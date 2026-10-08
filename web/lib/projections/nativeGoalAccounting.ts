import { boardSkaterForecast, skaterParticipationFromEvidence } from "./starterBoardScoring";
import type { DailyBoardEvidence } from "./dailyBoardEvidence";

/** The current native producer has two reported buckets, not a full-play estimator. */
export type NativeSkaterGoalRow = {
  player_id: number;
  game_id: number;
  team_id: number;
  as_of_date: string;
  horizon_games: number;
  proj_goals_es: number;
  proj_goals_pp: number;
  proj_goals_pk: null;
  uncertainty?: {
    model?: {
      skater_selection?: {
        production_conditioning?: string;
        participation_reason?: string | null;
        participation?: unknown;
        same_day_evidence?: unknown;
        season_bootstrap?: { fantasyWeight: number; historyWeight: number } | null;
      };
    };
  };
};

/** The producer maps scoped evidence, never roster membership or role weights, to pPlayed. */
export function buildNativeSkaterParticipationFields(args: {
  gameId: number; teamId: number; playerId: number; compute: boolean; evidence?: DailyBoardEvidence;
}) {
  const assertions = args.evidence?.assertions.filter(item => item.gameId === args.gameId
    && item.teamId === args.teamId && item.playerId === args.playerId) ?? [];
  const conflicts = args.evidence?.conflicts.filter(item => item.gameId === args.gameId && item.teamId === args.teamId
    && (item.playerId === null || item.playerId === args.playerId)) ?? [];
  const participation = args.compute ? skaterParticipationFromEvidence(args.evidence, args) : null;
  const reason = participation ? null : !args.compute ? "legacy_availability_is_not_participation"
    : !args.evidence ? "participation_evidence_not_loaded"
      : conflicts.some(item => ["ev", "availability"].includes(item.dimension)) ? "conflicting_participation_evidence"
        : assertions.some(item => item.confirmed && item.dimension === "ev")
          && assertions.some(item => item.confirmed && item.dimension === "availability" && item.value === "out") ? "conflicting_participation_assertions"
          : !assertions.length ? "missing_same_day_participation_evidence" : "missing_confirmed_participation_evidence";
  return { production_conditioning: args.compute ? "conditional_playing" : "legacy_availability_adjusted",
    participation_probability: participation?.probability ?? null, participation, participation_reason: reason,
    same_day_evidence: args.evidence ? { assertions, conflicts } : null };
}

/** A fresh confirmed EV assignment can add a current member omitted by historical lines.
 * Rates still pass the existing metadata/recency gates. PP/return/roster-only news cannot add an appearance.
 */
export function selectConfirmedNativeSkaterCandidates(args: {
  gameId: number; teamId: number; candidatePlayerIds: readonly number[]; currentRosterPlayerIds: readonly number[];
  evidence?: DailyBoardEvidence;
}) {
  const confirmed = args.currentRosterPlayerIds.filter(playerId => args.evidence?.assertions.some(item => item.gameId === args.gameId
    && item.teamId === args.teamId && item.playerId === playerId && item.dimension === "ev" && item.confirmed)
    && skaterParticipationFromEvidence(args.evidence, { ...args, playerId })?.probability === 1);
  return [...new Set([...args.candidatePlayerIds, ...confirmed])].filter(id => Number.isSafeInteger(id) && id > 0);
}

export type NativeRosterSelection = {
  candidatePlayerIds: readonly number[]; eligiblePlayerIds: readonly number[]; unavailablePlayerIds: readonly number[];
  knownGoaliePlayerIds: readonly number[];
  playerMetaById: ReadonlyMap<number, { team_id: number | null; position: string | null }>;
  excludedPlayerIds: { teamOrPosition: readonly number[]; missingRecentMetrics: readonly number[];
    hardStale: readonly number[]; invalidSeasonEvidence: readonly number[] };
  compute: boolean; evidence?: DailyBoardEvidence;
};

/** Additional selection provenance stays separate from serialized goal reconciliation. */
export function buildNativeRosterContributorCoverage(args: {
  gameId: number; teamId: number; currentRosterPlayerIds: readonly number[]; projectedPlayerIds: readonly number[]; selection: NativeRosterSelection;
}) {
  const selection = args.selection;
  if (![args.gameId, args.teamId, ...args.currentRosterPlayerIds, ...args.projectedPlayerIds].every(id => Number.isSafeInteger(id) && id > 0)
    || new Set(args.currentRosterPlayerIds).size !== args.currentRosterPlayerIds.length
    || new Set(args.projectedPlayerIds).size !== args.projectedPlayerIds.length) throw new Error("Invalid native roster contributor identity");
  if (args.projectedPlayerIds.some(id => selection.knownGoaliePlayerIds.includes(id))) throw new Error("A native skater contributor is identified as a goalie");
  const contributors = args.currentRosterPlayerIds.map(playerId => {
    const projected = args.projectedPlayerIds.includes(playerId), goalie = selection.knownGoaliePlayerIds.includes(playerId);
    const meta = selection.playerMetaById.get(playerId);
    const population = goalie ? "goalie" : projected || meta?.team_id === args.teamId && meta.position != null && meta.position !== "G" ? "skater" : "position_unverified";
    const reason = projected ? "projected_partial_skater" : goalie ? "outside_skater_estimator"
      : !selection.candidatePlayerIds.includes(playerId) ? "outside_candidate_pool"
        : selection.unavailablePlayerIds.includes(playerId) ? "unavailable_by_producer_gate"
          : selection.excludedPlayerIds.teamOrPosition.includes(playerId) ? "team_or_position_filtered"
            : selection.excludedPlayerIds.missingRecentMetrics.includes(playerId) ? "missing_rate_history"
              : selection.excludedPlayerIds.hardStale.includes(playerId) ? "hard_stale_rate_history"
                : selection.excludedPlayerIds.invalidSeasonEvidence.includes(playerId) ? "invalid_rate_recency_source"
                  : selection.eligiblePlayerIds.includes(playerId) ? "eligible_skater_not_projected" : "unclassified_producer_omission";
    const participation = goalie ? null : buildNativeSkaterParticipationFields({ gameId: args.gameId, teamId: args.teamId, playerId,
      compute: selection.compute, evidence: selection.evidence });
    return { playerId, population, selectionReason: reason, rateEligibility: goalie ? "outside_skater_estimator"
      : selection.eligiblePlayerIds.includes(playerId) ? "passed" : selection.candidatePlayerIds.includes(playerId) ? "failed" : "not_evaluated",
      participationProbabilityGivenGamePlayed: participation?.participation_probability ?? null,
      participationReason: goalie ? "goalie_appearance_and_offensive_credit_unproved" : participation?.participation_reason ?? null,
      goalContributionStatus: projected ? "modeled_partial" : participation?.participation_probability === 0 ? "confirmed_out_given_game_played" : "unknown",
      fullOfficialPlayMean: null };
  });
  return { version: "native-roster-contributor-coverage-v1", contributors,
    unmodeledGoaliePlayerIds: contributors.filter(row => row.population === "goalie").map(row => row.playerId),
    unevaluatedRosterPlayerIds: contributors.filter(row => row.selectionReason === "outside_candidate_pool").map(row => row.playerId),
    eligibleUnprojectedSkaterPlayerIds: contributors.filter(row => row.selectionReason === "eligible_skater_not_projected").map(row => row.playerId),
    unknownResidualPlayerIds: contributors.filter(row => row.goalContributionStatus === "unknown").map(row => row.playerId),
    residualMean: null };
}

const endpointGaps = [
  "missing_native_pk_goal_estimator",
  "unproved_regulation_strength_partition",
  "unproved_overtime_accounting",
  "unproved_empty_net_accounting",
  "unproved_shootout_exclusion",
  "unknown_game_occurrence_probability",
  "unproved_information_cutoff",
] as const;

function reportedMean(value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0
    || value !== Number(value.toFixed(3))) {
    throw new Error("Native reported goals must be finite, nonnegative and serialized to three decimals");
  }
  return value;
}

function sumReportedMeans(values: number[]): number {
  const sum = values.reduce((total, value) => total + reportedMean(value), 0);
  if (!Number.isFinite(sum)) throw new Error("Native reported goal sum overflow");
  return Number(sum.toFixed(3));
}

function assertScope(scope: { game_id: number; team_id: number; horizon_games: number; as_of_date: string }) {
  if (![scope.game_id, scope.team_id, scope.horizon_games].every(value => Number.isSafeInteger(value) && value > 0)
    || !/^\d{4}-\d{2}-\d{2}$/.test(scope.as_of_date) || !Number.isFinite(Date.parse(scope.as_of_date))
    || new Date(scope.as_of_date).toISOString().slice(0, 10) !== scope.as_of_date) {
    throw new Error("Invalid native goal accounting scope");
  }
}

function endpointDisclosure(asOfDate: string, horizonGames: number) {
  return {
    version: "forge-native-goal-accounting-v1" as const,
    unit: "expected_goal_count" as const,
    scope: horizonGames === 1 ? "one_game" as const : "scaled_horizon" as const,
    // The buckets do not resolve period/goalie presence. These amounts may overlap
    // their reported ES/PP contents; they must never be added to those contents.
    ordinaryRegulation: { esMean: null, ppMean: null, pkMean: null },
    overtimeMean: null,
    emptyNetMean: null,
    shootoutExclusion: "unproved" as const,
    gameOccurrenceProbability: null,
    fullOfficialPlayMean: null,
    unconditionalMean: null,
    fullGameEligible: false as const,
    rollingHistoryGameDateBefore: asOfDate,
    informationCutoffAt: null,
  };
}

/** Integrate only the existing confirmed 0/1 evidence branch, once, for one game.
 * This is given the game is played; native production supplies no pGamePlayed.
 * Legacy availability multipliers and a sum of horizon scalars are not that branch.
 */
export function buildNativePlayerGoalAccounting(row: NativeSkaterGoalRow) {
  assertScope(row);
  if (!Number.isSafeInteger(row.player_id) || row.player_id <= 0 || row.proj_goals_pk !== null) {
    throw new Error("Invalid native player goal identity or unsupported PK output");
  }
  const reportedEsPpMean = sumReportedMeans([row.proj_goals_es, row.proj_goals_pp]);
  const selection = row.uncertainty?.model?.skater_selection;
  // Only EV/availability conflicts affect skater appearance, matching the evidence helper.
  // Keep the complete conflicts in the stored selection; scope only this participation calculation.
  const sameDay = selection?.same_day_evidence as { conflicts?: Array<{ dimension?: string }> } | undefined;
  const uncertainty = sameDay ? { ...row.uncertainty, model: { ...row.uncertainty?.model, skater_selection: {
    ...selection, same_day_evidence: { ...sameDay, conflicts: sameDay.conflicts?.filter(item => ["ev", "availability"].includes(item.dimension ?? "")) },
  } } } : row.uncertainty;
  const forecast = boardSkaterForecast({ proj_goals: reportedEsPpMean }, uncertainty);
  const conditional = selection?.production_conditioning === "conditional_playing";
  const oneGame = row.horizon_games === 1;
  const bootstrap = selection?.season_bootstrap;
  const bootstrapBlend = Boolean(bootstrap && (bootstrap.fantasyWeight > 0 || bootstrap.historyWeight > 0));
  const reasons: string[] = [...endpointGaps];
  if (!oneGame) reasons.push("scaled_horizon_is_not_a_player_game");
  if (!conditional) reasons.push("legacy_availability_is_not_participation");
  if (forecast.participationProbability === null) reasons.push("unknown_participation");
  if (bootstrapBlend) reasons.push("bootstrap_all_strength_minus_pp_is_not_regulation_es");
  return {
    ...endpointDisclosure(row.as_of_date, row.horizon_games),
    playerId: row.player_id,
    identityNamespace: "native_projection_player_id" as const,
    gameId: row.game_id,
    teamId: row.team_id,
    horizonGames: row.horizon_games,
    reportedComponents: { esMean: row.proj_goals_es, ppMean: row.proj_goals_pp, pkMean: null },
    reportedBasis: conditional ? "conditional_playing" as const : "legacy_unclassified" as const,
    esBucketDefinition: bootstrapBlend ? "bootstrap_all_strength_minus_pp_blend" as const : "native_ev_rate_on_reconciled_shots" as const,
    reportedEsPpMean,
    conditionalEsPpMean: oneGame && conditional ? reportedEsPpMean : null,
    participationProbabilityGivenGamePlayed: oneGame ? forecast.participationProbability : null,
    participationReason: !oneGame ? "scaled_horizon_is_not_a_player_game"
      : forecast.participationProbability === null ? selection?.participation_reason ?? "unknown_participation" : null,
    expectedEsPpMeanGivenGamePlayed: oneGame ? forecast.expected?.GOALS ?? null : null,
    reasons,
  };
}

/** Reconcile the serialized contributor rows, never a separately rounded raw sum.
 * A sum of individual conditional means is not a joint team conditional mean.
 */
export function buildNativeTeamGoalAccounting(args: {
  gameId: number;
  teamId: number;
  asOfDate: string;
  horizonGames: number;
  currentRosterPlayerIds: readonly number[];
  playerRows: readonly NativeSkaterGoalRow[];
}) {
  assertScope({ game_id: args.gameId, team_id: args.teamId, horizon_games: args.horizonGames, as_of_date: args.asOfDate });
  const ids = args.playerRows.map(row => row.player_id);
  if (new Set(ids).size !== ids.length || args.playerRows.some(row => row.game_id !== args.gameId
    || row.team_id !== args.teamId || row.horizon_games !== args.horizonGames || row.as_of_date !== args.asOfDate)
    || new Set(args.currentRosterPlayerIds).size !== args.currentRosterPlayerIds.length
    || args.currentRosterPlayerIds.some(id => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error("Native team goals require distinct contributors and matching game/team/horizon/date scope");
  }
  const contributors = args.playerRows.map(buildNativePlayerGoalAccounting);
  const esMean = sumReportedMeans(args.playerRows.map(row => row.proj_goals_es));
  const ppMean = sumReportedMeans(args.playerRows.map(row => row.proj_goals_pp));
  const unmodeledRosterPlayerIds = args.currentRosterPlayerIds.filter(id => !ids.includes(id));
  const unexpectedProjectedPlayerIds = ids.filter(id => !args.currentRosterPlayerIds.includes(id));
  const reasons = new Set<string>([...endpointGaps, "unknown_residual_scorers", "unproved_game_time_roster", "unproved_goalie_scoring"]);
  contributors.forEach(row => row.reasons.forEach(reason => reasons.add(reason)));
  if (!contributors.length) reasons.add("empty_projected_roster");
  if (!args.currentRosterPlayerIds.length) reasons.add("unknown_current_roster");
  if (unmodeledRosterPlayerIds.length || unexpectedProjectedPlayerIds.length) reasons.add("unmodeled_or_unexpected_roster_contributors");
  const allConditional = contributors.length > 0 && contributors.every(row => row.conditionalEsPpMean !== null);
  const allIntegrated = contributors.length > 0 && contributors.every(row => row.expectedEsPpMeanGivenGamePlayed !== null);
  return {
    ...endpointDisclosure(args.asOfDate, args.horizonGames),
    gameId: args.gameId,
    teamId: args.teamId,
    horizonGames: args.horizonGames,
    reportedBasis: "sum_of_serialized_player_components" as const,
    reportedComponents: { esMean, ppMean, pkMean: null },
    reportedEsPpMean: sumReportedMeans([esMean, ppMean]),
    sumOfPlayerConditionalEsPpMeans: allConditional ? sumReportedMeans(contributors.map(row => row.conditionalEsPpMean!)) : null,
    expectedListedEsPpMeanGivenGamePlayed: allIntegrated ? sumReportedMeans(contributors.map(row => row.expectedEsPpMeanGivenGamePlayed!)) : null,
    residualMean: null,
    currentRosterPlayerIds: [...args.currentRosterPlayerIds],
    projectedPlayerIds: ids,
    unmodeledRosterPlayerIds,
    unexpectedProjectedPlayerIds,
    reasons: [...reasons],
  };
}
