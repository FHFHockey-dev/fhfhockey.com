import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, latestMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  latestMock: vi.fn()
}));

// Latest-run selection is the shared proof-aware lookup (Astra F4); its admission rules are tested with it.
vi.mock("lib/projections/externalInputProof", async () => ({
  ...await vi.importActual<any>("lib/projections/externalInputProof"),
  requireLatestExternalInputProvenRun: latestMock
}));

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
    latestMock.mockResolvedValue({ runId: "run-123", proof: { basis: "verified_producer_closure", releaseSha: "a".repeat(40),
      closureSha256: "b".repeat(64) } });
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

  it("refuses, with a labelled 404, a date whose runs cannot prove they excluded external inputs", async () => {
    latestMock.mockRejectedValue(Object.assign(new Error("No succeeded projection run with external-input exclusion proof found"),
      { statusCode: 404, details: { reason: "external_input_provenance_unproven", withheldRuns: 1 } }));
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07" } } as any, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.details).toEqual({ reason: "external_input_provenance_unproven", withheldRuns: 1 });
    expect(fromMock).not.toHaveBeenCalledWith("forge_goalie_projections");
  });

  it("names what admitted the served run", async () => {
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07" } } as any, res);
    expect(res.body.runProof).toEqual({ runId: "run-123", basis: "verified_producer_closure", releaseSha: "a".repeat(40),
      closureSha256: "b".repeat(64) });
  });
});
