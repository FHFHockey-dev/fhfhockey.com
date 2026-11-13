import { describe, expect, it, vi } from "vitest";

import { STARTER_DECISION_SHARE } from "./goalie/goalieOutcomes";
import { getGoalieForgePipelineSpec } from "./goaliePipeline";
import { runPerGameGoalieStage } from "./stages/goalie-stage";
import { readGoalieCandidatesContract } from "./goalie/goalieCandidates";
import { boardGoalieForecast } from "./starterBoardScoring";
import { resolveDailyBoardEvidence, type BoardAssertion, type DailyBoardEvidence } from "./dailyBoardEvidence";

const fixtureWrites = vi.hoisted(() => vi.fn(async (_row: Record<string, unknown>) => 1));
vi.mock("./stages/persistence-stage", () => ({ persistForgeGoalieProjection: fixtureWrites }));
vi.mock("./starterBoardFlags", () => ({ starterBoardFlags: () => ({ compute: true }) }));
vi.mock("lib/supabase/server", () => ({ default: { from: () => { throw new Error("Unexpected fixture database read"); } } }));

describe("goalie pipeline spec", () => {
  it("has strict stage ordering and dependency references", () => {
    const spec = getGoalieForgePipelineSpec();
    expect(spec.version).toBe("goalie-forge-pipeline-v2");
    expect(spec.stages).toHaveLength(8);

    const orders = spec.stages.map((s) => s.order);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    const ids = new Set(spec.stages.map((s) => s.id));
    for (const stage of spec.stages) {
      for (const dep of stage.depends_on) {
        expect(ids.has(dep)).toBe(true);
      }
    }
  });

  it("keeps the canonical v2 goalie writer as the only pipeline writer route", () => {
    const spec = getGoalieForgePipelineSpec();
    const writerStage = spec.stages.find((stage) => stage.id === "goalie_start_priors_v2");

    expect(writerStage?.endpoint).toBe("/api/v1/db/update-goalie-projections-v2");
    expect(
      spec.stages.some((stage) => stage.endpoint === "/api/v1/db/update-goalie-projections")
    ).toBe(false);
  });
});

// Fictional source/identity fixtures exercise the producer; no real confirmation is asserted.
describe("goalie producer confirmation evidence", () => {
  const date = "2026-10-10", cutoff = "2026-10-10T18:02:00Z";
  const game = { id: 2026029999, date, homeTeamId: 10, awayTeamId: 11 };
  const assertion = (changed: Partial<BoardAssertion> = {}): BoardAssertion => ({
    gameId: game.id, teamId: 10, playerId: 100, dimension: "goalie", value: "confirmed", confirmed: true,
    evidenceId: "synthetic-confirmation", sourceKey: "synthetic-reporter", sourceUrl: "https://example.invalid/confirmation",
    publishedAt: "2026-10-10T18:00:00Z", receivedAt: "2026-10-10T18:01:00Z", ...changed,
  });
  const evidence = (assertions = [assertion()]): DailyBoardEvidence => ({ informationCutoffAt: cutoff, assertions, conflicts: [] });
  async function run(source?: DailyBoardEvidence, options: {
    probability?: number; override?: boolean; cutoffAt?: string | null; horizon?: number; goalsFor?: number | null; opponentGoalsFor?: number | null;
    weakerBackup?: boolean; shotsPk?: number | null;
  } = {}) {
    const probability = options.probability ?? 0.8;
    const cache = <T,>(value: T) => new Map([[`10:${date}`, value], [`11:${date}`, value]]);
    const goalieHistory = { recentStarts: 10, recentShotsAgainst: 300, recentGoalsAllowed: 24,
      seasonStarts: 20, seasonShotsAgainst: 600, seasonGoalsAllowed: 50,
      baselineStarts: 60, baselineShotsAgainst: 1800, baselineGoalsAllowed: 162, residualStdDev: 1 };
    const args: Parameters<typeof runPerGameGoalieStage>[0] = {
      asOfDate: date, runId: "synthetic-goalie-run", horizonGames: options.horizon ?? 1, game, deadlineMs: Date.now() + 30000,
      dailyBoardEvidence: source, evidenceCutoffAt: options.cutoffAt === undefined ? cutoff : options.cutoffAt,
      goalieCandidates: [{ teamId: 10, opponentTeamId: 11, candidateGoalieIds: [100, 101],
        priorStartProbByGoalieId: new Map([[100, probability], [101, 1 - probability]]),
        // A legacy boolean without a scoped receipt cannot confirm either player.
        confirmedStarterByGoalieId: new Map([[100, true], [101, true]]),
        lineComboPriorByGoalieId: new Map(), projectedGsaaPer60ByGoalieId: new Map(),
        seasonStartPctByGoalieId: new Map(), seasonGamesPlayedByGoalieId: new Map(),
        override: options.override === false ? null : { goalieId: 100, starterProb: probability },
      }],
      teamShotsByTeamId: new Map([[11, { shotsEs: 25, shotsPp: 5, ...("shotsPk" in options ? { shotsPk: options.shotsPk } : {}) }]]), teamGoalsByTeamId: new Map([
        ...(options.goalsFor === null ? [] : [[10, options.goalsFor ?? 3] as [number, number]]),
        ...(options.opponentGoalsFor === null ? [] : [[11, options.opponentGoalsFor ?? 3] as [number, number]]),
      ]),
      teamAbbreviationById: new Map(), teamStrengthPriorCache: cache(null), teamFiveOnFiveProfileCache: cache(null),
      teamNstExpectedGoalsCache: cache(null), teamDefensiveEnvironmentCache: cache({ avgShotsAgainstLast10: null, avgShotsAgainstLast5: null }),
      teamOffenseEnvironmentCache: cache({ avgShotsForLast10: null, avgShotsForLast5: null, avgGoalsForLast10: null, avgGoalsForLast5: null }),
      teamRestDaysCache: cache(null), teamGoalieStarterContextCache: cache({ startsByGoalie: new Map([[100, 1], [101, 1]]),
        lastPlayedDateByGoalie: new Map(), totalGames: 2, previousGameDate: null, previousGameStarterGoalieId: null }),
      goalieEvidenceCache: new Map([100, 101].map(id => [`${id}:${date}`, id === 101 && options.weakerBackup
        ? { ...goalieHistory, recentGoalsAllowed: 36, seasonGoalsAllowed: 70, baselineGoalsAllowed: 200 } : goalieHistory])),
      goalieWorkloadContextCache: new Map([100, 101].map(id => [`${id}:${date}`, {
        startsLast7Days: 0, startsLast14Days: 0, daysSinceLastStart: 3, isGoalieBackToBack: false }])),
      goalieRestSplitProfileCache: new Map([100, 101].map(id => [`${id}:${date}`, null])),
      teamHorizonScalarsCache: new Map(), playerPropContextByGamePlayerKey: new Map([100, 101].map(id => [`${game.id}:${id}`, {
        player_total_saves: { marketType: "player_total_saves", sourceRank: 1, sourceNames: ["synthetic-book"], sportsbookKeys: [],
          observedAt: null, freshnessExpiresAt: null, outcomes: [] } }])),
      selectedGoalieByTeamId: new Map(), playerPredictionOutputRows: [], modelMarketFlagRows: [], leagueSavePctCache: new Map(),
      metrics: { warnings: [] },
    };
    fixtureWrites.mockClear();
    expect(await runPerGameGoalieStage(args)).toEqual({ timedOut: false, goalieRowsUpserted: 1 });
    expect(fixtureWrites).toHaveBeenCalledTimes(1);
    const row = fixtureWrites.mock.calls[0][0] as any;
    return { row, candidates: row.uncertainty.daily_board_candidates as any[],
      selected: args.selectedGoalieByTeamId.get(10)!, market: args.playerPredictionOutputRows[0] as any };
  }
  const numeric = (result: Awaited<ReturnType<typeof run>>) => ({
    projections: Object.fromEntries(Object.entries(result.row).filter(([key]) => key.startsWith("proj_"))),
    selected: { goalieId: result.selected.goalieId, starterProbability: result.selected.starterProbability, saves: result.selected.saves },
    candidates: result.candidates.map(row => ({ playerId: row.playerId, startingProbability: row.startingProbability, conditional: row.conditional })),
    marketMean: result.market.expected_value,
  });

  it("includes known opponent PK shots in goalie shots against (decision 24)", async () => {
    const zero = await run(undefined, { shotsPk: 0 });
    const known = await run(undefined, { shotsPk: 3 });
    // The existing game-context adjustment applies to all 33 shots, including the three PK shots.
    expect(known.row.proj_shots_against).toBeCloseTo(zero.row.proj_shots_against * 33 / 30, 3);
    expect(known.row.uncertainty.pk_shots).toBe("known");
    const candidates = readGoalieCandidatesContract(known.row.uncertainty)!;
    expect(candidates.rows.every(row => row.if_starts.shots_against === known.row.proj_shots_against)).toBe(true);
  });

  it.each([null, undefined])("keeps unknown opponent PK shots %s labelled without inventing shots", async shotsPk => {
    const zero = await run(undefined, { shotsPk: 0 });
    const unknown = await run(undefined, { shotsPk });
    expect(unknown.row.proj_shots_against).toBe(zero.row.proj_shots_against);
    expect(unknown.row.uncertainty.pk_shots).toBe("unknown");
  });

  it.each([true, false])("preserves nullable offense through goalie output, candidate branches and metadata (override=%s)", async override => {
    const missing = await run(undefined, { override, goalsFor: null, opponentGoalsFor: null });
    expect(missing.row.proj_win_prob).toBeNull();
    expect(missing.candidates.every(row => row.conditional.WINS_GOALIE === null)).toBe(true);
    expect(missing.row.proj_saves).toBeGreaterThan(0);
    expect(missing.market.expected_value).toBeGreaterThan(0);
    expect(missing.row.uncertainty.model.scenario_metadata.blended_projection.proj_win_prob).toBeNull();
    const zero = await run(undefined, { override, goalsFor: 0, opponentGoalsFor: 0 });
    expect(zero.row.proj_win_prob).not.toBeNull();
    if (!override) {
      expect(missing.row.uncertainty.model.starter_selection.model_context).toMatchObject({ team_is_weaker: null, opponent_is_weak: null });
      expect(missing.row.uncertainty.model.starter_selection.opponent_offense_context).toMatchObject({
        team_goals_for_pre_strength_adjustment: null, team_goals_for_post_strength_adjustment: null,
        opponent_goals_for_post_strength_adjustment: null,
      });
    }
  });

  it("records the team-game win and each candidate's unconditional W as separate populations", async () => {
    const { row } = await run(undefined, { override: false, goalsFor: 3.3, opponentGoalsFor: 2.9 });
    const populations = row.uncertainty.win_populations;
    expect(populations.team).toMatchObject({ population: "team_game", denominator: "games", source: "poisson_race" });
    expect(populations.goalie_denominators).toEqual({ credited_win_if_starts: "starts", unconditional_win: "candidate_games" });
    expect(populations.proj_win_prob_population).toBe("team_goalie_slot_credited_starter_win");
    const teamWin = populations.team.win_probability;
    expect(teamWin).toBeGreaterThan(0.5);
    expect(populations.goalies.map((g: any) => g.goalie_id).sort()).toEqual([100, 101]);
    // Identical evidence: each goalie's team win if he starts is the team value, and every team win
    // is credited to exactly one candidate (starter share plus relief).
    const total = populations.goalies.reduce((sum: number, g: any) => sum + g.unconditional_win, 0);
    expect(total).toBeCloseTo(teamWin * populations.start_probability_mass, 3);
    for (const g of populations.goalies) {
      expect(g.team_win_if_starts).toBeCloseTo(teamWin, 4);
      expect(g.credited_win_if_starts).toBeCloseTo(teamWin * STARTER_DECISION_SHARE, 4);
      expect(g.unconditional_win).toBeLessThan(g.credited_win_if_starts);
    }

    const missing = await run(undefined, { override: false, goalsFor: null, opponentGoalsFor: null });
    expect(missing.row.uncertainty.win_populations.team).toMatchObject({ win_probability: null, source: null });
    expect(missing.row.uncertainty.win_populations.goalies).toEqual([]);
  });

  it("serves one row per candidate: own if-starts line, P(start), unconditional product, team win apart (P0 #20)", async () => {
    const { row } = await run(undefined, { override: false, goalsFor: 3.3, opponentGoalsFor: 2.9, weakerBackup: true });
    const contract = readGoalieCandidatesContract(row.uncertainty)!;
    expect(contract).not.toBeNull();
    expect(row.uncertainty.row_basis).toBe("team_goalie_slot_mixture");
    expect(contract.values_per).toBe("single_game");
    expect(contract.relief_basis).toEqual({ counts: "zero_relief_assumption", shutout: "zero_relief_assumption", credited_win: "modelled_decision_share" });
    expect(contract.rows.map(r => r.goalie_id).sort()).toEqual([100, 101]);
    const [top, backup] = [contract.rows.find(r => r.goalie_id === 100)!, contract.rows.find(r => r.goalie_id === 101)!];
    // Each goalie's own line: the weaker backup allows more goals if he starts than the starter does.
    expect(backup.if_starts.goals_allowed).toBeGreaterThan(top.if_starts.goals_allowed);
    // A closed two-goalie set; the partner's probability is stored, not rebuilt as 1 − p(top).
    expect(top.start_probability + backup.start_probability).toBeCloseTo(1, 6);
    for (const r of contract.rows) {
      expect(r.unconditional.saves).toBeCloseTo(r.start_probability * r.if_starts.saves, 2);
      expect(r.unconditional.goals_allowed).toBeCloseTo(r.start_probability * r.if_starts.goals_allowed, 2);
    }
    // The team win % is reported once; each goalie's own credited Win is his row's value.
    expect(contract.team_win_probability).toBe(row.uncertainty.win_populations.team.win_probability);
    for (const g of row.uncertainty.win_populations.goalies) {
      expect(contract.rows.find(r => r.goalie_id === g.goalie_id)!.unconditional.credited_win_prob).toBe(g.unconditional_win);
    }
    expect(contract.issuance).toMatchObject({ run_id: "synthetic-goalie-run", as_of_date: date, information_cutoff_at: cutoff });
  });

  it("never multiplies a probability by the horizon scalar (decision 28)", async () => {
    const one = await run(undefined, { override: false, goalsFor: 3.3, opponentGoalsFor: 2.9, horizon: 1 });
    const two = await run(undefined, { override: false, goalsFor: 3.3, opponentGoalsFor: 2.9, horizon: 2 });
    expect(two.row.proj_saves).toBeCloseTo(2 * one.row.proj_saves, 2);
    expect(two.row.proj_win_prob).toBe(one.row.proj_win_prob);
    expect(two.row.proj_shutout_prob).toBe(one.row.proj_shutout_prob);
    expect(two.row.uncertainty.value_basis).toEqual({ counts: "horizon_total", probabilities: "single_game" });
  });

  it.each([0.4, 0.8, 1])("does not manufacture confirmation from override %s or legacy booleans", async probability => {
    const actual = await run(undefined, { probability });
    expect(actual.selected.confirmedStatus).toBe(false);
    expect(actual.market.components.projection_inputs.confirmed_status).toBe(false);
    expect(actual.candidates.every(row => row.probabilityStatus === "uncalibrated_model")).toBe(true);
    expect(actual.selected.starterProbability).toBe(probability);
  });
  it("does not confirm an unbound legacy starter map without an override", async () => {
    const actual = await run(undefined, { override: false });
    expect(actual.selected.confirmedStatus).toBe(false);
    expect(actual.market.components.projection_inputs.confirmed_status).toBe(false);
  });
  it("binds confirmation to the exact candidate without changing probabilities or modeled means", async () => {
    const original = await run();
    const source = evidence(), actual = await run(source);
    expect(actual.selected).toMatchObject({ goalieId: 100, starterProbability: 0.8, confirmedStatus: true });
    expect(actual.candidates.map(row => [row.playerId, row.startingProbability, row.probabilityStatus])).toEqual([
      [100, 0.8, "confirmed_evidence"], [101, 0, "uncalibrated_model"],
    ]);
    expect(actual.candidates[0]).toMatchObject({ gameId: game.id, teamId: 10, horizonGames: 1,
      evidenceCutoffAt: cutoff, confirmationEvidenceIds: ["synthetic-confirmation"] });
    expect(actual.market.components.projection_inputs).toMatchObject({ confirmed_status: true,
      confirmation_evidence_ids: ["synthetic-confirmation"], confirmation_evidence_cutoff_at: cutoff });
    expect(numeric(actual)).toEqual(numeric(original));
    const identity = { gameId: game.id, teamId: 10, playerId: 100, horizonGames: 1, cutoffAt: cutoff, evidence: source };
    expect(boardGoalieForecast(actual.candidates[0], identity)).toMatchObject({ probabilityStatus: "confirmed_evidence", participationProbability: 0.8 });
    expect(boardGoalieForecast(actual.candidates[0])?.probabilityStatus).toBe("uncalibrated_model");
  });
  it("binds a heuristic starter's confirmation without changing its numerical model", async () => {
    const original = await run(undefined, { override: false });
    const actual = await run(evidence(), { override: false });
    expect(actual.selected).toMatchObject({ goalieId: 100, confirmedStatus: true });
    expect(actual.selected.starterProbability).toBeLessThan(1);
    expect(numeric(actual)).toEqual(numeric(original));
  });
  it("does not transfer a different goalie's confirmation to the override player", async () => {
    const actual = await run(evidence([assertion({ playerId: 101 })]));
    expect(actual.selected.confirmedStatus).toBe(false);
    expect(actual.candidates.map(row => [row.playerId, row.startingProbability, row.probabilityStatus])).toEqual([
      [100, 0.8, "uncalibrated_model"], [101, 0, "confirmed_evidence"],
    ]);
  });
  it.each([
    { gameId: game.id + 1 }, { teamId: 11 }, { sourceKey: "" }, { evidenceId: "" },
    { publishedAt: "invalid" }, { publishedAt: "2026-10-10T18:02:00.000001Z", receivedAt: "2026-10-10T18:02:00.000001Z" },
    { receivedAt: "2026-10-10T18:02:00.000001Z" }, { receivedAt: "2026-10-10T17:59:00Z" },
    { value: "projected" }, { value: "expected" }, { value: "unknown" }, { value: "stale" }, { confirmed: false },
  ])("rejects unbound, late or non-confirmed assertions %j", async changed => {
    const actual = await run(evidence([assertion(changed)]), { probability: 1 });
    expect(actual.selected.confirmedStatus).toBe(false);
    expect(actual.market.components.projection_inputs.confirmed_status).toBe(false);
    expect(actual.candidates.every(row => row.probabilityStatus === "uncalibrated_model")).toBe(true);
    expect(actual.selected.starterProbability).toBe(1);
  });
  it("retains disputed evidence as unconfirmed, including contradictory team starters", async () => {
    const conflicting = { ...evidence(), conflicts: [{ gameId: game.id, teamId: 10, playerId: null,
      dimension: "goalie", evidenceIds: ["synthetic-conflict"] }] };
    for (const source of [conflicting, evidence([assertion(), assertion({ playerId: 101, evidenceId: "synthetic-other-confirmation" })])]) {
      const actual = await run(source);
      expect(actual.selected.confirmedStatus).toBe(false);
      expect(actual.candidates.every(row => row.probabilityStatus === "uncalibrated_model")).toBe(true);
    }
  });
  it("keeps an expired source unconfirmed after the existing evidence resolver", async () => {
    const source = resolveDailyBoardEvidence({ cutoff, lineups: [], conflicts: [], goalies: [{ id: "synthetic-expired",
      game_id: game.id, team_id: 10, player_id: 100, accepted: true, observation_status: "confirmed", source_key: "synthetic-reporter",
      observed_at: "2026-10-10T18:00:00Z", available_at: "2026-10-10T18:01:00Z", expires_at: "2026-10-10T18:01:30Z" }] });
    expect(source.assertions).toEqual([]);
    const actual = await run(source);
    expect(actual.selected.confirmedStatus).toBe(false);
  });
  it("requires the exact independently supplied cutoff and single-game horizon", async () => {
    for (const options of [{ cutoffAt: null }, { cutoffAt: "2026-10-10T18:01:59Z" }, { horizon: 2 }]) {
      const actual = await run(evidence(), options);
      expect(actual.selected.confirmedStatus).toBe(false);
      expect(actual.candidates.every(row => row.probabilityStatus === "uncalibrated_model")).toBe(true);
    }
  });
});

// Synthetic two-team fixture: one game, both starters fixed, so each goalie's W is the paired team value.
describe("goalie producer paired game win probabilities", () => {
  const date = "2026-10-10";
  const game = { id: 2026029998, date, homeTeamId: 10, awayTeamId: 11 };
  async function runPair(options: { gameMarketSummary?: Record<string, any>; goals?: [number, number] } = {}) {
    const [homeGoals, awayGoals] = options.goals ?? [3.4, 2.6];
    const cache = <T,>(value: T) => new Map([[`10:${date}`, value], [`11:${date}`, value]]);
    const history = { recentStarts: 10, recentShotsAgainst: 300, recentGoalsAllowed: 24, seasonStarts: 20, seasonShotsAgainst: 600,
      seasonGoalsAllowed: 50, baselineStarts: 60, baselineShotsAgainst: 1800, baselineGoalsAllowed: 162, residualStdDev: 1 };
    const candidate = (teamId: number, opponentTeamId: number, goalieId: number) => ({ teamId, opponentTeamId,
      candidateGoalieIds: [goalieId], priorStartProbByGoalieId: new Map([[goalieId, 1]]), confirmedStarterByGoalieId: new Map(),
      lineComboPriorByGoalieId: new Map(), projectedGsaaPer60ByGoalieId: new Map(), seasonStartPctByGoalieId: new Map(),
      seasonGamesPlayedByGoalieId: new Map(), override: { goalieId, starterProb: 1 } });
    const args: Parameters<typeof runPerGameGoalieStage>[0] = {
      asOfDate: date, runId: "synthetic-pair-run", horizonGames: 1, game, deadlineMs: Date.now() + 30000,
      goalieCandidates: [candidate(10, 11, 100), candidate(11, 10, 200)], gameMarketSummary: options.gameMarketSummary,
      teamShotsByTeamId: new Map([[10, { shotsEs: 26, shotsPp: 5 }], [11, { shotsEs: 24, shotsPp: 4 }]]),
      teamGoalsByTeamId: new Map([[10, homeGoals], [11, awayGoals]]),
      teamAbbreviationById: new Map([[10, "AAA"], [11, "BBB"]]), teamStrengthPriorCache: cache(null),
      teamFiveOnFiveProfileCache: cache(null), teamNstExpectedGoalsCache: cache(null),
      teamDefensiveEnvironmentCache: cache({ avgShotsAgainstLast10: null, avgShotsAgainstLast5: null }),
      teamOffenseEnvironmentCache: cache({ avgShotsForLast10: null, avgShotsForLast5: null, avgGoalsForLast10: null, avgGoalsForLast5: null }),
      teamRestDaysCache: cache(null), teamGoalieStarterContextCache: cache({ startsByGoalie: new Map(), lastPlayedDateByGoalie: new Map(),
        totalGames: 1, previousGameDate: null, previousGameStarterGoalieId: null }),
      goalieEvidenceCache: new Map([100, 200].map(id => [`${id}:${date}`, history])),
      goalieWorkloadContextCache: new Map([100, 200].map(id => [`${id}:${date}`, {
        startsLast7Days: 0, startsLast14Days: 0, daysSinceLastStart: 3, isGoalieBackToBack: false }])),
      goalieRestSplitProfileCache: new Map([100, 200].map(id => [`${id}:${date}`, null])),
      teamHorizonScalarsCache: new Map(), playerPropContextByGamePlayerKey: new Map(), selectedGoalieByTeamId: new Map(),
      playerPredictionOutputRows: [], modelMarketFlagRows: [], leagueSavePctCache: new Map(), metrics: { warnings: [] },
    };
    fixtureWrites.mockClear();
    expect(await runPerGameGoalieStage(args)).toEqual({ timedOut: false, goalieRowsUpserted: 2 });
    const rows = fixtureWrites.mock.calls.map(call => call[0] as any);
    return Object.fromEntries(rows.map(row => [row.team_id, row.proj_win_prob as number]));
  }

  it("makes the two teams' win probabilities sum to the starter decision share", async () => {
    const wins = await runPair();
    expect(wins[10] + wins[11]).toBeCloseTo(STARTER_DECISION_SHARE, 3);
    expect(wins[10]).toBeGreaterThan(wins[11]);
    const even = await runPair({ goals: [3, 3] });
    expect(even[10]).toBeCloseTo(even[11], 4);
  });

  it("uses the de-vigged moneyline when the game has one", async () => {
    const outcome = (key: string, price: number) => ({ outcomeKey: key, averageLineValue: null, averagePriceAmerican: price,
      averageImpliedProbability: null, sportsbookCount: 1 });
    const wins = await runPair({ gameMarketSummary: { h2h: { marketType: "h2h", sourceRank: 1, sourceNames: ["synthetic"],
      sportsbookKeys: ["synthetic"], observedAt: null, freshnessExpiresAt: null,
      outcomes: [outcome("team:AAA", 120), outcome("team:BBB", -140)] } } });
    const home = (100 / 220) / (100 / 220 + 140 / 240);
    expect(wins[10]).toBeCloseTo(home * STARTER_DECISION_SHARE, 3);
    expect(wins[11]).toBeCloseTo((1 - home) * STARTER_DECISION_SHARE, 3);
  });
});
