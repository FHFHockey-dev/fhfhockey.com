import { describe, expect, it, vi } from "vitest";

import {
  finalizeScheduleNotRealizedGameStats,
  getTransactionalGameStatsFailureDetails,
  persistCompleteGameStatsTransaction,
  quarantineGameStatsBatch,
  TransactionalGameStatsPersistenceError,
} from "./transactionalGameStatsPersistence";

const gameId = 2025020001;
const teamRows = [
  { gameId, teamId: 1, score: 3 },
  { gameId, teamId: 2, score: 2 },
];
const skaterRows = [{ gameId, playerId: 10, position: "C" }];
const goalieRows = [{ gameId, playerId: 20, position: "G" }];

function completeReceipt(overrides: Record<string, unknown> = {}) {
  return {
    game_id: gameId,
    outcome: "complete",
    contract_version: 1,
    expected_team_rows: 2,
    observed_team_rows: 2,
    expected_skater_rows: 1,
    observed_skater_rows: 1,
    expected_goalie_rows: 1,
    observed_goalie_rows: 1,
    pruned_team_rows: 0,
    pruned_skater_rows: 0,
    pruned_goalie_rows: 0,
    completed_at: "2026-07-15T01:30:00.000Z",
    ...overrides,
  };
}

function quarantineReceipt(id: number) {
  return {
    game_id: id,
    outcome: "quarantined",
    reason: "game_not_finished",
    contract_version: 1,
    expected_team_rows: 0,
    observed_team_rows: 0,
    expected_skater_rows: 0,
    observed_skater_rows: 0,
    expected_goalie_rows: 0,
    observed_goalie_rows: 0,
    completed_at: "2026-07-15T01:30:00.000Z",
  };
}

function nonRealizedReceipt(overrides: Record<string, unknown> = {}) {
  return {
    ...quarantineReceipt(gameId),
    reason: "schedule_not_realized",
    ...overrides,
  };
}

function createSupabase(args: {
  playerLookupResults?: Array<{
    data: Array<{ id: number }> | null;
    error: unknown;
  }>;
  rpcResults?: Array<{ data: unknown; error: unknown }>;
}) {
  const playerLookupResults = [...(args.playerLookupResults ?? [])];
  const rpcResults = [...(args.rpcResults ?? [])];
  const limit = vi.fn(
    async () =>
      playerLookupResults.shift() ?? {
        data: [{ id: 10 }, { id: 20 }],
        error: null,
      },
  );
  const inIds = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ in: inIds }));
  const from = vi.fn((table: string) => {
    if (table !== "players") throw new Error(`Unexpected table ${table}`);
    return { select };
  });
  const rpc = vi.fn(
    async () =>
      rpcResults.shift() ?? { data: [completeReceipt()], error: null },
  );

  return {
    supabase: { from, rpc } as any,
    from,
    rpc,
    limit,
  };
}

async function captureRejection(callback: () => Promise<unknown>) {
  try {
    await callback();
  } catch (error) {
    return error;
  }
  throw new Error("Expected transactional persistence to reject.");
}

describe("persistCompleteGameStatsTransaction", () => {
  it("preflights parents and makes one complete RPC with normalized goalie defaults", async () => {
    const client = createSupabase({});
    const repairMissingPlayer = vi.fn();

    const receipt = await persistCompleteGameStatsTransaction({
      supabase: client.supabase,
      gameId,
      teamRows,
      skaterRows,
      goalieRows,
      repairMissingPlayer,
    });

    expect(receipt).toMatchObject({
      gameId,
      outcome: "complete",
      contractVersion: 1,
      observedTeamRows: 2,
      observedSkaterRows: 1,
      observedGoalieRows: 1,
    });
    expect(client.rpc).toHaveBeenCalledOnce();
    expect(client.rpc).toHaveBeenCalledWith(
      "persist_complete_game_stats_v1",
      expect.objectContaining({
        p_game_id: gameId,
        p_expected_team_rows: 2,
        p_expected_skater_rows: 1,
        p_expected_goalie_rows: 1,
        p_goalie_rows: [
          expect.objectContaining({
            playerId: 20,
            evenStrengthShotsAgainst: "0/0",
            toi: "00:00",
            savePctg: 0,
          }),
        ],
      }),
    );
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(repairMissingPlayer).not.toHaveBeenCalled();
  });

  it("repairs only exact missing parents and proves them on recheck before the RPC", async () => {
    const client = createSupabase({
      playerLookupResults: [
        { data: [{ id: 10 }], error: null },
        { data: [{ id: 10 }, { id: 20 }], error: null },
      ],
    });
    const repairMissingPlayer = vi.fn().mockResolvedValue(undefined);

    await persistCompleteGameStatsTransaction({
      supabase: client.supabase,
      gameId,
      teamRows,
      skaterRows,
      goalieRows,
      repairMissingPlayer,
    });

    expect(repairMissingPlayer).toHaveBeenCalledOnce();
    expect(repairMissingPlayer).toHaveBeenCalledWith(20);
    expect(client.limit).toHaveBeenCalledTimes(2);
    expect(client.rpc).toHaveBeenCalledOnce();
  });

  it("rejects duplicate identities before any database call", async () => {
    const client = createSupabase({});
    const error = await captureRejection(() =>
      persistCompleteGameStatsTransaction({
        supabase: client.supabase,
        gameId,
        teamRows,
        skaterRows: [...skaterRows, ...skaterRows],
        goalieRows,
        repairMissingPlayer: vi.fn(),
      }),
    );

    expect(error).toBeInstanceOf(TransactionalGameStatsPersistenceError);
    expect(getTransactionalGameStatsFailureDetails(error)).toMatchObject({
      phase: "validation",
      gameId,
      terminalError: { code: "INVALID_TRANSACTIONAL_GAME_STATS_INPUT" },
    });
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("retries the whole RPC once only for an exact player-parent FK race", async () => {
    const client = createSupabase({
      playerLookupResults: [
        { data: [{ id: 10 }, { id: 20 }], error: null },
        { data: [{ id: 10 }, { id: 20 }], error: null },
      ],
      rpcResults: [
        {
          data: null,
          error: {
            code: "23503",
            message: 'violates constraint "goaliesGameStats_playerId_fkey"',
          },
        },
        { data: [completeReceipt()], error: null },
      ],
    });

    await persistCompleteGameStatsTransaction({
      supabase: client.supabase,
      gameId,
      teamRows,
      skaterRows,
      goalieRows,
      repairMissingPlayer: vi.fn(),
    });

    expect(client.rpc).toHaveBeenCalledTimes(2);
    expect(client.limit).toHaveBeenCalledTimes(2);
  });

  it("does not retry unrelated RPC errors and sanitizes the failure", async () => {
    const client = createSupabase({
      rpcResults: [
        {
          data: null,
          error: {
            code: "42501",
            message:
              "denied at https://example.test/private Bearer sensitive-token\ncontinued",
          },
        },
      ],
    });
    const error = await captureRejection(() =>
      persistCompleteGameStatsTransaction({
        supabase: client.supabase,
        gameId,
        teamRows,
        skaterRows,
        goalieRows,
        repairMissingPlayer: vi.fn(),
      }),
    );

    expect(getTransactionalGameStatsFailureDetails(error)).toMatchObject({
      phase: "persistence_rpc",
      terminalError: {
        code: "42501",
        message: "denied at [redacted-url] Bearer [redacted] continued",
      },
    });
    expect(client.rpc).toHaveBeenCalledOnce();
  });

  it("fails closed on a zero-row or mismatched completion receipt", async () => {
    const client = createSupabase({
      rpcResults: [
        {
          data: [completeReceipt({ observed_goalie_rows: 0 })],
          error: null,
        },
      ],
    });
    const error = await captureRejection(() =>
      persistCompleteGameStatsTransaction({
        supabase: client.supabase,
        gameId,
        teamRows,
        skaterRows,
        goalieRows,
        repairMissingPlayer: vi.fn(),
      }),
    );

    expect(getTransactionalGameStatsFailureDetails(error)).toMatchObject({
      phase: "receipt_validation",
      terminalError: {
        code: "INVALID_TRANSACTIONAL_GAME_STATS_RECEIPT",
      },
    });
  });
});

describe("quarantineGameStatsBatch", () => {
  it("accepts only the exact bounded terminal receipt set", async () => {
    const client = createSupabase({
      rpcResults: [
        {
          data: [quarantineReceipt(2025020001), quarantineReceipt(2025020002)],
          error: null,
        },
      ],
    });

    const receipts = await quarantineGameStatsBatch({
      supabase: client.supabase,
      gameIds: [2025020002, 2025020001],
      reason: "game_not_finished",
    });

    expect(receipts.map((receipt) => receipt.gameId)).toEqual([
      2025020001, 2025020002,
    ]);
    expect(client.rpc).toHaveBeenCalledWith("quarantine_game_stats_v1", {
      p_game_ids: [2025020001, 2025020002],
      p_reason: "game_not_finished",
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("keeps the batch pending when the receipt set is incomplete", async () => {
    const client = createSupabase({
      rpcResults: [{ data: [quarantineReceipt(2025020001)], error: null }],
    });
    const error = await captureRejection(() =>
      quarantineGameStatsBatch({
        supabase: client.supabase,
        gameIds: [2025020001, 2025020002],
        reason: "game_not_finished",
      }),
    );

    expect(getTransactionalGameStatsFailureDetails(error)).toMatchObject({
      phase: "quarantine_receipt_validation",
      terminalError: {
        code: "INVALID_GAME_STATS_QUARANTINE_RECEIPT",
      },
    });
  });
});

describe("finalizeScheduleNotRealizedGameStats", () => {
  it("accepts one exact zero-count terminal receipt", async () => {
    const client = createSupabase({
      rpcResults: [{ data: [nonRealizedReceipt()], error: null }],
    });

    await expect(
      finalizeScheduleNotRealizedGameStats({
        supabase: client.supabase,
        gameId,
      }),
    ).resolves.toMatchObject({
      gameId,
      outcome: "quarantined",
      reason: "schedule_not_realized",
      observedTeamRows: 0,
      observedSkaterRows: 0,
      observedGoalieRows: 0,
    });
    expect(client.rpc).toHaveBeenCalledWith(
      "finalize_non_realized_game_stats_v1",
      { p_game_id: gameId },
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  it("fails closed on a malformed or mismatched terminal receipt", async () => {
    const client = createSupabase({
      rpcResults: [
        {
          data: [nonRealizedReceipt({ observed_goalie_rows: 1 })],
          error: null,
        },
      ],
    });
    const error = await captureRejection(() =>
      finalizeScheduleNotRealizedGameStats({
        supabase: client.supabase,
        gameId,
      }),
    );

    expect(getTransactionalGameStatsFailureDetails(error)).toMatchObject({
      phase: "non_realized_receipt_validation",
      terminalError: {
        code: "INVALID_NON_REALIZED_GAME_STATS_RECEIPT",
      },
    });
  });

  it("surfaces a sanitized RPC failure and leaves terminal state unclaimed", async () => {
    const client = createSupabase({
      rpcResults: [
        {
          data: null,
          error: {
            code: "P0001",
            message: "not old enough at https://example.test/private",
          },
        },
      ],
    });
    const error = await captureRejection(() =>
      finalizeScheduleNotRealizedGameStats({
        supabase: client.supabase,
        gameId,
      }),
    );

    expect(getTransactionalGameStatsFailureDetails(error)).toMatchObject({
      phase: "non_realized_rpc",
      terminalError: {
        code: "P0001",
        message: "not old enough at [redacted-url]",
      },
    });
  });
});
