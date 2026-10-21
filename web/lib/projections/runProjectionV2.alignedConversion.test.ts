import { describe, expect, it } from "vitest";
import { createAlignedCountSupportBuilder } from "lib/rollingPlayerCountSupport";
import type { RollingRow } from "./types/run-forge-projections.types";
import { computeSupportedStrengthSplitConversionRates, applySupportedSkaterConversionHeads, resolveSkaterConversionRates } from "./calculators/skater-adjustments";
import { blendTopStarterScenarioOutputs, computeStrengthSplitConversionRates } from "./run-forge-projections";
import { buildSkaterNaivePriorBaseline, clampSkaterAssistRate } from "./stages/skater-stage";

// Moved from runProjectionV2.test.ts so that file also runs against production calculators.
describe("scenario blending", () => {
  it.each([
    { weight: 0.5, scenarioWin: null, fallbackWin: 0.4, expected: null },
    { weight: 0.5, scenarioWin: 0.4, fallbackWin: null, expected: null },
    { weight: 1, scenarioWin: 0, fallbackWin: null, expected: 0 },
    { weight: 0, scenarioWin: null, fallbackWin: 0.4, expected: 0.4 },
  ])("preserves missing required win mass and ignores unused null mass: %j", ({ weight, scenarioWin, fallbackWin, expected }) => {
    const common = { proj_shots_against: 30, proj_saves: 27, proj_goals_allowed: 3,
      proj_shutout_prob: 0.05, modeled_save_pct: 0.9, workload_save_pct_penalty: 0 };
    const blended = blendTopStarterScenarioOutputs({
      scenarioProjections: [{ ...common, goalie_id: 5001, rank: 1, starter_probability_raw: weight,
        starter_probability_top2_normalized: weight, proj_win_prob: scenarioWin }],
      fallbackProjection: { ...common, proj_win_prob: fallbackWin },
    });
    expect(blended.proj_win_prob).toBe(expected);
    expect(blended.proj_saves).toBe(27);
    expect(blended.proj_goals_allowed).toBe(3);
  });
});

describe("aligned conversion integration", () => {
  function row(strength: "ev" | "pp", assist: number | null = 2, goals = 1, shots = 8) {
    const game = { id: 1, date: "2026-10-06", seasonId: 20262027 };
    const support = createAlignedCountSupportBuilder({ playerId: 7, strengthState: strength,
      sourceTable: strength === "ev" ? "nst_gamelog_es_counts" : "nst_gamelog_pp_counts", startDate: game.date,
      canonicalGames: [game], countsRows: [{ id: 10, player_id: 7, date_scraped: game.date, season: game.seasonId, goals, shots, total_assists: assist }],
    }).push({ player_id: 7, game_id: game.id, date: game.date, season_id: game.seasonId });
    return { player_id: 7, game_id: game.id, game_date: game.date, season: game.seasonId, strength_state: strength,
      aligned_count_support: support, goals_total_all: 331, shots_total_all: 510, assists_total_all: 63,
    } as RollingRow;
  }
  it("uses paired counts independently of legacy scalars with unchanged conversion priors", () => {
    const ev = row("ev"), pp = row("pp");
    const rates = computeSupportedStrengthSplitConversionRates({ ev, pp, goalRateMultiplier: 1, assistRateMultiplier: 1 });
    const reference = computeStrengthSplitConversionRates({ evGoalsAll: 1, evGoalsRecent: 1, evShotsAll: 8, evShotsRecent: 8,
      evAssistsAll: 2, evAssistsRecent: 2, ppGoalsAll: 1, ppGoalsRecent: 1, ppShotsAll: 8, ppShotsRecent: 8,
      ppAssistsAll: 2, ppAssistsRecent: 2, goalRateMultiplier: 1, assistRateMultiplier: 1 });
    expect(rates).toMatchObject(reference);
    expect(computeSupportedStrengthSplitConversionRates({ ev: { ...ev, aligned_count_support: undefined }, pp: undefined,
      goalRateMultiplier: 1, assistRateMultiplier: 1 })).toMatchObject({ goalRateEs: null, goalRatePp: null, assistRateEs: null, assistRatePp: null });
  });
  it("withholds absent pair heads, derived bands/scenarios/PPP and preserves other categories", () => {
    const rates = computeSupportedStrengthSplitConversionRates({ ev: row("ev"), pp: row("pp", null), goalRateMultiplier: 1, assistRateMultiplier: 1 });
    expect(rates.goalRatePp).not.toBeNull(); expect(rates.assistRatePp).toBeNull();
    const source = { proj_goals_es: 0.1, proj_goals_pp: 0.2, proj_assists_es: 0.3, proj_assists_pp: 0.4, proj_hits: 0.8,
      uncertainty: { assists_pp: { mean: 0.4 }, ppp: { mean: 0.6 }, a: { mean: 0.7 }, pts: { mean: 1 }, hit: { mean: 0.8 },
        model: { skater_selection: { conversion_rates: { goal_rate_pp: 0.2, assist_rate_pp: 1 }, role_scenarios: {
          scenario_stat_lines: [{ goals_pp: 0.2, assists_pp: 0.4 }] } }, holdout_baselines: {
            current_baseline: { goals_pp: 0.2, assists_pp: 0.4 }, naive_prior: { assists_pp: 0.5 } } } } };
    const actual = applySupportedSkaterConversionHeads(source, rates);
    expect(actual).toMatchObject({ proj_goals_pp: 0.2, proj_assists_pp: null, proj_hits: 0.8, uncertainty: { assists_pp: null, ppp: null,
      a: null, pts: null, hit: { mean: 0.8 }, model: { skater_selection: { conversion_rates: { assist_rate_pp: null },
        role_scenarios: { scenario_stat_lines: [{ goals_pp: 0.2, assists_pp: null }] } },
        holdout_baselines: { current_baseline: { assists_pp: null }, naive_prior: { assists_pp: 0.5 } } } } });
    expect(source.proj_assists_pp).toBe(0.4); expect(source.uncertainty.ppp).toEqual({ mean: 0.6 });
  });
  it("uses a supported Bayes rate directly and records the legacy second shrink for backtests", () => {
    const rates = computeSupportedStrengthSplitConversionRates({ ev: row("ev", 40, 52, 400), pp: undefined, goalRateMultiplier: 1, assistRateMultiplier: 1 });
    const bayes = rates.goalRateEs as number;
    expect(bayes).toBeGreaterThan(0.12); expect(bayes).toBeLessThan(0.13);
    const resolved = resolveSkaterConversionRates({ splitRates: rates, sampleWeight: 0.7 });
    expect(resolved.goalRateEs).toBe(bayes);
    expect(resolved.conversionShrink.goal_es).toEqual({ bayes, legacy: bayes * 0.7 + 0.3 * 0.095, sample_weight: 0.7 });
    expect(resolved.conversionShrink.goal_pp).toEqual({ bayes: null, legacy: 0.145, sample_weight: 0.7 });
    const splitRates = { goalRateEs: null, goalRatePp: null, assistRateEs: null, assistRatePp: null };
    const unsupported = resolveSkaterConversionRates({ splitRates, sampleWeight: 0.4 });
    expect(unsupported).toMatchObject({ goalRateEs: 0.095, goalRatePp: 0.145, assistRateEs: 1.44, assistRatePp: 1.9 });
    expect(unsupported.conversionShrink.assist_pp).toEqual({ bayes: null, legacy: 1.9, sample_weight: 0.4 });
    expect(resolveSkaterConversionRates({ splitRates, sampleWeight: 0.4, assistDenominator: "per_two_goals" }))
      .toMatchObject({ goalRateEs: 0.095, goalRatePp: 0.145, assistRateEs: 0.72, assistRatePp: 0.95 });
  });
  it("projects assists per goal on the per-goal scale and keeps the per-two-goals path for the ledger", () => {
    const chain = (assistDenominator: "per_goal" | "per_two_goals") => {
      const rates = computeSupportedStrengthSplitConversionRates({ ev: row("ev", 34, 20, 160), pp: undefined,
        goalRateMultiplier: 1, assistRateMultiplier: 1, assistDenominator });
      const resolved = resolveSkaterConversionRates({ splitRates: rates, sampleWeight: 0.8, assistDenominator });
      const trended = clampSkaterAssistRate(resolved.assistRateEs * 1.04, "es", "trend", assistDenominator);
      return { goalRateEs: resolved.goalRateEs,
        assistRateEs: clampSkaterAssistRate(trended * 1.03, "es", "coupling", assistDenominator) };
    };
    const live = chain("per_goal"), legacy = chain("per_two_goals");
    const goalsEs = 160 * live.goalRateEs, assistsEs = goalsEs * live.assistRateEs;
    expect(live.assistRateEs).toBeGreaterThan(1.6); expect(live.assistRateEs).toBeLessThan(1.8);
    expect(assistsEs / goalsEs).toBeCloseTo(live.assistRateEs, 12);
    expect(legacy.assistRateEs).toBeCloseTo(live.assistRateEs / 2, 10);
    const naivePrior = buildSkaterNaivePriorBaseline({ shotsEs: 160, shotsPp: 0 });
    expect(naivePrior).toMatchObject({ assist_per_goal_es: 1.44, assist_per_goal_pp: 1.9 });
    expect(naivePrior.assists_es).toBeCloseTo(naivePrior.goals_es * 1.44, 12);
    expect(clampSkaterAssistRate(5, "pp", "coupling", "per_goal")).toBe(4.2);
    expect(clampSkaterAssistRate(5, "pp", "coupling", "per_two_goals")).toBe(2.1);
    expect(clampSkaterAssistRate(5, "es", "trend", "per_goal")).toBe(3.4);
    expect(clampSkaterAssistRate(0, "es", "trend", "per_two_goals")).toBe(0.2);
  });
  it("distinguishes zero exposure from a supported goal/shot pair with zero goals", () => {
    const rates = computeSupportedStrengthSplitConversionRates({ ev: row("ev", 0, 0, 8), pp: row("pp", 0, 0, 0), goalRateMultiplier: 1, assistRateMultiplier: 1 });
    expect(rates.goalRateEs).not.toBeNull(); expect(rates.assistRateEs).toBeNull();
    expect(rates.goalRatePp).toBeNull(); expect(rates.assistRatePp).toBeNull();
    expect(rates.support.pp?.pairs.goalPerShot?.all.denominator).toBe(0);
  });
});
