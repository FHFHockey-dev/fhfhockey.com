import React, { useEffect, useMemo, useRef, useState } from "react";
import HeroPlayerCard, { type HeroSample, type PreparedHero, type CardShareFormat } from "./HeroPlayerCard";
import { REVIEWED_HERO_SAMPLES } from "../../lib/player-cards/reviewedHeroSamples";
import { prepareHero, rasterizePlayerCard, saveCardFile, shareCardFile } from "../../lib/player-cards/shareExport";
import { adaptLocalSnapshot } from "../../lib/player-cards/adapter";
import { buildInteractionFixture, type FixtureScenario } from "../../lib/player-cards/interactionFixtures";
import { displaySnapshot, flowSettings, INITIAL_FLOW } from "../../lib/player-cards/interactionSnapshot";
import { EDITORIAL_METRICS } from "./EditorialPlayerCard";
import { METRICS } from "../../lib/player-cards/registry";
import { formatMetric } from "./PlayerCard";
import { preparePortrait, portraitKey, isPortraitStyle, PORTRAIT_STYLES, PORTRAIT_LABELS, type PortraitStyle } from "../../lib/player-cards/portraitTreatment";
import styles from "./PlayerCardShareStudio.module.scss";

const STYLE_STORAGE = "fhfh-player-card-portrait-v1";

export default function PlayerCardShareStudio({ samples = REVIEWED_HERO_SAMPLES, loadArtwork = prepareHero, rasterize = rasterizePlayerCard, treatArtwork = preparePortrait }: {
  samples?: readonly HeroSample[]; loadArtwork?: typeof prepareHero; rasterize?: typeof rasterizePlayerCard; treatArtwork?: typeof preparePortrait;
}) {
  const [playerId, setPlayerId] = useState(samples[0]?.id), [format, setFormat] = useState<CardShareFormat>("landscape");
  const [scenario, setScenario] = useState<FixtureScenario>("complete"), [hero, setHero] = useState<PreparedHero | null>(null);
  const [portraitStyle, setPortraitStyle] = useState<PortraitStyle>("team-colors");
  const [styledHero, setStyledHero] = useState<PreparedHero | null>(null), [treating, setTreating] = useState(false);
  const [error, setError] = useState(""), [retry, setRetry] = useState(0), [busy, setBusy] = useState(false), [status, setStatus] = useState("");
  const [prepared, setPrepared] = useState<{ key: string; file: File } | null>(null);
  const busyRef = useRef(false), svgRef = useRef<SVGSVGElement>(null);
  const sample = samples.find(row => row.id === playerId);
  useEffect(() => {
    try { const saved = localStorage.getItem(STYLE_STORAGE); if (isPortraitStyle(saved)) setPortraitStyle(saved); } catch { /* Session selection works without storage. */ }
  }, []);
  useEffect(() => {
    let active = true; setHero(null); setError(""); setPrepared(null);
    if (!sample) { setError("No reviewed artwork is available."); return; }
    loadArtwork(sample).then(value => { if (active) setHero(value); }, reason => { if (active) setError(reason instanceof Error ? reason.message : "Artwork unavailable."); });
    return () => { active = false; };
  }, [sample, retry, loadArtwork]);
  useEffect(() => {
    const controller = new AbortController(); setStyledHero(null); setPrepared(null);
    if (!hero || hero.id !== sample?.id) { setTreating(false); return; }
    setTreating(true); setError("");
    treatArtwork(hero, portraitStyle, controller.signal).then(value => {
      if (!controller.signal.aborted) { setStyledHero(value); setTreating(false); }
    }, reason => {
      if (!controller.signal.aborted) { setError(reason instanceof Error ? reason.message : "Portrait unavailable."); setTreating(false); }
    });
    return () => controller.abort();
  }, [hero, sample, portraitStyle, treatArtwork]);
  const snapshot = useMemo(() => {
    if (!sample) return null;
    const result = adaptLocalSnapshot(buildInteractionFixture(flowSettings(INITIAL_FLOW), scenario, 1001), 1001);
    if (result.state === "rejected") return null;
    const fixture = displaySnapshot(result);
    return { ...fixture, id: `art-study-${sample.id}-${fixture.id}`, player: { id: String(sample.id), name: sample.name, team: sample.team, position: sample.position } };
  }, [sample, scenario]);
  const readyHero = styledHero?.id === sample?.id && styledHero?.treatment?.style === portraitStyle ? styledHero : null;
  const key = `${snapshot?.id}:${format}:${readyHero ? portraitKey(readyHero) : "pending"}`;
  const exportable = !!snapshot && !!readyHero && snapshot.sample.gp !== null && snapshot.sample.toiSeconds !== null && snapshot.readings.some(r => r.state === "valid");
  function changed() { setPrepared(null); setStatus(""); }
  async function createImage(social: boolean) {
    if (busyRef.current || !exportable || !snapshot || !readyHero || !svgRef.current) return;
    busyRef.current = true; setBusy(true); setStatus("Preparing the displayed image…");
    try {
      const blob = await rasterize(svgRef.current, snapshot, readyHero, format);
      const file = new File([blob], `fhfh-${sample!.id}-illustrative-${format}-${portraitStyle}.png`, { type: "image/png" });
      if (social) { setPrepared({ key, file }); setStatus("Image ready. Choose Share prepared image to open your device’s share options."); }
      else { saveCardFile(file, file.name); setStatus("PNG saved from the displayed snapshot."); }
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Export failed. Please retry."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function sharePrepared() {
    if (busyRef.current || !prepared || prepared.key !== key) return;
    busyRef.current = true; setBusy(true);
    try {
      const outcome = await shareCardFile(prepared.file);
      setStatus(outcome === "cancelled" ? "Sharing cancelled. Nothing was posted." : outcome === "downloaded" ? "This browser cannot share image files. PNG downloaded for manual posting." : "Image handed to your device’s share destination.");
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Sharing failed. Use Download PNG instead."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <main className={styles.studio}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>FHFH / SHARE STUDIO</p><h1>Player cards</h1><p>Reviewed NHL photography with illustrative statistics. The numbers below do not describe the pictured player.</p></div><a href="/social-share/game-grid">Schedule share studio →</a></header>
    <div className={styles.controls}>
      <label>Reviewed artwork<select aria-label="Reviewed artwork" value={playerId} disabled={busy} onChange={e => { changed(); setPlayerId(Number(e.target.value)); }}>{samples.map(row => <option key={row.id} value={row.id}>{row.name} · {row.team}</option>)}</select></label>
      <label>Image format<select aria-label="Image format" value={format} disabled={busy} onChange={e => { changed(); setFormat(e.target.value as CardShareFormat); }}><option value="landscape">Landscape card</option><option value="social-square">Social square</option></select></label>
      <label>Portrait style<select aria-label="Portrait style" value={portraitStyle} disabled={busy || treating} onChange={e => {
        const value = e.target.value; if (!isPortraitStyle(value)) return;
        changed(); setPortraitStyle(value);
        try { localStorage.setItem(STYLE_STORAGE, value); } catch { /* Session selection remains available. */ }
      }}>{PORTRAIT_STYLES.map(style => <option key={style} value={style}>{PORTRAIT_LABELS[style]}</option>)}</select></label>
      <label>Statistics preview<select aria-label="Statistics preview" value={scenario} disabled={busy} onChange={e => { changed(); setScenario(e.target.value as FixtureScenario); }}><option value="complete">Illustrative profile</option><option value="metric-gap">Missing metric input</option><option value="history-gap">Unverified appearance history</option></select></label>
      <button disabled={busy || !exportable} onClick={() => void createImage(false)}>Download PNG</button>
      <button disabled={busy || !exportable} onClick={() => void createImage(true)}>Social Share</button>
      {prepared?.key === key && <button disabled={busy} onClick={() => void sharePrepared()}>Share prepared image</button>}
    </div>
    {error ? <p role="alert">{error} <button onClick={() => setRetry(n => n + 1)}>Retry artwork</button></p> : !readyHero ? <p role="status">{treating ? "Applying portrait style…" : "Preparing reviewed artwork…"}</p> : null}
    {snapshot && readyHero && <section className={styles.artwork} aria-label="Player card preview"><HeroPlayerCard snapshot={snapshot} hero={readyHero} format={format} svgRef={svgRef} /></section>}
    <p role="status" aria-live="polite">{status || (snapshot?.sample.gp === null ? "GP unverified. Export unavailable until sample context is verified." : scenario === "metric-gap" ? "Missing metric inputs remain unavailable on the card and export." : "Live statistics and premium activation remain off.")}</p>
    {snapshot && readyHero && <details><summary>Card values and provenance</summary><p>Photo: NHL action-image URL captured {sample!.capturedAt.slice(0, 10)}. Team and jersey identity reflect that capture. Local background removal; no generated identity. Statistical source: fabricated fixture player1001, separate from the photographed player.</p><p><a href={sample!.sourceUrl} target="_blank" rel="noreferrer">Recorded photo source</a></p><ul>{EDITORIAL_METRICS.map(id => { const row = snapshot.readings.find(v => v.id === id)!; return <li key={id}>{METRICS.find(v => v.id === id)!.help}: {formatMetric(id, row.value)} · {row.rank ? `${row.rank.tied ? "T-" : ""}${row.rank.ordinal}/${row.rank.population} · ${row.rank.percentile.toFixed(1)} percentile` : row.reason || row.rankReason}</li>; })}</ul><button disabled={busy} onClick={() => saveCardFile(new Blob([JSON.stringify({ snapshot, selectedMetrics: EDITORIAL_METRICS, format, artwork: { ...readyHero, dataUrl: undefined }, statistics: { origin: "synthetic", fixturePlayerId: 1001, representsPicturedPlayer: false }, liveActivation: false, premiumActivation: false }, null, 2)], { type: "application/json" }), "fhfh-player-card-manifest.json")}>Download manifest</button></details>}
  </main>;
}
