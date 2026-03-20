import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUDIT_BENCHMARK_RUN_POLICY,
  buildBenchmarkReportObservation,
  executeBenchmarkJob,
  runBenchmarkInventory,
  runBenchmarkChronologically,
  type BenchmarkRunResult
} from "lib/cron/benchmarkRunner";
import type { CronInventoryJob } from "lib/cron/cronInventory";

function createJob(
  overrides: Partial<CronInventoryJob> & Pick<CronInventoryJob, "key" | "name">
): CronInventoryJob {
  const { key, name, ...rest } = overrides;

  return {
    key,
    name,
    cronExpression: "0 0 * * *",
    scheduleTimeDisplay: "00:00 UTC",
    utcHour: 0,
    utcMinute: 0,
    slotIndex: 0,
    sortOrder: 0,
    method: "GET",
    executionShape: "HTTP route",
    url: null,
    route: `/api/${overrides.name}`,
    routePath: `/api/${name}`,
    sqlText: null,
    notes: [],
    ...rest
  };
}

describe("benchmarkRunner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T12:00:00.000Z"));
  });

  it("runs jobs in chronological order and preserves same-slot file order", async () => {
    const jobs: CronInventoryJob[] = [
      createJob({
        key: "late",
        name: "late",
        slotIndex: 600,
        sortOrder: 2,
        scheduleTimeDisplay: "10:00 UTC"
      }),
      createJob({
        key: "early-a",
        name: "early-a",
        slotIndex: 540,
        sortOrder: 0,
        scheduleTimeDisplay: "09:00 UTC"
      }),
      createJob({
        key: "early-b",
        name: "early-b",
        slotIndex: 540,
        sortOrder: 1,
        scheduleTimeDisplay: "09:00 UTC"
      })
    ];

    const seen: string[] = [];
    const executeJob = vi.fn(
      async (job: CronInventoryJob): Promise<BenchmarkRunResult<string>> => {
        seen.push(job.name);
        vi.setSystemTime(new Date(Date.now() + 1_000));
        return {
          status: "success",
          summary: `${job.name}:ok`
        };
      }
    );

    const result = await runBenchmarkChronologically(jobs, executeJob);

    expect(seen).toEqual(["early-a", "early-b", "late"]);
    expect(result.observations.map((observation) => observation.jobName)).toEqual(seen);
    expect(result.observations.every((observation) => observation.timing.timer === "00:01")).toBe(
      true
    );
    expect(result.timer).toBe("00:03");
    expect(result.policy).toEqual(AUDIT_BENCHMARK_RUN_POLICY);
    expect(result.report).toMatchObject({
      source: "benchmark_runner",
      counts: {
        totalJobs: 3,
        succeeded: 3,
        failed: 0,
        skipped: 0
      }
    });
  });

  it("records skipped and failure results without breaking sequence timing", async () => {
    const jobs: CronInventoryJob[] = [
      createJob({ key: "skip", name: "skip", sortOrder: 0 }),
      createJob({ key: "fail", name: "fail", sortOrder: 1 })
    ];

    const executeJob = vi.fn(async (job: CronInventoryJob) => {
      vi.setSystemTime(new Date(Date.now() + 500));
      if (job.name === "skip") {
        return {
          status: "skipped",
          reason: "local/dev side effect"
        } satisfies BenchmarkRunResult;
      }

      return {
        status: "failure",
        reason: "boom"
      } satisfies BenchmarkRunResult;
    });

    const result = await runBenchmarkChronologically(jobs, executeJob);

    expect(result.observations).toMatchObject([
      {
        jobName: "skip",
        status: "skipped",
        reason: "local/dev side effect",
        notes: expect.arrayContaining(["local/dev side effect"]),
        touchedSystems: expect.any(Array)
      },
      {
        jobName: "fail",
        status: "failure",
        reason: "boom",
        notes: expect.arrayContaining(["boom"]),
        touchedSystems: expect.any(Array)
      }
    ]);
    expect(result.durationMs).toBe(1_000);
  });

  it("dispatches HTTP and SQL jobs through separate executors in one ordered workflow", async () => {
    const jobs: CronInventoryJob[] = [
      createJob({
        key: "http-job",
        name: "http-job",
        slotIndex: 540,
        sortOrder: 0,
        method: "GET",
        executionShape: "HTTP route",
        route: "/api/http-job"
      }),
      createJob({
        key: "sql-job",
        name: "sql-job",
        slotIndex: 545,
        sortOrder: 1,
        method: "SQL",
        executionShape: "SQL-only",
        sqlText: "REFRESH MATERIALIZED VIEW test_view;",
        route: null,
        routePath: null
      })
    ];

    const executeHttpJob = vi.fn(async (job: CronInventoryJob) => {
      vi.setSystemTime(new Date(Date.now() + 1_000));
      return {
        status: "success",
        summary: `${job.name}:http`
      } satisfies BenchmarkRunResult<string>;
    });
    const executeSqlJob = vi.fn(async (job: CronInventoryJob) => {
      vi.setSystemTime(new Date(Date.now() + 2_000));
      return {
        status: "success",
        summary: `${job.name}:sql`
      } satisfies BenchmarkRunResult<string>;
    });

    const result = await runBenchmarkInventory(jobs, {
      executeHttpJob,
      executeSqlJob
    });

    expect(executeHttpJob).toHaveBeenCalledTimes(1);
    expect(executeSqlJob).toHaveBeenCalledTimes(1);
    expect(executeHttpJob.mock.calls[0]?.[0]?.name).toBe("http-job");
    expect(executeSqlJob.mock.calls[0]?.[0]?.name).toBe("sql-job");
    expect(result.observations).toMatchObject([
      {
        jobName: "http-job",
        status: "success",
        summary: "http-job:http",
        touchedSystems: expect.arrayContaining(["supabase"]),
        canRunLocally: true
      },
      {
        jobName: "sql-job",
        status: "success",
        summary: "sql-job:sql",
        touchedSystems: expect.arrayContaining([
          "supabase",
          "local_database_functions"
        ]),
        canRunLocally: true
      }
    ]);
  });

  it("skips non-runnable and unsupported jobs with stable reasons", async () => {
    const nonRunnableJob = createJob({
      key: "broken-job",
      name: "broken-job",
      executionShape: "currently non-runnable in local/dev",
      notes: ["STATUS: 404 NOT FOUND"]
    });
    const unsupportedJob = createJob({
      key: "wrapper-job",
      name: "wrapper-job",
      method: "UNKNOWN",
      executionShape: "wrapper-dependent"
    });

    await expect(
      executeBenchmarkJob(nonRunnableJob, {})
    ).resolves.toMatchObject({
      status: "skipped",
      reason: "STATUS: 404 NOT FOUND"
    });

    await expect(
      executeBenchmarkJob(unsupportedJob, {})
    ).resolves.toMatchObject({
      status: "skipped",
      reason: "No benchmark executor is configured for this job shape."
    });
  });

  it("uses policy-controlled fallback execution when provided", async () => {
    const job = createJob({
      key: "sheet-job",
      name: "sync-yahoo-players-to-sheet",
      route: "/api/internal/sync-yahoo-players-to-sheet"
    });

    const executePolicyJob = vi.fn(
      async (_job: CronInventoryJob, action) =>
        ({
          status: "success",
          summary: action
        }) satisfies BenchmarkRunResult<string>
    );

    await expect(
      executeBenchmarkJob(job, {
        executePolicyJob
      })
    ).resolves.toMatchObject({
      status: "success",
      summary: "mock_fallback"
    });

    expect(executePolicyJob).toHaveBeenCalledWith(job, "mock_fallback");
  });

  it("captures benchmark metadata, local-run policy, and executor notes in observations", async () => {
    const jobs: CronInventoryJob[] = [
      createJob({
        key: "nst-job",
        name: "update-nst-gamelog",
        slotIndex: 540,
        sortOrder: 0,
        route: "/api/v1/db/update-nst-gamelog"
      }),
      createJob({
        key: "side-effect-job",
        name: "sync-yahoo-players-to-sheet",
        slotIndex: 545,
        sortOrder: 1,
        route: "/api/internal/sync-yahoo-players-to-sheet"
      })
    ];

    const result = await runBenchmarkInventory(jobs, {
      executeHttpJob: async (job) => {
        vi.setSystemTime(new Date(Date.now() + 500));
        return {
          status: "success",
          summary: job.name,
          notes: ["executor note"]
        };
      },
      executePolicyJob: async (_job, action) => {
        vi.setSystemTime(new Date(Date.now() + 500));
        return {
          status: "success",
          summary: action,
          notes: ["policy adapter"]
        } satisfies BenchmarkRunResult<string>;
      }
    });

    expect(result.observations[0]).toMatchObject({
      jobName: "update-nst-gamelog",
      localRunPolicy: "caution",
      canRunLocally: true,
      touchedSystems: expect.arrayContaining(["nst", "external_api"]),
      benchmarkAnnotations: expect.arrayContaining([
        expect.objectContaining({ kind: "rate_limited" })
      ]),
      notes: expect.arrayContaining(["executor note"])
    });

    expect(result.observations[1]).toMatchObject({
      jobName: "sync-yahoo-players-to-sheet",
      status: "success",
      summary: "mock_fallback",
      localRunPolicy: "skip",
      canRunLocally: false,
      touchedSystems: expect.arrayContaining(["google_sheets", "yahoo_api"]),
      benchmarkAnnotations: expect.arrayContaining([
        expect.objectContaining({ kind: "side_effect" })
      ]),
      executionAction: "mock_fallback",
      notes: expect.arrayContaining(["policy adapter"])
    });
  });

  it("does not impose a hard per-job duration limit during audit execution", async () => {
    const jobs: CronInventoryJob[] = [
      createJob({
        key: "long-job",
        name: "long-job",
        slotIndex: 540,
        sortOrder: 0
      })
    ];

    const result = await runBenchmarkInventory(jobs, {
      executeHttpJob: async () => {
        vi.setSystemTime(new Date(Date.now() + 125_000));
        return {
          status: "success",
          summary: "completed after long runtime"
        };
      }
    });

    expect(result.policy).toEqual({
      mode: "audit",
      durationLimitMode: "none",
      hardPerJobTimeoutMs: null
    });
    expect(result.observations).toMatchObject([
      {
        jobName: "long-job",
        status: "success",
        summary: "completed after long runtime"
      }
    ]);
    expect(result.observations[0]?.timing.durationMs).toBe(125_000);
    expect(result.observations[0]?.timing.timer).toBe("02:05");
    expect(result.durationMs).toBe(125_000);
    expect(result.timer).toBe("02:05");
  });

  it("emits a cron-report-compatible benchmark report envelope", async () => {
    const result = await runBenchmarkInventory(
      [
        createJob({
          key: "fast-job",
          name: "fast-job",
          slotIndex: 540,
          sortOrder: 0,
          route: "/api/v1/db/fast-job"
        }),
        createJob({
          key: "skip-job",
          name: "sync-yahoo-players-to-sheet",
          slotIndex: 545,
          sortOrder: 1,
          route: "/api/internal/sync-yahoo-players-to-sheet"
        })
      ],
      {
        executeHttpJob: async (job) => {
          vi.setSystemTime(new Date(Date.now() + 271_000));
          return {
            status: "success",
            summary: job.name
          };
        }
      }
    );

    expect(result.report).toMatchObject({
      source: "benchmark_runner",
      counts: {
        totalJobs: 2,
        succeeded: 1,
        failed: 0,
        skipped: 1,
        slowJobs: 1,
        annotatedJobs: 1
      },
      observations: [
        expect.objectContaining({
          jobName: "fast-job",
          status: "success",
          benchmarkStatus: "success",
          durationMs: 271_000,
          optimizationDenotation: "OPTIMIZE",
          timing: expect.objectContaining({
            source: "benchmark_runner",
            timer: "04:31"
          })
        }),
        expect.objectContaining({
          jobName: "sync-yahoo-players-to-sheet",
          status: "unknown",
          benchmarkStatus: "skipped",
          executionAction: "mock_fallback",
          missingObservationWarnings: expect.arrayContaining([
            "Benchmark runner skipped full local/dev execution for this scheduled job."
          ])
        })
      ]
    });
  });

  it("normalizes individual observations into benchmark report digests", () => {
    const reportObservation = buildBenchmarkReportObservation({
      key: "skip-job",
      jobName: "skip-job",
      method: "GET",
      executionShape: "HTTP route",
      scheduleTimeDisplay: "03:00 UTC",
      route: "/api/skip-job",
      sqlText: null,
      status: "skipped",
      reason: "Skipped for local/dev safety",
      summary: null,
      timing: {
        startedAt: "2026-03-20T03:00:00.000Z",
        endedAt: "2026-03-20T03:00:02.000Z",
        durationMs: 2_000,
        timer: "00:02"
      },
      touchedSystems: ["supabase"],
      notes: ["Skipped for local/dev safety"],
      benchmarkAnnotations: [],
      canRunLocally: false,
      localRunPolicy: "skip",
      localRunReason: "Skipped for local/dev safety",
      executionAction: "skip"
    });

    expect(reportObservation).toMatchObject({
      status: "unknown",
      benchmarkStatus: "skipped",
      runTime: "2026-03-20T03:00:02.000Z",
      method: "GET",
      route: "/api/skip-job",
      reason: "Skipped for local/dev safety",
      timing: expect.objectContaining({
        source: "benchmark_runner"
      }),
      missingObservationWarnings: [
        "Benchmark runner skipped full local/dev execution for this scheduled job."
      ]
    });
  });
});
