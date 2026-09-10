import { useMemo, useState } from "react";
import { useDraftProScenarios } from "hooks/useDraftProScenarios";
import { scenarioFingerprint, type ScenarioInput } from "lib/draft-pro/scenarios";
import { ScenarioComparisonPanel } from "./ScenarioComparisonPanel";
import styles from "./ScenarioComparisonPanel.module.scss";

export type ScenarioComparisonWorkspaceProps = Readonly<{ eligible: boolean; input: ScenarioInput | null; draftId?: string | null }>;
/** Complete W09 surface. W07 only supplies the existing read-only dashboard adapter values and mounts it. */
export function ScenarioComparisonWorkspace({ eligible, input, draftId }: ScenarioComparisonWorkspaceProps) {
  const contextFingerprint = useMemo(() => input ? scenarioFingerprint(input) : null, [input]);
  const scenarios = useDraftProScenarios(contextFingerprint, eligible); const [name, setName] = useState("");
  const unavailable = !scenarios.result && !input ? "Choose two distinct available candidates." : null;
  return <section className={styles.workspace} aria-label="A versus B scenario workspace">
    <div className={styles.actions}>{eligible ? <><button type="button" disabled={!input || scenarios.status === "loading" || scenarios.status === "saving"} onClick={() => input && void scenarios.generate(input, draftId)}>{scenarios.status === "loading" ? "Comparing…" : "Compare A vs B"}</button><label htmlFor="scenario-name">Scenario name</label><input id="scenario-name" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="A vs B" /><button type="button" disabled={!input || !name.trim() || scenarios.status === "saving"} onClick={() => input && void scenarios.save(name.trim(), input, draftId)}>{scenarios.status === "saving" ? "Saving…" : "Save scenario"}</button></> : <span>Roster-impact scenarios require Draft Pro. Existing free two-player comparison remains available in the projections table.</span>}</div>
    {scenarios.error ? <p role="alert" className={styles.error}>{scenarios.error} <button type="button" onClick={() => void scenarios.retry()}>Retry failed action</button></p> : null}
    {eligible && scenarios.result && scenarios.contextUnavailable ? <p role="status">This historical scenario has no matching current comparison context. Its saved results remain visible but cannot be recalculated until two current candidates are selected.</p> : null}
    <ScenarioComparisonPanel eligible={eligible} result={eligible ? scenarios.result : null} savedFingerprint={scenarios.stale ? "stale" : scenarios.result?.fingerprint ?? null} unavailableReason={unavailable} />
    <div className={styles.saved}><h3>Saved scenarios</h3>{scenarios.listLoading ? <p role="status">Loading saved scenario names…</p> : scenarios.listError ? <p role="alert" className={styles.error}>{scenarios.listError} <button type="button" onClick={() => void scenarios.list()}>Retry saved list</button></p> : !scenarios.saved.length ? <p>{eligible ? "No saved scenarios yet." : "Sign in to see retained scenario names."}</p> : <ul>{scenarios.saved.map((item) => <li key={item.id}><button type="button" disabled={!eligible || scenarios.status !== "idle"} onClick={() => void scenarios.open(item.id)}>{item.name}</button><time dateTime={item.updated_at}>{new Date(item.updated_at).toLocaleString()}</time>{!eligible ? <span>Locked</span> : null}</li>)}</ul>}</div>
  </section>;
}
