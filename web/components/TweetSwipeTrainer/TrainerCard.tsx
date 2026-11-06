import { useMemo, useState, type ReactNode } from "react";

import type { TrainerLine, TrainerPlayerMatch } from "lib/sources/tweetSwipeTrainer";
import type { TrainerCard as TrainerCardData } from "lib/sources/tweetSwipeTrainerServer";

import { resolveCardName, TYPE_LABELS, type TrainerPlayerOption } from "./trainerApi";
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

// Accents don't matter when matching typed names: "Brandsegg-Nygard" finds "Brandsegg-Nygård".
export function foldName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
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
  return [...matches.filter((player) => player.team_id === teamId), ...matches.filter((player) => player.team_id !== teamId)].slice(0, limit);
}

type FixTarget = { rawName: string; match: TrainerPlayerMatch | null; unresolvedId: string | null };

function NameFixPanel(props: {
  card: TrainerCardData;
  target: FixTarget;
  players: TrainerPlayerOption[];
  datalistId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { target } = props;
  const [playerName, setPlayerName] = useState(target.match?.fullName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const player = findPlayerByName(props.players, playerName);
  const isConfirm = Boolean(target.match?.playerId && player?.id === target.match.playerId);

  async function save() {
    if (!player) return;
    setBusy(true);
    setError(null);
    try {
      const message = await resolveCardName({
        card: props.card,
        rawName: target.rawName,
        playerId: player.id,
        unresolvedId: target.unresolvedId,
        reason: !target.match || target.match.playerId == null ? "trainer_unmatched" : isConfirm ? "trainer_near_match" : "trainer_wrong_match"
      });
      props.onSaved(message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Alias save failed.");
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
        <input
          list={props.datalistId}
          value={playerName}
          onChange={(event) => setPlayerName(event.target.value)}
          placeholder="Type a player name"
          autoFocus
        />
      </label>
      {error ? <p className={styles.fixError} role="alert">{error}</p> : null}
      <div className={styles.fixActions}>
        <button type="button" className={styles.primaryButton} disabled={!player || busy} onClick={() => void save()}>
          {busy ? "Saving…" : isConfirm ? "Confirm and save alias" : "Save alias"}
        </button>
        <button type="button" className={styles.ghostButton} onClick={props.onClose}>Cancel</button>
      </div>
      <p className={styles.fixHint}>Saving teaches &ldquo;{target.rawName}&rdquo; as an alias, so future mentions resolve too.</p>
    </div>
  );
}

// The audit links any match below 70 to the alias fix; above that a quiet "Fix" is enough.
const NEEDS_REVIEW_BELOW = 70;

function PlayerChip(props: { match: TrainerPlayerMatch; onFix: () => void }) {
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
  // The whole chip opens the fix panel; only matches that need review carry a visible tag.
  return (
    <button
      type="button"
      className={`${styles.playerChip} ${styles[`chip_${tone}`]}`}
      onClick={props.onFix}
      data-swipe-ok=""
      aria-label={`${action} ${match.raw}: ${found}`}
      title={`${found.charAt(0).toUpperCase()}${found.slice(1)}. Click to ${action.toLowerCase()}.`}
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
      {uncertain ? <span className={styles.chipFixStrong}>{match.playerId != null ? "Confirm" : "Fix"}</span> : null}
    </button>
  );
}

function LineRows(props: { title: string; prefix: string; lines: TrainerLine[]; onFix: (match: TrainerPlayerMatch) => void }) {
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
            <div className={`${styles.slotChips} ${styles.lineGrid}`}>
              {line.slots.map((slot, slotIndex) => (
                <PlayerChip key={`${slot.raw}-${slotIndex}`} match={slot} onFix={() => props.onFix(slot)} />
              ))}
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
}) {
  const { card } = props;
  const { parse } = card;
  const [fixTarget, setFixTarget] = useState<FixTarget | null>(null);
  const [showSignals, setShowSignals] = useState(false);
  const tone = parse.confidence.band;
  const datalistId = `trainer-players-${card.key}`;
  const teamPlayers = useMemo(() => {
    const team = props.players.filter((player) => player.team_id === parse.teamId);
    return team.length ? team : props.players.slice(0, 400);
  }, [props.players, parse.teamId]);
  const isLineCombo = parse.type === "line_combination";
  const otherPlayers = isLineCombo
    ? parse.players.filter(
        (player) =>
          // Anyone already shown in a line, kept or dropped, isn't repeated here.
          ![...parse.forwards, ...parse.defensePairs].some((line) => line.slots.some((slot) => slot.playerId != null && slot.playerId === player.playerId)) &&
          !parse.goalies.some((goalie) => goalie.playerId === player.playerId) &&
          !parse.extras.some((extra) => extra.playerId === player.playerId)
      )
    : parse.players;
  const openFix = (match: TrainerPlayerMatch) => setFixTarget({ rawName: match.raw, match, unresolvedId: null });

  return (
    <article className={styles.card} aria-label={`Tweet by ${card.authorHandle ?? card.sourceAccount ?? "unknown"}`}>
      <datalist id={datalistId}>
        {teamPlayers.map((player) => (
          <option key={player.id} value={player.fullName}>{player.position ?? ""}</option>
        ))}
      </datalist>

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
        </div>

        {isLineCombo ? (
          <>
            <LineRows title="Forward lines" prefix="L" lines={parse.forwards} onFix={openFix} />
            <LineRows title="Defence pairs" prefix="D" lines={parse.defensePairs} onFix={openFix} />
          </>
        ) : null}
        {parse.goalies.length ? (
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
            <h3 className={styles.slotTitle}>Extras, scratches and injuries</h3>
            <div className={styles.slotChips}>
              {parse.extras.map((extra, index) => (
                <PlayerChip key={`${extra.raw}-${index}`} match={extra} onFix={() => openFix(extra)} />
              ))}
            </div>
          </div>
        ) : null}
        {otherPlayers.length ? (
          <div className={styles.slotGroup}>
            <h3 className={styles.slotTitle}>{isLineCombo ? "Other names" : "Players matched"}</h3>
            <div className={styles.slotChips}>
              {otherPlayers.map((match, index) => (
                <PlayerChip key={`${match.raw}-${index}`} match={match} onFix={() => openFix(match)} />
              ))}
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
          datalistId={datalistId}
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
