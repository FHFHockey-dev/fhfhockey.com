// @vitest-environment node
import { describe, expect, it } from "vitest";
import { aggregatePlayerGameMeans, GAME_FORECAST_TARGETS, gameForecastContractSchema, goalieRatioOfExpectations,
  type GameForecastContract } from "./gameContract";
import { invalidSyntheticGameForecasts, syntheticGameForecast, syntheticGoalie } from "./gameContract.fixtures";

function invariants(value: unknown): string[] {
  const result = gameForecastContractSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map(issue => issue.code === "custom" ? issue.params?.invariant : issue.code);
}

describe("additive player-game accounting contract", () => {
  it("accepts invented game means without enabling inference or serving", () => {
    const artifact = gameForecastContractSchema.parse(syntheticGameForecast());
    expect(artifact.use).toBe("research_only");
    expect(artifact.players[0].means.ASSISTS).toBeCloseTo(0.432);
    expect(artifact.players[0].means.PP_POINTS).toBeCloseTo(0.252);
    expect(syntheticGoalie(artifact).means.SAVES_GOALIE).toBeCloseTo(11.44);
    expect(artifact.teamAccounting.officialGoalsForMean).toBe(2);
    expect(artifact.teamAccounting.officialGoalsAgainstMean).toBeCloseTo(2.48);
    expect(artifact.teamAccounting.guardedNetMinutesMean).toBeCloseTo(43.6);
    expect(artifact.unknownStarter.probabilityGivenGamePlayed).toBe(0.1);
    expect(artifact.unsupportedOutputs.jointDistribution.value).toBeNull();
  });

  it.each(invalidSyntheticGameForecasts())("rejects $name", ({ artifact, invariant }) => {
    expect(invariants(artifact)).toContain(invariant);
  });

  it.each([NaN, Infinity, -1])("rejects a non-finite or negative mean (%s)", value => {
    const artifact = syntheticGameForecast(); artifact.players[0].means.GOALS = value;
    expect(gameForecastContractSchema.safeParse(artifact).success).toBe(false);
  });

  it("rejects missing keys, invented outputs, unscoped timestamps and unsupported competitions", () => {
    const artifact = syntheticGameForecast();
    for (const value of [
      { ...artifact, contractVersion: "player-forecast-game-accounting-v1" },
      { ...artifact, competitionType: "postseason" }, { ...artifact, competitionType: "preseason" },
      { ...artifact, asOf: "2026-10-07T16:00:00" }, { ...artifact, toiUnit: "minutes" },
      { ...artifact, starterSelectionKind: "independent_bernoulli" },
      { ...artifact, unsupportedOutputs: { ...artifact.unsupportedOutputs,
        jointDistribution: { value: [1, 2], reason: "Covariance was mistaken for a joint distribution." } } },
      { ...artifact, players: [{ ...artifact.players[0], means: { GOALS: 0.36 } }, ...artifact.players.slice(1)] },
      { ...artifact, players: [{ ...artifact.players[0], means: { ...artifact.players[0].means, MADE_UP_HEAD: 0 } }, ...artifact.players.slice(1)] },
    ]) expect(gameForecastContractSchema.safeParse(value).success).toBe(false);
  });

  it("keeps per-game conditional start mass distinct from unconditional start probability", () => {
    const artifact = syntheticGameForecast();
    const starters = artifact.players.filter(player => player.population === "goalie")
      .reduce((sum, player) => sum + player.participation.pStart, artifact.unknownStarter.probabilityGivenGamePlayed);
    expect(starters).toBeCloseTo(1);
    expect(artifact.game.pGamePlayed * starters).toBeCloseTo(0.8);
    const goalie = syntheticGoalie(artifact);
    expect(goalie.participation.pStart).toBe(0.6);
    expect(goalie.startConfirmation.label).toBe("confirmed");
    expect(Date.parse(artifact.sources[2].firstReceivedAt)).toBeGreaterThan(Date.parse(artifact.modelCutoff));
    goalie.startConfirmation = { ...goalie.startConfirmation, label: "unknown", currentRevisionId: null, history: [] };
    expect(gameForecastContractSchema.safeParse(artifact).success).toBe(true);
    expect(goalie.participation.pStart).toBe(0.6);
  });

  it.each(["skater", "goalie"])("requires positive-minute probability to be within official statistical credit for a %s", population => {
    const artifact = syntheticGameForecast();
    if (population === "skater") artifact.players[0].participation.pPositiveMinutes = 0.95;
    else syntheticGoalie(artifact).participation.pGamePlayedCredited = 0;
    expect(invariants(artifact)).toContain("participation_exposure");
  });

  it.each([
    { target: "WINS_GOALIE" as const, played: 0.8 }, { target: "SHUTOUTS_GOALIE" as const, played: 0.8 },
    { target: "WINS_GOALIE" as const, played: 0 }, { target: "SHUTOUTS_GOALIE" as const, played: 0 },
  ])("bounds team $target separately under occurrence probability $played", ({ target, played }) => {
    const artifact = syntheticGameForecast({ pGamePlayed: played });
    for (const player of artifact.players) if (player.population === "goalie") {
      player.conditionalMeans![target] = 1;
      player.means[target] = played * (player.participation.pStart + player.participation.pReliefOnly);
      player.pOfficialShutoutEligibleGivenAppearance = 1;
    }
    if (played > 0) expect(syntheticGoalie(artifact).means[target]! + syntheticGoalie(artifact, 903).means[target]!).toBeCloseTo(0.84);
    expect(invariants(artifact)).toContain("team_goalie_outcomes");
  });

  it.each(["WINS_GOALIE", "SHUTOUTS_GOALIE"] as const)("includes supported residual %s in the team outcome bound", target => {
    const artifact = syntheticGameForecast();
    for (const player of artifact.players) if (player.population === "goalie") {
      player.conditionalMeans![target] = 0.95;
      player.means[target] = 0.8 * (player.participation.pStart + player.participation.pReliefOnly) * 0.95;
      player.pOfficialShutoutEligibleGivenAppearance = 1;
    }
    const residual = artifact.residualContributors[1];
    residual.conditionalGoalieOutcomeMeans![target] = 0.25;
    residual.goalieOutcomeMeans[target] = 0.02;
    delete residual.goalieOutcomeUnsupportedReasons[target];
    residual.pOfficialShutoutEligibleGivenAppearance = 1;
    residual.shutoutEligibilityRuleVersion = "synthetic-official-shutout-rule-v1";
    expect(invariants(artifact)).toContain("team_goalie_outcomes");
  });

  it("requires residual outcomes to retain appearance, unsupported-head and official-eligibility semantics", () => {
    const artifact = syntheticGameForecast(), residual = artifact.residualContributors[1];
    expect(residual.goalieOutcomeMeans.WINS_GOALIE).toBeNull();
    expect(residual.goalieOutcomeUnsupportedReasons.WINS_GOALIE).toBeTruthy();
    residual.conditionalGoalieOutcomeMeans!.WINS_GOALIE = 2; residual.goalieOutcomeMeans.WINS_GOALIE = 0.16;
    delete residual.goalieOutcomeUnsupportedReasons.WINS_GOALIE;
    expect(invariants(artifact)).toContain("residual_goalie_outcome");
    residual.conditionalGoalieOutcomeMeans!.WINS_GOALIE = 0.5; residual.goalieOutcomeMeans.WINS_GOALIE = 0.04;
    expect(gameForecastContractSchema.safeParse(artifact).success).toBe(true);
    residual.conditionalGoalieOutcomeMeans!.SHUTOUTS_GOALIE = 0.2; residual.goalieOutcomeMeans.SHUTOUTS_GOALIE = 0.016;
    delete residual.goalieOutcomeUnsupportedReasons.SHUTOUTS_GOALIE;
    expect(invariants(artifact)).toContain("official_shutout");
    residual.pOfficialShutoutEligibleGivenAppearance = 0.25;
    residual.shutoutEligibilityRuleVersion = "synthetic-official-shutout-rule-v1";
    expect(gameForecastContractSchema.safeParse(artifact).success).toBe(true);
    residual.goalieOutcomeUnsupportedReasons.SHUTOUTS_GOALIE = "Incorrectly still marked unsupported.";
    expect(invariants(artifact)).toContain("unsupported_head");
  });

  it("requires the unknown starter branch to fit within its residual goalie appearance mass", () => {
    const artifact = syntheticGameForecast();
    artifact.residualContributors[1].pGoalieAppearanceGivenGamePlayed = 0.09;
    expect(invariants(artifact)).toContain("participation_exposure");
  });

  it("retains a later revocation without rewriting the original confirmation or probabilities", () => {
    const artifact = syntheticGameForecast();
    artifact.sources.push({ ...artifact.sources[2], sourceId: "synthetic-correction", revisionId: "synthetic-report-v2",
      supersedesRevisionId: "synthetic-report-v1", publishedAt: "2026-10-07T15:58:00Z",
      firstReceivedAt: "2026-10-07T15:58:00Z", verifiedAt: "2026-10-07T15:58:00Z" });
    const confirmation = syntheticGoalie(artifact).startConfirmation;
    confirmation.label = "unknown"; confirmation.currentRevisionId = "confirmation-2";
    confirmation.history.push({ ...confirmation.history[0], revisionId: "confirmation-2", supersedesRevisionId: "confirmation-1",
      sourceId: "synthetic-correction", label: "unknown", verifiedAt: "2026-10-07T15:59:00Z" });
    expect(gameForecastContractSchema.safeParse(artifact).success).toBe(true);
    expect(confirmation.history[0].label).toBe("confirmed");
    expect(syntheticGoalie(artifact).participation.pStart).toBe(0.6);
    confirmation.currentRevisionId = "confirmation-1"; confirmation.label = "confirmed";
    expect(invariants(artifact)).toContain("confirmation_current");
  });

  it("downgrades expired confirmation and refuses unresolved contradictory reports", () => {
    const artifact = syntheticGameForecast();
    const goalie = syntheticGoalie(artifact);
    goalie.startConfirmation.history[0].expiresAt = "2026-10-07T15:59:00Z";
    goalie.startConfirmation.label = "stale";
    expect(gameForecastContractSchema.safeParse(artifact).success).toBe(true);
    goalie.startConfirmation.history[0].expiresAt = "2026-10-07T18:00:00Z";
    goalie.startConfirmation.label = "confirmed";
    artifact.sources[2].quality.conflict = "unresolved"; artifact.quality.conflict = "unresolved";
    expect(invariants(artifact)).toContain("confirmed_evidence");
  });

  it("keeps freshness, completeness, conflict and fallback independent", () => {
    const artifact = syntheticGameForecast();
    artifact.sources[1].quality = { freshness: "stale", completeness: "partial", conflict: "unresolved" };
    artifact.quality = { freshness: "stale", completeness: "partial", conflict: "unresolved" };
    artifact.fallback = { status: "applied", modelVersion: "synthetic-baseline-v1",
      reasonCodes: ["missing_input"], displayLabel: "Synthetic fallback with partial, stale, disputed inputs." };
    expect(gameForecastContractSchema.safeParse(artifact).success).toBe(true);
    artifact.quality.freshness = "fresh";
    expect(invariants(artifact)).toContain("quality_overclaim");
    artifact.quality.freshness = "stale"; artifact.fallback.modelVersion = null;
    expect(invariants(artifact)).toContain("fallback_lineage");
  });

  it("supports penalty-only official credit with zero minutes and undefined goalie ratios", () => {
    const artifact = syntheticGameForecast();
    const skater = artifact.players[0];
    skater.participation.pPositiveMinutes = 0;
    const oldGoals = skater.means.GOALS!;
    for (const key of GAME_FORECAST_TARGETS) {
      if (skater.means[key] === null) continue;
      skater.means[key] = 0; skater.conditionalMeans![key] = 0;
    }
    skater.conditionalMeans!.PENALTY_MINUTES = 1;
    skater.means.PENALTY_MINUTES = 0.72;
    artifact.teamAccounting.officialGoalsForMean -= oldGoals;
    expect(gameForecastContractSchema.safeParse(artifact).success).toBe(true);
    expect(skater.participation.pGamePlayedCredited).toBe(0.9);
    expect(skater.participation.pDress).toBe(0.95);
    expect(skater.means.TOTAL_TOI).toBe(0);
    expect(goalieRatioOfExpectations(skater.means).savePercentage.value).toBeNull();
  });

  it("allows undefined conditional means for a zero-appearance goalie and null zero-denominator ratios", () => {
    const artifact = syntheticGameForecast();
    const goalie = syntheticGoalie(artifact);
    artifact.teamAccounting.officialGoalsAgainstMean -= goalie.means.GOALS_AGAINST_GOALIE!;
    artifact.teamAccounting.opponentShotsOnGoalMean -= goalie.means.SHOTS_AGAINST_GOALIE!;
    artifact.teamAccounting.guardedNetMinutesMean -= goalie.means.TOTAL_TOI! / 60;
    goalie.participation = { conditioning: "given_game_played", pDress: 0, pPositiveMinutes: 0,
      pGamePlayedCredited: 0, pStart: 0, pReliefOnly: 0, pNoAppearance: 1 };
    goalie.conditionalMeans = null;
    goalie.conditionalGoalsWithoutShotMean = null; goalie.conditionalGoalsAgainstWithoutShotMean = null;
    for (const key of GAME_FORECAST_TARGETS) if (goalie.means[key] !== null) goalie.means[key] = 0;
    artifact.unknownStarter.probabilityGivenGamePlayed = 0.7;
    artifact.residualContributors[1].pGoalieAppearanceGivenGamePlayed = 0.7;
    // The evidence label is independent of late-change probability, including a zero model start.
    expect(gameForecastContractSchema.safeParse(artifact).success).toBe(true);
    const ratios = goalieRatioOfExpectations(goalie.means);
    expect(ratios.savePercentage.value).toBeNull(); expect(ratios.goalsAgainstAverage.value).toBeNull();
    expect(ratios.savePercentage.positiveDenominatorProbability).toBeNull();
    expect(ratios.savePercentage.expectedRealizedRatio).toBeNull();
  });

  it("keeps zero-GA personal performance distinct from official shutout credit and allows W plus SO", () => {
    const artifact = syntheticGameForecast();
    const goalie = syntheticGoalie(artifact);
    goalie.conditionalMeans!.WINS_GOALIE = 0.9; goalie.means.WINS_GOALIE = 0.468;
    goalie.conditionalMeans!.SHUTOUTS_GOALIE = 0.8; goalie.means.SHUTOUTS_GOALIE = 0.416;
    goalie.pOfficialShutoutEligibleGivenAppearance = 0.85;
    expect(gameForecastContractSchema.safeParse(artifact).success).toBe(true);
    expect(goalie.means.WINS_GOALIE! + goalie.means.SHUTOUTS_GOALIE!).toBeGreaterThan(0.52);
    const backup = syntheticGoalie(artifact, 903);
    expect(goalie.means.WINS_GOALIE! + goalie.means.SHUTOUTS_GOALIE! + backup.means.WINS_GOALIE!
      + backup.means.SHUTOUTS_GOALIE!).toBeGreaterThan(artifact.game.pGamePlayed);
    artifact.teamAccounting.officialGoalsAgainstMean -= goalie.means.GOALS_AGAINST_GOALIE!;
    goalie.conditionalMeans!.GOALS_AGAINST_GOALIE = 0; goalie.means.GOALS_AGAINST_GOALIE = 0;
    goalie.conditionalMeans!.SAVES_GOALIE = 24; goalie.means.SAVES_GOALIE = 12.48;
    goalie.conditionalMeans!.SHUTOUTS_GOALIE = 0; goalie.means.SHUTOUTS_GOALIE = 0;
    goalie.pOfficialShutoutEligibleGivenAppearance = 0;
    expect(gameForecastContractSchema.safeParse(artifact).success).toBe(true);
    expect(goalie.means.SHUTOUTS_GOALIE).toBe(0);
  });

  it("accounts for an exceptional non-shot award explicitly rather than increasing SA", () => {
    const artifact = syntheticGameForecast();
    const goalie = syntheticGoalie(artifact);
    goalie.conditionalMeans!.GOALS_AGAINST_GOALIE! += 0.5;
    goalie.means.GOALS_AGAINST_GOALIE! += 0.26;
    goalie.goalsAgainstWithoutShotMean = 0.26;
    goalie.conditionalGoalsAgainstWithoutShotMean = 0.5;
    artifact.teamAccounting.officialGoalsAgainstMean += 0.26;
    const skater = artifact.players[0];
    skater.conditionalMeans!.SHOTS_ON_GOAL = 0.2; skater.means.SHOTS_ON_GOAL = 0.144;
    skater.goalsWithoutShotMean = 0.216;
    skater.conditionalGoalsWithoutShotMean = 0.3;
    expect(gameForecastContractSchema.safeParse(artifact).success).toBe(true);
    goalie.goalsAgainstWithoutShotMean = 0;
    expect(invariants(artifact)).toContain("guarded_net_identity");
  });

  it.each([0, 0.8])("preserves the same non-shot exceptional-goal kernels with game occurrence %s", played => {
    const artifact = syntheticGameForecast({ pGamePlayed: played }), goalie = syntheticGoalie(artifact), skater = artifact.players[0];
    goalie.conditionalMeans!.GOALS_AGAINST_GOALIE = 2.5;
    goalie.conditionalGoalsAgainstWithoutShotMean = 0.5;
    goalie.goalsAgainstWithoutShotMean = played * 0.65 * 0.5;
    goalie.means.GOALS_AGAINST_GOALIE = played * 0.65 * 2.5;
    artifact.teamAccounting.officialGoalsAgainstMean += played * 0.65 * 0.5;
    skater.conditionalMeans!.SHOTS_ON_GOAL = 0.2; skater.means.SHOTS_ON_GOAL = played * 0.9 * 0.2;
    skater.conditionalGoalsWithoutShotMean = 0.3; skater.goalsWithoutShotMean = played * 0.9 * 0.3;
    expect(gameForecastContractSchema.safeParse(artifact).success).toBe(true);
    expect(goalie.conditionalMeans!.SHOTS_AGAINST_GOALIE).toBe(24);
    expect(goalie.conditionalMeans!.SAVES_GOALIE).toBe(22);
    expect(goalie.conditionalGoalsAgainstWithoutShotMean).toBe(0.5);
    if (played === 0) expect(goalie.goalsAgainstWithoutShotMean).toBe(0);
    else {
      goalie.goalsAgainstWithoutShotMean = 0;
      expect(invariants(artifact)).toContain("participation_integration");
    }
  });

  it("rejects duplicate players, mappings, residuals and broken source/correction histories", () => {
    const duplicate = syntheticGameForecast(); duplicate.players.push(duplicate.players[0]);
    expect(invariants(duplicate)).toContain("duplicate_player");
    const residual = syntheticGameForecast(); residual.residualContributors.push(residual.residualContributors[0]);
    expect(invariants(residual)).toContain("duplicate_residual");
    const source = syntheticGameForecast(); source.sources[1].supersedesRevisionId = "unretained-source";
    expect(invariants(source)).toContain("source_revision");
    const history = syntheticGameForecast(); syntheticGoalie(history).startConfirmation.history[0].supersedesRevisionId = "missing-confirmation";
    expect(invariants(history)).toContain("confirmation_history");
  });

  it("rejects overflow in team accounting instead of comparing Infinity as equal to a finite total", () => {
    const artifact = syntheticGameForecast();
    for (const residual of artifact.residualContributors) residual.goalsForMean = 1e308;
    artifact.teamAccounting.officialGoalsForMean = 1e308;
    expect(invariants(artifact)).toContain("team_accounting");
  });

  it("zeros every unconditional branch when the game cannot occur", () => {
    const artifact = syntheticGameForecast({ pGamePlayed: 0 });
    expect(gameForecastContractSchema.safeParse(artifact).success).toBe(true);
    expect(goalieRatioOfExpectations(syntheticGoalie(artifact).means).savePercentage.value).toBeNull();
    artifact.residualContributors[0].goalsForMean = 1; artifact.teamAccounting.officialGoalsForMean = 1;
    expect(invariants(artifact)).toContain("participation_integration");
  });

  it.each([
    { positive: 0, seconds: 1080, valid: false }, { positive: 0.1, seconds: 1080, valid: false },
    { positive: 0.8, seconds: 0, valid: false }, { positive: 0.1, seconds: 3900 * 0.1 / 0.9, valid: true },
  ])("checks conditional time with positive-minute probability $positive and $seconds seconds when occurrence is zero", ({ positive, seconds, valid }) => {
    const artifact = syntheticGameForecast({ pGamePlayed: 0 }), skater = artifact.players[0];
    skater.participation.pPositiveMinutes = positive;
    skater.conditionalMeans!.TOTAL_TOI = seconds;
    if (valid) expect(gameForecastContractSchema.safeParse(artifact).success).toBe(true);
    else expect(invariants(artifact)).toContain("minutes_exposure");
  });

  it.each([
    { minutes: 65, valid: false }, { minutes: 65 / 1.05, valid: true },
  ])("bounds the known goalie conditional time subtotal with $minutes minutes per appearance when occurrence is zero", ({ minutes, valid }) => {
    const artifact = syntheticGameForecast({ pGamePlayed: 0 });
    for (const player of artifact.players) if (player.population === "goalie") player.conditionalMeans!.TOTAL_TOI = minutes * 60;
    if (valid) expect(gameForecastContractSchema.safeParse(artifact).success).toBe(true);
    else expect(invariants(artifact)).toContain("team_accounting");
  });

  it("bounds hypothetical conditional time, wins and official shutouts even if the game cannot occur", () => {
    for (const [key, value, invariant] of [["TOTAL_TOI", 66 * 60, "minutes_exposure"],
      ["WINS_GOALIE", 1.1, "goalie_win"], ["SHUTOUTS_GOALIE", 0.3, "official_shutout"]] as const) {
      const artifact = syntheticGameForecast({ pGamePlayed: 0 });
      syntheticGoalie(artifact).conditionalMeans![key] = value;
      expect(invariants(artifact)).toContain(invariant);
    }
  });

  it("rejects supported scoring double-allocated to a residual", () => {
    const artifact = syntheticGameForecast();
    artifact.players[0].goalsResidualContributorId = "other-credited-scorers";
    expect(invariants(artifact)).toContain("scorer_coverage");
  });

  it("rejects goalie counts on a skater record that would bypass goalie participation/accounting", () => {
    const artifact = syntheticGameForecast(), skater = artifact.players[0];
    skater.means.SAVES_GOALIE = 1.44; skater.conditionalMeans!.SAVES_GOALIE = 2;
    delete skater.unsupportedReasons.SAVES_GOALIE;
    expect(invariants(artifact)).toContain("population_target");
  });
});

describe("explicit player-game aggregation", () => {
  const first = () => syntheticGameForecast();
  const second = () => syntheticGameForecast({ gameId: 900002, scheduledAt: "2026-10-10T23:00:00Z", firstGoalieShots: 60 });
  const aggregate = (artifacts: GameForecastContract[], gameIds = [900001, 900002], playerId = 902) =>
    aggregatePlayerGameMeans({ artifacts, gameIds, playerId });

  it("adds unconditional numerator/denominator means once, then derives the labeled ratio", () => {
    const result = aggregate([second(), first()]);
    expect(result.gameIds).toEqual([900001, 900002]);
    expect(result.componentForecastIds).toEqual(["synthetic-game-900001", "synthetic-game-900002"]);
    expect(result.means.SAVES_GOALIE).toBeCloseTo(41.6);
    expect(result.means.SHOTS_AGAINST_GOALIE).toBeCloseTo(43.68);
    expect(result.ratios!.savePercentage.value).toBeCloseTo(80 / 84);
    expect(result.ratios!.savePercentage.value).not.toBeCloseTo((22 / 24 + 58 / 60) / 2);
    expect(result.ratios!.savePercentage.kind).toBe("ratio_of_expectations");
    expect(result.ratios!.goalieMinutesMean).toBeCloseTo(52);
    expect(result.ratios!.goalsAgainstAverage.denominatorMean).toBeCloseTo(52);
    expect(result.ratios!.goalsAgainstAverage.value).toBeCloseTo(60 * 2.08 / 52);
  });

  it.each([
    { minutes: 50, expected: 1.2e308 }, { minutes: 25, expected: null },
  ])("handles derived GAA from finite large counts and $minutes conditional minutes", ({ minutes, expected }) => {
    const artifact = first(), goalie = syntheticGoalie(artifact);
    for (const key of ["GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE"] as const) {
      goalie.conditionalMeans![key] = 1e308; goalie.means[key] = 0.52e308;
    }
    goalie.conditionalMeans!.SAVES_GOALIE = 0; goalie.means.SAVES_GOALIE = 0;
    artifact.teamAccounting.officialGoalsAgainstMean = 0.52e308;
    artifact.teamAccounting.opponentShotsOnGoalMean = 0.52e308;
    artifact.teamAccounting.guardedNetMinutesMean += 0.52 * (minutes - 50);
    goalie.conditionalMeans!.TOTAL_TOI = minutes * 60; goalie.means.TOTAL_TOI = 0.52 * minutes * 60;
    expect(gameForecastContractSchema.safeParse(artifact).success).toBe(true);
    if (expected === null) expect(() => aggregate([artifact], [900001])).toThrow(/finite/);
    else {
      const value = aggregate([artifact], [900001]).ratios!.goalsAgainstAverage.value!;
      expect(Number.isFinite(value)).toBe(true);
      expect(value / expected).toBeCloseTo(1);
    }
  });

  it.each([0, 1e-309])("preserves ratios for a tiny denominator and numerator %s when the intermediate scale overflows", numerator => {
    const means = syntheticGoalie(first()).means;
    means.GOALS_AGAINST_GOALIE = numerator; means.TOTAL_TOI = 60e-309;
    means.SAVES_GOALIE = numerator; means.SHOTS_AGAINST_GOALIE = 1e-309;
    const ratios = goalieRatioOfExpectations(means);
    expect(ratios.savePercentage.value).toBeCloseTo(numerator === 0 ? 0 : 1);
    expect(ratios.goalsAgainstAverage.value).toBeCloseTo(numerator === 0 ? 0 : 60);
  });

  it("keeps a missing head null throughout aggregation and preserves its explanation", () => {
    const later = second(), goalie = syntheticGoalie(later);
    goalie.means.WINS_GOALIE = null; goalie.conditionalMeans!.WINS_GOALIE = null;
    goalie.unsupportedReasons.WINS_GOALIE = "No outcome head for this game.";
    const result = aggregate([first(), later]);
    expect(result.means.WINS_GOALIE).toBeNull();
    expect(result.unsupportedReasons.WINS_GOALIE).toContain("No outcome head for this game.");
    expect(aggregate([first(), second()], undefined, 901).ratios).toBeNull();
  });

  it.each([
    { name: "duplicate artifacts", artifacts: () => [first(), first()], gameIds: [900001, 900002] },
    { name: "missing selected game", artifacts: () => [first()], gameIds: [900001, 900002] },
    { name: "duplicate selected game", artifacts: () => [first(), second()], gameIds: [900001, 900001] },
    { name: "chronologically reversed horizon", artifacts: () => [first(), second()], gameIds: [900002, 900001] },
  ])("rejects $name instead of silently changing the horizon", ({ artifacts, gameIds }) => {
    expect(() => aggregate(artifacts(), gameIds)).toThrow();
  });

  it("refuses mixed as-of vintages, versions, mappings and absent players", () => {
    for (const key of ["modelVersion", "eventDefinitionVersion", "rulesVersion"] as const) {
      const later = second(); later[key] = "different-version";
      expect(() => aggregate([first(), later])).toThrow("same as-of");
    }
    const later = second(); later.asOf = "2026-10-07T16:00:30Z";
    expect(() => aggregate([first(), later])).toThrow("same as-of");
    const mapping = second(); syntheticGoalie(mapping).identity.mappingVersion = "other-mapping";
    expect(() => aggregate([first(), mapping])).toThrow("canonical player mapping");
    expect(() => aggregate([first(), second()], undefined, 999)).toThrow("Missing or duplicate");
  });

  it("validates unknown input before aggregation", () => {
    const artifact = syntheticGameForecast();
    expect(() => aggregatePlayerGameMeans({ artifacts: [{ ...artifact, use: "production" }], playerId: 902,
      gameIds: [900001] })).toThrow();
  });

  it("rejects overflow when individually valid finite game means sum to Infinity", () => {
    const gameIds = [900001, 900002, 900003];
    const artifacts = gameIds.map((gameId, index) => {
      const artifact = syntheticGameForecast({ gameId, scheduledAt: `2026-10-${String(8 + index).padStart(2, "0")}T23:00:00Z` });
      artifact.players[0].conditionalMeans!.HITS = 1e308; artifact.players[0].means.HITS = 0.72e308;
      expect(gameForecastContractSchema.safeParse(artifact).success).toBe(true);
      return artifact;
    });
    expect(() => aggregatePlayerGameMeans({ artifacts, playerId: 901, gameIds })).toThrow(/finite/);
  });
});
