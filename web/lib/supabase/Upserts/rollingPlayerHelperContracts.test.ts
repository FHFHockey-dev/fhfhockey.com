import { describe, expect, it } from "vitest";

import {
  resolvePpShareComponents,
  toRollingPlayerPpContextRow
} from "./rollingPlayerPpShareContract";
import { buildPowerPlayCombinationRows } from "./powerPlayCombinationMetrics";
import { resolvePpUnitLabel } from "./rollingPlayerPpUnitContract";
import { resolveTrustedLineAssignment } from "./rollingPlayerLineContextContract";
import {
  normalizeWgoToiPerGame,
  resolveRollingPlayerToiContext
} from "./rollingPlayerToiContract";
import { resolveIxgPer60Components } from "./rollingPlayerMetricMath";

describe("rolling player helper contracts", () => {
  it("keeps PP team-share resolution separate from unit-relative PP role semantics", () => {
    const [builderRow] = buildPowerPlayCombinationRows({
      gameId: 10,
      unit: 1,
      players: [{ playerId: 7, toiSeconds: 180 }],
      avgUnitToiSeconds: 150,
      teamPpToiSeconds: 300
    });

    expect(builderRow.percentageOfPP).toBe(1.2);
    expect(builderRow.pp_unit_usage_index).toBe(1.2);
    expect(builderRow.pp_unit_relative_toi).toBe(30);
    expect(builderRow.pp_vs_unit_avg).toBe(0.2);
    expect(builderRow.pp_share_of_team).toBe(0.6);

    expect(
      resolvePpShareComponents({
        builderPlayerPpToi: builderRow.PPTOI,
        builderTeamShare: builderRow.pp_share_of_team
      })
    ).toEqual({
      numerator: 180,
      denominator: 300
    });

    expect(toRollingPlayerPpContextRow(builderRow)).toEqual({
      gameId: 10,
      playerId: 7,
      PPTOI: 180,
      unit: 1,
      pp_share_of_team: 0.6
    });
    expect(
      resolvePpUnitLabel({
        originalGameId: builderRow.gameId,
        unit: builderRow.unit
      })
    ).toBe(1);
  });

  it("treats line assignments as contextual builder labels only when the player is actually placed", () => {
    expect(
      resolveTrustedLineAssignment({
        row: {
          forwards: [7, 8, 9, 10, 11, 12],
          defensemen: [20, 21, 22, 23],
          goalies: [30]
        },
        playerId: 11
      })
    ).toEqual({
      lineCombo: { slot: 2, positionGroup: "forward" },
      hasSourceRow: true,
      hasTrustedAssignment: true
    });

    expect(
      resolveTrustedLineAssignment({
        row: {
          forwards: [7, 8, 9],
          defensemen: [20, 21],
          goalies: [30]
        },
        playerId: 99
      })
    ).toEqual({
      lineCombo: { slot: null, positionGroup: null },
      hasSourceRow: true,
      hasTrustedAssignment: false
    });
  });

  it("makes TOI normalization and trust explicit", () => {
    expect(normalizeWgoToiPerGame({ toiPerGame: 18.5 })).toEqual({
      seconds: 1110,
      normalization: "minutes_to_seconds",
      rejection: null
    });

    expect(
      resolveRollingPlayerToiContext({
        countsToi: null,
        countsOiToi: 0,
        ratesToiPerGp: 840,
        fallbackToiSeconds: 1110,
        wgoToiPerGame: 18.5
      })
    ).toEqual({
      seconds: 840,
      source: "rates",
      trustTier: "supplementary",
      rejectedCandidates: [{ source: "counts_oi", reason: "non_positive" }],
      wgoNormalization: "missing"
    });
  });

  it("prefers direct ixG for ixg_per_60 and only reconstructs from rates when necessary", () => {
    expect(
      resolveIxgPer60Components({
        strength: "all",
        countsIxg: 0.7,
        wgoIxg: 1.4,
        toiSeconds: 1200,
        per60Rate: 6
      })
    ).toEqual({
      components: {
        numerator: 0.7,
        denominator: 1200
      },
      source: "counts_raw"
    });

    expect(
      resolveIxgPer60Components({
        strength: "pp",
        countsIxg: null,
        wgoIxg: 1.4,
        toiSeconds: 1200,
        per60Rate: 6
      })
    ).toEqual({
      components: {
        numerator: 2,
        denominator: 1200
      },
      source: "rate_reconstruction"
    });
  });
});
