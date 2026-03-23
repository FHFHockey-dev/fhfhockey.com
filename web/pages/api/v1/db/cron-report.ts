import fs from "fs/promises";
import path from "path";

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

import { CronReportEmail } from "components/CronReportEmail/CronReportEmail";
import { CronAuditEmail } from "components/CronReportEmail/CronAuditEmail";
import {
  getBenchmarkAnnotations,
  hasBenchmarkAnnotationKind,
  type BenchmarkAnnotation
} from "lib/cron/benchmarkNotes";
import {
  buildSlowJobWarning,
  isSlowJobDuration,
  SLOW_JOB_DENOTATION,
  SLOW_JOB_THRESHOLD_MS,
  type SlowJobWarning
} from "lib/cron/cronReportFlags";
import {
  type CronJobTimingRecord
} from "lib/cron/timingContract";
import { extractAuditTimingRecord } from "lib/cron/cronReportTiming";
import { buildSqlCronTimingObservation } from "lib/cron/sqlTiming";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

const REPORT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MATCH_WINDOW_MS = 6 * 60 * 60 * 1000;

const SCHEDULE_ALIAS_MAP: Record<string, string[]> = {
  "update-all-wgo-skaters": ["update-wgo-skaters", "/api/v1/db/update-wgo-skaters"],
  "update-all-wgo-goalies": ["/api/v1/db/update-wgo-goalies"],
  "update-all-wgo-skater-totals": [
    "update-skater-totals",
    "/api/v1/db/update-wgo-totals"
  ],
  "update-shift-charts": ["/api/v1/db/shift-charts"],
  "update-yahoo-matchup-dates": ["/api/v1/db/update-yahoo-weeks"],
  "update-line-combinations-all": ["/api/v1/db/update-line-combinations"],
  "update-wgo-teams": ["run-fetch-wgo-data", "/api/v1/db/run-fetch-wgo-data"],
  "update-wigo-table-stats": [
    "calculate-wigo-stats",
    "/api/v1/db/calculate-wigo-stats"
  ]
};

type NormalizedStatus = "success" | "failure" | "unknown";
type ReportJobStatus = NormalizedStatus | "missing";
type ScheduleMethod = "GET" | "POST" | "SQL" | "UNKNOWN";

type ScheduledCronJob = {
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
  dataQualityWarningCount: number;
  rowsUpserted: number | null;
  failedRows: number | null;
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
  lastStatusSource: "audit" | "cron" | "missing" | "unknown";
  scheduleTimeDisplay: string;
  expectedRunDisplay: string;
  lastRunDisplay: string;
  method: ScheduleMethod;
  route: string | null;
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
  failedRowSamples: string[];
  lastDurationMs: number | null;
  avgDurationMs: number | null;
  optimizationDenotation: typeof SLOW_JOB_DENOTATION | null;
  benchmarkAnnotations: BenchmarkAnnotation[];
  missingObservationWarnings: string[];
};

type RunDigest = {
  key: string;
  label: string;
  jobName: string;
  status: NormalizedStatus;
  runTime: string;
  runTimeDisplay: string;
  method: string | null;
  route: string | null;
  statusCode: number | null;
  durationMs: number | null;
  rowsUpserted: number | null;
  rowsAffected: number | null;
  failedRows: number | null;
  reason: string | null;
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
  auditUnknown: number;
  jobsOkLast: number;
  jobsFailingLast: number;
  jobsMissingLast: number;
  jobsUnknownLast: number;
  unscheduledRuns: number;
  totalRowsUpserted: number;
  totalFailedRows: number;
  warnSlow: number;
  warnPartialFailure: number;
  warnMissingAudit: number;
};

type WarningSummary = {
  slowMsThreshold: number;
  slowJobDenotation: typeof SLOW_JOB_DENOTATION;
  slowJobs: SlowJobWarning[];
  missingObservationJobs: Array<{ displayName: string; warnings: string[] }>;
};

type BenchmarkSummary = {
  annotatedJobCount: number;
  bottleneckJobs: Array<{ displayName: string; notes: string[] }>;
  missingObservationJobs: Array<{ displayName: string; warnings: string[] }>;
};

function normalizeStatus(value: unknown): NormalizedStatus {
  const v = String(value ?? "").toLowerCase().trim();
  if (!v) return "unknown";
  if (["success", "succeeded", "ok", "passed"].includes(v)) return "success";
  if (["failure", "failed", "error", "errored"].includes(v)) return "failure";
  return "unknown";
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
    raw.match(/<span class="inline-block">\s*([^<]+)\s*<\/span>/i)?.[1]?.trim() ?? null;
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

function extractPrimaryMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return sanitizeErrorMessage(value, 240);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractPrimaryMessage(item);
      if (nested) return nested;
    }
    return null;
  }

  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  for (const key of [
    "message",
    "error",
    "err",
    "reason",
    "detail",
    "details",
    "return_message",
    "returnMessage",
    "statusText"
  ]) {
    if (typeof obj[key] === "string" && obj[key]?.trim()) {
      return sanitizeErrorMessage(obj[key], 240);
    }
  }

  for (const key of ["errors", "failures", "failedRows", "failed_rows"]) {
    const nested = extractPrimaryMessage(obj[key]);
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

function sumNumericFields(
  value: unknown,
  keys: readonly string[],
  skipKeys: ReadonlySet<string>
): { found: boolean; total: number } {
  if (!value || typeof value !== "object") {
    return { found: false, total: 0 };
  }

  if (Array.isArray(value)) {
    return value.reduce(
      (acc, item) => {
        const nested = sumNumericFields(item, keys, skipKeys);
        return nested.found
          ? { found: true, total: acc.total + nested.total }
          : acc;
      },
      { found: false, total: 0 }
    );
  }

  const obj = value as Record<string, unknown>;
  let found = false;
  let total = 0;

  for (const [key, nestedValue] of Object.entries(obj)) {
    if (skipKeys.has(key)) continue;

    const numeric = keys.includes(key) ? toFiniteNumber(nestedValue) : null;
    if (numeric != null) {
      found = true;
      total += numeric;
      continue;
    }

    const nested = sumNumericFields(nestedValue, keys, skipKeys);
    if (nested.found) {
      found = true;
      total += nested.total;
    }
  }

  return { found, total };
}

function inferRowsUpserted(response: unknown): number | null {
  const direct = getDirectNumericField(response, [
    "rowsUpserted",
    "rows_upserted",
    "rowsInserted",
    "rows_inserted",
    "upserted",
    "inserted",
    "updated",
    "totalUpdates",
    "total_updates",
    "count"
  ]);
  if (direct != null) return direct;

  const nested = sumNumericFields(
    response,
    [
      "rowsUpserted",
      "rows_upserted",
      "rowsInserted",
      "rows_inserted",
      "upserted",
      "inserted",
      "updated",
      "totalUpdates",
      "total_updates"
    ],
    new Set(["observability", "debug", "errors", "warnings"])
  );

  return nested.found ? nested.total : null;
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
    "invalid_rows"
  ]);

  const visit = (current: unknown) => {
    if (out.length >= limit || current == null) return;

    if (Array.isArray(current)) {
      for (const item of current) {
        if (out.length >= limit) break;
        if (item && typeof item === "object") {
          visit(item);
        } else if (item != null) {
          out.push(item);
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

function inferFailedRows(response: unknown): number | null {
  const direct = getDirectNumericField(response, [
    "failedRows",
    "failed_rows",
    "failedCount",
    "failed_count",
    "errorCount",
    "errorsCount",
    "rowsFailed",
    "rows_failed"
  ]);
  if (direct != null) return direct;

  const failures = collectFailureEntries(response, 100);
  return failures.length > 0 ? failures.length : null;
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

function parseUrlPieces(
  rawUrl: string | null
): { route: string | null; routePath: string | null } {
  if (!rawUrl) {
    return { route: null, routePath: null };
  }

  try {
    const parsed = new URL(rawUrl);
    return {
      route: `${parsed.pathname}${parsed.search}`,
      routePath: parsed.pathname
    };
  } catch {
    return {
      route: rawUrl,
      routePath: rawUrl.split("?")[0] ?? rawUrl
    };
  }
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
    dataQualityWarningCount: 0,
    rowsUpserted: null,
    failedRows: null,
    failedRowSamples: []
  };

  if (!details) return empty;

  const parsedDetails = parseJsonMaybe(details);
  if (!parsedDetails || typeof parsedDetails !== "object") {
    return {
      ...empty,
      error: extractPrimaryMessage(parsedDetails),
      responseMessage: extractPrimaryMessage(parsedDetails)
    };
  }

  const obj = parsedDetails as Record<string, unknown>;
  const response = parseJsonMaybe(obj.response);
  const timing = extractAuditTimingRecord(parsedDetails);
  const { route, routePath } = parseUrlPieces(
    typeof obj.url === "string" ? obj.url : null
  );
  const goalieRowsProcessed = getDirectNumericField(response, [
    "goalieRowsProcessed"
  ]);
  const failedRowSamples = collectFailureEntries(response)
    .map((entry) => formatFailureSample(entry))
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, 3);

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
    dataQualityWarningCount: countWarningEntries(response),
    rowsUpserted: inferRowsUpserted(response),
    failedRows: inferFailedRows(response),
    failedRowSamples
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

function safeDurationMs(startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) return null;
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const duration = end - start;
  return duration >= 0 ? duration : null;
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
    routePath
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

  return candidate.getTime() >= since.getTime() ? candidate.toISOString() : null;
}

async function readCronScheduleMarkdown(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), "rules/cron-schedule.md"),
    path.resolve(process.cwd(), "web/rules/cron-schedule.md")
  ];

  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate, "utf8");
    } catch {
      // continue
    }
  }

  throw new Error("Could not locate rules/cron-schedule.md");
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

  const rawJobs = matches.map((match, index) => {
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
      sortOrder: index
    };
  });

  const dedupedJobs = rawJobs.filter((job, index, jobs) => {
    const signature = [
      job.name,
      job.cronExpression,
      job.method,
      job.route ?? "",
      job.url ?? "",
      job.sqlText ?? ""
    ].join("::");
    return (
      index ===
      jobs.findIndex((candidate) =>
        [
          candidate.name,
          candidate.cronExpression,
          candidate.method,
          candidate.route ?? "",
          candidate.url ?? "",
          candidate.sqlText ?? ""
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
            ...(SCHEDULE_ALIAS_MAP[job.name] ?? [])
          ].filter((value): value is string => Boolean(value))
        )
      )
    };
  });
}

function candidateMatchesSchedule(
  job: ScheduledCronJob,
  candidate: {
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
  if (!aliasMatch) return false;

  const candidateMethod = candidate.method?.toUpperCase() ?? null;
  if (
    job.method !== "SQL" &&
    candidateMethod &&
    candidateMethod !== "UNKNOWN" &&
    candidateMethod !== job.method
  ) {
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

function statusSortValue(status: ReportJobStatus): number {
  switch (status) {
    case "failure":
      return 0;
    case "missing":
      return 1;
    case "unknown":
      return 2;
    default:
      return 3;
  }
}

function buildRunDigestFromAudit(row: AuditRow): RunDigest {
  const benchmarkAnnotations = getBenchmarkAnnotations(row.jobName);
  const optimizationDenotation = isSlowJobDuration(row.parsed.durationMs)
    ? SLOW_JOB_DENOTATION
    : null;
  const missingObservationWarnings =
    row.parsed.durationMs == null
      ? ["Observed audit run does not have reliable timing metadata yet."]
      : [];

  return {
    key: row.id,
    label: row.parsed.route ?? row.jobName,
    jobName: row.jobName,
    status: row.status,
    runTime: row.time,
    runTimeDisplay: new Date(row.time).toLocaleString(),
    method: row.parsed.method,
    route: row.parsed.route,
    statusCode: row.parsed.statusCode,
    durationMs: row.parsed.durationMs,
    rowsUpserted: row.parsed.rowsUpserted ?? row.rowsAffected,
    rowsAffected: row.rowsAffected,
    failedRows: row.parsed.failedRows,
    reason:
      row.parsed.error ??
      row.parsed.responseMessage ??
      row.detailsMessage ??
      null,
    failedRowSamples: row.parsed.failedRowSamples,
    optimizationDenotation,
    benchmarkAnnotations,
    missingObservationWarnings
  };
}

function buildRunDigestFromCron(row: RunRow): RunDigest {
  const benchmarkAnnotations = getBenchmarkAnnotations(row.jobName);
  const optimizationDenotation = isSlowJobDuration(row.durationMs)
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
    status: row.status,
    runTime: row.time,
    runTimeDisplay: new Date(row.time).toLocaleString(),
    method: row.method === "UNKNOWN" ? null : row.method,
    route: row.route,
    statusCode: null,
    durationMs: row.durationMs,
    rowsUpserted: row.rowsAffected,
    rowsAffected: row.rowsAffected,
    failedRows: null,
    reason: row.returnMessage ? sanitizeErrorMessage(row.returnMessage, 240) : null,
    failedRowSamples: [],
    optimizationDenotation,
    benchmarkAnnotations,
    missingObservationWarnings
  };
}

function collectMissingObservationWarnings(job: {
  lastStatus: ReportJobStatus;
  runsCount: number;
  auditRunsCount: number;
  method: ScheduleMethod;
  lastDurationMs: number | null;
  hasObservedSqlTiming: boolean;
  runDataAvailable: boolean;
  auditDataAvailable: boolean;
}): string[] {
  const warnings: string[] = [];

  if (job.lastStatus === "missing") {
    warnings.push("No cron or audit observation matched this scheduled slot.");
  }

  if (
    job.runsCount > 0 &&
    job.auditRunsCount === 0 &&
    job.method !== "SQL" &&
    job.auditDataAvailable
  ) {
    warnings.push("Cron invoked the route, but no audit payload was recorded.");
  }

  if (job.lastStatus !== "missing" && job.lastDurationMs == null) {
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
    warnings.push("Cron run telemetry is unavailable for SQL schedule matching.");
  }

  if (job.method !== "SQL" && (!job.runDataAvailable || !job.auditDataAvailable)) {
    const unavailableSources = [
      !job.runDataAvailable ? "cron_job_report" : null,
      !job.auditDataAvailable ? "cron_job_audit" : null
    ]
      .filter((source): source is string => Boolean(source))
      .join(" and ");
    warnings.push(`Telemetry source unavailable: ${unavailableSources}.`);
  }

  return warnings;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const sinceDate = new Date(Date.now() - REPORT_WINDOW_MS);
  const since = sinceDate.toISOString();
  const now = new Date();
  const emailRecipient = process.env.CRON_REPORT_EMAIL_RECIPIENT!;

  let jobRunDetailsEmailResult: any = null;
  let auditEmailResult: any = null;
  const errors: string[] = [];

  const { data: runs, error: runErr } = await supabase
    .from("cron_job_report")
    .select("jobname, scheduled_time, status, return_message, end_time, sql_text")
    .gte("scheduled_time", since)
    .order("scheduled_time", { ascending: true });

  if (runErr) {
    console.error("Error fetching cron_job_report:", runErr.message);
    errors.push(
      `Failed to fetch cron_job_report: ${
        sanitizeErrorMessage(runErr.message) ?? "Unknown upstream error"
      }`
    );
  }

  const { data: audits, error: auditErr } = await supabase
    .from("cron_job_audit")
    .select("job_name, run_time, rows_affected, status, details")
    .gte("run_time", since)
    .order("run_time", { ascending: true });

  if (auditErr) {
    console.error("Error fetching cron_job_audit:", auditErr.message);
    errors.push(
      `Failed to fetch cron_job_audit: ${
        sanitizeErrorMessage(auditErr.message) ?? "Unknown upstream error"
      }`
    );
  }

  let scheduledJobs: ScheduledCronJob[] = [];
  try {
    scheduledJobs = await loadScheduledCronJobs(sinceDate, now);
  } catch (error: any) {
    console.error("Error loading cron schedule:", error?.message ?? error);
    errors.push(
      `Failed to parse cron schedule: ${error?.message ?? String(error)}`
    );
  }

  const auditRows: AuditRow[] = (audits ?? []).map((row: any, index: number) => ({
    id: `audit:${index}:${row.job_name ?? ""}:${row.run_time ?? ""}`,
    jobName: String(row.job_name ?? ""),
    time: String(row.run_time ?? ""),
    rowsAffected: (row.rows_affected ?? null) as number | null,
    rawStatus: row.status,
    status: normalizeStatus(row.status),
    details: row.details,
    detailsMessage: extractDetailsMessage(row.details),
    parsed: parseAuditDetails(row.details)
  }));

  const runRows: RunRow[] = (runs ?? []).map((row: any, index: number) => {
    const invocation = parseCronInvocation((row.sql_text ?? null) as string | null);
    const timing = buildSqlCronTimingObservation({
      jobname: (row.jobname ?? null) as string | null,
      scheduled_time: (row.scheduled_time ?? null) as string | null,
      end_time: (row.end_time ?? null) as string | null,
      status: row.status,
      return_message: (row.return_message ?? null) as string | null,
      sql_text: (row.sql_text ?? null) as string | null
    }).timing;
    return {
      id: `run:${index}:${row.jobname ?? ""}:${row.scheduled_time ?? ""}`,
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
      durationMs:
        timing?.durationMs ??
        safeDurationMs(
          (row.scheduled_time ?? null) as string | null,
          (row.end_time ?? null) as string | null
        ),
      method: invocation.method,
      url: invocation.url,
      route: invocation.route,
      routePath: invocation.routePath
    };
  });

  const matchedAuditIds = new Set<string>();
  const matchedRunIds = new Set<string>();
  const runDataAvailable = !runErr;
  const auditDataAvailable = !auditErr;

  const jobSummaries: JobSummary[] = scheduledJobs
    .map((job) => {
      const matchingAudits = auditRows
        .filter((row) =>
          candidateMatchesSchedule(job, {
            jobName: row.jobName,
            time: row.time,
            method: row.parsed.method,
            route: row.parsed.route,
            routePath: row.parsed.routePath
          })
        )
        .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));

      const matchingRuns = runRows
        .filter((row) =>
          candidateMatchesSchedule(job, {
            jobName: row.jobName,
            time: row.time,
            method: row.method,
            route: row.route,
            routePath: row.routePath
          })
        )
        .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));

      matchingAudits.forEach((row) => matchedAuditIds.add(row.id));
      matchingRuns.forEach((row) => matchedRunIds.add(row.id));

      const lastAudit = matchingAudits[0] ?? null;
      const lastRun = matchingRuns[0] ?? null;
      const lastAuditTs = lastAudit ? Date.parse(lastAudit.time) : -Infinity;
      const lastRunTs = lastRun ? Date.parse(lastRun.time) : -Infinity;
      const preferAudit = lastAuditTs >= lastRunTs;
      const hasFullCoverageForMissing =
        job.method === "SQL"
          ? runDataAvailable
          : runDataAvailable && auditDataAvailable;

      const lastStatus: ReportJobStatus =
        !lastAudit && !lastRun
          ? hasFullCoverageForMissing
            ? "missing"
            : "unknown"
          : preferAudit
            ? (lastAudit?.status ?? "unknown")
            : (lastRun?.status ?? "unknown");

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
          ? Math.round(durations.reduce((acc, value) => acc + value, 0) / durations.length)
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

      const rowsUpsertedLast =
        lastAudit?.parsed.rowsUpserted ??
        lastAudit?.rowsAffected ??
        lastRun?.rowsAffected ??
        null;
      const rowsAffectedLast = lastAudit?.rowsAffected ?? lastRun?.rowsAffected ?? null;
      const failedRowsLast = lastAudit?.parsed.failedRows ?? null;
      const failedRowSamples = lastAudit?.parsed.failedRowSamples ?? [];

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
      const optimizationDenotation = isSlowJobDuration(lastDurationMs)
        ? SLOW_JOB_DENOTATION
        : null;
      const benchmarkAnnotations = getBenchmarkAnnotations(job.name);
      const missingObservationWarnings = collectMissingObservationWarnings({
        lastStatus,
        runsCount: matchingRuns.length,
        auditRunsCount: matchingAudits.length,
        method: job.method,
        lastDurationMs,
        hasObservedSqlTiming: matchingRuns.some((row) => row.timing != null),
        runDataAvailable,
        auditDataAvailable
      });

      const notes: string[] = [];
      if (lastStatus === "missing") {
        notes.push("No cron or audit entry matched this scheduled slot.");
      }
      if (
        matchingRuns.length > 0 &&
        matchingAudits.length === 0 &&
        job.method !== "SQL" &&
        auditDataAvailable
      ) {
        notes.push("Cron invoked the route, but no audit payload was recorded.");
      }
      if (!lastAudit && !lastRun && !hasFullCoverageForMissing) {
        notes.push("Telemetry is incomplete, so missing-run status could not be determined.");
      }
      if (lastStatus === "success" && (failedRowsLast ?? 0) > 0) {
        notes.push(`Completed with ${failedRowsLast} row-level failures.`);
      }
      if ((lastAudit?.parsed.dataQualityWarningCount ?? 0) > 0) {
        notes.push(
          `Returned ${lastAudit?.parsed.dataQualityWarningCount} warning(s).`
        );
      }
      if (optimizationDenotation) {
        notes.push(`${optimizationDenotation}: last runtime exceeded 4m30s.`);
      }
      if (hasBenchmarkAnnotationKind(benchmarkAnnotations, "bottleneck")) {
        const firstBottleneckNote = benchmarkAnnotations.find(
          (annotation) => annotation.kind === "bottleneck"
        )?.note;
        if (firstBottleneckNote) {
          notes.push(`Bottleneck: ${firstBottleneckNote}`);
        }
      }
      if (job.method === "SQL" && lastRun?.returnMessage && lastStatus !== "failure") {
        const sanitizedReturnMessage = sanitizeErrorMessage(lastRun.returnMessage, 140);
        if (sanitizedReturnMessage) {
          notes.push(sanitizedReturnMessage);
        }
      }

      return {
        jobKey: job.key,
        jobName: job.name,
        displayName: job.displayName,
        lastStatus,
        lastStatusSource,
        scheduleTimeDisplay: job.scheduleTimeDisplay,
        expectedRunDisplay: job.expectedRunAt
          ? new Date(job.expectedRunAt).toLocaleString()
          : job.scheduleTimeDisplay,
        lastRunDisplay:
          lastAudit?.time || lastRun?.time
            ? new Date(lastAudit?.time ?? lastRun?.time ?? "").toLocaleString()
            : "—",
        method: job.method,
        route: job.route ?? job.sqlText,
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
        failedRowSamples,
        lastDurationMs,
        avgDurationMs,
        optimizationDenotation,
        benchmarkAnnotations,
        missingObservationWarnings
      };
    })
    .sort((a, b) => {
      const statusDiff = statusSortValue(a.lastStatus) - statusSortValue(b.lastStatus);
      if (statusDiff !== 0) return statusDiff;
      const scheduleA = scheduledJobs.find((job) => job.key === a.jobKey)?.sortOrder ?? 0;
      const scheduleB = scheduledJobs.find((job) => job.key === b.jobKey)?.sortOrder ?? 0;
      return scheduleA - scheduleB;
    });

  const failureHighlights = jobSummaries.filter((job) => job.lastStatus === "failure");
  const missingJobs = jobSummaries.filter((job) => job.lastStatus === "missing");

  const unmatchedAuditRuns = auditRows
    .filter((row) => !matchedAuditIds.has(row.id))
    .map((row) => buildRunDigestFromAudit(row));
  const unmatchedCronRuns = runRows
    .filter((row) => !matchedRunIds.has(row.id))
    .map((row) => buildRunDigestFromCron(row));
  const unscheduledRuns = [...unmatchedAuditRuns, ...unmatchedCronRuns].sort(
    (a, b) => Date.parse(b.runTime) - Date.parse(a.runTime)
  );

  const auditRunDigests = auditRows
    .map((row) => buildRunDigestFromAudit(row))
    .sort((a, b) => Date.parse(b.runTime) - Date.parse(a.runTime));

  const WARN_SLOW: SlowJobWarning[] = jobSummaries
    .filter((job) => isSlowJobDuration(job.lastDurationMs))
    .map((job) => buildSlowJobWarning(job.displayName, job.lastDurationMs ?? 0));

  const WARN_PARTIAL_FAILURE = jobSummaries
    .filter((job) => job.lastStatus === "success" && (job.failedRowsLast ?? 0) > 0)
    .map((job) => ({
      displayName: job.displayName,
      failedRows: job.failedRowsLast ?? 0
    }));

  const WARN_MISSING_AUDIT = jobSummaries
    .filter(
      (job) =>
        job.lastStatus !== "missing" &&
        job.runsCount > 0 &&
        job.auditRunsCount === 0 &&
        job.method !== "SQL" &&
        auditDataAvailable
    )
    .map((job) => job.displayName);

  const missingObservationJobs = jobSummaries
    .filter((job) => job.missingObservationWarnings.length > 0)
    .map((job) => ({
      displayName: job.displayName,
      warnings: job.missingObservationWarnings
    }));

  const benchmarkSummary: BenchmarkSummary = {
    annotatedJobCount: jobSummaries.filter(
      (job) => job.benchmarkAnnotations.length > 0
    ).length,
    bottleneckJobs: jobSummaries
      .filter((job) => hasBenchmarkAnnotationKind(job.benchmarkAnnotations, "bottleneck"))
      .map((job) => ({
        displayName: job.displayName,
        notes: job.benchmarkAnnotations
          .filter((annotation) => annotation.kind === "bottleneck")
          .map((annotation) => annotation.note)
      })),
    missingObservationJobs
  };

  const warningSummary: WarningSummary = {
    slowMsThreshold: SLOW_JOB_THRESHOLD_MS,
    slowJobDenotation: SLOW_JOB_DENOTATION,
    slowJobs: WARN_SLOW,
    missingObservationJobs
  };

  const counts: ReportCounts = {
    scheduledJobs: scheduledJobs.length,
    scheduledJobsWithActivity: jobSummaries.filter(
      (job) => job.runsCount > 0 || job.auditRunsCount > 0
    ).length,
    auditRuns: auditRows.length,
    auditSuccesses: auditRows.filter((row) => row.status === "success").length,
    auditFailures: auditRows.filter((row) => row.status === "failure").length,
    auditUnknown: auditRows.filter((row) => row.status === "unknown").length,
    jobsOkLast: jobSummaries.filter((job) => job.lastStatus === "success").length,
    jobsFailingLast: jobSummaries.filter((job) => job.lastStatus === "failure").length,
    jobsMissingLast: jobSummaries.filter((job) => job.lastStatus === "missing").length,
    jobsUnknownLast: jobSummaries.filter((job) => job.lastStatus === "unknown").length,
    unscheduledRuns: unscheduledRuns.length,
    totalRowsUpserted: jobSummaries.reduce(
      (acc, job) => acc + (job.rowsUpsertedLast ?? job.rowsAffectedLast ?? 0),
      0
    ),
    totalFailedRows: jobSummaries.reduce(
      (acc, job) => acc + (job.failedRowsLast ?? 0),
      0
    ),
    warnSlow: WARN_SLOW.length,
    warnPartialFailure: WARN_PARTIAL_FAILURE.length,
    warnMissingAudit: WARN_MISSING_AUDIT.length
  };

  if (auditRows.length > 0 || auditErr) {
    try {
      const { data, error } = await resend.emails.send({
        from: "audit-report@fhfhockey.com",
        to: emailRecipient,
        subject:
          auditErr && auditRows.length === 0
            ? "⚠️ Cron Audit — telemetry unavailable"
            : counts.auditFailures > 0
            ? `❌ Cron Audit — ${counts.auditFailures} failing audit runs`
            : `✅ Cron Audit — ${counts.auditSuccesses} audit runs ok`,
        react: CronAuditEmail({
          audits: auditRunDigests,
          sinceDate: since,
          fetchErrors: errors.filter((message) => message.includes("cron_job_audit")),
      summary: {
            auditRuns: counts.auditRuns,
            auditSuccesses: counts.auditSuccesses,
            auditFailures: counts.auditFailures,
            auditUnknown: counts.auditUnknown,
            slowJobDenotation: SLOW_JOB_DENOTATION,
            slowMsThreshold: SLOW_JOB_THRESHOLD_MS,
            annotatedJobCount: auditRunDigests.filter(
              (audit) => audit.benchmarkAnnotations.length > 0
            ).length,
            slowRuns: auditRunDigests.filter(
              (audit) => audit.optimizationDenotation != null
            ).length,
            missingObservationRuns: auditRunDigests.filter(
              (audit) => audit.missingObservationWarnings.length > 0
            ).length,
            totalRowsUpserted: auditRunDigests.reduce(
              (acc, audit) => acc + (audit.rowsUpserted ?? audit.rowsAffected ?? 0),
              0
            ),
            totalFailedRows: auditRunDigests.reduce(
              (acc, audit) => acc + (audit.failedRows ?? 0),
              0
            )
          }
        })
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
  } else if (!auditErr) {
    auditEmailResult = { success: true, message: "No audit data to send." };
  }

  if (scheduledJobs.length > 0 || runRows.length > 0 || auditRows.length > 0) {
    try {
      const { data, error } = await resend.emails.send({
        from: "job-status@fhfhockey.com",
        to: emailRecipient,
        subject:
          errors.length > 0 &&
          counts.scheduledJobsWithActivity === 0 &&
          counts.auditRuns === 0 &&
          counts.unscheduledRuns === 0
            ? "⚠️ Daily Cron Summary — telemetry unavailable"
            : counts.jobsFailingLast > 0 || counts.jobsMissingLast > 0
            ? `❌ Daily Cron Summary — ${counts.jobsFailingLast} failing, ${counts.jobsMissingLast} missing`
            : counts.jobsUnknownLast > 0
              ? `⚠️ Daily Cron Summary — ${counts.jobsUnknownLast} unknown`
            : `✅ Daily Cron Summary — ${counts.jobsOkLast}/${counts.scheduledJobs} scheduled jobs ok`,
        react: CronReportEmail({
          sinceDate: since,
          summary: counts,
          jobs: jobSummaries,
          failureHighlights,
          missingJobs,
          unscheduledRuns,
          fetchErrors: errors,
          warnings: {
            slowMsThreshold: SLOW_JOB_THRESHOLD_MS,
            slowJobs: WARN_SLOW,
            partialFailureJobs: WARN_PARTIAL_FAILURE,
            missingAuditJobs: WARN_MISSING_AUDIT,
            missingObservationJobs
          }
        })
      });

      if (error) {
        console.error("Resend error for job run details email:", error.message);
        errors.push(`Job run details email failed: ${error.message}`);
        jobRunDetailsEmailResult = { success: false, error: error.message };
      } else {
        jobRunDetailsEmailResult = { success: true, emailId: data?.id };
      }
    } catch (error: any) {
      console.error("Exception sending job run details email:", error.message);
      errors.push(`Job run details email exception: ${error.message}`);
      jobRunDetailsEmailResult = { success: false, error: error.message };
    }
  } else if (!runErr) {
    jobRunDetailsEmailResult = {
      success: true,
      message: "No scheduled or observed cron data to send."
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
      jobRunDetailsEmailResult
    });
  }

  return res.status(200).json({
    success: true,
    auditEmailResult,
    jobRunDetailsEmailResult,
    counts,
    warnings: warningSummary,
    benchmark: benchmarkSummary
  });
}
