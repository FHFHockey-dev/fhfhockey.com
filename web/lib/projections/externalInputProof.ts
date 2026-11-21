// Whether a FORGE run's output is proven free of third-party fantasy projection inputs (TJ, 2026-10-26).
// The proof is the run's captured input snapshot (`forge-run-inputs-v1`, written by saveForgeInputSnapshot), whose
// inputProvenance the live writer labels only when its own captured reads contain no fantasy source
// (run-forge-projections.ts `externalFantasyClaim`). Revision publishing copies that inputProvenance verbatim, so the
// detailed revision path (consumerRevisionAdmission.ts) checks the same claim and receipt. Run-start
// `forge_runs.metrics.input_provenance` never carries the claim, so it is not evidence either way.
//
// A run with no snapshot at all (production capture is off, TJ 2026-10-26) is proven instead when its code is, and only
// when it is a succeeded, released (full-SHA) run whose every invocation is attributable: the resumable writer
// (run-lifecycle-queries.ts) stamps `git_sha` once, at creation, and a later invocation, possibly of another release,
// may resume the run without restamping it, so the SHA alone covers only a single-invocation run.
//   - Stamped runs: `metrics.producer_identity` (forgeProducerIdentity.ts) records each invocation's producer closure
//     hash, defined only by a production build of the deployed source (never an env var, so unbuilt or local code
//     stamps null). It needs one entry per invocation, all the same hash, no `local:` code version, and that hash in
//     VERIFIED_FORGE_PRODUCER_CLOSURES. The SHA never stands in for the stamp, so a next release with an unchanged
//     closure is admitted and a changed or unverified closure is not.
//   - Unstamped runs predate stamping: their exact SHA must be in VERIFIED_FORGE_RELEASES (538100d41 only). Any other
//     SHA without a stamp, or a malformed stamp, is unproven.
// A run that has a snapshot is judged by its snapshot alone: no verified release or closure overrides captured evidence.
// Absent, malformed or contradictory proof means not proven; historical rows stay stored, only unserved.
import type { SupabaseClient } from "@supabase/supabase-js";
import { forgeEnvScoped } from "./forgeScopeProbe";
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
const PROOF_COLUMNS = "entity_key,available_at,snapshot_version:payload->>version,snapshot_run_id:payload->>runId,snapshot_kind:payload->>snapshotKind,"
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
  // A pregame publication proves its exclusion only to its own game-scoped readback (forgeScopeProbe.ts).
  if (row?.snapshot_kind === "qualified_pregame_receipt" && !forgeEnvScoped()) return false;
  return typeof row?.entity_key === "string" && row.snapshot_run_id === row.entity_key
    && row.snapshot_version === "forge-inputs-v1"
    && row.external_fantasy_input_contract === FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT
    && typeof row.available_at === "string" && Number.isFinite(Date.parse(row.available_at))
    && validCapturedReadReceipt(row.captured_reads, row.available_at);
}

type RunAttribution = { basis: "verified_producer_closure" | "verified_release"; releaseSha: string; closureSha256?: string };

/** One `forge_runs` row (selected with RUN_ATTRIBUTION_COLUMNS) attributed, as a whole, to verified producer code:
 * succeeded, released, and either
 *   - stamped: one stamp entry per invocation (the count equals `metrics.resume.invocations`), every entry the same
 *     verified closure (none null or unknown) and no `local:` code version; a resumed run whose invocations all ran the
 *     same verified closure is one producer, so it is admitted too; or
 *   - unstamped (predates stamping): a single invocation of a verified exact SHA, since it has no per-invocation proof. */
export function verifiedRunAttribution(row: Row): RunAttribution | null {
  if (typeof row?.run_id !== "string" || row.status !== "succeeded"
    || typeof row.git_sha !== "string" || !FULL_SHA.test(row.git_sha)) return null;
  if (row.producer_identity !== null && row.producer_identity !== undefined) {
    // Closure admission needs the V2 stamp shape: one that predates `code_versions` (5a19f1def's env-based writer,
    // never deployed) cannot show it was not a local runner, so it denies (C7 R42 A4).
    if (!Array.isArray((row.producer_identity as { code_versions?: unknown }).code_versions)) return null;
    const stamp = parseProducerIdentity(row.producer_identity);
    if (!stamp || String(stamp.invocations.length) !== row.invocations) return null;
    // A `local:` code version marks a local runner, whatever SHA or closure the row also claims (C7 R40 V2). A null
    // version is the deployed writer's normal value (only the local runner sets FORGE_CODE_VERSION).
    if (stamp.code_versions.some(version => version?.startsWith("local:"))) return null;
    const closure = stamp.invocations[0];
    return closure !== null && stamp.invocations.every(entry => entry === closure) && verifiedForgeProducerClosure(closure)
      ? { basis: "verified_producer_closure", releaseSha: row.git_sha, closureSha256: closure } : null;
  }
  const release = row.invocations === "1" ? verifiedForgeRelease(row.git_sha) : null;
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

/** What a forge_runs read selects to tell a full-slate run from a selected_games rerun (H3, audit 2026-11-16). */
export const RUN_SCOPE_COLUMNS = "execution_scope:metrics->execution_scope,scope_key:metrics->resume->>scope_key";

/** The games a selected_games rerun projected: `metrics.execution_scope.requested_game_ids`, else the ids in its resume
 * scope key (`h<N>:<ids>`). Null for a full-slate run, and for a run that records no scope (older runs were all full). */
export function forgeRunScopedGameIds(row: { execution_scope?: unknown; scope_key?: unknown } | null | undefined): number[] | null {
  const scope = row?.execution_scope as { mode?: unknown; requested_game_ids?: unknown } | null | undefined;
  const ids = (values: unknown[]) => [...new Set(values.map(Number).filter(id => Number.isSafeInteger(id) && id > 0))].sort((a, b) => a - b);
  if (Array.isArray(scope?.requested_game_ids) && scope!.requested_game_ids.length) return ids(scope!.requested_game_ids);
  const key = typeof row?.scope_key === "string" ? /^h\d+:(\d+(?:,\d+)*)$/.exec(row.scope_key) : null;
  if (key) return ids(key[1].split(","));
  return scope?.mode === "selected_games" ? [] : null;
}

/** Which run serves each game of one date: the base (full-slate) run, and newer selected_games runs (newest first),
 * each over its own games. */
export type RunsByGame = { baseRunId: string | null; overlays: Array<{ runId: string; gameIds: number[] }> };
/** A newer selected_games run laid over the date's full-slate run: it serves only its own games. */
export type ProvenRunOverlay = { runId: string; proof: ExternalInputProof; gameIds: number[] };
/** RunsByGame over proven runs only: the newest proven full-slate run (null when the date has none) and the proven
 * selected_games runs newer than it. */
export type ProvenRunsByGame = { baseRunId: string | null; overlays: ProvenRunOverlay[] };

type ScopedRunRow = { run_id: string; execution_scope?: unknown; scope_key?: unknown };

/** Pure (H3): from one date's admitted runs, newest first, the newest full-slate run and every selected_games run newer
 * than it. Older runs are superseded by that slate run. A selected_games run with no game ids serves nothing. */
export function selectRunsByGame(rowsNewestFirst: ScopedRunRow[]): RunsByGame {
  const overlays: RunsByGame["overlays"] = [];
  for (const row of rowsNewestFirst) {
    const gameIds = forgeRunScopedGameIds(row);
    if (gameIds === null) return { baseRunId: row.run_id, overlays };
    if (gameIds.length) overlays.push({ runId: row.run_id, gameIds });
  }
  return { baseRunId: null, overlays };
}

/** Pure (H3): selectRunsByGame over the proven runs only; an unproven run is never selected, whatever its scope. */
export function selectProvenRunsByGame(rowsNewestFirst: ScopedRunRow[], proof: ReadonlyMap<string, ExternalInputProof>): ProvenRunsByGame {
  const selected = selectRunsByGame(rowsNewestFirst.filter(row => proof.has(row.run_id)));
  return { baseRunId: selected.baseRunId, overlays: selected.overlays.map(overlay => ({ ...overlay, proof: proof.get(overlay.runId)! })) };
}

/** The run ids whose output rows a per-game reader reads: the base run, then the overlays. */
export function provenRunIdsByGame(runs: RunsByGame): string[] {
  return [...(runs.baseRunId ? [runs.baseRunId] : []), ...runs.overlays.map(overlay => overlay.runId)];
}

/** Pure (H3): keeps each output row only from the run that serves its game. A game belongs to the newest overlay that
 * requested it and has rows for it; every other game belongs to the base run. A player the rerun dropped is not kept
 * from the slate run, and an overlay that wrote nothing for a game does not hide the slate run's rows for it. */
export function keepRowsOfServingRun<R extends { run_id?: unknown; game_id?: unknown }>(rows: R[], runs: RunsByGame): R[] {
  if (!runs.overlays.length) return runs.baseRunId ? rows.filter(row => row.run_id === runs.baseRunId) : [];
  const withRows = new Set(rows.map(row => `${String(row.run_id)}|${Number(row.game_id)}`));
  const owner = new Map<number, string>();
  for (const overlay of runs.overlays) for (const gameId of overlay.gameIds) {
    if (!owner.has(gameId) && withRows.has(`${overlay.runId}|${gameId}`)) owner.set(gameId, overlay.runId);
  }
  return rows.filter(row => row.run_id === (owner.get(Number(row.game_id)) ?? runs.baseRunId));
}

/** As requireLatestExternalInputProvenRunId, with the selected run's proof. `runId` is the date's newest proven
 * full-slate run (else its newest proven selected_games run); `runsByGame` adds the newer proven selected_games runs,
 * each serving only its own games (H3). */
export async function requireLatestExternalInputProvenRun(
  asOfDate: string,
  horizonGames = 1,
): Promise<{ runId: string; proof: ExternalInputProof; runsByGame: ProvenRunsByGame }> {
  if (!supabase) throw new Error("Supabase server client not available");
  const { data, error } = await restrictRunsToHorizon(excludeOffReleaseRuns(supabase
    .from("forge_runs")
    .select(`run_id,${RUN_SCOPE_COLUMNS}`)
    .eq("as_of_date", asOfDate)
    .eq("status", "succeeded")), horizonGames)
    .order("created_at", { ascending: false })
    .limit(PROVEN_RUN_CANDIDATES);

  if (error) throw error;
  const rows = ((data ?? []) as Array<{ run_id?: unknown; execution_scope?: unknown; scope_key?: unknown }>)
    .filter((row): row is { run_id: string; execution_scope?: unknown; scope_key?: unknown } => typeof row.run_id === "string");
  const runIds = rows.map((row) => row.run_id);
  const proof = runIds.length ? await loadExternalInputProof(supabase, runIds) : new Map<string, ExternalInputProof>();
  const runsByGame = selectProvenRunsByGame(rows, proof);
  const runId = runsByGame.baseRunId ?? runsByGame.overlays[0]?.runId;
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
  return { runId, proof: proof.get(runId)!, runsByGame };
}
