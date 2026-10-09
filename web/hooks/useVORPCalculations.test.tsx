import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProcessedPlayer } from "./useProcessedProjectionsData";
import { useVORPCalculations } from "./useVORPCalculations";
import {
  KEEPER_CONTRACT_VERSION,
  materializeKeeperPicks
} from "../lib/draftDashboard/keepers";
import { applyFantraxPlayerSources } from "../lib/draftDashboard/fantraxPlayerSources";
import { buildPositionWeightMultipliers } from "../lib/draftDashboard/positionWeights";

function player(
  playerId: number,
  position: string,
  value: number,
  yahooAvgPick = playerId
): ProcessedPlayer {
  return {
    playerId,
    fullName: `Player ${playerId}`,
    displayTeam: "TST",
    displayPosition: position,
    eligiblePositions: position.split(","),
    combinedStats: {},
    fantasyPoints: {
      projected: value,
      actual: null,
      diffPercentage: null,
      projectedPerGame: null,
      actualPerGame: null
    },
    yahooAvgPick
  } as ProcessedPlayer;
}

function projectedStat(key: string, projected: number): ProcessedPlayer["combinedStats"][string] {
  return {
    projected,
    actual: null,
    diffPercentage: null,
    projectedDetail: {
      value: projected,
      contributingSources: [],
      missingFromSelectedSources: [],
      statDefinition: {
        key,
        displayName: key,
        dataType: "numeric",
        higherIsBetter: true,
        isGoalieStat: false,
        isSkaterStat: true
      }
    }
  };
}

const players = [
  player(1, "C,LW", 100, 1),
  player(2, "C", 90, 2),
  player(3, "LW", 80, 3),
  player(4, "RW", 70, 4),
  player(5, "RW", 60, 5),
  player(6, "D", 50, 6),
  player(7, "D", 40, 7),
  player(8, "G", 30, 8),
  player(9, "G", 20, 9)
];

const rosterConfig = { C: 1, LW: 1, RW: 1, D: 1, G: 1, utility: 0 };

describe("useVORPCalculations grouped forwards", () => {
  it("deduplicates multi-position forwards and uses one FWD contract throughout", () => {
    const { result } = renderHook(() =>
      useVORPCalculations({
        players,
        availablePlayers: players,
        draftSettings: { teamCount: 1, rosterConfig },
        picksUntilNext: 1,
        forwardGrouping: "fwd"
      })
    );

    expect(Object.keys(result.current.replacementByPos)).toEqual([
      "FWD",
      "D",
      "G"
    ]);
    // Rank four is 70 only when C/LW eligibility for player 1 is deduplicated.
    expect(result.current.replacementByPos.FWD.vorp).toBe(70);
    expect(result.current.expectedTakenByPos).toEqual({ FWD: 1, D: 0, G: 0 });
    expect(result.current.playerMetrics.get("1")).toMatchObject({
      bestPos: "FWD",
      eligible: ["FWD"],
      vorp: 30
    });
  });

  it("keeps split pools independent and allocates utility without changing D/G", () => {
    const { result } = renderHook(() =>
      useVORPCalculations({
        players,
        availablePlayers: players,
        draftSettings: {
          teamCount: 1,
          rosterConfig: { ...rosterConfig, utility: 1 }
        },
        picksUntilNext: 0,
        forwardGrouping: "split"
      })
    );

    expect(Object.keys(result.current.replacementByPos)).toEqual([
      "C",
      "LW",
      "RW",
      "D",
      "G"
    ]);
    expect(result.current.replacementByPos.D.vorp).toBe(40);
    expect(result.current.replacementByPos.G.vorp).toBe(20);
    expect(result.current.playerMetrics.get("1")?.eligible).toEqual(["C", "LW"]);
  });

  it("uses grouped personalized fills to move the FWD replacement baseline", () => {
    const { result } = renderHook(() =>
      useVORPCalculations({
        players,
        availablePlayers: players,
        draftSettings: { teamCount: 1, rosterConfig },
        picksUntilNext: 0,
        forwardGrouping: "fwd",
        personalizeReplacement: true,
        myFilledSlots: { FWD: 1 }
      })
    );

    expect(result.current.replacementByPos.FWD.vorp).toBe(80);
    expect(result.current.replacementByPos.D.vorp).toBe(40);
    expect(result.current.replacementByPos.G.vorp).toBe(20);
  });

  it("changes only the remaining baseline when a keeper leaves availability", () => {
    const draftedPlayers = materializeKeeperPicks([], [
      {
        version: KEEPER_CONTRACT_VERSION,
        status: "valid",
        cost: "pick",
        playerId: "1",
        teamId: "Team 1",
        round: 1,
        pickInRound: 1,
        pickNumber: 1
      }
    ]);
    const draftedIds = new Set(draftedPlayers.map((pick) => pick.playerId));
    const availablePlayers = players.filter(
      (player) => !draftedIds.has(String(player.playerId))
    );
    expect(availablePlayers.some((player) => player.playerId === 1)).toBe(false);
    const { result, rerender } = renderHook(
      ({ baselineMode }: { baselineMode: "remaining" | "full" }) =>
        useVORPCalculations({
          players,
          availablePlayers,
          draftSettings: { teamCount: 1, rosterConfig },
          picksUntilNext: 0,
          forwardGrouping: "fwd",
          baselineMode
        }),
      {
        initialProps: {
          baselineMode: "remaining"
        } as { baselineMode: "remaining" | "full" }
      }
    );

    expect(result.current.replacementByPos.FWD.vorp).toBe(60);
    expect(result.current.playerMetrics.get("1")).toMatchObject({
      vorp: 40,
      vona: 10,
      vbd: 30
    });
    rerender({ baselineMode: "full" });
    expect(result.current.replacementByPos.FWD.vorp).toBe(70);
  });

  it("returns finite neutral metrics when a player has no usable position", () => {
    const positionlessPlayer = player(10, "", 25);
    const { result } = renderHook(() =>
      useVORPCalculations({
        players: [positionlessPlayer],
        availablePlayers: [positionlessPlayer],
        draftSettings: { teamCount: 1, rosterConfig },
        picksUntilNext: 0
      })
    );

    expect(result.current.playerMetrics.get("10")).toMatchObject({
      value: 25,
      vorp: 0,
      vols: 0,
      vona: 0,
      vbd: 0,
      bestPos: "",
      eligible: []
    });
  });
});

describe("useVORPCalculations position weights", () => {
  const params = {
    players,
    availablePlayers: players,
    draftSettings: { teamCount: 1, rosterConfig },
    picksUntilNext: 0,
    forwardGrouping: "fwd" as const
  };

  it("preserves every neutral metric and applies Pro gating without changing saved choices", () => {
    const weights = { C: 1, LW: 1, RW: 1, D: 0.5, G: 1 };
    const neutral = renderHook(() => useVORPCalculations(params)).result.current;
    const explicitNeutral = renderHook(() => useVORPCalculations({
      ...params,
      positionWeightMultipliers: buildPositionWeightMultipliers(players, { D: 1 }, true)
    })).result.current;
    const disabled = renderHook(() => useVORPCalculations({
      ...params,
      positionWeightMultipliers: buildPositionWeightMultipliers(players, weights, false)
    })).result.current;

    expect(explicitNeutral).toEqual(neutral);
    expect(disabled).toEqual(neutral);
    expect(weights.D).toBe(0.5);
  });

  it("reduces defense values once and recomputes their replacement baseline", () => {
    const multipliers = buildPositionWeightMultipliers(players, { D: 0.5 }, true);
    const before = players.map(p => p.fantasyPoints.projected);
    const weighted = renderHook(() => useVORPCalculations({
      ...params,
      positionWeightMultipliers: multipliers
    })).result.current;

    expect(weighted.playerMetrics.get("6")).toMatchObject({ value: 25, vorp: 5, bestPos: "D" });
    expect(weighted.playerMetrics.get("7")?.value).toBe(20);
    expect(weighted.replacementByPos.D).toEqual({ vorp: 20, vols: 25 });
    expect(weighted.replacementByPos.FWD.vorp).toBe(70);
    expect(players.map(p => p.fantasyPoints.projected)).toEqual(before);
  });

  it("weights the prorated points total, leaving the projection and source stats intact", () => {
    const skater = {
      ...player(20, "D", 100),
      combinedStats: {
        GOALS: projectedStat("GOALS", 10),
        GAMES_PLAYED: projectedStat("GAMES_PLAYED", 42)
      }
    };
    const weighted = renderHook(() => useVORPCalculations({
      ...params,
      players: [skater],
      availablePlayers: [skater],
      prorate84: true,
      fantasyPointSettings: { GOALS: 10, ASSISTS: 0, PP_POINTS: 0, SHOTS_ON_GOAL: 0, HITS: 0, BLOCKED_SHOTS: 0 },
      positionWeightMultipliers: buildPositionWeightMultipliers([skater], { D: 0.5 }, true)
    })).result.current;

    expect(weighted.playerMetrics.get("20")?.value).toBe(100);
    expect(skater.fantasyPoints.projected).toBe(100);
    expect(skater.combinedStats.GOALS.projected).toBe(10);
  });

  it("multiplies positive, negative, and zero category composites with their signs", () => {
    const categoryPlayers = [0, 10, 20].map((goals, index) => ({
      ...player(index + 30, "D", 500),
      combinedStats: { GOALS: projectedStat("GOALS", goals) }
    }));
    const base = {
      ...params,
      players: categoryPlayers,
      availablePlayers: categoryPlayers,
      leagueType: "categories" as const,
      categoryWeights: { GOALS: 1 }
    };
    const neutral = renderHook(() => useVORPCalculations(base)).result.current;
    const explicitNeutral = renderHook(() => useVORPCalculations({
      ...base,
      positionWeightMultipliers: buildPositionWeightMultipliers(categoryPlayers, { D: 1 }, true)
    })).result.current;
    const weighted = renderHook(() => useVORPCalculations({
      ...base,
      positionWeightMultipliers: buildPositionWeightMultipliers(categoryPlayers, { D: 0.5 }, true)
    })).result.current;

    expect(explicitNeutral).toEqual(neutral);
    for (const id of ["30", "31", "32"]) {
      expect(weighted.playerMetrics.get(id)?.value).toBeCloseTo(neutral.playerMetrics.get(id)!.value * 0.5);
    }
    expect(neutral.playerMetrics.get("30")!.value).toBeLessThan(0);
    expect(weighted.playerMetrics.get("30")!.value).toBeGreaterThan(neutral.playerMetrics.get("30")!.value);
    expect(weighted.playerMetrics.get("31")!.value).toBe(0);
    expect(weighted.replacementByPos.D.vorp).toBeCloseTo(neutral.replacementByPos.D.vorp * 0.5);
    expect(weighted.replacementByPos.D.vols).toBeCloseTo(neutral.replacementByPos.D.vols * 0.5);
    expect(categoryPlayers.map(p => p.fantasyPoints.projected)).toEqual([500, 500, 500]);
  });

  it("uses the highest eligible weight once before forward grouping and leaves missing positions neutral", () => {
    const candidates = [player(40, "C,D", 100), player(41, "F", 80), player(42, "", 60)];
    const multipliers = buildPositionWeightMultipliers(candidates, { C: 0.6, LW: 1.3, RW: 0.8, D: 0.5 }, true);
    const weighted = renderHook(() => useVORPCalculations({
      ...params,
      players: candidates,
      availablePlayers: candidates,
      positionWeightMultipliers: multipliers
    })).result.current;

    expect([...multipliers]).toEqual([["40", 0.6], ["41", 1.3]]);
    expect(weighted.playerMetrics.get("40")).toMatchObject({ value: 60, eligible: ["FWD", "D"] });
    expect(weighted.playerMetrics.get("41")).toMatchObject({ value: 104, eligible: ["FWD"] });
    expect(weighted.playerMetrics.get("42")).toMatchObject({ value: 60, eligible: [] });
  });

  it("resolves the selected Yahoo or Fantrax eligibility without changing roster eligibility", () => {
    const original = [player(50, "C", 100), player(51, "C", 80)];
    const fantraxRows = [{ id: "fx-50", name: "50, Player", team: "TST", positions: ["D"], adp: 5 }];
    const yahoo = applyFantraxPlayerSources(original, fantraxRows, "yahoo", "yahoo");
    const fantrax = applyFantraxPlayerSources(original, fantraxRows, "yahoo", "fantrax");
    const weights = { C: 1.2, D: 0.5 };
    const yahooMultipliers = buildPositionWeightMultipliers(yahoo, weights, true);
    const fantraxMultipliers = buildPositionWeightMultipliers(fantrax, weights, true);
    const weighted = renderHook(() => useVORPCalculations({
      ...params,
      players: original,
      availablePlayers: original,
      positionWeightMultipliers: fantraxMultipliers
    })).result.current;

    expect(yahooMultipliers.get("50")).toBe(1.2);
    expect(fantraxMultipliers.get("50")).toBe(0.5);
    expect(fantraxMultipliers.has("51")).toBe(false);
    expect(weighted.playerMetrics.get("50")).toMatchObject({ value: 50, eligible: ["FWD"] });
    expect(weighted.playerMetrics.get("51")?.value).toBe(80);
    expect(original.map(p => p.displayPosition)).toEqual(["C", "C"]);
  });
});
