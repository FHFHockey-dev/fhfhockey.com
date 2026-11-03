import { CURRENT_NHL_FORMATS, parseCurrentNhlRequest, type CurrentNhlCard, type CurrentNhlFormat, type CurrentNhlRequest } from "./currentNhl";
export type CurrentSelection = { playerId: string; season: string; count: string; cardFormat: CurrentNhlFormat };
export function selectionFromCard(card: CurrentNhlCard | null): CurrentSelection {
  const now = new Date(), year = now.getUTCFullYear() - (now.getUTCMonth() < 8 ? 1 : 0);
  return { playerId: card ? String(card.request.playerId) : "", season: String(card?.request.season || year * 10000 + year + 1), count: String(card?.request.count || 10), cardFormat: "rates-opportunity" };
}
export function selectionRequest(selection: CurrentSelection): CurrentNhlRequest {
  let id = selection.playerId.trim();
  if (!/^[1-9]\d{6}$/.test(id)) {
    let url: URL; try { url = new URL(id, "https://fhfhockey.com"); } catch { throw new Error("Enter a valid NHL ID or FHFH player URL."); }
    const match = url.pathname.match(/^\/stats\/player\/([1-9]\d{6})\/?$/);
    if (!["https://fhfhockey.com", "https://www.fhfhockey.com"].includes(url.origin) || !match) throw new Error("Enter a valid NHL ID or FHFH player URL.");
    id = match[1];
  }
  return parseCurrentNhlRequest({ playerId: id, season: selection.season, count: selection.count });
}
export function readCurrentSelection(search: string, fallback: CurrentSelection): CurrentSelection {
  const p = new URLSearchParams(search), format = p.get("cardFormat");
  return { playerId: p.get("playerId") ?? fallback.playerId, season: p.get("season") ?? fallback.season, count: p.get("count") ?? fallback.count, cardFormat: CURRENT_NHL_FORMATS.includes(format as CurrentNhlFormat) ? format as CurrentNhlFormat : fallback.cardFormat };
}
export function currentSelectionUrl(href: string, selection: CurrentSelection): string {
  const request = selectionRequest(selection), url = new URL(href);
  url.searchParams.set("playerId", String(request.playerId)); url.searchParams.set("season", String(request.season)); url.searchParams.set("count", String(request.count)); url.searchParams.set("cardFormat", selection.cardFormat);
  return url.pathname + url.search + url.hash;
}
export function capturedWindow(card: CurrentNhlCard | null, count: number): CurrentNhlCard | null {
  if (!card?.windows || card.windows.length !== 3 || ![5, 10, 20].includes(count)) return null;
  const matches = card.windows.filter(view => view.request.count === count), view = matches[0];
  if (matches.length !== 1 || view.player.id !== card.player.id || view.player.team !== card.player.team || view.request.season !== card.request.season || view.observedAt !== card.observedAt || view.source !== card.source || view.evidence?.version !== card.evidence.version) return null;
  return { ...view, windows: card.windows };
}
/** Validate the small application response before exposing values; source qualification stays server-owned. */
export function assertCurrentResponse(value: unknown, request: CurrentNhlRequest): asserts value is CurrentNhlCard {
  const card = value as CurrentNhlCard;
  if (!card || !["ready", "unavailable"].includes(card.state) || !["nhl-current", "nhl-retained", "contract-fixture"].includes(card.source) || card.player?.id !== request.playerId || !card.player.name || card.request?.playerId !== request.playerId || card.request?.season !== request.season || card.request?.count !== request.count || !Number.isFinite(Date.parse(card.observedAt)) || card.evidence?.version !== "nhl-basic-skater-v1" || !Array.isArray(card.evidence.selectedGames) || !card.values || !card.sample) throw new Error("The returned player, window or source evidence is unverified.");
  if (card.state === "ready" && (!Number.isInteger(card.sample.gp) || card.sample.gp! < 1 || card.sample.gp! > request.count || !Number.isFinite(card.sample.toiSeconds) || card.sample.toiSeconds! <= 0 || card.evidence.selectedGames.length !== card.sample.gp)) throw new Error("The returned sample is unverified.");
  for (const id of ["atoi", "shots60", "goals60", "points60", "goals", "assists", "points", "shots", "shootingPct"] as const) if (card.values[id] !== null && (!Number.isFinite(card.values[id]) || card.values[id]! < 0)) throw new Error("A returned metric is unverified.");
  if (card.previous) {
    const previous = card.previous;
    if (previous.state === "ready") {
      if (card.state !== "ready" || card.sample.gp !== request.count || !Array.isArray(previous.games) || previous.games.length !== request.count || new Set(previous.games.map(game => game.gameId)).size !== request.count || !Number.isFinite(previous.toiSeconds) || previous.toiSeconds <= 0 || !previous.values) throw new Error("The preceding sample is unverified.");
      const firstRecent = Math.min(...card.evidence.selectedGames.map(game => Date.parse(game.utcStart)));
      if (previous.games.some(game => card.sample.gameIds.includes(game.gameId) || !Number.isFinite(Date.parse(game.utcStart)) || Date.parse(game.utcStart) >= firstRecent)) throw new Error("Preceding and recent windows overlap or have unverified chronology.");
      for (const id of Object.keys(card.values) as (keyof CurrentNhlCard["values"])[]) if (previous.values[id] !== null && (!Number.isFinite(previous.values[id]) || previous.values[id]! < 0)) throw new Error("A preceding metric is unverified.");
    } else if (previous.state !== "unavailable" || !previous.reason) throw new Error("The preceding sample is unverified.");
  }
  if (card.windows) {
    if (!Array.isArray(card.windows) || card.windows.length !== 3 || new Set(card.windows.map(view => view?.request?.count)).size !== 3) throw new Error("Captured appearance windows are inconsistent.");
    for (const view of card.windows) {
      if (![5, 10, 20].includes(view.request?.count) || view.observedAt !== card.observedAt || view.source !== card.source || view.player?.team !== card.player.team || "windows" in view) throw new Error("Captured appearance windows are inconsistent.");
      assertCurrentResponse(view, { ...request, count: view.request.count });
    }
  }
}
