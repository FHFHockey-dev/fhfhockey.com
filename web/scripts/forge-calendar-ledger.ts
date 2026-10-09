import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join, resolve, sep } from "node:path";
import { FORGE_PROCESS_GUARDIAN_PROTOCOL, type ForgeProcessGuardianIdentity } from "./forge-process-guardian";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const integer = (value: number, minimum: number, maximum: number) => Number.isSafeInteger(value) && value >= minimum && value <= maximum;

/** Flush both content and directory entry before allowing a child to use a grant. */
function persist(directory: string, name: string, value: unknown) {
  const identity = `${hash(hostname())}-${process.pid}-${randomUUID()}.json`;
  const draft = join(directory, `.draft-${name}-${identity}`), ready = join(directory, `.ready-${name}-${identity}`);
  const fd = openSync(draft, "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(value)); fsyncSync(fd); } finally { closeSync(fd); }
  // A ready name can only refer to a complete, fsynced payload. Never expose a partial canonical file.
  linkSync(draft, ready);
  const parent = openSync(directory, "r");
  try {
    fsyncSync(parent);
    linkSync(ready, join(directory, name));
    fsyncSync(parent);
    unlinkSync(draft); unlinkSync(ready); fsyncSync(parent);
  } finally { closeSync(parent); }
}
function readyNames(directory: string, name: string) {
  return readdirSync(directory).filter(file => file.startsWith(`.ready-${name}-`));
}
function hasCheckpoint(directory: string, name: string) {
  return existsSync(join(directory, name)) || readyNames(directory, name).length > 0;
}
function read<T>(directory: string, name: string): T {
  let path = join(directory, name);
  if (!existsSync(path)) {
    const names = readyNames(directory, name);
    if (names.length !== 1) throw new Error("Calendar checkpoint is missing or has ambiguous retained preparations.");
    const identity = names[0].slice(`.ready-${name}-`.length);
    const match = /^([a-f0-9]{64})-([1-9]\d*)-([a-f0-9-]{36})\.json$/.exec(identity);
    if (!match || match[1] !== hash(hostname()) || !integer(Number(match[2]), 1, Number.MAX_SAFE_INTEGER)
      || !uuid(match[3]) || alive(Number(match[2]))) {
      throw new Error("Calendar checkpoint writer is active, foreign or unresolved.");
    }
    // Passive recovery retains the original preparation; it never rewrites a recipe or resets an allocation.
    path = join(directory, names[0]);
  }
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size > 128 * 1024 || (stat.mode & 0o077) || process.getuid && stat.uid !== process.getuid()) {
    throw new Error("Calendar ledger receipt is not a private regular file.");
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
}
function privateRoot(directory: string) {
  const root = realpathSync(directory), repo = realpathSync(resolve(__dirname, "../..")), stat = lstatSync(directory);
  if (!stat.isDirectory() || root === repo || root.startsWith(`${repo}${sep}`)
    || (stat.mode & 0o077) || process.getuid && stat.uid !== process.getuid()) {
    throw new Error("Calendar ledger must be private to the operator and outside the repository.");
  }
  return root;
}

export type ForgeCalendarRecipe = { scopeChecksum: string; origin: string; artifactHash: string; codeVersion: string;
  gameIds: number[]; deadlineAt: string; maxRequests: number; maxWrites: number; initialRequests: number;
  readOnly?: true; recoverySourceChecksum?: string };
type RecipeReceipt = { version: "forge-calendar-ledger-v1"; recipe: ForgeCalendarRecipe; checksum: string };
export type ForgeCalendarGrant = { version: "forge-calendar-grant-v1"; index: number; recipeChecksum: string;
  action: "inspect" | "generate" | "reconcile" | "recovery"; gameId: number | null; operationId: string;
  expectedRevisionId: string | null; maxRequests: number; maxWrites: number; deadlineAt: string;
  coordinator: { pid: number; hostname: string }; recovery?: { root: string; recipe: ForgeCalendarRecipe }; checksum: string };
type GrantResult = { version: "forge-calendar-result-v1"; grantChecksum: string; requests: { reads: number; writes: number } | null;
  outcome: string; receiptHash: string | null; checksum: string };
type ProcessReceipt = { version: "forge-calendar-process-v1"; grantChecksum: string; pid: number; hostname: string;
  guardian?: ForgeProcessGuardianIdentity };
type GrantState = { directory: string; grant: ForgeCalendarGrant; result: GrantResult | null;
  process: ProcessReceipt | null; investigation: ForgeCalendarState | null };
export type ForgeCalendarState = { grants: GrantState[]; requests: number; writes: number;
  remainingRequests: number; remainingWrites: number; deadlineAt: string; expired: boolean };
export type ForgeCalendarLedger = ReturnType<typeof openForgeCalendarLedger>;

function validateRecipe(recipe: ForgeCalendarRecipe) {
  if (!/^[a-f0-9]{64}$/.test(recipe.scopeChecksum) || !/^[a-f0-9]{64}$/.test(recipe.artifactHash)
    || !/^local:[a-f0-9]{64}$/.test(recipe.codeVersion) || new URL(recipe.origin).origin !== recipe.origin
    || !recipe.gameIds.length || recipe.gameIds.length > 500 || new Set(recipe.gameIds).size !== recipe.gameIds.length
    || recipe.gameIds.some(id => !integer(id, 1, Number.MAX_SAFE_INTEGER))
    || !Number.isFinite(Date.parse(recipe.deadlineAt)) || !integer(recipe.maxRequests, 1, 10000)
    || !integer(recipe.maxWrites, recipe.readOnly ? 0 : 1, recipe.readOnly ? 0 : 2000)
    || recipe.readOnly !== undefined && recipe.readOnly !== true
    || recipe.readOnly && (!/^[a-f0-9]{64}$/.test(recipe.recoverySourceChecksum ?? "") || recipe.initialRequests !== 0)
    || !recipe.readOnly && recipe.recoverySourceChecksum !== undefined
    || !integer(recipe.initialRequests, 0, recipe.maxRequests)) {
    throw new Error("Calendar ledger recipe is invalid.");
  }
}
function alive(pid: number) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code !== "ESRCH"; }
}
function validGuardian(guardian: ForgeProcessGuardianIdentity, pid: number) {
  return integer(guardian.pid, 1, Number.MAX_SAFE_INTEGER) && guardian.pid !== pid && !!guardian.hostname
    && guardian.protocol === FORGE_PROCESS_GUARDIAN_PROTOCOL && /^[a-f0-9]{64}$/.test(guardian.nonceHash);
}
function activeProcess(child: ProcessReceipt) {
  return child.hostname !== hostname() || alive(child.pid)
    || !!child.guardian && (child.guardian.hostname !== hostname() || alive(child.guardian.pid) || alive(-child.guardian.pid));
}
export function initializeForgeCalendarLedger(directory: string, recipe: ForgeCalendarRecipe) {
  const root = privateRoot(directory);
  validateRecipe(recipe);
  mkdirSync(join(root, "grants"), { mode: 0o700 });
  persist(root, "ledger.json", { version: "forge-calendar-ledger-v1", recipe, checksum: hash(recipe) });
  return openForgeCalendarLedger(root, recipe);
}

/** Unfinished grants retain their full allocation; restart never resets the recipe, deadline or counters. */
export function openForgeCalendarLedger(directory: string, expectedRecipe: ForgeCalendarRecipe) {
  validateRecipe(expectedRecipe);
  const root = privateRoot(directory), receipt = read<RecipeReceipt>(root, "ledger.json");
  if (receipt.version !== "forge-calendar-ledger-v1" || receipt.checksum !== hash(receipt.recipe)
    || receipt.checksum !== hash(expectedRecipe)) throw new Error("Calendar ledger recipe changed or mismatches the scope.");
  const recipe = receipt.recipe;
  validateRecipe(recipe);
  const recoveryLedger = (recovery: ForgeCalendarGrant["recovery"]) => {
    if (!recovery || recipe.readOnly || recovery.recipe.readOnly !== true
      || recovery.recipe.recoverySourceChecksum !== receipt.checksum
      || recovery.recipe.scopeChecksum !== recipe.scopeChecksum || recovery.recipe.origin !== recipe.origin
      || recovery.recipe.artifactHash !== recipe.artifactHash || recovery.recipe.codeVersion !== recipe.codeVersion
      || hash(recovery.recipe.gameIds) !== hash(recipe.gameIds) || realpathSync(recovery.root) === root) {
      throw new Error("Recovery ledger does not match its original execution.");
    }
    return openForgeCalendarLedger(recovery.root, recovery.recipe);
  };
  const state = (): ForgeCalendarState => {
    if (hash(read<RecipeReceipt>(root, "ledger.json")) !== hash(receipt)) throw new Error("Calendar ledger recipe changed after opening.");
    const names = readdirSync(join(root, "grants")).sort();
    if (names.length > 10000 || names.some((name, index) => name !== String(index + 1).padStart(6, "0"))) {
      throw new Error("Calendar ledger grant sequence is incomplete.");
    }
    let requests = recipe.initialRequests, writes = 0;
    const grants = names.map((name, index) => {
      const directory = privateRoot(join(root, "grants", name));
      const grant = read<ForgeCalendarGrant>(directory, "grant.json"), { checksum, ...unsigned } = grant;
      if (grant.version !== "forge-calendar-grant-v1" || grant.index !== index + 1 || checksum !== hash(unsigned)
        || grant.recipeChecksum !== receipt.checksum || !uuid(grant.operationId) || grant.deadlineAt !== recipe.deadlineAt
        || grant.expectedRevisionId !== null && !uuid(grant.expectedRevisionId)
        || !grant.coordinator || !integer(grant.coordinator.pid, 1, Number.MAX_SAFE_INTEGER) || !grant.coordinator.hostname
        || !integer(grant.maxRequests, grant.action === "recovery" ? 0 : 1, grant.action === "recovery" ? 0 : recipe.maxRequests)
        || !integer(grant.maxWrites, 0, recipe.maxWrites)
        || !(recipe.readOnly ? ["reconcile"] : ["inspect", "generate", "reconcile", "recovery"]).includes(grant.action)
        || grant.gameId !== null && !recipe.gameIds.includes(grant.gameId)
        || !["inspect", "recovery"].includes(grant.action) && grant.gameId === null
        || grant.action !== "generate" && grant.maxWrites !== 0
        || grant.action !== "recovery" && grant.recovery !== undefined
        || grant.action === "recovery" && grant.gameId !== null) throw new Error("Calendar ledger grant is invalid.");
      const investigation = grant.action === "recovery" ? recoveryLedger(grant.recovery).state() : null;
      let result: GrantResult | null = null;
      const resultRecovered = !existsSync(join(directory, "result.json"));
      if (hasCheckpoint(directory, "result.json")) {
        result = read<GrantResult>(directory, "result.json");
        const { checksum: resultChecksum, ...resultUnsigned } = result;
        if (result.version !== "forge-calendar-result-v1" || result.grantChecksum !== checksum
          || resultChecksum !== hash(resultUnsigned)
          || typeof result.outcome !== "string" || result.receiptHash !== null && !/^[a-f0-9]{64}$/.test(result.receiptHash)
          || result.requests && (!integer(result.requests.reads, 0, grant.maxRequests)
            || !integer(result.requests.writes, 0, grant.maxWrites)
            || result.requests.reads + result.requests.writes > grant.maxRequests)) throw new Error("Calendar ledger result exceeds its grant.");
      }
      requests += result?.requests ? result.requests.reads + result.requests.writes : grant.maxRequests;
      writes += result?.requests ? result.requests.writes : grant.maxWrites;
      let process: ProcessReceipt | null = null;
      if (hasCheckpoint(directory, "process.json")) {
        process = read<ProcessReceipt>(directory, "process.json");
        if (process.version !== "forge-calendar-process-v1" || process.grantChecksum !== checksum
          || !integer(process.pid, 1, Number.MAX_SAFE_INTEGER) || !process.hostname
          || process.guardian && !validGuardian(process.guardian, process.pid)) throw new Error("Calendar process identity is invalid.");
      }
      if (result && resultRecovered && (result.requests && !process
        || process && activeProcess(process)
        || investigation?.grants.some(child => child.process && activeProcess(child.process)))) {
        throw new Error("Recovered calendar result lacks terminal child evidence.");
      }
      return { directory, grant, result, process, investigation };
    });
    if (requests > recipe.maxRequests || writes > recipe.maxWrites) throw new Error("Calendar ledger shared budget was exceeded.");
    return { grants, requests, writes, remainingRequests: recipe.maxRequests - requests, remainingWrites: recipe.maxWrites - writes,
      deadlineAt: recipe.deadlineAt, expired: Date.now() >= Date.parse(recipe.deadlineAt) };
  };
  return {
    root, recipe, state,
    grant(input: { action: ForgeCalendarGrant["action"]; gameId?: number; operationId?: string; expectedRevisionId?: string | null;
      maxRequests: number; maxWrites: number; recovery?: ForgeCalendarGrant["recovery"] }) {
      const current = state();
      if (current.grants.some(entry => entry.grant.coordinator.hostname !== hostname()
        || entry.grant.coordinator.pid !== process.pid && alive(entry.grant.coordinator.pid)
        || entry.process && activeProcess(entry.process)
        || entry.investigation?.grants.some(child => child.grant.coordinator.hostname !== hostname()
          || child.grant.coordinator.pid !== process.pid && alive(child.grant.coordinator.pid)
          || child.process && activeProcess(child.process))
        || !entry.result && entry.grant.coordinator.pid === process.pid)) {
        throw new Error("Calendar coordinator or child is active or unresolved; no overlapping grant is allowed.");
      }
      if (current.expired && input.action !== "recovery"
        || !(recipe.readOnly ? ["reconcile"] : ["inspect", "generate", "reconcile", "recovery"]).includes(input.action)
        || input.gameId != null && !recipe.gameIds.includes(input.gameId)
        || !integer(input.maxRequests, input.action === "recovery" ? 0 : 1, input.action === "recovery" ? 0 : current.remainingRequests)
        || !integer(input.maxWrites, 0, current.remainingWrites) || input.action !== "generate" && input.maxWrites !== 0
        || !["inspect", "recovery"].includes(input.action) && !recipe.gameIds.includes(input.gameId!)
        || input.action === "recovery" && input.gameId != null
        || input.action !== "recovery" && input.recovery !== undefined) throw new Error("Calendar grant scope or shared budget exhausted.");
      if (input.action === "recovery") recoveryLedger(input.recovery).state();
      const operationId = input.operationId ?? randomUUID();
      if (!uuid(operationId) || input.expectedRevisionId != null && !uuid(input.expectedRevisionId)) {
        throw new Error("Calendar operation or prior revision identity is invalid.");
      }
      const unsigned = { version: "forge-calendar-grant-v1" as const, index: current.grants.length + 1, recipeChecksum: receipt.checksum,
        action: input.action, gameId: input.gameId ?? null, operationId, expectedRevisionId: input.expectedRevisionId ?? null,
        maxRequests: input.maxRequests, maxWrites: input.maxWrites, deadlineAt: recipe.deadlineAt,
        coordinator: { pid: process.pid, hostname: hostname() }, ...(input.recovery ? { recovery: input.recovery } : {}) };
      const directory = join(root, "grants", String(unsigned.index).padStart(6, "0"));
      const prepared = join(root, `.grant-prepared-${randomUUID()}`);
      mkdirSync(prepared, { mode: 0o700 });
      const grant = { ...unsigned, checksum: hash(unsigned) };
      persist(prepared, "grant.json", grant);
      // Published grants are always nonempty: competing current allocators cannot replace a sequence entry.
      renameSync(prepared, directory);
      const parent = openSync(join(root, "grants"), "r");
      try { fsyncSync(parent); } finally { closeSync(parent); }
      return { directory, grant };
    },
    started(index: number, pid: number, guardian?: ForgeProcessGuardianIdentity) {
      const entry = state().grants[index - 1];
      if (!entry || entry.result || entry.process || entry.grant.coordinator.hostname !== hostname()
        || entry.grant.coordinator.pid !== process.pid || !integer(pid, 1, Number.MAX_SAFE_INTEGER)
        || guardian && (!validGuardian(guardian, pid) || guardian.hostname !== hostname())) throw new Error("Calendar grant cannot start.");
      persist(entry.directory, "process.json", { version: "forge-calendar-process-v1", grantChecksum: entry.grant.checksum,
        pid, hostname: hostname(), ...(guardian ? { guardian } : {}) });
    },
    finish(index: number, outcome: string, requests: GrantResult["requests"], receiptHash: string | null) {
      const entry = state().grants[index - 1];
      if (!entry || entry.result || requests && !entry.process
        || entry.process && activeProcess(entry.process)
        || entry.investigation?.grants.some(child => child.process && activeProcess(child.process))
        || typeof outcome !== "string" || receiptHash !== null && !/^[a-f0-9]{64}$/.test(receiptHash)
        || requests && (!integer(requests.reads, 0, entry.grant.maxRequests)
        || !integer(requests.writes, 0, entry.grant.maxWrites) || requests.reads + requests.writes > entry.grant.maxRequests)) {
        throw new Error("Calendar result is incompatible with its reserved budget.");
      }
      const unsigned = { version: "forge-calendar-result-v1" as const, grantChecksum: entry.grant.checksum, requests, outcome, receiptHash };
      persist(entry.directory, "result.json", { ...unsigned, checksum: hash(unsigned) });
      return state();
    },
  };
}

/** IPC start barrier: the parent flushes the grant and PID before letting the CLI access Supabase. */
export async function awaitForgeCalendarGrant() {
  const token = process.env.FORGE_CALENDAR_START_TOKEN;
  if (!token) return;
  if (!uuid(token) || !process.connected || !process.send) throw new Error("Calendar start grant is unavailable.");
  await new Promise<void>((resolveReady, reject) => {
    const timer = setTimeout(() => finish(new Error("Calendar start grant timed out.")), 10000);
    const disconnected = () => finish(new Error("Calendar supervisor disconnected before activation."));
    const message = (value: unknown) => {
      if ((value as any)?.type === "forge-calendar-start" && (value as any)?.token === token
        && (value as any)?.protocol === FORGE_PROCESS_GUARDIAN_PROTOCOL) finish();
    };
    const finish = (error?: Error) => {
      clearTimeout(timer); process.removeListener("disconnect", disconnected); process.removeListener("message", message);
      if (error) reject(error); else resolveReady();
    };
    process.once("disconnect", disconnected); process.on("message", message);
    process.send!({ type: "forge-calendar-ready", token, protocol: FORGE_PROCESS_GUARDIAN_PROTOCOL });
  });
  // Keep the IPC handle out of the normal CLI exit path after the grant has been acknowledged.
  process.disconnect();
}
