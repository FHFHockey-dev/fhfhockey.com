import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cronJobReportSelectMock,
  cronJobAuditSelectMock,
  cronJobAuditInsertMock,
  resendSendMock,
  readFileMock
} = vi.hoisted(() => ({
  cronJobReportSelectMock: vi.fn(),
  cronJobAuditSelectMock: vi.fn(),
  cronJobAuditInsertMock: vi.fn(),
  resendSendMock: vi.fn(),
  readFileMock: vi.fn()
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "cron_job_report") {
        return {
          select: cronJobReportSelectMock
        };
      }
      if (table === "cron_job_audit") {
        return {
          select: cronJobAuditSelectMock
        };
      }
      throw new Error(`Unexpected table ${table}`);
    })
  }))
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: vi.fn(() => ({
      insert: cronJobAuditInsertMock
    }))
  }
}));

vi.mock("resend", () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: resendSendMock
    }
  }))
}));

vi.mock("fs/promises", () => ({
  default: {
    readFile: readFileMock
  }
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
    }
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
                "select net.http_post(url:='https://fhfhockey.com/api/v1/db/run-projection-v2');"
            }
          ],
          error: null
        })
      })
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
                  timing: {
                    startedAt: "2026-03-20T12:00:00.000Z",
                    endedAt: "2026-03-20T12:05:01.000Z",
                    durationMs: 301_000,
                    timer: "05:01"
                  }
                })
              }
            }
          ],
          error: null
        })
      })
    });

    readFileMock.mockResolvedValue(`
SELECT cron.schedule(
  'run-forge-projection-v2',
  '0 12 * * *',
  $$select net.http_post(url:='https://fhfhockey.com/api/v1/db/run-projection-v2');$$
);
`);

    cronJobAuditInsertMock.mockResolvedValue({});
    resendSendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });
  });

  it("returns enriched warning and benchmark payloads for slow jobs with audit timing", async () => {
    const req: any = { method: "GET" };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      counts: expect.objectContaining({
        warnSlow: 1,
        jobsOkLast: 1
      }),
      warnings: {
        slowMsThreshold: 270_000,
        slowJobDenotation: "OPTIMIZE",
        slowJobs: [
          expect.objectContaining({
            displayName: "run-forge-projection-v2",
            timer: "05:01",
            denotation: "OPTIMIZE"
          })
        ],
        missingObservationJobs: []
      },
      benchmark: {
        annotatedJobCount: 1,
        bottleneckJobs: [
          expect.objectContaining({
            displayName: "run-forge-projection-v2"
          })
        ],
        missingObservationJobs: []
      }
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
                "select net.http_get(url:='https://fhfhockey.com/api/v1/db/cron-report');"
            }
          ],
          error: null
        })
      })
    });

    cronJobAuditSelectMock.mockReturnValue({
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      })
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
        scheduledJobsWithActivity: 1
      })
    });
  });
});
