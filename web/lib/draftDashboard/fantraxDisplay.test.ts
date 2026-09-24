import { describe, expect, it } from "vitest";

import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import { applyFantraxDisplay, fantraxEligiblePositions, type FantraxDisplayPlayer } from "./fantraxDisplay";

const player = (playerId: number, fullName: string): ProcessedPlayer => ({
  playerId, fullName, displayTeam: "OLD", displayPosition: "C",
  eligiblePositions: ["C"], yahooAvgPick: 99, yahooAvgRound: 9, yahooPctDrafted: 80,
  combinedStats: {} as ProcessedPlayer["combinedStats"],
  fantasyPoints: { projected: null, actual: null, diffPercentage: null, projectedPerGame: null, actualPerGame: null },
});

describe("Fantrax dashboard metadata", () => {
  it("uses league eligibility and excludes the skater utility roster slot", () => {
    expect(fantraxEligiblePositions("D,Skt")).toEqual(["D"]);
    expect(fantraxEligiblePositions("C,LW,Skt")).toEqual(["C", "LW"]);
    expect(fantraxEligiblePositions(null)).toBeNull();
  });
  it("uses unique Fantrax names, current team, primary position and ADP", () => {
    const catalog: FantraxDisplayPlayer[] = [
      { name: "Tim Stützle", team: "OTT", position: "C", eligiblePositions: ["C", "LW"], adp: 12.5 },
      { name: "Goalie Example", team: "BOS", position: "G", eligiblePositions: ["G"], adp: null },
    ];
    const result = applyFantraxDisplay([player(1, "Tim Stutzle"), player(2, "Goalie Example")], catalog);
    expect(result[0]).toMatchObject({ fullName: "Tim Stützle", displayTeam: "OTT", displayPosition: "C", eligiblePositions: ["C", "LW"], yahooAvgPick: 12.5, yahooAvgRound: null, yahooPctDrafted: null, fantraxMetadataMatched: true });
    expect(result[1]).toMatchObject({ displayTeam: "BOS", displayPosition: "G", eligiblePositions: ["G"], yahooAvgPick: null });
  });

  it("hides Yahoo ADP when Fantrax data is unavailable or identity is ambiguous", () => {
    expect(applyFantraxDisplay([player(1, "A Player")], null)[0]).toMatchObject({ yahooAvgPick: null, fantraxMetadataMatched: false });
    const catalog: FantraxDisplayPlayer[] = [
      { name: "A Player", team: "BOS", position: "C", eligiblePositions: null, adp: 1 },
      { name: "A Player", team: "NYR", position: "C", eligiblePositions: null, adp: 2 },
    ];
    expect(applyFantraxDisplay([player(1, "A Player")], catalog)[0].yahooAvgPick).toBeNull();
    expect(applyFantraxDisplay([player(1, "A Player"), player(2, "A Player")], catalog).every((row) => row.yahooAvgPick === null)).toBe(true);
  });
});
