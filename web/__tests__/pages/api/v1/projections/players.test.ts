import { beforeEach, describe, expect, it, vi } from "vitest";
import { provenSnapshotRow, unprovenSnapshotRow } from "lib/projections/externalInputProof.fixtures";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn()
}));

vi.mock("lib/projections/apiHelpers", async () => {
  const actual = await vi.importActual<any>("lib/projections/apiHelpers");
  return {
    ...actual,
    requireLatestSucceededRunId: vi.fn(async () => "run-123")
  };
});

type QueryResult = {
  data?: any;
  error: null;
};

function createQueryBuilder(resolver: () => QueryResult) {
  const builder: any = {
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    not() { return builder; },
    or() { return builder; },
    order() { return builder; },
    limit() { return builder; },
    in(column: string, ids: string[]) {
      builder.ids = ids;
      return builder;
    },
    maybeSingle() {
      const out = resolver();
      return Promise.resolve({ data: Array.isArray(out.data) ? out.data[0] ?? null : out.data ?? null, error: out.error });
    },
    then(resolve: (value: any) => any) {
      const out = resolver();
      return Promise.resolve(resolve({ data: out.data ?? [], error: out.error }));
    }
  };
  return builder;
}

vi.mock("lib/supabase/server", () => ({
  default: {
    from: fromMock
  }
}));

import handler from "../../../../../pages/api/v1/projections/players";

function createMockRes() {
  const res: any = {
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
    }
  };
  return res;
}

// Newest first, as the latest-run read orders them; each run's snapshot decides whether it is served.
let runs: Array<{ run_id: string; snapshot: Record<string, unknown> | null }> = [];
const projectionReads: string[] = [];

describe("/api/v1/projections/players", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runs = [{ run_id: "run-123", snapshot: provenSnapshotRow("run-123") }];
    projectionReads.length = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_player_projections") {
        const builder = createQueryBuilder(() => ({
          data: [{ player_id: 8478402, run_id: builder.runId }],
          error: null
        }));
        const eq = builder.eq;
        builder.eq = (column: string, value: string) => {
          if (column === "run_id") { builder.runId = value; projectionReads.push(value); }
          return eq(column, value);
        };
        return builder;
      }
      if (table === "forge_runs") {
        return createQueryBuilder(() => ({ data: runs.map(({ run_id }) => ({ run_id, status: "succeeded", git_sha: "a".repeat(40),
          metrics: {} })), error: null }));
      }
      if (table === "player_forecast_source_observations") {
        const builder = createQueryBuilder(() => ({
          data: runs.flatMap(run => run.snapshot && builder.ids?.includes(run.run_id) ? [run.snapshot] : []),
          error: null
        }));
        return builder;
      }
      return createQueryBuilder(() => ({ data: [], error: null }));
    });
  });

  const read = async (query: Record<string, string>) => {
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07", ...query } } as any, res);
    return res;
  };

  it("serves the latest run only when its snapshot proves external inputs were excluded", async () => {
    const res = await read({});
    expect(res.statusCode).toBe(200);
    expect(res.body.runId).toBe("run-123");
  });

  it("refuses an unproven legacy latest run instead of serving its rows", async () => {
    runs = [{ run_id: "legacy-run", snapshot: unprovenSnapshotRow("legacy-run") }];
    const res = await read({});
    expect(res.statusCode).toBe(404);
    expect(res.body.details).toEqual({ reason: "external_input_provenance_unproven", withheldRuns: 1 });
    expect(projectionReads).toEqual([]);
  });

  it("skips a newer unproven run for the date's latest proven one", async () => {
    runs = [{ run_id: "uncaptured-run", snapshot: null }, { run_id: "legacy-run", snapshot: unprovenSnapshotRow("legacy-run") },
      { run_id: "clean-run", snapshot: provenSnapshotRow("clean-run") }];
    const res = await read({});
    expect(res.statusCode).toBe(200);
    expect(res.body.runId).toBe("clean-run");
    expect(res.body.runProof).toEqual({ runId: "clean-run", basis: "captured_snapshot", releaseSha: null, closureSha256: null });
    expect(projectionReads).toEqual(["clean-run"]);
  });

  it("admits an explicit clean run by its snapshot proof, not by run-start metrics", async () => {
    // Run-start metrics never carry the exclusion claim; only the captured snapshot does.
    const runId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    runs = [{ run_id: runId, snapshot: provenSnapshotRow(runId) }];
    const proven = await read({ runId });
    expect(proven.statusCode).toBe(200);
    expect(proven.body.runId).toBe(runId);
    runs = [{ run_id: runId, snapshot: unprovenSnapshotRow(runId) }];
    const refused = await read({ runId });
    expect(refused.statusCode).toBe(422);
    expect(projectionReads).toEqual([runId]);
  });

  it("returns projection rows with explicit deprecation metadata", async () => {
    const req: any = {
      method: "GET",
      query: {
        date: "2026-02-07"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers.Deprecation).toBe("true");
    expect(res.headers["X-FHF-Canonical-Route"]).toBe("/api/v1/forge/players");
    expect(res.body).toMatchObject({
      deprecated: true,
      canonicalRoute: "/api/v1/forge/players",
      runId: "run-123",
      asOfDate: "2026-02-07"
    });
    expect(res.body.data).toEqual([{ player_id: 8478402, run_id: "run-123" }]);
  });
});
