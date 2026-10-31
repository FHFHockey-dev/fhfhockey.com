import { bounded } from "lib/socialShare/trendSources";
import type { SharePostContext, SharePostLoadResult, SharePostReadClient } from "./contract";
import { seasonScope } from "./creaseShift";
import { readScheduledGames, SEASON_GOALIE_LIMIT, SEASON_SCHEDULE_LIMIT, SEASON_TEAM_GAME_LIMIT } from "./creaseShift.sources";
import { buildGoalieGsax, NST_GSAX_COLUMNS, NST_GSAX_TABLES, toNstGoalieGames, type GoalieGsaxData, type GoalieGsaxSettings, type GsaxStrength, type NstGsaxRow } from "./goalieGsax";
import { readCompletedTeamGames, readGoalieAppearances } from "./shared/goalieLedger.sources";

/** Whether the FHFH model has this season's rows at all; a failed check reads as unknown, never as a value. */
async function countFhfhRows(client: SharePostReadClient, from: string, through: string): Promise<number | null> {
  try {
    const { count, error } = await client.from("nhl_xg_goalie_game_aggregates").select("game_id", { count: "exact", head: true }).gte("game_date", from).lte("game_date", through);
    return error || typeof count !== "number" ? null : count;
  } catch { return null; }
}

export async function loadGoalieGsax({ client, generatedAt }: SharePostContext, settings: GoalieGsaxSettings): Promise<SharePostLoadResult<GoalieGsaxData>> {
  const { from, through, season } = seasonScope(generatedAt), strength: GsaxStrength = settings.strength === "5v5" ? "5v5" : "all";
  const [nstRows, appearances, fhfhRows] = await Promise.all([
    bounded<NstGsaxRow>("NST goalie logs", SEASON_GOALIE_LIMIT, (start, end) => client.from(NST_GSAX_TABLES[strength]).select(NST_GSAX_COLUMNS.join(","), { count: "exact" }).eq("season", season).gte("date_scraped", from).lte("date_scraped", through).order("date_scraped").order("player_id").range(start, end)),
    readGoalieAppearances(client, { season, from, through, limit: SEASON_GOALIE_LIMIT }),
    countFhfhRows(client, from, through),
  ]);
  const nstGames = toNstGoalieGames(nstRows, { season, through });
  // Windows stop at NST's through-date, so the schedule proof stops there too.
  const proofThrough = nstGames.reduce((latest, game) => game.date > latest ? game.date : latest, from);
  const [reported, scheduled] = await Promise.all([
    readCompletedTeamGames(client, { season, from, through: proofThrough, limit: SEASON_TEAM_GAME_LIMIT }),
    readScheduledGames(client, { season, from, through: proofThrough, limit: SEASON_SCHEDULE_LIMIT }),
  ]);
  return buildGoalieGsax({ appearances, nstGames, strength, window: settings.window === "std" ? null : Number(settings.window), board: settings.board === "worst" ? "worst" : "best", minAppearances: settings.minAppearances, minCoverage: settings.minCoverage, reported, scheduled, fhfhRows });
}
