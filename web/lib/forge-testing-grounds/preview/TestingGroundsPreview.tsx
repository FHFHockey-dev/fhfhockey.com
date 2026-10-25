import { useId, useMemo, useState } from "react";
import { z } from "zod";
import { projectOperationalProgress } from "../operationalProgress";
import { type HealthIssueCode } from "../dataHealth";
import { MAX_LISTED_RUNS, RUN_PHASES, runProgressSchema, type RunEvent } from "../runProjection";
import { createHistoryFixture, createPreviewFixture, previewScenarios, type PreviewScenario } from "./previewFixtures";
import styles from "./TestingGroundsPreview.module.scss";

const runLabels = {
  draft: "Draft", preflight_blocked: "Preflight blocked", queued: "Queued", running: "Running",
  cancellation_requested: "Cancellation requested", cancelled: "Cancelled", failed: "Failed",
  completed_awaiting_reveal: "Completed · results sealed", completed_revealed: "Completed",
};
const stageLabels = { historical_games: "Historical inputs", fitting: "Model fitting", player_game_predictions: "Player-game predictions", evaluation_tasks: "Evaluation tasks" };
const stageStates = { queued: "Queued", running: "Running", cancellation_requested: "Cancellation requested", cancelled: "Cancelled", failed: "Failed", completed: "Completed" };
const issueLabels: Record<HealthIssueCode, string> = {
  missing: "Missing field", null: "Null value", malformed: "Malformed value", duplicate: "Duplicate identity", stale: "Stale observation",
  identity: "Invalid identity", units: "Unit mismatch", strength: "Strength mismatch", source_mismatch: "Source mismatch", invalid_clock: "Invalid source clocks",
  missing_revision: "Missing revision", historically_unavailable: "Historically unavailable", availability_unknown: "Availability unknown", later_capture: "Later capture",
};
const phaseLabels: Record<typeof RUN_PHASES[number], string> = { history: "Historical inputs", fitting: "Model fitting", prediction: "Predictions", evaluation: "Evaluation" };
const eventLabels: Record<RunEvent, string> = {
  accepted: "Accepted", step_claimed: "Step started", unit_accepted: "Work unit saved", checkpoint_saved: "Checkpoint saved",
  awaiting_outcomes: "Waiting for outcomes", retry_queued: "Retry queued", completed_sealed: "Completed, results sealed",
  planned_reveal: "Revealed by plan", cancellation_requested: "Cancellation requested", cancelled: "Cancelled",
  cancelled_at_checkpoint: "Cancelled at checkpoint", cancelled_after_lease_expiry: "Cancelled after worker lease expired",
  run_deadline: "Run deadline reached", execution_budget: "Execution budget used", outcome_check_budget: "Outcome-check budget used",
  retry_budget: "Retry budget used", storage_limit: "Storage limit reached",
};
const historySchema = z.object({ runs: z.array(runProgressSchema).max(MAX_LISTED_RUNS) }).strict();
const number = (value: number) => value.toLocaleString("en-US");
function completionLabel(percent: number | null, processed: number | null, eligible: number): string {
  if (percent === null) return "No eligible units";
  const rounded = percent.toFixed(1);
  return processed !== eligible && rounded === "100.0" ? "Less than 100% complete" : `${rounded}% complete`;
}
function duration(ms: number | null): string {
  if (ms === null) return "Not started";
  const seconds = Math.max(0, Math.floor(ms / 1_000));
  return seconds < 60 ? `${seconds}s` : seconds < 3_600 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${Math.floor(seconds / 3_600)}h ${Math.floor(seconds / 60) % 60}m`;
}

/** Strict operational envelope only. Unknown fields are never reflected in UI/errors/JSON. */
export function OperationalProgressPanel({ snapshot, now }: { snapshot: unknown; now: string }) {
  const headingId = useId();
  let progress: ReturnType<typeof projectOperationalProgress>;
  try { progress = projectOperationalProgress(snapshot, { now, staleAfterMs: 90_000 }); }
  catch { return <section className={styles.panel} aria-labelledby={headingId}><h2 id={headingId}>Work progress</h2><p role="alert">Progress is unavailable. The saved operational snapshot could not be validated.</p></section>; }
  const active = progress.stages.find(stage => stage.status === "running" || stage.status === "cancellation_requested");
  return <section className={styles.panel} aria-labelledby={headingId}>
    <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Operational view</p><h2 id={headingId}>Work progress</h2></div><span className={styles.badge}>{runLabels[progress.state]}</span></div>
    <p className={styles.muted}>Completed work units only. There is no overall percentage or live model score.</p>
    {active?.heartbeatStatus === "stale" && <p className={styles.notice} role="status">Heartbeat is stale. The saved state is still {stageStates[active.status].toLowerCase()}; this does not prove the worker failed.</p>}
    {progress.state === "cancellation_requested" && <p className={styles.notice}>Waiting for a safe checkpoint. Accepted work is retained; a request is not confirmation that computation has stopped.</p>}
    {(progress.state === "cancelled" || progress.state === "failed") && <p className={styles.notice}>Accepted work is retained. Remaining units are incomplete and results stay sealed.</p>}
    <ol className={styles.stages}>
      {progress.stages.map((stage, index) => <li key={stage.stageId} className={styles.stage}>
        <div className={styles.stageHeading}><span className={styles.stepNumber} aria-hidden="true">{index + 1}</span><h3>{stageLabels[stage.kind]}</h3><span className={styles.stageStatus}>{stageStates[stage.status]}</span></div>
        {stage.kind === "fitting" ? <p className={styles.fitMessage}>No measured internal percentage. {stage.status === "queued" ? "Waiting for historical inputs." : `Elapsed ${duration(stage.elapsedMs)}.`}</p> : <>
          <div className={styles.measure}><strong>{number(stage.completed!)} <span>/ {number(stage.denominator.eligible)} {stage.unit}</span></strong><span>{completionLabel(stage.percent, stage.completed, stage.denominator.eligible)}</span></div>
          {stage.percent !== null && <progress aria-label={`${stageLabels[stage.kind]} completed work`}
            aria-valuetext={`${number(stage.completed!)} of ${number(stage.denominator.eligible)} ${stage.unit} processed; ${number(stage.counts.pending)} pending. ${stage.completed === stage.denominator.eligible ? "All declared work processed." : "Work is incomplete."}`}
            value={stage.completed!} max={stage.denominator.eligible} />}
          <dl className={styles.counters}>{(["successful", "skipped", "failed", "pending"] as const).map(key => <div key={key}><dt>{key === "successful" ? "Successful" : key === "skipped" ? "Skipped" : key === "failed" ? "Failed" : "Pending"}</dt><dd>{number(stage.counts[key])}</dd></div>)}</dl>
          {stage.denominator.excludedBeforeStage > 0 && <p className={styles.small}>{number(stage.denominator.excludedBeforeStage)} excluded before this stage; excluded rows do not count as completed work.</p>}
        </>}
        <div className={styles.stageMeta}><span>Elapsed: {duration(stage.elapsedMs)}</span><span>{stage.heartbeatStatus === "inactive" ? "Heartbeat inactive" : stage.heartbeatStatus === "not_received" ? "Heartbeat not received" : `${stage.heartbeatStatus === "stale" ? "Stale" : "Recent"} heartbeat · ${duration(stage.heartbeatAgeMs)} ago`}</span></div>
      </li>)}
    </ol>
    <details className={styles.details}><summary>Operational snapshot · revision {progress.revision}</summary><p className={styles.small}>Synthetic saved state at {progress.recordedAt}. No result payload or arbitrary worker log is included.</p><pre tabIndex={0} aria-label="Operational snapshot JSON">{JSON.stringify(progress, null, 2)}</pre></details>
  </section>;
}

/** Saved-run listing from the owner collection route. Unvalidated listings are never reflected. */
export function RunHistoryPanel({ listing }: { listing: unknown }) {
  const headingId = useId();
  const parsed = historySchema.safeParse(listing);
  const heading = <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Reconnect</p><h2 id={headingId}>Saved runs</h2></div></div>;
  if (!parsed.success) return <section className={styles.panel} aria-labelledby={headingId}>{heading}<p role="alert">Saved runs are unavailable. The listing could not be validated.</p></section>;
  const runs = parsed.data.runs;
  return <section className={styles.panel} aria-labelledby={headingId}>
    {heading}
    <p className={styles.muted}>Reopening on any device reads this saved state from the server. Nothing runs in this browser tab.</p>
    {runs.length === 0 ? <p>No saved runs yet.</p> : <ol className={styles.stages}>{runs.map(run => <li key={run.runId} className={styles.stage}>
      <div className={styles.stageHeading}><h3>Run {run.runId.slice(-4)}</h3><span className={styles.stageStatus}>{runLabels[run.state]}</span></div>
      <p className={styles.small}>Created {new Date(run.createdAtMs).toISOString()} · {eventLabels[run.lastEvent]} · revision {run.revision}</p>
      <dl className={styles.counters}>{run.stages.map(stage => <div key={stage.phase}><dt>{phaseLabels[stage.phase]}</dt>
        <dd>{stage.percent === null ? "No percentage" : `${number(stage.successful + stage.failed)} / ${number(stage.total)}`}</dd></div>)}</dl>
      <p className={styles.small}>{run.storageMode === "memory_reference" ? "Memory reference: not durable, lost if the server restarts." : "Durable store."} {run.state === "completed_revealed" ? "Results revealed by plan." : "Results sealed."}</p>
    </li>)}</ol>}
  </section>;
}

function DataHealthPanel({ report }: { report: NonNullable<ReturnType<typeof createPreviewFixture>["health"]> }) {
  const headingId = useId();
  const rows = report.counts;
  return <section className={styles.panel} aria-labelledby={headingId}>
    <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Preflight evidence</p><h2 id={headingId}>Data health</h2></div><span className={styles.badge}>{report.status === "blocked" ? "Blocked" : "Checked with warnings"}</span></div>
    <p className={styles.muted}>Numeric input fields only. Valid zero, missing and null remain distinct.</p>
    <dl className={styles.healthCounts}>{[["Input rows", rows.inputRows], ["Valid numeric", rows.validNumericRows], ["Valid zero", rows.validZeroRows], ["Missing", rows.missingRows], ["Null", rows.nullRows], ["Affected rows", rows.affectedRows]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className={styles.small}>Numeric validity is separate from source health. Issue counts can overlap; affected rows are counted once.</p>
    <div className={styles.notice}><strong>{report.historyClassification === "reconstructed_history_diagnostic" ? "Reconstructed-history diagnostic" : "Snapshot clocks present"}</strong><p>{report.authenticityLimitation}</p></div>
    <div className={styles.issues}>{report.issues.map(issue => <details key={issue.code} className={styles.issue}>
      <summary><span>{issueLabels[issue.code]}</span><span className={styles.issueCount}>{issue.affectedRows} {issue.affectedRows === 1 ? "row" : "rows"} · {issue.severity}</span></summary>
      <p><strong>Expected:</strong> {issue.expected}</p><p>{issue.guidance}</p>
      <label>Safe affected IDs · synthetic sample<textarea readOnly rows={Math.min(4, issue.samples.length)} value={issue.samples.map(sample => sample.identity ? `Player ${sample.identity.playerId} / game ${sample.identity.gameId} (row ${sample.rowIndex + 1})` : `Row ${sample.rowIndex + 1}: invalid identity withheld`).join("\n")} /></label>
      {issue.omittedSamples > 0 && <p>{issue.omittedSamples} additional samples omitted.</p>}
    </details>)}</div>
    <div className={styles.manual}><h3>Manual investigation</h3><p>Inspect the safe IDs and declared source in <code>/db/runner</code>. Navigation does not authorize a repair.</p><p>No automatic repairs or exclusions. Repaired inputs need a new manifest and health report; preserve this report.</p><p className={styles.small}>Source: {report.specification.field.source} / {report.specification.field.table} / {report.specification.field.field} · {report.specification.field.unit} · {report.specification.field.strength}</p></div>
  </section>;
}

/** Fixture-only presentation. No auth claim, persistence, network or runner integration. */
export default function TestingGroundsPreview() {
  const [scenario, setScenario] = useState<PreviewScenario>("predicting");
  const fixture = useMemo(() => createPreviewFixture(scenario), [scenario]);
  const history = useMemo(() => createHistoryFixture(), []);
  const selectorId = useId(), launchReasonId = useId();
  return <main className={styles.preview}>
    <div className={styles.container}>
      <header className={styles.header}><div><p className={styles.eyebrow}>FORGE / Research workspace</p><h1>Testing Grounds</h1><p className={styles.subtitle}>Follow the work. Inspect the inputs. Keep results sealed.</p></div><span className={styles.previewBadge}>Synthetic preview</span></header>
      <section className={styles.previewBar} aria-label="Preview controls"><div><label htmlFor={selectorId}>Preview state</label><select id={selectorId} value={scenario} onChange={event => { const next = previewScenarios.find(item => item.id === event.target.value); if (next) setScenario(next.id); }}>{previewScenarios.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><p>These fixed September fixtures stay in this tab. Changing the view runs no job and saves no data.</p></section>
      <section className={styles.runSummary} aria-label="Experiment summary"><div><p className={styles.eyebrow}>Display fixture / September 2026</p><h2>{scenario === "empty" ? "No run selected" : "Baseline + candidate · operational preview"}</h2><p>Immutable version references and real model settings will appear after the approved model adapters are connected.</p></div><div className={styles.launch}><button type="button" disabled aria-describedby={launchReasonId}>Launch unavailable</button><p id={launchReasonId}>Hosted execution and owner access are not connected. Nothing continues after this preview closes.</p></div></section>
      {fixture.snapshot && fixture.health ? <div className={styles.grid}><OperationalProgressPanel snapshot={fixture.snapshot} now={fixture.now} /><DataHealthPanel report={fixture.health} /></div> : <section className={styles.panel}><h2>Start with a saved configuration</h2><p>Choose a preview state above to inspect the monitoring and data-health views. No experiment or health report has been created.</p></section>}
      <RunHistoryPanel listing={history} />
      <section className={`${styles.panel} ${styles.sealed}`} aria-label="Sealed results"><div><p className={styles.eyebrow}>Review boundary</p><h2>Results stay sealed</h2></div><p>{scenario === "sealed" ? "All fixture work is complete. Completion alone does not authorize reveal." : "Quality scores, outcome plots and result exports are unavailable in this preview."} A real run must satisfy its frozen reveal policy and independent outcome-availability checks.</p></section>
      <footer className={styles.footer}>Local synthetic UI only · no real inputs, repairs, captures or hosted jobs · Release C remains protected</footer>
    </div>
  </main>;
}
