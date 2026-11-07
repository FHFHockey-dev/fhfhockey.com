import React, { useMemo, useRef, useState } from "react";
import PlayerAnalysisCard, { analysisPresentationKey, type AnalysisPresentation } from "./PlayerAnalysisCard";
import type { PreparedHero } from "./HeroPlayerCard";
import { ANALYSIS_FIELDS, buildAnalysisSnapshot, type AnalysisCapture, type AnalysisSettings } from "../../lib/player-cards/analysisSnapshot";
import { cardBlshEvidence, cardTradeContext, type EvidenceReceipt, type TradeObservation } from "../../lib/player-cards/analysisEvidence";
import type { DisplayProfile } from "../../lib/buyLowSellHigh/displayProfile";
import { goalieOutlook, type GoalieInventory } from "../../lib/player-cards/goalieOutlook";
import { analysisManifest, rasterizeAnalysis } from "../../lib/player-cards/analysisExport";
import { saveCardFile } from "../../lib/player-cards/shareExport";
import styles from "./PlayerAnalysisStudio.module.scss";

export type AnalysisSelection = { id: string; label: string; capture: AnalysisCapture; hero?: PreparedHero | null; blsh?: { profile: DisplayProfile; receipt: EvidenceReceipt }; trades?: { records: TradeObservation[]; ownerReceipt: string | null } } | { id: string; label: string; goalie: GoalieInventory["player"]; inventory: GoalieInventory | null };
/** Supplied snapshots only. No loaders or provider calls are reachable from these controls. */
export default function PlayerAnalysisStudio({ selections, rasterize = rasterizeAnalysis }: { selections: readonly AnalysisSelection[]; rasterize?: typeof rasterizeAnalysis }) {
  const [selected, setSelected] = useState(selections[0]?.id || ""), [query, setQuery] = useState(""), [view, setView] = useState<"categories" | "comparison" | "evidence" | "trades">("categories");
  const [settings, setSettings] = useState<AnalysisSettings>({ period: { mode: "appearances", count: 5 }, baseline: "previous", basis: "per-game", visual: "bars" }), [gameIndex, setGameIndex] = useState(0);
  const [prepared, setPrepared] = useState<{ key: string; file: File } | null>(null), [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  const svg = useRef<SVGSVGElement>(null), generation = useRef(0), busyRef = useRef(false);
  const item = selections.find(s => s.id === selected), capture = item && "capture" in item ? item.capture : null;
  const snapshot = useMemo(() => capture ? buildAnalysisSnapshot(capture, settings) : null, [capture, settings]);
  const hero = item && "capture" in item ? item.hero : null;
  const p: AnalysisPresentation | null = item && "goalie" in item ? { goalie: goalieOutlook(item.inventory, item.goalie), gameIndex } : snapshot && item && "capture" in item ? { snapshot, view, blsh: cardBlshEvidence(snapshot, item.blsh?.profile || null, item.blsh?.receipt || null), trades: cardTradeContext(snapshot.capture.player.id, item.trades?.records || [], { fixture: snapshot.capture.source === "synthetic", ownerReceipt: item.trades?.ownerReceipt || null, asOf: snapshot.capture.observedAt }) } : null;
  const key = p ? analysisPresentationKey(p, hero) : "", keyRef = useRef(key); keyRef.current = key;
  const changed = () => { generation.current++; setPrepared(null); setStatus(""); };
  const change = (patch: Partial<AnalysisSettings>) => { changed(); setSettings(s => ({ ...s, ...patch })); };
  const exportable = p && ("snapshot" in p ? !p.snapshot.recent.reason : p.goalie.state === "fixture");
  async function image(share: boolean) {
    if (!p || !svg.current || !exportable || busyRef.current) return;
    const run = generation.current, savedKey = key; busyRef.current = true; setBusy(true);
    try {
      const blob = await rasterize(svg.current, p, hero);
      if (run !== generation.current || savedKey !== keyRef.current) return;
      const file = new File([blob], `fhfh-analysis-${selected}.png`, { type: "image/png" });
      if (share) { setPrepared({ key: savedKey, file }); setStatus("Image prepared from the displayed snapshot."); } else { saveCardFile(file, file.name); setStatus("PNG saved."); }
    } catch (e) { if (run === generation.current) setStatus(e instanceof Error ? e.message : "Export failed."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function share() {
    if (!prepared || prepared.key !== key) return;
    if (!navigator.canShare?.({ files: [prepared.file] }) || !navigator.share) { setStatus("File sharing unavailable on this device; download the PNG."); return; }
    try { await navigator.share({ files: [prepared.file] }); setStatus("Share dialog closed."); } catch (e) { setStatus(e instanceof Error && e.name === "AbortError" ? "Share cancelled." : "Unable to share; download the PNG."); }
  }
  return <section className={styles.studio} aria-label="Player card analysis">
    <h1>Player card analysis</h1><p className={styles.notice}>Local card extension · supplied captures only. Existing card formats and artwork remain in the current editor. Fixture records are labeled throughout.</p>
    <div className={styles.controls}>
      <label className={styles.control}>Search supplied players<input value={query} onChange={e => { setQuery(e.target.value); changed(); setSelected(""); }} /></label>
      <label className={styles.control}>Player<select aria-label="Player" value={selected} onChange={e => { changed(); setSelected(e.target.value); setGameIndex(0); }}><option value="">Choose a player</option>{selections.filter(s => s.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      {capture && <>
        <label className={styles.control}>Analysis view<select aria-label="Analysis view" value={view} onChange={e => { changed(); setView(e.target.value as typeof view); }}><option value="categories">Scoring & peripherals</option><option value="comparison">Recent comparison</option><option value="evidence">BLSH evidence</option><option value="trades">Trade context</option></select></label>
        <label className={styles.control}>Window<select aria-label="Window" value={settings.period.mode === "appearances" ? settings.period.count : "calendar"} onChange={e => change({ period: e.target.value === "calendar" ? { mode: "calendar", start: capture.observedAt.slice(0, 8) + "01", end: capture.observedAt.slice(0, 10) } : { mode: "appearances", count: Number(e.target.value) as 5 | 10 | 20 }, ...(e.target.value === "20" || e.target.value === "calendar" ? { baseline: "previous" as const } : {}) })}><option value="5">Last 5 appearances</option><option value="10">Last 10 appearances</option><option value="20">Last 20 appearances</option><option value="calendar">UTC calendar</option></select></label>
        {settings.period.mode === "calendar" && <><label className={styles.control}>Start date<input type="date" value={settings.period.start} onChange={e => { if (settings.period.mode === "calendar") change({ period: { ...settings.period, start: e.target.value } }); }} /></label><label className={styles.control}>End date<input type="date" value={settings.period.end} onChange={e => { if (settings.period.mode === "calendar") change({ period: { ...settings.period, end: e.target.value } }); }} /></label></>}
        {view === "comparison" && <label className={styles.control}>Comparison baseline<select aria-label="Comparison baseline" value={settings.baseline} onChange={e => change({ baseline: e.target.value as "previous" | "season" })}><option value="previous">Matched previous appearances</option><option value="season" disabled={settings.period.mode !== "appearances" || settings.period.count === 20}>Season to date (L5/L10)</option></select></label>}
        <label className={styles.control}>Value basis<select aria-label="Value basis" value={settings.basis} onChange={e => change({ basis: e.target.value as AnalysisSettings["basis"] })}><option value="per-game">Per game</option><option value="total">Totals</option><option value="per60">Per 60 minutes</option></select></label>
        {view === "categories" && <label className={styles.control}>Category display<select aria-label="Category display" value={settings.visual} onChange={e => change({ visual: e.target.value as "bars" | "radar" })}><option value="bars">Aligned bars</option><option value="radar">Raw category shape</option></select></label>}
      </>}
      {p && "goalie" in p && <label className={styles.control}>Scheduled game<select aria-label="Scheduled game" value={gameIndex} onChange={e => { changed(); setGameIndex(Number(e.target.value)); }}>{p.goalie.games.map((g, i) => <option value={i} key={g.id}>{g.heading}</option>)}</select></label>}
    </div>
    {!p && <p role="status">{selections.some(s => s.label.toLowerCase().includes(query.toLowerCase())) ? "Choose a player. Previous values have been cleared." : "No matching supplied player."}</p>}
    {p && <><div className={styles.preview}><PlayerAnalysisCard presentation={p} hero={hero} svgRef={svg} /></div><div className={styles.controls}>
      <button disabled={!exportable || busy} onClick={() => void image(false)}>Download analysis PNG</button><button disabled={!exportable || busy} onClick={() => void image(true)}>Prepare analysis share</button><button disabled={!prepared || prepared.key !== key || busy} onClick={() => void share()}>Share prepared image</button>
      <button onClick={() => { const file = new File([JSON.stringify(analysisManifest(p, hero), null, 2)], `fhfh-analysis-${selected}.json`, { type: "application/json" }); saveCardFile(file, file.name); }}>Download analysis manifest</button>
    </div><div className={styles.details} aria-label="Readable card details">
      {"snapshot" in p ? <><p>{p.snapshot.disclosure}</p><p>{p.snapshot.capture.finality}</p><p>{p.snapshot.recent.reason || p.snapshot.baseline.reason}</p><ul className={styles.metrics}>{p.snapshot.recent.readings.map(r => <li key={r.metric}><strong>{ANALYSIS_FIELDS[r.metric].label}</strong>{r.value === null ? "Unavailable" : r.value.toFixed(2)} {r.unit} · {r.gp} GP<p>{r.reason || "Measured value"}</p><small>{r.rankReason}</small></li>)}</ul><h2>{p.blsh.heading}</h2>{p.blsh.lines.map((t, i) => <p key={i}>{t}</p>)}<p>{p.blsh.market}</p><h2>Trade context</h2>{p.trades.lines.map((t, i) => <p key={i}>{t}</p>)}</> : <><p>{p.goalie.reason}</p>{p.goalie.games.map(g => <article key={g.id}><h2>{g.heading}</h2><p>{g.confirmation}</p><p>{g.forecast}</p>{g.dimensions.map(d => <p key={d.label}><strong>{d.group} · {d.label}:</strong> {d.text}</p>)}</article>)}</>}
    </div></>}
    <p role="status" aria-live="polite">{status}</p>
  </section>;
}
