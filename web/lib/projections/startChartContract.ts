import type { TeamPowerSnapshotLike } from "lib/dashboard/teamContext";
import type { ResolvedDataServingContract } from "lib/dashboard/freshness";
import {
  START_CHART_FANTASY_SCORING_CONTRACT,
  START_CHART_RANKING_CONTRACT,
  type StartChartFantasyScoringContract,
  type StartChartPositionRanks,
  type StartChartRankingContract,
} from "lib/projections/startChartFantasyScoring";

export type StartChartSourceState = "ready" | "partial" | "missing" | "error";

export type StartChartSourceStatusEntry = {
  state: StartChartSourceState;
  affectsRanking: boolean;
  date: string | null;
  updatedAt?: string | null;
  message?: string | null;
};

export type StartChartSourceStatus = {
  overall: "ready" | "degraded";
  projection: StartChartSourceStatusEntry & {
    runId: string | null;
    modelVersion: string | null;
    inputVersion: string | null;
  };
  teamRatings: StartChartSourceStatusEntry & {
    requestedDate: string;
    resolvedDate: string | null;
  };
  ctpi: StartChartSourceStatusEntry & {
    throughDate: string | null;
    formulaVersion: string | null;
    inputVersion: string | null;
    trustedRows: number;
    untrustedRows: number;
  };
  goalies: StartChartSourceStatusEntry & {
    expectedTeams: number;
    coveredTeams: number;
    freshTeams: number;
    staleTeams: number;
  };
  ownership: StartChartSourceStatusEntry & {
    mappedPlayers: number;
    unmappedPlayers: number;
    playersWithAsOf: number;
    playersMissingAsOf: number;
    oldestAsOfDate: string | null;
    latestAsOfDate: string | null;
  };
  gamesRemaining: StartChartSourceStatusEntry;
  degradedReasons: string[];
};

export type StartChartCoverage = {
  slateGames: number;
  slateTeams: number;
  projectionRows: number;
  renderedRows: number;
  goalieTeamsExpected: number;
  goalieTeamsCovered: number;
  yahooMappedPlayers: number;
  yahooUnmappedPlayers: number;
};

export type StartChartPlayerContext = {
  es_role: string | null;
  unit_tier: string | null;
  pp_share: number | null;
  role_probability: number | null;
  role_continuity: number | null;
  opponent_defense_edge: number | null;
  goalie_goal_rate_multiplier: number | null;
  goalie_starter_certainty: number | null;
  rest_delta: number | null;
  trend_effect: string | null;
  projection_low: number | null;
  projection_high: number | null;
  flags: string[];
};

export type StartChartPlayer = {
  row_key: string;
  game_id: number;
  player_id: number;
  name: string;
  positions: string[];
  ownership: number | null;
  percent_ownership: number | null;
  ownership_as_of_date: string | null;
  opponent_team_id: number | null;
  opponent_abbrev: string | null;
  team_id: number | null;
  team_abbrev: string | null;
  proj_fantasy_points: number | null;
  proj_goals: number | null;
  proj_assists: number | null;
  proj_shots: number | null;
  proj_pp_points: number | null;
  proj_hits: number | null;
  proj_blocks: number | null;
  proj_pim: number | null;
  proj_toi_minutes: number | null;
  matchup_grade: number | null;
  start_probability: number | null;
  projected_gsaa: number | null;
  confirmed_status: boolean | null;
  games_remaining_week: number | null;
  position_ranks: StartChartPositionRanks;
  context: StartChartPlayerContext;
};

export type StartChartGoalie = {
  player_id: number;
  name: string;
  start_probability: number | null;
  projected_gsaa_per_60: number | null;
  confirmed_status: boolean | null;
  source_updated_at: string | null;
  source_confidence: "high" | "medium" | "low" | null;
  is_stale: boolean;
};

export type StartChartGame = {
  id: number;
  date: string;
  startTime: string | null;
  homeTeamId: number;
  awayTeamId: number;
  homeAbbrev: string | null;
  awayAbbrev: string | null;
  homeRating?: TeamPowerSnapshotLike;
  awayRating?: TeamPowerSnapshotLike;
  homeGoalies: StartChartGoalie[];
  awayGoalies: StartChartGoalie[];
};

export type StartChartServing = ResolvedDataServingContract & {
  mode: "exact" | "fallback" | "partial" | "no_games";
  reason: string | null;
  ageDays: number | null;
};

export type StartChartResponse = {
  dateUsed: string;
  date: string;
  resolvedDate: string;
  requestedDate: string;
  fallbackApplied: boolean;
  serving: StartChartServing;
  projectionRunId: string | null;
  projections: number;
  players: StartChartPlayer[];
  ctpi: Array<{ date: string } & Record<string, number | string | null>>;
  games: StartChartGame[];
  sourceStatus: StartChartSourceStatus;
  coverage: StartChartCoverage;
  fantasyScoringContract: StartChartFantasyScoringContract;
  rankingContract: StartChartRankingContract;
};

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === "object" ? (value as Record<string, any>) : {};

const finiteOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const stringOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

const sourceState = (value: unknown): StartChartSourceState =>
  value === "partial" || value === "missing" || value === "error"
    ? value
    : "ready";

const normalizeContext = (value: unknown): StartChartPlayerContext => {
  const row = asRecord(value);
  return {
    es_role: stringOrNull(row.es_role),
    unit_tier: stringOrNull(row.unit_tier),
    pp_share: finiteOrNull(row.pp_share),
    role_probability: finiteOrNull(row.role_probability),
    role_continuity: finiteOrNull(row.role_continuity),
    opponent_defense_edge: finiteOrNull(row.opponent_defense_edge),
    goalie_goal_rate_multiplier: finiteOrNull(row.goalie_goal_rate_multiplier),
    goalie_starter_certainty: finiteOrNull(row.goalie_starter_certainty),
    rest_delta: finiteOrNull(row.rest_delta),
    trend_effect: stringOrNull(row.trend_effect),
    projection_low: finiteOrNull(row.projection_low),
    projection_high: finiteOrNull(row.projection_high),
    flags: Array.isArray(row.flags)
      ? row.flags.filter((flag: unknown): flag is string => typeof flag === "string")
      : [],
  };
};

const normalizeSourceEntry = (value: unknown): StartChartSourceStatusEntry => {
  const row = asRecord(value);
  return {
    state: sourceState(row.state),
    affectsRanking: Boolean(row.affectsRanking),
    date: stringOrNull(row.date),
    updatedAt: stringOrNull(row.updatedAt),
    message: stringOrNull(row.message),
  };
};

export function normalizeStartChartResponse(payload: unknown): StartChartResponse {
  const root = asRecord(payload);
  const resolvedDate =
    stringOrNull(root.resolvedDate) ??
    stringOrNull(root.dateUsed) ??
    stringOrNull(root.date);
  const requestedDate = stringOrNull(root.requestedDate) ?? resolvedDate;
  if (!resolvedDate || !requestedDate) {
    throw new Error("Start Chart response is missing its requested or resolved date");
  }

  const servingRoot = asRecord(root.serving);
  const sourceRoot = asRecord(root.sourceStatus);
  const coverageRoot = asRecord(root.coverage);
  const players = (Array.isArray(root.players) ? root.players : []).flatMap(
    (value: unknown) => {
      const row = asRecord(value);
      const playerId = finiteOrNull(row.player_id);
      const gameId = finiteOrNull(row.game_id);
      if (playerId == null) return [];
      const positions = Array.isArray(row.positions)
        ? row.positions.filter((position: unknown): position is string =>
            typeof position === "string",
          )
        : [];
      return [
        {
          row_key:
            stringOrNull(row.row_key) ??
            `${gameId ?? "unknown"}:${playerId}:${stringOrNull(row.team_abbrev) ?? "unknown"}`,
          game_id: gameId ?? 0,
          player_id: playerId,
          name: stringOrNull(row.name) ?? `Player ${playerId}`,
          positions,
          ownership: finiteOrNull(row.ownership),
          percent_ownership: finiteOrNull(row.percent_ownership),
          ownership_as_of_date: stringOrNull(row.ownership_as_of_date),
          opponent_team_id: finiteOrNull(row.opponent_team_id),
          opponent_abbrev: stringOrNull(row.opponent_abbrev),
          team_id: finiteOrNull(row.team_id),
          team_abbrev: stringOrNull(row.team_abbrev),
          proj_fantasy_points: finiteOrNull(row.proj_fantasy_points),
          proj_goals: finiteOrNull(row.proj_goals),
          proj_assists: finiteOrNull(row.proj_assists),
          proj_shots: finiteOrNull(row.proj_shots),
          proj_pp_points: finiteOrNull(row.proj_pp_points),
          proj_hits: finiteOrNull(row.proj_hits),
          proj_blocks: finiteOrNull(row.proj_blocks),
          proj_pim: finiteOrNull(row.proj_pim),
          proj_toi_minutes: finiteOrNull(row.proj_toi_minutes),
          matchup_grade: finiteOrNull(row.matchup_grade),
          start_probability: finiteOrNull(row.start_probability),
          projected_gsaa: finiteOrNull(row.projected_gsaa),
          confirmed_status:
            typeof row.confirmed_status === "boolean" ? row.confirmed_status : null,
          games_remaining_week: finiteOrNull(row.games_remaining_week),
          position_ranks: asRecord(row.position_ranks) as StartChartPositionRanks,
          context: normalizeContext(row.context),
        } satisfies StartChartPlayer,
      ];
    },
  );

  const normalizeGoalies = (value: unknown): StartChartGoalie[] =>
    (Array.isArray(value) ? value : []).flatMap((goalieValue: unknown) => {
      const row = asRecord(goalieValue);
      const playerId = finiteOrNull(row.player_id);
      if (playerId == null) return [];
      const confidence = stringOrNull(row.source_confidence);
      return [
        {
          player_id: playerId,
          name: stringOrNull(row.name) ?? `Goalie ${playerId}`,
          start_probability: finiteOrNull(row.start_probability),
          projected_gsaa_per_60: finiteOrNull(row.projected_gsaa_per_60),
          confirmed_status:
            typeof row.confirmed_status === "boolean" ? row.confirmed_status : null,
          source_updated_at: stringOrNull(row.source_updated_at),
          source_confidence:
            confidence === "high" || confidence === "medium" || confidence === "low"
              ? confidence
              : null,
          is_stale: Boolean(row.is_stale),
        } satisfies StartChartGoalie,
      ];
    });

  const games = (Array.isArray(root.games) ? root.games : []).flatMap(
    (value: unknown) => {
      const row = asRecord(value);
      const id = finiteOrNull(row.id);
      const homeTeamId = finiteOrNull(row.homeTeamId);
      const awayTeamId = finiteOrNull(row.awayTeamId);
      const date = stringOrNull(row.date);
      if (id == null || homeTeamId == null || awayTeamId == null || !date) return [];
      return [
        {
          id,
          date,
          startTime: stringOrNull(row.startTime),
          homeTeamId,
          awayTeamId,
          homeAbbrev: stringOrNull(row.homeAbbrev),
          awayAbbrev: stringOrNull(row.awayAbbrev),
          homeRating: row.homeRating,
          awayRating: row.awayRating,
          homeGoalies: normalizeGoalies(row.homeGoalies),
          awayGoalies: normalizeGoalies(row.awayGoalies),
        } satisfies StartChartGame,
      ];
    },
  );

  const projectionSource = asRecord(sourceRoot.projection);
  const teamRatingSource = asRecord(sourceRoot.teamRatings);
  const ctpiSource = asRecord(sourceRoot.ctpi);
  const goalieSource = asRecord(sourceRoot.goalies);
  const ownershipSource = asRecord(sourceRoot.ownership);
  const gamesRemainingSource = asRecord(sourceRoot.gamesRemaining);
  const defaultSource = (affectsRanking: boolean): StartChartSourceStatusEntry => ({
    state: "missing",
    affectsRanking,
    date: null,
  });

  return {
    dateUsed: resolvedDate,
    date: resolvedDate,
    resolvedDate,
    requestedDate,
    fallbackApplied: Boolean(root.fallbackApplied),
    serving: {
      requestedDate,
      resolvedDate,
      fallbackApplied: Boolean(root.fallbackApplied),
      isSameDay: requestedDate === resolvedDate,
      state: servingRoot.state === "fallback" ? "fallback" : "same_day",
      strategy: servingRoot.strategy ?? "requested_date",
      gapDays: finiteOrNull(servingRoot.gapDays),
      severity:
        servingRoot.severity === "warn" || servingRoot.severity === "error"
          ? servingRoot.severity
          : "none",
      status: servingRoot.status ?? "requested_date",
      message: stringOrNull(servingRoot.message),
      requestedScheduledGames: finiteOrNull(servingRoot.requestedScheduledGames),
      resolvedScheduledGames: finiteOrNull(servingRoot.resolvedScheduledGames),
      requestedHadGames:
        typeof servingRoot.requestedHadGames === "boolean"
          ? servingRoot.requestedHadGames
          : null,
      resolvedHadGames:
        typeof servingRoot.resolvedHadGames === "boolean"
          ? servingRoot.resolvedHadGames
          : null,
      mode:
        servingRoot.mode === "fallback" ||
        servingRoot.mode === "partial" ||
        servingRoot.mode === "no_games"
          ? servingRoot.mode
          : "exact",
      reason: stringOrNull(servingRoot.reason),
      ageDays: finiteOrNull(servingRoot.ageDays ?? servingRoot.gapDays),
    },
    projectionRunId: stringOrNull(root.projectionRunId),
    projections: finiteOrNull(root.projections) ?? players.length,
    players,
    ctpi: Array.isArray(root.ctpi) ? root.ctpi : [],
    games,
    sourceStatus: {
      overall: sourceRoot.overall === "degraded" ? "degraded" : "ready",
      projection: {
        ...(Object.keys(projectionSource).length
          ? normalizeSourceEntry(projectionSource)
          : defaultSource(true)),
        runId: stringOrNull(projectionSource.runId),
        modelVersion: stringOrNull(projectionSource.modelVersion),
        inputVersion: stringOrNull(projectionSource.inputVersion),
      },
      teamRatings: {
        ...(Object.keys(teamRatingSource).length
          ? normalizeSourceEntry(teamRatingSource)
          : defaultSource(false)),
        requestedDate,
        resolvedDate: stringOrNull(teamRatingSource.resolvedDate),
      },
      ctpi: {
        ...(Object.keys(ctpiSource).length
          ? normalizeSourceEntry(ctpiSource)
          : defaultSource(false)),
        throughDate: stringOrNull(ctpiSource.throughDate),
        formulaVersion: stringOrNull(ctpiSource.formulaVersion),
        inputVersion: stringOrNull(ctpiSource.inputVersion),
        trustedRows: finiteOrNull(ctpiSource.trustedRows) ?? 0,
        untrustedRows: finiteOrNull(ctpiSource.untrustedRows) ?? 0,
      },
      goalies: {
        ...(Object.keys(goalieSource).length
          ? normalizeSourceEntry(goalieSource)
          : defaultSource(true)),
        expectedTeams: finiteOrNull(goalieSource.expectedTeams) ?? 0,
        coveredTeams: finiteOrNull(goalieSource.coveredTeams) ?? 0,
        freshTeams: finiteOrNull(goalieSource.freshTeams) ?? 0,
        staleTeams: finiteOrNull(goalieSource.staleTeams) ?? 0,
      },
      ownership: {
        ...(Object.keys(ownershipSource).length
          ? normalizeSourceEntry(ownershipSource)
          : defaultSource(false)),
        mappedPlayers: finiteOrNull(ownershipSource.mappedPlayers) ?? 0,
        unmappedPlayers: finiteOrNull(ownershipSource.unmappedPlayers) ?? 0,
        playersWithAsOf: finiteOrNull(ownershipSource.playersWithAsOf) ?? 0,
        playersMissingAsOf:
          finiteOrNull(ownershipSource.playersMissingAsOf) ?? 0,
        oldestAsOfDate: stringOrNull(ownershipSource.oldestAsOfDate),
        latestAsOfDate: stringOrNull(ownershipSource.latestAsOfDate),
      },
      gamesRemaining: Object.keys(gamesRemainingSource).length
        ? normalizeSourceEntry(gamesRemainingSource)
        : defaultSource(false),
      degradedReasons: Array.isArray(sourceRoot.degradedReasons)
        ? sourceRoot.degradedReasons.filter(
            (reason: unknown): reason is string => typeof reason === "string",
          )
        : [],
    },
    coverage: {
      slateGames: finiteOrNull(coverageRoot.slateGames) ?? games.length,
      slateTeams: finiteOrNull(coverageRoot.slateTeams) ?? games.length * 2,
      projectionRows: finiteOrNull(coverageRoot.projectionRows) ?? players.length,
      renderedRows: finiteOrNull(coverageRoot.renderedRows) ?? players.length,
      goalieTeamsExpected: finiteOrNull(coverageRoot.goalieTeamsExpected) ?? 0,
      goalieTeamsCovered: finiteOrNull(coverageRoot.goalieTeamsCovered) ?? 0,
      yahooMappedPlayers: finiteOrNull(coverageRoot.yahooMappedPlayers) ?? 0,
      yahooUnmappedPlayers: finiteOrNull(coverageRoot.yahooUnmappedPlayers) ?? 0,
    },
    fantasyScoringContract:
      (root.fantasyScoringContract as StartChartFantasyScoringContract) ??
      START_CHART_FANTASY_SCORING_CONTRACT,
    rankingContract:
      (root.rankingContract as StartChartRankingContract) ??
      START_CHART_RANKING_CONTRACT,
  };
}
