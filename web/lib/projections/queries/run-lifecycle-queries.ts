import supabase from "lib/supabase/server";

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

export async function createRun(asOfDate: string): Promise<string> {
  assertSupabase();
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
  metrics: any
) {
  assertSupabase();
  const { error } = await supabase
    .from("forge_runs")
    .update({ status, metrics, updated_at: new Date().toISOString() })
    .eq("run_id", runId);
  if (error) throw error;
}
