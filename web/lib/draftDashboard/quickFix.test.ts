import { describe, expect, it } from "vitest";

import { replaceManualDraftPick } from "./quickFix";

const picks = [
  {
    playerId: "1",
    teamId: "Team 1",
    pickNumber: 1,
    round: 1,
    pickInRound: 1,
  },
  {
    playerId: "2",
    teamId: "Team 2",
    pickNumber: 2,
    round: 1,
    pickInRound: 2,
  },
  {
    playerId: "3",
    teamId: "Team 1",
    pickNumber: 3,
    round: 2,
    pickInRound: 1,
  },
];

describe("Quick Fix", () => {
  it("replaces only the target player and leaves a restorable snapshot", () => {
    const snapshot = picks.map((pick) => ({ ...pick }));
    const result = replaceManualDraftPick({
      draftedPlayers: picks,
      currentPick: 4,
      targetPickNumber: 2,
      replacementPlayerId: "9",
      selectablePlayerIds: new Set(["9"]),
    });
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.players).toEqual([
      picks[0],
      { ...picks[1], playerId: "9" },
      picks[2],
    ]);
    expect(result.players[1]).toMatchObject({
      teamId: "Team 2",
      pickNumber: 2,
      round: 1,
      pickInRound: 2,
    });
    expect(picks).toEqual(snapshot);
  });

  it("rejects keepers, future/provider picks, and unavailable replacements", () => {
    expect(
      replaceManualDraftPick({
        draftedPlayers: [{ ...picks[0], isKeeper: true }],
        currentPick: 2,
        targetPickNumber: 1,
        replacementPlayerId: "9",
        selectablePlayerIds: new Set(["9"]),
      }),
    ).toMatchObject({ ok: false });
    expect(
      replaceManualDraftPick({
        draftedPlayers: picks,
        currentPick: 2,
        targetPickNumber: 2,
        replacementPlayerId: "9",
        selectablePlayerIds: new Set(["9"]),
      }),
    ).toMatchObject({ ok: false });
    expect(
      replaceManualDraftPick({
        draftedPlayers: [{ ...picks[0], source: "yahoo" as const }],
        currentPick: 2,
        targetPickNumber: 1,
        replacementPlayerId: "9",
        selectablePlayerIds: new Set(["9"]),
      }),
    ).toMatchObject({ ok: false });
    expect(
      replaceManualDraftPick({
        draftedPlayers: picks,
        currentPick: 4,
        targetPickNumber: 1,
        replacementPlayerId: "9",
        selectablePlayerIds: new Set(),
      }),
    ).toMatchObject({ ok: false });
  });
});
