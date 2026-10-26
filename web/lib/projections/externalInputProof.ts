// Whether a FORGE run's output is proven free of third-party fantasy projection inputs (TJ, 2026-10-26).
// The proof is the run's captured input snapshot (`forge-run-inputs-v1`, written by saveForgeInputSnapshot), whose
// inputProvenance the live writer labels only when its own captured reads contain no fantasy source
// (run-forge-projections.ts `externalFantasyClaim`). Revision publishing copies that inputProvenance verbatim, so the
// detailed revision path (consumerRevisionAdmission.ts) checks the same claim and receipt. Run-start
// `forge_runs.metrics.input_provenance` never carries the claim, so it is not evidence either way.
//
// A run with no snapshot at all (production capture is off, TJ 2026-10-26) is proven instead when its code is, and only
// when it is a succeeded, released (full-SHA) run finished in exactly one invocation (`metrics.resume.invocations = 1`):
// the resumable writer (run-lifecycle-queries.ts) stamps `git_sha` once, at creation, and a later invocation, possibly of
// another release, may resume the run without restamping it.
//   - Stamped runs: `metrics.producer_identity` (forgeProducerIdentity.ts) records each invocation's producer closure
//     hash, defined only by a production build of the deployed source (never an env var, so unbuilt or local code
//     stamps null). It must hold exactly one invocation, with no `local:` code version, whose hash is in
//     VERIFIED_FORGE_PRODUCER_CLOSURES. The SHA never stands in for the stamp, so a next release with an unchanged
//     closure is admitted and a changed or unverified closure is not.
//   - Unstamped runs predate stamping: their exact SHA must be in VERIFIED_FORGE_RELEASES (538100d41 only). Any other
//     SHA without a stamp, or a malformed stamp, is unproven.
// A run that has a snapshot is judged by its snapshot alone: no verified release or closure overrides captured evidence.
// Absent, malformed or contradictory proof means not proven; historical rows stay stored, only unserved.
import type { SupabaseClient } from "@supabase/supabase-js";
import supabase from "lib/supabase/server";
import { acceptedNewsSupersedes } from "./acceptedNews";
import { FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } from "./calibrationEligibility";
import { excludeOffReleaseRuns, isOffReleaseGitSha, restrictRunsToHorizon } from "./releasedRunFence";
import { parseProducerIdentity } from "./forgeProducerIdentity";
import { verifiedForgeProducerClosure, verifiedForgeRelease } from "./verifiedForgeReleases";

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
  + "captured_reads:payload->inputProvenance->capturedReads,snapshot_code_version:payload->>codeVersion";
/** What attributes a snapshot-less run to its code: never its metrics' (absent) exclusion claim. */
const RUN_ATTRIBUTION_COLUMNS = "run_id,git_sha,status,invocations:metrics->resume->>invocations,"
  + "rolling_player_history_contract:metrics->input_provenance->>rolling_player_history_contract,"
  + "producer_identity:metrics->producer_identity";
const FULL_SHA = /^[0-9a-f]{40}$/;

/** The proven contracts, shaped as `input_provenance` so evaluateForgeCalibrationEligibility reads them, and the basis. */
export type ExternalInputProof = { rolling_player_history_contract: string | null;
  external_fantasy_input_contract: typeof FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT;
  basis: "captured_snapshot" | "verified_producer_closure" | "verified_release"; releaseSha?: string; closureSha256?: string };

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

type RunAttribution = { basis: "verified_producer_closure" | "verified_release"; releaseSha: string; closureSha256?: string };

/** One `forge_runs` row (selected with RUN_ATTRIBUTION_COLUMNS) attributed, as a whole, to verified producer code:
 * succeeded, released, one invocation, and either one verified stamped closure or (unstamped) a verified exact SHA. */
export function verifiedRunAttribution(row: Row): RunAttribution | null {
  if (typeof row?.run_id !== "string" || row.status !== "succeeded" || row.invocations !== "1"
    || typeof row.git_sha !== "string" || !FULL_SHA.test(row.git_sha)) return null;
  if (row.producer_identity !== null && row.producer_identity !== undefined) {
    // Closure admission needs the V2 stamp shape: one that predates `code_versions` (5a19f1def's env-based writer,
    // never deployed) cannot show it was not a local runner, so it denies (C7 R42 A4).
    if (!Array.isArray((row.producer_identity as { code_versions?: unknown }).code_versions)) return null;
    const stamp = parseProducerIdentity(row.producer_identity), closure = stamp?.invocations.length === 1 ? stamp.invocations[0] : null;
    // A `local:` code version marks a local runner, whatever SHA or closure the row also claims (C7 R40 V2).
    if (stamp?.code_versions.some(version => version?.startsWith("local:"))) return null;
    return closure && verifiedForgeProducerClosure(closure)
      ? { basis: "verified_producer_closure", releaseSha: row.git_sha, closureSha256: closure } : null;
  }
  const release = verifiedForgeRelease(row.git_sha);
  return release ? { basis: "verified_release", releaseSha: release.sha } : null;
}

/** Pure: a run with snapshots is proven only when every snapshot proves exclusion; a run with none, only when its
 * row is attributed to verified producer code (verifiedRunAttribution). */
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
      const attribution = run.length === 1 ? verifiedRunAttribution(run[0]) : null;
      if (attribution) proven.set(runId, { rolling_player_history_contract: typeof run[0].rolling_player_history_contract === "string"
        ? run[0].rolling_player_history_contract : null, external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT,
      ...attribution });
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

/** A run's standing (Astra F4; C7 R42 A7). `proven`. When verified-clean producer code captured the run but its
 * snapshot does not prove exclusion: `claim_withheld` when the snapshot lacks the claim (that code withholds it only
 * when its own reads included a fantasy or unaudited source), `malformed_capture` when it carries the claim but its
 * receipt or identity is invalid. Both are withheld. Otherwise `unproven`: missing proof, not contamination. */
export type ExternalInputProofStatus = "proven" | "unproven" | "claim_withheld" | "malformed_capture";
export type ClassifiedRunProof = { runId: string; status: ExternalInputProofStatus; proof: ExternalInputProof | null };

/** Pure: classifies runs from their snapshots and attribution rows (all of them, captured or not). */
export function classifyExternalInputProofRows(snapshots: Row[], runIds: readonly string[], runRows: Row[]): Map<string, ClassifiedRunProof> {
  const captured = new Set(snapshots.map(row => row.entity_key));
  const proven = externalInputProofByRun(snapshots, runIds, runRows.filter(row => !captured.has(row.run_id)));
  const verifiedProducer = (runId: string) => snapshots.some(row => row.entity_key === runId && verifiedForgeRelease(row.snapshot_code_version))
    || runRows.some(row => {
      if (row.run_id !== runId) return false;
      const stamp = parseProducerIdentity(row.producer_identity);
      return stamp?.invocations.length === 1 && Boolean(verifiedForgeProducerClosure(stamp.invocations[0]));
    });
  const classified = new Map<string, ClassifiedRunProof>();
  for (const runId of new Set(runIds)) {
    const proof = proven.get(runId) ?? null;
    const claimWithheld = snapshots.some(row => row.entity_key === runId && row.external_fantasy_input_contract !== FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT);
    classified.set(runId, { runId, proof, status: proof ? "proven"
      : captured.has(runId) && verifiedProducer(runId) ? claimWithheld ? "claim_withheld" : "malformed_capture" : "unproven" });
  }
  return classified;
}

/** Read-only: classifies `runIds` (two small reads). A failed read throws. */
export async function classifyExternalInputProof(db: SupabaseClient<any>, runIds: readonly string[]): Promise<Map<string, ClassifiedRunProof>> {
  const ids = [...new Set(runIds.filter(id => typeof id === "string" && id.length > 0))];
  const snapshots = await inChunks(ids, async chunk => rowsOf(await (db as any).from("player_forecast_source_observations")
    .select(PROOF_COLUMNS).eq("provider", FORGE_RUN_INPUT_SNAPSHOT.provider).eq("dataset_key", FORGE_RUN_INPUT_SNAPSHOT.datasetKey)
    .in("entity_key", chunk), "FORGE run input snapshot"));
  const runRows = await inChunks(ids, async chunk => rowsOf(await (db as any).from("forge_runs")
    .select(RUN_ATTRIBUTION_COLUMNS).in("run_id", chunk), "FORGE run attribution"));
  return classifyExternalInputProofRows(snapshots, ids, runRows);
}

/** What a served run's proof rests on, for response diagnostics (Astra F1 acceptance; C7 R40 V3). */
export type RunProofDiagnostics = { runId: string; basis: ExternalInputProof["basis"] | null; releaseSha: string | null;
  closureSha256: string | null };
export function runProofDiagnostics(runId: string, proof: ExternalInputProof | null | undefined): RunProofDiagnostics {
  return { runId, basis: proof?.basis ?? null, releaseSha: proof?.releaseSha ?? null, closureSha256: proof?.closureSha256 ?? null };
}

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

// Lives here, not in apiHelpers: run-projection-accuracy (inside the FORGE producer closure) imports apiHelpers, and
// admission must stay outside that closure (scripts/forge-producer-closure.ts ADMISSION_MODULES).
/** Recent runs of a date searched for one with external-input exclusion proof. */
const PROVEN_RUN_CANDIDATES = 20;

/** The latest succeeded released run of the date whose snapshot proves it excluded third-party fantasy inputs.
 * A newer unproven run is skipped, never served; with none proven the date has no run (404). */
export async function requireLatestExternalInputProvenRunId(asOfDate: string, horizonGames = 1): Promise<string> {
  return (await requireLatestExternalInputProvenRun(asOfDate, horizonGames)).runId;
}

/** An explicitly requested run, served only as a succeeded release with proof: 404 when there is no such run, 422 when
 * it failed, is still running, was made off the release path, or is unproven. */
export async function requireExternalInputProvenRun(runId: string): Promise<{ runId: string; proof: ExternalInputProof }> {
  if (!supabase) throw new Error("Supabase server client not available");
  const { data: selectedRun, error: runError } = await supabase
    .from("forge_runs").select("run_id,status,git_sha").eq("run_id", runId).maybeSingle();
  if (runError) throw runError;
  if (!selectedRun) throw Object.assign(new Error("Selected projection run was not found."), { statusCode: 404 });
  if ((selectedRun as { status?: unknown }).status !== "succeeded"
    || isOffReleaseGitSha((selectedRun as { git_sha?: string | null }).git_sha)) {
    throw Object.assign(new Error("Selected projection run is not a succeeded released run."), { statusCode: 422,
      details: { reason: "run_not_succeeded_release" } });
  }
  const proof = (await loadExternalInputProof(supabase, [runId])).get(runId);
  if (!proof) {
    throw Object.assign(new Error("Selected projection run lacks external fantasy exclusion provenance."), { statusCode: 422,
      details: { reason: "external_input_provenance_unproven" } });
  }
  return { runId, proof };
}

/** As requireLatestExternalInputProvenRunId, with the selected run's proof. */
export async function requireLatestExternalInputProvenRun(
  asOfDate: string,
  horizonGames = 1,
): Promise<{ runId: string; proof: ExternalInputProof }> {
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
  return { runId, proof: proof.get(runId)! };
}
