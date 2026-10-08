import { readFileSync, writeFileSync, mkdirSync, statSync, openSync, fsyncSync, closeSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { projectionInputHash } from "../lib/projections/inputCapture";
import { TEAM_GOALS_FEATURES, TEAM_GOALS_PARAMETERS, TEAM_GOALS_VERSION, type ModelFreeze } from "../lib/forecast-diagnostics/pairedInputs";
import { assembleFrozenPairFromCapture, computeFrozenPair, frozenPairSchema, frozenPairDiagnosticReport, verifyPairReplay, type FrozenPair, type FrozenPairOutput } from "../lib/forecast-diagnostics/frozenPairRunner";
import { forecastDiagnosticsJson, forecastDiagnosticsMarkdown } from "../lib/forecast-diagnostics/contract";
import { GAME_FORECAST_CONTRACT_VERSION } from "../lib/player-forecasts/gameContract";

const MAX_BYTES = 32 * 1024 * 1024;
const digest = (bytes: Buffer) => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
function readBytes(path: string) {
  if (statSync(path).size > MAX_BYTES) throw new Error("Private input exceeds 32 MiB bound");
  const bytes = readFileSync(path);
  if (bytes.length > MAX_BYTES) throw new Error("Private input exceeds 32 MiB bound");
  return bytes;
}
const readJson = (path: string) => JSON.parse(readBytes(path).toString("utf8"));

/** Pins all committed application source plus the installed dependency lock and runtime. Requires a clean committed checkout. */
export function executionFreeze(packet: Pick<FrozenPair, "forgeSnapshot">): { team: ModelFreeze; forge: ModelFreeze } {
  const root = resolve(__dirname, "../..");
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  if (git("status", "--porcelain", "--untracked-files=all")) throw new Error("Freeze requires a clean committed checkout");
  const commit = git("rev-parse", "HEAD");
  const sourceTreeHash = projectionInputHash(git("ls-tree", "-r", "HEAD", "web"));
  const lockfileHash = digest(readFileSync(join(root, "web/package-lock.json")));
  const common = { codeCommit: commit, sourceTreeHash, lockfileHash, nodeVersion: process.version };
  const team: ModelFreeze = { ...common, modelVersion: TEAM_GOALS_VERSION, featureSchemaVersion: TEAM_GOALS_VERSION,
    featureNames: [...TEAM_GOALS_FEATURES], parameters: TEAM_GOALS_PARAMETERS,
    parametersHash: projectionInputHash(TEAM_GOALS_PARAMETERS), calibration: { kind: "none" } };
  const parameters = { environment: packet.forgeSnapshot.modelEnvironment ?? null, modelMode: packet.forgeSnapshot.modelMode,
    accountingContractVersion: GAME_FORECAST_CONTRACT_VERSION,
    nativeGoalAccountingVersion: "forge-native-goal-accounting-v1",
    deterministicSeed: packet.forgeSnapshot.deterministicSeed ?? null, seasonBootstrapApplied: packet.forgeSnapshot.seasonBootstrapApplied ?? false,
    weightsSourceHash: digest(readFileSync(join(root, "web/lib/projections/constants/projection-weights.ts"))) };
  const forge: ModelFreeze = { ...common, modelVersion: `forge-native-${packet.forgeSnapshot.modelMode}`,
    featureSchemaVersion: "forge-recorded-queries-v1", featureNames: packet.forgeSnapshot.reads.map((read, index) => `${index}:${projectionInputHash(read.request)}`),
    parameters, parametersHash: projectionInputHash(parameters), calibration: { kind: "none" } };
  return { team, forge };
}

/** Process-local denial, installed before importing the native scorer. No live DB client is constructed during replay. */
export function denyNetwork() {
  const denied = () => { throw new Error("Network is disabled in frozen replay"); };
  globalThis.fetch = denied as typeof fetch;
  for (const [module, names] of [["node:http", ["request", "get"]], ["node:https", ["request", "get"]],
    ["node:net", ["connect", "createConnection"]], ["node:tls", ["connect"]],
    ["node:dns", ["lookup", "resolve"]]] as const) {
    const api = require(module);
    for (const name of names) api[name] = denied;
  }
  require("node:net").Socket.prototype.connect = denied;
}

async function worker(packetPath: string) {
  denyNetwork();
  const packet = frozenPairSchema.parse(readJson(packetPath));
  // Only non-secret model settings are restored. The worker inherits no service credentials.
  for (const [key, value] of Object.entries(packet.forgeSnapshot.modelEnvironment ?? {})) {
    if (!["FORGE_SKATER_MODEL_MODE", "NHL_XG_TEAM_AGGREGATE_MODEL_VERSION", "NHL_XG_TEAM_AGGREGATE_FEATURE_VERSION",
      "NHL_XG_TEAM_AGGREGATE_WINDOW_GAMES", "NHL_XG_MODEL_VERSION", "START_CHART_GAME_REVISIONS",
      "STARTER_BOARD_COMPUTE_ENABLED", "STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED"].includes(key)) throw new Error("Unexpected model environment key");
    if (value === null) delete process.env[key]; else process.env[key] = value;
  }
  process.env.STARTER_BOARD_CAPTURE_ENABLED = "true";
  const { scoreFrozenForgeSnapshot } = await import("../lib/projections/run-forge-projections");
  let nativeExecutionWrites: unknown;
  const forecasts = await computeFrozenPair(packet, executionFreeze(packet), { forge: scoreFrozenForgeSnapshot,
    retainExecutionWrites: writes => { nativeExecutionWrites = writes; } });
  process.send?.({ forecasts, nativeExecutionWrites });
}

/** Hard deadline is enforced by killing the child, not by an uncancelled Promise race. */
export function boundedWorker(packetPath: string, timeoutMs = 120_000): Promise<any> {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 600_000) throw new Error("Invalid bounded runner timeout");
  const web = resolve(__dirname, "..");
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, ["-r", "ts-node/register/transpile-only", __filename, "--worker", packetPath], {
      cwd: web, env: { NODE_ENV: "test", PATH: process.env.PATH, NODE_PATH: web,
        // Import-time public client constructors need strings. These inert values grant no access; all network remains denied.
        NEXT_PUBLIC_SUPABASE_URL: "https://frozen-replay.invalid", NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: "offline-constructor-placeholder",
        TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node"}' },
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    });
    let message: any, stderr = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Frozen runner exceeded hard deadline")); }, timeoutMs);
    child.stderr?.on("data", data => { stderr = (stderr + String(data)).slice(-4000); });
    child.on("message", value => { message = value; });
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("exit", code => {
      clearTimeout(timer);
      if (code === 0 && message?.forecasts) resolveResult(message);
      else reject(new Error(`Frozen runner failed (${code}): ${stderr}`));
    });
  });
}

export async function runFrozenPairCommand(args: string[]) {
  const [mode, input, third, fourth] = args;
  if (mode === "--worker") return worker(input);
  if (!["prepare", "freeze", "issue", "replay"].includes(mode) || !input || !third
    || args.length !== (mode === "prepare" ? 4 : 3))
    throw new Error("Usage: run-frozen-forecast-pair.ts prepare CAPTURE_JSON HISTORY_JSON EXCLUSIVE_OUTPUT_DIRECTORY | freeze|issue|replay INPUT_JSON EXCLUSIVE_OUTPUT_DIRECTORY");
  const captureBytes = mode === "prepare" ? readBytes(input) : null;
  const historyBytes = mode === "prepare" ? readBytes(third) : null;
  let packet: FrozenPair;
  if (captureBytes && historyBytes) {
    const capture = JSON.parse(captureBytes.toString("utf8"));
    const snapshot = frozenPairSchema.shape.forgeSnapshot.parse(capture.snapshot);
    packet = assembleFrozenPairFromCapture(capture, JSON.parse(historyBytes.toString("utf8")), executionFreeze({ forgeSnapshot: snapshot }));
  } else packet = frozenPairSchema.parse(readJson(input));
  if (Buffer.byteLength(JSON.stringify(packet)) > MAX_BYTES) throw new Error("Private paired packet exceeds 32 MiB bound");
  const output = mode === "prepare" ? fourth : third;
  const destination = resolve(output);
  mkdirSync(destination, { mode: 0o700 }); // Exclusive directory: never overwrite an original or retry into the same packet.
  const saveText = (name: string, value: string) => {
    const fd = openSync(join(destination, name), "wx", 0o600);
    try { writeFileSync(fd, value); fsyncSync(fd); } finally { closeSync(fd); }
    const directory = openSync(destination, "r");
    try { fsyncSync(directory); } finally { closeSync(directory); }
  };
  const save = (name: string, value: unknown) => saveText(name, JSON.stringify(value, null, 2) + "\n");
  const saveReport = (forecasts: FrozenPairOutput, issuedAt: string, verified: boolean) => {
    const report = frozenPairDiagnosticReport(packet, forecasts, issuedAt, verified);
    saveText("diagnostics.json", forecastDiagnosticsJson(report));
    saveText("diagnostics.md", forecastDiagnosticsMarkdown(report));
  };
  if (mode === "prepare" && captureBytes && historyBytes) {
    saveText("capture.json", captureBytes.toString("utf8"));
    saveText("history.json", historyBytes.toString("utf8"));
    save("inputs.json", packet);
    save("manifest.json", { inputHash: projectionInputHash(packet), status: "inputs_frozen", acceptanceEligible: false,
      captureHash: digest(captureBytes), historyHash: digest(historyBytes) });
    return;
  }
  if (mode === "freeze") {
    const freeze = executionFreeze(packet);
    const frozen = { ...packet, teamFreeze: freeze.team, forgeFreeze: freeze.forge, frozenAt: new Date().toISOString() };
    // Native snapshot codeVersion is an acquisition claim and must already match; never relabel it here.
    const { validateFrozenPair } = await import("../lib/forecast-diagnostics/frozenPairRunner");
    validateFrozenPair(frozen, freeze);
    save("inputs.json", frozen);
    save("manifest.json", { inputHash: projectionInputHash(frozen), status: "inputs_frozen", acceptanceEligible: false });
    return;
  }
  if (mode === "issue" && (Date.now() < Date.parse(packet.scope.cutoffAt) || Date.now() >= Date.parse(packet.scope.startAt)))
    throw new Error("Original issuance must actually occur at/after cutoff and before puck drop");
  if (mode === "issue") {
    const manifest = readJson(join(resolve(input, ".."), "manifest.json"));
    if (manifest.status !== "inputs_frozen" || manifest.inputHash !== projectionInputHash(packet)) throw new Error("Unsealed or changed frozen inputs");
  }
  save("dispatch.json", { pairId: packet.pairId, mode, dispatchedAt: new Date().toISOString(), inputHash: projectionInputHash(packet), status: "dispatched" });
  try {
    if (mode === "replay" && existsSync(join(resolve(input, ".."), "failed.json")))
      throw new Error("Failed original issuance cannot be replayed as an issued forecast");
    const result = await boundedWorker(resolve(input));
    const { forecasts } = result;
    save("execution-writes.json", { recordedAt: new Date().toISOString(), writes: result.nativeExecutionWrites });
    if (mode === "issue") {
      const issuedAt = new Date().toISOString();
      if (Date.parse(issuedAt) < Date.parse(packet.scope.cutoffAt)) throw new Error("Clock moved before the issuance cutoff");
      if (Date.parse(issuedAt) >= Date.parse(packet.scope.startAt)) throw new Error("Computation missed pregame issuance");
      save("original.json", { issuedAt, inputHash: projectionInputHash(packet), forecastHash: projectionInputHash(forecasts), forecasts });
      save("inputs.json", packet);
      saveReport(forecasts, issuedAt, false);
    } else {
      const original = readJson(join(resolve(input, ".."), "original.json"));
      if (typeof original.issuedAt !== "string" || !Number.isFinite(Date.parse(original.issuedAt))
        || Date.parse(original.issuedAt) < Date.parse(packet.scope.cutoffAt) || Date.parse(original.issuedAt) >= Date.parse(packet.scope.startAt))
        throw new Error("Preserved original has invalid issuance time");
      save("replay.json", { replayedAt: new Date().toISOString(), ...verifyPairReplay(original, packet, forecasts) });
      saveReport(forecasts, original.issuedAt, true);
    }
  } catch (error) {
    save("failed.json", { status: "failed", failedAt: new Date().toISOString(), reason: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}
if (require.main === module) runFrozenPairCommand(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
