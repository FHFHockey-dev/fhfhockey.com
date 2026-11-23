/**
 * Full-scale local proof of the FORGE H1–H10 shadow producer on a disposable PostgreSQL cluster (never a shared or
 * production database). Synthetic 32-club league: 804 players and 8,040 keys. The run measures time, SQL statements,
 * rows and bytes for one cutoff, a resumed rerun, and the per-key cost at larger training sizes.
 *
 *   LC_ALL=en_US.UTF-8 FORGE_V2_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin NODE_PATH=. npx ts-node --transpile-only \
 *     --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/forge-h10-local-producer.ts <out.json>
 */
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { performance } from "node:perf_hooks";
import { Pool } from "pg";
import { buildDenominator } from "../lib/forge-v2/denominator";
import { PostgresHistoryStore, SqlConnection } from "../lib/forge-v2/history.server";
import { buildH10Model, buildH10Training, H10RateState, prepareH10Issuance } from "../lib/forge-v2/h10Features";
import { H10_SEASON, syntheticLeague } from "../lib/forge-v2/h10Fixtures";
import { h10Scopes, readbackH10, runH10Issuance } from "../lib/forge-v2/h10Producer.server";
import { predictConditional } from "../lib/forge-v2/model";

const exec = promisify(execFile);
const bin = process.env.FORGE_V2_POSTGRES_BIN, out = process.argv[2];
if (!bin || !out) throw new Error("FORGE_V2_POSTGRES_BIN and an output path are required");

function counting(pool: Pool) {
  const counts = { statements: 0, writes: 0, sequence: 0, reads: 0 };
  const connection: SqlConnection = { query: async (text: string, values?: unknown[]) => {
    counts.statements += 1;
    if (/nextval\(/.test(text)) counts.sequence += 1; else if (/\b(insert|update)\b/i.test(text)) counts.writes += 1; else counts.reads += 1;
    return pool.query(text, values) as never;
  } };
  return { connection, counts };
}

async function main() {
  const environment: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))), NODE_ENV: "test" };
  const root = await mkdtemp(join(tmpdir(), "forge-h10-full-")), socket = join(root, "s");
  await mkdir(socket, { mode: 0o700 });
  await exec(join(bin!, "initdb"), ["-D", join(root, "d"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "forge_v2_fixture"], { env: environment });
  await exec(join(bin!, "pg_ctl"), ["-D", join(root, "d"), "-l", join(root, "log"), "-w", "-t", "10", "-o", `-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65444`, "start"], { env: environment });
  const admin = new Pool({ host: socket, port: 65444, user: "forge_v2_fixture", database: "postgres", max: 2 });
  const pool = new Pool({ host: socket, port: 65444, user: "service_role", database: "postgres", max: 3 });
  try {
    await admin.query("create role anon; create role authenticated; create role service_role login");
    await admin.query(await readFile(resolve(__dirname, "../..", "supabase/migrations/20261029235656_forge_v2_immutable_history.sql"), "utf8"));
    const T = Math.floor(Date.now() / 1000) * 1000, asOf = new Date(T - 5 * 60000).toISOString();
    const league = syntheticLeague({ anchor: T, teams: 32, pastDays: 25 });
    let t = performance.now();
    const denominator = buildDenominator({ evidence: league.evidence, schedule: league.schedule, asOf, seasonId: H10_SEASON, scheduleComplete: true, evidenceClass: "fixture" });
    const denominatorMs = performance.now() - t;
    const { connection, counts } = counting(pool);
    const input = { db: connection, store: new PostgresHistoryStore(connection), artifacts: { put: async () => { throw new Error("no_artifact_writes_expected"); } },
      denominator, schedule: league.schedule, logs: league.logs, clock: () => new Date().toISOString(), trigger: "daily" as const,
      config: { evidenceClass: "fixture" as const, approvalEvidenceId: "fixture-h10-full-scale", approvedAt: new Date(T - 3600000).toISOString(), codeVersion: "local-full-scale", maximumTrainingExamples: 2000 } };
    t = performance.now();
    const firstPass = await runH10Issuance({ ...input, maximumQueues: 40 });
    const firstPassMs = performance.now() - t, firstCounts = { ...counts };
    t = performance.now();
    const resumed = await runH10Issuance(input);
    const resumedMs = performance.now() - t, afterRun = { ...counts };
    const before = (await pool.query("select (select count(*) from forge_v2_private.forge_v2_vintages)::int v, (select count(*) from forge_v2_private.forge_v2_records)::int r")).rows[0];
    t = performance.now();
    const rerun = await runH10Issuance(input);
    const rerunMs = performance.now() - t;
    const after = (await pool.query("select (select count(*) from forge_v2_private.forge_v2_vintages)::int v, (select count(*) from forge_v2_private.forge_v2_records)::int r")).rows[0];
    t = performance.now();
    const back = await readbackH10(pool as unknown as SqlConnection, denominator);
    const readbackMs = performance.now() - t;
    const sizes = (await admin.query(`select relname, n_live_tup::int rows, pg_total_relation_size(relid)::bigint bytes from pg_stat_user_tables where schemaname='forge_v2_private' order by relname`)).rows;
    const queueBytes = (await admin.query("select count(*)::int queues, sum(pg_column_size(state))::bigint bytes, max(pg_column_size(state))::int largest, max(length(state::text))::int largest_text from forge_v2_private.forge_v2_work_queue")).rows[0];
    // Per-key compute at larger training sets (no DB): clone + predict, the two O(training) steps per issuance.
    const { scopes } = h10Scopes(denominator, new Map(league.schedule.map(g => [g.gameId, g])));
    const perKey: Record<string, number> = {};
    for (const size of [2000, 8000, 14000]) {
      const training = buildH10Training(league.logs, H10_SEASON, asOf, size).training, model = buildH10Model(training, asOf)!, state = H10RateState.from(league.logs, H10_SEASON, asOf);
      const sample = scopes.slice(0, 40), started = performance.now();
      for (const scope of sample) {
        const episode = { ...scope, id: "e", episode: 1, enteredAt: asOf, exitedAt: null };
        const lock = { id: "l", gameId: scope.gameId, adoptedAt: asOf, lockAt: scope.scheduledStartAt, scheduleRevision: scope.scheduleRevision, predecessorId: null, reopened: false, actualStartAt: null, playBegun: false, timingStatus: "provisional" as const };
        const prepared = structuredClone(prepareH10Issuance({ scope, episode, lock, asOf, state, model, config: { ...input.config, denominatorSha256: denominator.denominatorSha256 }, predecessorId: null, opportunityPredecessor: null }));
        predictConditional(prepared.model!, prepared.context);
      }
      perKey[`training_${training.length}`] = Math.round((performance.now() - started) / sample.length * 10) / 10;
    }
    // Optional scale check: replicate the ledger and vintages to N nights, then time the per-invocation queries.
    const nights = Number(process.env.H10_SCALE_NIGHTS ?? 0), explain: Record<string, unknown> = {};
    if (nights > 1) {
      t = performance.now();
      for (let n = 1; n < nights; n++) {
        await admin.query(`insert into forge_v2_private.forge_v2_records (id, kind, scope_key, predecessor_id, payload)
          select r.id || ':n${n}', r.kind, r.scope_key, ${n === 1 ? "r.id" : `r.id || ':n${n - 1}'`}, r.payload from forge_v2_private.forge_v2_records r where r.id not like '%:n%'`);
        await admin.query(`insert into forge_v2_private.forge_v2_vintages (id, issuance_key, issuance_sequence, player_id, game_id, payload)
          select v.id || ':n${n}', v.issuance_key || ':n${n}', v.issuance_sequence + ${n} * 100000, v.player_id, v.game_id,
            jsonb_set(jsonb_set(jsonb_set(v.payload::jsonb, '{id}', to_jsonb(v.id || ':n${n}')), '{issuanceKey}', to_jsonb(v.issuance_key || ':n${n}')), '{sequence}', to_jsonb(v.issuance_sequence + ${n} * 100000))::text
          from forge_v2_private.forge_v2_vintages v where v.id not like '%:n%'`);
      }
      await admin.query("analyze forge_v2_private.forge_v2_records; analyze forge_v2_private.forge_v2_vintages");
      explain.seedMs = Math.round(performance.now() - t);
      explain.rows = (await admin.query("select (select count(*) from forge_v2_private.forge_v2_records)::int records, (select count(*) from forge_v2_private.forge_v2_vintages)::int vintages")).rows[0];
      const keys = scopes.map(s => `${s.playerId}:${s.gameId}:${s.seasonId}:${s.targetVersion}:${s.conditioning}`);
      const time = async (name: string, text: string, values: unknown[]) => {
        const plan = (await admin.query(`explain (analyze, format json) ${text}`, values)).rows[0]["QUERY PLAN"][0];
        explain[name] = { executionMs: Math.round(plan["Execution Time"]), topNode: plan.Plan["Node Type"] };
      };
      const headsSql = `select r.id, r.scope_key, r.payload, p.payload as predecessor_payload from forge_v2_private.forge_v2_records r
        left join forge_v2_private.forge_v2_records p on p.id = r.predecessor_id
        where r.kind = $1 and r.scope_key = any($2::text[])
          and not exists (select 1 from forge_v2_private.forge_v2_records s where s.scope_key = r.scope_key and s.kind = r.kind and s.predecessor_id = r.id)`;
      await time("episodeHeads", headsSql, ["horizon_episode", [...keys, ...keys]]);
      await time("opportunityHeads", headsSql, ["opportunity", keys]);
      const queue = scopes.filter(s => s.teamId === scopes[0].teamId && s.horizon === 1);
      await time("latestVintagesPerQueue", `select distinct on (v.player_id, v.game_id) v.player_id::text, v.game_id::text, v.id from forge_v2_private.forge_v2_vintages v
        join forge_v2_private.forge_v2_publication_receipts r on r.vintage_id = v.id and r.output_hash = v.output_hash
        join unnest($1::bigint[], $2::bigint[]) as t(player_id, game_id) on t.player_id = v.player_id and t.game_id = v.game_id
        order by v.player_id, v.game_id, v.issuance_sequence desc`, [queue.map(s => s.playerId), queue.map(s => s.gameId)]);
      await time("readback", `select v.payload, v.output_hash, r.output_hash as receipt_hash, r.confirmed_at from forge_v2_private.forge_v2_vintages v
        join unnest($1::bigint[], $2::bigint[]) as t(player_id, game_id) on t.player_id = v.player_id and t.game_id = v.game_id
        left join forge_v2_private.forge_v2_publication_receipts r on r.vintage_id = v.id`, [scopes.map(s => s.playerId), scopes.map(s => s.gameId)]);
    }
    const result = {
      version: "forge-h10-local-producer-proof-v1", evidenceClass: "fixture", generatedAt: new Date().toISOString(), host: "local disposable PostgreSQL 17 (unix socket)",
      denominator: { sha256: denominator.denominatorSha256, counts: denominator.counts.byClass, keys: denominator.counts.keys, players: denominator.counts.players, buildMs: Math.round(denominatorMs) },
      firstPass: { queuesProcessed: firstPass.queues.processed, complete: firstPass.complete, ms: Math.round(firstPassMs), sql: firstCounts },
      resumed: { complete: resumed.complete, ms: Math.round(resumedMs), jobs: resumed.jobs, gaps: resumed.gaps.length, gapReasons: [...new Set(resumed.gaps.map(g => g.reason))], training: resumed.training },
      fullRunSql: afterRun, rerun: { ms: Math.round(rerunMs), vintagesBefore: before.v, vintagesAfter: after.v, recordsBefore: before.r, recordsAfter: after.r, complete: rerun.complete },
      readback: { ms: Math.round(readbackMs), vintages: back.vintages, receiptMismatches: back.receiptMismatches, coverage: { expected: back.coverage.expected, numeric: back.coverage.numeric, nonNumeric: back.coverage.nonNumeric, missing: back.coverage.missing, playersWithAllTen: back.coverage.playersWithAllTen, byHorizon: back.coverage.byHorizon, stray: back.coverage.stray.length },
        skaterPlayers: back.skaterPlayers, spread: back.spread, nonNumericReasons: back.reasons },
      tables: sizes, queues: queueBytes, perKeyComputeMs: perKey, scale: nights > 1 ? { nights, ...explain } : null,
    };
    await writeFile(out!, `${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({ ...result, readback: { ...result.readback, coverage: { ...result.readback.coverage, byHorizon: undefined } } }, null, 1)}\n`);
  } finally {
    await pool.end(); await admin.end();
    await exec(join(bin!, "pg_ctl"), ["-D", join(root, "d"), "-w", "-t", "10", "stop", "-m", "fast"], { env: environment }).catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exit(1); });
