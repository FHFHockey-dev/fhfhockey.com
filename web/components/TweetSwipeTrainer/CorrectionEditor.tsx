import { Fragment, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";

import type {
  TrainerContext,
  TrainerExtraction,
  TrainerGameBinding,
  TrainerPowerPlaySwap,
  TrainerScope,
  TrainerSlotValue,
  TrainerType
} from "lib/sources/tweetSwipeTrainer";
import type { TrainerCard } from "lib/sources/tweetSwipeTrainerServer";

import PlayerCombobox from "./PlayerCombobox";
import { findPlayerByName, foldName, isPowerPlaySubcategory, sentenceCase, suggestPlayers } from "./TrainerCard";
import {
  AliasRefusedError,
  aliasRefusalText,
  aliasScopeLabel,
  assignCardNameOnce,
  CONTEXT_LABELS,
  CONTEXT_ORDER,
  offRosterNote,
  positionGroupFor,
  resolveCardName,
  SCOPE_LABELS,
  SCOPE_ORDER,
  type TrainerCategoryOption,
  type TrainerPlayerOption,
  type TrainerTeamOption
} from "./trainerApi";
import styles from "./TweetSwipeTrainer.module.scss";

const FORWARD_LINES = 4;
const DEFENSE_PAIRS = 3;
// Starter, backup and an extra (third) goalie when a lineup lists one.
const GOALIE_ROLES = ["Starter", "Backup", "Extra"] as const;
// Slots read left to right as the tweet lists them, which beat writers write as LW-C-RW and LD-RD.
const FORWARD_SPOTS = ["LW", "C", "RW"] as const;
const DEFENSE_SPOTS = ["LD", "RD"] as const;
// Power-play units as beat writers list them: QB-LW-RW-B-N.
const PP_UNITS = 2;
const PP_SPOTS = ["QB", "LW", "RW", "Bumper", "Net"] as const;
const PP_SPOT_NAMES = ["QB", "LW", "RW", "bumper", "net front"] as const;
// Drags carry this type so slots only accept names from the tray, not stray text.
const TRAY_TYPE = "application/x-fhfh-trainer-name";

type ListKind = "extraForwards" | "extraDefensemen" | "extras" | "others";
type SwapSide = "in" | "out";
type Target =
  | { kind: "forward"; row: number; col: number }
  | { kind: "pair"; row: number; col: number }
  | { kind: "pp"; row: number; col: number }
  | { kind: "goalie"; index: number }
  | { kind: "swap"; unit: number; side: SwapSide; index: number }
  | { kind: ListKind; index: number };

/** Per PP unit, who joins and who leaves, as editable name lists. */
type SwapDraft = Record<SwapSide, string[]>;
const emptySwaps = (): SwapDraft[] => Array.from({ length: PP_UNITS }, () => ({ in: [], out: [] }));

function typeForCategory(category: string): TrainerType {
  if (category === "LINE COMBINATION" || category === "LINEUP") return "line_combination";
  if (category === "GOALIE START") return "goalie";
  if (["INJURY", "SCRATCHES", "RETURN"].includes(category)) return "injury";
  if (category === "TRANSACTION") return "transaction";
  return "other";
}

/**
 * Which spots the editor shows. The category decides: a power-play tweet fills PP1 and PP2, a lineup fills lines,
 * pairs, goalies and extras, a goalie start fills the starter and backup, and anything else lists its players.
 */
type Layout = "lines" | "powerPlay" | "goalie" | "players";

function layoutFor(category: string, subcategory: string | null): Layout {
  const type = typeForCategory(category);
  if (type === "line_combination") return isPowerPlaySubcategory(subcategory) ? "powerPlay" : "lines";
  if (type === "goalie") return "goalie";
  return "players";
}

function names(slots: TrainerSlotValue[], size: number): string[] {
  return Array.from({ length: size }, (_, index) => slots[index]?.name ?? "");
}

function grid(lines: TrainerSlotValue[][], rows: number, size: number): string[][] {
  return Array.from({ length: rows }, (_, index) => names(lines[index] ?? [], size));
}

const key = (name: string) => foldName(name);

/** An unknown name, resolved right here through the alias tool, so later tweets match it too. */
function ResolveRow(props: {
  card: TrainerCard;
  raw: string;
  players: TrainerPlayerOption[];
  teamId: number | null;
  teamLabel: string | null;
  onResolved: (raw: string, player: TrainerPlayerOption, message: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refused, setRefused] = useState<{ unresolvedId: string; player: TrainerPlayerOption; scoped: boolean } | null>(null);
  const suggestions = useMemo(
    () => suggestPlayers(props.raw, props.players, props.teamId),
    [props.raw, props.players, props.teamId]
  );
  const player = findPlayerByName(props.players, draft);

  const scopeFor = (chosen: TrainerPlayerOption) => {
    const group = positionGroupFor(chosen.position);
    return group ? { group, label: aliasScopeLabel(props.teamLabel, group) } : null;
  };

  // A shared surname is refused as a blanket alias; it can still be learned for this team's F, D or G.
  async function save(chosen: TrainerPlayerOption, scoped = false) {
    setBusy(true);
    setError(null);
    try {
      const queued = props.card.unresolvedNames.find((name) => key(name.rawName) === key(props.raw));
      const message = await resolveCardName({
        card: props.card,
        rawName: props.raw,
        playerId: chosen.id,
        reason: "trainer_unmatched",
        unresolvedId: refused?.unresolvedId ?? queued?.id ?? null,
        positionGroup: scoped ? scopeFor(chosen)?.group ?? null : null
      });
      props.onResolved(props.raw, chosen, `${message}${offRosterNote(chosen, props.card)}`);
    } catch (saveError) {
      if (saveError instanceof AliasRefusedError && saveError.canAssignOnce) {
        setRefused({ unresolvedId: saveError.unresolvedId, player: chosen, scoped });
        setError(scoped ? `${saveError.message} Use it for this tweet only instead.` : aliasRefusalText(props.raw, chosen.fullName, scopeFor(chosen)?.label));
      } else setError(saveError instanceof Error ? saveError.message : "Alias save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function assignOnce() {
    if (!refused) return;
    setBusy(true);
    try {
      const message = await assignCardNameOnce({ unresolvedId: refused.unresolvedId, playerId: refused.player.id, rawName: props.raw });
      props.onResolved(props.raw, refused.player, message);
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Couldn't assign it.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.resolveRow} role="group" aria-label={`Resolve ${props.raw}`}>
      <p className={styles.resolveLead}>
        &ldquo;{props.raw}&rdquo; isn&rsquo;t a known player.
        {suggestions.length ? " Is it:" : " Who is it?"}
      </p>
      {suggestions.length ? (
        <div className={styles.slotChips}>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              className={styles.trayChip}
              disabled={busy}
              onClick={() => void save(suggestion)}
            >
              {suggestion.fullName}
            </button>
          ))}
        </div>
      ) : null}
      <div className={styles.editorListRow}>
        <PlayerCombobox
          className={styles.slotInput}
          value={draft}
          onChange={setDraft}
          players={props.players}
          teamId={props.teamId}
          teamLabel={props.teamLabel}
          ariaLabel={`Player ${props.raw} means`}
          placeholder="Another player"
        />
        <button type="button" className={styles.primaryButton} disabled={!player || busy} onClick={() => player && void save(player)}>
          {busy ? "Saving…" : "Save alias"}
        </button>
      </div>
      {error ? <p className={styles.fixError} role="alert">{error}</p> : null}
      {refused ? (
        <div className={styles.fixActions}>
          {!refused.scoped && scopeFor(refused.player) ? (
            <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void save(refused.player, true)}>
              Learn for {scopeFor(refused.player)!.label} only
            </button>
          ) : null}
          <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void assignOnce()}>
            Use {refused.player.fullName} for this tweet only
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SlotInput(props: {
  value: string;
  label: string;
  teamId: number | null;
  teamLabel: string | null;
  players: TrainerPlayerOption[];
  placing: string | null;
  onChange: (value: string) => void;
  onPlace: (name: string) => void;
  /** Picks this spot's name up to move it; another spot then takes it (a filled spot swaps). */
  onMove?: () => void;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // A long name shrinks its own text to fit the field (down to 10px) instead of scrolling inside it.
  useLayoutEffect(() => {
    const element = input.current;
    if (!element) return;
    const fit = () => {
      element.style.fontSize = "";
      let size = parseFloat(getComputedStyle(element).fontSize) || 14;
      while (element.scrollWidth > element.clientWidth && size > 10) {
        size -= 0.5;
        element.style.fontSize = `${size}px`;
      }
    };
    fit();
    // Refit when the field's width changes (window resize, layout switch).
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [props.value]);
  const known = !props.value.trim() || Boolean(findPlayerByName(props.players, props.value));
  const className = [
    styles.slotInput,
    known ? "" : styles.slotInputUnknown,
    props.placing ? styles.slotTarget : "",
    over ? styles.slotDropOver : ""
  ]
    .filter(Boolean)
    .join(" ");
  const field = (
    <PlayerCombobox
      inputRef={input}
      className={className}
      value={props.value}
      onChange={props.onChange}
      players={props.players}
      teamId={props.teamId}
      teamLabel={props.teamLabel}
      ariaLabel={props.label}
      inputProps={{
        // While a name is picked, a tap places it instead of opening the keyboard.
        readOnly: Boolean(props.placing),
        "aria-label": props.placing ? `${props.label}: place ${props.placing} here` : props.label,
        title: known ? undefined : "Not a known player name: it will be stored as text",
        onClick: () => {
          if (props.placing) props.onPlace(props.placing);
        },
        onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
          if (props.placing && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            props.onPlace(props.placing);
          }
        },
        onDragOver: (event: DragEvent<HTMLInputElement>) => {
          if (!event.dataTransfer.types.includes(TRAY_TYPE)) return;
          event.preventDefault();
          setOver(true);
        },
        onDragLeave: () => setOver(false),
        onDrop: (event: DragEvent<HTMLInputElement>) => {
          const name = event.dataTransfer.getData(TRAY_TYPE);
          setOver(false);
          if (!name) return;
          event.preventDefault();
          props.onPlace(name);
        }
      }}
    />
  );
  if (!props.onMove || !props.value.trim() || props.placing) return field;
  return (
    <>
      {field}
      <button
        type="button"
        draggable
        className={styles.moveButton}
        aria-label={`Move ${props.value}`}
        title="Move to another spot (click, then the spot; or drag)"
        onClick={props.onMove}
        onDragStart={(event) => {
          event.dataTransfer.setData(TRAY_TYPE, props.value);
          event.dataTransfer.setData("text/plain", props.value);
          event.dataTransfer.effectAllowed = "move";
          props.onMove?.();
        }}
      >
        ⇄
      </button>
    </>
  );
}

export default function CorrectionEditor(props: {
  card: TrainerCard;
  players: TrainerPlayerOption[];
  categoryOptions: TrainerCategoryOption[];
  busy: boolean;
  onCancel: () => void;
  onSave: (correction: TrainerExtraction, notes: string) => void;
  onAliasSaved: (message: string) => void;
  /** Where the editor starts: the parser's answer plus any names placed on the card. */
  start?: TrainerExtraction;
  teams?: TrainerTeamOption[];
}) {
  const start = props.start ?? props.card.extraction;
  const { parse } = props.card;
  const slotIds = new Set(
    [...start.forwards.flat(), ...start.defensePairs.flat(), ...start.goalies, ...start.extras].map((slot) => slot.playerId)
  );
  const [category, setCategory] = useState(start.category);
  // The team the tweet is about: the parser's guess, which TJ can correct. Player searches look at it first.
  const [teamId, setTeamId] = useState<number | null>(start.teamId ?? props.card.parse.teamId ?? null);
  const teamLabel = props.teams?.find((team) => team.id === teamId)?.abbreviation ?? (teamId === props.card.parse.teamId ? props.card.parse.teamAbbreviation : null);
  const [subcategory, setSubcategory] = useState(start.subcategory ?? "");
  const startLayout = layoutFor(start.category, start.subcategory);
  // Spots the starting layout doesn't show begin empty, so nothing saved is hidden from view.
  const shown = (visible: boolean, values: () => string[]) => (visible ? values() : []);
  const [forwards, setForwards] = useState(() => grid(startLayout === "lines" ? start.forwards : [], FORWARD_LINES, 3));
  const [pairs, setPairs] = useState(() => grid(startLayout === "lines" ? start.defensePairs : [], DEFENSE_PAIRS, 2));
  const [powerPlay, setPowerPlay] = useState(() =>
    grid(startLayout === "powerPlay" ? start.powerPlay ?? [] : [], PP_UNITS, PP_SPOTS.length)
  );
  // A "change only" power-play tweet names who joins and leaves a unit, never the unit's other spots.
  const [swaps, setSwaps] = useState<SwapDraft[]>(() => {
    const drafts = emptySwaps();
    if (startLayout !== "powerPlay") return drafts;
    for (const swap of start.powerPlaySwaps ?? []) {
      const draft = drafts[swap.unit - 1];
      if (!draft) continue;
      draft.in = swap.in.map((slot) => slot.name);
      draft.out = swap.out.map((slot) => slot.name);
    }
    return drafts;
  });
  const [context, setContext] = useState<TrainerContext | "">(start.context ?? "");
  const [scope, setScope] = useState<TrainerScope | "">(start.scope ?? "");
  const [opponentId, setOpponentId] = useState<number | null>(start.game?.opponentTeamId ?? null);
  const [gameDate, setGameDate] = useState(start.game?.date ?? "");
  // Tray names TJ marked as not players in this tweet (e.g. "power play" read as Owen Power).
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [addName, setAddName] = useState("");
  const [goalies, setGoalies] = useState(() =>
    names(startLayout === "lines" || startLayout === "goalie" ? start.goalies : [], GOALIE_ROLES.length)
  );
  const [extraForwards, setExtraForwards] = useState(() => shown(startLayout === "lines", () => (start.extraForwards ?? []).map((slot) => slot.name)));
  const [extraDefensemen, setExtraDefensemen] = useState(() => shown(startLayout === "lines", () => (start.extraDefensemen ?? []).map((slot) => slot.name)));
  const [extras, setExtras] = useState(() => shown(startLayout === "lines", () => start.extras.map((slot) => slot.name)));
  const [others, setOthers] = useState(() =>
    startLayout === "players" ? start.players.map((slot) => slot.name) : start.players.filter((slot) => !slotIds.has(slot.playerId)).map((slot) => slot.name)
  );
  const [bumped, setBumped] = useState<string[]>(() => {
    if (startLayout === "lines") return [];
    // Names the parser put in spots this layout doesn't have go to the tray instead.
    const hidden = [
      ...(startLayout === "powerPlay" ? [] : (start.powerPlay ?? []).flat()),
      ...start.forwards.flat(),
      ...start.defensePairs.flat(),
      ...(startLayout === "goalie" ? [] : start.goalies),
      ...(start.extraForwards ?? []),
      ...(start.extraDefensemen ?? []),
      ...start.extras,
      // v1 records listed players off the power play without a unit; v2 records them as a unit's swap.
      ...(start.offPowerPlay ?? []),
      ...(startLayout === "powerPlay" ? [] : (start.powerPlaySwaps ?? []).flatMap((swap) => [...swap.in, ...swap.out]))
    ];
    return startLayout === "players" ? [] : hidden.map((slot) => slot.name);
  });
  const [placing, setPlacing] = useState<string | null>(null);
  // The spot a name was picked up from with Move, so dropping it on a filled spot swaps the two.
  const [movingFrom, setMovingFrom] = useState<Target | null>(null);
  // Names resolved here: raw text -> the player's full name, so the tray and every spot follow the fix.
  const [renamed, setRenamed] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const subcategories = props.categoryOptions.find((option) => option.category === category)?.subcategories ?? [];
  const layout = layoutFor(category, subcategory || null);
  const showLines = layout === "lines";
  const showSwaps = layout === "powerPlay" && scope === "change";
  // Context and game apply to lineups, power plays and goalie starts; scope to lineups and power plays.
  const showContext = layout !== "players";
  const showScope = layout === "lines" || layout === "powerPlay";
  const swapNames = swaps.flatMap((draft) => [...draft.in, ...draft.out]);

  // Names the parser saw but didn't place: dropped candidate lines, unmatched names and, for lineups, other
  // names. A name leaves the tray once it sits in a spot; a name pushed out of a spot comes back.
  const candidates = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (raw: string | null | undefined) => {
      const name = raw?.trim() ? renamed[key(raw)] ?? raw.trim() : null;
      if (!name || seen.has(key(name))) return;
      seen.add(key(name));
      out.push(name);
    };
    for (const line of [...parse.forwards, ...parse.defensePairs]) {
      if (!line.kept) line.slots.forEach((slot) => add(slot.fullName ?? slot.raw));
    }
    parse.players.filter((player) => player.playerId == null).forEach((player) => add(player.raw));
    if (layout !== "players") others.forEach(add);
    bumped.forEach(add);
    return out.filter((name) => !dismissed.some((value) => key(value) === key(name)));
  }, [parse, layout, others, bumped, renamed, dismissed]);
  const placed = new Set(
    [...forwards.flat(), ...pairs.flat(), ...powerPlay.flat(), ...swapNames, ...goalies, ...extraForwards, ...extraDefensemen, ...extras, ...(layout === "players" ? others : [])]
      .filter((value) => value.trim())
      .map(key)
  );
  const tray = candidates.filter((name) => !placed.has(key(name)));

  const toSlot = (name: string): TrainerSlotValue => {
    const player = findPlayerByName(props.players, name);
    return { playerId: player?.id ?? null, name: player?.fullName ?? name.trim() };
  };
  const filled = (values: string[]) => values.filter((value) => value.trim()).map(toSlot);

  function valueAt(target: Target): string {
    if (target.kind === "forward") return forwards[target.row]?.[target.col] ?? "";
    if (target.kind === "pair") return pairs[target.row]?.[target.col] ?? "";
    if (target.kind === "pp") return powerPlay[target.row]?.[target.col] ?? "";
    if (target.kind === "goalie") return goalies[target.index] ?? "";
    if (target.kind === "swap") return swaps[target.unit]?.[target.side][target.index] ?? "";
    const list =
      target.kind === "extraForwards"
        ? extraForwards
        : target.kind === "extraDefensemen"
          ? extraDefensemen
          : target.kind === "extras"
            ? extras
            : others;
    return list[target.index] ?? "";
  }

  function write(target: Target, value: string) {
    const setGrid = (rows: string[][], row: number, col: number) =>
      rows.map((cells, rowIndex) => (rowIndex === row ? cells.map((cell, colIndex) => (colIndex === col ? value : cell)) : cells));
    if (target.kind === "forward") setForwards((rows) => setGrid(rows, target.row, target.col));
    else if (target.kind === "pair") setPairs((rows) => setGrid(rows, target.row, target.col));
    else if (target.kind === "pp") setPowerPlay((rows) => setGrid(rows, target.row, target.col));
    else if (target.kind === "goalie") setGoalies((cells) => cells.map((cell, index) => (index === target.index ? value : cell)));
    else if (target.kind === "swap")
      setSwaps((drafts) =>
        drafts.map((draft, unit) => {
          if (unit !== target.unit) return draft;
          const list = [...draft[target.side]];
          list[target.index] = value;
          return { ...draft, [target.side]: list };
        })
      );
    else {
      const setList =
        target.kind === "extraForwards"
          ? setExtraForwards
          : target.kind === "extraDefensemen"
            ? setExtraDefensemen
            : target.kind === "extras"
              ? setExtras
              : setOthers;
      setList((list) => {
        const next = [...list];
        next[target.index] = value;
        return next;
      });
    }
  }

  /** Puts a tray name in a spot. Whatever was there goes back to the tray; the name leaves any other spot. */
  function place(target: Target, name: string) {
    const previous = valueAt(target);
    // Moved from a fixed spot (a line, pair, PP or goalie spot): the two swap. Otherwise the old name goes to the tray.
    const from = movingFrom && key(valueAt(movingFrom)) === key(name) && ["forward", "pair", "pp", "goalie"].includes(movingFrom.kind) ? movingFrom : null;
    const swapBack = Boolean(from) && previous.trim() !== "" && key(previous) !== key(name);
    if (previous.trim() && key(previous) !== key(name) && !swapBack) setBumped((list) => [...list, previous]);
    setMovingFrom(null);
    // A name can only sit in one spot.
    setForwards((rows) => rows.map((cells) => cells.map((cell) => (key(cell) === key(name) ? "" : cell))));
    setPairs((rows) => rows.map((cells) => cells.map((cell) => (key(cell) === key(name) ? "" : cell))));
    setPowerPlay((rows) => rows.map((cells) => cells.map((cell) => (key(cell) === key(name) ? "" : cell))));
    setGoalies((cells) => cells.map((cell) => (key(cell) === key(name) ? "" : cell)));
    for (const setList of [setExtraForwards, setExtraDefensemen, setExtras]) setList((list) => list.filter((cell) => key(cell) !== key(name)));
    setSwaps((drafts) => drafts.map((draft) => ({ in: draft.in.filter((cell) => key(cell) !== key(name)), out: draft.out.filter((cell) => key(cell) !== key(name)) })));
    write(target, name);
    if (swapBack && from) write(from, previous);
    setPlacing(null);
  }

  // Every name that doesn't match a known player, in a spot or still in the tray, can be resolved here.
  const unknownNames = [...new Set([...forwards.flat(), ...pairs.flat(), ...powerPlay.flat(), ...swapNames, ...goalies, ...extraForwards, ...extraDefensemen, ...extras, ...tray].filter(
    (value) => value.trim() && !findPlayerByName(props.players, value)
  ))].filter((value, index, all) => all.findIndex((other) => key(other) === key(value)) === index);

  function resolved(raw: string, player: TrainerPlayerOption, message: string) {
    const rename = (value: string) => (key(value) === key(raw) ? player.fullName : value);
    setForwards((rows) => rows.map((cells) => cells.map(rename)));
    setPairs((rows) => rows.map((cells) => cells.map(rename)));
    setPowerPlay((rows) => rows.map((cells) => cells.map(rename)));
    setSwaps((drafts) => drafts.map((draft) => ({ in: draft.in.map(rename), out: draft.out.map(rename) })));
    setGoalies((cells) => cells.map(rename));
    setExtraForwards((list) => list.map(rename));
    setExtraDefensemen((list) => list.map(rename));
    setExtras((list) => list.map(rename));
    setOthers((list) => list.map(rename));
    setBumped((list) => list.map(rename));
    setRenamed((map) => ({ ...map, [key(raw)]: player.fullName }));
    props.onAliasSaved(message);
  }

  /**
   * A category change swaps the spots: the ones the new layout doesn't have are cleared, and the new ones are filled
   * from the parser's reading when it has one, otherwise from the cleared names in order. Anything left over goes
   * back to the tray, so no name is lost.
   */
  function relayout(next: Layout) {
    if (next === layout) return;
    const freed: string[] = [];
    const take = (values: string[], keep: boolean) => {
      if (!keep) freed.push(...values.filter((value) => value.trim()));
    };
    take(forwards.flat(), next === "lines");
    take(pairs.flat(), next === "lines");
    take(powerPlay.flat(), next === "powerPlay");
    take(swapNames, next === "powerPlay");
    take(goalies, next === "lines" || next === "goalie");
    take(extraForwards, next === "lines");
    take(extraDefensemen, next === "lines");
    take(extras, next === "lines");
    const unused = [...freed];
    const claim = (values: string[]) => {
      for (const value of values) {
        const index = unused.findIndex((name) => key(name) === key(value));
        if (index >= 0) unused.splice(index, 1);
      }
      return values;
    };
    const fromParse = (lines: TrainerSlotValue[][]) => lines.map((line) => line.map((slot) => renamed[key(slot.name)] ?? slot.name));
    if (next !== "lines") {
      setForwards(grid([], FORWARD_LINES, 3));
      setPairs(grid([], DEFENSE_PAIRS, 2));
      setExtraForwards([]);
      setExtraDefensemen([]);
      setExtras([]);
    } else if (!forwards.flat().some((value) => value.trim()) && !pairs.flat().some((value) => value.trim())) {
      setForwards(grid([], FORWARD_LINES, 3).map((row, index) => row.map((_, col) => claim([fromParse(start.forwards)[index]?.[col] ?? ""])[0]!)));
      setPairs(grid([], DEFENSE_PAIRS, 2).map((row, index) => row.map((_, col) => claim([fromParse(start.defensePairs)[index]?.[col] ?? ""])[0]!)));
    }
    if (next === "powerPlay") {
      const parsed = fromParse(parse.powerPlay.filter((unit) => unit.kept).map((unit) => unit.slots.map((slot) => ({ playerId: slot.playerId, name: slot.fullName ?? slot.raw }))));
      // No units from the parser: the names that sat in the old spots, five to a unit, in the order they were listed.
      const units = parsed.length
        ? parsed
        : [freed.slice(0, PP_SPOTS.length), freed.slice(PP_SPOTS.length, PP_SPOTS.length * PP_UNITS)];
      const filledGrid = grid([], PP_UNITS, PP_SPOTS.length).map((row, index) => row.map((_, col) => units[index]?.[col] ?? ""));
      claim(filledGrid.flat().filter((value) => value.trim()));
      setPowerPlay(filledGrid);
    } else {
      setPowerPlay(grid([], PP_UNITS, PP_SPOTS.length));
      setSwaps(emptySwaps());
    }
    if (next === "goalie" || next === "lines") {
      if (!goalies.some((value) => value.trim())) setGoalies(names(start.goalies, GOALIE_ROLES.length).map((value) => claim([value])[0]!));
    } else setGoalies(names([], GOALIE_ROLES.length));
    if (next === "players") {
      // Everyone named becomes a player on the claim.
      setOthers((list) => [...list, ...unused.filter((name) => !list.some((value) => key(value) === key(name)))]);
      unused.length = 0;
    }
    setBumped((list) => [...list, ...unused]);
    setPlacing(null);
  }

  /**
   * "Change only" on a power play swaps the unit grid for per-unit in/out lists, and back. Names in the spots that
   * go away return to the tray, so none is lost or silently kept.
   */
  function changeScope(next: TrainerScope | "") {
    if (layout === "powerPlay" && (next === "change") !== (scope === "change")) {
      if (next === "change") {
        setBumped((list) => [...list, ...powerPlay.flat().filter((value) => value.trim())]);
        setPowerPlay(grid([], PP_UNITS, PP_SPOTS.length));
      } else {
        setBumped((list) => [...list, ...swapNames.filter((value) => value.trim())]);
        setSwaps(emptySwaps());
      }
    }
    setScope(next);
  }

  function save() {
    const lineSlots = showLines ? forwards.map(filled).filter((line) => line.length) : [];
    const pairSlots = showLines ? pairs.map(filled).filter((pair) => pair.length) : [];
    // Units keep their number: an empty PP1 stays (as []) when only PP2 changed; trailing empty units drop.
    const powerPlayUnits = layout === "powerPlay" && !showSwaps ? powerPlay.map(filled) : [];
    while (powerPlayUnits.length && !powerPlayUnits[powerPlayUnits.length - 1]!.length) powerPlayUnits.pop();
    const powerPlaySlots = powerPlayUnits;
    const swapSlots: TrainerPowerPlaySwap[] = showSwaps
      ? swaps
          .map((draft, index) => ({ unit: index + 1, in: filled(draft.in), out: filled(draft.out) }))
          .filter((swap) => swap.in.length || swap.out.length)
      : [];
    // The parser's game id is kept only while the opponent and date still match what it bound.
    const game: TrainerGameBinding | null =
      !showContext || (opponentId == null && !gameDate)
        ? null
        : {
            gameId:
              start.game && start.game.opponentTeamId === opponentId && (start.game.date ?? "") === gameDate ? start.game.gameId : null,
            opponentTeamId: opponentId,
            date: gameDate || null
          };
    const goalieSlots = showLines || layout === "goalie" ? filled(goalies) : [];
    const extraForwardSlots = showLines ? filled(extraForwards) : [];
    const extraDefenseSlots = showLines ? filled(extraDefensemen) : [];
    const extraSlots = showLines ? filled(extras) : [];
    // Names left in the tray were still named in the tweet.
    const named = layout === "players" ? filled(others) : filled(tray);
    const everyone = new Map<string, TrainerSlotValue>();
    for (const slot of [...lineSlots.flat(), ...pairSlots.flat(), ...powerPlaySlots.flat(), ...swapSlots.flatMap((swap) => [...swap.in, ...swap.out]), ...goalieSlots, ...extraForwardSlots, ...extraDefenseSlots, ...extraSlots, ...named]) {
      if (slot.playerId != null) everyone.set(`id:${slot.playerId}`, slot);
    }
    props.onSave(
      {
        type: typeForCategory(category),
        category,
        subcategory: subcategory || null,
        teamId,
        players: [...everyone.values()],
        forwards: lineSlots,
        defensePairs: pairSlots,
        goalies: goalieSlots,
        extras: extraSlots,
        extraForwards: extraForwardSlots,
        extraDefensemen: extraDefenseSlots,
        powerPlay: powerPlaySlots,
        offPowerPlay: [],
        context: showContext ? context || null : null,
        scope: showScope ? scope || null : null,
        game,
        powerPlaySwaps: swapSlots
      },
      notes
    );
  }

  const slot = (target: Target, label: string) => (
    <SlotInput
      value={valueAt(target)}
      label={label}
      teamId={teamId}
      teamLabel={teamLabel}
      players={props.players}
      placing={placing}
      onChange={(next) => write(target, next)}
      onPlace={(name) => place(target, name)}
      onMove={() => {
        setPlacing(valueAt(target));
        setMovingFrom(target);
      }}
    />
  );

  const listEditor = (kind: ListKind, label: string, values: string[], setValues: (next: string[]) => void) => (
    <div className={styles.editorGroup}>
      <h3 className={styles.slotTitle}>{label}</h3>
      {values.map((value, index) => (
        <div key={index} className={styles.editorListRow}>
          {slot({ kind, index }, `${label} ${index + 1}`)}
          <button
            type="button"
            className={styles.ghostButton}
            onClick={() => setValues(values.filter((_, itemIndex) => itemIndex !== index))}
            aria-label={`Remove ${value || "empty row"}`}
          >
            Remove
          </button>
        </div>
      ))}
      {placing ? (
        <div className={styles.editorListRow}>{slot({ kind, index: values.length }, `New ${label.toLowerCase()} spot`)}</div>
      ) : (
        <button type="button" className={`${styles.ghostButton} ${styles.addButton}`} onClick={() => setValues([...values, ""])}>
          Add player
        </button>
      )}
    </div>
  );

  return (
    <section
      className={styles.editor}
      aria-label="Correct the parser's answer"
      onKeyDown={(event) => {
        // Escape first drops the picked name; a second Escape leaves the editor.
        if (event.key === "Escape" && placing) {
          event.stopPropagation();
          setPlacing(null);
        }
      }}
    >
      <header className={styles.editorHeader}>
        <h2>What should the parser have said?</h2>
        <p>Start from the parser&rsquo;s answer and change what&rsquo;s wrong. Names that don&rsquo;t match a player are kept as text.</p>
      </header>

      <div className={styles.editorRow}>
        <label className={styles.fieldLabel}>
          <span>Team</span>
          <select
            value={teamId == null ? "" : String(teamId)}
            onChange={(event) => setTeamId(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">No single team</option>
            {(props.teams ?? []).map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.abbreviation})
              </option>
            ))}
          </select>
        </label>
        <label className={styles.fieldLabel}>
          <span>Category</span>
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setSubcategory("");
              relayout(layoutFor(event.target.value, null));
            }}
          >
            {props.categoryOptions.map((option) => (
              <option key={option.category} value={option.category}>{sentenceCase(option.category)}</option>
            ))}
          </select>
        </label>
        <label className={styles.fieldLabel}>
          <span>Subcategory</span>
          <select
            value={subcategory}
            onChange={(event) => {
              setSubcategory(event.target.value);
              relayout(layoutFor(category, event.target.value || null));
            }}
          >
            <option value="">None</option>
            {subcategories.map((option) => (
              <option key={option} value={option}>{sentenceCase(option)}</option>
            ))}
          </select>
        </label>
      </div>

      {showContext ? (
        <div className={styles.editorRow}>
          <label className={styles.fieldLabel}>
            <span>Context</span>
            <select value={context} onChange={(event) => setContext(event.target.value as TrainerContext | "")}>
              <option value="">Not stated</option>
              {CONTEXT_ORDER.map((option) => (
                <option key={option} value={option}>{CONTEXT_LABELS[option]}</option>
              ))}
            </select>
          </label>
          {showScope ? (
            <label className={styles.fieldLabel}>
              <span>Scope</span>
              <select value={scope} onChange={(event) => changeScope(event.target.value as TrainerScope | "")}>
                <option value="">Not stated</option>
                {SCOPE_ORDER.map((option) => (
                  <option key={option} value={option}>{SCOPE_LABELS[option]}</option>
                ))}
              </select>
            </label>
          ) : null}
          {/* Only what the tweet says: a timestamp alone doesn't name a game. */}
          <label className={styles.fieldLabel}>
            <span>Opponent</span>
            <select
              value={opponentId == null ? "" : String(opponentId)}
              onChange={(event) => setOpponentId(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">Not named</option>
              {(props.teams ?? [])
                .filter((team) => team.id !== teamId)
                .map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.abbreviation})
                  </option>
                ))}
            </select>
          </label>
          <label className={styles.fieldLabel}>
            <span>Game date</span>
            <input type="date" value={gameDate} onChange={(event) => setGameDate(event.target.value)} />
          </label>
        </div>
      ) : null}

      {layout !== "players" ? (
        <div className={styles.tray} role="group" aria-label="Names to place">
          <h3 className={styles.slotTitle}>Names to place</h3>
          {tray.length ? (
            <>
              <p className={styles.trayHint} aria-live="polite">
                {placing
                  ? `Placing ${placing}: click the spot it belongs in, or press Esc to cancel.`
                  : "Click a name, then the spot it belongs in. On desktop you can also drag it. × drops a name that isn't a player here."}
              </p>
              <div className={styles.slotChips}>
                {tray.map((name) => (
                  <span key={name} className={styles.trayItem}>
                    <button
                      type="button"
                      draggable
                      className={placing && key(placing) === key(name) ? `${styles.trayChip} ${styles.trayChipPicked}` : styles.trayChip}
                      aria-pressed={placing ? key(placing) === key(name) : false}
                      onClick={() => setPlacing((current) => (current && key(current) === key(name) ? null : name))}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(TRAY_TYPE, name);
                        event.dataTransfer.setData("text/plain", name);
                        event.dataTransfer.effectAllowed = "move";
                        setPlacing(name);
                      }}
                      onDragEnd={() => setPlacing(null)}
                    >
                      {name}
                    </button>
                    <button
                      type="button"
                      className={styles.trayRemove}
                      aria-label={`${name} isn't a player in this tweet`}
                      title="Not a player in this tweet"
                      onClick={() => {
                        setDismissed((list) => [...list, name]);
                        if (placing && key(placing) === key(name)) setPlacing(null);
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </>
          ) : null}
          {/* A name the parser missed entirely (a typo like "Kuluch"): add it as written, then place or resolve it. */}
          <form
            className={styles.editorListRow}
            onSubmit={(event) => {
              event.preventDefault();
              const name = addName.trim();
              if (!name) return;
              setDismissed((list) => list.filter((value) => key(value) !== key(name)));
              setBumped((list) => [...list, name]);
              setAddName("");
            }}
          >
            <input
              className={styles.slotInput}
              value={addName}
              onChange={(event) => setAddName(event.target.value)}
              aria-label="Add a name the parser missed"
              placeholder="Add a name the parser missed, as the tweet spells it"
            />
            <button type="submit" className={styles.ghostButton} disabled={!addName.trim()}>Add name</button>
          </form>
          {dismissed.length ? (
            <p className={styles.trayHint}>
              Not players here: {dismissed.join(", ")}{" "}
              <button type="button" className={styles.linkButton} onClick={() => setDismissed([])}>Undo</button>
            </p>
          ) : null}
        </div>
      ) : null}

      {unknownNames.length ? (
        <div className={styles.resolveGroup}>
          <h3 className={styles.slotTitle}>Names to resolve</h3>
          {unknownNames.map((raw) => (
            <ResolveRow
              key={key(raw)}
              card={props.card}
              raw={raw}
              players={props.players}
              teamId={teamId}
              teamLabel={teamLabel}
              onResolved={resolved}
            />
          ))}
        </div>
      ) : null}

      {showLines ? (
        <>
          <div className={styles.editorGroup}>
            <h3 className={styles.slotTitle}>Forward lines</h3>
            <div className={styles.editorGrid}>
              <span aria-hidden="true" />
              {FORWARD_SPOTS.map((spot) => (
                <span key={spot} className={styles.spotHead} aria-hidden="true">{spot}</span>
              ))}
              {forwards.map((line, lineIndex) => (
                <Fragment key={lineIndex}>
                  <span className={styles.slotLabel}>L{lineIndex + 1}</span>
                  {line.map((_, slotIndex) => (
                    <span key={slotIndex} className={styles.editorCell}>
                      {slot({ kind: "forward", row: lineIndex, col: slotIndex }, `Line ${lineIndex + 1} ${FORWARD_SPOTS[slotIndex]}`)}
                    </span>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
          <div className={styles.editorGroup}>
            <h3 className={styles.slotTitle}>Defence pairs</h3>
            <div className={styles.editorGrid}>
              <span aria-hidden="true" />
              {DEFENSE_SPOTS.map((spot) => (
                <span key={spot} className={styles.spotHead} aria-hidden="true">{spot}</span>
              ))}
              <span aria-hidden="true" />
              {pairs.map((pair, pairIndex) => (
                <Fragment key={pairIndex}>
                  <span className={styles.slotLabel}>D{pairIndex + 1}</span>
                  {pair.map((_, slotIndex) => (
                    <span key={slotIndex} className={styles.editorCell}>
                      {slot({ kind: "pair", row: pairIndex, col: slotIndex }, `Pair ${pairIndex + 1} ${DEFENSE_SPOTS[slotIndex]}`)}
                    </span>
                  ))}
                  <span aria-hidden="true" />
                </Fragment>
              ))}
            </div>
          </div>
          {listEditor("extraForwards", "Extra forwards", extraForwards, setExtraForwards)}
          {listEditor("extraDefensemen", "Extra defensemen", extraDefensemen, setExtraDefensemen)}
        </>
      ) : null}

      {layout === "powerPlay" && !showSwaps ? (
        <div className={styles.editorGroup}>
          <h3 className={styles.slotTitle}>Power-play units</h3>
          <div className={`${styles.editorGrid} ${styles.editorGridWide}`}>
            <span aria-hidden="true" />
            {PP_SPOTS.map((spot) => (
              <span key={spot} className={styles.spotHead} aria-hidden="true">{spot}</span>
            ))}
            {powerPlay.map((unit, unitIndex) => (
              <Fragment key={unitIndex}>
                <span className={styles.slotLabel}>PP{unitIndex + 1}</span>
                {unit.map((_, slotIndex) => (
                  <span key={slotIndex} className={styles.editorCell}>
                    {slot({ kind: "pp", row: unitIndex, col: slotIndex }, `PP${unitIndex + 1} ${PP_SPOT_NAMES[slotIndex]}`)}
                  </span>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      ) : null}
      {showSwaps
        ? swaps.map((draft, unit) => (
            <div key={unit} className={styles.editorGroup} role="group" aria-label={`PP${unit + 1} change`}>
              <h3 className={styles.slotTitle}>PP{unit + 1} change</h3>
              {(["in", "out"] as const).map((side) => {
                const label = `PP${unit + 1} ${side === "in" ? "in" : "out"}`;
                const setSide = (next: string[]) => setSwaps((drafts) => drafts.map((item, index) => (index === unit ? { ...item, [side]: next } : item)));
                return (
                  <div key={side} className={styles.editorGroup}>
                    <h4 className={styles.slotRole}>{side === "in" ? "Joins the unit" : "Leaves the unit"}</h4>
                    {draft[side].map((value, index) => (
                      <div key={index} className={styles.editorListRow}>
                        {slot({ kind: "swap", unit, side, index }, `${label} ${index + 1}`)}
                        <button
                          type="button"
                          className={styles.ghostButton}
                          onClick={() => setSide(draft[side].filter((_, itemIndex) => itemIndex !== index))}
                          aria-label={`Remove ${value || "empty row"}`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {placing ? (
                      <div className={styles.editorListRow}>{slot({ kind: "swap", unit, side, index: draft[side].length }, `New ${label} spot`)}</div>
                    ) : (
                      <button type="button" className={`${styles.ghostButton} ${styles.addButton}`} onClick={() => setSide([...draft[side], ""])}>
                        Add player
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        : null}

      {showLines || layout === "goalie" ? (
        <div className={styles.editorGroup}>
          <h3 className={styles.slotTitle}>Goalies</h3>
          {GOALIE_ROLES.map((role, index) => (
            <div key={role} className={styles.editorSlotRow}>
              <span className={styles.slotRole}>{role}</span>
              <span className={styles.editorCell}>{slot({ kind: "goalie", index }, `${role} goalie`)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {showLines ? listEditor("extras", "Scratches and injuries", extras, setExtras) : null}
      {layout === "players" ? listEditor("others", "Players", others, setOthers) : null}

      <label className={styles.fieldLabel}>
        <span>Notes (optional)</span>
        <textarea value={notes} rows={2} onChange={(event) => setNotes(event.target.value)} />
      </label>

      <div className={styles.fixActions}>
        <button type="button" className={styles.primaryButton} disabled={props.busy} onClick={save}>
          {props.busy ? "Saving…" : "Save correction"}
        </button>
        <button type="button" className={styles.ghostButton} disabled={props.busy} onClick={props.onCancel}>Back to card</button>
      </div>
    </section>
  );
}
