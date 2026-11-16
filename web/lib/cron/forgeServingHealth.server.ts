import type { SupabaseClient } from "@supabase/supabase-js";

import { loadExternalInputProof, verifiedRunAttribution } from "lib/projections/externalInputProof";
import { isOffReleaseGitSha, restrictRunsToHorizon } from "lib/projections/releasedRunFence";
import { buildRollingForgeRunScopeKey, readRollingForgeRunState } from "lib/rollingForgePipelineRunState";
import {
  assessForgeServingHealth,
  etDate,
  FORGE_SERVING_PIPELINE_MODE,
  type ForgeServingHealth,
  type ForgeServingRunRow,
  type ForgeServingStageState,
} from "./forgeServingHealth";

/** The readers' attribution columns (externalInputProof.ts RUN_ATTRIBUTION_COLUMNS) plus creation time and scope. */
export const FORGE_SERVING_RUN_COLUMNS = "run_id,status,git_sha,created_at,invocations:metrics->resume->>invocations,"
  + "rolling_player_history_contract:metrics->input_provenance->>rolling_player_history_contract,"
  + "producer_identity:metrics->producer_identity,execution_mode:metrics->execution_scope->>mode,"
  + "scope_key:metrics->resume->>scope_key";
/** A date has a handful of h1 runs (one per daily pipeline that reached it, plus single-game reruns). */
const RUN_LIMIT = 30;

const errorText = (error: unknown) => (error instanceof Error ? error.message
  : typeof (error as { message?: unknown })?.message === "string" ? (error as { message: string }).message : String(error));

/**
 * Read-only report adapter; never throws. Two bounded reads always: today's h1 `forge_runs` (indexed on as_of_date,
 * at most 30 rows) and today's rolling pipeline stage rows (primary-key prefix). Only when the verdict would alert and
 * a succeeded released run lacks closure attribution does it confirm through the readers' loadExternalInputProof (one
 * or two more small reads), so a run proven by a captured snapshot is never reported as withheld.
 */
export async function readForgeServingHealth(input: {
  client: SupabaseClient;
  now: Date;
  seasonState: "in_season" | "off_season" | "unknown";
  deadlineAt: number;
}): Promise<ForgeServingHealth> {
  const { client, now, seasonState } = input;
  const date = etDate(now);
  const notes: string[] = [];
  const assess = (runs: ForgeServingRunRow[] | null, stages: Map<string, ForgeServingStageState> | null,
    provenRunIds?: Set<string>) => assessForgeServingHealth({ date, now, seasonState, runs, stages, provenRunIds, notes });
  if (seasonState === "off_season") return assess([], null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), Math.max(0, input.deadlineAt - Date.now()));
  });
  const withDeadline = <T>(work: Promise<T>) => Promise.race([work, deadline]);
  try {
    const runsRead = withDeadline((async () => {
      const { data, error } = await restrictRunsToHorizon((client as any).from("forge_runs")
        .select(FORGE_SERVING_RUN_COLUMNS).eq("as_of_date", date), 1)
        .order("created_at", { ascending: false }).limit(RUN_LIMIT);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("forge_runs read returned no rows array");
      return data as ForgeServingRunRow[];
    })());
    const stagesRead = withDeadline(readRollingForgeRunState({ supabase: client as any,
      scopeKey: buildRollingForgeRunScopeKey(FORGE_SERVING_PIPELINE_MODE, date) }));
    const [runsResult, stagesResult] = await Promise.allSettled([runsRead, stagesRead]);
    let runs: ForgeServingRunRow[] | null = null;
    if (runsResult.status === "rejected") notes.push(`FORGE runs unavailable: ${errorText(runsResult.reason)}`);
    else if (runsResult.value === "timeout") notes.push("FORGE runs read timed out.");
    else runs = runsResult.value;
    let stages: Map<string, ForgeServingStageState> | null = null;
    if (stagesResult.status === "rejected") notes.push(`Rolling pipeline state unavailable: ${errorText(stagesResult.reason)}`);
    else if (stagesResult.value === "timeout") notes.push("Rolling pipeline state read timed out.");
    else stages = stagesResult.value;

    const health = assess(runs, stages);
    const unattributed = (runs ?? []).filter(row => row.status === "succeeded" && !isOffReleaseGitSha(row.git_sha)
      && verifiedRunAttribution(row) === null).map(row => row.run_id);
    if ((health.status !== "critical" && health.status !== "warning") || !unattributed.length) return health;
    // Confirm with the readers' full proof (captured snapshots) before alerting.
    const proof = await withDeadline(loadExternalInputProof(client as any, unattributed)).catch((error: unknown) => error);
    if (proof instanceof Map) return assess(runs, stages, new Set(proof.keys()));
    notes.push(proof === "timeout" ? "Snapshot proof read timed out; the verdict rests on closure attribution only."
      : `Snapshot proof read failed (${errorText(proof)}); the verdict rests on closure attribution only.`);
    return assess(runs, stages);
  } catch (error) {
    notes.push(`FORGE serving check failed: ${errorText(error)}`);
    return assess(null, null);
  } finally {
    clearTimeout(timer);
  }
}
