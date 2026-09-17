import supabase from "lib/supabase/server";
import { PROJECTION_SOURCES_CONFIG } from "lib/projectionsConfig/projectionSourcesConfig";
import { FANTASY_PROJECTION_SEASON_ID } from "lib/fantasy-projections/contracts";
import type { BoardStats } from "./starterBoardScoring";

export const SEASON_BOOTSTRAP_POLICY = { version: "season-bootstrap-v1", historyGames: 20,
  transitionGames: 20, fantasyShare: 0.6, validation: "unvalidated" as const };
export type SeasonBootstrap = {
  previous: BoardStats; fantasy: BoardStats; currentSeasonGames: number; historyGames: number;
  sourceIds: string[]; sourceRowIds: string[]; limitations: string[];
};
export type SeasonBootstrapDisclosure = {
  version: string; currentSeasonGames: number; historyGames: number; transitionGames: number;
  sourceIds: string[]; fantasyWeight: number; historyWeight: number; validation: "unvalidated";
  limitations: string[];
};
const number = (value: unknown): number | null => value !== null && value !== undefined && value !== ""
  && typeof value !== "boolean" && Number.isFinite(Number(value)) ? Number(value) : null;
const nonnegative = (value: unknown) => { const n = number(value); return n != null && n >= 0 ? n : null; };
const minutes = (value: unknown) => {
  if (typeof value !== "string" || !/^\d+:\d{2}$/.test(value)) return null;
  const [m, s] = value.split(":").map(Number);
  return s < 60 ? m + s / 60 : null;
};
const skaterKeys: Record<string, string> = { GOALS: "goals", ASSISTS: "assists", SHOTS_ON_GOAL: "shots",
  HITS: "hits", BLOCKED_SHOTS: "blockedShots", PP_POINTS: "powerPlayPoints", PP_GOALS: "powerPlayGoals",
  PENALTY_MINUTES: "pim" };

/** Convert hockey totals before scoring; never divide percentage/rate columns. */
export function fantasySourcePerGame(row: Record<string, unknown>, sourceId: string): BoardStats | null {
  const source = PROJECTION_SOURCES_CONFIG.find((item) => item.id === sourceId);
  const gp = nonnegative(row.Games_Played);
  if (!source || !gp || gp > 100) return null;
  const stats: BoardStats = {};
  for (const mapping of source.statMappings) {
    if (["GAMES_PLAYED", "GAMES_STARTED_GOALIE", "SHOOTING_PERCENTAGE", "SAVE_PERCENTAGE",
      "GOALS_AGAINST_AVERAGE", "FACEOFF_PERCENTAGE"].includes(mapping.key)) continue;
    const value = number(row[mapping.dbColumnName]);
    if (value == null || value < 0 && mapping.key !== "PLUS_MINUS") continue;
    const starts = nonnegative(row.Games_Started_Goalie);
    const denominator = source.playerType === "goalie" && ["WINS_GOALIE", "SHUTOUTS_GOALIE"].includes(mapping.key)
      ? starts && starts <= gp ? starts : null : gp;
    // TOI is already minutes per appearance in the dashboard's import contract.
    stats[mapping.key] = mapping.key === "TIME_ON_ICE_PER_GAME" ? value : denominator ? value / denominator : null;
  }
  if (source.playerType === "goalie") {
    const saves = stats.SAVES_GOALIE, ga = stats.GOALS_AGAINST_GOALIE;
    if (saves != null && ga != null) stats.SHOTS_AGAINST_GOALIE = saves + ga;
    for (const key of ["WINS_GOALIE", "SHUTOUTS_GOALIE"]) {
      if (stats[key] != null && stats[key]! > 1) stats[key] = null;
    }
  }
  return Object.values(stats).some((value) => value != null) ? stats : null;
}

/** Missing categories stay missing; each available public source has equal weight. */
export function averageBootstrapStats(rows: BoardStats[]): BoardStats {
  return Object.fromEntries([...new Set(rows.flatMap((row) => Object.keys(row)))].map((key) => {
    const values = rows.map((row) => row[key]).filter((v): v is number => v != null && Number.isFinite(v));
    return [key, values.length ? values.reduce((a, b) => a + b, 0) / values.length : null];
  }));
}

export function buildSeasonHistory(rows: any[], seasonId: number, cutoffDate: string, population: "skater" | "goalie",
  windowGames = SEASON_BOOTSTRAP_POLICY.historyGames) {
  if (!Number.isInteger(windowGames) || windowGames < 1 || windowGames > 84) throw new Error("Invalid season history window");
  const previousSeason = seasonId - 10001;
  const seen = new Set<number>();
  const eligible = rows.filter((row) => {
    const game = row.games;
    const playedMinutes = minutes(row.toi) ?? (population === "goalie" ? nonnegative(row.toi_seconds) : null);
    if (!game || Number(game.type) !== 2 || game.date >= cutoffDate || ![seasonId, previousSeason].includes(Number(game.seasonId))
      || !playedMinutes || seen.has(Number(game.id))) return false;
    seen.add(Number(game.id)); return true;
  }).sort((a, b) => b.games.date.localeCompare(a.games.date) || Number(b.games.id) - Number(a.games.id));
  const previous = eligible.filter((row) => Number(row.games.seasonId) === previousSeason).slice(0, windowGames);
  const stats = previous.map((row): BoardStats => {
    if (population === "goalie") {
      const match = typeof row.saveShotsAgainst === "string" ? /^(\d+)\/(\d+)$/.exec(row.saveShotsAgainst) : null;
      const saves = match ? Number(match[1]) : nonnegative(row.saves);
      const shots = match ? Number(match[2]) : nonnegative(row.shots_against);
      const ga = nonnegative(row.goalsAgainst ?? row.goals_allowed);
      return saves != null && shots != null && ga != null && saves + ga === shots
        ? { SAVES_GOALIE: saves, GOALS_AGAINST_GOALIE: ga, SHOTS_AGAINST_GOALIE: shots } : {};
    }
    return {
    ...Object.fromEntries(Object.entries(skaterKeys).map(([key, field]) => [key, nonnegative(row[field])])),
    TIME_ON_ICE_PER_GAME: minutes(row.toi), PP_TOI: minutes(row.powerPlayToi),
    };
  });
  return { previous: averageBootstrapStats(stats), historyGames: previous.length,
    currentSeasonGames: eligible.filter((row) => Number(row.games.seasonId) === seasonId).length };
}

export function blendSeasonBootstrap(organic: BoardStats, prior: SeasonBootstrap) {
  const progress = Math.min(1, Math.max(0, prior.currentSeasonGames) / SEASON_BOOTSTRAP_POLICY.transitionGames);
  const fantasyWeight = (1 - progress) * SEASON_BOOTSTRAP_POLICY.fantasyShare;
  const historyWeight = (1 - progress) * (1 - SEASON_BOOTSTRAP_POLICY.fantasyShare);
  const stats: BoardStats = { ...organic };
  for (const key of new Set([...Object.keys(organic), ...Object.keys(prior.previous), ...Object.keys(prior.fantasy)])) {
    const parts = [[organic[key], progress], [prior.previous[key], historyWeight], [prior.fantasy[key], fantasyWeight]]
      .filter(([value, weight]) => value != null && Number.isFinite(value) && weight != null && weight > 0) as number[][];
    const weight = parts.reduce((sum, part) => sum + part[1], 0);
    stats[key] = weight ? parts.reduce((sum, [value, w]) => sum + value * w, 0) / weight : organic[key] ?? null;
  }
  if (stats.SAVES_GOALIE != null && stats.GOALS_AGAINST_GOALIE != null)
    stats.SHOTS_AGAINST_GOALIE = stats.SAVES_GOALIE + stats.GOALS_AGAINST_GOALIE;
  if (stats.GOALS != null && stats.ASSISTS != null && stats.PP_POINTS != null)
    stats.PP_POINTS = Math.min(stats.PP_POINTS, stats.GOALS + stats.ASSISTS);
  const disclosure: SeasonBootstrapDisclosure = { version: SEASON_BOOTSTRAP_POLICY.version,
    currentSeasonGames: prior.currentSeasonGames, historyGames: prior.historyGames,
    transitionGames: SEASON_BOOTSTRAP_POLICY.transitionGames, sourceIds: prior.sourceIds,
    fantasyWeight, historyWeight, validation: "unvalidated", limitations: prior.limitations };
  return { stats, disclosure };
}

export function bootstrapSkaterLine(organic: { goalsEs: number; goalsPp: number; assistsEs: number; assistsPp: number;
  shotsEs: number; shotsPp: number; hits: number; blocks: number }, prior: SeasonBootstrap,
  context: { goals: number; assists: number; shots: number; ppUsage: number }) {
  const contextualize = (stats: BoardStats): BoardStats => {
    const next = { ...stats };
    for (const [key, factor] of Object.entries({ GOALS: context.goals, PP_GOALS: context.goals,
      ASSISTS: context.assists, SHOTS_ON_GOAL: context.shots, PP_POINTS: (context.goals + context.assists) / 2 })) {
      if (next[key] != null) next[key] = next[key]! * factor;
    }
    const ppPoints = next.PP_POINTS;
    if (ppPoints != null) {
      const totalPoints = (next.GOALS ?? 0) + (next.ASSISTS ?? 0);
      const ppGoals = Math.min(ppPoints, next.PP_GOALS ?? (totalPoints ? ppPoints * (next.GOALS ?? 0) / totalPoints : 0));
      if (next.GOALS != null) next.GOALS = Math.max(0, next.GOALS + ppGoals * (context.ppUsage - 1));
      if (next.ASSISTS != null) next.ASSISTS = Math.max(0, next.ASSISTS + (ppPoints - ppGoals) * (context.ppUsage - 1));
      next.PP_POINTS = ppPoints * context.ppUsage;
      next.PP_GOALS = ppGoals * context.ppUsage;
    }
    return next;
  };
  const blended = blendSeasonBootstrap({ GOALS: organic.goalsEs + organic.goalsPp,
    ASSISTS: organic.assistsEs + organic.assistsPp, PP_GOALS: organic.goalsPp, PP_POINTS: organic.goalsPp + organic.assistsPp,
    SHOTS_ON_GOAL: organic.shotsEs + organic.shotsPp, HITS: organic.hits, BLOCKED_SHOTS: organic.blocks },
    { ...prior, previous: contextualize(prior.previous), fantasy: contextualize(prior.fantasy) });
  const s = blended.stats;
  const goals = s.GOALS ?? organic.goalsEs + organic.goalsPp;
  const assists = s.ASSISTS ?? organic.assistsEs + organic.assistsPp;
  const ppPoints = Math.min(goals + assists, s.PP_POINTS ?? organic.goalsPp + organic.assistsPp);
  const goalsPp = Math.max(0, Math.min(goals, ppPoints, s.PP_GOALS ?? organic.goalsPp));
  const assistsPp = Math.min(assists, ppPoints - goalsPp);
  const shots = s.SHOTS_ON_GOAL ?? organic.shotsEs + organic.shotsPp;
  const ppShotShare = organic.shotsEs + organic.shotsPp > 0 ? organic.shotsPp / (organic.shotsEs + organic.shotsPp) : 0;
  return { goalsEs: goals - goalsPp, goalsPp, assistsEs: assists - assistsPp, assistsPp,
    shotsEs: shots * (1 - ppShotShare), shotsPp: shots * ppShotShare,
    hits: s.HITS ?? organic.hits, blocks: s.BLOCKED_SHOTS ?? organic.blocks, disclosure: blended.disclosure };
}

/** Keep today's opponent-driven shot volume while shrinking goalie performance. */
export function bootstrapGoalieLine(organic: BoardStats, prior: SeasonBootstrap) {
  const result = blendSeasonBootstrap(organic, prior);
  const saves = result.stats.SAVES_GOALIE, ga = result.stats.GOALS_AGAINST_GOALIE;
  const shots = organic.SHOTS_AGAINST_GOALIE;
  if (shots != null && saves != null && ga != null && saves + ga > 0) {
    result.stats.SAVES_GOALIE = shots * saves / (saves + ga);
    result.stats.GOALS_AGAINST_GOALIE = shots - result.stats.SAVES_GOALIE;
    result.stats.SHOTS_AGAINST_GOALIE = shots;
  }
  return result;
}

/** These reads participate in the existing immutable FORGE input transcript. */
export async function loadSeasonBootstrap(playerIds: number[], seasonId: number, cutoffDate: string,
  population: "skater" | "goalie", allowCurrentFantasy: boolean): Promise<Map<number, SeasonBootstrap>> {
  if (!playerIds.length) return new Map();
  const db = supabase as any;
  const sourceConfigs = allowCurrentFantasy && seasonId === FANTASY_PROJECTION_SEASON_ID
    ? PROJECTION_SOURCES_CONFIG.filter((s) => s.playerType === population && s.defaultSelected !== false) : [];
  const historyRows: any[] = [];
  for (let offset = 0; ; offset += 500) {
    if (offset >= 5000) throw new Error("Season history exceeds bounded player pool");
    const history = await db.from(population === "skater" ? "skatersGameStats" : "goaliesGameStats")
    .select(population === "skater"
      ? "playerId,gameId,goals,assists,shots,hits,blockedShots,pim,powerPlayGoals,powerPlayPoints,toi,powerPlayToi,games!inner(id,date,seasonId,type)"
      : "playerId,gameId,saveShotsAgainst,goalsAgainst,toi,games!inner(id,date,seasonId,type)")
    .in("playerId", playerIds)
    .in("games.seasonId", [seasonId - 10001, seasonId]).eq("games.type", 2).lt("games.date", cutoffDate)
    .order("gameId", { ascending: false }).order("playerId").range(offset, offset + 499);
    if (history.error || !Array.isArray(history.data)) throw new Error("Season history unavailable");
    historyRows.push(...history.data);
    if (history.data.length < 500) break;
  }
  const sources = await Promise.all(sourceConfigs.map(async (source) => {
    const columns = [...new Set(["player_id", "upload_batch_id", ...source.statMappings.map((m) => m.dbColumnName)])].join(",");
    const result = await db.from(source.tableName).select(columns).in("player_id", playerIds);
    return { source, rows: result.error ? [] : result.data ?? [], failed: Boolean(result.error) };
  }));
  return new Map(playerIds.map((id) => {
    const recent = buildSeasonHistory(historyRows.filter((row: any) => Number(row.playerId ?? row.goalie_id) === id), seasonId, cutoffDate, population);
    const available = sources.flatMap(({ source, rows }) => {
      const matches = rows.filter((row: any) => Number(row.player_id) === id);
      const row = matches.length === 1 ? matches[0] : null;
      const stats = row ? fantasySourcePerGame(row, source.id) : null;
      return stats ? [{ sourceId: source.id, rowId: String(row.upload_batch_id), stats }] : [];
    });
    const limitations = ["Starting weights are uncalibrated; missing categories redistribute weight among available inputs.",
      "Provider publication times are unavailable; source rows and receipt times are captured with this run."];
    if (!available.length) limitations.push("No usable current-season public fantasy projection.");
    if (recent.historyGames < SEASON_BOOTSTRAP_POLICY.historyGames) limitations.push("Fewer than 20 previous-season appearances available.");
    if (sources.some((source) => source.failed)) limitations.push("One or more public projection sources could not be read.");
    if (population === "skater") limitations.push("Missing PP goal/assist splits use the total goal/assist ratio; recent deployment still adjusts PP opportunity.");
    if (population === "goalie") limitations.push("Per-appearance save/GA rates determine a performance prior applied to today's opponent-driven shots. Relief appearances may affect it. Win/shutout priors require projected starts.");
    return [id, { ...recent, fantasy: averageBootstrapStats(available.map((row) => row.stats)),
      sourceIds: available.map((row) => row.sourceId), sourceRowIds: available.map((row) => row.rowId), limitations }];
  }));
}
