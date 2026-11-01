import { bounded } from "lib/socialShare/trendSources";
import type { SharePostContext, SharePostLoadResult, SharePostReadClient } from "./contract";
import { seasonScope } from "./creaseShift";
import { readScheduledGames, SEASON_GOALIE_LIMIT, SEASON_SCHEDULE_LIMIT, SEASON_TEAM_GAME_LIMIT } from "./creaseShift.sources";
import { buildGoalieGsax, GSAX_PERIOD_WINDOW, goalieGsaxModule, NST_GSAX_COLUMNS, NST_GSAX_TABLES, toNstGoalieGames, type GoalieGsaxData, type GoalieGsaxSettings, type GsaxStrength, type GsaxWindow, type NstGsaxRow } from "./goalieGsax";
import { boardChoice } from "./shared/goalieBoards";
import { matchupCalendar, resolvePeriodWindow } from "./shared/periodWindow";
import { readMatchupRows } from "./shared/periodWindow.sources";
import { readCompletedTeamGames, readGoalieAppearances } from "./shared/goalieLedger.sources";

/** Whether the FHFH model has this season's rows at all; a failed check reads as unknown, never as a value. */
async function countFhfhRows(client: SharePostReadClient, from: string, through: string): Promise<number | null> {
  try {
    const { count, error } = await client.from("nhl_xg_goalie_game_aggregates").select("game_id", { count: "exact", head: true }).gte("game_date", from).lte("game_date", through);
    return error || typeof count !== "number" ? null : count;
  } catch { return null; }
}

const missing = (reason: string): SharePostLoadResult<GoalieGsaxData> => ({ state: "missing", reasons: [reason], data: null, evidence: { sources: [{ name: "Yahoo matchup weeks", tables: ["yahoo_matchup_weeks"], state: "ready", asOf: null, updatedAt: null }], sample: reason, strength: "Not available", cohort: "Not available", coverage: null } });

export async function loadGoalieGsax({ client, generatedAt }: SharePostContext, settings: GoalieGsaxSettings): Promise<SharePostLoadResult<GoalieGsaxData>> {
  const { from, through, season } = seasonScope(generatedAt), strength: GsaxStrength = settings.strength === "5v5" ? "5v5" : "all";
  const calendar = matchupCalendar(await readMatchupRows(client, String(season).slice(0, 4)));
  let window: GsaxWindow = settings.window === "week" ? "week" : settings.window === "std" ? null : Number(settings.window);
  if (settings.period !== GSAX_PERIOD_WINDOW) {
    const resolved = resolvePeriodWindow(settings, calendar, { ...goalieGsaxModule.periodControl!, cutoff: through });
    if (!resolved.window) return missing(calendar.reasons.find(reason => /overlap/.test(reason)) ?? resolved.reason);
    window = { from: resolved.window.from, through: resolved.window.through, label: resolved.window.label, week: resolved.window.week };
  }
  const nstRows = await bounded<NstGsaxRow>("NST goalie logs", SEASON_GOALIE_LIMIT, (start, end) => client.from(NST_GSAX_TABLES[strength]).select(NST_GSAX_COLUMNS.join(","), { count: "exact" }).eq("season", season).gte("date_scraped", from).lte("date_scraped", through).order("date_scraped").order("player_id").range(start, end));
  const appearances = await readGoalieAppearances(client, { season, from, through, limit: SEASON_GOALIE_LIMIT });
  const fhfhRows = await countFhfhRows(client, from, through);
  const nstGames = toNstGoalieGames(nstRows, { season, through });
  // Preset windows stop at NST's through-date, so their schedule proof stops there too. Chosen dates must prove every game they name, up to the cutoff.
  const nstNewest = nstGames.reduce((latest, game) => game.date > latest ? game.date : latest, from);
  const proofThrough = typeof window === "object" && window ? [window.through, through].sort()[0] : nstNewest;
  const reported = await readCompletedTeamGames(client, { season, from, through: proofThrough, limit: SEASON_TEAM_GAME_LIMIT });
  const scheduled = await readScheduledGames(client, { season, from, through: proofThrough, limit: SEASON_SCHEDULE_LIMIT });
  return buildGoalieGsax({ appearances, nstGames, strength, window, weeks: calendar.weeks, board: boardChoice(settings.board), minAppearances: settings.minAppearances, minCoverage: settings.minCoverage, reported, scheduled, fhfhRows });
}
