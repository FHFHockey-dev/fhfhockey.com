import { cronAuditFailureResponse } from "lib/cron/manualCronAudit";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  buildCronJobTiming,
  hasCronTimingEnvelope,
  withCronJobTiming,
} from "lib/cron/timingContract";
import supabase from "lib/supabase/server";
import type { CronClassification } from "lib/cron/nhlOffSeason";

// "continued" marks a planned partial run: the route stopped at its runtime
// budget and handed back a cursor for the next call. It is not a failure.
type AuditStatus = "success" | "failure" | "continued";

type CronAuditRow = {
  job_name: string;
  status: AuditStatus;
  rows_affected: number | null;
  details: any;
};

function truncateString(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen - 1) + "…";
}

function safeJson(value: unknown, maxLen: number): string | null {
  if (value == null) return null;
  try {
    return truncateString(JSON.stringify(value), maxLen);
  } catch {
    return null;
  }
}

function outcomeFields(value: unknown, keys: readonly string[], maxLen = 300) {
  const result: Record<string, string | number | boolean | null> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const field = record[key];
    if (typeof field === "string") result[key] = truncateString(field, maxLen);
    else if (field === null || typeof field === "boolean" ||
      (typeof field === "number" && Number.isFinite(field))) result[key] = field;
  }
  return result;
}

/** Keep outcome facts queryable even when the legacy response preview is cut. */
function responseOutcome(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const outcome: Record<string, unknown> = outcomeFields(record, [
    "success", "status", "error", "asOfDate", "nextGameId", "nextStartDate",
    "lastCompletedGameId", "rowsUpserted", "rowsVerified", "rowsPruned",
  ], 2000);
  if (Array.isArray(record.errors)) {
    outcome.errors = {
      count: record.errors.length,
      sample: record.errors.slice(0, 3).map((error) =>
        typeof error === "string" ? { message: truncateString(error, 2000) }
          : outcomeFields(error, ["gameId", "date", "stage", "message"], 2000)),
    };
  }
  if (record.termination && typeof record.termination === "object") {
    outcome.termination = outcomeFields(record.termination, [
      "state", "resumeRequired", "nextStartDate",
    ]);
  }
  if (record.preflight && typeof record.preflight === "object") {
    const preflight = record.preflight as Record<string, unknown>;
    const gates = Array.isArray(preflight.gates) ? preflight.gates : null;
    const failedGates = gates?.filter((gate) =>
      gate && typeof gate === "object" && gate.status === "FAIL");
    outcome.preflight = {
      ...outcomeFields(preflight, ["status", "asOfDate"]),
      gateCount: gates?.length ?? null,
      failedGateCount: failedGates?.length ?? null,
      failedGates: failedGates?.slice(0, 10).map((gate) =>
        outcomeFields(gate, ["gate_key", "status", "detail"])) ?? null,
    };
  }
  return outcome;
}

function inferRowsAffected(body: unknown): number | null {
  const tryNumber = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  const visit = (obj: any): number | null => {
    if (!obj || typeof obj !== "object") return null;
    const keys = [
      "rowsUpserted",
      "rows_upserted",
      "rowsAffected",
      "rows_affected",
      "rowsInserted",
      "rows_inserted",
      "upserted",
      "inserted",
      "updated",
      "totalUpdates",
      "total_updates",
      "succeeded",
      "count",
    ];

    for (const k of keys) {
      const n = tryNumber(obj[k]);
      if (n != null) return n;
    }

    for (const v of Object.values(obj)) {
      if (Array.isArray(v) && v.length > 0 && typeof v[0] !== "object")
        continue;
      const nested = visit(v);
      if (nested != null) return nested;
    }

    return null;
  };

  return visit(body);
}

function inferFailedRows(body: unknown): number | null {
  const directKeys = [
    "failedRows",
    "failed_rows",
    "failedCount",
    "failed_count",
    "errorCount",
    "errorsCount",
    "rowsFailed",
    "rows_failed",
  ];

  const visit = (obj: any): number | null => {
    if (!obj || typeof obj !== "object") return null;

    if (Array.isArray(obj)) {
      return obj.reduce((acc, item) => acc + (visit(item) ?? 0), 0) || null;
    }

    for (const key of directKeys) {
      const value = obj[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
    }

    for (const key of ["errors", "failures", "failedRows", "failed_rows"]) {
      const value = obj[key];
      if (Array.isArray(value)) return value.length;
    }

    for (const value of Object.values(obj)) {
      const nested = visit(value);
      if (nested != null) return nested;
    }

    return null;
  };

  return visit(body);
}

function inferFailure(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const b: any = body;

  if (b.success === false) return true;

  const normalizedStatus =
    typeof b.status === "string" ? b.status.trim().toLowerCase() : null;
  if (
    normalizedStatus &&
    ["failure", "failed", "error"].includes(normalizedStatus)
  ) {
    return true;
  }

  if (typeof b.error === "string" && b.error.trim()) return true;

  if (typeof b.failedRequests === "number" && b.failedRequests > 0) return true;
  if (Array.isArray(b.summary?.errors) && b.summary.errors.length > 0)
    return true;

  if (b.success === true) return false;
  if (
    normalizedStatus &&
    ["success", "succeeded", "ok", "passed"].includes(normalizedStatus)
  ) {
    return false;
  }

  if (typeof b.message === "string" && /fail|error/i.test(b.message))
    return true;
  return false;
}

/**
 * A 207 that stopped at a runtime budget on purpose: the body asks for a
 * continuation (`termination.state`, `resume.request`, or a partial daily
 * `resumeCursor` read by `continueDailyWindow`) and lists no failures.
 */
function isPlannedContinuation(statusCode: number, body: unknown): boolean {
  if (statusCode !== 207 || !body || typeof body !== "object" || Array.isArray(body))
    return false;
  const b: any = body;
  const requested =
    b.termination?.state === "continuation_required" ||
    (b.resume?.request != null && typeof b.resume.request === "object") ||
    b.resumeCursor?.status === "partial" ||
    b.continueDailyWindow === true;
  if (!requested) return false;
  if (typeof b.error === "string" && b.error.trim()) return false;
  if (typeof b.failedRequests === "number" && b.failedRequests > 0) return false;
  // The FORGE pipeline counts failed steps here; nested child receipts below
  // it are not failures of this run.
  if (typeof b.failureSummary?.failedStepCount === "number")
    return b.failureSummary.failedStepCount === 0;
  return (inferFailedRows(body) ?? 0) === 0;
}

// The registered symbol withNhlOffSeasonSkip stamps on the response. It is read
// through the global registry rather than imported, so route tests that mock
// lib/cron/nhlOffSeason still run this wrapper unchanged.
const CRON_CLASSIFICATION_KEY = Symbol.for("fhfh.cron.classification");
const SEASONAL_GAME_DATA: CronClassification = "nhl_seasonal_game_data";

function knownClassification(value: unknown): CronClassification | null {
  return value === SEASONAL_GAME_DATA ? SEASONAL_GAME_DATA : null;
}

/** The classification the off-season gate stamped on this response, if any. */
export function cronClassificationOf(res: object): CronClassification | null {
  return knownClassification((res as Record<symbol, unknown>)[CRON_CLASSIFICATION_KEY]);
}

/**
 * Reads `details.cronClassification` from a cron_job_audit row. New rows carry
 * the classification or null (not seasonal game data); undefined means the row
 * predates the field (or holds an unrecognised value), so callers must fall back.
 */
export function cronClassificationFromAuditDetails(
  details: unknown,
): CronClassification | null | undefined {
  if (!details || typeof details !== "object" || Array.isArray(details)) return undefined;
  const value = (details as Record<string, unknown>).cronClassification;
  if (value === null) return null;
  return knownClassification(value) ?? undefined;
}

function defaultJobName(req: NextApiRequest): string {
  const url = req.url ?? "";
  const pathOnly = url.split("?")[0]?.trim();
  return pathOnly || "unknown";
}

export function withCronJobAudit(
  handler: (req: any, res: any) => any,
  opts?: {
    jobName?: string;
    // Opt into a required persistence acknowledgement. An unconfirmed audit
    // returns 503 with a no-retry receipt; ordinary routes keep their outcome.
    includeFinalAuditReceipt?: boolean;
    recordRowMetrics?: boolean;
    // Limit persisted response data to safe primitive summary fields. The API
    // response and outcome inference still use the complete handler result.
    responsePreviewKeys?: readonly string[];
    // Return true for a clean run that did no work (for example an empty
    // queue poll). That run writes no audit row. Failures, continuations,
    // non-2xx responses and runs that did work are always audited.
    skipAuditWhenNoOp?: (body: unknown) => boolean;
  }
): (req: any, res: any) => Promise<void> {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const startedAt = Date.now();
    const jobName = opts?.jobName ?? defaultJobName(req);

    let capturedBody: unknown = null;
    let pendingResponse: { kind: "json" | "send"; body: unknown } | null = null;

    const originalJson = res.json.bind(res);
    res.json = ((body: any) => {
      capturedBody = body;
      pendingResponse = { kind: "json", body };
      return res;
    }) as any;

    const originalSend =
      typeof res.send === "function" ? res.send.bind(res) : null;
    if (originalSend) {
      res.send = ((body: any) => {
        if (capturedBody == null) capturedBody = body;
        pendingResponse = { kind: "send", body };
        return res;
      }) as any;
    }

    let thrown: unknown = null;
    try {
      await handler(req, res);
    } catch (err) {
      thrown = err;
      if (!res.headersSent) {
        const errorBody = withCronJobTiming(
          { success: false, error: (err as any)?.message ?? "Unknown error" },
          startedAt
        );
        capturedBody = errorBody;
        res.status(500).json(errorBody);
      }
    }

    const endedAt = Date.now();
    const timing = hasCronTimingEnvelope(capturedBody)
      ? {
          ...capturedBody.timing,
          source: "audit" as const,
        }
      : {
          ...buildCronJobTiming(startedAt, endedAt),
          source: "audit" as const,
        };
    const durationMs = timing.durationMs;
    const statusCode = res.statusCode;
    const recordRowMetrics = opts?.recordRowMetrics !== false;
    const rowsUpserted = recordRowMetrics
      ? inferRowsAffected(capturedBody)
      : null;
    const failedRows = recordRowMetrics ? inferFailedRows(capturedBody) : null;
    const plannedContinuation =
      thrown == null && isPlannedContinuation(statusCode, capturedBody);
    const inferredFailure =
      !plannedContinuation && (thrown != null ||
      statusCode === 207 ||
      statusCode >= 400 ||
      inferFailure(capturedBody));

    if (
      opts?.includeFinalAuditReceipt &&
      capturedBody &&
      typeof capturedBody === "object" &&
      !Array.isArray(capturedBody)
    ) {
      const bodyWithReceipt = {
        ...(capturedBody as Record<string, unknown>),
        finalAudit: {
          owner: "withCronJobAudit",
          // A row is visible to readers only after this wrapper's insert
          // succeeds, so a durable row must not advertise a pending receipt.
          // The response is changed to `failed` below if the insert errors.
          status: "persisted",
        },
      };
      capturedBody = bodyWithReceipt;
      const pending = pendingResponse as {
        kind: "json" | "send";
        body: unknown;
      } | null;
      if (pending) {
        pendingResponse = {
          kind: pending.kind,
          body: bodyWithReceipt,
        };
      }
    }

    let finalAuditStatus: "persisted" | "failed" | "unverified" = "unverified";
    // A final-audit receipt promises a persisted row, so it never skips.
    const auditSkipped = thrown == null && !plannedContinuation && !inferredFailure &&
      statusCode >= 200 && statusCode < 300 && !opts?.includeFinalAuditReceipt &&
      opts?.skipAuditWhenNoOp?.(capturedBody) === true;

    const auditBody = opts?.responsePreviewKeys == null
      ? capturedBody
      : outcomeFields(capturedBody, opts.responsePreviewKeys.filter((key) =>
          Object.prototype.hasOwnProperty.call(capturedBody ?? {}, key)));
    const responsePreview = safeJson(auditBody, 4000);

    const row: CronAuditRow = {
      job_name: jobName,
      status: plannedContinuation
        ? "continued"
        : inferredFailure
          ? "failure"
          : "success",
      rows_affected: rowsUpserted,
      details: {
        invocationSource: req.headers?.["user-agent"] === "vercel-cron/1.0" ? "vercel-cron-claimed" : "unspecified",
        method: req.method ?? null,
        url: req.url ?? null,
        statusCode,
        durationMs,
        timing,
        rowsUpserted,
        failedRows,
        finalAudit: opts?.includeFinalAuditReceipt
          ? {
              owner: "withCronJobAudit",
              status: "persisted",
            }
          : null,
        error:
          thrown != null
            ? opts?.responsePreviewKeys != null
              ? "Handler failed."
              : ((thrown as any)?.message ?? safeJson(thrown, 2000))
            : null,
        response: responsePreview,
        responseTruncated: responsePreview?.endsWith("…") ?? false,
        responseOutcome: responseOutcome(auditBody),
        cronClassification: cronClassificationOf(res),
      },
    };

    try {
      if (!auditSkipped) try {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const query = supabase.from("cron_job_audit").insert(row as any);
        const pending = typeof query?.abortSignal === "function" ? query.abortSignal(controller.signal) : query;
        let acknowledgement: { error?: any };
        try {
          acknowledgement = await Promise.race([
            Promise.resolve(pending),
            new Promise<never>((_resolve, reject) => {
              timer = setTimeout(() => { controller.abort(); reject(new Error("Audit acknowledgement timed out; persistence outcome unverified")); }, 5000);
            }),
          ]);
        } finally { clearTimeout(timer); }
        const auditInsertError = acknowledgement?.error;
        if (acknowledgement && typeof acknowledgement === "object" && !Array.isArray(acknowledgement) &&
            Object.prototype.hasOwnProperty.call(acknowledgement, "error") && acknowledgement.error === null) {
          finalAuditStatus = "persisted";
        } else if (auditInsertError) {
          finalAuditStatus = "failed";
          console.error(
            "cron_job_audit insert failed",
            auditInsertError.message ??
              safeJson(auditInsertError, 2000) ??
              "Unknown audit insert error"
          );
        }
      } catch (e) {
        finalAuditStatus = "unverified";
        console.error("cron_job_audit insert failed", (e as any)?.message ?? e);
      }
    } finally {
      const responseToFlush = pendingResponse as {
        kind: "json" | "send";
        body: unknown;
      } | null;
      res.json = originalJson as any;
      if (originalSend) {
        res.send = originalSend as any;
      }
      if (auditSkipped) {
        // No receipt was promised or written; flush the handler response as is.
      } else if (opts?.includeFinalAuditReceipt && finalAuditStatus !== "persisted") {
        // Only routes promising a durable final receipt couple their response
        // to audit persistence. Other routes retain the handler's status/body;
        // audit failures are still logged above without retrying the write.
        res.status(503);
        pendingResponse = { kind: "json", body: cronAuditFailureResponse(
          responseToFlush?.body ?? capturedBody, statusCode, finalAuditStatus, "withCronJobAudit") };
      } else if (opts?.includeFinalAuditReceipt && responseToFlush?.body &&
          typeof responseToFlush.body === "object" && !Array.isArray(responseToFlush.body)) {
        pendingResponse = { ...responseToFlush, body: { ...responseToFlush.body,
          finalAudit: { owner: "withCronJobAudit", status: "persisted" } } };
      }
      const outgoing = pendingResponse as { kind: "json" | "send"; body: unknown } | null;
      if (outgoing?.kind === "json") originalJson(outgoing.body);
      else if (outgoing?.kind === "send" && originalSend) originalSend(outgoing.body);
    }
  };
}
