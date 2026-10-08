import { describe, expect, it, vi } from "vitest";
import { buildNativePlayerGoalAccounting, buildNativeTeamGoalAccounting, buildNativeSkaterParticipationFields,
  selectConfirmedNativeSkaterCandidates, buildNativeRosterContributorCoverage, type NativeSkaterGoalRow, type NativeRosterSelection } from "./nativeGoalAccounting";
import type { BoardAssertion, DailyBoardEvidence } from "./dailyBoardEvidence";
import { computeShotsFromRate } from "./utils/number-utils";
import { runPerGameSkaterStage } from "./stages/skater-stage";
import { resolveSkaterRolloutConfig } from "./skaterRollout";

const producer = vi.hoisted(() => ({
  roster: (teamId: number) => Array.from({ length: 18 }, (_, index) => teamId * 100 + index + 1),
  playerWrites: vi.fn(async (rows: unknown[]) => rows.length),
  teamWrites: vi.fn(async (_row: unknown) => 1),
}));
vi.mock("lib/supabase/server", () => ({ default: { from: (table: string) => {
  if (!["players", "goalie_start_projections"].includes(table)) throw new Error(`Unexpected synthetic producer read: ${table}`);
  const data = table === "players" ? [10, 11].flatMap(teamId => producer.roster(teamId).map(id => ({ id, team_id: teamId, position: "C" }))) : [];
  const query = { select: () => query, in: () => query, eq: () => query, order: () => query, limit: () => query,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve) };
  return query;
} } }));
vi.mock("lib/NHL/server", () => ({ getSeasonById: async (id: number) => ({ id, startDate: "2026-10-01" }) }));
vi.mock("./starterBoardFlags", () => ({ starterBoardFlags: () => ({ compute: true }) }));
vi.mock("./queries/line-combo-queries", () => ({ fetchRecentTeamLineCombinations: async ({ teamId }: { teamId: number }) => [{
  gameId: 2026020001, teamId, forwards: producer.roster(teamId).filter(id => id !== 1018), defensemen: [], goalies: [], games: { date: "2026-10-06" },
}] }));
vi.mock("./queries/skater-queries", () => ({
  fetchCurrentRosterPlayerIds: async (teamId: number) => producer.roster(teamId),
  fetchRollingRows: async () => [], fetchSkaterRecencyEvents: async () => new Map(),
  fetchLatestWgoSkaterDeploymentProfiles: async () => new Map(),
  fetchLatestSkaterContextProfiles: async () => ({ shotQuality: new Map(), onIceContext: new Map() }),
  fetchLatestSkaterTrendAdjustments: async () => ({ adjustments: new Map(), diagnostics: {
    eligibleRows: 0, playersWithRows: 0, playersAdjusted: 0, playersMissingRows: 18, playersNeutralizedByRecency: 0,
    selectedSoftStaleRows: 0, selectedHardStaleRows: 0, fetchFailed: false,
  } }),
}));
vi.mock("./queries/goalie-queries", async importOriginal => ({
  ...await importOriginal<typeof import("./queries/goalie-queries")>(), fetchOpponentGoalieContextForGame: async () => null,
}));
vi.mock("./seasonBootstrap", async importOriginal => ({
  ...await importOriginal<typeof import("./seasonBootstrap")>(),
  loadSeasonBootstrap: async (ids: number[]) => new Map(ids.map(id => [id, { previous: { PP_TOI: 2 }, fantasy: {},
    currentSeasonGames: 0, historyGames: 1, sourceIds: [], sourceRowIds: [], limitations: ["Synthetic mechanics fixture"] }])),
  bootstrapSkaterLine: () => ({ goalsEs: 0.3334, goalsPp: 0.1114, assistsEs: 0.5, assistsPp: 0.2,
    shotsEs: 2, shotsPp: 1, hits: 1, blocks: 1, disclosure: { fantasyWeight: 0.6, historyWeight: 0.4 } }),
}));
vi.mock("./stages/persistence-stage", () => ({
  persistForgePlayerProjectionRows: producer.playerWrites, persistForgeTeamProjection: producer.teamWrites,
  persistForgeGoalieProjection: vi.fn(), persistPerGameAnalyticsOutputs: vi.fn(),
}));

// Invented serialized producer rows: mechanics only, never real-game acceptance.
function player(playerId = 100, overrides: Partial<NativeSkaterGoalRow> = {}): NativeSkaterGoalRow {
  return {
    player_id: playerId, game_id: 900001, team_id: 10, as_of_date: "2026-10-07", horizon_games: 1,
    proj_goals_es: 0.4, proj_goals_pp: 0.1, proj_goals_pk: null,
    uncertainty: { model: { skater_selection: { production_conditioning: "conditional_playing",
      participation: { version: "skater-participation-v1", probability: 1, status: "confirmed_evidence", evidenceIds: ["synthetic-lineup"] } } } },
    ...overrides,
  };
}
function team(playerRows: NativeSkaterGoalRow[], currentRosterPlayerIds = playerRows.map(row => row.player_id)) {
  return buildNativeTeamGoalAccounting({ gameId: 900001, teamId: 10, asOfDate: "2026-10-07", horizonGames: 1,
    currentRosterPlayerIds, playerRows });
}

function assertion(overrides: Partial<BoardAssertion> = {}): BoardAssertion {
  return { gameId: 900001, teamId: 10, playerId: 100, dimension: "ev", value: "L1", evidenceId: "synthetic-confirmed-lineup",
    sourceKey: "synthetic-reporter", sourceUrl: null, publishedAt: "2026-10-07T18:00:00Z", receivedAt: "2026-10-07T18:01:00Z",
    confirmed: true, ...overrides };
}

describe("native participation and fresh candidate mapping", () => {
  const identity = { gameId: 900001, teamId: 10, playerId: 100, compute: true };
  it("exports the supported 0/1 scalar consistently and distinguishes missing inputs from missing evidence", () => {
    expect(buildNativeSkaterParticipationFields(identity)).toMatchObject({ participation_probability: null, participation_reason: "participation_evidence_not_loaded" });
    expect(buildNativeSkaterParticipationFields({ ...identity, evidence: { assertions: [], conflicts: [] } }))
      .toMatchObject({ participation_probability: null, participation_reason: "missing_same_day_participation_evidence" });
    expect(buildNativeSkaterParticipationFields({ ...identity, evidence: { assertions: [assertion()], conflicts: [] } }))
      .toMatchObject({ participation_probability: 1, participation_reason: null });
    expect(buildNativeSkaterParticipationFields({ ...identity, evidence: { assertions: [assertion({ dimension: "availability", value: "out" })], conflicts: [] } }))
      .toMatchObject({ participation_probability: 0, participation_reason: null });
    expect(buildNativeSkaterParticipationFields({ ...identity, compute: false, evidence: { assertions: [assertion()], conflicts: [] } }).participation_probability).toBeNull();
  });
  it("scopes assertions to both game and team, preserving unknowns for historical roster-only candidates", () => {
    const fields = buildNativeSkaterParticipationFields({ ...identity, evidence: {
      assertions: [assertion({ teamId: 11 }), assertion({ gameId: 900002 })],
      conflicts: [{ gameId: 900001, teamId: 11, playerId: 100, dimension: "ev", evidenceIds: ["synthetic-foreign-conflict"] }] } });
    expect(fields).toMatchObject({ participation_probability: null, same_day_evidence: { assertions: [], conflicts: [] } });
  });
  it("preserves unknowns for contradictory confirmed appearance and exclusion, and team availability conflicts", () => {
    expect(buildNativeSkaterParticipationFields({ ...identity, evidence: { assertions: [assertion(),
      assertion({ dimension: "availability", value: "out" })], conflicts: [] } }))
      .toMatchObject({ participation_probability: null, participation_reason: "conflicting_participation_assertions" });
    expect(buildNativeSkaterParticipationFields({ ...identity, evidence: { assertions: [assertion()],
      conflicts: [{ gameId: 900001, teamId: 10, playerId: null, dimension: "availability", evidenceIds: ["synthetic-team-conflict"] }] } }))
      .toMatchObject({ participation_probability: null, participation_reason: "conflicting_participation_evidence" });
  });
  it("keeps PP conflicts visible without invalidating confirmed appearance, but blocks EV/availability conflicts", () => {
    const evidence: DailyBoardEvidence = { assertions: [assertion()], conflicts: [{ gameId: 900001, teamId: 10, playerId: 100, dimension: "pp", evidenceIds: ["synthetic-pp-conflict"] }] };
    const fields = buildNativeSkaterParticipationFields({ ...identity, evidence });
    expect(fields.participation_probability).toBe(1);
    expect(fields.same_day_evidence!.conflicts).toHaveLength(1);
    const row = player(); row.uncertainty!.model!.skater_selection = fields;
    expect(buildNativePlayerGoalAccounting(row).expectedEsPpMeanGivenGamePlayed).toBe(0.5);
    evidence.conflicts[0].dimension = "ev";
    expect(buildNativeSkaterParticipationFields({ ...identity, evidence })).toMatchObject({ participation_probability: null, participation_reason: "conflicting_participation_evidence" });
    row.uncertainty!.model!.skater_selection = buildNativeSkaterParticipationFields({ ...identity, evidence });
    expect(buildNativePlayerGoalAccounting(row).expectedEsPpMeanGivenGamePlayed).toBeNull();
  });
  it("preserves team goalie-conflict provenance without suppressing independently confirmed skater appearance", () => {
    const evidence: DailyBoardEvidence = { assertions: [assertion()], conflicts: [
      { gameId: 900001, teamId: 10, playerId: null, dimension: "goalie", evidenceIds: ["synthetic-team-goalie-conflict"] },
    ] };
    const fields = buildNativeSkaterParticipationFields({ ...identity, evidence });
    const row = player(); row.uncertainty!.model!.skater_selection = fields;
    const originalProvenance = JSON.stringify(row.uncertainty);
    expect(fields).toMatchObject({ participation_probability: 1, participation_reason: null,
      same_day_evidence: { conflicts: evidence.conflicts } });
    const accounted = buildNativePlayerGoalAccounting(row);
    expect(accounted).toMatchObject({ participationProbabilityGivenGamePlayed: 1,
      participationReason: null, expectedEsPpMeanGivenGamePlayed: 0.5, fullGameEligible: false });
    expect(accounted.reasons).not.toContain("unknown_participation");
    expect(JSON.stringify(row.uncertainty)).toBe(originalProvenance);
  });
  it("adds a same-day confirmed current skater omitted from historical lines without treating role/news as appearance", () => {
    const args = { gameId: 900001, teamId: 10, candidatePlayerIds: [100], currentRosterPlayerIds: [100, 101, 102, 103], evidence: {
      assertions: [assertion({ playerId: 101 }), assertion({ playerId: 102, dimension: "pp", value: "PP1" }),
        assertion({ playerId: 103, dimension: "availability", value: "return" }), assertion({ playerId: 104 })], conflicts: [],
    } };
    expect(selectConfirmedNativeSkaterCandidates(args)).toEqual([100, 101]);
    expect(selectConfirmedNativeSkaterCandidates({ ...args, evidence: undefined })).toEqual([100]);
    expect(selectConfirmedNativeSkaterCandidates({ ...args, evidence: { assertions: args.evidence.assertions,
      conflicts: [{ gameId: 900001, teamId: 10, playerId: 101, dimension: "ev", evidenceIds: ["synthetic-conflict"] }] } })).toEqual([100]);
  });
});

describe("native player goal accounting", () => {
  it("retains a conditional partial mean and integrates the existing evidence once, given game occurrence", () => {
    const accounted = buildNativePlayerGoalAccounting(player());
    expect(accounted).toMatchObject({ unit: "expected_goal_count", scope: "one_game",
      reportedComponents: { esMean: 0.4, ppMean: 0.1, pkMean: null }, reportedEsPpMean: 0.5,
      conditionalEsPpMean: 0.5, participationProbabilityGivenGamePlayed: 1, expectedEsPpMeanGivenGamePlayed: 0.5,
      gameOccurrenceProbability: null, fullOfficialPlayMean: null, unconditionalMean: null, fullGameEligible: false,
      rollingHistoryGameDateBefore: "2026-10-07", informationCutoffAt: null });
    expect(accounted.reasons).toEqual(expect.arrayContaining(["missing_native_pk_goal_estimator", "unproved_regulation_strength_partition",
      "unproved_overtime_accounting", "unproved_empty_net_accounting", "unproved_shootout_exclusion", "unproved_information_cutoff"]));
    expect(accounted.ordinaryRegulation).toEqual({ esMean: null, ppMean: null, pkMean: null });
    expect(accounted.overtimeMean).toBeNull();
    expect(accounted.emptyNetMean).toBeNull();
  });

  it("keeps a supported exclusion zero distinct from unknown participation", () => {
    const out = player();
    const selection = out.uncertainty!.model!.skater_selection!;
    selection.participation = { version: "skater-participation-v1", probability: 0, status: "confirmed_evidence", evidenceIds: ["synthetic-out"] };
    expect(buildNativePlayerGoalAccounting(out)).toMatchObject({ conditionalEsPpMean: 0.5, expectedEsPpMeanGivenGamePlayed: 0 });
    selection.participation = null;
    expect(buildNativePlayerGoalAccounting(out)).toMatchObject({ conditionalEsPpMean: 0.5,
      participationProbabilityGivenGamePlayed: null, expectedEsPpMeanGivenGamePlayed: null });
  });

  it("does not manufacture fractional probabilities or integrate conflicting evidence", () => {
    const row = player();
    const selection = row.uncertainty!.model!.skater_selection!;
    selection.participation = { version: "skater-participation-v1", probability: 0.5, status: "confirmed_evidence", evidenceIds: ["synthetic-invalid"] };
    expect(buildNativePlayerGoalAccounting(row).expectedEsPpMeanGivenGamePlayed).toBeNull();
    selection.participation = { version: "skater-participation-v1", probability: 1, status: "confirmed_evidence", evidenceIds: ["synthetic-lineup"] };
    selection.same_day_evidence = { conflicts: [{ dimension: "ev" }] };
    expect(buildNativePlayerGoalAccounting(row).expectedEsPpMeanGivenGamePlayed).toBeNull();
  });

  it("never interprets legacy availability adjustments as unconditional or conditional-on-playing means", () => {
    const row = player();
    row.uncertainty!.model!.skater_selection!.production_conditioning = "legacy_availability_adjusted";
    expect(buildNativePlayerGoalAccounting(row)).toMatchObject({ reportedBasis: "legacy_unclassified", reportedEsPpMean: 0.5,
      conditionalEsPpMean: null, expectedEsPpMeanGivenGamePlayed: null, unconditionalMean: null });
    expect(buildNativePlayerGoalAccounting(row).reasons).toContain("legacy_availability_is_not_participation");
  });

  it("does not divide a scaled horizon into an invented player-game mean", () => {
    const accounted = buildNativePlayerGoalAccounting(player(100, { horizon_games: 3, proj_goals_es: 1.2, proj_goals_pp: 0.3 }));
    expect(accounted).toMatchObject({ scope: "scaled_horizon", reportedEsPpMean: 1.5,
      conditionalEsPpMean: null, participationProbabilityGivenGamePlayed: null,
      participationReason: "scaled_horizon_is_not_a_player_game", expectedEsPpMeanGivenGamePlayed: null });
    expect(accounted.reasons).toContain("scaled_horizon_is_not_a_player_game");
  });

  it("discloses all-strength-minus-PP bootstrap contamination without declaring PK, OT or EN zero", () => {
    const row = player();
    const selection = row.uncertainty!.model!.skater_selection!;
    selection.season_bootstrap = { fantasyWeight: 0.6, historyWeight: 0.4 };
    const accounted = buildNativePlayerGoalAccounting(row);
    expect(accounted.esBucketDefinition).toBe("bootstrap_all_strength_minus_pp_blend");
    expect(accounted.reasons).toContain("bootstrap_all_strength_minus_pp_is_not_regulation_es");
    expect(accounted.reportedComponents.pkMean).toBeNull();
    selection.season_bootstrap = { fantasyWeight: 0, historyWeight: 0 };
    expect(buildNativePlayerGoalAccounting(row).esBucketDefinition).toBe("native_ev_rate_on_reconciled_shots");
  });

  it("uses seconds of exposure with SOG per sixty minutes and goals per shot", () => {
    const shots = computeShotsFromRate(600, 6);
    expect(shots).toBe(1);
    expect(buildNativePlayerGoalAccounting(player(100, { proj_goals_es: shots * 0.1, proj_goals_pp: 0 })).reportedEsPpMean).toBe(0.1);
  });

  it.each([-0.1, NaN, Infinity, 0.3334])("rejects invalid or unserialized means instead of zero-filling: %s", value => {
    expect(() => buildNativePlayerGoalAccounting(player(100, { proj_goals_es: value }))).toThrow();
  });
  it("rejects a fabricated native PK output and arithmetic overflow", () => {
    expect(() => buildNativePlayerGoalAccounting({ ...player(), proj_goals_pk: 0 } as unknown as NativeSkaterGoalRow)).toThrow();
    expect(() => buildNativePlayerGoalAccounting(player(100, { proj_goals_es: Number.MAX_VALUE, proj_goals_pp: Number.MAX_VALUE }))).toThrow(/overflow/);
  });
});

describe("native team contributor reconciliation", () => {
  it("separates known goalies, unevaluated roster members, stale rates and eligible omissions without assigning zero residuals", () => {
    const rosterSelection: NativeRosterSelection = { candidatePlayerIds: [100, 103, 104], eligiblePlayerIds: [100, 104], unavailablePlayerIds: [],
      knownGoaliePlayerIds: [101], playerMetaById: new Map([100, 103, 104].map(id => [id, { team_id: 10, position: "C" }])),
      excludedPlayerIds: { teamOrPosition: [], missingRecentMetrics: [], hardStale: [103], invalidSeasonEvidence: [] },
      compute: true, evidence: { assertions: [], conflicts: [] } };
    const accounted = team([player()], [100, 101, 102, 103, 104]);
    const covered = buildNativeRosterContributorCoverage({ gameId: 900001, teamId: 10,
      currentRosterPlayerIds: [100, 101, 102, 103, 104], projectedPlayerIds: [100], selection: rosterSelection });
    expect(covered).toMatchObject({ unmodeledGoaliePlayerIds: [101], unevaluatedRosterPlayerIds: [102], eligibleUnprojectedSkaterPlayerIds: [104],
      unknownResidualPlayerIds: [101, 102, 103, 104], residualMean: null, contributors: [
        { playerId: 100, population: "skater", selectionReason: "projected_partial_skater", rateEligibility: "passed" },
        { playerId: 101, population: "goalie", selectionReason: "outside_skater_estimator", goalContributionStatus: "unknown" },
        { playerId: 102, population: "position_unverified", selectionReason: "outside_candidate_pool", rateEligibility: "not_evaluated" },
        { playerId: 103, population: "skater", selectionReason: "hard_stale_rate_history", participationProbabilityGivenGamePlayed: null },
        { playerId: 104, population: "skater", selectionReason: "eligible_skater_not_projected" },
      ] });
    expect(accounted.unmodeledRosterPlayerIds).toEqual([101, 102, 103, 104]);
    expect(accounted.fullOfficialPlayMean).toBeNull();
    expect(accounted.fullGameEligible).toBe(false);
    expect(() => buildNativeRosterContributorCoverage({ gameId: 900001, teamId: 10,
      currentRosterPlayerIds: [100], projectedPlayerIds: [100], selection: { ...rosterSelection, knownGoaliePlayerIds: [100] } })).toThrow("identified as a goalie");
    const confirmedOut = buildNativeRosterContributorCoverage({ gameId: 900001, teamId: 10,
      currentRosterPlayerIds: [100, 101, 102, 103, 104], projectedPlayerIds: [100], selection: { ...rosterSelection,
        evidence: { assertions: [assertion({ playerId: 102, dimension: "availability", value: "out" })], conflicts: [] } } });
    expect(confirmedOut.contributors.find(row => row.playerId === 102))
      .toMatchObject({ participationProbabilityGivenGamePlayed: 0, goalContributionStatus: "confirmed_out_given_game_played", fullOfficialPlayMean: null });
    expect(confirmedOut.unknownResidualPlayerIds).toEqual([101, 103, 104]);
    expect(confirmedOut.residualMean).toBeNull();
  });
  it("sums reported rounded player components rather than independently rounding the raw team mean", () => {
    const raw = 0.3334;
    const rows = [100, 101].map(id => player(id, { proj_goals_es: Number(raw.toFixed(3)), proj_goals_pp: 0 }));
    const accounted = team(rows);
    expect(Number((raw * 2).toFixed(3))).toBe(0.667);
    expect(accounted.reportedComponents).toEqual({ esMean: 0.666, ppMean: 0, pkMean: null });
    expect(accounted.sumOfPlayerConditionalEsPpMeans).toBe(0.666);
    expect(accounted.expectedListedEsPpMeanGivenGamePlayed).toBe(0.666);
    expect(accounted.fullOfficialPlayMean).toBeNull();
    expect(accounted.fullGameEligible).toBe(false);
  });

  it("sums integrated contributor means once and preserves an unknown contributor", () => {
    const out = player(101);
    out.uncertainty!.model!.skater_selection!.participation = {
      version: "skater-participation-v1", probability: 0, status: "confirmed_evidence", evidenceIds: ["synthetic-out"] };
    expect(team([player(), out])).toMatchObject({ reportedEsPpMean: 1, sumOfPlayerConditionalEsPpMeans: 1,
      expectedListedEsPpMeanGivenGamePlayed: 0.5, residualMean: null, unconditionalMean: null });
    out.uncertainty!.model!.skater_selection!.participation = null;
    expect(team([player(), out]).expectedListedEsPpMeanGivenGamePlayed).toBeNull();
  });

  it("names unmodeled roster members without treating them or goalie scoring as zero residuals", () => {
    const accounted = team([player()], [100, 101, 102]);
    expect(accounted).toMatchObject({ projectedPlayerIds: [100], unmodeledRosterPlayerIds: [101, 102],
      residualMean: null, fullOfficialPlayMean: null, fullGameEligible: false });
    expect(accounted.reasons).toEqual(expect.arrayContaining(["unknown_residual_scorers", "unproved_game_time_roster", "unproved_goalie_scoring"]));
    expect(team([player(103)], [100]).unexpectedProjectedPlayerIds).toEqual([103]);
    expect(team([])).toMatchObject({ reportedEsPpMean: 0, expectedListedEsPpMeanGivenGamePlayed: null, fullOfficialPlayMean: null });
  });

  it("rejects duplicate contributors, substituted scope and malformed current rosters", () => {
    expect(() => team([player(), player()])).toThrow();
    for (const overrides of [{ game_id: 900002 }, { team_id: 11 }, { horizon_games: 2 }, { as_of_date: "2026-10-08" }]) {
      expect(() => team([player(100, overrides)])).toThrow();
    }
    expect(() => team([player()], [100, 100])).toThrow();
    expect(() => team([player()], [-1])).toThrow();
    expect(() => team([player(100, { proj_goals_es: Number.MAX_VALUE, proj_goals_pp: 0 }),
      player(101, { proj_goals_es: Number.MAX_VALUE, proj_goals_pp: 0 })])).toThrow(/overflow/);
  });
});

describe("native skater-stage accounting integration", () => {
  it("writes reconciled serialized goal components and keeps the synthetic full-team endpoint ineligible", async () => {
    const asOfDate = "2026-10-07";
    const cached = <T>(value: T) => new Map([10, 11].map(teamId => [`${teamId}:${asOfDate}`, value]));
    const teamGoalsByTeamId = new Map<number, number>();
    const result = await runPerGameSkaterStage({
      seasonBootstrap: true, asOfDate, runId: "synthetic-native-goal-accounting", horizonGames: 1,
      game: { id: 2026020002, date: asOfDate, homeTeamId: 10, awayTeamId: 11 },
      deadlineMs: Date.now() + 30_000, currentSeasonId: 20262027,
      skaterRollout: resolveSkaterRolloutConfig("baseline"),
      teamAbbreviationById: new Map(), playerAvailabilityMultiplier: new Map(), availabilityEventByPlayer: new Map(), roleEventByPlayer: new Map(),
      goalieOverrideByTeamId: new Map(), activeRosterSkaterIdsByTeamId: new Map([10, 11].map(id => [id, producer.roster(id)])),
      teamHorizonScalarsCache: cached([1]), teamSkaterRoleHistoryCache: cached(new Map()),
      teamShotsByTeamId: new Map(), teamGoalsByTeamId, fallbackGoalieByTeamId: new Map([[10, null], [11, null]]),
      teamGoalieStarterContextCache: cached({ startsByGoalie: new Map(), lastPlayedDateByGoalie: new Map(), totalGames: 0,
        previousGameDate: null, previousGameStarterGoalieId: null }),
      teamDefensiveEnvironmentCache: new Map(), teamOffenseEnvironmentCache: new Map(), teamRestDaysCache: cached(null),
      teamStrengthPriorCache: cached(null), teamStrengthCache: cached({ toiEsSecondsAvg: 15000, toiPpSecondsAvg: 3000, shotsEsAvg: 36, shotsPpAvg: 18 }),
      teamFiveOnFiveProfileCache: cached(null), teamNstExpectedGoalsCache: cached(null), teamLineComboGoaliePriorCache: cached(new Map()),
      currentTeamGoalieIdsCache: cached(new Set()), playerPropContextByGamePlayerKey: new Map(), playerPredictionOutputRows: [], modelMarketFlagRows: [],
      goalieCandidates: [], learningCounters: { players: 0, goalRecent: 0, assistRecent: 0 }, metrics: { data_quality: {}, warnings: [] },
      dailyBoardEvidence: { assertions: [assertion({ gameId: 2026020002, playerId: 1018, value: "L4" })],
        conflicts: [{ gameId: 2026020002, teamId: 10, playerId: 1018, dimension: "pp", evidenceIds: ["synthetic-pp-conflict"] }] },
    });
    expect(result).toEqual({ timedOut: false, playerRowsUpserted: 36, teamRowsUpserted: 2 });
    expect(producer.playerWrites).toHaveBeenCalledTimes(2);
    const added = producer.playerWrites.mock.calls[0][0].find((row: any) => row.player_id === 1018) as any;
    expect(added.uncertainty.model.skater_selection).toMatchObject({ participation_probability: 1, participation_reason: null });
    expect(added.uncertainty.native_goal_accounting).toMatchObject({ participationProbabilityGivenGamePlayed: 1, expectedEsPpMeanGivenGamePlayed: 0.444 });
    for (let index = 0; index < 2; index++) {
      const rows = producer.playerWrites.mock.calls[index][0] as Array<NativeSkaterGoalRow & { uncertainty: { native_goal_accounting: unknown } }>;
      const written = producer.teamWrites.mock.calls[index][0] as Record<string, any>;
      expect(written).toMatchObject({ proj_goals_es: 5.994, proj_goals_pp: 1.998, proj_goals_pk: null });
      expect(written.proj_goals_es).toBe(Number(rows.reduce((sum, row) => sum + row.proj_goals_es, 0).toFixed(3)));
      expect(written.proj_goals_es).not.toBe(Number((18 * 0.3334).toFixed(3)));
      expect(teamGoalsByTeamId.get(written.team_id)).toBe(7.992);
      expect(teamGoalsByTeamId.get(written.team_id)).toBe(written.uncertainty.native_goal_accounting.reportedEsPpMean);
      expect(teamGoalsByTeamId.get(written.team_id)).toBe(Number((written.proj_goals_es + written.proj_goals_pp).toFixed(3)));
      expect(teamGoalsByTeamId.get(written.team_id)).not.toBe(Number((18 * (0.3334 + 0.1114)).toFixed(3)));
      expect(written.uncertainty.native_goal_accounting).toMatchObject({ fullGameEligible: false, fullOfficialPlayMean: null,
        expectedListedEsPpMeanGivenGamePlayed: null, residualMean: null });
      expect(written.uncertainty.native_roster_contributor_coverage).toMatchObject({
        version: "native-roster-contributor-coverage-v1", eligibleUnprojectedSkaterPlayerIds: [], residualMean: null,
      });
      expect(written.uncertainty.native_roster_contributor_coverage.contributors).toHaveLength(18);
      expect(rows[0].uncertainty.native_goal_accounting).toMatchObject({ reportedComponents: { esMean: 0.333, ppMean: 0.111, pkMean: null },
        esBucketDefinition: "bootstrap_all_strength_minus_pp_blend", expectedEsPpMeanGivenGamePlayed: null, fullGameEligible: false });
    }
  });
});
