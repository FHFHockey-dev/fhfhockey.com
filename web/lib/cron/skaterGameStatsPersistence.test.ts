import { describe, expect, it, vi } from "vitest";

import {
  getPlayerGameStatsBatchFailureDetails,
  persistGoalieGameStatsBatch,
  persistSkaterGameStatsBatch,
  GoalieGameStatsBatchError,
  SkaterGameStatsBatchError,
} from "lib/cron/skaterGameStatsPersistence";

const gameId = 2025020001;
const skaterRows = [
  { gameId, playerId: 1, goals: 1 },
  { gameId, playerId: 2, goals: 0 },
];
const goalieRows = [
  { gameId, playerId: 11, goalsAgainst: 1 },
  { gameId, playerId: 12, goalsAgainst: 2 },
];

const skaterPlayerForeignKeyError = {
  code: "23503",
  message:
    'insert or update on table "skatersGameStats" violates foreign key constraint "skatersgamestats_playerid_fkey"',
  details: 'Key (playerId)=(2) is not present in table "players".',
};
const goaliePlayerForeignKeyError = {
  code: "23503",
  message:
    'insert or update on table "goaliesGameStats" violates foreign key constraint "goaliesGameStats_playerId_fkey"',
  details: 'Key (playerId)=(12) is not present in table "players".',
};

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error("Expected promise to reject, but it resolved.");
}

function createSupabaseMock(args: {
  statsTable: "skatersGameStats" | "goaliesGameStats";
  upsertResults: Array<{ error: unknown | null }>;
  parentResult?: {
    data: Array<{ id: number }> | null;
    error: unknown | null;
  };
}) {
  const upsert = vi.fn();
  for (const result of args.upsertResults) {
    upsert.mockResolvedValueOnce(result);
  }

  const limit = vi.fn().mockResolvedValue(
    args.parentResult ?? {
      data: [],
      error: null,
    },
  );
  const inFilter = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ in: inFilter }));
  const from = vi.fn((table: string) => {
    if (table === args.statsTable) return { upsert };
    if (table === "players") return { select };
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    supabase: { from } as any,
    from,
    upsert,
    select,
    inFilter,
    limit,
  };
}

describe("persistSkaterGameStatsBatch", () => {
  it("persists a successful request as one complete batch", async () => {
    const client = createSupabaseMock({
      statsTable: "skatersGameStats",
      upsertResults: [{ error: null }],
    });
    const repairMissingPlayer = vi.fn();

    await expect(
      persistSkaterGameStatsBatch({
        supabase: client.supabase,
        rows: skaterRows,
        gameId,
        repairMissingPlayer,
      }),
    ).resolves.toBe(2);

    expect(client.upsert).toHaveBeenCalledOnce();
    expect(client.upsert).toHaveBeenCalledWith(skaterRows);
    expect(client.select).not.toHaveBeenCalled();
    expect(repairMissingPlayer).not.toHaveBeenCalled();
  });

  it("repairs only proven-missing parents and retries the complete batch once", async () => {
    const client = createSupabaseMock({
      statsTable: "skatersGameStats",
      upsertResults: [{ error: skaterPlayerForeignKeyError }, { error: null }],
      parentResult: {
        data: [{ id: 1 }],
        error: null,
      },
    });
    const repairMissingPlayer = vi.fn().mockResolvedValue(undefined);

    await expect(
      persistSkaterGameStatsBatch({
        supabase: client.supabase,
        rows: skaterRows,
        gameId,
        repairMissingPlayer,
      }),
    ).resolves.toBe(2);

    expect(client.inFilter).toHaveBeenCalledWith("id", [1, 2]);
    expect(client.limit).toHaveBeenCalledWith(2);
    expect(repairMissingPlayer).toHaveBeenCalledOnce();
    expect(repairMissingPlayer).toHaveBeenCalledWith(2);
    expect(client.upsert.mock.calls).toEqual([[skaterRows], [skaterRows]]);
  });

  it("throws structured details without per-row writes when the retry fails", async () => {
    const client = createSupabaseMock({
      statsTable: "skatersGameStats",
      upsertResults: [
        { error: skaterPlayerForeignKeyError },
        {
          error: {
            code: "23503",
            message:
              "parent remained missing at https://example.test/private Bearer sensitive-token\ncontinued",
          },
        },
      ],
      parentResult: {
        data: [{ id: 1 }],
        error: null,
      },
    });

    const error = await captureRejection(
      persistSkaterGameStatsBatch({
        supabase: client.supabase,
        rows: skaterRows,
        gameId,
        repairMissingPlayer: vi.fn().mockResolvedValue(undefined),
      }),
    );

    expect(error).toBeInstanceOf(SkaterGameStatsBatchError);
    expect(getPlayerGameStatsBatchFailureDetails(error)).toMatchObject({
      kind: "skater_game_stats_batch_failure",
      code: "SKATER_GAME_STATS_BATCH_FAILED",
      phase: "retry_upsert",
      gameId,
      requestedRows: 2,
      playerIds: [1, 2],
      missingPlayerIds: [2],
      terminalError: {
        code: "23503",
        message:
          "parent remained missing at [redacted-url] Bearer [redacted] continued",
      },
    });
    expect(client.upsert.mock.calls).toEqual([[skaterRows], [skaterRows]]);
  });

  it("requires the exact named skater player FK before attempting repair", async () => {
    const otherPlayerForeignKeyError = {
      code: "23503",
      message:
        'insert or update violates foreign key constraint "other_player_fkey"',
      details: 'Key (playerId)=(2) is not present in table "players".',
    };
    const client = createSupabaseMock({
      statsTable: "skatersGameStats",
      upsertResults: [{ error: otherPlayerForeignKeyError }],
    });
    const repairMissingPlayer = vi.fn();

    const error = await captureRejection(
      persistSkaterGameStatsBatch({
        supabase: client.supabase,
        rows: skaterRows,
        gameId,
        repairMissingPlayer,
      }),
    );

    expect(error).toBeInstanceOf(SkaterGameStatsBatchError);
    expect(getPlayerGameStatsBatchFailureDetails(error)).toMatchObject({
      phase: "initial_upsert",
      missingPlayerIds: [],
      terminalError: { code: "23503" },
    });
    expect(client.upsert).toHaveBeenCalledOnce();
    expect(client.select).not.toHaveBeenCalled();
    expect(repairMissingPlayer).not.toHaveBeenCalled();
  });
});

describe("persistGoalieGameStatsBatch", () => {
  it("repairs only proven-missing goalie parents and retries the complete batch", async () => {
    const client = createSupabaseMock({
      statsTable: "goaliesGameStats",
      upsertResults: [{ error: goaliePlayerForeignKeyError }, { error: null }],
      parentResult: {
        data: [{ id: 11 }],
        error: null,
      },
    });
    const repairMissingPlayer = vi.fn().mockResolvedValue(undefined);

    await expect(
      persistGoalieGameStatsBatch({
        supabase: client.supabase,
        rows: goalieRows,
        gameId,
        repairMissingPlayer,
      }),
    ).resolves.toBe(2);

    expect(client.inFilter).toHaveBeenCalledWith("id", [11, 12]);
    expect(client.limit).toHaveBeenCalledWith(2);
    expect(repairMissingPlayer).toHaveBeenCalledOnce();
    expect(repairMissingPlayer).toHaveBeenCalledWith(12);
    expect(client.upsert.mock.calls).toEqual([[goalieRows], [goalieRows]]);
  });

  it("throws structured details when missing-parent repair fails", async () => {
    const client = createSupabaseMock({
      statsTable: "goaliesGameStats",
      upsertResults: [{ error: goaliePlayerForeignKeyError }],
      parentResult: {
        data: [{ id: 11 }],
        error: null,
      },
    });

    const error = await captureRejection(
      persistGoalieGameStatsBatch({
        supabase: client.supabase,
        rows: goalieRows,
        gameId,
        repairMissingPlayer: vi
          .fn()
          .mockRejectedValue(new Error("NHL parent repair failed")),
      }),
    );

    expect(error).toBeInstanceOf(GoalieGameStatsBatchError);
    expect(getPlayerGameStatsBatchFailureDetails(error)).toMatchObject({
      kind: "goalie_game_stats_batch_failure",
      code: "GOALIE_GAME_STATS_BATCH_FAILED",
      phase: "parent_repair",
      requestedRows: 2,
      missingPlayerIds: [12],
      failedRepairPlayerId: 12,
      terminalError: {
        code: null,
        message: "NHL parent repair failed",
      },
    });
    expect(client.upsert).toHaveBeenCalledOnce();
  });

  it("throws structured details after one complete-batch retry fails", async () => {
    const client = createSupabaseMock({
      statsTable: "goaliesGameStats",
      upsertResults: [
        { error: goaliePlayerForeignKeyError },
        { error: { code: "42501", message: "retry denied" } },
      ],
      parentResult: {
        data: [{ id: 11 }],
        error: null,
      },
    });

    const error = await captureRejection(
      persistGoalieGameStatsBatch({
        supabase: client.supabase,
        rows: goalieRows,
        gameId,
        repairMissingPlayer: vi.fn().mockResolvedValue(undefined),
      }),
    );

    expect(error).toBeInstanceOf(GoalieGameStatsBatchError);
    expect(getPlayerGameStatsBatchFailureDetails(error)).toMatchObject({
      kind: "goalie_game_stats_batch_failure",
      phase: "retry_upsert",
      requestedRows: 2,
      terminalError: { code: "42501", message: "retry denied" },
    });
    expect(client.upsert.mock.calls).toEqual([[goalieRows], [goalieRows]]);
  });

  it("fails closed without parent lookup for non-FK errors", async () => {
    const client = createSupabaseMock({
      statsTable: "goaliesGameStats",
      upsertResults: [
        { error: { code: "42501", message: "permission denied" } },
      ],
    });
    const repairMissingPlayer = vi.fn();

    const error = await captureRejection(
      persistGoalieGameStatsBatch({
        supabase: client.supabase,
        rows: goalieRows,
        gameId,
        repairMissingPlayer,
      }),
    );

    expect(error).toBeInstanceOf(GoalieGameStatsBatchError);
    expect(getPlayerGameStatsBatchFailureDetails(error)).toMatchObject({
      kind: "goalie_game_stats_batch_failure",
      phase: "initial_upsert",
      terminalError: { code: "42501", message: "permission denied" },
    });
    expect(client.select).not.toHaveBeenCalled();
    expect(repairMissingPlayer).not.toHaveBeenCalled();
  });

  it("rejects more than 100 parent IDs before any database request", async () => {
    const client = createSupabaseMock({
      statsTable: "goaliesGameStats",
      upsertResults: [],
    });
    const oversizedRows = Array.from({ length: 101 }, (_, index) => ({
      gameId,
      playerId: index + 1,
    }));

    const error = await captureRejection(
      persistGoalieGameStatsBatch({
        supabase: client.supabase,
        rows: oversizedRows,
        gameId,
        repairMissingPlayer: vi.fn(),
      }),
    );

    expect(error).toBeInstanceOf(GoalieGameStatsBatchError);
    expect(getPlayerGameStatsBatchFailureDetails(error)).toMatchObject({
      kind: "goalie_game_stats_batch_failure",
      phase: "validation",
      requestedRows: 101,
      terminalError: { code: "INVALID_GOALIE_GAME_STATS_BATCH" },
    });
    expect(client.from).not.toHaveBeenCalled();
  });
});
