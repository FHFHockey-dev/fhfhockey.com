import { z } from "zod";

import supabase from "lib/supabase/server";

export const dateSchema = z
  .string({ required_error: "date is required" })
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u, "date must be YYYY-MM-DD");

export function getQueryStringParam(
  value: string | string[] | undefined
): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

export async function requireLatestSucceededRunId(asOfDate: string): Promise<string> {
  if (!supabase) throw new Error("Supabase server client not available");
  const { data, error } = await supabase
    .from("forge_runs")
    .select("run_id")
    .eq("as_of_date", asOfDate)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const runId = (data as any)?.run_id as string | undefined;
  if (!runId) {
    const err = new Error(`No succeeded projection run found for date=${asOfDate}`);
    (err as any).statusCode = 404;
    throw err;
  }
  return runId;
}
