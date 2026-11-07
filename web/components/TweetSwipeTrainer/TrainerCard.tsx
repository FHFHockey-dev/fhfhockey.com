import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { TrainerExtraction, TrainerLine, TrainerPlayerMatch, TrainerSlotValue } from "lib/sources/tweetSwipeTrainer";
import type { TrainerCard as TrainerCardData } from "lib/sources/tweetSwipeTrainerServer";

import PlayerCombobox from "./PlayerCombobox";
import {
  AliasRefusedError,
  aliasRefusalText,
  aliasScopeLabel,
  assignCardNameOnce,
  CONTEXT_LABELS,
  foldName,
  gameLabel,
  positionGroupFor,
  resolveCardName,
  SCOPE_LABELS,
  TYPE_LABELS,
  type TrainerPlayerOption,
  type TrainerTeamOption
} from "./trainerApi";

export { foldName };
import styles from "./TweetSwipeTrainer.module.scss";

const BASIS_LABELS: Record<TrainerPlayerMatch["basis"], string> = {
  full_name: "full name",
  alias: "alias",
  initial: "initial",
  surname: "surname only",
  ambiguous: "ambiguous",
  conflicting_membership: "other team",
  missing: "no player"
};

// Same bands as the server (CONFIDENCE_BANDS): 85+ likely correct, 60-84 amber, below 60 red.
// The review categories are stored as caps enums ("LINE COMBINATION"); content reads in sentence case.
export function sentenceCase(value: string): string {
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const FILTER_LABELS: Record<string, string> = {
  accepted: "NHL filter passed",
  rejected_ambiguous: "No single NHL team found",
  rejected_non_nhl: "Not an NHL tweet",
  rejected_insufficient_text: "No text to read"
};

// Penalties read with a true minus sign: "−11", not "-11".
function minus(points: number): string {
  return points < 0 ? `\u2212${Math.abs(points)}` : String(points);
}

export function confidenceTone(score: number): "high" | "mid" | "low" {
  return score >= 85 ? "high" : score >= 60 ? "mid" : "low";
}

function formatPostedAt(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;
}

export function findPlayerByName(players: TrainerPlayerOption[], name: string): TrainerPlayerOption | null {
  const key = foldName(name);
  return key ? players.find((player) => foldName(player.fullName) === key) ?? null : null;
}

/** Likely players for an unknown name: initials ("MBN" → Michael Brandsegg-Nygård) or a surname prefix ("Drai"). */
export function suggestPlayers(raw: string, players: TrainerPlayerOption[], teamId: number | null, limit = 4): TrainerPlayerOption[] {
  const text = raw.replace(/[.'’]/g, "").trim();
  const folded = foldName(text);
  if (!folded) return [];
  const isInitials = /^[A-Z]{2,4}$/.test(text);
  const matches = players.filter((player) => {
    const parts = foldName(player.fullName).split(/[\s-]+/).filter(Boolean);
    if (isInitials) return parts.map((part) => part[0]).join("") === folded;
    return folded.length >= 3 && parts.slice(1).some((part) => part.startsWith(folded));
  });
  // Nothing starts with it: try close spellings of a surname, since tweets have typos ("Kuluch" for Kulich).
  const close =
    matches.length || isInitials || folded.length < 4
      ? []
      : players.filter((player) =>
          foldName(player.fullName)
            .split(/[\s-]+/)
            .slice(1)
            .some((part) => Math.abs(part.length - folded.length) <= 2 && editDistance(part, folded) <= (folded.length >= 6 ? 2 : 1))
        );
  const found = matches.length ? matches : close;
  return [...found.filter((player) => player.team_id === teamId), ...found.filter((player) => player.team_id !== teamId)].slice(0, limit);
}

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + (left[i - 1] === right[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[right.length]!;
}

type FixTarget = { rawName: string; match: TrainerPlayerMatch | null; unresolvedId: string | null };

function NameFixPanel(props: {
  card: TrainerCardData;
  target: FixTarget;
  players: TrainerPlayerOption[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { target } = props;
  const [playerName, setPlayerName] = useState(target.match?.fullName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the alias tool refused a shared surname: the name can still be assigned for this tweet only.
  const [refused, setRefused] = useState<{ unresolvedId: string; playerId: number; scoped: boolean } | null>(null);
  const player = findPlayerByName(props.players, playerName);
  const isConfirm = Boolean(target.match?.playerId && player?.id === target.match.playerId);
  const surnameAlreadyMatched = isConfirm && target.match?.basis === "surname";

  async function assignOnce() {
    if (!refused) return;
    setBusy(true);
    try {
      props.onSaved(await assignCardNameOnce({ unresolvedId: refused.unresolvedId, playerId: refused.playerId, rawName: target.rawName }));
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Couldn't assign it.");
    } finally {
      setBusy(false);
    }
  }

  const group = positionGroupFor(player?.position);
  const scope = group ? aliasScopeLabel(props.card.parse.teamAbbreviation, group) : null;

  // A shared surname is refused as a blanket alias; it can still be learned for this team's F, D or G.
  async function save(scoped = false) {
    if (!player) return;
    setBusy(true);
    setError(null);
    try {
      const message = await resolveCardName({
        card: props.card,
        rawName: target.rawName,
        playerId: player.id,
        unresolvedId: refused?.unresolvedId ?? target.unresolvedId,
        reason: !target.match || target.match.playerId == null ? "trainer_unmatched" : isConfirm ? "trainer_near_match" : "trainer_wrong_match",
        positionGroup: scoped ? group : null
      });
      setRefused(null);
      props.onSaved(message);
    } catch (saveError) {
      if (saveError instanceof AliasRefusedError && saveError.canAssignOnce) {
        setRefused({ unresolvedId: saveError.unresolvedId, playerId: player.id, scoped });
        setError(scoped ? `${saveError.message} Use it for this tweet only instead.` : aliasRefusalText(target.rawName, player.fullName, scope));
      } else setError(saveError instanceof Error ? saveError.message : "Alias save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.fixPanel} role="group" aria-label={`Fix the name ${target.rawName}`}>
      <p className={styles.fixLead}>
        Tweet says <strong>&ldquo;{target.rawName}&rdquo;</strong>
        {target.match?.fullName ? <> · parser matched {target.match.fullName}</> : <> · parser found no player</>}
      </p>
      <label className={styles.fieldLabel}>
        <span>Player it means</span>
        <PlayerCombobox
          value={playerName}
          onChange={setPlayerName}
          players={props.players}
          teamId={props.card.parse.teamId}
          teamLabel={props.card.parse.teamAbbreviation}
          ariaLabel={`Player ${target.rawName} means`}
          placeholder="Type a player name"
          inputProps={{ autoFocus: true }}
        />
      </label>
      {error ? <p className={styles.fixError} role="alert">{error}</p> : null}
      <div className={styles.fixActions}>
        <button type="button" className={styles.primaryButton} disabled={!player || busy} onClick={() => void save()}>
          {busy ? "Saving…" : isConfirm ? "Confirm and save alias" : "Save alias"}
        </button>
        {refused && !refused.scoped && scope ? (
          <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void save(true)}>
            Learn for {scope} only
          </button>
        ) : null}
        {refused ? (
          <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void assignOnce()}>
            Use for this tweet only
          </button>
        ) : null}
        <button type="button" className={styles.ghostButton} onClick={props.onClose}>Cancel</button>
      </div>
      <p className={styles.fixHint}>
        {surnameAlreadyMatched
          ? `The parser already matches “${target.rawName}” by surname on this team's roster, so this needs no alias. Save one only if it keeps picking the wrong player.`
          : `Saving teaches “${target.rawName}” as an alias, so future mentions resolve too.`}
      </p>
    </div>
  );
}

/** Names TJ placed on the card itself (spots the parser left empty). Any placement turns the verdict into a correction. */
export type CardPlacements = {
  starter: TrainerSlotValue | null;
  backup: TrainerSlotValue | null;
  extraForwards: TrainerSlotValue[];
  extraDefensemen: TrainerSlotValue[];
  /**
   * Set once a goalie was moved on the card: starter and backup then replace the parser's goalies (null = empty).
   * Until then they only fill spots the parser left empty.
   */
  goaliesSet?: boolean;
};

/** A power-play tweet: its spots are PP1 and PP2. (The lib has the same check; it can't load in the browser.) */
export const isPowerPlaySubcategory = (subcategory: string | null | undefined) => Boolean(subcategory?.startsWith("POWER PLAY"));

export const EMPTY_PLACEMENTS: CardPlacements = { starter: null, backup: null, extraForwards: [], extraDefensemen: [] };

export function hasPlacements(placements: CardPlacements | undefined): boolean {
  return Boolean(
    placements &&
      (placements.goaliesSet || placements.starter || placements.backup || placements.extraForwards.length || placements.extraDefensemen.length)
  );
}

const slotKey = (slot: TrainerSlotValue) => (slot.playerId != null ? `id:${slot.playerId}` : `name:${foldName(slot.name)}`);

/** The parser's answer plus the card placements: what "Save with placements" stores and where the editor starts. */
export function mergePlacements(extraction: TrainerExtraction, placements: CardPlacements | undefined): TrainerExtraction {
  if (!placements || !hasPlacements(placements)) return extraction;
  const starter = placements.goaliesSet ? placements.starter : extraction.goalies[0] ?? placements.starter;
  const backup = placements.goaliesSet ? placements.backup : extraction.goalies[1] ?? placements.backup;
  const goalies = [starter, backup].filter((slot): slot is TrainerSlotValue => Boolean(slot));
  const extraForwards = [...(extraction.extraForwards ?? []), ...placements.extraForwards];
  const extraDefensemen = [...(extraction.extraDefensemen ?? []), ...placements.extraDefensemen];
  const players = new Map(extraction.players.map((slot) => [slotKey(slot), slot]));
  for (const slot of [...goalies, ...extraForwards, ...extraDefensemen]) if (slot.playerId != null) players.set(slotKey(slot), slot);
  return { ...extraction, goalies, extraForwards, extraDefensemen, players: [...players.values()] };
}

// Drags from a name on the card carry this type, so spots only accept names from the card.
const PLACE_TYPE = "application/x-fhfh-card-name";

// The audit links any match below 70 to the alias fix; above that a quiet "Fix" is enough.
const NEEDS_REVIEW_BELOW = 70;

function PlayerChip(props: {
  match: TrainerPlayerMatch;
  onFix: () => void;
  /** Names the parser didn't place can be picked (or dragged) onto a spot instead. */
  onPick?: () => void;
  picked?: boolean;
  placedIn?: string | null;
}) {
  const { match } = props;
  const tone = confidenceTone(match.confidence);
  const uncertain = match.confidence < NEEDS_REVIEW_BELOW;
  // The literal is worth showing only when it isn't simply the surname or full name.
  const showRaw = Boolean(match.fullName) && !["full_name", "surname"].includes(match.basis) && match.raw !== match.fullName;
  const positionNote = match.positionFits === false ? `; position ${match.position} doesn't fit this slot` : "";
  // Say what the parser found in words: "matched by surname only", never "matched by no match".
  const found =
    match.playerId != null
      ? `matched to ${match.fullName} by ${BASIS_LABELS[match.basis]} (${match.confidence})${positionNote}`
      : match.basis === "ambiguous" || match.basis === "conflicting_membership"
        ? `${match.candidateIds.length || "several"} players could fit, none chosen`
        : "no player matched";
  const action = match.playerId == null ? "Fix" : uncertain ? "Confirm or fix" : "Fix";
  const pickable = Boolean(props.onPick);
  const classes = [styles.playerChip, styles[`chip_${tone}`], props.picked ? styles.chipPicked : ""].filter(Boolean).join(" ");
  // The whole chip opens the fix panel; only matches that need review carry a visible tag.
  return (
    <button
      type="button"
      className={classes}
      onClick={pickable ? props.onPick : props.onFix}
      data-swipe-ok=""
      draggable={pickable || undefined}
      onDragStart={
        pickable
          ? (event) => {
              event.dataTransfer.setData(PLACE_TYPE, JSON.stringify({ playerId: match.playerId, name: match.fullName ?? match.raw }));
              event.dataTransfer.effectAllowed = "move";
              props.onPick?.();
            }
          : undefined
      }
      aria-pressed={pickable ? Boolean(props.picked) : undefined}
      aria-label={
        pickable
          ? `${props.picked ? "Picked" : "Pick"} ${match.fullName ?? match.raw} to place${props.placedIn ? `, placed as ${props.placedIn}` : ""}: ${found}`
          : `${action} ${match.raw}: ${found}`
      }
      title={
        pickable
          ? "Click, then click a dotted spot (or drag it there)."
          : `${found.charAt(0).toUpperCase()}${found.slice(1)}. Click to ${action.toLowerCase()}.`
      }
    >
      <span className={styles.chipName}>
        {match.fullName ?? <>&ldquo;{match.raw}&rdquo;</>}
        {showRaw ? <span className={styles.chipRaw}> &ldquo;{match.raw}&rdquo;</span> : null}
      </span>
      <span className={styles.chipScore}>
        {match.confidence}
        <span className={styles.chipBasis}>
          {" "}
          {BASIS_LABELS[match.basis]}
          {match.positionFits === false ? ` · pos ${match.position}?` : ""}
        </span>
      </span>
      {props.placedIn ? <span className={styles.placedTag}>{props.placedIn}</span> : null}
      {uncertain && !pickable ? <span className={styles.chipFixStrong}>{match.playerId != null ? "Confirm" : "Fix"}</span> : null}
    </button>
  );
}

/**
 * A spot to fill: click it (with a name picked) or drop a name on it. An empty spot can also search the roster for a
 * player the parser never named. Beside a filled spot it offers to swap the picked name in.
 */
function PlaceSpot(props: {
  label: string;
  picked: TrainerPlayerMatch | null;
  onPlace: (slot: TrainerSlotValue) => void;
  /** Who sits there now; the picked name swaps with them. */
  occupant?: string | null;
  /** For the roster search on an empty spot. */
  players?: TrainerPlayerOption[];
  teamId?: number | null;
  teamLabel?: string | null;
}) {
  const [over, setOver] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const pickedName = props.picked ? props.picked.fullName ?? props.picked.raw : null;
  if (props.occupant && !pickedName) return null;
  if (searching && props.players) {
    return (
      <span className={styles.spotSearch}>
        <PlayerCombobox
          value={query}
          onChange={(value) => {
            setQuery(value);
            const player = props.players!.find((candidate) => candidate.fullName === value);
            if (player) {
              props.onPlace({ playerId: player.id, name: player.fullName });
              setSearching(false);
              setQuery("");
            }
          }}
          players={props.players}
          teamId={props.teamId ?? null}
          teamLabel={props.teamLabel ?? null}
          ariaLabel={`Search a player for ${props.label}`}
          placeholder="Search players"
          className={styles.slotInput}
          inputProps={{ autoFocus: true, onKeyDown: (event) => event.key === "Escape" && setSearching(false) }}
        />
        <button type="button" className={styles.linkButton} onClick={() => setSearching(false)}>Cancel</button>
      </span>
    );
  }
  const classes = [styles.placeSpot, pickedName ? styles.placeSpotReady : "", over ? styles.placeSpotOver : ""].filter(Boolean).join(" ");
  const spot = (
    <button
      type="button"
      className={classes}
      aria-label={
        pickedName
          ? `${props.label}: place ${pickedName} here${props.occupant ? `, swapping with ${props.occupant}` : ""}`
          : `${props.label}: empty. Pick a name first, or drag one here`
      }
      onClick={() => {
        if (props.picked) props.onPlace({ playerId: props.picked.playerId, name: pickedName! });
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(PLACE_TYPE)) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        const data = event.dataTransfer.getData(PLACE_TYPE);
        setOver(false);
        if (!data) return;
        event.preventDefault();
        props.onPlace(JSON.parse(data) as TrainerSlotValue);
      }}
    >
      {pickedName ? (props.occupant ? `Swap in ${pickedName}` : `Place ${pickedName}`) : "Empty"}
    </button>
  );
  if (props.occupant || !props.players || pickedName) return spot;
  return (
    <span className={styles.spotSearch}>
      {spot}
      <button type="button" className={styles.linkButton} onClick={() => setSearching(true)} aria-label={`Search a player for ${props.label}`}>
        Search
      </button>
    </span>
  );
}

function PlacedName(props: { slot: TrainerSlotValue; where: string; onRemove: () => void }) {
  return (
    <span className={styles.placedName}>
      {props.slot.name}
      <button type="button" className={styles.placedRemove} aria-label={`Remove ${props.slot.name} from ${props.where}`} onClick={props.onRemove}>
        ×
      </button>
    </span>
  );
}

function LineRows(props: {
  title: string;
  prefix: string;
  lines: TrainerLine[];
  onFix: (match: TrainerPlayerMatch) => void;
  onPick: (match: TrainerPlayerMatch) => void;
  isPicked: (match: TrainerPlayerMatch) => boolean;
  placedIn: (match: TrainerPlayerMatch) => string | null;
  /** Power-play units hold five spots, so they get a five-column row. */
  wide?: boolean;
}) {
  if (!props.lines.length) return null;
  let keptIndex = 0;
  return (
    <div className={styles.slotGroup}>
      <h3 className={styles.slotTitle}>{props.title}</h3>
      {props.lines.map((line, index) => {
        const label = line.kept ? `${props.prefix}${++keptIndex}` : "Dropped";
        return (
          <div key={`${label}-${index}`} className={line.kept ? styles.slotRow : `${styles.slotRow} ${styles.slotRowDropped}`}>
            <span className={styles.slotLabel}>{label}</span>
            <div className={`${styles.slotChips} ${styles.lineGrid}${props.wide ? ` ${styles.lineGridWide}` : ""}`}>
              {line.slots.map((slot, slotIndex) =>
                line.kept ? (
                  <PlayerChip key={`${slot.raw}-${slotIndex}`} match={slot} onFix={() => props.onFix(slot)} />
                ) : (
                  // Dropped candidates can be placed as extras or a goalie spot.
                  <PlayerChip
                    key={`${slot.raw}-${slotIndex}`}
                    match={slot}
                    onFix={() => props.onFix(slot)}
                    onPick={() => props.onPick(slot)}
                    picked={props.isPicked(slot)}
                    placedIn={props.placedIn(slot)}
                  />
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TrainerCard(props: {
  card: TrainerCardData;
  players: TrainerPlayerOption[];
  onAliasSaved: (message: string) => void;
  /** While correcting, the editor takes the extraction's place beside the tweet. */
  editor?: ReactNode;
  placements?: CardPlacements;
  onPlacementsChange?: (next: CardPlacements) => void;
  /** For naming the opponent in the game binding. */
  teams?: TrainerTeamOption[];
}) {
  const { card } = props;
  const { parse } = card;
  const [fixTarget, setFixTarget] = useState<FixTarget | null>(null);
  const [picked, setPicked] = useState<TrainerPlayerMatch | null>(null);
  const placements = props.placements ?? EMPTY_PLACEMENTS;
  const sameName = (left: TrainerSlotValue, right: TrainerSlotValue) => slotKey(left) === slotKey(right);
  const asSlot = (match: TrainerPlayerMatch): TrainerSlotValue => ({ playerId: match.playerId, name: match.fullName ?? match.raw });
  // Who sits in each goalie spot: the parser's goalies until one is moved on the card, then the card's.
  const goalieAt = (spot: "starter" | "backup"): TrainerSlotValue | null => {
    if (placements.goaliesSet) return placements[spot];
    const parsed = card.parse.goalies[spot === "starter" ? 0 : 1];
    return parsed ? asSlot(parsed) : placements[spot];
  };
  const placedIn = (match: TrainerPlayerMatch): string | null => {
    const slot = asSlot(match);
    const starter = goalieAt("starter");
    const backup = goalieAt("backup");
    if (starter && sameName(starter, slot)) return "Starter";
    if (backup && sameName(backup, slot)) return "Backup";
    if (placements.extraForwards.some((entry) => sameName(entry, slot))) return "Extra F";
    if (placements.extraDefensemen.some((entry) => sameName(entry, slot))) return "Extra D";
    return null;
  };
  type Spot = "starter" | "backup" | "extraForwards" | "extraDefensemen";
  /**
   * Places a name in one spot; it leaves any other spot it was in. Moving a goalie onto the other goalie spot swaps
   * the two (Ellis from Starter to Backup puts whoever was Backup in Starter).
   */
  function place(spot: Spot, slot: TrainerSlotValue) {
    const without = (list: TrainerSlotValue[]) => list.filter((entry) => !sameName(entry, slot));
    const starter = goalieAt("starter");
    const backup = goalieAt("backup");
    const from = starter && sameName(starter, slot) ? "starter" : backup && sameName(backup, slot) ? "backup" : null;
    const goalies = { starter, backup };
    if (from) goalies[from] = null;
    if (spot === "starter" || spot === "backup") {
      const occupant = goalies[spot];
      goalies[spot] = slot;
      if (from && occupant && !sameName(occupant, slot)) goalies[from] = occupant;
    }
    const next: CardPlacements = {
      ...goalies,
      // Goalie spots now follow the card, so a moved parser goalie isn't drawn back into its old spot.
      goaliesSet: placements.goaliesSet || Boolean(from) || card.parse.goalies.length > 0 && (spot === "starter" || spot === "backup"),
      extraForwards: without(placements.extraForwards),
      extraDefensemen: without(placements.extraDefensemen)
    };
    if (spot === "extraForwards" || spot === "extraDefensemen") next[spot] = [...next[spot], slot];
    props.onPlacementsChange?.(next);
    setPicked(null);
  }
  function unplace(spot: Spot, slot: TrainerSlotValue) {
    if (spot === "starter" || spot === "backup") {
      props.onPlacementsChange?.({ ...placements, starter: goalieAt("starter"), backup: goalieAt("backup"), [spot]: null, goaliesSet: true });
      return;
    }
    props.onPlacementsChange?.({ ...placements, [spot]: placements[spot].filter((entry) => !sameName(entry, slot)) });
  }
  // A placed or parsed name in a spot, as a match the pick state and chips understand.
  const matchFor = (slot: TrainerSlotValue): TrainerPlayerMatch =>
    card.parse.players.find((match) => sameName(asSlot(match), slot)) ??
    card.parse.goalies.find((match) => sameName(asSlot(match), slot)) ?? {
      raw: slot.name,
      playerId: slot.playerId,
      fullName: slot.playerId != null ? slot.name : null,
      position: null,
      basis: slot.playerId != null ? "full_name" : "missing",
      confidence: slot.playerId != null ? 100 : 0,
      positionFits: null,
      candidateIds: []
    };
  const pick = (match: TrainerPlayerMatch) =>
    setPicked((current) => (current && sameName(asSlot(current), asSlot(match)) ? null : match));
  const isPicked = (match: TrainerPlayerMatch) => Boolean(picked && sameName(asSlot(picked), asSlot(match)));
  useEffect(() => {
    if (!picked) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setPicked(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked]);
  const [showSignals, setShowSignals] = useState(false);
  const tone = parse.confidence.band;
  const isLineCombo = parse.type === "line_combination";
  // A power-play tweet shows its PP1/PP2 units; the even-strength spots (goalies, extras) don't apply to it.
  const isPowerPlay = isLineCombo && isPowerPlaySubcategory(parse.subcategory);
  const otherPlayers = isLineCombo
    ? parse.players.filter(
        (player) =>
          // Anyone already shown in a line, kept or dropped, isn't repeated here.
          ![...parse.forwards, ...parse.defensePairs, ...parse.powerPlay].some((line) => line.slots.some((slot) => slot.playerId != null && slot.playerId === player.playerId)) &&
          // A parser goalie moved out of both goalie spots comes back here to be placed again.
          !(parse.goalies.some((goalie) => goalie.playerId === player.playerId) && placedIn(player)) &&
          !parse.extras.some((extra) => extra.playerId === player.playerId)
      )
    : parse.players;
  const openFix = (match: TrainerPlayerMatch) => setFixTarget({ rawName: match.raw, match, unresolvedId: null });

  return (
    <article className={styles.card} aria-label={`Tweet by ${card.authorHandle ?? card.sourceAccount ?? "unknown"}`}>
      <header className={styles.cardHeader}>
        <div className={styles.byline}>
          <h2 className={styles.author}>{card.authorName ?? card.authorHandle ?? card.sourceAccount ?? "Unknown author"}</h2>
          {card.authorHandle && card.authorName ? <span className={styles.handle}>{card.authorHandle}</span> : null}
          {card.repostedBy ? (
            <span className={styles.repost}>
              Reposted by {card.repostedBy} · original by {card.originalAuthor ?? "unknown"}
            </span>
          ) : null}
          <span className={styles.meta}>
            {[card.sourceAccount && `via ${card.sourceAccount}`, formatPostedAt(card.postedAt), card.postKind === "quote" ? "quote" : null]
              .filter(Boolean)
              .join(" · ")}
            {card.tweetUrl ? (
              <>
                {" · "}
                <a href={card.tweetUrl} target="_blank" rel="noreferrer">open on X</a>
              </>
            ) : null}
          </span>
        </div>
        <button
          type="button"
          className={`${styles.confidence} ${styles[`confidence_${tone}`]}`}
          onClick={() => setShowSignals((value) => !value)}
          aria-expanded={showSignals}
          aria-label={`Confidence ${parse.confidence.score} of 100. Show how it was scored.`}
        >
          <span className={styles.confidenceScore}>{parse.confidence.score}</span>
          <span className={styles.confidenceLabel}>confidence</span>
        </button>
      </header>

      {showSignals ? (
        <ul className={styles.signals}>
          <li>
            <span>Start</span>
            <span>100</span>
          </li>
          {parse.confidence.signals.map((signal) => (
            <li key={signal.label}>
              <span>{signal.label}</span>
              <span>{minus(signal.points)}</span>
            </li>
          ))}
          {!parse.confidence.signals.length ? <li><span>No penalties</span><span>0</span></li> : null}
        </ul>
      ) : parse.confidence.signals.length ? (
        <p className={styles.metaText}>
          Why {parse.confidence.score}:{" "}
          {[...parse.confidence.signals]
            .sort((left, right) => left.points - right.points)
            .slice(0, 3)
            .map((signal) => `${signal.label} (${minus(signal.points)})`)
            .join(" · ")}
        </p>
      ) : null}

      <div className={styles.cardBody}>
      <div className={styles.tweetColumn}>
      {parse.imageOnly ? (
        <p className={styles.imageOnly} role="note">
          Image-only tweet: the text alone can&rsquo;t show the lines, so the parser can&rsquo;t judge it. Open it on X to check.
        </p>
      ) : null}

      <p className={styles.tweetText}>{card.text}</p>
      {card.quotedText ? (
        <blockquote className={styles.quoted}>
          {card.quotedAuthor ? <span className={styles.quotedBy}>Quoting {card.quotedAuthor}</span> : null}
          {card.quotedText}
        </blockquote>
      ) : null}
      </div>

      <div className={styles.extractionColumn}>
      {props.editor ?? (
      <>
      <section className={styles.extraction} aria-label="What the parser extracted">
        <div className={styles.extractionHead}>
          {TYPE_LABELS[parse.type] !== sentenceCase(parse.category) ? (
            <span className={styles.typePill}>{TYPE_LABELS[parse.type]}</span>
          ) : null}
          <span className={styles.categoryText}>
            {sentenceCase(parse.category)}
            {parse.subcategory ? ` › ${sentenceCase(parse.subcategory)}` : ""}
          </span>
          <span className={styles.metaText}>
            {parse.teamAbbreviation ?? "No team"} · {FILTER_LABELS[parse.filterStatus] ?? sentenceCase(parse.filterStatus.replace(/_/g, " "))}
            {parse.phraseHits.length ? ` · rule ${parse.phraseHits[0]!.ruleId} (${parse.phraseHits[0]!.tier} tier)` : ""}
          </span>
          {isLineCombo || parse.type === "goalie" ? (
            // Part of the answer: "Correct" means these are right too.
            <span className={styles.metaText} aria-label="Context, scope and game">
              {parse.context ? CONTEXT_LABELS[parse.context] : "No context"}
              {isLineCombo ? ` · ${parse.scope ? SCOPE_LABELS[parse.scope] : "No scope"}` : ""}
              {` · ${gameLabel(parse.game, props.teams)}`}
            </span>
          ) : null}
        </div>
        {parse.powerPlaySwaps.length ? (
          <ul className={styles.swapList} aria-label="Power-play changes">
            {parse.powerPlaySwaps.map((swap) => (
              <li key={swap.unit}>
                PP{swap.unit}: in {swap.in.map((slot) => slot.name).join(", ") || "nobody named"}; out{" "}
                {swap.out.map((slot) => slot.name).join(", ") || "nobody named"}
              </li>
            ))}
          </ul>
        ) : null}

        {isLineCombo && !isPowerPlay ? (
          <p className={styles.pickHint} aria-live="polite">
            {picked ? (
              <>
                Placing <strong>{picked.fullName ?? picked.raw}</strong>: click a dotted spot (or drag it there), Esc to cancel.{" "}
                <button type="button" className={styles.linkButton} onClick={() => openFix(picked)}>
                  Fix this name
                </button>
              </>
            ) : (
              "Missed or misplaced a goalie or extra? Click a name (goalies too), then its spot; a filled goalie spot swaps. Search finds anyone the parser missed."
            )}
          </p>
        ) : null}
        {isLineCombo ? (
          <>
            <LineRows title="Forward lines" prefix="L" lines={parse.forwards} onFix={openFix} onPick={pick} isPicked={isPicked} placedIn={placedIn} />
            <LineRows title="Defence pairs" prefix="D" lines={parse.defensePairs} onFix={openFix} onPick={pick} isPicked={isPicked} placedIn={placedIn} />
            <LineRows title="Power play" prefix="PP" lines={parse.powerPlay} onFix={openFix} onPick={pick} isPicked={isPicked} placedIn={placedIn} wide />
          </>
        ) : null}
        {isPowerPlay && !parse.powerPlay.length ? (
          <p className={styles.pickHint}>The parser found no power-play units. Mark it wrong to fill PP1 and PP2.</p>
        ) : null}
        {isLineCombo && !isPowerPlay ? (
          <>
            {/* Always shown on lineups, so a missed starter, backup or extra is visible, not just absent. */}
            <div className={styles.slotGroup}>
              <h3 className={styles.slotTitle}>Goalies</h3>
              {(["Starter", "Backup"] as const).map((role) => {
                const spot = role === "Starter" ? "starter" : "backup";
                const occupant = goalieAt(spot);
                const match = occupant ? matchFor(occupant) : null;
                return (
                  <div key={role} className={`${styles.slotRow} ${styles.slotRowRole}`}>
                    <span className={styles.slotLabel}>{role}</span>
                    <div className={styles.slotChips}>
                      {occupant && match ? (
                        // A goalie in a spot can be picked (or dragged) and moved; the other goalie spot swaps.
                        <PlayerChip match={match} onFix={() => openFix(match)} onPick={() => pick(match)} picked={isPicked(match)} />
                      ) : null}
                      {occupant ? (
                        <button type="button" className={styles.placedRemove} aria-label={`Remove ${occupant.name} from ${role.toLowerCase()} goalie`} onClick={() => unplace(spot, occupant)}>
                          ×
                        </button>
                      ) : null}
                      {occupant && picked && sameName(asSlot(picked), occupant) ? null : (
                        <PlaceSpot
                          label={`${role} goalie`}
                          picked={picked}
                          occupant={occupant?.name ?? null}
                          onPlace={(slot) => place(spot, slot)}
                          players={props.players}
                          teamId={parse.teamId}
                          teamLabel={parse.teamAbbreviation}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* The parser doesn't read extras yet: these spots let TJ teach it. They can stay empty. */}
            {(
              [
                ["extraForwards", "Extra forwards"],
                ["extraDefensemen", "Extra defensemen"]
              ] as const
            ).map(([spot, title]) => (
              <div key={spot} className={styles.slotGroup}>
                <h3 className={styles.slotTitle}>{title}</h3>
                <div className={styles.slotChips}>
                  {placements[spot].map((slot) => (
                    <PlacedName key={slotKey(slot)} slot={slot} where={title.toLowerCase()} onRemove={() => unplace(spot, slot)} />
                  ))}
                  <PlaceSpot
                    label={title}
                    picked={picked}
                    onPlace={(slot) => place(spot, slot)}
                    players={props.players}
                    teamId={parse.teamId}
                    teamLabel={parse.teamAbbreviation}
                  />
                </div>
              </div>
            ))}
          </>
        ) : parse.goalies.length ? (
          <div className={styles.slotGroup}>
            <h3 className={styles.slotTitle}>Goalies</h3>
            <div className={styles.slotChips}>
              {parse.goalies.map((goalie, index) => (
                <PlayerChip key={`${goalie.raw}-${index}`} match={goalie} onFix={() => openFix(goalie)} />
              ))}
            </div>
          </div>
        ) : null}
        {parse.extras.length ? (
          <div className={styles.slotGroup}>
            <h3 className={styles.slotTitle}>Scratches and injuries</h3>
            <div className={styles.slotChips}>
              {parse.extras.map((extra, index) => (
                <PlayerChip key={`${extra.raw}-${index}`} match={extra} onFix={() => openFix(extra)} />
              ))}
            </div>
          </div>
        ) : null}
        {otherPlayers.some((match) => !isLineCombo || !placedIn(match)) ? (
          <div className={styles.slotGroup}>
            <h3 className={styles.slotTitle}>{isLineCombo ? "Other names" : "Players matched"}</h3>
            <div className={styles.slotChips}>
              {otherPlayers
                .filter((match) => !isLineCombo || !placedIn(match))
                .map((match, index) =>
                  isLineCombo ? (
                    <PlayerChip
                      key={`${match.raw}-${index}`}
                      match={match}
                      onFix={() => openFix(match)}
                      onPick={() => pick(match)}
                      picked={isPicked(match)}
                    />
                  ) : (
                    <PlayerChip key={`${match.raw}-${index}`} match={match} onFix={() => openFix(match)} />
                  )
                )}
            </div>
          </div>
        ) : null}
        {!parse.players.length && !parse.goalies.length ? <p className={styles.metaText}>No players extracted.</p> : null}

        {card.unresolvedNames.length ? (
          <div className={styles.slotGroup}>
            <h3 className={styles.slotTitle}>Names waiting in the alias queue</h3>
            <div className={styles.slotChips}>
              {card.unresolvedNames.map((name) => (
                <button
                  key={name.id}
                  type="button"
                  className={styles.queuedName}
                  onClick={() => setFixTarget({ rawName: name.rawName, match: null, unresolvedId: name.id })}
                >
                  {name.rawName} · resolve
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {fixTarget ? (
        <NameFixPanel
          key={`${fixTarget.rawName}-${fixTarget.unresolvedId ?? ""}`}
          card={card}
          target={fixTarget}
          players={props.players}
          onClose={() => setFixTarget(null)}
          onSaved={(message) => {
            setFixTarget(null);
            props.onAliasSaved(message);
          }}
        />
      ) : null}
      </>
      )}
      </div>
      </div>
    </article>
  );
}
