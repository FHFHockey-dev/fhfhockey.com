import { describe, expect, it } from "vitest";
import { createAlignedCountSupportBuilder } from "lib/rollingPlayerCountSupport";
import type { RollingRow } from "./types/run-forge-projections.types";
import { computeSupportedStrengthSplitConversionRates, applySupportedSkaterConversionHeads } from "./calculators/skater-adjustments";
import { blendTopStarterScenarioOutputs, computeStrengthSplitConversionRates } from "./run-forge-projections";

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
  it("distinguishes zero exposure from a supported goal/shot pair with zero goals", () => {
    const rates = computeSupportedStrengthSplitConversionRates({ ev: row("ev", 0, 0, 8), pp: row("pp", 0, 0, 0), goalRateMultiplier: 1, assistRateMultiplier: 1 });
    expect(rates.goalRateEs).not.toBeNull(); expect(rates.assistRateEs).toBeNull();
    expect(rates.goalRatePp).toBeNull(); expect(rates.assistRatePp).toBeNull();
    expect(rates.support.pp?.pairs.goalPerShot?.all.denominator).toBe(0);
  });
});
