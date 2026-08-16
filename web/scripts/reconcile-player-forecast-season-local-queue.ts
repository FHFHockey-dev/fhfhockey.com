import { randomUUID } from "crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development.local" });

import { FANTASY_PROJECTION_SEASON_ID } from "../lib/fantasy-projections/contracts";
import { getServiceRoleClient } from "../lib/supabase/server";

function assertLocalOnly(): void {
  if (process.env.PLAYER_FORECAST_SEASON_IMPORT_CONFIRM !== "local-only") {
    throw new Error("PLAYER_FORECAST_SEASON_IMPORT_CONFIRM must equal local-only.");
  }
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(apiUrl)) {
    throw new Error("Season queue reconciliation is restricted to local Supabase.");
  }
}

async function hasImportedScope(client: any, runId: string, job: any): Promise<boolean> {
  if (job.fhfh_player_id != null) {
    const { count, error } = await client
      .from("player_forecast_season_player_aggregates")
      .select("id", { count: "exact", head: true })
      .eq("run_id", runId)
      .eq("fhfh_player_id", job.fhfh_player_id);
    if (error) throw error;
    return count === 1;
  }
  if (job.team_id != null) {
    const [teamResult, playerResult] = await Promise.all([
      client
        .from("player_forecast_season_team_aggregates")
        .select("id", { count: "exact", head: true })
        .eq("run_id", runId)
        .eq("team_id", job.team_id),
      client
        .from("player_forecast_season_player_aggregates")
        .select("id", { count: "exact", head: true })
        .eq("run_id", runId)
        .eq("team_id", job.team_id),
    ]);
    if (teamResult.error) throw teamResult.error;
    if (playerResult.error) throw playerResult.error;
    return teamResult.count === 1 && Number(playerResult.count ?? 0) > 0;
  }
  const [teamResult, playerResult] = await Promise.all([
    client
      .from("player_forecast_season_team_aggregates")
      .select("id", { count: "exact", head: true })
      .eq("run_id", runId),
    client
      .from("player_forecast_season_player_aggregates")
      .select("id", { count: "exact", head: true })
      .eq("run_id", runId),
  ]);
  if (teamResult.error) throw teamResult.error;
  if (playerResult.error) throw playerResult.error;
  return teamResult.count === 32 && Number(playerResult.count ?? 0) > 0;
}

async function main(): Promise<void> {
  assertLocalOnly();
  const client = getServiceRoleClient() as any;
  const ownerToken = randomUUID();
  let succeeded = 0;
  let failed = 0;

  for (;;) {
    const { data: jobs, error: claimError } = await client.rpc(
      "claim_player_forecast_season_jobs",
      { p_owner_token: ownerToken, p_limit: 50, p_lease_seconds: 800 },
    );
    if (claimError) throw claimError;
    if (!jobs?.length) break;

    for (const job of jobs) {
      let run: any = null;
      let errorSummary: string | null = null;
      try {
        const runResult = await client
          .from("player_forecast_season_runs")
          .select("id,source_high_watermark,status")
          .eq("season_id", job.season_id)
          .eq("view_key", job.view_key)
          .in("status", ["draft", "validated"])
          .gte("source_high_watermark", job.claimed_watermark)
          .order("source_high_watermark", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (runResult.error) throw runResult.error;
        run = runResult.data;
        if (!run || !(await hasImportedScope(client, run.id, job))) {
          errorSummary = "No checksum-verified imported run covers this job watermark and scope.";
        }
      } catch (error) {
        errorSummary = error instanceof Error ? error.message : String(error);
      }

      const { data: finished, error: finishError } = await client.rpc(
        "finish_player_forecast_season_job",
        {
          p_job_id: job.id,
          p_owner_token: ownerToken,
          p_succeeded: errorSummary == null,
          p_error_code: errorSummary == null ? null : "local_import_scope_missing",
          p_error_summary: errorSummary,
        },
      );
      if (finishError) throw finishError;
      if (finished.status === "succeeded") succeeded += 1;
      else if (finished.status === "failed") failed += 1;
    }
  }

  const { data: remaining, error: remainingError } = await client
    .from("player_forecast_season_queue")
    .select("id,status", { count: "exact" })
    .eq("season_id", FANTASY_PROJECTION_SEASON_ID)
    .in("status", ["pending", "running", "failed"]);
  if (remainingError) throw remainingError;
  const result = {
    seasonId: FANTASY_PROJECTION_SEASON_ID,
    succeeded,
    failed,
    remaining: remaining?.length ?? 0,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.failed > 0 || result.remaining > 0) {
    throw new Error("Season queue still contains dirty jobs.");
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
