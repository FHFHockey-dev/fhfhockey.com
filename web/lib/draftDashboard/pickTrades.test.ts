import { describe, expect, it } from "vitest";

import {
  PICK_TRADE_CONTRACT_VERSION,
  findPicksUntilTeamTurn,
  migratePickTrades,
  parsePickTradeImport,
  resolvePickOwner,
  upsertPickTrade,
  validatePickTradeBatch
} from "./pickTrades";

const base = {
  draftOrder: ["Team 1", "Team 2", "Team 3", "Team 4"],
  roundCount: 3,
  isSnakeDraft: true
};

describe("pick trade contract", () => {
  it("derives original owners and stable global identity across snake rounds", () => {
    const result = upsertPickTrade(
      { round: 2, pickInRound: 1, currentTeamId: "Team 1" },
      base
    );
    expect(result).toMatchObject({
      ok: true,
      trade: {
        version: PICK_TRADE_CONTRACT_VERSION,
        pickNumber: 5,
        originalTeamId: "Team 4",
        currentTeamId: "Team 1"
      }
    });
  });

  it("rejects bounds, unknown/no-op owners, and completed ordinary picks", () => {
    expect(
      upsertPickTrade(
        { round: 4, pickInRound: 5, currentTeamId: "Missing" },
        base
      )
    ).toMatchObject({ ok: false });
    expect(
      upsertPickTrade(
        { round: 1, pickInRound: 1, currentTeamId: "Team 1" },
        base
      )
    ).toMatchObject({ ok: false });
    expect(
      upsertPickTrade(
        { round: 1, pickInRound: 1, currentTeamId: "Team 2" },
        {
          ...base,
          draftedPlayers: [
            { playerId: "1", teamId: "Team 1", round: 1, pickInRound: 1, pickNumber: 1 }
          ]
        }
      )
    ).toMatchObject({ ok: false });
  });

  it("keeps keeper display precedence while preserving the underlying trade", () => {
    const result = upsertPickTrade(
      { round: 1, pickInRound: 1, currentTeamId: "Team 2" },
      {
        ...base,
        keepers: [
          {
            version: 1,
            status: "valid",
            playerId: "1",
            teamId: "Team 3",
            round: 1,
            pickInRound: 1,
            pickNumber: 1
          }
        ]
      }
    );
    if (!result.ok) throw new Error("fixture failed");
    expect(result.warnings[0]).toContain("Team 3");
    expect(
      resolvePickOwner({
        round: 1,
        pickInRound: 1,
        draftOrder: base.draftOrder,
        isSnakeDraft: true,
        trades: result.trades,
        keepers: [
          {
            version: 1,
            status: "valid",
            playerId: "1",
            teamId: "Team 3",
            round: 1,
            pickInRound: 1,
            pickNumber: 1
          }
        ]
      })
    ).toMatchObject({ currentTeamId: "Team 3", tradedTeamId: "Team 2", source: "keeper" });
  });

  it("migrates legacy maps and validates bulk input transactionally", () => {
    expect(migratePickTrades({ "2-1": "Team 1" }, base)).toEqual([
      expect.objectContaining({ pickNumber: 5, originalTeamId: "Team 4" })
    ]);
    const parsed = parsePickTradeImport(
      "round,pickInRound,currentTeamId\n1,1,Team 2\n1,2,Team 2"
    );
    if (!parsed.ok) throw new Error("fixture failed");
    expect(validatePickTradeBatch(parsed.candidates, base)).toMatchObject({
      ok: false,
      trades: [],
      errors: [expect.stringContaining("Row 2")]
    });

    const multiple = validatePickTradeBatch(
      [
        { round: 1, pickInRound: 1, currentTeamId: "Team 2" },
        { round: 2, pickInRound: 1, currentTeamId: "Team 1" }
      ],
      base
    );
    expect(multiple).toMatchObject({ ok: true });
    if (!multiple.ok) return;
    expect(multiple.trades).toHaveLength(2);
    const edited = upsertPickTrade(
      { round: 1, pickInRound: 1, currentTeamId: "Team 3" },
      { ...base, trades: multiple.trades }
    );
    expect(edited).toMatchObject({ ok: true });
    if (edited.ok) {
      expect(edited.trades).toHaveLength(2);
      expect(edited.trade.currentTeamId).toBe("Team 3");
    }
  });

  it("uses traded ownership and skips completed keeper turns in forecasts", () => {
    const traded = upsertPickTrade(
      { round: 1, pickInRound: 2, currentTeamId: "Team 1" },
      base
    );
    if (!traded.ok) throw new Error("fixture failed");
    expect(
      findPicksUntilTeamTurn({
        currentPick: 1,
        teamId: "Team 1",
        draftOrder: base.draftOrder,
        isSnakeDraft: true,
        trades: traded.trades,
        maxPickNumber: 12
      })
    ).toBe(1);
    expect(
      findPicksUntilTeamTurn({
        currentPick: 1,
        teamId: "Team 1",
        draftOrder: base.draftOrder,
        isSnakeDraft: true,
        trades: traded.trades,
        completedPickNumbers: [2],
        maxPickNumber: 12
      })
    ).toBe(7);
  });
});
