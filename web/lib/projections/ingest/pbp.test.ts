import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    deleteError: null as Error | null,
    gameError: null as Error | null,
    playsError: null as Error | null,
    storedPlays: [] as Array<{
      id: number;
      gameid: number;
      typedesckey: string | null;
    }>,
  };
  const operations: string[] = [];
  const deleteEq = vi.fn(async (_column: string, gameId: number) => {
    operations.push(`delete:${gameId}`);
    if (!state.deleteError) {
      state.storedPlays = state.storedPlays.filter(
        (play) => play.gameid !== gameId,
      );
    }
    return { error: state.deleteError };
  });
  const deletePlays = vi.fn(() => ({ eq: deleteEq }));
  const upsertGame = vi.fn(async () => {
    operations.push("upsert:game");
    return { error: state.gameError };
  });
  const upsertPlays = vi.fn(async (rows: typeof state.storedPlays) => {
    operations.push("upsert:plays");
    if (!state.playsError) {
      for (const row of rows) {
        state.storedPlays = state.storedPlays.filter(
          (stored) => stored.gameid !== row.gameid || stored.id !== row.id,
        );
        state.storedPlays.push(row);
      }
    }
    return { error: state.playsError };
  });
  const from = vi.fn((table: string) => {
    if (table === "pbp_games") return { upsert: upsertGame };
    if (table === "pbp_plays") {
      return { delete: deletePlays, upsert: upsertPlays };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    state,
    operations,
    deleteEq,
    deletePlays,
    upsertGame,
    upsertPlays,
    from,
  };
});

vi.mock("lib/supabase/server", () => ({
  default: { from: mocks.from },
}));

import { isCompleteFinalPbpPayload, upsertPbpGameAndPlays } from "./pbp";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    id: 2025020001,
    season: 20252026,
    gameType: 2,
    gameState: "OFF",
    gameDate: "2025-10-07",
    startTimeUTC: "2025-10-07T23:00:00Z",
    awayTeam: {
      id: 2,
      abbrev: "BBB",
      commonName: { default: "Away" },
      score: 1,
    },
    homeTeam: {
      id: 1,
      abbrev: "AAA",
      commonName: { default: "Home" },
      score: 2,
    },
    plays: [
      { eventId: 1, typeDescKey: "shot-on-goal" },
      { eventId: 2, typeDescKey: "game-end" },
    ],
    ...overrides,
  };
}

describe("final PBP payload completeness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.length = 0;
    mocks.state.deleteError = null;
    mocks.state.gameError = null;
    mocks.state.playsError = null;
    mocks.state.storedPlays = [];
  });

  it("requires a final state and exactly one terminal game-end event", () => {
    expect(isCompleteFinalPbpPayload(payload() as any)).toBe(true);
    expect(
      isCompleteFinalPbpPayload(payload({ gameState: "LIVE" }) as any),
    ).toBe(false);
    expect(
      isCompleteFinalPbpPayload(
        payload({ plays: [{ eventId: 1, typeDescKey: "game-end" }] }) as any,
      ),
    ).toBe(false);
    expect(
      isCompleteFinalPbpPayload(
        payload({ plays: [{ eventId: 1, typeDescKey: "period-end" }] }) as any,
      ),
    ).toBe(false);
    expect(
      isCompleteFinalPbpPayload(
        payload({
          plays: [
            { eventId: 1, typeDescKey: "game-end" },
            { eventId: 2, typeDescKey: "game-end" },
          ],
        }) as any,
      ),
    ).toBe(false);
  });

  it("rejects duplicate event identities before any database mutation", async () => {
    const duplicateEventPayload = payload({
      plays: [
        { eventId: 1, typeDescKey: "shot-on-goal" },
        { eventId: 1, typeDescKey: "faceoff" },
        { eventId: 2, typeDescKey: "game-end" },
      ],
    });

    expect(isCompleteFinalPbpPayload(duplicateEventPayload as any)).toBe(false);
    await expect(
      upsertPbpGameAndPlays(duplicateEventPayload as any),
    ).rejects.toThrow("not final and complete");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("validates every mapped play before deleting the stored snapshot", async () => {
    const invalidTypeCodePayload = payload({
      plays: [
        { eventId: 1, typeDescKey: "shot-on-goal", typeCode: "invalid" },
        { eventId: 2, typeDescKey: "game-end", typeCode: 999 },
      ],
    });

    await expect(
      upsertPbpGameAndPlays(invalidTypeCodePayload as any),
    ).rejects.toThrow("invalid type code");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("replaces the complete game scope before writing the fresh snapshot", async () => {
    mocks.state.storedPlays = [
      { id: 1, gameid: 2025020001, typedesckey: "stale-event" },
      { id: 2, gameid: 2025020001, typedesckey: "game-end" },
      { id: 99, gameid: 2025020001, typedesckey: "game-end" },
      { id: 99, gameid: 2025020002, typedesckey: "game-end" },
    ];

    const result = await upsertPbpGameAndPlays(payload() as any);

    expect(result).toEqual({ playsUpserted: 2 });
    expect(mocks.deletePlays).toHaveBeenCalledTimes(1);
    expect(mocks.deleteEq).toHaveBeenCalledWith("gameid", 2025020001);
    expect(mocks.upsertGame).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 2025020001,
        hometeamscore: 2,
        awayteamscore: 1,
      }),
      { onConflict: "id" },
    );
    expect(mocks.upsertPlays).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 1,
          gameid: 2025020001,
          typedesckey: "shot-on-goal",
        }),
        expect.objectContaining({
          id: 2,
          gameid: 2025020001,
          typedesckey: "game-end",
        }),
      ],
      { onConflict: "gameid,id" },
    );
    expect(mocks.operations).toEqual([
      "delete:2025020001",
      "upsert:game",
      "upsert:plays",
    ]);
    expect(
      mocks.state.storedPlays
        .filter((play) => play.gameid === 2025020001)
        .map(({ id, gameid, typedesckey }) => ({ id, gameid, typedesckey })),
    ).toEqual([
      { id: 1, gameid: 2025020001, typedesckey: "shot-on-goal" },
      { id: 2, gameid: 2025020001, typedesckey: "game-end" },
    ]);
    expect(
      mocks.state.storedPlays.filter((play) => play.gameid === 2025020002),
    ).toEqual([{ id: 99, gameid: 2025020002, typedesckey: "game-end" }]);
  });

  it("stops before either upsert when exact-scope deletion fails", async () => {
    const deleteError = new Error("delete failed");
    mocks.state.deleteError = deleteError;

    await expect(upsertPbpGameAndPlays(payload() as any)).rejects.toBe(
      deleteError,
    );
    expect(mocks.operations).toEqual(["delete:2025020001"]);
    expect(mocks.upsertGame).not.toHaveBeenCalled();
    expect(mocks.upsertPlays).not.toHaveBeenCalled();
  });

  it("leaves terminal evidence absent when a post-delete write fails", async () => {
    const gameError = new Error("game upsert failed");
    mocks.state.gameError = gameError;
    mocks.state.storedPlays = [
      { id: 2, gameid: 2025020001, typedesckey: "game-end" },
    ];

    await expect(upsertPbpGameAndPlays(payload() as any)).rejects.toBe(
      gameError,
    );
    expect(mocks.operations).toEqual(["delete:2025020001", "upsert:game"]);
    expect(mocks.upsertPlays).not.toHaveBeenCalled();
    expect(mocks.state.storedPlays).toEqual([]);

    vi.clearAllMocks();
    mocks.operations.length = 0;
    mocks.state.gameError = null;
    const playsError = new Error("plays upsert failed");
    mocks.state.playsError = playsError;
    mocks.state.storedPlays = [
      { id: 2, gameid: 2025020001, typedesckey: "game-end" },
    ];

    await expect(upsertPbpGameAndPlays(payload() as any)).rejects.toBe(
      playsError,
    );
    expect(mocks.operations).toEqual([
      "delete:2025020001",
      "upsert:game",
      "upsert:plays",
    ]);
    expect(mocks.state.storedPlays).toEqual([]);
  });
});
