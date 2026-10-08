import { createHash } from "node:crypto";
import { availableBefore, provenanceSchema, scoreTeamGoals } from "../forecast-diagnostics/pairedInputs";
import type { auditNativeGoalLedger } from "./nativeGoalLedgerAudit";
import { projectionInputHash } from "./inputCapture";
import { reconcileResearchGoalAppearanceManifest, researchGoalAppearanceManifestSchema } from "./researchGoalAppearanceManifest";

export const RESEARCH_GOAL_BASELINE_VERSION = "research-credited-goals-per-appearance-v1";
export const RESEARCH_GOAL_CELLS = ["REG", "OT"].flatMap(period =>
  ["both_present", "attacking_absent", "defending_absent", "both_absent"].flatMap(net =>
    ["equal_skaters", "more_skaters", "fewer_skaters"].map(strength => `${period}:${net}:${strength}`)));
type CellCounts = Record<string, number>;
export type ResearchGoalAppearance = {
  gameId: number; teamId: number; seasonId: number; phase: number; startedAt: string; availableAt: string;
  toiSeconds: number | null; officialGoals: number | null; goalsByCell: CellCounts | null; gaps: string[];
};
const positiveId = (id: unknown): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0;
const sorted = (ids: readonly number[]) => [...ids].sort((a, b) => a - b);
const sameIds = (a: readonly number[], b: readonly number[]) => projectionInputHash(sorted(a)) === projectionInputHash(sorted(b));
const vector = () => Object.fromEntries(RESEARCH_GOAL_CELLS.map(cell => [cell, 0]));
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const time = (value: string) => Date.parse(value);

/** GOALS only. The caller must independently prove the full player-season appearance manifest.
 * Matching a supplied manifest checks accounting mechanics, not its external completeness.
 * The retained-data runner below never invents that manifest from a club roster/window.
 */
export function estimateResearchPlayerGoals(args: {
  playerId: number; seasonId: number; featureCutoffAt: string; appearances: readonly ResearchGoalAppearance[];
  provedSeasonAppearanceGameIds: readonly number[] | null;
}) {
  if (!positiveId(args.playerId) || !positiveId(args.seasonId) || !Number.isFinite(time(args.featureCutoffAt))
    || args.appearances.length > 200 || new Set(args.appearances.map(row => row.gameId)).size !== args.appearances.length)
    throw new Error("Invalid research goal history identity or duplicate appearance");
  const expected = args.provedSeasonAppearanceGameIds;
  if (expected && (expected.some(id => !positiveId(id)) || new Set(expected).size !== expected.length))
    throw new Error("Invalid complete player-season appearance manifest");
  const reasons = new Set<string>();
  const valid: ResearchGoalAppearance[] = [];
  for (const row of args.appearances) {
    if (!positiveId(row.gameId) || !positiveId(row.teamId) || !Number.isFinite(time(row.startedAt)) || !Number.isFinite(time(row.availableAt))
      || row.toiSeconds !== null && (!Number.isFinite(row.toiSeconds) || row.toiSeconds < 0)
      || row.officialGoals !== null && (!Number.isSafeInteger(row.officialGoals) || row.officialGoals < 0))
      throw new Error("Invalid research appearance units or identity");
    let usable = true;
    const gap = (code: string) => { reasons.add(code); usable = false; };
    if (row.seasonId !== args.seasonId || row.phase !== 2) gap("out_of_current_regular_season_history");
    if (time(row.startedAt) >= time(args.featureCutoffAt) || time(row.availableAt) >= time(args.featureCutoffAt)) gap("history_unavailable_at_feature_cutoff");
    row.gaps.forEach(gap);
    if (row.toiSeconds === null) gap("missing_official_total_toi");
    if (row.goalsByCell === null || row.officialGoals === null) gap("unproved_official_goal_credit_or_partition");
    else {
      if (Object.entries(row.goalsByCell).some(([cell, count]) => !RESEARCH_GOAL_CELLS.includes(cell) || !Number.isSafeInteger(count) || count < 0))
        throw new Error("Invalid disjoint credited-goal cell count");
      if (sum(Object.values(row.goalsByCell)) !== row.officialGoals) gap("goal_cells_differ_from_official_player_credit");
      if (row.toiSeconds === 0 && row.officialGoals > 0) gap("credited_goal_without_positive_toi_appearance");
    }
    if (usable) valid.push(row);
  }
  const positive = valid.filter(row => row.toiSeconds! > 0);
  if (expected === null) reasons.add("complete_player_season_appearance_manifest_unavailable");
  else if (!sameIds(expected, positive.map(row => row.gameId))) reasons.add("incomplete_player_season_appearance_history");
  if (!positive.length) reasons.add("no_positive_toi_appearances");
  const observedCounts = vector();
  positive.forEach(row => Object.entries(row.goalsByCell!).forEach(([cell, count]) => { observedCounts[cell] += count; }));
  const observedGoals = sum(Object.values(observedCounts)), n = positive.length;
  if (!Number.isSafeInteger(observedGoals)) throw new Error("Research credited-goal count overflow");
  const supported = reasons.size === 0;
  const cellMeans = Object.fromEntries(RESEARCH_GOAL_CELLS.map(cell => [cell, supported ? observedCounts[cell] / n : null]));
  return { version: RESEARCH_GOAL_BASELINE_VERSION, category: "GOALS" as const, researchOnly: true,
    playerId: args.playerId, identityNamespace: "nhl_provider_player_id" as const, seasonId: args.seasonId, featureCutoffAt: args.featureCutoffAt,
    denominator: "complete_current_regular_season_positive_official_TOI_appearances" as const, unit: "goals_per_physical_playing_appearance" as const,
    historyStatus: supported ? "complete" as const : expected === null ? "unproved" as const : "incomplete_or_zero_support" as const,
    historyReasons: [...reasons].sort(), provedSeasonAppearanceGameIds: expected === null ? null : sorted(expected),
    observedCohort: { gameIds: sorted(positive.map(row => row.gameId)), zeroToiGameIds: sorted(valid.filter(row => row.toiSeconds === 0).map(row => row.gameId)),
      positiveToiAppearanceCount: n, officialGoals: observedGoals, goalsByCell: observedCounts,
      goalsPerObservedAppearance: n > 0 ? observedGoals / n : null, isCompletePlayerSeasonEstimate: supported },
    conditionalGoalsPerPlayingAppearance: supported ? observedGoals / n : null, cellMeans,
    participationProbabilityGivenGamePlayed: null, statisticalCreditProbabilityGivenGamePlayed: null,
    gameOccurrenceProbability: null, expectedGoalsGivenGamePlayed: null, unconditionalGoalsMean: null, fullGameEligible: false,
  };
}

function verifyBoxscore(source: any) {
  const provenance = provenanceSchema.parse(source?.provenance);
  if (source.kind !== "official_boxscore" || source.revisionId !== provenance.revisionId || source.url !== provenance.source
    || !positiveId(source.gameId) || source.url !== `https://api-web.nhle.com/v1/gamecenter/${source.gameId}/boxscore`
    || typeof source.bodyUtf8 !== "string" || createHash("sha256").update(source.bodyUtf8).digest("hex") !== source.rawBytesHash
    || projectionInputHash(JSON.parse(source.bodyUtf8)) !== projectionInputHash(source.payload)
    || projectionInputHash(source.payload) !== provenance.payloadHash) throw new Error("Unverified retained official boxscore revision");
  return provenance;
}

function officialToi(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{1,3}:[0-5]\d$/.test(value)) return null;
  const [minutes, seconds] = value.split(":").map(Number);
  return minutes * 60 + seconds;
}

/** Raw sources have already passed the existing retained ledger replay. Missing boxscores
 * remain missing. This adapter supplies no complete cross-team player-season manifest.
 */
export function evaluateRetainedResearchGoals(input: {
  ledger: ReturnType<typeof auditNativeGoalLedger>; historyBundle: any; boxscoreRevisions: unknown[];
  appearanceEvidence?: { manifest: unknown; revisions: unknown[] };
}) {
  const { ledger } = input, scope = ledger.scope;
  const boxes = input.boxscoreRevisions.map(value => ({ source: value as any, provenance: verifyBoxscore(value) }));
  if (new Set(boxes.map(row => row.source.gameId)).size !== boxes.length || new Set(boxes.map(row => row.source.revisionId)).size !== boxes.length
    || boxes.some(row => !ledger.games.some(game => game.gameId === row.source.gameId))) throw new Error("Duplicate or out-of-population boxscore");
  const teams = ledger.windows.map(window => {
    const teamId = window.teamId;
    const population = input.historyBundle.population.find((row: any) => row.teamId === teamId);
    const schedule = input.historyBundle.scheduleSources.find((row: any) => population.selectedGameIds.every((id: number) =>
      row.payload.games.some((game: any) => game.id === id && [game.homeTeam.id, game.awayTeam.id].includes(teamId))));
    const preceding = schedule.payload.games.filter((game: any) => game.season === scope.seasonId && game.gameType === 2
      && [game.homeTeam.id, game.awayTeam.id].includes(teamId) && time(game.startTimeUTC) < time(scope.cutoffAt));
    const completeClubWindow = sameIds(preceding.map((game: any) => game.id), population.selectedGameIds)
      && preceding.every((game: any) => ["OFF", "FINAL"].includes(game.gameState)) && population.incompleteGameIds.length === 0;
    const games = ledger.games.filter(game => population.selectedGameIds.includes(game.gameId)).map(game => {
      const box = boxes.find(row => row.source.gameId === game.gameId), gaps: string[] = [];
      const historicalRoster = game.roster.filter(row => row.teamId === teamId);
      const goals = game.events.filter(row => row.kind === "goal" && row.teamId === teamId);
      const fact = game.teams.find(row => row.teamId === teamId)!;
      if (!completeClubWindow) gaps.push("incomplete_current_season_club_window");
      if (!game.availableAtProspectiveCutoff) gaps.push("pbp_unavailable_at_feature_cutoff");
      const partitionGaps = ledger.gaps.filter(row => row.gameId === game.gameId && row.eventId != null
        && goals.some(goal => goal.eventId === row.eventId) && row.code !== "event_goal_sog_credit_unproved");
      if (partitionGaps.length) gaps.push("unproved_goal_event_partition_or_identity");
      const payload = box?.source.payload;
      if (payload && (payload.id !== game.gameId || payload.season !== scope.seasonId || payload.gameType !== 2
        || !["OFF", "FINAL"].includes(payload.gameState) || payload.startTimeUTC !== game.startAt
        || !sameIds([payload.homeTeam?.id, payload.awayTeam?.id], game.teams.map(row => row.teamId))
        || game.teams.some(row => (payload.homeTeam.id === row.teamId ? payload.homeTeam : payload.awayTeam).score !== row.finalScore)))
        throw new Error("Boxscore differs from historical game identity or official final");
      if (!box) gaps.push("official_boxscore_unavailable");
      else if (!availableBefore(box.provenance, scope.cutoffAt)) gaps.push("boxscore_unavailable_at_feature_cutoff");
      const side = payload?.homeTeam.id === teamId ? "homeTeam" : "awayTeam";
      const stats = payload?.playerByGameStats?.[side];
      const rows: any[] = [];
      for (const group of ["forwards", "defense", "goalies"]) {
        if (!Array.isArray(stats?.[group])) gaps.push("incomplete_boxscore_player_population");
        else rows.push(...stats[group]);
      }
      if (new Set(rows.map(row => row.playerId)).size !== rows.length || rows.some(row => !positiveId(row.playerId)))
        throw new Error("Ambiguous boxscore player identity");
      if (!sameIds(rows.map(row => row.playerId), historicalRoster.map(row => row.playerId))) gaps.push("boxscore_roster_population_differs_from_pbp");
      const skaterGoals = rows.filter(row => row.position !== "G").map(row => row.goals);
      const allSkaterCreditsKnown = skaterGoals.every(count => Number.isSafeInteger(count) && count >= 0);
      const skaterCreditTotal = allSkaterCreditsKnown ? sum(skaterGoals) : null;
      const observedAt = new Date(Math.max(time(game.provenance.firstReceivedAt), time(game.provenance.verifiedAt),
        game.provenance.publishedAt === null ? -Infinity : time(game.provenance.publishedAt),
        box ? time(box.provenance.firstReceivedAt) : -Infinity, box ? time(box.provenance.verifiedAt) : -Infinity,
        box?.provenance.publishedAt == null ? -Infinity : time(box.provenance.publishedAt))).toISOString();
      const players = historicalRoster.map(player => {
        const row = rows.find(value => value.playerId === player.playerId), playerGaps = [...gaps];
        const events = goals.filter(goal => goal.playerId === player.playerId), cells = vector();
        for (const event of events) {
          const cell = `${event.period}:${event.netState}:${event.skaterRelation}`;
          if (!RESEARCH_GOAL_CELLS.includes(cell)) playerGaps.push("unclassified_official_goal"); else cells[cell]++;
        }
        let officialGoals: number | null = Number.isSafeInteger(row?.goals) && row.goals >= 0 ? row.goals : null;
        // A complete goal-event ledger plus all team goals credited to skaters proves
        // an observed goalie zero. This is not a zero future goalie-scoring assumption.
        if (player.positionCode === "G" && officialGoals === null && events.length === 0 && skaterCreditTotal === fact.observedOfficialPlayGoals)
          officialGoals = 0;
        if (officialGoals === null) playerGaps.push("official_player_goal_credit_unavailable");
        if (row && row.position !== player.positionCode) playerGaps.push("boxscore_player_position_differs_from_pbp");
        return { playerId: player.playerId, position: player.positionCode, appearance: {
          gameId: game.gameId, teamId, seasonId: scope.seasonId, phase: 2, startedAt: game.startAt, availableAt: observedAt,
          toiSeconds: officialToi(row?.toi), officialGoals, goalsByCell: cells, gaps: [...new Set(playerGaps)].sort(),
        } satisfies ResearchGoalAppearance };
      });
      return { gameId: game.gameId, officialPlayGoals: fact.observedOfficialPlayGoals, pbpRevisionId: game.revisionId,
        boxscoreRevisionId: box?.source.revisionId ?? null, gaps: [...new Set(gaps)].sort(), players,
        availableBeforeHistoricalStart: game.availableBeforeHistoricalStart && Boolean(box && availableBefore(box.provenance, game.startAt)) };
    });
    const playerIds = [...new Set(games.flatMap(game => game.players.map(row => row.playerId)))].sort((a, b) => a - b);
    const players = playerIds.map(playerId => estimateResearchPlayerGoals({ playerId, seasonId: scope.seasonId, featureCutoffAt: scope.cutoffAt,
      appearances: games.flatMap(game => game.players.filter(row => row.playerId === playerId).map(row => row.appearance)), provedSeasonAppearanceGameIds: null }));
    const observedGoals = sum(games.map(game => game.officialPlayGoals));
    const observedContributorGoals = sum(players.map(player => player.observedCohort.officialGoals));
    const allPlayerGamesUsable = games.every(game => game.gaps.length === 0 && game.players.every(row => row.appearance.gaps.length === 0
      && row.appearance.toiSeconds !== null && row.appearance.officialGoals !== null
      && sum(Object.values(row.appearance.goalsByCell!)) === row.appearance.officialGoals
      && (row.appearance.toiSeconds > 0 || row.appearance.officialGoals === 0) && time(row.appearance.availableAt) < time(scope.cutoffAt)));
    const observedReconciliation = completeClubWindow && allPlayerGamesUsable && observedGoals === observedContributorGoals;
    const weightedCohortMean = observedReconciliation ? sum(players.map(player => player.observedCohort.positiveToiAppearanceCount === 0 ? 0
      : player.observedCohort.positiveToiAppearanceCount / games.length * player.observedCohort.goalsPerObservedAppearance!)) : null;
    return { teamId, historyGameIds: sorted(population.selectedGameIds), retainedClubScheduleWindowComplete: completeClubWindow,
      games, players, historicalAccounting: { officialGoals: observedGoals, contributorGoals: observedContributorGoals,
        reconciled: observedReconciliation, ownObservedGoalsPerTeamGame: completeClubWindow && games.length ? observedGoals / games.length : null,
        weightedObservedCohortMean: weightedCohortMean,
        identity: "sum((observed_player_appearances / observed_team_games) * observed_G_over_n) = observed_team_G_over_N",
        weightsAreFutureParticipationProbabilities: false },
      sumOfSupportedIndividualConditionalMeans: players.length && players.every(player => player.conditionalGoalsPerPlayingAppearance !== null)
        ? sum(players.map(player => player.conditionalGoalsPerPlayingAppearance!)) : null,
      futureRosterCoverageProved: false, futureResidualMean: null, fullOfficialPlayMean: null, fullGameEligible: false };
  }).sort((a, b) => a.teamId - b.teamId);
  const comparison = scoreTeamGoals({ ...scope, gameDate: scope.startAt.slice(0, 10) }, input.historyBundle.history);
  const latestHistoricalStart = Math.max(...teams.flatMap(team => team.games.flatMap(game => game.players.map(row => time(row.appearance.startedAt)))));
  const featuresAvailableBeforeLatestHistoricalStart = teams.flatMap(team => team.games.flatMap(game => game.players))
    .filter(row => time(row.appearance.availableAt) < latestHistoricalStart).length;
  const result = { version: RESEARCH_GOAL_BASELINE_VERSION, category: "GOALS", evidenceKind: "retained_historical_research_evaluation",
    scope, researchOnly: true, acceptanceEligible: false, productionReplacement: false, teams,
    comparison: { sameInputTeamGoalBaseline: comparison, sameScopeNativeForgeComparison: "unavailable_in_this_retained_bundle",
      forecastLift: "not_evaluated", historicalForecastBacktestEligible: false,
      historicalForecastBacktestStatus: "complete_player_history_and_temporal_fold_proofs_unavailable",
      featuresAvailableBeforeLatestHistoricalStart,
      limitation: "Cohort algebra is observational accounting; later-retained finals cannot become historical pregame inputs." },
    remainingRequirements: ["Complete per-player current-season appearance manifests across teams, including transfer history and measured zeros.",
      "Canonical identity/game-time roster, physical-appearance/statistical-credit bridge, future participation and game occurrence.",
      "Provider situation/credit certification, estimator ability lineage and separate out-of-sample acceptance."],
  };
  if (!input.appearanceEvidence) return { ...result, playerSeasonResearch: undefined };
  const observations = teams.flatMap(team => team.games.flatMap(game => {
    const payload = boxes.find(box => box.source.gameId === game.gameId)?.source.payload;
    const side = payload?.homeTeam.id === team.teamId ? payload?.homeTeam : payload?.awayTeam;
    const opponent = payload?.homeTeam.id === team.teamId ? payload?.awayTeam : payload?.homeTeam;
    return game.players.map(player => ({ ...player, gameDate: payload?.gameDate,
      teamAbbrev: side?.abbrev, opponentAbbrev: opponent?.abbrev }));
  }));
  const researchCutoff = researchGoalAppearanceManifestSchema.parse(input.appearanceEvidence.manifest).featureCutoffAt;
  const proof = reconcileResearchGoalAppearanceManifest({ ...input.appearanceEvidence, observations,
    cohortResultHash: projectionInputHash(result), seasonId: scope.seasonId, featureCutoffAt: researchCutoff,
    expectedPlayerIds: [...new Set(observations.map(player => player.playerId))] });
  const seasonPlayers = proof.players.map(player => {
    const estimate = estimateResearchPlayerGoals({ playerId: player.playerId, seasonId: scope.seasonId,
      featureCutoffAt: researchCutoff, appearances: player.appearances, provedSeasonAppearanceGameIds: null });
    const cohort = estimate.observedCohort, n = cohort.positiveToiAppearanceCount;
    const observedRatioUsable = player.status === "cohort_reconciled" && n > 0;
    return { ...estimate, providerCohortObservation: {
      populationScope: "fixed_retained_provider_game_id_cohort" as const,
      denominator: "positive_official_TOI_appearances_in_reconciled_retained_provider_cohort" as const,
      gameIds: player.retainedProviderCohortGameIds, positiveToiAppearanceCount: n, officialGoals: cohort.officialGoals,
      goalsPerPlayingAppearance: observedRatioUsable ? cohort.goalsPerObservedAppearance : null,
      cellGoalsPerPlayingAppearance: Object.fromEntries(RESEARCH_GOAL_CELLS.map(cell => [cell, observedRatioUsable ? cohort.goalsByCell[cell] / n : null])),
      isCompletePlayerSeasonEstimate: false },
      appearanceEvidence: { status: player.status, reasons: player.reasons, providerGameIds: player.providerGameIds,
        sourceRevisionIds: player.sourceRevisionIds, availableAt: player.availableAt, requestTimeCapAt: player.requestTimeCapAt,
        historyCoverageThroughAt: null, providerSeasonCoverageStatus: "unproved" as const } };
  });
  return { ...result, playerSeasonResearch: { ...proof, players: seasonPlayers,
    supportedPlayerCount: seasonPlayers.filter(player => player.conditionalGoalsPerPlayingAppearance !== null).length,
    retainedProviderCohortObservationCount: seasonPlayers.filter(player => player.providerCohortObservation.goalsPerPlayingAppearance !== null).length,
    completePlayerSeasonAtFeatureCutoff: false,
    fullGameEligible: false, historicalForecastBacktestEligible: false },
    remainingRequirements: ["Independent provider/population proof of time-complete player-season coverage remains unavailable; retained cohort observations do not supply it.",
      ...result.remainingRequirements.slice(1)] };
}
