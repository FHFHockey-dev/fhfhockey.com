// @vitest-environment node
import { execFile, execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const WEB = resolve(__dirname, "..");
const adapter = join(__dirname, "forge-pregame-host.py");
const gameId = "2026020329";
const nextGameId = "2026020330";
const start = "2026-11-16T02:00:00Z";
const preload = "./node_modules/ts-node/register/transpile-only";
const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })));

// Each process uses the real execute wiring and verifier with a disk-backed copy of the existing fake custody database.
// The node shim changes only the process entry, so a mistaken live call in this rehearsal cannot reach a provider.
const fixture = String.raw`
const fs = require("node:fs");
const path = require("node:path");
const { executeSlate, parseSlateArgs, shellLoadGate } = require(path.resolve("scripts/forge-pregame-slate.ts"));
const { SlateSim } = require(path.resolve("lib/projections/pregameCapture/slateSimulator.ts"));
const { reverifyStoredWitness } = require(path.resolve("lib/projections/pregameCapture/verifier.ts"));
const { testTsaTrust } = require(path.resolve("lib/projections/pregameCapture/__fixtures__/testTsa.ts"));
const wakeNow = require(process.env.FORGE_HOST_TEST_CLOCK);
const dir = process.env.FORGE_HOST_TEST_DIR;
const marker = path.join(dir, "entered");
globalThis.fetch = () => { process.exit(71); };

function custodyPath(gameId) { return path.join(dir, "custody-" + gameId + ".json"); }

function load(store) {
  if (!fs.existsSync(store)) return null;
  return JSON.parse(fs.readFileSync(store, "utf8"), (_, value) => {
    if (value?.type === "Buffer") return Buffer.from(value.data);
    if (value?.bigint) return BigInt(value.bigint);
    return value;
  });
}

async function main() {
  if (process.argv[2] === "readback") {
    const { game, clock, state } = load(custodyPath(process.argv[3]));
    const sim = new SlateSim(clock);
    const db = sim.addGame(game);
    for (const key of ["claims", "artifacts", "witnesses", "outcomes"]) db[key] = new Map(state[key]);
    const row = await db.rpc().read(process.argv[4]);
    console.log(JSON.stringify({ gameId: row.gameId, policyId: row.policyId, codeVersion: row.codeVersion,
      outcome: row.outcome, scheduledStart: new Date(row.scheduledStart).toISOString(), artifactPresent: row.artifactPresent,
      saveFenced: row.saveFenced, hashesAgree: row.rawSha256 === row.storedRawSha256,
      ...reverifyStoredWitness(row, testTsaTrust()) }));
    return;
  }
  const options = parseSlateArgs(process.argv.slice(2));
  const game = { gameId: options.games[0].gameId, start: options.games[0].scheduledStart, slateDate: options.slateDate };
  const store = custodyPath(game.gameId);
  const existing = load(store);
  const scenario = process.env.FORGE_HOST_TEST_SCENARIO;
  const sim = new SlateSim(wakeNow(game.start));
  const db = sim.addGame(game, scenario === "stop" ? { transportRefusal: "postgres:57014" } : {});
  const maps = ["claims", "artifacts", "witnesses", "outcomes"];
  for (const key of maps) db[key] = new Map(existing?.state[key]);
  db.calls = existing?.calls ?? [];
  function save() {
    const state = Object.fromEntries(maps.map((key) => [key, [...db[key]]]));
    fs.writeFileSync(store, JSON.stringify({ game, clock: sim.clock.ms, state, calls: db.calls },
      (_, value) => typeof value === "bigint" ? { bigint: String(value) } : value));
  }
  if (scenario === "hold") {
    fs.writeFileSync(marker, "ready");
    while (!fs.existsSync(path.join(dir, "release"))) await new Promise((resolve) => setTimeout(resolve, 10));
  }
  if (scenario === "crash") db.hooks.afterSaveCommit = () => { save(); process.kill(process.pid, "SIGKILL"); };
  const gate = await shellLoadGate(options.gate)(sim.slate()[0]);
  const deps = sim.executorDeps();
  let lookupFailures = scenario === "recovery" ? 3 : 0;
  const baseLookup = deps.custody.lookup;
  deps.custody.lookup = async (...args) => {
    if (lookupFailures-- > 0) throw new Error("injected custody lookup failure");
    return baseLookup(...args);
  };
  const settled = await sim.clock.drive(executeSlate(options, process.env, async () => ({
    custody: deps.custody, captureDeps: deps.captureDeps, now: deps.now, sleepUntil: deps.sleepUntil,
    refreshSlate: async () => sim.slate(), loadGate: async () => gate,
  })));
  if (!settled.settled) throw new Error("fixture stalled");
  save();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
`;

function invoke(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<{ code: number; status: Record<string, unknown> }>((done, fail) => {
    execFile(command, args, { cwd: WEB, env, timeout: 15_000 }, (error, stdout, stderr) => {
      try {
        done({ code: error?.code === undefined ? 0 : Number(error.code), status: JSON.parse(stdout) });
      } catch {
        fail(new Error(`No host result. ${String(error)}\n${stderr}`));
      }
    });
  });
}

function setup(gateBody = "exit 0\n") {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "forge-pregame-host-")));
  directories.push(dir);
  const gate = join(dir, "gate.zsh");
  const entry = join(dir, "fixture.cjs");
  const clock = join(dir, "clock.cjs");
  const state = join(dir, "state");
  const checkout = join(dir, "candidate");
  const candidateWeb = join(checkout, "web");
  const candidateAdapter = join(candidateWeb, "scripts", "forge-pregame-host.py");
  const candidateEntry = join(candidateWeb, "scripts", "forge-pregame-slate.ts");
  mkdirSync(join(candidateWeb, "scripts"), { recursive: true });
  copyFileSync(adapter, candidateAdapter);
  copyFileSync(join(__dirname, "forge-pregame-slate.ts"), candidateEntry);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: checkout, encoding: "utf8",
    env: { NODE_ENV: "test", PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" } }).trim();
  git("init", "-q", "--template=");
  git("add", "web/scripts");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "candidate");
  const sha = git("rev-parse", "HEAD");
  writeFileSync(gate, gateBody);
  writeFileSync(entry, fixture);
  writeFileSync(clock, `
const minutes = { early: 120, late: 59, recovery: 59 };
module.exports = (start) => Date.parse(start) - (minutes[process.env.FORGE_HOST_TEST_SCENARIO] ?? 75) * 60_000;
if (process.argv[1]?.includes("@")) Date.now = () => module.exports(process.argv[1].split("@")[1]);
`);
  writeFileSync(join(dir, "node"), `#!/bin/sh
[ "$PWD" = "$FORGE_HOST_TEST_CANDIDATE_WEB" ] || exit 70
cd "$FORGE_HOST_TEST_WEB" || exit 70
if [ "$3" = "-e" ]; then
  shift 3
  exec "$FORGE_HOST_REAL_NODE" -r ${preload} -r "$FORGE_HOST_TEST_CLOCK" -e "$@"
fi
shift 3
exec "$FORGE_HOST_REAL_NODE" -r ${preload} "$FORGE_HOST_TEST_ENTRY" "$@"
`, { mode: 0o700 });
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    PATH: `${dir}:${process.env.PATH}`,
    FORGE_HOST_REAL_NODE: process.execPath, FORGE_HOST_TEST_ENTRY: entry, FORGE_HOST_TEST_DIR: dir,
    FORGE_HOST_TEST_WEB: WEB, FORGE_HOST_TEST_CANDIDATE_WEB: candidateWeb, FORGE_HOST_TEST_CLOCK: clock,
    FORGE_PREGAME_CAPTURE_ENABLED: "true",
    TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node"}',
  };
  const args = [candidateAdapter, "--slate", "2026-11-15", "--sha", sha, "--host", hostname(), "--gate", gate, "--state", state];
  const custodyPath = (id: string) => join(dir, `custody-${id}.json`);
  return {
    dir, sha, candidateEntry,
    attempts: (id = gameId) => {
      const game = join(state, `game-${id}`);
      return existsSync(game) ? readdirSync(game).filter((name) => name.startsWith("attempt-")) : [];
    },
    wake: (scenario = "normal", extra: string[] = [], id = gameId) => {
      const approval = `fixture-approval-${id}`;
      return invoke("python3", [...args, "--game", `${id}@${start}`, "--confirm-game", id, "--approval", approval, ...extra],
        { ...env, FORGE_HOST_TEST_SCENARIO: scenario, FORGE_PREGAME_CAPTURE_APPROVAL: approval });
    },
    custody: (id = gameId) => JSON.parse(readFileSync(custodyPath(id), "utf8")),
    hasCustody: (id = gameId) => existsSync(custodyPath(id)),
    readback: (claimId: string) => invoke(process.execPath, ["-r", preload, entry, "readback", gameId, claimId], env),
  };
}

describe("portable FORGE host rehearsal", () => {
  it("runs the operator load gate with the host's pinned psql and refuses a busy or unavailable database", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-gate-"));
    directories.push(dir);
    const binary = join(dir, "host psql");
    const envFile = join(dir, "fixture.env");
    writeFileSync(envFile, "NEXT_PUBLIC_SUPABASE_URL=https://127.0.0.1\nSUPABASE_DB_URL=postgres://fixture@127.0.0.1/fixture\n");
    writeFileSync(binary, '#!/bin/sh\ncase "$*" in *"begin read only;"*) ;; *) exit 2;; esac\necho "$FIXTURE_LOAD"\n', { mode: 0o700 });
    const gate = resolve(WEB, "../tasks/artifacts/forge-pregame-capture-2026-11-14/operator/gate.sh");
    const run = (load: string, psql = binary) => spawnSync("/bin/zsh", [gate], { encoding: "utf8",
      env: { NODE_ENV: "test", PATH: process.env.PATH, PGPOOL_HOST: "127.0.0.1", TSA_HOST: "127.0.0.1",
        FHFH_ENV_FILE: envFile, FHFH_PSQL_BIN: psql, FIXTURE_LOAD: load } });
    expect(run("1 2 0")).toMatchObject({ status: 0, stdout: expect.stringContaining("gate ok") });
    expect(run("6 2 0")).toMatchObject({ status: 7, stderr: expect.stringContaining("busy") });
    expect(run("1 2 0", join(dir, "missing"))).toMatchObject({ status: 7, stderr: expect.stringContaining("database check did not answer") });
  });

  it("serializes duplicate wakes, retains the terminal receipt, and reads the witness back in a fresh process", async () => {
    const host = setup();
    const active = host.wake("hold");
    try {
      await expect.poll(() => existsSync(join(host.dir, "entered")), { timeout: 8_000 }).toBe(true);
      expect(await host.wake()).toEqual({ code: 0, status: { status: "in_progress" } });
      expect(await host.wake("normal", [], nextGameId)).toEqual({ code: 0, status: { status: "in_progress" } });
    } finally {
      writeFileSync(join(host.dir, "release"), "");
    }
    const terminal = await active;
    expect(terminal).toMatchObject({ code: 0, status: { status: "terminal", outcome: "qualified", claimId: "claim-1" } });
    expect(await host.wake("late")).toEqual(terminal);
    expect(host.custody().calls.filter((call: string) => call === "claim" || call === "save")).toEqual(["claim", "save"]);
    expect(await host.readback("claim-1")).toMatchObject({ code: 0, status: { gameId: Number(gameId), policyId: "pregame-native-v1",
      codeVersion: host.sha, outcome: "qualified", scheduledStart: new Date(start).toISOString(), artifactPresent: true,
      saveFenced: false, hashesAgree: true, withinDeadline: true } });
    expect(await host.wake("normal", ["--host", "unapproved.example"])).toMatchObject({ code: 1, status: { status: "refused" } });
    expect(await host.wake("normal", ["--sha", "b".repeat(40)])).toMatchObject({ code: 1, status: { status: "refused" } });
    expect(await host.wake("normal", [], nextGameId)).toMatchObject({ code: 0, status: { status: "terminal",
      gameId: Number(nextGameId), outcome: "qualified" } });
    expect(host.custody(nextGameId).calls.filter((call: string) => call === "claim" || call === "save")).toEqual(["claim", "save"]);
  }, 20_000);

  it("reconciles a killed process after save from custody without a second claim or witness", async () => {
    const host = setup();
    expect(await host.wake("crash")).toMatchObject({ code: 1, status: { status: "resume_required", childStatus: -9 } });
    expect(await host.wake("normal", [], nextGameId)).toMatchObject({ code: 1, status: { status: "slate_custody_unresolved",
      priorGameId: Number(gameId) } });
    expect(host.attempts(nextGameId)).toEqual([]);
    expect(host.hasCustody(nextGameId)).toBe(false);
    expect(await host.wake()).toMatchObject({ code: 1, status: { status: "resume_required" } });
    expect(await host.wake("normal", ["--resume"])).toMatchObject({ code: 1, status: { status: "resume_not_due" } });
    expect(await host.wake("recovery", ["--resume"])).toMatchObject({ code: 0, status: { status: "terminal",
      outcome: "saved_without_valid_witness", claimId: "claim-1", source: "sweep" } });
    const custody = host.custody();
    expect(custody.calls.filter((call: string) => call === "claim" || call === "save")).toEqual(["claim", "save"]);
    expect(custody.state.witnesses).toEqual([]);
  }, 20_000);

  it("refuses wakes outside the capture window, unverified code, and a closed load gate", async () => {
    const late = setup();
    expect(await late.wake("early")).toMatchObject({ code: 0, status: { status: "not_due" } });
    expect(await late.wake("late")).toMatchObject({ code: 1, status: { status: "missed_window" } });
    expect(late.attempts()).toEqual([]);
    expect(late.hasCustody()).toBe(false);
    writeFileSync(late.candidateEntry, "// differs from the approved commit\n");
    expect(await late.wake()).toMatchObject({ code: 1, status: { status: "refused", reason: "the candidate checkout has tracked changes" } });
    const closed = setup("exit 7\n");
    expect(await closed.wake()).toMatchObject({ code: 1, status: { status: "load_gate_closed" } });
    expect(closed.hasCustody()).toBe(false);
  }, 20_000);

  it("retains a queue stop across independently approved wakes and receipt recovery", async () => {
    const host = setup();
    const terminal = await host.wake("stop");
    expect(terminal).toMatchObject({ code: 0, status: { status: "terminal", outcome: "source_failed", stopped: { trigger: "statement_timeout" } } });
    expect(await host.wake("late")).toEqual(terminal);
    const blocked = { code: 1, status: { status: "slate_stopped", priorGameId: Number(gameId), gameId: Number(nextGameId),
      trigger: "statement_timeout" } };
    expect(await host.wake("normal", [], nextGameId)).toEqual(blocked);

    // Custody and the owner's stop event survived, but the local terminal receipt did not.
    rmSync(String(terminal.status.receipt));
    expect(await host.wake("normal", [], nextGameId)).toEqual(blocked);
    expect(await host.wake("late", ["--resume"])).toMatchObject({ code: 0, status: { status: "terminal",
      source: "prior_run", outcome: "source_failed", stopped: { trigger: "statement_timeout" } } });
    expect(await host.wake("normal", [], nextGameId)).toEqual(blocked);
    expect(host.custody().calls.filter((call: string) => call === "claim" || call === "save")).toEqual(["claim"]);
    expect(host.attempts(nextGameId)).toEqual([]);
    expect(host.hasCustody(nextGameId)).toBe(false);
  }, 20_000);
});
