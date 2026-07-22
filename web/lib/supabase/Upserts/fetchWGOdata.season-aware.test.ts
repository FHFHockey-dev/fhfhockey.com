import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  return {
    fetch: vi.fn(),
    expectedTeamId: 0,
    originalServiceRoleKey,
    originalSupabaseUrl,
    upsertedRows: [] as Array<Record<string, unknown>>,
  };
});

vi.mock("node-fetch", () => ({ default: mocks.fetch }));
vi.mock("progress", () => ({
  default: class ProgressBarMock {
    tick() {}
  },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      if (table === "games") {
        const builder = {
          select: () => builder,
          eq: () => builder,
          range: async () => ({
            data: [
              {
                id: 9001,
                homeTeamId: mocks.expectedTeamId,
                awayTeamId: 6,
              },
            ],
            error: null,
          }),
        };
        return builder;
      }

      if (table === "wgo_team_stats") {
        const builder = {
          select: () => builder,
          eq: () => builder,
          limit: async () => ({ data: [], error: null }),
          upsert: async (
            rows: Record<string, unknown> | Array<Record<string, unknown>>,
          ) => {
            mocks.upsertedRows.push(...(Array.isArray(rows) ? rows : [rows]));
            return { error: null };
          },
        };
        return builder;
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { main } from "lib/supabase/Upserts/fetchWGOdata.js";

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    json: async () => payload,
  };
}

function installOneDateSources(
  seasonId: number,
  date: string,
  franchiseId: number,
) {
  const datasetRow = {
    franchiseId,
    franchiseName: "Deliberately stale upstream name",
    gamesPlayed: 1,
  };
  const season = {
    id: seasonId,
    formattedSeasonId: `${String(seasonId).slice(0, 4)}-${String(
      seasonId,
    ).slice(4)}`,
    startDate: `${date}T00:00:00Z`,
    regularSeasonEndDate: `${date}T00:00:00Z`,
    endDate: `${date}T00:00:00Z`,
  };

  mocks.fetch.mockImplementation(async (url: string) => {
    if (url.includes("/season?")) {
      return jsonResponse({ data: [season] });
    }
    if (url.includes("/team/")) {
      return jsonResponse({ data: [datasetRow] });
    }
    throw new Error(`Unexpected URL: ${url}`);
  });
}

describe("fetchWGOdata season-aware writer identity", () => {
  afterAll(() => {
    if (mocks.originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = mocks.originalSupabaseUrl;
    }
    if (mocks.originalServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = mocks.originalServiceRoleKey;
    }
  });

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "time").mockImplementation(() => undefined);
    vi.spyOn(console, "timeEnd").mockImplementation(() => undefined);
    mocks.fetch.mockReset();
    mocks.upsertedRows.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    {
      seasonId: 20232024,
      date: "2023-10-10",
      franchiseId: 28,
      teamId: 53,
      teamName: "Arizona Coyotes",
    },
    {
      seasonId: 20242025,
      date: "2024-10-10",
      franchiseId: 40,
      teamId: 59,
      teamName: "Utah Hockey Club",
    },
    {
      seasonId: 20252026,
      date: "2025-10-10",
      franchiseId: 40,
      teamId: 68,
      teamName: "Utah Mammoth",
    },
  ])(
    "writes canonical $seasonId identity from the per-season catalog",
    async ({ seasonId, date, franchiseId, teamId, teamName }) => {
      mocks.expectedTeamId = teamId;
      installOneDateSources(seasonId, date, franchiseId);

      await main({ date, recent: false, allSeasons: true });

      expect(mocks.fetch).toHaveBeenCalledTimes(12);
      expect(mocks.upsertedRows).toHaveLength(1);
      expect(mocks.upsertedRows[0]).toMatchObject({
        season_id: String(seasonId),
        date,
        team_id: teamId,
        franchise_name: teamName,
        game_id: 9001,
        opponent_id: 6,
      });
    },
  );
});
