import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  auditInsertMock,
  requireLatestSucceededRunIdMock,
  runProjectionPreflightChecksMock
} = vi.hoisted(() => ({
  auditInsertMock: vi.fn().mockResolvedValue({ error: null }),
  requireLatestSucceededRunIdMock: vi.fn(),
  runProjectionPreflightChecksMock: vi.fn()
}));

vi.mock("lib/supabase", () => ({
  default: {
    from: vi.fn(() => ({
      insert: auditInsertMock
    }))
  }
}));

vi.mock("lib/supabase/server", () => ({
  default: {}
}));

vi.mock("lib/projections/apiHelpers", () => ({
  requireLatestSucceededRunId: requireLatestSucceededRunIdMock
}));

vi.mock("../../../../../pages/api/v1/db/run-projection-v2", () => ({
  runProjectionPreflightChecks: runProjectionPreflightChecksMock
}));

import handler, {
  buildSkaterActualMatchDiagnostics,
  replaceProjectionResultsAtomic
} from "../../../../../pages/api/v1/db/run-projection-accuracy";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as any,
    headersSent: false,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      this.headersSent = true;
      return this;
    }
  };
  return res;
}

describe("/api/v1/db/run-projection-accuracy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runProjectionPreflightChecksMock.mockResolvedValue({
      asOfDate: "2026-03-19",
      bypassed: false,
      status: "PASS",
      gates: []
    });
    requireLatestSucceededRunIdMock.mockRejectedValue(
      new Error(
        "<!DOCTYPE html><html><title>fyhftlxokyjtpndbkfse.supabase.co | 522: Connection timed out</title></html>"
      )
    );
  });

  it("returns structured dependency diagnostics instead of raw html errors", async () => {
    const req: any = {
      method: "GET",
      query: {
        date: "2026-03-20"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      scanSummary: {
        surface: "projection_accuracy_operator",
        status: "blocked",
        fallbackApplied: false,
        rowCounts: {
          rowsUpserted: 0
        },
        blockingIssueCount: 1
      },
      error:
        "Upstream dependency returned an HTML error page instead of structured JSON.",
      dependencyError: {
        kind: "dependency_error",
        classification: "html_upstream_response",
        source: "supabase_or_proxy",
        htmlLike: true
      }
    });
  });

  it("returns 422 when projection freshness preflight fails", async () => {
    runProjectionPreflightChecksMock.mockResolvedValueOnce({
      asOfDate: "2026-03-19",
      bypassed: false,
      status: "FAIL",
      gates: [
        {
          gate_key: "projection_derived_v2",
          status: "FAIL",
          detail: "player_latest=none",
          action: "Run /api/v1/db/build-projection-derived-v2 for recent dates."
        }
      ]
    });

    const req: any = {
      method: "GET",
      query: {
        date: "2026-03-20"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toMatchObject({
      success: false,
      actualDate: "2026-03-20",
      projectionDate: "2026-03-19",
      preflight: {
        status: "FAIL"
      },
      scanSummary: {
        surface: "projection_accuracy_operator",
        requestedDate: "2026-03-20",
        activeDataDate: "2026-03-20",
        fallbackApplied: false,
        status: "blocked",
        rowCounts: {
          skaterRows: 0,
          goalieRows: 0,
          totalRows: 0
        },
        blockingIssueCount: 1
      },
      error:
        "Projection freshness checks failed. Resolve upstream dependencies or use bypassPreflight=true to override."
    });
    expect(requireLatestSucceededRunIdMock).not.toHaveBeenCalled();
  });

  it("reports selected-run actual coverage without counting wrong-date projections", () => {
    const diagnostics = buildSkaterActualMatchDiagnostics({
      playerProjections: [
        { game_id: 1, player_id: 10 },
        { game_id: 1, player_id: 11 },
        { game_id: 2, player_id: 12 },
        { game_id: 1, player_id: null },
      ],
      validGameIds: new Set([1]),
      skaterActuals: new Map([["1:10", { shots: 3 }]]),
    });

    expect(diagnostics).toEqual({
      projectionRows: 4,
      eligibleSameDateRows: 2,
      matchedActualRows: 1,
      missingActualRows: 1,
      wrongDateRows: 1,
      invalidIdentityRows: 1,
      actualMatchRate: 0.5,
    });
  });

  it("atomically replaces an empty canonical result scope so stale rerun rows are removed", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        deleted: 4,
        inserted: 0,
        asOfDate: "2026-03-19",
        actualDate: "2026-03-20",
        sourceRunId: "latest-run",
      },
      error: null,
    });

    await expect(
      replaceProjectionResultsAtomic(
        { rpc },
        {
          asOfDate: "2026-03-19",
          actualDate: "2026-03-20",
          sourceRunId: "latest-run",
          rows: [],
        },
      ),
    ).resolves.toMatchObject({ deleted: 4, inserted: 0 });
    expect(rpc).toHaveBeenCalledWith(
      "replace_forge_projection_results_atomic",
      expect.objectContaining({
        p_as_of_date: "2026-03-19",
        p_actual_date: "2026-03-20",
        p_source_run_id: "latest-run",
        p_rows: [],
      }),
    );
  });

  it("fails closed when the replacement receipt identifies a stale run", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        deleted: 1,
        inserted: 0,
        asOfDate: "2026-03-19",
        actualDate: "2026-03-20",
        sourceRunId: "stale-run",
      },
      error: null,
    });

    await expect(
      replaceProjectionResultsAtomic(
        { rpc },
        {
          asOfDate: "2026-03-19",
          actualDate: "2026-03-20",
          sourceRunId: "latest-run",
          rows: [],
        },
      ),
    ).rejects.toThrow("Atomic projection-result replacement receipt mismatch.");
  });

  it("keeps atomic result replacement service-only and latest-run scoped", () => {
    const repoRoot =
      path.basename(process.cwd()) === "web"
        ? path.resolve(process.cwd(), "..")
        : process.cwd();
    const sql = readFileSync(
      path.join(
        repoRoot,
        "supabase/migrations/20260723121407_replace_forge_projection_results_atomic.sql",
      ),
      "utf8",
    );

    expect(sql).toContain(
      "create or replace function public.replace_forge_projection_results_atomic(",
    );
    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = pg_catalog");
    expect(sql).toMatch(
      /select run_id[\s\S]*status = 'succeeded'[\s\S]*order by created_at desc[\s\S]*limit 1/,
    );
    expect(
      sql.indexOf("delete from public.forge_projection_results"),
    ).toBeLessThan(sql.indexOf("insert into public.forge_projection_results"));
    expect(sql).not.toMatch(/exception\s+when\s+others/i);
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });
});
