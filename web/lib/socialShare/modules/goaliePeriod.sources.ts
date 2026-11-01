import type { GoalieWeeklyAggregate, LeagueWeeklyAverage } from "components/GoaliePage/goalieTypes";
import { bounded } from "lib/socialShare/trendSources";
import type { SharePostContext, SharePostLoadResult, SharePostReadClient } from "./contract";
import { seasonScope, type ScheduledGame } from "./creaseShift";
import { readScheduledGames } from "./creaseShift.sources";
import { buildGoaliePeriod, periodReadRange, resolvePeriod, tgvSeasonWeeks, type GoalieAdpRows, type GoaliePeriodData, type GoaliePeriodSettings, type TgvRows, type YahooAdpGoalieRow } from "./goaliePeriod";
import type { YahooMapRow } from "./goalieRescue";
import { toMatchupWeeks, type MatchupWeek } from "./shared/categoryCounts";
import { readMatchupRows } from "./shared/periodWindow.sources";
import type { CompletedTeamGame, GoalieAppearance } from "./shared/goalieLedger";
import { readCompletedTeamGames, readGoalieAppearances } from "./shared/goalieLedger.sources";

/** A month's touched weeks are at most 7 weeks: about 110 games a week, 2 team rows each, plus relief. Above this fails closed. */
const PERIOD_ROW_LIMIT = 1800;
const PERIOD_SCHEDULE_LIMIT = 900;
/** A full season or a long range: 1,312 games, 2 team rows and 2 starters each, plus relief. Above these fails closed, and the post says so. */
export const LONG_PERIOD_ROW_LIMIT = 3600;
const LONG_SCHEDULE_LIMIT = 1400;
/** Season through the period: 27 weeks × at most about 80 goalies a week (61 so far). Above this fails closed. */
const TGV_ROW_LIMIT = 2200;
const WEEK_LIMIT = 40;
/** 181 Yahoo goalies this season and 716 numeric picks across every season on 2026-11-01. Above a ceiling a read fails closed. */
const YAHOO_GOALIE_LIMIT = 400, MAP_CHUNK = 150, AVERAGE_PICK_LIMIT = 1500;

/** The existing method's views, read as its page reads them. A failure leaves TGV unavailable beside Category Counts. */
async function readTgv(client: SharePostReadClient, matchupSeason: string, weeks: readonly MatchupWeek[]): Promise<TgvRows | null> {
  if (!weeks.length) return { weeks, goalies: [], league: [] };
  const through = weeks[weeks.length - 1].week;
  try {
    const goalies = await bounded<GoalieWeeklyAggregate>("TGV goalie weeks", TGV_ROW_LIMIT, (start, end) => client.from("goalie_weekly_aggregates").select("*", { count: "exact" }).eq("matchup_season", matchupSeason).lte("week", through).order("week").order("goalie_id").range(start, end));
    const league = await bounded<LeagueWeeklyAverage>("TGV league weeks", WEEK_LIMIT, (start, end) => client.from("league_weekly_goalie_averages").select("*", { count: "exact" }).eq("matchup_season", matchupSeason).lte("week", through).order("week").range(start, end));
    return { weeks, goalies, league };
  } catch { return null; }
}

/**
 * Only this Yahoo season's goalie rows give a value: other seasons hold other picks for the same player. The highest pick is across every season,
 * as the fallback rule says, skipping Yahoo's "-" to stay small. Any failure leaves ADP unavailable rather than counting goalies as undrafted.
 */
export async function readPeriodAdp(client: SharePostReadClient, yahooSeason: number): Promise<GoalieAdpRows | null> {
  try {
    const [goalies, averagePicks] = await Promise.all([
      bounded<YahooAdpGoalieRow>("Yahoo goalie picks", YAHOO_GOALIE_LIMIT, (start, end) => client.from("yahoo_players").select("player_key,player_id,average_pick:draft_analysis->>average_pick", { count: "exact" }).eq("season", yahooSeason).eq("display_position", "G").order("player_key").range(start, end)),
      bounded<{ average_pick: string | null }>("Yahoo average picks", AVERAGE_PICK_LIMIT, (start, end) => client.from("yahoo_players").select("average_pick:draft_analysis->>average_pick", { count: "exact" }).neq("draft_analysis->>average_pick", "-").order("player_key").range(start, end)),
    ]);
    const keys = [...new Set(goalies.flatMap(row => row.player_id ? [row.player_key, row.player_id] : [row.player_key]))], map: YahooMapRow[] = [];
    for (let index = 0; index < keys.length; index += MAP_CHUNK) {
      const chunk = keys.slice(index, index + MAP_CHUNK);
      map.push(...await bounded<YahooMapRow>("Yahoo to NHL id map", chunk.length * 2, (start, end) => client.from("yahoo_nhl_player_map_read").select("yahoo_player_id,nhl_player_id", { count: "exact" }).in("yahoo_player_id", chunk).order("yahoo_player_id").order("nhl_player_id").range(start, end)));
    }
    return { goalies, map, averagePicks: averagePicks.map(row => row.average_pick) };
  } catch { return null; }
}

export async function loadGoaliePeriod({ client, generatedAt }: SharePostContext, settings: GoaliePeriodSettings): Promise<SharePostLoadResult<GoaliePeriodData>> {
  const { through, season } = seasonScope(generatedAt), matchupSeason = String(season).slice(0, 4);
  const weeks = toMatchupWeeks(await readMatchupRows(client, matchupSeason)), resolved = resolvePeriod(settings, weeks, through);
  const missing = (reason: string): SharePostLoadResult<GoaliePeriodData> => ({ state: "missing", reasons: [reason], data: null, evidence: { sources: [{ name: "Yahoo matchup weeks", tables: ["yahoo_matchup_weeks"], state: "ready", asOf: null, updatedAt: null }], sample: reason, strength: "All situations", cohort: "Not available", coverage: null } });
  if ("reason" in resolved) return missing(resolved.reason);
  const { period } = resolved, range = { season, ...periodReadRange(period) }, long = period.kind === "custom" || period.kind === "season";
  const limit = long ? LONG_PERIOD_ROW_LIMIT : PERIOD_ROW_LIMIT;
  let reads: [GoalieAppearance[], CompletedTeamGame[], ScheduledGame[]];
  try {
    reads = [await readGoalieAppearances(client, { ...range, limit }), await readCompletedTeamGames(client, { ...range, limit }), await readScheduledGames(client, { ...range, limit: long ? LONG_SCHEDULE_LIMIT : PERIOD_SCHEDULE_LIMIT })];
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/over its \d+-row limit/.test(message)) return missing(`${period.label} is too large to read: ${message}`);
    throw error;
  }
  const [appearances, reported, scheduled] = reads;
  const tgv = await readTgv(client, matchupSeason, tgvSeasonWeeks(weeks, period));
  const adp = await readPeriodAdp(client, Math.floor(season / 10000));
  return buildGoaliePeriod({ settings, period, appearances, reported, scheduled, tgv, adp });
}
