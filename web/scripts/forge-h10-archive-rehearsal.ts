/**
 * Q2 rehearsal (TJ, 2026-11-23): one representative month of the partitioned H1–H10 history, end to end, locally.
 *   1. Source: a disposable PostgreSQL 17 with the three migrations. Night 1 is a real issuance on the approved real
 *      data (skaters and goalies, the route's 32-club official read). Nights 2–30 replicate it with their own ids,
 *      issuance keys, sequences, cutoffs (the 29 days before 2026-11-23) and receipts, so the issuance month holds 30
 *      editions at real row sizes (forecast values repeat; that is the only synthetic part).
 *   2. Export each of the five month partitions (gzip CSV), checksum, restore into an isolated second cluster, and
 *      reconcile every row, as-of lookup and backtest against the source.
 *   3. Write the archive manifest and index in the source, then detach and drop the month locally and look a forecast
 *      up through the manifest.
 * No production connection, write or storage upload. Archives go to a scratch directory, not the repo.
 *
 *   LC_ALL=en_US.UTF-8 TMPDIR=/tmp FORGE_V2_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin npx tsx scripts/forge-h10-archive-rehearsal.ts <packet-dir> <out.json> <scratch-dir>
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { performance } from "node:perf_hooks";
import { Client, Pool } from "pg";
import { buildDenominator } from "../lib/forge-v2/denominator";
import { resolveMembership } from "../lib/forge-v2/denominator";
import { PostgresHistoryStore, SqlConnection } from "../lib/forge-v2/history.server";
import { h10InputsFromRows } from "../lib/forge-v2/h10Reader.server";
import { runH10Issuance } from "../lib/forge-v2/h10Producer.server";
import { runH10GoalieIssuance } from "../lib/forge-v2/h10GoalieProducer.server";
import { moveEvidence, officialMoves, parseOfficialRoster } from "../lib/forge-v2/h10News";
import { clubAbbrev } from "../lib/forge-v2/h10NewsRoute.server";
import { canonicalJson } from "../lib/forge-v2/identity";
import { ARCHIVE_TABLES, ArchiveFile, asOfLookup, backtest, exportPartition, partitionDigest, partitionOf, PsqlTarget, restorePartition } from "../lib/forge-v2/h10Archive.server";
import { realRows, verified } from "./forge-h10-real-inputs";

const exec = promisify(execFile);
const [packet, out, scratch] = process.argv.slice(2), bin = process.env.FORGE_V2_POSTGRES_BIN;
if (!packet || !out || !scratch || !bin) throw new Error("usage: <packet-dir> <out.json> <scratch-dir> with FORGE_V2_POSTGRES_BIN");
const ASOF = "2026-11-23T17:20:00.000Z", SEASON = 20262027, NIGHTS = Math.min(Number(process.env.H10_REHEARSAL_NIGHTS ?? 30), 30);
const MIGRATIONS = ["20261029235656_forge_v2_immutable_history.sql", "20261123200000_forge_v2_goalie_h10.sql", "20261123210000_forge_v2_h10_partitions_archive.sql"];
const environment: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))), NODE_ENV: "test" };

async function cluster(port: number) {
  const root = await mkdtemp(join(tmpdir(), "forge-h10-arch-")), socket = join(root, "s");
  await mkdir(socket, { mode: 0o700 });
  await exec(join(bin!, "initdb"), ["-D", join(root, "d"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "forge_v2_fixture"], { env: environment });
  await exec(join(bin!, "pg_ctl"), ["-D", join(root, "d"), "-l", join(root, "log"), "-w", "-t", "10", "-o", `-c listen_addresses='' -c unix_socket_directories='${socket}' -p ${port}`, "start"], { env: environment });
  const admin = new Pool({ host: socket, port, user: "forge_v2_fixture", database: "postgres", max: 3 });
  await admin.query("create role anon; create role authenticated; create role service_role login");
  for (const name of MIGRATIONS) await admin.query(await readFile(resolve(__dirname, "../..", "supabase/migrations", name), "utf8"));
  const target: PsqlTarget = { bin: bin!, host: socket, port, user: "forge_v2_fixture", database: "postgres", env: environment };
  const one = async () => { const c = new Client({ host: socket, port, user: "forge_v2_fixture", database: "postgres" }); await c.connect(); return c; };
  const stop = async () => { await admin.end(); await exec(join(bin!, "pg_ctl"), ["-D", join(root, "d"), "-w", "-t", "10", "stop", "-m", "fast"], { env: environment }).catch(() => undefined); await rm(root, { recursive: true, force: true }); };
  return { admin, socket, port, target, one, stop };
}

/** Deterministic rehearsal outcomes (not real results): the target games are after the real read's cutoff. */
const outcome = (playerId: number, gameId: number) => {
  const h = createHash("sha256").update(`${playerId}:${gameId}`).digest();
  return { G: h[0] % 5 === 0 ? 1 : 0, A: h[1] % 4 === 0 ? 1 : 0, PPP: h[2] % 9 === 0 ? 1 : 0, SOG: h[3] % 5, HIT: h[4] % 4, BLK: h[5] % 3, PIM: h[6] % 7 === 0 ? 2 : 0 };
};

async function main() {
  const report: Record<string, unknown> = { version: "forge-h10-archive-rehearsal-v1", nights: NIGHTS, note: "night 1 real issuance on real data; nights 2..N replicate it with own ids, keys, sequences, cutoffs and receipts" };
  await mkdir(scratch!, { recursive: true });
  const source = await cluster(65451);
  let restored: Awaited<ReturnType<typeof cluster>> | null = null;
  try {
    // ---- Night 1: the real issuance (as G2, with the route's complete official read).
    const rows = realRows(packet!);
    const inputs = h10InputsFromRows(rows, { asOf: ASOF, seasonId: SEASON, logIngestUtcMinute: 450, gameHours: 3.5, rosterMaxAgeHours: 36 });
    const sweepDir = join(packet!, "nhl-public-rosters-20261123"), sweep = verified(sweepDir);
    const sweepAt = new Date(readFileSync(join(sweepDir, "fetched_at.txt"), "utf8").trim().split("\n")[1]).toISOString();
    const clubs = [...new Set(inputs.schedule.flatMap(g => [g.homeTeamId, g.awayTeamId]))].sort((a, b) => a - b);
    const rosters = clubs.map(teamId => parseOfficialRoster(JSON.parse(sweep(`roster_${clubAbbrev(teamId)}_20262027.json`)), teamId, clubAbbrev(teamId)!, sweepAt));
    const current = new Map(resolveMembership(inputs.evidence, sweepAt).members.map(m => [m.affiliation.playerId, m.affiliation.teamId as number]));
    const denominator = buildDenominator({ evidence: [...inputs.evidence, ...officialMoves(rosters, current, [], true).map(moveEvidence)], schedule: inputs.schedule, asOf: sweepAt,
      seasonId: SEASON, scheduleComplete: true, evidenceClass: "prospective_shadow" });
    const pool = new Pool({ host: source.socket, port: source.port, user: "service_role", database: "postgres", max: 3 });
    const db = pool as unknown as SqlConnection, config = { evidenceClass: "prospective_shadow" as const, approvalEvidenceId: "local-archive-rehearsal-not-an-issuance-approval", approvedAt: ASOF, codeVersion: "local-rehearsal", maximumTrainingExamples: 2000 };
    let started = performance.now();
    const skaters = await runH10Issuance({ db, store: new PostgresHistoryStore(db), artifacts: { put: async () => { throw new Error("no_artifact_writes_expected"); } }, denominator,
      schedule: inputs.schedule, logs: inputs.logs, clock: () => new Date().toISOString(), trigger: "daily", config });
    const goalies = await runH10GoalieIssuance({ db, denominator, schedule: inputs.schedule, skaterLogs: inputs.logs, goalieLogs: inputs.goalieLogs, clock: () => new Date().toISOString(), trigger: "daily",
      config: { evidenceClass: config.evidenceClass, approvalEvidenceId: config.approvalEvidenceId, codeVersion: config.codeVersion, maximumTrainingExamples: 2000 } });
    await pool.end();
    report.night1 = { ms: Math.round(performance.now() - started), skaterComplete: skaters.complete, goaliePublished: goalies.published, players: denominator.counts.players, keys: denominator.keys.length };

    // ---- Nights 2..N: replicate night 1 (canonical payloads, so stored hashes stay valid; receipts via the barrier).
    started = performance.now();
    const month = new Date().toISOString().slice(0, 7);
    const base = {
      skater: (await source.admin.query("select payload from forge_v2_private.forge_v2_vintages order by issuance_sequence")).rows.map(r => JSON.parse(r.payload)),
      goalie: (await source.admin.query("select payload from forge_v2_private.forge_v2_goalie_vintages order by issuance_sequence")).rows.map(r => JSON.parse(r.payload)),
      records: (await source.admin.query("select id, kind, scope_key, predecessor_id, payload from forge_v2_private.forge_v2_records order by ordinal")).rows,
    };
    const baseIds = new Set(base.records.map(r => r.id as string));
    const shift = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();
    for (let night = 2; night <= NIGHTS; night++) {
      const tag = `#n${String(night).padStart(2, "0")}`;
      // Nights 2..N take the N-1 days before the real cutoff, at 09:00Z (cutoffs must be in the past: the receipt
      // barrier refuses a generation time after the receipt). Night 1 keeps the real 2026-11-23 cutoff.
      const cutoffShift = Date.UTC(2026, 10, 23 - (night - 1), 9) - Date.parse(ASOF);
      const insertVintages = async (table: string, payloads: Array<Record<string, unknown> & { playerId: number; gameId: number }>) => {
        for (let i = 0; i < payloads.length; i += 800) {
          const batch = payloads.slice(i, i + 800), values: unknown[] = [], tuples: string[] = [];
          const sequences = (await source.admin.query("select nextval('forge_v2_private.forge_v2_issuance_sequence')::bigint as s from generate_series(1, $1)", [batch.length])).rows.map(r => Number(r.s));
          for (const [index, p] of batch.entries()) {
            const sequence = sequences[index];
            const v = { ...p, id: `${p.id}${tag}`, issuanceKey: `${p.issuanceKey}${tag}`, sequence, inputCutoffAt: shift(p.inputCutoffAt as string, cutoffShift),
              generatedAt: shift(p.generatedAt as string, cutoffShift), ...(p.predecessorId ? { predecessorId: `${p.predecessorId}${tag}` } : {}),
              ...("episodeId" in p ? { episodeId: `${p.episodeId}${tag}`, lockEpochId: `${p.lockEpochId}${tag}` } : {}) };
            const n = values.length;
            tuples.push(`($${n + 1},$${n + 2},$${n + 3},$${n + 4},$${n + 5},$${n + 6})`);
            values.push(v.id, v.issuanceKey, v.sequence, v.playerId, v.gameId, canonicalJson(v));
          }
          await source.admin.query(`insert into forge_v2_private.${table} (id, issuance_key, issuance_sequence, player_id, game_id, payload) values ${tuples.join(",")} on conflict do nothing`, values);
        }
      };
      await insertVintages("forge_v2_vintages", base.skater);
      await insertVintages("forge_v2_goalie_vintages", base.goalie);
      for (let i = 0; i < base.records.length; i += 1500) {
        const batch = base.records.slice(i, i + 1500), values: unknown[] = [], tuples: string[] = [];
        for (const r of batch) {
          const n = values.length;
          tuples.push(`($${n + 1},$${n + 2},$${n + 3},$${n + 4},$${n + 5})`);
          values.push(`${r.id}${tag}`, r.kind, `${r.scope_key}${tag}`, r.predecessor_id ? (baseIds.has(r.predecessor_id) ? `${r.predecessor_id}${tag}` : r.predecessor_id) : null, r.payload);
        }
        await source.admin.query(`insert into forge_v2_private.forge_v2_records (id, kind, scope_key, predecessor_id, payload) values ${tuples.join(",")} on conflict do nothing`, values);
      }
      for (const [v, r] of [["forge_v2_vintages", "forge_v2_publication_receipts"], ["forge_v2_goalie_vintages", "forge_v2_goalie_publication_receipts"]]) {
        await source.admin.query(`insert into forge_v2_private.${r} (vintage_id, output_hash, confirmed_at, witness)
          select id, output_hash, clock_timestamp(), 'committed_readback' from forge_v2_private.${v} where id like $1 on conflict do nothing`, [`%${tag}`]);
      }
    }
    report.replication = { ms: Math.round(performance.now() - started), month };

    // ---- Measure the month in Postgres (tables, indexes and TOAST).
    const sizes = (await source.admin.query(`select t as table_name, pg_total_relation_size(('forge_v2_private.' || t || '_' || replace($1, '-', '_'))::regclass)::bigint as total,
      pg_indexes_size(('forge_v2_private.' || t || '_' || replace($1, '-', '_'))::regclass)::bigint as indexes from unnest($2::text[]) t`, [month, [...ARCHIVE_TABLES]])).rows
      .map(r => ({ table: r.table_name, totalBytes: Number(r.total), indexBytes: Number(r.indexes) }));
    const counts = Object.fromEntries(await Promise.all(ARCHIVE_TABLES.map(async t => [t, Number((await source.admin.query(`select count(*) from forge_v2_private.${partitionOf(t, month)}`)).rows[0].count)])));
    report.database = { month, rows: counts, partitions: sizes, totalBytes: sizes.reduce((s, x) => s + x.totalBytes, 0), indexBytes: sizes.reduce((s, x) => s + x.indexBytes, 0),
      evidenceTableBytes: Number((await source.admin.query("select pg_total_relation_size('forge_v2_private.forge_h10_evidence')::bigint as b")).rows[0].b) };

    // ---- Source answers: digests, as-of lookups and the backtest.
    const sourceClient = await source.one();
    const keys = denominator.keys.filter((_, i) => i % 27 === 0);
    // What was known at midday on four days of the month, as published by now (every receipt here is from today).
    const publishedBy = new Date(Date.now() + 3600000).toISOString();
    const queries = keys.flatMap((k, i) => [-3, 5, 15, 23].map(day => ({ playerId: k.playerId, gameId: k.gameId, asOf: new Date(Date.UTC(2026, 10, day, 12 + (i % 6))).toISOString(), publishedBy })));
    const sourceAnswers = { digests: Object.fromEntries(await Promise.all(ARCHIVE_TABLES.map(async t => [t, await partitionDigest(sourceClient, t, month)]))),
      lookup: await asOfLookup(sourceClient, queries), backtest: await backtest(sourceClient, month, outcome) };

    // ---- Export and checksum.
    started = performance.now();
    const files: ArchiveFile[] = [];
    for (const t of ARCHIVE_TABLES) files.push(await exportPartition(source.target, t, month, scratch!));
    report.archive = { exportMs: Math.round(performance.now() - started), files: files.map(f => ({ table: f.table, rows: counts[f.table], rawBytes: f.rawBytes, bytes: f.bytes, sha256: f.sha256, rawSha256: f.rawSha256 })),
      bytes: files.reduce((s, f) => s + f.bytes, 0), rawBytes: files.reduce((s, f) => s + f.rawBytes, 0) };

    // ---- Restore into an isolated cluster, reconcile, and reproduce.
    restored = await cluster(65452);
    started = performance.now();
    for (const f of files) await restorePartition(restored.target, f);
    const restoreMs = Math.round(performance.now() - started);
    const restoredClient = await restored.one();
    const restoredAnswers = { digests: Object.fromEntries(await Promise.all(ARCHIVE_TABLES.map(async t => [t, await partitionDigest(restoredClient, t, month)]))),
      lookup: await asOfLookup(restoredClient, queries), backtest: await backtest(restoredClient, month, outcome) };
    const reconciled = ARCHIVE_TABLES.every(t => JSON.stringify(sourceAnswers.digests[t]) === JSON.stringify(restoredAnswers.digests[t]));
    report.restore = { restoreMs, reconciled, digests: restoredAnswers.digests,
      asOfLookup: { queries: queries.length, found: sourceAnswers.lookup.results.filter(r => r.id).length, sourceSha256: sourceAnswers.lookup.sha256, restoredSha256: restoredAnswers.lookup.sha256, identical: sourceAnswers.lookup.sha256 === restoredAnswers.lookup.sha256 },
      backtest: { source: sourceAnswers.backtest.result, sourceSha256: sourceAnswers.backtest.sha256, restoredSha256: restoredAnswers.backtest.sha256, identical: sourceAnswers.backtest.sha256 === restoredAnswers.backtest.sha256 } };
    await restoredClient.end();

    // ---- Manifest and index (source), then the local detach and drop, then a lookup through the manifest.
    if (!reconciled || sourceAnswers.lookup.sha256 !== restoredAnswers.lookup.sha256 || sourceAnswers.backtest.sha256 !== restoredAnswers.backtest.sha256) throw new Error("rehearsal_not_reconciled");
    for (const f of files) {
      const id = `forge-v2-archive:${f.table}:${month}`, d = sourceAnswers.digests[f.table];
      const span = (await source.admin.query(`select min(${f.table.includes("records") ? "recorded_at" : "inserted_at"}) as a, max(${f.table.includes("records") ? "recorded_at" : "inserted_at"}) as b from forge_v2_private.${f.partition}`)).rows[0];
      await source.admin.query(`insert into forge_v2_private.forge_v2_archives (id, table_name, month, row_count, content_sha256, sha256, bytes, storage_path, first_inserted_at, last_inserted_at, verified)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [id, f.table, `${month}-01`, d.rows, d.digest, f.sha256, f.bytes, `forge-v2-archive/${month}/${f.partition}.csv.gz`, span.a, span.b,
        { restoredRows: restoredAnswers.digests[f.table].rows, reconciled, asOfLookupSha256: restoredAnswers.lookup.sha256, backtestSha256: restoredAnswers.backtest.sha256, restoreMs }]);
      if (f.table.endsWith("vintages")) await source.admin.query(`insert into forge_v2_private.forge_v2_archive_index (archive_id, player_id, game_id, vintages, first_issued_at, last_issued_at)
        select $1, player_id, game_id, count(*), min(inserted_at), max(inserted_at) from forge_v2_private.${f.partition} group by player_id, game_id`, [id]);
    }
    for (const t of ARCHIVE_TABLES) {
      await source.admin.query(`alter table forge_v2_private.${t} detach partition forge_v2_private.${partitionOf(t, month)}`);
      await source.admin.query(`drop table forge_v2_private.${partitionOf(t, month)}`);
    }
    const probe = queries[0];
    report.afterDrop = {
      hotLookupFound: (await asOfLookup(sourceClient, [probe])).results.filter(r => r.id).length,
      manifest: (await source.admin.query(`select a.id, a.storage_path, a.sha256, i.vintages from forge_v2_private.forge_v2_archive_index i join forge_v2_private.forge_v2_archives a on a.id = i.archive_id
        where i.player_id = $1 and i.game_id = $2`, [probe.playerId, probe.gameId])).rows,
      indexRows: Number((await source.admin.query("select count(*) from forge_v2_private.forge_v2_archive_index")).rows[0].count),
      archivesBytes: Number((await source.admin.query("select pg_total_relation_size('forge_v2_private.forge_v2_archive_index') + pg_total_relation_size('forge_v2_private.forge_v2_archives') as b")).rows[0].b),
    };
    await sourceClient.end();
  } finally {
    await source.stop();
    if (restored) await restored.stop();
  }
  await writeFile(out!, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 1).slice(0, 5000)}\n`);
}
main().catch(error => { console.error(error); process.exit(1); });
