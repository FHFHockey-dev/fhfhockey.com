import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { hostname } from "node:os";
import type { PlanningData } from "../lib/rosterScheduleOptimizer/planningTypes";
import type { CalendarCoverageProfile } from "../lib/player-forecasts/calendarCoverage";
import type { planPlayerForecastCalendarWork } from "../lib/player-forecasts/orchestration";
import { awaitForgeCalendarGrant } from "./forge-calendar-ledger";
import { FORGE_PROCESS_GUARDIAN_PROTOCOL, runForgeProcessGuardian, type ForgeProcessGuardianIdentity } from "./forge-process-guardian";

const usage = "Inspect: run-forge-calendar-local.ts --game-ids ID,ID --artifact REVIEWED_CODE_JSON --out PRIVATE_NEW_DIRECTORY [--days 1..21] [--player-ids CANONICAL_ID,ID] [--skater-targets TARGET,TARGET] [--goalie-targets TARGET,TARGET] [--max-games 1..500] [--max-requests 1..10000] [--max-writes 1..2000] [--runtime-ms 1..3600000] [--request-timeout-ms 1..60000]. Execute: --write --scope REVIEWED_SCOPE_JSON --out PRIVATE_NEW_DIRECTORY [--resume ORIGINAL_EXECUTION_DIRECTORY]. Recover only: --recover --scope ORIGINAL_SCOPE_JSON --resume ORIGINAL_EXECUTION_DIRECTORY --out PRIVATE_NEW_DIRECTORY [--max-requests 1..10000] [--runtime-ms 1..600000] [--request-timeout-ms 1..60000]. Recovery never generates or writes to Supabase. Writes retain the existing capacity, source and hosted-contract gates.";
export type ForgeCalendarOptions = { gameIds: number[]; playerIds?: string[]; artifact: string; out: string;
  days: number; profile: CalendarCoverageProfile; limits: { concurrency: 1; maxGames: number; maxRequests: number;
    maxWrites: number; runtimeMs: number; requestTimeoutMs: number }; inspect: boolean };
const hash = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");

export function parseForgeCalendarArgs(argv: string[]): ForgeCalendarOptions {
  const values = new Map<string, string>();
  const inspect = argv.includes("--inspect");
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === "--inspect") continue;
    if (!["--game-ids", "--player-ids", "--artifact", "--out", "--days", "--skater-targets", "--goalie-targets",
      "--max-games", "--max-requests", "--max-writes", "--runtime-ms", "--request-timeout-ms"].includes(flag)
      || values.has(flag) || !argv[index + 1] || argv[index + 1].startsWith("--")) throw new Error(usage);
    values.set(flag, argv[++index]);
  }
  const bound = (flag: string, fallback: number, maximum: number) => {
    const raw = values.get(flag) ?? String(fallback);
    if (!/^[1-9]\d*$/.test(raw) || Number(raw) > maximum) throw new Error(usage);
    return Number(raw);
  };
  const ids = (raw: string) => {
    const list = raw.split(",");
    if (list.length > 1000 || list.some(id => !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
      || new Set(list).size !== list.length) throw new Error(usage);
    return list.sort((a, b) => Number(a) - Number(b));
  };
  const targets = (flag: string, goalie: boolean) => {
    const list = values.get(flag)?.split(",") ?? [];
    if (list.length > 20 || list.some(key => !/^[A-Z][A-Z0-9_]{0,63}$/.test(key)
      || (key.endsWith("_GOALIE") || key === "GOALIE_MINUTES") !== goalie)
      || new Set(list).size !== list.length) throw new Error(usage);
    return list.sort();
  };
  const profile = { skaterTargets: targets("--skater-targets", false), goalieTargets: targets("--goalie-targets", true) };
  const maxGames = bound("--max-games", 16, 500), gameIds = ids(values.get("--game-ids") ?? "").map(Number);
  if (!values.get("--artifact") || !values.get("--out") || gameIds.length > maxGames
    || !profile.skaterTargets.length && !profile.goalieTargets.length) throw new Error(usage);
  return { gameIds, ...(values.has("--player-ids") ? { playerIds: ids(values.get("--player-ids")!) } : {}),
    profile, artifact: resolve(values.get("--artifact")!), out: resolve(values.get("--out")!),
    days: bound("--days", 14, 21), inspect,
    limits: { concurrency: 1, maxGames, maxRequests: bound("--max-requests", 500, 10000),
      maxWrites: bound("--max-writes", 200, 2000), runtimeMs: bound("--runtime-ms", 600000, 3600000),
      requestTimeoutMs: bound("--request-timeout-ms", 10000, 60000) } };
}

type Calendar = Awaited<ReturnType<typeof planPlayerForecastCalendarWork>>;
export type CalendarRevisionIdentity = { id: string; game_id: number; published_at: string };

/** Reuses consumer eligibility; storage existence and approved baselines cannot certify detailed coverage. */
export async function buildForgeCalendarManifest(args: { options: ForgeCalendarOptions; calendar: Calendar;
  data: PlanningData; revisions: CalendarRevisionIdentity[]; now: Date; origin: string;
  artifact: { codeVersion: string; contentHash: string }; requests: { reads: number; writes: number }; deadlineMs: number }) {
  const { options, calendar, data, now } = args;
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(args.deadlineMs) || args.deadlineMs <= now.getTime()
    || calendar.calendarDays !== options.days
    || calendar.scheduleCoverage.readStatus !== "complete" || args.requests.writes !== 0
    || !Number.isSafeInteger(args.requests.reads) || args.requests.reads < 0 || args.requests.reads > options.limits.maxRequests
    || new Set(args.revisions.map(row => row.id)).size !== args.revisions.length
    || args.revisions.some(row => !options.gameIds.includes(row.game_id) || !row.id || !Number.isFinite(Date.parse(row.published_at)))) {
    throw new Error("Calendar inspection scope or read receipts are inconsistent.");
  }
  const scopes = calendar.scopes.filter(scope => options.gameIds.includes(scope.gameId));
  if (new Set(scopes.map(scope => scope.gameId)).size !== options.gameIds.length) {
    throw new Error("Every requested game must have an eligible canonical calendar scope.");
  }
  const seasons = [...new Set(scopes.map(scope => scope.seasonId))];
  if (seasons.length !== 1 || data.forecastManifest?.seasonId !== seasons[0]
    || Date.parse(data.forecastManifest.asOf) !== now.getTime()) throw new Error("Calendar consumer snapshot is missing or incompatible.");
  if (options.playerIds?.some(id => !data.players.some(player => player.id === id))) {
    throw new Error("Requested canonical player scope is incomplete.");
  }
  // Retain all team goalies while checking competition, even for a selected-player inspection.
  const { summarizeCalendarConsumerCoverage } = await import("../lib/player-forecasts/calendarCoverage");
  const { playerForecastSourcePayloadHash } = await import("../lib/player-forecasts/sourceSnapshot");
  const { validForecastCalendarPolicy } = await import("../lib/player-forecasts/contributions");
  if (!validForecastCalendarPolicy(calendar.calendarPolicy) || calendar.calendarPolicy.calendarDays !== options.days) {
    throw new Error("Calendar scope policy is unsupported or inconsistent.");
  }
  const detailedData = { ...data, baselineSources: [], forecasts: data.forecasts.filter(row => row.sourceKind === "detailed") };
  const startDate = now.toISOString().slice(0, 10);
  const endDate = new Date(Date.parse(`${startDate}T00:00:00Z`) + (options.days - 1) * 86400000).toISOString().slice(0, 10);
  const policyCompatible = JSON.stringify(data.forecastManifest.calendarPolicy) === JSON.stringify(calendar.calendarPolicy);
  const games = options.gameIds.map(gameId => {
    const sides = scopes.filter(scope => scope.gameId === gameId).sort((a, b) => a.teamId - b.teamId);
    if (sides.length !== 2 || new Set(sides.map(side => side.teamId)).size !== 2
      || sides.some(side => side.seasonId !== seasons[0] || side.scheduledStartAt !== sides[0].scheduledStartAt
        || !Number.isFinite(Date.parse(side.scheduledStartAt)) || Date.parse(side.scheduledStartAt) <= now.getTime()
        || !data.games.some(game => game.id === String(gameId) && game.teamAbbreviation === side.teamAbbreviation
          && game.startsAt === side.scheduledStartAt && game.scheduleRevision === side.scheduleRevision && game.status === "scheduled"))) {
      throw new Error("Calendar and consumer schedule identities disagree.");
    }
    const coverage = summarizeCalendarConsumerCoverage(detailedData, sides, options.profile,
      { seasonId: seasons[0], asOf: now.toISOString(), startDate, endDate });
    const latest = args.revisions.filter(row => row.game_id === gameId).sort((a, b) =>
      Date.parse(b.published_at) - Date.parse(a.published_at) || b.id.localeCompare(a.id))[0] ?? null;
    const required = data.players.filter(player => options.playerIds === undefined || options.playerIds.includes(player.id))
      .filter(player => sides.some(side => side.teamId === player.nhlTeamId)).flatMap(player =>
        (player.playerClass === "goalie" ? options.profile.goalieTargets : options.profile.skaterTargets)
          .map(target => ({ playerId: player.id, nhlPlayerId: player.nhlId, teamId: player.nhlTeamId!,
            rosterRevision: player.rosterRevision ?? null, population: player.playerClass, target })))
      .sort((a, b) => Number(a.playerId) - Number(b.playerId) || a.target.localeCompare(b.target));
    // Global competitor coverage is deliberately stricter than a requested-player subset.
    const rows = detailedData.forecasts.filter(row => row.gameId === String(gameId));
    const sameRevision = !!latest && rows.length > 0 && rows.every(row => row.revisionId === latest.id);
    const staleSchedule = calendar.scheduleCoverage.staleGameIds.includes(gameId);
    const eligible = policyCompatible && !staleSchedule && sameRevision && coverage.inputStatus === "complete"
      && coverage.requiredPlayerGameTargets > 0 && coverage.eligiblePlayerGameTargets === coverage.requiredPlayerGameTargets;
    const expiresAt = rows.length && rows.every(row => row.expiresAt && Number.isFinite(Date.parse(row.expiresAt)))
      ? new Date(Math.min(...rows.map(row => Date.parse(row.expiresAt!)))).toISOString() : null;
    return { gameId, seasonId: seasons[0], slateDate: sides[0].gameDate, scheduledStartAt: sides[0].scheduledStartAt,
      sides: sides.map(side => ({ teamId: side.teamId, opponentTeamId: side.opponentTeamId,
        scheduleRevision: side.scheduleRevision, teamGameOrdinal: side.teamGameHorizon, calendarLeadDay: side.calendarLeadDay })),
      expectedPriorRevisionId: latest?.id ?? null, required, coverage, expiresAt,
      decision: eligible ? "skip_eligible_detailed" as const : "requires_generation_or_readiness_repair" as const,
      exclusions: [...(!policyCompatible ? ["horizon_policy_mismatch"] : []), ...(staleSchedule ? ["stale_schedule"] : []),
        ...(!sameRevision ? ["no_eligible_current_revision"] : [])] };
  });
  const unsigned = { version: "forge-calendar-scope-v1" as const, mode: "read_only" as const,
    allowedActions: ["inspect"] as const, origin: args.origin, capturedAt: now.toISOString(),
    deadlineAt: new Date(args.deadlineMs).toISOString(),
    calendarPolicy: calendar.calendarPolicy, profile: options.profile, playerIds: options.playerIds ?? null,
    artifact: args.artifact, limits: options.limits, requests: args.requests,
    context: { manifestId: data.forecastManifest.id, scheduleRevision: data.forecastManifest.scheduleRevision,
      rosterRevision: data.forecastManifest.rosterRevision, acceptedNewsRevision: data.forecastManifest.acceptedNewsRevision ?? null,
      consumerCalendarPolicy: data.forecastManifest.calendarPolicy ?? null },
    scheduleCoverage: calendar.scheduleCoverage, workload: calendar.workload, games,
    consistency: "bounded_independent_reads" as const, recommendationReadiness: "not_evaluated" as const,
    limitations: ["This scope does not authorize writes, release a source or prove current NHL population completeness.",
      "Serving flags/canaries remain authoritative; excluded research or conditional data is not made eligible.",
      "Selected-player requirements are retained; skip eligibility includes every stored competitor on both game sides.",
      "Revalidate inputs, prior revisions, artifact and shared budgets before a future execution/resume."] };
  return { ...unsigned, checksum: playerForecastSourcePayloadHash(unsigned) };
}

function save(directory: string, name: string, value: unknown) {
  const fd = openSync(resolve(directory, name), "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(value, null, 2)); fsyncSync(fd); } finally { closeSync(fd); }
}

/** The independent guardian survives coordinator death, including during synchronous child work. */
export async function superviseForgeProcess(args: { argv: string[]; cwd: string; out: string; deadlineMs: number;
  signal?: AbortSignal; environment?: NodeJS.ProcessEnv; maxLogBytes?: number;
  beforeStart?: (pid: number, guardian: ForgeProcessGuardianIdentity) => void }) {
  if (!Number.isFinite(args.deadlineMs) || args.deadlineMs <= Date.now() || args.signal?.aborted) {
    throw new Error("Local FORGE supervision cancelled or exhausted before spawn.");
  }
  if (process.platform === "win32") throw new Error("Local FORGE supervision requires POSIX process groups.");
  const started = Date.now(), maximum = args.maxLogBytes ?? 1024 * 1024;
  if (!Number.isSafeInteger(maximum) || maximum < 1) throw new Error("Invalid supervision log bound.");
  const log = openSync(resolve(args.out, "process.log"), "wx", 0o600);
  try {
    return await new Promise<{ outcome: "succeeded" | "failed" | "deadline" | "cancelled" | "output_limit" | "log_failure";
      pid: number | null; guardian: ForgeProcessGuardianIdentity | null; code: number | null; signal: NodeJS.Signals | null;
      durationMs: number; logBytes: number }>((resolveResult, reject) => {
      const token = randomUUID(), protocol = FORGE_PROCESS_GUARDIAN_PROTOCOL;
      const child = spawn(process.execPath, ["-e", `(${runForgeProcessGuardian.toString()})(${JSON.stringify(protocol)})`], { cwd: args.cwd,
        env: { ...(args.environment ?? process.env), FORGE_PROCESS_GUARDIAN_TOKEN: token, FORGE_CALENDAR_START_TOKEN: "" },
        detached: true, stdio: ["ignore", "pipe", "pipe", "ipc"] });
      const guardian: ForgeProcessGuardianIdentity | null = child.pid ? { pid: child.pid, hostname: hostname(), protocol,
        nonceHash: createHash("sha256").update(token).digest("hex") } : null;
      let reason: "deadline" | "cancelled" | "output_limit" | "log_failure" | undefined, bytes = 0, activated = false;
      let pid: number | null = null, terminal: { code: number | null; signal: NodeJS.Signals | null } | null = null;
      const send = (message: object) => {
        if (!child.connected) return;
        child.send({ ...message, token, protocol }, error => { if (error && !reason) reason = "log_failure"; });
      };
      const stop = (next: NonNullable<typeof reason>) => {
        if (reason) return;
        reason = next; send({ type: "forge-guardian-stop", reason: next });
      };
      const cancelled = () => stop("cancelled");
      const timer = setTimeout(() => stop("deadline"), Math.max(0, args.deadlineMs - Date.now()));
      const cleanup = () => { clearTimeout(timer);
        args.signal?.removeEventListener("abort", cancelled); };
      child.on("message", (value: any) => {
        if (value?.token !== token || value.protocol !== protocol) return;
        if (value.type === "forge-guardian-spawned" && pid === null && Number.isSafeInteger(value.pid) && value.pid > 0) pid = value.pid;
        if (value.type === "forge-guardian-terminal" && value.pid === pid) terminal = { code: value.code, signal: value.signal };
        if (value.type === "forge-guardian-stopped" && ["deadline", "cancelled", "output_limit", "log_failure"].includes(value.reason)) {
          reason ??= value.reason;
        }
        if (!args.beforeStart || reason || activated || value.type !== "forge-guardian-ready" || value.pid !== pid || !pid || !guardian) return;
        try {
          if (Date.now() >= args.deadlineMs || args.signal?.aborted) { stop("deadline"); return; }
          args.beforeStart(pid, guardian); // Flush the worker and guardian identities before granting I/O.
          if (Date.now() >= args.deadlineMs || args.signal?.aborted) { stop("deadline"); return; }
          activated = true; send({ type: "forge-guardian-start" });
        } catch { stop("log_failure"); }
      });
      const output = (buffer: Buffer) => {
        const length = Math.min(buffer.length, maximum - bytes);
        if (length > 0) {
          try { writeFileSync(log, new Uint8Array(buffer.subarray(0, length))); bytes += length; }
          catch { stop("log_failure"); return; }
        }
        if (buffer.length > length) stop("output_limit");
      };
      child.stdout!.on("data", output); child.stderr!.on("data", output);
      child.once("error", error => { cleanup(); reject(error); });
      child.once("close", () => {
        cleanup();
        const cleanupDeadline = Date.now() + 1000;
        const groupStopped = () => {
          let unresolved = false;
          if (guardian) {
            try { process.kill(-guardian.pid, 0); unresolved = true; }
            catch (error) { unresolved = (error as NodeJS.ErrnoException).code !== "ESRCH"; }
          }
          if (unresolved && Date.now() < cleanupDeadline) { setTimeout(groupStopped, 25); return; }
          resolveResult({ outcome: reason ?? (!unresolved && terminal?.code === 0 ? "succeeded" : "failed"),
            pid, guardian, code: terminal?.code ?? null, signal: terminal?.signal ?? null, durationMs: Date.now() - started, logBytes: bytes });
        };
        groupStopped(); // Observe only; a reused or foreign group is never signalled by the coordinator.
      });
      send({ type: "forge-guardian-init", guardianPid: child.pid, parentPid: process.pid, argv: args.argv, cwd: args.cwd,
        deadlineMs: args.deadlineMs, maxLogBytes: maximum, requireStart: !!args.beforeStart });
      args.signal?.addEventListener("abort", cancelled, { once: true });
      if (args.signal?.aborted) cancelled();
    });
  } finally { fsyncSync(log); closeSync(log); }
}

async function inspect(options: ForgeCalendarOptions) {
  await awaitForgeCalendarGrant();
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(resolve(__dirname, ".."), true, { info() {}, error() {} });
  const started = Date.now(), intent = JSON.parse(readFileSync(resolve(options.out, "intent.json"), "utf8"));
  const deadlineMs = Date.parse(intent.startedAt) + options.limits.runtimeMs;
  if (intent.version !== "forge-calendar-inspection-v1" || !Number.isFinite(deadlineMs) || deadlineMs <= started) {
    throw new Error("Calendar inspection intent or deadline is unavailable.");
  }
  const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  if ((!origin.startsWith("https://") && !origin.startsWith("http://localhost:")) || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Local Supabase configuration is unavailable.");
  }
  const { guardedForgeFetch } = await import("./run-forge-local");
  const requests = { reads: 0, writes: 0, readMs: 0, writeMs: 0, acknowledgedWrites: 0, rejectedWrites: 0, unknownWrites: 0 };
  const transport = globalThis.fetch;
  globalThis.fetch = (input, init) => guardedForgeFetch(input, init, origin, false, transport, requests,
    { deadlineMs, maxWrites: 0, maxRequests: options.limits.maxRequests, requestTimeoutMs: options.limits.requestTimeoutMs });
  try {
    const artifactBytes = readFileSync(options.artifact), artifact = JSON.parse(artifactBytes.toString());
    const { codeVersion, ...unsigned } = artifact;
    if (artifact.version !== "forge-local-artifact-v1" || codeVersion !== `local:${hash(JSON.stringify(unsigned))}`) {
      throw new Error("Reviewed FORGE artifact is missing or inconsistent.");
    }
    const db = (await import("../lib/supabase/server")).default as any;
    const { planPlayerForecastCalendarWork } = await import("../lib/player-forecasts/orchestration");
    const { loadPlanningData } = await import("../lib/rosterScheduleData/planning");
    const { readForecastScopeRows } = await import("../lib/player-forecasts/scopeReads");
    const now = new Date();
    const calendar = await planPlayerForecastCalendarWork({ supabase: db, now, days: options.days });
    const seasons = [...new Set(calendar.scopes.filter(scope => options.gameIds.includes(scope.gameId)).map(scope => scope.seasonId))];
    if (seasons.length !== 1) throw new Error("Calendar game scope is incomplete or spans seasons.");
    const startDate = now.toISOString().slice(0, 10);
    const endDate = new Date(Date.parse(`${startDate}T00:00:00Z`) + (options.days - 1) * 86400000).toISOString().slice(0, 10);
    const data = await loadPlanningData(db, { seasonId: seasons[0], startDate, endDate, timeZone: "UTC" }, { now });
    const revisions = await readForecastScopeRows<CalendarRevisionIdentity>({ key: "id", maximum: 10000, deadlineMs,
      build: () => db.from("forge_game_revisions").select("id,game_id,published_at", { count: "exact" })
        .in("game_id", options.gameIds).order("game_id").order("published_at", { ascending: false }).order("id", { ascending: false }) });
    if (hash(new Uint8Array(readFileSync(options.artifact))) !== hash(new Uint8Array(artifactBytes))) {
      throw new Error("Reviewed artifact changed during scope inspection.");
    }
    const manifest = await buildForgeCalendarManifest({ options, calendar, data, revisions, now, origin,
      artifact: { codeVersion, contentHash: hash(new Uint8Array(artifactBytes)) }, requests, deadlineMs });
    save(options.out, "scope.json", manifest);
    save(options.out, "inspection.json", { status: "inspected", mode: "read_only", requests,
      checksum: manifest.checksum, durationMs: Date.now() - started });
  } catch (error) {
    save(options.out, "inspection.json", { status: "incomplete", mode: "read_only", requests,
      durationMs: Date.now() - started, detail: "Inspect local scope/configuration and retained process log; no writes were enabled." });
    throw error;
  } finally { globalThis.fetch = transport; }
}

async function main() {
  if (process.argv.includes("--help")) { console.log(usage); return; }
  if (process.argv.includes("--recover")) {
    const { runForgeCalendarRecovery, parseForgeCalendarRecoveryArgs } = await import("./forge-calendar-execution");
    await runForgeCalendarRecovery(parseForgeCalendarRecoveryArgs(process.argv.slice(2)));
    return;
  }
  if (process.argv.includes("--write")) {
    const { runForgeCalendarExecution, parseForgeCalendarExecutionArgs } = await import("./forge-calendar-execution");
    await runForgeCalendarExecution(parseForgeCalendarExecutionArgs(process.argv.slice(2)));
    return;
  }
  const options = parseForgeCalendarArgs(process.argv.slice(2));
  if (options.inspect) { await inspect(options); return; }
  const started = Date.now(), repo = realpathSync(resolve(__dirname, "../.."));
  const parent = realpathSync(resolve(options.out, ".."));
  if (parent === repo || parent.startsWith(`${repo}${sep}`) || existsSync(options.out)) {
    throw new Error("Use a new private receipt directory outside the repository.");
  }
  mkdirSync(options.out, { mode: 0o700 });
  const artifactBytes = readFileSync(options.artifact);
  const artifactPath = resolve(options.out, "reviewed-code.json");
  const artifactFd = openSync(artifactPath, "wx", 0o600);
  try { writeFileSync(artifactFd, new Uint8Array(artifactBytes)); fsyncSync(artifactFd); } finally { closeSync(artifactFd); }
  save(options.out, "intent.json", { version: "forge-calendar-inspection-v1", options, startedAt: new Date(started).toISOString(),
    artifactHash: hash(new Uint8Array(artifactBytes)), inspectionScriptHash: hash(new Uint8Array(readFileSync(__filename))) });
  const controller = new AbortController(), cancel = () => controller.abort();
  process.once("SIGINT", cancel); process.once("SIGTERM", cancel);
  try {
    const argv = process.argv.slice(2);
    argv[argv.indexOf("--artifact") + 1] = artifactPath;
    const result = await superviseForgeProcess({ argv: [...process.execArgv, __filename, ...argv, "--inspect"],
      cwd: resolve(__dirname, ".."), out: options.out, deadlineMs: started + options.limits.runtimeMs, signal: controller.signal });
    save(options.out, "receipt.json", { version: "forge-calendar-inspection-v1", mode: "read_only", ...result,
      scopePath: result.outcome === "succeeded" ? resolve(options.out, "scope.json") : null,
      writesEnabled: false, automaticRetryAllowed: false });
    console.log(JSON.stringify({ receipt: resolve(options.out, "receipt.json"), outcome: result.outcome, writesEnabled: false }));
    if (result.outcome !== "succeeded") process.exitCode = 1;
  } finally { process.removeListener("SIGINT", cancel); process.removeListener("SIGTERM", cancel); }
}

if (require.main === module) main().catch(() => {
  console.error("Local calendar operation failed; inspect private receipts before retrying. No automatic retry was started.");
  process.exitCode = 1;
});
