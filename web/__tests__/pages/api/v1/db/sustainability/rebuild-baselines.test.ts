import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler
}));

const { assertBaselinesPrerequisitesMock, readMock, upsertMock, issue } = vi.hoisted(() => ({
  assertBaselinesPrerequisitesMock: vi.fn(),
  readMock: vi.fn(),
  upsertMock: vi.fn(),
  issue: {
    code: "missing_player_stats_unified",
    message:
      "Missing prerequisite data in player_stats_unified for baseline rebuild.",
    detail: "No player_stats_unified rows were found on or after 2025-03-21.",
    action:
      "Refresh player_stats_unified before rebuilding sustainability baselines."
  } as const
}));

vi.mock("../../../../../../lib/sustainability/dependencyChecks", async () => {
  const actual =
    await vi.importActual<
      typeof import("../../../../../../lib/sustainability/dependencyChecks")
    >("../../../../../../lib/sustainability/dependencyChecks");
  return {
    ...actual,
    assertBaselinesPrerequisites: assertBaselinesPrerequisitesMock
  };
});

// In-memory PostgREST stand-in: reads resolve at range(), writes are recorded.
vi.mock("lib/supabase/server", () => ({
  default: {
    from: (table: string) => {
      if (table === "player_baselines") return { upsert: upsertMock };
      if (table === "cron_job_audit") return { insert: async () => ({ error: null }) };
      const state: { table: string; select?: string; ids?: number[] } = { table };
      const query: any = {
        select: (select: string) => { state.select = select; return query; },
        gte: () => query,
        not: () => query,
        order: () => query,
        in: (_column: string, ids: number[]) => { state.ids = ids; return query; },
        range: async (from: number, to: number) => readMock(state, from, to),
      };
      return query;
    },
  },
}));

import handler from "../../../../../../pages/api/v1/db/sustainability/rebuild-baselines";
import { SustainabilityDependencyError } from "../../../../../../lib/sustainability/dependencyChecks";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  } as any;
}

describe("/api/v1/db/sustainability/rebuild-baselines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a structured prerequisite failure when unified stats are missing", async () => {
    assertBaselinesPrerequisitesMock.mockRejectedValue(
      new SustainabilityDependencyError(issue)
    );

    const req: any = {
      method: "GET",
      query: { snapshot_date: "2026-03-21" }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(424);
    expect(res.body.success).toBe(false);
    expect(res.body.prerequisite).toEqual(issue);
    expect(res.body.dependencyError.message).toBe(issue.message);
  });

  // 2026-10-17: the totals read for a later batch timed out behind the
  // 10:41 UTC matview refresh after earlier batch upserts had committed.
  function mockBatches(totalsTimeoutOnCall: number | null) {
    const players = Array.from({ length: 150 }, (_, index) => ({
      player_id: 8470001 + index, player_name: `Player ${index}`, position_code: "C"
    }));
    let totalsCalls = 0;
    readMock.mockImplementation(async (state: { table: string; select?: string }, from: number) => {
      if (state.table === "player_stats_unified") {
        return { data: state.select === "player_id, player_name, position_code" && from === 0 ? players : [], error: null };
      }
      totalsCalls += 1;
      return totalsCalls === totalsTimeoutOnCall
        ? { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } }
        : { data: [], error: null };
    });
    upsertMock.mockResolvedValue({ error: null });
  }

  it("reports committed batches when a later totals read times out", async () => {
    assertBaselinesPrerequisitesMock.mockResolvedValue(undefined);
    mockBatches(2);
    const res = createMockRes();

    await handler({ method: "GET", query: { snapshot_date: "2026-10-17" } } as any, res);

    expect(res.statusCode).toBe(500);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0]).toHaveLength(100);
    expect(res.body).toMatchObject({
      success: false,
      snapshot_date: "2026-10-17",
      processed: 100,
      rowsUpserted: 100,
      partialWrite: true,
    });
    expect(res.body.message).toContain("statement timeout");
  });

  it("reports every committed row on success and none for a dry run", async () => {
    assertBaselinesPrerequisitesMock.mockResolvedValue(undefined);
    mockBatches(null);
    const res = createMockRes();
    await handler({ method: "GET", query: { snapshot_date: "2026-10-17" } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, processed: 150, rowsUpserted: 150 });

    upsertMock.mockClear();
    const dryRes = createMockRes();
    await handler({ method: "GET", query: { snapshot_date: "2026-10-17", dry: "1" } } as any, dryRes);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(dryRes.body).toMatchObject({ success: true, dry_run: true, processed: 150, rowsUpserted: 0 });
  });
});
