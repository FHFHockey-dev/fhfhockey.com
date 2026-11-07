import { buildCurrentNhlCard, parseCurrentNhlRequest, type CurrentNhlRequest } from "./currentNhl";

export const CURRENT_NHL_LIMITS = { requests: 3, requestMs: 5000, totalMs: 15000, bytesPerResponse: 512 * 1024, retries: 0, redirects: 0 } as const;
const origin = "https://api-web.nhle.com/v1";
/** Fixed public NHL host and paths only. No database, refresh, provider fallback or credentials. */
export async function readCurrentNhlJson(path: string, signal: AbortSignal): Promise<unknown> {
  if (!/^\/(?:player\/[1-9]\d{6}\/(?:landing|game-log\/\d{8}\/2)|club-schedule-season\/[A-Z]{2,3}\/\d{8})$/.test(path)) throw new Error("Unsupported card source path.");
  const response = await fetch(origin + path, { signal, redirect: "error", credentials: "omit", cache: "no-store", headers: { Accept: "application/json", "User-Agent": "fhfhockey-player-cards/1.0" } });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json") || !response.body) throw new Error("NHL card source unavailable.");
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > CURRENT_NHL_LIMITS.bytesPerResponse) throw new Error("NHL card response exceeded its byte limit."); chunks.push(part.value); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally { await reader.cancel(); reader.releaseLock(); }
}

export async function loadCurrentNhlCard(request: CurrentNhlRequest, read = readCurrentNhlJson, now = () => new Date()) {
  parseCurrentNhlRequest(request);
  const overall = AbortSignal.timeout(CURRENT_NHL_LIMITS.totalMs);
  const bounded = (path: string) => read(path, AbortSignal.any([overall, AbortSignal.timeout(CURRENT_NHL_LIMITS.requestMs)]));
  const identity = await bounded(`/player/${request.playerId}/landing`);
  const team = identity && typeof identity === "object" && "currentTeamAbbrev" in identity ? identity.currentTeamAbbrev : null;
  if (!identity || typeof identity !== "object" || !("playerId" in identity) || identity.playerId !== request.playerId || typeof team !== "string" || !/^[A-Z]{2,3}$/.test(team)) throw new Error("NHL team identity unavailable.");
  const history = await bounded(`/player/${request.playerId}/game-log/${request.season}/2`);
  const schedule = await bounded(`/club-schedule-season/${team}/${request.season}`);
  return buildCurrentNhlCard(request, { identity, history, schedule, observedAt: now().toISOString() });
}
