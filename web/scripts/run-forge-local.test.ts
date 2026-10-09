import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { assertReviewedForgeCalendarIssuedContext, captureLocalForgeArtifact, guardedForgeFetch, parseArgs, verifyLocalForgeArtifact,
  type RequestCounts } from "./run-forge-local";
import { runProjectionV2ForDate } from "../lib/projections/run-forge-projections";
import { projectionInputHash } from "../lib/projections/inputCapture";
import { acquireForgeLocalOwnership, ForgeLocalOwnershipError, inspectForgeLocalOwnership, recoverForgeLocalOwnership } from "./forge-local-ownership";
import { parseForgeCalendarArgs, superviseForgeProcess } from "./run-forge-calendar-local";
import { initializeForgeCalendarLedger, openForgeCalendarLedger, type ForgeCalendarRecipe } from "./forge-calendar-ledger";
import { assertForgeCalendarContext, parseForgeCalendarExecutionArgs, parseForgeCalendarRecoveryArgs,
  runForgeCalendarExecution, runForgeCalendarRecovery } from "./forge-calendar-execution";
import { playerForecastSourcePayloadHash } from "../lib/player-forecasts/sourceSnapshot";
import * as issuedContexts from "../lib/projections/issuedContext";
import { FORGE_PROCESS_GUARDIAN_PROTOCOL, runForgeProcessGuardian, type ForgeProcessGuardianIdentity } from "./forge-process-guardian";

const boundary = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), capture: vi.fn(), save: vi.fn(), publish: vi.fn() }));
vi.mock("lib/supabase/server", () => ({ default: { rpc: boundary.rpc, from: boundary.from } }));
vi.mock("../lib/projections/inputCapture", async (original) => ({ ...await original<any>(), captureProjectionInputs: boundary.capture }));
vi.mock("../lib/projections/gameRevisions", async (original) => ({ ...await original<any>(),
  saveForgeInputSnapshot: boundary.save, publishForgeGameRevisions: boundary.publish }));

const exec = promisify(execFile);
const directories: string[] = [];
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks();
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });
const requestCounts = (): RequestCounts => ({ reads: 0, writes: 0, readMs: 0, writeMs: 0,
  acknowledgedWrites: 0, rejectedWrites: 0, unknownWrites: 0 });

function artifactFixture() {
  const repo = mkdtempSync(join(tmpdir(), "forge-artifact-"));
  directories.push(repo);
  mkdirSync(join(repo, "web"));
  writeFileSync(join(repo, "web/package-lock.json"), "{}");
  writeFileSync(join(repo, "web/tsconfig.json"), "{}");
  const source = join(repo, "web/runner.js");
  const dependency = join(repo, "web/dependency.js");
  writeFileSync(source, "exports.run = 1;");
  writeFileSync(dependency, "exports.value = 2;");
  const files = [source, dependency];
  const environment = { FORGE_SKATER_MODEL_MODE: "baseline" };
  const artifact = captureLocalForgeArtifact(repo, environment, files);
  return { repo, source, dependency, files, environment, artifact };
}

describe("local FORGE scope and transport", () => {
  const pin = "a".repeat(64);
  function executionFixture(overrides: { runtimeMs?: number; maxRequests?: number; maxWrites?: number; origin?: string } = {}) {
    const root = mkdtempSync(join(tmpdir(), "forge-calendar-execution-")); directories.push(root); chmodSync(root, 0o700);
    const artifact = { codeVersion: `local:${pin}`, ownershipDirectory: join(root, "owners") }, bytes = JSON.stringify(artifact);
    writeFileSync(join(root, "reviewed-code.json"), bytes, { mode: 0o600 });
    const scheduledStartAt = new Date(Date.now() + 3600000).toISOString(), slateDate = scheduledStartAt.slice(0, 10);
    const unsigned: any = { version: "forge-calendar-scope-v1", mode: "read_only", allowedActions: ["inspect"], origin: overrides.origin ?? "https://db.example",
      deadlineAt: new Date(Date.now() + (overrides.runtimeMs ?? 60000)).toISOString(), calendarPolicy: { version: "forecast-calendar-v1", calendarDays: 14, overlapDays: 7, timeZone: "UTC" },
      profile: { skaterTargets: ["GOALS"], goalieTargets: [] }, playerIds: null,
      artifact: { codeVersion: artifact.codeVersion, contentHash: createHash("sha256").update(bytes).digest("hex") },
      limits: { concurrency: 1, maxGames: 16, maxRequests: overrides.maxRequests ?? 3000, maxWrites: overrides.maxWrites ?? 300,
        runtimeMs: overrides.runtimeMs ?? 60000, requestTimeoutMs: 1000 },
      requests: { reads: 2, writes: 0 }, context: { scheduleRevision: pin, rosterRevision: pin, acceptedNewsRevision: null },
      games: [1, 2].map(gameId => ({ gameId, seasonId: 20262027, slateDate, scheduledStartAt,
        sides: [{ teamId: 1, opponentTeamId: 2, scheduleRevision: pin }, { teamId: 2, opponentTeamId: 1, scheduleRevision: pin }],
        expectedPriorRevisionId: null, required: [{ playerId: "10", nhlPlayerId: 100, teamId: 1, rosterRevision: pin, population: "skater", target: "GOALS" }],
        decision: "requires_generation_or_readiness_repair", exclusions: ["no_eligible_current_revision"] })) };
    unsigned.context.consumerCalendarPolicy = unsigned.calendarPolicy;
    const scope = { ...unsigned, checksum: playerForecastSourcePayloadHash(unsigned) };
    writeFileSync(join(root, "scope.json"), JSON.stringify(scope), { mode: 0o600 });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", scope.origin);
    const ownershipRoot = join(root, "owners"); vi.stubEnv("FORGE_LOCAL_OWNERSHIP_DIR", ownershipRoot);
    const statePath = join(root, "state.json"); writeFileSync(statePath, JSON.stringify({ generated: [], operations: {} }));
    const child = join(root, "child.ts");
    writeFileSync(child, `const { awaitForgeCalendarGrant } = require(${JSON.stringify(join(__dirname, "forge-calendar-ledger"))});
      const fs = require('node:fs'), path = require('node:path');
      awaitForgeCalendarGrant().then(() => { const args = process.argv.slice(2), arg = name => args[args.indexOf(name) + 1];
        fs.writeFileSync(${JSON.stringify(join(root, "io-"))} + process.pid, 'activated');
        const scope = JSON.parse(fs.readFileSync(${JSON.stringify(join(root, "scope.json"))}, 'utf8'));
        const state = JSON.parse(fs.readFileSync(${JSON.stringify(statePath)}, 'utf8'));
        const out = arg('--out'); if (!fs.existsSync(out)) fs.mkdirSync(out, {mode: 0o700});
        const save = (name, data) => fs.writeFileSync(path.join(out, name), JSON.stringify(data), {mode: 0o600});
        const gameId = Number(arg('--game-id')), operationId = arg(args.includes('--reconcile') ? '--reconcile' : '--operation-id');
        if (args.includes('--inspect')) { scope.games.forEach(game => { if (state.operations[game.gameId]) {
          game.expectedPriorRevisionId = state.operations[game.gameId];
          if (process.env.FORGE_TEST_PUBLIC_DISABLED !== 'true') game.decision = 'skip_eligible_detailed'; } });
          if (process.env.FORGE_TEST_CONTEXT_DRIFT === 'true') scope.context.acceptedNewsRevision = 'changed';
          const { checksum, ...unsigned } = scope;
          scope.checksum = require(${JSON.stringify(join(__dirname, "../lib/player-forecasts/sourceSnapshot"))}).playerForecastSourcePayloadHash(unsigned);
          save('scope.json', scope); save('inspection.json', {status: 'inspected', mode: 'read_only', requests: {reads: 1, writes: 0}});
        } else if (args.includes('--reconcile')) {
          if (process.env.FORGE_TEST_PAUSE_RECONCILE === 'true') { setInterval(() => {}, 1000); return; }
          const evidence = state.evidence?.[gameId];
          if (evidence) { save('input-observation.json', evidence.observation); save('issued-revisions.json', evidence.revisions); }
          save('receipt.json', {version: 'forge-local-reconciliation-v1', origin: scope.origin,
            status: state.operations[gameId] ? 'verified_issued' : 'unresolved', automaticRetryAllowed: false,
            scope: {gameId, date: arg('--date'), operationId}, attempt: evidence?.attempt ?? null, requests: {reads: 1, writes: 0}});
        } else {
          const owner = require(${JSON.stringify(join(__dirname, "forge-local-ownership"))}).acquireForgeLocalOwnership({
            origin: scope.origin, gameId, receiptDirectory: out, root: process.env.FORGE_LOCAL_OWNERSHIP_DIR, operationId });
          owner.beforeWrite();
          state.generated.push(gameId); state.operations[gameId] = operationId;
          const uuid = require('node:crypto').randomUUID;
          const attempt = {version: 'forge-local-attempt-v1', operationId, gameId, slateDate: arg('--date'),
            codeVersion: scope.artifact.codeVersion, expectedRevisionId: scope.games.find(game => game.gameId === gameId).expectedPriorRevisionId,
            runId: uuid(), inputSnapshotId: uuid(), revisionId: uuid(), state: 'issued'};
          const captured = {version: 'forge-inputs-v1', runId: attempt.runId, codeVersion: attempt.codeVersion, slateDate: attempt.slateDate,
            horizonGames: 1, gameIds: [gameId], replayClassification: 'captured_live', inputProvenance: {fixture: true}};
          state.evidence ??= {}; state.evidence[gameId] = {attempt,
            observation: {id: attempt.inputSnapshotId, payload: captured,
              payload_hash: require(${JSON.stringify(join(__dirname, "../lib/projections/inputCapture"))}).projectionInputHash(captured)},
            revisions: [{id: attempt.revisionId, game_id: gameId, run_id: attempt.runId, input_snapshot_id: attempt.inputSnapshotId,
              payload: {codeVersion: attempt.codeVersion, inputProvenance: captured.inputProvenance}}]};
          fs.writeFileSync(${JSON.stringify(statePath)}, JSON.stringify(state));
          if (process.env.FORGE_TEST_PAUSE_AFTER_WRITE === 'true') { setInterval(() => {}, 1000); return; }
          if (process.env.FORGE_TEST_DROP_RECEIPT === 'true') { process.exitCode = 1; return; }
          save('receipt.json', {status: 'issued', scope: {gameId, date: arg('--date')}, ownership: {operationId},
            codeVersion: scope.artifact.codeVersion, requests: {reads: 1, writes: 1}}); owner.finish(true); }
      });`);
    const supervise: typeof superviseForgeProcess = args => superviseForgeProcess({ ...args,
      argv: ["-r", "ts-node/register/transpile-only", child, ...args.argv.slice(args.argv.findIndex(arg => arg.endsWith(".ts")) + 1)],
      environment: { ...(args.environment ?? process.env), TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' } });
    return { root, scope, statePath, supervise, child, ownershipRoot };
  }
  async function failedCalendarParent(fixture: ReturnType<typeof executionFixture>) {
    const first = join(fixture.root, "first"), entry = join(fixture.root, "failed-parent.ts");
    writeFileSync(entry, `const { superviseForgeProcess } = require(${JSON.stringify(join(__dirname, "run-forge-calendar-local"))});
      require(${JSON.stringify(join(__dirname, "forge-calendar-execution"))}).runForgeCalendarExecution({write: true,
        scope: ${JSON.stringify(join(fixture.root, "scope.json"))}, out: ${JSON.stringify(first)}}, args => superviseForgeProcess({...args,
          argv: ['-r', 'ts-node/register/transpile-only', ${JSON.stringify(fixture.child)},
            ...args.argv.slice(args.argv.findIndex(arg => arg.endsWith('.ts')) + 1)]}));`);
    await expect(exec(process.execPath, ["-r", "ts-node/register/transpile-only", entry], { cwd: join(__dirname, ".."),
      env: { ...process.env, NODE_PATH: ".", FORGE_TEST_DROP_RECEIPT: "true",
        TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' } })).rejects.toMatchObject({ code: 1 });
    return first;
  }
  it("requires separate explicit calendar write intent and forbids budget changes on resume", () => {
    expect(parseForgeCalendarExecutionArgs(["--write", "--scope", "/private/scope.json", "--out", "/private/new", "--resume", "/private/old"]))
      .toMatchObject({ write: true, scope: "/private/scope.json", out: "/private/new", resume: "/private/old" });
    for (const extra of [[], ["--max-writes", "100"], ["--days", "7"], ["--write"]]) {
      const args = extra.length ? ["--write", "--scope", "/private/scope.json", "--out", "/private/new", ...extra] : ["--scope", "/private/scope.json", "--out", "/private/new"];
      expect(() => parseForgeCalendarExecutionArgs(args)).toThrow();
    }
    const id = randomUUID();
    const args = ["--date", "2026-10-03", "--game-id", "1", "--out", "/private/new", "--write", "--operation-id", id, "--expected-revision", "none", "--max-requests", "7"];
    expect(parseArgs(args)).toMatchObject({ operationId: id, expectedRevisionId: null, maxRequests: 7 });
    expect(() => parseArgs(args.map(value => value === id ? "not-a-uuid" : value))).toThrow();
    expect(() => parseArgs([...args, "--expected-revision", id])).toThrow();
  });
  it("requires separate bounded recovery-only intent and rejects every generation option", () => {
    const args = ["--recover", "--scope", "/private/scope.json", "--resume", "/private/original", "--out", "/private/new"];
    expect(parseForgeCalendarRecoveryArgs(args)).toEqual({ recover: true, scope: "/private/scope.json", resume: "/private/original",
      out: "/private/new", maxRequests: 1000, runtimeMs: 150000, requestTimeoutMs: 10000 });
    for (const extra of [["--write"], ["--refresh"], ["--recover"], ["--max-writes", "1"], ["--game-ids", "1"],
      ["--max-requests", "0"], ["--runtime-ms", "600001"], ["--request-timeout-ms", "60001"]]) {
      expect(() => parseForgeCalendarRecoveryArgs([...args, ...extra])).toThrow();
    }
    expect(() => parseForgeCalendarRecoveryArgs(args.filter(arg => arg !== "--recover"))).toThrow();
    expect(() => parseForgeCalendarExecutionArgs(args)).toThrow();
  });
  it("recovers an expired and exhausted original execution with independent reads and no renewed generation", async () => {
    const { root, scope, statePath, supervise } = executionFixture({ runtimeMs: 3000, maxRequests: 1003, maxWrites: 100 }), first = join(root, "first");
    const oldExit = process.exitCode; vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      vi.stubEnv("FORGE_TEST_DROP_RECEIPT", "true");
      const failed = await runForgeCalendarExecution({ write: true, scope: join(root, "scope.json"), out: first }, supervise);
      expect(failed.budgets).toMatchObject({ requests: 1003, writes: 100, remainingRequests: 0, remainingWrites: 0 });
      const originalIntent = readFileSync(join(first, "ledger.json"), "utf8");
      const generations = failed.budgets.grants.filter(entry => entry.grant.action === "generate").map(entry => entry.grant);
      await vi.waitFor(() => expect(Date.now()).toBeGreaterThanOrEqual(Date.parse(scope.deadlineAt)), { timeout: 3000 });
      vi.stubEnv("FORGE_TEST_DROP_RECEIPT", "false"); vi.stubEnv("FORGE_TEST_CONTEXT_DRIFT", "true");
      const result = await runForgeCalendarRecovery({ recover: true, scope: join(root, "scope.json"), resume: first, out: join(root, "recovery"),
        maxRequests: 5, runtimeMs: 10000, requestTimeoutMs: 1000 }, supervise);
      expect(result).toMatchObject({ mode: "recovery_only", investigationComplete: true, issuanceResolved: true,
        databaseWritesAllowed: false, generationAllowed: false, recommendationReadiness: "not_evaluated",
        originalBudgets: { requests: 1003, writes: 100, deadlineAt: scope.deadlineAt }, recoveryBudgets: { requests: 1, writes: 0 },
        progress: [{ gameId: 1, status: "verified_issued", ownershipRecovery: { state: "released" } }] });
      expect(readFileSync(join(first, "ledger.json"), "utf8")).toBe(originalIntent);
      const after = openForgeCalendarLedger(first, JSON.parse(originalIntent).recipe).state();
      expect(after.grants.filter(entry => entry.grant.action === "generate").map(entry => entry.grant)).toEqual(generations);
      expect(after).toMatchObject({ requests: 1003, writes: 100, expired: true });
      expect(JSON.parse(readFileSync(statePath, "utf8")).generated).toEqual([1]);
      expect(() => openForgeCalendarLedger(join(root, "recovery"), JSON.parse(readFileSync(join(root, "recovery/ledger.json"), "utf8")).recipe)
        .grant({ action: "generate", gameId: 2, maxRequests: 1, maxWrites: 0 })).toThrow();
    } finally { process.exitCode = oldExit; }
  }, 15000);
  it("leaves negative recovery and interrupted filesystem claims unresolved without cleanup or generation", async () => {
    const oldExit = process.exitCode; vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const { root, args, statePath, directory, supervise } = await recoveryFixture(), first = join(root, "first");
      const state = readFileSync(statePath, "utf8");
      writeFileSync(statePath, JSON.stringify({ generated: [1], operations: {} }));
      const options = { recover: true as const, scope: join(root, "scope.json"), resume: first,
        out: join(root, "negative"), maxRequests: 5, runtimeMs: 10000, requestTimeoutMs: 1000 };
      const negative = await runForgeCalendarRecovery(options, supervise);
      expect(negative).toMatchObject({ investigationComplete: true, issuanceResolved: false, generationAllowed: false,
        recoveryBudgets: { writes: 0 }, progress: [{ gameId: 1, status: "unresolved" }] });
      expect(existsSync(directory)).toBe(true);
      writeFileSync(statePath, state); mkdirSync(join(directory, "verified-recovery"), { mode: 0o700 });
      const partial = await runForgeCalendarRecovery({ ...options, out: join(root, "interrupted-claim") }, supervise);
      expect(partial).toMatchObject({ investigationComplete: false, issuanceResolved: false, recoveryBudgets: { writes: 0 } });
      expect(existsSync(join(directory, "verified-recovery"))).toBe(true);
      expect(inspectForgeLocalOwnership(directory).owner?.operationId).toBe(args.operationId);
      expect(JSON.parse(readFileSync(statePath, "utf8")).generated).toEqual([1]);
      expect(partial.originalBudgets).toEqual(negative.originalBudgets);
    } finally { process.exitCode = oldExit; }
  }, 15000);
  it("bounds a recovery child deadline without resetting unknown reads or releasing old ownership", async () => {
    const oldExit = process.exitCode; vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const { root, directory, supervise } = await recoveryFixture();
      vi.stubEnv("FORGE_TEST_PAUSE_RECONCILE", "true");
      const result = await runForgeCalendarRecovery({ recover: true, scope: join(root, "scope.json"), resume: join(root, "first"),
        out: join(root, "deadline"), maxRequests: 5, runtimeMs: 1000, requestTimeoutMs: 1000 }, supervise);
      expect(result).toMatchObject({ investigationComplete: false, issuanceResolved: false, generationAllowed: false,
        recoveryBudgets: { requests: 5, writes: 0 }, originalBudgets: { requests: 1003, writes: 100 } });
      expect(existsSync(directory)).toBe(true);
      expect(result.recoveryBudgets.grants).toHaveLength(1);
      expect(result.recoveryBudgets.grants[0].result?.outcome).toBe("deadline");
      expect(existsSync(join(root, `io-${result.recoveryBudgets.grants[0].process!.pid}`))).toBe(true);
      for (const grant of result.recoveryBudgets.grants) if (grant.process) expect(() => process.kill(grant.process!.pid, 0)).toThrow();
    } finally { process.exitCode = oldExit; }
  }, 15000);
  it.skipIf(process.platform === "win32")("blocks actual competing recovery/resume, then automatically stops an orphaned investigator without refunding its claim", async () => {
    const fixture = executionFixture(), first = await failedCalendarParent(fixture), heldOut = join(fixture.root, "held");
    const options = { recover: true as const, scope: join(fixture.root, "scope.json"), resume: first, out: heldOut,
      maxRequests: 5, runtimeMs: 15000, requestTimeoutMs: 1000 };
    const entry = join(fixture.root, "held-recovery.ts");
    writeFileSync(entry, `const { superviseForgeProcess } = require(${JSON.stringify(join(__dirname, "run-forge-calendar-local"))});
      require(${JSON.stringify(join(__dirname, "forge-calendar-execution"))}).runForgeCalendarRecovery(${JSON.stringify(options)},
        args => superviseForgeProcess({...args, argv: ['-r', 'ts-node/register/transpile-only', ${JSON.stringify(fixture.child)},
          ...args.argv.slice(args.argv.findIndex(arg => arg.endsWith('.ts')) + 1)]}));`);
    const parent = spawn(process.execPath, ["-r", "ts-node/register/transpile-only", entry], { cwd: join(__dirname, ".."),
      env: { ...process.env, NODE_PATH: ".", FORGE_TEST_PAUSE_RECONCILE: "true",
        TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' } });
    parent.stdout.resume(); parent.stderr.resume();
    const closed = new Promise(resolveClose => parent.once("close", (code, signal) => resolveClose({ code, signal })));
    const original = openForgeCalendarLedger(first, JSON.parse(readFileSync(join(first, "ledger.json"), "utf8")).recipe);
    const oldExit = process.exitCode; let childPid: number | undefined, guardianPid: number | undefined;
    vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await vi.waitFor(() => {
        const latest = original.state().grants.at(-1)!;
        expect(latest.grant.action).toBe("recovery");
        childPid = latest.investigation?.grants.at(-1)?.process?.pid;
        guardianPid = latest.investigation?.grants.at(-1)?.process?.guardian?.pid;
        expect(childPid).toBeDefined(); expect(existsSync(join(fixture.root, `io-${childPid}`))).toBe(true);
        expect(guardianPid).toBeDefined();
      }, { timeout: 8000 });
      const count = original.state().grants.length;
      const blocked = await runForgeCalendarRecovery({ ...options, out: join(fixture.root, "competing") }, fixture.supervise);
      expect(blocked).toMatchObject({ investigationComplete: false, recoveryBudgets: { requests: 0, writes: 0 } });
      const resume = await runForgeCalendarExecution({ write: true, scope: options.scope, resume: first, out: join(fixture.root, "resume-blocked") }, fixture.supervise);
      expect(resume.executionComplete).toBe(false); expect(original.state().grants).toHaveLength(count);
      parent.kill("SIGKILL"); expect(await closed).toMatchObject({ signal: "SIGKILL" });
      await vi.waitFor(() => expect(() => process.kill(childPid!, 0)).toThrow(), { timeout: 5000 });
      await vi.waitFor(() => expect(() => process.kill(guardianPid!, 0)).toThrow(), { timeout: 5000 });
      const completed = await runForgeCalendarRecovery({ ...options, out: join(fixture.root, "completed") }, fixture.supervise);
      expect(completed).toMatchObject({ investigationComplete: true, issuanceResolved: true, generationAllowed: false,
        recoveryBudgets: { requests: 1, writes: 0 }, originalBudgets: { requests: 1003, writes: 100 } });
      const interrupted = original.state().grants.find(entry => entry.grant.action === "recovery" && entry.grant.coordinator.pid === parent.pid)!;
      expect(interrupted.result).toBeNull(); expect(interrupted.investigation).toMatchObject({ requests: 5, writes: 0, remainingRequests: 0 });
      expect(JSON.parse(readFileSync(fixture.statePath, "utf8")).generated).toEqual([1]);
    } finally {
      if (parent.exitCode === null && parent.signalCode === null) parent.kill("SIGKILL");
      await closed;
      if (guardianPid) try { process.kill(-guardianPid, "SIGKILL"); } catch { /* Owned fixture already stopped. */ }
      process.exitCode = oldExit;
    }
  }, 30000);
  it("runs the actual recovery CLI through only bounded Supabase GETs and matching retained issuance", async () => {
    const methods: string[] = []; let evidence: any;
    const server = createServer((request, response) => {
      methods.push(request.method!); response.setHeader("content-type", "application/json");
      if (request.method !== "GET") { response.statusCode = 500; response.end("{}"); return; }
      if (request.url?.startsWith("/rest/v1/rpc/inspect_forge_local_attempt?")) response.end(JSON.stringify(evidence.attempt));
      else if (request.url?.startsWith("/rest/v1/player_forecast_source_observations?")) response.end(JSON.stringify(evidence.observation));
      else if (request.url?.startsWith("/rest/v1/forge_game_revisions?")) response.end(JSON.stringify(evidence.revisions));
      else { response.statusCode = 500; response.end("{}"); }
    });
    await new Promise<void>(resolveListen => server.listen(0, resolveListen));
    try {
      const address = server.address(); if (!address || typeof address === "string") throw new Error("Expected local port");
      const fixture = executionFixture({ origin: `http://localhost:${address.port}` }), first = await failedCalendarParent(fixture);
      evidence = JSON.parse(readFileSync(fixture.statePath, "utf8")).evidence[1];
      const out = join(fixture.root, "cli-recovery");
      await exec(process.execPath, ["-r", "ts-node/register/transpile-only", "scripts/run-forge-calendar-local.ts", "--recover",
        "--scope", join(fixture.root, "scope.json"), "--resume", first, "--out", out, "--max-requests", "5", "--runtime-ms", "10000"],
        { cwd: join(__dirname, ".."), env: { ...process.env, NODE_PATH: ".", SUPABASE_SERVICE_ROLE_KEY: "local-test-only",
          TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' } });
      const receipt = JSON.parse(readFileSync(join(out, "receipt.json"), "utf8"));
      expect(receipt).toMatchObject({ mode: "recovery_only", generationAllowed: false, databaseWritesAllowed: false,
        investigationComplete: true, issuanceResolved: true, recoveryBudgets: { requests: 3, writes: 0 },
        originalBudgets: { requests: 1003, writes: 100 }, progress: [{ gameId: 1, status: "verified_issued", ownershipRecovery: { state: "released" } }] });
      expect(methods).toEqual(["GET", "GET", "GET"]);
      expect(JSON.parse(readFileSync(fixture.statePath, "utf8")).generated).toEqual([1]);
    } finally { await new Promise<void>(resolveClose => server.close(() => resolveClose())); }
  }, 20000);
  it("checks reviewed calendar game, schedule and roster identities before captured calculation", () => {
    const { scope } = executionFixture(), game = scope.games[0];
    const context: any = { game: { id: game.gameId, date: game.slateDate, seasonId: game.seasonId, startTime: game.scheduledStartAt },
      schedule: game.sides.map((row: any) => ({ ...row, revision: row.scheduleRevision })),
      roster: [{ canonicalId: 10, nhlId: 100, teamId: 1, revision: pin }] };
    expect(() => assertReviewedForgeCalendarIssuedContext(game, [context])).not.toThrow();
    for (const changed of [{ game: { ...context.game, seasonId: 20252026 } }, { schedule: context.schedule.slice(0, 1) },
      { roster: [] }, { roster: [{ ...context.roster[0], revision: "changed" }] }, { roster: [{ ...context.roster[0], nhlId: 101 }] }]) {
      expect(() => assertReviewedForgeCalendarIssuedContext(game, [{ ...context, ...changed }])).toThrow("Captured context changed");
    }
    expect(() => assertReviewedForgeCalendarIssuedContext(game, [context], Date.parse(game.scheduledStartAt))).toThrow();
    expect(() => assertForgeCalendarContext(scope, { ...scope, context: { ...scope.context, acceptedNewsRevision: "changed" } })).toThrow("context changed");
  });
  it("executes the actual serial calendar supervisor with durable grants and distinguishes public coverage", async () => {
    const { root, scope, statePath, supervise } = executionFixture(), output = join(root, "execution");
    const oldExit = process.exitCode; vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const result = await runForgeCalendarExecution({ write: true, scope: join(root, "scope.json"), out: output }, supervise);
      expect(result).toMatchObject({ executionComplete: true, eligibleCoverageComplete: true, recommendationReadiness: "not_evaluated",
        budgets: { requests: 8, writes: 2 }, progress: [{ gameId: 1, status: "issued" }, { gameId: 2, status: "issued" }] });
      expect(JSON.parse(readFileSync(statePath, "utf8")).generated).toEqual([1, 2]);
      expect(result.budgets.deadlineAt).toBe(scope.deadlineAt);
      expect(result.budgets.grants.every(entry => !!entry.process && !!entry.result)).toBe(true);
    } finally { process.exitCode = oldExit; }
  }, 15000);
  it("resumes a lost calendar write receipt by positive read-only reconciliation without duplicate generation", async () => {
    const { root, statePath, supervise } = executionFixture(), first = join(root, "first"), resumed = join(root, "resumed");
    const oldExit = process.exitCode; vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      vi.stubEnv("FORGE_TEST_DROP_RECEIPT", "true");
      const failed = await runForgeCalendarExecution({ write: true, scope: join(root, "scope.json"), out: first }, supervise);
      expect(failed.executionComplete).toBe(false);
      expect(failed.budgets).toMatchObject({ requests: 1003, writes: 100 });
      vi.stubEnv("FORGE_TEST_DROP_RECEIPT", "false");
      const result = await runForgeCalendarExecution({ write: true, scope: join(root, "scope.json"), out: resumed, resume: first }, supervise);
      expect(result).toMatchObject({ executionComplete: true, eligibleCoverageComplete: true,
        budgets: { requests: 1008, writes: 101 }, progress: [{ gameId: 1, status: "verified_issued" }, { gameId: 2, status: "issued" }] });
      expect(JSON.parse(readFileSync(statePath, "utf8")).generated).toEqual([1, 2]);
      expect(result.budgets.grants.filter(entry => entry.grant.action === "generate" && entry.grant.gameId === 1)).toHaveLength(1);
      expect(result.progress[0].ownershipRecovery?.state).toBe("released");
      expect(readdirSync(join(root, "owners")).filter(name => name.startsWith("recovered-"))).toHaveLength(1);
    } finally { process.exitCode = oldExit; }
  }, 15000);
  it("accounts for positive prior issuance after context drift but never starts changed-context generation", async () => {
    const { root, statePath, supervise } = executionFixture(), first = join(root, "first");
    const oldExit = process.exitCode; vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      vi.stubEnv("FORGE_TEST_DROP_RECEIPT", "true");
      await runForgeCalendarExecution({ write: true, scope: join(root, "scope.json"), out: first }, supervise);
      vi.stubEnv("FORGE_TEST_DROP_RECEIPT", "false"); vi.stubEnv("FORGE_TEST_CONTEXT_DRIFT", "true");
      const result = await runForgeCalendarExecution({ write: true, scope: join(root, "scope.json"), out: join(root, "changed"), resume: first }, supervise);
      expect(result).toMatchObject({ executionComplete: false, eligibleCoverageComplete: false,
        progress: [{ gameId: 1, status: "verified_issued", ownershipRecovery: { state: "released" } }] });
      expect(JSON.parse(readFileSync(statePath, "utf8")).generated).toEqual([1]);
      expect(result.budgets.grants.filter(entry => entry.grant.action === "generate")).toHaveLength(1);
    } finally { process.exitCode = oldExit; }
  }, 15000);

  async function recoveryFixture() {
    const fixture = executionFixture(), first = join(fixture.root, "first");
    vi.stubEnv("FORGE_TEST_DROP_RECEIPT", "true");
    await runForgeCalendarExecution({ write: true, scope: join(fixture.root, "scope.json"), out: first }, fixture.supervise);
    vi.stubEnv("FORGE_TEST_DROP_RECEIPT", "false");
    const state = JSON.parse(readFileSync(fixture.statePath, "utf8")), evidence = state.evidence[1];
    const directory = join(fixture.ownershipRoot, readdirSync(fixture.ownershipRoot).find(name => name.startsWith("1-"))!);
    const owner = inspectForgeLocalOwnership(directory).owner!;
    const evidenceDirectory = join(fixture.root, "positive-readback"); mkdirSync(evidenceDirectory, { mode: 0o700 });
    const receipt = { version: "forge-local-reconciliation-v1", origin: fixture.scope.origin, status: "verified_issued",
      automaticRetryAllowed: false, requests: { reads: 3, writes: 0 },
      scope: { operationId: owner.operationId, gameId: 1, date: fixture.scope.games[0].slateDate }, attempt: evidence.attempt };
    for (const [name, value] of [["receipt.json", receipt], ["input-observation.json", evidence.observation], ["issued-revisions.json", evidence.revisions]]) {
      writeFileSync(join(evidenceDirectory, name as string), JSON.stringify(value), { mode: 0o600 });
    }
    return { ...fixture, directory, receipt, evidence, args: { origin: fixture.scope.origin, gameId: 1, date: fixture.scope.games[0].slateDate,
      operationId: owner.operationId, codeVersion: fixture.scope.artifact.codeVersion, expectedRevisionId: null,
      receiptDirectory: owner.receiptDirectory, writer: { pid: owner.pid, hostname: owner.hostname }, evidenceDirectory, root: fixture.ownershipRoot } };
  }
  it("requires positive immutable readback and a terminal local writer before ownership recovery", async () => {
    const oldExit = process.exitCode; vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const { args, directory, receipt, evidence } = await recoveryFixture();
      for (const changed of [{ origin: "https://other.example" }, { operationId: randomUUID() }, { expectedRevisionId: randomUUID() },
        { receiptDirectory: "/unrelated" }, { writer: { ...args.writer, pid: process.pid } },
        { writer: { ...args.writer, hostname: "another-host" } }]) {
        await expect(recoverForgeLocalOwnership({ ...args, ...changed })).rejects.toThrow();
        expect(existsSync(directory)).toBe(true);
      }
      for (const changed of [{ status: "unresolved" }, { attempt: { ...receipt.attempt, state: "expired" } },
        { attempt: { ...receipt.attempt, revisionId: randomUUID() } }, { requests: { reads: 3, writes: 1 } }]) {
        writeFileSync(join(args.evidenceDirectory, "receipt.json"), JSON.stringify({ ...receipt, ...changed }));
        await expect(recoverForgeLocalOwnership(args)).rejects.toThrow();
        expect(existsSync(directory)).toBe(true);
      }
      writeFileSync(join(args.evidenceDirectory, "receipt.json"), JSON.stringify(receipt));
      const changed = structuredClone(evidence.observation); changed.payload.inputProvenance.fixture = false;
      changed.payload_hash = projectionInputHash(changed.payload);
      writeFileSync(join(args.evidenceDirectory, "input-observation.json"), JSON.stringify(changed));
      await expect(recoverForgeLocalOwnership(args)).rejects.toThrow("input/revision");
      writeFileSync(join(args.evidenceDirectory, "input-observation.json"), JSON.stringify(evidence.observation));
      chmodSync(join(args.evidenceDirectory, "receipt.json"), 0o644);
      await expect(recoverForgeLocalOwnership(args)).rejects.toThrow("private regular file");
      chmodSync(join(args.evidenceDirectory, "receipt.json"), 0o600);
      const result = await recoverForgeLocalOwnership(args);
      expect(result.state).toBe("released"); expect(existsSync(directory)).toBe(false);
      expect(readFileSync(join(result.archive!, "write-intent.json"), "utf8")).toContain(args.operationId);
      const claimName = readdirSync(result.archive!).find(name => name.startsWith("verified-recovery-"))!;
      expect(JSON.parse(readFileSync(join(result.archive!, claimName), "utf8")).proof).toMatchObject({
        operationId: args.operationId, evidenceHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
      expect(await recoverForgeLocalOwnership(args)).toEqual({ state: "absent" });
      const replacement = acquireForgeLocalOwnership({ origin: args.origin, gameId: args.gameId, receiptDirectory: args.evidenceDirectory, root: args.root });
      replacement.beforeWrite();
      await expect(recoverForgeLocalOwnership(args)).rejects.toThrow("write intent changed");
      replacement.assertOwned(); expect(existsSync(replacement.reference.directory)).toBe(true);
      replacement.finish(true);
    } finally { process.exitCode = oldExit; }
  }, 15000);
  it("serializes actual competing recovery processes and preserves a later replacement owner", async () => {
    const oldExit = process.exitCode; vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const fixture = await recoveryFixture(), { args, ownershipRoot, root, directory } = fixture, entry = join(root, "recover.ts");
      const interrupted = await pausedOwnershipRecovery(fixture, "claimed");
      interrupted.child.kill("SIGKILL"); await expect(interrupted.closed).resolves.toEqual({ code: null, signal: "SIGKILL" });
      writeFileSync(entry, `require(${JSON.stringify(join(__dirname, "forge-local-ownership"))}).recoverForgeLocalOwnership(${JSON.stringify(args)})
        .then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });`);
      const run = () => exec(process.execPath, ["-r", "ts-node/register/transpile-only", entry], { cwd: join(__dirname, ".."),
        env: { ...process.env, NODE_PATH: ".", TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' } });
      const results = await Promise.allSettled([run(), run()]);
      expect(results.some(result => result.status === "fulfilled" && JSON.parse(result.value.stdout).state === "released")).toBe(true);
      for (const result of results) if (result.status === "rejected") expect(result.reason.stderr).toMatch(/EEXIST|ENOENT|changed|investigator/);
      expect(existsSync(directory)).toBe(false);
      expect(readdirSync(ownershipRoot).filter(name => name.startsWith("recovered-"))).toHaveLength(1);
      const archive = join(ownershipRoot, readdirSync(ownershipRoot).find(name => name.startsWith("recovered-"))!);
      expect(readdirSync(archive).filter(name => name.startsWith("verified-recovery-"))).toHaveLength(2);
      const replacement = acquireForgeLocalOwnership({ origin: args.origin, gameId: args.gameId, receiptDirectory: root, root: ownershipRoot });
      replacement.beforeWrite(); await expect(run()).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("write intent changed") });
      replacement.assertOwned(); replacement.finish(true);
    } finally { process.exitCode = oldExit; }
  }, 20000);
  async function pausedOwnershipRecovery(fixture: Awaited<ReturnType<typeof recoveryFixture>>,
    phase: "prepared" | "claimed" | "before archive" | "archived") {
    const marker = join(fixture.root, `recovery-checkpoint-${randomUUID()}`), entry = `${marker}.ts`;
    writeFileSync(entry, `const fs = require('node:fs'), link = fs.linkSync, rename = fs.renameSync;
      const pause = () => { fs.writeFileSync(${JSON.stringify(marker)}, 'paused', {mode: 0o600});
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0); };
      fs.linkSync = (...args) => { ${phase === "prepared" ? "pause();" : ""}
        const result = link(...args); ${phase === "claimed" ? "pause();" : ""} return result; };
      fs.renameSync = (...args) => { ${phase === "before archive" ? "pause();" : ""}
        const result = rename(...args); ${phase === "archived" ? "pause();" : ""} return result; };
      require(${JSON.stringify(join(__dirname, "forge-local-ownership"))}).recoverForgeLocalOwnership(${JSON.stringify(fixture.args)})
        .catch(error => { console.error(error.message); process.exitCode = 1; });`);
    const child = spawn(process.execPath, ["-r", "ts-node/register/transpile-only", entry], { cwd: join(__dirname, ".."),
      env: { ...process.env, NODE_PATH: ".", TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' } });
    let output = "";
    child.stdout.on("data", data => { output += data.toString(); }); child.stderr.on("data", data => { output += data.toString(); });
    const closed = new Promise(resolveClose => child.once("close", (code, signal) => resolveClose({ code, signal })));
    try {
      await vi.waitFor(() => {
        if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Recovery child stopped: ${output}`);
        expect(existsSync(marker)).toBe(true);
      }, { timeout: 5000 });
    } catch (error) { child.kill("SIGKILL"); await closed; throw error; }
    return { child, closed };
  }
  it.skipIf(process.platform === "win32").each(["prepared", "claimed", "before archive", "archived"] as const)(
    "recovers an actual investigator killed at the %s checkpoint without altering its original operation", async phase => {
      const oldExit = process.exitCode; vi.spyOn(console, "log").mockImplementation(() => {});
      let pending: Awaited<ReturnType<typeof pausedOwnershipRecovery>> | null = null;
      try {
        const fixture = await recoveryFixture(), { args, directory, root, statePath } = fixture;
        const original = readFileSync(join(root, "first/ledger.json"), "utf8"), state = readFileSync(statePath, "utf8");
        const budget = openForgeCalendarLedger(join(root, "first"), JSON.parse(original).recipe).state();
        pending = await pausedOwnershipRecovery(fixture, phase);
        if (phase === "claimed" || phase === "before archive") {
          await expect(recoverForgeLocalOwnership(args)).rejects.toThrow("investigator");
          expect(inspectForgeLocalOwnership(directory).owner?.operationId).toBe(args.operationId);
        }
        pending.child.kill("SIGKILL"); await expect(pending.closed).resolves.toEqual({ code: null, signal: "SIGKILL" }); pending = null;
        if (phase === "claimed" || phase === "before archive") {
          const firstClaim = readdirSync(directory).filter(name => name.startsWith("verified-recovery-"));
          expect(firstClaim).toHaveLength(1);
          const retained = readFileSync(join(directory, firstClaim[0]), "utf8");
          // A second interrupted takeover must keep the original proof and predecessor rather than delete its lock.
          pending = await pausedOwnershipRecovery(fixture, "claimed");
          await expect(recoverForgeLocalOwnership(args)).rejects.toThrow("investigator");
          pending.child.kill("SIGKILL"); await pending.closed; pending = null;
          expect(readFileSync(join(directory, firstClaim[0]), "utf8")).toBe(retained);
          expect(readdirSync(directory).filter(name => name.startsWith("verified-recovery-"))).toHaveLength(2);
        }
        const result = await recoverForgeLocalOwnership(args);
        expect(result.state).toBe(phase === "archived" ? "absent" : "released");
        expect(existsSync(directory)).toBe(false);
        const archiveName = readdirSync(fixture.ownershipRoot).find(name => name.startsWith(`recovered-${args.operationId}-`))!;
        const archive = join(fixture.ownershipRoot, archiveName), names = readdirSync(archive).filter(name => name.startsWith("verified-recovery-"));
        expect(names).toHaveLength(phase === "claimed" || phase === "before archive" ? 3 : 1);
        let prior: string | null = null;
        for (const name of names.sort()) {
          const record = JSON.parse(readFileSync(join(archive, name), "utf8")), { checksum, ...unsigned } = record;
          expect(record.previous).toBe(prior); expect(checksum).toBe(projectionInputHash(unsigned)); prior = checksum;
          expect(record.proof).toMatchObject({ operationId: args.operationId, owner: { pid: args.writer.pid }, evidenceDirectory: realpathSync(args.evidenceDirectory) });
        }
        expect(readFileSync(statePath, "utf8")).toBe(state);
        expect(readFileSync(join(root, "first/ledger.json"), "utf8")).toBe(original);
        expect(openForgeCalendarLedger(join(root, "first"), JSON.parse(original).recipe).state()).toMatchObject({
          requests: budget.requests, writes: budget.writes, deadlineAt: budget.deadlineAt });
        const replacement = acquireForgeLocalOwnership({ origin: args.origin, gameId: args.gameId, receiptDirectory: root, root: fixture.ownershipRoot });
        replacement.beforeWrite(); await expect(recoverForgeLocalOwnership(args)).rejects.toThrow("write intent changed");
        replacement.assertOwned(); replacement.finish(true);
      } finally { if (pending) { pending.child.kill("SIGKILL"); await pending.closed; } process.exitCode = oldExit; }
    }, 20000);
  it.skipIf(process.platform === "win32")("preserves interrupted claims with altered identity, missing evidence or a live investigator", async () => {
    const oldExit = process.exitCode; vi.spyOn(console, "log").mockImplementation(() => {});
    let pending: Awaited<ReturnType<typeof pausedOwnershipRecovery>> | null = null;
    try {
      const fixture = await recoveryFixture(), { args, directory } = fixture;
      pending = await pausedOwnershipRecovery(fixture, "claimed");
      pending.child.kill("SIGKILL"); await pending.closed; pending = null;
      const name = readdirSync(directory).find(name => name.startsWith("verified-recovery-"))!, path = join(directory, name);
      const original = readFileSync(path, "utf8"), claim = JSON.parse(original);
      for (const changed of [{ investigator: { ...claim.investigator, pid: process.pid } },
        { investigator: { ...claim.investigator, hostname: "foreign-host" } }, { previous: "a".repeat(64) },
        { directoryIdentity: { ...claim.directoryIdentity, ino: claim.directoryIdentity.ino + 1 } },
        { proof: { ...claim.proof, evidenceHash: "b".repeat(64) } }]) {
        const { checksum: _checksum, ...unsigned } = { ...claim, ...changed };
        const altered = JSON.stringify({ ...unsigned, checksum: projectionInputHash(unsigned) });
        writeFileSync(path, altered);
        await expect(recoverForgeLocalOwnership(args)).rejects.toThrow();
        expect(readFileSync(path, "utf8")).toBe(altered);
        expect(inspectForgeLocalOwnership(directory).owner?.operationId).toBe(args.operationId);
      }
      writeFileSync(path, original.slice(0, 25));
      await expect(recoverForgeLocalOwnership(args)).rejects.toThrow();
      expect(readFileSync(path, "utf8")).toBe(original.slice(0, 25));
      writeFileSync(path, original);
      const fresh = join(fixture.root, "fresh-readback"); mkdirSync(fresh, { mode: 0o700 });
      for (const file of ["receipt.json", "input-observation.json", "issued-revisions.json"]) {
        writeFileSync(join(fresh, file), readFileSync(join(args.evidenceDirectory, file), "utf8"), { mode: 0o600 });
      }
      const retained = readFileSync(join(args.evidenceDirectory, "receipt.json"), "utf8");
      rmSync(join(args.evidenceDirectory, "receipt.json"));
      await expect(recoverForgeLocalOwnership({ ...args, evidenceDirectory: fresh })).rejects.toThrow();
      expect(readFileSync(path, "utf8")).toBe(original); expect(existsSync(directory)).toBe(true);
      writeFileSync(join(args.evidenceDirectory, "receipt.json"), retained, { mode: 0o600 });
      const originalRevisions = readFileSync(join(args.evidenceDirectory, "issued-revisions.json"), "utf8");
      const alteredRevisions = JSON.parse(originalRevisions); alteredRevisions[0].id = randomUUID();
      writeFileSync(join(args.evidenceDirectory, "issued-revisions.json"), JSON.stringify(alteredRevisions));
      const { checksum: _checksum, ...rehash } = claim;
      rehash.proof = { ...claim.proof, evidenceHash: projectionInputHash({
        receipt: JSON.parse(retained), observation: JSON.parse(readFileSync(join(args.evidenceDirectory, "input-observation.json"), "utf8")),
        revisions: alteredRevisions }) };
      const rehashed = JSON.stringify({ ...rehash, checksum: projectionInputHash(rehash) }); writeFileSync(path, rehashed);
      await expect(recoverForgeLocalOwnership({ ...args, evidenceDirectory: fresh })).rejects.toThrow("evidence");
      expect(readFileSync(path, "utf8")).toBe(rehashed); expect(existsSync(directory)).toBe(true);
      writeFileSync(join(args.evidenceDirectory, "issued-revisions.json"), originalRevisions); writeFileSync(path, original);
      expect((await recoverForgeLocalOwnership({ ...args, evidenceDirectory: fresh })).state).toBe("released");
    } finally { if (pending) { pending.child.kill("SIGKILL"); await pending.closed; } process.exitCode = oldExit; }
  }, 15000);
  it.skipIf(process.platform === "win32").each(["before activation", "after write"] as const)(
    "automatically stops children after an actual parent is killed %s without resetting allocations", async phase => {
      const { root, scope, statePath, supervise, child } = executionFixture(), first = join(root, "first");
      const oldExit = process.exitCode; vi.spyOn(console, "log").mockImplementation(() => {});
      const parentEntry = join(root, "parent.ts");
      writeFileSync(parentEntry, `const { superviseForgeProcess } = require(${JSON.stringify(join(__dirname, "run-forge-calendar-local"))});
        const { runForgeCalendarExecution } = require(${JSON.stringify(join(__dirname, "forge-calendar-execution"))});
        runForgeCalendarExecution({write: true, scope: ${JSON.stringify(join(root, "scope.json"))}, out: ${JSON.stringify(first)}},
          args => superviseForgeProcess({...args,
            argv: ['-r', 'ts-node/register/transpile-only', ${JSON.stringify(child)}, ...args.argv.slice(args.argv.findIndex(arg => arg.endsWith('.ts')) + 1)],
            beforeStart: (pid, guardian) => { args.beforeStart(pid, guardian); ${phase === "before activation" ? "process.kill(process.pid, 'SIGKILL');" : ""} }
          })).catch(error => { console.error(error.message); process.exitCode = 1; });`);
      const parent = spawn(process.execPath, ["-r", "ts-node/register/transpile-only", parentEntry], { cwd: join(__dirname, ".."),
        env: { ...process.env, NODE_PATH: ".", FORGE_TEST_PAUSE_AFTER_WRITE: String(phase === "after write"),
          TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' } });
      let output = "";
      parent.stdout.on("data", data => { output += data.toString(); }); parent.stderr.on("data", data => { output += data.toString(); });
      const closed = new Promise(resolveClose => parent.once("close", (code, signal) => resolveClose({ code, signal })));
      const recipe: ForgeCalendarRecipe = { scopeChecksum: scope.checksum, origin: scope.origin, artifactHash: scope.artifact.contentHash,
        codeVersion: scope.artifact.codeVersion, gameIds: [1, 2], deadlineAt: scope.deadlineAt,
        maxRequests: scope.limits.maxRequests, maxWrites: scope.limits.maxWrites, initialRequests: scope.requests.reads };
      let childPid: number | undefined, guardianPid: number | undefined;
      try {
        await vi.waitFor(() => {
          const state = openForgeCalendarLedger(first, recipe).state();
          const latest = state.grants.at(-1)!; expect(latest.process).not.toBeNull(); childPid = latest.process!.pid;
          guardianPid = latest.process!.guardian?.pid; expect(guardianPid).toBeDefined();
          if (phase === "after write") expect(JSON.parse(readFileSync(statePath, "utf8")).generated).toEqual([1]);
        }, { timeout: 10000 });
        const ledger = openForgeCalendarLedger(first, recipe), interrupted = ledger.state();
        if (phase === "after write") {
          expect(() => process.kill(childPid!, 0)).not.toThrow();
          const blocked = await runForgeCalendarExecution({ write: true, scope: join(root, "scope.json"), out: join(root, "blocked"), resume: first }, supervise);
          expect(blocked.executionComplete).toBe(false);
          expect(blocked.budgets.grants).toHaveLength(interrupted.grants.length);
          expect(JSON.parse(readFileSync(statePath, "utf8")).generated).toEqual([1]);
          parent.kill("SIGKILL");
        }
        expect(await closed, output).toMatchObject({ signal: "SIGKILL" });
        await vi.waitFor(() => expect(() => process.kill(childPid!, 0)).toThrow(), { timeout: 5000 });
        await vi.waitFor(() => expect(() => process.kill(guardianPid!, 0)).toThrow(), { timeout: 5000 });
        if (phase === "before activation") expect(existsSync(join(root, `io-${childPid}`))).toBe(false);
        expect(interrupted).toMatchObject({ requests: phase === "after write" ? 1003 : 1002,
          writes: phase === "after write" ? 100 : 0, deadlineAt: scope.deadlineAt });
        const recovered = await runForgeCalendarExecution({ write: true, scope: join(root, "scope.json"), out: join(root, "recovered"), resume: first }, supervise);
        expect(recovered).toMatchObject({ executionComplete: true, eligibleCoverageComplete: true,
          budgets: { requests: 1008, writes: phase === "after write" ? 101 : 2, deadlineAt: scope.deadlineAt } });
        expect(JSON.parse(readFileSync(statePath, "utf8")).generated).toEqual([1, 2]);
        if (phase === "after write") expect(recovered.progress[0]).toMatchObject({ status: "verified_issued", ownershipRecovery: { state: "released" } });
        expect(recovered.budgets.grants.filter(entry => entry.grant.action === "generate" && entry.grant.gameId === 1)).toHaveLength(1);
      } finally {
        if (parent.exitCode === null && parent.signalCode === null) parent.kill("SIGKILL");
        await closed;
        if (guardianPid) try { process.kill(-guardianPid, "SIGKILL"); } catch { /* Owned fixture already stopped. */ }
        process.exitCode = oldExit;
      }
    }, 30000);
  it("keeps negative calendar reconciliation unresolved without retrying its generation", async () => {
    const { root, statePath, supervise } = executionFixture(), first = join(root, "first");
    const oldExit = process.exitCode; vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      vi.stubEnv("FORGE_TEST_DROP_RECEIPT", "true");
      await runForgeCalendarExecution({ write: true, scope: join(root, "scope.json"), out: first }, supervise);
      writeFileSync(statePath, JSON.stringify({ generated: [1], operations: {} }));
      vi.stubEnv("FORGE_TEST_DROP_RECEIPT", "false");
      const result = await runForgeCalendarExecution({ write: true, scope: join(root, "scope.json"), out: join(root, "resumed"), resume: first }, supervise);
      expect(result).toMatchObject({ executionComplete: false, eligibleCoverageComplete: false, progress: [{ gameId: 1, status: "unresolved" }] });
      expect(JSON.parse(readFileSync(statePath, "utf8")).generated).toEqual([1]);
      expect(result.budgets.grants.filter(entry => entry.grant.action === "generate")).toHaveLength(1);
    } finally { process.exitCode = oldExit; }
  }, 15000);
  it("rejects changed calendar news before generation and never certifies disabled public coverage", async () => {
    const { root, statePath, supervise } = executionFixture();
    const oldExit = process.exitCode; vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      vi.stubEnv("FORGE_TEST_CONTEXT_DRIFT", "true");
      const changed = await runForgeCalendarExecution({ write: true, scope: join(root, "scope.json"), out: join(root, "changed") }, supervise);
      expect(changed.executionComplete).toBe(false); expect(JSON.parse(readFileSync(statePath, "utf8")).generated).toEqual([]);
      vi.stubEnv("FORGE_TEST_CONTEXT_DRIFT", "false"); vi.stubEnv("FORGE_TEST_PUBLIC_DISABLED", "true");
      const disabled = await runForgeCalendarExecution({ write: true, scope: join(root, "scope.json"), out: join(root, "disabled") }, supervise);
      expect(disabled).toMatchObject({ executionComplete: true, eligibleCoverageComplete: false, recommendationReadiness: "not_evaluated" });
      expect(JSON.parse(readFileSync(statePath, "utf8")).generated).toEqual([1, 2]);
    } finally { process.exitCode = oldExit; }
  }, 15000);

  function calendarLedger() {
    const root = mkdtempSync(join(tmpdir(), "forge-ledger-")); directories.push(root); chmodSync(root, 0o700);
    const recipe: ForgeCalendarRecipe = { scopeChecksum: "a".repeat(64), origin: "https://db.example",
      artifactHash: "b".repeat(64), codeVersion: `local:${"c".repeat(64)}`, gameIds: [1, 2],
      deadlineAt: new Date(Date.now() + 30000).toISOString(), maxRequests: 12, maxWrites: 4, initialRequests: 2 };
    return { root, recipe, ledger: initializeForgeCalendarLedger(root, recipe) };
  }
  it.skipIf(process.platform === "win32").each([
    ["recipe", "ready"], ["recipe", "canonical"], ["grant", "before publication"], ["grant", "published"],
    ["process", "ready"], ["process", "canonical"], ["result", "ready"], ["result", "canonical"],
    ["reference", "before publication"], ["reference", "published"],
  ] as const)("retains ledger %s evidence after an actual crash at %s without renewing its budget", async (kind, phase) => {
    const root = mkdtempSync(join(tmpdir(), "forge-checkpoint-")); directories.push(root); chmodSync(root, 0o700);
    const recipe: ForgeCalendarRecipe = { scopeChecksum: "a".repeat(64), origin: "https://db.example", artifactHash: "b".repeat(64),
      codeVersion: `local:${"c".repeat(64)}`, gameIds: [1, 2], deadlineAt: new Date(Date.now() + 30000).toISOString(),
      maxRequests: 12, maxWrites: 4, initialRequests: 2 };
    const marker = join(root, "paused"), entry = join(root, "parent.ts"), child = join(root, "child.ts");
    writeFileSync(child, `require(${JSON.stringify(join(__dirname, "forge-calendar-ledger"))}).awaitForgeCalendarGrant()
      .then(() => require('node:fs').writeFileSync(${JSON.stringify(join(root, "io-started"))}, 'started'))
      .catch(() => { process.exitCode = 1; });`);
    const target = ({ recipe: "ledger.json", process: "process.json", result: "result.json" } as Record<string, string>)[kind];
    writeFileSync(entry, `const fs = require('node:fs'), path = require('node:path'), link = fs.linkSync, rename = fs.renameSync;
      const pause = () => { fs.writeFileSync(${JSON.stringify(marker)}, 'paused', {mode: 0o600});
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0); };
      fs.linkSync = (...args) => {
        const selected = path.basename(args[1]) === ${JSON.stringify(target ?? "not-selected")}
          && (${JSON.stringify(kind)} !== 'recipe' || path.dirname(args[1]) === fs.realpathSync(${JSON.stringify(root)}));
        if (selected && ${JSON.stringify(phase)} === 'ready') pause();
        const result = link(...args); if (selected && ${JSON.stringify(phase)} === 'canonical') pause(); return result; };
      fs.renameSync = (...args) => {
        const selected = ['grant', 'reference'].includes(${JSON.stringify(kind)}) && path.basename(args[1]) === '000001';
        if (selected && ${JSON.stringify(phase)} === 'before publication') pause();
        const result = rename(...args); if (selected && ${JSON.stringify(phase)} === 'published') pause(); return result; };
      (async () => {
        const { initializeForgeCalendarLedger } = require(${JSON.stringify(join(__dirname, "forge-calendar-ledger"))});
        const recipe = ${JSON.stringify(recipe)}, ledger = initializeForgeCalendarLedger(${JSON.stringify(root)}, recipe);
        if (${JSON.stringify(kind)} === 'recipe') return;
        if (${JSON.stringify(kind)} === 'reference') {
          const readRoot = ${JSON.stringify(join(root, "read-ledger"))}; fs.mkdirSync(readRoot, {mode: 0o700});
          const readRecipe = {...recipe, readOnly: true, maxRequests: 5, maxWrites: 0, initialRequests: 0,
            recoverySourceChecksum: require('node:crypto').createHash('sha256').update(JSON.stringify(recipe)).digest('hex')};
          initializeForgeCalendarLedger(readRoot, readRecipe);
          ledger.grant({action: 'recovery', maxRequests: 0, maxWrites: 0, recovery: {root: fs.realpathSync(readRoot), recipe: readRecipe}}); return;
        }
        const grant = ledger.grant({action: ${JSON.stringify(kind === "grant" ? "generate" : "inspect")},
          ${kind === "grant" ? "gameId: 1," : ""} maxRequests: 5, maxWrites: ${kind === "grant" ? 2 : 0}});
        if (${JSON.stringify(kind)} === 'grant') return;
        const { superviseForgeProcess } = require(${JSON.stringify(join(__dirname, "run-forge-calendar-local"))});
        const result = await superviseForgeProcess({argv: ['-r', 'ts-node/register/transpile-only', ${JSON.stringify(child)}],
          cwd: ${JSON.stringify(join(__dirname, ".."))}, out: grant.directory, deadlineMs: Date.parse(recipe.deadlineAt),
          beforeStart: (pid, guardian) => { fs.writeFileSync(${JSON.stringify(join(root, "child-pid"))}, String(pid));
            fs.writeFileSync(${JSON.stringify(join(root, "guardian-pid"))}, String(guardian.pid)); ledger.started(1, pid, guardian); }});
        if (result.outcome !== 'succeeded') throw Error('Fixture child did not complete');
        ledger.finish(1, 'inspected', {reads: 1, writes: 0}, 'd'.repeat(64));
      })().catch(error => { console.error(error.message); process.exitCode = 1; });`);
    const parent = spawn(process.execPath, ["-r", "ts-node/register/transpile-only", entry], { cwd: join(__dirname, ".."),
      env: { ...process.env, NODE_PATH: ".", TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' } });
    let output = ""; parent.stderr.on("data", data => { output += data.toString(); }); parent.stdout.on("data", data => { output += data.toString(); });
    const closed = new Promise(resolveClose => parent.once("close", (code, signal) => resolveClose({ code, signal })));
    let childPid: number | null = null, guardianPid: number | null = null;
    try {
      await vi.waitFor(() => {
        if (parent.exitCode !== null || parent.signalCode !== null) throw new Error(output);
        expect(existsSync(marker)).toBe(true);
      }, { timeout: 5000 });
      if (existsSync(join(root, "child-pid"))) childPid = Number(readFileSync(join(root, "child-pid"), "utf8"));
      if (existsSync(join(root, "guardian-pid"))) guardianPid = Number(readFileSync(join(root, "guardian-pid"), "utf8"));
      if (phase === "ready") expect(() => openForgeCalendarLedger(root, recipe).state()).toThrow("checkpoint writer");
      if (kind === "process") expect(existsSync(join(root, "io-started"))).toBe(false);
      parent.kill("SIGKILL"); await expect(closed).resolves.toEqual({ code: null, signal: "SIGKILL" });
      if (childPid) await vi.waitFor(() => expect(() => process.kill(childPid!, 0)).toThrow(), { timeout: 5000 });
      if (guardianPid) await vi.waitFor(() => expect(() => process.kill(guardianPid!, 0)).toThrow(), { timeout: 5000 });
      const ledger = openForgeCalendarLedger(root, recipe), state = ledger.state();
      expect(state.deadlineAt).toBe(recipe.deadlineAt);
      if (kind === "recipe" || ["grant", "reference"].includes(kind) && phase === "before publication") {
        expect(state).toMatchObject({ requests: 2, writes: 0, grants: [] });
      } else if (kind === "grant") {
        expect(state).toMatchObject({ requests: 7, writes: 2, grants: [{ grant: { index: 1, maxRequests: 5, maxWrites: 2 }, result: null }] });
        expect(() => ledger.started(1, process.pid)).toThrow("cannot start");
      } else if (kind === "process") {
        expect(state).toMatchObject({ requests: 7, writes: 0, grants: [{ process: { pid: childPid }, result: null }] });
        expect(() => ledger.started(1, process.pid)).toThrow("cannot start");
        expect(existsSync(join(root, "io-started"))).toBe(false);
      } else if (kind === "result") {
        expect(state).toMatchObject({ requests: 3, writes: 0, grants: [{ result: { outcome: "inspected", requests: { reads: 1, writes: 0 } } }] });
        expect(() => ledger.finish(1, "inspected", { reads: 1, writes: 0 }, null)).toThrow();
        expect(existsSync(join(root, "io-started"))).toBe(true);
      } else {
        expect(state).toMatchObject({ requests: 2, writes: 0, grants: [{ grant: { action: "recovery" }, investigation: { requests: 0, writes: 0 } }] });
      }
      if (kind === "recipe" && phase === "ready") {
        const ready = readdirSync(root).find(name => name.startsWith(".ready-ledger.json-"))!, path = join(root, ready);
        const original = readFileSync(path, "utf8");
        chmodSync(path, 0o644); expect(() => openForgeCalendarLedger(root, recipe)).toThrow("private regular file"); chmodSync(path, 0o600);
        const foreign = join(root, ready.replace(/^\.ready-ledger\.json-[a-f0-9]{64}-/, `.ready-ledger.json-${"f".repeat(64)}-`));
        writeFileSync(foreign, original, { mode: 0o600 });
        expect(() => openForgeCalendarLedger(root, recipe)).toThrow("ambiguous"); rmSync(foreign);
        renameSync(path, foreign); expect(() => openForgeCalendarLedger(root, recipe)).toThrow("foreign"); renameSync(foreign, path);
        const active = join(root, ready.replace(/-\d+-([a-f0-9-]{36}\.json)$/, `-${process.pid}-$1`));
        renameSync(path, active); expect(() => openForgeCalendarLedger(root, recipe)).toThrow("active"); renameSync(active, path);
        writeFileSync(path, original.slice(0, 15)); expect(() => openForgeCalendarLedger(root, recipe)).toThrow();
        expect(readFileSync(path, "utf8")).toBe(original.slice(0, 15)); writeFileSync(path, original);
        const changed = JSON.parse(original); changed.recipe.maxRequests++; changed.checksum = createHash("sha256").update(JSON.stringify(changed.recipe)).digest("hex");
        writeFileSync(path, JSON.stringify(changed)); expect(() => openForgeCalendarLedger(root, recipe)).toThrow("mismatches"); writeFileSync(path, original);
      }
      const before = state.requests;
      ledger.grant({ action: "inspect", maxRequests: 1, maxWrites: 0 });
      expect(ledger.state()).toMatchObject({ requests: before + 1, writes: state.writes, deadlineAt: recipe.deadlineAt });
    } finally {
      if (parent.exitCode === null && parent.signalCode === null) parent.kill("SIGKILL"); await closed;
      if (guardianPid) try { process.kill(-guardianPid, "SIGKILL"); } catch { /* Owned fixture is terminal. */ }
    }
  }, 15000);
  it("leaves malformed legacy checkpoint files and empty grant slots unresolved", () => {
    const { root, recipe, ledger } = calendarLedger();
    mkdirSync(join(root, "grants/000001"), { mode: 0o700 });
    expect(() => ledger.state()).toThrow("checkpoint is missing");
    writeFileSync(join(root, "grants/000001/grant.json"), '{"version":', { mode: 0o600 });
    expect(() => ledger.state()).toThrow();
    expect(readFileSync(join(root, "grants/000001/grant.json"), "utf8")).toBe('{"version":');
    expect(openForgeCalendarLedger(root, recipe).recipe).toEqual(recipe);
  });
  it("allows only linked zero-allocation recovery claims after expiry and never grants writes to an investigation", () => {
    const { root, recipe, ledger } = calendarLedger(), readRoot = join(root, "read-only"); mkdirSync(readRoot, { mode: 0o700 });
    const recoveryRecipe: ForgeCalendarRecipe = { ...recipe, readOnly: true, maxRequests: 5, maxWrites: 0, initialRequests: 0,
      deadlineAt: new Date(Date.parse(recipe.deadlineAt) + 30000).toISOString(),
      recoverySourceChecksum: createHash("sha256").update(JSON.stringify(recipe)).digest("hex") };
    const investigation = initializeForgeCalendarLedger(readRoot, recoveryRecipe);
    vi.useFakeTimers(); vi.setSystemTime(Date.parse(recipe.deadlineAt) + 1);
    expect(() => ledger.grant({ action: "recovery", maxRequests: 0, maxWrites: 0 })).toThrow("does not match");
    const claim = ledger.grant({ action: "recovery", maxRequests: 0, maxWrites: 0, recovery: { root: readRoot, recipe: recoveryRecipe } });
    expect(ledger.state()).toMatchObject({ requests: 2, writes: 0, expired: true });
    expect(() => ledger.grant({ action: "inspect", maxRequests: 1, maxWrites: 0 })).toThrow("no overlapping grant");
    for (const action of ["generate", "inspect", "recovery"] as const) {
      expect(() => investigation.grant({ action, gameId: 1, maxRequests: 1, maxWrites: 0 })).toThrow();
    }
    expect(() => investigation.grant({ action: "reconcile", gameId: 1, maxRequests: 1, maxWrites: 1 })).toThrow();
    investigation.grant({ action: "reconcile", gameId: 1, maxRequests: 5, maxWrites: 0 });
    investigation.finish(1, "unknown", null, null); ledger.finish(claim.grant.index, "incomplete", null, null);
    expect(ledger.state()).toMatchObject({ requests: 2, writes: 0 });
    expect(investigation.state()).toMatchObject({ requests: 5, writes: 0, remainingRequests: 0 });
    expect(() => ledger.grant({ action: "generate", gameId: 1, maxRequests: 1, maxWrites: 1 })).toThrow("budget exhausted");
  });
  it("reserves durable calendar grants and never resets unknown request/write costs on reopen", () => {
    const { root, recipe, ledger } = calendarLedger();
    const reserved = ledger.grant({ action: "generate", gameId: 1, maxRequests: 6, maxWrites: 3 });
    expect(statSync(join(reserved.directory, "grant.json")).mode & 0o777).toBe(0o600);
    expect(openForgeCalendarLedger(root, recipe).state()).toMatchObject({ requests: 8, writes: 3, remainingRequests: 4, remainingWrites: 1 });
    expect(() => ledger.grant({ action: "generate", gameId: 2, maxRequests: 1, maxWrites: 1 })).toThrow("active or unresolved");
    expect(() => ledger.finish(1, "issued", { reads: 1, writes: 1 }, null)).toThrow("reserved budget");
    ledger.finish(1, "unknown", null, null);
    expect(openForgeCalendarLedger(root, recipe).state()).toMatchObject({ requests: 8, writes: 3 });
    expect(() => ledger.grant({ action: "generate", gameId: 2, maxRequests: 5, maxWrites: 1 })).toThrow("budget exhausted");
    expect(() => ledger.grant({ action: "generate", gameId: 2, maxRequests: 4, maxWrites: 2 })).toThrow("budget exhausted");
  });
  it("binds every resumed calendar recipe and validates grants even if checksums are recomputed", () => {
    const { root, recipe, ledger } = calendarLedger();
    for (const changed of [{ maxRequests: 13 }, { maxWrites: 5 }, { deadlineAt: new Date(Date.now() + 60000).toISOString() },
      { gameIds: [1] }, { artifactHash: "d".repeat(64) }, { scopeChecksum: "d".repeat(64) }]) {
      expect(() => openForgeCalendarLedger(root, { ...recipe, ...changed })).toThrow("recipe changed");
    }
    const grant = ledger.grant({ action: "generate", gameId: 1, maxRequests: 2, maxWrites: 1 });
    const { checksum: _old, ...unsigned } = grant.grant;
    const invalid = { ...unsigned, expectedRevisionId: "not-a-uuid" };
    writeFileSync(join(grant.directory, "grant.json"), JSON.stringify({ ...invalid,
      checksum: createHash("sha256").update(JSON.stringify(invalid)).digest("hex") }));
    expect(() => openForgeCalendarLedger(root, recipe).state()).toThrow("grant is invalid");
  });
  it("rejects expired ledger allocation and invalid operation identities before creating a grant", () => {
    const { root, recipe, ledger } = calendarLedger();
    for (const input of [{ operationId: "bad" }, { expectedRevisionId: "bad" }, { gameId: 3 }]) {
      expect(() => ledger.grant({ action: "generate", gameId: 1, maxRequests: 2, maxWrites: 1, ...input })).toThrow();
    }
    vi.useFakeTimers(); vi.setSystemTime(Date.parse(recipe.deadlineAt));
    expect(() => openForgeCalendarLedger(root, recipe).grant({ action: "inspect", maxRequests: 1, maxWrites: 0 })).toThrow("budget exhausted");
    expect(ledger.state().grants).toHaveLength(0);
  });
  it("blocks a second actual coordinator while the first owns a ledger grant", async () => {
    const { root, recipe, ledger } = calendarLedger();
    ledger.grant({ action: "generate", gameId: 1, maxRequests: 2, maxWrites: 1 });
    const child = join(root, "competing.ts");
    writeFileSync(child, `const { openForgeCalendarLedger } = require(${JSON.stringify(join(__dirname, "forge-calendar-ledger"))});
      openForgeCalendarLedger(${JSON.stringify(root)}, ${JSON.stringify(recipe)}).grant({action: 'generate', gameId: 2, maxRequests: 2, maxWrites: 1});`);
    await expect(promisify(execFile)(process.execPath, ["-r", "ts-node/register/transpile-only", child], { cwd: join(__dirname, ".."),
      env: { ...process.env, TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' } }))
      .rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("no overlapping grant") });
    expect(ledger.state().grants).toHaveLength(1);
  });
  it("grants actual child I/O only after its durable allocation and PID, and refunds only terminal measured work", async () => {
    const { root, recipe, ledger } = calendarLedger();
    const grant = ledger.grant({ action: "inspect", maxRequests: 6, maxWrites: 0 });
    const child = join(root, "granted-child.ts");
    writeFileSync(child, `const { awaitForgeCalendarGrant } = require(${JSON.stringify(join(__dirname, "forge-calendar-ledger"))});
      const fs = require('node:fs');
      awaitForgeCalendarGrant().then(() => { if (!fs.existsSync(${JSON.stringify(join(grant.directory, "process.json"))})) throw Error('PID not flushed');
        fs.writeFileSync(${JSON.stringify(join(root, "io-started"))}, 'started'); });`);
    const result = await superviseForgeProcess({ argv: ["-r", "ts-node/register/transpile-only", child],
      cwd: join(__dirname, ".."), out: grant.directory, deadlineMs: Date.parse(recipe.deadlineAt),
      environment: { ...process.env, TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' },
      beforeStart: (pid, guardian) => { expect(existsSync(join(root, "io-started"))).toBe(false); ledger.started(1, pid, guardian);
        expect(() => ledger.finish(1, "issued", { reads: 1, writes: 0 }, "d".repeat(64))).toThrow(); } });
    expect(result.outcome).toBe("succeeded"); expect(existsSync(join(root, "io-started"))).toBe(true);
    expect(ledger.state().grants[0].process?.guardian).toEqual(result.guardian);
    expect(() => process.kill(result.guardian!.pid, 0)).toThrow();
    ledger.finish(1, "inspected", { reads: 1, writes: 0 }, "d".repeat(64));
    expect(openForgeCalendarLedger(root, recipe).state()).toMatchObject({ requests: 3, writes: 0, remainingRequests: 9 });
    expect(() => ledger.finish(1, "inspected", { reads: 1, writes: 0 }, null)).toThrow();
  }, 15000);
  it("withholds actual child I/O when durable activation fails", async () => {
    const root = mkdtempSync(join(tmpdir(), "forge-activation-failed-")); directories.push(root);
    const marker = join(root, "io-started"), child = join(root, "blocked-child.ts");
    writeFileSync(child, `const { awaitForgeCalendarGrant } = require(${JSON.stringify(join(__dirname, "forge-calendar-ledger"))});
      awaitForgeCalendarGrant().then(() => require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'started'));`);
    const result = await superviseForgeProcess({ argv: ["-r", "ts-node/register/transpile-only", child], cwd: join(__dirname, ".."),
      out: root, deadlineMs: Date.now() + 5000,
      environment: { ...process.env, TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' },
      beforeStart: () => { throw new Error("flush failed"); } });
    expect(result.outcome).toBe("log_failure"); expect(existsSync(marker)).toBe(false);
  }, 10000);

  it("requires an explicit bounded read-only calendar scope and reviewed artifact", () => {
    const args = ["--game-ids", "2,1", "--skater-targets", "GOALS,HITS", "--artifact", "/tmp/reviewed-code.json", "--out", "/tmp/calendar"];
    expect(parseForgeCalendarArgs(args)).toMatchObject({ gameIds: [1, 2], days: 14, inspect: false,
      profile: { skaterTargets: ["GOALS", "HITS"], goalieTargets: [] }, limits: { concurrency: 1, maxGames: 16 } });
    for (const extra of [["--write"], ["--resume", "/tmp/old"], ["--days", "22"], ["--max-games", "1"],
      ["--max-requests", "0"], ["--max-requests", "10001"], ["--runtime-ms", "3600001"]]) {
      expect(() => parseForgeCalendarArgs([...args, ...extra])).toThrow();
    }
    expect(() => parseForgeCalendarArgs(args.map(value => value === "2,1" ? "1,1" : value))).toThrow();
    expect(() => parseForgeCalendarArgs(args.map(value => value === "GOALS,HITS" ? "SAVES_GOALIE" : value))).toThrow();
  });

  it("shares the request budget across reads and writes before transport", async () => {
    const requests: RequestCounts = { reads: 2, writes: 1, readMs: 0, writeMs: 0,
      acknowledgedWrites: 1, rejectedWrites: 0, unknownWrites: 0 };
    const transport = vi.fn();
    for (const method of ["GET", "POST"]) {
      await expect(guardedForgeFetch("https://db.example/rest/v1/games", { method }, "https://db.example", true,
        transport, requests, { deadlineMs: Date.now() + 1000, requestTimeoutMs: 1000, maxWrites: 5, maxRequests: 3 }))
        .rejects.toThrow("budget exhausted");
    }
    expect(transport).not.toHaveBeenCalled();
    expect(requests).toMatchObject({ reads: 2, writes: 1 });
  });

  it("supervises synchronous child work and kills a SIGTERM-resistant process at the shared deadline", async () => {
    const parent = mkdtempSync(join(tmpdir(), "forge-supervision-")); directories.push(parent);
    const result = await superviseForgeProcess({ argv: ["-e", 'process.on("SIGTERM", () => {}); console.log("started"); while (true) {}'],
      cwd: parent, out: parent, deadlineMs: Date.now() + 700 });
    expect(result).toMatchObject({ outcome: "deadline", signal: "SIGKILL" });
    expect(result.durationMs).toBeLessThan(2500);
    expect(readFileSync(join(parent, "process.log"), "utf8")).toContain("started");
    expect(statSync(join(parent, "process.log")).mode & 0o777).toBe(0o600);
    expect(() => process.kill(result.pid!, 0)).toThrow();
  }, 5000);

  it.skipIf(process.platform === "win32")("stops an activated resistant worker and its descendant after coordinator death, retaining unknown allocations", async () => {
    const { root, recipe } = calendarLedger(), entry = join(root, "orphan-parent.ts"), worker = join(root, "resistant-worker.ts");
    const unrelated = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
    const unrelatedClosed = new Promise(resolveClose => unrelated.once("close", resolveClose));
    writeFileSync(worker, `const fs = require('node:fs');
      require(${JSON.stringify(join(__dirname, "forge-calendar-ledger"))}).awaitForgeCalendarGrant().then(() => {
        process.on('SIGTERM', () => {});
        const descendant = require('node:child_process').spawn(process.execPath, ['-e',
          ${JSON.stringify(`process.on('SIGTERM', () => {}); require('node:fs').writeFileSync(${JSON.stringify(join(root, "descendant-ready"))}, String(process.pid)); setInterval(() => {}, 1000);`)}], {stdio: 'ignore'});
        fs.writeFileSync(${JSON.stringify(join(root, "activated"))}, String(descendant.pid));
        while (true) {}
      });`);
    writeFileSync(entry, `const {openForgeCalendarLedger} = require(${JSON.stringify(join(__dirname, "forge-calendar-ledger"))});
      const ledger = openForgeCalendarLedger(${JSON.stringify(root)}, ${JSON.stringify(recipe)});
      const grant = ledger.grant({action: 'generate', gameId: 1, maxRequests: 6, maxWrites: 3});
      require(${JSON.stringify(join(__dirname, "run-forge-calendar-local"))}).superviseForgeProcess({
        argv: ['-r', 'ts-node/register/transpile-only', ${JSON.stringify(worker)}], cwd: ${JSON.stringify(join(__dirname, ".."))},
        out: grant.directory, deadlineMs: Date.parse(${JSON.stringify(recipe.deadlineAt)}),
        beforeStart: (pid, guardian) => ledger.started(1, pid, guardian)
      });`);
    const parent = spawn(process.execPath, ["-r", "ts-node/register/transpile-only", entry], { cwd: join(__dirname, ".."),
      env: { ...process.env, NODE_PATH: ".", TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' }, stdio: "ignore" });
    const closed = new Promise(resolveClose => parent.once("close", (code, signal) => resolveClose({ code, signal })));
    let guardian: ForgeProcessGuardianIdentity | undefined;
    try {
      await vi.waitFor(() => expect(existsSync(join(root, "descendant-ready"))).toBe(true), { timeout: 8000 });
      const ledger = openForgeCalendarLedger(root, recipe), before = ledger.state(), child = before.grants[0].process!;
      guardian = child.guardian; expect(guardian).toMatchObject({ hostname: hostname(), protocol: FORGE_PROCESS_GUARDIAN_PROTOCOL });
      const descendant = Number(readFileSync(join(root, "descendant-ready"), "utf8"));
      expect(() => ledger.finish(1, "unknown", null, null)).toThrow("reserved budget");
      parent.kill("SIGKILL"); expect(await closed).toMatchObject({ signal: "SIGKILL" });
      await vi.waitFor(() => {
        for (const pid of [child.pid, descendant, guardian!.pid]) expect(() => process.kill(pid, 0)).toThrow();
      }, { timeout: 5000 });
      expect(() => process.kill(unrelated.pid!, 0)).not.toThrow();
      expect(ledger.state()).toMatchObject({ requests: 8, writes: 3, deadlineAt: recipe.deadlineAt,
        grants: [{ grant: { operationId: before.grants[0].grant.operationId }, process: child, result: null }] });
      ledger.finish(1, "unknown", null, null);
      expect(openForgeCalendarLedger(root, recipe).state()).toMatchObject({ requests: 8, writes: 3, remainingRequests: 4, remainingWrites: 1 });
    } finally {
      if (parent.exitCode === null && parent.signalCode === null) parent.kill("SIGKILL"); await closed;
      if (guardian) try { process.kill(-guardian.pid, "SIGKILL"); } catch { /* Owned fixture already stopped. */ }
      unrelated.kill("SIGKILL"); await unrelatedClosed;
    }
  }, 15000);

  it.skipIf(process.platform === "win32")("rejects foreign guardian identity and ignores mismatched start messages without signalling an unrelated process", async () => {
    const root = mkdtempSync(join(tmpdir(), "forge-guardian-protocol-")); directories.push(root);
    const unrelated = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
    const unrelatedClosed = new Promise(resolveClose => unrelated.once("close", resolveClose));
    const protocol = FORGE_PROCESS_GUARDIAN_PROTOCOL, token = randomUUID(), marker = join(root, "io-started");
    const startGuardian = () => spawn(process.execPath, ["-e", `(${runForgeProcessGuardian.toString()})(${JSON.stringify(protocol)})`],
      { cwd: root, detached: true, env: { ...process.env, FORGE_PROCESS_GUARDIAN_TOKEN: token }, stdio: ["ignore", "ignore", "ignore", "ipc"] });
    const foreign = startGuardian(), foreignClosed = new Promise(resolveClose => foreign.once("close", resolveClose));
    const own = startGuardian(), ownClosed = new Promise(resolveClose => own.once("close", resolveClose));
    const messages: any[] = []; own.on("message", message => messages.push(message));
    const init = { type: "forge-guardian-init", token, protocol, parentPid: process.pid, cwd: root, deadlineMs: Date.now() + 5000,
      maxLogBytes: 1024, requireStart: true, argv: ["-e", `const token = process.env.FORGE_CALENDAR_START_TOKEN;
        process.send({type: 'forge-calendar-ready', token, protocol: ${JSON.stringify(protocol)}, pid: ${unrelated.pid}});
        process.on('message', value => { if (value.type === 'forge-calendar-start') require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'started'); });`] };
    try {
      foreign.send({ ...init, guardianPid: unrelated.pid });
      await foreignClosed; expect(existsSync(marker)).toBe(false);
      own.send({ ...init, guardianPid: own.pid });
      await vi.waitFor(() => expect(messages.some(message => message.type === "forge-guardian-ready")).toBe(true), { timeout: 2000 });
      const workerPid = messages.find(message => message.type === "forge-guardian-spawned").pid;
      expect(messages.find(message => message.type === "forge-guardian-ready").pid).toBe(workerPid);
      expect(workerPid).not.toBe(unrelated.pid);
      own.send({ type: "forge-guardian-start", token: randomUUID(), protocol });
      own.send({ type: "forge-guardian-start", token, protocol: "foreign-protocol" });
      // A subsequent matching stop must be processed without either invalid start having accessed the marker.
      own.send({ type: "forge-guardian-stop", token, protocol, reason: "cancelled" });
      await ownClosed;
      expect(existsSync(marker)).toBe(false); expect(() => process.kill(workerPid, 0)).toThrow();
      expect(() => process.kill(unrelated.pid!, 0)).not.toThrow();
    } finally {
      for (const child of [foreign, own]) if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
      await Promise.all([foreignClosed, ownClosed]); unrelated.kill("SIGKILL"); await unrelatedClosed;
    }
  }, 10000);

  it("keeps foreign or reused live guardian identities unresolved without signalling them", () => {
    const { ledger, root } = calendarLedger(), grant = ledger.grant({ action: "inspect", maxRequests: 6, maxWrites: 0 });
    const workerPid = 99999999;
    const guardian: ForgeProcessGuardianIdentity = { pid: process.pid, hostname: hostname(), protocol: FORGE_PROCESS_GUARDIAN_PROTOCOL, nonceHash: "a".repeat(64) };
    let groupOnly = false;
    const kill = vi.spyOn(process, "kill").mockImplementation((pid, signal) => {
      if (signal !== 0) throw new Error("Ledger must never terminate a recorded PID.");
      if (pid === workerPid || groupOnly && pid === guardian.pid) throw Object.assign(new Error("terminal"), { code: "ESRCH" });
      return true;
    });
    ledger.started(1, workerPid, guardian);
    for (const [hostnameValue, remainingGroup] of [[hostname(), false], [hostname(), true], ["foreign-host", false]] as const) {
      groupOnly = remainingGroup;
      const path = join(grant.directory, "process.json"), receipt = JSON.parse(readFileSync(path, "utf8"));
      receipt.guardian.hostname = hostnameValue; writeFileSync(path, JSON.stringify(receipt));
      expect(() => ledger.finish(1, "inspected", { reads: 1, writes: 0 }, null)).toThrow("reserved budget");
      expect(() => ledger.grant({ action: "inspect", maxRequests: 1, maxWrites: 0 })).toThrow("active or unresolved");
      expect(ledger.state()).toMatchObject({ requests: 8, grants: [{ result: null }] });
    }
    expect(kill.mock.calls.every(([, signal]) => signal === 0)).toBe(true);
    expect(kill.mock.calls.some(([pid]) => pid === -guardian.pid)).toBe(true);
    expect(readdirSync(join(root, "grants"))).toEqual(["000001"]);
  });

  it.skipIf(process.platform === "win32")("fails closed after guardian loss while an owned descendant survives a terminal worker", async () => {
    const { root, recipe, ledger } = calendarLedger(), grant = ledger.grant({ action: "generate", gameId: 1, maxRequests: 6, maxWrites: 3 });
    const worker = join(root, "guardian-loss-worker.ts"), descendant = join(root, "descendant.ts");
    writeFileSync(descendant, `const fs = require('node:fs');
      fs.writeFileSync(${JSON.stringify(join(root, "descendant-ready"))}, String(process.pid));
      setInterval(() => { if (fs.existsSync(${JSON.stringify(join(root, "release-descendant"))})) process.exit(0); }, 10);`);
    writeFileSync(worker, `const fs = require('node:fs');
      require(${JSON.stringify(join(__dirname, "forge-calendar-ledger"))}).awaitForgeCalendarGrant().then(() => {
        require('node:child_process').spawn(process.execPath, [${JSON.stringify(descendant)}], {stdio: 'ignore'});
        setInterval(() => { if (fs.existsSync(${JSON.stringify(join(root, "release-worker"))})) process.exit(0); }, 10);
      });`);
    let guardian: ForgeProcessGuardianIdentity | undefined, workerPid: number | undefined;
    const run = superviseForgeProcess({ argv: ["-r", "ts-node/register/transpile-only", worker], cwd: join(__dirname, ".."),
      out: grant.directory, deadlineMs: Date.parse(recipe.deadlineAt),
      environment: { ...process.env, TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' },
      beforeStart: (pid, identity) => { workerPid = pid; guardian = identity; ledger.started(1, pid, identity); } });
    try {
      await vi.waitFor(() => expect(existsSync(join(root, "descendant-ready"))).toBe(true), { timeout: 5000 });
      const descendantPid = Number(readFileSync(join(root, "descendant-ready"), "utf8"));
      process.kill(guardian!.pid, "SIGKILL");
      expect(await run).toMatchObject({ outcome: "failed", pid: workerPid, code: null, guardian });
      expect(() => ledger.finish(1, "issued", { reads: 1, writes: 1 }, null)).toThrow("reserved budget");
      writeFileSync(join(root, "release-worker"), "release");
      await vi.waitFor(() => expect(() => process.kill(workerPid!, 0)).toThrow(), { timeout: 5000 });
      expect(() => process.kill(descendantPid, 0)).not.toThrow();
      expect(() => process.kill(guardian!.pid, 0)).toThrow();
      expect(() => ledger.finish(1, "unknown", null, null)).toThrow("reserved budget");
      expect(() => ledger.grant({ action: "inspect", maxRequests: 1, maxWrites: 0 })).toThrow("active or unresolved");
      expect(ledger.state()).toMatchObject({ requests: 8, writes: 3, grants: [{ result: null }] });
      writeFileSync(join(root, "release-descendant"), "release");
      await vi.waitFor(() => expect(() => process.kill(-guardian!.pid, 0)).toThrow(), { timeout: 5000 });
      ledger.finish(1, "unknown", null, null);
      expect(ledger.state()).toMatchObject({ requests: 8, writes: 3, deadlineAt: recipe.deadlineAt });
    } finally {
      writeFileSync(join(root, "release-worker"), "release"); writeFileSync(join(root, "release-descendant"), "release");
      await run;
    }
  }, 15000);

  it("cancels child work and retains a bounded private log without restarting it", async () => {
    const parent = mkdtempSync(join(tmpdir(), "forge-supervision-cancel-")); directories.push(parent);
    const controller = new AbortController();
    const run = superviseForgeProcess({ argv: ["-e", "setInterval(() => {}, 1000)"], cwd: parent, out: parent,
      deadlineMs: Date.now() + 5000, signal: controller.signal });
    controller.abort();
    const result = await run;
    expect(result.outcome).toBe("cancelled");
    expect(() => process.kill(result.pid!, 0)).toThrow();
    const noisy = join(parent, "noisy"); mkdirSync(noisy);
    const overflow = await superviseForgeProcess({ argv: ["-e", 'process.stdout.write("x".repeat(65536)); setInterval(() => {}, 1000)'],
      cwd: parent, out: noisy, deadlineMs: Date.now() + 5000, maxLogBytes: 128 });
    expect(overflow).toMatchObject({ outcome: "output_limit", logBytes: 128 });
    expect(statSync(join(noisy, "process.log")).size).toBe(128);
    expect(() => process.kill(overflow.pid!, 0)).toThrow();
  }, 8000);

  it("rejects expired or cancelled supervision before spawning any work", async () => {
    const parent = mkdtempSync(join(tmpdir(), "forge-supervision-rejected-")); directories.push(parent);
    const controller = new AbortController(); controller.abort();
    for (const options of [{ deadlineMs: Date.now() - 1 }, { deadlineMs: Date.now() + 1000, signal: controller.signal }]) {
      await expect(superviseForgeProcess({ argv: ["-e", "process.exit(0)"], cwd: parent, out: parent, ...options })).rejects.toThrow("before spawn");
    }
    expect(existsSync(join(parent, "process.log"))).toBe(false);
  });

  it("runs the actual calendar inspection CLI through reads and blocks attempted queue writes", async () => {
    const parent = mkdtempSync(join(tmpdir(), "forge-calendar-cli-")); directories.push(parent);
    const fixtureModule = join(parent, "scope-fixture.js");
    writeFileSync(fixtureModule, `
      const root = process.cwd();
      const replace = (path, exports) => {
        const id = require.resolve(root + path);
        require.cache[id] = { id, filename: id, loaded: true, exports };
      };
      const policy = { version: "forecast-calendar-v1", calendarDays: 14, overlapDays: 7, timeZone: "UTC" };
      const start = new Date(Date.now() + 86400000).toISOString();
      const scopes = [1, 2].map(teamId => ({ scopeKey: "game:30:team:" + teamId, gameId: 30, teamId,
        opponentTeamId: teamId === 1 ? 2 : 1, teamGameHorizon: 1, calendarLeadDay: 1,
        scheduledStartAt: start, gameDate: start.slice(0, 10), seasonId: 20262027, homeTeamId: 1, awayTeamId: 2,
        queueCompatible: true, teamAbbreviation: teamId === 1 ? "MIN" : "TOR", scheduleRevision: "schedule-" + teamId }));
      replace("/lib/player-forecasts/orchestration.ts", { planPlayerForecastCalendarWork: async ({ supabase }) => {
        if (process.env.CALENDAR_FIXTURE_MUTATION === "true") {
          const result = await supabase.from("forge_game_update_queue").insert({ game_id: 30 });
          if (result.error) throw new Error("Fixture forbidden mutation rejected");
        }
        return { calendarDays: 14, calendarPolicy: policy, scopes, workload: [], queueCompatibleScopes: 2,
          queueIncompatibleScopes: 0, dryRun: true,
          scheduleCoverage: { readStatus: "complete", discoveredGames: 1, eligibleGames: 1,
            excludedGames: [], staleGameIds: [], sourceWatermark: "source" } };
      } });
      replace("/lib/rosterScheduleData/planning.ts", { loadPlanningData: async (_db, _query, { now }) => ({
        players: [1, 2].map(id => ({ id: String(id), nhlId: id + 70, nhlTeamId: id, rosterRevision: "roster-" + id,
          name: "Fixture", teamAbbreviation: id === 1 ? "MIN" : "TOR", eligiblePositions: ["LW"],
          playerClass: "skater", availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] })),
        games: scopes.map(side => ({ id: "30", startsAt: start, date: start.slice(0, 10), teamAbbreviation: side.teamAbbreviation,
          opponent: side.teamId === 1 ? "TOR" : "MIN", home: side.teamId === 1, status: "scheduled", scheduleRevision: side.scheduleRevision })),
        forecasts: [], evidence: { schedule: { completeness: "complete" }, identities: { completeness: "complete" } },
        forecastManifest: { version: "planning-forecasts-v1", id: "fixture", seasonId: 20262027, asOf: now.toISOString(),
          calendarPolicy: policy, scheduleRevision: "schedule", rosterRevision: "roster", issuedRevisionIds: [],
          baselineChecksum: null, exclusionCounts: { serving_disabled: 1 }, exclusions: [{ gameId: "30", reasons: ["serving_disabled"] }] }
      }) });
    `);
    const artifact = { version: "forge-local-artifact-v1", files: [] };
    const pin = join(parent, "code.json");
    writeFileSync(pin, JSON.stringify({ ...artifact,
      codeVersion: `local:${createHash("sha256").update(JSON.stringify(artifact)).digest("hex")}` }));
    const methods: string[] = [];
    const server = createServer((request, response) => {
      methods.push(request.method!);
      if (request.method !== "GET" || !request.url?.startsWith("/rest/v1/forge_game_revisions?")) {
        response.statusCode = 500; response.end("{}"); return;
      }
      response.setHeader("content-type", "application/json"); response.setHeader("content-range", "0-0/1");
      response.end(JSON.stringify([{ id: "historical-only", game_id: 30, published_at: "2026-09-28T12:00:00Z" }]));
    });
    await new Promise<void>(resolve => server.listen(0, resolve));
    try {
      const address = server.address(); if (!address || typeof address === "string") throw new Error("Expected local port");
      for (const mutation of [false, true]) {
        const out = join(parent, mutation ? "rejected" : "preview");
        const entry = mutation ? ["-r", "ts-node/register/transpile-only", "-r", fixtureModule]
          : ["-r", fixtureModule, join(require.resolve("ts-node/package.json"), "..", "dist", "bin.js"),
            "--transpile-only", "--compiler-options", '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}'];
        const run = exec(process.execPath, [...entry, "scripts/run-forge-calendar-local.ts",
          "--game-ids", "30", "--skater-targets", "GOALS", "--artifact", pin, "--out", out], {
          cwd: join(__dirname, ".."), env: { ...process.env, NODE_PATH: ".",
            TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}',
            NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${address.port}`, SUPABASE_SERVICE_ROLE_KEY: "local-test-only",
            CALENDAR_FIXTURE_MUTATION: String(mutation) },
        });
        if (mutation) await expect(run).rejects.toThrow(); else await run;
        const receipt = JSON.parse(readFileSync(join(out, "receipt.json"), "utf8"));
        const inspection = JSON.parse(readFileSync(join(out, "inspection.json"), "utf8"));
        expect(receipt).toMatchObject({ mode: "read_only", outcome: mutation ? "failed" : "succeeded",
          writesEnabled: false, automaticRetryAllowed: false });
        expect(inspection.requests).toMatchObject({ reads: mutation ? 0 : 1, writes: 0 });
        expect(statSync(out).mode & 0o777).toBe(0o700);
        if (mutation) expect(existsSync(join(out, "scope.json"))).toBe(false);
        else expect(JSON.parse(readFileSync(join(out, "scope.json"), "utf8"))).toMatchObject({ allowedActions: ["inspect"],
          games: [{ gameId: 30, expectedPriorRevisionId: "historical-only", decision: "requires_generation_or_readiness_repair" }] });
      }
      expect(methods).toEqual(["GET"]);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  }, 20000);
  it("holds local scope ownership through calculation and permits disjoint games", () => {
    const parent = mkdtempSync(join(tmpdir(), "forge-ownership-")); directories.push(parent);
    const scope = { origin: "https://db.example", gameId: 1, receiptDirectory: parent, root: join(parent, "owners") };
    const owner = acquireForgeLocalOwnership(scope);
    owner.beforeWrite(); // A successful calculation does not release publication ownership.
    expect(() => acquireForgeLocalOwnership(scope)).toThrow(ForgeLocalOwnershipError);
    expect(inspectForgeLocalOwnership(owner.reference.directory)).toMatchObject({ live: true, state: "active",
      owner: { operationId: owner.reference.operationId, pid: process.pid } });
    const other = acquireForgeLocalOwnership({ ...scope, gameId: 2 });
    expect(other.finish()).toBe(true);
    expect(owner.finish()).toBe(false);
    expect(existsSync(join(owner.reference.directory, "write-intent.json"))).toBe(true);
    expect(owner.finish(true)).toBe(true);
    expect(owner.finish(true)).toBe(true);
    expect(acquireForgeLocalOwnership(scope).finish()).toBe(true);
  });

  it("does not reclaim dead or incomplete ownership, or discard a replacement owner's state", () => {
    const parent = mkdtempSync(join(tmpdir(), "forge-dead-ownership-")); directories.push(parent);
    const scope = { origin: "https://db.example", gameId: 1, receiptDirectory: parent, root: join(parent, "owners") };
    const owner = acquireForgeLocalOwnership(scope);
    owner.beforeWrite();
    const originalKill = process.kill.bind(process);
    vi.spyOn(process, "kill").mockImplementation((pid, signal) => {
      if (pid === process.pid && signal === 0) throw Object.assign(new Error("not running"), { code: "ESRCH" });
      return originalKill(pid, signal);
    });
    expect(inspectForgeLocalOwnership(owner.reference.directory)).toMatchObject({ live: false, state: "unresolved" });
    expect(() => acquireForgeLocalOwnership(scope)).toThrow("unresolved");
    const path = join(owner.reference.directory, "owner.json");
    const replacement = { ...JSON.parse(readFileSync(path, "utf8")), operationId: "11111111-1111-4111-8111-111111111111" };
    writeFileSync(path, JSON.stringify(replacement));
    expect(() => owner.beforeWrite()).toThrow(); expect(() => owner.finish(true)).toThrow();
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(replacement);
    rmSync(path);
    expect(() => acquireForgeLocalOwnership(scope)).toThrow("unresolved");
    expect(existsSync(owner.reference.directory)).toBe(true);
  });

  it("rejects repository or non-private ownership directories before acquiring a scope", () => {
    const parent = mkdtempSync(join(tmpdir(), "forge-private-owner-")); directories.push(parent);
    const scope = { origin: "https://db.example", gameId: 1, receiptDirectory: parent };
    const inside = join(__dirname, "forbidden-ownership-directory");
    expect(() => acquireForgeLocalOwnership({ ...scope, root: inside })).toThrow("outside the repository");
    expect(existsSync(inside)).toBe(false);
    const root = join(parent, "public-owners"); mkdirSync(root); chmodSync(root, 0o755);
    expect(() => acquireForgeLocalOwnership({ ...scope, root })).toThrow("private");
    expect(statSync(root).mode & 0o777).toBe(0o755);
  });

  it("requires one explicit game and an intentional write/refresh combination", () => {
    expect(() => parseArgs(["--date", "2026-09-29", "--out", "/tmp/forge"])).toThrow();
    expect(() => parseArgs(["--date", "2026-02-30", "--game-id", "1", "--out", "/tmp/forge"])).toThrow();
    expect(() => parseArgs(["--date", "2026-09-29", "--game-id", "1", "--out", "/tmp/forge", "--refresh"])).toThrow();
    expect(parseArgs(["--date", "2026-09-29", "--game-id", "2026020001", "--out", "/tmp/forge"]).write).toBe(false);
    const scope = ["--date", "2026-09-29", "--game-id", "1", "--out", "/tmp/forge"];
    expect(parseArgs([...scope, "--max-writes", "3", "--runtime-ms", "1500", "--request-timeout-ms", "200"]))
      .toMatchObject({ maxWrites: 3, runtimeMs: 1500, requestTimeoutMs: 200 });
    for (const [flag, value] of [["--max-writes", "0"], ["--max-writes", "2001"], ["--runtime-ms", "600001"],
      ["--request-timeout-ms", "60001"], ["--runtime-ms", "1.5"], ["--runtime-ms", "-1"]]) {
      expect(() => parseArgs([...scope, flag, value])).toThrow();
    }
    const operation = randomUUID();
    expect(parseArgs([...scope, "--reconcile", operation])).toMatchObject({ reconcile: operation, write: false });
    expect(() => parseArgs([...scope, "--reconcile", "invalid"])).toThrow();
    expect(() => parseArgs([...scope, "--reconcile", operation, "--write"])).toThrow();
    expect(() => parseArgs([...scope, "--reconcile", operation, "--artifact", "/tmp/pin"])).toThrow();
    expect(() => parseArgs([...scope, "--reconcile-failed-snapshot"])).toThrow();
    expect(parseArgs([...scope, "--reconcile", operation, "--reconcile-failed-snapshot"]))
      .toMatchObject({ reconcile: operation, reconcileFailedSnapshot: true, write: false });
  });

  it("rejects off-origin, dispatch and preview writes before transport", async () => {
    const transport = async () => new Response("[]", { status: 200 });
    const counts = requestCounts();
    await expect(guardedForgeFetch("https://other.example/rest/v1/games", undefined,
      "https://db.example", true, transport, counts)).rejects.toThrow("rejected");
    await expect(guardedForgeFetch("https://db.example/functions/v1/dispatch", { method: "POST" },
      "https://db.example", true, transport, counts)).rejects.toThrow("rejected");
    await expect(guardedForgeFetch("https://db.example/rest/v1/rpc/enqueue_forecasts", { method: "POST" },
      "https://db.example", true, transport, counts)).rejects.toThrow("rejected");
    await expect(guardedForgeFetch("https://db.example/rest/v1/forge_runs", { method: "POST" },
      "https://db.example", false, transport, counts)).rejects.toThrow("rejected");
    expect(counts).toEqual(requestCounts());
  });

  it("retains attempted writes when a committed request loses its response", async () => {
    const counts = requestCounts();
    let committed = false;
    const transport = async () => { committed = true; throw new Error("response lost"); };
    await expect(guardedForgeFetch("https://db.example/rest/v1/rpc/publish_forge_game_revisions", { method: "POST" },
      "https://db.example", true, transport, counts)).rejects.toThrow("response lost");
    expect(committed).toBe(true);
    expect(counts).toMatchObject({ writes: 1, acknowledgedWrites: 0, rejectedWrites: 0, unknownWrites: 1 });
    expect(counts.writeMs).toBeGreaterThanOrEqual(0);
  });

  it("separates acknowledged, rejected and uncertain HTTP write responses", async () => {
    const counts = requestCounts();
    for (const status of [201, 409, 503]) {
      await guardedForgeFetch("https://db.example/rest/v1/forge_runs", { method: "POST" },
        "https://db.example", true, async () => new Response("{}", { status }), counts);
    }
    expect(counts).toMatchObject({ writes: 3, acknowledgedWrites: 1, rejectedWrites: 1, unknownWrites: 1 });
  });

  it("rejects exhausted budgets and pre-cancelled work before transport or journaling", async () => {
    const transport = vi.fn(async () => new Response("[]")), beforeWrite = vi.fn();
    const counts = requestCounts();
    const bounds = { deadlineMs: Date.now() + 1000, requestTimeoutMs: 500, maxWrites: 1, beforeWrite };
    const url = "https://db.example/rest/v1/forge_runs";
    await expect(guardedForgeFetch(url, { method: "POST" }, "https://db.example", true, transport, counts,
      { ...bounds, deadlineMs: Date.now() })).rejects.toThrow("budget exhausted");
    const controller = new AbortController(); controller.abort();
    await expect(guardedForgeFetch(url, { method: "POST", signal: controller.signal },
      "https://db.example", true, transport, counts, bounds)).rejects.toThrow("cancelled");
    expect(transport).not.toHaveBeenCalled(); expect(beforeWrite).not.toHaveBeenCalled();
    expect(counts).toEqual(requestCounts());
    await guardedForgeFetch(url, { method: "POST", body: "{}" }, "https://db.example", true, transport, counts, bounds);
    await expect(guardedForgeFetch(url, { method: "POST" }, "https://db.example", true, transport, counts, bounds))
      .rejects.toThrow("budget exhausted");
    expect(transport).toHaveBeenCalledTimes(1); expect(beforeWrite).toHaveBeenCalledTimes(1);
    expect(counts).toMatchObject({ writes: 1, acknowledgedWrites: 1, unknownWrites: 0 });
  });

  it.each(["headers", "body"])("bounds stalled %s even when transport ignores abort", async phase => {
    vi.useFakeTimers();
    const counts = requestCounts(); let passedSignal: AbortSignal | null | undefined;
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const transport = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      passedSignal = init?.signal;
      if (phase === "headers") return new Promise<Response>(() => {});
      const response = new Response("{}");
      vi.spyOn(response, "arrayBuffer").mockImplementation(() => new Promise(() => {}));
      return response;
    });
    const pending = guardedForgeFetch("https://db.example/rest/v1/rpc/publish_forge_game_revisions",
      { method: "POST", signal: controller.signal }, "https://db.example", true, transport, counts,
      { deadlineMs: Date.now() + 25, requestTimeoutMs: 100, maxWrites: 1 });
    const rejected = expect(pending).rejects.toThrow("deadline exceeded");
    await vi.advanceTimersByTimeAsync(25); await rejected;
    expect(passedSignal?.aborted).toBe(true);
    expect(counts).toMatchObject({ writes: 1, unknownWrites: 1, acknowledgedWrites: 0, writeMs: 25 });
    expect(remove).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("cancels an in-flight write promptly even if transport ignores its signal", async () => {
    vi.useFakeTimers();
    const counts = requestCounts(); const controller = new AbortController();
    const pending = guardedForgeFetch("https://db.example/rest/v1/forge_runs",
      { method: "POST", signal: controller.signal }, "https://db.example", true,
      async () => new Promise<Response>(() => {}), counts,
      { deadlineMs: Date.now() + 5000, requestTimeoutMs: 1000, maxWrites: 1 });
    const rejected = expect(pending).rejects.toThrow("cancelled");
    controller.abort(); await rejected;
    expect(counts).toMatchObject({ writes: 1, unknownWrites: 1 }); expect(vi.getTimerCount()).toBe(0);
  });

  it("refuses a write when its durable journal fails before transport", async () => {
    const counts = requestCounts(), transport = vi.fn(async () => new Response("{}"));
    await expect(guardedForgeFetch("https://db.example/rest/v1/forge_runs", { method: "POST", body: "{}" },
      "https://db.example", true, transport, counts, { deadlineMs: Date.now() + 1000, requestTimeoutMs: 100,
        maxWrites: 1, beforeWrite: () => { throw new Error("journal unavailable"); } })).rejects.toThrow("journal unavailable");
    expect(transport).not.toHaveBeenCalled(); expect(counts).toEqual(requestCounts());
  });

  it("rechecks the deadline after journaling and records a prepared write as not attempted", async () => {
    vi.useFakeTimers();
    const counts = requestCounts(), transport = vi.fn(async () => new Response("{}")), afterWrite = vi.fn();
    await expect(guardedForgeFetch("https://db.example/rest/v1/forge_runs", { method: "POST" },
      "https://db.example", true, transport, counts, { deadlineMs: Date.now() + 10, requestTimeoutMs: 100,
        maxWrites: 1, beforeWrite: () => vi.advanceTimersByTime(10), afterWrite })).rejects.toThrow("budget exhausted");
    expect(transport).not.toHaveBeenCalled(); expect(counts).toEqual(requestCounts());
    expect(afterWrite).toHaveBeenCalledWith(expect.objectContaining({ outcome: "not_attempted", responseStatus: null }));
  });

  it("preserves the known HTTP outcome if the result journal fails and strips private request data", async () => {
    const counts = requestCounts(), beforeWrite = vi.fn(), afterWrite = vi.fn(() => { throw new Error("journal failed"); });
    const url = "https://db.example/rest/v1/forge_runs?privateFilter=secret-query";
    await expect(guardedForgeFetch(url, { method: "POST", body: '{"private":"secret-body"}',
      headers: { Authorization: "Bearer secret-token" } }, "https://db.example", true,
      async () => new Response("{}", { status: 201 }), counts, { deadlineMs: Date.now() + 1000,
        requestTimeoutMs: 100, maxWrites: 1, beforeWrite, afterWrite })).rejects.toThrow("journal failed");
    expect(counts).toMatchObject({ writes: 1, acknowledgedWrites: 1, rejectedWrites: 0, unknownWrites: 0 });
    expect(beforeWrite).toHaveBeenCalledWith({ resource: "/rest/v1/forge_runs", index: 1, method: "POST", payloadBytes: 25,
      payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(afterWrite).toHaveBeenCalledWith(expect.objectContaining({ outcome: "acknowledged", responseStatus: 201 }));
    expect(JSON.stringify([beforeWrite.mock.calls, afterWrite.mock.calls])).not.toContain("secret-");
  });

  it.each([204, 304])("retains headers and bodyless status %s within the bounded read", async status => {
    const counts = requestCounts();
    const response = await guardedForgeFetch("https://db.example/rest/v1/games", { method: "HEAD" },
      "https://db.example", false, async () => new Response(null, { status, headers: { "content-range": "0-0/1" } }), counts,
      { deadlineMs: Date.now() + 1000, requestTimeoutMs: 100, maxWrites: 1 });
    expect(response.status).toBe(status); expect(response.headers.get("content-range")).toBe("0-0/1");
    expect(await response.text()).toBe(""); expect(counts).toMatchObject({ reads: 1, writes: 0 });
  });

  it("pins source, dependencies, lockfile, compiler settings and model environment", () => {
    const fixture = artifactFixture();
    expect(() => verifyLocalForgeArtifact(fixture.artifact, fixture.repo, fixture.environment, fixture.files)).not.toThrow();
    vi.stubEnv("FORGE_LOCAL_OWNERSHIP_DIR", join(fixture.repo, "changed-owner-policy"));
    expect(() => verifyLocalForgeArtifact(fixture.artifact, fixture.repo, fixture.environment, fixture.files)).toThrow("artifact changed");
    vi.unstubAllEnvs();
    for (const path of [fixture.source, fixture.dependency, join(fixture.repo, "web/package-lock.json"), join(fixture.repo, "web/tsconfig.json")]) {
      const original = readFileSync(path);
      writeFileSync(path, "changed");
      expect(() => verifyLocalForgeArtifact(fixture.artifact, fixture.repo, fixture.environment, fixture.files)).toThrow("artifact changed");
      writeFileSync(path, new Uint8Array(original));
    }
    expect(() => verifyLocalForgeArtifact(fixture.artifact, fixture.repo,
      { FORGE_SKATER_MODEL_MODE: "candidate" }, fixture.files)).toThrow("artifact changed");
    for (const changed of [{ nodeVersion: "unreviewed" }, { nodeBinaryHash: "changed" },
      { compilerOptions: { target: 1 } }, { codeVersion: "local:invented" }]) {
      expect(() => verifyLocalForgeArtifact({ ...fixture.artifact, ...changed }, fixture.repo,
        fixture.environment, fixture.files)).toThrow("artifact changed");
    }
    const late = join(fixture.repo, "web/late.js");
    writeFileSync(late, "exports.late = true;");
    expect(() => verifyLocalForgeArtifact(fixture.artifact, fixture.repo, fixture.environment,
      [...fixture.files, late])).toThrow("artifact changed");
    rmSync(fixture.dependency);
    expect(() => verifyLocalForgeArtifact(fixture.artifact, fixture.repo, fixture.environment, fixture.files)).toThrow("artifact changed");
  });

  it("previews via reads and skips a duplicate even with --write", async () => {
    const methods: string[] = [];
    const server = createServer((request, response) => {
      methods.push(request.method ?? "");
      response.setHeader("content-type", "application/json");
      if (request.url?.startsWith("/rest/v1/games?")) response.end(JSON.stringify([{ id: 2026020001, date: "2026-09-29" }]));
      else if (request.url?.startsWith("/rest/v1/forge_game_revisions?")) response.end(JSON.stringify([
        { id: "existing", run_id: "old", input_snapshot_id: "snapshot", published_at: "2026-09-28T13:00:00Z" },
      ]));
      else { response.statusCode = 404; response.end("[]"); }
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected local port");
      const parent = mkdtempSync(join(tmpdir(), "forge-local-test-"));
      directories.push(parent);
      for (const [name, flags, expected] of [["preview", [], "preview"], ["duplicate", ["--write"], "skipped_existing_revision"]] as const) {
        const out = join(parent, name);
        await exec(process.execPath, ["-r", "ts-node/register/transpile-only", "scripts/run-forge-local.ts",
          "--date", "2026-09-29", "--game-id", "2026020001", "--out", out, ...flags], {
          cwd: join(__dirname, ".."), env: { ...process.env, NODE_PATH: ".", TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}',
            NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${address.port}`, SUPABASE_SERVICE_ROLE_KEY: "local-test-only",
            FORGE_LOCAL_OWNERSHIP_DIR: join(parent, "owners") },
        });
        const receipt = JSON.parse(readFileSync(join(out, "receipt.json"), "utf8"));
        expect(receipt.status).toBe(expected);
        expect(receipt.requests).toMatchObject({ writes: 0, unknownWrites: 0 });
        expect(JSON.parse(readFileSync(receipt.artifact, "utf8"))).toMatchObject({
          version: "forge-local-artifact-v1", codeVersion: receipt.codeVersion,
          compilerOptions: { target: 9 }, transpileOnly: true });
      }
      expect(methods).toEqual(["GET", "GET", "GET", "GET"]);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 20_000);

  it("reconciles matching issuance through reads and leaves absent, expired or active attempts unresolved", async () => {
    const parent = mkdtempSync(join(tmpdir(), "forge-reconciliation-")); directories.push(parent);
    let owner: ReturnType<typeof acquireForgeLocalOwnership>, operationId: string;
    const version = `local:${"a".repeat(64)}`;
    const captured = { version: "forge-inputs-v1", codeVersion: version, runId: "run-1", slateDate: "2026-09-29",
      horizonGames: 1, gameIds: [2026020001], replayClassification: "captured_live", inputProvenance: { fixture: true } };
    const revision = { id: "revision-1", run_id: "run-1", input_snapshot_id: "snapshot-1", game_id: 2026020001,
      payload: { codeVersion: version, inputProvenance: captured.inputProvenance } };
    let state = "active";
    const methods: string[] = [];
    const server = createServer((request, response) => {
      methods.push(request.method!); response.setHeader("content-type", "application/json");
      if (request.url?.startsWith("/rest/v1/rpc/inspect_forge_local_attempt?")) {
        expect(new URL(request.url, "http://localhost").searchParams.get("p_operation_id")).toBe(operationId);
        response.end(JSON.stringify(state === "missing" ? null : { version: "forge-local-attempt-v1", operationId,
          slateDate: "2026-09-29", gameId: state === "wrong_scope" ? 1 : 2026020001, codeVersion: version,
          runId: "run-1", state: ["wrong_scope", "wrong_snapshot"].includes(state) ? "issued" : state,
          revisionId: "revision-1", inputSnapshotId: "snapshot-1" }));
      } else if (request.url?.startsWith("/rest/v1/player_forecast_source_observations?")) {
        response.end(JSON.stringify({ id: state === "wrong_snapshot" ? "other" : "snapshot-1",
          payload: captured, payload_hash: projectionInputHash(captured) }));
      } else if (request.url?.startsWith("/rest/v1/forge_game_revisions?")) response.end(JSON.stringify([revision]));
      else { response.statusCode = 400; response.end("{}"); }
    });
    await new Promise<void>(resolve => server.listen(0, resolve));
    try {
      const address = server.address(); if (!address || typeof address === "string") throw new Error("Expected local port");
      owner = acquireForgeLocalOwnership({ origin: `http://localhost:${address.port}`, gameId: 2026020001,
        receiptDirectory: parent, root: join(parent, "owners") });
      owner.beforeWrite(); operationId = owner.reference.operationId;
      for (state of ["missing", "active", "expired", "issued", "wrong_scope", "wrong_snapshot"]) {
        const out = join(parent, state);
        const run = exec(process.execPath, ["-r", "ts-node/register/transpile-only", "scripts/run-forge-local.ts",
          "--date", "2026-09-29", "--game-id", "2026020001", "--out", out, "--reconcile", operationId], {
          cwd: join(__dirname, ".."), env: { ...process.env, NODE_PATH: ".",
            TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}',
            NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${address.port}`, SUPABASE_SERVICE_ROLE_KEY: "local-test-only",
            FORGE_LOCAL_OWNERSHIP_DIR: join(parent, "owners") },
        });
        if (state.startsWith("wrong_")) await expect(run).rejects.toMatchObject({ code: 1 }); else await run;
        const receipt = JSON.parse(readFileSync(join(out, "receipt.json"), "utf8"));
        expect(receipt).toMatchObject({ status: state.startsWith("wrong_") ? "failed_before_run"
          : state === "issued" ? "verified_issued" : "unresolved", requests: { writes: 0, unknownWrites: 0 } });
        if (!state.startsWith("wrong_")) expect(receipt.automaticRetryAllowed).toBe(false);
        expect(existsSync(join(out, "code.json"))).toBe(false);
        expect(existsSync(join(owner.reference.directory, "write-intent.json"))).toBe(true);
        owner.assertOwned();
      }
      expect(methods.every(method => method === "GET")).toBe(true);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  }, 20000);

  it("retains CLI identities and uncertain publication state across failures without retrying", async () => {
    const parent = mkdtempSync(join(tmpdir(), "forge-cli-failures-"));
    directories.push(parent);
    const preload = join(parent, "runner-fixture.cjs");
    writeFileSync(preload, `
      const Module = require('node:module');
      const original = Module._load;
      Module._load = function(request, ...args) {
        if (request === '../lib/projections/run-forge-projections') return {
          projectionModelEnvironment: () => ({ failure: process.env.FORGE_TEST_FAILURE }),
          runProjectionV2ForDate: async (date, options) => {
            const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const post = (path) => fetch(origin + '/rest/v1/' + path, { method: 'POST', body: '{}' });
            options.executionGuard.verify({ phase: 'before_run' });
            await post('rpc/begin_forge_game_run');
            if (process.env.FORGE_TEST_FAILURE === 'crash_after_reservation') process.kill(process.pid, 'SIGKILL');
            options.executionGuard.verify({ phase: 'reserved', runId: 'run-1' });
            if (process.env.FORGE_TEST_FAILURE === 'reservation') throw new Error('calculation failed');
            options.executionGuard.verify({ phase: 'before_snapshot', runId: 'run-1' });
            await post('player_forecast_source_observations');
            options.executionGuard.verify({ phase: 'before_publish', runId: 'run-1', inputSnapshotId: 'snapshot-1' });
            await post('rpc/publish_forge_game_revisions');
            if (process.env.FORGE_TEST_FAILURE === 'crash_after_publication') process.kill(process.pid, 'SIGKILL');
            return { runId: 'run-1', inputSnapshotId: 'snapshot-1', publishedGames: 1, gamesProcessed: 1,
              playerRowsUpserted: 1, teamRowsUpserted: 1, goalieRowsUpserted: 0, timedOut: false };
          }
        };
        return original.call(this, request, ...args);
      };
    `);
    let failure = "reservation";
    let activeOut = "";
    let issued: any = null, captured: any = null;
    let releasePublication: (() => void) | undefined, publicationReached: (() => void) | undefined;
    const writes: string[] = [];
    const journalAtWrite: any[] = [];
    const server = createServer((request, response) => {
      response.setHeader("content-type", "application/json");
      if (request.method === "POST") {
        const path = request.url!;
        writes.push(path);
        const journal = readFileSync(join(activeOut, "attempts.jsonl"), "utf8").trim().split("\n").map(line => JSON.parse(line));
        journalAtWrite.push(journal[journal.length - 1]);
        if (path.endsWith("publish_forge_game_revisions") && failure === "active_overlap") {
          releasePublication = () => response.end("{}"); publicationReached?.(); return;
        }
        if (failure === "publication" && path.endsWith("publish_forge_game_revisions")) {
          // The simulated database committed, but the HTTP response never arrives.
          request.socket.destroy(); return;
        }
        if (path.endsWith("publish_forge_game_revisions") && ["issued", "wrong_snapshot"].includes(failure)) {
          const codeVersion = JSON.parse(readFileSync(join(activeOut, "code.json"), "utf8")).codeVersion;
          captured = { version: "forge-inputs-v1", codeVersion, runId: "run-1", slateDate: "2026-09-29", horizonGames: 1,
            gameIds: [2026020001], replayClassification: "captured_live", outputHash: "a".repeat(64), inputProvenance: { fixture: true } };
          issued = { id: "revision-1", run_id: "run-1", input_snapshot_id: "snapshot-1", game_id: 2026020001,
            published_at: "2026-09-29T13:00:00Z", payload: { codeVersion, inputProvenance: captured.inputProvenance } };
        }
        response.end("{}"); return;
      }
      if (request.url?.startsWith("/rest/v1/games?")) response.end(JSON.stringify([{ id: 2026020001, date: "2026-09-29" }]));
      else if (request.url?.startsWith("/rest/v1/forge_game_revisions?")) response.end(JSON.stringify(issued ? [issued] : []));
      else if (request.url?.startsWith("/rest/v1/player_forecast_source_observations?") && captured) response.end(JSON.stringify({
        id: failure === "wrong_snapshot" ? "other-snapshot" : "snapshot-1", payload: captured, payload_hash: projectionInputHash(captured) }));
      else { response.statusCode = 400; response.end(JSON.stringify({ message: "post-publication verification failed" })); }
    });
    await new Promise<void>(resolve => server.listen(0, resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected local port");
      const invoke = async (out: string, flags: string[]) => {
        activeOut = out;
        return exec(process.execPath,
        ["-r", "ts-node/register/transpile-only", "-r", preload, "scripts/run-forge-local.ts",
          "--date", "2026-09-29", "--game-id", "2026020001", "--out", out, ...flags], {
          cwd: join(__dirname, ".."), env: { ...process.env, NODE_PATH: ".",
            TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}',
            NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${address.port}`, SUPABASE_SERVICE_ROLE_KEY: "local-test-only",
            FORGE_LOCAL_OWNERSHIP_DIR: join(parent, `${failure}-owners`),
            FORGE_TEST_FAILURE: failure },
        });
      };
      const missingPin = join(parent, "missing-pin");
      await expect(invoke(missingPin, ["--write"])).rejects.toMatchObject({ code: 1 });
      expect(JSON.parse(readFileSync(join(missingPin, "receipt.json"), "utf8"))).toMatchObject({
        status: "failed_before_run", requests: { writes: 0, unknownWrites: 0 } });
      expect(writes).toEqual([]);
      const invalidPin = join(parent, "invalid-pin.json"), rejected = join(parent, "rejected-pin");
      const reviewed = JSON.parse(readFileSync(join(missingPin, "code.json"), "utf8"));
      writeFileSync(invalidPin, JSON.stringify({ ...reviewed, codeVersion: "local:unreviewed" }));
      await expect(invoke(rejected, ["--write", "--artifact", invalidPin])).rejects.toMatchObject({ code: 1 });
      expect(JSON.parse(readFileSync(join(rejected, "receipt.json"), "utf8"))).toMatchObject({
        status: "artifact_rejected", requests: { writes: 0, unknownWrites: 0 } });
      expect(writes).toEqual([]);
      for (failure of ["reservation", "publication", "verification", "crash_after_reservation", "crash_after_publication",
        "active_overlap", "issued", "wrong_snapshot"]) {
        issued = null; captured = null;
        const preview = join(parent, `${failure}-preview`), output = join(parent, `${failure}-write`);
        await invoke(preview, []);
        writes.splice(0);
        journalAtWrite.splice(0);
        const crashed = failure.startsWith("crash_");
        const atPublication = new Promise<void>(resolve => { publicationReached = resolve; });
        const run = invoke(output, ["--write", "--artifact", join(preview, "code.json")]);
        const completion = failure === "issued" ? run : expect(run).rejects.toMatchObject(crashed ? { signal: "SIGKILL" } : { code: 1 });
        if (failure === "active_overlap") {
          await atPublication;
          const held = journalAtWrite.at(-1).ownership;
          expect(inspectForgeLocalOwnership(held.directory)).toMatchObject({ live: true, state: "active" });
          const other = join(parent, "active-overlap-retry");
          await expect(invoke(other, ["--write", "--artifact", join(preview, "code.json")])).rejects.toMatchObject({ code: 1 });
          expect(JSON.parse(readFileSync(join(other, "receipt.json"), "utf8"))).toMatchObject({
            status: "ownership_unavailable", requests: { reads: 0, writes: 0 }, existingOwnership: { live: true, state: "active" } });
          expect(writes).toHaveLength(3); releasePublication!(); releasePublication = undefined;
        }
        await completion;
        const journalText = readFileSync(join(output, "attempts.jsonl"), "utf8");
        const journal = journalText.trim().split("\n").map(line => JSON.parse(line));
        const attempted = journal.filter(row => row.entry.kind === "write_attempt");
        const received = journal.filter(row => row.entry.kind === "write_receipt");
        expect(attempted).toHaveLength(writes.length); expect(received).toHaveLength(writes.length);
        expect(journalText).not.toContain("local-test-only"); expect(journalText).not.toContain('"body":');
        expect(statSync(join(output, "attempts.jsonl")).mode & 0o777).toBe(0o600);
        for (const [index, row] of journalAtWrite.entries()) {
          expect(row).toMatchObject({ scope: { date: "2026-09-29", gameId: 2026020001 },
            limits: { maxWrites: 100, runtimeMs: 150000, requestTimeoutMs: 10000 },
            entry: { kind: "write_attempt", resource: writes[index], index: index + 1 } });
          expect(row.codeVersion).toMatch(/^local:[a-f0-9]{64}$/);
          expect(row.entry.payloadHash).toMatch(/^[a-f0-9]{64}$/);
        }
        expect(received.at(-1).entry.outcome).toBe(failure === "publication" ? "unknown" : "acknowledged");
        const acquired = journal.find(row => row.entry.kind === "ownership_acquired").entry;
        if (failure === "issued") {
          expect(JSON.parse(readFileSync(join(output, "receipt.json"), "utf8"))).toMatchObject({
            status: "issued", inputSnapshotId: "snapshot-1", issuedRevisionIds: ["revision-1"] });
          expect(existsSync(acquired.directory)).toBe(false);
          const skip = join(parent, "issued-skip");
          await invoke(skip, ["--write", "--artifact", join(preview, "code.json")]);
          expect(JSON.parse(readFileSync(join(skip, "receipt.json"), "utf8"))).toMatchObject({
            status: "skipped_existing_revision", requests: { writes: 0 } });
          expect(existsSync(acquired.directory)).toBe(false); expect(writes).toHaveLength(3);
          continue;
        }
        const held = inspectForgeLocalOwnership(acquired.directory);
        expect(held).toMatchObject({ live: false, state: "unresolved", owner: { operationId: acquired.operationId } });
        const blocked = join(parent, `${failure}-blocked-retry`);
        const writesBeforeRetry = writes.length;
        await expect(invoke(blocked, ["--write", "--artifact", join(preview, "code.json")])).rejects.toMatchObject({ code: 1 });
        expect(JSON.parse(readFileSync(join(blocked, "receipt.json"), "utf8"))).toMatchObject({
          status: "ownership_unavailable", requests: { reads: 0, writes: 0 },
          existingOwnership: { directory: acquired.directory, operationId: acquired.operationId, live: false, state: "unresolved" } });
        expect(writes).toHaveLength(writesBeforeRetry);
        if (crashed) {
          expect(existsSync(join(output, "receipt.json"))).toBe(false);
          expect(received.at(-1).checkpoint).toMatchObject(failure === "crash_after_publication"
            ? { phase: "before_publish", runId: "run-1", inputSnapshotId: "snapshot-1" } : { phase: "before_run" });
          expect(writes).toHaveLength(failure === "crash_after_reservation" ? 1 : 3);
          continue;
        }
        const receipt = JSON.parse(readFileSync(join(output, "receipt.json"), "utf8"));
        expect(receipt).toMatchObject({ status: "failed", runId: "run-1",
          publicationOutcome: failure === "reservation" ? "not_attempted" : failure === "publication" ? "unknown" : "acknowledged",
          requests: { writes: failure === "reservation" ? 1 : 3, unknownWrites: failure === "publication" ? 1 : 0 } });
        if (failure !== "reservation") expect(receipt.inputSnapshotId).toBe("snapshot-1");
        if (failure === "verification") expect(receipt.result.publishedGames).toBe(1);
        expect(writes.filter(path => path.endsWith("publish_forge_game_revisions"))).toHaveLength(failure === "reservation" ? 0 : 1);
      }
    } finally { releasePublication?.(); await new Promise<void>(resolve => server.close(() => resolve())); }
  }, 20_000);
});

describe("FORGE artifact gate at the actual issuance boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STARTER_BOARD_CAPTURE_ENABLED", "true");
    vi.stubEnv("STARTER_BOARD_COMPUTE_ENABLED", "true");
    vi.stubEnv("STARTER_BOARD_CANARY_GAME_IDS", "1");
    boundary.rpc.mockResolvedValue({ data: "run-1", error: null });
    boundary.from.mockImplementation(() => {
      const query: any = { update: () => query, eq: () => query,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve) };
      return query;
    });
    boundary.capture.mockResolvedValue({ result: { runId: "run-1", gamesProcessed: 1, playerRowsUpserted: 1,
      teamRowsUpserted: 1, goalieRowsUpserted: 0, timedOut: false },
    reads: [{ request: [{ method: "from", args: ["games"] }], result: { data: [], error: null }, receivedAt: new Date().toISOString() }], writes: [] });
    boundary.save.mockResolvedValue("snapshot-1");
    boundary.publish.mockResolvedValue(1);
  });

  function options(fixture: ReturnType<typeof artifactFixture>, checkpoints: unknown[] = []) {
    vi.stubEnv("FORGE_CODE_VERSION", fixture.artifact.codeVersion);
    return { gameIds: [1], horizonGames: 1, executionGuard: { codeVersion: fixture.artifact.codeVersion,
      verify: (checkpoint: unknown) => { checkpoints.push(checkpoint);
        verifyLocalForgeArtifact(fixture.artifact, fixture.repo, fixture.environment, fixture.files); } } };
  }
  const date = () => new Date().toISOString().slice(0, 10);

  it("runs the calendar context guard inside capture before model calculation and withholds issuance on rejection", async () => {
    const fixture = artifactFixture();
    vi.spyOn(issuedContexts, "captureForgeIssuedContexts").mockResolvedValue([]);
    boundary.capture.mockImplementation(async (calculate: () => Promise<unknown>) => calculate());
    const guard = vi.fn(() => { throw new Error("reviewed population changed"); });
    await expect(runProjectionV2ForDate(date(), { ...options(fixture), issuedContextGuard: guard })).rejects.toThrow("reviewed population changed");
    expect(guard).toHaveBeenCalledExactlyOnceWith([]);
    expect(boundary.save).not.toHaveBeenCalled(); expect(boundary.publish).not.toHaveBeenCalled();
  });

  it("rejects an invalid initial pin before reservation or generation", async () => {
    const fixture = artifactFixture();
    writeFileSync(fixture.source, "unreviewed");
    await expect(runProjectionV2ForDate(date(), options(fixture))).rejects.toThrow("artifact changed");
    expect(boundary.rpc).not.toHaveBeenCalled();
    expect(boundary.capture).not.toHaveBeenCalled();
    expect(boundary.save).not.toHaveBeenCalled();
    expect(boundary.publish).not.toHaveBeenCalled();
  });

  it("binds a local operation to reservation and never recomputes an existing attempt", async () => {
    const fixture = artifactFixture(), checkpoints: unknown[] = [];
    const intent = { operationId: randomUUID(), expectedRevisionId: null, leaseMs: 150000 };
    const receipt = { version: "forge-local-attempt-v1", ...intent, runId: "run-1", gameId: 1,
      slateDate: date(), codeVersion: fixture.artifact.codeVersion, reservedAt: new Date().toISOString(),
      leaseExpiresAt: new Date(Date.now() + intent.leaseMs).toISOString(), state: "active", reservation: "new" };
    boundary.rpc.mockResolvedValue({ data: receipt, error: null });
    expect(await runProjectionV2ForDate(date(), { ...options(fixture, checkpoints), localAttempt: intent }))
      .toMatchObject({ runId: "run-1", publishedGames: 1 });
    expect(boundary.rpc).toHaveBeenCalledWith("begin_forge_local_run", {
      p_operation_id: intent.operationId, p_date: date(), p_game_id: 1,
      p_code_version: fixture.artifact.codeVersion, p_expected_revision_id: null, p_lease_ms: 150000 });
    boundary.capture.mockClear(); boundary.save.mockClear(); boundary.publish.mockClear(); boundary.from.mockClear();
    boundary.rpc.mockResolvedValue({ data: { ...receipt, reservation: "existing" }, error: null });
    await expect(runProjectionV2ForDate(date(), { ...options(fixture, checkpoints), localAttempt: intent }))
      .rejects.toThrow("already exists");
    expect(checkpoints.at(-1)).toEqual({ phase: "reserved", runId: "run-1" });
    expect(boundary.capture).not.toHaveBeenCalled(); expect(boundary.save).not.toHaveBeenCalled();
    expect(boundary.publish).not.toHaveBeenCalled(); expect(boundary.from).not.toHaveBeenCalled();
    boundary.rpc.mockResolvedValue({ data: { ...receipt, operationId: randomUUID() }, error: null });
    await expect(runProjectionV2ForDate(date(), { ...options(fixture), localAttempt: intent }))
      .rejects.toThrow("immutable intent");
    expect(boundary.capture).not.toHaveBeenCalled();
    await expect(runProjectionV2ForDate(date(), { ...options(fixture), localAttempt: intent,
      boardLease: { owner: randomUUID(), version: 1 } })).rejects.toThrow("without a queue lease");
  });

  it.each(["source", "late dependency"])("withholds snapshot and publication after %s drift during computation", async (kind) => {
    const fixture = artifactFixture(), checkpoints: unknown[] = [];
    const capture = await boundary.capture();
    boundary.capture.mockImplementation(async () => {
      if (kind === "source") writeFileSync(fixture.source, "changed while calculating");
      else { const late = join(fixture.repo, "web/late.js"); writeFileSync(late, "late dependency"); fixture.files.push(late); }
      return capture;
    });
    await expect(runProjectionV2ForDate(date(), options(fixture, checkpoints))).rejects.toThrow("artifact changed");
    expect(boundary.rpc).toHaveBeenCalledWith("begin_forge_game_run", expect.anything());
    expect(checkpoints.at(-1)).toEqual({ phase: "before_snapshot", runId: "run-1" });
    expect(boundary.save).not.toHaveBeenCalled();
    expect(boundary.publish).not.toHaveBeenCalled();
  });

  it("rechecks the pin after snapshot storage and retains known identities before withholding issuance", async () => {
    const fixture = artifactFixture(), checkpoints: unknown[] = [];
    boundary.save.mockImplementation(async () => { writeFileSync(fixture.dependency, "changed after save"); return "snapshot-1"; });
    await expect(runProjectionV2ForDate(date(), options(fixture, checkpoints))).rejects.toThrow("artifact changed");
    expect(boundary.save).toHaveBeenCalledOnce();
    expect(checkpoints.at(-1)).toEqual({ phase: "before_publish", runId: "run-1", inputSnapshotId: "snapshot-1" });
    expect(boundary.publish).not.toHaveBeenCalled();
  });

  it("issues unchanged pinned output and preserves known identities on a lost publication response", async () => {
    const fixture = artifactFixture(), checkpoints: unknown[] = [];
    expect(await runProjectionV2ForDate(date(), options(fixture, checkpoints))).toMatchObject({
      runId: "run-1", inputSnapshotId: "snapshot-1", publishedGames: 1 });
    expect(checkpoints).toEqual([{ phase: "before_run" }, { phase: "reserved", runId: "run-1" },
      { phase: "before_snapshot", runId: "run-1" }, { phase: "before_publish", runId: "run-1", inputSnapshotId: "snapshot-1" }]);
    boundary.publish.mockRejectedValue(new Error("publication response lost"));
    await expect(runProjectionV2ForDate(date(), options(fixture, checkpoints))).rejects.toThrow("publication response lost");
    expect(checkpoints.at(-1)).toEqual({ phase: "before_publish", runId: "run-1", inputSnapshotId: "snapshot-1" });
    expect(boundary.publish).toHaveBeenCalledTimes(2);
  });
});

// Opt in with the installed PostgreSQL bin directory. No TCP/hosted URL is used:
// every run creates and stops its own private server, socket and empty database.
describe.runIf(Boolean(process.env.FORGE_POSTGRES_BIN))("local FORGE PostgreSQL fencing", () => {
  const bin = process.env.FORGE_POSTGRES_BIN!;
  const code = `local:${"a".repeat(64)}`;
  // Do not let inherited libpq service/host/option settings redirect fixture commands.
  const fixtureEnv: NodeJS.ProcessEnv = { ...process.env };
  for (const name of Object.keys(fixtureEnv)) if (name.startsWith("PG")) delete fixtureEnv[name];
  let root: string, socket: string, started = false;
  const args = () => ["-h", socket, "-p", "65439", "-U", "forge_test", "-d", "fhfh_forge_fence_fixture", "-v", "ON_ERROR_STOP=1", "-qAt"];
  const sql = async (query: string) => (await exec(join(bin, "psql"), [...args(), "-c", query], { env: fixtureEnv })).stdout.trim();
  const serviceSql = (query: string) => sql(`set role service_role; ${query}`);
  const begin = (id: string, game: number, lease = 600000, expected: string | null = null, version = code) =>
    `select public.begin_forge_local_run('${id}',current_date+1,${game},'${version}',${expected ? `'${expected}'` : "null"},${lease})`;
  const inspect = async (id: string) => JSON.parse(await serviceSql(`select public.inspect_forge_local_attempt('${id}')`));
  const prepare = async (run: string, game: number, version = code) => sql(`select fhfh_internal.fixture_prepare_forge('${run}',${game},'${version}')`);
  const publish = (run: string, snapshot: string) => serviceSql(`select public.publish_forge_game_revisions('${run}','${snapshot}')`);
  function transaction(query: string, marker: string) {
    const child = spawn(join(bin, "psql"), args(), { env: fixtureEnv });
    let stdout = "", stderr = "";
    let readyResolve: () => void, readyReject: (error: Error) => void;
    const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    child.stdout.on("data", data => { stdout += data; if (stdout.includes(marker)) readyResolve(); });
    child.stderr.on("data", data => { stderr += data; });
    const done = new Promise<string>((resolve, reject) => {
      child.on("error", error => { readyReject(error); reject(error); });
      child.on("exit", status => {
        if (status !== 0) { const error = new Error(stderr); readyReject(error); reject(error); }
        else { if (!stdout.includes(marker)) readyReject(new Error("Missing transaction checkpoint")); resolve(stdout); }
      });
    });
    // Separate stdin statements expose checkpoints before the transaction ends;
    // a single -c multi-statement command buffers results until after COMMIT.
    child.stdin.end(query.replace(/;/g, ";\n"));
    return { ready, done };
  }
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "fhfh-forge-pg-"));
    socket = join(root, "socket"); mkdirSync(socket, { mode: 0o700 });
    await exec(join(bin, "initdb"), ["-D", join(root, "data"), "--no-locale", "--encoding=UTF8",
      "--auth-local=trust", "--auth-host=reject", "-U", "forge_test",
      ...(existsSync(join(bin, "../share/postgresql/postgres.bki")) ? ["-L", join(bin, "../share/postgresql")] : [])], { env: fixtureEnv });
    await exec(join(bin, "pg_ctl"), ["-D", join(root, "data"), "-l", join(root, "server.log"), "-w", "-t", "10",
      "-o", `-c listen_addresses='' -c unix_socket_directories='${socket}' -c fhfh.fixture=forge-local-execution-v1 -p 65439`, "start"], { env: fixtureEnv });
    started = true;
    await exec(join(bin, "createdb"), ["-h", socket, "-p", "65439", "-U", "forge_test", "fhfh_forge_fence_fixture"], { env: fixtureEnv });
    await exec(join(bin, "psql"), [...args(), "-f", join(__dirname, "../../supabase/tests/forge_local_execution.sql")], { env: fixtureEnv });
  }, 20000);
  afterAll(async () => {
    if (started) await exec(join(bin, "pg_ctl"), ["-D", join(root, "data"), "-w", "-t", "10", "stop", "-m", "fast"], { env: fixtureEnv });
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("keeps immutable ownership after metrics replacement and rejects legacy overlapping work", async () => {
    const id = randomUUID();
    const receipt = JSON.parse(await serviceSql(begin(id, 9001)));
    expect(receipt).toMatchObject({ operationId: id, reservation: "new", state: "active", expectedRevisionId: null });
    const replay = JSON.parse(await serviceSql(begin(id, 9001)));
    expect(replay).toMatchObject({ runId: receipt.runId, reservation: "existing" });
    await sql(`update public.forge_runs set status='succeeded',metrics='{}' where run_id='${receipt.runId}'`);
    await expect(serviceSql(`select public.begin_forge_game_run(current_date+1,array[9001]::bigint[],'legacy')`)).rejects.toThrow("owns this scope");
    await expect(serviceSql(`insert into public.forge_runs(as_of_date,status) values(current_date+1,'running')`)).rejects.toThrow("owns this scope");
    expect(await serviceSql(`select public.begin_forge_game_run(current_date+1,array[9002]::bigint[],'legacy')`)).toMatch(/^[a-f0-9-]{36}$/);
    await expect(serviceSql(begin(id, 9003))).rejects.toThrow("immutable intent");
    await expect(serviceSql(begin(id, 9001, 600000, null, `local:${"b".repeat(64)}`))).rejects.toThrow("immutable intent");
    await expect(sql(`update public.player_forecast_source_observations set payload='{}' where id='${id}'`)).rejects.toThrow("IMMUTABLE_RECORD");
    expect(await sql(`select payload_hash=encode(sha256(convert_to(payload::text,'UTF8')),'hex') from public.player_forecast_source_observations where id='${id}'`)).toBe("t");
    expect(await sql("select count(*) from public.forge_game_update_queue")).toBe("0");
  });

  it("isolates service-role fencing and preserves existing private ACLs and attached guards", async () => {
    const schema = JSON.parse(await sql(`select jsonb_build_object(
      'serviceUsage',has_schema_privilege('service_role','forge_execution_internal','USAGE'),
      'serviceCreate',has_schema_privilege('service_role','forge_execution_internal','CREATE'),
      'oldUsage',has_schema_privilege('service_role','fhfh_internal','USAGE'),
      'anonUsage',has_schema_privilege('anon','forge_execution_internal','USAGE'),
      'authenticatedUsage',has_schema_privilege('authenticated','forge_execution_internal','USAGE'))`));
    expect(schema).toEqual({ serviceUsage: true, serviceCreate: false, oldUsage: false,
      anonUsage: false, authenticatedUsage: false });
    const matrix = JSON.parse(await sql(`select jsonb_agg(jsonb_build_object(
      'signature',p.oid::regprocedure::text,'trigger',p.prorettype='trigger'::regtype,
      'serviceExecute',has_function_privilege('service_role',p.oid,'EXECUTE'),
      'anonExecute',has_function_privilege('anon',p.oid,'EXECUTE'),
      'authenticatedExecute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
      'securityDefiner',p.prosecdef,'config',p.proconfig,
      'bodySha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')) order by p.oid::regprocedure::text)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='forge_execution_internal' or (n.nspname='public'
        and p.proname in ('begin_forge_local_run','inspect_forge_local_attempt'))`));
    expect(matrix).toHaveLength(6);
    for (const fn of matrix) {
      expect(fn).toMatchObject({ serviceExecute: !fn.trigger, anonExecute: false,
        authenticatedExecute: false, securityDefiner: false, config: ['search_path=""'] });
    }
    const oldAclUnchanged = await sql(`select b.schema_acl is not distinct from n.nspacl::text
      and b.functions=(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'acl',p.proacl::text,
        'owner',p.proowner,'securityDefiner',p.prosecdef,'config',p.proconfig,'body',p.prosrc)
        order by p.oid::regprocedure::text) from pg_proc p where p.pronamespace=n.oid
          and p.proname<>'fixture_prepare_forge')
      from public.forge_fence_fixture_acl_baseline b join pg_namespace n on n.nspname='fhfh_internal'`);
    expect(oldAclUnchanged).toBe("t");
    console.info("FORGE_FENCE_PERMISSION_RECEIPT", JSON.stringify({ schema, matrix, oldAclUnchanged: true }));

    for (const query of [
      "select fhfh_internal.current_starter_board_revisions(current_date+1)",
      "select fhfh_internal.enqueue_starter_board_game(9010,1,clock_timestamp(),clock_timestamp())",
    ]) await expect(serviceSql(query)).rejects.toThrow("permission denied for schema fhfh_internal");
    for (const name of ["guard_forge_local_reservation", "guard_forge_local_publication"]) {
      await expect(serviceSql(`select forge_execution_internal.${name}()`)).rejects.toThrow("permission denied for function");
    }
    const id = randomUUID(), attempt = JSON.parse(await serviceSql(begin(id, 9010)));
    expect(await inspect(id)).toMatchObject({ state: "active", runId: attempt.runId });
    expect(await sql("select count(*) from public.forge_game_update_queue where game_id=9010")).toBe("0");
    for (const role of ["anon", "authenticated"]) {
      await expect(sql(`set role ${role}; select public.inspect_forge_local_attempt('${id}')`)).rejects.toThrow("permission denied");
      await expect(sql(`set role ${role}; ${begin(randomUUID(), 9010)}`)).rejects.toThrow("permission denied");
    }
    const snapshot = await prepare(attempt.runId, 9010);
    await sql(`update public.forge_runs set metrics=jsonb_build_object('started_at','fixture-start','finished_at','fixture-finish')
      where run_id='${attempt.runId}'`);
    expect(await publish(attempt.runId, snapshot)).toBe("1");
    expect(JSON.parse(await serviceSql(`select payload from public.forge_game_revisions where run_id='${attempt.runId}'`)))
      .toMatchObject({ queueLease: null, calculationStartedAt: "fixture-start", calculationCompletedAt: "fixture-finish" });
    await expect(sql(`update public.forge_game_revisions set payload='{}' where run_id='${attempt.runId}'`))
      .rejects.toThrow("IMMUTABLE_RECORD");
    expect(await publish(attempt.runId, snapshot)).toBe("0");
  });

  it("rejects expired writers and wrong artifacts while preserving normal publication and replay", async () => {
    const id = randomUUID(), old = JSON.parse(await serviceSql(begin(id, 9003, 100)));
    const oldSnapshot = await prepare(old.runId, 9003);
    await sql("select pg_sleep(0.15)");
    expect(await inspect(id)).toMatchObject({ state: "expired", revisionId: null });
    expect(JSON.parse(await serviceSql(begin(id, 9003, 100)))).toMatchObject({ reservation: "existing", state: "expired" });
    await expect(publish(old.runId, oldSnapshot)).rejects.toThrow("Expired or incompatible");
    const nextId = randomUUID(), next = JSON.parse(await serviceSql(begin(nextId, 9003)));
    await expect(publish(old.runId, oldSnapshot)).rejects.toThrow("owns publication");
    const snapshot = await prepare(next.runId, 9003);
    expect(await publish(next.runId, snapshot)).toBe("1");
    expect(await publish(next.runId, snapshot)).toBe("0");
    expect(await inspect(nextId)).toMatchObject({ state: "issued", inputSnapshotId: snapshot });
    await sql(`update public.forge_runs set status='failed',metrics='{}' where run_id='${next.runId}'`);
    expect(await inspect(nextId)).toMatchObject({ state: "issued", inputSnapshotId: snapshot, runStatus: "failed" });
    await expect(serviceSql(begin(randomUUID(), 9003))).rejects.toThrow("prior revision changed");
    const wrong = JSON.parse(await serviceSql(begin(randomUUID(), 9004)));
    const wrongSnapshot = await prepare(wrong.runId, 9004, `local:${"b".repeat(64)}`);
    await expect(publish(wrong.runId, wrongSnapshot)).rejects.toThrow("incompatible local FORGE");
    const legacy = await serviceSql(`select public.begin_forge_game_run(current_date+1,array[9005]::bigint[],'legacy')`);
    const legacySnapshot = await prepare(legacy, 9005, "legacy");
    await serviceSql(begin(randomUUID(), 9005));
    await expect(publish(legacy, legacySnapshot)).rejects.toThrow("owns publication");
  });

  it("normalizes only timing-trigger fields for replay and preserves input, model and lease guards", async () => {
    const id = randomUUID(), attempt = JSON.parse(await serviceSql(begin(id, 9011, 1200)));
    const snapshot = await prepare(attempt.runId, 9011);
    expect(await publish(attempt.runId, snapshot)).toBe("1");
    const original = await serviceSql(`select payload from public.forge_game_revisions where run_id='${attempt.runId}'`);
    const replay = (payload: string) => serviceSql(`with inserted as (
      insert into public.forge_game_revisions(run_id,game_id,slate_date,input_snapshot_id,decision_as_of,payload)
      select run_id,game_id,slate_date,input_snapshot_id,decision_as_of,${payload}
        from public.forge_game_revisions r where run_id='${attempt.runId}'
      on conflict(run_id,game_id) do nothing returning id) select count(*) from inserted`);
    const forgedTiming = `jsonb_build_object('queueLease',jsonb_build_object('owner','forged','version',999),
      'calculationStartedAt',jsonb_build_array('forged-start'),'calculationCompletedAt',false)`;
    expect(await replay(`r.payload || ${forgedTiming}`)).toBe("0");
    for (const changed of [
      "jsonb_set(r.payload,'{players,0,player_id}','999'::jsonb)",
      "r.payload || jsonb_build_object('modelMode','changed-model')",
      "r.payload || jsonb_build_object('codeVersion','changed-code')",
      "r.payload || jsonb_build_object('inputProvenance',jsonb_build_object('queueLease','changed-source'))",
      "r.payload || jsonb_build_object('inputCutoff','changed-cutoff')",
    ]) await expect(replay(`${changed} || ${forgedTiming}`)).rejects.toThrow(/superseded|incompatible/);
    await sql(`update public.forge_runs set metrics=jsonb_build_object('started_at','replacement-start','finished_at','replacement-finish')
      where run_id='${attempt.runId}'`);
    expect(await publish(attempt.runId, snapshot)).toBe("0");
    await sql("select pg_sleep(1.25)");
    expect(await inspect(id)).toMatchObject({ state: "issued" });
    expect(await publish(attempt.runId, snapshot)).toBe("0");
    expect(await replay(`r.payload || ${forgedTiming}`)).toBe("0");
    await expect(replay(`r.payload || jsonb_build_object('modelMode','expired-model') || ${forgedTiming}`))
      .rejects.toThrow("Expired or incompatible");

    // The queue guard authorizes from run metrics, not the caller's payload copy.
    await sql(`update public.forge_runs set metrics=jsonb_build_object('board_lease',
      jsonb_build_object('owner','${randomUUID()}','version',999)) where run_id='${attempt.runId}'`);
    await expect(replay(`r.payload || ${forgedTiming}`)).rejects.toThrow("Expired worker cannot publish");
    expect(await serviceSql(`select payload from public.forge_game_revisions where run_id='${attempt.runId}'`)).toBe(original);
    expect(await serviceSql(`select count(*) from public.forge_game_revisions where run_id='${attempt.runId}'`)).toBe("1");

    // A fresh direct publication cannot persist forged operational fields either.
    const direct = JSON.parse(await serviceSql(begin(randomUUID(), 9012)));
    const directSnapshot = await prepare(direct.runId, 9012);
    await serviceSql(`insert into public.forge_game_revisions(run_id,game_id,slate_date,input_snapshot_id,decision_as_of,payload)
      values('${direct.runId}',9012,current_date+1,'${directSnapshot}',clock_timestamp(),
        jsonb_build_object('codeVersion','${code}','modelMode','fixture-direct','inputProvenance','fixture-source') || ${forgedTiming})`);
    expect(JSON.parse(await serviceSql(`select payload from public.forge_game_revisions where run_id='${direct.runId}'`)))
      .toEqual({ codeVersion: code, modelMode: "fixture-direct", inputProvenance: "fixture-source",
        queueLease: null, calculationStartedAt: null, calculationCompletedAt: null });
  });

  it("serializes a committed reservation with a lost response by the same operation identity", async () => {
    const id = randomUUID();
    const first = transaction(`begin; set local role service_role; ${begin(id, 9006)}; select 'reservation-open'; select pg_sleep(0.3); commit;`, "reservation-open");
    await first.ready;
    const replay = serviceSql(begin(id, 9006));
    const competing = serviceSql(begin(randomUUID(), 9006)).then(() => new Error("Unexpected competing reservation"), error => error as Error);
    await first.done;
    expect(JSON.parse(await replay)).toMatchObject({ operationId: id, reservation: "existing", state: "active" });
    expect((await competing).message).toContain("owns this scope");
    expect(await sql(`select count(*) from public.player_forecast_source_observations where id='${id}'`)).toBe("1");
    expect(await sql(`select count(*) from public.forge_runs where run_id=(select entity_key::uuid from public.player_forecast_source_observations where id='${id}')`)).toBe("1");
  });

  it("preserves successful-run, accepted-news and pregame publication gates", async () => {
    const attempt = JSON.parse(await serviceSql(begin(randomUUID(), 9008)));
    const snapshot = await prepare(attempt.runId, 9008);
    await sql(`update public.forge_runs set status='failed',metrics='{}' where run_id='${attempt.runId}'`);
    await expect(publish(attempt.runId, snapshot)).rejects.toThrow("Only completed runs");
    await sql(`update public.forge_runs set status='succeeded',metrics='{}' where run_id='${attempt.runId}'`);
    await sql("select fhfh_internal.enqueue_starter_board_game(9008,1,clock_timestamp(),clock_timestamp())");
    await expect(publish(attempt.runId, snapshot)).rejects.toThrow("newer accepted evidence");
    expect(await sql("select count(*) from public.forge_game_revisions where game_id=9008")).toBe("0");
    await sql("update public.games set \"startTime\"=clock_timestamp()-interval '1 second' where id=9008");
    expect(await publish(attempt.runId, snapshot)).toBe("0");
  });

  it("keeps negative expired readback unresolved while a publication transaction may still commit", async () => {
    const id = randomUUID(), attempt = JSON.parse(await serviceSql(begin(id, 9007, 700)));
    const snapshot = await prepare(attempt.runId, 9007);
    const pending = transaction(`begin; set local role service_role; select public.publish_forge_game_revisions('${attempt.runId}','${snapshot}');
      select 'publication-open'; select pg_sleep(1.5); commit;`, "publication-open");
    await pending.ready;
    const retry = serviceSql(begin(randomUUID(), 9007)).then(() => new Error("Unexpected successful retry"), error => error as Error);
    await sql("select pg_sleep(0.8)");
    expect(await inspect(id)).toMatchObject({ state: "expired", revisionId: null });
    await pending.done; expect((await retry).message).toContain("prior revision changed");
    expect(await inspect(id)).toMatchObject({ state: "issued", inputSnapshotId: snapshot });
    expect(await sql("select count(*) from public.forge_game_revisions where game_id=9007")).toBe("1");
  });
});
