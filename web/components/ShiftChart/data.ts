import Fetch from "lib/cors-fetch";
import {
  normalizeGame,
  normalizeSchedule,
  type Game,
  type ScheduleGame,
} from "./model";

async function json(url: string): Promise<unknown> {
  const response = await Fetch(url);
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === "object" && "message" in body
        ? String(body.message)
        : `HTTP ${response.status}`;
    throw new Error(`Unable to load NHL data: ${message}`);
  }
  return response.json();
}

// Only share requests while in flight: retries always obtain fresh data, with no stale global cache.
const pendingGames = new Map<number, Promise<Game>>();
export function loadGame(id: number): Promise<Game> {
  const pending = pendingGames.get(id);
  if (pending) return pending;
  const request = Promise.all([
    json(`https://api-web.nhle.com/v1/gamecenter/${id}/boxscore`),
    json(
      `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${id}`,
    ),
    json(`https://api-web.nhle.com/v1/gamecenter/${id}/play-by-play`),
  ])
    .then(([box, shifts, plays]) => normalizeGame(box, shifts, plays))
    .finally(() => pendingGames.delete(id));
  pendingGames.set(id, request);
  return request;
}
const pendingSchedules = new Map<string, Promise<ScheduleGame[]>>();
export function loadSchedule(date: string): Promise<ScheduleGame[]> {
  const pending = pendingSchedules.get(date);
  if (pending) return pending;
  const request = json(`https://api-web.nhle.com/v1/schedule/${date}`)
    .then(normalizeSchedule)
    .finally(() => pendingSchedules.delete(date));
  pendingSchedules.set(date, request);
  return request;
}
export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export async function latestCompletedGame(
  today = new Date(),
): Promise<ScheduleGame | null> {
  const todayString = localDate(today);
  // Each schedule response contains a week. Two requests cover the existing 14-day search bound.
  for (const daysBack of [6, 13]) {
    const start = new Date(today);
    start.setDate(start.getDate() - daysBack);
    const games = await loadSchedule(localDate(start));
    const latest = games
      .filter(
        (g) =>
          g.date >= localDate(start) &&
          g.date <= todayString &&
          ["OFF", "FINAL"].includes(g.state),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)[0];
    if (latest) return latest;
  }
  return null;
}
