import { get } from "lib/NHL/base";
import { instant, type LineGame } from "./types";

export const LIVE_STATE_MAX_AGE_MS = 5 * 60_000;

export function trustworthyState(game: LineGame, now: string): boolean {
  const observed = instant(game.observedAt), current = instant(now);
  if (observed == null || current == null || observed > current || !game.stateSource) return false;
  // A completed game is terminal. Live/pregame/future status must be freshly observed.
  return game.phase === "final" || current - observed <= LIVE_STATE_MAX_AGE_MS;
}

export function stateAtRead(game: LineGame, now: string): LineGame {
  return trustworthyState(game, now) ? game : { ...game, phase: "unknown" };
}

export function chooseDefaultGame(games: LineGame[], now: string): LineGame | null {
  const active = games.map((game) => stateAtRead(game, now));
  const live = active.filter((game) => game.phase === "live").sort((a, b) => a.id - b.id);
  if (live.length) return live[0]!;
  const next = active.filter((game) => ["scheduled", "pregame"].includes(game.phase) || game.phase === "unknown" && (instant(game.scheduledStart) ?? 0) > (instant(now) ?? Infinity))
    .sort((a, b) => (instant(a.scheduledStart) ?? Infinity) - (instant(b.scheduledStart) ?? Infinity) || a.id - b.id);
  return next[0] ?? null;
}

/** No clock-derived phase: upstream phase is independent of scheduled start. */
export function adaptNhlGameState(base: LineGame, payload: any, observedAt: string): LineGame {
  if (payload?.id !== base.id || payload?.homeTeam?.id !== base.homeTeamId || payload?.awayTeam?.id !== base.awayTeamId) return { ...base, phase: "unknown" };
  const scheduleState = payload.gameScheduleState;
  const phase = scheduleState === "PPD" || scheduleState === "SUSP" ? "postponed"
    : ({ FUT: "scheduled", PRE: "pregame", LIVE: "live", CRIT: "live", FINAL: "final", OFF: "final" } as const)[payload.gameState as string as "FUT"] ?? "unknown";
  const scheduledStart = instant(payload.startTimeUTC) == null ? base.scheduledStart : payload.startTimeUTC;
  // NHL scheduled start is never relabeled as actual puck drop.
  const actualStart = instant(payload.actualStartTimeUTC) == null ? null : payload.actualStartTimeUTC;
  return { ...base, scheduledStart, phase, actualStart, observedAt, stateSource: `https://api-web.nhle.com/v1/gamecenter/${base.id}/landing`,
    scheduleIdentity: `${base.id}:${scheduledStart ?? base.date}:${scheduleState ?? "unknown"}` };
}

export async function observeLineGame(base: LineGame, now: string): Promise<LineGame> {
  try { return adaptNhlGameState(base, await get(`/gamecenter/${base.id}/landing`, false, AbortSignal.timeout(6000)), now); }
  catch { return stateAtRead(base, now); }
}
