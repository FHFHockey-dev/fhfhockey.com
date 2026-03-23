import type { CronInventoryJob } from "lib/cron/cronInventory";
import { getBenchmarkObservationMetadata } from "lib/cron/benchmarkObservationMetadata";

export type BenchmarkExecutionAction =
  | "run"
  | "skip"
  | "observe_only"
  | "mock_fallback";

export type BenchmarkExecutionPolicy = {
  action: BenchmarkExecutionAction;
  reason: string | null;
  notes: string[];
};

export function getBenchmarkExecutionPolicy(
  job: Pick<CronInventoryJob, "name" | "method" | "executionShape" | "notes">
): BenchmarkExecutionPolicy {
  const metadata = getBenchmarkObservationMetadata(job);

  if (job.executionShape === "currently non-runnable in local/dev") {
    return {
      action: "skip",
      reason:
        metadata.localRunReason ??
        "Scheduled job is currently non-runnable in local/dev.",
      notes: metadata.notes
    };
  }

  if (job.name === "daily-cron-report") {
    return {
      action: "observe_only",
      reason:
        metadata.localRunReason ??
        "Use production-safe observation or mocked email delivery for cron-report.",
      notes: metadata.notes
    };
  }

  if (job.name === "sync-yahoo-players-to-sheet") {
    return {
      action: "mock_fallback",
      reason:
        metadata.localRunReason ??
        "Use a mocked external side-effect adapter for Google Sheets writes.",
      notes: metadata.notes
    };
  }

  if (metadata.localRunPolicy === "skip") {
    return {
      action: "skip",
      reason: metadata.localRunReason,
      notes: metadata.notes
    };
  }

  return {
    action: "run",
    reason: metadata.localRunReason,
    notes: metadata.notes
  };
}
