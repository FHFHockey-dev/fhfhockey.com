import React, { useEffect, useMemo, useRef, useState } from "react";
import { adaptLocalSnapshot, type AdaptedCard, type LocalCardInput } from "../../lib/player-cards/adapter";
import { buildInteractionFixture, EXAMPLE_PLAYERS, type FixtureScenario } from "../../lib/player-cards/interactionFixtures";
import { displaySnapshot, flowSearch, flowSettings, pngContext, readFlow, type FlowState } from "../../lib/player-cards/interactionSnapshot";
import { CATEGORIES, CURATED_METRICS, EXTRA_METRICS, METRICS } from "../../lib/player-cards/registry";
import type { CardSettings } from "../../lib/player-cards/contracts";
import { cardPng } from "./PlayerCardPreview";
import { formatMetric } from "./PlayerCard";
import InteractiveCard from "./InteractiveCard";
import styles from "./PlayerCardFlow.module.scss";

export type FixtureLoader = (settings: CardSettings, scenario: FixtureScenario, playerId: number) => Promise<LocalCardInput>;
const localLoader: FixtureLoader = async (settings, scenario, playerId) => buildInteractionFixture(settings, scenario, playerId);
function save(blob: Blob, filename: string) { const url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url),1000); }

export default function PlayerCardFlow({ loadFixture = localLoader }: { loadFixture?: FixtureLoader }) {
  const [state, setState] = useState<FlowState>(() => readFlow(typeof window === "undefined" ? "" : window.location.search));
  const [query, setQuery] = useState(""); const [extra,setExtra] = useState(false); const [attempt,setAttempt] = useState(0);
  const [card,setCard] = useState<AdaptedCard | null>(null); const [phase,setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [message,setMessage] = useState(""); const [busy,setBusy] = useState(false); const svg = useRef<SVGSVGElement>(null); const exporting = useRef(false); const pendingPop = useRef<FlowState | null>(null);
  const settings = useMemo(() => flowSettings(state),[state]);
  useEffect(() => { const pop = () => { const next = readFlow(window.location.search); if (exporting.current) pendingPop.current = next; else { setState(next); setMessage(""); } }; window.addEventListener("popstate",pop); return () => window.removeEventListener("popstate",pop); },[]);
  useEffect(() => {
    let current = true; setPhase("loading"); setCard(null); setMessage("");
    loadFixture(settings,state.scenario,state.playerId).then(input => {
      if (!current) return;
      const result = adaptLocalSnapshot(input,state.playerId);
      if (result.state === "rejected") throw new Error(result.reason);
      setCard(result); setPhase("ready");
    }).catch(error => { if (current) { setPhase("error"); setMessage(error instanceof Error ? error.message : "Local fixture failed. Retry."); } });
    return () => { current = false; };
  },[loadFixture,settings,state.playerId,state.scenario,attempt]);
  function update(change: Partial<FlowState>) { if (exporting.current) return; const next = { ...state,...change }; window.history.pushState(null,"",flowSearch(next)); setState(next); setMessage(""); }
  const snapshot = card ? displaySnapshot(card) : null;
  const exportContext = snapshot ? pngContext(snapshot) : null;
  const selected = extra ? EXTRA_METRICS : CURATED_METRICS;
  const matches = EXAMPLE_PLAYERS.filter(player => player.name.toLowerCase().includes(query.trim().toLowerCase()));
  async function exportPng() {
    if (exporting.current || !svg.current || !snapshot || !exportContext || !card || card.state === "unavailable" || phase !== "ready") return;
    exporting.current = true; setBusy(true); setMessage("Creating PNG from this displayed fixture snapshot…");
    try { const blob = await cardPng(svg.current,exportContext); save(blob,`${snapshot.id}-${extra ? "extra" : "curated"}.png`); setMessage("Synthetic PNG downloaded from the displayed snapshot."); }
    catch(error) { setMessage(error instanceof Error ? error.message : "PNG failed. Retry with this snapshot."); }
    finally { exporting.current = false; setBusy(false); if (pendingPop.current) { setState(pendingPop.current); pendingPop.current = null; } }
  }
  return <main className={styles.flowPage}>
    <p className={styles.flowBadge}>FHFH · INTERACTIVE SYNTHETIC PREVIEW</p><h1 className={styles.flowTitle}>Pick a player. Choose the period. Keep the context.</h1>
    <p className={styles.flowIntro}>This fixture-only flow computes cards from fabricated game records and an 18-player comparison population. Search, period changes and PNG export are free. Live data and premium activation remain off. Defaults, season/short-N policies and rank conventions are proposals.</p>
    <div className={styles.flowStudio}><section className={styles.flowControls} aria-label="Player-card controls">
      <label htmlFor="flow-search">Search example skaters</label><input id="flow-search" value={query} disabled={busy} onChange={event => setQuery(event.target.value)} placeholder="Try Alex or Jamie" autoComplete="off" />
      {query && <ul className={styles.flowResults}>{matches.length ? matches.map(player => <li key={player.id}><button disabled={busy} onClick={() => { update({playerId:player.id}); setQuery(""); }}>{player.name} · {player.team} · {player.position} · ID {player.id}</button></li>) : <li role="status">No example skaters found.</li>}</ul>}
      <p className={styles.flowSmall}>Selected: {EXAMPLE_PLAYERS.find(player => player.id === state.playerId)!.name} · ID {state.playerId}</p>
      <label htmlFor="flow-mode">Period mode</label><select id="flow-mode" value={state.mode} disabled={busy} onChange={event => update({mode:event.target.value as FlowState["mode"]})}><option value="appearances">Each player’s own appearances</option><option value="calendar">Shared calendar dates · UTC</option></select>
      {state.mode === "appearances" ? <><label htmlFor="flow-n">Appearances per player</label><select id="flow-n" value={state.count} disabled={busy} onChange={event => update({count:Number(event.target.value) as FlowState["count"]})}><option value="5">Last 5</option><option value="10">Last 10</option><option value="20">Last 20</option></select></> : <><label htmlFor="flow-start">Start date · inclusive UTC</label><input id="flow-start" type="date" value={state.start} disabled={busy} onChange={event => update({start:event.target.value})} /><label htmlFor="flow-end">End date · inclusive UTC</label><input id="flow-end" type="date" value={state.end} disabled={busy} onChange={event => update({end:event.target.value})} /></>}
      <label htmlFor="flow-strength">Strength · synthetic coverage</label><select id="flow-strength" value={state.strength} disabled={busy} onChange={event => update({strength:event.target.value as FlowState["strength"]})}><option value="all">All Strengths</option><option value="5v5">5v5</option><option value="pp">Power play</option></select>
      <label htmlFor="flow-policy">Short season policy · proposed</label><select id="flow-policy" value={state.fullN ? "full" : "allow"} disabled={busy} onChange={event => update({fullN:event.target.value === "full"})}><option value="allow">Allow honestly known short sample</option><option value="full">Require all N appearances</option></select>
      <label htmlFor="flow-case">Source scenario · synthetic</label><select id="flow-case" value={state.scenario} disabled={busy} onChange={event => update({scenario:event.target.value as FixtureScenario})}><option value="complete">Complete example</option><option value="metric-gap">Missing ixG input</option><option value="unknown-pool">Unknown comparison coverage</option><option value="history-gap">Unverified appearance history</option><option value="stale">Stale source</option><option value="source-error">Source error</option></select>
      <label htmlFor="flow-content">Card content · proposed</label><select id="flow-content" value={extra ? "extra" : "curated"} disabled={busy} onChange={event => setExtra(event.target.value === "extra")}><option value="curated">Curated metrics</option><option value="extra">Extra metrics card</option></select>
      <button className={styles.flowDownload} disabled={busy || phase !== "ready" || !exportContext || card?.state === "unavailable"} onClick={exportPng}>{busy ? "Creating PNG…" : "Download synthetic PNG"}</button>
      <button disabled={busy || !snapshot || phase !== "ready"} onClick={() => save(new Blob([JSON.stringify({snapshot,renderVariant:"interactive-v1",selectedMetrics:selected,coverage:card?.coverage,source:card?.source,retrospective:card?.retrospective,liveActivation:false,premiumActivation:false},null,2)],{type:"application/json"}),`${snapshot!.id}-manifest.json`)}>Download snapshot manifest</button>
      <p className={styles.flowSmall}>Season-contained windows · common completed-game cutoff: 24 Oct 2026, 00:00 UTC. Every identity, source proof and statistic here is fabricated. No portrait assets or service access.</p>
    </section><section className={styles.flowPreview} aria-label="Computed fixture card">
      <p className={styles.flowStatus} role="status" aria-live="polite">{phase === "loading" ? "Computing local fixture…" : message || (card?.state === "unavailable" ? card.selection.reason || "Source unavailable: no exportable values." : card?.state === "partial" ? "Partial source: affected values and ranks are unavailable." : "Fixture snapshot ready.")}</p>
      {phase === "error" && <button onClick={() => setAttempt(value => value+1)}>Retry local fixture</button>}
      {snapshot && phase === "ready" && <><InteractiveCard snapshot={snapshot} selected={selected} svgRef={svg} /><p className={styles.flowSmall}>The PNG uses this exact displayed SVG. Its synthetic label and sample context are preserved. No period or source recomputation happens during export.</p>
        <details className={styles.flowReadings}><summary>Read values, source states and coverage at text size</summary>{CATEGORIES.map(category => <section key={category}><h2>{category}</h2><dl>{METRICS.filter(metric => metric.category === category && selected.includes(metric.id)).map(metric => { const value = snapshot.readings.find(row => row.id === metric.id)!, coverage = card!.coverage[metric.id]; return <div key={metric.id}><dt>{metric.label}<br />{metric.unit}</dt><dd><strong>{formatMetric(metric.id,value.value)}</strong><br />{value.rank ? `${value.rank.tied ? "T-" : ""}${value.rank.ordinal} of ${value.rank.population} · ${value.rank.percentile.toFixed(1)} percentile` : value.reason || value.rankReason}<br />{coverage.valid} valid · {coverage.knownUndefined} undefined · {coverage.missingIncomplete} missing<br />{coverage.knownShort} known short</dd></div>; })}</dl></section>)}</details>
        <details className={styles.flowReadings}><summary>Rank definition and interpretation</summary><p>Same metric, strength, season, cutoff and period rule for all valid values. Competition ties use1,2,2,4; percentile is100 × (values below + half the equal values) / valid N. No minimum GP/TOI or position filter. Unknown comparison coverage withholds ranks. Own-last-N spans can differ; calendar dates are shared and inclusive. Percentiles describe numeric magnitude, not quality or a forecast. Premium allocation remains undecided and inactive.</p></details></>}
    </section></div>
  </main>;
}
