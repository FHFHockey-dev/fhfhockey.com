import { describe, expect, it } from "vitest";
import {
  buildPowerPlayCombinationRows,
  buildUnitUsageRows
} from "./powerPlayCombinationMetrics";

describe("powerPlayCombinationMetrics", () => {
  it("computes unit-relative usage fields without breaking the legacy ratio field", () => {
    const rows = buildUnitUsageRows(
      [
        { playerId: 1, toiSeconds: 180 },
        { playerId: 2, toiSeconds: 120 }
      ],
      150
    );

    expect(rows).toEqual([
      {
        playerId: 1,
        PPTOI: 180,
        percentageOfPP: 1.2,
        pp_unit_usage_index: 1.2,
        pp_unit_relative_toi: 30,
        pp_vs_unit_avg: 0.2
      },
      {
        playerId: 2,
        PPTOI: 120,
        percentageOfPP: 0.8,
        pp_unit_usage_index: 0.8,
        pp_unit_relative_toi: -30,
        pp_vs_unit_avg: -0.2
      }
    ]);
  });

  it("computes true team PP share from team-level PP time", () => {
    const rows = buildPowerPlayCombinationRows({
      gameId: 99,
      unit: 1,
      players: [
        { playerId: 1, toiSeconds: 180 },
        { playerId: 2, toiSeconds: 120 }
      ],
      avgUnitToiSeconds: 150,
      teamPpToiSeconds: 300
    });

    expect(rows.map((row) => row.pp_share_of_team)).toEqual([0.6, 0.4]);
  });

  it("keeps unit-relative percentageOfPP distinct from team-share semantics", () => {
    const [row] = buildPowerPlayCombinationRows({
      gameId: 100,
      unit: 1,
      players: [{ playerId: 1, toiSeconds: 180 }],
      avgUnitToiSeconds: 150,
      teamPpToiSeconds: 300
    });

    expect(row.percentageOfPP).toBe(1.2);
    expect(row.pp_unit_usage_index).toBe(1.2);
    expect(row.pp_share_of_team).toBe(0.6);
  });
});
