import { createHash } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { loadEnvConfig } from "@next/env";
import { acquireForgeLocalOwnership, ForgeLocalOwnershipError, forgeLocalOwnershipRoot, inspectForgeLocalOwnership } from "./forge-local-ownership";
import { awaitForgeCalendarGrant } from "./forge-calendar-ledger";
import type { RunProjectionOptions, RunProjectionResult } from "../lib/projections/types/run-forge-projections.types";
import type { ForgeIssuedContextV1 } from "../lib/projections/issuedContext";
import type { buildForgeCalendarManifest } from "./run-forge-calendar-local";

// Use the same Node/ts-node entry point for preview and write; see web/README.md.
const usage = "Usage: run-forge-local.ts --date YYYY-MM-DD --game-id ID --out PRIVATE_NEW_DIRECTORY [--write --artifact REVIEWED_CODE_JSON] [--refresh] [--reconcile OPERATION_UUID [--reconcile-failed-snapshot]] [--operation-id UUID --expected-revision UUID|none] [--max-requests 1..10000] [--max-writes 1..2000] [--runtime-ms 1..600000] [--request-timeout-ms 1..60000]";
type Options = { date: string; gameId: number; out: string; write: boolean; refresh: boolean; artifact?: string; calendarScope?: string;
  reconcile?: string; reconcileFailedSnapshot?: boolean; operationId?: string; expectedRevisionId?: string | null;
  maxRequests: number; maxWrites: number; runtimeMs: number; requestTimeoutMs: number };

export function parseArgs(argv: string[]): Options {
  if (argv.includes("--help")) { console.log(usage); process.exit(0); }
  const values = new Map<string, string>();
  let write = false, refresh = false, reconcileFailedSnapshot = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--write" || arg === "--refresh" || arg === "--reconcile-failed-snapshot") {
      if (arg === "--write") write = true;
      else if (arg === "--refresh") refresh = true;
      else reconcileFailedSnapshot = true;
    } else if (["--date", "--game-id", "--out", "--artifact", "--calendar-scope", "--reconcile", "--operation-id", "--expected-revision",
      "--max-requests", "--max-writes", "--runtime-ms", "--request-timeout-ms"].includes(arg) && argv[i + 1] && !argv[i + 1].startsWith("--")) {
      if (values.has(arg)) throw new Error(usage);
      values.set(arg, argv[++i]);
    } else throw new Error(usage);
  }
  const date = values.get("--date") ?? "";
  const rawId = values.get("--game-id") ?? "";
  const out = values.get("--out") ?? "";
  const parsedDate = new Date(`${date}T00:00:00Z`);
  const reconcile = values.get("--reconcile");
  const operationId = values.get("--operation-id"), expected = values.get("--expected-revision");
  const uuid = (value: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime())
    || parsedDate.toISOString().slice(0, 10) !== date
    || !/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(Number(rawId)) || !out || refresh && !write
    || operationId && (!write || !uuid(operationId) || expected === undefined)
    || expected !== undefined && (!operationId || expected !== "none" && !uuid(expected))
    || values.has("--calendar-scope") && (!write || !operationId)
    || reconcile && (!uuid(reconcile) || write || refresh || operationId || values.has("--artifact"))
    || reconcileFailedSnapshot && !reconcile) {
    throw new Error(usage);
  }
  const bound = (key: string, fallback: number, max: number) => {
    const raw = values.get(key) ?? String(fallback);
    if (!/^[1-9]\d*$/.test(raw) || Number(raw) > max) throw new Error(usage);
    return Number(raw);
  };
  return { date, gameId: Number(rawId), out: resolve(out), write, refresh,
    ...(reconcile ? { reconcile } : {}),
    ...(reconcileFailedSnapshot ? { reconcileFailedSnapshot } : {}),
    ...(operationId ? { operationId, expectedRevisionId: expected === "none" ? null : expected } : {}),
    maxRequests: bound("--max-requests", 1000, 10000),
    maxWrites: bound("--max-writes", 100, 2000), runtimeMs: bound("--runtime-ms", 150000, 600000),
    requestTimeoutMs: bound("--request-timeout-ms", 10000, 60000),
    ...(values.has("--artifact") ? { artifact: resolve(values.get("--artifact")!) } : {}),
    ...(values.has("--calendar-scope") ? { calendarScope: resolve(values.get("--calendar-scope")!) } : {}) };
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function assertReviewedForgeCalendarIssuedContext(game: Awaited<ReturnType<typeof buildForgeCalendarManifest>>["games"][number],
  contexts: ForgeIssuedContextV1[], now = Date.now()) {
  const context = contexts.find(row => row.game.id === game.gameId);
  if (!context || contexts.length !== 1 || context.game.seasonId !== game.seasonId || context.game.date !== game.slateDate
    || Date.parse(context.game.startTime) !== Date.parse(game.scheduledStartAt) || Date.parse(context.game.startTime) <= now
    || game.sides.length !== 2 || context.schedule.length !== 2
    || game.sides.some(side => !context.schedule.some(row => row.teamId === side.teamId
      && row.opponentTeamId === side.opponentTeamId && row.revision === side.scheduleRevision))
    || game.required.some(required => !context.roster.some(row => String(row.canonicalId) === required.playerId
      && row.nhlId === required.nhlPlayerId && row.teamId === required.teamId && row.revision === required.rosterRevision))) {
    throw new Error("Captured context changed from the reviewed calendar intent.");
  }
}

export function captureLocalForgeArtifact(repo: string, modelEnvironment: Record<string, string | null>,
  loadedFiles = Object.keys(require.cache)) {
  const tsNode = (process as any)[Symbol.for("ts-node.register.instance")];
  const unsigned = { version: "forge-local-artifact-v1" as const,
    files: [...new Set(loadedFiles)].sort().map(path => ({
      path: path.startsWith(`${repo}${sep}`) ? relative(repo, path) : path,
      sha256: sha256(new Uint8Array(readFileSync(path))),
    })),
    packageLockHash: sha256(new Uint8Array(readFileSync(resolve(repo, "web/package-lock.json")))),
    tsconfigHash: sha256(new Uint8Array(readFileSync(resolve(repo, "web/tsconfig.json")))),
    nodeVersion: process.version, nodeBinaryHash: sha256(new Uint8Array(readFileSync(process.execPath))),
    executionArgs: [...process.execArgv], compilerOptions: tsNode?.config?.options ?? null,
    transpileOnly: tsNode?.options?.transpileOnly ?? null, modelEnvironment: { ...modelEnvironment },
    ownershipDirectory: forgeLocalOwnershipRoot(process.env.FORGE_LOCAL_OWNERSHIP_DIR) };
  return { ...unsigned, codeVersion: `local:${sha256(JSON.stringify(unsigned))}` };
}

type LocalForgeArtifact = ReturnType<typeof captureLocalForgeArtifact>;
export class LocalForgeArtifactError extends Error {
  constructor() { super("Local FORGE artifact changed or does not match the reviewed pin; issuance withheld."); }
}
export function verifyLocalForgeArtifact(artifact: LocalForgeArtifact, repo: string,
  modelEnvironment: Record<string, string | null>, loadedFiles = Object.keys(require.cache)): void {
  try {
    if (JSON.stringify(artifact) !== JSON.stringify(captureLocalForgeArtifact(repo, modelEnvironment, loadedFiles))) {
      throw new LocalForgeArtifactError();
    }
  } catch { throw new LocalForgeArtifactError(); }
}

function privateDirectory(path: string): void {
  const repo = realpathSync(resolve(__dirname, "../.."));
  if (existsSync(path)) throw new Error("Receipt directory already exists; choose a new private directory.");
  const parent = realpathSync(resolve(path, ".."));
  if (parent === repo || parent.startsWith(`${repo}${sep}`)) throw new Error("Private receipts must be outside the repository.");
  mkdirSync(path, { mode: 0o700 });
}

function save(path: string, name: string, value: unknown): void {
  writeFileSync(resolve(path, name), JSON.stringify(value, null, 2), { flag: "wx", mode: 0o600 });
}

export type RequestCounts = { reads: number; writes: number; readMs: number; writeMs: number;
  acknowledgedWrites: number; rejectedWrites: number; unknownWrites: number };
export type ForgeWriteAttempt = { resource: string; index: number; payloadHash: string | null;
  method: string; payloadBytes: number | null };
export type ForgeWriteReceipt = ForgeWriteAttempt & { outcome: "not_attempted" | "acknowledged" | "rejected" | "unknown";
  responseStatus: number | null; durationMs: number;
  transport?: { effectiveTimeoutMs: number | null; headersMs: number | null; headersStatus: number | null;
    bodyMs: number | null; responseBytes: number | null; requestId: string | null;
    failurePhase: "waiting_for_headers" | "reading_body" | null } };
export type ForgeTransportBounds = { deadlineMs: number; requestTimeoutMs: number; maxWrites: number;
  maxRequests?: number;
  beforeWrite?: (attempt: ForgeWriteAttempt) => void; afterWrite?: (receipt: ForgeWriteReceipt) => void };
export async function guardedForgeFetch(input: RequestInfo | URL, init: RequestInit | undefined,
  origin: string, allowWrite: boolean, transport: typeof fetch, requests: RequestCounts, bounds?: ForgeTransportBounds): Promise<Response> {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const rpc = url.pathname.startsWith("/rest/v1/rpc/") ? url.pathname.slice("/rest/v1/rpc/".length) : null;
  if (url.origin !== origin || !url.pathname.startsWith("/rest/v1/")
    || rpc && !["begin_forge_game_run", "begin_forge_local_run", "inspect_forge_local_attempt", "publish_forge_game_revisions"].includes(rpc)
    || !["GET", "HEAD", "POST", "PATCH"].includes(method)
    || !allowWrite && !["GET", "HEAD"].includes(method)) {
    throw new Error("Local FORGE transport rejected a request.");
  }
  const write = !["GET", "HEAD"].includes(method);
  const started = Date.now();
  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  if (signal?.aborted) throw new Error("Local FORGE request cancelled before transport.");
  if (bounds && (started >= bounds.deadlineMs || write && requests.writes >= bounds.maxWrites
    || bounds.maxRequests !== undefined && requests.reads + requests.writes >= bounds.maxRequests)) {
    throw new Error("Local FORGE transport budget exhausted.");
  }
  const attempt: ForgeWriteAttempt = { resource: url.pathname, index: requests.writes + 1,
    payloadHash: typeof init?.body === "string" ? sha256(init.body) : null, method,
    payloadBytes: typeof init?.body === "string" ? Buffer.byteLength(init.body) : null };
  if (write) bounds?.beforeWrite?.(attempt);
  // A flushed journal can consume the remaining budget. Never send after it expires.
  if (signal?.aborted || bounds && Date.now() >= bounds.deadlineMs) {
    if (write) bounds?.afterWrite?.({ ...attempt, outcome: "not_attempted", responseStatus: null, durationMs: Date.now() - started });
    throw new Error(signal?.aborted ? "Local FORGE request cancelled before transport." : "Local FORGE transport budget exhausted.");
  }
  if (write) requests.writes++; else requests.reads++;
  const controller = new AbortController();
  let abort: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let outcome: ForgeWriteReceipt["outcome"] = "unknown";
  let responseStatus: number | null = null;
  const diagnostics: NonNullable<ForgeWriteReceipt["transport"]> = { effectiveTimeoutMs: null, headersMs: null,
    headersStatus: null, bodyMs: null, responseBytes: null, requestId: null, failurePhase: "waiting_for_headers" };
  let completed = false;
  try {
    const interrupted = bounds || signal ? new Promise<never>((_, reject) => {
      abort = () => { controller.abort(); reject(new Error("Local FORGE request cancelled.")); };
      signal?.addEventListener("abort", abort, { once: true });
      if (bounds) timer = setTimeout(() => {
        controller.abort(); reject(new Error("Local FORGE request deadline exceeded."));
      }, diagnostics.effectiveTimeoutMs = Math.max(0, Math.min(bounds.requestTimeoutMs, bounds.deadlineMs - Date.now())));
    }) : null;
    const work = (async () => {
      const response = await transport(input, { ...init, redirect: "error", signal: controller.signal });
      // A late response must not mutate diagnostics after the durable receipt was emitted.
      if (completed) return response;
      diagnostics.headersMs = Date.now() - started;
      diagnostics.headersStatus = response.status;
      const requestId = response.headers.get("sb-request-id") ?? response.headers.get("x-request-id");
      diagnostics.requestId = requestId && /^[a-zA-Z0-9._:-]{1,128}$/.test(requestId) ? requestId : null;
      diagnostics.failurePhase = "reading_body";
      // Include body receipt in the budget; returning headers alone leaves SDK parsing unbounded.
      if (!bounds) return response;
      const bodyStarted = Date.now();
      const body = await response.arrayBuffer();
      if (!completed) {
        diagnostics.bodyMs = Date.now() - bodyStarted;
        diagnostics.responseBytes = body.byteLength;
      }
      return new Response(body.byteLength ? body : null, { status: response.status, statusText: response.statusText, headers: response.headers });
    })();
    const response = interrupted ? await Promise.race([work, interrupted]) : await work;
    responseStatus = response.status;
    outcome = response.ok ? "acknowledged" : response.status >= 400 && response.status < 500 ? "rejected" : "unknown";
    diagnostics.failurePhase = null;
    return response;
  } finally {
    completed = true;
    if (timer) clearTimeout(timer);
    if (abort) signal?.removeEventListener("abort", abort);
    if (write) {
      if (outcome === "acknowledged") requests.acknowledgedWrites++;
      else if (outcome === "rejected") requests.rejectedWrites++;
      else requests.unknownWrites++;
      requests.writeMs += Date.now() - started;
      bounds?.afterWrite?.({ ...attempt, outcome, responseStatus, durationMs: Date.now() - started,
        transport: { ...diagnostics } });
    }
    else requests.readMs += Date.now() - started;
  }
}

async function readLocalForgeIssuance(db: any, identity: { date: string; gameId: number; codeVersion: string;
  runId: string; inputSnapshotId: string }) {
  const { projectionInputHash } = await import("../lib/projections/inputCapture");
  const { data: observation, error: observationError } = await db.from("player_forecast_source_observations")
    .select("id,payload,payload_hash").eq("id", identity.inputSnapshotId).single();
  const captured = observation?.payload;
  if (observationError || observation?.id !== identity.inputSnapshotId || !captured
    || captured.version !== "forge-inputs-v1" || captured.runId !== identity.runId || captured.codeVersion !== identity.codeVersion
    || captured.slateDate !== identity.date || captured.horizonGames !== 1 || captured.replayClassification !== "captured_live"
    || !Array.isArray(captured.gameIds) || captured.gameIds.length !== 1 || captured.gameIds[0] !== identity.gameId
    || projectionInputHash(captured) !== observation.payload_hash) throw new Error("Captured input observation could not be verified.");
  const { data: revisions, error: outputError } = await db.from("forge_game_revisions")
    .select("id,game_id,run_id,input_snapshot_id,payload,published_at").eq("run_id", identity.runId).eq("game_id", identity.gameId);
  if (outputError || !Array.isArray(revisions) || revisions.some((row: any) => row.run_id !== identity.runId
    || Number(row.game_id) !== identity.gameId || row.input_snapshot_id !== identity.inputSnapshotId
    || row.payload?.codeVersion !== identity.codeVersion
    || projectionInputHash(row.payload?.inputProvenance) !== projectionInputHash(captured.inputProvenance))) {
    throw new Error("Issued revision does not match the captured local execution.");
  }
  return { observation, revisions };
}

async function main() {
  await awaitForgeCalendarGrant();
  const options = parseArgs(process.argv.slice(2));
  const absolute = process.env.FORGE_CALENDAR_DEADLINE_AT;
  if (absolute && (!process.env.FORGE_CALENDAR_START_TOKEN || !Number.isFinite(Date.parse(absolute)))) {
    throw new Error("Calendar deadline requires a supervised start grant.");
  }
  const startedAt = Date.now(), deadlineMs = Math.min(startedAt + options.runtimeMs, absolute ? Date.parse(absolute) : Infinity);
  const execution = { startedAt: new Date(startedAt).toISOString(), limits: {
    maxRequests: options.maxRequests, maxWrites: options.maxWrites, runtimeMs: options.runtimeMs, requestTimeoutMs: options.requestTimeoutMs } };
  privateDirectory(options.out);
  receiptDirectory = options.out;
  loadEnvConfig(resolve(__dirname, ".."), true, { info() {}, error() {} });
  const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  if (!origin.startsWith("https://") && !origin.startsWith("http://localhost:")) throw new Error("Invalid Supabase origin.");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase service key is unavailable.");
  process.env.STARTER_BOARD_CAPTURE_ENABLED = "true";
  process.env.STARTER_BOARD_COMPUTE_ENABLED = "true";
  process.env.STARTER_BOARD_SERVING_ENABLED = "false";
  process.env.STARTER_BOARD_SCHEDULER_ENABLED = "false";
  process.env.STARTER_BOARD_CHALLENGER_ENABLED = "false";
  process.env.STARTER_BOARD_CANARY_GAME_IDS = String(options.gameId);

  const fetchOriginal = globalThis.fetch;
  const requests: RequestCounts = { reads: 0, writes: 0, readMs: 0, writeMs: 0,
    acknowledgedWrites: 0, rejectedWrites: 0, unknownWrites: 0 };
  setupReceipt = { requests, ...execution };
  const ownershipRoot = forgeLocalOwnershipRoot(process.env.FORGE_LOCAL_OWNERSHIP_DIR);
  let checkpoint: Parameters<NonNullable<RunProjectionOptions["executionGuard"]>["verify"]>[0] = { phase: "before_run" };
  let journalScope: unknown;
  let journalCodeVersion: string | undefined;
  const journal = (entry: unknown) => {
    const fd = openSync(resolve(options.out, "attempts.jsonl"), "a", 0o600);
    try { writeFileSync(fd, `${JSON.stringify({ ...execution, ownership: ownership?.reference, at: new Date().toISOString(), scope: journalScope,
      codeVersion: journalCodeVersion, checkpoint, entry })}\n`); fsyncSync(fd); } finally { closeSync(fd); }
  };
  globalThis.fetch = (input, init) => guardedForgeFetch(input, init, origin, options.write, fetchOriginal, requests,
    { deadlineMs, requestTimeoutMs: options.requestTimeoutMs, maxWrites: options.maxWrites,
      maxRequests: options.maxRequests,
      beforeWrite: attempt => { ownership?.beforeWrite(); journal({ kind: "write_attempt", ...attempt }); },
      afterWrite: receipt => journal({ kind: "write_receipt", ...receipt }) });

  if (options.write) {
    ownership = acquireForgeLocalOwnership({ origin, gameId: options.gameId, receiptDirectory: options.out,
      root: ownershipRoot, operationId: options.operationId });
    setupReceipt.ownership = ownership.reference;
    journal({ kind: "ownership_acquired", ...ownership.reference });
  }

  const db = (await import("../lib/supabase/server")).default as any;
  if (options.reconcile) {
    const scope = { date: options.date, gameId: options.gameId, operationId: options.reconcile };
    setupReceipt.scope = scope;
    const { data: attempt, error } = await db.rpc("inspect_forge_local_attempt",
      { p_operation_id: options.reconcile }, { get: true });
    if (error) throw new Error("Local FORGE attempt could not be inspected.");
    if (attempt && (attempt.version !== "forge-local-attempt-v1" || attempt.operationId !== options.reconcile
      || attempt.gameId !== options.gameId || attempt.slateDate !== options.date
      || !/^local:[a-f0-9]{64}$/.test(attempt.codeVersion ?? "") || !attempt.runId
      || !["active", "expired", "issued"].includes(attempt.state))) {
      throw new Error("Local FORGE reconciliation does not match the requested immutable scope.");
    }
    let verified = false;
    let failedSnapshotEvidence: Awaited<ReturnType<typeof import("./forge-local-failure-evidence")["readFailedSnapshotTimeoutEvidence"]>> | undefined;
    if (attempt?.state === "issued") {
      const evidence = await readLocalForgeIssuance(db, { ...scope, codeVersion: attempt.codeVersion,
        runId: attempt.runId, inputSnapshotId: attempt.inputSnapshotId });
      if (evidence.revisions.length !== 1 || evidence.revisions[0].id !== attempt.revisionId) {
        throw new Error("Local FORGE reconciliation lacks matching issuance.");
      }
      save(options.out, "input-observation.json", evidence.observation);
      save(options.out, "issued-revisions.json", evidence.revisions);
      verified = true;
    }
    if (options.reconcileFailedSnapshot && attempt?.state === "expired" && attempt.runStatus === "failed") {
      const key = sha256(`${origin}:${options.gameId}`), directory = resolve(ownershipRoot, `${options.gameId}-${key}`);
      const inspection = inspectForgeLocalOwnership(directory), owner = inspection.owner;
      if (owner?.operationId === options.reconcile && owner.origin === origin && owner.gameId === options.gameId && !inspection.live) {
        const { readFailedSnapshotTimeoutEvidence } = await import("./forge-local-failure-evidence");
        failedSnapshotEvidence = await readFailedSnapshotTimeoutEvidence(db, { ...scope, origin, codeVersion: attempt.codeVersion,
          expectedRevisionId: attempt.expectedRevisionId, receiptDirectory: owner.receiptDirectory }, attempt);
      }
    }
    const receipt = { version: "forge-local-reconciliation-v1", origin,
      status: verified ? "verified_issued" : failedSnapshotEvidence ? "verified_failed_snapshot_timeout" : "unresolved", scope, ...execution, requests,
      attempt: attempt ?? null, automaticRetryAllowed: false, durationMs: Date.now() - startedAt };
    if (failedSnapshotEvidence) {
      const { verifyFailedSnapshotTimeoutEvidence } = await import("./forge-local-failure-evidence");
      const directory = resolve(ownershipRoot, `${options.gameId}-${sha256(`${origin}:${options.gameId}`)}`);
      const owner = inspectForgeLocalOwnership(directory).owner!;
      failedSnapshotEvidence.receipt = receipt;
      for (const [name, value] of Object.entries({ "input-observation.json": failedSnapshotEvidence.observation,
        "issued-revisions.json": failedSnapshotEvidence.revisions, "attempt-observation.json": failedSnapshotEvidence.attemptObservation,
        "failed-run.json": failedSnapshotEvidence.run, "original-receipt.json": failedSnapshotEvidence.originalReceipt,
        "original-journal.json": failedSnapshotEvidence.originalJournal, "original-code.json": failedSnapshotEvidence.originalArtifact })) save(options.out, name, value);
      verifyFailedSnapshotTimeoutEvidence({ ...scope, origin, codeVersion: attempt.codeVersion,
        expectedRevisionId: attempt.expectedRevisionId, receiptDirectory: owner.receiptDirectory }, failedSnapshotEvidence);
    }
    save(options.out, "receipt.json", receipt);
    console.log(JSON.stringify({ receipt: resolve(options.out, "receipt.json"), ...receipt }));
    return; // Read-only reconciliation never reclaims ownership or starts calculations.
  }
  const { data: games, error: gameError } = await db.from("games").select("id,date").eq("id", options.gameId).eq("date", options.date).limit(1);
  if (gameError || games?.length !== 1) throw new Error("Scoped game and slate date were not found.");
  const { data: existing, error: revisionError } = await db.from("forge_game_revisions")
    .select("id,run_id,input_snapshot_id,published_at").eq("game_id", options.gameId)
    .order("published_at", { ascending: false }).order("id", { ascending: false }).limit(1);
  if (revisionError) throw new Error("Could not inspect existing revisions.");
  const latest = existing?.[0] ?? null;
  if (options.operationId && (latest?.id ?? null) !== options.expectedRevisionId) {
    throw new Error("Current revision changed from the reviewed calendar intent; no reservation was started.");
  }
  const scope = { date: options.date, gameId: options.gameId, existingRevisionId: latest?.id ?? null };
  journalScope = scope;
  setupReceipt.scope = scope;
  const { runProjectionV2ForDate, projectionModelEnvironment } = await import("../lib/projections/run-forge-projections");
  let issuedContextGuard: RunProjectionOptions["issuedContextGuard"];
  if (options.calendarScope) {
    const reviewedBytes = readFileSync(options.calendarScope), reviewed = JSON.parse(reviewedBytes.toString());
    const { playerForecastSourcePayloadHash } = await import("../lib/player-forecasts/sourceSnapshot");
    const { checksum, ...unsigned } = reviewed;
    const game = reviewed.games?.find((row: any) => row.gameId === options.gameId);
    if (reviewed.version !== "forge-calendar-scope-v1" || checksum !== playerForecastSourcePayloadHash(unsigned)
      || !process.env.FORGE_CALENDAR_START_TOKEN || process.env.FORGE_CALENDAR_SCOPE_CHECKSUM !== checksum
      || !options.artifact || sha256(new Uint8Array(readFileSync(options.artifact))) !== reviewed.artifact.contentHash
      || reviewed.origin !== origin || !game || game.slateDate !== options.date
      || game.expectedPriorRevisionId !== options.expectedRevisionId
      || Date.parse(game.scheduledStartAt) <= Date.now() || Date.parse(reviewed.deadlineAt) < deadlineMs) {
      throw new Error("Reviewed calendar scope does not match the local operation.");
    }
    issuedContextGuard = contexts => {
      if (sha256(new Uint8Array(readFileSync(options.calendarScope!))) !== sha256(new Uint8Array(reviewedBytes))) throw new Error("Reviewed calendar scope changed.");
      assertReviewedForgeCalendarIssuedContext(game, contexts);
    };
  }
  const repo = realpathSync(resolve(__dirname, "../.."));
  const artifact = captureLocalForgeArtifact(repo, projectionModelEnvironment());
  if (artifact.ownershipDirectory !== ownershipRoot) throw new LocalForgeArtifactError();
  setupReceipt.codeVersion = artifact.codeVersion;
  save(options.out, "code.json", artifact);
  if (options.artifact) {
    verifyLocalForgeArtifact(JSON.parse(readFileSync(options.artifact, "utf8")), repo, projectionModelEnvironment());
  }
  if (!options.write || latest && !options.refresh) {
    ownership?.assertOwned();
    const receipt = { status: !options.write ? "preview" : "skipped_existing_revision", scope, ...execution,
      ownership: ownership?.reference,
      wouldWrite: !latest || options.refresh, requests, artifact: resolve(options.out, "code.json"), codeVersion: artifact.codeVersion };
    save(options.out, "receipt.json", receipt);
    ownership?.finish();
    console.log(JSON.stringify({ receipt: resolve(options.out, "receipt.json"), ...receipt }));
    return;
  }

  if (!options.artifact) throw new Error("A write requires --artifact pointing to a reviewed preview code.json.");
  const sourceBundle = artifact.files.filter(file => !file.path.startsWith(sep)
    && !file.path.includes(`node_modules${sep}`)).map(file => {
    const source = readFileSync(resolve(repo, file.path));
    if (sha256(new Uint8Array(source)) !== file.sha256) throw new LocalForgeArtifactError();
    return { ...file, sourceBase64: source.toString("base64") };
  });
  const { codeVersion } = artifact;
  journalCodeVersion = codeVersion;
  process.env.FORGE_CODE_VERSION = codeVersion;
  save(options.out, "source-bundle.json", { codeVersion, files: sourceBundle });
  let publicationOutcome: "not_attempted" | "unknown" | "acknowledged" = "not_attempted";
  let result: RunProjectionResult | undefined;
  try {
    result = await runProjectionV2ForDate(options.date, { gameIds: [options.gameId], horizonGames: 1,
      issuedContextGuard,
      localAttempt: { operationId: ownership!.reference.operationId, expectedRevisionId: latest?.id ?? null,
        leaseMs: Math.max(1, Math.min(options.runtimeMs, deadlineMs - Date.now())) },
      deadlineMs, executionGuard: { codeVersion, verify: next => {
        checkpoint = next;
        ownership?.assertOwned();
        journal({ kind: "checkpoint" });
        verifyLocalForgeArtifact(artifact, repo, projectionModelEnvironment());
        if (process.env.FORGE_CODE_VERSION !== codeVersion) throw new LocalForgeArtifactError();
        if (next.phase === "before_publish") publicationOutcome = "unknown";
      } } });
    if (checkpoint.phase === "before_publish") publicationOutcome = "acknowledged";
    verifyLocalForgeArtifact(artifact, repo, projectionModelEnvironment());
    if (result.timedOut || !result.inputSnapshotId) {
      const receipt = { status: result.timedOut ? "timed_out" : "missing_input_snapshot", scope, ...execution, ownership: ownership?.reference,
        codeVersion, runId: result.runId, result, durationMs: Date.now() - startedAt, requests,
        checkpoint, publicationOutcome };
      save(options.out, "receipt.json", receipt);
      console.error(JSON.stringify({ receipt: resolve(options.out, "receipt.json"), ...receipt }));
      process.exitCode = 1;
      return;
    }
    const { observation, revisions } = await readLocalForgeIssuance(db, { ...scope, codeVersion,
      runId: result.runId, inputSnapshotId: result.inputSnapshotId });
    save(options.out, "input-observation.json", observation);
    save(options.out, "issued-revisions.json", revisions ?? []);
    ownership?.assertOwned();
    const receipt = { status: result.gamesProcessed !== 1 || !result.playerRowsUpserted
      ? "empty_or_partial" : result.publishedGames !== 1 || revisions?.length !== 1 ? "unpublished"
      : "issued",
      scope, ...execution, ownership: ownership?.reference, codeVersion, runId: result.runId, inputSnapshotId: result.inputSnapshotId,
      inputHash: observation.payload_hash, outputHash: observation.payload.outputHash,
      issuedRevisionsHash: sha256(JSON.stringify(revisions ?? [])),
      issuedRevisionIds: (revisions ?? []).map((row: { id: string }) => row.id),
      result, durationMs: Date.now() - startedAt, requests, checkpoint, publicationOutcome };
    save(options.out, "receipt.json", receipt);
    ownership?.finish(receipt.status === "issued");
    console.log(JSON.stringify({ receipt: resolve(options.out, "receipt.json"), ...receipt }));
    if (receipt.status !== "issued") process.exitCode = 1;
  } catch (error) {
    const receipt = { status: error instanceof LocalForgeArtifactError ? "artifact_rejected" : "failed", scope, ...execution, ownership: ownership?.reference, codeVersion,
      runId: result?.runId ?? checkpoint.runId, inputSnapshotId: result?.inputSnapshotId ?? checkpoint.inputSnapshotId,
      result, checkpoint, publicationOutcome, durationMs: Date.now() - startedAt, requests,
      detail: "Reconcile the private scoped run/input/revision state before retrying; no automatic retry was started." };
    save(options.out, "receipt.json", receipt);
    console.error(JSON.stringify({ receipt: resolve(options.out, "receipt.json"), ...receipt }));
    process.exitCode = 1;
  } finally {
    if (ownership && !ownership.attempted) ownership.finish();
  }
}
let receiptDirectory: string | undefined;
let ownership: ReturnType<typeof acquireForgeLocalOwnership> | undefined;
let setupReceipt: { requests: RequestCounts; scope?: unknown; codeVersion?: string; startedAt: string;
  limits: { maxRequests: number; maxWrites: number; runtimeMs: number; requestTimeoutMs: number };
  ownership?: { directory: string; operationId: string } } | undefined;
if (require.main === module) main().catch((error) => {
  if (receiptDirectory && !existsSync(resolve(receiptDirectory, "receipt.json"))) {
    save(receiptDirectory, "receipt.json", { status: error instanceof LocalForgeArtifactError ? "artifact_rejected"
      : error instanceof ForgeLocalOwnershipError ? "ownership_unavailable" : "failed_before_run",
      ...(error instanceof ForgeLocalOwnershipError ? { existingOwnership: { directory: error.inspection.directory,
        operationId: error.inspection.owner?.operationId ?? null, state: error.inspection.state, live: error.inspection.live } } : {}),
      ...(error?.name === "FailedForgeSnapshotEvidenceError" ? { failedSnapshotGate: error.gate } : {}),
      ...setupReceipt, detail: error instanceof LocalForgeArtifactError
        ? "Check the reviewed artifact pin; no automatic retry was started."
        : "Check scope, configuration and Supabase read access; no automatic retry was started." });
  }
  if (ownership && !ownership.attempted) ownership.finish();
  console.error("Local FORGE setup failed; check the private receipt and configuration.");
  process.exitCode = 1;
});
