import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cronJobReportSelectMock,
  cronJobAuditSelectMock,
  cronJobAuditInsertMock,
  resendSendMock,
  readFileMock,
  cronAuditEmailMock,
} = vi.hoisted(() => ({
  cronJobReportSelectMock: vi.fn(),
  cronJobAuditSelectMock: vi.fn(),
  cronJobAuditInsertMock: vi.fn(),
  resendSendMock: vi.fn(),
  readFileMock: vi.fn(),
  cronAuditEmailMock: vi.fn((_props: any) => null),
}));

// Model PostgREST's bounded range and exact total without making live requests.
function reportQuery(mock: ReturnType<typeof vi.fn>, args: unknown[], cron = false) {
  let from = 0;
  let to = 499;
  const bounds: Record<string, string> = {};
  const query = {
    gte: (field: string, value: string) => { bounds.since = value; bounds.field = field; return query; },
    lte: (_field: string, value: string) => { bounds.until = value; return query; },
    order: vi.fn(() => query),
    range: (start: number, end: number) => { from = start; to = end; return query; },
    abortSignal: async () => {
      const response = await mock(...args);
      const rows = (response.data ?? []).map((row: any, index: number) => cron ? { runid: index + 1, ...row } : row)
        .filter((row: any) => row[bounds.field] >= bounds.since && row[bounds.field] <= bounds.until);
      return { ...response, data: rows.slice(from, to + 1), count: response.count === undefined ? rows.length : response.count };
    },
  };
  return query;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "cron_job_report") {
        return {
          select: (...args: unknown[]) => reportQuery(cronJobReportSelectMock, args, true),
        };
      }
      if (table === "cron_job_audit") {
        return {
          select: (...args: unknown[]) => reportQuery(cronJobAuditSelectMock, args),
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

vi.mock("components/CronReportEmail/CronAuditEmail", () => ({
  CronAuditEmail: cronAuditEmailMock,
}));

vi.mock("fs/promises", () => ({
  default: {
    readFile: readFileMock,
  },
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: unknown) => handler,
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
    vi.stubGlobal("AbortSignal", { timeout: vi.fn(() => new AbortController().signal) });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T12:10:00.000Z"));

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.RESEND_API_KEY = "resend-key";
    process.env.CRON_REPORT_EMAIL_RECIPIENT = "ops@example.com";

    cronJobReportSelectMock.mockResolvedValue({
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
    });

    cronJobAuditSelectMock.mockResolvedValue({
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

  it("never substitutes HTTP SQL submission elapsed or affected counts for execution metrics", async () => {
    cronJobAuditSelectMock.mockResolvedValue({ data: [], error: null });
    const res = createMockRes();
    await handler({ method: "GET" } as any, res);
    const row = cronAuditEmailMock.mock.calls.at(-1)?.[0].audits[0];
    expect(row).toMatchObject({ status: "unknown", durationMs: null, rowsUpserted: null });
    expect(row.timingProvenance).toBe("HTTP submission only; route completion unverified");
    expect(res.body.totals).toMatchObject({ rowsUpserted: null, errorRows: null });
  });

  it("retains verified partial PBP writes without counting game errors as error rows", async () => {
    readFileMock.mockResolvedValue("SELECT cron.schedule('update-pbp','0 12 * * *',$$select net.http_get(url:='https://fhfhockey.com/api/v1/db/update-PbP?gameId=recent');$$);");
    cronJobReportSelectMock.mockResolvedValue({ data: [], error: null });
    cronJobAuditSelectMock.mockResolvedValue({ data: [{ job_name: "update-PbP", run_time: "2026-03-20T12:00:04.000Z", status: "failure", rows_affected: 741,
      details: { method: "GET", url: "/api/v1/db/update-PbP?gameId=recent", durationMs: 3162, failedRows: 1,
        response: { success: false, rowsUpserted: 741, rowsVerified: 741, failedRows: 1, errors: [{ gameId: 2026020019, stage: "precheck_shifts", message: "Shift clock/duration mismatch" }] } } }], error: null });
    const res = createMockRes();
    await handler({ method: "GET" } as any, res);
    expect(cronAuditEmailMock.mock.calls.at(-1)?.[0].audits[0]).toMatchObject({ status: "failure", durationMs: 3162, rowsUpserted: 741, failedRows: null, failedOperations: 1, reason: "Shift clock/duration mismatch" });
    expect(res.body.counts).toMatchObject({ totalRowsUpserted: 741, totalFailedRows: 0 });
    expect(res.body.totals.errorRows).toBeNull();
  });

  it("flags measured execution before the repository limit and retires the generic slow threshold", async () => {
    cronJobAuditSelectMock.mockResolvedValue({ data: [{ job_name: "run-forge-projection-v2", run_time: "2026-03-20T12:00:04.000Z", status: "success",
      details: { method: "POST", url: "/api/v1/db/run-projection-v2", durationMs: 218000, rowsUpserted: 999, failedRows: 2, response: { success: true, count: 999, errors: ["operation error"] } } }], error: null });
    const res = createMockRes();
    await handler({ method: "GET" } as any, res);
    expect(res.body.warnings).toMatchObject({ slowMsThreshold: null, nearLimitFraction: 0.9, slowJobs: [{ thresholdMs: 216000, repositoryLimitMs: 240000 }] });
    expect(cronAuditEmailMock.mock.calls.at(-1)?.[0].audits[0]).toMatchObject({ rowsUpserted: null, failedRows: null });
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
    expect(cronJobAuditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        job_name: "daily-cron-report",
        rows_affected: null,
        details: expect.objectContaining({
          rowsUpserted: null,
          failedRows: null,
        }),
      })
    );
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
        slowMsThreshold: null,
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

  it("does not let a same-name method-mismatched probe replace the scheduled result", async () => {
    cronJobReportSelectMock.mockResolvedValue({
      data: [
        {
          jobname: "update-player-trend-metrics",
          scheduled_time: "2026-03-20T12:00:00.000Z",
          end_time: "2026-03-20T12:00:01.000Z",
          status: "succeeded",
          return_message: "200 OK",
          sql_text:
            "select net.http_post(url:='https://example.test/api/v1/db/update-player-trend-metrics');",
        },
      ],
      error: null,
    });
    cronJobAuditSelectMock.mockResolvedValue({
      data: [
        {
          job_name: "update-player-trend-metrics",
          run_time: "2026-03-20T12:00:01.000Z",
          rows_affected: 10,
          status: "success",
          details: {
            method: "POST",
            url: "https://example.test/api/v1/db/update-player-trend-metrics",
            statusCode: 200,
            response: JSON.stringify({ success: true, rowsUpserted: 10 }),
          },
        },
        {
          job_name: "update-player-trend-metrics",
          run_time: "2026-03-20T12:01:00.000Z",
          rows_affected: null,
          status: "failure",
          details: {
            method: "GET",
            url: "https://example.test/api/v1/db/update-player-trend-metrics",
            statusCode: 405,
            response: JSON.stringify({ success: false }),
          },
        },
      ],
      error: null,
    });
    readFileMock.mockResolvedValue(`
\`\`\`json
[
  {
    "jobid": 392,
    "jobname": "update-player-trend-metrics",
    "schedule": "0 12 * * *",
    "run_time_utc": "12:00 UTC",
    "active": true,
    "method": "POST",
    "route": "/api/v1/db/update-player-trend-metrics"
  }
]
\`\`\`
`);

    const res = createMockRes();
    await handler({ method: "GET", query: {} } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      counts: expect.objectContaining({
        jobsOkLast: 1,
        jobsFailingLast: 0,
        // The mismatched probe remains visible as an unmatched audit run;
        // it must not change the scheduled job's status.
        auditFailures: 1,
      }),
    });
    expect(cronAuditEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        audits: expect.arrayContaining([
          expect.objectContaining({
            jobName: "update-player-trend-metrics",
            status: "success",
            statusCode: 200,
          }),
        ]),
      })
    );
  });

  it("does not count bounded external-feed skips as partial failures", async () => {
    cronJobReportSelectMock.mockResolvedValue({
      data: [
        {
          jobname: "update-line-combinations-job",
          scheduled_time: "2026-03-20T12:00:00.000Z",
          end_time: "2026-03-20T12:00:01.000Z",
          status: "success",
          return_message: "200 OK",
          sql_text:
            "select net.http_get(url:='https://example.test/api/v1/db/update-line-combinations?count=10');",
        },
      ],
      error: null,
    });
    cronJobAuditSelectMock.mockResolvedValue({
      data: [
        {
          job_name: "update-line-combinations-job",
          run_time: "2026-03-20T12:00:01.000Z",
          rows_affected: 10,
          status: "success",
          details: {
            method: "GET",
            url: "https://example.test/api/v1/db/update-line-combinations?count=10",
            statusCode: 200,
            response: JSON.stringify({
              success: true,
              repairMode: "recent_gap",
              status: "skipped_external_feed_unavailable",
              processed: 0,
              skipped: 10,
              skippedGameIds: [2025030417],
            }),
          },
        },
      ],
      error: null,
    });
    readFileMock.mockResolvedValue(`
\`\`\`json
[
  {
    "jobid": 328,
    "jobname": "update-line-combinations-job",
    "schedule": "0 12 * * *",
    "run_time_utc": "12:00 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-line-combinations?count=10"
  }
]
\`\`\`
`);

    const res = createMockRes();
    await handler({ method: "GET", query: {} } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      counts: expect.objectContaining({
        auditFailures: 0,
        totalFailedRows: 0,
        totalRowsUpserted: 0,
        warnPartialFailure: 0,
        jobsFailingLast: 0,
      }),
      warnings: expect.objectContaining({
        partialFailureJobs: [],
      }),
    });
  });

  it("includes SKO low-row warnings in the daily operator email", async () => {
    cronJobReportSelectMock.mockResolvedValue({
      data: [
        {
          jobname: "update-predictions-sko",
          scheduled_time: "2026-03-20T10:45:00.000Z",
          end_time: "2026-03-20T10:45:02.000Z",
          status: "success",
          return_message: "1 row",
          sql_text:
            "select net.http_get(url:='https://fhfhockey.com/api/v1/ml/update-predictions-sko');",
        },
      ],
      error: null,
    });
    cronJobAuditSelectMock.mockResolvedValue({
      data: [
        {
          job_name: "update-predictions-sko",
          run_time: "2026-03-20T10:45:02.000Z",
          rows_affected: 0,
          status: "success",
          details: {
            method: "GET",
            url: "/api/v1/ml/update-predictions-sko",
            statusCode: 200,
            response: JSON.stringify({
              success: true,
              warnings: [
                {
                  code: "low_rows_written",
                  message:
                    "Only 0 rows were written for 2 selected players.",
                },
              ],
            }),
          },
        },
      ],
      error: null,
    });
    readFileMock.mockResolvedValue(`
\`\`\`json
[
  {
    "jobid": 327,
    "jobname": "update-predictions-sko",
    "schedule": "45 10 * * *",
    "run_time_utc": "10:45 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/ml/update-predictions-sko"
  }
]
\`\`\`
`);
    const req: any = { method: "GET", query: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(cronAuditEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        audits: [
          expect.objectContaining({
            jobName: "update-predictions-sko",
            reason: "Returned 1 warning(s).",
          }),
        ],
      })
    );
  });

  it("prefers the active JSON schedule inventory over legacy SQL snippets", async () => {
    vi.setSystemTime(new Date("2026-03-20T14:00:00.000Z"));

    cronJobReportSelectMock.mockResolvedValue({
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
    });

    cronJobAuditSelectMock.mockResolvedValue({
      data: [],
      error: null,
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
    expect(res.body.warnings.missingObservationJobs[0].warnings).toContain(
      "Cron submission was recorded, but no route audit payload was recorded; route execution is unverified."
    );
  });

  it("suppresses only the current report's self-audit gap while the wrapper is still writing it", async () => {
    vi.setSystemTime(new Date("2026-03-20T12:00:30.000Z"));

    cronJobReportSelectMock.mockResolvedValue({
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
    });

    cronJobAuditSelectMock.mockResolvedValue({ data: [], error: null });

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

  it("distinguishes the four scheduler submissions from unverified route execution", async () => {
    vi.setSystemTime(new Date("2026-03-20T14:00:00.000Z"));

    const jobs = [
      {
        jobid: 43,
        jobname: "update-standings-details",
        schedule: "15 8 * * *",
        route: "/api/v1/db/update-standings-details?date=all",
      },
      {
        jobid: 99,
        jobname: "update-nst-goalies",
        schedule: "30 8 * * *",
        route: "/api/v1/db/update-nst-goalies",
      },
      {
        jobid: 275,
        jobname: "update-nst-team-daily",
        schedule: "55 9 * * *",
        route: "/api/v1/db/update-nst-team-daily",
      },
      {
        jobid: 328,
        jobname: "update-nst-team-daily-incremental",
        schedule: "50 10 * * *",
        route: "/api/v1/db/update-nst-team-daily",
      },
    ];

    cronJobReportSelectMock.mockResolvedValue({
      data: jobs.map((job) => {
        const [minute, hour] = job.schedule.split(" ");
        const scheduledTime = `2026-03-20T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00.000Z`;
        return {
          jobname: job.jobname,
          scheduled_time: scheduledTime,
          end_time: scheduledTime,
          status: "success",
          return_message: "OK",
          sql_text: `select net.http_get(url:='https://fhfhockey.com${job.route}');`,
        };
      }),
      error: null,
    });
    cronJobAuditSelectMock.mockResolvedValue({ data: [], error: null });
    readFileMock.mockResolvedValue(`
\`\`\`json
${JSON.stringify(
  jobs.map((job) => ({
    ...job,
    active: true,
    method: "GET",
  }))
)}
\`\`\`
`);

    const req: any = { method: "GET", query: { preview: "json" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      counts: expect.objectContaining({
  scheduledJobs: 4,
  scheduledJobsWithActivity: 4,
  warnMissingAudit: 4,
      }),
    });
    expect(res.body.warnings.missingObservationJobs).toHaveLength(4);
    for (const warning of res.body.warnings.missingObservationJobs) {
      expect(warning.warnings).toContain(
        "Cron submission was recorded, but no route audit payload was recorded; route execution is unverified."
      );
    }
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

    cronJobReportSelectMock.mockResolvedValue({
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
    });

    cronJobAuditSelectMock.mockResolvedValue({
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

    cronJobReportSelectMock.mockResolvedValue({
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
    });

    cronJobAuditSelectMock.mockResolvedValue({
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
        jobsOkLast: 0,
        jobsUnknownLast: 1,
        warnMissingAudit: 0,
      }),
      warnings: expect.objectContaining({
        missingObservationJobs: [],
      }),
    });
  });

  it("classifies a scheduled 410 legacy route as disabled rather than failed", async () => {
    cronJobReportSelectMock.mockResolvedValue({
      data: [
        {
          jobname: "update-rolling-games-recent",
          scheduled_time: "2026-03-20T12:00:00.000Z",
          end_time: "2026-03-20T12:00:01.000Z",
          status: "failed",
          return_message:
            "HTTP 410 Legacy rolling-games loader has been disabled.",
          sql_text:
            "select net.http_get(url:='https://fhfhockey.com/api/v1/db/update-rolling-games?date=recent');",
        },
      ],
      error: null,
    });

    cronJobAuditSelectMock.mockResolvedValue({
      data: [
        {
          job_name: "update-rolling-games-recent",
          run_time: "2026-03-20T12:00:01.000Z",
          rows_affected: 0,
          status: "failure",
          details: {
            method: "GET",
            url: "https://fhfhockey.com/api/v1/db/update-rolling-games?date=recent",
            statusCode: 410,
            durationMs: 1000,
            response: JSON.stringify({
              success: false,
              error: "Legacy rolling-games loader has been disabled.",
            }),
          },
        },
      ],
      error: null,
    });

    readFileMock.mockResolvedValue(`
\`\`\`json
[
  {
    "jobid": 319,
    "jobname": "update-rolling-games-recent",
    "schedule": "0 12 * * *",
    "run_time_utc": "12:00 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-rolling-games?date=recent"
  }
]
\`\`\`
`);

    const req: any = { method: "GET", query: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      counts: expect.objectContaining({
        auditFailures: 0,
        auditDisabled: 1,
        jobsFailingLast: 0,
        jobsDisabledLast: 1,
      }),
    });
    expect(cronAuditEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        audits: [expect.objectContaining({ status: "disabled" })],
        summary: expect.objectContaining({ auditDisabled: 1 }),
      })
    );
  });
  it("reads the full 6184-observation window rather than the first 1000", async () => {
    const audits = Array.from({ length: 6184 }, (_, index) => ({
      job_name: `child-${index}`,
      run_time: "2026-03-20T01:06:10.162024Z",
      status: index < 32 || (index >= 1000 && index < 1051) ? "failure" : "success",
      rows_affected: 0, details: null,
    }));
    cronJobAuditSelectMock.mockResolvedValue({ data: audits, error: null });
    const res = createMockRes();
    await handler({ method: "GET", query: { preview: "json" } } as any, res);
    expect(res.body.counts).toMatchObject({ auditRuns: 6184, auditFailures: 83 });
    expect(res.body.sources.audit).toMatchObject({ complete: true, pages: 7, expectedCount: 6184 });
    expect(cronJobAuditSelectMock).toHaveBeenCalledWith(expect.any(String), { count: "exact" });
  });

  it("assigns all four horizons by full query identity independent of inventory and arrival order", async () => {
    const jobs = [7, 3, 1, 0].map((horizon, index) => ({
      jobid: 383 + index, jobname: `game-predictions-forecast-h${horizon}`,
      schedule: `${35 + index} 11 * * *`, active: true, method: "GET",
      route: `/api/v1/game-predictions/forecast?fromOffsetDays=${horizon}&toOffsetDays=${horizon}`,
    }));
    const audits = jobs.map((job, index) => ({
      job_name: "game-predictions-forecast", run_time: `2026-03-20T11:${39 + index}:00.000Z`,
      status: index === 1 ? "failure" : "success",
      details: { method: "GET", url: job.route.split("?")[0] + `?toOffsetDays=${[7, 3, 1, 0][index]}&fromOffsetDays=${[7, 3, 1, 0][index]}`, statusCode: index === 1 ? 500 : 200 },
    }));
    cronJobReportSelectMock.mockResolvedValue({ data: [], error: null });
    cronJobAuditSelectMock.mockResolvedValue({ data: audits.reverse(), error: null });
    readFileMock.mockResolvedValue(`\`\`\`json
${JSON.stringify(jobs.reverse())}
\`\`\``);
    const res = createMockRes();
    await handler({ method: "GET" } as any, res);
    expect(res.body.counts).toMatchObject({ jobsOkLast: 3, jobsFailingLast: 1, jobsMissingLast: 0, unscheduledRuns: 0 });
    const briefings = cronAuditEmailMock.mock.calls.at(-1)?.[0] as any;
    expect(briefings.audits.find((job: any) => job.jobName === "game-predictions-forecast-h3").status).toBe("failure");
  });

  it("keeps recurring line updates from consuming the daily all operation", async () => {
    const jobs = [
      { jobid: 1, jobname: "update-line-combinations-job", schedule: "*/25 * * * *", route: "/api/v1/db/update-line-combinations?count=10" },
      { jobid: 2, jobname: "update-line-combinations-all", schedule: "0 8 * * *", route: "/api/v1/db/update-line-combinations" },
    ].map((job) => ({ ...job, active: true, method: "GET" }));
    cronJobReportSelectMock.mockResolvedValue({ data: [], error: null });
    cronJobAuditSelectMock.mockResolvedValue({ data: [...jobs.map((job, index) => ({
      job_name: "/api/v1/db/update-line-combinations", run_time: `2026-03-20T08:0${index}:00.000Z`,
      status: "success", details: { method: "GET", url: job.route, statusCode: 200 },
    })), { job_name: "/api/v1/db/update-line-combinations", run_time: "2026-03-20T12:00:01.000Z",
      status: "success", details: { method: "GET", url: jobs[0].route, statusCode: 200 } }], error: null });
    readFileMock.mockResolvedValue(`\`\`\`json
${JSON.stringify(jobs)}
\`\`\``);
    const res = createMockRes();
    await handler({ method: "GET" } as any, res);
    expect(res.body.counts).toMatchObject({ jobsOkLast: 2, jobsMissingLast: 0, unscheduledRuns: 0 });
  });

  it("assigns path-only legacy observations to the closest slot and respects exact scheduler ownership", async () => {
    const jobs = [
      { jobname: "early", schedule: "0 11 * * *" },
      { jobname: "late", schedule: "10 11 * * *" },
    ].map((job) => ({ ...job, active: true, method: "GET", route: "/api/shared" }));
    cronJobReportSelectMock.mockResolvedValue({ data: [
      { runid: 17, jobname: "late", scheduled_time: "2026-03-20T11:01:00.000Z", status: "failed", sql_text: "select net.http_get(url:='https://fhfhockey.com/api/shared');" },
    ], error: null });
    cronJobAuditSelectMock.mockResolvedValue({ data: [
      { job_name: "/api/shared", run_time: "2026-03-20T11:09:00.000Z", status: "failure", details: { method: "GET", url: "/api/shared", statusCode: 500 } },
      { job_name: "early", run_time: "2026-03-20T11:01:00.000Z", status: "success", details: { method: "GET", url: "/api/shared", statusCode: 200 } },
    ], error: null });
    readFileMock.mockResolvedValue(`\`\`\`json
${JSON.stringify(jobs)}
\`\`\``);
    const res = createMockRes();
    await handler({ method: "GET" } as any, res);
    expect(res.body.counts).toMatchObject({ jobsOkLast: 1, jobsFailingLast: 1, jobsMissingLast: 0 });
    const briefings = cronAuditEmailMock.mock.calls.at(-1)?.[0] as any;
    expect(briefings.audits.find((job: any) => job.jobName === "late")).toMatchObject({ status: "failure" });
  });

  it("preserves partial failure evidence and marks query timeouts as incomplete", async () => {
    const audits = Array.from({ length: 1001 }, (_, index) => ({ job_name: `child-${index}`, run_time: "2026-03-20T01:00:00.000Z", status: index === 0 ? "failure" : "success", details: null }));
    cronJobAuditSelectMock.mockResolvedValueOnce({ data: audits, error: null })
      .mockResolvedValue({ data: null, error: { message: "statement timeout" }, count: null });
    const res = createMockRes();
    await handler({ method: "GET" } as any, res);
    expect(res.body).toMatchObject({ totalsComplete: false, counts: { auditRuns: 1000, auditFailures: 1, jobsOkLast: 0 } });
    expect(res.body.sources.audit.error).toContain("statement timeout");
    expect(resendSendMock.mock.calls[0][0].subject).toContain("incomplete telemetry");
    expect((cronAuditEmailMock.mock.calls.at(-1)?.[0] as any).fetchErrors[0]).toContain("1000 observations retained");
  });

  it("keeps no-output serving-gate receipts unknown without inventing failures", async () => {
    cronJobAuditSelectMock.mockResolvedValue({ data: [{
      job_name: "run-forge-projection-v2", run_time: "2026-03-20T12:05:00.000Z", status: "success", rows_affected: 0,
      details: { method: "POST", url: "/api/v1/db/run-projection-v2", statusCode: 200,
        response: { success: true, result: { requestedGames: 6, processedGames: 0, skippedGames: 6, results: [{ skippedReason: "non-production model" }] } } },
    }], error: null });
    const res = createMockRes();
    await handler({ method: "GET" } as any, res);
    expect(res.body.counts).toMatchObject({ jobsUnknownLast: 1, jobsOkLast: 0, auditFailures: 0 });
    const briefing = (cronAuditEmailMock.mock.calls.at(-1)?.[0] as any).audits[0];
    expect(briefing.reason).toContain("produced no output");
  });

  it("excludes arrivals beyond the fixed window end", async () => {
    cronJobAuditSelectMock.mockResolvedValue({ data: [{ job_name: "future", run_time: "2026-03-20T12:11:00.000Z", status: "failure" }], error: null });
    const res = createMockRes();
    await handler({ method: "GET", query: { preview: "json" } } as any, res);
    expect(res.body.window).toEqual({ since: "2026-03-19T12:10:00.000Z", until: "2026-03-20T12:10:00.000Z" });
    expect(res.body.counts.auditFailures).toBe(0);
  });

  it("matches one closest observation per daily slot and retains extra failure evidence", async () => {
    cronJobReportSelectMock.mockResolvedValue({ data: [], error: null });
    cronJobAuditSelectMock.mockResolvedValue({ data: [
      { job_name: "run-forge-projection-v2", run_time: "2026-03-20T12:09:00.000Z", status: "failure", details: { method: "POST", url: "/api/v1/db/run-projection-v2", statusCode: 500, error: "extra failed run" } },
      { job_name: "run-forge-projection-v2", run_time: "2026-03-20T12:00:01.000Z", status: "success", details: { method: "POST", url: "/api/v1/db/run-projection-v2", statusCode: 200 } },
    ], error: null });
    const res = createMockRes();
    await handler({ method: "GET" } as any, res);
    expect(res.body.counts).toMatchObject({ jobsOkLast: 1, auditFailures: 1, unscheduledRuns: 1 });
    expect((cronAuditEmailMock.mock.calls.at(-1)?.[0] as any).audits.some((row: any) => row.reason === "extra failed run")).toBe(true);
  });

  it("deduplicates indistinguishable audit identities and reports their completeness as unknown", async () => {
    const row = { job_name: "run-forge-projection-v2", run_time: "2026-03-20T12:00:01.000Z", status: "failure", details: { method: "POST", url: "/api/v1/db/run-projection-v2", statusCode: 500 } };
    cronJobAuditSelectMock.mockResolvedValue({ data: [row, row], error: null });
    const res = createMockRes();
    await handler({ method: "GET", query: { preview: "json" } } as any, res);
    expect(res.body.counts.auditFailures).toBe(1);
    expect(res.body.sources.audit).toMatchObject({ complete: false, duplicateRows: 1 });
    expect(res.body.totals.auditFailures).toBeNull();
  });

  it("newer unknown must not suppress extra failed observation on same route", async () => {
    cronJobReportSelectMock.mockResolvedValue({data: [], error: null});
    cronJobAuditSelectMock.mockResolvedValue({data: [
      {job_name: "run-forge-projection-v2", run_time: "2026-03-20T12:00:00.000Z", status: "success", details: {method:"POST",url:"/api/v1/db/run-projection-v2",response:{success:true,rowsUpserted:42}}},
      {job_name: "probe", run_time: "2026-03-20T11:50:00.000Z", status: "failure", details: {method:"POST",url:"/api/v1/db/run-projection-v2",error:"extra actual failure"}},
      {job_name: "probe", run_time: "2026-03-20T12:05:00.000Z", status: "unknown", details: {method:"POST",url:"/api/v1/db/run-projection-v2"}},
    ], error: null});
    const res=createMockRes(); await handler({method:"GET"} as any,res);
    expect(res.body.counts.auditFailures).toBe(1);
    const props=cronAuditEmailMock.mock.calls[0][0];
    expect(props.audits.some((a:any)=>a.status==="failure")).toBe(true);
  });

  it("scheduler timestamp tie cannot borrow failure from another horizon as last success", async () => {
    readFileMock.mockResolvedValue(`SELECT cron.schedule('h1','0 12 * * *',$$select net.http_post(url:='https://fhfhockey.com/api/v1/game-predictions/forecast?horizonDays=1');$$);\nSELECT cron.schedule('h3','0 12 * * *',$$select net.http_post(url:='https://fhfhockey.com/api/v1/game-predictions/forecast?horizonDays=3');$$);`);
    cronJobReportSelectMock.mockResolvedValue({data:[],error:null});
    cronJobAuditSelectMock.mockResolvedValue({data:[
      {job_name:"/api/v1/game-predictions/forecast",run_time:"2026-03-20T12:01:00.000Z",status:"success",details:{method:"POST",url:"/api/v1/game-predictions/forecast?horizonDays=1",response:{rowsUpserted:3}}},
      {job_name:"/api/v1/game-predictions/forecast",run_time:"2026-03-20T12:01:00.000Z",status:"failure",details:{method:"POST",url:"/api/v1/game-predictions/forecast?horizonDays=3",error:"h3 failed"}},
    ],error:null});
    const res=createMockRes(); await handler({method:"GET"} as any,res);
    const h3=cronAuditEmailMock.mock.calls[0][0].audits.find((a:any)=>a.jobName==="h3");
    expect(h3.lastKnownSuccessDisplay).toBeNull();
  });

  it("no output processedGames=0 skippedGames=0 must not be productive success",async()=>{
    cronJobReportSelectMock.mockResolvedValue({data:[],error:null});
    cronJobAuditSelectMock.mockResolvedValue({data:[{job_name:"run-forge-projection-v2",run_time:"2026-03-20T12:01:00.000Z",status:"success",rows_affected:0,details:{method:"POST",url:"/api/v1/db/run-projection-v2",response:{success:true,result:{processedGames:0,skippedGames:0}}}}],error:null});
    const res=createMockRes(); await handler({method:"GET"} as any,res);
    expect(res.body.counts.jobsOkLast).toBe(0);
  });


  it("extra SQL failure must not yield an all-green subject",async()=>{
    cronJobReportSelectMock.mockResolvedValue({data:[{jobname:"other-sql-job",scheduled_time:"2026-03-20T12:03:00.000Z",status:"failed",return_message:"ERROR: actual SQL failure",sql_text:"SELECT failing_function();"}],error:null});
    const res=createMockRes();await handler({method:"GET"} as any,res);
    const props=cronAuditEmailMock.mock.calls[0][0]; const subject=resendSendMock.mock.calls[0][0].subject;
    expect(props.audits.some((a:any)=>a.status==="failure")).toBe(true);
    expect(props.audits.find((a:any)=>a.jobName==="other-sql-job").timingProvenance).toBe("Unknown; no SQL execution timing receipt");
    expect(subject).not.toContain("✅");
  });
  it("actual all-skipped shift response must not be productive success",async()=>{
    readFileMock.mockResolvedValue(`SELECT cron.schedule('update-shift-charts','0 12 * * *',$$select net.http_get(url:='https://fhfhockey.com/api/v1/db/shift-charts');$$);`);
    cronJobReportSelectMock.mockResolvedValue({data:[],error:null});
    cronJobAuditSelectMock.mockResolvedValue({data:[{job_name:"update-shift-charts",run_time:"2026-03-20T12:01:00.000Z",status:"success",rows_affected:0,details:{method:"GET",url:"/api/v1/db/shift-charts",response:{success:true,message:"Successfully processed all shift charts.",operationStatus:"warning",rowsAffected:0,rowsVerified:0,rowsPruned:0,idempotentGames:0,preseasonShiftSkips:[{gameId:2026010056,code:"preseason_shift_source_unavailable",stage:"fetch_shifts",reason:"No shift rows"}],dataQualityWarnings:[{code:"preseason_shift_source_unavailable",message:"Skipped approved preseason game 2026010056; relationships remain unverified."}]}}}],error:null});
    const res=createMockRes();await handler({method:"GET"} as any,res);
    expect(res.body.counts.jobsOkLast).toBe(0);
    expect(cronAuditEmailMock.mock.calls[0][0].audits[0].lastKnownSuccessDisplay).toBeNull();
    expect(cronAuditEmailMock.mock.calls[0][0].audits[0].reason).toContain("produced no output");
  });


  it("a single yesterday recurring receipt cannot prove latest slot is healthy",async()=>{
    readFileMock.mockResolvedValue(`SELECT cron.schedule('recurring-lines','*/25 * * * *',$$select net.http_post(url:='https://fhfhockey.com/api/v1/db/update-line-combinations?count=10');$$);`);
    cronJobReportSelectMock.mockResolvedValue({data:[],error:null});
    cronJobAuditSelectMock.mockResolvedValue({data:[{job_name:"recurring-lines",run_time:"2026-03-19T12:25:01.000Z",status:"success",rows_affected:10,details:{method:"POST",url:"/api/v1/db/update-line-combinations?count=10",durationMs:1000,response:{success:true,rowsUpserted:10}}}],error:null});
    const res=createMockRes();await handler({method:"GET"} as any,res);
    expect(res.body.counts.jobsOkLast).toBe(0);
  });

  it("puts failures ahead of eight newer unknown routes and reports omitted failure detail counts", async () => {
    cronJobReportSelectMock.mockResolvedValue({ data: [], error: null });
    const failures = Array.from({ length: 10 }, (_, index) => ({ job_name: `failed-${index}`, run_time: "2026-03-20T10:00:00.000Z", status: "failure", details: { method: "POST", url: `/extra/${index}`, error: `failure ${index}` } }));
    const unknown = Array.from({ length: 8 }, (_, index) => ({ job_name: `unknown-${index}`, run_time: "2026-03-20T12:05:00.000Z", status: "unknown", details: { method: "POST", url: `/unknown/${index}` } }));
    cronJobAuditSelectMock.mockResolvedValue({ data: [...unknown, ...failures], error: null });
    const res = createMockRes();
    await handler({ method: "GET" } as any, res);
    const props = cronAuditEmailMock.mock.calls[0][0];
    expect(props.audits.filter((row: any) => row.status === "failure")).toHaveLength(8);
    expect(props.summary.omittedFailureObservations).toBe(2);
    expect(res.body.counts).toMatchObject({ auditFailures: 10, omittedFailureObservations: 2 });
  });

  it("retains failure details for distinct forecast operations sharing a path", async () => {
    cronJobReportSelectMock.mockResolvedValue({ data: [], error: null });
    cronJobAuditSelectMock.mockResolvedValue({ data: [1, 3].map((horizon) => ({ job_name: "forecast", run_time: "2026-03-20T12:00:00.000Z", status: "failure", details: { method: "POST", url: `/api/v1/game-predictions/forecast?horizonDays=${horizon}`, error: `h${horizon} failed` } })), error: null });
    const res = createMockRes();
    await handler({ method: "GET" } as any, res);
    const failures = cronAuditEmailMock.mock.calls[0][0].audits.filter((row: any) => row.status === "failure");
    expect(failures.map((row: any) => row.reason).sort()).toEqual(["h1 failed", "h3 failed"]);
    expect(res.body.counts.omittedFailureObservations).toBe(0);
  });

  it.each([
    { rowsAffected: 0, rowsVerified: 40, rowsPruned: 0, idempotentGames: 1 },
    { rowsAffected: 40, rowsVerified: 40, rowsPruned: 0, idempotentGames: 0 },
    { rowsAffected: 0, rowsVerified: 0, rowsPruned: 3, idempotentGames: 0 },
  ])("keeps verified/idempotent/mixed shift runs productive: %j", async (metrics) => {
    readFileMock.mockResolvedValue("SELECT cron.schedule('update-shift-charts','0 12 * * *',$$select net.http_get(url:='https://fhfhockey.com/api/v1/db/shift-charts');$$);");
    cronJobReportSelectMock.mockResolvedValue({ data: [], error: null });
    cronJobAuditSelectMock.mockResolvedValue({ data: [{ job_name: "update-shift-charts", run_time: "2026-03-20T12:01:00.000Z", status: "success", rows_affected: metrics.rowsAffected,
      details: { method: "GET", url: "/api/v1/db/shift-charts", response: { success: true, operationStatus: "warning", ...metrics, preseasonShiftSkips: [{ gameId: 2026010056 }] } } }], error: null });
    const res = createMockRes();
    await handler({ method: "GET" } as any, res);
    expect(res.body.counts).toMatchObject({ jobsOkLast: 1, auditUnknown: 0 });
    expect(cronAuditEmailMock.mock.calls[0][0].audits[0].lastKnownSuccessDisplay).not.toBeNull();
  });

  it("keeps generic zero-row successes productive", async () => {
    cronJobReportSelectMock.mockResolvedValue({ data: [], error: null });
    cronJobAuditSelectMock.mockResolvedValue({ data: [{ job_name: "run-forge-projection-v2", run_time: "2026-03-20T12:00:01.000Z", status: "success", rows_affected: 0,
      details: { method: "POST", url: "/api/v1/db/run-projection-v2", response: { success: true, rowsUpserted: 0 } } }], error: null });
    const res = createMockRes();
    await handler({ method: "GET" } as any, res);
    expect(res.body.counts.jobsOkLast).toBe(1);
  });

  it.each(["complete", "incomplete"])("checks the latest recurring slot with %s telemetry", async (coverage) => {
    readFileMock.mockResolvedValue("SELECT cron.schedule('recurring-lines','*/25 * * * *',$$select net.http_post(url:='https://fhfhockey.com/api/v1/db/update-line-combinations?count=10');$$);");
    cronJobReportSelectMock.mockResolvedValue(coverage === "complete" ? { data: [], error: null } : { data: null, error: { message: "statement timeout" } });
    cronJobAuditSelectMock.mockResolvedValue({ data: [{ job_name: "recurring-lines", run_time: "2026-03-19T12:25:01.000Z", status: "success",
      details: { method: "POST", url: "/api/v1/db/update-line-combinations?count=10", response: { rowsUpserted: 10 } } }], error: null });
    const res = createMockRes();
    await handler({ method: "GET" } as any, res);
    expect(res.body.counts.jobsOkLast).toBe(0);
    expect(res.body.counts[coverage === "complete" ? "jobsMissingLast" : "jobsUnknownLast"]).toBe(1);
    const job = cronAuditEmailMock.mock.calls[0][0].audits[0];
    expect(job.reason).toContain("2026-03-20T12:00:00.000Z");
    expect(job.reason).toContain("five-minute");
    expect(job.runTimeDisplay).toContain("2026-03-19T12:25:01.000Z");
  });

  it("uses the previous required recurring slot during the explicit completion grace", async () => {
    vi.setSystemTime(new Date("2026-03-20T12:03:00.000Z"));
    readFileMock.mockResolvedValue("SELECT cron.schedule('recurring-lines','*/25 * * * *',$$select net.http_post(url:='https://fhfhockey.com/api/v1/db/update-line-combinations?count=10');$$);");
    cronJobReportSelectMock.mockResolvedValue({ data: [], error: null });
    cronJobAuditSelectMock.mockResolvedValue({ data: [{ job_name: "recurring-lines", run_time: "2026-03-20T11:50:01.000Z", status: "success",
      details: { method: "POST", url: "/api/v1/db/update-line-combinations?count=10", response: { rowsUpserted: 10 } } }], error: null });
    const res = createMockRes();
    await handler({ method: "GET" } as any, res);
    expect(res.body.counts.jobsOkLast).toBe(1);
  });

  it("retains an earlier recurring failure after the latest slot recovers", async () => {
    readFileMock.mockResolvedValue("SELECT cron.schedule('recurring-lines','*/25 * * * *',$$select net.http_post(url:='https://fhfhockey.com/api/v1/db/update-line-combinations?count=10');$$);");
    cronJobReportSelectMock.mockResolvedValue({ data: [], error: null });
    cronJobAuditSelectMock.mockResolvedValue({ data: [
      { job_name: "recurring-lines", run_time: "2026-03-20T11:50:01.000Z", status: "failure", details: { method: "POST", url: "/api/v1/db/update-line-combinations?count=10", error: "earlier failure" } },
      { job_name: "recurring-lines", run_time: "2026-03-20T12:00:01.000Z", status: "success", details: { method: "POST", url: "/api/v1/db/update-line-combinations?count=10", response: { rowsUpserted: 10 } } },
    ], error: null });
    const res = createMockRes();
    await handler({ method: "GET" } as any, res);
    expect(res.body.counts.jobsOkLast).toBe(1);
    expect(cronAuditEmailMock.mock.calls[0][0].audits.some((row: any) => row.reason === "earlier failure")).toBe(true);
    expect(resendSendMock.mock.calls[0][0].subject).not.toContain("✅");
  });

  it("preserves failure and skip identities when mixed with a newer unknown observation", async () => {
    cronJobReportSelectMock.mockResolvedValue({ data: [], error: null });
    const route = "/api/v1/game-predictions/forecast";
    cronJobAuditSelectMock.mockResolvedValue({ data: [
      { job_name: "run-forge-projection-v2", run_time: "2026-03-20T12:00:00.000Z", status: "success", details: { method: "POST", url: "/api/v1/db/run-projection-v2", response: { rowsUpserted: 42 } } },
      { job_name: "forecast", run_time: "2026-03-20T11:50:00.000Z", status: "failure", details: { method: "POST", url: `${route}?horizonDays=1`, error: "h1 failed" } },
      { job_name: "forecast", run_time: "2026-03-20T12:05:00.000Z", status: "unknown", details: { method: "POST", url: `${route}?horizonDays=1` } },
      { job_name: "forecast", run_time: "2026-03-20T12:03:00.000Z", status: "success", details: { method: "POST", url: `${route}?horizonDays=3`, response: { success: true, result: { processedGames: 0, skippedGames: 2 } } } },
    ], error: null });
    const res = createMockRes();
    await handler({ method: "GET" } as any, res);
    const extra = cronAuditEmailMock.mock.calls[0][0].audits.slice(1);
    expect(extra).toHaveLength(2);
    expect(extra[0]).toMatchObject({ status: "failure", reason: "h1 failed", route: `${route}?horizonDays=1` });
    expect(extra[1]).toMatchObject({ status: "unknown", route: `${route}?horizonDays=3`, lastKnownSuccessDisplay: null });
    expect(extra[1].missingObservationWarnings).toContain("Operation was skipped or produced no output; successful HTTP execution does not establish data refresh.");
    expect(res.body.counts).toMatchObject({ auditFailures: 1, auditUnknown: 2, jobsOkLast: 1, omittedFailureObservations: 0 });
  });

  it("explains truncated producer receipts and retains visible timing provenance and operation budget", async () => {
    cronJobReportSelectMock.mockResolvedValue({ data: [], error: null });
    cronJobAuditSelectMock.mockResolvedValue({ data: [{
      job_name: "run-rolling-forge-pipeline", run_time: "2026-03-20T12:00:01.000Z", status: "failure",
      details: { method: "GET", url: "/api/v1/db/run-rolling-forge-pipeline", statusCode: 500,
        timing: { startedAt: "2026-03-20T11:58:18.000Z", endedAt: "2026-03-20T12:00:01.000Z", durationMs: 103000, timer: "01:43", source: "audit" },
        response: '{"success":false,"runtimeBudget":{"budgetMs":210000},"termination":{"state":"stopped_on_blocking_failure"},"dependencyContract":{"stages":[…' },
    }], error: null });
    const res = createMockRes();
    await handler({ method: "GET" } as any, res);
    const row = (cronAuditEmailMock.mock.calls.at(-1)?.[0] as any).audits.find((row: any) => row.jobName === "run-rolling-forge-pipeline");
    expect(row).toMatchObject({ status: "failure", durationMs: 103000, timingProvenance: "Route audit timing receipt", runtimeBudgetMs: 210000, repositoryLimitMs: 240000 });
    expect(row.reason).toContain("stopped on blocking failure");
    expect(row.reason).toContain("root cause unavailable");
    expect(row.reason).not.toContain('"dependencyContract"');
  });

  it("prefers a nested failed-stage root cause over generic summary and declaration metadata", async () => {
    cronJobAuditSelectMock.mockResolvedValue({ data: [{ job_name: "run-forge-projection-v2", run_time: "2026-03-20T12:00:01.000Z", status: "failure",
      details: { method: "POST", url: "/api/v1/db/run-projection-v2", response: { success: false, message: "Pipeline failed", pipeline: { stages: [{ message: "declarative contract" }] }, results: [{ status: "success", message: "healthy stage" }, { status: "failed", error: { message: "[NHL] Invalid shift roster for game 2026010001" } }] } } }], error: null });
    const res = createMockRes(); await handler({ method: "GET" } as any, res);
    expect((cronAuditEmailMock.mock.calls.at(-1)?.[0] as any).audits.find((row: any) => row.jobName === "run-forge-projection-v2").reason).toBe("[NHL] Invalid shift roster for game 2026010001");
  });

  it("labels empty stats attempts as no output and distinguishes observed success from incomplete schedule health", async () => {
    readFileMock.mockResolvedValue('```json\n' + JSON.stringify([{ jobname: "stats", active: true, method: "GET", schedule: "0 12 * * *", route: "/api/v1/db/cron/update-stats-cron" }]) + '\n```');
    cronJobReportSelectMock.mockResolvedValue({ data: null, error: { message: "statement timeout" } });
    cronJobAuditSelectMock.mockResolvedValue({ data: [{ job_name: "stats", run_time: "2026-03-20T12:00:01.000Z", status: "success", details: { method: "GET", url: "/api/v1/db/cron/update-stats-cron", durationMs: 483, response: { success: true, attemptedGameIds: [], updatedGameIds: [] } } }], error: null });
    const res = createMockRes(); await handler({ method: "GET" } as any, res);
    const row = (cronAuditEmailMock.mock.calls.at(-1)?.[0] as any).audits.find((row: any) => row.jobName === "stats");
    expect(row.status).toBe("unknown");
    expect(row.rowsUpserted).toBeNull();
    expect(row.missingObservationWarnings.join(" ")).toContain("skipped or produced no output");
    expect(row.timingProvenance).toContain("scope unverified");
  });

  it("uses a shared 180-second read allowance and reserves 60 seconds under the 240-second repository limit", async () => {
    for (const mock of [cronJobReportSelectMock, cronJobAuditSelectMock]) {
      mock.mockImplementation(async () => {
        vi.setSystemTime(Date.now() + 8_000);
        return { data: [], error: null };
      });
    }
    const res = createMockRes();
    await handler({ method: "GET", query: { preview: "json" } } as any, res);
    expect(res.body.sources.cron.complete).toBe(true);
    expect(res.body.sources.audit.complete).toBe(true);
    expect(res.body.window.until).toBe("2026-03-20T12:10:00.000Z");
    expect(res.body.executionBudget).toMatchObject({
      repositoryLimitMs: 240_000, sourceBudgetMs: 180_000, sourceElapsedMs: 32_000,
      sourceDeadlineAt: "2026-03-20T12:13:00.000Z", requestTimeoutMs: 15_000,
      phaseReservesMs: { assemblyAndRender: 20_000, emailDelivery: 20_000, auditAndResponse: 20_000 },
    });
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it("exhausts one overall source deadline and still sends a truthful partial report", async () => {
    const cron = Array.from({ length: 5000 }, (_, id) => ({
      runid: id + 1, jobname: "child-sql", scheduled_time: "2026-03-20T12:00:00.000Z",
      status: "success", sql_text: "SELECT 1;",
    }));
    const audits = Array.from({ length: 6184 }, (_, id) => ({
      job_name: "child-" + id, run_time: "2026-03-20T12:00:00.000Z",
      status: id < 83 ? "failure" : "success", details: null,
    }));
    cronJobReportSelectMock.mockImplementation(async () => {
      vi.setSystemTime(Date.now() + 12_000); return { data: cron, error: null };
    });
    cronJobAuditSelectMock.mockImplementation(async () => {
      vi.setSystemTime(Date.now() + 5_000); return { data: audits, error: null };
    });
    const res = createMockRes();
    await handler({ method: "GET" } as any, res);
    expect(res.body.executionBudget.sourceElapsedMs).toBe(180_000);
    expect(res.body.sources.cron.complete).toBe(true);
    expect(res.body.sources.audit).toMatchObject({ complete: false, enumerationComplete: true, pages: 7, verificationPages: 5 });
    expect(res.body.counts).toMatchObject({ auditRuns: 6184, auditFailures: 83 });
    expect(res.body.totals.auditFailures).toBeNull();
    expect(resendSendMock.mock.calls[0][0].subject).toContain("incomplete telemetry");
  });

});
