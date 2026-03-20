import {
  getBenchmarkAnnotations,
  type BenchmarkAnnotation
} from "lib/cron/benchmarkNotes";
import type { CronInventoryJob } from "lib/cron/cronInventory";
import { getNstTouchLevel } from "lib/cron/nstClassification";

export type BenchmarkTouchedSystem =
  | "supabase"
  | "local_database_functions"
  | "materialized_view"
  | "nst"
  | "external_api"
  | "nhl_api"
  | "yahoo_api"
  | "google_sheets"
  | "resend";

export type BenchmarkLocalRunPolicy = "safe" | "caution" | "skip";

export type BenchmarkObservationMetadata = {
  touchedSystems: BenchmarkTouchedSystem[];
  benchmarkAnnotations: BenchmarkAnnotation[];
  notes: string[];
  canRunLocally: boolean;
  localRunPolicy: BenchmarkLocalRunPolicy;
  localRunReason: string | null;
};

function uniqueSystems(
  systems: BenchmarkTouchedSystem[]
): BenchmarkTouchedSystem[] {
  return Array.from(new Set(systems));
}

export function getTouchedSystemsForJob(
  job: Pick<CronInventoryJob, "name" | "method">
): BenchmarkTouchedSystem[] {
  const touchedSystems: BenchmarkTouchedSystem[] = ["supabase"];

  if (job.method === "SQL") {
    touchedSystems.push("local_database_functions");
  }

  if (
    job.name.includes("refresh") ||
    job.name.includes("matview") ||
    job.name.includes("materialized")
  ) {
    touchedSystems.push("materialized_view");
  }

  switch (getNstTouchLevel(job.name)) {
    case "direct_remote_nst_fetch":
      touchedSystems.push("nst", "external_api");
      break;
    case "indirect_nst_derived":
      touchedSystems.push("nst");
      break;
    default:
      break;
  }

  if (
    job.name.includes("goalie-projections") ||
    job.name.includes("start-chart") ||
    job.name.includes("line-combinations") ||
    job.name.includes("power-play") ||
    job.name.includes("games") ||
    job.name.includes("teams") ||
    job.name.includes("players")
  ) {
    touchedSystems.push("nhl_api");
  }

  if (job.name.includes("yahoo")) {
    touchedSystems.push("yahoo_api");
  }

  if (job.name === "sync-yahoo-players-to-sheet") {
    touchedSystems.push("google_sheets");
  }

  if (job.name === "daily-cron-report") {
    touchedSystems.push("resend");
  }

  return uniqueSystems(touchedSystems);
}

export function getBenchmarkObservationMetadata(
  job: Pick<CronInventoryJob, "name" | "method" | "executionShape" | "notes">
): BenchmarkObservationMetadata {
  const benchmarkAnnotations = getBenchmarkAnnotations(job.name);
  const touchedSystems = getTouchedSystemsForJob(job);

  if (job.executionShape === "currently non-runnable in local/dev") {
    return {
      touchedSystems,
      benchmarkAnnotations,
      notes: [...job.notes, ...benchmarkAnnotations.map((entry) => entry.note)],
      canRunLocally: false,
      localRunPolicy: "skip",
      localRunReason:
        job.notes[0] ?? "Scheduled job is currently non-runnable in local/dev."
    };
  }

  if (
    benchmarkAnnotations.some(
      (annotation) =>
        annotation.kind === "side_effect" || annotation.kind === "special_handling"
    )
  ) {
    return {
      touchedSystems,
      benchmarkAnnotations,
      notes: benchmarkAnnotations.map((entry) => entry.note),
      canRunLocally: false,
      localRunPolicy: "skip",
      localRunReason:
        benchmarkAnnotations.find(
          (annotation) =>
            annotation.kind === "side_effect" ||
            annotation.kind === "special_handling"
        )?.note ?? "This job should not run blindly in local/dev."
    };
  }

  if (
    benchmarkAnnotations.some(
      (annotation) =>
        annotation.kind === "rate_limited" ||
        annotation.kind === "stateful" ||
        annotation.kind === "batch_loop"
    )
  ) {
    return {
      touchedSystems,
      benchmarkAnnotations,
      notes: benchmarkAnnotations.map((entry) => entry.note),
      canRunLocally: true,
      localRunPolicy: "caution",
      localRunReason:
        benchmarkAnnotations.find(
          (annotation) =>
            annotation.kind === "rate_limited" ||
            annotation.kind === "stateful" ||
            annotation.kind === "batch_loop"
        )?.note ?? "This job needs special audit handling."
    };
  }

  return {
    touchedSystems,
    benchmarkAnnotations,
    notes: [...job.notes, ...benchmarkAnnotations.map((entry) => entry.note)],
    canRunLocally: true,
    localRunPolicy: "safe",
    localRunReason: null
  };
}
