import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditInsertMock, requireLatestSucceededRunIdMock } = vi.hoisted(() => ({
  auditInsertMock: vi.fn().mockResolvedValue({ error: null }),
  requireLatestSucceededRunIdMock: vi.fn()
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
});
