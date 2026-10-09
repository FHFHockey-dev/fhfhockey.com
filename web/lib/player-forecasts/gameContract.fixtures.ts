import { GAME_FORECAST_CONTRACT_VERSION, GAME_FORECAST_TARGETS,
  type GameForecastContract, type GameForecastMeans, type PlayerGameForecastRecord } from "./gameContract";

/** Entirely invented local examples. IDs, evidence and means are not observed NHL data. */
function fixtureMeans(values: Partial<GameForecastMeans>, exposure: number) {
  const conditionalMeans = Object.fromEntries(GAME_FORECAST_TARGETS.map(key => [key, values[key] ?? null])) as GameForecastMeans;
  return {
    conditionalMeans,
    means: Object.fromEntries(GAME_FORECAST_TARGETS.map(key => [key,
      conditionalMeans[key] === null ? null : conditionalMeans[key]! * exposure])) as GameForecastMeans,
    unsupportedReasons: Object.fromEntries(GAME_FORECAST_TARGETS.filter(key => conditionalMeans[key] === null)
      .map(key => [key, "No synthetic head for this population/category."])),
  };
}

export function syntheticGameForecast(options: {
  gameId?: number; scheduledAt?: string; firstGoalieShots?: number; pGamePlayed?: number;
} = {}): GameForecastContract {
  const gameId = options.gameId ?? 900001;
  const scheduledAt = options.scheduledAt ?? "2026-10-08T23:00:00Z";
  const played = options.pGamePlayed ?? 0.8;
  const shots = options.firstGoalieShots ?? 24;
  const game = { seasonId: 20262027, gameId, teamId: 90, opponentTeamId: 91,
    scheduledAt, scheduleRevision: "synthetic-schedule-v1", pGamePlayed: played };
  const common = (playerId: number) => ({
    game: { seasonId: game.seasonId, gameId, teamId: game.teamId, scheduledAt,
      scheduleRevision: game.scheduleRevision, rosterRevision: "synthetic-roster-v1", playerId, nhlPlayerId: playerId + 1000 },
    identity: { mappingVersion: "synthetic-mapping-v1", teamValidFrom: "2026-09-01T00:00:00Z", teamValidUntil: null },
    sourceIds: ["synthetic-model", "synthetic-inputs"], meanBasis: "unconditional_game" as const,
    goalsWithoutShotMean: 0, conditionalGoalsWithoutShotMean: 0,
    goalsResidualContributorId: playerId === 901 ? null : "other-credited-scorers",
  });
  const unknownConfirmation = (playerId: number) => ({
    playerId, nhlPlayerId: playerId + 1000, teamId: game.teamId, gameId,
    label: "unknown" as const, currentRevisionId: null, history: [],
  });
  const skater: PlayerGameForecastRecord = {
    ...common(901), population: "forward", conditionalBasis: "on_statistical_credit_given_game_played",
    participation: { conditioning: "given_game_played", pDress: 0.95, pPositiveMinutes: 0.8, pGamePlayedCredited: 0.9 },
    ...fixtureMeans({ GOALS: 0.5, PRIMARY_ASSISTS: 0.4, SECONDARY_ASSISTS: 0.2, ASSISTS: 0.6,
      PP_GOALS: 0.2, PP_PRIMARY_ASSISTS: 0.1, PP_SECONDARY_ASSISTS: 0.05, PP_POINTS: 0.35,
      SHOTS_ON_GOAL: 3, HITS: 1, BLOCKED_SHOTS: 0.5, PENALTY_MINUTES: 0.8, TOTAL_TOI: 18 * 60 }, played * 0.9),
  };
  const starter: PlayerGameForecastRecord = {
    ...common(902), population: "goalie", conditionalBasis: "on_start_or_relief_given_game_played",
    participation: { conditioning: "given_game_played", pDress: 1, pPositiveMinutes: 0.65,
      pGamePlayedCredited: 0.65, pStart: 0.6, pReliefOnly: 0.05, pNoAppearance: 0.35 },
    ...fixtureMeans({ SHOTS_AGAINST_GOALIE: shots, SAVES_GOALIE: shots - 2, GOALS_AGAINST_GOALIE: 2,
      TOTAL_TOI: 50 * 60, WINS_GOALIE: 0.6, SHUTOUTS_GOALIE: 0.1 }, played * 0.65),
    goalsAgainstWithoutShotMean: 0, conditionalGoalsAgainstWithoutShotMean: 0, pOfficialShutoutEligibleGivenAppearance: 0.2,
    shutoutEligibilityRuleVersion: "synthetic-official-shutout-rule-v1",
    startConfirmation: { ...unknownConfirmation(902), label: "confirmed", currentRevisionId: "confirmation-1",
      history: [{ revisionId: "confirmation-1", supersedesRevisionId: null, sourceId: "synthetic-report",
        label: "confirmed", evidenceStatus: "direct_inspected", verifiedAt: "2026-10-07T15:57:00Z",
        expiresAt: "2026-10-07T18:00:00Z" }] },
  };
  const backup: PlayerGameForecastRecord = {
    ...common(903), population: "goalie", conditionalBasis: "on_start_or_relief_given_game_played",
    participation: { conditioning: "given_game_played", pDress: 1, pPositiveMinutes: 0.4,
      pGamePlayedCredited: 0.4, pStart: 0.3, pReliefOnly: 0.1, pNoAppearance: 0.6 },
    ...fixtureMeans({ SHOTS_AGAINST_GOALIE: 30, SAVES_GOALIE: 27, GOALS_AGAINST_GOALIE: 3,
      TOTAL_TOI: 40 * 60, WINS_GOALIE: 0.3, SHUTOUTS_GOALIE: 0.05 }, played * 0.4),
    goalsAgainstWithoutShotMean: 0, conditionalGoalsAgainstWithoutShotMean: 0, pOfficialShutoutEligibleGivenAppearance: 0.1,
    shutoutEligibilityRuleVersion: "synthetic-official-shutout-rule-v1", startConfirmation: unknownConfirmation(903),
  };
  const quality = { freshness: "fresh" as const, completeness: "complete" as const, conflict: "clear" as const };
  const source = (sourceId: string, at: string, components: GameForecastContract["sources"][number]["components"]) => ({
    sourceId, revisionId: `${sourceId}-v1`, supersedesRevisionId: null,
    reference: `synthetic://game-contract-fixtures/${sourceId}`, publisher: "Local synthetic fixtures",
    publishedAt: at, effectiveAt: at, firstReceivedAt: at, verifiedAt: at, components,
    accessStatus: "available" as const, rightsStatus: "unknown" as const, quality: { ...quality },
  });
  return {
    contractVersion: GAME_FORECAST_CONTRACT_VERSION, forecastId: `synthetic-game-${gameId}`,
    use: "research_only", outputKind: "count_means_only",
    asOf: "2026-10-07T16:00:00Z", generatedAt: "2026-10-07T16:01:00Z",
    modelCutoff: "2026-09-01T00:00:00Z", featureCutoff: "2026-10-07T15:50:00Z",
    modelVersion: "synthetic-ability-v1", featureSchemaVersion: "synthetic-features-v1",
    sourceWatermark: "synthetic-sources-v1", rulesVersion: "synthetic-regular-season-rules-v1",
    eventDefinitionVersion: "synthetic-official-event-credit-v1", competitionType: "regular_season",
    eventScope: "official_play_excluding_shootout", toiUnit: "seconds",
    starterSelectionKind: "exclusive_categorical_given_game_played", game,
    sources: [source("synthetic-model", "2026-08-31T12:00:00Z", ["model"]),
      source("synthetic-inputs", "2026-10-07T15:40:00Z", ["features", "identity"]),
      source("synthetic-report", "2026-10-07T15:56:00Z", ["confirmation"])], quality,
    fallback: { status: "none", modelVersion: null, reasonCodes: [], displayLabel: "Synthetic research example; no live use." },
    unsupportedOutputs: {
      countDistributions: { value: null, reason: "Only first moments are supplied." },
      jointDistribution: { value: null, reason: "No joint simulator or shared draws." },
      covariance: { value: null, reason: "No covariance estimate; covariance alone would not establish a joint distribution." },
      expectedRealizedRatios: { value: null, reason: "Ratio-of-expectations only; denominator distributions are absent." },
      positiveDenominatorProbability: { value: null, reason: "No exposure distribution supplied." },
      decisionUtility: { value: null, reason: "No actionable league baseline or decision adapter." },
    },
    players: [skater, starter, backup],
    residualContributors: [
      { contributorId: "other-credited-scorers", description: "All remaining credited scorers, including goalie scorers",
        reason: "Only one skater scoring record is supplied.", goalsForMean: played * 2.05,
        guardedNetShotsAgainstMean: 0, guardedNetSavesMean: 0, guardedNetGoalsAgainstMean: 0,
        guardedNetGoalsAgainstWithoutShotMean: 0, goalieMinutesMean: 0,
        pGoalieAppearanceGivenGamePlayed: 0, goalieOutcomeMeans: { WINS_GOALIE: 0, SHUTOUTS_GOALIE: 0 },
        conditionalGoalieOutcomeMeans: null, goalieOutcomeUnsupportedReasons: {},
        pOfficialShutoutEligibleGivenAppearance: null, shutoutEligibilityRuleVersion: null },
      { contributorId: "unknown-goalie", description: "Unresolved goalie identity and its exposure",
        reason: "Explicit remaining starter branch.", goalsForMean: 0,
        guardedNetShotsAgainstMean: played * 3, guardedNetSavesMean: played * 2.7,
        guardedNetGoalsAgainstMean: played * 0.3, guardedNetGoalsAgainstWithoutShotMean: 0,
        goalieMinutesMean: played * 6, pGoalieAppearanceGivenGamePlayed: 0.1,
        goalieOutcomeMeans: { WINS_GOALIE: null, SHUTOUTS_GOALIE: null },
        conditionalGoalieOutcomeMeans: { WINS_GOALIE: null, SHUTOUTS_GOALIE: null },
        goalieOutcomeUnsupportedReasons: { WINS_GOALIE: "No synthetic unknown-goalie win head.", SHUTOUTS_GOALIE: "No synthetic unknown-goalie shutout head." },
        pOfficialShutoutEligibleGivenAppearance: null, shutoutEligibilityRuleVersion: null },
    ],
    unknownStarter: { residualContributorId: "unknown-goalie", probabilityGivenGamePlayed: 0.1 },
    teamAccounting: {
      officialGoalsForMean: played * 2.5, officialGoalsAgainstMean: played * 3.1,
      opponentShotsOnGoalMean: played * (0.65 * shots + 0.4 * 30 + 3 + 0.3),
      emptyNetGoalsAgainstMean: played * 0.2, emptyNetShotsAgainstMean: played * 0.3,
      unassignedAwardedGoalsAgainstMean: played * 0.1,
      guardedNetMinutesMean: played * (0.65 * 50 + 0.4 * 40 + 6),
      shootoutStandingsAdjustmentForMean: played * 0.1, shootoutStandingsAdjustmentAgainstMean: played * 0.05,
    },
  };
}

export function syntheticGoalie(artifact: GameForecastContract, playerId = 902) {
  const goalie = artifact.players.find(player => player.game.playerId === playerId);
  if (!goalie || goalie.population !== "goalie") throw new Error("Synthetic goalie not found.");
  return goalie;
}

export function invalidSyntheticGameForecasts() {
  const invalid = (name: string, invariant: string, mutate: (artifact: GameForecastContract) => void) => {
    const artifact = syntheticGameForecast(); mutate(artifact); return { name, invariant, artifact };
  };
  return [
    invalid("assist components disagree", "count_identity", artifact => { artifact.players[0].means.ASSISTS = 0; }),
    invalid("PPP components disagree", "count_identity", artifact => { artifact.players[0].means.PP_POINTS = 0; }),
    invalid("unexplained goals outside SOG", "goals_subset_shots", artifact => { artifact.players[0].means.GOALS = 3; }),
    invalid("goalie SA/SV/GA disagree", "guarded_net_identity", artifact => { syntheticGoalie(artifact).means.SHOTS_AGAINST_GOALIE = 13; }),
    invalid("per-game goalie states do not normalize", "goalie_states", artifact => { syntheticGoalie(artifact).participation.pNoAppearance = 0.2; }),
    invalid("team starter mass has a gap", "team_starter", artifact => { artifact.unknownStarter.probabilityGivenGamePlayed = 0; }),
    invalid("participation applied twice", "participation_integration", artifact => { syntheticGoalie(artifact).means.SAVES_GOALIE! *= 0.65; }),
    invalid("positive minutes without statistical credit", "participation_exposure", artifact => { syntheticGoalie(artifact).participation.pGamePlayedCredited = 0; }),
    invalid("multiple expected team goalie wins", "team_goalie_outcomes", artifact => {
      for (const player of artifact.players) if (player.population === "goalie") {
        player.conditionalMeans!.WINS_GOALIE = 1;
        player.means.WINS_GOALIE = artifact.game.pGamePlayed * (player.participation.pStart + player.participation.pReliefOnly);
      }
    }),
    invalid("missing head disguised as zero", "unsupported_head", artifact => { syntheticGoalie(artifact).means.HITS = 0; }),
    invalid("published earlier but received after feature cutoff", "source_availability", artifact => {
      artifact.sources[1].firstReceivedAt = "2026-10-07T15:51:00Z"; artifact.sources[1].verifiedAt = "2026-10-07T15:52:00Z";
    }),
    invalid("future model observations", "forecast_cutoff", artifact => { artifact.modelCutoff = "2026-10-07T16:01:00Z"; }),
    invalid("expired team identity", "player_game_identity", artifact => { artifact.players[0].identity.teamValidUntil = artifact.game.scheduledAt; }),
    invalid("confirmation names another game", "confirmation_identity", artifact => { syntheticGoalie(artifact).startConfirmation.gameId += 1; }),
    invalid("inference labeled confirmed", "confirmed_evidence", artifact => { syntheticGoalie(artifact).startConfirmation.history[0].evidenceStatus = "inference"; }),
    invalid("expired confirmation still labeled confirmed", "confirmed_evidence", artifact => {
      syntheticGoalie(artifact).startConfirmation.history[0].expiresAt = "2026-10-07T15:59:00Z";
    }),
    invalid("unproven official shutout eligibility", "official_shutout", artifact => { syntheticGoalie(artifact).pOfficialShutoutEligibleGivenAppearance = null; }),
    invalid("team goals omit residual credited scorers", "team_accounting", artifact => { artifact.residualContributors.shift(); }),
    invalid("unsupported goalie scoring has no named residual", "scorer_coverage", artifact => { syntheticGoalie(artifact).goalsResidualContributorId = null; }),
    invalid("shootout standings goal folded into official play", "team_accounting", artifact => {
      artifact.teamAccounting.officialGoalsForMean += artifact.teamAccounting.shootoutStandingsAdjustmentForMean;
    }),
  ];
}
