import React, { useEffect, useRef, useState } from "react";
import { RESEARCH_EXAMPLES, type ResearchExample } from "../../lib/player-cards/researchExamples";
import { readResearchFixture, researchBinding, withPlayerResearchSnapshot, type ResearchHost } from "../../lib/player-cards/researchSnapshot";
import { rasterizeResearchCard } from "../../lib/player-cards/researchExport";
import { saveCardFile } from "../../lib/player-cards/shareExport";
import ResearchCardEvidence from "./ResearchCardEvidence";
import ResearchPlayerCard from "./ResearchPlayerCard";
import styles from "./PlayerCardShareStudio.module.scss";
async function loadExample(example: ResearchExample, signal: AbortSignal) {
  const query = new URLSearchParams({ fixture: example.file, playerId: String(example.playerId), eventThroughDate: example.eventThroughDate });
  const response = await fetch(`/api/v1/player-cards/research?${query}`, { signal, credentials: "omit", redirect: "error", cache: "no-store" });
  if (!response.ok) throw new Error("Historical research example unavailable. No current data was requested.");
  const text = await response.text(); if (text.length > 256 * 1024) throw new Error("Research response exceeded its bound.");
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || !("fixtureText" in value) || typeof value.fixtureText !== "string" || !("manifestSha256" in value) || typeof value.manifestSha256 !== "string") throw new Error("Research response is incomplete.");
  return { fixtureText: value.fixtureText, manifestSha256: value.manifestSha256 };
}
export default function ResearchPlayerCardStudio({ load = loadExample, rasterize = rasterizeResearchCard }: { load?: typeof loadExample; rasterize?: typeof rasterizeResearchCard }) {
  const [file, setFile] = useState(""), [card, setCard] = useState<ResearchHost | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [status, setStatus] = useState("");
  const request = useRef<AbortController | null>(null), svgRef = useRef<SVGSVGElement>(null), busyRef = useRef(false);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  async function select(next: string) {
    request.current?.abort(); request.current = null; setFile(next); setCard(null); setError(""); setStatus("");
    const example = RESEARCH_EXAMPLES.find(row => row.file === next); if (!example) { setLoading(false); return; }
    const controller = new AbortController(); request.current = controller; setLoading(true); const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const raw = await load(example, controller.signal), snapshot = await readResearchFixture(raw.fixtureText, example, raw.manifestSha256);
      if (!controller.signal.aborted) setCard(withPlayerResearchSnapshot({ player: { id: example.playerId, name: example.name }, eventThroughDate: example.eventThroughDate }, snapshot));
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Research example unavailable."); }
    finally { clearTimeout(timer); if (request.current === controller) { setLoading(false); if (controller.signal.aborted) setError("Historical example timed out or was cancelled. No substitute data loaded."); } }
  }
  async function download() {
    if (!card || !svgRef.current || busyRef.current) return; busyRef.current = true; setBusy(true);
    try { const blob = await rasterize(svgRef.current, card); saveCardFile(blob, `fhfh-${card.player.id}-${card.eventThroughDate}-offline-research.png`); setStatus("Saved the displayed historical research example. No live or activation claim."); }
    catch (reason) { setStatus(reason instanceof Error ? reason.message : "Research PNG failed."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <main className={styles.studio}><header className={styles.heading}><div><p className={styles.eyebrow}>FHFH / SHARE STUDIO</p><h1>Player cards · research examples</h1><p>Saved historical development and synthetic contract examples. These are not current NHL results, live alerts or selected production detectors.</p></div></header>
    <div className={styles.controls}><label>Historical example<select aria-label="Historical example" value={file} disabled={busy} onChange={event => void select(event.target.value)}><option value="">Choose an exact saved example…</option>{RESEARCH_EXAMPLES.map(row => <option key={row.file} value={row.file}>{row.kind === "synthetic_contract" ? "SYNTHETIC · " : "HISTORICAL · "}{row.label}</option>)}</select></label><button disabled={busy || loading || !card} onClick={() => void download()}>Download research PNG</button></div>
    {error && <p role="alert">{error}</p>}<p role="status" aria-live="polite">{loading ? "Checking manifest, fixture hash, player, exact historical date and versions…" : status || (card ? "Manifest-bound research only. Source availability and issuance are unknown." : "No research evidence selected. Existing NHL data and artwork controls remain separate.")}</p>
    {card && <><div className={styles.artwork}><ResearchPlayerCard card={card} svgRef={svgRef} /></div><ResearchCardEvidence card={card} /><button disabled={busy} onClick={() => saveCardFile(new Blob([JSON.stringify({ card, evidence: { ...researchBinding(card), researchOnly: true, trustedForActivation: false }, note: "Historical game-date example; packaging is not issuance" }, null, 2)], { type: "application/json" }), `fhfh-${card.player.id}-${card.eventThroughDate}-research-manifest.json`)}>Download research manifest</button></>}
  </main>;
}
