import { getSchedule } from "lib/NHL/server";
import { buildScheduleSnapshot, currentSeason } from "lib/socialShare/schedule";
import type { ShareMapRow } from "lib/socialShare/players";
import { bounded } from "lib/socialShare/trendSources";
import type { SharePostContext, SharePostLoadResult } from "./contract";
import { seasonScope } from "./creaseShift";
import { buildOffNightEdge, OFF_NIGHT_LOOKBACK_DAYS, OFF_NIGHT_MAX_SCHEDULE_WEEKS, OFF_NIGHT_THIS_WEEK, offNightEmptyWindow, offNightPeriodMissing, offNightScheduleGate, offNightUpcoming, offNightWeeks, resolveOffNightWindow, type OffNightData, type OffNightSettings, type OffNightYahooRow } from "./offNightEdge";
import { editionDate } from "./shared/definitions";
import { matchupCalendar } from "./shared/periodWindow";
import { readMatchupRows } from "./shared/periodWindow.sources";
import { readSkaterAppearances } from "./shared/skaterAppearances.sources";
import { shiftDays } from "./teamGames";

/** Ceilings over the live counts (read 1 in the lane receipt: 5,435 skater rows, 151 games, 1,608 Yahoo, 2,373 map). Over one fails closed. */
const LIMITS = { skaters: 9000, games: 300, yahoo: 2000, map: 3000 } as const;
const YAHOO_COLUMNS = "player_key,player_id,player_name,editorial_team_abbreviation,display_position,eligible_positions,position_type,percent_ownership,status,season,last_updated";

export async function loadOffNightEdge({ client, generatedAt }: SharePostContext, settings: OffNightSettings): Promise<SharePostLoadResult<OffNightData>> {
  const today = editionDate(generatedAt), thisWeek = settings.period === OFF_NIGHT_THIS_WEEK;
  // This week's default needs no matchup calendar, so that table cannot take it down.
  const calendar = thisWeek ? { weeks: [], reasons: [] } : matchupCalendar(await readMatchupRows(client, String(seasonScope(generatedAt).season).slice(0, 4)));
  const { window, reason } = resolveOffNightWindow(settings, calendar, generatedAt);
  if (!window) return offNightPeriodMissing([reason, ...calendar.reasons]);
  const weeks = offNightWeeks(window.from, window.through);
  if (weeks.length > OFF_NIGHT_MAX_SCHEDULE_WEEKS) return offNightPeriodMissing([`${window.label} touches ${weeks.length} schedule weeks; this post reads at most ${OFF_NIGHT_MAX_SCHEDULE_WEEKS}.`]);
  const upcoming = offNightUpcoming(window, generatedAt);
  // A date ahead of today can fail only because it is not out yet, which the default's generic failure would not say.
  const schedules = await Promise.all(weeks.map(week => getSchedule(week.weekStart, { includeOdds: false }))).catch((cause: unknown) => {
    if (upcoming) return null;
    throw cause;
  });
  if (!schedules) return offNightPeriodMissing([`The NHL schedule for ${window.label} could not be read. It may not be published yet.`]);
  // The edition refuses a read newer than its own time, so it is stamped after the schedule answers, as in socialShare/server.ts.
  const stamped = new Date().toISOString();
  const edition = weeks.map((week, index) => buildScheduleSnapshot({ format: thisWeek && settings.dates === "rest-of-week" ? "remaining-week" : "game-grid", weekStart: week.weekStart, schedule: schedules[index], generatedAt: stamped, selectedDates: week.dates }));
  const gated = offNightScheduleGate(edition);
  if (gated) return upcoming ? { ...gated, reasons: [`The NHL schedule for ${window.label} is not fully published, so there is no ranking.`, ...gated.reasons ?? []] } : gated;
  const empty = offNightEmptyWindow(edition, window, settings);
  if (empty) return empty;
  const through = shiftDays(today, -1), from = shiftDays(through, 1 - OFF_NIGHT_LOOKBACK_DAYS), season = currentSeason(through);
  const [appearances, games, yahoo, map] = await Promise.all([
    readSkaterAppearances(client, { season, from, through, limit: LIMITS.skaters }),
    bounded<{ id: number; date: string }>("Schedule", LIMITS.games, (start, end) => client.from("games").select("id,date", { count: "exact" }).eq("seasonId", season).eq("type", 2).gte("date", from).lte("date", through).order("id").range(start, end)),
    // No ownership filter in the read: a range filter would drop null, and unknown has to stay distinct from 0%.
    bounded<OffNightYahooRow>("Yahoo ownership", LIMITS.yahoo, (start, end) => client.from("yahoo_players").select(YAHOO_COLUMNS, { count: "exact" }).eq("season", Math.floor(season / 10000)).order("player_key").range(start, end)),
    // The whole map: only then can a Yahoo id on two NHL ids be seen and dropped.
    bounded<ShareMapRow>("Yahoo to NHL id map", LIMITS.map, (start, end) => client.from("yahoo_nhl_player_map_read").select("yahoo_player_id,nhl_player_id", { count: "exact" }).order("yahoo_player_id").order("nhl_player_id").range(start, end)),
  ]);
  return buildOffNightEdge({ edition, window, settings, appearances, yahoo, map, gameIds: games.map(game => game.id), scheduled: games, from, through });
}
