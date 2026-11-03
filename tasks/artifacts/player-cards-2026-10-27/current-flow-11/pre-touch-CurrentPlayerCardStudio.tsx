import React, { useCallback, useEffect, useRef, useState } from "react";
import CurrentPlayerCard, { currentCardKey } from "./CurrentPlayerCard";
import { CURRENT_NHL_DEFINITIONS, CURRENT_NHL_FORMATS, type CurrentNhlCard, type CurrentNhlFormat, type CurrentNhlRequest } from "../../lib/player-cards/currentNhl";
import { currentNhlManifest, rasterizeCurrentNhlCard } from "../../lib/player-cards/currentNhlExport";
import { saveCardFile } from "../../lib/player-cards/shareExport";
import { assertCurrentResponse, capturedWindow, currentSelectionUrl, readCurrentSelection, selectionFromCard, selectionRequest, type CurrentSelection } from "../../lib/player-cards/currentSelection";
import styles from "./PlayerCardShareStudio.module.scss";

async function loadCurrentCard(request: CurrentNhlRequest, signal: AbortSignal): Promise<CurrentNhlCard> {
  const response = await fetch(`/api/v1/player-cards?${new URLSearchParams(Object.fromEntries(Object.entries(request).map(([key, value]) => [key, String(value)])))}`, { signal, credentials: "omit", redirect: "error", cache: "no-store" });
  if (!response.ok) throw new Error("NHL inputs are unavailable. No substitute values or ranks were loaded.");
  const text = await response.text();
  if (text.length > 128 * 1024) throw new Error("NHL card response exceeded its bound.");
  return JSON.parse(text);
}
export default function CurrentPlayerCardStudio({ initialCard = null, load = loadCurrentCard, rasterize = rasterizeCurrentNhlCard }: { initialCard?: CurrentNhlCard | null; load?: typeof loadCurrentCard; rasterize?: typeof rasterizeCurrentNhlCard }) {
  const initial = useRef(selectionFromCard(initialCard)).current;
  const [playerId, setPlayerId] = useState(initial.playerId), [season, setSeason] = useState(initial.season), [count, setCount] = useState(initial.count);
  const [format, setFormat] = useState<CurrentNhlFormat>(initial.cardFormat), [card, setCard] = useState(initialCard), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [status, setStatus] = useState("");
  const [prepared, setPrepared] = useState<{ key: string; file: File } | null>(null);
  const requestRef = useRef<AbortController | null>(null), svgRef = useRef<SVGSVGElement>(null), busyRef = useRef(false), exportGeneration = useRef(0);
  const changed = useCallback(() => { requestRef.current?.abort(); requestRef.current = null; exportGeneration.current++; setCard(null); setLoading(false); setPrepared(null); setStatus(""); }, []);
  useEffect(() => {
    const counter = exportGeneration;
    const restore = () => {
      const selection = readCurrentSelection(window.location.search, initial); changed();
      setPlayerId(selection.playerId); setSeason(selection.season); setCount(selection.count); setFormat(selection.cardFormat);
      setStatus("Selection restored from the URL. Choose Load NHL results to fetch a new snapshot.");
    };
    if (["playerId", "season", "count", "cardFormat"].some(key => new URLSearchParams(window.location.search).has(key))) restore();
    window.addEventListener("popstate", restore);
    return () => { window.removeEventListener("popstate", restore); requestRef.current?.abort(); requestRef.current = null; counter.current++; };
  }, [initial, changed]);
  function remember(selection: CurrentSelection) {
    try { const url = currentSelectionUrl(window.location.href, selection); if (url !== window.location.pathname + window.location.search + window.location.hash) window.history.pushState(null, "", url); } catch { /* Invalid drafts stay editable; they never trigger a fetch. */ }
  }
  function chooseWindow(value: string) {
    const selected = capturedWindow(card, Number(value)); changed(); setCount(value);
    if (selected) { setCard(selected); setStatus("Showing another window from the same verified capture. No source refresh was requested."); }
    remember({ playerId, season, count: value, cardFormat: format });
  }
  async function loadCard() {
    if (busyRef.current || loading) return;
    changed(); const controller = new AbortController(); requestRef.current = controller; setPrepared(null); setCard(null); setStatus(""); setLoading(true);
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
    try {
      const request = selectionRequest({ playerId, season, count, cardFormat: format });
      setPlayerId(String(request.playerId)); remember({ playerId: String(request.playerId), season, count, cardFormat: format });
      const result = await load(request, controller.signal);
      if (controller.signal.aborted) return;
      assertCurrentResponse(result, request);
      setCard(result);
    } catch (error) { if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : "Unable to load this card."); }
    finally { clearTimeout(timeout); if (requestRef.current === controller) { setLoading(false); if (timedOut) setStatus("NHL request timed out. No substitute values were loaded."); } }
  }
  async function createImage(share: boolean) {
    if (!card || card.state !== "ready" || !svgRef.current || busyRef.current) return;
    const generation = exportGeneration.current; busyRef.current = true; setBusy(true); setStatus("Preparing the displayed snapshot…");
    try {
      const blob = await rasterize(svgRef.current, card, format), file = new File([blob], `fhfh-${card.player.id}-${card.request.season}-L${card.request.count}-${format}-${card.source}.png`, { type: "image/png" });
      if (generation !== exportGeneration.current) return;
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
    <header className={styles.heading}><div><p className={styles.eyebrow}>FHFH / SHARE STUDIO</p><h1>Player cards · NHL results</h1><p>Load a current skater snapshot. Basic NHL counts and rates are separate from NST chance and on-ice definitions. One explicit load captures all three appearance windows. Window and category changes reuse that capture; Load NHL results refreshes it.</p></div></header>
    <form className={styles.controls} onSubmit={event => { event.preventDefault(); void loadCard(); }}>
      <label>Player NHL ID<input aria-label="Player NHL ID" inputMode="text" placeholder="NHL ID or /stats/player/ID" value={playerId} disabled={busy} onChange={event => { changed(); setPlayerId(event.target.value); }} /></label>
      <label>Season<input aria-label="Season" inputMode="numeric" value={season} disabled={busy} onChange={event => { changed(); setSeason(event.target.value); }} /></label>
      <label>Own last appearances<select value={count} disabled={busy} onChange={event => { chooseWindow(event.target.value); }}>{[5, 10, 20].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Card category<select value={format} disabled={busy} onChange={event => { const next = event.target.value as CurrentNhlFormat; exportGeneration.current++; setFormat(next); setPrepared(null); setStatus(""); remember({ playerId, season, count, cardFormat: next }); }}>{CURRENT_NHL_FORMATS.map(id => <option key={id} value={id}>{id === "rates-opportunity" ? "Rates & Opportunity" : "Results & Milestones"}</option>)}</select></label>
      <button type="submit" disabled={busy || loading}>{loading ? "Loading…" : "Load NHL results"}</button>
      <button type="button" disabled={busy || card?.state !== "ready"} onClick={() => createImage(false)}>Download PNG</button><button type="button" disabled={busy || card?.state !== "ready"} onClick={() => createImage(true)}>Prepare social image</button>
      {prepared && <button type="button" disabled={busy || !card || prepared.key !== currentCardKey(card, format)} onClick={sharePrepared}>Share prepared image</button>}
    </form>
    <p>Paste a stable NHL ID or an existing FHFH /stats/player/ID URL. All Strengths, regular-season skater data only; name search and richer suites require their qualified source interfaces.</p>
    <p role="status" aria-live="polite">{status || (loading ? "Checking identity, game log and final-game schedule…" : card ? card.source === "contract-fixture" ? "Synthetic contract fixture. Not a real player’s results." : card.source === "nhl-retained" ? "Retained official NHL capture, not a current live response." : "NHL snapshot loaded at the observation time shown on the card." : "Choose a player and load a snapshot.")}</p>
    {card && <><div className={styles.artwork}><CurrentPlayerCard card={card} format={format} svgRef={svgRef} /></div><div role="note"><p>{card.rankReason}</p>{card.issues.map(issue => <p key={issue}>{issue}</p>)}</div>
      <details><summary>Source and metric definitions</summary><p>{card.historyStatement} {card.finalityStatement}</p><p>All Strengths only. Calendar-date windows and strength splits are unavailable in this source adapter.</p>{Object.entries(CURRENT_NHL_DEFINITIONS).map(([id, definition]) => <p key={id}>{definition.label}: {definition.definition}</p>)}<button onClick={() => saveCardFile(new Blob([JSON.stringify(currentNhlManifest(card, format), null, 2)], { type: "application/json" }), `fhfh-${card.player.id}-${format}-manifest.json`)}>Download snapshot manifest</button></details></>}
    <p>Other stat suites remain in the work plan. Sustainability scores, isolated impact, on-ice chance metrics, goalie workload and milestone baselines are not inferred from these counts.</p>
  </main>;
}
