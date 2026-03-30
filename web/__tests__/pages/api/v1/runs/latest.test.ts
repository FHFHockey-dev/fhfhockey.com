import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn()
}));

function createQueryBuilder(resolver: () => { data?: any; error: any }) {
  const builder: any = {
    select() {
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    eq() {
      return builder;
    },
    maybeSingle() {
      const out = resolver();
      return Promise.resolve({ data: out.data ?? null, error: out.error });
    }
  };
  return builder;
}

vi.mock("lib/supabase/server", () => ({
  default: {
    from: fromMock
  }
}));

import handler from "../../../../../pages/api/v1/runs/latest";

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

describe("/api/v1/runs/latest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_runs") {
        return createQueryBuilder(() => ({
          data: {
            run_id: "run-123",
            as_of_date: "2026-03-20",
            status: "succeeded",
            created_at: "2026-03-20T11:00:00.000Z",
            metrics: {
              games: 8,
              player_rows: 212,
              team_rows: 16,
              goalie_rows: 24
            }
          },
          error: null
        }));
      }
      return createQueryBuilder(() => ({ data: null, error: null }));
    });
  });

  it("returns scan-friendly latest-run metadata alongside the raw run row", async () => {
    const req: any = {
      method: "GET",
      query: {
        date: "2026-03-20"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      data: {
        run_id: "run-123",
        as_of_date: "2026-03-20",
        status: "succeeded"
      },
      scanSummary: {
        surface: "latest_run_reader",
        requestedDate: "2026-03-20",
        activeDataDate: "2026-03-20",
        fallbackApplied: false,
        status: "ready",
        rowCounts: {
          gamesProcessed: 8,
          playerRowsUpserted: 212,
          teamRowsUpserted: 16,
          goalieRowsUpserted: 24
        },
        blockingIssueCount: 0
      }
    });
  });
});
