import vercelConfiguration from "../../vercel.json";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function rowCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

// These producers return counts from committed RPC receipts and post-write
// verification. Wrapper-inferred counts and arbitrary response counters do not
// establish successful database writes. Keep this list explicit and reviewed.
const INPUT_ROUTES = new Set(["/api/v1/db/update-PbP", "/api/v1/db/ingest-projection-inputs"]);
const RELATIONSHIP_ROUTES = new Set(["/api/v1/db/shift-charts", "/api/v1/db/update-shifts"]);
// These producers use failedRows for game/date/request-operation failures.
const OPERATION_ERROR_ROUTES = new Set([
  ...INPUT_ROUTES, "/api/v1/db/run-projection-accuracy",
  "/api/v1/db/refresh-draft-ranker-community", "/api/v1/db/draft-ranker-health",
  "/api/v1/db/refresh-draft-ranker-discovery",
]);
const VERIFIED_TS_ROUTES = new Set([
  ...INPUT_ROUTES, ...RELATIONSHIP_ROUTES,
  "/api/v1/db/run-projection-v2", "/api/v1/db/run-projection-accuracy",
  "/api/v1/db/cron-report", "/api/v1/db/build-projection-derived-v2",
  "/api/v1/db/run-rolling-forge-pipeline", "/api/v1/db/cron/update-stats-cron",
  "/api/v1/db/update-teams",
]);

export function reportedRuntimeBudgetMs(response: unknown, routePath: string | null): number | null {
  // This reviewed producer records an operation budget, not a platform limit.
  if (routePath !== "/api/v1/db/run-rolling-forge-pipeline") return null;
  let budget = object(object(response).runtimeBudget);
  if (typeof response === "string") {
    // The wrapper can truncate a large response after this complete early
    // member. Recover only that intact JSON object, never partial counters.
    const member = response.match(/"runtimeBudget"\s*:\s*(\{[^{}]{1,400}\})/);
    if (member) {
      try { budget = object(JSON.parse(member[1])); } catch { return null; }
    }
  }
  const value = rowCount(budget.budgetMs);
  return value != null && value > 0 ? value : null;
}

export function readReportMetrics(response: unknown, routePath: string | null) {
  const payload = object(response);
  const verified = rowCount(payload.rowsVerified);
  const declared = rowCount(payload.rowsUpserted);
  const input = INPUT_ROUTES.has(routePath ?? "");
  const relationship = RELATIONSHIP_ROUTES.has(routePath ?? "");
  const written = input ? declared : relationship ? rowCount(payload.rowsAffected) : null;
  const rowsUpserted = written != null && verified != null && verified >= written ? written : null;
  // Operation-unit receipts cannot establish a database error-row count.
  const operationErrors = OPERATION_ERROR_ROUTES.has(routePath ?? "");
  const failedOperations = operationErrors ? rowCount(payload.failedRows) : null;
  const failedRows = operationErrors ? null : rowCount(payload.failedRows) ?? rowCount(payload.rowsFailed) ?? rowCount(payload.failed_rows);
  return { rowsUpserted, failedRows, failedOperations };
}

export function repositoryExecutionLimitMs(routePath: string | null): number | null {
  if (!VERIFIED_TS_ROUTES.has(routePath ?? "")) return null;
  // This is the repository policy for these verified TS routes. It is not
  // proof of a deployed function override or a provider-wide default.
  return vercelConfiguration.functions["pages/api/**/*.ts"].maxDuration * 1000;
}

export function isNearRepositoryLimit(durationMs: number | null, limitMs: number | null): boolean {
  return durationMs != null && limitMs != null && durationMs >= limitMs * 0.9;
}

export function formatExecutionDuration(durationMs: number | null): string {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs < 0) return "Unknown";
  if (durationMs === 0) return "0s";
  if (durationMs < 1000) return "<1s";
  const seconds = Math.floor(durationMs / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
