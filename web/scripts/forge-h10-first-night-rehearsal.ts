/**
 * Local rehearsal of hosted-packet/first-night-verify.sql on a disposable PostgreSQL: a real-shaped night issued by
 * the real nightly route, driven through the real dispatch path (tick -> signed request -> verify -> begin -> route ->
 * finish), on the TJ-approved bounded reads and the saved public NHL rosters. pg_net, Vault and pg_cron are local
 * stand-ins with the production names; pg_stat_statements is the real extension. The verification file runs three
 * times: mid-run (after a budget-limited "continued" dispatch), after completion, and after seeding known defects.
 * Nothing leaves this machine; no production read or write.
 *
 *   LC_ALL=en_US.UTF-8 TMPDIR=/tmp FORGE_V2_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin NODE_PATH=. npx ts-node --transpile-only \
 *     --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/forge-h10-first-night-rehearsal.ts <packet-dir> <out-dir>
 */
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";

import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { Pool } from "pg";
import type { SqlConnection } from "../lib/forge-v2/history.server";
import { handleH10Shadow, h10RouteConfig } from "../lib/forge-v2/h10Route.server";
import { H10_ROUTE, beginH10Dispatch, finishH10Dispatch, verifyH10Dispatch } from "../lib/forge-v2/h10Dispatch.server";
import { realRows, verified } from "./forge-h10-real-inputs";

const exec = promisify(execFile);
const [packet, outDir] = process.argv.slice(2), bin = process.env.FORGE_V2_POSTGRES_BIN;
if (!packet || !outDir || !bin) throw new Error("usage: <packet-dir> <out-dir> with FORGE_V2_POSTGRES_BIN");
const PORT = 65461, SECRET = "local-rehearsal-h10-dispatch-signing-key-0123456789";
const STUBS = `
create schema extensions; create extension pgcrypto schema extensions; create extension pg_stat_statements schema extensions;
create schema vault; create table vault.decrypted_secrets (name text, decrypted_secret text);
create schema net; create table net.requests (id bigserial primary key, url text, body jsonb, headers jsonb);
create table net._http_response (id bigint primary key, status_code integer, content_type text, headers jsonb, content text, timed_out boolean, error_msg text, created timestamptz not null default now());
create function net.http_post(url text, body jsonb, headers jsonb, timeout_milliseconds integer) returns bigint
  language sql as $$ insert into net.requests (url, body, headers) values (url, body, headers) returning id $$;
create schema cron; create table cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create table cron.job_run_details (runid bigserial primary key, jobid bigint, status text, return_message text, start_time timestamptz, end_time timestamptz);
insert into cron.job (jobname, schedule, command) values ('forge-h10-shadow-nightly', '*/15 8-12 * * *', 'select forge_v2_private.forge_h10_tick_v1(''nightly'')');`;
const MIGRATIONS = ["20261029235656_forge_v2_immutable_history.sql", "20261123200000_forge_v2_goalie_h10.sql", "20261123210000_forge_v2_h10_partitions_archive.sql", "20261123220000_forge_h10_hosted_dispatch.sql"];

async function main() {
  const rows = realRows(packet!), sweep = verified(join(packet!, "nhl-public-rosters-20261123"));
  const environment: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))), NODE_ENV: "test" };
  const root = await mkdtemp(join(tmpdir(), "forge-h10-night-")), socket = join(root, "s");
  await mkdir(socket, { mode: 0o700 }); await mkdir(outDir!, { recursive: true });
  await exec(join(bin!, "initdb"), ["-D", join(root, "d"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "postgres"], { env: environment });
  await exec(join(bin!, "pg_ctl"), ["-D", join(root, "d"), "-l", join(root, "log"), "-w", "-t", "10", "-o",
    `-c listen_addresses='' -c unix_socket_directories='${socket}' -p ${PORT} -c shared_preload_libraries=pg_stat_statements`, "start"], { env: environment });
  const admin = new Pool({ host: socket, port: PORT, user: "postgres", database: "postgres", max: 2 });
  const pool = new Pool({ host: socket, port: PORT, user: "service_role", database: "postgres", max: 3 });
  const db = pool as unknown as SqlConnection;
  const summary: Record<string, unknown> = { version: "forge-h10-first-night-rehearsal-v1", dispatches: [] as unknown[] };
  // psql exactly as the operator would run it; output lands in <out-dir>/<label>/first-night-verify-<date>/.
  const verify = async (label: string, runDate: string) => {
    const cwd = join(outDir!, label); await mkdir(cwd, { recursive: true });
    const started = Date.now();
    const { stdout, stderr } = await exec(join(bin!, "psql"), ["-X", "-h", socket, "-p", String(PORT), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-v", `run_date=${runDate}`,
      "-f", resolve(__dirname, "../../tasks/artifacts/forge-full-nhl-h10-2026-11-23/hosted-packet/first-night-verify.sql")], { cwd, env: environment });
    const dir = join(cwd, `first-night-verify-${runDate}`), files = (await readdir(dir)).sort();
    return { ms: Date.now() - started, stdout: stdout.trim(), stderr: stderr.trim(), files, reconcile: files.includes("05-reconcile.txt") ? await readFile(join(dir, "05-reconcile.txt"), "utf8") : null };
  };
  try {
    await admin.query("create role anon; create role authenticated; create role service_role login");
    await admin.query(STUBS);
    for (const name of MIGRATIONS) await admin.query(await readFile(resolve(__dirname, "../..", "supabase/migrations", name), "utf8"));
    await admin.query("insert into vault.decrypted_secrets values ('forge_h10_dispatch_secret', $1)", [SECRET]);
    await admin.query("select extensions.pg_stat_statements_reset()");
    const config = h10RouteConfig({ FORGE_H10_SHADOW_ENABLED: "true", FORGE_H10_SHADOW_APPROVAL_ID: "local-first-night-rehearsal-not-an-approval", FORGE_H10_SHADOW_APPROVED_AT: "2026-11-23T22:00:00Z",
      VERCEL_GIT_COMMIT_SHA: "local-rehearsal-code-version" });
    if ("error" in config) throw new Error(config.error);
    const fetchRoster = async (abbrev: string) => JSON.parse(sweep(`roster_${abbrev}_20262027.json`));

    // One cron tick, then delivery of whatever it queued, exactly as the hosted route handles it.
    const tick = async () => {
      const start = new Date();
      const result = (await admin.query("select forge_v2_private.forge_h10_tick_v1('nightly') as r")).rows[0].r as string;
      await admin.query("insert into cron.job_run_details (jobid, status, return_message, start_time, end_time) select jobid, 'succeeded', $1, $2, clock_timestamp() from cron.job where jobname = 'forge-h10-shadow-nightly'", [result, start]);
      if (result !== "queued") return { tick: result };
      const request = (await admin.query("select id, url, body, headers from net.requests order by id desc limit 1")).rows[0];
      const headers = Object.fromEntries(Object.entries(request.headers as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
      const auth = verifyH10Dispatch({ method: "POST", path: new URL(request.url).pathname, query: {}, headers, body: request.body }, SECRET, Date.now());
      if (!auth.ok) throw new Error(`rehearsal_signature_refused:${JSON.stringify(auth.body)}`);
      const begun = await beginH10Dispatch(db, auth.dispatch);
      let status = 200, body: Record<string, unknown>;
      if (!begun.ok) { status = begun.status; body = begun.body as Record<string, unknown>; }
      else {
        let outcome = "failed";
        try {
          const result2 = await handleH10Shadow({ mode: "nightly", now: Date.now(), db, config, readRows: async () => rows, fetchRoster });
          outcome = String(result2.body.status ?? "unknown"); status = result2.status; body = { ...result2.body, runKey: auth.dispatch.runKey };
        } finally { await finishH10Dispatch(db, auth.dispatch.dispatchId, outcome); }
      }
      await admin.query("insert into net._http_response (id, status_code, content_type, content, timed_out) values ($1, $2, 'application/json', $3, false)", [request.id, status, JSON.stringify(body!)]);
      const entry = { tick: result, httpStatus: status, status: body!.status, reason: body!.reason ?? null, runKey: auth.dispatch.runKey, scopes: body!.scopes ?? null, jobs: body!.jobs ?? null, gaps: body!.gaps ?? null };
      (summary.dispatches as unknown[]).push(entry);
      process.stdout.write(`${JSON.stringify(entry)}\n`);
      return entry;
    };

    const first = await tick();
    const runDate = String((first as { runKey?: string }).runKey ?? "").split(":")[1];
    if (!runDate) throw new Error(`first tick did not dispatch: ${JSON.stringify(first)}`);
    summary.runDate = runDate;
    summary.midRun = await verify("1-mid-run", runDate);
    let last = first as { status?: unknown };
    for (let i = 0; i < 12 && last.status !== "complete"; i++) last = await tick() as { status?: unknown };
    // A later tick after completion: the route answers from the completion marker, as production ticks to 12:45Z will.
    await tick();
    summary.complete = await verify("2-complete", runDate);

    // Known defects, seeded directly as the owner with triggers off (replica): every check must see exactly these.
    await admin.query("begin; set local session_replication_role = replica");
    const freeze = (await admin.query("select recorded_at, payload::jsonb->'denominator'->>'denominatorSha256' as sha from forge_v2_private.forge_v2_records where scope_key = $1 order by ordinal desc limit 1", [`forge-h10-nightly:${runDate}`])).rows[0];
    const pick = async (table: string, horizon: number, offset = 0) => (await admin.query(`select v.id, v.payload from forge_v2_private.${table} v join forge_v2_private.${table.replace("vintages", "publication_receipts")} r on r.vintage_id = v.id
      where (v.payload::jsonb->>'horizon')::int = $1 order by v.player_id, v.game_id limit 1 offset $2`, [horizon, offset])).rows[0];
    let sequence = Number((await admin.query("select coalesce(max(issuance_sequence), 0) + 1000000 as s from (select issuance_sequence from forge_v2_private.forge_v2_vintages union all select issuance_sequence from forge_v2_private.forge_v2_goalie_vintages) x")).rows[0].s);
    const copy = async (table: string, payloadText: string, change: (p: Record<string, unknown>) => void, insertedAt: string | null, receipt = true) => {
      const p = JSON.parse(payloadText); sequence += 1;
      p.id = `rehearsal-defect:${sequence}`; p.issuanceKey = `rehearsal-defect:${sequence}`; p.sequence = sequence; change(p);
      await admin.query(`insert into forge_v2_private.${table} (id, issuance_key, issuance_sequence, player_id, game_id, payload, output_hash, insert_transaction, inserted_at)
        values ($1, $1, $2, $3, $4, $5, $6, pg_current_xact_id(), coalesce($7::timestamptz, clock_timestamp()))`, [p.id, sequence, p.playerId, p.gameId, JSON.stringify(p), `hash-${sequence}`, insertedAt]);
      if (receipt) await admin.query(`insert into forge_v2_private.${table.replace("vintages", "publication_receipts")} (vintage_id, output_hash, confirmed_at, receipt_transaction, witness, inserted_at)
        values ($1, $2, clock_timestamp(), pg_current_xact_id(), 'committed_readback', coalesce($3::timestamptz, clock_timestamp()))`, [p.id, `hash-${sequence}`, insertedAt]);
    };
    const s3 = await pick("forge_v2_vintages", 3), s5 = await pick("forge_v2_vintages", 5), s7 = await pick("forge_v2_vintages", 7), g2 = await pick("forge_v2_goalie_vintages", 2);
    await admin.query("delete from forge_v2_private.forge_v2_publication_receipts where vintage_id = $1", [s3.id]);                       // skater H3: missing + unpublished
    await copy("forge_v2_vintages", s5.payload, p => { p.gameId = 2026029999; }, null);                                                  // skater H5: extra, player_game_not_frozen
    await copy("forge_v2_vintages", s7.payload, p => { p.modelVersion = ""; }, null);                                                    // skater H7: duplicate + lacking model lineage
    await copy("forge_v2_vintages", s7.payload, p => { (p.sourceManifest as Array<{ id: string }>)[0].id = "forge-h10-denominator:another"; }, null); // extra, names_another_denominator
    await copy("forge_v2_vintages", s5.payload, p => { (p.sourceManifest as Array<{ id: string }>)[0].id = "forge-h10-denominator:yesterday"; },
      new Date(new Date(freeze.recorded_at).getTime() - 86400000).toISOString());                                                       // a prior night's edition: ignored
    await copy("forge_v2_goalie_vintages", g2.payload, p => { p.teamId = p.opponentId; }, null);                                          // goalie H2: extra (team differs) + team not frozen
    await admin.query("commit");
    summary.seeded = { missingAndUnpublished: { skaterH3: s3.id }, extra: { skaterH5_gameNotFrozen: 1, skaterH7_otherDenominator: 1, goalieH2_teamDiffers: 1 },
      duplicate: { skaterH7: 1, alsoLackingModelLineage: 1 }, ignoredPriorNightEdition: { skaterH5: 1 }, freezeSha: freeze.sha };
    summary.defects = await verify("3-defects", runDate);
    summary.noFreeze = await verify("4-no-freeze", "2026-11-22");
  } finally {
    await pool.end(); await admin.end();
    await exec(join(bin!, "pg_ctl"), ["-D", join(root, "d"), "-w", "-t", "10", "stop", "-m", "fast"], { env: environment }).catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  }
  await writeFile(join(outDir!, "rehearsal.json"), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write("rehearsal done\n");
}

main().catch(error => { console.error(error); process.exit(1); });
