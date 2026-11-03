import React, { useRef, useState } from "react";
import { PLAYER_CARD_CAPABILITIES, type PlayerCardSnapshot } from "../../lib/player-cards/contracts";
import { fixtureSnapshot, type FixtureKind } from "../../lib/player-cards/fixtures";
import { CATEGORIES, CURATED_METRICS, EXTRA_METRICS, METRICS } from "../../lib/player-cards/registry";
import PlayerCard, { formatMetric } from "./PlayerCard";
import styles from "./PlayerCard.module.scss";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Rasterizes the displayed SVG itself. No fetch, reranking or source refresh. */
export async function cardPng(svg: SVGSVGElement, snapshot: PlayerCardSnapshot): Promise<Blob> {
  if (snapshot.source !== "synthetic" || svg.dataset.snapshotId !== snapshot.id) throw new Error("The displayed snapshot changed. Retry with the current card.");
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("width", "1080"); copy.setAttribute("height", "1080");
  copy.removeAttribute("class");
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml;charset=utf-8" }));
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("PNG creation timed out. Retry with this card.")), 10000);
      const image = new Image();
      image.onerror = () => { clearTimeout(timer); reject(new Error("The card could not be rendered. Please retry.")); };
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1080;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("PNG export is unavailable in this browser.");
          context.drawImage(image, 0, 0, 1080, 1080);
          canvas.toBlob(blob => { clearTimeout(timer); if (blob) resolve(blob); else reject(new Error("PNG creation failed. Please retry.")); }, "image/png");
        } catch (error) { clearTimeout(timer); reject(error); }
      };
      image.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}

export default function PlayerCardPreview() {
  const [kind, setKind] = useState<FixtureKind>("curated");
  const [query, setQuery] = useState("");
  const [extra, setExtra] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const snapshot = fixtureSnapshot(kind);
  const matching = "alex morgan".includes(query.trim().toLowerCase());
  const selected = extra ? EXTRA_METRICS : CURATED_METRICS;
  async function exportPng() {
    if (busy || !svgRef.current) return;
    setBusy(true); setStatus("Creating your synthetic example PNG…");
    try {
      const blob = await cardPng(svgRef.current, snapshot);
      download(blob, `fhfh-${snapshot.id}-${extra ? "extra" : "curated"}.png`);
      setStatus("Synthetic example PNG downloaded.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "PNG export failed. Please retry."); }
    finally { setBusy(false); }
  }
  return <main className={styles.page}>
    <p className={styles.eyebrow}>FHFH · Design preview / synthetic data</p>
    <h1 className={styles.heading}>The player. The numbers. The context.</h1>
    <p className={styles.intro}>A shareable view of recent play, with actual values, raw rank and percentile together. This working example uses fabricated players and numbers. Live data and premium features are inactive.</p>
    <div className={styles.studio}>
      <section className={styles.controls} aria-label="Synthetic card controls">
        <label htmlFor="player-card-search">Search example players</label>
        <input id="player-card-search" value={query} disabled={busy} onChange={event => setQuery(event.target.value)} placeholder="Try Alex Morgan" autoComplete="off" />
        {query && <ul className={styles.results}>{matching ? <li><button disabled={busy} onClick={() => { setKind("curated"); setQuery(""); setStatus(""); }}>Alex Morgan · Example Hockey Club · RW</button></li> : <li role="status">No example players found.</li>}</ul>}
        <label htmlFor="player-card-example">Example scenario</label>
        <select id="player-card-example" value={kind} disabled={busy} onChange={event => { setKind(event.target.value as FixtureKind); setStatus(""); }}>
          <option value="curated">Curated card</option><option value="long-name">Long player name</option><option value="partial">Known short season sample</option><option value="missing">Missing source / incomplete pool</option>
        </select>
        <label htmlFor="player-card-content">Card content · proposed</label>
        <select id="player-card-content" value={extra ? "extra" : "curated"} disabled={busy} onChange={event => { setExtra(event.target.value === "extra"); setStatus(""); }}><option value="curated">Curated metrics</option><option value="extra">More metrics · extra card</option></select>
        <p className={styles.sectionLabel}>Period and definition</p>
        <p className={styles.notice}>Own L10 appearances · All Strengths<br />Regular season · common UTC cutoff<br />Proposed defaults, fixed for this example.</p>
        <button className={styles.download} disabled={busy} onClick={exportPng}>{busy ? "Creating PNG…" : "Download example PNG"}</button>
        <button disabled={busy} onClick={() => download(new Blob([JSON.stringify({ snapshot, selectedMetrics: selected, capabilities: PLAYER_CARD_CAPABILITIES }, null, 2)], { type: "application/json" }), `${snapshot.id}-manifest.json`)}>Download example manifest</button>
        <p className={styles.notice}>Basic search, cards and PNG downloads will be free. Premium metric allocation and comparison are awaiting review.</p>
        <p className={styles.status} role="status" aria-live="polite">{status}</p>
      </section>
      <section className={styles.preview} aria-label="Player card preview">
        <PlayerCard snapshot={snapshot} selected={selected} svgRef={svgRef} />
        <p className={styles.caption}>Proposed 1080 × 1080 export. The PNG contains only the card above and preserves its synthetic label. Example ranks use a fabricated metric-specific cohort, never live NHL records.</p>
        <details className={styles.help}><summary>Read card values at text size</summary>
          {CATEGORIES.map(category => <section key={category}><h2 className={styles.readingTitle}>{category}</h2>
            <dl className={styles.readings}>{METRICS.filter(metric => metric.category === category && selected.includes(metric.id)).map(metric => {
              const reading = snapshot.readings.find(value => value.id === metric.id)!;
              return <div key={metric.id}><dt>{metric.label} <span>{metric.unit}</span></dt><dd><strong>{formatMetric(metric.id, reading.value)}</strong><br />{reading.rank ? `${reading.rank.tied ? "T-" : ""}${reading.rank.ordinal} of ${reading.rank.population} · ${reading.rank.percentile.toFixed(1)} percentile` : reading.reason || reading.rankReason}</dd></div>;
            })}</dl>
          </section>)}
        </details>
        <details className={styles.help}><summary>How to read ranks and percentiles</summary><p>Rank is the position among all valid values for the same metric and period. No minimum games, ice time or position filter. Proposed ties use 1, 2, 2, 4. Percentile is 100 × (values below + half of equal values) / valid values. A one-player pool has percentile 50. Numeric magnitude is not a quality grade or a forecast.</p><p>Individual generation, playing opportunity, on-ice context and finishing describe different things. Involvement and shooting conversion need context; higher does not imply sustainable improvement. Each player’s own L10 can span different dates. A calendar-range option and L5/L20 require the next verified window-contract slice.</p></details>
      </section>
    </div>
  </main>;
}
