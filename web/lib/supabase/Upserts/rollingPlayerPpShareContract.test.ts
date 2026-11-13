import { describe, expect, it } from "vitest";

import {
  createRatioRollingAccumulator,
  getRatioRollingSnapshot,
  updateRatioRollingAccumulator
} from "./rollingMetricAggregation";
import {
  ROLLING_PLAYER_PP_SHARE_CONTRACT,
  resolvePlayerPpToiSeconds,
  resolvePpShareComponents,
  resolveServedPpShareComponents,
  toRollingPlayerPpContextRow
} from "./rollingPlayerPpShareContract";
import { ppClockVerdict } from "lib/ppShare/serving";

describe("rollingPlayerPpShareContract", () => {
  it("prefers builder-derived team share inputs before WGO fallback reconstruction", () => {
    expect(
      resolvePpShareComponents({
        builderPlayerPpToi: 120,
        builderTeamShare: 0.4,
        wgoPlayerPpToi: 90,
        wgoTeamShare: 0.3
      })
    ).toEqual({
      numerator: 120,
      denominator: 300
    });
  });

  it("falls back to WGO reconstruction when builder team-share coverage is missing", () => {
    expect(
      resolvePpShareComponents({
        builderPlayerPpToi: null,
        builderTeamShare: null,
        wgoPlayerPpToi: 80,
        wgoTeamShare: 0.25
      })
    ).toEqual({
      numerator: 80,
      denominator: 320
    });
  });

  it("resolves direct player PP TOI as builder-first with WGO fallback for all and pp only", () => {
    expect(
      resolvePlayerPpToiSeconds({
        strength: "all",
        builderPlayerPpToi: 120,
        wgoPlayerPpToi: 90
      })
    ).toBe(120);

    expect(
      resolvePlayerPpToiSeconds({
        strength: "pp",
        builderPlayerPpToi: null,
        wgoPlayerPpToi: 80
      })
    ).toBe(80);

    expect(
      resolvePlayerPpToiSeconds({
        strength: "ev",
        builderPlayerPpToi: 120,
        wgoPlayerPpToi: 90
      })
    ).toBeNull();
  });

  it("records that unit-relative PP fields are excluded from pp_share_pct semantics", () => {
    expect(
      ROLLING_PLAYER_PP_SHARE_CONTRACT.explicitlyExcludedUnitRelativeFields
    ).toContain("powerPlayCombinations.percentageOfPP");
    expect(ROLLING_PLAYER_PP_SHARE_CONTRACT.authoritativeSource.shareField).toBe(
      "powerPlayCombinations.pp_share_of_team"
    );
    expect(ROLLING_PLAYER_PP_SHARE_CONTRACT.contextualFields).toEqual([
      "powerPlayCombinations.unit"
    ]);
    expect(ROLLING_PLAYER_PP_SHARE_CONTRACT.optionalContextFields).toEqual([
      "powerPlayCombinations.pp_share_of_team",
      "powerPlayCombinations.pp_unit_usage_index",
      "powerPlayCombinations.pp_unit_relative_toi",
      "powerPlayCombinations.pp_vs_unit_avg"
    ]);
    expect(ROLLING_PLAYER_PP_SHARE_CONTRACT.storagePolicy).toBe(
      "single_team_share_contract_with_fallback"
    );
  });

  it("sanitizes PP builder rows down to rolling team-share inputs plus approved contextual fields", () => {
    expect(
      toRollingPlayerPpContextRow({
        gameId: 10,
        playerId: 7,
        PPTOI: 150,
        unit: 1,
        pp_share_of_team: 0.6,
        percentageOfPP: 1.2,
        pp_unit_usage_index: 1.2,
        pp_unit_relative_toi: 30,
        pp_vs_unit_avg: 0.2
      })
    ).toEqual({
      gameId: 10,
      playerId: 7,
      PPTOI: 150,
      unit: 1,
      pp_share_of_team: 0.6,
      pp_unit_usage_index: 1.2,
      pp_unit_relative_toi: 30,
      pp_vs_unit_avg: 0.2
    });
  });

  it("uses the team PP clock for every dressed game, including games with no player PP time (D6)", () => {
    // Five dressed games, PP time in two; the team had 120 s of PP in each.
    const games = [
      { builderPlayerPpToi: 90, builderTeamShare: 0.75 },
      { builderPlayerPpToi: 0, builderTeamShare: 0 },
      { builderPlayerPpToi: 60, builderTeamShare: 0.5 },
      { builderPlayerPpToi: 0, builderTeamShare: 0 },
      { builderPlayerPpToi: 0, builderTeamShare: 0 }
    ];
    const pool = (withClock: boolean) => {
      const acc = createRatioRollingAccumulator();
      for (const game of games) {
        updateRatioRollingAccumulator(
          acc,
          resolvePpShareComponents({
            ...game,
            teamPpClock: withClock ? { seconds: 120, source: "fixture" } : null
          }),
          { windowFamily: "ratio_performance" }
        );
      }
      return getRatioRollingSnapshot(acc, { scale: 1 }).windows[5];
    };

    // 150 s of 600 s team PP time, not 150 of the 240 s in the two PP games.
    expect(pool(true)).toBeCloseTo(0.25, 6);
    expect(pool(false)).toBeCloseTo(0.625, 6);
  });

  it("keeps a known zero clock and an unknown player PP time distinct", () => {
    expect(
      resolvePpShareComponents({
        builderPlayerPpToi: 0,
        builderTeamShare: null,
        teamPpClock: { seconds: 0, source: "fixture" }
      })
    ).toEqual({ numerator: 0, denominator: 0 });
    expect(
      resolvePpShareComponents({
        builderPlayerPpToi: null,
        builderTeamShare: null,
        wgoPlayerPpToi: null,
        teamPpClock: { seconds: 120, source: "fixture" }
      })
    ).toBeNull();
    // An impossible share is passed through for investigation, never capped.
    expect(
      resolvePpShareComponents({
        builderPlayerPpToi: 150,
        builderTeamShare: null,
        teamPpClock: { seconds: 120, source: "fixture" }
      })
    ).toEqual({ numerator: 150, denominator: 120 });
  });

  describe("decision 152: served share uses the stored team-game clock", () => {
    const clock = (availability: "available" | "not_applicable" | "unavailable", clockSeconds: number | null) =>
      ppClockVerdict({ gameId: 1, teamId: 1, availability, clockSeconds, unavailableReason: availability === "unavailable"
        ? "The clock differs from the official team PP total by +28 s." : null, computedAt: "t" });

    it("available: stored PPTOI over the clock; no row is a real 0 of the clock", () => {
      expect(resolveServedPpShareComponents({ clock: clock("available", 120), storedPlayerPpToi: 90 }))
        .toEqual({ numerator: 90, denominator: 120 });
      expect(resolveServedPpShareComponents({ clock: clock("available", 120), storedPlayerPpToi: null }))
        .toEqual({ numerator: 0, denominator: 120 });
    });

    it("N/A adds 0 of 0; unavailable, a missing row or a player above the clock adds nothing (never capped)", () => {
      expect(resolveServedPpShareComponents({ clock: clock("not_applicable", 0), storedPlayerPpToi: null }))
        .toEqual({ numerator: 0, denominator: 0 });
      expect(resolveServedPpShareComponents({ clock: clock("unavailable", 148), storedPlayerPpToi: 60 })).toBeNull();
      expect(resolveServedPpShareComponents({ clock: ppClockVerdict(null), storedPlayerPpToi: 60 })).toBeNull();
      expect(resolveServedPpShareComponents({ clock: clock("available", 120), storedPlayerPpToi: 121 })).toBeNull();
    });

    it("pools a window over the clock denominators: N/A games add nothing, withheld games are left out", () => {
      const acc = createRatioRollingAccumulator();
      for (const [state, seconds, ppToi] of [
        ["available", 120, 90], ["available", 120, null], ["not_applicable", 0, null],
        ["unavailable", 148, 60], ["available", 240, 60]
      ] as const) {
        updateRatioRollingAccumulator(acc, resolveServedPpShareComponents({ clock: clock(state, seconds), storedPlayerPpToi: ppToi }),
          { windowFamily: "ratio_performance" });
      }
      // 150 s of the 480 s team PP time in the three available games.
      expect(getRatioRollingSnapshot(acc, { scale: 1 }).windows[5]).toBeCloseTo(150 / 480, 6);
    });
  });
});
