// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Pool } from "pg";
import { buildDenominator, FrozenDenominator, measureCoverage } from "./denominator";
import { contentHash } from "./hash.server";
import { SqlConnection } from "./history.server";
import { DET, H10_SEASON, MONTEMBEAULT, MTL, syntheticLeague, syntheticTrade } from "./h10Fixtures";
import { readbackH10Goalies, runH10GoalieIssuance, H10GoalieRunInput } from "./h10GoalieProducer.server";

const exec = promisify(execFile);
const bin = process.env.FORGE_V2_POSTGRES_BIN;
const migrations = ["20261029235656_forge_v2_immutable_history.sql", "20261123200000_forge_v2_goalie_h10.sql", "20261123210000_forge_v2_h10_partitions_archive.sql"].map(name => resolve(__dirname, "../../..", "supabase/migrations", name));
const MIN = 60000;

describe.runIf(Boolean(bin))("FORGE H1–H10 goalie if-starts on disposable PostgreSQL (synthetic fixture evidence)", () => {
  let root: string, socket: string, admin: Pool, db: Pool, started = false;
  const environment: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))), NODE_ENV: "test" };
  const T = Math.floor(Date.now() / 1000) * 1000, iso = (ms: number) => new Date(ms).toISOString();
  const c1 = iso(T - 9 * MIN), tradeAt = iso(T - 8 * MIN), tradeReceived = iso(T - 7 * MIN), c2 = iso(T - 6 * MIN);
  const league = syntheticLeague({ anchor: T, teams: 6, pastDays: 30 });
  let first: FrozenDenominator, second: FrozenDenominator;
  const count = async (table: string) => (await db.query(`select count(*)::int as n from forge_v2_private.${table}`)).rows[0].n as number;
  const run = (denominator: FrozenDenominator, extra: Partial<H10GoalieRunInput> = {}) => runH10GoalieIssuance({ db: db as SqlConnection, denominator, schedule: league.schedule,
    skaterLogs: league.logs, goalieLogs: league.goalieLogs, clock: () => new Date().toISOString(), trigger: "daily",
    config: { evidenceClass: "fixture", approvalEvidenceId: "fixture-goalie-proof", codeVersion: "local-test", maximumTrainingExamples: 2000 }, ...extra });

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "forge-h10-goalie-")); socket = join(root, "socket");
    await mkdir(socket, { mode: 0o700 });
    await exec(join(bin!, "initdb"), ["-D", join(root, "data"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "forge_v2_fixture"], { env: environment });
    await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-l", join(root, "server.log"), "-w", "-t", "10", "-o", `-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65448`, "start"], { env: environment });
    started = true;
    admin = new Pool({ host: socket, port: 65448, user: "forge_v2_fixture", database: "postgres", max: 2 });
    await admin.query("create role anon; create role authenticated; create role service_role login");
    for (const file of migrations) await admin.query(await readFile(file, "utf8"));
    db = new Pool({ host: socket, port: 65448, user: "service_role", database: "postgres", max: 3 });
    first = buildDenominator({ evidence: league.evidence, schedule: league.schedule, asOf: c1, seasonId: H10_SEASON, scheduleComplete: true, evidenceClass: "fixture" });
    second = buildDenominator({ evidence: [...league.evidence, ...syntheticTrade(tradeAt, tradeReceived)], schedule: league.schedule, asOf: c2, seasonId: H10_SEASON, scheduleComplete: true, evidenceClass: "fixture" });
  }, 30000);
  afterAll(async () => {
    await db?.end(); await admin?.end();
    if (started) await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-w", "-t", "10", "stop", "-m", "fast"], { env: environment });
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("refuses the migration without the v2 history schema", async () => {
    await admin.query("create schema probe");
    await expect(admin.query((await readFile(migrations[1], "utf8")).replace(/forge_v2_private\.forge_v2_vintages'\) is null/, "probe.missing') is null"))).rejects.toThrow(/apply 20261029235656 first/);
    await admin.query("drop schema probe");
  });

  it("writes nothing for goalies when no goalie starts were read; every key is a named gap", async () => {
    const report = await run(first, { goalieLogs: [] });
    expect(report).toMatchObject({ complete: true, published: 0, reused: 0 });
    expect(new Set(report.gaps.map(g => g.reason))).toEqual(new Set(["goalie_training_below_minimum_support"]));
    expect(report.gaps).toHaveLength(120);
    expect(await count("forge_v2_goalie_vintages")).toBe(0);
  });

  it("issues an if-starts forecast for every goalie key across all ten horizons; a rerun adds nothing; rows are immutable", async () => {
    const goalieKeys = first.keys.filter(k => k.playerClass === "goalie");
    expect(goalieKeys).toHaveLength(120);
    const partial = await run(first, { maximumKeys: 30 });
    expect(partial).toMatchObject({ complete: false, published: 30 });
    const done = await run(first);
    expect(done).toMatchObject({ complete: true, published: 90, reused: 30, gaps: [] });
    expect(done.training.available).toBeGreaterThan(25);
    const before = { v: await count("forge_v2_goalie_vintages"), r: await count("forge_v2_goalie_publication_receipts") };
    expect(before).toEqual({ v: 120, r: 120 });
    expect((await run(first)).reused).toBe(120);
    expect({ v: await count("forge_v2_goalie_vintages"), r: await count("forge_v2_goalie_publication_receipts") }).toEqual(before);
    await expect(db.query("update forge_v2_private.forge_v2_goalie_vintages set payload='{}'")).rejects.toThrow(/permission denied/);
    await expect(admin.query("delete from forge_v2_private.forge_v2_goalie_vintages")).rejects.toThrow(/IMMUTABLE/);
    await expect(admin.query("truncate forge_v2_private.forge_v2_goalie_publication_receipts")).rejects.toThrow(/IMMUTABLE/);
    const rows = await readbackH10Goalies(db as SqlConnection, first);
    const coverage = measureCoverage(first, rows);
    expect(coverage.byHorizon.map(h => h.numeric)).toEqual(Array(10).fill(12)); // 12 goalies × H1–H10, every value numeric
    expect(coverage.stray).toEqual([]);
    expect(rows.every(r => Math.abs((r.values.SHOTS_AGAINST as number) - (r.values.SAVES as number) - (r.values.GOALS_ALLOWED as number)) < 1e-9)).toBe(true);
  }, 300000);

  it("issues Montembeault's trade as goalie material revisions on Detroit; his Montréal rows stay byte-identical", async () => {
    const montrealBefore = (await db.query("select id, payload from forge_v2_private.forge_v2_goalie_vintages where player_id = $1 order by id", [MONTEMBEAULT])).rows;
    expect(montrealBefore.every(r => JSON.parse(r.payload).teamId === MTL)).toBe(true);
    const event = { id: `trade:${tradeAt}`, kind: "affiliation" as const, receivedAt: tradeReceived, acceptedAt: c2, payloadHash: contentHash({ goalie: MONTEMBEAULT }), affected: { playerIds: [MONTEMBEAULT] } };
    const report = await run(second, { trigger: { material: [event] } });
    expect(report).toMatchObject({ complete: true, keys: 10, published: 10 });
    const after = (await db.query("select id, payload from forge_v2_private.forge_v2_goalie_vintages where player_id = $1 order by id", [MONTEMBEAULT])).rows;
    expect(after.filter(r => montrealBefore.some(b => b.id === r.id))).toEqual(montrealBefore);
    const detroit = after.map(r => JSON.parse(r.payload)).filter(v => v.teamId === DET);
    expect(detroit.map(v => v.horizon).sort((a: number, b: number) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(detroit.every(v => v.trigger === "material" && v.evidenceClass === "fixture")).toBe(true);
    const rows = await readbackH10Goalies(db as SqlConnection, second);
    expect(measureCoverage(second, rows).byHorizon.every(h => h.numeric >= 1)).toBe(true);
  }, 300000);
});
