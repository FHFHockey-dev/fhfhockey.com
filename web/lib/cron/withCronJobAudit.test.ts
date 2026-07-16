import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.fn();

vi.mock("lib/supabase/server", () => ({
  default: {
    from: vi.fn(() => ({
      insert: insertMock,
    })),
  },
}));

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { withCronJobTiming } from "lib/cron/timingContract";

function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    method: "GET",
    url: "/api/v1/db/example",
    ...overrides,
  } as any;
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headersSent: false,
    headers: {} as Record<string, unknown>,
    body: undefined as unknown,
    setHeader(name: string, value: unknown) {
      this.headers[name] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      this.headersSent = true;
      return this;
    },
    send(body: unknown) {
      this.body = body;
      this.headersSent = true;
      return this;
    },
  };

  return res;
}

describe("withCronJobAudit", () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    insertMock.mockReset();
    insertMock.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds timing to wrapper-generated 500 responses when the handler throws", async () => {
    const wrapped = withCronJobAudit(
      async () => {
        throw new Error("boom");
      },
      { jobName: "test-job" },
    );

    const req = createMockReq();
    const res = createMockRes();

    await wrapped(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      error: "boom",
    });
    expect((res.body as any).timing.startedAt).toMatch(/T/);
    expect((res.body as any).timing.endedAt).toMatch(/T/);
    expect((res.body as any).timing.durationMs).toBeTypeOf("number");
    expect((res.body as any).timing.timer).toMatch(/^\d{2,}:\d{2}$/);

    expect(insertMock).toHaveBeenCalledTimes(1);
    const row = insertMock.mock.calls[0][0];
    expect(row.job_name).toBe("test-job");
    expect(row.status).toBe("failure");
    expect(row.details.timing.source).toBe("audit");
    expect(row.details.error).toBe("boom");
  });

  it("records canonical audit timing even when the handler returns a timed failure payload", async () => {
    const startedAt = "2026-03-20T11:00:00.000Z";
    const endedAt = "2026-03-20T11:00:12.345Z";

    const wrapped = withCronJobAudit(
      async (_req, res) => {
        return res.status(422).json(
          withCronJobTiming(
            {
              success: false,
              error: "preflight failed",
              processedRows: 17,
            },
            startedAt,
            endedAt,
          ),
        );
      },
      { jobName: "timed-failure-job" },
    );

    const req = createMockReq();
    const res = createMockRes();

    await wrapped(req, res);

    expect(res.statusCode).toBe(422);
    expect((res.body as any).timing).toEqual({
      startedAt,
      endedAt,
      durationMs: 12_345,
      timer: "00:12",
    });

    const row = insertMock.mock.calls[0][0];
    expect(row.status).toBe("failure");
    expect(row.details.durationMs).toBe(12_345);
    expect(row.details.timing).toEqual({
      startedAt,
      endedAt,
      durationMs: 12_345,
      timer: "00:12",
      source: "audit",
    });
  });

  it("records an HTTP 200 partial-processing payload with success false as a failure", async () => {
    const wrapped = withCronJobAudit(
      async (_req, res) => {
        return res.json({
          success: false,
          succeeded: 3,
          failed: 1,
          failedRows: 2,
          failures: [
            {
              kind: "goalie_game_stats_batch_failure",
              code: "GOALIE_GAME_STATS_BATCH_FAILED",
              gameId: 2025020001,
            },
          ],
        });
      },
      { jobName: "season-stats-partial-failure" },
    );

    const req = createMockReq();
    const res = createMockRes();

    await wrapped(req, res);

    expect(res.statusCode).toBe(200);
    const row = insertMock.mock.calls[0][0];
    expect(row.status).toBe("failure");
    expect(row.details.failedRows).toBe(2);
    expect(row.details.response).toContain("GOALIE_GAME_STATS_BATCH_FAILED");
  });

  it("uses explicit success before legacy failure words and records the season succeeded count", async () => {
    const wrapped = withCronJobAudit(
      async (_req, res) => {
        return res.json({
          seasonId: 20252026,
          success: true,
          message:
            "Stats update complete. Processed: 12, Succeeded: 7, Failed: 0.",
          processed: 12,
          succeeded: 7,
          failed: 0,
          failedRows: 0,
          skipped: 3,
          deferred: 2,
        });
      },
      { jobName: "season-stats-success" },
    );

    const req = createMockReq();
    const res = createMockRes();

    await wrapped(req, res);

    const row = insertMock.mock.calls[0][0];
    expect(row.status).toBe("success");
    expect(row.rows_affected).toBe(7);
    expect(row.details.rowsUpserted).toBe(7);
    expect(row.details.failedRows).toBe(0);
  });

  it("uses an explicit successful status before legacy error words", async () => {
    const wrapped = withCronJobAudit(
      async (_req, res) => {
        return res.json({
          status: "succeeded",
          message: "Completed with 0 errors.",
        });
      },
      { jobName: "explicit-status-success" },
    );

    const req = createMockReq();
    const res = createMockRes();

    await wrapped(req, res);

    expect(insertMock.mock.calls[0][0].status).toBe("success");
  });

  it("surfaces a resolved Supabase audit insert error", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    insertMock.mockResolvedValueOnce({
      error: { message: "audit insert unavailable" },
    });
    const wrapped = withCronJobAudit(
      async (_req, res) => res.json({ success: true }),
      { jobName: "audit-insert-error" },
    );

    const req = createMockReq();
    const res = createMockRes();

    await wrapped(req, res);

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "cron_job_audit insert failed",
      "audit insert unavailable",
    );
  });

  it("does not silently skip persistence when runtime configuration is unavailable", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const wrapped = withCronJobAudit(
      async (_req, res) => res.json({ success: true }),
      { jobName: "runtime-config-audit" },
    );

    await wrapped(createMockReq(), createMockRes());

    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});
