import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "lib/supabase/database-generated.types";
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

export type GamePredictionFeatureInputs = {
  game: GameRow;
  sourceAsOfDate: string;
  homeTeam: TeamRow;
  awayTeam: TeamRow;
  priorGames: GameRow[];
  teamPowerRows: TeamPowerRow[];
  standingsRows: StandingsRow[];
  wgoTeamRows: WgoTeamRow[];
  goalieStartRows: GoalieStartProjectionRow[];
  lineCombinationRows: LineCombinationRow[];
  linesCccRows: LinesCccRow[];
  goaliePerformanceRows: GoaliePerformanceRow[];
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
) {
  cutoffs.push({
    table,
    cutoff: sourceDate,
    asOfRule,
    stale:
      sourceDate == null
        ? true
        : differenceInDays(sourceAsOfDate, sourceDate) > 14,
  });
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

  collectSourceCutoff(
    sourceCutoffs,
    "team_power_ratings_daily",
    teamPowerRow?.date ?? null,
    inputs.sourceAsOfDate,
  );
  collectSourceCutoff(
    sourceCutoffs,
    "nhl_standings_details",
    standingsRow?.date ?? null,
    inputs.sourceAsOfDate,
  );
  collectSourceCutoff(
    sourceCutoffs,
    "wgo_team_stats",
    wgoRow?.date ?? null,
    inputs.sourceAsOfDate,
  );

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

  const goalie = buildGoalieBlendFeatures(inputs.goalieStartRows, team.id, {
    linesCccRows: inputs.linesCccRows,
    lineCombinationRows: inputs.lineCombinationRows,
    goaliePerformanceRows: inputs.goaliePerformanceRows,
    priorGames: inputs.priorGames,
    gameId: inputs.game.id,
  });
  if (goalie.source === "fallback") {
    missingFeatures.push(`${args.side}.goalie_start_projection`);
    fallbackFlags[`${args.side}_goalie_fallback`] = true;
  }

  const lineup = buildLineupFeatures(
    inputs.lineCombinationRows,
    team.id,
    inputs.game.id,
  );
  if (!lineup) {
    fallbackFlags[`${args.side}_lineup_omitted`] = true;
  }

  return {
    teamId: team.id,
    abbreviation: team.abbreviation,
    ...schedule,
    teamPower: buildTeamPowerFeatures(teamPowerRow, inputs.game.date),
    standings: buildStandingsFeatures(standingsRow),
    wgoTeam: buildWgoTeamFeatures(wgoRow),
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
    } as unknown as Json,
    metadata: {
      generated_by: "game-prediction-feature-builder",
      feature_set_version: payload.featureSetVersion,
      source_as_of_date: payload.sourceAsOfDate,
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
  const sourceAsOfDate = options.sourceAsOfDate ?? typedGame.date;
  const sourceAsOfEnd = `${sourceAsOfDate}T23:59:59.999Z`;
  const minPriorDate = new Date(
    Math.min(parseDateOnly(typedGame.date), parseDateOnly(sourceAsOfDate)) -
      45 * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
  const teamIds = [typedGame.homeTeamId, typedGame.awayTeamId];

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
  const sourceEligiblePriorGames = priorGames.filter(
    (priorGame) => priorGame.date < sourceAsOfDate,
  );
  const lineCombinationGameIds = Array.from(
    new Set([
      typedGame.id,
      ...sourceEligiblePriorGames.map((priorGame) => priorGame.id),
    ]),
  );

  const [
    teamsResult,
    teamPowerResult,
    standingsResult,
    wgoTeamResult,
    goalieStartResult,
    lineCombinationResult,
    linesCccResult,
    goaliePerformanceResult,
  ] = await Promise.all([
    client.from("teams").select("id,abbreviation,name").in("id", teamIds),
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
      .from("goalie_start_projections")
      .select(
        "game_id,team_id,player_id,game_date,start_probability,confirmed_status,projected_gsaa_per_60,created_at,updated_at",
      )
      .eq("game_id", gameId)
      .lte("created_at", sourceAsOfEnd),
    client
      .from("lineCombinations")
      .select("gameId,teamId,forwards,defensemen,goalies")
      .in("gameId", lineCombinationGameIds)
      .in("teamId", teamIds),
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
  ]);

  for (const result of [
    teamsResult,
    teamPowerResult,
    standingsResult,
    wgoTeamResult,
    goalieStartResult,
    lineCombinationResult,
    linesCccResult,
    goaliePerformanceResult,
  ]) {
    if (result.error) throw result.error;
  }

  const teams = (teamsResult.data ?? []) as TeamRow[];
  const homeTeam = teams.find((team) => team.id === typedGame.homeTeamId);
  const awayTeam = teams.find((team) => team.id === typedGame.awayTeamId);
  if (!homeTeam || !awayTeam) {
    throw new Error(`Missing team identity for game ${gameId}.`);
  }

  return {
    game: typedGame,
    sourceAsOfDate,
    homeTeam,
    awayTeam,
    priorGames,
    teamPowerRows: (teamPowerResult.data ?? []) as TeamPowerRow[],
    standingsRows: (standingsResult.data ?? []) as StandingsRow[],
    wgoTeamRows: (wgoTeamResult.data ?? []) as WgoTeamRow[],
    goalieStartRows: (goalieStartResult.data ??
      []) as GoalieStartProjectionRow[],
    lineCombinationRows: (lineCombinationResult.data ??
      []) as LineCombinationRow[],
    linesCccRows: (linesCccResult.data ?? []) as LinesCccRow[],
    goaliePerformanceRows: (goaliePerformanceResult.data ??
      []) as GoaliePerformanceRow[],
  };
}
