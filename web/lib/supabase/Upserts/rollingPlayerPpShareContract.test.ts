import { describe, expect, it } from "vitest";

import {
  ROLLING_PLAYER_PP_SHARE_CONTRACT,
  resolvePpShareComponents,
  toRollingPlayerPpContextRow
} from "./rollingPlayerPpShareContract";

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
    expect(ROLLING_PLAYER_PP_SHARE_CONTRACT.storagePolicy).toBe(
      "single_team_share_contract_with_fallback"
    );
  });

  it("sanitizes PP builder rows down to rolling team-share inputs plus contextual unit", () => {
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
      pp_share_of_team: 0.6
    });
  });
});
