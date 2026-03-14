import { describe, expect, it } from "vitest";

import {
  ROLLING_PLAYER_PP_UNIT_CONTRACT,
  hasTrustedPpUnitContext,
  resolvePpUnitLabel
} from "./rollingPlayerPpUnitContract";

describe("rollingPlayerPpUnitContract", () => {
  it("records pp_unit as a contextual builder-owned label", () => {
    expect(ROLLING_PLAYER_PP_UNIT_CONTRACT.authoritativeSource.unitField).toBe(
      "powerPlayCombinations.unit"
    );
    expect(ROLLING_PLAYER_PP_UNIT_CONTRACT.freshnessDependencies).toEqual([
      "powerPlayCombinations"
    ]);
  });

  it("trusts positive integer unit labels tied to a builder game row", () => {
    expect(
      hasTrustedPpUnitContext({
        originalGameId: 2025020001,
        unit: 1
      })
    ).toBe(true);
    expect(
      resolvePpUnitLabel({
        originalGameId: 2025020001,
        unit: 2
      })
    ).toBe(2);
  });

  it("rejects null, zero, and missing-game unit labels", () => {
    expect(
      hasTrustedPpUnitContext({
        originalGameId: 2025020001,
        unit: null
      })
    ).toBe(false);
    expect(
      hasTrustedPpUnitContext({
        originalGameId: 2025020001,
        unit: 0
      })
    ).toBe(false);
    expect(
      resolvePpUnitLabel({
        originalGameId: null,
        unit: 1
      })
    ).toBeNull();
  });
});
