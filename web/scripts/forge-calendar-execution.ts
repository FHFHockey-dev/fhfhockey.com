import { createHash } from "node:crypto";
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { loadEnvConfig } from "@next/env";
import { initializeForgeCalendarLedger, openForgeCalendarLedger, type ForgeCalendarRecipe } from "./forge-calendar-ledger";
import { parseForgeCalendarArgs, superviseForgeProcess, type buildForgeCalendarManifest } from "./run-forge-calendar-local";
import { playerForecastSourcePayloadHash } from "../lib/player-forecasts/sourceSnapshot";
import { forgeLocalOwnershipRoot, recoverForgeLocalOwnership } from "./forge-local-ownership";

type Scope = Awaited<ReturnType<typeof buildForgeCalendarManifest>>;
type ExecutionOptions = { write: true; scope: string; out: string; resume?: string };
type RecoveryOptions = { recover: true; scope: string; out: string; resume: string;
  maxRequests: number; runtimeMs: number; requestTimeoutMs: number };
const hash = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");
const usage = "Use --write --scope REVIEWED_SCOPE_JSON --out NEW_PRIVATE_DIRECTORY [--resume ORIGINAL_EXECUTION_DIRECTORY]. Budgets and deadline come from the reviewed scope.";
export function parseForgeCalendarExecutionArgs(argv: string[]): ExecutionOptions {
  if (argv.filter(value => value === "--write").length !== 1) throw new Error(usage);
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === "--write") continue;
    if (!["--scope", "--out", "--resume"].includes(flag) || values.has(flag)
      || !argv[index + 1] || argv[index + 1].startsWith("--")) throw new Error(usage);
    values.set(flag, resolve(argv[++index]));
  }
  if (!values.has("--scope") || !values.has("--out")) throw new Error(usage);
  return { write: true, scope: values.get("--scope")!, out: values.get("--out")!,
    ...(values.has("--resume") ? { resume: values.get("--resume")! } : {}) };
}
export function parseForgeCalendarRecoveryArgs(argv: string[]): RecoveryOptions {
  const usage = "Use --recover --scope ORIGINAL_SCOPE_JSON --resume ORIGINAL_EXECUTION_DIRECTORY --out NEW_PRIVATE_DIRECTORY [--max-requests 1..10000] [--runtime-ms 1..600000] [--request-timeout-ms 1..60000]. Recovery never generates or writes to Supabase.";
  if (argv.filter(value => value === "--recover").length !== 1) throw new Error(usage);
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === "--recover") continue;
    if (!["--scope", "--resume", "--out", "--max-requests", "--runtime-ms", "--request-timeout-ms"].includes(flag)
      || values.has(flag) || !argv[index + 1] || argv[index + 1].startsWith("--")) throw new Error(usage);
    values.set(flag, argv[++index]);
  }
  if (!["--scope", "--resume", "--out"].every(flag => values.has(flag))) throw new Error(usage);
  const bound = (flag: string, fallback: number, maximum: number) => {
    const raw = values.get(flag) ?? String(fallback);
    if (!/^[1-9]\d*$/.test(raw) || Number(raw) > maximum) throw new Error(usage);
    return Number(raw);
  };
  return { recover: true, scope: resolve(values.get("--scope")!), resume: resolve(values.get("--resume")!), out: resolve(values.get("--out")!),
    maxRequests: bound("--max-requests", 1000, 10000), runtimeMs: bound("--runtime-ms", 150000, 600000),
    requestTimeoutMs: bound("--request-timeout-ms", 10000, 60000) };
}
function read(path: string): any {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size > 32 * 1024 * 1024 || stat.mode & 0o077
    || process.getuid && stat.uid !== process.getuid()) throw new Error("Calendar input must be a bounded private regular file.");
  return JSON.parse(readFileSync(path, "utf8"));
}
function save(directory: string, name: string, value: unknown) {
  const fd = openSync(join(directory, name), "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(value)); fsyncSync(fd); } finally { closeSync(fd); }
}
function createOutput(out: string) {
  const repo = realpathSync(resolve(__dirname, "../..")), parent = realpathSync(dirname(out));
  if (existsSync(out) || parent === repo || parent.startsWith(`${repo}${sep}`)) throw new Error("Use a new private directory outside the repository.");
  mkdirSync(out, { mode: 0o700 });
}
export function validateForgeCalendarExecutionScope(scope: Scope) {
  const { checksum, ...unsigned } = scope;
  if (scope.version !== "forge-calendar-scope-v1" || scope.mode !== "read_only"
    || checksum !== playerForecastSourcePayloadHash(unsigned) || new URL(scope.origin).origin !== scope.origin
    || scope.requests.writes !== 0 || !Number.isFinite(Date.parse(scope.deadlineAt)) || !scope.games.length
    || scope.calendarPolicy.version !== "forecast-calendar-v1" || scope.calendarPolicy.timeZone !== "UTC" || scope.calendarPolicy.overlapDays !== 7
    || playerForecastSourcePayloadHash(scope.calendarPolicy) !== playerForecastSourcePayloadHash(scope.context.consumerCalendarPolicy)
    || scope.games.some(game => game.exclusions.includes("horizon_policy_mismatch") || game.exclusions.includes("stale_schedule"))
    || scope.games.some(game => !game.required.length || !Number.isFinite(Date.parse(game.scheduledStartAt)))) {
    throw new Error("Calendar execution requires the reviewed inspection scope.");
  }
  return parseForgeCalendarArgs(["--game-ids", scope.games.map(game => game.gameId).join(","), "--artifact", "/reviewed-code.json",
    "--out", "/calendar-output", "--days", String(scope.calendarPolicy.calendarDays),
    ...(scope.playerIds ? ["--player-ids", scope.playerIds.join(",")] : []),
    ...(scope.profile.skaterTargets.length ? ["--skater-targets", scope.profile.skaterTargets.join(",")] : []),
    ...(scope.profile.goalieTargets.length ? ["--goalie-targets", scope.profile.goalieTargets.join(",")] : []),
    "--max-games", String(scope.limits.maxGames), "--max-requests", String(scope.limits.maxRequests),
    "--max-writes", String(scope.limits.maxWrites), "--runtime-ms", String(scope.limits.runtimeMs),
    "--request-timeout-ms", String(scope.limits.requestTimeoutMs)]);
}
export function assertForgeCalendarContext(reviewed: Scope, current: Scope) {
  const context = (scope: Scope) => ({ origin: scope.origin, calendarPolicy: scope.calendarPolicy, profile: scope.profile,
    playerIds: scope.playerIds, news: scope.context.acceptedNewsRevision,
    schedule: scope.context.scheduleRevision, roster: scope.context.rosterRevision,
    games: scope.games.map(game => ({ gameId: game.gameId, seasonId: game.seasonId, slateDate: game.slateDate,
      scheduledStartAt: game.scheduledStartAt, sides: game.sides, required: game.required })) });
  if (playerForecastSourcePayloadHash(context(reviewed)) !== playerForecastSourcePayloadHash(context(current))) {
    throw new Error("Calendar context changed; review a new scope instead of silently changing intent.");
  }
}
function reviewedCalendarScope(path: string) {
  const scope = read(path) as Scope, parsed = validateForgeCalendarExecutionScope(scope);
  const artifactPath = join(dirname(path), "reviewed-code.json"), artifact = read(artifactPath), artifactBytes = readFileSync(artifactPath);
  if (hash(new Uint8Array(artifactBytes)) !== scope.artifact.contentHash || artifact.codeVersion !== scope.artifact.codeVersion) {
    throw new Error("Reviewed artifact mismatches the calendar scope.");
  }
  loadEnvConfig(resolve(__dirname, ".."), true, { info() {}, error() {} });
  if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin !== scope.origin
    || artifact.ownershipDirectory !== forgeLocalOwnershipRoot(process.env.FORGE_LOCAL_OWNERSHIP_DIR)) {
    throw new Error("Calendar Supabase origin or ownership directory changed.");
  }
  const recipe: ForgeCalendarRecipe = { scopeChecksum: scope.checksum, origin: scope.origin, artifactHash: scope.artifact.contentHash,
    codeVersion: scope.artifact.codeVersion, gameIds: parsed.gameIds, deadlineAt: scope.deadlineAt,
    maxRequests: scope.limits.maxRequests, maxWrites: scope.limits.maxWrites, initialRequests: scope.requests.reads };
  return { scope, parsed, artifactPath, artifactBytes, recipe };
}

/** Serial, direct-Supabase execution. Unknown attempts are reconciled, never blindly rerun. */
export async function runForgeCalendarExecution(options: ExecutionOptions,
  supervise: typeof superviseForgeProcess = superviseForgeProcess) {
  if (options.write !== true) throw new Error(usage);
  const { scope, parsed, artifactPath, artifactBytes, recipe } = reviewedCalendarScope(options.scope);
  createOutput(options.out);
  save(options.out, "execution-intent.json", { version: "forge-calendar-execution-v1", options, scopeChecksum: scope.checksum,
    startedAt: new Date().toISOString(), writesExplicitlyRequested: true });
  const ledger = options.resume ? openForgeCalendarLedger(options.resume, recipe) : initializeForgeCalendarLedger(options.out, recipe);
  if (!options.resume) {
    save(options.out, "scope.json", scope);
    const fd = openSync(join(options.out, "reviewed-code.json"), "wx", 0o600);
    try { writeFileSync(fd, new Uint8Array(artifactBytes)); fsyncSync(fd); } finally { closeSync(fd); }
  }
  const controller = new AbortController(), cancel = () => controller.abort();
  process.once("SIGINT", cancel); process.once("SIGTERM", cancel);
  const progress: Array<{ gameId: number; status: string; operationId?: string;
    ownershipRecovery?: { state: "released" | "absent"; archive?: string } }> = [];
  let finalScope: Scope | null = null, failure: string | null = null;
  const execute = async (action: "inspect" | "generate" | "reconcile", game?: Scope["games"][number], operationId?: string) => {
    const state = ledger.state(), maxRequests = Math.min(1000, state.remainingRequests);
    const maxWrites = action === "generate" ? Math.min(100, state.remainingWrites, maxRequests) : 0;
    if (!maxRequests || action === "generate" && !maxWrites) throw new Error("Calendar shared budget exhausted.");
    const { directory, grant } = ledger.grant({ action, gameId: game?.gameId, operationId,
      expectedRevisionId: game?.expectedPriorRevisionId, maxRequests, maxWrites });
    const childOut = join(directory, "child"), remaining = Math.max(1, Date.parse(scope.deadlineAt) - Date.now());
    const runtime = Math.min(remaining, action === "inspect" ? 3600000 : 600000);
    let argv: string[];
    if (action === "inspect") {
      mkdirSync(childOut, { mode: 0o700 });
      save(childOut, "intent.json", { version: "forge-calendar-inspection-v1", startedAt: new Date().toISOString() });
      argv = [join(__dirname, "run-forge-calendar-local.ts"), "--inspect", "--game-ids", parsed.gameIds.join(","),
        "--artifact", artifactPath, "--out", childOut, "--days", String(parsed.days), "--max-games", String(parsed.limits.maxGames),
        ...(parsed.playerIds ? ["--player-ids", parsed.playerIds.join(",")] : []),
        ...(parsed.profile.skaterTargets.length ? ["--skater-targets", parsed.profile.skaterTargets.join(",")] : []),
        ...(parsed.profile.goalieTargets.length ? ["--goalie-targets", parsed.profile.goalieTargets.join(",")] : [])];
    } else argv = [join(__dirname, "run-forge-local.ts"), "--date", game!.slateDate, "--game-id", String(game!.gameId), "--out", childOut,
      ...(action === "reconcile" ? ["--reconcile", grant.operationId] : ["--write", "--refresh", "--artifact", artifactPath,
        "--operation-id", grant.operationId, "--expected-revision", game!.expectedPriorRevisionId ?? "none", "--calendar-scope", options.scope])];
    argv.push("--max-requests", String(maxRequests), "--runtime-ms", String(runtime),
      "--request-timeout-ms", String(scope.limits.requestTimeoutMs));
    if (action === "generate") argv.push("--max-writes", String(maxWrites));
    const result = await supervise({ argv: [...process.execArgv, ...argv], cwd: resolve(__dirname, ".."), out: directory,
      deadlineMs: Date.parse(scope.deadlineAt), signal: controller.signal,
      environment: { ...process.env, FORGE_CALENDAR_DEADLINE_AT: scope.deadlineAt,
        FORGE_CALENDAR_SCOPE_CHECKSUM: scope.checksum }, beforeStart: (pid, guardian) => ledger.started(grant.index, pid, guardian) });
    let receipt: any = null;
    try { receipt = read(join(childOut, action === "inspect" ? "inspection.json" : "receipt.json")); } catch { /* Missing receipt retains the full grant. */ }
    const counts = receipt?.requests;
    const compatible = counts && Number.isSafeInteger(counts.reads) && Number.isSafeInteger(counts.writes)
      && counts.reads >= 0 && counts.writes >= 0 && counts.reads + counts.writes <= maxRequests && counts.writes <= maxWrites
      && (action === "inspect" ? receipt.mode === "read_only" : receipt.scope?.gameId === game!.gameId
        && receipt.scope?.date === game!.slateDate && (action === "reconcile" ? receipt.scope?.operationId === grant.operationId
          : receipt.ownership?.operationId === grant.operationId && receipt.codeVersion === recipe.codeVersion));
    ledger.finish(grant.index, compatible ? receipt.status : result.outcome, compatible ? counts : null,
      compatible ? hash(JSON.stringify(receipt)) : null);
    if (result.outcome !== "succeeded" || !compatible) throw new Error("Calendar child failed or lacks compatible terminal evidence.");
    return { receipt, grant, childOut, scope: action === "inspect" ? read(join(childOut, "scope.json")) as Scope : null };
  };
  try {
    // Account for old issuance before current-context checks; cleanup cannot authorize changed-context generation.
    for (const game of scope.games) {
      const previous = ledger.state().grants.filter(entry => entry.grant.action === "generate" && entry.grant.gameId === game.gameId).at(-1);
      if (previous) {
        const recovery = await execute("reconcile", game, previous.grant.operationId);
        if (recovery.receipt.status !== "verified_issued" || recovery.receipt.attempt?.codeVersion !== recipe.codeVersion
          || recovery.receipt.attempt?.expectedRevisionId !== game.expectedPriorRevisionId) {
          progress.push({ gameId: game.gameId, status: "unresolved", operationId: previous.grant.operationId });
          throw new Error("Calendar write outcome remains unresolved; retry is not authorized by a negative read.");
        }
        if (!previous.process) throw new Error("Original calendar writer identity is missing.");
        const ownershipRecovery = await recoverForgeLocalOwnership({ origin: recipe.origin, gameId: game.gameId, date: game.slateDate,
          operationId: previous.grant.operationId, codeVersion: recipe.codeVersion, expectedRevisionId: game.expectedPriorRevisionId,
          receiptDirectory: join(previous.directory, "child"), writer: previous.process, evidenceDirectory: recovery.childOut,
          root: process.env.FORGE_LOCAL_OWNERSHIP_DIR });
        progress.push({ gameId: game.gameId, status: "verified_issued", operationId: previous.grant.operationId, ownershipRecovery });
      }
    }
    const current = (await execute("inspect")).scope!;
    validateForgeCalendarExecutionScope(current); assertForgeCalendarContext(scope, current);
    for (const game of scope.games) {
      if (progress.some(row => row.gameId === game.gameId)) continue;
      const fresh = current.games.find(row => row.gameId === game.gameId)!;
      if (fresh.expectedPriorRevisionId !== game.expectedPriorRevisionId) throw new Error("Calendar prior revision changed.");
      if (fresh.decision === "skip_eligible_detailed") { progress.push({ gameId: game.gameId, status: "skipped_eligible_detailed" }); continue; }
      const generated = await execute("generate", game);
      progress.push({ gameId: game.gameId, status: generated.receipt.status, operationId: generated.grant.operationId });
      if (generated.receipt.status !== "issued") throw new Error("Calendar game did not issue a complete local result.");
    }
    finalScope = (await execute("inspect")).scope!;
    validateForgeCalendarExecutionScope(finalScope); assertForgeCalendarContext(scope, finalScope);
  } catch { failure = "Inspect per-grant receipts and current source/ownership evidence; no automatic retry was started."; }
  finally { process.removeListener("SIGINT", cancel); process.removeListener("SIGTERM", cancel); }
  const executionComplete = !failure && progress.length === scope.games.length;
  const eligibleCoverageComplete = executionComplete && finalScope!.games.every(game => game.decision === "skip_eligible_detailed");
  const receipt = { version: "forge-calendar-execution-v1", scopeChecksum: scope.checksum,
    executionComplete, eligibleCoverageComplete, recommendationReadiness: "not_evaluated", progress,
    budgets: ledger.state(), finalScopeChecksum: finalScope?.checksum ?? null, failure, automaticRetryAllowed: false };
  save(options.out, "receipt.json", receipt);
  console.log(JSON.stringify({ receipt: join(options.out, "receipt.json"), executionComplete, eligibleCoverageComplete }));
  if (!executionComplete || !eligibleCoverageComplete) process.exitCode = 1;
  return receipt;
}

/** Investigate historical operations with a separate zero-write budget; original generation intent is never renewed. */
export async function runForgeCalendarRecovery(options: RecoveryOptions, supervise: typeof superviseForgeProcess = superviseForgeProcess) {
  if (options.recover !== true || !Number.isSafeInteger(options.maxRequests) || options.maxRequests < 1 || options.maxRequests > 10000
    || !Number.isSafeInteger(options.runtimeMs) || options.runtimeMs < 1 || options.runtimeMs > 600000
    || !Number.isSafeInteger(options.requestTimeoutMs) || options.requestTimeoutMs < 1 || options.requestTimeoutMs > 60000) {
    throw new Error("Recovery requires explicit bounded read-only intent.");
  }
  const { scope, recipe } = reviewedCalendarScope(options.scope), original = openForgeCalendarLedger(options.resume, recipe);
  const before = original.state(), originalRecipeHash = hash(JSON.stringify(recipe)), deadlineAt = new Date(Date.now() + options.runtimeMs).toISOString();
  createOutput(options.out);
  save(options.out, "recovery-intent.json", { version: "forge-calendar-recovery-v1", options, sourceLedger: original.root,
    scopeChecksum: scope.checksum, startedAt: new Date().toISOString(), databaseWritesAllowed: false, generationAllowed: false });
  const recoveryRecipe: ForgeCalendarRecipe = { ...recipe, deadlineAt, maxRequests: options.maxRequests, maxWrites: 0,
    initialRequests: 0, readOnly: true, recoverySourceChecksum: originalRecipeHash };
  const ledger = initializeForgeCalendarLedger(options.out, recoveryRecipe);
  const controller = new AbortController(), cancel = () => controller.abort();
  process.once("SIGINT", cancel); process.once("SIGTERM", cancel);
  const progress: Array<{ gameId: number; operationId: string; status: string; ownershipRecovery?: Awaited<ReturnType<typeof recoverForgeLocalOwnership>> }> = [];
  let claim: number | null = null, failure: string | null = null;
  try {
    claim = original.grant({ action: "recovery", maxRequests: 0, maxWrites: 0, recovery: { root: ledger.root, recipe: recoveryRecipe } }).grant.index;
    for (const previous of before.grants.filter(entry => entry.grant.action === "generate")) {
      const game = scope.games.find(game => game.gameId === previous.grant.gameId)!;
      const maxRequests = Math.min(1000, ledger.state().remainingRequests);
      const { directory, grant } = ledger.grant({ action: "reconcile", gameId: game.gameId, operationId: previous.grant.operationId,
        expectedRevisionId: previous.grant.expectedRevisionId, maxRequests, maxWrites: 0 });
      const childOut = join(directory, "child"), runtimeMs = Math.max(1, Date.parse(deadlineAt) - Date.now());
      const result = await supervise({ argv: [...process.execArgv, join(__dirname, "run-forge-local.ts"), "--date", game.slateDate,
        "--game-id", String(game.gameId), "--out", childOut, "--reconcile", grant.operationId, "--max-requests", String(maxRequests),
        "--runtime-ms", String(runtimeMs), "--request-timeout-ms", String(options.requestTimeoutMs)],
        cwd: resolve(__dirname, ".."), out: directory, deadlineMs: Date.parse(deadlineAt), signal: controller.signal,
        environment: { ...process.env, FORGE_CALENDAR_DEADLINE_AT: deadlineAt, FORGE_CALENDAR_SCOPE_CHECKSUM: scope.checksum },
        beforeStart: (pid, guardian) => ledger.started(grant.index, pid, guardian) });
      let receipt: any = null;
      try { receipt = read(join(childOut, "receipt.json")); } catch { /* Unknown reads retain their full new grant. */ }
      const counts = receipt?.requests;
      const compatible = receipt?.version === "forge-local-reconciliation-v1" && receipt.origin === recipe.origin
        && receipt.scope?.gameId === game.gameId && receipt.scope?.date === game.slateDate && receipt.scope?.operationId === grant.operationId
        && counts?.writes === 0 && Number.isSafeInteger(counts.reads) && counts.reads >= 0 && counts.reads <= maxRequests;
      ledger.finish(grant.index, compatible ? receipt.status : result.outcome, compatible ? counts : null,
        compatible ? hash(JSON.stringify(receipt)) : null);
      if (result.outcome !== "succeeded" || !compatible) throw new Error("Recovery child lacks compatible terminal read evidence.");
      if (receipt.status !== "verified_issued" || !previous.process || receipt.attempt?.expectedRevisionId !== previous.grant.expectedRevisionId) {
        progress.push({ gameId: game.gameId, operationId: grant.operationId, status: "unresolved" });
        continue;
      }
      const ownershipRecovery = await recoverForgeLocalOwnership({ origin: recipe.origin, gameId: game.gameId, date: game.slateDate,
        operationId: grant.operationId, codeVersion: recipe.codeVersion, expectedRevisionId: previous.grant.expectedRevisionId,
        receiptDirectory: join(previous.directory, "child"), writer: previous.process, evidenceDirectory: childOut,
        root: process.env.FORGE_LOCAL_OWNERSHIP_DIR, deadlineMs: Date.parse(deadlineAt), signal: controller.signal });
      progress.push({ gameId: game.gameId, operationId: grant.operationId, status: "verified_issued", ownershipRecovery });
    }
  } catch { failure = "Inspect retained recovery grants and ownership evidence; generation was not enabled."; }
  finally {
    process.removeListener("SIGINT", cancel); process.removeListener("SIGTERM", cancel);
    if (claim !== null) {
      try { original.finish(claim, failure ? "incomplete" : "inspected", null, null); }
      catch { failure = "Recovery claim remains unresolved; inspect its live child and retained evidence before another invocation."; }
    }
  }
  const after = original.state();
  if (after.requests !== before.requests || after.writes !== before.writes || hash(JSON.stringify(original.recipe)) !== originalRecipeHash) {
    throw new Error("Recovery altered original generation accounting.");
  }
  const receipt = { version: "forge-calendar-recovery-v1", mode: "recovery_only", scopeChecksum: scope.checksum, sourceLedger: original.root,
    databaseWritesAllowed: false, generationAllowed: false, automaticRetryAllowed: false, recommendationReadiness: "not_evaluated",
    investigationComplete: !failure && progress.length === before.grants.filter(entry => entry.grant.action === "generate").length,
    issuanceResolved: !failure && progress.length > 0 && progress.every(row => row.status === "verified_issued"), progress,
    originalBudgets: { requests: before.requests, writes: before.writes, deadlineAt: recipe.deadlineAt }, recoveryBudgets: ledger.state(), failure };
  save(options.out, "receipt.json", receipt);
  console.log(JSON.stringify({ receipt: join(options.out, "receipt.json"), investigationComplete: receipt.investigationComplete,
    issuanceResolved: receipt.issuanceResolved, generationAllowed: false }));
  if (!receipt.investigationComplete || !receipt.issuanceResolved) process.exitCode = 1;
  return receipt;
}
