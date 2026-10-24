import { getSchedule } from "lib/NHL/server";
import { TUESDAY_NOT_CONNECTED, assertCalendarDate, buildBlockedSnapshot, buildScheduleSnapshot, calendarWeekStart, currentSeason, weekDates } from "./schedule";
import { buildOpponentLayer } from "./matchups";
import { loadShareTeamRates } from "./teamRates";
import { loadSharePlayerRecent, loadSharePlayerSources, RECENT_LIMITS } from "./playerSources";
import { attachRecent, buildPlayerLayer, trimPlayerLayer } from "./players";
import { localDate } from "lib/rosterScheduleOptimizer/planningDates";
import { isSocialShareFormat, OPPONENT_RATE_FORMATS, SHARE_TIME_ZONE, UPSTREAM_READ_FORMATS, type SocialShareFormat, type SocialShareSnapshot } from "./types";

export class SocialShareRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function loadScheduleShareSnapshot(format: SocialShareFormat, weekStart?: string, selectedDates?: string[]) {
  if (!isSocialShareFormat(format)) throw new SocialShareRequestError("Unknown social-share format.", 404);
  const requestedAt = new Date().toISOString();
  const start = weekStart ?? calendarWeekStart(requestedAt);
  try {
    const dates = weekDates(assertCalendarDate(start));
    assertSupportedSeason(start, requestedAt);
    if (selectedDates && (new Set(selectedDates).size !== selectedDates.length || selectedDates.some(date => !dates.includes(assertCalendarDate(date))))) throw new Error("Selected dates must be unique dates within the selected week.");
  } catch (error) { throw new SocialShareRequestError(error instanceof Error ? error.message : "Invalid date selection.", 400); }
  // Tuesday trends has no live trend source yet, so it makes no read at all (SS1-6-O1).
  if (format === "tuesday-trends") return buildBlockedSnapshot({ format, weekStart: start, selectedDates, generatedAt: requestedAt, ...TUESDAY_NOT_CONNECTED });
  if (!UPSTREAM_READ_FORMATS.includes(format)) return buildBlockedSnapshot({ format, weekStart: start, selectedDates, generatedAt: requestedAt,
    sourceReason: "No upstream schedule read was made for this unsupported format.", reason: "This format requires ownership or player evidence that is not available in this schedule-only edition." });
  let snapshot: SocialShareSnapshot;
  try {
    const schedule = await getSchedule(start, { includeOdds: false });
    snapshot = buildScheduleSnapshot({ format, weekStart: start, selectedDates, generatedAt: new Date().toISOString(), schedule });
  } catch { throw new SocialShareRequestError("NHL schedule is unavailable. Refresh to retry.", 503); }
  // Opponent rates are read only after the schedule succeeds and only for formats with matchup
  // cards; their failure never blocks the schedule edition. Tuesday trend sources are not connected.
  if (!OPPONENT_RATE_FORMATS.includes(format)) return snapshot;
  const season = currentSeason(start);
  const stats = await loadShareTeamRates(season).catch(() => null);
  snapshot.opponents = buildOpponentLayer(stats, { season, teams: snapshot.teams, fetchedAt: new Date().toISOString(), generatedAt: snapshot.generatedAt });
  // Player reads only follow a ready schedule edition (an unready one ranks nobody), for every team
  // with games (top-10 first, wider pool fills short lists). The layer leaves the server trimmed to the
  // cards' players; only those players get the last-five-games read.
  if (snapshot.state !== "ready" || snapshot.source.state !== "ready") return snapshot;
  const teamsWithGames = snapshot.rows.filter(row => row.remainingGames > 0).map(row => row.team.abbreviation);
  const sources = teamsWithGames.length ? await loadSharePlayerSources(season, teamsWithGames).catch(() => null) : null;
  const layer = buildPlayerLayer(sources, { season, teams: snapshot.teams.map(team => team.abbreviation), fetchedAt: new Date().toISOString(), generatedAt: snapshot.generatedAt });
  const trimmed = trimPlayerLayer(snapshot, layer);
  if (trimmed.state !== "ready" || !trimmed.players.length) { snapshot.players = trimmed; return snapshot; }
  const since = new Date(Date.parse(`${localDate(snapshot.generatedAt, SHARE_TIME_ZONE)}T00:00:00Z`) - RECENT_LIMITS.lookbackDays * 86400000).toISOString().slice(0, 10);
  const recent = await loadSharePlayerRecent(season, trimmed.players.filter(player => player.group !== "G").map(player => player.nhlId), trimmed.players.filter(player => player.group === "G").map(player => player.nhlId), since).catch(() => null);
  snapshot.players = attachRecent(trimmed, recent, snapshot.generatedAt);
  return snapshot;
}

/** Previous, current or next NHL season relative to the request's New York week. */
export function assertSupportedSeason(weekStart: string, requestedAt: string) {
  const current = currentSeason(calendarWeekStart(requestedAt)), requested = currentSeason(weekStart);
  const first = current - 10001, last = current + 10001;
  const label = (season: number) => `${Math.floor(season / 10000)}–${String(season % 10000).slice(2)}`;
  if (requested < first || requested > last) throw new Error(`weekStart must fall in the ${label(first)}, ${label(current)} or ${label(last)} NHL season.`);
}

/** Shared CDN cache ceiling: matches the schedule's 15-minute near-puck-drop freshness window with room to spare. */
export const SHARE_CACHE_MAX_SECONDS = 300;
/** A cached edition must still leave the viewer this long to prepare and download before it expires. */
export const SHARE_CACHE_EXPIRY_MARGIN_SECONDS = 600;
/** Shorter ceiling while a card layer (opponents, players) is unready, so a transient failure clears quickly. */
export const SHARE_CACHE_UNREADY_OPPONENTS_SECONDS = 60;

/**
 * Cache-Control for a successful edition. Only ready editions are shared, and s-maxage plus
 * stale-while-revalidate never reach past expiresAt minus the margin, so the CDN cannot serve
 * an edition that expires before the viewer can use it. Browsers never cache (max-age=0).
 */
export function shareCacheControl(snapshot: SocialShareSnapshot, now = Date.now()) {
  if (snapshot.state !== "ready" || snapshot.source.state !== "ready" || !snapshot.expiresAt) return "no-store";
  const usable = Math.floor((Date.parse(snapshot.expiresAt) - now) / 1000) - SHARE_CACHE_EXPIRY_MARGIN_SECONDS;
  if (!Number.isFinite(usable) || usable < 60) return "no-store";
  // Any attached layer that is not ready (opponents required; players when present, including a failed
  // last-five-games read) keeps the cache short.
  const layersReady = snapshot.opponents?.state === "ready" && (!snapshot.players || (snapshot.players.state === "ready" && snapshot.players.recentState !== "unavailable"));
  const ceiling = layersReady ? SHARE_CACHE_MAX_SECONDS : SHARE_CACHE_UNREADY_OPPONENTS_SECONDS;
  const sMaxAge = Math.min(ceiling, usable);
  const stale = layersReady ? Math.min(SHARE_CACHE_MAX_SECONDS, usable - sMaxAge) : 0;
  return `public, max-age=0, s-maxage=${sMaxAge}${stale > 0 ? `, stale-while-revalidate=${stale}` : ""}`;
}
