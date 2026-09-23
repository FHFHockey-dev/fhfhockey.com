import { describe, expect, it } from "vitest";

import { reconcileFantraxDraftState } from "./fantraxLiveDraft";

const state = {
  session: { id: "session", status: "active", providerStatus: "inProgress", externalLeagueId: "league", externalTeamId: "team", lastPolledAt: null, nextPollAt: "", lastErrorCode: null },
  draftOrder: ["team-a", "team-b"],
  picks: [
    { pickNumber: 1, roundNumber: 1, pickInRound: 1, teamId: "team-b", playerId: "fx-1", nhlPlayerId: 42 },
    { pickNumber: 2, roundNumber: 1, pickInRound: 2, teamId: "team-a", playerId: "fx-2", nhlPlayerId: null },
  ],
  slots: [
    { pickNumber: 1, roundNumber: 1, pickInRound: 1, teamId: "team-b", playerId: "fx-1" },
    { pickNumber: 2, roundNumber: 1, pickInRound: 2, teamId: "team-a", playerId: "fx-2" },
    { pickNumber: 3, roundNumber: 2, pickInRound: 1, teamId: "team-a", playerId: null },
  ],
  warning: null,
  pollIntervalMs: 30000,
};

describe("Fantrax dashboard reconciliation", () => {
  it("maps exact team ownership and keeps future null slots pending", () => {
    const result = reconcileFantraxDraftState(state, [{ playerId: 42 }] as never, ["local-a", "local-b"]);
    expect(result.safe).toBe(true);
    expect(result.draftedPlayers.map((pick) => [pick.pickNumber, pick.teamId])).toEqual([[1, "local-b"], [2, "local-a"]]);
    expect(result.draftedPlayers[0].playerId).toBe("42");
    expect(result.unresolved).toEqual([{ pickNumber: 2, playerId: "fx-2" }]);
    expect(result.currentPick).toBe(3);
    expect(result.nextTeamId).toBe("local-a");
    expect([result.nextRound, result.nextPickInRound]).toEqual([2, 1]);
  });

  it("does not apply picks when the local team order cannot be mapped", () => {
    const result = reconcileFantraxDraftState(state, [], ["one-team"]);
    expect(result.safe).toBe(false);
    expect(result.draftedPlayers).toEqual([]);
  });
});
