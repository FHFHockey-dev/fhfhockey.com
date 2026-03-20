import { beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.fn();

vi.mock("lib/supabase", () => ({
  default: {
    from: vi.fn(() => ({
      insert: insertMock
    }))
  }
}));

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { withCronJobTiming } from "lib/cron/timingContract";

function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    method: "GET",
    url: "/api/v1/db/example",
    ...overrides
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
    }
  };

  return res;
}

describe("withCronJobAudit", () => {
  beforeEach(() => {
    insertMock.mockReset();
    insertMock.mockResolvedValue({});
  });

  it("adds timing to wrapper-generated 500 responses when the handler throws", async () => {
    const wrapped = withCronJobAudit(async () => {
      throw new Error("boom");
    }, { jobName: "test-job" });

    const req = createMockReq();
    const res = createMockRes();

    await wrapped(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      error: "boom"
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

    const wrapped = withCronJobAudit(async (_req, res) => {
      return res.status(422).json(
        withCronJobTiming(
          {
            success: false,
            error: "preflight failed",
            processedRows: 17
          },
          startedAt,
          endedAt
        )
      );
    }, { jobName: "timed-failure-job" });

    const req = createMockReq();
    const res = createMockRes();

    await wrapped(req, res);

    expect(res.statusCode).toBe(422);
    expect((res.body as any).timing).toEqual({
      startedAt,
      endedAt,
      durationMs: 12_345,
      timer: "00:12"
    });

    const row = insertMock.mock.calls[0][0];
    expect(row.status).toBe("failure");
    expect(row.details.durationMs).toBe(12_345);
    expect(row.details.timing).toEqual({
      startedAt,
      endedAt,
      durationMs: 12_345,
      timer: "00:12",
      source: "audit"
    });
  });
});
