import { describe, expect, it } from "vitest";

import {
  KEEPER_CONTRACT_VERSION,
  getNextOpenPick,
  materializeKeeperPicks,
  migrateKeeperEntries,
  parseKeeperImport,
  validateKeeperBatch,
  validateKeeperCandidate
} from "./keepers";

const context = {
  teamCount: 4,
  roundCount: 3,
  teamIds: ["Team 1", "Team 2", "Team 3", "Team 4"],
  playerIds: ["1", "2", "3", "4"]
};

describe("keeper contract", () => {
  it("creates a versioned valid keeper with a stable global pick", () => {
    expect(
      validateKeeperCandidate(
        { playerId: "1", teamId: "Team 2", round: 2, pickInRound: 3 },
        context
      )
    ).toEqual({
      ok: true,
      keeper: {
        version: KEEPER_CONTRACT_VERSION,
        status: "valid",
        playerId: "1",
        teamId: "Team 2",
        round: 2,
        pickInRound: 3,
        pickNumber: 7
      }
    });
  });

  it("rejects invalid identities, bounds, duplicates, and completed picks", () => {
    const existing = validateKeeperCandidate(
      { playerId: "1", teamId: "Team 1", round: 1, pickInRound: 1 },
      context
    );
    if (!existing.ok) throw new Error("fixture failed");
    const result = validateKeeperCandidate(
      { playerId: "1", teamId: "Missing", round: 4, pickInRound: 5 },
      {
        ...context,
        keepers: [existing.keeper],
        draftedPlayers: [
          {
            playerId: "2",
            teamId: "Team 2",
            round: 2,
            pickInRound: 1,
            pickNumber: 5
          }
        ]
      }
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Keeper team is invalid.",
        "Round must be between 1 and 3.",
        "Pick must be between 1 and 4."
      ])
    );

    const conflict = validateKeeperCandidate(
      { playerId: "2", teamId: "Team 2", round: 1, pickInRound: 1 },
      { ...context, keepers: [existing.keeper] }
    );
    expect(conflict).toMatchObject({ ok: false });
  });

  it("materializes typed keeper picks and preserves only them on reset", () => {
    const valid = validateKeeperCandidate(
      { playerId: "1", teamId: "Team 1", round: 1, pickInRound: 1 },
      context
    );
    if (!valid.ok) throw new Error("fixture failed");
    const reset = materializeKeeperPicks([], [valid.keeper]);
    expect(reset).toEqual([
      expect.objectContaining({
        playerId: "1",
        pickNumber: 1,
        isKeeper: true,
        keeperVersion: KEEPER_CONTRACT_VERSION
      })
    ]);
    expect(
      materializeKeeperPicks(
        [
          ...reset,
          {
            playerId: "2",
            teamId: "Team 2",
            round: 1,
            pickInRound: 2,
            pickNumber: 2
          }
        ],
        [valid.keeper]
      )
    ).toHaveLength(2);
    expect(materializeKeeperPicks(reset, [])).toEqual([]);
    expect(getNextOpenPick(1, 8, [{ pickNumber: 1 }, { pickNumber: 2 }])).toBe(
      3
    );
  });

  it("migrates legacy persisted keepers into the current version", () => {
    expect(
      migrateKeeperEntries(
        [
          { playerId: 1, teamId: "Team 1", round: 2, pickInRound: 4 },
          { playerId: 1, teamId: "Team 2", round: 1, pickInRound: 1 }
        ],
        4
      )
    ).toEqual([
      expect.objectContaining({
        version: KEEPER_CONTRACT_VERSION,
        status: "valid",
        playerId: "1",
        pickNumber: 8
      })
    ]);
  });

  it("parses JSON and CSV batches transactionally with row errors", () => {
    const json = parseKeeperImport(
      JSON.stringify([
        { playerId: "1", teamId: "Team 1", round: 1, pickInRound: 1 },
        { playerId: "2", teamId: "Team 2", round: 1, pickInRound: 2 }
      ])
    );
    expect(json).toMatchObject({ ok: true });
    if (!json.ok) return;
    expect(validateKeeperBatch(json.candidates, context)).toMatchObject({
      ok: true,
      keepers: [{ playerId: "1" }, { playerId: "2" }]
    });

    const csv = parseKeeperImport(
      "playerId,teamId,round,pickInRound\n1,Team 1,1,1\n1,Team 2,1,2"
    );
    if (!csv.ok) throw new Error("CSV fixture failed");
    expect(validateKeeperBatch(csv.candidates, context)).toMatchObject({
      ok: false,
      keepers: [],
      errors: [expect.stringContaining("Row 2")]
    });
  });
});
