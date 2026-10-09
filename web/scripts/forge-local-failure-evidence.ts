import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import { projectionInputHash } from "../lib/projections/inputCapture";

export type FailedSnapshotEvidence = { receipt: any; observation: any; revisions: any[];
  attemptObservation: any; run: any; originalReceipt: any; originalJournal: any[]; originalArtifact: any };
export type FailedSnapshotScope = { origin: string; gameId: number; date: string; operationId: string;
  codeVersion: string; expectedRevisionId: string | null; receiptDirectory: string };

export class FailedForgeSnapshotEvidenceError extends Error {
  constructor(readonly gate: string) {
    super(`Failed snapshot disposition lacks matching terminal, committed evidence (${gate}).`);
    this.name = "FailedForgeSnapshotEvidenceError";
  }
}

/** The installed fence hashes this fixed, flat receipt using PostgreSQL jsonb::text. */
export function forgeAttemptObservationHash(payload: Record<string, unknown>): string {
  const keys = ["version", "operationId", "runId", "slateDate", "gameId", "codeVersion", "expectedRevisionId", "leaseMs", "reservedAt", "leaseExpiresAt"];
  if (!payload || Object.keys(payload).length !== keys.length || keys.some(key => !Object.hasOwn(payload, key))
    || Object.values(payload).some(value => value !== null && typeof value !== "string" && !(typeof value === "number" && Number.isSafeInteger(value)))) {
    throw new FailedForgeSnapshotEvidenceError("attempt_hash_contract");
  }
  // These fixed ASCII keys sort by byte length, then byte order; JSONB emits these spaces.
  const text = `{${keys.sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
    .map(key => `${JSON.stringify(key)}: ${JSON.stringify(payload[key])}`).join(", ")}}`;
  return createHash("sha256").update(text).digest("hex");
}

export function readPrivateForgeEvidence(directory: string, name: string): any {
  const repo = realpathSync(resolve(__dirname, "../..")), canonical = realpathSync(directory), info = lstatSync(directory);
  if (!info.isDirectory() || canonical === repo || canonical.startsWith(`${repo}${sep}`)
    || (info.mode & 0o077) || process.getuid && info.uid !== process.getuid()) throw new Error("FORGE evidence directory is not private.");
  const path = resolve(canonical, name), file = lstatSync(path);
  if (!file.isFile() || file.size > 32 * 1024 * 1024 || (file.mode & 0o077)
    || process.getuid && file.uid !== process.getuid()) throw new Error("FORGE evidence is not a bounded private regular file.");
  const text = readFileSync(path, "utf8");
  return name === "attempts.jsonl" ? text.trim().split("\n").map(line => JSON.parse(line)) : JSON.parse(text);
}

/** This disposition settles one committed snapshot timeout; it never certifies issuance or input quality. */
export function verifyFailedSnapshotTimeoutEvidence(scope: FailedSnapshotScope, evidence: FailedSnapshotEvidence, now = Date.now()): void {
  const fail = (gate: string) => { throw new FailedForgeSnapshotEvidenceError(gate); };
  const uuid = (value: unknown) => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
  const { receipt, observation, revisions, attemptObservation, run, originalReceipt: original,
    originalJournal: journal, originalArtifact: artifact } = evidence;
  const attempt = receipt?.attempt, snapshot = observation?.payload;
  const observed = Date.parse(attempt?.observedAt), expires = Date.parse(attempt?.leaseExpiresAt);
  if (!uuid(scope.operationId) || !/^local:[a-f0-9]{64}$/.test(scope.codeVersion) || !Number.isSafeInteger(scope.gameId)
    || scope.gameId < 1 || scope.expectedRevisionId !== null && !uuid(scope.expectedRevisionId)
    || receipt?.version !== "forge-local-reconciliation-v1" || receipt.status !== "verified_failed_snapshot_timeout"
    || receipt.origin !== scope.origin || receipt.automaticRetryAllowed !== false || receipt.requests?.writes !== 0
    || receipt.scope?.operationId !== scope.operationId || receipt.scope?.gameId !== scope.gameId || receipt.scope?.date !== scope.date
    || attempt?.version !== "forge-local-attempt-v1" || attempt.operationId !== scope.operationId || attempt.gameId !== scope.gameId
    || attempt.slateDate !== scope.date || attempt.codeVersion !== scope.codeVersion || attempt.expectedRevisionId !== scope.expectedRevisionId
    || attempt.state !== "expired" || attempt.runStatus !== "failed" || !uuid(attempt.runId)
    || attempt.revisionId !== null || attempt.inputSnapshotId !== null
    || !Number.isFinite(observed) || observed > now || now - observed > 60000
    || !Number.isFinite(expires) || expires > observed || !Array.isArray(revisions) || revisions.length) fail("immutable_attempt");
  if (attemptObservation?.id !== scope.operationId || attemptObservation.provider !== "forge"
    || attemptObservation.dataset_key !== "forge-local-execution-v1" || attemptObservation.entity_key !== attempt.runId
    || attemptObservation.metadata?.hashCodec !== "postgres-jsonb-text-sha256-v1"
    || forgeAttemptObservationHash(attemptObservation.payload) !== attemptObservation.payload_hash
    || attemptObservation.payload_hash !== attempt.payloadHash
    || Object.entries(attemptObservation.payload).some(([key, value]) => projectionInputHash(value) !== projectionInputHash(attempt[key]))) fail("attempt_observation");
  if (run?.run_id !== attempt.runId || run.status !== "failed" || run.git_sha !== scope.codeVersion || run.as_of_date !== scope.date
    || run.metrics?.publication_failed !== true || !String(run.metrics.error).includes("Local FORGE request deadline exceeded.")
    || run.metrics.analytics_sidecar?.status !== "omitted_fenced_local_attempt") fail("failed_run");
  if (!uuid(observation?.id) || observation.provider !== "forge" || observation.dataset_key !== "forge-run-inputs-v1"
    || observation.entity_key !== attempt.runId || projectionInputHash(snapshot) !== observation.payload_hash
    || snapshot?.version !== "forge-inputs-v1" || snapshot.runId !== attempt.runId || snapshot.codeVersion !== scope.codeVersion
    || snapshot.slateDate !== scope.date || snapshot.horizonGames !== 1 || snapshot.replayClassification !== "captured_live"
    || snapshot.seasonBootstrapApplied !== false || JSON.stringify(snapshot.gameIds) !== JSON.stringify([scope.gameId])
    || !Array.isArray(snapshot.reads) || !snapshot.reads.length
    || snapshot.inputProvenance?.capturedReads?.readCount !== snapshot.reads.length
    || projectionInputHash(snapshot.reads) !== snapshot.inputProvenance.capturedReads.hash
    || !/^[a-f0-9]{64}$/.test(snapshot.outputHash ?? "")) fail("committed_snapshot");
  if (original?.status !== "failed" || original.publicationOutcome !== "not_attempted"
    || original.scope?.gameId !== scope.gameId || original.scope?.date !== scope.date
    || original.scope?.existingRevisionId !== scope.expectedRevisionId || original.codeVersion !== scope.codeVersion
    || original.runId !== attempt.runId || original.inputSnapshotId != null
    || original.ownership?.operationId !== scope.operationId || original.checkpoint?.phase !== "before_snapshot"
    || original.checkpoint.runId !== attempt.runId || original.requests?.unknownWrites !== 1 || original.requests.rejectedWrites !== 0
    || !Number.isInteger(original.requests.writes) || original.requests.writes < 3 || original.requests.writes > 100
    || original.requests.acknowledgedWrites !== original.requests.writes - 1
    || !Number.isFinite(Date.parse(original.startedAt)) || !Number.isFinite(original.durationMs)
    || original.durationMs < 0 || Date.parse(original.startedAt) + original.durationMs > observed) fail("original_receipt");
  if (artifact?.version !== "forge-local-artifact-v1" || artifact.codeVersion !== scope.codeVersion) fail("original_artifact");
  const { codeVersion: _codeVersion, ...unsigned } = artifact;
  if (`local:${createHash("sha256").update(JSON.stringify(unsigned)).digest("hex")}` !== scope.codeVersion) fail("artifact_pin");
  if (!Array.isArray(journal) || !journal.length || journal.some((row, index) => !Number.isFinite(Date.parse(row.at))
    || Date.parse(row.at) < Date.parse(original.startedAt) || Date.parse(row.at) > Date.parse(original.startedAt) + original.durationMs
    || index > 0 && Date.parse(row.at) < Date.parse(journal[index - 1].at)
    || row.startedAt !== original.startedAt || row.ownership?.operationId !== scope.operationId
    || row.ownership.directory !== original.ownership.directory || row.checkpoint?.phase === "before_publish")) fail("journal_identity");
  const attempts = journal.filter(row => row.entry?.kind === "write_attempt"), receipts = journal.filter(row => row.entry?.kind === "write_receipt");
  if (attempts.length !== original.requests.writes || receipts.length !== attempts.length) fail("journal_counts");
  const allowed = new Set(["/rest/v1/rpc/begin_forge_local_run", "/rest/v1/forge_runs", "/rest/v1/forge_player_projections",
    "/rest/v1/forge_team_projections", "/rest/v1/forge_goalie_projections", "/rest/v1/player_forecast_source_observations"]);
  for (const [index, row] of attempts.entries()) {
    const acknowledgement = receipts[index], write = row.entry;
    if (write.index !== index + 1 || !allowed.has(write.resource) || !/^[a-f0-9]{64}$/.test(write.payloadHash ?? "")
      || write.method !== undefined && write.method !== (write.resource === "/rest/v1/forge_runs" ? "PATCH" : "POST")
      || acknowledgement.entry.index !== write.index || acknowledgement.entry.resource !== write.resource
      || acknowledgement.entry.payloadHash !== write.payloadHash || Date.parse(acknowledgement.at) < Date.parse(row.at)
      || row.codeVersion !== scope.codeVersion || acknowledgement.codeVersion !== scope.codeVersion
      || row.scope?.gameId !== scope.gameId || row.scope?.date !== scope.date
      || acknowledgement.scope?.gameId !== scope.gameId || acknowledgement.scope?.date !== scope.date
      || !["acknowledged", "unknown"].includes(acknowledgement.entry.outcome)
      || acknowledgement.entry.outcome === "acknowledged" && !(acknowledgement.entry.responseStatus >= 200 && acknowledgement.entry.responseStatus < 300)) fail("journal_write");
  }
  const unknowns = receipts.filter(row => row.entry.outcome === "unknown"), unknown = unknowns[0];
  if (unknowns.length !== 1 || unknown.entry.resource !== "/rest/v1/player_forecast_source_observations"
    || unknown.checkpoint?.phase !== "before_snapshot" || unknown.checkpoint.runId !== attempt.runId
    || unknown.entry.index !== attempts.length - 1 || unknown.entry.responseStatus !== null
    || attempts[0].entry.resource !== "/rest/v1/rpc/begin_forge_local_run"
    || attempts.at(-1).entry.resource !== "/rest/v1/forge_runs" || receipts.at(-1).entry.outcome !== "acknowledged"
    || receipts.at(-1).checkpoint?.phase !== "before_snapshot" || receipts.at(-1).checkpoint.runId !== attempt.runId
    || Date.parse(attempts.at(-1).at) < Date.parse(unknown.at)
    || journal.filter(row => row.entry?.resource === "/rest/v1/player_forecast_source_observations" && row.entry.kind === "write_attempt").length !== 1
    || !journal.some(row => row.entry?.kind === "ownership_acquired" && row.entry.operationId === scope.operationId)) fail("snapshot_finalization");
}

/** All requests are reads; never retries, republishes or changes run/ownership state. */
export async function readFailedSnapshotTimeoutEvidence(db: any, scope: FailedSnapshotScope, attempt: any): Promise<FailedSnapshotEvidence> {
  const originalReceipt = readPrivateForgeEvidence(scope.receiptDirectory, "receipt.json");
  const originalJournal = readPrivateForgeEvidence(scope.receiptDirectory, "attempts.jsonl");
  const originalArtifact = readPrivateForgeEvidence(scope.receiptDirectory, "code.json");
  const read = async (query: any) => { const result = await query; if (result.error) throw new Error("Failed FORGE attempt readback was rejected."); return result.data; };
  const attemptObservation = await read(db.from("player_forecast_source_observations").select("id,provider,dataset_key,entity_key,payload,payload_hash,metadata")
    .eq("id", scope.operationId).single());
  const run = await read(db.from("forge_runs").select("run_id,as_of_date,status,git_sha,metrics,updated_at").eq("run_id", attempt.runId).single());
  const snapshots = await read(db.from("player_forecast_source_observations").select("id,provider,dataset_key,entity_key,payload,payload_hash")
    .eq("provider", "forge").eq("dataset_key", "forge-run-inputs-v1").eq("entity_key", attempt.runId).limit(2));
  const revisions = await read(db.from("forge_game_revisions").select("id,run_id,game_id,input_snapshot_id")
    .eq("run_id", attempt.runId).eq("game_id", scope.gameId).limit(2));
  if (!Array.isArray(snapshots) || snapshots.length !== 1) throw new Error("Failed snapshot disposition requires exactly one committed input snapshot.");
  return { receipt: null, observation: snapshots[0], revisions, attemptObservation, run, originalReceipt, originalJournal, originalArtifact };
}
