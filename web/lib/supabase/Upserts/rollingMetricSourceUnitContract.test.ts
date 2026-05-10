import { describe, expect, it } from "vitest";

import {
  getRollingMetricSourceUnitContract,
  ROLLING_METRIC_SOURCE_UNIT_CONTRACTS,
} from "./rollingMetricSourceUnitContract";

describe("rolling metric source/unit contract", () => {
  it("documents source and unit ownership for the required player metric groups", () => {
    const requiredKeys = [
      "strength_state",
      "toi_seconds",
      "pp_toi_seconds",
      "shots",
      "sog_per_60",
      "ixg",
      "ixg_per_60",
      "iscf",
      "ihdcf",
      "goals",
      "assists",
      "points",
      "hits",
      "blocks",
      "ipp",
      "pdo",
      "on_ice_sh_pct",
      "oz_start_pct",
      "pp_share_pct",
    ];

    expect(ROLLING_METRIC_SOURCE_UNIT_CONTRACTS.map((contract) => contract.metricKey)).toEqual(
      expect.arrayContaining(requiredKeys)
    );
    for (const key of requiredKeys) {
      const contract = getRollingMetricSourceUnitContract(key);
      expect(contract?.primarySources.length).toBeGreaterThan(0);
      expect(contract?.unit).toEqual(expect.any(String));
    }
  });

  it("keeps PP share separate from unit-relative context", () => {
    expect(getRollingMetricSourceUnitContract("pp_share_pct")).toMatchObject({
      unit: "fraction_0_to_1",
      primarySources: [
        "powerPlayCombinations.PPTOI",
        "powerPlayCombinations.pp_share_of_team",
      ],
    });
  });
});
