import { getSchedule } from "lib/NHL/server";
import { buildScheduleSnapshot, calendarWeekStart, currentSeason } from "lib/socialShare/schedule";
import type { ShareMapRow } from "lib/socialShare/players";
import { bounded } from "lib/socialShare/trendSources";
import type { SharePostContext, SharePostLoadResult } from "./contract";
import { buildOffNightEdge, OFF_NIGHT_LOOKBACK_DAYS, offNightScheduleGate, offNightSelectedDates, type OffNightData, type OffNightSettings, type OffNightYahooRow } from "./offNightEdge";
import { editionDate } from "./shared/definitions";
import { readSkaterAppearances } from "./shared/skaterAppearances.sources";
import { shiftDays } from "./teamGames";

/** Ceilings over the live counts (read 1 in the lane receipt: 5,435 skater rows, 151 games, 1,608 Yahoo, 2,373 map). Over one fails closed. */
const LIMITS = { skaters: 9000, games: 300, yahoo: 2000, map: 3000 } as const;
const YAHOO_COLUMNS = "player_key,player_id,player_name,editorial_team_abbreviation,display_position,eligible_positions,position_type,percent_ownership,status,season,last_updated";

export async function loadOffNightEdge({ client, generatedAt }: SharePostContext, settings: OffNightSettings): Promise<SharePostLoadResult<OffNightData>> {
  const weekStart = calendarWeekStart(generatedAt), today = editionDate(generatedAt);
  const schedule = await getSchedule(weekStart, { includeOdds: false });
  // The edition refuses a read newer than its own time, so it is stamped after the schedule answers, as in socialShare/server.ts.
  const edition = buildScheduleSnapshot({ format: settings.dates === "weekly" ? "game-grid" : "remaining-week", weekStart, schedule, generatedAt: new Date().toISOString(), selectedDates: offNightSelectedDates(weekStart, today, settings.dates) });
  const gated = offNightScheduleGate(edition);
  if (gated) return gated;
  const through = shiftDays(today, -1), from = shiftDays(through, 1 - OFF_NIGHT_LOOKBACK_DAYS), season = currentSeason(through);
  const [appearances, games, yahoo, map] = await Promise.all([
    readSkaterAppearances(client, { season, from, through, limit: LIMITS.skaters }),
    bounded<{ id: number }>("Schedule", LIMITS.games, (start, end) => client.from("games").select("id", { count: "exact" }).eq("seasonId", season).eq("type", 2).gte("date", from).lte("date", through).order("id").range(start, end)),
    // No ownership filter in the read: a range filter would drop null, and unknown has to stay distinct from 0%.
    bounded<OffNightYahooRow>("Yahoo ownership", LIMITS.yahoo, (start, end) => client.from("yahoo_players").select(YAHOO_COLUMNS, { count: "exact" }).eq("season", Math.floor(season / 10000)).order("player_key").range(start, end)),
    // The whole map: only then can a Yahoo id on two NHL ids be seen and dropped.
    bounded<ShareMapRow>("Yahoo to NHL id map", LIMITS.map, (start, end) => client.from("yahoo_nhl_player_map_read").select("yahoo_player_id,nhl_player_id", { count: "exact" }).order("yahoo_player_id").order("nhl_player_id").range(start, end)),
  ]);
  return buildOffNightEdge({ edition, settings, appearances, yahoo, map, gameIds: games.map(game => game.id), from, through });
}
