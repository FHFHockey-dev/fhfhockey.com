import supabase from "lib/supabase/server";
import type { Json } from "lib/supabase/database-generated.types";

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

export const RUN_ACTIVE_WINDOW_MS = 10 * 60 * 1000;

type ForgeRunLifecycleRow = {
  run_id: string;
  as_of_date: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  metrics: Json | null;
};

type JsonObject = { [key: string]: Json | undefined };

function isJsonObject(value: Json | null): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseRunActivityTimestamp(row: {
  updated_at: string | null;
  created_at: string | null;
}): number | null {
  const updatedAt = row.updated_at ? Date.parse(row.updated_at) : Number.NaN;
  if (Number.isFinite(updatedAt)) return updatedAt;
  const createdAt = row.created_at ? Date.parse(row.created_at) : Number.NaN;
  return Number.isFinite(createdAt) ? createdAt : null;
}

export function getRunActivityAgeMs(
  row: Pick<ForgeRunLifecycleRow, "updated_at" | "created_at">,
  nowMs = Date.now()
): number | null {
  const activityTs = parseRunActivityTimestamp(row);
  if (activityTs == null) return null;
  return Math.max(0, nowMs - activityTs);
}

export function isRunningRunStale(
  row: Pick<ForgeRunLifecycleRow, "updated_at" | "created_at">,
  nowMs = Date.now(),
  staleAfterMs = RUN_ACTIVE_WINDOW_MS
): boolean {
  const ageMs = getRunActivityAgeMs(row, nowMs);
  return ageMs == null || ageMs > staleAfterMs;
}

function buildStaleRunMetrics(
  metrics: Json | null,
  staleAgeMs: number | null
): JsonObject {
  return {
    ...(isJsonObject(metrics) ? metrics : {}),
    finished_at: new Date().toISOString(),
    timed_out: true,
    stale_running_row_cleaned_up: true,
    stale_running_age_ms: staleAgeMs,
    error:
      "Projection run was marked failed after remaining in running status beyond the allowed active window."
  };
}

async function failStaleRunningRun(row: ForgeRunLifecycleRow, nowMs: number) {
  const staleAgeMs = getRunActivityAgeMs(row, nowMs);
  const { error } = await supabase
    .from("forge_runs")
    .update({
      status: "failed",
      metrics: buildStaleRunMetrics(row.metrics, staleAgeMs),
      updated_at: new Date(nowMs).toISOString()
    })
    .eq("run_id", row.run_id);
  if (error) throw error;
}

export async function createRun(asOfDate: string): Promise<string> {
  assertSupabase();
  const nowMs = Date.now();
  const { data: runningRows, error: runningError } = await supabase
    .from("forge_runs")
    .select("run_id,as_of_date,status,created_at,updated_at,metrics")
    .eq("as_of_date", asOfDate)
    .eq("status", "running")
    .order("created_at", { ascending: false })
    .limit(20);
  if (runningError) throw runningError;

  const rows = ((runningRows ?? []) as ForgeRunLifecycleRow[]).filter(
    (row) => row.status === "running"
  );
  const activeRows = rows.filter(
    (row) => !isRunningRunStale(row, nowMs, RUN_ACTIVE_WINDOW_MS)
  );
  const staleRows = rows.filter((row) =>
    isRunningRunStale(row, nowMs, RUN_ACTIVE_WINDOW_MS)
  );

  for (const staleRow of staleRows) {
    await failStaleRunningRun(staleRow, nowMs);
  }

  if (activeRows.length > 0) {
    const activeRow = activeRows[0];
    const activeAgeMs = getRunActivityAgeMs(activeRow, nowMs);
    const activeMinutes =
      activeAgeMs == null
        ? "unknown"
        : `${Math.max(1, Math.round(activeAgeMs / 60_000))}m`;
    const error = new Error(
      `Projection run already active for ${asOfDate} (run ${activeRow.run_id}, last activity ${activeMinutes} ago).`
    ) as Error & {
      code?: string;
      statusCode?: number;
    };
    error.code = "ACTIVE_RUN_EXISTS";
    error.statusCode = 409;
    throw error;
  }

  const { data, error } = await supabase
    .from("forge_runs")
    .insert({
      as_of_date: asOfDate,
      status: "running",
      git_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? null,
      metrics: {}
    })
    .select("run_id")
    .single<{ run_id: string }>();
  if (error) throw error;
  return data.run_id;
}

export async function finalizeRun(
  runId: string,
  status: "succeeded" | "failed",
  metrics: Json
) {
  assertSupabase();
  const { error } = await supabase
    .from("forge_runs")
    .update({ status, metrics, updated_at: new Date().toISOString() })
    .eq("run_id", runId);
  if (error) throw error;
}
