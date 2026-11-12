import { bounded } from "lib/socialShare/trendSources";
import { activeTeamAbbreviations, teamsInfo } from "lib/teamsInfo";
import type { SharePostContext, SharePostLoadResult, SharePostReadClient } from "./contract";
import { buildCreaseShift, creaseShiftPicks, reconcileSchedule, seasonScope, type CreaseShiftData, type CreaseShiftSettings, type ScheduledGame } from "./creaseShift";
import { readCompletedTeamGames, readGoalieAppearances } from "./shared/goalieLedger.sources";
import { GOALIE_APPEARANCE_COLUMNS, TEAM_GAME_COLUMNS, toCompletedTeamGames, toGoalieAppearances, type GoalieAppearanceRow, type TeamGameRow } from "./shared/goalieLedger";
import type { GoalieWorkloadSnapshot } from "components/GameGrid/utils/goalieWorkloadView";

/**
 * A full 84-game season through the cutoff: 32 × 84 / 2 = 1,344 games, 2,688 team rows. The team and goalie reads do not
 * filter out playoff rows, so each also covers a full playoff run (at most 105 games, 210 team rows) on top. The goalie read
 * is one row per goalie per game: 2,688 starts plus relief. Read 11-11 on 82-game seasons: 2,764 to 2,797 goalie rows a
 * regular season, and 2,940 goalie and 2,788 team rows for 2025-26 with its playoffs. Anything above these fails closed.
 */
export const SEASON_TEAM_GAME_LIMIT = 3000;
export const SEASON_GOALIE_LIMIT = 3400;
/** Regular-season games only (`type` 2): 1,344. */
export const SEASON_SCHEDULE_LIMIT = 1400;

/** Game ids per final-state read; at most two game-end rows each before the read fails closed. */
export const FINAL_STATE_CHUNK = 200;

/**
 * The final-state predicate (rule 19), the same evidence the team unit-TOI planner uses: a game is final when its stored
 * play-by-play holds exactly one game-end event. None, or more than one, is not proof.
 */
export async function readFinalGameIds(client: SharePostReadClient, gameIds: readonly number[]): Promise<Set<number>> {
  const ends = new Map<number, number>();
  for (let index = 0; index < gameIds.length; index += FINAL_STATE_CHUNK) {
    const chunk = gameIds.slice(index, index + FINAL_STATE_CHUNK);
    const rows = await bounded<{ gameid: number; id: number }>("Final-state evidence", chunk.length * 2, (start, end) => client.from("pbp_plays").select("gameid,id", { count: "exact" }).in("gameid", [...chunk]).eq("typedesckey", "game-end").order("gameid").order("id").range(start, end));
    for (const row of rows) ends.set(Number(row.gameid), (ends.get(Number(row.gameid)) ?? 0) + 1);
  }
  return new Set([...ends].filter(([, count]) => count === 1).map(([gameId]) => gameId));
}

/** Regular-season games in the dates, oldest first, each with `final` from `readFinalGameIds`. See `ScheduledGame`. */
export async function readScheduledGames(client: SharePostReadClient, scope: { season: number; from: string; through: string; limit: number; teamId?: number; startedBy?: string }): Promise<ScheduledGame[]> {
  const games = await bounded<Omit<ScheduledGame, "final">>("Schedule", scope.limit, (start, end) => {
    let query = client.from("games").select("id,date,homeTeamId,awayTeamId", { count: "exact" }).eq("seasonId", scope.season).eq("type", 2).gte("date", scope.from).lte("date", scope.through);
    if (scope.teamId !== undefined) query = query.or(`homeTeamId.eq.${scope.teamId},awayTeamId.eq.${scope.teamId}`);
    if (scope.startedBy !== undefined) query = query.lte("startTime", scope.startedBy);
    return query.order("date").order("id").range(start, end);
  });
  const final = games.length ? await readFinalGameIds(client, games.map(game => game.id)) : new Set<number>();
  return games.map(game => ({ ...game, final: final.has(game.id) }));
}

/** Lazy Game Grid read: one team's stored regular-season schedule, at most 100 games / 400 appearances.
 * Game-end observation proves finality; it does not supply the actual completion timestamp or an as-issued archive. */
export async function loadGoalieGridHistory(client: SharePostReadClient, scope: { season: number; teamId: number; through: string; requestedAt: string }): Promise<GoalieWorkloadSnapshot> {
  const team = Object.entries(teamsInfo).find(([, value]) => value.id === scope.teamId)?.[0];
  if (!team) throw new Error("Unknown team for goalie history.");
  const from = `${String(scope.season).slice(0, 4)}-07-01`;
  const scheduled = await readScheduledGames(client, { season: scope.season, from, through: scope.through, limit: 100,
    teamId: scope.teamId, startedBy: scope.requestedAt });
  if (new Set(scheduled.map(g => g.id)).size !== scheduled.length) throw new Error("Duplicate schedule identities.");
  const ids = scheduled.map(g => g.id);
  const [teamRows, goalieRows] = ids.length ? await Promise.all([
    bounded<TeamGameRow>("Team's completed games", 100, (start, end) => client.from("wgo_team_stats")
      .select(TEAM_GAME_COLUMNS.join(","), { count: "exact" }).eq("season_id", scope.season).eq("team_id", scope.teamId)
      .in("game_id", ids).gte("date", from).lte("date", scope.through).order("game_id").range(start, end)),
    bounded<GoalieAppearanceRow>("Team's goalie appearances", 400, (start, end) => client.from("wgo_goalie_stats")
      .select(GOALIE_APPEARANCE_COLUMNS.join(","), { count: "exact" }).eq("season_id", scope.season).eq("team_abbreviation", team)
      .in("game_id", ids).gte("date", from).lte("date", scope.through).order("game_id").order("goalie_id").range(start, end)),
  ]) : [[], []];
  const reported = toCompletedTeamGames(teamRows, scope);
  const appearances = toGoalieAppearances(goalieRows, scope);
  // Keep exact team/date matching; a misplaced report cannot fill a schedule gap.
  const matching = reported.filter(g => scheduled.some(s => s.id === g.gameId && s.date === g.date) && g.team === team);
  const reconciliation = reconcileSchedule(scheduled, matching);
  const games = reconciliation.games.filter(g => g.team === team);
  const observedAt = new Date().toISOString();
  return { version: "goalie-workload-view-v1", seasonId: scope.season, seasonStartsOn: from, teamId: scope.teamId,
    source: "Crease Shift: stored regular-season schedule, WGO official starts, exactly one PBP game-end event",
    revision: `crease-shift:${scope.season}:${scope.teamId}:${observedAt}`, observedAt,
    dataThrough: games.map(g => g.date).sort().at(-1) ?? null, basis: "current_recorded_results",
    coverageBasis: "stored_regular_season_schedule", scheduleVerifiedThrough: scope.through,
    // An empty stored season schedule cannot distinguish a bye/early season from missing ingestion.
    scheduleComplete: scheduled.length > 0 && !reconciliation.gaps.some(gap => gap.team === team), appearancesComplete: true,
    scheduleCoverage: { version: "stored-team-schedule-v1", from, through: scope.through, scheduledGames: scheduled.length,
      gaps: reconciliation.gaps.filter(gap => gap.team === team).map(({ gameId, date, reason }) => ({ gameId, date, reason })) },
    games: games.map(g => ({ ...g, seasonId: scope.season, state: "final", completedAt: null,
      finality: { basis: "single_stored_game_end", observedAt } })), appearances };
}

export async function loadCreaseShift({ client, generatedAt }: SharePostContext, settings: CreaseShiftSettings): Promise<SharePostLoadResult<CreaseShiftData>> {
  const { from, through, season } = seasonScope(generatedAt);
  const [reported, appearances, scheduled] = await Promise.all([
    readCompletedTeamGames(client, { season, from, through, limit: SEASON_TEAM_GAME_LIMIT }),
    readGoalieAppearances(client, { season, from, through, limit: SEASON_GOALIE_LIMIT }),
    readScheduledGames(client, { season, from, through, limit: SEASON_SCHEDULE_LIMIT }),
  ]);
  // Every team is ranked so a picked team keeps its league rank; the picks only choose who shows.
  return buildCreaseShift({ reported, appearances, scheduled, teams: [...activeTeamAbbreviations].map(String).sort(), picked: creaseShiftPicks(settings.teams), window: Number(settings.window), comparison: settings.comparison === "std" ? "std" : "previous", minComparisonGames: settings.minComparisonGames, through });
}
