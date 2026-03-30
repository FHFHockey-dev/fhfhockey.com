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

vi.mock("../../../../../pages/api/v1/projections/_helpers", () => ({
  requireLatestSucceededRunId: requireLatestSucceededRunIdMock
}));

vi.mock("../../../../../pages/api/v1/db/run-projection-v2", () => ({
  runProjectionPreflightChecks: runProjectionPreflightChecksMock
}));

import handler from "../../../../../pages/api/v1/db/run-projection-accuracy";

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
});
