import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";

type AuditStatus = "success" | "failure";

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
      "count"
    ];

    for (const k of keys) {
      const n = tryNumber(obj[k]);
      if (n != null) return n;
    }

    for (const v of Object.values(obj)) {
      if (Array.isArray(v) && v.length > 0 && typeof v[0] !== "object") continue;
      const nested = visit(v);
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
  if (typeof b.error === "string" && b.error.trim()) return true;
  if (typeof b.message === "string" && /fail|error/i.test(b.message)) return true;
  return false;
}

function defaultJobName(req: NextApiRequest): string {
  const url = req.url ?? "";
  const pathOnly = url.split("?")[0]?.trim();
  return pathOnly || "unknown";
}

export function withCronJobAudit(
  handler: (req: any, res: any) => any,
  opts?: { jobName?: string }
): (req: any, res: any) => Promise<void> {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const startedAt = Date.now();
    const jobName = opts?.jobName ?? defaultJobName(req);

    let capturedBody: unknown = null;

    const originalJson = res.json.bind(res);
    res.json = ((body: any) => {
      capturedBody = body;
      return originalJson(body);
    }) as any;

    const originalSend = res.send.bind(res);
    res.send = ((body: any) => {
      if (capturedBody == null) capturedBody = body;
      return originalSend(body);
    }) as any;

    let thrown: unknown = null;
    try {
      await handler(req, res);
    } catch (err) {
      thrown = err;
      if (!res.headersSent) {
        res
          .status(500)
          .json({ success: false, error: (err as any)?.message ?? "Unknown error" });
      }
    }

    const durationMs = Date.now() - startedAt;
    const statusCode = res.statusCode;
    const inferredFailure =
      thrown != null || statusCode >= 400 || inferFailure(capturedBody);

    const row: CronAuditRow = {
      job_name: jobName,
      status: inferredFailure ? "failure" : "success",
      rows_affected: inferRowsAffected(capturedBody),
      details: {
        method: req.method ?? null,
        url: req.url ?? null,
        statusCode,
        durationMs,
        error:
          thrown != null
            ? ((thrown as any)?.message ?? safeJson(thrown, 2000))
            : null,
        response: safeJson(capturedBody, 4000)
      }
    };

    try {
      await supabase.from("cron_job_audit").insert(row as any);
    } catch (e) {
      console.error("cron_job_audit insert failed", (e as any)?.message ?? e);
    }
  };
}
