import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  get: vi.fn(),
  restGet: vi.fn(),
  updatePlayer: vi.fn(),
}));

vi.mock("lib/supabase/public-client", () => ({
  default: {
    from: mocks.from,
  },
}));

vi.mock("lib/supabase/server", () => ({
  default: {},
}));

vi.mock("lib/NHL/base", () => ({
  get: mocks.get,
  restGet: mocks.restGet,
}));

vi.mock("pages/api/v1/db/update-player/[playerId]", () => ({
  updatePlayer: mocks.updatePlayer,
}));

import { getCurrentSeason, getSeasonById } from "./index";

type SeasonRow = {
  endDate: string;
  id: number;
  numberOfGames: number;
  regularSeasonEndDate: string;
  startDate: string;
};

function createSeasonQuery(sourceRows: readonly SeasonRow[]) {
  let rows = [...sourceRows];
  const query = {
    select: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };

  query.select.mockImplementation(() => query);
  query.lte.mockImplementation((column: string, value: string) => {
    if (column === "startDate") {
      rows = rows.filter((row) => row.startDate <= value);
    }
    return query;
  });
  query.order.mockImplementation(
    (column: string, options: { ascending: boolean }) => {
      if (column === "startDate") {
        rows.sort((left, right) =>
          options.ascending
            ? left.startDate.localeCompare(right.startDate)
            : right.startDate.localeCompare(left.startDate),
        );
      }
      return query;
    },
  );
  query.limit.mockImplementation(async (limit: number) => ({
    data: rows.slice(0, limit),
    error: null,
  }));

  return query;
}

describe("getCurrentSeason", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("selects the latest-started season after its end rather than an upcoming season", async () => {
    const query = createSeasonQuery([
      {
        id: 20262027,
        startDate: "2026-10-06T00:00:00.000Z",
        regularSeasonEndDate: "2027-04-15T00:00:00.000Z",
        endDate: "2027-06-25T00:00:00.000Z",
        numberOfGames: 1312,
      },
      {
        id: 20252026,
        startDate: "2025-10-07T00:00:00.000Z",
        regularSeasonEndDate: "2026-04-16T00:00:00.000Z",
        endDate: "2026-06-25T00:00:00.000Z",
        numberOfGames: 1312,
      },
      {
        id: 20242025,
        startDate: "2024-10-04T00:00:00.000Z",
        regularSeasonEndDate: "2025-04-17T00:00:00.000Z",
        endDate: "2025-06-17T00:00:00.000Z",
        numberOfGames: 1312,
      },
    ]);
    mocks.from.mockImplementation((table: string) => {
      if (table !== "seasons") {
        throw new Error(`Unexpected public table: ${table}`);
      }
      return query;
    });

    const season = await getCurrentSeason();

    expect(mocks.from).toHaveBeenCalledWith("seasons");
    expect(query.lte).toHaveBeenCalledWith(
      "startDate",
      "2026-07-21T12:00:00.000Z",
    );
    expect(query.order).toHaveBeenCalledWith("startDate", {
      ascending: false,
    });
    expect(query.limit).toHaveBeenCalledWith(2);
    expect(season).toMatchObject({
      seasonId: 20252026,
      lastSeasonId: 20242025,
      seasonEndDate: "2026-06-25T00:00:00.000Z",
    });
    expect(mocks.restGet).not.toHaveBeenCalled();
  });
});

describe("getSeasonById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses one exact season-ID row without an unbounded scan", async () => {
    const row: SeasonRow = {
      id: 20242025,
      startDate: "2024-10-04T00:00:00.000Z",
      regularSeasonEndDate: "2025-04-17T00:00:00.000Z",
      endDate: "2025-06-17T00:00:00.000Z",
      numberOfGames: 1312,
    };
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({ data: row, error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table !== "seasons") throw new Error(`Unexpected table: ${table}`);
      return query;
    });

    await expect(getSeasonById(20242025)).resolves.toEqual(row);
    expect(query.select).toHaveBeenCalledWith(
      "id,startDate,regularSeasonEndDate,endDate,numberOfGames",
    );
    expect(query.eq).toHaveBeenCalledWith("id", 20242025);
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("rejects unsafe season identities before querying", async () => {
    await expect(getSeasonById(Number.NaN)).rejects.toThrow(
      "A valid season ID is required.",
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
