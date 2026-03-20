import {
  getBenchmarkObservationMetadata,
  type BenchmarkLocalRunPolicy,
  type BenchmarkTouchedSystem
} from "lib/cron/benchmarkObservationMetadata";
import {
  getBenchmarkExecutionPolicy,
  type BenchmarkExecutionAction
} from "lib/cron/benchmarkExecutionPolicy";
import {
  isSlowJobDuration,
  SLOW_JOB_DENOTATION
} from "lib/cron/cronReportFlags";
import {
  buildCronJobTiming,
  type CronJobTimingContract,
  type CronJobTimingRecord
} from "lib/cron/timingContract";
import type { CronInventoryJob } from "lib/cron/cronInventory";
import type { BenchmarkAnnotation } from "lib/cron/benchmarkNotes";

export type BenchmarkRunStatus = "success" | "failure" | "skipped";
export type BenchmarkDurationLimitMode = "none";
export type BenchmarkReportStatus = "success" | "failure" | "unknown";

export type BenchmarkRunPolicy = {
  mode: "audit";
  durationLimitMode: BenchmarkDurationLimitMode;
  hardPerJobTimeoutMs: null;
};

export type BenchmarkRunResult<TSummary = unknown> = {
  status: BenchmarkRunStatus;
  summary?: TSummary;
  reason?: string;
  notes?: string[];
  touchedSystems?: BenchmarkTouchedSystem[];
};

export type BenchmarkRunObservation<TSummary = unknown> = {
  key: string;
  jobName: string;
  method: CronInventoryJob["method"];
  executionShape: CronInventoryJob["executionShape"];
  scheduleTimeDisplay: string;
  route: string | null;
  sqlText: string | null;
  status: BenchmarkRunStatus;
  reason: string | null;
  summary: TSummary | null;
  timing: CronJobTimingContract;
  touchedSystems: BenchmarkTouchedSystem[];
  notes: string[];
  benchmarkAnnotations: BenchmarkAnnotation[];
  canRunLocally: boolean;
  localRunPolicy: BenchmarkLocalRunPolicy;
  localRunReason: string | null;
  executionAction: BenchmarkExecutionAction;
};

export type BenchmarkRunSequence<TSummary = unknown> = {
  startedAt: string;
  endedAt: string;
  durationMs: number;
  timer: string;
  policy: BenchmarkRunPolicy;
  observations: BenchmarkRunObservation<TSummary>[];
  report: BenchmarkReportSequence<TSummary>;
};

export type BenchmarkReportObservation<TSummary = unknown> = {
  key: string;
  label: string;
  jobName: string;
  status: BenchmarkReportStatus;
  benchmarkStatus: BenchmarkRunStatus;
  runTime: string;
  runTimeDisplay: string;
  method: CronInventoryJob["method"] | null;
  route: string | null;
  statusCode: number | null;
  durationMs: number;
  rowsUpserted: number | null;
  rowsAffected: number | null;
  failedRows: number | null;
  reason: string | null;
  failedRowSamples: string[];
  optimizationDenotation: typeof SLOW_JOB_DENOTATION | null;
  benchmarkAnnotations: BenchmarkAnnotation[];
  missingObservationWarnings: string[];
  touchedSystems: BenchmarkTouchedSystem[];
  notes: string[];
  canRunLocally: boolean;
  localRunPolicy: BenchmarkLocalRunPolicy;
  localRunReason: string | null;
  executionAction: BenchmarkExecutionAction;
  summary: TSummary | null;
  timing: CronJobTimingRecord;
};

export type BenchmarkReportSequence<TSummary = unknown> = {
  source: "benchmark_runner";
  startedAt: string;
  endedAt: string;
  durationMs: number;
  timer: string;
  policy: BenchmarkRunPolicy;
  counts: {
    totalJobs: number;
    succeeded: number;
    failed: number;
    skipped: number;
    slowJobs: number;
    annotatedJobs: number;
  };
  observations: BenchmarkReportObservation<TSummary>[];
};

export type BenchmarkExecutor<TSummary = unknown> = {
  executeHttpJob?: (
    job: CronInventoryJob
  ) => Promise<BenchmarkRunResult<TSummary>>;
  executeSqlJob?: (
    job: CronInventoryJob
  ) => Promise<BenchmarkRunResult<TSummary>>;
  executePolicyJob?: (
    job: CronInventoryJob,
    action: BenchmarkExecutionAction
  ) => Promise<BenchmarkRunResult<TSummary>>;
  executeUnsupportedJob?: (
    job: CronInventoryJob
  ) =>
    | Promise<BenchmarkRunResult<TSummary>>
    | BenchmarkRunResult<TSummary>;
};

export const AUDIT_BENCHMARK_RUN_POLICY: BenchmarkRunPolicy = {
  mode: "audit",
  durationLimitMode: "none",
  hardPerJobTimeoutMs: null
};

function deriveDefaultSkipReason(job: CronInventoryJob): string {
  if (job.executionShape === "currently non-runnable in local/dev") {
    return job.notes[0] ?? "Scheduled job is currently non-runnable in local/dev.";
  }

  if (job.executionShape === "SQL-only") {
    return "No SQL benchmark executor configured.";
  }

  if (job.executionShape === "HTTP route") {
    return "No HTTP benchmark executor configured.";
  }

  return "No benchmark executor is configured for this job shape.";
}

function normalizeBenchmarkReportStatus(
  status: BenchmarkRunStatus
): BenchmarkReportStatus {
  switch (status) {
    case "success":
    case "failure":
      return status;
    default:
      return "unknown";
  }
}

export function buildBenchmarkReportObservation<TSummary = unknown>(
  observation: BenchmarkRunObservation<TSummary>
): BenchmarkReportObservation<TSummary> {
  const timing: CronJobTimingRecord = {
    ...observation.timing,
    source: "benchmark_runner"
  };
  const missingObservationWarnings: string[] =
    observation.status === "skipped"
      ? [
          "Benchmark runner skipped full local/dev execution for this scheduled job."
        ]
      : [];

  return {
    key: observation.key,
    label: observation.route ?? observation.jobName,
    jobName: observation.jobName,
    status: normalizeBenchmarkReportStatus(observation.status),
    benchmarkStatus: observation.status,
    runTime: timing.endedAt,
    runTimeDisplay: new Date(timing.endedAt).toLocaleString(),
    method: observation.method === "UNKNOWN" ? null : observation.method,
    route: observation.route ?? observation.sqlText,
    statusCode: null,
    durationMs: timing.durationMs,
    rowsUpserted: null,
    rowsAffected: null,
    failedRows: null,
    reason: observation.reason,
    failedRowSamples: [],
    optimizationDenotation: isSlowJobDuration(timing.durationMs)
      ? SLOW_JOB_DENOTATION
      : null,
    benchmarkAnnotations: observation.benchmarkAnnotations,
    missingObservationWarnings,
    touchedSystems: observation.touchedSystems,
    notes: observation.notes,
    canRunLocally: observation.canRunLocally,
    localRunPolicy: observation.localRunPolicy,
    localRunReason: observation.localRunReason,
    executionAction: observation.executionAction,
    summary: observation.summary,
    timing
  };
}

export function buildBenchmarkReportSequence<TSummary = unknown>(
  sequence: Omit<BenchmarkRunSequence<TSummary>, "report">
): BenchmarkReportSequence<TSummary> {
  const observations = sequence.observations.map((observation) =>
    buildBenchmarkReportObservation(observation)
  );

  return {
    source: "benchmark_runner",
    startedAt: sequence.startedAt,
    endedAt: sequence.endedAt,
    durationMs: sequence.durationMs,
    timer: sequence.timer,
    policy: sequence.policy,
    counts: {
      totalJobs: observations.length,
      succeeded: observations.filter(
        (observation) => observation.benchmarkStatus === "success"
      ).length,
      failed: observations.filter(
        (observation) => observation.benchmarkStatus === "failure"
      ).length,
      skipped: observations.filter(
        (observation) => observation.benchmarkStatus === "skipped"
      ).length,
      slowJobs: observations.filter(
        (observation) => observation.optimizationDenotation != null
      ).length,
      annotatedJobs: observations.filter(
        (observation) => observation.benchmarkAnnotations.length > 0
      ).length
    },
    observations
  };
}

export async function executeBenchmarkJob<TSummary = unknown>(
  job: CronInventoryJob,
  executor: BenchmarkExecutor<TSummary>
): Promise<BenchmarkRunResult<TSummary>> {
  const executionPolicy = getBenchmarkExecutionPolicy(job);

  if (executionPolicy.action !== "run") {
    if (executor.executePolicyJob) {
      return executor.executePolicyJob(job, executionPolicy.action);
    }

    return {
      status: "skipped",
      reason: executionPolicy.reason ?? deriveDefaultSkipReason(job),
      notes: executionPolicy.notes
    };
  }

  if (job.executionShape === "currently non-runnable in local/dev") {
    return {
      status: "skipped",
      reason: deriveDefaultSkipReason(job)
    };
  }

  if (job.executionShape === "SQL-only" || job.method === "SQL") {
    if (executor.executeSqlJob) {
      return executor.executeSqlJob(job);
    }

    return {
      status: "skipped",
      reason: deriveDefaultSkipReason(job)
    };
  }

  if (job.executionShape === "HTTP route" || job.method === "GET" || job.method === "POST") {
    if (executor.executeHttpJob) {
      return executor.executeHttpJob(job);
    }

    return {
      status: "skipped",
      reason: deriveDefaultSkipReason(job)
    };
  }

  if (executor.executeUnsupportedJob) {
    return executor.executeUnsupportedJob(job);
  }

  return {
    status: "skipped",
    reason: deriveDefaultSkipReason(job)
  };
}

export async function runBenchmarkInventory<TSummary = unknown>(
  jobs: CronInventoryJob[],
  executor: BenchmarkExecutor<TSummary>
): Promise<BenchmarkRunSequence<TSummary>> {
  return runBenchmarkChronologically(jobs, (job) =>
    executeBenchmarkJob(job, executor)
  );
}

export async function runBenchmarkChronologically<TSummary = unknown>(
  jobs: CronInventoryJob[],
  executeJob: (
    job: CronInventoryJob
  ) => Promise<BenchmarkRunResult<TSummary>>
): Promise<BenchmarkRunSequence<TSummary>> {
  const sequenceStartedAt = Date.now();
  const observations: BenchmarkRunObservation<TSummary>[] = [];

  const orderedJobs = [...jobs].sort((left, right) => {
    if (left.slotIndex !== right.slotIndex) {
      return left.slotIndex - right.slotIndex;
    }

    return left.sortOrder - right.sortOrder;
  });

  for (const job of orderedJobs) {
    const startedAt = Date.now();
    const result = await executeJob(job);
    const endedAt = Date.now();
    const metadata = getBenchmarkObservationMetadata(job);
    const executionPolicy = getBenchmarkExecutionPolicy(job);

    observations.push({
      ...metadata,
      key: job.key,
      jobName: job.name,
      method: job.method,
      executionShape: job.executionShape,
      scheduleTimeDisplay: job.scheduleTimeDisplay,
      route: job.route,
      sqlText: job.sqlText,
      status: result.status,
      reason: result.reason ?? null,
      summary: result.summary ?? null,
      timing: buildCronJobTiming(startedAt, endedAt),
      touchedSystems: Array.from(
        new Set([
          ...metadata.touchedSystems,
          ...(result.touchedSystems ?? [])
        ])
      ),
      notes: Array.from(
        new Set([
          ...metadata.notes,
          ...(result.notes ?? []),
          ...(result.reason ? [result.reason] : [])
        ].filter((entry) => Boolean(entry)))
      ),
      executionAction: executionPolicy.action
    });
  }

  const sequenceEndedAt = Date.now();
  const sequenceTiming = buildCronJobTiming(sequenceStartedAt, sequenceEndedAt);
  const baseSequence = {
    startedAt: sequenceTiming.startedAt,
    endedAt: sequenceTiming.endedAt,
    durationMs: sequenceTiming.durationMs,
    timer: sequenceTiming.timer,
    policy: AUDIT_BENCHMARK_RUN_POLICY,
    observations
  };

  return {
    ...baseSequence,
    report: buildBenchmarkReportSequence(baseSequence)
  };
}
