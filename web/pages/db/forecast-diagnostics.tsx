import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import supabase from "lib/supabase";
import {
  FORECAST_DIAGNOSTICS_VERSION,
  forecastDiagnosticsJson,
  forecastDiagnosticsMarkdown,
  type ForecastBase,
  type ForecastDiagnosticsReport,
  type SourceEvidence,
} from "lib/forecast-diagnostics/contract";
import styles from "styles/ForecastDiagnostics.module.scss";

const value = (item: unknown): string => item == null ? "Unavailable" : String(item);
const list = (items: unknown[] | null): string => items == null ? "Unavailable" : items.length ? items.join(", ") : "None";

function Sources({ sources }: { sources: SourceEvidence[] }) {
  return sources.length ? <div className={styles.tableScroll} tabIndex={0} aria-label="Source lineage table">
    <table><caption>Source lineage and cutoff availability</caption><thead><tr>
      <th>Source / revision / hash</th><th>Observed</th><th>Available / basis</th><th>Retrieved</th><th>Immutable / hash verified</th>
    </tr></thead><tbody>{sources.map((source, index) => <tr key={index}>
      <td>{source.source}<br />{value(source.revisionId)}<br /><code>{value(source.payloadHash)}</code></td>
      <td>{value(source.observedAt)}</td><td>{value(source.availableAt)}<br />{source.availabilityBasis}</td>
      <td>{source.retrievedAt}</td><td>{source.immutable ? "Yes" : "No"} / {source.hashVerified ? "Yes" : "No"}</td>
    </tr>)}</tbody></table>
  </div> : <p>No source lineage retained.</p>;
}

function BaseDetails({ base, label }: { base: ForecastBase | null; label: string }) {
  if (!base) return <p>{label}: Unavailable</p>;
  return <details className={styles.details}><summary>{label} definitions, contributors, and lineage · {base.coverage}</summary>
    <dl className={styles.metadata}>
      <div><dt>Contract / forecast set</dt><dd>{base.contractVersion} / {base.forecastSetId}</dd></div>
      <div><dt>Game / team / season / phase</dt><dd>{base.gameId} / {base.teamId} / {base.seasonId} / {base.phase}</dd></div>
      <div><dt>Horizon / cutoff / issued</dt><dd>{value(base.horizonGames)} / {value(base.cutoffAt)} / {value(base.issuedAt)}</dd></div>
      <div><dt>Model / calibration</dt><dd>{value(base.modelVersion)} / {value(base.calibrationVersion)}</dd></div>
      <div><dt>Features</dt><dd>{list(base.featureNames)}</dd></div>
      <div><dt>Roster scenario / strength states</dt><dd>{value(base.rosterScenarioId)} / {list(base.strengthStates)}</dd></div>
      <div><dt>Goal endpoint</dt><dd>{base.goalDefinition ? `${base.goalDefinition.periods}; shootout ${base.goalDefinition.shootout}; empty net ${base.goalDefinition.emptyNet}` : "Unavailable"}</dd></div>
      <div><dt>Mean semantics / appearance probability</dt><dd>{base.meanSemantics} / {value(base.appearanceProbability)}</dd></div>
      <div><dt>Residual / empty-net mean</dt><dd>{value(base.residualMean)} / {value(base.emptyNetMean)}</dd></div>
      <div><dt>Workload by strength</dt><dd>{base.workloadByStrength ? Object.entries(base.workloadByStrength).map(([strength, amount]) => `${strength}: ${value(amount)}`).join("; ") || "None" : "Unavailable"}</dd></div>
    </dl>
    {base.nativeGoalAccounting && <div>
      <h4>Partial native goal accounting</h4>
      <p>Reported player ES/PP bucket sum: {value(base.nativeGoalAccounting.reportedEsPpMean)}.
        Participation-adjusted ES/PP mean given the game is played: {value(base.nativeGoalAccounting.expectedListedEsPpMeanGivenGamePlayed)}.</p>
      <p>Full official-play mean: {value(base.nativeGoalAccounting.fullOfficialPlayMean)}.
        PK, period, empty-net and residual coverage require source-supported proof.</p>
      <p>Native accounting gaps: {list(base.nativeGoalAccounting.reasons)}</p>
    </div>}
    {base.nativeRosterContributorCoverage && <div>
      <h4>Native roster selection</h4>
      <p>Retained producer selection records. An omission does not prove nonappearance or zero goals.
        Producer gate results do not prove complete rate history.
        Residual mean: {value(base.nativeRosterContributorCoverage.residualMean)}.</p>
      <div className={styles.tableScroll} tabIndex={0} aria-label={`${label} native roster selection table`}><table>
        <caption>Native roster selection and unknown goal contributions</caption>
        <thead><tr><th>Player</th><th>Population</th><th>Selection reason</th><th>Producer rate gate</th>
          <th>Appearance probability given game played</th><th>Participation reason</th><th>Goal contribution</th><th>Full mean</th></tr></thead>
        <tbody>{base.nativeRosterContributorCoverage.contributors.map(player => <tr key={player.playerId}>
          <td>{player.playerId}</td><td>{player.population}</td><td>{player.selectionReason}</td><td>{player.rateEligibility}</td>
          <td>{value(player.participationProbabilityGivenGamePlayed)}</td><td>{value(player.participationReason)}</td>
          <td>{player.goalContributionStatus}</td><td>{value(player.fullOfficialPlayMean)}</td>
        </tr>)}</tbody>
      </table></div>
    </div>}
    {base.contributors.length ? <div className={styles.tableScroll} tabIndex={0} aria-label={`${label} contributors table`}><table><caption>Player participation accounting</caption><thead><tr><th>Player</th><th>Scenario</th><th>Mean</th><th>Semantics</th><th>Appearance probability</th></tr></thead><tbody>{base.contributors.map((player, index) => <tr key={index}><td>{player.playerId}</td><td>{player.scenarioId}</td><td>{value(player.mean)}</td><td>{player.semantics}</td><td>{value(player.appearanceProbability)}</td></tr>)}</tbody></table></div> : <p>No player contributors retained.</p>}
    <Sources sources={base.lineage} />
  </details>;
}

export default function ForecastDiagnosticsPage() {
  const router = useRouter();
  const [gameId, setGameId] = useState("");
  const [cutoffAt, setCutoffAt] = useState("");
  const [report, setReport] = useState<ForecastDiagnosticsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<{ id: number; controller: AbortController | null }>({ id: 0, controller: null });
  const prefilled = useRef(false);

  useEffect(() => {
    if (!router.isReady || prefilled.current) return;
    prefilled.current = true;
    if (typeof router.query.gameId === "string") setGameId(router.query.gameId);
    if (typeof router.query.cutoffAt === "string") setCutoffAt(router.query.cutoffAt);
  }, [router.isReady, router.query.gameId, router.query.cutoffAt]);
  useEffect(() => () => { request.current.id += 1; request.current.controller?.abort(); }, []);

  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    request.current.controller?.abort();
    const id = ++request.current.id;
    setReport(null);
    setError(null);
    setLoading(false);
    const cutoff = cutoffAt.trim();
    if (!Number.isSafeInteger(Number(gameId)) || Number(gameId) <= 0 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(cutoff) || !Number.isFinite(Date.parse(cutoff))) {
      setError("Enter a positive game ID and a timezone-qualified ISO cutoff, such as 2026-10-05T18:00:00Z (UTC).");
      return;
    }
    const controller = new AbortController();
    request.current.controller = controller;
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (id !== request.current.id) return;
      const params = new URLSearchParams({ gameId: String(Number(gameId)), cutoffAt: cutoff });
      const response = await fetch(`/api/internal/forecast-diagnostics?${params}`, {
        method: "GET", signal: controller.signal,
        headers: data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {},
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error("Sign in with an admin account to load diagnostics (401).");
        if (response.status === 403) throw new Error("Your account does not have admin access (403).");
        throw new Error(`Diagnostics could not be loaded (${response.status}). Check the game and cutoff, then retry.`);
      }
      const payload: ForecastDiagnosticsReport = await response.json();
      if (payload.contractVersion !== FORECAST_DIAGNOSTICS_VERSION || !payload.scope || !Array.isArray(payload.comparisons) || !Array.isArray(payload.exposure) || !Array.isArray(payload.sources) || !payload.replay || !Array.isArray(payload.limitations)) {
        throw new Error("The diagnostics response is unsupported or incomplete. No report is available to export.");
      }
      if (payload.scope.gameId !== Number(gameId) || Date.parse(payload.scope.cutoffAt) !== Date.parse(cutoff)) throw new Error("The response does not match the requested game and cutoff. Retry to load the correct scope.");
      if (id === request.current.id) setReport(payload);
    } catch (caught) {
      if (id === request.current.id && !controller.signal.aborted) setError(caught instanceof Error ? caught.message : "A network error prevented loading diagnostics. Retry the request.");
    } finally {
      if (id === request.current.id) setLoading(false);
    }
  }

  function download(format: "json" | "md") {
    if (!report || loading) return;
    const content = format === "json" ? forecastDiagnosticsJson(report) : forecastDiagnosticsMarkdown(report);
    const url = URL.createObjectURL(new Blob([content], { type: format === "json" ? "application/json;charset=utf-8" : "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `forecast-diagnostics-${report.scope.gameId}.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <><Head><title>Forecast diagnostics | FHFH</title><meta name="robots" content="noindex,nofollow" /></Head><main className={styles.page}>
    <header><p className={styles.eyebrow}>Admin · Checkpoint 1 · Read only</p><h1>Forecast diagnostics</h1><p>Inspect one pregame forecast set. Diagnostic estimates are unvalidated; alignment does not establish model accuracy.</p></header>
    <form className={styles.form} onSubmit={load}>
      <label>Game ID<input name="gameId" type="number" min="1" step="1" required value={gameId} onChange={event => setGameId(event.target.value)} /></label>
      <label>Cutoff (ISO with timezone)<input name="cutoffAt" type="text" required aria-describedby="cutoff-help" placeholder="2026-10-05T18:00:00Z" value={cutoffAt} onChange={event => setCutoffAt(event.target.value)} /></label>
      <button type="submit">{loading ? "Load another scope" : "Load diagnostics"}</button>
      <p id="cutoff-help">Use UTC with Z, e.g. 2026-10-05T18:00:00Z, or an explicit offset, e.g. 2026-10-05T14:00:00-04:00. Cutoff must precede puck drop.</p>
    </form>
    <div className={styles.actions}><button disabled={!report || loading} onClick={() => download("json")}>Export JSON</button><button disabled={!report || loading} onClick={() => download("md")}>Export Markdown</button></div>
    <div role="status" aria-live="polite">{loading ? "Loading diagnostics…" : report ? "Diagnostics loaded for the scope below." : !error ? "Enter a game and cutoff to load diagnostics." : null}</div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {report && <div aria-label="Loaded diagnostic report">
      {report.evidenceKind === "synthetic_fixture" && <p className={styles.warning}><strong>Synthetic fixture</strong> · Fictional engineering evidence; not production forecasts.</p>}
      <section className={styles.panel}><h2>Loaded scope</h2><dl className={styles.metadata}>
        <div><dt>Game / season / phase / horizon</dt><dd>{report.scope.gameId} / {report.scope.seasonId} / {report.scope.phase} / {report.scope.horizonGames} game</dd></div>
        <div><dt>Game date / puck drop</dt><dd>{report.scope.gameDate} / {report.scope.startAt}</dd></div>
        <div><dt>Cutoff</dt><dd>{report.scope.cutoffAt}</dd></div>
        <div><dt>Forecast set</dt><dd>{report.forecastSetId}</dd></div>
        <div><dt>Contract / generated</dt><dd>{report.contractVersion} / {report.generatedAt}</dd></div>
        <div><dt>Evidence</dt><dd>{report.evidenceKind}</dd></div>
      </dl></section>
      <section className={styles.panel}><h2>Base comparisons</h2><p>Difference = comparable FORGE − comparable team. Comparable means are shown only for aligned bases. Raw means retain their original participation semantics.</p>
        {report.comparisons.length ? <><div className={styles.tableScroll} tabIndex={0} aria-label="Base comparison table"><table><caption>Goals for this game</caption><thead><tr><th>Team</th><th>Raw FORGE</th><th>Raw team</th><th>Comparable FORGE</th><th>Comparable team</th><th>Difference</th><th>Status</th></tr></thead><tbody>{report.comparisons.map(row => <tr key={row.teamId}><th scope="row">{row.abbreviation}</th><td>{value(row.forge?.rawMean)}</td><td>{value(row.team?.rawMean)}</td><td>{value(row.status === "aligned" ? row.forgeMean : null)}</td><td>{value(row.status === "aligned" ? row.teamMean : null)}</td><td>{value(row.status === "aligned" ? row.difference : null)}</td><td>{row.status}</td></tr>)}</tbody></table></div>
          {report.comparisons.map(row => <article key={row.teamId}><h3>{row.abbreviation} accounting</h3><p>Alignment reasons: {list(row.reasons)}</p><BaseDetails label={`${row.abbreviation} FORGE`} base={row.forge} /><BaseDetails label={`${row.abbreviation} team`} base={row.team} /></article>)}</> : <p>No retained forecast bases for this scope. Comparable estimates are Unavailable.</p>}
      </section>
      <section className={styles.panel}><h2>Team-game exposure</h2>{report.exposure.length ? <><div className={styles.tableScroll} tabIndex={0} aria-label="Team-game exposure table"><table><caption>Legacy versus verified exposure</caption><thead><tr><th>Team / season</th><th>Source rows</th><th>Legacy GP / GF / GA</th><th>Verified GP / GF / GA</th><th>Actual last-five count</th><th>Coverage</th></tr></thead><tbody>{report.exposure.map(row => <tr key={row.teamId}><th scope="row">{row.abbreviation} / {row.seasonId}</th><td>{row.sourceRowCount}</td><td>{row.legacyTotals.gp} / {row.legacyTotals.gf} / {row.legacyTotals.ga}</td><td>{value(row.correctedTotals.gp)} / {value(row.correctedTotals.gf)} / {value(row.correctedTotals.ga)}</td><td>{row.actualLastFiveCount}</td><td>{row.coverage}</td></tr>)}</tbody></table></div>{report.exposure.map(row => <details className={styles.details} key={row.teamId}><summary>{row.abbreviation} accepted games and exclusions ({row.exclusions.length})</summary><p>Source: {row.source}<br />Accepted game IDs: {list(row.acceptedGameIds)}<br />Last-five game IDs: {list(row.lastFiveGameIds)}</p>{row.exclusions.length ? <ul>{row.exclusions.map((excluded, index) => <li key={index}>Row {excluded.rowIndex}: {excluded.reason}</li>)}</ul> : <p>No rows excluded.</p>}</details>)}</> : <p>No team-game exposure retained.</p>}</section>
      <section className={styles.panel}><h2>Source manifest</h2><Sources sources={report.sources} /></section>
      <section className={styles.panel}><h2>Replay: {report.replay.status}</h2>{report.replay.blockers.length ? <ul>{report.replay.blockers.map((blocker, index) => <li key={index}>{blocker}</li>)}</ul> : <p>No replay blockers reported.</p>}<h3>Limitations</h3>{report.limitations.length ? <ul>{report.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul> : <p>No additional limitations reported.</p>}</section>
    </div>}
  </main></>;
}
