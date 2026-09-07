import { describe, expect, it } from "vitest";

import { buildDraftProDustRequest } from "./draftProDustRequest";

const player = (playerId: number, position: string, value: number) => ({
  playerId,
  fullName: `Player ${playerId}`,
  displayTeam: "TST",
  displayPosition: position,
  eligiblePositions: position.split(","),
  fantasyPoints: { projected: value },
}) as any;

describe("buildDraftProDustRequest", () => {
  it("preserves grouped eligibility and effective roster slots in the DUST request", () => {
    const players = [player(1, "C,LW", 100), player(2, "G", 90)];
    const request = buildDraftProDustRequest({
      season: "20262027", lineupMode: "daily", sort: "schedule_fit", inputOrigin: "draft",
      allPlayers: players, availablePlayers: players, rosterAssignments: [{ playerId: "1", teamId: "mine" }],
      myTeamId: "mine", forwardGrouping: "fwd",
      vorpMetrics: new Map([["1", { value: 120 }], ["2", { value: 80 }]]) as any,
      rosterSlots: { FWD: 3, G: 1 },
    });
    expect(request).toMatchObject({
      season: "20262027",
      rosterSlots: { FWD: 3, G: 1 },
      roster: [{ id: "1", eligiblePositions: ["FWD"], available: false, projectionSeason: "20262027" }],
      candidates: [{ id: "1", eligiblePositions: ["FWD"], value: 120 }, { id: "2", eligiblePositions: ["G"] }],
    });
  });
});
