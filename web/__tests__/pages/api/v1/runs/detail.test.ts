import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn()
}));

function createBuilder(result: any) {
  const builder: any = {
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    maybeSingle() {
      return Promise.resolve(result);
    },
    then(resolve: (value: any) => unknown) {
      return Promise.resolve(resolve(result));
    }
  };
  return builder;
}

vi.mock("lib/supabase/server", () => ({
  default: {
    from: fromMock
  }
}));

import handler from "../../../../../pages/api/v1/runs/[runId]";

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

describe("/api/v1/runs/[runId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_runs") {
        return createBuilder({
          data: {
            run_id: "run-123",
            as_of_date: "2026-03-20",
            status: "succeeded",
            metrics: {
              preflight: { status: "PASS" },
              warnings: ["line combo fallback used"]
            }
          },
          error: null
        });
      }
      return createBuilder({ count: table.includes("player") ? 12 : 2, error: null });
    });
  });

  it("returns run metadata, row counts, preflight, and warnings", async () => {
    const req: any = {
      method: "GET",
      query: {
        runId: "run-123"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toMatchObject({
      run_id: "run-123",
      rowCounts: {
        playerRows: 12,
        teamRows: 2,
        goalieRows: 2
      },
      preflight: { status: "PASS" },
      warnings: ["line combo fallback used"]
    });
    expect(res.body.scanSummary).toMatchObject({
      surface: "projection_run_detail",
      status: "ready"
    });
  });
});
