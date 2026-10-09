import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { projectionInputHash } from "../lib/projections/inputCapture";
import { guardedForgeFetch, type ForgeWriteReceipt, type RequestCounts } from "./run-forge-local";
import { acquireForgeLocalOwnership, recoverForgeLocalOwnership } from "./forge-local-ownership";
import { forgeAttemptObservationHash, readFailedSnapshotTimeoutEvidence, verifyFailedSnapshotTimeoutEvidence, type FailedSnapshotEvidence } from "./forge-local-failure-evidence";

const exec = promisify(execFile), directories: string[] = [];
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const counts = (): RequestCounts => ({ reads: 0, writes: 0, readMs: 0, writeMs: 0, acknowledgedWrites: 0, rejectedWrites: 0, unknownWrites: 0 });

async function fixture(origin = "https://db.example") {
  const root = mkdtempSync(join(tmpdir(), "forge-failed-snapshot-")); directories.push(root); chmodSync(root, 0o700);
  const originalDirectory = join(root, "original"), evidenceDirectory = join(root, "reconciliation");
  mkdirSync(originalDirectory, { mode: 0o700 }); mkdirSync(evidenceDirectory, { mode: 0o700 });
  const operationId = randomUUID(), runId = randomUUID(), snapshotId = randomUUID(), now = Date.now();
  const originalArtifact: any = { version: "forge-local-artifact-v1", fixtureNonce: randomUUID() };
  const codeVersion = `local:${createHash("sha256").update(JSON.stringify(originalArtifact)).digest("hex")}`;
  originalArtifact.codeVersion = codeVersion;
  const owner = acquireForgeLocalOwnership({ origin, gameId: 1, operationId, receiptDirectory: originalDirectory, root: join(root, "owners") });
  owner.beforeWrite();
  const directory = owner.reference.directory, recordedOwner = JSON.parse(readFileSync(join(directory, "owner.json"), "utf8"));
  const writerPid = Number((await exec(process.execPath, ["-e", "console.log(process.pid)"])).stdout.trim());
  recordedOwner.pid = writerPid; writeFileSync(join(directory, "owner.json"), JSON.stringify(recordedOwner));
  const scope = { origin, gameId: 1, date: "2026-10-05", operationId, codeVersion, expectedRevisionId: null,
    receiptDirectory: originalDirectory, writer: { pid: writerPid, hostname: hostname() }, evidenceDirectory, root: join(root, "owners"),
    disposition: "failed_snapshot_timeout" as const };
  const immutable = { version: "forge-local-attempt-v1", operationId, runId, gameId: 1, slateDate: scope.date,
    codeVersion, expectedRevisionId: null, leaseMs: 1000, reservedAt: new Date(now - 4000).toISOString(), leaseExpiresAt: new Date(now - 3000).toISOString() };
  const attemptObservation = { id: operationId, provider: "forge", dataset_key: "forge-local-execution-v1", entity_key: runId,
    payload: immutable, payload_hash: forgeAttemptObservationHash(immutable), metadata: { hashCodec: "postgres-jsonb-text-sha256-v1" } };
  const attempt = { ...immutable, state: "expired", runStatus: "failed", observedAt: new Date(now).toISOString(),
    payloadHash: attemptObservation.payload_hash, revisionId: null, inputSnapshotId: null };
  const reads = [{ request: [{ method: "from", args: ["games"] }], result: { data: [{ id: 1 }], error: null }, receivedAt: new Date(now - 3500).toISOString() }];
  const snapshot = { version: "forge-inputs-v1", runId, slateDate: scope.date, codeVersion, horizonGames: 1, gameIds: [1],
    replayClassification: "captured_live", seasonBootstrapApplied: false, reads,
    inputProvenance: { capturedReads: { readCount: reads.length, hash: projectionInputHash(reads) } }, outputHash: "b".repeat(64) };
  const observation = { id: snapshotId, provider: "forge", dataset_key: "forge-run-inputs-v1", entity_key: runId,
    payload: snapshot, payload_hash: projectionInputHash(snapshot) };
  const run = { run_id: runId, status: "failed", git_sha: codeVersion, as_of_date: scope.date,
    metrics: { error: "Error: Local FORGE request deadline exceeded.", publication_failed: true,
      analytics_sidecar: { status: "omitted_fenced_local_attempt" } } };
  const originalReceipt = { status: "failed", publicationOutcome: "not_attempted", startedAt: new Date(now - 5000).toISOString(), durationMs: 2500,
    scope: { date: scope.date, gameId: 1, existingRevisionId: null }, codeVersion, runId,
    checkpoint: { phase: "before_snapshot", runId }, ownership: owner.reference,
    requests: { reads: 1, writes: 3, acknowledgedWrites: 2, rejectedWrites: 0, unknownWrites: 1 } };
  const base = { startedAt: originalReceipt.startedAt, ownership: owner.reference, codeVersion, scope: originalReceipt.scope };
  const originalJournal: any[] = [{ ...base, at: new Date(now - 4900).toISOString(), checkpoint: { phase: "before_run" },
    entry: { kind: "ownership_acquired", operationId } }];
  const resources = ["/rest/v1/rpc/begin_forge_local_run", "/rest/v1/player_forecast_source_observations", "/rest/v1/forge_runs"];
  for (const [i, resource] of resources.entries()) {
    const checkpoint = i ? { phase: "before_snapshot", runId } : { phase: "before_run" };
    const entry = { resource, index: i + 1, payloadHash: String(i + 1).repeat(64) };
    originalJournal.push({ ...base, checkpoint, at: new Date(now - 4500 + i * 500).toISOString(), entry: { ...entry, kind: "write_attempt" } });
    originalJournal.push({ ...base, checkpoint, at: new Date(now - 4400 + i * 500).toISOString(),
      entry: { ...entry, kind: "write_receipt", outcome: i === 1 ? "unknown" : "acknowledged", responseStatus: i === 1 ? null : 200 } });
  }
  const receipt = { version: "forge-local-reconciliation-v1", origin, status: "verified_failed_snapshot_timeout",
    scope: { date: scope.date, gameId: 1, operationId }, requests: { reads: 5, writes: 0 }, attempt, automaticRetryAllowed: false };
  const evidence: FailedSnapshotEvidence = { receipt, observation, revisions: [], attemptObservation, run, originalReceipt, originalJournal, originalArtifact };
  const save = () => {
    for (const [name, value] of Object.entries({ "receipt.json": receipt, "input-observation.json": observation, "issued-revisions.json": evidence.revisions,
      "attempt-observation.json": attemptObservation, "failed-run.json": run, "original-receipt.json": originalReceipt,
      "original-journal.json": originalJournal, "original-code.json": originalArtifact })) writeFileSync(join(evidenceDirectory, name), JSON.stringify(value), { mode: 0o600 });
    writeFileSync(join(originalDirectory, "receipt.json"), JSON.stringify(originalReceipt), { mode: 0o600 });
    writeFileSync(join(originalDirectory, "attempts.jsonl"), originalJournal.map(row => JSON.stringify(row)).join("\n") + "\n", { mode: 0o600 });
    writeFileSync(join(originalDirectory, "code.json"), JSON.stringify(originalArtifact), { mode: 0o600 });
  };
  save(); return { root, directory, scope, evidence, save };
}

describe("snapshot timeout transport diagnostics", () => {
  it.each(["waiting_for_headers", "reading_body"] as const)("retains a committed write as unknown during %s", async phase => {
    vi.useFakeTimers(); const requests = counts(); let committed = false, lateHeaders: ((response: Response) => void) | undefined;
    const receipts: ForgeWriteReceipt[] = [];
    const transport = vi.fn(async () => {
      committed = true;
      if (phase === "waiting_for_headers") return new Promise<Response>(resolve => { lateHeaders = resolve; });
      const response = new Response("{}", { status: 201, headers: { "sb-request-id": "trace-id" } });
      vi.spyOn(response, "arrayBuffer").mockImplementation(() => new Promise(() => {})); return response;
    });
    const pending = guardedForgeFetch("https://db.example/rest/v1/player_forecast_source_observations?select=id", { method: "POST", body: '{"value":"å"}' },
      "https://db.example", true, transport, requests, { deadlineMs: Date.now() + 100, requestTimeoutMs: 10, maxWrites: 1, afterWrite: receipt => receipts.push(receipt) });
    const rejection = expect(pending).rejects.toThrow("deadline exceeded");
    await vi.advanceTimersByTimeAsync(10); await rejection;
    expect(committed).toBe(true); expect(transport).toHaveBeenCalledTimes(1);
    expect(requests).toMatchObject({ writes: 1, acknowledgedWrites: 0, unknownWrites: 1 });
    expect(receipts[0]).toMatchObject({ method: "POST", payloadBytes: 14, outcome: "unknown", responseStatus: null,
      transport: { effectiveTimeoutMs: 10, headersStatus: phase === "reading_body" ? 201 : null,
        headersMs: phase === "reading_body" ? 0 : null, responseBytes: null, failurePhase: phase } });
    const saved = JSON.stringify(receipts[0]); lateHeaders?.(new Response("{}", { status: 201 }));
    await vi.advanceTimersByTimeAsync(1); expect(JSON.stringify(receipts[0])).toBe(saved);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("records a bounded complete response without changing acknowledgement or leaking private payloads", async () => {
    const requests = counts(), receipts: ForgeWriteReceipt[] = [];
    await guardedForgeFetch("https://db.example/rest/v1/player_forecast_source_observations?select=private-query", { method: "POST", body: "private-body" },
      "https://db.example", true, async () => new Response('{"id":"1"}', { status: 201, headers: { "x-request-id": "trace-id" } }), requests,
      { deadlineMs: Date.now() + 100, requestTimeoutMs: 50, maxWrites: 1, afterWrite: receipt => receipts.push(receipt) });
    expect(receipts[0]).toMatchObject({ outcome: "acknowledged", responseStatus: 201, payloadBytes: 12,
      transport: { headersStatus: 201, responseBytes: 10, requestId: "trace-id", failurePhase: null } });
    expect(JSON.stringify(receipts)).not.toContain("private-"); expect(requests).toMatchObject({ acknowledgedWrites: 1, unknownWrites: 0 });
  });
});

describe("failed committed snapshot ownership disposition", () => {
  it("uses the installed PostgreSQL reservation codec and rejects undeclared or extended contracts", async () => {
    const f = await fixture();
    expect(f.evidence.attemptObservation.payload_hash).not.toBe(projectionInputHash(f.evidence.attemptObservation.payload));
    expect(() => forgeAttemptObservationHash({ ...f.evidence.attemptObservation.payload, extra: true })).toThrow("attempt_hash_contract");
    f.evidence.attemptObservation.metadata.hashCodec = "invented";
    expect(() => verifyFailedSnapshotTimeoutEvidence(f.scope, f.evidence)).toThrow("attempt_observation");
  });
  it("archives the terminal failed claim without deleting evidence, claiming a replacement or certifying issuance", async () => {
    const f = await fixture(); verifyFailedSnapshotTimeoutEvidence(f.scope, f.evidence);
    const original = readFileSync(join(f.directory, "owner.json"), "utf8"), snapshot = readFileSync(join(f.scope.evidenceDirectory, "input-observation.json"), "utf8");
    await expect(recoverForgeLocalOwnership({ ...f.scope, disposition: undefined })).rejects.toThrow("positive issuance");
    const result = await recoverForgeLocalOwnership(f.scope);
    expect(result.state).toBe("released"); expect(existsSync(f.directory)).toBe(false);
    expect(readFileSync(join(result.archive!, "owner.json"), "utf8")).toBe(original);
    expect(readFileSync(join(f.scope.evidenceDirectory, "input-observation.json"), "utf8")).toBe(snapshot);
    expect(JSON.parse(readFileSync(join(result.archive!, readdirSync(result.archive!).find(name => name.startsWith("verified-recovery-"))!), "utf8")).proof)
      .toMatchObject({ disposition: "failed_snapshot_timeout", operationId: f.scope.operationId });
    const replacement = acquireForgeLocalOwnership({ origin: f.scope.origin, gameId: 1, receiptDirectory: f.root, root: f.scope.root });
    replacement.beforeWrite(); await expect(recoverForgeLocalOwnership(f.scope)).rejects.toThrow("write intent changed"); replacement.assertOwned();
  });
  it.each(["active", "issued", "stale", "future", "missing_snapshot", "wrong_hash", "multiple_unknowns", "publication_attempted", "missing_finalization", "wrong_artifact", "journal_after_exit", "reordered_journal", "wrong_method"])(
    "holds %s evidence without archiving the original claim", async kind => {
      const f = await fixture(), e = f.evidence;
      if (kind === "active" || kind === "issued") e.receipt.attempt.state = kind;
      if (kind === "stale") e.receipt.attempt.observedAt = new Date(Date.now() - 60001).toISOString();
      if (kind === "future") e.receipt.attempt.observedAt = new Date(Date.now() + 60000).toISOString();
      if (kind === "missing_snapshot") e.observation.payload = null;
      if (kind === "wrong_hash") e.observation.payload_hash = "d".repeat(64);
      if (kind === "multiple_unknowns") e.originalJournal.at(-1).entry.outcome = "unknown";
      if (kind === "publication_attempted") e.originalJournal[1].entry.resource = "/rest/v1/rpc/publish_forge_game_revisions";
      if (kind === "missing_finalization") e.originalJournal.pop();
      if (kind === "wrong_artifact") e.originalArtifact.fixtureNonce = "changed";
      if (kind === "journal_after_exit") e.originalJournal.at(-1).at = new Date(Date.now() + 1000).toISOString();
      if (kind === "reordered_journal") [e.originalJournal[1], e.originalJournal[2]] = [e.originalJournal[2], e.originalJournal[1]];
      if (kind === "wrong_method") e.originalJournal[1].entry.method = "GET";
      f.save(); await expect(recoverForgeLocalOwnership(f.scope)).rejects.toThrow(); expect(existsSync(f.directory)).toBe(true);
      expect(readdirSync(f.scope.root).filter(name => name.startsWith("recovered-"))).toHaveLength(0);
    });
  it("holds live writers, mismatched scopes, public files and a snapshot with changed captured reads", async () => {
    const f = await fixture();
    for (const change of [{ operationId: randomUUID() }, { receiptDirectory: f.root }, { writer: { pid: process.pid, hostname: hostname() } },
      { writer: { ...f.scope.writer, hostname: "different-host" } }]) {
      await expect(recoverForgeLocalOwnership({ ...f.scope, ...change })).rejects.toThrow(); expect(existsSync(f.directory)).toBe(true);
    }
    chmodSync(join(f.scope.evidenceDirectory, "original-journal.json"), 0o644);
    await expect(recoverForgeLocalOwnership(f.scope)).rejects.toThrow("private regular file");
    chmodSync(join(f.scope.evidenceDirectory, "original-journal.json"), 0o600);
    f.evidence.observation.payload.reads[0].result.data[0].id = 2;
    f.evidence.observation.payload_hash = projectionInputHash(f.evidence.observation.payload);
    f.save(); await expect(recoverForgeLocalOwnership(f.scope)).rejects.toThrow(); expect(existsSync(f.directory)).toBe(true);
  });
  it("collects exactly four run-scoped reads and never writes or retries", async () => {
    const f = await fixture(), operations: any[] = [];
    const db = { from: (table: string) => {
      const ops: any[] = [{ method: "from", args: [table] }]; operations.push(ops);
      const query: any = new Proxy({}, { get: (_target, method) => method === "then" ? (resolve: any) => {
        const snapshot = ops.some(op => op.method === "eq" && op.args[0] === "dataset_key");
        resolve({ data: table === "forge_runs" ? f.evidence.run : table === "forge_game_revisions" ? []
          : snapshot ? [f.evidence.observation] : f.evidence.attemptObservation, error: null });
      } : (...args: any[]) => { ops.push({ method, args }); return query; } }); return query;
    } };
    const result = await readFailedSnapshotTimeoutEvidence(db, f.scope, f.evidence.receipt.attempt);
    expect(result.observation).toEqual(f.evidence.observation); expect(operations).toHaveLength(4);
    expect(operations.flat().every(op => ["from", "select", "eq", "limit", "single"].includes(op.method))).toBe(true);
    expect(existsSync(f.directory)).toBe(true);
  });
  it("serializes competing investigators and preserves a replacement claim", async () => {
    const f = await fixture(), entry = join(f.root, "archive.ts");
    writeFileSync(entry, `require(${JSON.stringify(join(__dirname, "forge-local-ownership"))}).recoverForgeLocalOwnership(${JSON.stringify(f.scope)})
      .then(value => console.log(JSON.stringify(value))).catch(error => { console.error(error.message); process.exitCode = 1; });`);
    const run = () => exec(process.execPath, ["-r", "ts-node/register/transpile-only", entry], { cwd: join(__dirname, ".."),
      env: { ...process.env, NODE_PATH: ".", TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' } });
    const results = await Promise.allSettled([run(), run()]);
    expect(results.some(result => result.status === "fulfilled" && JSON.parse(result.value.stdout).state === "released")).toBe(true);
    expect(readdirSync(f.scope.root).filter(name => name.startsWith("recovered-"))).toHaveLength(1);
    const replacement = acquireForgeLocalOwnership({ origin: f.scope.origin, gameId: 1, receiptDirectory: f.root, root: f.scope.root });
    replacement.beforeWrite(); await expect(run()).rejects.toMatchObject({ code: 1 }); replacement.assertOwned();
  }, 10000);
  it("retains an interrupted investigator claim and safely appends its terminal takeover proof", async () => {
    const f = await fixture(), marker = join(f.root, "claimed"), entry = join(f.root, "interrupted.ts");
    writeFileSync(entry, `const fs = require('node:fs'), original = fs.linkSync;
      fs.linkSync = (...args) => { const value = original(...args); fs.writeFileSync(${JSON.stringify(marker)}, 'claimed');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0); return value; };
      require(${JSON.stringify(join(__dirname, "forge-local-ownership"))}).recoverForgeLocalOwnership(${JSON.stringify(f.scope)})
        .catch(error => { console.error(error.message); process.exitCode = 1; });`);
    const { spawn } = await import("node:child_process");
    const child = spawn(process.execPath, ["-r", "ts-node/register/transpile-only", entry], { cwd: join(__dirname, ".."),
      env: { ...process.env, NODE_PATH: ".", TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' } });
    const closed = new Promise(resolve => child.once("close", resolve));
    try {
      await vi.waitFor(() => { expect(child.exitCode).toBe(null); expect(existsSync(marker)).toBe(true); }, { timeout: 5000 });
      await expect(recoverForgeLocalOwnership(f.scope)).rejects.toThrow("investigator is active");
    } finally { child.kill("SIGKILL"); await closed; }
    expect(readdirSync(f.directory).filter(name => name.startsWith("verified-recovery-"))).toHaveLength(1);
    const result = await recoverForgeLocalOwnership(f.scope);
    expect(result.state).toBe("released");
    expect(readdirSync(result.archive!).filter(name => name.startsWith("verified-recovery-"))).toHaveLength(2);
  }, 10000);
  it("runs the real reconciliation CLI through five GETs and retains ownership until an explicit separate disposition", async () => {
    let f: Awaited<ReturnType<typeof fixture>>; const requests: string[] = [];
    const server = createServer((request, response) => {
      requests.push(request.method!); response.setHeader("content-type", "application/json");
      const url = new URL(request.url!, "http://localhost"); let data: any;
      if (url.pathname.endsWith("inspect_forge_local_attempt")) data = f.evidence.receipt.attempt;
      else if (url.pathname.endsWith("forge_runs")) data = f.evidence.run;
      else if (url.pathname.endsWith("forge_game_revisions")) data = [];
      else if (url.searchParams.has("dataset_key")) data = [f.evidence.observation];
      else data = f.evidence.attemptObservation;
      response.end(JSON.stringify(data));
    });
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "localhost", resolve); });
    try {
      const address = server.address() as { port: number }; f = await fixture(`http://localhost:${address.port}`);
      const out = join(f.root, "cli");
      const childArgs = ["-r", "ts-node/register/transpile-only", join(__dirname, "run-forge-local.ts"),
        "--date", f.scope.date, "--game-id", "1", "--out", out, "--reconcile", f.scope.operationId, "--reconcile-failed-snapshot",
        "--max-requests", "5", "--runtime-ms", "10000", "--request-timeout-ms", "1000"];
      await exec(process.execPath, childArgs, { cwd: join(__dirname, ".."),
        env: { ...process.env, NODE_PATH: ".", TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}',
          NEXT_PUBLIC_SUPABASE_URL: f.scope.origin, SUPABASE_SERVICE_ROLE_KEY: "synthetic-test-only", FORGE_LOCAL_OWNERSHIP_DIR: f.scope.root } })
        .catch(error => { throw new Error(`CLI readback failed after ${requests.length} HTTP requests: ${existsSync(join(out, "receipt.json"))
          ? readFileSync(join(out, "receipt.json"), "utf8") : error.stderr}`); });
      expect(requests).toEqual(["GET", "GET", "GET", "GET", "GET"]);
      const receipt = JSON.parse(readFileSync(join(out, "receipt.json"), "utf8"));
      expect(receipt).toMatchObject({ status: "verified_failed_snapshot_timeout", automaticRetryAllowed: false, requests: { reads: 5, writes: 0 } });
      expect(existsSync(f.directory)).toBe(true); expect(existsSync(join(out, "original-journal.json"))).toBe(true);
      const archived = await recoverForgeLocalOwnership({ ...f.scope, evidenceDirectory: out }); expect(archived.state).toBe("released");
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  }, 15000);
});

describe("failed snapshot archival freshness", () => {
  async function recoverWithClockChange(f: Awaited<ReturnType<typeof fixture>>, wallMs: number, elapsedMs: number, beforeClaim = false) {
    const entry = join(f.root, "clock-change.ts"), observed = Date.parse(f.evidence.receipt.attempt.observedAt);
    writeFileSync(entry, `const fs = require('node:fs');
      let wall = ${observed}, elapsed = 0n, hooked = false;
      Date.now = () => wall; process.hrtime.bigint = () => elapsed;
      const method = ${JSON.stringify(beforeClaim ? "openSync" : "linkSync")}, original = fs[method];
      fs[method] = (...args) => { const value = original(...args);
        if (method === 'linkSync' || String(args[0]).includes('recovery-proof-')) {
          hooked = true; wall = ${observed + wallMs}; elapsed = ${elapsedMs}n * 1000000n;
        } return value; };
      require(${JSON.stringify(join(__dirname, "forge-local-ownership"))}).recoverForgeLocalOwnership(${JSON.stringify(f.scope)})
        .then(value => console.log(JSON.stringify({ value, hooked })))
        .catch(error => console.log(JSON.stringify({ error: error.message, hooked })));`);
    const child = await exec(process.execPath, ["-r", "ts-node/register/transpile-only", entry], { cwd: join(__dirname, ".."),
      env: { ...process.env, NODE_PATH: ".", TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' } });
    const result = JSON.parse(child.stdout); expect(result.hooked).toBe(true); return result;
  }
  it.each([
    { kind: "wall clock expiry", wallMs: 60001, elapsedMs: 1, released: false },
    { kind: "elapsed expiry despite wall clock rollback", wallMs: 10, elapsedMs: 60001, released: false },
    { kind: "wall clock preceding investigation", wallMs: -1, elapsedMs: 1, released: false },
    { kind: "exact freshness boundary", wallMs: 60000, elapsedMs: 60000, released: true },
  ])("rechecks $kind after publishing the complete claim", async ({ wallMs, elapsedMs, released }) => {
    const f = await fixture();
    const originalOwner = readFileSync(join(f.directory, "owner.json")), originalIntent = readFileSync(join(f.directory, "write-intent.json"));
    const result = await recoverWithClockChange(f, wallMs, elapsedMs);
    if (released) {
      expect(result.value.state).toBe("released"); expect(existsSync(f.directory)).toBe(false);
    } else {
      expect(result.error).toContain("fresh failed-attempt evidence");
      expect(existsSync(f.directory)).toBe(true);
      expect(readFileSync(join(f.directory, "owner.json"))).toEqual(originalOwner);
      expect(readFileSync(join(f.directory, "write-intent.json"))).toEqual(originalIntent);
      const claims = readdirSync(f.directory).filter(name => name.startsWith("verified-recovery-"));
      expect(claims).toHaveLength(1);
      expect(JSON.parse(readFileSync(join(f.directory, claims[0]), "utf8")).proof.disposition).toBe("failed_snapshot_timeout");
      expect(readdirSync(f.scope.root).filter(name => name.startsWith("recovered-") || name.startsWith("recovery-proof-"))).toHaveLength(0);
    }
  });

  it("rejects expired evidence before publishing a claim when preparation takes too long", async () => {
    const f = await fixture(), result = await recoverWithClockChange(f, 60001, 1, true);
    expect(result.error).toContain("fresh failed-attempt evidence");
    expect(existsSync(f.directory)).toBe(true);
    expect(readdirSync(f.directory).filter(name => name.startsWith("verified-recovery-"))).toHaveLength(0);
    expect(readdirSync(f.scope.root).filter(name => name.startsWith("recovered-") || name.startsWith("recovery-proof-"))).toHaveLength(0);
  });
});
