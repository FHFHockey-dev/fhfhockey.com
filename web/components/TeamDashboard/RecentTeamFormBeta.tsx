import React, { useId, useState } from "react";
import { formatFractionPercent } from "lib/stats/percentUnits";
import { CTPI_DESCRIPTIVE_BETA_LABEL } from "lib/trends/ctpiVersions";
import {
  useRecentTeamFormBeta,
  type RecentTeamFormBetaComponent,
  type RecentTeamFormBetaDebug,
  type RecentTeamFormBetaModel,
} from "./useRecentTeamFormBeta";
import styles from "./RecentTeamFormBeta.module.scss";

/*
 * Recent Team Form descriptive beta (DISPLAY-PLAN, TJ 2026-11-13). It
 * describes recent play from candidate v2 rows as issued. It is not a
 * forecast and feeds nothing else.
 */

export const RECENT_TEAM_FORM_INFO_TIP =
  "Describes how the team has played over its last 10 games: shot quality for and against, goaltending against expected, and power-play and penalty-kill rates pooled by ice time. Each is compared with the league on the same date, and 50 is league average. It is not a prediction and is still being validated.";

export const RECENT_TEAM_FORM_PARTS_CAPTION =
  "Score parts vs league average (the middle line), in standard deviations (SD)";

/** Bars span ±2 SD; larger values fill the half-track. */
const BAR_DOMAIN_SD = 2;

function formatShortDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Signed SD value without its unit, e.g. "+0.6" or "−0.3". */
function formatSd(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return "0.0";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toFixed(1)}`;
}

/** "Oct 21 – Nov 11" (one date alone when the range has one game). */
function formatDateRange(dates: readonly string[]): string {
  if (dates.length === 0) return "";
  const first = formatShortDate(dates[0]);
  const last = formatShortDate(dates[dates.length - 1]);
  return first === last ? first : `${first} – ${last}`;
}

type ScoreModel = Extract<RecentTeamFormBetaModel, { kind: "score" }>;

/** Plain-language note when puck luck is not over the score's own games. */
function separateSampleNote(model: ScoreModel): string {
  if (model.puckLuck.games === 0) {
    return "5-on-5 stats are missing for these games, so puck luck is unavailable";
  }
  if (model.windowDates.length === 0) {
    return "The score's game dates couldn't be confirmed, so puck luck below is a separate 5-on-5 sample";
  }
  return "5-on-5 games don't match the score's games, so puck luck below is a separate sample";
}

/** Puck-luck scope: "same N games" only when every date matches the score's. */
function puckLuckScope(model: ScoreModel): string {
  const { games, dates } = model.puckLuck;
  if (model.sameGames) return `5-on-5, same ${games} games; not part of the score`;
  if (games === 0) return "5-on-5; not part of the score";
  return `5-on-5, separate sample: ${games} ${games === 1 ? "game" : "games"}, ${formatDateRange(dates)}; not part of the score`;
}

function ComponentRow({ component }: { component: RecentTeamFormBetaComponent }) {
  if (component.value === null) {
    return (
      <li className={styles.componentRow}>
        <span className={styles.componentLabel}>{component.label}</span>
        <span className={styles.unknownMark} aria-hidden="true">
          —
        </span>
        <span className={`${styles.componentValue} ${styles.unknownValue}`}>
          Unknown
        </span>
        <span className={styles.componentNote}>{component.reason}</span>
      </li>
    );
  }
  const clipped = Math.abs(component.value) > BAR_DOMAIN_SD;
  const size = Math.min(Math.abs(component.value), BAR_DOMAIN_SD) / BAR_DOMAIN_SD;
  const direction =
    component.value > 0 ? styles.above : component.value < 0 ? styles.below : "";
  return (
    <li className={styles.componentRow}>
      <span className={styles.componentLabel}>{component.label}</span>
      <span className={styles.barTrack} aria-hidden="true">
        <span
          className={`${styles.barFill} ${direction}${clipped ? ` ${styles.clipped}` : ""}`}
          data-clipped={clipped || undefined}
          style={{ "--bar-size": `${(size * 50).toFixed(1)}%` } as React.CSSProperties}
        />
      </span>
      <span className={`${styles.componentValue} ${direction}`}>
        {formatSd(component.value)} <span className={styles.unit}>SD</span>
      </span>
      <span className={styles.componentNote}>{component.inputs}</span>
    </li>
  );
}

function DebugDetail({ debug }: { debug: RecentTeamFormBetaDebug | null }) {
  if (process.env.NODE_ENV !== "development" || !debug) return null;
  return (
    <details className={styles.debug} data-testid="recent-team-form-debug">
      <summary>Debug (development only)</summary>
      <dl>
        <dt>Fingerprint</dt>
        <dd>{debug.fingerprint ?? "—"}</dd>
        <dt>Warnings</dt>
        <dd>{debug.warnings.length > 0 ? debug.warnings.join(", ") : "none"}</dd>
        <dt>computed_at</dt>
        <dd>{debug.computedAt ?? "—"}</dd>
        <dt>Coverage</dt>
        <dd>
          {Object.entries(debug.coverage)
            .map(([key, value]) => `${key} ${value.toFixed(2)}`)
            .join(" · ") || "—"}
        </dd>
        <dt>Status</dt>
        <dd>
          {debug.publicationStatus ?? "—"} · games through{" "}
          {debug.sourceThroughDate ?? "—"}
        </dd>
        <dt>PDO context</dt>
        <dd>{JSON.stringify(debug.pdoContext ?? null)}</dd>
      </dl>
    </details>
  );
}

function ScoreBody({
  model,
}: {
  model: ScoreModel;
}) {
  const partsId = useId();
  const { windowDates, recentGameCount, puckLuck } = model;
  // The window names the score's own confirmed dates; otherwise it keeps to
  // what the row itself states (its last game).
  const range =
    windowDates.length > 0
      ? ` (${formatDateRange(windowDates)})`
      : model.sourceThroughDate
        ? ` (games through ${formatShortDate(model.sourceThroughDate)})`
        : "";
  return (
    <>
      <div className={styles.scoreRow}>
        <span className={styles.score}>{Math.round(model.score)}</span>
        <span className={styles.scoreScale}>
          on a 0–100 scale; 50 = league average on that date
        </span>
      </div>
      <p className={styles.windowLine}>
        Last {recentGameCount} games before {formatShortDate(model.snapshotDate)}
        {range}; recent games count more
      </p>
      <p className={styles.asOf}>
        As of {formatShortDate(model.snapshotDate)} · {recentGameCount} of{" "}
        {model.targetGames} games included
      </p>
      {model.partialNotes.map((note) => (
        <p key={note} className={styles.partialNote}>
          {note}
        </p>
      ))}
      {model.sameGames ? null : (
        <p className={styles.mismatchNote}>{separateSampleNote(model)}</p>
      )}
      <p id={partsId} className={styles.partsCaption}>
        {RECENT_TEAM_FORM_PARTS_CAPTION}
      </p>
      <ul className={styles.components} aria-labelledby={partsId}>
        {model.components.map((component) => (
          <ComponentRow key={component.key} component={component} />
        ))}
      </ul>
      <div className={styles.puckLuck}>
        <h5 className={styles.puckLuckHeading}>
          Puck luck{" "}
          <span className={styles.puckLuckScope}>({puckLuckScope(model)})</span>
        </h5>
        <dl className={styles.puckLuckStats}>
          <div>
            <dt>PDO</dt>
            <dd>{puckLuck.pdo === null ? "—" : puckLuck.pdo.toFixed(3)}</dd>
          </div>
          <div>
            <dt>Shooting</dt>
            <dd>{formatFractionPercent(puckLuck.shootingPct)}</dd>
          </div>
          <div>
            <dt>Save</dt>
            <dd>{formatFractionPercent(puckLuck.savePct)}</dd>
          </div>
        </dl>
        <p className={styles.puckLuckNote}>
          1.000 is league average; extremes usually regress
        </p>
      </div>
    </>
  );
}

interface RecentTeamFormBetaProps {
  teamAbbrev: string;
  seasonId: string;
  regularSeasonStartDate?: string | null;
  regularSeasonEndDate?: string | null;
}

export function RecentTeamFormBeta({
  teamAbbrev,
  seasonId,
  regularSeasonStartDate,
  regularSeasonEndDate,
}: RecentTeamFormBetaProps) {
  const result = useRecentTeamFormBeta(
    teamAbbrev,
    seasonId,
    regularSeasonStartDate,
    regularSeasonEndDate,
  );
  const [infoOpen, setInfoOpen] = useState(false);
  const headingId = useId();
  const tipId = useId();

  let body: React.ReactNode;
  let debug: RecentTeamFormBetaDebug | null = null;
  if (result.state === "loading") {
    body = <p className={styles.stateText}>Loading Recent Team Form…</p>;
  } else if (result.state === "error") {
    body = <p className={styles.stateText}>Recent Team Form could not be loaded</p>;
  } else if (result.model.kind === "notEnoughGames") {
    body = (
      <p className={styles.stateText}>
        Not enough games yet ({result.model.gamesPlayed} of{" "}
        {result.model.minimumGames})
      </p>
    );
  } else if (result.model.kind === "unavailable") {
    debug = result.model.debug;
    body = (
      <p className={styles.stateText}>
        Recent Team Form is not available for this team and season
      </p>
    );
  } else {
    debug = result.model.debug;
    body = <ScoreBody model={result.model} />;
  }

  return (
    <section
      className={styles.beta}
      aria-labelledby={headingId}
      aria-busy={result.state === "loading" || undefined}
    >
      <div className={styles.header}>
        <h4 id={headingId} className={styles.title}>
          Recent Team Form
        </h4>
        <button
          type="button"
          className={styles.infoButton}
          aria-expanded={infoOpen}
          aria-controls={tipId}
          aria-label="About Recent Team Form"
          onClick={() => setInfoOpen((open) => !open)}
        >
          <span aria-hidden="true">&#9432;</span>
        </button>
        <span className={styles.badge}>{CTPI_DESCRIPTIVE_BETA_LABEL}</span>
      </div>
      <p id={tipId} className={styles.infoTip} hidden={!infoOpen}>
        {RECENT_TEAM_FORM_INFO_TIP}
      </p>
      {body}
      <DebugDetail debug={debug} />
    </section>
  );
}

export default RecentTeamFormBeta;
