import type { GameForecast, LeagueRules } from "lib/rosterScheduleOptimizer/planningTypes";
import styles from "./RosterScheduleOptimizer.module.scss";

type Props = { forecasts?: GameForecast[]; scoring: LeagueRules["scoring"];
  nameOf: (id: string) => string; timeZone: string; label: string };
const finite = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);

function evidenceRows(forecasts: GameForecast[], scoring: LeagueRules["scoring"]) {
  const targets = scoring.mode === "points"
    ? Object.entries(scoring.weights).filter(([, weight]) => weight !== 0).map(([key]) => key)
    : [...new Set(scoring.categories.flatMap(category => [category.numerator ?? category.key,
      ...(category.denominator ? [category.denominator] : [])]))];
  return forecasts.flatMap(forecast => targets.filter(target => target in forecast.stats || target in (forecast.contributions ?? {}))
    .map(target => {
      const contribution = forecast.contributions?.[target];
      const uses = contribution?.allowedUses ?? forecast.allowedUses;
      const totals = uses?.totals === true && finite(forecast.stats[target]);
      const assignment = uses?.assignment === true && finite(forecast.assignmentStats?.[target] ?? forecast.stats[target]);
      const conditional = !totals && !assignment && uses?.conditionalTieBreak === true
        && finite(contribution?.conditionalMean ?? forecast.tieBreakStats?.[target]);
      const kind = contribution ? contribution.sourceKind : forecast.sourceKind;
      const source = kind === "blended" ? "Blended detailed/baseline estimate"
        : kind === "baseline" ? "Baseline rate estimate" : kind === "detailed" ? "Detailed game estimate"
          : "Game estimate (source unspecified)";
      const timestamps = (["detailed", "baseline"] as const).flatMap(inputKind => {
        const input = contribution?.inputs?.[inputKind];
        return input && (kind === inputKind || kind === "blended") && contribution?.sourceIds.includes(input.sourceId)
          ? [{ label: inputKind === "detailed" ? "Detailed production input" : "Baseline rate input",
            cutoffAt: input.cutoffAt, issuedAt: input.issuedAt, expiresAt: input.expiresAt }] : [];
      });
      const participation = contribution?.inputs?.participation;
      if (participation && contribution?.participationRevisionId === participation.revisionId) {
        timestamps.push({ label: `Participation input (${participation.basis})`, cutoffAt: participation.cutoffAt,
          issuedAt: participation.issuedAt, expiresAt: participation.expiresAt });
      }
      return { forecast, target, kind, timestamps, retained: !!contribution, available: totals || assignment || conditional,
        source: totals || assignment || conditional ? source : "Unavailable",
        use: conditional ? "Conditional ability only; assumes participation. No projected total."
          : totals ? uses?.comparison === true ? "Projected total and comparison use" : "Projected total only; comparison not approved"
            : assignment ? "Assignment use only; no projected total" : "Start/sit decision unresolved" };
    }));
}

export function forecastSummary(forecasts: GameForecast[] | undefined, scoring: LeagueRules["scoring"]): string {
  const rows = evidenceRows(forecasts ?? [], scoring).filter(row => row.available);
  if (!rows.length) return "Forecast evidence unavailable";
  return rows.some(row => row.kind === "baseline" || row.kind === "blended")
    ? "Includes baseline estimates · provisional" : "Game estimates · provisional";
}

export default function ForecastEvidence({ forecasts, scoring, nameOf, timeZone, label }: Props) {
  const rows = evidenceRows(forecasts ?? [], scoring);
  if (!rows.length) return null;
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const timestamp = (value: string | undefined) => value && Number.isFinite(Date.parse(value))
    ? formatter.format(new Date(value))
    : "unknown";
  return <details className={styles.settings}>
    <summary>{label} · estimate sources</summary>
    <p>Baseline estimates use reusable contribution rates. The optimized no-move plan is a lineup comparison, not a statistical source. None of these estimates imply calibrated confidence.</p>
    {rows.slice(0, 100).map(({ forecast, target, source, use, timestamps, retained }) => <article
      key={`${forecast.playerId}:${forecast.gameId}:${target}`} aria-label={`${nameOf(forecast.playerId)} game ${forecast.gameId} ${target} evidence`}>
      <p><strong>{nameOf(forecast.playerId)} · game {forecast.gameId} · {target}</strong><br />
        {source} · {use}</p>
      {timestamps.length ? <ul aria-label="Source timestamps">{timestamps.map(input => <li key={input.label}>
        {input.label} · inputs as of {timestamp(input.cutoffAt)} · issued {timestamp(input.issuedAt)} · expires {timestamp(input.expiresAt)}
      </li>)}</ul> : <p>{retained ? "Target source timestamps unavailable." : <>
        Target source lineage unavailable. Game-estimate bundle bounds: latest input cutoff {timestamp(forecast.cutoffAt)}
        {` · latest issuance ${timestamp(forecast.issuedAt)} · earliest expiry ${timestamp(forecast.expiresAt)}`}
      </>}</p>}
    </article>)}
    {rows.length > 100 && <p>{rows.length - 100} more target records are omitted from this view.</p>}
  </details>;
}
