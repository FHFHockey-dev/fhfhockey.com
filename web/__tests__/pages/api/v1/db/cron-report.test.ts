import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cronJobReportSelectMock,
  cronJobAuditSelectMock,
  cronJobAuditInsertMock,
  resendSendMock,
  readFileMock,
} = vi.hoisted(() => ({
  cronJobReportSelectMock: vi.fn(),
  cronJobAuditSelectMock: vi.fn(),
  cronJobAuditInsertMock: vi.fn(),
  resendSendMock: vi.fn(),
  readFileMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "cron_job_report") {
        return {
          select: cronJobReportSelectMock,
        };
      }
      if (table === "cron_job_audit") {
        return {
          select: cronJobAuditSelectMock,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  })),
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: vi.fn(() => ({
      insert: cronJobAuditInsertMock,
    })),
  },
}));

vi.mock("resend", () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: resendSendMock,
    },
  })),
}));

vi.mock("fs/promises", () => ({
  default: {
    readFile: readFileMock,
  },
}));

import handler from "../../../../../pages/api/v1/db/cron-report";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headersSent: false,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
  };

  return res;
}

describe("/api/v1/db/cron-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T12:00:00.000Z"));

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.RESEND_API_KEY = "resend-key";
    process.env.CRON_REPORT_EMAIL_RECIPIENT = "ops@example.com";

    cronJobReportSelectMock.mockReturnValue({
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              jobname: "run-forge-projection-v2",
              scheduled_time: "2026-03-20T12:00:00.000Z",
              end_time: "2026-03-20T12:05:01.000Z",
              status: "success",
              return_message: "UPDATE 42",
              sql_text:
                "select net.http_post(url:='https://fhfhockey.com/api/v1/db/run-projection-v2');",
            },
          ],
          error: null,
        }),
      }),
    });

    cronJobAuditSelectMock.mockReturnValue({
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              job_name: "run-forge-projection-v2",
              run_time: "2026-03-20T12:05:01.000Z",
              rows_affected: 42,
              status: "success",
              details: {
                method: "POST",
                url: "https://fhfhockey.com/api/v1/db/run-projection-v2",
                statusCode: 200,
                response: JSON.stringify({
                  success: true,
                  failedRows: 3,
                  timing: {
                    startedAt: "2026-03-20T12:00:00.000Z",
                    endedAt: "2026-03-20T12:05:01.000Z",
                    durationMs: 301_000,
                    timer: "05:01",
                  },
                }),
              },
            },
          ],
          error: null,
        }),
      }),
    });

    readFileMock.mockResolvedValue(`
SELECT cron.schedule(
  'run-forge-projection-v2',
  '0 12 * * *',
  $$select net.http_post(url:='https://fhfhockey.com/api/v1/db/run-projection-v2');$$
);
`);

    cronJobAuditInsertMock.mockResolvedValue({});
    resendSendMock.mockResolvedValue({
      data: { id: "email_123" },
      error: null,
    });
  });

  it("returns enriched warning and benchmark payloads for slow jobs with audit timing", async () => {
    const req: any = { method: "GET" };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(resendSendMock).toHaveBeenCalledTimes(1);
    expect(resendSendMock.mock.calls[0]?.[0]).toMatchObject({
      from: "audit-report@fhfhockey.com",
      subject: expect.stringContaining("Daily Cron Report"),
    });
    expect(res.body).toMatchObject({
      success: true,
      jobRunDetailsEmailResult: expect.objectContaining({
        suppressed: true,
      }),
      counts: expect.objectContaining({
        warnSlow: 1,
        jobsOkLast: 1,
        totalFailedRows: 3,
        warnPartialFailure: 1,
      }),
      warnings: {
        slowMsThreshold: 270_000,
        slowJobDenotation: "OPTIMIZE",
        slowJobs: [
          expect.objectContaining({
            displayName: "run-forge-projection-v2",
            timer: "05:01",
            denotation: "OPTIMIZE",
          }),
        ],
        partialFailureJobs: [
          {
            displayName: "run-forge-projection-v2",
            failedRows: 3,
          },
        ],
        missingObservationJobs: [],
      },
      benchmark: {
        annotatedJobCount: 1,
        bottleneckJobs: [
          expect.objectContaining({
            displayName: "run-forge-projection-v2",
          }),
        ],
        missingObservationJobs: [],
      },
    });
  });

  it("prefers the active JSON schedule inventory over legacy SQL snippets", async () => {
    vi.setSystemTime(new Date("2026-03-20T14:00:00.000Z"));

    cronJobReportSelectMock.mockReturnValue({
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              jobname: "daily-cron-report",
              scheduled_time: "2026-03-20T13:00:00.000Z",
              end_time: "2026-03-20T13:00:01.000Z",
              status: "success",
              return_message: "1 row",
              sql_text:
                "select net.http_get(url:='https://fhfhockey.com/api/v1/db/cron-report');",
            },
          ],
          error: null,
        }),
      }),
    });

    cronJobAuditSelectMock.mockReturnValue({
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
    });

    readFileMock.mockResolvedValue(`
\`\`\`json
[
  {
    "jobid": 234,
    "jobname": "daily-cron-report",
    "schedule": "00 13 * * *",
    "run_time_utc": "13:00 UTC",
    "active": true
  },
  {
    "jobid": 277,
    "jobname": "refresh-team-power-ratings-daily",
    "schedule": "15 10 * * *",
    "run_time_utc": "10:15 UTC",
    "active": false
  }
]
\`\`\`

-- SELECT cron.schedule(
--   'daily-cron-report',
--   '00 13 * * *',
--   $$select net.http_get(url:='https://fhfhockey.com/api/v1/db/cron-report');$$
-- );

-- SELECT cron.schedule(
--   'refresh-team-power-ratings-daily',
--   '15 10 * * *',
--   $$select public.refresh_team_power_ratings('2025-10-01', '2026-03-20');$$
-- );
`);

    const req: any = { method: "GET" };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      counts: expect.objectContaining({
        scheduledJobs: 1,
        jobsMissingLast: 0,
        scheduledJobsWithActivity: 1,
        warnMissingAudit: 1,
      }),
    });
  });

  it("suppresses only the current report's self-audit gap while the wrapper is still writing it", async () => {
    vi.setSystemTime(new Date("2026-03-20T12:00:30.000Z"));

    cronJobReportSelectMock.mockReturnValue({
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              jobname: "daily-cron-report",
              scheduled_time: "2026-03-20T12:00:00.000Z",
              end_time: "2026-03-20T12:00:01.000Z",
              status: "success",
              return_message: "1 row",
              sql_text:
                "select net.http_get(url:='https://fhfhockey.com/api/v1/db/cron-report');",
            },
          ],
          error: null,
        }),
      }),
    });

    cronJobAuditSelectMock.mockReturnValue({
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    readFileMock.mockResolvedValue(`
\`\`\`json
[
  {
    "jobid": 234,
    "jobname": "daily-cron-report",
    "schedule": "0 12 * * *",
    "run_time_utc": "12:00 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/cron-report"
  }
]
\`\`\`
`);

    const req: any = { method: "GET", query: { preview: "json" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      counts: expect.objectContaining({
        scheduledJobs: 1,
        scheduledJobsWithActivity: 1,
        warnMissingAudit: 0,
      }),
      warnings: expect.objectContaining({
        missingObservationJobs: [],
      }),
    });
  });

  it("supports preview=json without sending Resend emails", async () => {
    const req: any = { method: "GET", query: { preview: "json" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      dryRun: true,
      preview: "json",
      auditEmailResult: expect.objectContaining({
        dryRun: true,
      }),
      jobRunDetailsEmailResult: expect.objectContaining({
        suppressed: true,
        dryRun: true,
      }),
    });
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it("fails closed when the packaged cron schedule inventory is unavailable", async () => {
    readFileMock.mockRejectedValue(new Error("ENOENT"));

    const req: any = { method: "GET", query: { preview: "json" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      success: false,
      code: "CRON_SCHEDULE_INVENTORY_UNAVAILABLE",
      message:
        "Cron schedule inventory is unavailable; report generation failed closed.",
    });
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it("fails closed when the packaged cron schedule inventory has no active jobs", async () => {
    readFileMock.mockResolvedValue("# No active jobs");

    const req: any = { method: "GET", query: { preview: "json" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      success: false,
      code: "CRON_SCHEDULE_INVENTORY_EMPTY",
      message:
        "Cron schedule inventory contains zero active jobs; report generation failed closed.",
    });
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it("matches audit rows when a route wrapper converts the cron GET to POST", async () => {
    vi.setSystemTime(new Date("2026-03-20T12:00:00.000Z"));

    cronJobReportSelectMock.mockReturnValue({
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              jobname: "update-shift-charts",
              scheduled_time: "2026-03-20T07:45:00.000Z",
              end_time: "2026-03-20T07:50:01.000Z",
              status: "success",
              return_message: "1 row",
              sql_text:
                "select net.http_get(url:='https://fhfhockey.com/api/v1/db/update-shifts?action=all');",
            },
          ],
          error: null,
        }),
      }),
    });

    cronJobAuditSelectMock.mockReturnValue({
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              job_name: "update-shift-charts",
              run_time: "2026-03-20T07:50:01.000Z",
              rows_affected: 10,
              status: "success",
              details: {
                method: "POST",
                url: "/api/v1/db/update-shifts?action=all",
                statusCode: 200,
                durationMs: 301000,
                response: JSON.stringify({ success: true, rowsUpserted: 10 }),
              },
            },
          ],
          error: null,
        }),
      }),
    });

    readFileMock.mockResolvedValue(`
\`\`\`json
[
  {
    "jobid": 16,
    "jobname": "update-shift-charts",
    "schedule": "45 7 * * *",
    "run_time_utc": "07:45 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-shifts?action=all"
  }
]
\`\`\`
`);

    const req: any = { method: "GET", query: { preview: "json" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      counts: expect.objectContaining({
        jobsOkLast: 1,
        warnMissingAudit: 0,
      }),
      warnings: expect.objectContaining({
        missingObservationJobs: [],
      }),
    });
  });

  it("does not report pre-checkpoint cron runs as live audit gaps", async () => {
    vi.setSystemTime(new Date("2026-03-20T12:00:00.000Z"));

    cronJobReportSelectMock.mockReturnValue({
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              jobname: "update-nst-current-season",
              scheduled_time: "2026-03-20T08:45:00.000Z",
              end_time: "2026-03-20T08:46:00.000Z",
              status: "success",
              return_message: "1 row",
              sql_text:
                "select net.http_get(url:='https://fhfhockey.com/api/v1/db/update-nst-current-season');",
            },
          ],
          error: null,
        }),
      }),
    });

    cronJobAuditSelectMock.mockReturnValue({
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              job_name: "daily-cron-report",
              run_time: "2026-03-20T10:00:00.000Z",
              rows_affected: 0,
              status: "success",
              details: {
                method: "GET",
                url: "/api/v1/db/cron-report?preview=json",
                statusCode: 200,
                durationMs: 100,
                response: JSON.stringify({ success: true, dryRun: true }),
              },
            },
          ],
          error: null,
        }),
      }),
    });

    readFileMock.mockResolvedValue(`
\`\`\`json
[
  {
    "jobid": 220,
    "jobname": "update-nst-current-season",
    "schedule": "45 8 * * *",
    "run_time_utc": "08:45 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-nst-current-season"
  }
]
\`\`\`
`);

    const req: any = { method: "GET", query: { preview: "json" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      counts: expect.objectContaining({
        jobsOkLast: 1,
        warnMissingAudit: 0,
      }),
      warnings: expect.objectContaining({
        missingObservationJobs: [],
      }),
    });
  });
});
