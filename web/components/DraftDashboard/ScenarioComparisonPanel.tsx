import type { ScenarioResult } from "lib/draft-pro/scenarios";
import styles from "./ScenarioComparisonPanel.module.scss";

export type ScenarioComparisonPanelProps = Readonly<{
  eligible: boolean; result: ScenarioResult | null; savedFingerprint?: string | null;
  unavailableReason?: string | null; onSave?(): void;
}>;

/** W07 mount contract: pass the read-only result from compareDraftProScenarios and the saved fingerprint. */
export function ScenarioComparisonPanel({ eligible, result, savedFingerprint, unavailableReason, onSave }: ScenarioComparisonPanelProps) {
  const stale = Boolean(result && savedFingerprint && savedFingerprint !== result.fingerprint);
  return <section className={styles.panel} aria-label="Compare two candidates">
    <div className={styles.heading}><div><h2>Compare two candidates</h2><p>Each player is measured against the same current roster.</p></div>{eligible && result && onSave ? <button type="button" onClick={onSave}>Save scenario</button> : null}</div>
    {!eligible ? <p role="status">Draft Pro is inactive. Saved scenario names remain visible, but roster-impact payloads are locked.</p> : unavailableReason ? <p role="status">Comparison unavailable: {unavailableReason}</p> : !result ? <p role="status">Choose two available candidates to see their roster impact.</p> : <>
      {stale ? <p className={styles.stale} role="status">Saved scenario is stale because roster, projections, scoring, or schedule inputs changed. Recalculate before relying on it.</p> : null}
      <p className={styles.baseline}>Baseline raw VORP: <strong>{result.baseline.rawVorp.toFixed(1)}</strong>{result.baseline.projectedPoints === null ? " · Projected points unavailable" : <> · Baseline projected points: <strong>{result.baseline.projectedPoints.toFixed(1)}</strong></>}</p>
      <p className={styles.baseline}>Schedule: <strong>{result.schedule.state.replaceAll("_", " ")}</strong>{result.schedule.window ? ` · Weeks ${result.schedule.window.startWeek ?? "?"}–${result.schedule.window.endWeek ?? "?"}` : ""}{result.schedule.freshness?.latestFetchedAt ? ` · Updated ${new Date(result.schedule.freshness.latestFetchedAt).toLocaleString()}` : ""}</p>
      <div className={styles.cards}>{result.candidates.map((candidate) => <article key={candidate.id} className={styles.card}><h3>{candidate.name}</h3><dl><div><dt>Raw VORP effect / after</dt><dd>{format(candidate.rawVorpDelta)} / {formatValue(candidate.rawVorpAfter)}</dd></div><div><dt>Projected points effect / after</dt><dd>{candidate.projectedPointsDelta === null ? "Unavailable" : `${format(candidate.projectedPointsDelta)} / ${formatValue(candidate.projectedPointsAfter!)}`}</dd></div><div><dt>Position needs</dt><dd>{candidate.positionNeeds.length ? candidate.positionNeeds.join(", ") : "No current need"}</dd></div><div><dt>DUST active games</dt><dd>{candidate.dust.unavailable ? `Unavailable — ${candidate.dust.reason}` : format(candidate.dust.activeGamesAdded!)}</dd></div><div><dt>DUST bench games</dt><dd>{candidate.dust.unavailable ? "Unavailable" : format(candidate.dust.marginalBenchGames!)}</dd></div></dl><h4>Enabled categories</h4><ul>{Object.entries(candidate.categories).map(([key, item]) => <li key={key}><span>{key.replaceAll("_", " ")}</span><strong>{item.state === "missing" ? "Unavailable" : item.state === "irrelevant" ? `No effect · ${formatCategory(key, item.after)}` : `${formatCategory(key, item.baseline)} → ${formatCategory(key, item.after)} (${formatCategory(key, item.delta, true)}) · ${item.direction} is better`}</strong></li>)}</ul></article>)}</div>
    </>}
  </section>;
}
function format(value: number) { return `${value > 0 ? "+" : ""}${value.toFixed(2)}`; }
function formatValue(value: number) { return value.toFixed(1); }
function formatCategory(key: string, value: number | null, signed = false) { if (value === null) return "Unavailable"; const digits = key === "SAVE_PERCENTAGE" ? 4 : key === "GOALS_AGAINST_AVERAGE" ? 3 : 1; return `${signed && value > 0 ? "+" : ""}${value.toFixed(digits)}`; }
