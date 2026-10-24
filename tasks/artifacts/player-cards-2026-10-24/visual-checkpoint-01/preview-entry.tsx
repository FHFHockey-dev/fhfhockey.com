import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import EditorialPlayerCard, { EDITORIAL_METRICS, EDITORIAL_SIZE } from '../../../../web/components/player-cards/EditorialPlayerCard';
import { adaptLocalSnapshot } from '../../../../web/lib/player-cards/adapter';
import { buildInteractionFixture } from '../../../../web/lib/player-cards/interactionFixtures';
import { INITIAL_FLOW, flowSettings, displaySnapshot } from '../../../../web/lib/player-cards/interactionSnapshot';
import { METRICS } from '../../../../web/lib/player-cards/registry';
import { formatMetric } from '../../../../web/components/player-cards/PlayerCard';

const result = adaptLocalSnapshot(buildInteractionFixture(flowSettings(INITIAL_FLOW), 'complete', 1001), 1001);
if (result.state === 'rejected') throw new Error(result.reason);
const snapshot = displaySnapshot(result);
const manifest = { renderer: 'fhfh-editorial-checkpoint-01', dimensions: EDITORIAL_SIZE, selectedMetrics: EDITORIAL_METRICS, snapshot, coverage: result.coverage, liveActivation: false, premiumActivation: false };

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Artifact-only dimension adapter: the frozen accepted exporter is square.
// Rasterize this exact displayed SVG, without fetching or recalculating data.
async function landscapePng(svg: SVGSVGElement) {
  if (svg.dataset.snapshotId !== snapshot.id || snapshot.source !== 'synthetic') throw new Error('Displayed snapshot does not match the export.');
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute('width', String(EDITORIAL_SIZE.width)); copy.setAttribute('height', String(EDITORIAL_SIZE.height));
  copy.removeAttribute('class'); copy.removeAttribute('style');
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('PNG creation timed out. Please retry.')), 10000);
      const image = new Image();
      image.onerror = () => { clearTimeout(timer); reject(new Error('The card could not be rendered. Please retry.')); };
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas'); canvas.width = EDITORIAL_SIZE.width; canvas.height = EDITORIAL_SIZE.height;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('PNG export is unavailable in this browser.');
          context.drawImage(image, 0, 0);
          canvas.toBlob(blob => { clearTimeout(timer); if (blob) resolve(blob); else reject(new Error('PNG creation failed. Please retry.')); }, 'image/png');
        } catch (error) { clearTimeout(timer); reject(error); }
      };
      image.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}

function Checkpoint() {
  const svgRef = useRef<SVGSVGElement>(null), busyRef = useRef(false);
  const [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  async function exportPng() {
    if (busyRef.current || !svgRef.current) return;
    busyRef.current = true; setBusy(true); setStatus('Creating the displayed synthetic card…');
    try {
      download(await landscapePng(svgRef.current), 'fhfh-editorial-checkpoint-01.png');
      setStatus('Synthetic PNG downloaded from the displayed snapshot.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Export failed. Please retry.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <main>
    <header className="checkpoint-header"><div><p className="eyebrow">FHFH · VISUAL CHECKPOINT 01</p><h1>One player. One clear profile.</h1><p className="intro">A representative card for layout and hierarchy feedback. Player, team, games and cohort are fabricated.</p></div>
      <nav aria-label="Checkpoint actions"><button disabled={busy} onClick={exportPng}>{busy ? 'Creating PNG…' : 'Download synthetic PNG'}</button><button disabled={busy} onClick={() => download(new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }), 'fhfh-editorial-checkpoint-01-manifest.json')}>Download snapshot manifest</button><a href="/player-cards/functional">Open functional fixture tool</a></nav>
    </header>
    <section aria-label="Representative synthetic landscape card" className="artwork"><EditorialPlayerCard snapshot={snapshot} svgRef={svgRef} /></section>
    <p role="status" aria-live="polite" className="status">{status}</p>
    <p className="caption">Proposed 1200 × 900 landscape export. Controls are outside the artwork. Live data and premium activation remain off.</p>
    <details><summary>Read the card as text</summary><p>Actual values, raw ranks and percentiles come from the same synthetic snapshot. Bars show numeric magnitude, not quality or a forecast.</p><table><caption>Fabricated18-player comparison cohort; no GP, TOI or position filter.</caption><thead><tr><th scope="col">Metric</th><th scope="col">Actual value</th><th scope="col">Rank / valid N</th><th scope="col">Percentile</th></tr></thead><tbody>{EDITORIAL_METRICS.map(id => {
      const reading = snapshot.readings.find(row => row.id === id)!;
      return <tr key={id}><th scope="row">{METRICS.find(metric => metric.id === id)!.help}</th><td>{formatMetric(id, reading.value)}</td><td>{reading.rank ? `${reading.rank.tied ? 'T-' : ''}${reading.rank.ordinal} / ${reading.rank.population}` : reading.reason || reading.rankReason}</td><td>{reading.rank ? reading.rank.percentile.toFixed(1) : 'Unavailable'}</td></tr>;
    })}</tbody></table></details>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Checkpoint />);
