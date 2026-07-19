import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  queryLog: [] as any[],
  responses: [] as any[],
}));

vi.mock("lib/supabase", () => ({
  default: { from: mocks.from },
}));

import { getDateRangeForGames } from "./utilities";

const request = {
  teamId: 22,
  seasonId: 20252026,
  seasonType: "regularSeason" as const,
  gamesBack: 7 as const,
  scopeStartDate: "2025-10-01",
  scopeEndDate: "2026-04-15",
};

function completedGameRow(index: number) {
  return {
    id: index,
    game_id: 2025020000 + index,
    date: `2026-03-${String(20 - index).padStart(2, "0")}`,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queryLog.length = 0;
  mocks.responses.length = 0;
  mocks.from.mockImplementation((table: string) => {
    const log = {
      table,
      select: "",
      eq: [] as any[],
      gte: [] as any[],
      lte: [] as any[],
      order: [] as any[],
      range: null as [number, number] | null,
    };
    mocks.queryLog.push(log);

    const query = {
      select(fields: string) {
        log.select = fields;
        return query;
      },
      eq(column: string, value: unknown) {
        log.eq.push([column, value]);
        return query;
      },
      gte(column: string, value: unknown) {
        log.gte.push([column, value]);
        return query;
      },
      lte(column: string, value: unknown) {
        log.lte.push([column, value]);
        return query;
      },
      order(column: string, options: unknown) {
        log.order.push([column, options]);
        return query;
      },
      range(from: number, to: number) {
        log.range = [from, to];
        const response = mocks.responses.shift();
        if (!response) throw new Error("Unexpected WGO page request.");
        return Promise.resolve(response);
      },
    };
    return query;
  });
});

describe("getDateRangeForGames", () => {
  it("uses the exact page-owned season/type bounds and returns exact newest-first IDs", async () => {
    const rows = Array.from({ length: 7 }, (_, index) =>
      completedGameRow(index + 1),
    );
    mocks.responses.push({ data: rows, error: null });

    await expect(getDateRangeForGames(request)).resolves.toEqual({
      startDate: rows[6].date,
      endDate: rows[0].date,
      gameIds: rows.map((row) => row.game_id),
      requestedGameCount: 7,
      resolvedGameCount: 7,
    });
    expect(mocks.queryLog).toEqual([
      {
        table: "wgo_team_stats",
        select: "id,game_id,date",
        eq: [
          ["team_id", 22],
          ["season_id", 20252026],
        ],
        gte: [["date", "2025-10-01"]],
        lte: [["date", "2026-04-15"]],
        order: [
          ["date", { ascending: false }],
          ["game_id", { ascending: false, nullsFirst: false }],
          ["id", { ascending: false }],
        ],
        range: [0, 6],
      },
    ]);
  });

  it("uses the supplied playoff bounds without inferring them from the current season", async () => {
    const rows = Array.from({ length: 7 }, (_, index) =>
      completedGameRow(index + 1),
    );
    mocks.responses.push({ data: rows, error: null });

    await getDateRangeForGames({
      ...request,
      seasonType: "playoffs",
      scopeStartDate: "2026-04-16",
      scopeEndDate: "2026-06-24",
    });

    expect(mocks.queryLog[0].gte).toEqual([["date", "2026-04-16"]]);
    expect(mocks.queryLog[0].lte).toEqual([["date", "2026-06-24"]]);
  });

  it("returns null when the completed-game ledger has fewer than N rows", async () => {
    mocks.responses.push({
      data: Array.from({ length: 6 }, (_, index) =>
        completedGameRow(index + 1),
      ),
      error: null,
    });

    await expect(getDateRangeForGames(request)).resolves.toBeNull();
  });

  it("rejects database and malformed-ledger results instead of substituting older games", async () => {
    mocks.responses.push({
      data: null,
      error: new Error("date lookup failed"),
    });
    await expect(getDateRangeForGames(request)).rejects.toThrow(
      "date lookup failed",
    );

    mocks.responses.push({
      data: Array.from({ length: 7 }, (_, index) =>
        completedGameRow(index + 1),
      ).map((row, index) => (index === 0 ? { ...row, game_id: null } : row)),
      error: null,
    });
    await expect(getDateRangeForGames(request)).rejects.toThrow(
      "invalid game ID",
    );
  });

  it("rejects duplicate identities and malformed dates within the fixed N candidates", async () => {
    const duplicateRows = Array.from({ length: 7 }, (_, index) =>
      completedGameRow(index + 1),
    );
    duplicateRows[1] = {
      ...duplicateRows[1],
      game_id: duplicateRows[0].game_id,
    };
    mocks.responses.push({ data: duplicateRows, error: null });
    await expect(getDateRangeForGames(request)).rejects.toThrow(
      "duplicate game ID",
    );

    const malformedDateRows = Array.from({ length: 7 }, (_, index) =>
      completedGameRow(index + 1),
    );
    malformedDateRows[0] = { ...malformedDateRows[0], date: "2026-02-30" };
    mocks.responses.push({ data: malformedDateRows, error: null });
    await expect(getDateRangeForGames(request)).rejects.toThrow("invalid date");
  });

  it("rejects invalid ownership before querying", async () => {
    await expect(
      getDateRangeForGames({ ...request, teamId: 0 }),
    ).rejects.toThrow("valid team ID");
    await expect(
      getDateRangeForGames({
        ...request,
        scopeStartDate: "2026-04-16",
        scopeEndDate: "2026-04-15",
      }),
    ).rejects.toThrow("valid season-type date scope");
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
