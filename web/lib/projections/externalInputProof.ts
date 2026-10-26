// Whether a FORGE run's output is proven free of third-party fantasy projection inputs (TJ, 2026-10-26).
// The proof is the run's captured input snapshot (`forge-run-inputs-v1`, written by saveForgeInputSnapshot), whose
// inputProvenance the live writer labels only when its own captured reads contain no fantasy source
// (run-forge-projections.ts `externalFantasyClaim`). Revision publishing copies that inputProvenance verbatim, so the
// detailed revision path (consumerRevisionAdmission.ts) checks the same claim and receipt. Run-start
// `forge_runs.metrics.input_provenance` never carries the claim, so it is not evidence either way.
// Absent, malformed or contradictory proof means not proven; historical rows stay stored, only unserved.
import type { SupabaseClient } from "@supabase/supabase-js";
import { acceptedNewsSupersedes } from "./acceptedNews";
import { FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } from "./calibrationEligibility";

type Row = Record<string, any>;

export const FORGE_RUN_INPUT_SNAPSHOT = { provider: "forge", datasetKey: "forge-run-inputs-v1" } as const;
/** Limitation and message text for output withheld for lack of proof. */
export const UNPROVEN_EXTERNAL_INPUT_MESSAGE =
  "FORGE output whose run cannot prove it excluded third-party fantasy projections is unavailable.";
/** Ids per proof read, keeping each request URL short. */
const PROOF_READ_CHUNK = 100;
/** Small projections of the snapshot payload: never the captured reads themselves. */
const PROOF_COLUMNS = "entity_key,available_at,snapshot_version:payload->>version,snapshot_run_id:payload->>runId,"
  + "rolling_player_history_contract:payload->inputProvenance->>rolling_player_history_contract,"
  + "external_fantasy_input_contract:payload->inputProvenance->>external_fantasy_input_contract,"
  + "captured_reads:payload->inputProvenance->capturedReads";

/** The proven contracts, shaped as `input_provenance` so evaluateForgeCalibrationEligibility reads them. */
export type ExternalInputProof = { rolling_player_history_contract: string | null;
  external_fantasy_input_contract: typeof FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT };

/** The captured-read receipt as consumerRevisionAdmission requires it, issued no later than `notAfter`. */
export function validCapturedReadReceipt(receipt: unknown, notAfter: string): boolean {
  const value = receipt as Row | null | undefined;
  return Boolean(value) && value!.version === "forge-captured-reads-v1" && typeof value!.hash === "string"
    && /^[a-f0-9]{64}$/.test(value!.hash) && Number.isSafeInteger(value!.readCount) && value!.readCount >= 1
    && Number.isFinite(Date.parse(value!.firstReceivedAt)) && Number.isFinite(Date.parse(value!.lastReceivedAt))
    && !acceptedNewsSupersedes(value!.firstReceivedAt, value!.lastReceivedAt)
    && !acceptedNewsSupersedes(value!.lastReceivedAt, notAfter);
}

/** One snapshot row (selected with PROOF_COLUMNS) proves its own run's exclusion. */
export function snapshotProvesExternalInputExclusion(row: Row): boolean {
  return typeof row?.entity_key === "string" && row.snapshot_run_id === row.entity_key
    && row.snapshot_version === "forge-inputs-v1"
    && row.external_fantasy_input_contract === FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT
    && typeof row.available_at === "string" && Number.isFinite(Date.parse(row.available_at))
    && validCapturedReadReceipt(row.captured_reads, row.available_at);
}

/** Pure: a run is proven only when it has a snapshot and every snapshot it has proves exclusion. */
export function externalInputProofByRun(rows: Row[], runIds: readonly string[]): Map<string, ExternalInputProof> {
  const byRun = new Map<string, Row[]>();
  for (const row of rows) if (typeof row?.entity_key === "string") byRun.set(row.entity_key, [...(byRun.get(row.entity_key) ?? []), row]);
  const proven = new Map<string, ExternalInputProof>();
  for (const runId of new Set(runIds)) {
    const snapshots = byRun.get(runId) ?? [];
    if (!snapshots.length || !snapshots.every(snapshotProvesExternalInputExclusion)) continue;
    const rolling = new Set(snapshots.map(row => typeof row.rolling_player_history_contract === "string" ? row.rolling_player_history_contract : null));
    proven.set(runId, { rolling_player_history_contract: rolling.size === 1 ? [...rolling][0] : null,
      external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT });
  }
  return proven;
}

/** Read-only: the proven runs among `runIds`. A failed read throws; callers treat it as unproven, never as proven. */
export async function loadExternalInputProof(db: SupabaseClient<any>, runIds: readonly string[]): Promise<Map<string, ExternalInputProof>> {
  const ids = [...new Set(runIds.filter(id => typeof id === "string" && id.length > 0))];
  const chunks = Array.from({ length: Math.ceil(ids.length / PROOF_READ_CHUNK) }, (_, index) =>
    ids.slice(index * PROOF_READ_CHUNK, (index + 1) * PROOF_READ_CHUNK));
  const results = await Promise.all(chunks.map(async chunk => {
    const { data, error } = await (db as any).from("player_forecast_source_observations").select(PROOF_COLUMNS)
      .eq("provider", FORGE_RUN_INPUT_SNAPSHOT.provider).eq("dataset_key", FORGE_RUN_INPUT_SNAPSHOT.datasetKey)
      .in("entity_key", chunk);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("FORGE run input snapshot read is incomplete");
    return data as Row[];
  }));
  return externalInputProofByRun(results.flat(), ids);
}
