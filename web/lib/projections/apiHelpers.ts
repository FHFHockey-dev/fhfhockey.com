// Shared projection API validation and run lookup.
import { z } from "zod";

import supabase from "lib/supabase/server";
import { excludeOffReleaseRuns, restrictRunsToHorizon } from "./releasedRunFence";
import { loadExternalInputProof } from "./externalInputProof";

export const dateSchema = z
  .string({ required_error: "date is required" })
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u, "date must be YYYY-MM-DD");

export function getQueryStringParam(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

export function buildProjectionApiErrorResponse(
  error: unknown,
  stableInternalError: string,
): { statusCode: number; error: string; details?: unknown } {
  const statusCode = Number((error as any)?.statusCode) || 500;
  if (statusCode >= 500) {
    return { statusCode, error: stableInternalError };
  }
  return {
    statusCode,
    error: (error as any)?.message ?? String(error),
    ...((error as any)?.details === undefined
      ? {}
      : { details: (error as any).details }),
  };
}

export async function requireLatestSucceededRunId(
  asOfDate: string,
  horizonGames = 1,
): Promise<string> {
  if (!supabase) throw new Error("Supabase server client not available");
  const { data, error } = await restrictRunsToHorizon(excludeOffReleaseRuns(supabase
    .from("forge_runs")
    .select("run_id")
    .eq("as_of_date", asOfDate)
    .eq("status", "succeeded")), horizonGames)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const runId = (data as any)?.run_id as string | undefined;
  if (!runId) {
    const err = new Error(
      `No succeeded projection run found for date=${asOfDate}`,
    );
    (err as any).statusCode = 404;
    throw err;
  }
  return runId;
}

/** Recent runs of a date searched for one with external-input exclusion proof. */
const PROVEN_RUN_CANDIDATES = 20;

/** The latest succeeded released run of the date whose snapshot proves it excluded third-party fantasy inputs.
 * A newer unproven run is skipped, never served; with none proven the date has no run (404). */
export async function requireLatestExternalInputProvenRunId(
  asOfDate: string,
  horizonGames = 1,
): Promise<string> {
  if (!supabase) throw new Error("Supabase server client not available");
  const { data, error } = await restrictRunsToHorizon(excludeOffReleaseRuns(supabase
    .from("forge_runs")
    .select("run_id")
    .eq("as_of_date", asOfDate)
    .eq("status", "succeeded")), horizonGames)
    .order("created_at", { ascending: false })
    .limit(PROVEN_RUN_CANDIDATES);

  if (error) throw error;
  const runIds = ((data ?? []) as Array<{ run_id?: unknown }>)
    .map((row) => row.run_id)
    .filter((id): id is string => typeof id === "string");
  const proof = runIds.length ? await loadExternalInputProof(supabase, runIds) : new Map();
  const runId = runIds.find((id) => proof.has(id));
  if (!runId) {
    const err = new Error(
      runIds.length
        ? `No succeeded projection run with external-input exclusion proof found for date=${asOfDate}`
        : `No succeeded projection run found for date=${asOfDate}`,
    );
    (err as any).statusCode = 404;
    if (runIds.length) (err as any).details = { reason: "external_input_provenance_unproven", withheldRuns: runIds.length };
    throw err;
  }
  return runId;
}
