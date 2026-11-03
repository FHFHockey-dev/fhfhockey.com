import React, { useEffect, useRef, useState } from "react";
import CurrentPlayerCard, { currentCardKey } from "./CurrentPlayerCard";
import { CURRENT_NHL_DEFINITIONS, CURRENT_NHL_FORMATS, parseCurrentNhlRequest, type CurrentNhlCard, type CurrentNhlFormat, type CurrentNhlRequest } from "../../lib/player-cards/currentNhl";
import { rasterizeCurrentNhlCard } from "../../lib/player-cards/currentNhlExport";
import { saveCardFile } from "../../lib/player-cards/shareExport";
import ResearchCardEvidence from "./ResearchCardEvidence";
import styles from "./PlayerCardShareStudio.module.scss";

async function loadCurrentCard(request: CurrentNhlRequest, signal: AbortSignal): Promise<CurrentNhlCard> {
  const response = await fetch(`/api/v1/player-cards?${new URLSearchParams(Object.fromEntries(Object.entries(request).map(([key, value]) => [key, String(value)])))}`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("NHL inputs are unavailable. No substitute values or ranks were loaded.");
  return response.json();
}
export default function CurrentPlayerCardStudio({ initialCard = null, load = loadCurrentCard, rasterize = rasterizeCurrentNhlCard }: { initialCard?: CurrentNhlCard | null; load?: typeof loadCurrentCard; rasterize?: typeof rasterizeCurrentNhlCard }) {
  const year = new Date().getUTCFullYear() - (new Date().getUTCMonth() < 8 ? 1 : 0);
  const [playerId, setPlayerId] = useState(String(initialCard?.request.playerId || 8476453)), [season, setSeason] = useState(String(initialCard?.request.season || year * 10000 + year + 1)), [count, setCount] = useState(String(initialCard?.request.count || 10));
  const [format, setFormat] = useState<CurrentNhlFormat>("rates-opportunity"), [card, setCard] = useState(initialCard), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [status, setStatus] = useState("");
  const [prepared, setPrepared] = useState<{ key: string; file: File } | null>(null);
  const requestRef = useRef<AbortController | null>(null), svgRef = useRef<SVGSVGElement>(null), busyRef = useRef(false);
  useEffect(() => () => requestRef.current?.abort(), []);
  function changed() { requestRef.current?.abort(); setCard(null); setLoading(false); setPrepared(null); setStatus(""); }
  async function loadCard() {
    requestRef.current?.abort(); const controller = new AbortController(); requestRef.current = controller; setPrepared(null); setCard(null); setStatus(""); setLoading(true);
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
    try {
      const request = parseCurrentNhlRequest({ playerId, season, count });
      const result = await load(request, controller.signal);
      if (controller.signal.aborted) return;
      if (result.request.playerId !== request.playerId || result.request.season !== request.season || result.request.count !== request.count) throw new Error("Player or window changed in the returned snapshot.");
      setCard(result);
    } catch (error) { if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : "Unable to load this card."); }
    finally { clearTimeout(timeout); if (requestRef.current === controller) { setLoading(false); if (timedOut) setStatus("NHL request timed out. No substitute values were loaded."); } }
  }
  async function createImage(share: boolean) {
    if (!card || card.state !== "ready" || !svgRef.current || busyRef.current) return;
    busyRef.current = true; setBusy(true); setStatus("Preparing the displayed snapshot…");
    try {
      const blob = await rasterize(svgRef.current, card, format), file = new File([blob], `fhfh-${card.player.id}-${format}-${card.source}.png`, { type: "image/png" });
      if (share) { setPrepared({ key: currentCardKey(card, format), file }); setStatus("Image ready. Share prepared image opens your device’s share options."); }
      else { saveCardFile(file, file.name); setStatus("PNG saved from the displayed snapshot."); }
    } catch (error) { setStatus(error instanceof Error ? error.message : "PNG creation failed."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function sharePrepared() {
    if (!card || !prepared || prepared.key !== currentCardKey(card, format) || busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      if (navigator.share && navigator.canShare?.({ files: [prepared.file] })) { await navigator.share({ files: [prepared.file], title: `FHFH · ${card.player.name} · NHL results` }); setStatus("Image handed to your device’s share destination."); }
      else { saveCardFile(prepared.file, prepared.file.name); setStatus("File sharing is unavailable here. PNG downloaded for manual posting."); }
    } catch (error) { setStatus(error instanceof Error && error.name === "AbortError" ? "Sharing cancelled. Nothing was posted." : "Sharing failed. Use Download PNG."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <main className={styles.studio}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>FHFH / SHARE STUDIO</p><h1>Player cards · NHL results</h1><p>Load a current skater snapshot. Basic NHL counts and rates are separate from NST chance and on-ice definitions. No data loads until you choose Load NHL results.</p></div></header>
    <div className={styles.controls}>
      <label>Player NHL ID<input aria-label="Player NHL ID" inputMode="numeric" value={playerId} disabled={busy} onChange={event => { changed(); setPlayerId(event.target.value); }} /></label>
      <label>Season<input aria-label="Season" inputMode="numeric" value={season} disabled={busy} onChange={event => { changed(); setSeason(event.target.value); }} /></label>
      <label>Own last appearances<select value={count} disabled={busy} onChange={event => { changed(); setCount(event.target.value); }}>{[5, 10, 20].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Card category<select value={format} disabled={busy} onChange={event => { setFormat(event.target.value as CurrentNhlFormat); setPrepared(null); setStatus(""); }}>{CURRENT_NHL_FORMATS.map(id => <option key={id} value={id}>{id === "rates-opportunity" ? "Rates & Opportunity" : "Results & Milestones"}</option>)}</select></label>
      <button disabled={busy || loading} onClick={loadCard}>{loading ? "Loading…" : "Load NHL results"}</button>
      <button disabled={busy || card?.state !== "ready"} onClick={() => createImage(false)}>Download PNG</button><button disabled={busy || card?.state !== "ready"} onClick={() => createImage(true)}>Prepare social image</button>
      {prepared && <button disabled={busy || !card || prepared.key !== currentCardKey(card, format)} onClick={sharePrepared}>Share prepared image</button>}
    </div>
    <p role="status" aria-live="polite">{status || (loading ? "Checking identity, game log and final-game schedule…" : card ? card.source === "contract-fixture" ? "Synthetic contract fixture. Not a real player’s results." : card.source === "nhl-retained" ? "Retained official NHL capture, not a current live response." : "NHL snapshot loaded at the observation time shown on the card." : "Choose a player and load a snapshot.")}</p>
    {card && <><div className={styles.artwork}><CurrentPlayerCard card={card} format={format} svgRef={svgRef} /></div><div role="note"><p>{card.rankReason}</p>{card.issues.map(issue => <p key={issue}>{issue}</p>)}</div>
      <details><summary>Source and metric definitions</summary><p>{card.historyStatement} {card.finalityStatement}</p><p>All Strengths only. Calendar-date windows and strength splits are unavailable in this source adapter.</p>{Object.entries(CURRENT_NHL_DEFINITIONS).map(([id, definition]) => <p key={id}>{definition.label}: {definition.definition}</p>)}<button onClick={() => saveCardFile(new Blob([JSON.stringify({ card, format, definitions: CURRENT_NHL_DEFINITIONS }, null, 2)], { type: "application/json" }), `fhfh-${card.player.id}-${format}-manifest.json`)}>Download snapshot manifest</button></details></>}
    {card && <details><summary>Research evidence (optional)</summary><ResearchCardEvidence card={{ player: card.player, eventThroughDate: [...card.sample.sourceDates].sort().at(-1) || null, playerResearchSnapshot: card.playerResearchSnapshot }} /></details>}
    <p>Other stat suites remain in the work plan. Sustainability scores, isolated impact, on-ice chance metrics, goalie workload and milestone baselines are not inferred from these counts.</p>
  </main>;
}
