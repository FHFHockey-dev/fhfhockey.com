import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "lib/supabase/database-generated.types";

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

import {
  getCurrentSeason,
  getLatestStartedSeasonForDate,
  getSchedule,
  getSeasonById,
  getTeams,
  isValidNhlSeasonId,
  resolveCanonicalTeamLineage,
  resolveLatestStartedSeasonIdForDate,
} from "./index";

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

function createLatestStartedSeasonClient(
  sourceRows: readonly SeasonRow[],
  queryError: Error | null = null,
) {
  let rows = [...sourceRows];
  const query = {
    select: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
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
  query.limit.mockImplementation((limit: number) => {
    rows = rows.slice(0, limit);
    return query;
  });
  query.maybeSingle.mockImplementation(async () => ({
    data: queryError ? null : (rows[0] ?? null),
    error: queryError,
  }));

  const from = vi.fn((table: string) => {
    if (table !== "seasons") throw new Error(`Unexpected table: ${table}`);
    return query;
  });

  return {
    client: { from } as unknown as SupabaseClient<Database>,
    from,
    query,
  };
}

function createTeamsQuery(args: {
  rows?: Array<{
    abbreviation: string;
    created_at: string;
    id: number;
    name: string;
  }> | null;
  error?: unknown;
}) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockResolvedValue({
    data: args.rows === undefined ? [] : args.rows,
    error: args.error ?? null,
  });
  return query;
}

describe("getTeams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([20232024, 20242025, 20252026])(
    "accepts consecutive eight-digit season ID %i",
    (seasonId) => {
      expect(isValidNhlSeasonId(seasonId)).toBe(true);
    },
  );

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    2024202,
    202420250,
    20242026,
    9007199254740992,
  ])("rejects invalid season ID %s", (seasonId) => {
    expect(isValidNhlSeasonId(seasonId)).toBe(false);
  });

  it.each([
    [53, "ARI", { id: 68, abbreviation: "UTA" }],
    [59, "UTA", { id: 68, abbreviation: "UTA" }],
    [68, "UTA", { id: 68, abbreviation: "UTA" }],
    [1, "NJD", { id: 1, abbreviation: "NJD" }],
    [54, "VGK", { id: 54, abbreviation: "VGK" }],
  ])(
    "resolves canonical lineage for %i/%s",
    (teamId, abbreviation, expected) => {
      expect(
        resolveCanonicalTeamLineage(teamId as number, abbreviation as string),
      ).toEqual(expected);
    },
  );

  it.each([
    [53, "UTA"],
    [59, "ARI"],
    [68, "ARI"],
    [11, "ATL"],
    [999, "ZZZ"],
  ])("rejects unknown lineage %i/%s", (teamId, abbreviation) => {
    expect(
      resolveCanonicalTeamLineage(teamId as number, abbreviation as string),
    ).toBeNull();
  });

  it("returns only exact persisted membership and preserves retired identities", async () => {
    const query = createTeamsQuery({
      rows: [
        {
          id: 59,
          name: "Utah Hockey Club",
          abbreviation: "UTA",
          created_at: "2024-01-01T00:00:00.000Z",
        },
        {
          id: 1,
          name: "New Jersey Devils",
          abbreviation: "NJD",
          created_at: "2024-01-01T00:00:00.000Z",
        },
        {
          id: 53,
          name: "Arizona Coyotes",
          abbreviation: "ARI",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });
    mocks.from.mockImplementation((table: string) => {
      if (table !== "teams") throw new Error(`Unexpected table: ${table}`);
      return query;
    });

    await expect(getTeams(20232024)).resolves.toEqual([
      {
        id: 1,
        name: "New Jersey Devils",
        abbreviation: "NJD",
        logo: "/teamLogos/NJD.png",
      },
      {
        id: 53,
        name: "Arizona Coyotes",
        abbreviation: "ARI",
        logo: "/teamLogos/ARI.png",
      },
      {
        id: 59,
        name: "Utah Hockey Club",
        abbreviation: "UTA",
        logo: "/teamLogos/UTA.png",
      },
    ]);
    expect(query.select).toHaveBeenCalledWith(
      "id, name, abbreviation, team_season!inner()",
    );
    expect(query.eq).toHaveBeenCalledWith("team_season.seasonId", 20232024);
  });

  it("returns an empty exact season without padding or static fallback", async () => {
    const query = createTeamsQuery({ rows: [] });
    mocks.from.mockReturnValue(query);

    await expect(getTeams(19981999)).resolves.toEqual([]);
  });

  it("propagates an exact lookup failure", async () => {
    const lookupError = new Error("team lookup failed");
    const query = createTeamsQuery({ rows: null, error: lookupError });
    mocks.from.mockReturnValue(query);

    await expect(getTeams(20242025)).rejects.toBe(lookupError);
  });

  it("rejects invalid explicit seasons before any lookup", async () => {
    await expect(getTeams(20242026)).rejects.toThrow(
      "A valid consecutive eight-digit season ID is required.",
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("keeps the no-season path current-canonical and pads the active catalog", async () => {
    const seasonsQuery = createSeasonQuery([
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
    const teamsQuery = createTeamsQuery({
      rows: [
        {
          id: 59,
          name: "Utah Hockey Club",
          abbreviation: "UTA",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === "seasons") return seasonsQuery;
      if (table === "teams") return teamsQuery;
      throw new Error(`Unexpected table: ${table}`);
    });

    const teams = await getTeams();

    expect(teamsQuery.eq).toHaveBeenCalledWith(
      "team_season.seasonId",
      20252026,
    );
    expect(teams.some((team) => team.id === 53 || team.id === 59)).toBe(false);
    expect(teams.find((team) => team.id === 68)).toEqual({
      id: 68,
      name: "Utah Mammoth",
      abbreviation: "UTA",
      logo: "/teamLogos/UTA.png",
    });
    expect(teams.length).toBeGreaterThan(1);
  });

  it("retains the static fallback only for current-canonical lookups", async () => {
    const query = createTeamsQuery({
      rows: null,
      error: new Error("team lookup failed"),
    });
    mocks.from.mockReturnValue(query);

    const teams = await getTeams(20252026, { mode: "current-canonical" });

    expect(teams.length).toBeGreaterThan(1);
    expect(teams.find((team) => team.id === 68)?.name).toBe("Utah Mammoth");
  });
});

describe("getSchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds the same schedule without loading an unused team directory", async () => {
    mocks.get.mockResolvedValue({
      gameWeek: [
        {
          date: "2026-01-05",
          dayAbbrev: "MON",
          numberOfGames: 1,
          games: [
            {
              id: 2025020601,
              season: 20252026,
              awayTeam: { id: 53, abbrev: "ARI", score: 2 },
              homeTeam: { id: 68, abbrev: "UTA", score: 3 },
            },
          ],
        },
      ],
    });

    const result = await getSchedule("2026-01-05", { includeOdds: false });

    expect(mocks.get).toHaveBeenCalledWith("/schedule/2026-01-05");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(result.numGamesPerDay).toEqual([1, 0, 0, 0, 0, 0, 0]);
    expect(result.data[53].MON).toMatchObject({
      id: 2025020601,
      homeTeam: { id: 68, score: 3 },
      awayTeam: { id: 53, score: 2 },
    });
    expect(result.data[68].MON).toEqual(result.data[53].MON);
  });

  it("keeps the default expected-goals source call and odds mapping", async () => {
    mocks.get.mockResolvedValue({
      gameWeek: [
        {
          date: "2026-01-05",
          dayAbbrev: "MON",
          numberOfGames: 1,
          games: [
            {
              id: 2025020601,
              season: 20252026,
              awayTeam: { id: 1, abbrev: "NJD", score: 2 },
              homeTeam: { id: 2, abbrev: "NYI", score: 3 },
            },
          ],
        },
      ],
    });
    const oddsQuery = {
      select: vi.fn(),
      in: vi.fn(),
    };
    oddsQuery.select.mockReturnValue(oddsQuery);
    oddsQuery.in.mockResolvedValue({
      data: [
        {
          game_id: 2025020601,
          home_win_odds: 0.6,
          away_win_odds: 0.4,
          home_api_win_odds: 0.58,
          away_api_win_odds: 0.42,
        },
      ],
      error: null,
    });
    mocks.from.mockImplementation((table: string) => {
      if (table !== "expected_goals") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return oddsQuery;
    });

    const result = await getSchedule("2026-01-05");

    expect(mocks.from).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledWith("expected_goals");
    expect(oddsQuery.select).toHaveBeenCalledWith(
      "game_id, home_win_odds, away_win_odds, home_api_win_odds, away_api_win_odds",
    );
    expect(oddsQuery.in).toHaveBeenCalledWith("game_id", [2025020601]);
    expect(result.data[2].MON).toMatchObject({
      homeTeam: { winOdds: 0.6, apiWinOdds: 0.58 },
      awayTeam: { winOdds: 0.4, apiWinOdds: 0.42 },
    });
  });
});

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

describe("latest-started season resolution", () => {
  const seasons: SeasonRow[] = [
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
    {
      id: 20232024,
      startDate: "2023-10-10T00:00:00.000Z",
      regularSeasonEndDate: "2024-04-18T00:00:00.000Z",
      endDate: "2024-06-24T00:00:00.000Z",
      numberOfGames: 1312,
    },
  ];

  it.each([
    ["2025-03-14", 20242025],
    ["2026-07-21", 20252026],
    ["2026-10-06", 20262027],
  ])(
    "uses persisted season starts for selected date %s",
    async (date, expectedSeasonId) => {
      const { client, from, query } = createLatestStartedSeasonClient(seasons);

      await expect(
        resolveLatestStartedSeasonIdForDate(date, client),
      ).resolves.toBe(expectedSeasonId);
      expect(from).toHaveBeenCalledOnce();
      expect(from).toHaveBeenCalledWith("seasons");
      expect(query.select).toHaveBeenCalledWith(
        "id,startDate,regularSeasonEndDate,endDate,numberOfGames",
      );
      expect(query.lte).toHaveBeenCalledWith(
        "startDate",
        `${date}T23:59:59.999Z`,
      );
      expect(query.order).toHaveBeenCalledWith("startDate", {
        ascending: false,
      });
      expect(query.limit).toHaveBeenCalledWith(1);
      expect(query.maybeSingle).toHaveBeenCalledOnce();
    },
  );

  it("accepts a real leap-day date", async () => {
    const { client, from } = createLatestStartedSeasonClient(seasons);

    await expect(
      resolveLatestStartedSeasonIdForDate("2024-02-29", client),
    ).resolves.toBe(20232024);
    expect(from).toHaveBeenCalledOnce();
  });

  it.each(["2026-02-30", "2025-02-29", "2026-2-07", "not-a-date"])(
    "rejects invalid selected date %s before querying",
    async (date) => {
      const { client, from } = createLatestStartedSeasonClient(seasons);

      await expect(getLatestStartedSeasonForDate(date, client)).rejects.toThrow(
        "A valid date in YYYY-MM-DD format is required.",
      );
      expect(from).not.toHaveBeenCalled();
    },
  );

  it("returns null for dates before the earliest persisted season", async () => {
    const { client, query } = createLatestStartedSeasonClient(seasons);

    await expect(
      getLatestStartedSeasonForDate("2000-01-01", client),
    ).resolves.toBeNull();
    expect(query.limit).toHaveBeenCalledWith(1);
    expect(query.maybeSingle).toHaveBeenCalledOnce();
  });

  it("fails the ID resolver when no persisted season has started", async () => {
    const { client } = createLatestStartedSeasonClient(seasons);

    await expect(
      resolveLatestStartedSeasonIdForDate("2000-01-01", client),
    ).rejects.toThrow("Unable to resolve season id for date=2000-01-01");
  });

  it("propagates a bounded query error", async () => {
    const queryError = new Error("season lookup failed");
    const { client, query } = createLatestStartedSeasonClient(
      seasons,
      queryError,
    );

    await expect(
      getLatestStartedSeasonForDate("2026-07-21", client),
    ).rejects.toBe(queryError);
    expect(query.limit).toHaveBeenCalledWith(1);
    expect(query.maybeSingle).toHaveBeenCalledOnce();
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
