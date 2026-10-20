import type { StartChartTeamForm } from "./startChartTeamForm";
import type { GameExpectationsResponse, GameExpectationTarget, GameExpectationPowerPlayRole } from "lib/player-forecasts/gameExpectations";
import { teamsInfo } from "lib/teamsInfo";
import type { TeamPowerSnapshotLike } from "lib/dashboard/teamContext";
import { normalizeBoardValidationDisclosure, type BoardValidationDisclosure } from "./starterBoardValidation";
import type { ResolvedDataServingContract } from "lib/dashboard/freshness";
import { BOARD_CATEGORIES, parseBoardScoringRequest, scoreStarterBoardPayload, type BoardForecast, type BoardScoringRequest } from "./starterBoardScoring";
import {
  START_CHART_FANTASY_SCORING_CONTRACT,
  START_CHART_RANKING_CONTRACT,
  addStartChartPositionRanks,
  type StartChartFantasyScoringContract,
  type StartChartPositionRanks,
  type StartChartRankingContract,
} from "lib/projections/startChartFantasyScoring";

export type StartChartSourceState = "ready" | "partial" | "missing" | "error";
export type StartChartExpectationBasis = "expected" | "per_appearance" | "per_start";

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

type GameExpectationParticipation = NonNullable<GameExpectationTarget["participation"]>;
/** As in the FORGE view, boards keep model labels but omit the per-target input and evidence proofs. */
export type StartChartParticipation = Omit<GameExpectationParticipation, "model"> & {
  model?: Omit<NonNullable<GameExpectationParticipation["model"]>, "inputHash" | "evidenceHashes">;
};
export type StartChartTarget = Omit<GameExpectationTarget, "participation"> & { participation: StartChartParticipation | null };

export type StartChartPlayer = {
  gameExpectation?: {
    playerId: string; scheduleRevision: string; rosterRevision: string | null;
    appearanceProbability: number | null; startProbability: number | null;
    powerPlayRole: GameExpectationPowerPlayRole;
    startParticipation?: StartChartParticipation | null;
    limitations: string[];
    targets: Record<string, StartChartTarget>;
  };
  forecast?: BoardForecast | null;
  boardScore?: { points: number | null; categoryValue: number | null; sortValue: number | null; basis: string; missingCategories: string[]; change?: number | null; comparisonAllowed?: boolean };
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
  gameExpectations?: {
    version: "forge-game-expectations-v1"; readAsOf: string;
    manifestId: string | null; baselineChecksum: string | null; expiresAt: string | null;
    basis: StartChartExpectationBasis;
  };
  recentGoals?: StartChartTeamForm;
  validation?: BoardValidationDisclosure;
  newsStatus?: { available: boolean; pendingGames: number; freshnessBreachedGames: number; unresolvedConflicts: number; oldestAcceptedAt: string | null };
  scoringProfile?: BoardScoringRequest & { id: string };
  contractVersion?: 1 | 2;
  publishedForecastsEnabled?: boolean;
  forecastAdmission?: {
    exclusionCounts: Record<string, number>;
    exclusions: Array<{ gameId: string; playerId?: string; targetKey?: string; reasons: string[] }>;
  };
  gameRevisions?: Array<{
    gameId: number; revisionId: string; runId: string;
    decisionAsOf: string; publishedAt: string;
    inputCutoff?: string | null; calculatedAt?: string | null;
    modelMode: string | null; codeVersion: string | null;
  }>;
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

function normalizeParticipationModel(value: unknown, totalsAllowed: boolean): StartChartParticipation["model"] {
  const model = asRecord(value);
  const start = model.version === "goalie-frozen-window-start-frequency-v1"
    || model.version === "goalie-roster-observation-start-frequency-v1" || model.version === "goalie-rolling-14d-start-frequency-v1";
  if (!["skater-participation-frequency-v1", "goalie-appearance-frequency-v1",
    "skater-frozen-window-appearance-frequency-v1", "goalie-frozen-window-appearance-frequency-v1",
    "goalie-frozen-window-start-frequency-v1", "skater-roster-observation-appearance-frequency-v1",
    "goalie-roster-observation-appearance-frequency-v1", "goalie-roster-observation-start-frequency-v1",
    "skater-rolling-14d-appearance-frequency-v1", "goalie-rolling-14d-appearance-frequency-v1",
    "goalie-rolling-14d-start-frequency-v1"].includes(model.version)
    || model.event !== (start ? "official_starter" : "positive_minutes")
    || model.probabilityStatus !== "uncalibrated_model" || model.calibration !== "unavailable"
    || !stringOrNull(model.inputHash)) return undefined;
  const strings = (value: unknown): string[] => Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string") : [];
  return { version: model.version, event: model.event,
    probabilityStatus: "uncalibrated_model", calibration: "unavailable", limitations: strings(model.limitations),
    sampleSize: totalsAllowed && Number.isSafeInteger(model.sampleSize) && model.sampleSize > 0 ? model.sampleSize : null };
}

function normalizeGameExpectation(value: unknown): StartChartPlayer["gameExpectation"] {
  const row = asRecord(value);
  if (!stringOrNull(row.playerId) || !stringOrNull(row.scheduleRevision)) return undefined;
  const strings = (value: unknown): string[] => Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string") : [];
  const rawStart = asRecord(row.startParticipation), startModel = normalizeParticipationModel(rawStart.model, true);
  const startProbability = finiteOrNull(rawStart.probability);
  const startParticipation: StartChartParticipation | null = startModel?.event === "official_starter"
    && rawStart.basis === "start" && stringOrNull(rawStart.revisionId) && startProbability != null
    && startProbability >= 0 && startProbability <= 1 && startProbability === finiteOrNull(row.startProbability)
    && [rawStart.cutoffAt, rawStart.issuedAt, rawStart.expiresAt].every(value => typeof value === "string" && Number.isFinite(Date.parse(value)))
    && Date.parse(rawStart.cutoffAt) <= Date.parse(rawStart.issuedAt) && Date.parse(rawStart.issuedAt) < Date.parse(rawStart.expiresAt)
    ? { revisionId: rawStart.revisionId, basis: "start", probability: startProbability, model: startModel,
      cutoffAt: rawStart.cutoffAt, issuedAt: rawStart.issuedAt, expiresAt: rawStart.expiresAt } : null;
  const role = asRecord(row.powerPlayRole);
  const roleNotApplicable = role.status === "not_applicable" && role.reason === "not_applicable"
    && role.value === null && role.source === null;
  return {
    playerId: row.playerId, scheduleRevision: row.scheduleRevision, rosterRevision: stringOrNull(row.rosterRevision),
    appearanceProbability: finiteOrNull(row.appearanceProbability),
    startProbability: row.startParticipation ? startParticipation?.probability ?? null : finiteOrNull(row.startProbability),
    powerPlayRole: { value: null, source: null,
      status: roleNotApplicable ? "not_applicable" : "unavailable",
      reason: roleNotApplicable ? "not_applicable" : "current_role_evidence_unavailable" },
    ...(startParticipation ? { startParticipation } : {}),
    limitations: strings(row.limitations),
    targets: Object.fromEntries(BOARD_CATEGORIES.filter(key => row.targets?.[key]).map(key => {
      const target = asRecord(row.targets[key]), uses = asRecord(target.allowedUses);
      const model = normalizeParticipationModel(target.participation?.model, uses.totals === true);
      return [key, {
        expected: uses.totals === true ? finiteOrNull(target.expected) : null,
        conditional: uses.conditionalTieBreak === true ? finiteOrNull(target.conditional) : null,
        basis: stringOrNull(target.basis), unit: target.unit === "minutes" ? "minutes" : "count",
        allowedUses: { assignment: uses.assignment === true, totals: uses.totals === true,
          comparison: uses.comparison === true, conditionalTieBreak: uses.conditionalTieBreak === true },
        sourceKind: stringOrNull(target.sourceKind) as GameExpectationTarget["sourceKind"],
        sourceIds: strings(target.sourceIds), methodVersions: strings(target.methodVersions),
        sourceWatermarks: strings(target.sourceWatermarks), cutoffAt: stringOrNull(target.cutoffAt),
        issuedAt: stringOrNull(target.issuedAt), expiresAt: stringOrNull(target.expiresAt),
        sources: Array.isArray(target.sources) ? target.sources.flatMap((value: unknown) => {
          const source = asRecord(value);
          if (!stringOrNull(source.sourceId) || !["baseline", "detailed"].includes(source.kind)) return [];
          return [{ sourceId: source.sourceId, kind: source.kind as "baseline" | "detailed",
            methodVersion: String(source.methodVersion ?? ""), sourceWatermark: String(source.sourceWatermark ?? ""),
            cutoffAt: String(source.cutoffAt ?? ""), issuedAt: String(source.issuedAt ?? ""), expiresAt: String(source.expiresAt ?? "") }];
        }) : [],
        participation: target.participation && ["appearance", "start"].includes(target.participation.basis)
          && stringOrNull(target.participation.revisionId)
          ? { revisionId: target.participation.revisionId, basis: target.participation.basis,
              probability: uses.totals === true ? finiteOrNull(target.participation.probability) : null,
              ...(model ? { model } : {}),
              cutoffAt: String(target.participation.cutoffAt ?? ""),
              issuedAt: String(target.participation.issuedAt ?? ""), expiresAt: String(target.participation.expiresAt ?? "") } : null,
        participationRevisionId: stringOrNull(target.participationRevisionId), reasons: strings(target.reasons),
        limitations: strings(target.limitations),
      } satisfies StartChartTarget];
    })),
  };
}

function normalizeForecastAdmission(value: unknown): StartChartResponse["forecastAdmission"] {
  const admission = asRecord(value);
  if (!Array.isArray(admission.exclusions)) return undefined;
  const isReason = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(value);
  return {
    exclusionCounts: Object.fromEntries(Object.entries(asRecord(admission.exclusionCounts))
      .filter(([reason, count]) => isReason(reason) && Number.isSafeInteger(count) && count > 0)),
    exclusions: admission.exclusions.flatMap((value: unknown) => {
      const row = asRecord(value), gameId = stringOrNull(row.gameId);
      const reasons = Array.isArray(row.reasons) ? row.reasons.filter(isReason) : [];
      if (!gameId || !reasons.length) return [];
      const playerId = stringOrNull(row.playerId), targetKey = stringOrNull(row.targetKey);
      return [{ gameId, ...(playerId ? { playerId } : {}), ...(targetKey ? { targetKey } : {}), reasons }];
    }),
  };
}

function normalizeForecast(value: unknown): BoardForecast | null {
  if (!value || typeof value !== "object") return null;
  const row = asRecord(value);
  const stats = (data: unknown) => data && typeof data === "object"
    ? Object.fromEntries(BOARD_CATEGORIES.map((key) => [key, finiteOrNull(asRecord(data)[key])])) : null;
  return {
    conditioning: row.conditioning === "conditional_playing" || row.conditioning === "unconditional" ? row.conditioning : "legacy_unclassified",
    participationProbability: finiteOrNull(row.participationProbability),
    probabilityStatus: row.probabilityStatus === "confirmed_evidence" || row.probabilityStatus === "uncalibrated_model" ? row.probabilityStatus : "missing",
    conditional: stats(row.conditional), expected: stats(row.expected), legacy: stats(row.legacy),
    previous: row.previous && stats(row.previous.stats) ? { revisionId: String(row.previous.revisionId), stats: stats(row.previous.stats)!,
      changedInputs: Array.isArray(row.previous.changedInputs) ? row.previous.changedInputs.filter((item: unknown) => typeof item === "string") : [] } : null,
    distributionStatus: "means_only_unvalidated", ppRole: stringOrNull(row.ppRole),
    seasonBootstrap: row.seasonBootstrap?.version === "season-bootstrap-v1" ? {
      version: "season-bootstrap-v1", validation: "unvalidated",
      currentSeasonGames: finiteOrNull(row.seasonBootstrap.currentSeasonGames) ?? 0,
      historyGames: finiteOrNull(row.seasonBootstrap.historyGames) ?? 0,
      transitionGames: finiteOrNull(row.seasonBootstrap.transitionGames) ?? 20,
      fantasyWeight: finiteOrNull(row.seasonBootstrap.fantasyWeight) ?? 0,
      historyWeight: finiteOrNull(row.seasonBootstrap.historyWeight) ?? 0,
      sourceIds: Array.isArray(row.seasonBootstrap.sourceIds) ? row.seasonBootstrap.sourceIds.filter((v: unknown) => typeof v === "string") : [],
      limitations: Array.isArray(row.seasonBootstrap.limitations) ? row.seasonBootstrap.limitations.filter((v: unknown) => typeof v === "string") : [],
    } : null,
    ...(row.nonStartAssumption === "zero_relief_minutes" ? { nonStartAssumption: "zero_relief_minutes" as const } : {}),
    evidence: Array.isArray(row.evidence) ? row.evidence.map((item: any) => ({
      dimension: String(item.dimension ?? ""), value: String(item.value ?? ""),
      publishedAt: String(item.publishedAt ?? ""), receivedAt: String(item.receivedAt ?? ""),
    })) : [],
    conflicts: Array.isArray(row.conflicts) ? row.conflicts.filter((item: unknown) => typeof item === "string") : [],
  };
}

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

/** One comparison basis for the whole board; missing heads never borrow from another basis. */
export function selectStartChartExpectationBasis<T extends StartChartResponse>(response: T, basis: StartChartExpectationBasis): T {
  if (!response.gameExpectations) return response;
  return { ...response, gameExpectations: { ...response.gameExpectations, basis },
    players: response.players.map(player => {
      const targets = player.gameExpectation?.targets ?? {};
      const stats = Object.fromEntries(BOARD_CATEGORIES.map(key => {
        const target = targets[key];
        const permitted = basis === "expected" ? target?.allowedUses.totals && target.allowedUses.comparison
          : target?.allowedUses.conditionalTieBreak && target.basis === basis;
        return [key, permitted ? target?.[basis === "expected" ? "expected" : "conditional"] ?? null : null];
      }));
      return { ...player, proj_goals: stats.GOALS, proj_assists: stats.ASSISTS, proj_shots: stats.SHOTS_ON_GOAL,
        proj_pp_points: stats.PP_POINTS, proj_hits: stats.HITS, proj_blocks: stats.BLOCKED_SHOTS,
        proj_pim: stats.PENALTY_MINUTES, proj_toi_minutes: stats.TIME_ON_ICE_PER_GAME,
        forecast: { participationProbability: null, probabilityStatus: "missing", distributionStatus: "means_only_unvalidated",
          evidence: [], conflicts: [], ...player.forecast, expected: basis === "expected" ? stats : null,
          ...(basis !== "expected" ? { participationProbability: basis === "per_start" ? player.gameExpectation?.startProbability ?? null
            : player.gameExpectation?.appearanceProbability ?? null } : {}),
          conditional: basis !== "expected" ? stats : null,
          conditioning: basis === "expected" ? "unconditional" : "conditional_playing" } };
    }) };
}

/** Conditional ability may be displayed without granting permission for a primary comparison. */
export function scoreStartChartPayload<T extends StartChartResponse>(response: T, request: BoardScoringRequest) {
  const scored = scoreStarterBoardPayload(response, request);
  if (!response.gameExpectations) return scored;
  const players = scored.players.map(player => {
    const targets = player.gameExpectation?.targets ?? {};
    const goalie = player.positions.includes("G");
    const keys = request.mode === "categories" ? [request.category!]
      : Object.entries(request.profile[goalie ? "goalie" : "skater"]).filter(([, weight]) => weight !== 0).map(([key]) => key);
    const comparisonAllowed = goalie && request.mode !== "categories" && request.goalieSort === "start_probability"
      ? Object.values(targets).some(target => target.allowedUses.comparison && target.participation?.basis === "start"
          && target.participationRevisionId === target.participation.revisionId
          && target.participation.probability === player.start_probability)
      : keys.length > 0 && keys.every(key => targets[key]?.allowedUses.comparison === true);
    return { ...player, boardScore: { ...player.boardScore, comparisonAllowed,
      sortValue: comparisonAllowed ? player.boardScore?.sortValue ?? null : null } };
  });
  return { ...scored, players: addStartChartPositionRanks(players, player => player.boardScore.sortValue) };
}

/** Daily view of the same admitted per-game values shown by FORGE. No participation integration happens here. */
export function startChartFromGameExpectations(response: GameExpectationsResponse): StartChartResponse {
  const date = response.scope.startDate;
  const games = new Map<number, StartChartGame>();
  const players: unknown[] = [];
  const expiries: string[] = [];
  // Scheduled games this board cannot place (unknown team or identity) stay visible as a coverage gap.
  const unmappedGameIds = new Set<string>();
  let coveredRows = 0;
  for (const player of response.players) for (const game of player.games) {
    if (game.date !== date) continue;
    const gameId = Number(game.gameId);
    const home = teamsInfo[game.homeTeam], away = teamsInfo[game.awayTeam];
    if (!Number.isSafeInteger(gameId) || gameId <= 0 || !home || !away
      || (game.team !== game.homeTeam && game.team !== game.awayTeam)) {
      unmappedGameIds.add(game.gameId);
      continue;
    }
    if (!games.has(gameId)) games.set(gameId, { id: gameId, date, startTime: game.scheduledAt,
      homeTeamId: home.id, awayTeamId: away.id, homeAbbrev: home.abbrev, awayAbbrev: away.abbrev,
      homeGoalies: [], awayGoalies: [] });
    if (!Number.isSafeInteger(player.nhlPlayerId) || player.nhlPlayerId! <= 0) continue;
    const stats = (basis: "expected" | "conditional") => Object.fromEntries(BOARD_CATEGORIES.map(key => {
      const target = game.targets[key];
      const permitted = basis === "expected" ? target?.allowedUses.totals && target.allowedUses.comparison
        : target?.allowedUses.conditionalTieBreak;
      return [key, permitted ? target?.[basis] ?? null : null];
    }));
    const expectedStats = stats("expected"), conditionalStats = stats("conditional");
    const expected = Object.values(expectedStats).some(value => value != null) ? expectedStats : null;
    const conditional = Object.values(conditionalStats).some(value => value != null) ? conditionalStats : null;
    // Never fill a missing expected head with a per-appearance/start value.
    const displayed = expected ?? conditional ?? {};
    if (expected || conditional) coveredRows++;
    for (const target of Object.values(game.targets)) {
      // Probability-only rows also depend on these receipts, even when a head cannot be compared.
      if (target.expiresAt) expiries.push(target.expiresAt);
      if (target.participation?.expiresAt) expiries.push(target.participation.expiresAt);
      for (const source of target.sources) expiries.push(source.expiresAt);
    }
    expiries.push(game.scheduledAt);
    if (game.startParticipation?.expiresAt) expiries.push(game.startParticipation.expiresAt);
    const goalie = player.playerClass === "goalie";
    const probability = goalie ? game.startProbability : game.appearanceProbability;
    if (!expected && !conditional && probability == null) continue;
    const team = game.team === game.homeTeam ? home : away;
    const opponent = game.team === game.homeTeam ? away : home;
    if (goalie) games.get(gameId)![game.team === game.homeTeam ? "homeGoalies" : "awayGoalies"].push({
      player_id: player.nhlPlayerId!, name: player.name, start_probability: probability,
      projected_gsaa_per_60: null, confirmed_status: null, source_updated_at: null, source_confidence: null, is_stale: false,
    });
    players.push({ row_key: `game-expectations:${game.gameId}:${player.playerId}`, game_id: gameId,
      player_id: player.nhlPlayerId, name: player.name, positions: goalie ? ["G"] : player.positions,
      team_id: team.id, team_abbrev: team.abbrev, opponent_team_id: opponent.id, opponent_abbrev: opponent.abbrev,
      proj_goals: displayed.GOALS, proj_assists: displayed.ASSISTS, proj_shots: displayed.SHOTS_ON_GOAL,
      proj_pp_points: displayed.PP_POINTS, proj_hits: displayed.HITS, proj_blocks: displayed.BLOCKED_SHOTS,
      proj_pim: displayed.PENALTY_MINUTES, proj_toi_minutes: displayed.TIME_ON_ICE_PER_GAME,
      start_probability: goalie ? probability : null,
      forecast: { expected, conditional, conditioning: expected ? "unconditional" : "conditional_playing",
        participationProbability: probability,
        // This public view has no original confirmed/model classification.
        probabilityStatus: "missing" },
      gameExpectation: { playerId: player.playerId, scheduleRevision: game.scheduleRevision,
        rosterRevision: game.rosterRevision, appearanceProbability: game.appearanceProbability, startProbability: game.startProbability,
        powerPlayRole: game.powerPlayRole,
        ...(game.startParticipation ? { startParticipation: game.startParticipation } : {}),
        limitations: game.limitations, targets: game.targets },
    });
  }
  expiries.sort((a, b) => Date.parse(a) - Date.parse(b));
  const board = normalizeStartChartResponse({ date, requestedDate: date, resolvedDate: date, contractVersion: 2,
    projectionRunId: null, gameRevisions: [], players, games: [...games.values()],
    gameExpectations: { version: response.version, readAsOf: response.readAsOf,
      manifestId: response.manifestId, baselineChecksum: response.baselineChecksum, expiresAt: expiries[0] ?? null,
      basis: "expected" },
    serving: { mode: games.size || unmappedGameIds.size ? "partial" : "no_games",
      reason: games.size ? "game_expectation_coverage" : unmappedGameIds.size ? "unmapped_slate_teams" : "no_upcoming_games_on_selected_date",
      message: [games.size ? "Daily values use admitted game expectations. Missing heads or participation remain unavailable."
        : unmappedGameIds.size ? "" : `No upcoming scheduled games are available for ${date}.`,
      unmappedGameIds.size ? `${unmappedGameIds.size} scheduled game(s) are omitted because a team could not be identified.` : ""]
        .filter(Boolean).join(" ") },
    sourceStatus: { overall: "degraded", projection: { state: coveredRows ? "partial" : "missing", affectsRanking: true,
      date, updatedAt: null, message: "Read time is separate from original issuance. Conditional values are not expected game totals." },
      degradedReasons: [coveredRows ? "partial_game_expectation_coverage" : "missing_projection",
        ...(unmappedGameIds.size ? ["unmapped_slate_team"] : [])] },
    coverage: { slateGames: games.size, slateTeams: games.size * 2, projectionRows: coveredRows, renderedRows: players.length },
  });
  return selectStartChartExpectationBasis(board,
    board.players.some(player => Object.values(player.forecast?.expected ?? {}).some(value => value != null)) ? "expected"
      : board.players.some(player => Object.values(player.gameExpectation?.targets ?? {}).some(target => target.conditional != null && target.basis === "per_appearance"))
        ? "per_appearance" : "per_start");
}

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
          forecast: normalizeForecast(row.forecast),
          gameExpectation: normalizeGameExpectation(row.gameExpectation),
          ...(row.boardScore ? { boardScore: {
            points: finiteOrNull(row.boardScore.points), categoryValue: finiteOrNull(row.boardScore.categoryValue),
            change: finiteOrNull(row.boardScore.change),
            sortValue: finiteOrNull(row.boardScore.sortValue), basis: String(row.boardScore.basis ?? "legacy_unclassified"),
            missingCategories: Array.isArray(row.boardScore.missingCategories) ? row.boardScore.missingCategories.filter((item: unknown) => typeof item === "string") : [],
            ...(typeof row.boardScore.comparisonAllowed === "boolean" ? { comparisonAllowed: row.boardScore.comparisonAllowed } : {}),
          } } : {}),
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
  let scoringProfile: StartChartResponse["scoringProfile"];
  if (root.scoringProfile) {
    try {
      const request = parseBoardScoringRequest(root.scoringProfile);
      scoringProfile = { ...request, id: JSON.stringify([Object.entries(request.profile.skater).sort(), Object.entries(request.profile.goalie).sort()]) };
    } catch { /* Invalid optional profiles cannot change the normalized forecasts. */ }
  }

  return {
    gameExpectations: root.gameExpectations?.version === "forge-game-expectations-v1" && stringOrNull(root.gameExpectations.readAsOf)
      ? { version: "forge-game-expectations-v1", readAsOf: root.gameExpectations.readAsOf,
          manifestId: stringOrNull(root.gameExpectations.manifestId), baselineChecksum: stringOrNull(root.gameExpectations.baselineChecksum),
          expiresAt: stringOrNull(root.gameExpectations.expiresAt),
          basis: root.gameExpectations.basis === "per_appearance" || root.gameExpectations.basis === "per_start" ? root.gameExpectations.basis : "expected" } : undefined,
    scoringProfile,
    validation: normalizeBoardValidationDisclosure(root.validation),
    dateUsed: resolvedDate,
    contractVersion: root.contractVersion === 2 ? 2 : 1,
    publishedForecastsEnabled: typeof root.publishedForecastsEnabled === "boolean" ? root.publishedForecastsEnabled : undefined,
    forecastAdmission: normalizeForecastAdmission(root.forecastAdmission),
    newsStatus: root.newsStatus ? { available: root.newsStatus.available === true,
      pendingGames: finiteOrNull(root.newsStatus.pendingGames) ?? 0,
      freshnessBreachedGames: finiteOrNull(root.newsStatus.freshnessBreachedGames) ?? 0,
      unresolvedConflicts: finiteOrNull(root.newsStatus.unresolvedConflicts) ?? 0,
      oldestAcceptedAt: stringOrNull(root.newsStatus.oldestAcceptedAt) } : undefined,
    gameRevisions: Array.isArray(root.gameRevisions) ? root.gameRevisions.flatMap((value: unknown) => {
      const row = asRecord(value);
      if (!finiteOrNull(row.gameId) || !stringOrNull(row.revisionId) || !stringOrNull(row.runId)
        || !stringOrNull(row.decisionAsOf) || !stringOrNull(row.publishedAt)) return [];
      return [{ gameId: Number(row.gameId), revisionId: row.revisionId, runId: row.runId,
        decisionAsOf: row.decisionAsOf, publishedAt: row.publishedAt,
        inputCutoff: stringOrNull(row.inputCutoff), calculatedAt: stringOrNull(row.calculatedAt),
        modelMode: stringOrNull(row.modelMode), codeVersion: stringOrNull(row.codeVersion) }];
    }) : [],
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
    recentGoals: root.recentGoals?.source === "nhl_final_scores" && root.recentGoals.beforeDate === resolvedDate && Number.isSafeInteger(root.recentGoals.seasonId) && Array.isArray(root.recentGoals.teams)
      ? { seasonId: root.recentGoals.seasonId, beforeDate: resolvedDate, source: "nhl_final_scores",
          teams: root.recentGoals.teams.flatMap((row: any) => typeof row.team === "string" && Array.isArray(row.games) ? [{ team: row.team,
            games: row.games.filter((game: any) => typeof game.date === "string" && game.date < resolvedDate && Number.isInteger(game.goalsFor) && game.goalsFor >= 0 && Number.isInteger(game.goalsAgainst) && game.goalsAgainst >= 0).slice(0, 10) }] : []) }
      : undefined,
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
