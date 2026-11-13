import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
});

const { getSeasonForDateMock, supabaseState } = vi.hoisted(() => ({
  getSeasonForDateMock: vi.fn(),
  supabaseState: {
    current: {
      from() {
        throw new Error("Supabase mock not configured for this test.");
      },
    } as { from: (table: string) => unknown },
  },
}));

vi.mock("dotenv", () => ({
  default: { config: vi.fn() },
}));

vi.mock("lib/NHL/server", () => ({
  getLatestStartedSeasonForDate: getSeasonForDateMock,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      return supabaseState.current.from(table);
    },
  }),
}));

import handler from "../../../../../pages/api/v1/trends/team-ctpi";

function createMockRes() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as any,
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
  };
}

describe("/api/v1/trends/team-ctpi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSeasonForDateMock.mockResolvedValue({
      id: 20252026,
      startDate: "2025-10-07",
    });
  });

  it("paginates daily rows and reports source-date freshness instead of request time", async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      team: `T${index % 32}`,
      date: index === 1000 ? "2026-02-01" : "2026-01-31",
      ctpi_raw: 0.5,
      ctpi_0_to_100: 55,
      offense: 0.2,
      defense: 0.1,
      goaltending: 0.05,
      special_teams: 0.05,
      luck: null,
      computed_at: "2026-02-02T12:00:00.000Z",
      publication_status: "approved",
      formula_version: "recent-team-form-v2-candidate-2",
      input_version: "ctpi-one-team-game-input-v3-candidate",
      source_game_count: "10",
    }));
    const rangeCalls: Array<[number, number]> = [];

    supabaseState.current = {
      from(table: string) {
        if (table !== "team_ctpi_daily") {
          throw new Error(`Unexpected table: ${table}`);
        }
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          lte() {
            return this;
          },
          order() {
            return this;
          },
          range(from: number, to: number) {
            rangeCalls.push([from, to]);
            return Promise.resolve({
              data: rows.slice(from, to + 1),
              error: null,
            });
          },
        };
      },
    };

    const req: any = {
      method: "GET",
      query: { date: "2026-02-02" },
    };
    const res = createMockRes();

    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(getSeasonForDateMock).toHaveBeenCalledWith(
      "2026-02-02",
      expect.any(Object),
    );
    expect(rangeCalls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(res.body).toMatchObject({
      requestedDate: "2026-02-02",
      dateUsed: "2026-02-01",
      fallbackApplied: true,
      generatedAt: "2026-02-01T23:59:59.999Z",
      source: {
        kind: "team_ctpi_daily",
        ctpiVersion: 2,
        sourceDate: "2026-02-01",
        computedAt: "2026-02-02T12:00:00.000Z",
        rowCount: 1001,
        trustedRowCount: 1001,
        untrustedRowCount: 0,
      },
      coverage: {
        expectedTeams: 32,
        teamCount: 32,
        sourceRowCount: 1001,
        trustedRowCount: 1001,
        untrustedRowCount: 0,
        partial: true,
      },
    });
    expect(res.body.warnings).toEqual([
      "Recent Team Form is using the latest approved fallback date.",
    ]);
    expect(res.body.teams).toHaveLength(32);
  });

  it("hides candidate v2 rows (gated until validated) without recomputing any formula", async () => {
    const tables: string[] = [];
    supabaseState.current = {
      from(table: string) {
        tables.push(table);
        if (table !== "team_ctpi_daily") {
          throw new Error(`Unexpected table: ${table}`);
        }
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          lte() {
            return this;
          },
          order() {
            return this;
          },
          range() {
            return Promise.resolve({
              data: [
                {
                  team: "MTL",
                  date: "2026-02-01",
                  ctpi_raw: 2,
                  ctpi_0_to_100: 80,
                  offense: 2,
                  defense: 2,
                  goaltending: 0,
                  special_teams: 2,
                  luck: null,
                  computed_at: "2026-02-02T12:00:00.000Z",
                  publication_status: "candidate_unapproved",
                  formula_version: "recent-team-form-v2-candidate-2",
                  input_version: "ctpi-one-team-game-input-v3-candidate",
                  source_game_count: "10",
                },
              ],
              error: null,
            });
          },
        };
      },
    };
    const res = createMockRes();

    await handler(
      { method: "GET", query: { date: "2026-02-02" } } as any,
      res as any,
    );

    expect(res.statusCode).toBe(200);
    expect(tables).toEqual(["team_ctpi_daily"]);
    expect(res.body.teams).toEqual([]);
    expect(res.body.source).toMatchObject({
      kind: "team_ctpi_daily",
      ctpiVersion: 2,
      label: expect.stringContaining("candidate until validated"),
      sourceDate: null,
      rowCount: 1,
      trustedRowCount: 0,
      untrustedRowCount: 1,
      formulaVersion: null,
      inputVersion: null,
    });
    expect(res.body.coverage).toMatchObject({
      teamCount: 0,
      sourceRowCount: 1,
      trustedRowCount: 0,
      untrustedRowCount: 1,
      partial: true,
    });
    expect(res.body.warnings).toEqual([
      "Recent Team Form history is hidden unless its formula and source provenance are explicitly approved.",
      "Recent Team Form team coverage is incomplete.",
    ]);
  });

  it("selects rows by CTPI version, labels the version and keeps unknown v2 components unknown", async () => {
    const eqCalls: Array<[string, unknown]> = [];
    const row = (team: string, version: 1 | 2) => ({
      team,
      date: "2026-02-01",
      ctpi_raw: 0.4,
      ctpi_0_to_100: 56,
      offense: version === 2 ? null : 0.3,
      defense: 0.2,
      goaltending: 0.1,
      special_teams: 0.1,
      luck: version === 2 ? null : 0.4,
      computed_at: "2026-02-02T10:10:00.000Z",
      publication_status: "approved",
      formula_version:
        version === 2 ? "recent-team-form-v2-candidate-2" : "ctpi-formula-v1",
      input_version:
        version === 2
          ? "ctpi-one-team-game-input-v3-candidate"
          : "ctpi-one-game-input-v2",
      source_game_count: "10",
    });
    // Both versions are stored for the same team and date.
    const stored = [row("MTL", 1), row("MTL", 2)];
    supabaseState.current = {
      from() {
        const filters: Array<[string, unknown]> = [];
        const query = {
          select: () => query,
          eq(column: string, value: unknown) {
            eqCalls.push([column, value]);
            filters.push([column, value]);
            return query;
          },
          lte: () => query,
          order: () => query,
          range: () =>
            Promise.resolve({
              data: stored.filter((candidate) =>
                filters.every(
                  ([column, value]) =>
                    column !== "payload->>formulaVersion" ||
                    candidate.formula_version === value,
                ),
              ),
              error: null,
            }),
        };
        return query;
      },
    };

    const served = createMockRes();
    await handler(
      { method: "GET", query: { date: "2026-02-02" } } as any,
      served as any,
    );

    expect(eqCalls).toContainEqual([
      "payload->>formulaVersion",
      "recent-team-form-v2-candidate-2",
    ]);
    expect(served.body.source).toMatchObject({
      ctpiVersion: 2,
      sourceCutoff: "games_before_date",
      rowCount: 1,
      trustedRowCount: 1,
      formulaVersion: "recent-team-form-v2-candidate-2",
    });
    expect(served.body.teams).toEqual([
      expect.objectContaining({
        team: "MTL",
        ctpiVersion: 2,
        offense: null,
        luck: null,
        defense: 0.2,
      }),
    ]);

    eqCalls.length = 0;
    const history = createMockRes();
    await handler(
      { method: "GET", query: { date: "2026-02-02", version: "1" } } as any,
      history as any,
    );

    expect(eqCalls).toContainEqual([
      "payload->>formulaVersion",
      "ctpi-formula-v1",
    ]);
    expect(history.body.source).toMatchObject({
      ctpiVersion: 1,
      label: expect.stringContaining("CTPI v1"),
      sourceCutoff: "games_through_date",
      rowCount: 1,
    });
    expect(history.body.teams).toEqual([
      expect.objectContaining({ team: "MTL", ctpiVersion: 1, offense: 0.3 }),
    ]);
  });

  it("rejects an unknown CTPI version", async () => {
    supabaseState.current = {
      from() {
        throw new Error("must not query");
      },
    };
    const res = createMockRes();

    await handler(
      { method: "GET", query: { date: "2026-02-02", version: "3" } } as any,
      res as any,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("INVALID_CTPI_VERSION");
  });

  it("redacts dependency details from internal-error responses", async () => {
    supabaseState.current = {
      from() {
        throw new Error("private CTPI relation denied Bearer secret");
      },
    };
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const res = createMockRes();

    await handler(
      { method: "GET", query: { date: "2026-02-02" } } as any,
      res as any,
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      message: "Failed to load Recent Team Form.",
      error: "TEAM_CTPI_UNAVAILABLE",
    });
    expect(JSON.stringify(res.body)).not.toContain("secret");
    consoleError.mockRestore();
  });
});
