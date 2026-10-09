import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

import { CronAuditEmail } from "components/CronReportEmail/CronAuditEmail";
import {
  getBenchmarkAnnotations,
  hasBenchmarkAnnotationKind,
  type BenchmarkAnnotation,
} from "lib/cron/benchmarkNotes";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  buildSlowJobWarning,
  SLOW_JOB_DENOTATION,
  type SlowJobWarning,
} from "lib/cron/cronReportFlags";
import { type CronJobTimingRecord } from "lib/cron/timingContract";
import { readReportSource, reportRowIdentity, formatReportTime, REPORT_PAGE_SIZE } from "lib/cron/reportSource";
import { extractAuditTimingRecord } from "lib/cron/cronReportTiming";
import { readReportMetrics, repositoryExecutionLimitMs, isNearRepositoryLimit, reportedRuntimeBudgetMs } from "lib/cron/reportMetrics";
import { buildSqlCronTimingObservation } from "lib/cron/sqlTiming";
import { readCronScheduleMarkdown } from "lib/cron/cronInventory";
import adminOnly from "utils/adminOnlyMiddleware";
import {
  assessYahooLifecycleHealth,
  type YahooLifecycleWarning,
} from "lib/integrations/yahoo/lifecycleHealth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

const REPORT_WINDOW_MS = 24 * 60 * 60 * 1000;
// Repository policy, not proof of a deployed override. Leave time after reads
// for assembly/rendering, email acceptance and the outer audit/response.
// These are reserved headroom, not independently enforced phase timeouts.
const REPORT_PHASE_RESERVES_MS = {
  assemblyAndRender: 20_000,
  emailDelivery: 20_000,
  auditAndResponse: 20_000,
};
const REPORT_REQUEST_TIMEOUT_MS = 15_000;
const SELF_AUDIT_WRITE_GRACE_MS = 5 * 60 * 1000;
const MATCH_WINDOW_MS = 30 * 60 * 1000;
const RECURRING_SLOT_GRACE_MS = 5 * 60 * 1000;
const MAX_UNSCHEDULED_ALERTS = 8;
const ROUTE_AUDIT_MISSING_WARNING =
  "Cron submission was recorded, but no route audit payload was recorded; route execution is unverified.";

const SCHEDULE_ALIAS_MAP: Record<string, string[]> = {
  "update-all-wgo-skaters": [
    "update-wgo-skaters",
    "/api/v1/db/update-wgo-skaters",
  ],
  "update-all-wgo-goalies": ["/api/v1/db/update-wgo-goalies"],
  "update-all-wgo-skater-totals": [
    "update-skater-totals",
    "/api/v1/db/update-wgo-totals",
  ],
  "update-shift-charts": [
    "/api/v1/db/shift-charts",
    "/api/v1/db/update-shifts",
  ],
  "update-yahoo-matchup-dates": ["/api/v1/db/update-yahoo-weeks"],
  "update-roster-optimizer-schedule": [
    "/api/v1/db/update-roster-optimizer-schedule",
  ],
  "update-line-combinations-all": ["/api/v1/db/update-line-combinations"],
  "update-lineup-deployment-tallies": [
    "/api/v1/db/update-lineup-deployment-tallies",
  ],
  "update-wgo-teams": ["run-fetch-wgo-data", "/api/v1/db/run-fetch-wgo-data"],
  "update-wigo-table-stats": [
    "calculate-wigo-stats",
    "/api/v1/db/calculate-wigo-stats",
  ],
  "update-nst-tables-all": ["/api/Teams/nst-team-stats"],
  "sync-yahoo-players-to-sheet": ["/api/internal/sync-yahoo-players-to-sheet"],
  "update-predictions-sko": ["/api/v1/ml/update-predictions-sko"],
  "update-nhl-xg-shot-features": ["/api/v1/db/update-nhl-xg-shot-features"],
  "update-nhl-xg-shot-predictions": [
    "/api/v1/db/update-nhl-xg-shot-predictions",
  ],
};

const ROUTE_TARGET_TABLE_MAP: Record<string, string> = {
  "/api/v1/db/update-teams": "teams",
  "/api/v1/db/update-seasons": "seasons",
  "/api/v1/db/update-players": "players, rosters",
  "/api/v1/db/update-games": "games",
  "/api/v1/db/update-roster-optimizer-schedule": "roster_optimizer_team_games",
  "/api/v1/db/update-yahoo-weeks": "yahoo_weeks",
  "/api/v1/db/update-nst-gamelog": "nst_* game logs",
  "/api/v1/db/update-wgo-skaters": "wgo_skater_stats",
  "/api/v1/db/update-wgo-goalies": "wgo_goalie_stats",
  "/api/v1/db/update-wgo-totals": "wgo_skater_stats_totals",
  "/api/v1/db/update-power-play-combinations": "powerPlayCombinations",
  "/api/v1/db/update-lineup-deployment-tallies":
    "player_lineup_deployment_tallies",
  "/api/v1/db/powerPlayTimeFrame": "powerPlayTimeFrame",
  "/api/v1/db/update-line-combinations": "lineCombinations",
  "/api/v1/db/update-team-yearly-summary": "team_yearly_summary",
  "/api/v1/db/update-standings-details": "standings_details",
  "/api/v1/db/update-wgo-goalie-totals": "wgo_goalie_stats_totals",
  "/api/v1/db/update-rolling-player-averages": "rolling_player_averages",
  "/api/v1/db/update-game-goal-projections": "expected_goals",
  "/api/v1/db/update-yahoo-players": "yahoo_players",
  "/api/Teams/nst-team-stats": "nst_team_stats",
  "/api/v1/db/update-nst-goalies": "nst_goalie_stats",
  "/api/v1/db/calculate-wigo-stats": "wigo_table_stats",
  "/api/internal/sync-yahoo-players-to-sheet": "external sheet sync",
  "/api/v1/db/update-team-ctpi-daily": "team_ctpi_daily",
  "/api/v1/db/update-team-sos": "team_sos",
  "/api/v1/db/update-team-power-ratings": "team_power_ratings_daily",
  "/api/v1/db/update-team-power-ratings-new": "team_power_ratings_daily",
  "/api/v1/db/run-fetch-wgo-data": "wgo_team_stats",
  "/api/v1/db/update-nhl-edge-stats": "nhl_edge_*",
  "/api/v1/db/update-goalie-projections-v2": "goalie_projections",
  "/api/v1/db/update-player-underlying-stats": "player_underlying_*",
  "/api/v1/db/update-player-trend-metrics": "player_trend_metrics",
  "/api/v1/db/ingest-projection-inputs": "projection_inputs",
  "/api/v1/db/build-projection-derived-v2": "projection_derived_*",
  "/api/v1/db/update-nst-team-daily": "nst_team_daily",
  "/api/v1/db/run-projection-v2": "projection_execution",
  "/api/v1/db/update-season-stats": "season_stats",
  "/api/v1/db/update-rolling-games": "rolling_games",
  "/api/v1/db/update-sko-stats": "sko_skater_stats",
  "/api/v1/db/update-wgo-averages": "wgo_averages",
  "/api/v1/db/sustainability/rebuild-baselines": "sustainability_baselines",
  "/api/v1/sustainability/rebuild-priors": "sustainability_priors",
  "/api/v1/sustainability/rebuild-window-z": "sustainability_window_z",
  "/api/v1/sustainability/rebuild-score": "sustainability_scores",
  "/api/v1/sustainability/rebuild-trend-bands": "sustainability_trend_bands",
  "/api/v1/ml/update-predictions-sko": "sko_predictions",
  "/api/v1/db/update-power-rankings": "legacy disabled",
  "/api/v1/db/run-projection-accuracy": "projection_accuracy",
  "/api/v1/game-predictions/forecast": "game_prediction_forecasts",
  "/api/v1/game-predictions/score": "game_prediction_scores",
  "/api/v1/db/update-PbP": "play_by_play",
};

type NormalizedStatus = "success" | "failure" | "unknown";
type ReportStatus = NormalizedStatus | "disabled";
type ReportJobStatus = ReportStatus | "missing";
type ScheduleMethod = "GET" | "POST" | "SQL" | "UNKNOWN";

type ScheduledCronJob = {
  jobid: number | null;
  key: string;
  name: string;
  displayName: string;
  cronExpression: string;
  scheduleTimeDisplay: string;
  method: ScheduleMethod;
  url: string | null;
  route: string | null;
  routePath: string | null;
  sqlText: string | null;
  expectedRunAt: string | null;
  sortOrder: number;
  aliases: string[];
};

type CronScheduleJsonEntry = {
  jobid?: number;
  jobname?: string;
  schedule?: string;
  run_time_utc?: string;
  active?: boolean;
  method?: ScheduleMethod;
  route?: string | null;
  url?: string | null;
};

type ParsedAuditDetails = {
  timing: CronJobTimingRecord | null;
  durationMs: number | null;
  statusCode: number | null;
  url: string | null;
  route: string | null;
  routePath: string | null;
  method: string | null;
  error: string | null;
  response: unknown;
  responseMessage: string | null;
  goalieRowsProcessed: number | null;
  skaterRowsProcessed: number | null;
  skaterFreshnessFailureCount: number;
  dataQualityWarningCount: number;
  rowsUpserted: number | null;
  failedRows: number | null;
  failedOperations: number | null;
  failedRowSamples: string[];
};

type AuditRow = {
  id: string;
  jobName: string;
  time: string;
  rowsAffected: number | null;
  rawStatus: unknown;
  status: NormalizedStatus;
  details: unknown;
  detailsMessage: string | null;
  parsed: ParsedAuditDetails;
};

type RunRow = {
  jobid: number | null;
  id: string;
  jobName: string;
  time: string;
  rawStatus: unknown;
  status: NormalizedStatus;
  returnMessage: string | null;
  sqlText: string | null;
  endTime: string | null;
  rowsAffected: number | null;
  timing: CronJobTimingRecord | null;
  durationMs: number | null;
  method: ScheduleMethod;
  url: string | null;
  route: string | null;
  routePath: string | null;
};

type JobSummary = {
  jobKey: string;
  jobName: string;
  displayName: string;
  lastStatus: ReportJobStatus;
  observedExecutionStatus: ReportJobStatus;
  lastStatusSource: "audit" | "cron" | "missing" | "unknown";
  scheduleTimeDisplay: string;
  expectedRunDisplay: string;
  lastRunDisplay: string;
  method: ScheduleMethod;
  route: string | null;
  routePath: string | null;
  targetTable: string | null;
  statusCode: number | null;
  message: string | null;
  why: string | null;
  note: string | null;
  runsCount: number;
  auditRunsCount: number;
  okCount24h: number;
  failCount24h: number;
  rowsUpsertedLast: number | null;
  rowsAffectedLast: number | null;
  failedRowsLast: number | null;
  failedOperations: number | null;
  repositoryLimitMs: number | null;
  timingProvenance: string;
  runtimeBudgetMs: number | null;
  failedRowSamples: string[];
  lastDurationMs: number | null;
  avgDurationMs: number | null;
  lastKnownSuccessDisplay: string | null;
  optimizationDenotation: typeof SLOW_JOB_DENOTATION | null;
  benchmarkAnnotations: BenchmarkAnnotation[];
  missingObservationWarnings: string[];
};

type RunDigest = {
  key: string;
  label: string;
  jobName: string;
  status: ReportStatus;
  runTime: string;
  runTimeDisplay: string;
  method: string | null;
  route: string | null;
  routePath: string | null;
  targetTable: string | null;
  statusCode: number | null;
  durationMs: number | null;
  rowsUpserted: number | null;
  rowsAffected: number | null;
  failedRows: number | null;
  failedOperations: number | null;
  repositoryLimitMs: number | null;
  timingProvenance: string;
  runtimeBudgetMs: number | null;
  observationKind?: "scheduled" | "extra";
  observedExecutionStatus?: ReportJobStatus;
  reason: string | null;
  lastKnownSuccessDisplay: string | null;
  failedRowSamples: string[];
  optimizationDenotation: typeof SLOW_JOB_DENOTATION | null;
  benchmarkAnnotations: BenchmarkAnnotation[];
  missingObservationWarnings: string[];
};

type ReportCounts = {
  scheduledJobs: number;
  scheduledJobsWithActivity: number;
  auditRuns: number;
  auditSuccesses: number;
  auditFailures: number;
  cronFailures: number;
  omittedFailureObservations: number;
  auditUnknown: number;
  auditDisabled: number;
  jobsOkLast: number;
  jobsFailingLast: number;
  jobsMissingLast: number;
  jobsUnknownLast: number;
  jobsDisabledLast: number;
  unscheduledRuns: number;
  totalRowsUpserted: number;
  totalFailedRows: number;
  warnSlow: number;
  warnPartialFailure: number;
  warnMissingAudit: number;
};

type WarningSummary = {
  slowMsThreshold: null;
  nearLimitFraction: number;
  limitEvidence: string;
  slowJobDenotation: typeof SLOW_JOB_DENOTATION;
  slowJobs: SlowJobWarning[];
  partialFailureJobs: Array<{ displayName: string; failedRows: number }>;
  missingObservationJobs: Array<{ displayName: string; warnings: string[] }>;
  yahooLifecycle: YahooLifecycleWarning[];
};

type BenchmarkSummary = {
  scope: string;
  annotatedJobCount: number;
  bottleneckJobs: Array<{ displayName: string; notes: string[] }>;
  missingObservationJobs: Array<{ displayName: string; warnings: string[] }>;
};

function normalizeStatus(value: unknown): NormalizedStatus {
  const v = String(value ?? "")
    .toLowerCase()
    .trim();
  if (!v) return "unknown";
  if (["success", "succeeded", "ok", "passed"].includes(v)) return "success";
  if (["failure", "failed", "error", "errored"].includes(v)) return "failure";
  return "unknown";
}

function isQuarantinedLegacyRoute(routePath: string | null): boolean {
  return (
    routePath === "/api/v1/db/update-rolling-games" ||
    routePath === "/api/v1/db/update-power-rankings"
  );
}

function skippedOperationWarning(row: AuditRow): string | null {
  const response = row.parsed.response;
  if (row.status === "success" && response && typeof response === "object" && !Array.isArray(response)) {
    const receipt = response as Record<string, unknown>;
    const result = receipt.result && typeof receipt.result === "object" ? receipt.result as Record<string, unknown> : receipt;
    if ((row.parsed.routePath === "/api/v1/db/cron/update-stats-cron" &&
          Array.isArray(receipt.attemptedGameIds) && receipt.attemptedGameIds.length === 0 &&
          Array.isArray(receipt.updatedGameIds) && receipt.updatedGameIds.length === 0) || receipt.outcome === "skipped" || receipt.skipped === true ||
        /^skipped|^no[_-]?op/.test(String(receipt.status ?? receipt.outcome ?? "")) ||
        (result.processedGames === 0 && typeof result.skippedGames === "number" && result.skippedGames >= 0) ||
        ((row.parsed.routePath === "/api/v1/db/shift-charts" || row.parsed.routePath === "/api/v1/db/update-shifts") &&
          Array.isArray(receipt.preseasonShiftSkips) && receipt.preseasonShiftSkips.length > 0 &&
          receipt.rowsAffected === 0 && receipt.rowsVerified === 0 && receipt.rowsPruned === 0 && receipt.idempotentGames === 0)) {
      return "Operation was skipped or produced no output; successful HTTP execution does not establish data refresh.";
    }
  }
  return null;
}

function incompleteYahooReceiptWarning(row: AuditRow): string | null {
  const response = row.parsed.response;
  if (row.status !== "success" || row.parsed.routePath !== "/api/v1/db/update-yahoo-players" ||
      !response || typeof response !== "object" || Array.isArray(response)) return null;
  const receipt = response as Record<string, unknown>;
  if (receipt.status !== "partial" && receipt.completeSnapshot !== false) return null;
  const notes = ["Yahoo coverage is partial; complete snapshot unverified."];
  if (typeof receipt.sourceRows === "number" && typeof receipt.succeeded === "number") {
    notes.push(`${receipt.succeeded}/${receipt.sourceRows} player rows succeeded.`);
  }
  if (typeof receipt.ownershipOmitted === "number") notes.push(`${receipt.ownershipOmitted} ownership rows omitted.`);
  if (typeof receipt.ownershipHistoryUpserted === "number") notes.push(`${receipt.ownershipHistoryUpserted} ownership history rows written.`);
  const sheetExport = receipt.sheetExport;
  if (sheetExport && typeof sheetExport === "object" && !Array.isArray(sheetExport)) {
    const exportReceipt = sheetExport as Record<string, unknown>;
    if (exportReceipt.attempted === false) {
      const reason = typeof exportReceipt.reason === "string" ? sanitizeErrorMessage(exportReceipt.reason, 120) : null;
      notes.push(`Sheet export was not attempted${reason ? ` (${reason})` : ""}.`);
    }
  }
  return notes.join(" ");
}

function classifyAuditStatus(row: AuditRow): ReportStatus {
  if (skippedOperationWarning(row) || incompleteYahooReceiptWarning(row)) return "unknown";
  return row.status === "failure" &&
    row.parsed.statusCode === 410 &&
    isQuarantinedLegacyRoute(row.parsed.routePath)
    ? "disabled"
    : row.status;
}

function classifyCronStatus(row: RunRow): ReportStatus {
  const message = row.returnMessage ?? "";
  return isQuarantinedLegacyRoute(row.routePath) &&
    /\b410\b|legacy[ -]+.*disabled|disabled.*legacy|gone/i.test(message)
    ? "disabled"
    : row.method !== "SQL" && row.status === "success" ? "unknown" : row.status;
}

function getQueryString(req: NextApiRequest, key: string): string | null {
  const value = req.query?.[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
}

function parseBooleanQueryFlag(value: string | null): boolean {
  if (!value) return false;
  return ["1", "true", "yes"].includes(value.trim().toLowerCase());
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function truncateText(value: string, maxLen = 180): string {
  return value.length <= maxLen ? value : `${value.slice(0, maxLen - 1)}…`;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeErrorMessage(value: unknown, maxLen = 240): string | null {
  if (value == null) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = normalizeWhitespace(raw);
  const isHtmlDocument =
    /<!doctype html/i.test(normalized) ||
    /<html[\s>]/i.test(normalized) ||
    /<head[\s>]/i.test(normalized) ||
    /<body[\s>]/i.test(normalized);

  if (!isHtmlDocument) {
    return truncateText(normalized, maxLen);
  }

  const title = raw.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
  const cloudflareCode =
    raw.match(/Error code\s*<\/span>\s*<span[^>]*>\s*(\d{3})/i)?.[1] ?? null;
  const titleCode =
    title?.match(/\|\s*(\d{3})\s*:\s*([^|]+)/)?.[1]?.trim() ?? null;
  const titleReason =
    title?.match(/\|\s*\d{3}\s*:\s*([^|]+)/)?.[1]?.trim() ?? null;
  const headingReason =
    raw
      .match(/<span class="inline-block">\s*([^<]+)\s*<\/span>/i)?.[1]
      ?.trim() ?? null;
  const host = title?.split("|")[0]?.trim() ?? null;
  const provider = /cloudflare/i.test(raw) ? "Cloudflare" : "upstream proxy";
  const code = cloudflareCode ?? titleCode;
  const reason = titleReason ?? headingReason ?? "HTML error response";

  return truncateText(
    [provider, code ? `${code}` : null, reason, host ? `from ${host}` : null]
      .filter((part): part is string => Boolean(part))
      .join(" "),
    maxLen
  );
}

function safeStringify(value: unknown, maxLen = 180): string | null {
  try {
    return truncateText(JSON.stringify(value), maxLen);
  } catch {
    return null;
  }
}

function parseJsonMaybe(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function extractPrimaryMessage(value: unknown, depth = 0): string | null {
  if (depth > 6) return null;
  if (typeof value === "string" && value.trim()) {
    const raw = value.trim();
    if (/^\{\s*"/.test(raw) || /^\[\s*(?:\{|"|\[)/.test(raw)) {
      const parsed = parseJsonMaybe(raw);
      if (typeof parsed !== "string") return extractPrimaryMessage(parsed, depth + 1);
      const state = raw.match(/"termination"\s*:\s*\{\s*"state"\s*:\s*"([a-z_]+)"/)?.[1];
      return `${state ? `Reported termination: ${state.replace(/_/g, " ")}. ` : ""}Audit response is truncated or malformed; root cause unavailable. Inspect execution logs.`;
    }
    return sanitizeErrorMessage(raw, 300);
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 10)) {
      const nested = extractPrimaryMessage(item, depth + 1);
      if (nested) return nested;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  // Prefer concrete failure containers over generic summaries. Do not scan
  // declarative pipeline/dependency metadata or successful stage messages.
  for (const key of ["error", "err", "cause", "errors", "failures", "failedRows", "failed_rows", "blockedReasons"]) {
    const nested = extractPrimaryMessage(obj[key], depth + 1);
    if (nested) return nested;
  }
  for (const key of ["results", "stages"]) {
    if (!Array.isArray(obj[key])) continue;
    for (const stage of obj[key].slice(0, 20)) {
      if (!stage || typeof stage !== "object") continue;
      if (stage.success !== false && !["failure", "failed", "blocked"].includes(stage.status) && !stage.error) continue;
      const nested = extractPrimaryMessage(stage, depth + 1);
      if (nested) return nested;
    }
  }
  for (const key of ["message", "reason", "detail", "details", "return_message", "returnMessage", "statusText", "response", "result", "preflight"]) {
    const nested = extractPrimaryMessage(obj[key], depth + 1);
    if (nested) return nested;
  }
  return null;
}

function extractDetailsMessage(details: unknown): string | null {
  const parsed = parseJsonMaybe(details);
  if (!parsed || typeof parsed !== "object") {
    return extractPrimaryMessage(parsed);
  }

  const obj = parsed as Record<string, unknown>;
  const fromResponse = extractPrimaryMessage(parseJsonMaybe(obj.response));
  return (
    extractPrimaryMessage(obj.error) ??
    extractPrimaryMessage(obj.message) ??
    fromResponse ??
    null
  );
}

function getDirectNumericField(
  value: unknown,
  keys: readonly string[]
): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  for (const key of keys) {
    const numeric = toFiniteNumber(obj[key]);
    if (numeric != null) return numeric;
  }
  return null;
}

function collectFailureEntries(value: unknown, limit = 10): unknown[] {
  const out: unknown[] = [];
  const failureKeys = new Set([
    "errors",
    "failures",
    "failedRows",
    "failed_rows",
    "rowFailures",
    "invalidRows",
    "invalid_rows",
  ]);

  const visit = (current: unknown) => {
    if (out.length >= limit || current == null) return;

    if (Array.isArray(current)) {
      for (const item of current) {
        if (out.length >= limit) break;
        if (item && typeof item === "object") {
          visit(item);
        }
      }
      return;
    }

    if (typeof current !== "object") return;
    const obj = current as Record<string, unknown>;
    for (const [key, nested] of Object.entries(obj)) {
      if (out.length >= limit) break;
      if (failureKeys.has(key) && Array.isArray(nested)) {
        for (const entry of nested) {
          out.push(entry);
          if (out.length >= limit) break;
        }
        continue;
      }
      if (nested && typeof nested === "object") {
        visit(nested);
      }
    }
  };

  visit(value);
  return out;
}

function formatFailureSample(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return sanitizeErrorMessage(value, 180);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value == null ? null : sanitizeErrorMessage(value, 180);
  }

  const obj = value as Record<string, unknown>;
  const parts: string[] = [];

  const addPart = (label: string, keys: string[]) => {
    for (const key of keys) {
      const raw = obj[key];
      if (raw == null) continue;
      const rendered = String(raw).trim();
      if (!rendered) continue;
      parts.push(`${label}: ${truncateText(rendered, 48)}`);
      return;
    }
  };

  addPart("date", ["date", "gameDate", "game_date", "date_scraped"]);
  addPart("player", ["playerId", "player_id"]);
  addPart("game", ["gameId", "game_id"]);
  addPart("team", ["teamId", "team_id"]);
  addPart("id", ["id"]);
  addPart("table", ["table", "tableName", "table_name"]);
  addPart("name", ["name", "fullName", "goalieFullName", "skaterFullName"]);
  addPart("url", ["url"]);

  const message = extractPrimaryMessage(obj);
  if (message && !parts.some((part) => part.includes(message))) {
    parts.push(message);
  }

  return parts.length > 0
    ? truncateText(parts.join(" | "), 200)
    : safeStringify(value, 200);
}

function countWarningEntries(response: unknown): number {
  if (!response || typeof response !== "object") return 0;

  if (Array.isArray(response)) {
    return response.reduce((acc, item) => acc + countWarningEntries(item), 0);
  }

  const obj = response as Record<string, unknown>;
  let total = 0;

  for (const [key, value] of Object.entries(obj)) {
    if (key === "warnings" || key === "dataQualityWarnings") {
      total += Array.isArray(value) ? value.length : 0;
      continue;
    }
    if (value && typeof value === "object") {
      total += countWarningEntries(value);
    }
  }

  return total;
}

function parseUrlPieces(rawUrl: string | null): {
  route: string | null;
  routePath: string | null;
} {
  if (!rawUrl) {
    return { route: null, routePath: null };
  }

  try {
    const parsed = new URL(rawUrl);
    return {
      route: `${parsed.pathname}${parsed.search}`,
      routePath: parsed.pathname,
    };
  } catch {
    return {
      route: rawUrl,
      routePath: rawUrl.split("?")[0] ?? rawUrl,
    };
  }
}

function inferTargetTable(
  routePath: string | null,
  jobName: string
): string | null {
  if (routePath && ROUTE_TARGET_TABLE_MAP[routePath]) {
    return ROUTE_TARGET_TABLE_MAP[routePath];
  }

  const normalizedJob = jobName.toLowerCase();
  if (normalizedJob.includes("matview")) return "materialized view";
  if (normalizedJob.includes("sustainability")) return "sustainability_*";
  if (normalizedJob.includes("projection")) return "projection_*";
  if (normalizedJob.includes("prediction")) return "game_prediction_*";
  if (normalizedJob.includes("nst")) return "nst_*";
  if (normalizedJob.includes("wgo")) return "wgo_*";
  if (normalizedJob.includes("yahoo")) return "yahoo_*";

  return null;
}

function parseAuditDetails(details: unknown): ParsedAuditDetails {
  const empty: ParsedAuditDetails = {
    timing: null,
    durationMs: null,
    statusCode: null,
    url: null,
    route: null,
    routePath: null,
    method: null,
    error: null,
    response: null,
    responseMessage: null,
    goalieRowsProcessed: null,
    skaterRowsProcessed: null,
    skaterFreshnessFailureCount: 0,
    dataQualityWarningCount: 0,
    rowsUpserted: null,
    failedRows: null,
    failedOperations: null,
    failedRowSamples: [],
  };

  if (!details) return empty;

  const parsedDetails = parseJsonMaybe(details);
  if (!parsedDetails || typeof parsedDetails !== "object") {
    return {
      ...empty,
      error: extractPrimaryMessage(parsedDetails),
      responseMessage: extractPrimaryMessage(parsedDetails),
    };
  }

  const obj = parsedDetails as Record<string, unknown>;
  const response = parseJsonMaybe(obj.response);
  const timing = extractAuditTimingRecord(parsedDetails);
  const { route, routePath } = parseUrlPieces(
    typeof obj.url === "string" ? obj.url : null
  );
  const goalieRowsProcessed = getDirectNumericField(response, [
    "goalieRowsProcessed",
  ]);
  const skaterRowsProcessed = getDirectNumericField(response, [
    "skaterRowsProcessed",
  ]);
  const skaterFreshnessFailureCount =
    getDirectNumericField(response, ["skaterFreshnessFailureCount"]) ?? 0;
  const failedRowSamples = collectFailureEntries(response)
    .map((entry) => formatFailureSample(entry))
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, 3);
  const metrics = readReportMetrics(response, routePath);

  return {
    timing,
    durationMs: timing?.durationMs ?? toFiniteNumber(obj.durationMs),
    statusCode: toFiniteNumber(obj.statusCode),
    url: typeof obj.url === "string" ? obj.url : null,
    route,
    routePath,
    method: typeof obj.method === "string" ? obj.method.toUpperCase() : null,
    error: extractPrimaryMessage(obj.error),
    response,
    responseMessage: extractPrimaryMessage(response),
    goalieRowsProcessed,
    skaterRowsProcessed,
    skaterFreshnessFailureCount,
    dataQualityWarningCount: countWarningEntries(response),
    ...metrics,
    failedRowSamples,
  };
}

function parseRowsAffectedFromReturnMessage(
  returnMessage: string | null
): number | null {
  if (!returnMessage) return null;

  const toNumber = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const msg = String(returnMessage);
  const insertMatch = msg.match(/INSERT\s+\d+\s+(\d+)/i);
  if (insertMatch?.[1]) return toNumber(insertMatch[1]);

  const updateMatch = msg.match(/UPDATE\s+(\d+)/i);
  if (updateMatch?.[1]) return toNumber(updateMatch[1]);

  const deleteMatch = msg.match(/DELETE\s+(\d+)/i);
  if (deleteMatch?.[1]) return toNumber(deleteMatch[1]);

  const selectMatch = msg.match(/SELECT\s+(\d+)/i);
  if (selectMatch?.[1]) return toNumber(selectMatch[1]);

  const copyMatch = msg.match(/COPY\s+(\d+)/i);
  if (copyMatch?.[1]) return toNumber(copyMatch[1]);

  const rowWordMatch = msg.match(/(\d+)\s+row(s)?\b/i);
  if (rowWordMatch?.[1]) return toNumber(rowWordMatch[1]);

  return null;
}

function parseCronInvocation(sqlText: string | null): {
  method: ScheduleMethod;
  url: string | null;
  route: string | null;
  routePath: string | null;
} {
  if (!sqlText) {
    return { method: "UNKNOWN", url: null, route: null, routePath: null };
  }

  const methodMatch = sqlText.match(/net\.http_(get|post)\s*\(/i);
  const method = methodMatch
    ? methodMatch[1].toUpperCase() === "POST"
      ? "POST"
      : "GET"
    : "SQL";

  const urlMatch = sqlText.match(/url\s*:?=\s*'([^']+)'/i);
  const url = urlMatch?.[1] ?? null;
  const { route, routePath } = parseUrlPieces(url);

  return {
    method,
    url,
    route,
    routePath,
  };
}

function formatScheduleTime(cronExpression: string): string {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length < 2) return cronExpression;

  const minute = Number(parts[0]);
  const hour = Number(parts[1]);
  if (!Number.isInteger(minute) || !Number.isInteger(hour)) {
    return cronExpression;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} UTC`;
}

function expectedRunAtWithinWindow(
  cronExpression: string,
  since: Date,
  now: Date
): string | null {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length < 2) return null;

  const minute = Number(parts[0]);
  const hour = Number(parts[1]);
  if (!Number.isInteger(minute) || !Number.isInteger(hour)) return null;

  const candidate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hour,
      minute,
      0,
      0
    )
  );

  if (candidate.getTime() > now.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() - 1);
  }

  return candidate.getTime() >= since.getTime()
    ? candidate.toISOString()
    : null;
}

function parseScheduleJsonEntries(markdown: string): CronScheduleJsonEntry[] {
  const codeFenceMatch = markdown.match(/```json\s*([\s\S]*?)\s*```/i);
  if (!codeFenceMatch?.[1]) {
    return [];
  }

  try {
    const parsed = JSON.parse(codeFenceMatch[1]);
    return Array.isArray(parsed) ? (parsed as CronScheduleJsonEntry[]) : [];
  } catch {
    return [];
  }
}

async function loadScheduledCronJobs(
  since: Date,
  now: Date
): Promise<ScheduledCronJob[]> {
  const markdown = await readCronScheduleMarkdown();
  const activeMarkdown =
    markdown.split(/^# NEED TO ADD:?$/m)[0] ??
    markdown.split(/^# STATIC CRON SNIPPETS TO ADD$/m)[0] ??
    markdown;
  const normalized = activeMarkdown
    .split("\n")
    .map((line) => line.replace(/^\s*--\s?/, ""))
    .join("\n");

  const matches = Array.from(
    normalized.matchAll(
      /SELECT\s+cron\.schedule\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*([\s\S]*?)\);\s*/gi
    )
  );

  const sqlDefinitions = matches.map((match, index) => {
    const name = match[1]?.trim() ?? "";
    const cronExpression = match[2]?.trim() ?? "";
    const body = match[3]?.trim() ?? "";
    const invocation = parseCronInvocation(body);
    const scheduleTimeDisplay = formatScheduleTime(cronExpression);
    const expectedRunAt = expectedRunAtWithinWindow(cronExpression, since, now);
    const sqlText =
      invocation.method === "SQL"
        ? truncateText(body.replace(/\s+/g, " ").trim(), 180)
        : null;

    return {
      jobid: null,
      key: `${name}__${cronExpression}__${invocation.method}__${index}`,
      name,
      cronExpression,
      scheduleTimeDisplay,
      method: invocation.method,
      url: invocation.url,
      route: invocation.route,
      routePath: invocation.routePath,
      sqlText,
      expectedRunAt,
      sortOrder: index,
    };
  });

  const jsonJobs = parseScheduleJsonEntries(markdown)
    .filter((entry) => entry.active)
    .map((entry, index) => {
      const name = String(entry.jobname ?? "").trim();
      const cronExpression = String(entry.schedule ?? "").trim();
      const entryRoute = typeof entry.route === "string" ? entry.route : null;
      const entryUrl = typeof entry.url === "string" ? entry.url : entryRoute;
      const entryInvocation = parseUrlPieces(entryUrl);
      const entryMethod =
        entry.method === "GET" ||
        entry.method === "POST" ||
        entry.method === "SQL"
          ? entry.method
          : null;
      const definition =
        sqlDefinitions.find(
          (candidate) =>
            candidate.name === name &&
            candidate.cronExpression === cronExpression
        ) ??
        sqlDefinitions.find((candidate) => candidate.name === name) ??
        null;

      return {
        jobid: entry.jobid ?? null,
        key: definition?.key ?? `${name}__${cronExpression}__json__${index}`,
        name,
        cronExpression,
        scheduleTimeDisplay: formatScheduleTime(cronExpression),
        method: entryMethod ?? definition?.method ?? "UNKNOWN",
        url: entryUrl ?? definition?.url ?? null,
        route: entryInvocation.route ?? definition?.route ?? null,
        routePath: entryInvocation.routePath ?? definition?.routePath ?? null,
        sqlText: definition?.sqlText ?? null,
        expectedRunAt: expectedRunAtWithinWindow(cronExpression, since, now),
        sortOrder: index,
      };
    })
    .filter((job) => job.name && job.cronExpression);

  const rawJobs = jsonJobs.length > 0 ? jsonJobs : sqlDefinitions;

  const dedupedJobs = rawJobs.filter((job, index, jobs) => {
    const signature = [
      job.name,
      job.cronExpression,
      job.method,
      job.route ?? "",
      job.url ?? "",
      job.sqlText ?? "",
    ].join("::");
    return (
      index ===
      jobs.findIndex(
        (candidate) =>
          [
            candidate.name,
            candidate.cronExpression,
            candidate.method,
            candidate.route ?? "",
            candidate.url ?? "",
            candidate.sqlText ?? "",
          ].join("::") === signature
      )
    );
  });

  const duplicateCounts = dedupedJobs.reduce(
    (acc, job) => acc.set(job.name, (acc.get(job.name) ?? 0) + 1),
    new Map<string, number>()
  );

  return dedupedJobs.map((job) => {
    const displayName =
      (duplicateCounts.get(job.name) ?? 0) > 1
        ? `${job.name} [${job.method} ${job.scheduleTimeDisplay}]`
        : job.name;

    return {
      ...job,
      displayName,
      aliases: Array.from(
        new Set(
          [
            job.name,
            job.route,
            job.routePath,
            job.url,
            ...(SCHEDULE_ALIAS_MAP[job.name] ?? []),
          ].filter((value): value is string => Boolean(value))
        )
      ),
    };
  });
}

function candidateMatchesSchedule(
  job: ScheduledCronJob,
  candidate: {
    jobid?: number | null;
    jobName: string;
    time: string;
    method: string | null;
    route: string | null;
    routePath: string | null;
  }
): boolean {
  const aliases = new Set(
    [candidate.jobName, candidate.route, candidate.routePath].filter(
      (value): value is string => Boolean(value)
    )
  );

  const aliasMatch = job.aliases.some((alias) => aliases.has(alias));
  if (!aliasMatch && !(candidate.jobid != null && candidate.jobid === job.jobid)) return false;

  // Query parameters identify operations sharing a path (forecast horizons,
  // recurring count-limited lines versus the daily all operation).
  if (job.route && candidate.route && job.routePath === candidate.routePath &&
      canonicalRoute(job.route) !== canonicalRoute(candidate.route)) return false;

  const candidateMethod = candidate.method?.toUpperCase() ?? null;
  if (
    job.method !== "SQL" &&
    candidateMethod &&
    candidateMethod !== "UNKNOWN" &&
    candidateMethod !== job.method &&
    // A legacy GET scheduler may be converted to POST by an audited route
    // wrapper. Preserve that one-way compatibility, but never let a GET
    // probe replace a scheduled POST writer result.
    !(job.method === "GET" && candidateMethod === "POST")
  ) {
    // A direct probe can reuse the scheduled job name while using a
    // different method (for example, an unauthorized GET against a POST
    // writer). The method contract remains authoritative even when the name
    // matches exactly; otherwise the probe would replace the real scheduled
    // result in the daily report.
    return false;
  }

  if (!job.expectedRunAt) return true;
  const candidateTime = Date.parse(candidate.time);
  const expectedTime = Date.parse(job.expectedRunAt);
  if (!Number.isFinite(candidateTime) || !Number.isFinite(expectedTime)) {
    return false;
  }

  return Math.abs(candidateTime - expectedTime) <= MATCH_WINDOW_MS;
}

function canonicalRoute(route: string): string {
  const url = new URL(route, "https://report.invalid");
  url.searchParams.sort();
  return `${url.pathname}${url.search}`;
}

function cronTimeFieldMatches(expression: string, value: number): boolean {
  return expression.split(",").some((part) => {
    const [range, stepText] = part.split("/");
    const step = stepText ? Number(stepText) : 1;
    const [start, end] = range === "*" ? [0, Infinity] : range.split("-").map(Number);
    return step > 0 && value >= start && value <= (end ?? start) && (value - start) % step === 0;
  });
}

function recurringSlotMatches(job: ScheduledCronJob, slot: number): boolean {
  const [minutes, hours] = job.cronExpression.split(/\s+/);
  const date = new Date(slot);
  return cronTimeFieldMatches(minutes, date.getUTCMinutes()) && cronTimeFieldMatches(hours, date.getUTCHours());
}

function latestRequiredRecurringSlot(job: ScheduledCronJob, since: Date, until: Date): string | null {
  // Slots have five minutes for route completion/audit insertion before they
  // become required observations. Historical successes cannot fill later slots.
  for (let slot = Math.floor((until.getTime() - RECURRING_SLOT_GRACE_MS) / 60_000) * 60_000;
       slot >= since.getTime(); slot -= 60_000) {
    if (recurringSlotMatches(job, slot)) return new Date(slot).toISOString();
  }
  return null;
}

function closestRecurringSlot(job: ScheduledCronJob, time: string, since: Date, until: Date): string | null {
  const timeMs = Date.parse(time);
  let closest: number | null = null;
  for (let minute = Math.ceil((timeMs - MATCH_WINDOW_MS) / 60_000); minute <= Math.floor((timeMs + MATCH_WINDOW_MS) / 60_000); minute++) {
    const slot = minute * 60_000;
    if (slot < since.getTime() || slot > until.getTime()) continue;
    if (recurringSlotMatches(job, slot) &&
        (closest == null || Math.abs(slot - timeMs) < Math.abs(closest - timeMs))) closest = slot;
  }
  return closest == null ? null : new Date(closest).toISOString();
}

function assignObservations(jobs: ScheduledCronJob[], rows: Array<{
  id: string; jobid?: number | null; jobName: string; time: string;
  method: string | null; route: string | null; routePath: string | null;
}>, since: Date, until: Date): Map<string, string> {
  const assignments = new Map<string, string>();
  const edges = rows.flatMap((row) => {
    const knownOwner = jobs.some((job) => job.name === row.jobName ||
      (row.jobid != null && job.jobid === row.jobid));
    return jobs.filter((job) => {
      if (row.jobid != null && job.jobid != null && row.jobid !== job.jobid) return false;
      if (knownOwner && job.name !== row.jobName && !(row.jobid != null && job.jobid === row.jobid)) return false;
      return candidateMatchesSchedule(job, row);
    }).flatMap((job) => {
      const slot = job.expectedRunAt ?? closestRecurringSlot(job, row.time, since, until);
      if (!slot) return [];
      return [{
        row, job, slot,
        rank: row.jobid != null && job.jobid === row.jobid ? 0
          : job.name === row.jobName ? 1
            : job.route && row.route && canonicalRoute(job.route) === canonicalRoute(row.route) ? 2 : 3,
        distance: Math.abs(Date.parse(row.time) - Date.parse(slot)),
      }];
    });
  }).sort((a, b) => a.rank - b.rank || a.distance - b.distance ||
    a.slot.localeCompare(b.slot) || a.job.key.localeCompare(b.job.key) || a.row.id.localeCompare(b.row.id));
  const occupiedSlots = new Set<string>();
  for (const edge of edges) {
    const slotKey = `${edge.job.key}:${edge.slot}`;
    if (assignments.has(edge.row.id) || occupiedSlots.has(slotKey)) continue;
    assignments.set(edge.row.id, edge.job.key);
    occupiedSlots.add(slotKey);
  }
  return assignments;
}

function statusSortValue(status: ReportJobStatus): number {
  switch (status) {
    case "failure":
      return 0;
    case "missing":
      return 1;
    case "unknown":
      return 2;
    case "disabled":
      return 3;
    default:
      return 4;
  }
}

function auditTimingProvenance(parsed: ParsedAuditDetails): string {
  if (!parsed.timing) return parsed.durationMs == null ? "Unknown; no execution timing receipt" : "Legacy audit duration; measurement scope unverified";
  switch (parsed.timing.source) {
    case "response": return "Handler-reported timing receipt";
    case "audit": return "Route audit timing receipt";
    case "sql_runner": return "SQL execution timing receipt";
    case "benchmark_runner": return "Benchmark timing observation";
    default: return "Timing receipt; measurement scope unverified";
  }
}

function cronTimingProvenance(row: RunRow): string {
  if (row.method === "SQL") return row.timing ? "SQL execution timing receipt" : "Unknown; no SQL execution timing receipt";
  return row.method === "UNKNOWN" ? "Unknown; invocation measurement scope unverified" : "HTTP submission only; route completion unverified";
}

function buildRunDigestFromAudit(
  row: AuditRow,
  lastKnownSuccessDisplay: string | null = null
): RunDigest {
  const benchmarkAnnotations = getBenchmarkAnnotations(row.jobName);
  const optimizationDenotation = isNearRepositoryLimit(row.parsed.durationMs, repositoryExecutionLimitMs(row.parsed.routePath))
    ? SLOW_JOB_DENOTATION
    : null;
  const missingObservationWarnings =
    row.parsed.durationMs == null
      ? ["Observed audit run does not have reliable timing metadata yet."]
      : [];
  if (skippedOperationWarning(row)) missingObservationWarnings.push(skippedOperationWarning(row)!);
  if (incompleteYahooReceiptWarning(row)) missingObservationWarnings.push(incompleteYahooReceiptWarning(row)!);

  return {
    key: row.id,
    label: row.parsed.route ?? row.jobName,
    jobName: row.jobName,
    status: classifyAuditStatus(row),
    runTime: row.time,
    runTimeDisplay: formatReportTime(row.time),
    method: row.parsed.method,
    route: row.parsed.route,
    routePath: row.parsed.routePath,
    targetTable: inferTargetTable(row.parsed.routePath, row.jobName),
    statusCode: row.parsed.statusCode,
    durationMs: row.parsed.durationMs,
    rowsUpserted: row.parsed.rowsUpserted,
    rowsAffected: row.rowsAffected,
    failedRows: row.parsed.failedRows,
    failedOperations: row.parsed.failedOperations,
    repositoryLimitMs: repositoryExecutionLimitMs(row.parsed.routePath),
    timingProvenance: auditTimingProvenance(row.parsed),
    runtimeBudgetMs: reportedRuntimeBudgetMs(row.parsed.response, row.parsed.routePath),
    observationKind: "extra",
    reason:
      row.parsed.error ??
      row.parsed.responseMessage ??
      row.detailsMessage ??
      null,
    lastKnownSuccessDisplay,
    failedRowSamples: row.parsed.failedRowSamples,
    optimizationDenotation,
    benchmarkAnnotations,
    missingObservationWarnings,
  };
}

function buildRunDigestFromCron(
  row: RunRow,
  lastKnownSuccessDisplay: string | null = null
): RunDigest {
  const benchmarkAnnotations = getBenchmarkAnnotations(row.jobName);
  const optimizationDenotation = isNearRepositoryLimit(row.durationMs, repositoryExecutionLimitMs(row.routePath))
    ? SLOW_JOB_DENOTATION
    : null;
  const missingObservationWarnings =
    row.durationMs == null
      ? ["Observed cron run does not have reliable timing metadata yet."]
      : [];

  return {
    key: row.id,
    label: row.route ?? row.jobName,
    jobName: row.jobName,
    status: classifyCronStatus(row),
    runTime: row.time,
    runTimeDisplay: formatReportTime(row.time),
    method: row.method === "UNKNOWN" ? null : row.method,
    route: row.route,
    routePath: row.routePath,
    targetTable: inferTargetTable(row.routePath, row.jobName),
    statusCode: null,
    durationMs: row.durationMs,
    rowsUpserted: null,
    rowsAffected: row.rowsAffected,
    failedRows: null,
    failedOperations: null,
    repositoryLimitMs: repositoryExecutionLimitMs(row.routePath),
    timingProvenance: cronTimingProvenance(row),
    runtimeBudgetMs: null,
    observationKind: "extra",
    reason: row.returnMessage
      ? sanitizeErrorMessage(row.returnMessage, 240)
      : null,
    lastKnownSuccessDisplay,
    failedRowSamples: [],
    optimizationDenotation,
    benchmarkAnnotations,
    missingObservationWarnings,
  };
}

function auditSuccessKey(candidate: {
  jobName: string;
  routePath: string | null;
  route: string | null;
}): string {
  return candidate.route ? `route:${canonicalRoute(candidate.route)}` : `name:${candidate.jobName}`;
}

function buildLastKnownSuccessMap(auditRows: AuditRow[]): Map<string, string> {
  const successes = auditRows
    .filter((row) => classifyAuditStatus(row) === "success")
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  const result = new Map<string, string>();

  for (const row of successes) {
    const display = formatReportTime(row.time);
    const key = auditSuccessKey({ jobName: row.jobName, route: row.parsed.route, routePath: row.parsed.routePath });
    if (!result.has(key)) result.set(key, display);
  }

  return result;
}

function findLastKnownSuccessDisplay(
  successMap: Map<string, string>,
  candidate: {
    jobName: string;
    route: string | null;
    routePath: string | null;
  }
): string | null {
  return successMap.get(auditSuccessKey(candidate)) ?? null;
}

function compactUnscheduledRuns(runs: RunDigest[]): RunDigest[] {
  const seen = new Set<string>();
  const alerts: RunDigest[] = [];

  const severity: Record<ReportStatus, number> = { failure: 0, disabled: 1, unknown: 2, success: 3 };
  const ranked = [...runs].sort((a, b) => severity[a.status] - severity[b.status] ||
    Date.parse(b.runTime) - Date.parse(a.runTime) || a.key.localeCompare(b.key));
  for (const run of ranked) {
    if (run.status === "success") continue;
    const key = `${run.method ?? "UNKNOWN"}:${run.route ? canonicalRoute(run.route) : run.jobName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    alerts.push(run);
    if (alerts.length >= MAX_UNSCHEDULED_ALERTS) break;
  }

  return alerts;
}

function collectMissingObservationWarnings(job: {
  jobName: string;
  lastStatus: ReportJobStatus;
  runsCount: number;
  auditRunsCount: number;
  method: ScheduleMethod;
  lastDurationMs: number | null;
  hasObservedSqlTiming: boolean;
  runDataAvailable: boolean;
  auditDataAvailable: boolean;
  latestRunTime: string | null;
  auditGapGraceStartedAt: string | null;
  observationTime: string;
}): string[] {
  const warnings: string[] = [];
  const latestRunMs = job.latestRunTime ? Date.parse(job.latestRunTime) : null;
  const auditGapGraceMs = job.auditGapGraceStartedAt
    ? Date.parse(job.auditGapGraceStartedAt)
    : null;
  const awaitingPostGraceRun =
    latestRunMs != null &&
    auditGapGraceMs != null &&
    Number.isFinite(latestRunMs) &&
    Number.isFinite(auditGapGraceMs) &&
    latestRunMs < auditGapGraceMs;
  const observationMs = Date.parse(job.observationTime);
  const awaitingCurrentReportSelfAudit =
    job.jobName === "daily-cron-report" &&
    latestRunMs != null &&
    Number.isFinite(latestRunMs) &&
    Number.isFinite(observationMs) &&
    observationMs >= latestRunMs &&
    observationMs - latestRunMs <= SELF_AUDIT_WRITE_GRACE_MS;

  if (job.lastStatus === "missing") {
    warnings.push("No cron or audit observation matched this scheduled slot.");
  }

  if (
    job.runsCount > 0 &&
    job.auditRunsCount === 0 &&
    job.method !== "SQL" &&
    job.auditDataAvailable &&
    !awaitingPostGraceRun &&
    !awaitingCurrentReportSelfAudit
  ) {
    warnings.push(ROUTE_AUDIT_MISSING_WARNING);
  }

  if (job.lastStatus !== "missing" && job.lastDurationMs == null && !awaitingCurrentReportSelfAudit && !awaitingPostGraceRun) {
    const hasObservedRuns =
      job.runsCount > 0 || (job.method !== "SQL" && job.auditRunsCount > 0);
    if (hasObservedRuns) {
      warnings.push("Observed run does not have reliable timing metadata yet.");
    }
  }

  if (job.method === "SQL" && job.runsCount > 0 && !job.hasObservedSqlTiming) {
    warnings.push(
      "SQL observation is missing scheduled_time or end_time timing fields."
    );
  }

  if (job.method === "SQL" && !job.runDataAvailable) {
    warnings.push(
      "Cron run telemetry is unavailable for SQL schedule matching."
    );
  }

  if (
    job.method !== "SQL" &&
    (!job.runDataAvailable || !job.auditDataAvailable)
  ) {
    const unavailableSources = [
      !job.runDataAvailable ? "cron_job_report" : null,
      !job.auditDataAvailable ? "cron_job_audit" : null,
    ]
      .filter((source): source is string => Boolean(source))
      .join(" and ");
    warnings.push(`Telemetry source unavailable: ${unavailableSources}.`);
  }

  return warnings;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const now = new Date();
  const repositoryLimitMs = repositoryExecutionLimitMs("/api/v1/db/cron-report");
  const sourceBudgetMs = Math.max(0, (repositoryLimitMs ?? 0) -
    Object.values(REPORT_PHASE_RESERVES_MS).reduce((sum, reserve) => sum + reserve, 0));
  const sourceDeadlineAt = now.getTime() + sourceBudgetMs;
  const sourceOptions = { deadlineAt: sourceDeadlineAt, requestTimeoutMs: REPORT_REQUEST_TIMEOUT_MS };
  const sinceDate = new Date(now.getTime() - REPORT_WINDOW_MS);
  const since = sinceDate.toISOString();
  const until = now.toISOString();
  const emailRecipient = process.env.CRON_REPORT_EMAIL_RECIPIENT!;
  const previewMode = getQueryString(req, "preview") === "json";
  const dryRun =
    previewMode || parseBooleanQueryFlag(getQueryString(req, "dryRun"));

  let jobRunDetailsEmailResult: any = null;
  let auditEmailResult: any = null;
  const errors: string[] = [];

  const runSource = await readReportSource<any>((from, to, signal) => supabase
    .from("cron_job_report")
    .select("jobid, runid, jobname, scheduled_time, status, return_message, end_time, sql_text", { count: "exact" })
    .gte("scheduled_time", since).lte("scheduled_time", until)
    .order("scheduled_time", { ascending: true }).order("runid", { ascending: true })
    .range(from, to).abortSignal(signal),
    (row) => String(row.runid), REPORT_PAGE_SIZE, 40, sourceBudgetMs, sourceOptions);
  const auditSource = await readReportSource<any>((from, to, signal) => supabase
    .from("cron_job_audit")
    .select("job_name, run_time, rows_affected, status, details", { count: "exact" })
    .gte("run_time", since).lte("run_time", until)
    .order("run_time", { ascending: true }).order("job_name", { ascending: true })
    .order("status", { ascending: true }).order("rows_affected", { ascending: true })
    .order("details", { ascending: true }).range(from, to)
    .abortSignal(signal), reportRowIdentity, REPORT_PAGE_SIZE, 40, sourceBudgetMs, sourceOptions);
  const sourceElapsedMs = Date.now() - now.getTime();
  const runs = runSource.rows;
  const audits = auditSource.rows;
  const runErr = runSource.error;
  const auditErr = auditSource.error;
  for (const [name, source] of [["cron_job_report", runSource], ["cron_job_audit", auditSource]] as const) {
    if (!source.complete) errors.push(`Incomplete ${name}: ${sanitizeErrorMessage(source.error) ?? "Unknown source error"}. ${source.rows.length} observations retained; totals unknown.`);
  }

  let scheduledJobs: ScheduledCronJob[] = [];
  try {
    scheduledJobs = await loadScheduledCronJobs(sinceDate, now);
  } catch (error: any) {
    console.error("Error loading cron schedule:", error?.message ?? error);
    return res.status(500).json({
      success: false,
      code: "CRON_SCHEDULE_INVENTORY_UNAVAILABLE",
      message:
        "Cron schedule inventory is unavailable; report generation failed closed.",
    });
  }

  if (scheduledJobs.length === 0) {
    console.error("Cron schedule inventory contains zero active jobs.");
    return res.status(500).json({
      success: false,
      code: "CRON_SCHEDULE_INVENTORY_EMPTY",
      message:
        "Cron schedule inventory contains zero active jobs; report generation failed closed.",
    });
  }

  const auditRows: AuditRow[] = audits.map((row: any) => ({
    id: `audit:${reportRowIdentity(row)}`,
    jobName: String(row.job_name ?? ""),
    time: String(row.run_time ?? ""),
    rowsAffected: (row.rows_affected ?? null) as number | null,
    rawStatus: row.status,
    status: normalizeStatus(row.status),
    details: row.details,
    detailsMessage: extractDetailsMessage(row.details),
    parsed: parseAuditDetails(row.details),
  }));
  const lastKnownSuccessMap = buildLastKnownSuccessMap(auditRows);
  const auditGapGraceStartedAt =
    auditRows
      .filter((row) => row.jobName === "daily-cron-report")
      .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))[0]?.time ?? null;

  const runRows: RunRow[] = (runs ?? []).map((row: any) => {
    const invocation = parseCronInvocation(
      (row.sql_text ?? null) as string | null
    );
    const timing = invocation.method === "SQL" ? buildSqlCronTimingObservation({
      jobname: (row.jobname ?? null) as string | null,
      scheduled_time: (row.scheduled_time ?? null) as string | null,
      end_time: (row.end_time ?? null) as string | null,
      status: row.status,
      return_message: (row.return_message ?? null) as string | null,
      sql_text: (row.sql_text ?? null) as string | null,
    }).timing : null;
    return {
      id: `run:${row.runid}`,
      jobid: row.jobid ?? null,
      jobName: String(row.jobname ?? ""),
      time: String(row.scheduled_time ?? ""),
      rawStatus: row.status,
      status: normalizeStatus(row.status),
      returnMessage: (row.return_message ?? null) as string | null,
      sqlText: (row.sql_text ?? null) as string | null,
      endTime: (row.end_time ?? null) as string | null,
      rowsAffected: parseRowsAffectedFromReturnMessage(
        (row.return_message ?? null) as string | null
      ),
      timing,
      durationMs: timing?.durationMs ?? null,
      method: invocation.method,
      url: invocation.url,
      route: invocation.route,
      routePath: invocation.routePath,
    };
  });

  const matchedAuditIds = new Set<string>();
  const matchedRunIds = new Set<string>();
  const reportedAuditIds = new Set<string>();
  const reportedRunIds = new Set<string>();
  const runDataAvailable = runSource.complete;
  const auditDataAvailable = auditSource.complete;
  const auditAssignments = assignObservations(scheduledJobs, auditRows.map((row) => ({
    ...row, method: row.parsed.method, route: row.parsed.route, routePath: row.parsed.routePath,
    time: row.parsed.timing?.startedAt ?? row.time,
  })), sinceDate, now);
  const runAssignments = assignObservations(scheduledJobs, runRows, sinceDate, now);

  const jobSummaries: JobSummary[] = scheduledJobs
    .map((job) => {
      const matchingAudits = auditRows.filter((row) => auditAssignments.get(row.id) === job.key)
        .sort((a, b) => Date.parse(b.time) - Date.parse(a.time) || a.id.localeCompare(b.id));
      const matchingRuns = runRows.filter((row) => runAssignments.get(row.id) === job.key)
        .sort((a, b) => Date.parse(b.time) - Date.parse(a.time) || a.id.localeCompare(b.id));

      matchingAudits.forEach((row) => matchedAuditIds.add(row.id));
      matchingRuns.forEach((row) => matchedRunIds.add(row.id));

      const requiredSlot = job.expectedRunAt ?? latestRequiredRecurringSlot(job, sinceDate, now);
      const currentAudits = job.expectedRunAt ? matchingAudits : matchingAudits.filter((row) =>
        closestRecurringSlot(job, row.parsed.timing?.startedAt ?? row.time, sinceDate, now) === requiredSlot);
      const currentRuns = job.expectedRunAt ? matchingRuns : matchingRuns.filter((row) =>
        closestRecurringSlot(job, row.time, sinceDate, now) === requiredSlot);
      const lastAudit = currentAudits[0] ?? null;
      const lastRun = currentRuns[0] ?? null;
      if (lastAudit) reportedAuditIds.add(lastAudit.id);
      if (lastRun) reportedRunIds.add(lastRun.id);
      const lastAuditTs = lastAudit ? Date.parse(lastAudit.time) : -Infinity;
      const lastRunTs = lastRun ? Date.parse(lastRun.time) : -Infinity;
      const preferAudit = lastAuditTs >= lastRunTs;
      const hasFullCoverageForMissing =
        job.method === "SQL"
          ? runDataAvailable
          : runDataAvailable && auditDataAvailable;

      const rawLastStatus: NormalizedStatus | "missing" =
        !lastAudit && !lastRun
          ? hasFullCoverageForMissing
            ? "missing"
            : "unknown"
          : preferAudit
            ? (lastAudit?.status ?? "unknown")
            : (lastRun?.status ?? "unknown");
      const observedStatus: ReportJobStatus =
        lastAudit && preferAudit ? classifyAuditStatus(lastAudit)
          : lastRun ? classifyCronStatus(lastRun) : rawLastStatus;
      // A SQL HTTP receipt proves submission only; partial reads cannot prove
      // the latest success. Keep known failures/disabled receipts visible.
      const lastStatus: ReportJobStatus =
        observedStatus === "failure" || observedStatus === "disabled" ? observedStatus
          : !hasFullCoverageForMissing || (!lastAudit && job.method !== "SQL" && lastRun)
            ? "unknown" : observedStatus;

      const lastStatusSource: JobSummary["lastStatusSource"] =
        !lastAudit && !lastRun
          ? hasFullCoverageForMissing
            ? "missing"
            : "unknown"
          : preferAudit
            ? "audit"
            : "cron";

      const durations = matchingAudits
        .map((row) => row.parsed.durationMs)
        .filter((value): value is number => typeof value === "number");
      const fallbackDurations = matchingRuns
        .map((row) => row.durationMs)
        .filter((value): value is number => typeof value === "number");
      const avgDurationMs =
        durations.length > 0
          ? Math.round(
              durations.reduce((acc, value) => acc + value, 0) /
                durations.length
            )
          : fallbackDurations.length > 0
            ? Math.round(
                fallbackDurations.reduce((acc, value) => acc + value, 0) /
                  fallbackDurations.length
              )
            : null;

      const okCount24h =
        matchingAudits.length > 0
          ? matchingAudits.filter((row) => row.status === "success").length
          : matchingRuns.filter((row) => row.status === "success").length;
      const failCount24h =
        matchingAudits.length > 0
          ? matchingAudits.filter((row) => row.status === "failure").length
          : matchingRuns.filter((row) => row.status === "failure").length;

      const rowsUpsertedLast = lastAudit?.parsed.rowsUpserted ?? null;
      const rowsAffectedLast =
        lastAudit?.rowsAffected ??
        (job.method === "SQL" ? lastRun?.rowsAffected : null) ??
        null;
      const failedRowsLast = lastAudit?.parsed.failedRows ?? null;
      const failedOperations = lastAudit?.parsed.failedOperations ?? null;
      const repositoryLimitMs = repositoryExecutionLimitMs(job.routePath);
      const runtimeBudgetMs = reportedRuntimeBudgetMs(lastAudit?.parsed.response, job.routePath);
      const timingProvenance = lastAudit ? auditTimingProvenance(lastAudit.parsed)
        : lastRun ? cronTimingProvenance(lastRun) : "Unknown; no execution timing receipt";
      const failedRowSamples = lastAudit?.parsed.failedRowSamples ?? [];
      const route = job.route ?? job.sqlText;
      const routePath = job.routePath;
      const lastKnownSuccessDisplay = findLastKnownSuccessDisplay(
        lastKnownSuccessMap,
        {
          jobName: job.name,
          route: job.route,
          routePath,
        }
      );

      const message =
        lastAudit?.parsed.responseMessage ??
        lastAudit?.detailsMessage ??
        (lastRun?.returnMessage
          ? sanitizeErrorMessage(lastRun.returnMessage, 240)
          : null) ??
        null;

      const why =
        lastStatus === "failure"
          ? (lastAudit?.parsed.error ??
            lastAudit?.parsed.responseMessage ??
            lastAudit?.detailsMessage ??
            (lastRun?.returnMessage
              ? sanitizeErrorMessage(lastRun.returnMessage, 240)
              : null) ??
            "Run failed")
          : null;

      const lastDurationMs =
        lastAudit?.parsed.durationMs ?? lastRun?.durationMs ?? null;
      const optimizationDenotation = isNearRepositoryLimit(lastDurationMs, repositoryLimitMs)
        ? SLOW_JOB_DENOTATION
        : null;
      const benchmarkAnnotations = getBenchmarkAnnotations(job.name);
      const missingObservationWarnings = collectMissingObservationWarnings({
        jobName: job.name,
        lastStatus,
        runsCount: currentRuns.length,
        auditRunsCount: currentAudits.length,
        method: job.method,
        lastDurationMs,
        hasObservedSqlTiming: currentRuns.some((row) => row.timing != null),
        runDataAvailable,
        auditDataAvailable,
        latestRunTime: lastRun?.time ?? null,
        auditGapGraceStartedAt,
        observationTime: now.toISOString(),
      });

      const notes: string[] = [];
      if (!job.expectedRunAt && requiredSlot && !lastAudit && !lastRun) {
        notes.push(`Latest required recurring slot ${formatReportTime(requiredSlot)} has no observation after the five-minute completion grace.`);
      }
      const noOutputWarning = lastAudit ? skippedOperationWarning(lastAudit) : null;
      if (noOutputWarning) {
        notes.push(noOutputWarning);
        missingObservationWarnings.push(noOutputWarning);
      }
      const incompleteYahooWarning = lastAudit ? incompleteYahooReceiptWarning(lastAudit) : null;
      if (incompleteYahooWarning) {
        notes.push(incompleteYahooWarning);
        missingObservationWarnings.push(incompleteYahooWarning);
      }
      if (lastStatus === "missing") {
        notes.push("No cron or audit entry matched this scheduled slot.");
      }
      if (lastStatus === "disabled") {
        notes.push(
          "Quarantined legacy route returned HTTP 410; remove its stale scheduler reference before route retirement."
        );
      }
      if (
        matchingRuns.length > 0 &&
        matchingAudits.length === 0 &&
        job.method !== "SQL" &&
        auditDataAvailable &&
        missingObservationWarnings.includes(ROUTE_AUDIT_MISSING_WARNING)
      ) {
        notes.push(ROUTE_AUDIT_MISSING_WARNING);
      }
      if (!lastAudit && !lastRun && !hasFullCoverageForMissing) {
        notes.push(
          "Telemetry is incomplete, so missing-run status could not be determined."
        );
      }
      if (lastStatus === "success" && (failedRowsLast ?? 0) > 0) {
        notes.push(`Completed with ${failedRowsLast} row-level failures.`);
      }
      if ((lastAudit?.parsed.dataQualityWarningCount ?? 0) > 0) {
        notes.push(
          `Returned ${lastAudit?.parsed.dataQualityWarningCount} warning(s).`
        );
      }
      if ((lastAudit?.parsed.skaterFreshnessFailureCount ?? 0) > 0) {
        notes.push(
          `FORGE skater freshness has ${lastAudit?.parsed.skaterFreshnessFailureCount} blocking gate(s).`
        );
      }
      if (
        lastAudit?.parsed.routePath === "/api/v1/db/run-projection-v2" &&
        (lastAudit.parsed.skaterRowsProcessed ?? 0) === 0
      ) {
        notes.push("FORGE projection execution returned zero skater rows.");
      }
      if (optimizationDenotation) {
        notes.push(`${optimizationDenotation}: recorded elapsed reached 90% of the repository route limit (${repositoryLimitMs == null ? "unknown" : repositoryLimitMs / 1000 + "s"}); deployed override unverified.`);
      }
      if (
        job.method === "SQL" &&
        lastRun?.returnMessage &&
        lastStatus !== "failure"
      ) {
        const sanitizedReturnMessage = sanitizeErrorMessage(
          lastRun.returnMessage,
          140
        );
        if (sanitizedReturnMessage) {
          notes.push(sanitizedReturnMessage);
        }
      }

      return {
        jobKey: job.key,
        jobName: job.name,
        displayName: job.displayName,
        lastStatus,
        observedExecutionStatus: observedStatus,
        lastStatusSource,
        scheduleTimeDisplay: job.scheduleTimeDisplay,
        expectedRunDisplay: requiredSlot
          ? formatReportTime(requiredSlot)
          : job.scheduleTimeDisplay,
        lastRunDisplay:
          matchingAudits[0]?.time || matchingRuns[0]?.time
            ? formatReportTime(matchingAudits[0]?.time ?? matchingRuns[0]?.time ?? "")
            : "—",
        method: job.method,
        route,
        routePath,
        targetTable: inferTargetTable(routePath, job.name),
        statusCode: lastAudit?.parsed.statusCode ?? null,
        message,
        why,
        note: notes.length > 0 ? notes.join(" ") : null,
        runsCount: matchingRuns.length,
        auditRunsCount: matchingAudits.length,
        okCount24h,
        failCount24h,
        rowsUpsertedLast,
        rowsAffectedLast,
        failedRowsLast,
        failedOperations,
        repositoryLimitMs,
        timingProvenance,
        runtimeBudgetMs,
        failedRowSamples,
        lastDurationMs,
        avgDurationMs,
        lastKnownSuccessDisplay,
        optimizationDenotation,
        benchmarkAnnotations,
        missingObservationWarnings,
      };
    })
    .sort((a, b) => {
      const statusDiff =
        statusSortValue(a.lastStatus) - statusSortValue(b.lastStatus);
      if (statusDiff !== 0) return statusDiff;
      const scheduleA =
        scheduledJobs.find((job) => job.key === a.jobKey)?.sortOrder ?? 0;
      const scheduleB =
        scheduledJobs.find((job) => job.key === b.jobKey)?.sortOrder ?? 0;
      return scheduleA - scheduleB;
    });

  const failureHighlights = jobSummaries.filter(
    (job) => job.lastStatus === "failure"
  );
  const missingJobs = jobSummaries.filter(
    (job) => job.lastStatus === "missing"
  );

  const unmatchedAuditRuns = auditRows
    .filter((row) => !matchedAuditIds.has(row.id))
    .map((row) =>
      buildRunDigestFromAudit(
        row,
        findLastKnownSuccessDisplay(lastKnownSuccessMap, {
          jobName: row.jobName,
          route: row.parsed.route,
          routePath: row.parsed.routePath,
        })
      )
    );
  const unmatchedCronRuns = runRows
    .filter((row) => !matchedRunIds.has(row.id))
    .map((row) =>
      buildRunDigestFromCron(
        row,
        findLastKnownSuccessDisplay(lastKnownSuccessMap, {
          jobName: row.jobName,
          route: row.route,
          routePath: row.routePath,
        })
      )
    );
  const unscheduledRuns = [...unmatchedAuditRuns, ...unmatchedCronRuns].sort(
    (a, b) => Date.parse(b.runTime) - Date.parse(a.runTime)
  );
  const historicalFailures = [
    ...auditRows.filter((row) => matchedAuditIds.has(row.id) && !reportedAuditIds.has(row.id) && classifyAuditStatus(row) === "failure")
      .map((row) => buildRunDigestFromAudit(row)),
    ...runRows.filter((row) => matchedRunIds.has(row.id) && !reportedRunIds.has(row.id) && classifyCronStatus(row) === "failure")
      .map((row) => buildRunDigestFromCron(row)),
  ];
  const notableUnscheduledRuns = compactUnscheduledRuns([...unscheduledRuns, ...historicalFailures]);

  const auditRunDigests = auditRows
    .map((row) =>
      buildRunDigestFromAudit(
        row,
        findLastKnownSuccessDisplay(lastKnownSuccessMap, {
          jobName: row.jobName,
          route: row.parsed.route,
          routePath: row.parsed.routePath,
        })
      )
    )
    .sort((a, b) => Date.parse(b.runTime) - Date.parse(a.runTime));
  const auditBriefings = jobSummaries.map(
    (job) =>
      ({
        key: job.jobKey,
        label: job.route ?? job.displayName,
        jobName: job.displayName,
        status: job.lastStatus === "missing" ? "unknown" : job.lastStatus,
        runTime: job.lastRunDisplay,
        runTimeDisplay: job.lastRunDisplay,
        method: job.method === "UNKNOWN" ? null : job.method,
        route: job.route,
        routePath: job.routePath,
        targetTable: job.targetTable,
        statusCode: job.statusCode,
        durationMs: job.lastDurationMs,
        rowsUpserted: job.rowsUpsertedLast,
        rowsAffected: job.rowsAffectedLast,
        failedRows: job.failedRowsLast,
        failedOperations: job.failedOperations,
        repositoryLimitMs: job.repositoryLimitMs,
        timingProvenance: job.timingProvenance,
        runtimeBudgetMs: job.runtimeBudgetMs,
        observationKind: "scheduled",
        observedExecutionStatus: job.observedExecutionStatus,
        reason: job.why ?? job.note,
        lastKnownSuccessDisplay: job.lastKnownSuccessDisplay,
        failedRowSamples: job.failedRowSamples,
        optimizationDenotation: job.optimizationDenotation,
        benchmarkAnnotations: job.benchmarkAnnotations,
        missingObservationWarnings: job.missingObservationWarnings,
      }) satisfies RunDigest
  );

  const WARN_SLOW: SlowJobWarning[] = jobSummaries
    .filter((job) => isNearRepositoryLimit(job.lastDurationMs, job.repositoryLimitMs))
    .map((job) =>
      ({ ...buildSlowJobWarning(job.displayName, job.lastDurationMs ?? 0),
        repositoryLimitMs: job.repositoryLimitMs,
        timingProvenance: job.timingProvenance,
        runtimeBudgetMs: job.runtimeBudgetMs, thresholdMs: (job.repositoryLimitMs ?? 0) * 0.9 })
    );

  const WARN_PARTIAL_FAILURE = jobSummaries
    .filter(
      (job) => job.lastStatus === "success" && (job.failedRowsLast ?? 0) > 0
    )
    .map((job) => ({
      displayName: job.displayName,
      failedRows: job.failedRowsLast ?? 0,
    }));

  const WARN_MISSING_AUDIT = jobSummaries
    .filter(
      (job) =>
        job.lastStatus !== "missing" &&
        job.runsCount > 0 &&
        job.auditRunsCount === 0 &&
        job.method !== "SQL" &&
        auditDataAvailable &&
        job.missingObservationWarnings.includes(ROUTE_AUDIT_MISSING_WARNING)
    )
    .map((job) => job.displayName);

  const missingObservationJobs = jobSummaries
    .filter((job) => job.missingObservationWarnings.length > 0)
    .map((job) => ({
      displayName: job.displayName,
      warnings: job.missingObservationWarnings,
    }));
  const yahooLifecycle = assessYahooLifecycleHealth({
    observations: auditRows
      .filter(
        (row) =>
          row.parsed.routePath === "/api/v1/db/update-yahoo-players" ||
          row.jobName === "update-yahoo-players"
      )
      .map((row) => ({
        time: row.time,
        status: row.status,
        response: row.parsed.response,
      })),
    nowMs: now.getTime(),
  });

  const benchmarkSummary: BenchmarkSummary = {
    scope: "Historical static annotations; undated and not evidence of this window's execution status",
    annotatedJobCount: jobSummaries.filter(
      (job) => job.benchmarkAnnotations.length > 0
    ).length,
    bottleneckJobs: jobSummaries
      .filter((job) =>
        hasBenchmarkAnnotationKind(job.benchmarkAnnotations, "bottleneck")
      )
      .map((job) => ({
        displayName: job.displayName,
        notes: job.benchmarkAnnotations
          .filter((annotation) => annotation.kind === "bottleneck")
          .map((annotation) => annotation.note),
      })),
    missingObservationJobs,
  };

  const warningSummary: WarningSummary = {
    slowMsThreshold: null,
    nearLimitFraction: 0.9,
    limitEvidence: "Repository route policy; deployed overrides unverified",
    slowJobDenotation: SLOW_JOB_DENOTATION,
    slowJobs: WARN_SLOW,
    partialFailureJobs: WARN_PARTIAL_FAILURE,
    missingObservationJobs,
    yahooLifecycle,
  };

  const counts: ReportCounts = {
    scheduledJobs: scheduledJobs.length,
    scheduledJobsWithActivity: jobSummaries.filter(
      (job) => job.runsCount > 0 || job.auditRunsCount > 0
    ).length,
    auditRuns: auditRows.length,
    auditSuccesses: auditRows.filter(
      (row) => classifyAuditStatus(row) === "success"
    ).length,
    auditFailures: auditRows.filter(
      (row) => classifyAuditStatus(row) === "failure"
    ).length,
    cronFailures: runRows.filter((row) => classifyCronStatus(row) === "failure").length,
    omittedFailureObservations: Math.max(0,
      auditRows.filter((row) => classifyAuditStatus(row) === "failure").length +
      runRows.filter((row) => classifyCronStatus(row) === "failure").length -
      [...auditBriefings, ...notableUnscheduledRuns].filter((row) => row.status === "failure").length),
    auditUnknown: auditRows.filter(
      (row) => classifyAuditStatus(row) === "unknown"
    ).length,
    auditDisabled: auditRows.filter(
      (row) => classifyAuditStatus(row) === "disabled"
    ).length,
    jobsOkLast: jobSummaries.filter((job) => job.lastStatus === "success")
      .length,
    jobsFailingLast: jobSummaries.filter((job) => job.lastStatus === "failure")
      .length,
    jobsMissingLast: jobSummaries.filter((job) => job.lastStatus === "missing")
      .length,
    jobsUnknownLast: jobSummaries.filter((job) => job.lastStatus === "unknown")
      .length,
    jobsDisabledLast: jobSummaries.filter(
      (job) => job.lastStatus === "disabled"
    ).length,
    unscheduledRuns: unscheduledRuns.length,
    totalRowsUpserted: jobSummaries.reduce(
      (acc, job) => acc + (job.rowsUpsertedLast ?? 0),
      0
    ),
    totalFailedRows: jobSummaries.reduce(
      (acc, job) => acc + (job.failedRowsLast ?? 0),
      0
    ),
    warnSlow: WARN_SLOW.length,
    warnPartialFailure: WARN_PARTIAL_FAILURE.length,
    warnMissingAudit: WARN_MISSING_AUDIT.length,
  };

  const shouldRenderCronReport =
    auditRows.length > 0 ||
    scheduledJobs.length > 0 ||
    runRows.length > 0 ||
    auditErr ||
    runErr;

  if (dryRun) {
    auditEmailResult = {
      success: true,
      dryRun: true,
      message: previewMode
        ? "Preview JSON generated without sending email."
        : "Dry run completed without sending email.",
    };
    jobRunDetailsEmailResult = {
      success: true,
      suppressed: true,
      dryRun: true,
      message:
        "Dedicated job-status email suppressed; the CEO briefing is the single daily cron report.",
    };
  } else if (shouldRenderCronReport) {
    try {
      const { data, error } = await resend.emails.send({
        from: "audit-report@fhfhockey.com",
        to: emailRecipient,
        subject:
          (auditErr || runErr)
            ? "⚠️ Daily Cron Report — incomplete telemetry; totals unknown"
            : counts.jobsFailingLast > 0 || counts.jobsMissingLast > 0
              ? `❌ Daily Cron Report — ${counts.jobsFailingLast} failing, ${counts.jobsMissingLast} missing`
              : counts.auditFailures + counts.cronFailures > 0
                ? `❌ Daily Cron Report — ${counts.auditFailures + counts.cronFailures} observed execution failure receipts`
              : counts.jobsUnknownLast > 0
                ? `⚠️ Daily Cron Report — ${counts.jobsUnknownLast} unknown`
                : counts.jobsDisabledLast > 0
                  ? `⚠️ Daily Cron Report — ${counts.jobsDisabledLast} quarantined`
                  : `✅ Daily Cron Report — ${counts.jobsOkLast}/${counts.scheduledJobs} jobs ok`,
        react: CronAuditEmail({
          audits: [...auditBriefings, ...notableUnscheduledRuns],
          sinceDate: since,
          untilDate: until,
          totalsComplete: runSource.complete && auditSource.complete,
          fetchErrors: errors,
          summary: {
            scheduledJobs: counts.scheduledJobs,
            jobsOkLast: counts.jobsOkLast,
            jobsFailingLast: counts.jobsFailingLast,
            jobsMissingLast: counts.jobsMissingLast,
            jobsUnknownLast: counts.jobsUnknownLast,
            childObservations: unscheduledRuns.length,
            metricErrorsKnown: auditBriefings.filter((row) => row.failedRows != null).length,
            metricRowsKnown: auditBriefings.filter((row) => row.rowsUpserted != null).length,
            auditRuns: counts.auditRuns,
            auditSuccesses: counts.auditSuccesses,
            auditFailures: counts.auditFailures,
            cronFailures: counts.cronFailures,
            omittedFailureObservations: counts.omittedFailureObservations,
            auditUnknown: counts.auditUnknown,
            auditDisabled: counts.auditDisabled,
            slowJobDenotation: SLOW_JOB_DENOTATION,
            slowMsThreshold: null,
            annotatedJobCount: auditRunDigests.filter(
              (audit) => audit.benchmarkAnnotations.length > 0
            ).length,
            slowRuns: auditRunDigests.filter(
              (audit) => audit.optimizationDenotation != null
            ).length,
            missingObservationRuns: auditBriefings.filter(
              (audit) => audit.missingObservationWarnings.length > 0
            ).length,
            totalRowsUpserted: auditBriefings.reduce(
              (acc, audit) =>
                acc + (audit.rowsUpserted ?? 0),
              0
            ),
            totalFailedRows: auditBriefings.reduce(
              (acc, audit) => acc + (audit.failedRows ?? 0),
              0
            ),
          },
        }),
      });

      if (error) {
        console.error("Resend error for audit email:", error.message);
        errors.push(`Audit email failed: ${error.message}`);
        auditEmailResult = { success: false, error: error.message };
      } else {
        auditEmailResult = { success: true, emailId: data?.id };
      }
    } catch (error: any) {
      console.error("Exception sending audit email:", error.message);
      errors.push(`Audit email exception: ${error.message}`);
      auditEmailResult = { success: false, error: error.message };
    }
    jobRunDetailsEmailResult = {
      success: true,
      suppressed: true,
      message:
        "Dedicated job-status email suppressed; the CEO briefing is the single daily cron report.",
    };
  } else {
    auditEmailResult = { success: true, message: "No cron data to send." };
    jobRunDetailsEmailResult = {
      success: true,
      suppressed: true,
      message:
        "Dedicated job-status email suppressed; the CEO briefing is the single daily cron report.",
    };
  }

  if (
    errors.length > 0 &&
    (!auditEmailResult?.success || !jobRunDetailsEmailResult?.success)
  ) {
    return res.status(500).json({
      message: "One or more operations failed.",
      errors,
      auditEmailResult,
      jobRunDetailsEmailResult,
    });
  }

  return res.status(200).json({
    success: true,
    dryRun,
    preview: previewMode ? "json" : null,
    auditEmailResult,
    jobRunDetailsEmailResult,
    window: { since, until },
    executionBudget: {
      repositoryLimitMs,
      sourceBudgetMs,
      sourceElapsedMs,
      sourceDeadlineAt: new Date(sourceDeadlineAt).toISOString(),
      requestTimeoutMs: REPORT_REQUEST_TIMEOUT_MS,
      phaseReservesMs: REPORT_PHASE_RESERVES_MS,
      scope: "Handler entry; deployed override and outer middleware waits unverified",
    },
    sources: {
      cron: { ...runSource, rows: undefined, error: sanitizeErrorMessage(runSource.error) },
      audit: { ...auditSource, rows: undefined, error: sanitizeErrorMessage(auditSource.error) },
    },
    totalsComplete: runSource.complete && auditSource.complete,
    countScope: "observed",
    rowMetricScope: "Confirmed writes in latest scheduled receipts; partial coverage, never generic affected/attempted counts",
    totals: {
      auditRuns: auditSource.complete ? counts.auditRuns : null,
      auditFailures: auditSource.complete ? counts.auditFailures : null,
      cronRuns: runSource.complete ? runRows.length : null,
      rowsUpserted: runSource.complete && auditSource.complete && auditBriefings.every((row) => row.rowsUpserted != null || row.routePath === "/api/v1/db/cron-report") ? counts.totalRowsUpserted : null,
      errorRows: runSource.complete && auditSource.complete && auditBriefings.every((row) => row.failedRows != null || row.routePath === "/api/v1/db/cron-report") ? counts.totalFailedRows : null,
    },
    counts,
    warnings: warningSummary,
    benchmark: benchmarkSummary,
  });
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "daily-cron-report",
  // The report is an observability response, not a row-producing writer.
  // Do not infer its nested warning counts as rows affected by the report
  // itself; that creates a self-reinforcing partial-failure entry.
  recordRowMetrics: false,
});
