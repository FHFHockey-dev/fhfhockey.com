import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "lib/supabase/database-generated.types";
import {
  buildPredictionMetadataContract,
  buildSourceFreshnessContract,
} from "lib/predictions/contracts";
import {
  GAME_PREDICTION_FEATURE_SET_VERSION,
  getGamePredictionFeatureSources,
} from "./featureSources";

type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type GameRow = Pick<
  Tables<"games">,
  | "id"
  | "date"
  | "startTime"
  | "seasonId"
  | "homeTeamId"
  | "awayTeamId"
  | "type"
>;

export type TeamRow = Pick<Tables<"teams">, "id" | "abbreviation" | "name">;

export type TeamPowerRow = Pick<
  Tables<"team_power_ratings_daily">,
  | "team_abbreviation"
  | "date"
  | "off_rating"
  | "def_rating"
  | "goalie_rating"
  | "special_rating"
  | "pace_rating"
  | "xgf60"
  | "xga60"
  | "gf60"
  | "ga60"
  | "sf60"
  | "sa60"
>;

export type StandingsRow = Pick<
  Tables<"nhl_standings_details">,
  | "team_abbrev"
  | "date"
  | "games_played"
  | "point_pctg"
  | "win_pctg"
  | "goal_differential"
  | "l10_games_played"
  | "l10_goal_differential"
>;

export type WgoTeamRow = Pick<
  Tables<"wgo_team_stats">,
  | "team_id"
  | "date"
  | "game_id"
  | "opponent_id"
  | "goals_for_per_game"
  | "goals_against_per_game"
  | "shots_for_per_game"
  | "shots_against_per_game"
  | "power_play_pct"
  | "penalty_kill_pct"
>;

export type NstTeamGamelogRow = Pick<
  Tables<"nst_team_gamelogs_as_counts">,
  | "team_abbreviation"
  | "date"
  | "gp"
  | "wins"
  | "losses"
  | "otl"
  | "points"
  | "point_pct"
  | "gf"
  | "ga"
  | "xgf"
  | "xga"
  | "xgf_pct"
  | "sf"
  | "sa"
  | "sf_pct"
>;

export type TeamCtpiRow = Pick<
  Tables<"team_ctpi_daily">,
  | "team"
  | "date"
  | "computed_at"
  | "ctpi_0_to_100"
  | "ctpi_raw"
  | "offense"
  | "defense"
  | "goaltending"
  | "special_teams"
  | "luck"
>;

export type GoalieStartProjectionRow = Pick<
  Tables<"goalie_start_projections">,
  | "game_id"
  | "team_id"
  | "player_id"
  | "game_date"
  | "start_probability"
  | "confirmed_status"
  | "projected_gsaa_per_60"
  | "created_at"
  | "updated_at"
>;

export type LineCombinationRow = Pick<
  Tables<"lineCombinations">,
  "gameId" | "teamId" | "forwards" | "defensemen" | "goalies"
>;

export type LinesCccRow = Pick<
  Tables<"lines_ccc">,
  | "game_id"
  | "team_id"
  | "observed_at"
  | "tweet_posted_at"
  | "classification"
  | "status"
  | "nhl_filter_status"
  | "goalie_1_player_id"
  | "goalie_1_name"
  | "goalie_2_player_id"
  | "goalie_2_name"
>;

export type GoaliePerformanceRow = Pick<
  Database["public"]["Views"]["vw_goalie_stats_unified"]["Row"],
  | "player_id"
  | "team_id"
  | "date"
  | "player_name"
  | "nst_all_rates_gsaa_per_60"
  | "nst_5v5_rates_gsaa_per_60"
>;

export type ForgeGoalieGameRow = Pick<
  Tables<"forge_goalie_game">,
  | "game_id"
  | "game_date"
  | "goalie_id"
  | "team_id"
  | "shots_against"
  | "saves"
  | "goals_allowed"
  | "toi_seconds"
>;

export type WgoGoalieRow = Pick<
  Tables<"wgo_goalie_stats">,
  | "goalie_id"
  | "goalie_name"
  | "team_abbreviation"
  | "date"
  | "games_played"
  | "games_started"
  | "save_pct"
  | "shots_against_per_60"
  | "quality_start"
  | "quality_starts_pct"
  | "games_played_days_rest_0"
  | "games_played_days_rest_1"
  | "games_played_days_rest_2"
  | "games_played_days_rest_3"
  | "games_played_days_rest_4_plus"
  | "save_pct_days_rest_0"
  | "save_pct_days_rest_1"
  | "save_pct_days_rest_2"
  | "save_pct_days_rest_3"
  | "save_pct_days_rest_4_plus"
>;

export type ForgeTeamProjectionRow = Pick<
  Tables<"forge_team_projections">,
  | "run_id"
  | "game_id"
  | "team_id"
  | "horizon_games"
  | "proj_shots_es"
  | "proj_shots_pp"
  | "proj_goals_es"
  | "proj_goals_pp"
  | "updated_at"
>;

export type GamePredictionFeatureInputs = {
  game: GameRow;
  sourceAsOfDate: string;
  homeTeam: TeamRow;
  awayTeam: TeamRow;
  teamRows?: TeamRow[];
  priorGames: GameRow[];
  teamPowerRows: TeamPowerRow[];
  standingsRows: StandingsRow[];
  wgoTeamRows: WgoTeamRow[];
  nstTeamGamelogRows: NstTeamGamelogRow[];
  teamCtpiRows: TeamCtpiRow[];
  goalieStartRows: GoalieStartProjectionRow[];
  lineCombinationRows: LineCombinationRow[];
  linesCccRows: LinesCccRow[];
  goaliePerformanceRows: GoaliePerformanceRow[];
  forgeGoalieGameRows: ForgeGoalieGameRow[];
  wgoGoalieRows: WgoGoalieRow[];
  forgeTeamProjectionRows?: ForgeTeamProjectionRow[];
};

export type SourceCutoff = {
  table: string;
  cutoff: string | null;
  asOfRule: string;
  stale: boolean;
};

export type FeatureBuildWarning = {
  code: string;
  message: string;
  source?: string;
};

export type TeamSideFeatures = {
  teamId: number;
  abbreviation: string;
  daysRest: number | null;
  isBackToBack: boolean;
  gamesInLast3Days: number;
  teamPower: TeamPowerFeatures | null;
  standings: StandingsFeatures | null;
  wgoTeam: WgoTeamFeatures | null;
  recentForm: TeamRecentFormFeatures | null;
  ctpi: TeamCtpiFeatures | null;
  scheduleStrength: TeamScheduleStrengthFeatures | null;
  forgeProjection: ForgeTeamProjectionFeatures | null;
  goalie: GoalieBlendFeatures;
  lineup: LineupFeatures | null;
};

export type TeamPowerFeatures = {
  sourceDate: string;
  daysOld: number;
  offRating: number | null;
  defRating: number | null;
  goalieRating: number | null;
  specialRating: number | null;
  paceRating: number | null;
  xgf60: number | null;
  xga60: number | null;
  gf60: number | null;
  ga60: number | null;
  sf60: number | null;
  sa60: number | null;
};

export type StandingsFeatures = {
  sourceDate: string;
  gamesPlayed: number | null;
  pointPctg: number | null;
  winPctg: number | null;
  goalDifferential: number | null;
  l10GamesPlayed: number | null;
  l10GoalDifferential: number | null;
};

export type WgoTeamFeatures = {
  sourceDate: string;
  gameId: number | null;
  opponentId: number | null;
  goalsForPerGame: number | null;
  goalsAgainstPerGame: number | null;
  shotsForPerGame: number | null;
  shotsAgainstPerGame: number | null;
  powerPlayPct: number | null;
  penaltyKillPct: number | null;
};

export type TeamRecentFormFeatures = {
  sourceMaxDate: string;
  last5Games: number;
  last10Games: number;
  last5GoalDifferentialPerGame: number | null;
  last10GoalDifferentialPerGame: number | null;
  last5GoalsForPerGame: number | null;
  last10GoalsForPerGame: number | null;
  last5GoalsAgainstPerGame: number | null;
  last10GoalsAgainstPerGame: number | null;
  last5XgfPct: number | null;
  last10XgfPct: number | null;
  last5ShotShare: number | null;
  last10ShotShare: number | null;
  last5PointPct: number | null;
  last10PointPct: number | null;
};

export type TeamCtpiFeatures = {
  sourceDate: string;
  computedAt: string | null;
  ctpi0To100: number | null;
  ctpiRaw: number | null;
  offense: number | null;
  defense: number | null;
  goaltending: number | null;
  specialTeams: number | null;
  luck: number | null;
};

export type TeamScheduleStrengthFeatures = {
  sourceMaxDate: string | null;
  pastOpponentGames: number;
  pastOpponentAvgOffRating: number | null;
  pastOpponentAvgDefRating: number | null;
  pastOpponentAvgGoalieRating: number | null;
  pastOpponentAvgSpecialRating: number | null;
  pastOpponentCompositeRating: number | null;
};

export type ForgeTeamProjectionFeatures = {
  runId: string;
  updatedAt: string | null;
  projectedGoals: number | null;
  projectedShots: number | null;
};

export type GoalieBlendFeatures = {
  source:
    | "lines_ccc"
    | "goalie_start_projections"
    | "lineCombinations"
    | "recent_usage"
    | "fallback";
  confirmed: boolean;
  candidateCount: number;
  weightedProjectedGsaaPer60: number | null;
  topGoalieId: number | null;
  topGoalieName: string | null;
  topGoalieStartProbability: number | null;
  probabilityMass: number;
  context: GoalieContextFeatures | null;
};

export type GoalieContextFeatures = {
  sourceMaxDate: string | null;
  gamesPlayedLast14Days: number;
  startsLast14Days: number;
  daysSinceLastStart: number | null;
  isGoalieBackToBack: boolean;
  last5ShotsAgainstPerGame: number | null;
  last5SavePct: number | null;
  seasonGamesPlayed: number | null;
  seasonGamesStarted: number | null;
  seasonSavePct: number | null;
  seasonShotsAgainstPer60: number | null;
  qualityStarts: number | null;
  qualityStartsPct: number | null;
  restSplitGamesPlayed: Record<"rest0" | "rest1" | "rest2" | "rest3" | "rest4Plus", number | null>;
  restSplitSavePct: Record<"rest0" | "rest1" | "rest2" | "rest3" | "rest4Plus", number | null>;
};

export type LineupFeatures = {
  source: "lineCombinations";
  forwardCount: number;
  defensemanCount: number;
  goalieCount: number;
};

export type MatchupFeatures = {
  homeMinusAwayOffRating: number | null;
  homeMinusAwayDefRating: number | null;
  homeMinusAwayGoalieRating: number | null;
  homeMinusAwaySpecialRating: number | null;
  homeMinusAwayPointPctg: number | null;
  homeMinusAwayGoalDifferential: number | null;
  homeMinusAwayRecent5GoalDifferentialPerGame: number | null;
  homeMinusAwayRecent10GoalDifferentialPerGame: number | null;
  homeMinusAwayRecent5XgfPct: number | null;
  homeMinusAwayRecent10XgfPct: number | null;
  homeMinusAwayRecent10PointPct: number | null;
  homeMinusAwayCtpi: number | null;
  homeMinusAwayPastOpponentCompositeRating: number | null;
  homeMinusAwayForgeProjectedGoals: number | null;
  homeMinusAwayForgeProjectedShots: number | null;
  homeMinusAwayWeightedGoalieGsaaPer60: number | null;
  homeRestAdvantageDays: number | null;
};

export type GamePredictionFeatureSnapshotPayload = {
  featureSetVersion: string;
  gameId: number;
  seasonId: number;
  gameType: number | null;
  gameDate: string;
  startTime: string;
  sourceAsOfDate: string;
  home: TeamSideFeatures;
  away: TeamSideFeatures;
  matchup: MatchupFeatures;
  sourceCutoffs: SourceCutoff[];
  missingFeatures: string[];
  fallbackFlags: Record<string, boolean>;
  warnings: FeatureBuildWarning[];
};

type LatestDatedRow = { date: string };

function parseDateOnly(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function differenceInDays(laterDate: string, earlierDate: string): number {
  return Math.floor(
    (parseDateOnly(laterDate) - parseDateOnly(earlierDate)) / 86_400_000,
  );
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampNumber(
  value: number | string | null | undefined,
  min: number,
  max: number,
): number | null {
  const parsed = toNumber(value);
  if (parsed == null) return null;
  return Math.max(min, Math.min(max, parsed));
}

function percentishToRate(value: number | string | null | undefined): number | null {
  const parsed = toNumber(value);
  if (parsed == null) return null;
  return Math.max(0, Math.min(1, parsed > 1 ? parsed / 100 : parsed));
}

function latestBefore<T extends LatestDatedRow>(
  rows: T[],
  gameDate: string,
  predicate: (row: T) => boolean,
): T | null {
  const candidates = rows
    .filter((row) => predicate(row) && row.date < gameDate)
    .sort((a, b) => b.date.localeCompare(a.date));
  return candidates[0] ?? null;
}

function collectSourceCutoff(
  cutoffs: SourceCutoff[],
  table: string,
  sourceDate: string | null,
  sourceAsOfDate: string,
  asOfRule = "strict_before_source_as_of_date",
): SourceCutoff {
  const cutoff = {
    table,
    cutoff: sourceDate,
    asOfRule,
    stale:
      sourceDate == null
        ? true
        : differenceInDays(sourceAsOfDate, sourceDate) > 14,
  };
  cutoffs.push(cutoff);
  return cutoff;
}

function pushSourceCutoffWarning(
  warnings: FeatureBuildWarning[],
  side: "home" | "away",
  cutoff: SourceCutoff,
) {
  if (cutoff.cutoff == null) {
    warnings.push({
      code: "missing_source",
      source: cutoff.table,
      message: `${side} ${cutoff.table} source is missing; fallback or omission is active.`,
    });
    return;
  }

  if (cutoff.stale) {
    warnings.push({
      code: "stale_source",
      source: cutoff.table,
      message: `${side} ${cutoff.table} source cutoff ${cutoff.cutoff} is stale for prediction as-of date.`,
    });
  }
}

function pushSparseWarning(
  warnings: FeatureBuildWarning[],
  side: "home" | "away",
  code: string,
  source: string,
  message: string,
) {
  warnings.push({
    code,
    source,
    message: `${side} ${message}`,
  });
}

function latestDateOnly(values: Array<string | null | undefined>): string | null {
  return (
    values
      .map((value) => (typeof value === "string" ? value.slice(0, 10) : null))
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => b.localeCompare(a))[0] ?? null
  );
}

export function buildScheduleContextFeatures(args: {
  game: GameRow;
  teamId: number;
  priorGames: GameRow[];
}): Pick<TeamSideFeatures, "daysRest" | "isBackToBack" | "gamesInLast3Days"> {
  const priorTeamGames = args.priorGames
    .filter(
      (game) =>
        game.date < args.game.date &&
        (game.homeTeamId === args.teamId || game.awayTeamId === args.teamId),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const lastGame = priorTeamGames[0] ?? null;
  const daysRest = lastGame
    ? Math.max(0, differenceInDays(args.game.date, lastGame.date) - 1)
    : null;
  const gamesInLast3Days = priorTeamGames.filter(
    (game) => differenceInDays(args.game.date, game.date) <= 3,
  ).length;

  return {
    daysRest,
    isBackToBack: daysRest === 0,
    gamesInLast3Days,
  };
}

function buildTeamPowerFeatures(
  row: TeamPowerRow | null,
  gameDate: string,
): TeamPowerFeatures | null {
  if (!row) return null;
  return {
    sourceDate: row.date,
    daysOld: differenceInDays(gameDate, row.date),
    offRating: toNumber(row.off_rating),
    defRating: toNumber(row.def_rating),
    goalieRating: toNumber(row.goalie_rating),
    specialRating: toNumber(row.special_rating),
    paceRating: toNumber(row.pace_rating),
    xgf60: toNumber(row.xgf60),
    xga60: toNumber(row.xga60),
    gf60: toNumber(row.gf60),
    ga60: toNumber(row.ga60),
    sf60: toNumber(row.sf60),
    sa60: toNumber(row.sa60),
  };
}

function buildStandingsFeatures(
  row: StandingsRow | null,
): StandingsFeatures | null {
  if (!row) return null;
  return {
    sourceDate: row.date,
    gamesPlayed: toNumber(row.games_played),
    pointPctg: toNumber(row.point_pctg),
    winPctg: toNumber(row.win_pctg),
    goalDifferential: toNumber(row.goal_differential),
    l10GamesPlayed: toNumber(row.l10_games_played),
    l10GoalDifferential: toNumber(row.l10_goal_differential),
  };
}

function buildWgoTeamFeatures(row: WgoTeamRow | null): WgoTeamFeatures | null {
  if (!row) return null;
  return {
    sourceDate: row.date,
    gameId: row.game_id,
    opponentId: row.opponent_id,
    goalsForPerGame: clampNumber(row.goals_for_per_game, 0, 8),
    goalsAgainstPerGame: clampNumber(row.goals_against_per_game, 0, 8),
    shotsForPerGame: clampNumber(row.shots_for_per_game, 0, 60),
    shotsAgainstPerGame: clampNumber(row.shots_against_per_game, 0, 60),
    powerPlayPct: toNumber(row.power_play_pct),
    penaltyKillPct: toNumber(row.penalty_kill_pct),
  };
}

function sumNumbers<T>(
  rows: T[],
  selector: (row: T) => number | string | null | undefined,
): number {
  return rows.reduce((sum, row) => sum + (toNumber(selector(row)) ?? 0), 0);
}

function divideOrNull(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function shareFromCounts(
  forValue: number,
  againstValue: number,
  fallbackPct: number | string | null | undefined,
): number | null {
  const total = forValue + againstValue;
  if (total > 0) return forValue / total;
  return percentishToRate(fallbackPct);
}

function summarizeRecentTeamRows(rows: NstTeamGamelogRow[]) {
  const games = sumNumbers(rows, (row) => row.gp) || rows.length;
  const goalsFor = sumNumbers(rows, (row) => row.gf);
  const goalsAgainst = sumNumbers(rows, (row) => row.ga);
  const xgf = sumNumbers(rows, (row) => row.xgf);
  const xga = sumNumbers(rows, (row) => row.xga);
  const shotsFor = sumNumbers(rows, (row) => row.sf);
  const shotsAgainst = sumNumbers(rows, (row) => row.sa);
  const points = sumNumbers(rows, (row) => row.points);
  const hasPoints = rows.some((row) => toNumber(row.points) != null);

  return {
    games,
    goalDifferentialPerGame: divideOrNull(goalsFor - goalsAgainst, games),
    goalsForPerGame: divideOrNull(goalsFor, games),
    goalsAgainstPerGame: divideOrNull(goalsAgainst, games),
    xgfPct: shareFromCounts(xgf, xga, rows[0]?.xgf_pct),
    shotShare: shareFromCounts(shotsFor, shotsAgainst, rows[0]?.sf_pct),
    pointPct:
      hasPoints && games > 0
        ? points / (2 * games)
        : percentishToRate(rows[0]?.point_pct),
  };
}

function buildTeamRecentFormFeatures(
  rows: NstTeamGamelogRow[],
  teamAbbreviation: string,
  sourceAsOfDate: string,
): TeamRecentFormFeatures | null {
  const teamRows = rows
    .filter(
      (row) =>
        row.team_abbreviation === teamAbbreviation &&
        row.date < sourceAsOfDate,
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  if (teamRows.length === 0) return null;

  const last5 = summarizeRecentTeamRows(teamRows.slice(0, 5));
  const last10 = summarizeRecentTeamRows(teamRows.slice(0, 10));

  return {
    sourceMaxDate: teamRows[0]!.date,
    last5Games: last5.games,
    last10Games: last10.games,
    last5GoalDifferentialPerGame: last5.goalDifferentialPerGame,
    last10GoalDifferentialPerGame: last10.goalDifferentialPerGame,
    last5GoalsForPerGame: last5.goalsForPerGame,
    last10GoalsForPerGame: last10.goalsForPerGame,
    last5GoalsAgainstPerGame: last5.goalsAgainstPerGame,
    last10GoalsAgainstPerGame: last10.goalsAgainstPerGame,
    last5XgfPct: last5.xgfPct,
    last10XgfPct: last10.xgfPct,
    last5ShotShare: last5.shotShare,
    last10ShotShare: last10.shotShare,
    last5PointPct: last5.pointPct,
    last10PointPct: last10.pointPct,
  };
}

function buildTeamCtpiFeatures(row: TeamCtpiRow | null): TeamCtpiFeatures | null {
  if (!row) return null;
  return {
    sourceDate: row.date,
    computedAt: row.computed_at ?? null,
    ctpi0To100: toNumber(row.ctpi_0_to_100),
    ctpiRaw: toNumber(row.ctpi_raw),
    offense: toNumber(row.offense),
    defense: toNumber(row.defense),
    goaltending: toNumber(row.goaltending),
    specialTeams: toNumber(row.special_teams),
    luck: toNumber(row.luck),
  };
}

function averageNullable(values: Array<number | null>): number | null {
  const finiteValues = values.filter((value): value is number => value != null);
  if (finiteValues.length === 0) return null;
  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function teamPowerComposite(row: TeamPowerRow): number | null {
  return averageNullable([
    toNumber(row.off_rating),
    toNumber(row.def_rating),
    toNumber(row.goalie_rating),
    toNumber(row.special_rating),
  ]);
}

function buildTeamScheduleStrengthFeatures(args: {
  teamId: number;
  game: GameRow;
  sourceAsOfDate: string;
  priorGames: GameRow[];
  teams: TeamRow[];
  teamPowerRows: TeamPowerRow[];
}): TeamScheduleStrengthFeatures | null {
  const teamAbbreviationById = new Map(
    args.teams.map((team) => [team.id, team.abbreviation]),
  );
  const opponentRows = args.priorGames
    .filter(
      (game) =>
        game.date < args.sourceAsOfDate &&
        game.date < args.game.date &&
        (game.homeTeamId === args.teamId || game.awayTeamId === args.teamId),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
    .map((game) => {
      const opponentId =
        game.homeTeamId === args.teamId ? game.awayTeamId : game.homeTeamId;
      const opponentAbbreviation = teamAbbreviationById.get(opponentId);
      if (!opponentAbbreviation) return null;
      return latestBefore(
        args.teamPowerRows,
        args.sourceAsOfDate,
        (row) => row.team_abbreviation === opponentAbbreviation,
      );
    })
    .filter((row): row is TeamPowerRow => row != null);

  if (opponentRows.length === 0) return null;

  return {
    sourceMaxDate: latestDateOnly(opponentRows.map((row) => row.date)),
    pastOpponentGames: opponentRows.length,
    pastOpponentAvgOffRating: averageNullable(
      opponentRows.map((row) => toNumber(row.off_rating)),
    ),
    pastOpponentAvgDefRating: averageNullable(
      opponentRows.map((row) => toNumber(row.def_rating)),
    ),
    pastOpponentAvgGoalieRating: averageNullable(
      opponentRows.map((row) => toNumber(row.goalie_rating)),
    ),
    pastOpponentAvgSpecialRating: averageNullable(
      opponentRows.map((row) => toNumber(row.special_rating)),
    ),
    pastOpponentCompositeRating: averageNullable(
      opponentRows.map(teamPowerComposite),
    ),
  };
}

function buildForgeTeamProjectionFeatures(
  rows: ForgeTeamProjectionRow[] | undefined,
  gameId: number,
  teamId: number,
): ForgeTeamProjectionFeatures | null {
  const row = (rows ?? [])
    .filter(
      (candidate) =>
        candidate.game_id === gameId &&
        candidate.team_id === teamId &&
        Number(candidate.horizon_games ?? 1) === 1,
    )
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0];
  if (!row) return null;
  const goalsEs = toNumber(row.proj_goals_es);
  const goalsPp = toNumber(row.proj_goals_pp);
  const shotsEs = toNumber(row.proj_shots_es);
  const shotsPp = toNumber(row.proj_shots_pp);
  return {
    runId: row.run_id,
    updatedAt: row.updated_at ?? null,
    projectedGoals:
      goalsEs == null && goalsPp == null ? null : (goalsEs ?? 0) + (goalsPp ?? 0),
    projectedShots:
      shotsEs == null && shotsPp == null ? null : (shotsEs ?? 0) + (shotsPp ?? 0),
  };
}

export function buildGoalieBlendFeatures(
  rows: GoalieStartProjectionRow[],
  teamId: number,
  options: {
    linesCccRows?: LinesCccRow[];
    lineCombinationRows?: LineCombinationRow[];
    goaliePerformanceRows?: GoaliePerformanceRow[];
    priorGames?: GameRow[];
    gameId?: number;
  } = {},
): GoalieBlendFeatures {
  const goaliePerformanceRows = options.goaliePerformanceRows ?? [];
  const linesCccGoalie = (options.linesCccRows ?? [])
    .filter(
      (row) =>
        row.team_id === teamId &&
        row.game_id === options.gameId &&
        row.status === "observed" &&
        row.nhl_filter_status === "accepted" &&
        (row.goalie_1_player_id != null || row.goalie_1_name != null),
    )
    .sort((a, b) =>
      (b.observed_at ?? b.tweet_posted_at ?? "").localeCompare(
        a.observed_at ?? a.tweet_posted_at ?? "",
      ),
    )[0];
  if (linesCccGoalie) {
    return {
      source: "lines_ccc",
      confirmed: true,
      candidateCount:
        linesCccGoalie.goalie_2_player_id != null ||
        linesCccGoalie.goalie_2_name != null
          ? 2
          : 1,
      weightedProjectedGsaaPer60: latestGoaliePerformanceGsaa(
        goaliePerformanceRows,
        linesCccGoalie.goalie_1_player_id,
      ),
      topGoalieId: linesCccGoalie.goalie_1_player_id,
      topGoalieName: linesCccGoalie.goalie_1_name,
      topGoalieStartProbability: 1,
      probabilityMass: 1,
      context: null,
    };
  }

  const teamRows = rows.filter((row) => row.team_id === teamId);
  const confirmedRows = teamRows.filter((row) => row.confirmed_status === true);
  const usableRows = confirmedRows.length > 0 ? confirmedRows : teamRows;

  if (usableRows.length === 0) {
    const currentLineGoalie = firstGoalieIdForGameTeam(
      options.lineCombinationRows ?? [],
      options.gameId,
      teamId,
    );
    if (currentLineGoalie != null) {
      return {
        source: "lineCombinations",
        confirmed: false,
        candidateCount: 1,
        weightedProjectedGsaaPer60: latestGoaliePerformanceGsaa(
          goaliePerformanceRows,
          currentLineGoalie,
        ),
        topGoalieId: currentLineGoalie,
        topGoalieName: null,
        topGoalieStartProbability: 1,
        probabilityMass: 1,
        context: null,
      };
    }

    const recentUsageGoalie = buildRecentUsageGoalieFeatures({
      lineCombinationRows: options.lineCombinationRows ?? [],
      goaliePerformanceRows,
      priorGames: options.priorGames ?? [],
      teamId,
    });
    if (recentUsageGoalie) return recentUsageGoalie;

    return {
      source: "fallback",
      confirmed: false,
      candidateCount: 0,
      weightedProjectedGsaaPer60: null,
      topGoalieId: null,
      topGoalieName: null,
      topGoalieStartProbability: null,
      probabilityMass: 0,
      context: null,
    };
  }

  const rawWeights = usableRows.map((row) =>
    confirmedRows.length > 0
      ? 1 / confirmedRows.length
      : Math.max(0, toNumber(row.start_probability) ?? 0),
  );
  const rawTotal = rawWeights.reduce((sum, value) => sum + value, 0);
  const weights =
    rawTotal > 0
      ? rawWeights.map((value) => value / rawTotal)
      : usableRows.map(() => 1 / usableRows.length);
  const weightedGsaa = usableRows.reduce((sum, row, index) => {
    const gsaa =
      clampNumber(row.projected_gsaa_per_60, -3, 3) ??
      latestGoaliePerformanceGsaa(goaliePerformanceRows, row.player_id);
    return gsaa == null ? sum : sum + gsaa * weights[index];
  }, 0);
  const hasGsaa = usableRows.some(
    (row) =>
      toNumber(row.projected_gsaa_per_60) != null ||
      latestGoaliePerformanceGsaa(goaliePerformanceRows, row.player_id) != null,
  );
  const rankedRows = usableRows
    .map((row, index) => ({ row, weight: weights[index] }))
    .sort((a, b) => b.weight - a.weight);
  const top = rankedRows[0];

  return {
    source: "goalie_start_projections",
    confirmed: confirmedRows.length > 0,
    candidateCount: usableRows.length,
    weightedProjectedGsaaPer60: hasGsaa ? weightedGsaa : null,
    topGoalieId: top?.row.player_id ?? null,
    topGoalieName: null,
    topGoalieStartProbability: top ? top.weight : null,
    probabilityMass: rawTotal,
    context: null,
  };
}

function firstGoalieIdForGameTeam(
  rows: LineCombinationRow[],
  gameId: number | undefined,
  teamId: number,
): number | null {
  if (gameId == null) return null;
  const row = rows.find(
    (candidate) => candidate.gameId === gameId && candidate.teamId === teamId,
  );
  return row?.goalies[0] ?? null;
}

function buildRecentUsageGoalieFeatures(args: {
  lineCombinationRows: LineCombinationRow[];
  goaliePerformanceRows: GoaliePerformanceRow[];
  priorGames: GameRow[];
  teamId: number;
}): GoalieBlendFeatures | null {
  const recentStarterIds = args.priorGames
    .filter(
      (game) =>
        game.homeTeamId === args.teamId || game.awayTeamId === args.teamId,
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((game) => {
      const goalieId = firstGoalieIdForGameTeam(
        args.lineCombinationRows,
        game.id,
        args.teamId,
      );
      return goalieId == null ? [] : [goalieId];
    })
    .slice(0, 5);
  if (recentStarterIds.length === 0) return null;

  const counts = new Map<number, number>();
  for (const goalieId of recentStarterIds) {
    counts.set(goalieId, (counts.get(goalieId) ?? 0) + 1);
  }
  const [topGoalieId, topCount] = Array.from(counts.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0]!;

  return {
    source: "recent_usage",
    confirmed: false,
    candidateCount: counts.size,
    weightedProjectedGsaaPer60: latestGoaliePerformanceGsaa(
      args.goaliePerformanceRows,
      topGoalieId,
    ),
    topGoalieId,
    topGoalieName: null,
    topGoalieStartProbability: topCount / recentStarterIds.length,
    probabilityMass: 1,
    context: null,
  };
}

function buildGoalieContextFeatures(args: {
  goalieId: number | null;
  teamId: number;
  gameDate: string;
  sourceAsOfDate: string;
  forgeGoalieGameRows: ForgeGoalieGameRow[];
  wgoGoalieRows: WgoGoalieRow[];
}): GoalieContextFeatures | null {
  if (args.goalieId == null) return null;

  const forgeRows = args.forgeGoalieGameRows
    .filter(
      (row) =>
        row.goalie_id === args.goalieId &&
        row.team_id === args.teamId &&
        row.game_date < args.sourceAsOfDate &&
        row.game_date < args.gameDate,
    )
    .sort((a, b) => b.game_date.localeCompare(a.game_date));
  const recentRows = forgeRows.slice(0, 5);
  const last14Rows = forgeRows.filter(
    (row) => differenceInDays(args.gameDate, row.game_date) <= 14,
  );
  const startsLast14Days = last14Rows.filter(
    (row) => (toNumber(row.toi_seconds) ?? 0) >= 1_200,
  ).length;
  const latestStart = forgeRows.find(
    (row) => (toNumber(row.toi_seconds) ?? 0) >= 1_200,
  );
  const wgoRow = args.wgoGoalieRows
    .filter(
      (row) =>
        row.goalie_id === args.goalieId &&
        row.date < args.sourceAsOfDate &&
        row.date < args.gameDate,
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const shotsAgainst = sumNumbers(recentRows, (row) => row.shots_against);
  const saves = sumNumbers(recentRows, (row) => row.saves);

  if (forgeRows.length === 0 && !wgoRow) return null;

  return {
    sourceMaxDate: latestDateOnly([
      ...forgeRows.map((row) => row.game_date),
      wgoRow?.date,
    ]),
    gamesPlayedLast14Days: last14Rows.length,
    startsLast14Days,
    daysSinceLastStart: latestStart
      ? differenceInDays(args.gameDate, latestStart.game_date)
      : null,
    isGoalieBackToBack: latestStart
      ? differenceInDays(args.gameDate, latestStart.game_date) <= 1
      : false,
    last5ShotsAgainstPerGame: divideOrNull(shotsAgainst, recentRows.length),
    last5SavePct: divideOrNull(saves, shotsAgainst),
    seasonGamesPlayed: toNumber(wgoRow?.games_played),
    seasonGamesStarted: toNumber(wgoRow?.games_started),
    seasonSavePct: toNumber(wgoRow?.save_pct),
    seasonShotsAgainstPer60: toNumber(wgoRow?.shots_against_per_60),
    qualityStarts: toNumber(wgoRow?.quality_start),
    qualityStartsPct: percentishToRate(wgoRow?.quality_starts_pct),
    restSplitGamesPlayed: {
      rest0: toNumber(wgoRow?.games_played_days_rest_0),
      rest1: toNumber(wgoRow?.games_played_days_rest_1),
      rest2: toNumber(wgoRow?.games_played_days_rest_2),
      rest3: toNumber(wgoRow?.games_played_days_rest_3),
      rest4Plus: toNumber(wgoRow?.games_played_days_rest_4_plus),
    },
    restSplitSavePct: {
      rest0: toNumber(wgoRow?.save_pct_days_rest_0),
      rest1: toNumber(wgoRow?.save_pct_days_rest_1),
      rest2: toNumber(wgoRow?.save_pct_days_rest_2),
      rest3: toNumber(wgoRow?.save_pct_days_rest_3),
      rest4Plus: toNumber(wgoRow?.save_pct_days_rest_4_plus),
    },
  };
}

function latestGoaliePerformanceGsaa(
  rows: GoaliePerformanceRow[],
  playerId: number | null | undefined,
): number | null {
  if (playerId == null) return null;
  const row = rows
    .filter((candidate) => candidate.player_id === playerId)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
  return clampNumber(
    row?.nst_all_rates_gsaa_per_60 ?? row?.nst_5v5_rates_gsaa_per_60,
    -3,
    3,
  );
}

function buildLineupFeatures(
  rows: LineCombinationRow[],
  teamId: number,
  gameId: number,
): LineupFeatures | null {
  const row = rows.find(
    (candidate) => candidate.teamId === teamId && candidate.gameId === gameId,
  );
  if (!row) return null;
  return {
    source: "lineCombinations",
    forwardCount: row.forwards.length,
    defensemanCount: row.defensemen.length,
    goalieCount: row.goalies.length,
  };
}

function subtractNullable(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null {
  return a == null || b == null ? null : a - b;
}

export function buildMatchupFeatures(
  home: TeamSideFeatures,
  away: TeamSideFeatures,
): MatchupFeatures {
  return {
    homeMinusAwayOffRating: subtractNullable(
      home.teamPower?.offRating,
      away.teamPower?.offRating,
    ),
    homeMinusAwayDefRating: subtractNullable(
      home.teamPower?.defRating,
      away.teamPower?.defRating,
    ),
    homeMinusAwayGoalieRating: subtractNullable(
      home.teamPower?.goalieRating,
      away.teamPower?.goalieRating,
    ),
    homeMinusAwaySpecialRating: subtractNullable(
      home.teamPower?.specialRating,
      away.teamPower?.specialRating,
    ),
    homeMinusAwayPointPctg: subtractNullable(
      home.standings?.pointPctg,
      away.standings?.pointPctg,
    ),
    homeMinusAwayGoalDifferential: subtractNullable(
      home.standings?.goalDifferential,
      away.standings?.goalDifferential,
    ),
    homeMinusAwayRecent5GoalDifferentialPerGame: subtractNullable(
      home.recentForm?.last5GoalDifferentialPerGame,
      away.recentForm?.last5GoalDifferentialPerGame,
    ),
    homeMinusAwayRecent10GoalDifferentialPerGame: subtractNullable(
      home.recentForm?.last10GoalDifferentialPerGame,
      away.recentForm?.last10GoalDifferentialPerGame,
    ),
    homeMinusAwayRecent5XgfPct: subtractNullable(
      home.recentForm?.last5XgfPct,
      away.recentForm?.last5XgfPct,
    ),
    homeMinusAwayRecent10XgfPct: subtractNullable(
      home.recentForm?.last10XgfPct,
      away.recentForm?.last10XgfPct,
    ),
    homeMinusAwayRecent10PointPct: subtractNullable(
      home.recentForm?.last10PointPct,
      away.recentForm?.last10PointPct,
    ),
    homeMinusAwayCtpi: subtractNullable(
      home.ctpi?.ctpi0To100,
      away.ctpi?.ctpi0To100,
    ),
    homeMinusAwayPastOpponentCompositeRating: subtractNullable(
      home.scheduleStrength?.pastOpponentCompositeRating,
      away.scheduleStrength?.pastOpponentCompositeRating,
    ),
    homeMinusAwayForgeProjectedGoals: subtractNullable(
      home.forgeProjection?.projectedGoals,
      away.forgeProjection?.projectedGoals,
    ),
    homeMinusAwayForgeProjectedShots: subtractNullable(
      home.forgeProjection?.projectedShots,
      away.forgeProjection?.projectedShots,
    ),
    homeMinusAwayWeightedGoalieGsaaPer60: subtractNullable(
      home.goalie.weightedProjectedGsaaPer60,
      away.goalie.weightedProjectedGsaaPer60,
    ),
    homeRestAdvantageDays: subtractNullable(home.daysRest, away.daysRest),
  };
}

function buildTeamSideFeatures(args: {
  inputs: GamePredictionFeatureInputs;
  team: TeamRow;
  side: "home" | "away";
  warnings: FeatureBuildWarning[];
  missingFeatures: string[];
  fallbackFlags: Record<string, boolean>;
  sourceCutoffs: SourceCutoff[];
}): TeamSideFeatures {
  const {
    inputs,
    team,
    warnings,
    missingFeatures,
    fallbackFlags,
    sourceCutoffs,
  } = args;
  const schedule = buildScheduleContextFeatures({
    game: inputs.game,
    teamId: team.id,
    priorGames: inputs.priorGames,
  });
  const teamPowerRow = latestBefore(
    inputs.teamPowerRows,
    inputs.sourceAsOfDate,
    (row) => row.team_abbreviation === team.abbreviation,
  );
  const standingsRow = latestBefore(
    inputs.standingsRows,
    inputs.sourceAsOfDate,
    (row) => row.team_abbrev === team.abbreviation,
  );
  const wgoRow = latestBefore(
    inputs.wgoTeamRows,
    inputs.sourceAsOfDate,
    (row) => row.team_id === team.id,
  );
  const recentForm = buildTeamRecentFormFeatures(
    inputs.nstTeamGamelogRows,
    team.abbreviation,
    inputs.sourceAsOfDate,
  );
  const ctpiRow = latestBefore(
    inputs.teamCtpiRows,
    inputs.sourceAsOfDate,
    (row) => row.team === team.abbreviation,
  );
  const scheduleStrength = buildTeamScheduleStrengthFeatures({
    teamId: team.id,
    game: inputs.game,
    sourceAsOfDate: inputs.sourceAsOfDate,
    priorGames: inputs.priorGames,
    teams: [inputs.homeTeam, inputs.awayTeam, ...(inputs.teamRows ?? [])],
    teamPowerRows: inputs.teamPowerRows,
  });
  const forgeProjection = buildForgeTeamProjectionFeatures(
    inputs.forgeTeamProjectionRows,
    inputs.game.id,
    team.id,
  );

  for (const cutoff of [
    collectSourceCutoff(
      sourceCutoffs,
      "team_power_ratings_daily",
      teamPowerRow?.date ?? null,
      inputs.sourceAsOfDate,
    ),
    collectSourceCutoff(
      sourceCutoffs,
      "nhl_standings_details",
      standingsRow?.date ?? null,
      inputs.sourceAsOfDate,
    ),
    collectSourceCutoff(
      sourceCutoffs,
      "wgo_team_stats",
      wgoRow?.date ?? null,
      inputs.sourceAsOfDate,
    ),
    collectSourceCutoff(
      sourceCutoffs,
      "nst_team_gamelogs_as_counts",
      recentForm?.sourceMaxDate ?? null,
      inputs.sourceAsOfDate,
    ),
    collectSourceCutoff(
      sourceCutoffs,
      "team_ctpi_daily",
      ctpiRow?.date ?? null,
      inputs.sourceAsOfDate,
    ),
    collectSourceCutoff(
      sourceCutoffs,
      "team_power_ratings_daily",
      scheduleStrength?.sourceMaxDate ?? null,
      inputs.sourceAsOfDate,
      "strict_before_source_as_of_date_for_schedule_strength",
    ),
    collectSourceCutoff(
      sourceCutoffs,
      "forge_team_projections",
      forgeProjection?.updatedAt?.slice(0, 10) ?? null,
      inputs.sourceAsOfDate,
      "current_prediction_only",
    ),
  ]) {
    pushSourceCutoffWarning(warnings, args.side, cutoff);
  }

  if (!teamPowerRow) {
    missingFeatures.push(`${args.side}.team_power`);
    fallbackFlags[`${args.side}_team_power_fallback`] = true;
    warnings.push({
      code: "missing_team_power",
      source: "team_power_ratings_daily",
      message: `${args.side} team has no strict pregame team-power row.`,
    });
  }

  if (!standingsRow) {
    missingFeatures.push(`${args.side}.standings`);
    fallbackFlags[`${args.side}_standings_fallback`] = true;
  }

  if (!wgoRow) {
    missingFeatures.push(`${args.side}.wgo_team`);
    fallbackFlags[`${args.side}_wgo_team_fallback`] = true;
  }

  if (!recentForm) {
    missingFeatures.push(`${args.side}.recent_form`);
    fallbackFlags[`${args.side}_recent_form_fallback`] = true;
  } else if (recentForm.last10Games < 5) {
    pushSparseWarning(
      warnings,
      args.side,
      "sparse_recent_form",
      "nst_team_gamelogs_as_counts",
      `recent form has only ${recentForm.last10Games} eligible game(s).`,
    );
  }

  if (!ctpiRow) {
    missingFeatures.push(`${args.side}.ctpi`);
    fallbackFlags[`${args.side}_ctpi_fallback`] = true;
  }

  if (!scheduleStrength) {
    missingFeatures.push(`${args.side}.schedule_strength`);
    fallbackFlags[`${args.side}_schedule_strength_fallback`] = true;
  } else if (scheduleStrength.pastOpponentGames < 3) {
    pushSparseWarning(
      warnings,
      args.side,
      "sparse_schedule_strength",
      "team_power_ratings_daily",
      `schedule-strength context has only ${scheduleStrength.pastOpponentGames} prior opponent game(s).`,
    );
  }

  if (!forgeProjection) {
    fallbackFlags[`${args.side}_forge_projection_fallback`] = true;
  }

  const goalieSelection = buildGoalieBlendFeatures(inputs.goalieStartRows, team.id, {
    linesCccRows: inputs.linesCccRows,
    lineCombinationRows: inputs.lineCombinationRows,
    goaliePerformanceRows: inputs.goaliePerformanceRows,
    priorGames: inputs.priorGames,
    gameId: inputs.game.id,
  });
  const goalieContext = buildGoalieContextFeatures({
    goalieId: goalieSelection.topGoalieId,
    teamId: team.id,
    gameDate: inputs.game.date,
    sourceAsOfDate: inputs.sourceAsOfDate,
    forgeGoalieGameRows: inputs.forgeGoalieGameRows,
    wgoGoalieRows: inputs.wgoGoalieRows,
  });
  const goalie = {
    ...goalieSelection,
    context: goalieContext,
  };
  if (goalie.source === "fallback") {
    missingFeatures.push(`${args.side}.goalie_start_projection`);
    fallbackFlags[`${args.side}_goalie_fallback`] = true;
  }
  if (!goalieContext) {
    missingFeatures.push(`${args.side}.goalie_context`);
    fallbackFlags[`${args.side}_goalie_context_fallback`] = true;
  } else if (goalieContext.startsLast14Days === 0) {
    pushSparseWarning(
      warnings,
      args.side,
      "sparse_goalie_workload",
      "forge_goalie_game",
      "goalie workload context has no starts in the last 14 days.",
    );
  }
  const goalieProjectionDate = latestDateOnly(
    inputs.goalieStartRows
      .filter((row) => row.team_id === team.id && row.game_id === inputs.game.id)
      .map((row) => row.updated_at ?? row.created_at ?? row.game_date),
  );
  const acceptedTweetGoalieDate = latestDateOnly(
    inputs.linesCccRows
      .filter(
        (row) =>
          row.team_id === team.id &&
          row.game_id === inputs.game.id &&
          row.status === "observed" &&
          row.nhl_filter_status === "accepted",
      )
      .map((row) => row.observed_at ?? row.tweet_posted_at),
  );
  const recentUsageDate =
    goalie.source === "recent_usage"
      ? latestDateOnly(
          inputs.priorGames
            .filter(
              (game) =>
                game.homeTeamId === team.id || game.awayTeamId === team.id,
            )
            .map((game) => game.date),
        )
      : null;
  const goalieSourceDate =
    goalie.source === "lines_ccc"
      ? acceptedTweetGoalieDate
      : goalie.source === "goalie_start_projections"
        ? goalieProjectionDate
        : goalie.source === "recent_usage"
          ? recentUsageDate
          : goalie.source === "lineCombinations"
            ? inputs.sourceAsOfDate
            : null;
  for (const cutoff of [
    collectSourceCutoff(
      sourceCutoffs,
      goalie.source === "lines_ccc"
        ? "lines_ccc"
        : goalie.source === "lineCombinations" || goalie.source === "recent_usage"
          ? "lineCombinations"
          : "goalie_start_projections",
      goalieSourceDate,
      inputs.sourceAsOfDate,
      goalie.source === "goalie_start_projections" || goalie.source === "lines_ccc"
        ? "current_prediction_only"
        : "strict_before_source_as_of_date",
    ),
    collectSourceCutoff(
      sourceCutoffs,
      "forge_goalie_game",
      latestDateOnly(
        inputs.forgeGoalieGameRows
          .filter(
            (row) =>
              row.team_id === team.id &&
              row.goalie_id === goalie.topGoalieId &&
              row.game_date < inputs.sourceAsOfDate,
          )
          .map((row) => row.game_date),
      ),
      inputs.sourceAsOfDate,
    ),
    collectSourceCutoff(
      sourceCutoffs,
      "wgo_goalie_stats",
      latestDateOnly(
        inputs.wgoGoalieRows
          .filter(
            (row) =>
              row.goalie_id === goalie.topGoalieId &&
              row.date < inputs.sourceAsOfDate,
          )
          .map((row) => row.date),
      ),
      inputs.sourceAsOfDate,
    ),
  ]) {
    pushSourceCutoffWarning(warnings, args.side, cutoff);
  }

  const lineup = buildLineupFeatures(
    inputs.lineCombinationRows,
    team.id,
    inputs.game.id,
  );
  if (!lineup) {
    fallbackFlags[`${args.side}_lineup_omitted`] = true;
    warnings.push({
      code: "fallback_lineup_omitted",
      source: "lineCombinations",
      message: `${args.side} lineup context is omitted because no current line-combination row is available.`,
    });
  }
  pushSourceCutoffWarning(
    warnings,
    args.side,
    collectSourceCutoff(
      sourceCutoffs,
      "lineCombinations",
      lineup ? inputs.sourceAsOfDate : null,
      inputs.sourceAsOfDate,
      "current_prediction_only",
    ),
  );

  return {
    teamId: team.id,
    abbreviation: team.abbreviation,
    ...schedule,
    teamPower: buildTeamPowerFeatures(teamPowerRow, inputs.game.date),
    standings: buildStandingsFeatures(standingsRow),
    wgoTeam: buildWgoTeamFeatures(wgoRow),
    recentForm,
    ctpi: buildTeamCtpiFeatures(ctpiRow),
    scheduleStrength,
    forgeProjection,
    goalie,
    lineup,
  };
}

export function buildGamePredictionFeatureSnapshotPayload(
  inputs: GamePredictionFeatureInputs,
): GamePredictionFeatureSnapshotPayload {
  const warnings: FeatureBuildWarning[] = [];
  const missingFeatures: string[] = [];
  const fallbackFlags: Record<string, boolean> = {};
  const sourceCutoffs: SourceCutoff[] = [];
  const home = buildTeamSideFeatures({
    inputs,
    team: inputs.homeTeam,
    side: "home",
    warnings,
    missingFeatures,
    fallbackFlags,
    sourceCutoffs,
  });
  const away = buildTeamSideFeatures({
    inputs,
    team: inputs.awayTeam,
    side: "away",
    warnings,
    missingFeatures,
    fallbackFlags,
    sourceCutoffs,
  });

  return {
    featureSetVersion: GAME_PREDICTION_FEATURE_SET_VERSION,
    gameId: inputs.game.id,
    seasonId: inputs.game.seasonId,
    gameType: inputs.game.type,
    gameDate: inputs.game.date,
    startTime: inputs.game.startTime,
    sourceAsOfDate: inputs.sourceAsOfDate,
    home,
    away,
    matchup: buildMatchupFeatures(home, away),
    sourceCutoffs,
    missingFeatures,
    fallbackFlags,
    warnings,
  };
}

export function buildFeatureSnapshotInsert(args: {
  payload: GamePredictionFeatureSnapshotPayload;
  modelName: string;
  modelVersion: string;
  predictionCutoffAt: string;
}): Database["public"]["Tables"]["game_prediction_feature_snapshots"]["Insert"] {
  const { payload } = args;
  const sourceFreshness = payload.sourceCutoffs.map((cutoff) =>
    buildSourceFreshnessContract({
      source: cutoff.table,
      requestedDate: payload.sourceAsOfDate,
      sourceDate: cutoff.cutoff,
      staleThresholdDays: 14,
      currentOnly: cutoff.asOfRule === "current_prediction_only",
    }),
  );
  const predictionContract = buildPredictionMetadataContract({
    modelName: args.modelName,
    modelVersion: args.modelVersion,
    featureSetVersion: payload.featureSetVersion,
    asOfDate: payload.sourceAsOfDate,
    sourceCutoffs: sourceFreshness,
    warnings: payload.warnings,
    fallbackFlags: payload.fallbackFlags,
  });

  return {
    game_id: payload.gameId,
    snapshot_date: payload.gameDate,
    prediction_scope: "pregame",
    prediction_cutoff_at: args.predictionCutoffAt,
    model_name: args.modelName,
    model_version: args.modelVersion,
    feature_set_version: payload.featureSetVersion,
    home_team_id: payload.home.teamId,
    away_team_id: payload.away.teamId,
    source_cutoffs: payload.sourceCutoffs as unknown as Json,
    feature_payload: payload as unknown as Json,
    missing_features: payload.missingFeatures as unknown as Json,
    fallback_flags: payload.fallbackFlags as unknown as Json,
    provenance: {
      feature_sources: getGamePredictionFeatureSources(),
      warnings: payload.warnings,
      source_as_of_date: payload.sourceAsOfDate,
      source_freshness: sourceFreshness,
    } as unknown as Json,
    metadata: {
      generated_by: "game-prediction-feature-builder",
      feature_set_version: payload.featureSetVersion,
      source_as_of_date: payload.sourceAsOfDate,
      prediction_contract: predictionContract,
    },
  };
}

export async function persistGamePredictionFeatureSnapshot(
  client: SupabaseClient<Database>,
  insert: Database["public"]["Tables"]["game_prediction_feature_snapshots"]["Insert"],
): Promise<string> {
  const { data, error } = await client
    .from("game_prediction_feature_snapshots")
    .insert(insert)
    .select("feature_snapshot_id")
    .single();

  if (error) throw error;
  return data.feature_snapshot_id;
}

export async function fetchGamePredictionFeatureInputs(
  client: SupabaseClient<Database>,
  gameId: number,
  options: {
    sourceAsOfDate?: string;
  } = {},
): Promise<GamePredictionFeatureInputs> {
  const { data: game, error: gameError } = await client
    .from("games")
    .select("id,date,startTime,seasonId,homeTeamId,awayTeamId,type")
    .eq("id", gameId)
    .single();
  if (gameError) throw gameError;

  const typedGame = game as GameRow;
  const hasExplicitSourceAsOfDate = options.sourceAsOfDate != null;
  const sourceAsOfDate = options.sourceAsOfDate ?? typedGame.date;
  const sourceAsOfEnd = `${sourceAsOfDate}T23:59:59.999Z`;
  const minPriorDate = new Date(
    Math.min(parseDateOnly(typedGame.date), parseDateOnly(sourceAsOfDate)) -
      45 * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
  const teamIds = [typedGame.homeTeamId, typedGame.awayTeamId];

  const { data: teamsData, error: teamsError } = await client
    .from("teams")
    .select("id,abbreviation,name")
    .in("id", teamIds);
  if (teamsError) throw teamsError;

  const teams = (teamsData ?? []) as TeamRow[];
  const homeTeam = teams.find((team) => team.id === typedGame.homeTeamId);
  const awayTeam = teams.find((team) => team.id === typedGame.awayTeamId);
  if (!homeTeam || !awayTeam) {
    throw new Error(`Missing team identity for game ${gameId}.`);
  }
  const teamAbbreviations = [homeTeam.abbreviation, awayTeam.abbreviation];

  const { data: priorGamesData, error: priorGamesError } = await client
    .from("games")
    .select("id,date,startTime,seasonId,homeTeamId,awayTeamId,type")
    .gte("date", minPriorDate)
    .lt("date", typedGame.date)
    .or(
      `homeTeamId.in.(${teamIds.join(",")}),awayTeamId.in.(${teamIds.join(",")})`,
    );
  if (priorGamesError) throw priorGamesError;

  const priorGames = (priorGamesData ?? []) as GameRow[];
  const opponentTeamIds = Array.from(
    new Set(
      priorGames.flatMap((priorGame) => [
        priorGame.homeTeamId,
        priorGame.awayTeamId,
      ]),
    ),
  ).filter((teamId) => !teamIds.includes(teamId));
  const { data: opponentTeamsData, error: opponentTeamsError } =
    opponentTeamIds.length > 0
      ? await client
          .from("teams")
          .select("id,abbreviation,name")
          .in("id", opponentTeamIds)
      : { data: [], error: null };
  if (opponentTeamsError) throw opponentTeamsError;
  const teamRows = [
    ...teams,
    ...((opponentTeamsData ?? []) as TeamRow[]),
  ];
  const sourceEligiblePriorGames = priorGames.filter(
    (priorGame) => priorGame.date < sourceAsOfDate,
  );
  const lineCombinationGameIds = Array.from(
    new Set([
      ...(hasExplicitSourceAsOfDate ? [] : [typedGame.id]),
      ...sourceEligiblePriorGames.map((priorGame) => priorGame.id),
    ]),
  );
  const lineCombinationQuery =
    lineCombinationGameIds.length > 0
      ? client
          .from("lineCombinations")
          .select("gameId,teamId,forwards,defensemen,goalies")
          .in("gameId", lineCombinationGameIds)
          .in("teamId", teamIds)
      : Promise.resolve({ data: [], error: null });

  const [
    teamPowerResult,
    standingsResult,
    wgoTeamResult,
    nstTeamGamelogResult,
    teamCtpiResult,
    goalieStartResult,
    lineCombinationResult,
    linesCccResult,
    goaliePerformanceResult,
    forgeGoalieGameResult,
    wgoGoalieResult,
    forgeTeamProjectionResult,
  ] = await Promise.all([
    client
      .from("team_power_ratings_daily")
      .select(
        "team_abbreviation,date,off_rating,def_rating,goalie_rating,special_rating,pace_rating,xgf60,xga60,gf60,ga60,sf60,sa60",
      )
      .lt("date", sourceAsOfDate)
      .order("date", { ascending: false })
      .limit(100),
    client
      .from("nhl_standings_details")
      .select(
        "team_abbrev,date,games_played,point_pctg,win_pctg,goal_differential,l10_games_played,l10_goal_differential",
      )
      .lt("date", sourceAsOfDate)
      .order("date", { ascending: false })
      .limit(100),
    client
      .from("wgo_team_stats")
      .select(
        "team_id,date,game_id,opponent_id,goals_for_per_game,goals_against_per_game,shots_for_per_game,shots_against_per_game,power_play_pct,penalty_kill_pct",
      )
      .in("team_id", teamIds)
      .lt("date", sourceAsOfDate)
      .order("date", { ascending: false })
      .limit(100),
    client
      .from("nst_team_gamelogs_as_counts")
      .select(
        "team_abbreviation,date,gp,wins,losses,otl,points,point_pct,gf,ga,xgf,xga,xgf_pct,sf,sa,sf_pct",
      )
      .in("team_abbreviation", teamAbbreviations)
      .lt("date", sourceAsOfDate)
      .order("date", { ascending: false })
      .limit(80),
    client
      .from("team_ctpi_daily")
      .select(
        "team,date,computed_at,ctpi_0_to_100,ctpi_raw,offense,defense,goaltending,special_teams,luck",
      )
      .in("team", teamAbbreviations)
      .lt("date", sourceAsOfDate)
      .order("date", { ascending: false })
      .limit(100),
    client
      .from("goalie_start_projections")
      .select(
        "game_id,team_id,player_id,game_date,start_probability,confirmed_status,projected_gsaa_per_60,created_at,updated_at",
      )
      .eq("game_id", gameId)
      .lte("created_at", sourceAsOfEnd),
    lineCombinationQuery,
    client
      .from("lines_ccc")
      .select(
        "game_id,team_id,observed_at,tweet_posted_at,classification,status,nhl_filter_status,goalie_1_player_id,goalie_1_name,goalie_2_player_id,goalie_2_name",
      )
      .eq("game_id", gameId)
      .in("team_id", teamIds)
      .eq("status", "observed")
      .eq("nhl_filter_status", "accepted")
      .lte("observed_at", sourceAsOfEnd),
    client
      .from("vw_goalie_stats_unified")
      .select(
        "player_id,team_id,date,player_name,nst_all_rates_gsaa_per_60,nst_5v5_rates_gsaa_per_60",
      )
      .in("team_id", teamIds)
      .lt("date", sourceAsOfDate)
      .order("date", { ascending: false })
      .limit(300),
    client
      .from("forge_goalie_game")
      .select(
        "game_id,game_date,goalie_id,team_id,shots_against,saves,goals_allowed,toi_seconds",
      )
      .in("team_id", teamIds)
      .lt("game_date", sourceAsOfDate)
      .order("game_date", { ascending: false })
      .limit(300),
    client
      .from("wgo_goalie_stats")
      .select(
        "goalie_id,goalie_name,team_abbreviation,date,games_played,games_started,save_pct,shots_against_per_60,quality_start,quality_starts_pct,games_played_days_rest_0,games_played_days_rest_1,games_played_days_rest_2,games_played_days_rest_3,games_played_days_rest_4_plus,save_pct_days_rest_0,save_pct_days_rest_1,save_pct_days_rest_2,save_pct_days_rest_3,save_pct_days_rest_4_plus",
      )
      .in("team_abbreviation", teamAbbreviations)
      .lt("date", sourceAsOfDate)
      .order("date", { ascending: false })
      .limit(300),
    client
      .from("forge_team_projections")
      .select(
        "run_id,game_id,team_id,horizon_games,proj_shots_es,proj_shots_pp,proj_goals_es,proj_goals_pp,updated_at",
      )
      .eq("game_id", gameId)
      .in("team_id", teamIds)
      .eq("horizon_games", 1)
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  for (const result of [
    teamPowerResult,
    standingsResult,
    wgoTeamResult,
    nstTeamGamelogResult,
    teamCtpiResult,
    goalieStartResult,
    lineCombinationResult,
    linesCccResult,
    goaliePerformanceResult,
    forgeGoalieGameResult,
    wgoGoalieResult,
    forgeTeamProjectionResult,
  ]) {
    if (result.error) throw result.error;
  }

  return {
    game: typedGame,
    sourceAsOfDate,
    homeTeam,
    awayTeam,
    teamRows,
    priorGames,
    teamPowerRows: (teamPowerResult.data ?? []) as TeamPowerRow[],
    standingsRows: (standingsResult.data ?? []) as StandingsRow[],
    wgoTeamRows: (wgoTeamResult.data ?? []) as WgoTeamRow[],
    nstTeamGamelogRows: (nstTeamGamelogResult.data ??
      []) as NstTeamGamelogRow[],
    teamCtpiRows: (teamCtpiResult.data ?? []) as TeamCtpiRow[],
    goalieStartRows: (goalieStartResult.data ??
      []) as GoalieStartProjectionRow[],
    lineCombinationRows: (lineCombinationResult.data ??
      []) as LineCombinationRow[],
    linesCccRows: (linesCccResult.data ?? []) as LinesCccRow[],
    goaliePerformanceRows: (goaliePerformanceResult.data ??
      []) as GoaliePerformanceRow[],
    forgeGoalieGameRows: (forgeGoalieGameResult.data ??
      []) as ForgeGoalieGameRow[],
    wgoGoalieRows: (wgoGoalieResult.data ?? []) as WgoGoalieRow[],
    forgeTeamProjectionRows: (forgeTeamProjectionResult.data ??
      []) as ForgeTeamProjectionRow[],
  };
}
