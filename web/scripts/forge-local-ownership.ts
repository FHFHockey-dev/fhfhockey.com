import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join, resolve, sep } from "node:path";

type Owner = { version: "forge-local-ownership-v1"; operationId: string; origin: string; gameId: number;
  hostname: string; pid: number; startedAt: string; receiptDirectory: string };

function flush(path: string, data: unknown): void {
  const fd = openSync(path, "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(data)); fsyncSync(fd); } finally { closeSync(fd); }
}

export function inspectForgeLocalOwnership(directory: string) {
  let owner: Owner | null = null;
  try {
    const parsed = JSON.parse(readFileSync(join(directory, "owner.json"), "utf8"));
    if (parsed.version === "forge-local-ownership-v1" && typeof parsed.operationId === "string"
      && /^[a-f0-9-]{36}$/.test(parsed.operationId) && Number.isSafeInteger(parsed.pid) && parsed.pid > 0
      && typeof parsed.hostname === "string" && typeof parsed.receiptDirectory === "string") owner = parsed;
  } catch { /* Incomplete ownership files remain an unresolved scope. */ }
  let live = false;
  if (owner?.hostname === hostname()) {
    try { process.kill(owner.pid, 0); live = true; }
    catch (error) { live = (error as NodeJS.ErrnoException).code !== "ESRCH"; }
  }
  return { directory, owner, live, state: live ? "active" as const : "unresolved" as const };
}

export class ForgeLocalOwnershipError extends Error {
  constructor(readonly inspection: ReturnType<typeof inspectForgeLocalOwnership>) {
    super(`Local FORGE scope is ${inspection.state}; inspect its private ownership and attempt receipts before retrying.`);
  }
}

export function forgeLocalOwnershipRoot(root?: string) {
  return resolve(root ?? join(homedir(), ".fhfh", "forge-local-ownership"));
}

type RecoveryScope = { origin: string; gameId: number; date: string; operationId: string; codeVersion: string;
  expectedRevisionId: string | null; receiptDirectory: string; writer: { pid: number; hostname: string }; evidenceDirectory: string; root?: string;
  deadlineMs?: number; signal?: AbortSignal; disposition?: "failed_snapshot_timeout" };

/** Explicit filesystem archival after positive issuance or a settled snapshot timeout; never retries or writes the DB. */
export async function recoverForgeLocalOwnership(scope: RecoveryScope) {
  const recoveryStartedAt = Date.now(), recoveryStartedMonotonic = process.hrtime.bigint();
  const uuid = (value: unknown): value is string => typeof value === "string"
    && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
  const repo = realpathSync(resolve(__dirname, "../.."));
  const privateDirectory = (path: string) => {
    const stat = lstatSync(path), canonical = realpathSync(path);
    if (!stat.isDirectory() || (stat.mode & 0o077) || process.getuid && stat.uid !== process.getuid()
      || canonical === repo || canonical.startsWith(`${repo}${sep}`)) throw new Error("Recovery requires private operator directories.");
    return canonical;
  };
  const evidenceDirectory = privateDirectory(scope.evidenceDirectory);
  const read = (name: string, directory = evidenceDirectory): any => {
    const path = join(directory, name), stat = lstatSync(path);
    if (!stat.isFile() || stat.size > 32 * 1024 * 1024 || (stat.mode & 0o077)
      || process.getuid && stat.uid !== process.getuid()) throw new Error("Recovery evidence is not a bounded private regular file.");
    return JSON.parse(readFileSync(path, "utf8"));
  };
  const receipt = read("receipt.json"), attempt = receipt.attempt;
  const failedSnapshot = scope.disposition === "failed_snapshot_timeout";
  const observation = read("input-observation.json"), revisions = read("issued-revisions.json"), captured = observation?.payload;
  const evidence = { receipt, observation, revisions, ...(failedSnapshot ? {
    attemptObservation: read("attempt-observation.json"), run: read("failed-run.json"), originalReceipt: read("original-receipt.json"),
    originalJournal: read("original-journal.json"), originalArtifact: read("original-code.json"),
  } : {}) };
  if (scope.disposition !== undefined && !failedSnapshot || new URL(scope.origin).origin !== scope.origin) {
    throw new Error("Ownership recovery disposition or origin is invalid.");
  }
  if (failedSnapshot) {
    const { verifyFailedSnapshotTimeoutEvidence } = await import("./forge-local-failure-evidence");
    verifyFailedSnapshotTimeoutEvidence(scope, evidence as Parameters<typeof verifyFailedSnapshotTimeoutEvidence>[1]);
  } else {
    if (!uuid(scope.operationId)
      || !Number.isSafeInteger(scope.gameId) || scope.gameId < 1 || !/^local:[a-f0-9]{64}$/.test(scope.codeVersion)
      || scope.expectedRevisionId !== null && !uuid(scope.expectedRevisionId)
      || receipt.version !== "forge-local-reconciliation-v1" || receipt.status !== "verified_issued"
      || receipt.origin !== scope.origin || receipt.automaticRetryAllowed !== false || receipt.requests?.writes !== 0
      || receipt.scope?.operationId !== scope.operationId || receipt.scope?.gameId !== scope.gameId || receipt.scope?.date !== scope.date
      || attempt?.version !== "forge-local-attempt-v1" || attempt.state !== "issued" || attempt.operationId !== scope.operationId
      || attempt.gameId !== scope.gameId || attempt.slateDate !== scope.date || attempt.codeVersion !== scope.codeVersion
      || attempt.expectedRevisionId !== scope.expectedRevisionId || ![attempt.runId, attempt.inputSnapshotId, attempt.revisionId].every(uuid)) {
      throw new Error("Ownership recovery lacks matching positive issuance.");
    }
    const { projectionInputHash } = await import("../lib/projections/inputCapture");
    if (observation.id !== attempt.inputSnapshotId || captured?.version !== "forge-inputs-v1" || captured.runId !== attempt.runId
      || captured.codeVersion !== scope.codeVersion || captured.slateDate !== scope.date || captured.horizonGames !== 1
      || captured.replayClassification !== "captured_live" || captured.gameIds?.length !== 1 || captured.gameIds[0] !== scope.gameId
      || !captured.inputProvenance || projectionInputHash(captured) !== observation.payload_hash
      || !Array.isArray(revisions) || revisions.length !== 1 || revisions[0].id !== attempt.revisionId
      || revisions[0].run_id !== attempt.runId || revisions[0].input_snapshot_id !== attempt.inputSnapshotId
      || revisions[0].game_id !== scope.gameId || revisions[0].payload?.codeVersion !== scope.codeVersion
      || projectionInputHash(revisions[0].payload?.inputProvenance) !== projectionInputHash(captured.inputProvenance)) {
      throw new Error("Ownership recovery input/revision readback is incompatible.");
    }
  }
  const assertEvidenceFresh = () => {
    if (!failedSnapshot) return;
    const now = Date.now(), elapsed = Number(process.hrtime.bigint() - recoveryStartedMonotonic) / 1e6;
    const observed = Date.parse(attempt.observedAt);
    // Clock rollback cannot extend the server observation's lifetime while this investigation runs.
    if (!Number.isFinite(now) || now < recoveryStartedAt || !Number.isFinite(elapsed) || elapsed < 0
      || !Number.isFinite(observed) || observed > now
      || Math.max(now, recoveryStartedAt + elapsed) - observed > 60000) {
      throw new Error("Ownership recovery requires fresh failed-attempt evidence immediately before archival.");
    }
  };
  const { projectionInputHash } = await import("../lib/projections/inputCapture");
  if (!scope.writer || scope.writer.hostname !== hostname() || !Number.isSafeInteger(scope.writer.pid) || scope.writer.pid < 1) {
    throw new Error("Ownership recovery requires the original local writer identity.");
  }
  const assertTerminal = () => {
    if (scope.signal?.aborted || scope.deadlineMs !== undefined && Date.now() >= scope.deadlineMs) {
      throw new Error("Ownership recovery was cancelled or exceeded its investigation deadline.");
    }
    try { process.kill(scope.writer.pid, 0); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") return; }
    throw new Error("Ownership writer is active or its termination is unknown.");
  };
  assertTerminal();
  const rootPath = forgeLocalOwnershipRoot(scope.root);
  if (!existsSync(rootPath)) return { state: "absent" as const };
  const root = privateDirectory(rootPath), key = createHash("sha256").update(`${scope.origin}:${scope.gameId}`).digest("hex");
  const directory = join(root, `${scope.gameId}-${key}`);
  if (!existsSync(directory)) return { state: "absent" as const };
  privateDirectory(directory);
  for (const name of ["owner.json", "write-intent.json"]) {
    const stat = lstatSync(join(directory, name));
    if (!stat.isFile() || (stat.mode & 0o077) || process.getuid && stat.uid !== process.getuid()) {
      throw new Error("Recovery ownership evidence is not a private regular file.");
    }
  }
  if (JSON.parse(readFileSync(join(directory, "write-intent.json"), "utf8")).operationId !== scope.operationId) {
    throw new Error("Recovery write intent changed.");
  }
  const identity = lstatSync(directory), owner = inspectForgeLocalOwnership(directory).owner;
  const assertOwner = () => {
    const current = lstatSync(directory), inspection = inspectForgeLocalOwnership(directory);
    if (current.dev !== identity.dev || current.ino !== identity.ino || !owner
      || owner.operationId !== scope.operationId || owner.origin !== scope.origin || owner.gameId !== scope.gameId
      || owner.pid !== scope.writer.pid || owner.hostname !== scope.writer.hostname || owner.receiptDirectory !== scope.receiptDirectory
      || !Number.isFinite(Date.parse(owner.startedAt))
      || JSON.stringify(inspection.owner) !== JSON.stringify(owner)) throw new Error("Recovery cannot alter changed or incomplete ownership.");
    assertTerminal();
  };
  assertOwner();
  // Legacy claims have no durable investigator identity; their absence of a receipt cannot prove termination.
  if (existsSync(join(directory, "verified-recovery"))) throw new Error("Legacy recovery claim has unresolved investigator identity.");
  const prefix = `verified-recovery-${scope.operationId}-${identity.dev}-${identity.ino}-`;
  type Claim = { version: "forge-local-recovery-claim-v1"; index: number; previous: string | null;
    investigator: { pid: number; hostname: string }; directoryIdentity: { dev: number; ino: number };
    archive: string; proof: { version: "forge-local-recovery-v1"; operationId: string; owner: Owner;
      evidenceDirectory: string; evidenceHash: string; recoveredAt: string; disposition?: "failed_snapshot_timeout" }; checksum: string };
  const claims = () => {
    assertOwner();
    const names = readdirSync(directory).filter(name => name.startsWith(prefix)).sort();
    if (names.length > 128 || names.some((name, index) => name !== `${prefix}${String(index + 1).padStart(6, "0")}.json`)) {
      throw new Error("Recovery claim sequence is incomplete or exceeds its bound.");
    }
    let previous: Claim | null = null;
    for (const [index, name] of names.entries()) {
      assertTerminal();
      const claim = read(name, directory) as Claim, { checksum, ...unsigned } = claim;
      if (claim.version !== "forge-local-recovery-claim-v1" || claim.index !== index + 1
        || claim.previous !== (previous?.checksum ?? null) || checksum !== projectionInputHash(unsigned)
        || claim.directoryIdentity?.dev !== identity.dev || claim.directoryIdentity?.ino !== identity.ino
        || claim.investigator?.hostname !== hostname() || !Number.isSafeInteger(claim.investigator.pid) || claim.investigator.pid < 1
        || claim.proof?.version !== "forge-local-recovery-v1" || claim.proof.operationId !== scope.operationId
        || claim.proof.disposition !== scope.disposition
        || JSON.stringify(claim.proof.owner) !== JSON.stringify(owner) || !Number.isFinite(Date.parse(claim.proof.recoveredAt))
        || !/^[a-f0-9]{64}$/.test(claim.proof.evidenceHash)
        || !claim.archive.startsWith(`${root}${sep}recovered-${scope.operationId}-`)
        || !uuid(claim.archive.slice(`${root}${sep}recovered-${scope.operationId}-`.length))) {
        throw new Error("Recovery claim identity or retained proof changed.");
      }
      const retained = privateDirectory(claim.proof.evidenceDirectory);
      const retainedEvidence = { receipt: read("receipt.json", retained), observation: read("input-observation.json", retained),
        revisions: read("issued-revisions.json", retained), ...(failedSnapshot ? {
          attemptObservation: read("attempt-observation.json", retained), run: read("failed-run.json", retained),
          originalReceipt: read("original-receipt.json", retained), originalJournal: read("original-journal.json", retained),
          originalArtifact: read("original-code.json", retained),
        } : {}) }, prior = retainedEvidence.receipt;
      if (projectionInputHash(retainedEvidence) !== claim.proof.evidenceHash
        || prior.version !== receipt.version || prior.status !== receipt.status || prior.origin !== scope.origin
        || prior.automaticRetryAllowed !== false || prior.requests?.writes !== 0
        || projectionInputHash(prior.scope) !== projectionInputHash(receipt.scope)
        || ["version", "state", "operationId", "gameId", "slateDate", "codeVersion", "expectedRevisionId", "runId", "inputSnapshotId", "revisionId"]
          .some(key => prior.attempt?.[key] !== attempt[key])
        || projectionInputHash(retainedEvidence.observation) !== projectionInputHash(observation)
        || projectionInputHash(retainedEvidence.revisions) !== projectionInputHash(revisions)
        || failedSnapshot && ["attemptObservation", "run", "originalReceipt", "originalJournal", "originalArtifact"]
          .some(key => projectionInputHash((retainedEvidence as any)[key]) !== projectionInputHash((evidence as any)[key]))) {
        throw new Error("Recovery claim evidence is missing, changed or incompatible with verified issuance.");
      }
      previous = claim;
    }
    assertOwner();
    return previous;
  };
  const previous = claims();
  if (previous) {
    // A second call is not allowed to take over its own still-live or another investigator's claim.
    let live = true;
    try { process.kill(previous.investigator.pid, 0); }
    catch (error) { live = (error as NodeJS.ErrnoException).code !== "ESRCH"; }
    if (live) throw new Error("Recovery investigator is active or its termination is unknown.");
  }
  const index = (previous?.index ?? 0) + 1;
  if (index > 128) throw new Error("Recovery claim sequence exceeds its bound.");
  const archive = join(root, `recovered-${scope.operationId}-${randomUUID()}`);
  const unsigned: Omit<Claim, "checksum"> = { version: "forge-local-recovery-claim-v1", index, previous: previous?.checksum ?? null,
    investigator: { pid: process.pid, hostname: hostname() }, directoryIdentity: { dev: identity.dev, ino: identity.ino }, archive,
    proof: { version: "forge-local-recovery-v1", operationId: scope.operationId, owner: owner!, evidenceDirectory,
      evidenceHash: projectionInputHash(evidence), recoveredAt: new Date().toISOString(),
      ...(failedSnapshot ? { disposition: scope.disposition } : {}) } };
  const claim: Claim = { ...unsigned, checksum: projectionInputHash(unsigned) };
  const prepared = join(root, `recovery-proof-${randomUUID()}.json`);
  flush(prepared, claim);
  try {
    assertOwner();
    assertEvidenceFresh();
    // Hard-link a complete fsynced record exclusively: no visible empty-claim or partial-file window.
    linkSync(prepared, join(directory, `${prefix}${String(index).padStart(6, "0")}.json`));
    const scopeFd = openSync(directory, "r");
    try { fsyncSync(scopeFd); } finally { closeSync(scopeFd); }
    if (claims()?.checksum !== claim.checksum) throw new Error("Recovery claim changed before archival.");
    assertOwner();
    if (existsSync(archive)) throw new Error("Recovery archive already exists.");
    assertEvidenceFresh();
    renameSync(directory, archive); // Preserve the old ownership/intent; never recursively delete a reusable scope path.
    const fd = openSync(root, "r");
    try { fsyncSync(fd); } finally { closeSync(fd); }
    return { state: "released" as const, archive };
  } finally {
    // Never remove a published claim on failure. Terminal takeover retains it in the immutable chain.
    unlinkSync(prepared);
  }
}

/** Local invocation ownership only. Database/other-host publication fencing is separate. */
export function acquireForgeLocalOwnership(args: { origin: string; gameId: number; receiptDirectory: string; root?: string; operationId?: string }) {
  const origin = new URL(args.origin).origin;
  if (origin !== args.origin || !Number.isSafeInteger(args.gameId) || args.gameId < 1) throw new Error("Invalid local ownership scope.");
  if (args.operationId && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(args.operationId)) {
    throw new Error("Invalid local operation identity.");
  }
  const root = forgeLocalOwnershipRoot(args.root);
  const repo = realpathSync(resolve(__dirname, "../.."));
  if (root === repo || root.startsWith(`${repo}${sep}`)) throw new Error("Ownership receipts must stay outside the repository.");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const canonicalRoot = realpathSync(root);
  if (canonicalRoot === repo || canonicalRoot.startsWith(`${repo}${sep}`)) throw new Error("Ownership receipts must stay outside the repository.");
  const rootStat = statSync(root);
  if ((rootStat.mode & 0o077) !== 0 || process.getuid && rootStat.uid !== process.getuid()) {
    throw new Error("Local ownership directory must be private to the current operator.");
  }
  const key = createHash("sha256").update(`${origin}:${args.gameId}`).digest("hex");
  const directory = join(canonicalRoot, `${args.gameId}-${key}`);
  try { mkdirSync(directory, { mode: 0o700 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new ForgeLocalOwnershipError(inspectForgeLocalOwnership(directory));
    throw error;
  }
  const owner: Owner = { version: "forge-local-ownership-v1", operationId: args.operationId ?? randomUUID(), origin, gameId: args.gameId,
    hostname: hostname(), pid: process.pid, startedAt: new Date().toISOString(), receiptDirectory: args.receiptDirectory };
  try { flush(join(directory, "owner.json"), owner); }
  catch (error) { rmSync(directory, { recursive: true }); throw error; }
  const identity = statSync(directory);
  let attempted = false, released = false;
  const assertOwned = () => {
    const current = inspectForgeLocalOwnership(directory);
    let sameDirectory = false;
    try { const info = statSync(directory); sameDirectory = info.dev === identity.dev && info.ino === identity.ino; } catch { /* Lost ownership. */ }
    if (released || !sameDirectory || current.owner?.operationId !== owner.operationId
      || current.owner.pid !== owner.pid || current.owner.hostname !== owner.hostname
      || current.owner.origin !== owner.origin || current.owner.gameId !== owner.gameId
      || current.owner.receiptDirectory !== owner.receiptDirectory || current.owner.startedAt !== owner.startedAt) throw new ForgeLocalOwnershipError(current);
  };
  return {
    reference: { directory, operationId: owner.operationId },
    assertOwned,
    beforeWrite() {
      assertOwned();
      if (!attempted) { flush(join(directory, "write-intent.json"), { operationId: owner.operationId, at: new Date().toISOString() }); attempted = true; }
    },
    finish(publicationVerified = false) {
      if (released) return true;
      assertOwned();
      if ((attempted || existsSync(join(directory, "write-intent.json"))) && !publicationVerified) return false;
      rmSync(directory, { recursive: true }); released = true; return true;
    },
    get attempted() { return attempted || existsSync(join(directory, "write-intent.json")); },
  };
}
