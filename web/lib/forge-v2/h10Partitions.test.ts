// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Client, Pool } from "pg";
import { canonicalJson } from "./identity";
import { contentHash } from "./hash.server";
import { ARCHIVE_TABLES, exportPartition, partitionDigest, restorePartition } from "./h10Archive.server";

const exec = promisify(execFile);
const bin = process.env.FORGE_V2_POSTGRES_BIN;
const files = ["20261029235656_forge_v2_immutable_history.sql", "20261123200000_forge_v2_goalie_h10.sql", "20261123210000_forge_v2_h10_partitions_archive.sql", "20261124000000_forge_h10_interval_editions.sql"]
  .map(name => resolve(__dirname, "../../..", "supabase/migrations", name));

/** Migration 20261123210000 on disposable PostgreSQL: monthly partitions by issuance time, cross-partition
 * uniqueness, the predecessor rule, immutability, and the archive round trip on a small month. */
describe.runIf(Boolean(bin))("h10 monthly partitions and archive on disposable PostgreSQL", () => {
  let root: string, socket: string, admin: Pool, started = false, restoreRoot: string | null = null;
  const environment: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))), NODE_ENV: "test" };
  const month = new Date().toISOString().slice(0, 7);
  const next = (() => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 2)).toISOString(); })();
  const vintage = (id: string, sequence: number, cutoff: string) => ({ id, issuanceKey: `key:${id}`, sequence, playerId: 8477946, gameId: 2026020400, seasonId: 20262027,
    targetVersion: "nhl-official-skater-appearance-v1", conditioning: "official_appearance_given_game_occurs", teamId: 8, opponentId: 17, home: true, horizon: 1, episodeId: "e", lockEpochId: "l",
    scheduleRevision: "s", affiliationRevision: "a", sourceGameDate: "2026-12-01", scheduledStartAt: "2026-12-02T00:00:00.000Z", inputCutoffAt: cutoff, generatedAt: cutoff,
    means: Object.fromEntries(["G", "A", "PPP", "SOG", "HIT", "BLK", "PIM"].map(c => [c, { state: "available", value: 0.5 }])), participation: null, distribution: null, calibration: null,
    scoring: { id: "default", ruleVersion: "linear-seven-v1", weights: { G: 3, A: 2, PPP: 1, SOG: 0.4, HIT: 0.2, BLK: 0.3, PIM: 0.1 } }, modelVersion: "m", featureVersion: "f", codeVersion: "c",
    cohort: "test", qualificationId: null, sourceManifest: [{ id: "s" }], trigger: "daily", predecessorId: null, evidenceClass: "fixture", limitations: [] });
  const insert = (v: ReturnType<typeof vintage>, insertedAt?: string) => admin.query(`insert into forge_v2_private.forge_v2_vintages (id, issuance_key, issuance_sequence, player_id, game_id, payload${insertedAt ? ", inserted_at" : ""})
    values ($1,$2,$3,$4,$5,$6${insertedAt ? ",$7" : ""}) on conflict do nothing`, [v.id, v.issuanceKey, v.sequence, v.playerId, v.gameId, canonicalJson(v), ...(insertedAt ? [insertedAt] : [])]);
  const count = async (sql: string) => (await admin.query(sql)).rows[0].n as number;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "forge-h10-part-")); socket = join(root, "socket");
    await mkdir(socket, { mode: 0o700 });
    await exec(join(bin!, "initdb"), ["-D", join(root, "data"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "forge_v2_fixture"], { env: environment });
    await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-l", join(root, "server.log"), "-w", "-t", "10", "-o", `-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65454`, "start"], { env: environment });
    started = true;
    admin = new Pool({ host: socket, port: 65454, user: "forge_v2_fixture", database: "postgres", max: 3 });
    await admin.query("create role anon; create role authenticated; create role service_role login");
    await admin.query(await readFile(files[0], "utf8"));
    await admin.query(await readFile(files[1], "utf8"));
  }, 30000);
  afterAll(async () => {
    await admin?.end();
    if (started) await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-w", "-t", "10", "stop", "-m", "fast"], { env: environment });
    if (root) await rm(root, { recursive: true, force: true });
    if (restoreRoot) await rm(restoreRoot, { recursive: true, force: true });
  });

  it("refuses to partition tables that already hold history", async () => {
    await admin.query("begin");
    await admin.query("insert into forge_v2_private.forge_v2_records (id, kind, scope_key, payload) values ('r0', 'history_event', 's', '{}')");
    await expect(admin.query(await readFile(files[2], "utf8"))).rejects.toThrow(/forge_v2_partitions_require_empty_tables/);
    await admin.query("rollback");
    await admin.query(await readFile(files[2], "utf8"));
    await admin.query(await readFile(files[3], "utf8")); // interval editions (additive, applies on live tables)
    expect(await count(`select count(*)::int n from pg_inherits i join pg_class c on c.oid = i.inhparent where c.relname = 'forge_v2_vintages'`)).toBeGreaterThanOrEqual(2);
  });

  it("files each row in its issuance month and keeps ids and issuance keys unique across months", async () => {
    const v = vintage("v1", 1, new Date(Date.now() - 3600000).toISOString());
    await insert(v);
    expect((await admin.query("select tableoid::regclass::text t from forge_v2_private.forge_v2_vintages where id = 'v1'")).rows[0].t).toBe(`forge_v2_private.forge_v2_vintages_${month.replace("-", "_")}`);
    // A retry landing next month is skipped, like ON CONFLICT DO NOTHING; the stored row and hash are unchanged.
    await insert(v, next);
    await insert({ ...vintage("v1-other", 2, v.inputCutoffAt), issuanceKey: v.issuanceKey }, next);
    expect(await count("select count(*)::int n from forge_v2_private.forge_v2_vintages")).toBe(1);
    expect((await admin.query("select output_hash from forge_v2_private.forge_v2_vintages")).rows[0].output_hash).toBe(contentHash(JSON.parse(canonicalJson(v))));
    await admin.query("insert into forge_v2_private.forge_v2_publication_receipts (vintage_id, output_hash, confirmed_at, witness) select id, output_hash, clock_timestamp(), 'committed_readback' from forge_v2_private.forge_v2_vintages");
    await admin.query("insert into forge_v2_private.forge_v2_publication_receipts (vintage_id, output_hash, confirmed_at, witness, inserted_at) select id, output_hash, clock_timestamp(), 'committed_readback', $1 from forge_v2_private.forge_v2_vintages", [next]);
    expect(await count("select count(*)::int n from forge_v2_private.forge_v2_publication_receipts")).toBe(1);
    await expect(admin.query("insert into forge_v2_private.forge_v2_publication_receipts (vintage_id, output_hash, confirmed_at, witness) values ('missing', 'x', clock_timestamp(), 'committed_readback')"))
      .rejects.toThrow(/FORGE_V2_OUTPUT_HASH_MISMATCH/);
  });

  it("keeps the record predecessor rule and immutability on every partition", async () => {
    await admin.query("insert into forge_v2_private.forge_v2_records (id, kind, scope_key, payload) values ('r1', 'history_event', 's', '{\"a\":1}')");
    await admin.query("insert into forge_v2_private.forge_v2_records (id, kind, scope_key, predecessor_id, payload) values ('r2', 'history_event', 's', 'r1', '{\"a\":2}')");
    await expect(admin.query("insert into forge_v2_private.forge_v2_records (id, kind, scope_key, predecessor_id, payload) values ('r3', 'history_event', 's', 'nope', '{}')")).rejects.toThrow(/PREDECESSOR_MISSING/);
    await expect(admin.query("update forge_v2_private.forge_v2_vintages set payload = '{}'")).rejects.toThrow(/IMMUTABLE/);
    await expect(admin.query("delete from forge_v2_private.forge_v2_records")).rejects.toThrow(/IMMUTABLE/);
    await expect(admin.query(`truncate forge_v2_private.forge_v2_vintages_${month.replace("-", "_")}`)).rejects.toThrow(/IMMUTABLE/);
    await admin.query("insert into forge_v2_private.forge_h10_evidence (id, scope_key, payload) values ('e1', 'forge-h10-news', '{}')");
    await expect(admin.query("delete from forge_v2_private.forge_h10_evidence")).rejects.toThrow(/IMMUTABLE/);
    await expect(admin.query(`select forge_v2_private.forge_v2_ensure_month_partitions(date '2099-01-01')`)).rejects.toThrow(/horizon_too_far/);
  });

  it("round-trips a month: export, checksum, restore into an isolated database, identical digests; tampering is caught", async () => {
    const target = { bin: bin!, host: socket, port: 65454, user: "forge_v2_fixture", database: "postgres", env: environment };
    const dir = await mkdtemp(join(tmpdir(), "forge-h10-archive-files-"));
    const exported = [];
    for (const t of ARCHIVE_TABLES) exported.push(await exportPartition(target, t, month, dir));
    const one = new Client({ host: socket, port: 65454, user: "forge_v2_fixture", database: "postgres" }); await one.connect();
    const source = Object.fromEntries(await Promise.all(ARCHIVE_TABLES.map(async t => [t, await partitionDigest(one, t, month)])));
    await one.end();
    // The isolated database: the same three migrations, nothing else.
    restoreRoot = await mkdtemp(join(tmpdir(), "forge-h10-restore-"));
    const rsocket = join(restoreRoot, "s"); await mkdir(rsocket, { mode: 0o700 });
    await exec(join(bin!, "initdb"), ["-D", join(restoreRoot, "d"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "forge_v2_fixture"], { env: environment });
    await exec(join(bin!, "pg_ctl"), ["-D", join(restoreRoot, "d"), "-l", join(restoreRoot, "log"), "-w", "-t", "10", "-o", `-c listen_addresses='' -c unix_socket_directories='${rsocket}' -p 65455`, "start"], { env: environment });
    const radmin = new Pool({ host: rsocket, port: 65455, user: "forge_v2_fixture", database: "postgres", max: 2 });
    try {
      await radmin.query("create role anon; create role authenticated; create role service_role login");
      for (const f of files) await radmin.query(await readFile(f, "utf8"));
      const rtarget = { ...target, host: rsocket, port: 65455 };
      await expect(restorePartition(rtarget, { ...exported[0], sha256: "0".repeat(64) })).rejects.toThrow(/archive_checksum_mismatch/);
      for (const f of exported) await restorePartition(rtarget, f);
      const rone = new Client({ host: rsocket, port: 65455, user: "forge_v2_fixture", database: "postgres" }); await rone.connect();
      for (const t of ARCHIVE_TABLES) expect(await partitionDigest(rone, t, month)).toEqual(source[t]);
      expect(source.forge_v2_records.rows).toBe(2);
      // One altered byte in a restored row changes the digest.
      await rone.query("set session_replication_role = replica");
      await rone.query("update forge_v2_private.forge_v2_records set payload = '{\"a\":9}' where id = 'r2'");
      expect((await partitionDigest(rone, "forge_v2_records", month)).digest).not.toBe(source.forge_v2_records.digest);
      await rone.end();
    } finally {
      await radmin.end();
      await exec(join(bin!, "pg_ctl"), ["-D", join(restoreRoot, "d"), "-w", "-t", "10", "stop", "-m", "fast"], { env: environment }).catch(() => undefined);
      await rm(dir, { recursive: true, force: true });
    }
  }, 120000);
});
