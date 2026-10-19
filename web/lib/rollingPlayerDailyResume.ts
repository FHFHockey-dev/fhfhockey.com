import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "lib/supabase/database-generated.types";

/**
 * Resume cursor for the implicit daily rolling recompute.
 *
 * Each implicit-window run puts this marker first in its response body, so
 * `withCronJobAudit` keeps it inside the stored response preview. A later run
 * with `continueDailyWindow=true` reads today's newest marker for the same
 * window and continues after `nextResumeFrom`. A run killed before it answers
 * leaves no marker, so the next run repeats that work rather than skipping it.
 */
export type RollingDailyResumeCursor = {
  v: 1;
  windowStartDate: string;
  windowEndDate: string;
  strengths: string;
  status: "partial" | "complete";
  nextResumeFrom: number | null;
};

export type RollingDailyResumeState =
  | { state: "start" }
  | { state: "resume"; resumeFrom: number }
  | { state: "complete" };

const CURSOR_PATTERN = /"resumeCursor":(\{[^{}]*\})/;
const AUDIT_ROWS_TO_SCAN = 20;

export function formatRollingDailyStrengthKey(
  strengths: readonly string[] | undefined
): string {
  return strengths?.length ? [...strengths].sort().join(",") : "default";
}

export function parseRollingDailyResumeCursor(
  responsePreview: unknown
): RollingDailyResumeCursor | null {
  if (typeof responsePreview !== "string") return null;
  const match = CURSOR_PATTERN.exec(responsePreview);
  if (!match) return null;
  try {
    const cursor = JSON.parse(match[1]) as Partial<RollingDailyResumeCursor>;
    if (
      cursor.v !== 1 ||
      typeof cursor.windowStartDate !== "string" ||
      typeof cursor.windowEndDate !== "string" ||
      typeof cursor.strengths !== "string" ||
      (cursor.status !== "partial" && cursor.status !== "complete") ||
      (cursor.nextResumeFrom !== null &&
        !Number.isInteger(cursor.nextResumeFrom))
    ) {
      return null;
    }
    return cursor as RollingDailyResumeCursor;
  } catch {
    return null;
  }
}

export async function readRollingDailyResumeState(args: {
  client: SupabaseClient<Database>;
  jobName: string;
  windowStartDate: string;
  windowEndDate: string;
  strengths: string;
}): Promise<RollingDailyResumeState> {
  const { data, error } = await args.client
    .from("cron_job_audit")
    .select("run_time, details")
    .eq("job_name", args.jobName)
    .gte("run_time", `${args.windowEndDate}T00:00:00.000Z`)
    .order("run_time", { ascending: false })
    .limit(AUDIT_ROWS_TO_SCAN);
  if (error) {
    throw new Error(
      `Could not read the daily rolling resume cursor: ${error.message}`
    );
  }

  for (const row of data ?? []) {
    const details = row.details as { response?: unknown } | null;
    const cursor = parseRollingDailyResumeCursor(details?.response);
    if (
      !cursor ||
      cursor.windowStartDate !== args.windowStartDate ||
      cursor.windowEndDate !== args.windowEndDate ||
      cursor.strengths !== args.strengths
    ) {
      continue;
    }
    if (cursor.status === "complete") return { state: "complete" };
    return cursor.nextResumeFrom == null
      ? { state: "start" }
      : { state: "resume", resumeFrom: cursor.nextResumeFrom };
  }
  return { state: "start" };
}
