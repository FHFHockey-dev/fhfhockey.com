import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
});

const { fetchCurrentSeasonMock, tables } = vi.hoisted(() => ({
  fetchCurrentSeasonMock: vi.fn(),
  tables: { value: null as null | Record<string, any[]> },
}));

vi.mock("dotenv", () => ({
  default: { config: vi.fn() },
}));

vi.mock("../../../../../utils/fetchCurrentSeason", () => ({
  fetchCurrentSeason: fetchCurrentSeasonMock,
}));

/** Filters by eq(); order(desc) + limit(1) keeps the latest row. */
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      if (!tables.value) throw new Error("Supabase mock not configured for this test.");
      let rows = [...(tables.value[table] ?? [])];
      let orderKey: string | null = null;
      const chain: any = {
        select: () => chain,
        eq: (key: string, value: unknown) => {
          rows = rows.filter((row) => row[key] === value);
          return chain;
        },
        order: (key: string) => {
          orderKey = key;
          return chain;
        },
        limit: (n: number) => {
          const sorted = orderKey
            ? rows.sort((a, b) => String(b[orderKey!]).localeCompare(String(a[orderKey!])))
            : rows;
          return Promise.resolve({ data: sorted.slice(0, n), error: null });
        },
        then: (resolve: any, reject: any) =>
          Promise.resolve({ data: rows, error: null }).then(resolve, reject),
      };
      return chain;
    },
  }),
}));

import handler from "../../../../../pages/api/v1/trends/team-sos";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string | string[]>,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  } as any;
}

const v2Row = (team: string, overrides: Record<string, unknown> = {}) => ({
  season_id: 20252026,
  snapshot_date: "2026-01-14",
  team_id: team.charCodeAt(0),
  team_abbrev: team,
  sos_version: "descriptive-sos-v2",
  past_view: "past-retrospective",
  cutoff_at: "2026-01-15T09:12:03.000Z",
  past_fixtures: 30,
  pending_fixtures: 0,
  future_fixtures: 50,
  past_direct_supported: 30,
  future_direct_supported: 50,
  past_direct_win_pct: 0.6,
  past_indirect_win_pct: 0.5,
  past_direct_points_pct: 0.65,
  past_indirect_points_pct: 0.55,
  future_direct_win_pct: 0.4,
  future_indirect_win_pct: 0.5,
  future_direct_points_pct: 0.45,
  future_indirect_points_pct: 0.55,
  ...overrides,
});

/** A v1 row whose totals would read 0.9 / 0.1 if it were (wrongly) served. */
const v1Row = (team: string) => ({
  season_id: 20252026,
  game_date: "2026-01-15",
  team_id: team.charCodeAt(0),
  team_name: team,
  team_abbrev: team,
  past_opponent_total_wins: 9,
  past_opponent_total_losses: 1,
  past_opponent_total_ot_losses: 0,
  future_opponent_total_wins: 1,
  future_opponent_total_losses: 9,
  future_opponent_total_ot_losses: 0,
});

describe("/api/v1/trends/team-sos", () => {
  beforeEach(() => {
    tables.value = null;
    fetchCurrentSeasonMock.mockReset();
    fetchCurrentSeasonMock.mockResolvedValue({ id: 20252026 });
  });

  it("serves the latest descriptive-sos-v2 snapshot, labelled, never the v1 rows", async () => {
    tables.value = {
      sos_standings: [v1Row("AAA"), v1Row("BBB"), v1Row("CCC")],
      team_sos_daily: [
        v2Row("AAA", { snapshot_date: "2026-01-13", past_direct_win_pct: 0.1 }),
        v2Row("AAA", { pending_fixtures: 2 }),
        v2Row("BBB", { future_fixtures: 0, future_direct_win_pct: null }),
        v2Row("CCC", { future_direct_win_pct: null }),
        v2Row("DDD", { sos_version: "descriptive-sos-v3", past_direct_win_pct: 0.99 }),
      ],
    };
    const res = createMockRes();
    await handler({ method: "GET", query: {} } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      sosVersion: "descriptive-sos-v2",
      pastView: "past-retrospective",
      dateUsed: "2026-01-14",
      cutoffAt: "2026-01-15T09:12:03.000Z",
    });
    expect(res.body.definition).toContain("final games only");
    const byTeam = Object.fromEntries(res.body.teams.map((t: any) => [t.team, t]));
    expect(Object.keys(byTeam).sort()).toEqual(["AAA", "BBB", "CCC"]);
    // Both values are means over fixtures, so combined weights by fixture counts:
    // (0.6 x 30 + 0.4 x 50) / 80 = 0.475 (v1 rows would give 0.5).
    expect(byTeam.AAA.past).toMatchObject({ winPct: 0.6, pointsPct: 0.65, fixtures: 30, pendingFixtures: 2 });
    expect(byTeam.AAA.combinedWinPct).toBeCloseTo(0.475, 12);
    expect(byTeam.AAA.sosScore).toBe(47.5);
    // No future fixtures: combined is the past value alone.
    expect(byTeam.BBB.combinedWinPct).toBeCloseTo(0.6, 12);
    // Unknown future with fixtures stays unknown, not 0, and ranks last.
    expect(byTeam.CCC.future.winPct).toBeNull();
    expect(byTeam.CCC.combinedWinPct).toBeNull();
    expect(res.body.teams.map((t: any) => t.team)).toEqual(["BBB", "AAA", "CCC"]);
    expect(res.body.warnings).toContain(
      "2 team-games started before the cutoff without a final result are pending and not counted as past.",
    );
  });

  it("orders tied scores by team, not by input order", async () => {
    tables.value = { team_sos_daily: [v2Row("ZZZ"), v2Row("MMM"), v2Row("AAA")] };
    const res = createMockRes();
    await handler({ method: "GET", query: {} } as any, res);
    expect(res.body.teams.map((t: any) => t.team)).toEqual(["AAA", "MMM", "ZZZ"]);
  });

  it("reports v2 as not yet computed instead of falling back to v1", async () => {
    tables.value = { sos_standings: [v1Row("AAA")], team_sos_daily: [] };
    const res = createMockRes();
    await handler({ method: "GET", query: {} } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.teams).toEqual([]);
    expect(res.body.sosVersion).toBe("descriptive-sos-v2");
    expect(res.body.warnings[0]).toContain("has not been computed");
  });

  it("redacts dependency details from internal-error responses", async () => {
    fetchCurrentSeasonMock.mockRejectedValueOnce(
      new Error("relation private_seasons denied Bearer secret"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const res = createMockRes();

    await handler({ method: "GET", query: {} } as any, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      message: "Failed to compute strength of schedule.",
      error: "TEAM_SOS_UNAVAILABLE",
    });
    expect(JSON.stringify(res.body)).not.toContain("secret");
    consoleError.mockRestore();
  });
});
