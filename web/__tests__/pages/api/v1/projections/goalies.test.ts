import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn()
}));

vi.mock("pages/api/v1/projections/_helpers", async () => {
  const actual = await vi.importActual<any>("pages/api/v1/projections/_helpers");
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

import handler from "../../../../../pages/api/v1/projections/goalies";

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

describe("/api/v1/projections/goalies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_goalie_projections") {
        return createQueryBuilder(() => ({
          data: [{ goalie_id: 9001, run_id: "run-123" }],
          error: null
        }));
      }
      return createQueryBuilder(() => ({ data: [], error: null }));
    });
  });

  it("returns goalie projection rows with explicit deprecation metadata", async () => {
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
    expect(res.headers["X-FHF-Canonical-Route"]).toBe("/api/v1/forge/goalies");
    expect(res.body).toMatchObject({
      deprecated: true,
      canonicalRoute: "/api/v1/forge/goalies",
      runId: "run-123",
      asOfDate: "2026-02-07"
    });
    expect(res.body.data).toEqual([{ goalie_id: 9001, run_id: "run-123" }]);
  });
});
