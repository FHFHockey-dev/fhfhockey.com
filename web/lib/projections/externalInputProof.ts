// Whether a FORGE run's output is proven free of third-party fantasy projection inputs (TJ, 2026-10-26).
// The proof is the run's captured input snapshot (`forge-run-inputs-v1`, written by saveForgeInputSnapshot), whose
// inputProvenance the live writer labels only when its own captured reads contain no fantasy source
// (run-forge-projections.ts `externalFantasyClaim`). Revision publishing copies that inputProvenance verbatim, so the
// detailed revision path (consumerRevisionAdmission.ts) checks the same claim and receipt. Run-start
// `forge_runs.metrics.input_provenance` never carries the claim, so it is not evidence either way.
//
// A run with no snapshot at all (production capture is off, TJ 2026-10-26) is proven instead when its code is: its
// `forge_runs.git_sha` is an exact SHA in VERIFIED_FORGE_RELEASES and that SHA can be trusted to name the code that did
// all of the run's work. The resumable writer (run-lifecycle-queries.ts `insertRunningRun`) stamps `git_sha` once, at
// creation, from the executing deployment's `VERCEL_GIT_COMMIT_SHA` (then `GIT_SHA`, else `local:unknown`), and a later
// invocation, possibly of another release, may resume the run without restamping it. So only a succeeded run finished
// in exactly one invocation (`metrics.resume.invocations = 1`) is attributed by SHA. A run that has a snapshot is judged
// by its snapshot alone: a verified release never overrides captured evidence.
// Absent, malformed or contradictory proof means not proven; historical rows stay stored, only unserved.
import type { SupabaseClient } from "@supabase/supabase-js";
import { acceptedNewsSupersedes } from "./acceptedNews";
import { FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } from "./calibrationEligibility";
import { verifiedForgeRelease } from "./verifiedForgeReleases";

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
/** What attributes a snapshot-less run to its code: never its metrics' (absent) exclusion claim. */
const RUN_ATTRIBUTION_COLUMNS = "run_id,git_sha,status,invocations:metrics->resume->>invocations,"
  + "rolling_player_history_contract:metrics->input_provenance->>rolling_player_history_contract";

/** The proven contracts, shaped as `input_provenance` so evaluateForgeCalibrationEligibility reads them, and the basis. */
export type ExternalInputProof = { rolling_player_history_contract: string | null;
  external_fantasy_input_contract: typeof FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT;
  basis: "captured_snapshot" | "verified_release"; releaseSha?: string };

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

/** One `forge_runs` row (selected with RUN_ATTRIBUTION_COLUMNS) whose exact recorded SHA is a verified release and
 * names all of its work: succeeded, in a single invocation. */
export function runAttributedToVerifiedRelease(row: Row): string | null {
  const release = verifiedForgeRelease(row?.git_sha);
  return release && typeof row.run_id === "string" && row.status === "succeeded" && row.invocations === "1" ? release.sha : null;
}

/** Pure: a run with snapshots is proven only when every snapshot proves exclusion; a run with none, only when its
 * row is attributed to a verified release. */
export function externalInputProofByRun(rows: Row[], runIds: readonly string[], runRows: Row[] = []): Map<string, ExternalInputProof> {
  const byRun = new Map<string, Row[]>();
  for (const row of rows) if (typeof row?.entity_key === "string") byRun.set(row.entity_key, [...(byRun.get(row.entity_key) ?? []), row]);
  const runsById = new Map<string, Row[]>();
  for (const row of runRows) if (typeof row?.run_id === "string") runsById.set(row.run_id, [...(runsById.get(row.run_id) ?? []), row]);
  const proven = new Map<string, ExternalInputProof>();
  for (const runId of new Set(runIds)) {
    const snapshots = byRun.get(runId) ?? [];
    if (!snapshots.length) {
      const run = runsById.get(runId) ?? [];
      const releaseSha = run.length === 1 ? runAttributedToVerifiedRelease(run[0]) : null;
      if (releaseSha) proven.set(runId, { rolling_player_history_contract: typeof run[0].rolling_player_history_contract === "string"
        ? run[0].rolling_player_history_contract : null, external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT,
      basis: "verified_release", releaseSha });
      continue;
    }
    if (!snapshots.every(snapshotProvesExternalInputExclusion)) continue;
    const rolling = new Set(snapshots.map(row => typeof row.rolling_player_history_contract === "string" ? row.rolling_player_history_contract : null));
    proven.set(runId, { rolling_player_history_contract: rolling.size === 1 ? [...rolling][0] : null,
      external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT, basis: "captured_snapshot" });
  }
  return proven;
}

const inChunks = <T>(ids: string[], read: (chunk: string[]) => Promise<T[]>) => Promise.all(Array.from(
  { length: Math.ceil(ids.length / PROOF_READ_CHUNK) }, (_, index) => read(ids.slice(index * PROOF_READ_CHUNK, (index + 1) * PROOF_READ_CHUNK))))
  .then(parts => parts.flat());
const rowsOf = ({ data, error }: { data: unknown; error: unknown }, what: string) => {
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error(`${what} read is incomplete`);
  return data as Row[];
};

/** Read-only: the proven runs among `runIds`. Only runs with no snapshot have their attribution read. A failed read
 * throws; callers treat it as unproven, never as proven. */
export async function loadExternalInputProof(db: SupabaseClient<any>, runIds: readonly string[]): Promise<Map<string, ExternalInputProof>> {
  const ids = [...new Set(runIds.filter(id => typeof id === "string" && id.length > 0))];
  const snapshots = await inChunks(ids, async chunk => rowsOf(await (db as any).from("player_forecast_source_observations")
    .select(PROOF_COLUMNS).eq("provider", FORGE_RUN_INPUT_SNAPSHOT.provider).eq("dataset_key", FORGE_RUN_INPUT_SNAPSHOT.datasetKey)
    .in("entity_key", chunk), "FORGE run input snapshot"));
  const captured = new Set(snapshots.map(row => row.entity_key));
  const uncaptured = ids.filter(id => !captured.has(id));
  const runRows = await inChunks(uncaptured, async chunk => rowsOf(await (db as any).from("forge_runs")
    .select(RUN_ATTRIBUTION_COLUMNS).in("run_id", chunk), "FORGE run attribution"));
  return externalInputProofByRun(snapshots, ids, runRows);
}
