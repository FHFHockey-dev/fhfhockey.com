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
      { id: "fx-1", name: "Tim Stützle", team: "OTT", position: "C", eligiblePositions: ["C", "LW"], adp: 12.5 },
      { id: "fx-2", name: "Goalie Example", team: "BOS", position: "G", eligiblePositions: ["G"], adp: null },
    ];
    const result = applyFantraxDisplay([player(1, "Tim Stutzle"), player(2, "Goalie Example")], catalog);
    expect(result[0]).toMatchObject({ fullName: "Tim Stützle", displayTeam: "OTT", displayPosition: "C", eligiblePositions: ["C", "LW"], yahooAvgPick: 12.5, yahooAvgRound: null, yahooPctDrafted: null, fantraxMetadataMatched: true });
    expect(result[1]).toMatchObject({ displayTeam: "BOS", displayPosition: "G", eligiblePositions: ["G"], yahooAvgPick: null });
  });

  it("hides Yahoo ADP when Fantrax data is unavailable or identity is ambiguous", () => {
    expect(applyFantraxDisplay([player(1, "A Player")], null)[0]).toMatchObject({ yahooAvgPick: null, fantraxMetadataMatched: false });
    const catalog: FantraxDisplayPlayer[] = [
      { id: "fx-3", name: "A Player", team: "BOS", position: "C", eligiblePositions: null, adp: 1 },
      { id: "fx-4", name: "A Player", team: "NYR", position: "C", eligiblePositions: null, adp: 2 },
    ];
    expect(applyFantraxDisplay([player(1, "A Player")], catalog)[0].yahooAvgPick).toBeNull();
    expect(applyFantraxDisplay([player(1, "A Player"), player(2, "A Player")], catalog).every((row) => row.yahooAvgPick === null)).toBe(true);
  });

  it("matches verified spelling variants and same-name players by Fantrax ID", () => {
    const catalog: FantraxDisplayPlayer[] = [
      { id: "03rmx", name: "Sebastian Aho", team: "CAR", position: "C", eligiblePositions: ["C"], adp: 12 },
      { id: "03el6", name: "Sebastian Aho", team: "PIT", position: "D", eligiblePositions: ["D"], adp: 250 },
      { id: "03rfo", name: "Daniel Vladar", team: "PHI", position: "G", eligiblePositions: ["G"], adp: 180 },
    ];
    const result = applyFantraxDisplay([player(8478427, "Sebastian Aho"), player(8478435, "Dan Vladar")], catalog);
    expect(result.map((row) => row.yahooAvgPick)).toEqual([12, 180]);
    expect(result.map((row) => row.fantraxMetadataMatched)).toEqual([true, true]);
    expect(applyFantraxDisplay([player(8478427, "Sebastian Aho")], [{ ...catalog[0], name: "Someone Else" }])[0].fantraxMetadataMatched).toBe(false);
  });

  it("keeps an unmatched player's ADP hidden and clears a matched free agent's stale team", () => {
    const result = applyFantraxDisplay([player(1, "Ryan Reaves"), player(2, "Missing Player")], [
      { id: "004mz", name: "Ryan Reaves", team: null, position: "RW", eligiblePositions: null, adp: null },
    ]);
    expect(result[0]).toMatchObject({ displayTeam: null, fantraxMetadataMatched: true, yahooAvgPick: null });
    expect(result[1]).toMatchObject({ fantraxMetadataMatched: false, yahooAvgPick: null });
  });
});
