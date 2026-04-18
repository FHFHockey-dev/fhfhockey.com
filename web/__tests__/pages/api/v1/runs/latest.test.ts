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
    then(resolve: (value: { data?: any; error: any }) => unknown) {
      return Promise.resolve(resolve(resolver()));
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
          data: [
            {
              run_id: "run-123",
              as_of_date: "2026-03-20",
              status: "succeeded",
              created_at: "2026-03-20T11:00:00.000Z",
              updated_at: "2026-03-20T11:04:00.000Z",
              metrics: {
                games: 8,
                player_rows: 212,
                team_rows: 16,
                goalie_rows: 24
              }
            }
          ],
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

  it("falls back to the latest succeeded run when the newest row is a stale running shell", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_runs") {
        return createQueryBuilder(() => ({
          data: [
            {
              run_id: "run-stale",
              as_of_date: "2026-03-20",
              status: "running",
              created_at: "2026-03-20T11:05:00.000Z",
              updated_at: "2026-03-20T11:05:00.000Z",
              metrics: {}
            },
            {
              run_id: "run-good",
              as_of_date: "2026-03-20",
              status: "succeeded",
              created_at: "2026-03-20T11:00:00.000Z",
              updated_at: "2026-03-20T11:04:00.000Z",
              metrics: {
                games: 7,
                player_rows: 180,
                team_rows: 12,
                goalie_rows: 8
              }
            }
          ],
          error: null
        }));
      }
      return createQueryBuilder(() => ({ data: null, error: null }));
    });
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-20T11:20:00.000Z"));

      const req: any = {
        method: "GET",
        query: {
          date: "2026-03-20"
        }
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toMatchObject({
        run_id: "run-good",
        status: "succeeded"
      });
      expect(res.body.observedLatestRun).toMatchObject({
        run_id: "run-stale",
        status: "running"
      });
      expect(res.body.scanSummary.notes.join(" ")).toContain(
        "Ignored stale running row run-stale"
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to the latest succeeded run when a newer rerun failed", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_runs") {
        return createQueryBuilder(() => ({
          data: [
            {
              run_id: "run-failed",
              as_of_date: "2026-03-20",
              status: "failed",
              created_at: "2026-03-20T11:10:00.000Z",
              updated_at: "2026-03-20T11:12:00.000Z",
              metrics: {
                games: 2,
                player_rows: 0,
                team_rows: 0,
                goalie_rows: 0
              }
            },
            {
              run_id: "run-good",
              as_of_date: "2026-03-20",
              status: "succeeded",
              created_at: "2026-03-20T11:00:00.000Z",
              updated_at: "2026-03-20T11:04:00.000Z",
              metrics: {
                games: 7,
                player_rows: 180,
                team_rows: 12,
                goalie_rows: 8
              }
            }
          ],
          error: null
        }));
      }
      return createQueryBuilder(() => ({ data: null, error: null }));
    });

    const req: any = {
      method: "GET",
      query: {
        date: "2026-03-20"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toMatchObject({
      run_id: "run-good",
      status: "succeeded"
    });
    expect(res.body.observedLatestRun).toMatchObject({
      run_id: "run-failed",
      status: "failed"
    });
    expect(res.body.scanSummary.notes.join(" ")).toContain(
      "using latest succeeded run run-good as the actionable state"
    );
  });
});
