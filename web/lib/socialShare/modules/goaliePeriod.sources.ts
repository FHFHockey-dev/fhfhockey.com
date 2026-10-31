import type { GoalieWeeklyAggregate, LeagueWeeklyAverage } from "components/GoaliePage/goalieTypes";
import { bounded } from "lib/socialShare/trendSources";
import type { SharePostContext, SharePostLoadResult, SharePostReadClient } from "./contract";
import { seasonScope } from "./creaseShift";
import { readScheduledGames } from "./creaseShift.sources";
import { buildGoaliePeriod, periodReadRange, resolvePeriod, type GoaliePeriodData, type GoaliePeriodSettings } from "./goaliePeriod";
import { toMatchupWeeks } from "./shared/categoryCounts";
import { readCompletedTeamGames, readGoalieAppearances } from "./shared/goalieLedger.sources";

/** A month's touched weeks are at most 7 weeks: about 110 games a week, 2 team rows each, plus relief. Above this fails closed. */
const PERIOD_ROW_LIMIT = 1800;
const PERIOD_SCHEDULE_LIMIT = 900;
const TGV_ROW_LIMIT = 500;
const WEEK_LIMIT = 40;

/** The existing method's views, read as its page reads them. A failure leaves TGV unavailable beside Category Counts. */
async function readTgv(client: SharePostReadClient, matchupSeason: string, weeks: readonly number[]) {
  if (!weeks.length) return { goalies: [], league: [] };
  try {
    const [goalies, league] = await Promise.all([
      bounded<GoalieWeeklyAggregate>("TGV goalie weeks", TGV_ROW_LIMIT, (start, end) => client.from("goalie_weekly_aggregates").select("*", { count: "exact" }).eq("matchup_season", matchupSeason).in("week", [...weeks]).order("week").order("goalie_id").range(start, end)),
      bounded<LeagueWeeklyAverage>("TGV league weeks", WEEK_LIMIT, (start, end) => client.from("league_weekly_goalie_averages").select("*", { count: "exact" }).eq("matchup_season", matchupSeason).in("week", [...weeks]).order("week").range(start, end)),
    ]);
    return { goalies, league };
  } catch { return null; }
}

export async function loadGoaliePeriod({ client, generatedAt }: SharePostContext, settings: GoaliePeriodSettings): Promise<SharePostLoadResult<GoaliePeriodData>> {
  const { through, season } = seasonScope(generatedAt), matchupSeason = String(season).slice(0, 4);
  const weekRows = await bounded<{ week: number; start_date: string | null; end_date: string | null }>("Matchup weeks", WEEK_LIMIT, (start, end) => client.from("yahoo_matchup_weeks").select("week,start_date,end_date", { count: "exact" }).eq("season", matchupSeason).order("week").range(start, end));
  const resolved = resolvePeriod(settings, toMatchupWeeks(weekRows), through);
  if ("reason" in resolved) return { state: "missing", reasons: [resolved.reason], data: null, evidence: { sources: [{ name: "Yahoo matchup weeks", tables: ["yahoo_matchup_weeks"], state: "ready", asOf: null, updatedAt: null }], sample: resolved.reason, strength: "All situations", cohort: "Not available", coverage: null } };
  const { period } = resolved, range = { season, ...periodReadRange(period) };
  const [appearances, reported, scheduled, tgv] = await Promise.all([
    readGoalieAppearances(client, { ...range, limit: PERIOD_ROW_LIMIT }),
    readCompletedTeamGames(client, { ...range, limit: PERIOD_ROW_LIMIT }),
    readScheduledGames(client, { ...range, limit: PERIOD_SCHEDULE_LIMIT }),
    readTgv(client, matchupSeason, period.cellWeeks.map(week => week.week)),
  ]);
  return buildGoaliePeriod({ settings, period, appearances, reported, scheduled, tgv });
}
