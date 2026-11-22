// @vitest-environment node
// PROOF-ONLY (managed-signer lane, 2026-11-22). Copied by run-proof.sh into a `git archive` export of Y 1efdfb436 at
// web/lib/blsh/nativeCaptureV6/; never placed in the canonical checkout. Drives Y's real request-context and official
// handlers over real loopback HTTP, a disposable PostgreSQL 15 with Y's real BLSH migrations and the proposed operator SQL,
// a mock KMS (non-exportable stand-in) and the proposed signer code, on a simulated clock at 2026-11-23.
import { spawnSync, execFileSync } from "node:child_process";
import { createHash, createPublicKey, verify } from "node:crypto";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { createServer as createHttp, request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { createServer as createHttps } from "node:https";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import type { NextApiRequest, NextApiResponse } from "next";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createRequestContextHandler, requestContextApprovalBytes } from "./requestContextHandler";
import { officialPilotApprovalBytes, officialPilotHandler } from "./officialPilotHandler";
import { createOfficialPilotStore } from "./officialPilotStore";
import { OFFICIAL_ORIGIN } from "./officialPilotAcquisition";
import { RUNTIME_OVERRIDE_KEYS } from "./runtimeReceipt";
import { NST_ADMISSION_PROJECT_HOST } from "../../nst/admissionOrigin";
import { prepareNativeProcessCapture } from "../../../scripts/blsh/nativeProcessCapturePreparation";
import type { RequestContextStore } from "./requestContextStore";
import { createServer as createNet } from "node:net";
import pg from "pg";

const PROOF = process.env.BLSH_SIGNER_PROOF_DIR!;            // the artifact proof/ folder (read-only inputs)
const OUT = process.env.BLSH_SIGNER_PROOF_OUT!;              // scratch output folder
const LIVE = process.env.BLSH_SIGNER_LIVE_SQL_DIR!;          // live-pilot redate-20261123 folder (read-only)
const MIGRATIONS_DIR = join(__dirname, "../../../../supabase/migrations");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createSigner, requestContextBytes, officialBytes, fingerprintOfDer, pemOfDer } = await import(join(PROOF, "signer/blshSigner.mjs"));
const { createMockKms, createFileLedger } = await import(join(PROOF, "harness/mockKms.mjs"));
const { createSupabaseSigner, generateVaultKeys } = await import(join(PROOF, "signer/supabaseSigner.mjs"));

// ---------- fixed pilot facts (as Y is dated) ----------
const D = "2026-11-22", C = "2026-11-23";
const GAMES = [2026020373, 2026020374, 2026020375, 2026020376, 2026020377];
const DEPLOYMENT_ID = "dpl_PilotFixtureReady0001", GIT_SHA = "1efdfb4364dffa73a9c249f382dbfebe22ebbbd2";
const SIGNER_URL = "https://abcdefghijklmnopqrstuvwxyz012345.lambda-url.us-east-1.on.aws";
const SIGNER_ROLE = "arn:aws:iam::111122223333:role/blsh-signer-lambda";
const VERCEL_APP_IDENTITY = "arn:aws:sts::111122223333:assumed-role/vercel-fhfhockey-production/fhfhockey";
const TRIGGER = "t".repeat(24) + "-fixture-trigger-secret-0001";
const NATIVE_NAMES = ["STARTED.json", "PLAN.json", "RUNTIME.json", "operation-1-STARTED.json", "operation-1-SETTLED.json",
  "schedule.raw.json", "schedule.TRANSPORT-OBSERVATION.json", "operation-2-STARTED.json", "operation-2-SETTLED.json",
  "operation-3-STARTED.json", "operation-3-SETTLED.json", "individual.parser-input.html", "individual.TRANSPORT-OBSERVATION.json",
  "operation-4-STARTED.json", "operation-4-SETTLED.json", "operation-5-STARTED.json", "operation-5-SETTLED.json",
  "onIce.parser-input.html", "onIce.TRANSPORT-OBSERVATION.json", "MANIFEST.json"];
const hash = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");
const json = (v: unknown) => Buffer.from(JSON.stringify(v) + "\n");
const log: string[] = [];
const note = (line: string) => { log.push(line); };

// ---------- simulated wall clock (Date.now only; timers and performance stay real) ----------
let simBase = Date.parse(C + "T11:00:00Z"), simT0 = performance.now();
const jump = (isoTime: string) => { simBase = Date.parse(isoTime); simT0 = performance.now(); };
const nowMs = () => simBase + Math.floor(performance.now() - simT0);

// ---------- disposable PostgreSQL 15 ----------
const PGBIN = "/opt/homebrew/opt/postgresql@15/bin";
let pgRoot = "", pgEnv: NodeJS.ProcessEnv = {}, pgPort = 0;
let DB = "tmpl";
function psql(sql: string, opts: { role?: string; db?: string; vars?: Record<string, string>; expectError?: string } = {}) {
  const args = ["-XAtq", "-h", pgRoot, "-p", String(pgPort), "-U", opts.role ?? "postgres", "-d", opts.db ?? DB, "-v", "ON_ERROR_STOP=1"];
  for (const [k, v] of Object.entries(opts.vars ?? {})) args.push("-v", `${k}=${v}`);
  const r = spawnSync(join(PGBIN, "psql"), args, { input: `set fixture.at = '${new Date(nowMs()).toISOString()}';\n` + sql, env: pgEnv, encoding: "utf8", timeout: 30000 });
  if (opts.expectError) {
    if (r.status === 0 || !r.stderr.includes(opts.expectError)) throw new Error(`expected ${opts.expectError}: ${r.stderr}`);
    return r.stderr.trim();
  }
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}
const shifted = (text: string) => { expect(text.includes("fixture.")).toBe(false); return text.replaceAll("pg_catalog.clock_timestamp()", "fixture.wall_clock()"); };
const STUBS = `
create role anon; create role authenticated; create role service_role bypassrls login;
create schema storage; create schema cron; create schema net; create schema vault; create schema fhfh_internal; create schema fixture;
create function fixture.wall_clock() returns timestamptz language sql volatile as $$select current_setting('fixture.at')::timestamptz$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(bucket_id text,name text,metadata jsonb,owner uuid);
alter table storage.objects enable row level security;
grant all on storage.objects, storage.buckets to service_role;
create table cron.job(jobid bigserial primary key,schedule text not null,command text not null,nodename text default 'localhost',
  nodeport int default 5432,database text default 'postgres',username text not null default current_user,active boolean not null default true,jobname text,
  unique (jobname, username));
insert into cron.job(jobid,jobname,schedule,command) values
 (404,'blsh-native-capture','5 12 * * *','select 1'),(405,'blsh-native-capture-backup','20 12 * * *','select 1'),
 (406,'blsh-native-capture-watchdog','50 12 * * *','select 1'),(407,'blsh-native-capture-watchdog-assert','52 12 * * *','select 1'),
 (408,'unrelated-job-408','0 13 * * *','select 1');
select setval('cron.job_jobid_seq', 408);
-- pg_cron 1.4 semantics, emulated (see E2-PLAN for the source citation): RLS shows each role only its own jobs; schedule keys a job on
-- (jobname, the calling role) and records that role as the job's username; unschedule of another role's job needs DELETE on cron.job;
-- a job's command runs as its username (the harness's fire() does SET ROLE to it).
alter table cron.job enable row level security;
create policy cron_job_policy on cron.job using (username = current_user);
create table cron.job_run_details(runid bigserial primary key,jobid bigint,username text,command text,status text,return_message text,start_time timestamptz,end_time timestamptz);
alter table cron.job_run_details enable row level security;
create policy cron_job_run_details_policy on cron.job_run_details using (username = current_user);
create function cron.caller() returns text language sql stable as
  $$ select case when current_setting('role') = 'none' then session_user::text else current_setting('role') end $$;
create function cron.schedule(job_name text, schedule text, command text) returns bigint language plpgsql security definer as $$
declare id bigint; who text := cron.caller();
begin
  insert into cron.job(jobname, schedule, command, username) values (job_name, schedule, command, who)
    on conflict (jobname, username) do update set schedule = excluded.schedule, command = excluded.command returning jobid into id;
  return id;
end $$;
create function cron.unschedule(job_id bigint) returns boolean language plpgsql security definer as $$
declare who text := cron.caller(); owner text;
begin
  -- v1.4.2 job_metadata.c EnsureDeletePermission: a non-owner needs DELETE on cron.job (Postgres aclcheck_error).
  select j.username into owner from cron.job j where j.jobid = job_id;
  if owner is null then raise exception 'could not find valid entry for job %', job_id; end if;
  if owner <> who and not has_table_privilege(who, 'cron.job', 'delete') then raise exception 'permission denied for table job'; end if;
  delete from cron.job where jobid = job_id;
  return true;
end $$;
revoke all on function cron.schedule(text,text,text), cron.unschedule(bigint) from public;
create table vault.decrypted_secrets(name text,decrypted_secret text);
create table vault.secrets(id uuid,name text,secret text);
create function vault.create_secret(new_secret text, new_name text) returns uuid language plpgsql as $$
begin insert into vault.decrypted_secrets values (new_name,new_secret); return gen_random_uuid(); end $$;
create function fhfh_internal.require_cron_request_headers() returns jsonb language sql as $$select '{"Authorization":"Bearer fixture-cron"}'::jsonb$$;
-- pg_net shape: request queue drained by the harness worker; responses land in net._http_response.
create table net.queue(id bigserial primary key,method text,url text,headers jsonb,body text,timeout_ms int);
create table net._http_response(id bigint primary key,status_code int,content_type text,headers jsonb,content text,timed_out boolean,error_msg text,created timestamptz default now());
create function net.http_get(url text,headers jsonb,timeout_milliseconds int) returns bigint language sql security definer as
  $$ insert into net.queue(method,url,headers,timeout_ms) values ('GET',$1,$2,$3) returning id $$;
-- pg_net's http_post serialises its jsonb body with ::text (spaces after ':' and ',', jsonb key order).
create function net.http_post(url text,body jsonb default '{}'::jsonb,params jsonb default '{}'::jsonb,
  headers jsonb default '{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds int default 5000) returns bigint language sql security definer as
  $$ insert into net.queue(method,url,headers,body,timeout_ms) values ('POST',url,headers,body::text,timeout_milliseconds) returning id $$;
`;

// ---------- native packet fixture (the 12:05Z capture is out of scope; its rows are seeded) ----------
const NATIVE_RUN = "5a1e0000-0000-4000-8000-00000000c0de";
const storageDir = () => join(OUT, "storage");
const schedule = { gameWeek: [{ date: D, games: GAMES.map((id, i) => ({ id, season: 20262027, gameType: 2, gameState: "OFF", gameScheduleState: "OK",
  homeTeam: { id: 1 + i * 2, abbrev: ["BOS", "NYR", "TOR", "EDM", "VAN"][i] }, awayTeam: { id: 2 + i * 2, abbrev: ["MTL", "NJD", "OTT", "CGY", "SEA"][i] } })) }] };
function nativePacket(deploymentId = DEPLOYMENT_ID) {
  jump(C + "T12:05:30Z");
  const plan = prepareNativeProcessCapture({ seasonId: 20262027, date: D, plannedAtUTC: C + "T12:05:00.500Z", groups: ["individual", "onIce"] });
  const files: Record<string, Buffer> = {};
  for (const name of NATIVE_NAMES) files[name] = json({ fixture: name, sourceDate: D });
  files["schedule.raw.json"] = Buffer.from(JSON.stringify(schedule));
  files["schedule.TRANSPORT-OBSERVATION.json"] = json({ completedGameIds: GAMES, sha256: hash(files["schedule.raw.json"]) });
  for (const [index, group] of (["individual", "onIce"] as const).entries()) {
    const body = Buffer.from("<table><tr><td>1</td></tr><tr><td>2</td></tr></table>"), at = C + (index ? "T12:05:45.003Z" : "T12:05:20.001Z");
    files[group + ".parser-input.html"] = body;
    files[group + ".TRANSPORT-OBSERVATION.json"] = json({ status: "candidate_requires_adapter_and_source_review", operation: "nst:" + group,
      file: group + ".parser-input.html", sha256: hash(body), bytes: body.length, retrievedAtUTC: at, retainedAtUTC: at, httpStatus: 200,
      finalUrl: plan.pages[index].url, redirected: false, TLSVerified: null, tlsEvidence: "pending_runtime_review", representation: "client_redacted_parser_input",
      deploymentBinding: { deploymentId, gitCommitSha: GIT_SHA, routeBundleSHA256: "7".repeat(64) }, parsedRows: 2, completedGameIds: null,
      originalPublicationUTC: null, modelDefinition: "unknown", independentlyAccepted: false, advancedAdmission: false, score: null });
  }
  const entries = NATIVE_NAMES.slice(0, 19).map((file) => ({ file, bytes: files[file].length, sha256: hash(files[file]) }));
  files["MANIFEST.json"] = json({ state: "packet_complete_pending_review", sourceDate: D, runId: NATIVE_RUN, files: entries, completedAtUTC: C + "T12:06:00.981Z" });
  return files;
}
function seedNative(files: Record<string, Buffer>, deploymentId = DEPLOYMENT_ID) {
  jump(C + "T12:05:30Z");
  const dep = JSON.stringify({ deploymentId, gitCommitSha: GIT_SHA });
  expect(psql(`select public.blsh_capture_claim_v1('native-v6','${D}','${dep}') ->> 'claimed'`, { role: "service_role" })).toBe("true");
  const rows = NATIVE_NAMES.map((name, i) => {
    const path = `native-v6/${D}/${NATIVE_RUN}/${name}`;
    mkdirSync(join(storageDir(), "native", NATIVE_RUN), { recursive: true });
    writeFileSync(join(storageDir(), "native", NATIVE_RUN, name), new Uint8Array(files[name]));
    return `('${NATIVE_RUN}',${i + 1},'${path}',${files[name].length},'${hash(files[name])}')`;
  });
  psql(`set session_replication_role = replica;
    update public.blsh_capture_runs set run_id='${NATIVE_RUN}', claimed_at='${C} 12:05:00.400Z', state='packet_complete_pending_review',
      closed_at='${C} 12:06:01.000Z', manifest_sha256='${hash(files["MANIFEST.json"])}' where source_date='${D}';
    insert into public.blsh_capture_objects(run_id,ordinal,path,bytes,sha256) values ${rows.join(",")};
    insert into storage.objects(bucket_id,name,metadata) select 'blsh-native-packets', path, jsonb_build_object('size',bytes) from public.blsh_capture_objects;`);
}

// ---------- the Vercel app: Y's handlers behind loopback HTTP ----------
const sample = (() => {
  const raw = readFileSync(join(__dirname, "__fixtures__/request-context-v1.sample.json"), "utf8");
  const shiftedDates = raw.replace(/(?<![\d-])(20\d\d-\d\d-\d\d)(?![\d-])/g, (d) => new Date(Date.parse(d) + 3 * 86400000).toISOString().slice(0, 10));
  return Buffer.from(shiftedDates.replaceAll("T12:40:00+00:00", "T12:36:30+00:00"));
})();
const pgStore = (): RequestContextStore => ({
  async source(t) {
    const src = JSON.parse(psql(`select public.blsh_context_source_v1('${t.sourceDate}','${t.nativeRunId}','${t.nativeManifestSHA256}')`, { role: "service_role" }));
    const read = (name: string) => readFileSync(join(storageDir(), "native", t.nativeRunId, name));
    return { claimedAtUTC: src.claimedAtUTC, closedAtUTC: src.closedAtUTC, manifest: read("MANIFEST.json"),
      individual: read("individual.TRANSPORT-OBSERVATION.json"), onIce: read("onIce.TRANSPORT-OBSERVATION.json") };
  },
  async claim(t) {
    const r = JSON.parse(psql(`select public.blsh_context_claim_v1('${t.sourceDate}','${t.nativeRunId}','${t.nativeManifestSHA256}')`, { role: "service_role" }));
    return r.claimed ? { claimed: true, runId: r.runId } : { claimed: false };
  },
  async readContext() { jump(C + "T12:36:31Z"); return Buffer.from(sample); },
  async putObject(runId, day, ordinal, file, bytes, sha) {
    const path = `request-context-v1/${day}/${runId}/${file}`;
    psql(`insert into storage.objects(bucket_id,name,metadata) values ('blsh-request-context','${path}',jsonb_build_object('size',${bytes.length}))`);
    expect(psql(`select public.blsh_context_object_v1('${runId}',${ordinal},'${path}','${sha}',${bytes.length})`, { role: "service_role" })).toBe("t");
  },
  async close(runId, state, reason, sha, manifest) {
    const q = (v: string | null) => (v === null ? "null" : `$q$${v}$q$`);
    expect(psql(`select public.blsh_context_close_v1('${runId}','${state}',${q(reason)},${q(sha)},${q(manifest ? manifest.toString("utf8") : null)})`, { role: "service_role" })).toBe("t");
  },
});
let rcPublicPem = "", officialPublicPem = "";
const rcHandler = createRequestContextHandler({ approvalPublicKeyPem: () => rcPublicPem, createStore: async () => pgStore() });
const officialEvents: string[] = [];
let officialTls: { ca: string; port: number } | undefined, officialHandler: ReturnType<typeof officialPilotHandler> | undefined;
function officialStore() {
  // Claim goes to the real PG claim function (slot, native binding, schedule hash, deployment); objects/close stay in memory
  // because the DB requires acquisitionClass vercel_direct_https and this run uses the loopback TLS fixture.
  return createOfficialPilotStore({ serviceKey: "fixture-only", transport: async (request) => {
    const rpc = request.url.slice((OFFICIAL_ORIGIN + "/rest/v1/rpc/").length), body = JSON.parse(request.body!.toString("utf8"));
    if (rpc === "blsh_official_claim_v1") {
      officialEvents.push("claim");
      return Buffer.from(psql(`select public.blsh_official_claim_v1('${body.p_source_date}','${body.p_native_run_id}','${body.p_native_manifest_sha256}',
        '${body.p_deployment_id}','${body.p_git_commit_sha}','${body.p_schedule_sha256}','{${body.p_game_ids.join(",")}}')`, { role: "service_role" }));
    }
    officialEvents.push(rpc === "blsh_official_close_v1" ? "close:" + body.p_state : "object:" + String(body.p_path).split("/").at(-1));
    return Buffer.from("true");
  } });
}
function asNext(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://fhfhockey.local");
  Object.assign(req, { query: Object.fromEntries(url.searchParams) });
  const r = Object.assign(res, { status(n: number) { res.statusCode = n; return r; },
    json(v: unknown) { if (!res.headersSent) res.setHeader("content-type", "application/json"); res.end(JSON.stringify(v)); return r; } });
  return { url, req: req as unknown as NextApiRequest, res: r as unknown as NextApiResponse };
}
const appRequests: { path: string; status: number; body: string; bodyBytes: string }[] = [];
const app = createHttp(async (rawReq, rawRes) => {
  const { url, req, res } = asNext(rawReq, rawRes);
  if (url.pathname === "/api/v1/db/blsh-request-context") await rcHandler(req, res);
  else if (url.pathname === "/api/v1/db/blsh-official-boxscores" && officialHandler) await officialHandler(req, res);
  else { rawRes.statusCode = 404; rawRes.end("{}"); }
});

// ---------- the signer behind loopback HTTP (stands in for the Lambda function URL) ----------
let mandate: Record<string, unknown> = {};
const signerLog: string[] = [];
let kms: ReturnType<typeof createMockKms>, ledger: ReturnType<typeof createFileLedger>;
let kmsForSigner: { getPublicKey: (i: unknown) => Promise<unknown>; sign: (i: unknown) => Promise<unknown> };
let nhl: (date: string) => Promise<unknown> = async () => schedule;
const signer = () => createSigner({ mandate: () => mandate, now: nowMs, triggerSecret: () => TRIGGER, kms: kmsForSigner, ledger,
  nhlSchedule: (d: string) => nhl(d), log: (e: unknown) => signerLog.push(JSON.stringify(e)) });
const signerServer = createHttp(async (req, res) => {
  const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer);
  const url = new URL(req.url ?? "/", "http://signer.local");
  const out = await signer().handle({ method: req.method, path: url.pathname, rawQuery: url.search.slice(1), headers: req.headers, body: Buffer.concat(chunks).toString("utf8") });
  res.statusCode = out.status; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(out.body));
});

// ---------- Option V1: the Supabase-hosted signer (stands in for the Edge Function), DB access as postgres ----------
const SUPA_ORIGIN = "https://abcdefghijklmnopqrst.supabase.co", SUPA_URL = SUPA_ORIGIN + "/functions/v1/blsh-signer";
const KEY_NAMES = { requestContext: "blsh_signer_rc_key_20261122", official: "blsh_signer_official_key_20261122" };
const supaLog: string[] = [];
const dq = (t: string) => "$j$" + t + "$j$";
let evidenceCalls = 0;
const supaDb = {
  selfcheck: async () => {
    const currentUser = psql("select current_user");
    let ledgerWritable = false;
    try { psql(`begin; insert into fhfh_internal.blsh_signer_issuance_20261122(slot, record) values ('request-context#2026-11-22', '{}'); rollback;`); ledgerWritable = true; } catch { ledgerWritable = false; }
    return { currentUser, ledgerWritable };
  },
  evidence: async (kind: string) => (evidenceCalls++, psql(`select fhfh_internal.blsh_signer_evidence_20261122('${kind}')::text`)),
  readSecret: async (name: string) => psql(`select secret from fhfh_internal.blsh_signer_secrets where name = ${dq(name)}`) || null,
  reserve: async (slot: string, attrs: unknown) => psql(`insert into fhfh_internal.blsh_signer_issuance_20261122(slot, record)
    values (${dq(slot)}, ${dq(JSON.stringify(attrs))}::jsonb) on conflict do nothing returning slot`) === slot,
  complete: async (slot: string, attrs: unknown) => {
    expect(psql(`update fhfh_internal.blsh_signer_issuance_20261122 set record = ${dq(JSON.stringify(attrs))}::jsonb where slot = ${dq(slot)} returning slot`)).toBe(slot);
  },
  get: async (slot: string) => { const r = psql(`select record::text from fhfh_internal.blsh_signer_issuance_20261122 where slot = ${dq(slot)}`); return r ? JSON.parse(r) : null; },
};
const supaSigner = () => createSupabaseSigner({ mandate: () => mandate, now: nowMs, db: supaDb, nhlSchedule: (d: string) => nhl(d),
  log: (e: unknown) => supaLog.push(JSON.stringify(e)) });
const supaServer = createHttp(async (req, res) => {
  const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer);
  const url = new URL(req.url ?? "/", "http://supa.local");
  const out = await supaSigner().handle({ method: req.method, path: url.pathname, rawQuery: url.search.slice(1), headers: req.headers, body: Buffer.concat(chunks).toString("utf8") });
  res.statusCode = out.status; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(out.body));
});

// ---------- pg_net worker: sends each queued request byte-for-byte to the mapped local server ----------
function send(base: string, method: string, path: string, headers: Record<string, string>, body?: string) {
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const u = new URL(base);
    const h: Record<string, string> = { ...headers };
    if (body !== undefined) h["content-length"] = String(Buffer.byteLength(body));
    const r = httpRequest({ host: "127.0.0.1", port: Number(u.port), method, path, headers: h }, (res) => {
      const parts: Buffer[] = []; res.on("data", (c) => parts.push(c)); res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(parts).toString("utf8") }));
    });
    r.on("error", reject); if (body !== undefined) r.write(body); r.end();
  });
}
const bases: Record<string, string> = {};
async function drainNet() {
  const rows = JSON.parse(psql(`select coalesce(json_agg(q order by id),'[]') from net.queue q`));
  for (const q of rows) {
    const u = new URL(q.url);
    const base = u.origin === SIGNER_URL ? bases.signer : u.origin === SUPA_ORIGIN ? bases.supa : u.origin === "https://fhfhockey.com" ? bases.app : undefined;
    let status = 0, text = "", timedOut = false;
    if (!base) { timedOut = true; } else {
      const out = await send(base, q.method, (base === bases.supa ? u.pathname.replace("/functions/v1/blsh-signer", "") : u.pathname) + u.search, q.headers ?? {}, q.body ?? undefined);
      status = out.status; text = out.text;
      if (base === bases.app) appRequests.push({ path: u.pathname, status, body: text, bodyBytes: q.body ?? "" });
    }
    psql(`insert into net._http_response(id,status_code,content,timed_out) values (${q.id},${status || "null"},$r$${text}$r$,${timedOut});
      delete from net.queue where id=${q.id};`);
  }
  return rows.length;
}
function fire(jobname: string, at: string, username = "postgres") {
  jump(at);
  const cmd = psql(`select command from cron.job where jobname='${jobname}' and username='${username}'`);
  if (!cmd) return false;
  psql(username === "postgres" ? cmd : `set role ${username};\n${cmd}`);
  return true;
}
const steps = () => psql(`select string_agg(step||'='||disposition||coalesce(':'||reason,''),' ' order by job_id) from fhfh_internal.blsh_signer_steps_20261122`);

// ---------- setup ----------
let rcKeyFp = "", officialKeyFp = "";
function freshMandate(over: Record<string, unknown> = {}) {
  return { version: "fhfh.blsh.signer-mandate.v1", armed: true, sourceDate: D, captureDate: C, gameIds: GAMES, deploymentId: DEPLOYMENT_ID, gitCommitSha: GIT_SHA,
    keys: { requestContext: { keyId: "alias/blsh-request-context-v1", fingerprint: rcKeyFp }, official: { keyId: "alias/blsh-official-pilot-v1", fingerprint: officialKeyFp } },
    windows: { requestContext: [C + "T12:35:00Z", C + "T12:38:00Z"], official: [C + "T12:41:00Z", C + "T12:44:00Z"] },
    approvalRef: "TJ line S5 fixture", ...over };
}
let ledgerSeq = 0;
function resetSignerWorld() {
  kms = createMockKms({ now: nowMs });
  const policy = { signPrincipal: SIGNER_ROLE, notBefore: C + "T12:35:00Z", notAfter: C + "T12:45:00Z" };
  kms.admin.createKey("alias/blsh-request-context-v1", policy);
  kms.admin.createKey("alias/blsh-official-pilot-v1", policy);
  kmsForSigner = kms.clientFor(SIGNER_ROLE);
  ledger = createFileLedger(join(OUT, `ledger-${++ledgerSeq}.json`));
}
async function keyPem(alias: string) { const k = await kms.clientFor("arn:aws:iam::111122223333:root").getPublicKey({ KeyId: alias }); return { pem: pemOfDer(k.PublicKey), fp: fingerprintOfDer(k.PublicKey) }; }
function newDb(name: string) { psql(`create database ${name} template tmpl`, { db: "postgres" }); DB = name; }
function setupPilotDb(name: string, opts: { automate?: boolean } = {}) {
  newDb(name);
  const pins = { release_sha: GIT_SHA, deployment_id: DEPLOYMENT_ID };
  jump(C + "T11:00:00Z"); psql(shifted(readFileSync(join(LIVE, "INSTALL.sql"), "utf8")), { vars: pins });
  psql(`insert into vault.decrypted_secrets values ('blsh_signer_trigger_secret','${TRIGGER}')`);
  if (opts.automate !== false) { jump(C + "T11:30:00Z"); psql(shifted(readFileSync(join(PROOF, "sql/AUTOMATE-ONCE.sql"), "utf8")), { vars: { signer_url: SIGNER_URL } }); }
  jump(C + "T12:00:00Z"); psql(shifted(readFileSync(join(LIVE, "ARM.sql"), "utf8")), { vars: pins });
}

beforeAll(async () => {
  vi.spyOn(Date, "now").mockImplementation(nowMs);
  mkdirSync(OUT, { recursive: true });
  pgRoot = mkdtempSync("/tmp/bsp-");
  pgEnv = { PATH: PGBIN + ":/usr/bin:/bin", LC_ALL: "C", HOME: pgRoot };
  // Unix socket: trust (harness admin). Loopback TCP: SCRAM passwords, so E2's password rotation is tested for real.
  pgPort = await new Promise<number>((resolve) => { const n = createNet(); n.listen(0, "127.0.0.1", () => { const p = (n.address() as { port: number }).port; n.close(() => resolve(p)); }); });
  execFileSync(join(PGBIN, "initdb"), ["-D", join(pgRoot, "d"), "-U", "postgres", "--auth-local=trust", "--auth-host=scram-sha-256", "--no-locale", "-E", "UTF8", "--no-sync"], { env: pgEnv, stdio: "ignore" });
  execFileSync(join(PGBIN, "pg_ctl"), ["-D", join(pgRoot, "d"), "-l", join(pgRoot, "log"), "-o", `-k ${pgRoot} -c listen_addresses=127.0.0.1 -c port=${pgPort}`, "-w", "start"], { env: pgEnv, stdio: "ignore" });
  psql("create database tmpl", { db: "postgres" });
  psql(STUBS);
  for (const name of ["20261116000000_blsh_native_capture_v6.sql", "20261116000100_blsh_request_context_v1.sql", "20261118131414_blsh_request_context_custody.sql",
    "20261118155445_blsh_official_pilot.sql", "20261120143000_blsh_official_pilot_redate_20261121.sql", "20261121210000_blsh_official_pilot_redate_20261122.sql"]) {
    psql((name.startsWith("20261116000100") ? "set check_function_bodies = off;\n" : "") + readFileSync(join(MIGRATIONS_DIR, name), "utf8"));
  }
  psql(`create or replace function public.blsh_official_clock_v1() returns timestamptz language sql volatile set search_path = '' as $$ select fixture.wall_clock() $$`);
  note(`PG ${psql("show server_version")}: stubs + Y's six BLSH migrations (incl. both re-dates) applied`);
  // env of the fhfhockey production deployment under test
  for (const k of RUNTIME_OVERRIDE_KEYS) delete process.env[k];
  Object.assign(process.env, { CRON_SECRET: "fixture-cron", VERCEL_ENV: "production", VERCEL_REGION: "iad1", VERCEL_DEPLOYMENT_ID: DEPLOYMENT_ID,
    VERCEL_GIT_COMMIT_SHA: GIT_SHA, NEXT_PUBLIC_SUPABASE_URL: "https://" + NST_ADMISSION_PROJECT_HOST, SUPABASE_SERVICE_ROLE_KEY: "fixture-only" });
  expect(OFFICIAL_ORIGIN).toBe("https://" + NST_ADMISSION_PROJECT_HOST);
  // official loopback TLS fixture for api-web.nhle.com (same construction as Y's officialPilotHandler.testHelper.ts)
  const keys = mkdtempSync(join(OUT, "tls-"));
  const openssl = (...argv: string[]) => execFileSync("openssl", argv, { cwd: keys, stdio: "ignore" });
  writeFileSync(join(keys, "ca.cnf"), "[ca]\ndefault_ca=fixture\n[fixture]\ndatabase=index\nserial=serial\nnew_certs_dir=.\ndefault_md=sha256\npolicy=policy\nx509_extensions=ext\n[policy]\ncommonName=supplied\n[ext]\nbasicConstraints=critical,CA:true\nsubjectAltName=DNS:api-web.nhle.com\n");
  writeFileSync(join(keys, "index"), ""); writeFileSync(join(keys, "serial"), "01\n");
  openssl("req", "-new", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=api-web.nhle.com", "-keyout", "fixture.key", "-out", "fixture.csr");
  openssl("ca", "-batch", "-selfsign", "-config", "ca.cnf", "-keyfile", "fixture.key", "-in", "fixture.csr", "-out", "fixture.crt", "-notext", "-startdate", "20200101000000Z", "-enddate", "20990101000000Z");
  const ca = readFileSync(join(keys, "fixture.crt"), "utf8"), tlsKey = readFileSync(join(keys, "fixture.key"));
  rmSync(keys, { recursive: true, force: true });
  const boxes = Object.fromEntries(GAMES.map((id) => [String(id), Buffer.from(JSON.stringify({ id, gameDate: D, season: 20262027, gameType: 2, gameState: "OFF", gameScheduleState: "OK" }, null, 2) + "\r\n")]));
  const tls = createHttps({ cert: ca, key: tlsKey }, (req, res) => {
    const m = /^\/v1\/gamecenter\/(202602\d{4})\/boxscore$/.exec(req.url ?? "");
    if (req.method !== "GET" || !m || !boxes[m[1]]) { res.writeHead(404); res.end(); return; }
    officialEvents.push("box:" + m[1]); res.end(boxes[m[1]]);
  });
  tls.listen(0, "127.0.0.1"); await once(tls, "listening");
  officialTls = { ca, port: (tls.address() as { port: number }).port };
  officialHandler = officialPilotHandler(join(__dirname, "../../../pages/api/v1/db/blsh-official-boxscores.ts"), { socket: officialTls, store: officialStore() });
  for (const [name, server] of [["app", app], ["signer", signerServer], ["supa", supaServer]] as const) {
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    bases[name] = "http://127.0.0.1:" + (server.address() as { port: number }).port;
  }
  (globalThis as { __tls?: unknown }).__tls = tls;
}, 120000);
afterAll(async () => {
  for (const s of [app, signerServer, supaServer, (globalThis as { __tls?: { close(cb: () => void): void } }).__tls]) await new Promise<void>((r) => (s ? s.close(() => r()) : r()));
  if (pgRoot) { spawnSync(join(PGBIN, "pg_ctl"), ["-D", join(pgRoot, "d"), "-m", "immediate", "-w", "stop"], { env: pgEnv }); rmSync(pgRoot, { recursive: true, force: true }); }
  writeFileSync(join(OUT, "proof-log.txt"), log.join("\n") + "\n");
  writeFileSync(join(OUT, "signer-decisions.jsonl"), signerLog.join("\n") + "\n");
  writeFileSync(join(OUT, "supabase-signer-decisions.jsonl"), supaLog.join("\n") + "\n");
  vi.restoreAllMocks();
});

describe("managed signer: full timed hand-off against Y's unchanged verifier", () => {
  it("12:05 native receipt -> 12:35 signer -> 12:36 request-context POST -> 12:41 signer -> 12:42 Vault -> 12:45 official", async () => {
    resetSignerWorld();
    ({ pem: rcPublicPem, fp: rcKeyFp } = await keyPem("alias/blsh-request-context-v1"));
    ({ pem: officialPublicPem, fp: officialKeyFp } = await keyPem("alias/blsh-official-pilot-v1"));
    process.env.BLSH_OFFICIAL_PILOT_APPROVAL_PUBLIC_KEY = officialPublicPem;
    mandate = freshMandate();
    // The signer's byte layouts equal Y's (imported, not copied).
    const probe = { sourceDate: D, nativeRunId: NATIVE_RUN, nativeManifestSHA256: "a".repeat(64), scheduleSHA256: "b".repeat(64), deploymentId: DEPLOYMENT_ID, gitCommitSha: GIT_SHA, gameIds: GAMES };
    expect(Buffer.from(requestContextBytes(probe))).toEqual(Buffer.from(requestContextApprovalBytes(probe)));
    expect(Buffer.from(officialBytes(probe))).toEqual(Buffer.from(officialPilotApprovalBytes(probe)));
    note("PASS signer byte layouts equal Y's requestContextApprovalBytes and officialPilotApprovalBytes");
    // The 12:45 dispatch command in AUTOMATE-ONCE is byte-identical to the reviewed SCHEDULE-ONCE command.
    const cmd = (text: string) => text.slice(text.indexOf("$command$"), text.lastIndexOf("$command$") + 9);
    expect(cmd(readFileSync(join(PROOF, "sql/AUTOMATE-ONCE.sql"), "utf8"))).toBe(cmd(readFileSync(join(LIVE, "SCHEDULE-ONCE.sql"), "utf8")));
    note("PASS AUTOMATE-ONCE 12:45 dispatch command is byte-identical to reviewed SCHEDULE-ONCE.sql (33b1ead0...)");

    setupPilotDb("happy");
    const jobs = psql(`select string_agg(jobname||'@'||schedule, ', ' order by jobid) from cron.job where jobid > 408`);
    note("registered at 11:30 (before ARM): " + jobs);
    expect(jobs.split(", ").length).toBe(5);
    seedNative(nativePacket());
    note("12:05:30 native run claimed through Y's claim RPC under INSTALL/ARM (shifted); packet rows seeded");

    expect(fire("blsh-signer-rc-sign-20261122", C + "T12:35:00.200Z")).toBe(true);
    expect(await drainNet()).toBe(1);
    expect(fire("blsh-signer-rc-post-20261122", C + "T12:36:00.150Z")).toBe(true);
    expect(psql(`select count(*) from net._http_response r join fhfh_internal.blsh_signer_steps_20261122 s on s.request_id=r.id and s.step='rc_sign'`)).toBe("0");
    expect(await drainNet()).toBe(1);
    const rc = appRequests.at(-1)!;
    note(`12:36 request-context POST body as pg_net sends it (jsonb::text, ${Buffer.byteLength(rc.bodyBytes)} bytes): ${rc.bodyBytes.slice(0, 60)}...`);
    expect(rc.bodyBytes).not.toBe(JSON.stringify(JSON.parse(rc.bodyBytes)));          // reordered/spaced, not the signer's bytes
    note(`12:36 request-context response ${rc.status} ${rc.body}`);
    expect(rc.status).toBe(200);
    expect(JSON.parse(rc.body).state).toBe("packet_complete_pending_review");
    expect(psql(`select state from public.blsh_context_runs where source_date='${D}'`)).toBe("packet_complete_pending_review");
    note("PASS Y requestContextHandler accepted the KMS-signed envelope as re-serialised by Postgres jsonb; context packet complete in PG");

    expect(fire("blsh-signer-official-sign-20261122", C + "T12:41:00.300Z")).toBe(true);
    expect(await drainNet()).toBe(1);
    expect(fire("blsh-signer-official-store-20261122", C + "T12:42:00.100Z")).toBe(true);
    expect(psql(`select count(*) from vault.decrypted_secrets where name='blsh_official_grant_${D.replaceAll("-", "")}'`)).toBe("1");
    expect(psql(`select count(*) from net._http_response r join fhfh_internal.blsh_signer_steps_20261122 s on s.request_id=r.id and s.step like '%sign'`)).toBe("0");
    note("steps: " + steps());

    expect(fire("blsh-official-once-20261122", C + "T12:45:01.000Z")).toBe(true);
    expect(psql(`select disposition from fhfh_internal.blsh_official_dispatch_20261122`)).toBe("queued");
    process.execArgv.splice(0);
    expect(await drainNet()).toBe(1);
    const off = appRequests.at(-1)!;
    note(`12:45 official GET -> ${off.status} ${off.body.slice(0, 140)}`);
    expect(off.status).toBe(200);
    expect(JSON.parse(off.body).state).toBe("packet_complete_pending_review");
    expect(psql(`select array_to_string(game_ids,',')||'|'||deployment_id||'|'||git_commit_sha from public.blsh_official_runs`)).toBe(`${GAMES.join(",")}|${DEPLOYMENT_ID}|${GIT_SHA}`);
    note("PASS Y officialPilotHandler accepted the Vault grant; real PG blsh_official_claim_v1 accepted slot, native binding, schedule hash and deployment");
    expect(psql(`select count(*) from cron.job where jobid > 408`)).toBe("0");
    expect(psql(`select count(*) from net._http_response r where r.content like '%signature%'`)).toBe("0");
    expect(kms.admin.calls().filter((c: { op: string; ok: boolean }) => c.op === "Sign" && c.ok).length).toBe(2);
    expect(signerLog.join("\n")).not.toMatch(/signature|envelope|grantBase64/);
    note(`PASS every pilot job self-removed; no signer response row left in net._http_response; exactly 2 KMS Sign calls; signer log has decision codes and hashes only`);
    writeFileSync(join(OUT, "happy-ledger.json"), JSON.stringify(ledger.dump(), null, 2));
  }, 120000);
});

describe("refusals (each: no KMS signature issued, ledger unchanged unless stated)", () => {
  const signs = () => kms.admin.calls().filter((c: { op: string; ok: boolean }) => c.op === "Sign" && c.ok).length;
  async function call(path: string, body: string, opts: { at: string; headers?: Record<string, string>; method?: string; rawQuery?: string }) {
    jump(opts.at);
    return signer().handle({ method: opts.method ?? "POST", path, rawQuery: opts.rawQuery ?? "", body,
      headers: { authorization: "Bearer " + TRIGGER, "content-type": "application/json", ...(opts.headers ?? {}) } });
  }
  const evidence = (kind: string, at: string) => { jump(at); return JSON.parse(psql(`select fhfh_internal.blsh_signer_evidence_20261122('${kind}')::text`)); };
  async function world(name: string) {
    resetSignerWorld();
    ({ pem: rcPublicPem, fp: rcKeyFp } = await keyPem("alias/blsh-request-context-v1"));
    ({ pem: officialPublicPem, fp: officialKeyFp } = await keyPem("alias/blsh-official-pilot-v1"));
    mandate = freshMandate(); setupPilotDb(name); seedNative(nativePacket());
  }
  const results: string[] = [];
  const expectRefused = async (label: string, out: { status: number; body: { state: string; reason?: string } }, reason: string, before: number) => {
    expect(out.body).toEqual({ state: "refused", reason }); expect(signs()).toBe(before);
    results.push(`PASS refused ${label}: ${out.status} ${reason}`);
  };
  afterAll(() => { for (const r of results) note(r); });

  it("covers slate, deployment, receipt, window, conflict, duplicate, arbitrary input and stop switches", async () => {
    await world("refuse");
    const T = C + "T12:35:10Z";
    const ev = () => evidence("request-context", T);
    const body = (o: unknown) => JSON.stringify(o);
    let n = signs();
    // wrong slate
    mandate = freshMandate({ sourceDate: "2026-11-21", captureDate: "2026-11-22",
      windows: { requestContext: ["2026-11-22T12:35:00Z", "2026-11-22T12:38:00Z"], official: ["2026-11-22T12:41:00Z", "2026-11-22T12:44:00Z"] } });
    await expectRefused("wrong slate (mandate for 2026-11-21 used on 2026-11-23)", await call("/request-context", body(ev()), { at: T }), "outside_signing_window", n);
    mandate = freshMandate();
    let w = ev(); w.nativeRuns[0].sourceDate = "2026-11-21";
    await expectRefused("wrong slate inside a valid window (native run carries 2026-11-21)", await call("/request-context", body(w), { at: T }), "native_receipt_unverified", n);
    w = ev(); w.nativeSource.sourceDate = "2026-11-21";
    await expectRefused("wrong slate inside a valid window (receipt source names 2026-11-21)", await call("/request-context", body(w), { at: T }), "evidence_conflict", n);
    // wrong SHA / deployment
    let e = ev(); e.pilotPin.releaseSha = "0".repeat(40);
    await expectRefused("wrong SHA (INSTALL pin differs from mandate)", await call("/request-context", body(e), { at: T }), "deployment_mismatch", n);
    mandate = freshMandate({ deploymentId: "dpl_SomeOtherReadyDeployment" });
    await expectRefused("wrong deployment (mandate names another READY deployment)", await call("/request-context", body(ev()), { at: T }), "deployment_mismatch", n);
    mandate = freshMandate();
    e = ev(); e.nativeRuns[0].deployment.deploymentId = "dpl_NativeRanElsewhere";
    await expectRefused("native receipt bound to another deployment", await call("/request-context", body(e), { at: T }), "deployment_mismatch", n);
    // missing / unverified receipt
    e = ev(); e.nativeRuns = []; e.nativeSource = null;
    await expectRefused("missing native receipt", await call("/request-context", body(e), { at: T }), "native_receipt_missing", n);
    psql(`update storage.objects set metadata=jsonb_build_object('size',1) where name like '%/schedule.raw.json'`);
    e = ev(); expect(e.nativeSource).toBe(null);
    await expectRefused("unverified receipt (storage size disagrees; Y's blsh_context_source_v1 raises)", await call("/request-context", body(e), { at: T }), "native_receipt_unverified", n);
    psql(`update storage.objects s set metadata=jsonb_build_object('size',o.bytes) from public.blsh_capture_objects o where s.name=o.path`);
    e = ev(); e.nativeRuns[0].state = "failed";
    await expectRefused("unverified receipt (run not complete)", await call("/request-context", body(e), { at: T }), "native_receipt_unverified", n);
    e = ev(); e.nativeRuns[0].closedAtUTC = C + "T12:36:00Z";
    await expectRefused("unverified receipt (closed after the signing window opened)", await call("/request-context", body(e), { at: T }), "native_receipt_unverified", n);
    // windows
    await expectRefused("early request-context (12:34:59.999)", await call("/request-context", body(evidence("request-context", C + "T12:34:59.999Z")), { at: C + "T12:34:59.999Z" }), "outside_signing_window", n);
    await expectRefused("late request-context (12:38:00)", await call("/request-context", body(evidence("request-context", C + "T12:38:00Z")), { at: C + "T12:38:00Z" }), "outside_signing_window", n);
    await expectRefused("official inside the request-context window", await call("/official", body(evidence("official", T)), { at: T }), "outside_signing_window", n);
    mandate = freshMandate({ windows: { requestContext: [C + "T12:30:00Z", C + "T12:38:00Z"], official: [C + "T12:41:00Z", C + "T12:44:00Z"] } });
    await expectRefused("mandate that widens the window past the code bound", await call("/request-context", body(ev()), { at: T }), "mandate_invalid", n);
    mandate = freshMandate();
    // conflicting evidence
    e = ev(); e.nativeSource.nativeManifestSHA256 = "f".repeat(64);
    await expectRefused("conflicting evidence (source manifest hash differs from run row)", await call("/request-context", body(e), { at: T }), "evidence_conflict", n);
    e = ev(); e.nativeRuns.push({ ...e.nativeRuns[0], runId: "5a1e0000-0000-4000-8000-00000000beef" });
    await expectRefused("conflicting evidence (two native runs for one slate)", await call("/request-context", body(e), { at: T }), "evidence_conflict", n);
    e = ev(); e.dbClockUTC = C + "T12:30:00.000Z";
    await expectRefused("stale evidence (DB clock 5 min off)", await call("/request-context", body(e), { at: T }), "evidence_stale", n);
    // arbitrary input
    e = ev(); e.message = Buffer.from("sign me").toString("base64");
    await expectRefused("arbitrary input (extra 'message' member)", await call("/request-context", body(e), { at: T }), "evidence_invalid", n);
    await expectRefused("arbitrary input (unknown route /sign)", await call("/sign", body(ev()), { at: T }), "unknown_route", n);
    await expectRefused("arbitrary input (query string)", await call("/request-context", body(ev()), { at: T, rawQuery: "message=abc" }), "unexpected_parameters", n);
    await expectRefused("arbitrary input (GET)", await call("/request-context", "", { at: T, method: "GET" }), "method_not_allowed", n);
    await expectRefused("arbitrary input (duplicate JSON member)", await call("/request-context", body(ev()).replace('"kind":', '"kind":"official","kind":'), { at: T }), "evidence_invalid", n);
    await expectRefused("caller without the Vault trigger bearer", await call("/request-context", body(ev()), { at: T, headers: { authorization: "Bearer " + "x".repeat(52) } }), "trigger_bearer_required", n);
    // key identity
    mandate = freshMandate({ keys: { requestContext: { keyId: "alias/blsh-request-context-v1", fingerprint: officialKeyFp }, official: { keyId: "alias/blsh-official-pilot-v1", fingerprint: rcKeyFp } } });
    await expectRefused("KMS key whose fingerprint is not the approved one", await call("/request-context", body(ev()), { at: T }), "key_identity_mismatch", n);
    // stop switches
    mandate = freshMandate({ armed: false });
    await expectRefused("stop switch: mandate disarmed", await call("/request-context", body(ev()), { at: T }), "signer_disarmed", n);
    mandate = freshMandate();
    expect(Object.keys(ledger.dump())).toEqual([]);
    kms.admin.disableKey("alias/blsh-request-context-v1");
    await expectRefused("stop switch: KMS DisableKey", await call("/request-context", body(ev()), { at: T }), "kms_sign_failed", n);
    expect(ledger.dump()["request-context#" + D].state).toBe("reserved");
    kms.admin.enableKey("alias/blsh-request-context-v1");
    await expectRefused("retry after a reserve-then-fail (crash between reserve and sign) stays refused", await call("/request-context", body(ev()), { at: T }), "duplicate_request", n);
    results.push("PASS a failed or crashed signing leaves the one-shot slot reserved; nothing is re-signed");
  }, 120000);

  it("residual risk: a holder of the Vault bearer can get a signature over self-consistent forged native IDs; Y's verifier refuses it before any claim, but the slot is burned", async () => {
    await world("forged");
    const T = C + "T12:35:10Z";
    const e = evidence("request-context", T), fakeRun = "f0f0f0f0-0000-4000-8000-00000000f0f0", fakeManifest = "c".repeat(64);
    e.nativeRuns[0].runId = fakeRun; e.nativeRuns[0].manifestSHA256 = fakeManifest;
    e.nativeSource.nativeRunId = fakeRun; e.nativeSource.nativeManifestSHA256 = fakeManifest;
    e.nativeSource.objects = e.nativeSource.objects.map((o: { path: string; sha256: string }, i: number) =>
      ({ ...o, path: o.path.replace(NATIVE_RUN, fakeRun), sha256: i === 19 ? fakeManifest : o.sha256 }));
    const n = signs();
    const forged = await call("/request-context", JSON.stringify(e), { at: T });
    expect(forged.body.state).toBe("issued");
    expect(signs()).toBe(n + 1);
    results.push("FINDING forged-but-self-consistent evidence WITH the Vault bearer -> signer issued (signed fields: mandate slate/deployment + forged run ID and manifest hash)");
    jump(C + "T12:36:00Z");
    const out = await send(bases.app, "POST", "/api/v1/db/blsh-request-context",
      { authorization: "Bearer fixture-cron", "content-type": "application/json" }, JSON.stringify(forged.body.envelope));
    expect(out.status).toBe(503);
    expect(JSON.parse(out.text).reason).toBe("native_source_unverified");
    expect(psql(`select count(*) from public.blsh_context_runs`)).toBe("0");
    results.push("PASS Y requestContextHandler refused the forged approval (503 native_source_unverified) before any claim; 0 context runs");
    await expectRefused("the legitimate 12:35 request after the forged one (slot burned: denial of service, not forgery)",
      await call("/request-context", JSON.stringify(evidence("request-context", C + "T12:35:20Z")), { at: C + "T12:35:20Z" }), "duplicate_request", n + 1);
  }, 120000);

  it("duplicates and concurrency: two simultaneous requests yield exactly one signature; a later repeat is refused", async () => {
    await world("dup");
    const T = C + "T12:35:10Z", b = JSON.stringify(evidence("request-context", T));
    const n = signs();
    jump(T);
    const outs = await Promise.all([0, 1].map(() => signer().handle({ method: "POST", path: "/request-context", rawQuery: "", body: b,
      headers: { authorization: "Bearer " + TRIGGER, "content-type": "application/json" } })));
    expect(outs.map((o: { body: { state: string } }) => o.body.state).sort()).toEqual(["issued", "refused"]);
    expect(signs()).toBe(n + 1);
    await expectRefused("duplicate request after issuance", await call("/request-context", JSON.stringify(evidence("request-context", C + "T12:36:30Z")), { at: C + "T12:36:30Z" }), "duplicate_request", n + 1);
    results.push("PASS concurrent pair -> exactly one KMS signature");
  }, 120000);

  it("official-specific refusals: context missing, slate mismatch, third party unavailable, already claimed, order", async () => {
    await world("off");
    const T = C + "T12:41:10Z";
    const n0 = signs();
    await expectRefused("official before any request-context issuance (context missing)", await call("/official", JSON.stringify(evidence("official", T)), { at: T }), "context_incomplete", n0);
    // Issue request-context legitimately, then fake a complete context row (replica) to reach later official checks.
    const rcOut = await call("/request-context", JSON.stringify(evidence("request-context", C + "T12:35:10Z")), { at: C + "T12:35:10Z" });
    expect(rcOut.body.state).toBe("issued");
    psql(`set session_replication_role = replica; insert into public.blsh_context_runs(source_date,native_run_id,native_manifest_sha256,state,closed_at,manifest_sha256)
      select source_date, run_id, manifest_sha256, 'packet_complete_pending_review', '${C} 12:39:00Z', repeat('d',64) from public.blsh_capture_runs`);
    const n = signs();
    nhl = async () => ({ gameWeek: [{ date: D, games: [...schedule.gameWeek[0].games, { ...schedule.gameWeek[0].games[0], id: 2026020372 }] }] });
    await expectRefused("slate mismatch (public schedule has a sixth game)", await call("/official", JSON.stringify(evidence("official", T)), { at: T }), "slate_mismatch", n);
    nhl = async () => ({ gameWeek: [{ date: D, games: schedule.gameWeek[0].games.map((g, i) => (i ? g : { ...g, gameState: "LIVE" })) }] });
    await expectRefused("slate not final on the public schedule", await call("/official", JSON.stringify(evidence("official", T)), { at: T }), "slate_not_final", n);
    nhl = async () => { throw new Error("down"); };
    await expectRefused("public schedule unavailable (fail closed)", await call("/official", JSON.stringify(evidence("official", T)), { at: T }), "third_party_schedule_unavailable", n);
    nhl = async () => schedule;
    const e = evidence("official", T); e.officialRunCount = 1;
    await expectRefused("conflicting evidence (an official run already exists)", await call("/official", JSON.stringify(e), { at: T }), "evidence_conflict", n);
    const e2 = evidence("official", T); e2.contextRuns[0].nativeManifestSHA256 = "e".repeat(64);
    await expectRefused("conflicting evidence (context bound to another manifest)", await call("/official", JSON.stringify(e2), { at: T }), "evidence_conflict", n);
    await expectRefused("late official (12:44:00)", await call("/official", JSON.stringify(evidence("official", C + "T12:44:00Z")), { at: C + "T12:44:00Z" }), "outside_signing_window", n);
    const ok = await call("/official", JSON.stringify(evidence("official", T)), { at: T });
    expect(ok.body.state).toBe("issued");
    results.push("PASS official issued only after all official checks pass (control)");
  }, 120000);

  it("KMS policy refuses the verifying app's identity, wrong message type and out-of-window time even with valid bytes", async () => {
    resetSignerWorld();
    const msg = new TextEncoder().encode("probe");
    jump(C + "T12:36:00Z");
    for (const [label, principal, input, at] of [
      ["fhfhockey (verifying app) identity", VERCEL_APP_IDENTITY, { MessageType: "RAW", SigningAlgorithm: "ED25519_SHA_512" }, C + "T12:36:00Z"],
      ["prehash / DIGEST mode", SIGNER_ROLE, { MessageType: "DIGEST", SigningAlgorithm: "ED25519_PH_SHA_512" }, C + "T12:36:00Z"],
      ["signer role outside the key-policy time fence (12:45:00)", SIGNER_ROLE, { MessageType: "RAW", SigningAlgorithm: "ED25519_SHA_512" }, C + "T12:45:00Z"],
    ] as const) {
      jump(at);
      await expect(kms.clientFor(principal).sign({ KeyId: "alias/blsh-official-pilot-v1", Message: msg, ...input })).rejects.toThrow("AccessDeniedException");
      results.push(`PASS mock KMS denied ${label}`);
    }
    // The stand-in exposes no key material.
    const surface = JSON.stringify(Object.keys(kms.clientFor(SIGNER_ROLE)).concat(Object.keys(kms.admin)));
    expect(surface).not.toMatch(/export|private/i);
    results.push("PASS mock KMS surface has no export or private-key accessor: " + surface);
  });

  it("late paths fail closed with no dispatch: signer down at 12:35; request-context still running at 12:41; cancel switch", async () => {
    // (a) signer unreachable: rc_post sees no response; every later step is skipped; 12:45 finds no grant.
    await world("late_a");
    process.env.BLSH_OFFICIAL_PILOT_APPROVAL_PUBLIC_KEY = officialPublicPem;
    fire("blsh-signer-rc-sign-20261122", C + "T12:35:00.200Z");   // queued; worker does NOT run (signer unreachable)
    psql(`delete from net.queue`);
    fire("blsh-signer-rc-post-20261122", C + "T12:36:00.100Z");
    fire("blsh-signer-official-sign-20261122", C + "T12:41:00.100Z");
    fire("blsh-signer-official-store-20261122", C + "T12:42:00.100Z");
    fire("blsh-official-once-20261122", C + "T12:45:00.500Z");
    expect(steps()).toBe("rc_sign=queued rc_post=no_response official_sign=skipped_upstream official_store=skipped_upstream");
    expect(psql(`select disposition from fhfh_internal.blsh_official_dispatch_20261122`)).toBe("refused");
    expect(psql(`select count(*) from net.queue`)).toBe("0");
    results.push("PASS late (a) signer down: " + steps() + "; dispatch=refused; nothing queued");
    // (b) request-context not complete by 12:41 (the 12:36 POST is still running): signer refuses context_incomplete.
    await world("late_b");
    mandate = freshMandate();
    fire("blsh-signer-rc-sign-20261122", C + "T12:35:00.200Z"); await drainNet();
    fire("blsh-signer-rc-post-20261122", C + "T12:36:00.100Z");
    const pending = psql(`select count(*) from net.queue`); psql(`delete from net.queue`);  // POST in flight, not finished by 12:41
    expect(pending).toBe("1");
    fire("blsh-signer-official-sign-20261122", C + "T12:41:00.100Z"); await drainNet();
    fire("blsh-signer-official-store-20261122", C + "T12:42:00.100Z");
    fire("blsh-official-once-20261122", C + "T12:45:00.500Z");
    expect(steps()).toBe("rc_sign=queued rc_post=queued official_sign=queued:context_incomplete official_store=refused:context_incomplete");
    expect(psql(`select disposition from fhfh_internal.blsh_official_dispatch_20261122`)).toBe("refused");
    results.push("PASS late (b) context still running at 12:41: " + steps() + "; dispatch=refused");
    // (c) missed minute: a job that fires outside its minute expires and never acts.
    await world("late_c");
    fire("blsh-signer-rc-sign-20261122", C + "T12:36:00.000Z");
    expect(steps().startsWith("rc_sign=expired")).toBe(true);
    results.push("PASS late (c) rc_sign fired at 12:36:00 -> expired, nothing queued");
    // (d) database stop switch: CANCEL-SIGNER-STEPS + reviewed CANCEL-OFFICIAL-ONCE remove every pilot job; rerun is a no-op.
    await world("cancel");
    jump(C + "T12:20:00Z");
    psql(shifted(readFileSync(join(PROOF, "sql/CANCEL-SIGNER-STEPS.sql"), "utf8")));
    psql(shifted(readFileSync(join(LIVE, "CANCEL-OFFICIAL-ONCE.sql"), "utf8")));
    expect(psql(`select count(*) from cron.job where jobid > 408`)).toBe("0");
    psql(shifted(readFileSync(join(PROOF, "sql/CANCEL-SIGNER-STEPS.sql"), "utf8")));
    expect(psql(`select string_agg(jobid::text, ',' order by jobid) from cron.job`)).toBe("404,405,406,407,408");
    results.push("PASS stop switch (DB): CANCEL-SIGNER-STEPS + CANCEL-OFFICIAL-ONCE leave jobs 404-408 only; rerun no-op");
    // (e) AUTOMATE-ONCE preflight refusals: after 12:05, and a second registration.
    newDb("pre");
    jump(C + "T11:00:00Z"); psql(shifted(readFileSync(join(LIVE, "INSTALL.sql"), "utf8")), { vars: { release_sha: GIT_SHA, deployment_id: DEPLOYMENT_ID } });
    psql(`insert into vault.decrypted_secrets values ('blsh_signer_trigger_secret','${TRIGGER}')`);
    jump(C + "T12:05:00Z");
    psql(shifted(readFileSync(join(PROOF, "sql/AUTOMATE-ONCE.sql"), "utf8")), { vars: { signer_url: SIGNER_URL }, expectError: "signer_automation_preflight_refused" });
    jump(C + "T11:30:00Z");
    psql(shifted(readFileSync(join(PROOF, "sql/AUTOMATE-ONCE.sql"), "utf8")), { vars: { signer_url: "https://evil.example.com" }, expectError: "violates check constraint" });
    psql(shifted(readFileSync(join(PROOF, "sql/AUTOMATE-ONCE.sql"), "utf8")), { vars: { signer_url: SIGNER_URL } });
    psql(shifted(readFileSync(join(PROOF, "sql/AUTOMATE-ONCE.sql"), "utf8")), { vars: { signer_url: SIGNER_URL }, expectError: "signer_automation_preflight_refused" });
    results.push("PASS AUTOMATE-ONCE refuses at/after 12:05, a non-Lambda URL, and a second registration");
  }, 180000);
});

describe("Option V1b: Supabase-hosted signer, two Ed25519 keys in a postgres-owned private table (Vault refuted), no added cost", () => {
  const results: string[] = [];
  afterAll(() => { for (const r of results) note("V1 " + r); });
  let keys: Record<string, { vaultName: string; publicKeyPem: string; fingerprint: string }> = {};
  const keygen = () => generateVaultKeys({ names: KEY_NAMES,
    secretExists: async (n: string) => psql(`select count(*) from fhfh_internal.blsh_signer_secrets where name = ${dq(n)}`) !== "0",
    createSecret: async (n: string, v: string) => { psql(`insert into fhfh_internal.blsh_signer_secrets(name, secret) values (${dq(n)}, ${dq(v)})`); } });
  const signsV1 = () => supaLog.filter((l) => l.includes('"decision":"issued"')).length;
  async function v1World(name: string, opts: { seed?: boolean; automate?: boolean } = {}) {
    newDb(name);
    const pins = { release_sha: GIT_SHA, deployment_id: DEPLOYMENT_ID };
    jump(C + "T11:00:00Z"); psql(shifted(readFileSync(join(LIVE, "INSTALL.sql"), "utf8")), { vars: pins });
    psql(readFileSync(join(PROOF, "sql/SIGNER-SECRETS-SETUP.sql"), "utf8"));
    psql(`insert into fhfh_internal.blsh_signer_secrets(name, secret) values ('blsh_signer_trigger_secret','${TRIGGER}')`);
    keys = await keygen();
    rcPublicPem = keys.requestContext.publicKeyPem; officialPublicPem = keys.official.publicKeyPem;
    process.env.BLSH_OFFICIAL_PILOT_APPROVAL_PUBLIC_KEY = officialPublicPem;
    rcKeyFp = keys.requestContext.fingerprint; officialKeyFp = keys.official.fingerprint;
    mandate = freshMandate({ keys: { requestContext: { keyId: KEY_NAMES.requestContext, fingerprint: rcKeyFp }, official: { keyId: KEY_NAMES.official, fingerprint: officialKeyFp } } });
    if (opts.automate !== false) { jump(C + "T11:30:00Z"); psql(shifted(readFileSync(join(PROOF, "sql/AUTOMATE-ONCE-SUPABASE.sql"), "utf8")), { vars: { signer_url: SUPA_URL } }); }
    jump(C + "T12:00:00Z"); psql(shifted(readFileSync(join(LIVE, "ARM.sql"), "utf8")), { vars: pins });
    if (opts.seed !== false) seedNative(nativePacket());
    nhl = async () => schedule;
  }
  async function v1Call(path: string, at: string, opts: { body?: string; bearer?: string; method?: string } = {}) {
    jump(at);
    return supaSigner().handle({ method: opts.method ?? "POST", path, rawQuery: "", body: opts.body ?? "{}",
      headers: { authorization: "Bearer " + (opts.bearer ?? TRIGGER), "content-type": "application/json" } });
  }
  const refused = (label: string, out: { status: number; body: { state: string; reason?: string } }, reason: string, before: number) => {
    expect(out.body).toEqual({ state: "refused", reason }); expect(signsV1()).toBe(before);
    results.push(`PASS refused ${label}: ${out.status} ${reason}`);
  };

  it("Vault is not usable for the keys (service_role reads it by default; postgres cannot revoke supabase_admin's grant); the private table is", async () => {
    newDb("v1_access");
    // (a) Emulate Supabase's documented Vault grants (supabase/postgres after-create.sql): objects owned by supabase_admin, SELECT
    //     granted by supabase_admin to service_role, and to the project's non-superuser postgres WITH GRANT OPTION.
    psql(`create role supabase_admin_emul nologin; create role project_postgres_emul nologin;
      create schema vault_emul authorization supabase_admin_emul;
      set role supabase_admin_emul;
      create table vault_emul.decrypted_secrets(name text, decrypted_secret text);
      grant usage on schema vault_emul to service_role, project_postgres_emul;
      grant select on vault_emul.decrypted_secrets to service_role;
      grant select on vault_emul.decrypted_secrets to project_postgres_emul with grant option;
      reset role;`);
    const warn = psql(`set role project_postgres_emul; revoke select on vault_emul.decrypted_secrets from service_role; reset role;
      select pg_catalog.has_table_privilege('service_role','vault_emul.decrypted_secrets','select')`);
    expect(warn.split("\n").at(-1)).toBe("t");
    results.push("FINDING Vault: a non-superuser project owner's REVOKE of supabase_admin's SELECT grant to service_role is a no-op (PostgreSQL grantor rule); service_role (the Vercel app's key) would keep reading Vault-held private keys");
    // (b) The private table: owned by postgres, client roles hold nothing.
    const pins = { release_sha: GIT_SHA, deployment_id: DEPLOYMENT_ID };
    jump(C + "T11:00:00Z"); psql(shifted(readFileSync(join(LIVE, "INSTALL.sql"), "utf8")), { vars: pins });
    psql(readFileSync(join(PROOF, "sql/SIGNER-SECRETS-SETUP.sql"), "utf8"));
    psql(`insert into fhfh_internal.blsh_signer_secrets(name, secret) values ('blsh_signer_trigger_secret','${TRIGGER}')`);
    const out = await keygen();
    const text = JSON.stringify(out);
    expect(text).not.toMatch(/PRIVATE|MC4CAQAw/);
    expect(Object.values(out).map((k: { publicKeyPem: string }) => createPublicKey(k.publicKeyPem).asymmetricKeyType)).toEqual(["ed25519", "ed25519"]);
    expect(out.requestContext.fingerprint).not.toBe(out.official.fingerprint);
    results.push("PASS keygen inside Supabase: output carries public PEMs and fingerprints only; two distinct Ed25519 keys stored in the private table");
    await expect(keygen()).rejects.toThrow("keygen_refused_exists");
    results.push("PASS second keygen refused (keys exist)");
    psql("grant usage on schema fhfh_internal to service_role; grant select on fhfh_internal.blsh_signer_secrets to service_role");
    jump(C + "T11:30:00Z");
    psql(shifted(readFileSync(join(PROOF, "sql/AUTOMATE-ONCE-SUPABASE.sql"), "utf8")), { vars: { signer_url: SUPA_URL }, expectError: "signer_automation_preflight_refused" });
    results.push("PASS AUTOMATE-ONCE-SUPABASE refuses while service_role holds any privilege on the secrets table");
    psql("revoke select on fhfh_internal.blsh_signer_secrets from service_role");
    // A role that SUPABASE_JWT_SECRET could mint a token for (granted to authenticator) must not reach the secrets either.
    psql(`create role authenticator noinherit nologin; create role jwt_minted_emul nologin; grant jwt_minted_emul to authenticator;
      grant usage on schema fhfh_internal to jwt_minted_emul; grant select on fhfh_internal.blsh_signer_secrets to jwt_minted_emul;`);
    psql(shifted(readFileSync(join(PROOF, "sql/AUTOMATE-ONCE-SUPABASE.sql"), "utf8")), { vars: { signer_url: SUPA_URL }, expectError: "signer_automation_preflight_refused" });
    results.push("PASS AUTOMATE-ONCE-SUPABASE refuses while a role granted to authenticator (reachable with SUPABASE_JWT_SECRET) can read the secrets table");
    psql("revoke select on fhfh_internal.blsh_signer_secrets from jwt_minted_emul");
    psql(shifted(readFileSync(join(PROOF, "sql/AUTOMATE-ONCE-SUPABASE.sql"), "utf8")), { vars: { signer_url: SUPA_URL } });
    results.push("PASS AUTOMATE-ONCE-SUPABASE registers once no client role holds a privilege on the secrets table");
    for (const role of ["service_role", "anon", "authenticated"]) {
      for (const stmt of ["select secret from fhfh_internal.blsh_signer_secrets",
        "select fhfh_internal.blsh_signer_evidence_20261122('request-context')",
        "insert into fhfh_internal.blsh_signer_issuance_20261122(slot, record) values ('request-context#2026-11-22', '{}')",
        "update fhfh_internal.blsh_signer_secrets set secret = repeat('x', 40)"]) {
        psql(`set role ${role};\n${stmt}`, { expectError: "permission denied" });
      }
      results.push(`PASS ${role} denied: read keys or bearer, call evidence, write ledger, replace a key`);
    }
    expect(psql("select count(*) from fhfh_internal.blsh_signer_secrets where name like 'blsh_signer_%_key_20261122'")).toBe("2");
    results.push("RESIDUAL postgres (database owner, and every path that runs SQL as it) CAN read both private keys: asserted true, see PROPOSAL-SUPABASE section 3");
  }, 120000);

  it("full timed hand-off: 12:35 Edge signer (pulls evidence, Vault key) -> 12:36 RC POST -> 12:41 -> 12:42 Vault grant -> 12:45 official", async () => {
    await v1World("v1_happy");
    expect(fire("blsh-signer-rc-sign-20261122", C + "T12:35:00.200Z")).toBe(true);
    const q = JSON.parse(psql(`select json_agg(q) from net.queue q`))[0];
    expect(q.body).toBe("{}");
    results.push("PASS 12:35 trigger body is exactly {} (the signer pulls its evidence; the trigger names nothing)");
    expect(await drainNet()).toBe(1);
    expect(fire("blsh-signer-rc-post-20261122", C + "T12:36:00.150Z")).toBe(true);
    expect(await drainNet()).toBe(1);
    const rc = appRequests.at(-1)!;
    expect([rc.status, JSON.parse(rc.body).state]).toEqual([200, "packet_complete_pending_review"]);
    results.push("PASS Y requestContextHandler accepted the envelope signed with the table-held key; context packet complete");
    expect(fire("blsh-signer-official-sign-20261122", C + "T12:41:00.300Z")).toBe(true);
    expect(await drainNet()).toBe(1);
    expect(fire("blsh-signer-official-store-20261122", C + "T12:42:00.100Z")).toBe(true);
    expect(fire("blsh-official-once-20261122", C + "T12:45:01.000Z")).toBe(true);
    process.execArgv.splice(0);
    expect(await drainNet()).toBe(1);
    const off = appRequests.at(-1)!;
    expect([off.status, JSON.parse(off.body).state]).toEqual([200, "packet_complete_pending_review"]);
    results.push("PASS Y officialPilotHandler accepted the Vault grant; real PG official claim accepted slot, binding, schedule hash, deployment");
    expect(steps()).toBe("rc_sign=queued rc_post=queued official_sign=queued official_store=stored");
    expect(psql(`select count(*) from cron.job where jobid > 408`)).toBe("0");
    expect(psql(`select count(*) from net._http_response where content like '%signature%'`)).toBe("0");
    expect(psql(`select string_agg(slot || ':' || (record->>'state'), ',' order by slot) from fhfh_internal.blsh_signer_issuance_20261122`))
      .toBe(`official#${D}:issued,request-context#${D}:issued`);
    expect(signsV1()).toBe(2);
    expect(supaLog.join("\n")).not.toMatch(/signature|envelope|grantBase64|PRIVATE/);
    results.push("PASS exactly 2 approvals; ledger rows issued; jobs self-removed; no response row kept; log codes and hashes only");
  }, 120000);

  it("refuses missing, mismatched, expired and duplicate requests; stop switches; key swap detected", async () => {
    await v1World("v1_refuse");
    const T = C + "T12:35:10Z";
    let n = signsV1();
    refused("non-empty trigger body (arbitrary input)", await v1Call("/request-context", T, { body: JSON.stringify({ message: "sign me" }) }), "unexpected_body", n);
    refused("caller without the Vault bearer (e.g. the Vercel app's service_role key)", await v1Call("/request-context", T, { bearer: "service-role-jwt-" + "x".repeat(40) }), "trigger_bearer_required", n);
    refused("unknown route", await v1Call("/sign", T), "unknown_route", n);
    refused("expired: request-context at 12:38:00", await v1Call("/request-context", C + "T12:38:00Z"), "outside_signing_window", n);
    refused("early: request-context at 12:34:50 (evidence pull takes real time, so the window is judged at decision time)", await v1Call("/request-context", C + "T12:34:50Z"), "outside_signing_window", n);
    refused("expired: official at 12:44:00", await v1Call("/official", C + "T12:44:00Z"), "outside_signing_window", n);
    mandate = { ...mandate, deploymentId: "dpl_SomeOtherReadyDeployment" };
    refused("mismatched READY deployment", await v1Call("/request-context", T), "deployment_mismatch", n);
    mandate = { ...mandate, deploymentId: DEPLOYMENT_ID, gitCommitSha: "0".repeat(40) };
    refused("mismatched SHA", await v1Call("/request-context", T), "deployment_mismatch", n);
    mandate = { ...mandate, gitCommitSha: GIT_SHA, sourceDate: "2026-11-21", captureDate: "2026-11-22",
      windows: { requestContext: ["2026-11-22T12:35:00Z", "2026-11-22T12:38:00Z"], official: ["2026-11-22T12:41:00Z", "2026-11-22T12:44:00Z"] } };
    refused("mismatched slate", await v1Call("/request-context", T), "outside_signing_window", n);
    mandate = freshMandate({ keys: { requestContext: { keyId: KEY_NAMES.requestContext, fingerprint: rcKeyFp }, official: { keyId: KEY_NAMES.official, fingerprint: officialKeyFp } } });
    refused("official before request-context (order / context missing)", await v1Call("/official", C + "T12:41:10Z"), "context_incomplete", n);
    mandate = { ...mandate, armed: false };
    refused("stop switch: mandate disarmed (Edge Function secret)", await v1Call("/request-context", T), "signer_disarmed", n);
    mandate = { ...mandate, armed: true };
    // An admin who swaps a Vault key cannot get a signature unless the mandate (and Vercel's public key) change too.
    const saved = psql(`select secret from fhfh_internal.blsh_signer_secrets where name = ${dq(KEY_NAMES.requestContext)}`);
    const other = (await import("node:crypto")).generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");
    psql(`update fhfh_internal.blsh_signer_secrets set secret = ${dq(other)} where name = ${dq(KEY_NAMES.requestContext)}`);
    refused("key swapped in the table by a DB owner (fingerprint differs from TJ's mandate)", await v1Call("/request-context", T), "key_identity_mismatch", n);
    psql(`delete from fhfh_internal.blsh_signer_secrets where name = ${dq(KEY_NAMES.requestContext)}`);
    refused("stop switch: signing key deleted from the table", await v1Call("/request-context", T), "kms_unavailable", n);
    psql(`insert into fhfh_internal.blsh_signer_secrets(name, secret) values (${dq(KEY_NAMES.requestContext)}, ${dq(saved)})`);
    // duplicates: a concurrent pair -> exactly one; a later repeat -> refused (DB ledger)
    jump(T);
    const beforePair = signsV1();
    const pair = await Promise.all([0, 1].map(() => supaSigner().handle({ method: "POST", path: "/request-context", rawQuery: "", body: "{}",
      headers: { authorization: "Bearer " + TRIGGER, "content-type": "application/json" } })));
    expect(pair.map((o: { body: { state: string } }) => o.body.state).sort()).toEqual(["issued", "refused"]);
    n = signsV1(); expect(n).toBe(beforePair + 1);
    results.push("PASS concurrent pair -> exactly one signature (Postgres ledger, insert ... on conflict do nothing)");
    refused("duplicate request after issuance", await v1Call("/request-context", C + "T12:36:30Z"), "duplicate_request", n);
    // missing receipt: a fresh database with no native run
    await v1World("v1_missing", { seed: false });
    refused("missing native receipt", await v1Call("/request-context", T), "native_receipt_missing", signsV1());
    // stop switch, database side: the reviewed cancel set removes every job (same tables as option A)
    jump(C + "T12:20:00Z");
    psql(shifted(readFileSync(join(PROOF, "sql/CANCEL-SIGNER-STEPS.sql"), "utf8")));
    psql(shifted(readFileSync(join(LIVE, "CANCEL-OFFICIAL-ONCE.sql"), "utf8")));
    expect(psql(`select string_agg(jobid::text, ',' order by jobid) from cron.job`)).toBe("404,405,406,407,408");
    results.push("PASS stop switch (DB): CANCEL-SIGNER-STEPS + CANCEL-OFFICIAL-ONCE leave jobs 404-408 only");
  }, 180000);

  it("authenticates before any database work; /selfcheck proves runtime privileges without signing; execute_sql escalation and its fix (E1); R1 runs read-only", async () => {
    await v1World("v1_order");
    const before = evidenceCalls, n = signsV1();
    const T = C + "T12:35:10Z";
    for (const [label, out, reason] of [
      ["wrong bearer", await v1Call("/request-context", T, { bearer: "y".repeat(52) }), "trigger_bearer_required"],
      ["out of window", await v1Call("/request-context", C + "T12:30:00Z"), "outside_signing_window"],
      ["GET", await v1Call("/request-context", T, { method: "GET" }), "method_not_allowed"],
      ["non-empty body", await v1Call("/official", T, { body: "{\"a\":1}" }), "unexpected_body"],
    ] as const) {
      expect(out.body).toEqual({ state: "refused", reason });
      results.push(`PASS ${label} refused (${reason}) before any evidence query, key read or ledger write`);
    }
    expect(evidenceCalls).toBe(before);
    // /selfcheck: no signature, no ledger row, every privilege of the signing path exercised.
    const sc = await v1Call("/selfcheck", C + "T12:20:00Z");
    expect(sc.body).toEqual({ state: "selfcheck", currentUser: "postgres", ledgerWritable: true,
      keys: { requestContext: "matches_mandate", official: "matches_mandate" }, evidence: { "request-context": "ok", official: "ok" }, mandateArmed: true });
    expect(signsV1()).toBe(n);
    expect(psql("select count(*) from fhfh_internal.blsh_signer_issuance_20261122")).toBe("0");
    results.push("PASS /selfcheck: current_user=postgres, ledger insert works (rolled back), both keys match the mandate, evidence callable; 0 signatures, 0 ledger rows");
    // execute_sql: Y's migrations 20260716112908 + 20260820013120 grant service_role EXECUTE on this SECURITY DEFINER function.
    psql(`create function public.execute_sql(sql_statement text) returns void language plpgsql security definer as $f$begin execute sql_statement; end;$f$;
      revoke execute on function public.execute_sql(text) from public, anon, authenticated; grant execute on function public.execute_sql(text) to service_role;`);
    psql(`set role service_role; select public.execute_sql('grant usage on schema fhfh_internal to service_role; grant select on fhfh_internal.blsh_signer_secrets to service_role');`);
    expect(psql("set role service_role; select count(*) from fhfh_internal.blsh_signer_secrets where name like 'blsh_signer_%_key_%'").split("\n").at(-1)).toBe("2");
    results.push("FINDING service_role (the Vercel app's key) used public.execute_sql to grant itself the secrets table and read both private keys: no Supabase-hosted key or permit is independent of the app while that grant exists");
    psql("revoke select on fhfh_internal.blsh_signer_secrets from service_role; revoke usage on schema fhfh_internal from service_role; revoke execute on function public.execute_sql(text) from service_role");
    psql(`set role service_role; select public.execute_sql('select 1')`, { expectError: "permission denied" });
    psql("set role service_role; select secret from fhfh_internal.blsh_signer_secrets", { expectError: "permission denied" });
    results.push("PASS E1 (revoke EXECUTE on public.execute_sql from service_role) closes that path: service_role denied execute_sql and the secrets table");
    psql("grant execute on function public.execute_sql(text) to service_role");
    const r1 = psql(readFileSync(join(PROOF, "sql/R1-READONLY.sql"), "utf8"));
    writeFileSync(join(OUT, "r1-local-emulation.txt"), r1 + "\n");
    expect(r1).toMatch(/^execute_sql\|postgres\|t\|t$/m);
    psql("do $r$ begin if to_regrole('authenticator') is null then create role authenticator noinherit nologin; end if; end $r$; grant anon, authenticated, service_role to authenticator");
    const r1b = psql(readFileSync(join(PROOF, "sql/R1B-READONLY.sql"), "utf8"));
    writeFileSync(join(OUT, "r1b-local-emulation.txt"), r1b + "\n");
    expect(r1b).toMatch(/^authenticator_member\|service_role\|f\|t\|f$/m);
    results.push("PASS R1B-READONLY.sql runs read-only locally (out/r1b-local-emulation.txt)");
    results.push("PASS R1-READONLY.sql runs in a read-only transaction and reports the execute_sql owner and service_role grant (local emulation: out/r1-local-emulation.txt)");
  }, 120000);
});

describe("E2 boundary: what every credential the Vercel runtime holds can do after E2 (production grants per R1/R1b, emulated)", () => {
  const results: string[] = [];
  afterAll(() => { for (const r of results) note("E2 " + r); });
  const KEY_NAMES_E2 = { requestContext: "blsh_signer_rc_key_20261122", official: "blsh_signer_official_key_20261122" };
  async function e2World(name: string) {
    newDb(name);
    const pins = { release_sha: GIT_SHA, deployment_id: DEPLOYMENT_ID };
    jump(C + "T11:00:00Z"); psql(shifted(readFileSync(join(LIVE, "INSTALL.sql"), "utf8")), { vars: pins });
    psql(readFileSync(join(PROOF, "sql/SIGNER-SECRETS-SETUP.sql"), "utf8"));
    psql(`insert into fhfh_internal.blsh_signer_secrets(name, secret) values ('blsh_signer_trigger_secret','${TRIGGER}')`);
    const keys = await generateVaultKeys({ names: KEY_NAMES_E2,
      secretExists: async (n: string) => psql(`select count(*) from fhfh_internal.blsh_signer_secrets where name = ${dq(n)}`) !== "0",
      createSecret: async (n: string, v: string) => { psql(`insert into fhfh_internal.blsh_signer_secrets(name, secret) values (${dq(n)}, ${dq(v)})`); } });
    rcPublicPem = keys.requestContext.publicKeyPem; officialPublicPem = keys.official.publicKeyPem;
    process.env.BLSH_OFFICIAL_PILOT_APPROVAL_PUBLIC_KEY = officialPublicPem;
    rcKeyFp = keys.requestContext.fingerprint; officialKeyFp = keys.official.fingerprint;
    mandate = freshMandate({ keys: { requestContext: { keyId: KEY_NAMES_E2.requestContext, fingerprint: rcKeyFp }, official: { keyId: KEY_NAMES_E2.official, fingerprint: officialKeyFp } } });
    // Production grants for the app's roles, as R1/R1b read them (worst case where a read was not exact):
    //  - service_role: BYPASSRLS, USAGE on fhfh_internal, SELECT on the BLSH tables (Y migrations), Vault read + create/update
    //    (pgsodium_keyiduser), no execute_sql (revoked in production); per R2: EXECUTE cron.schedule/unschedule(bigint) and
    //    net.http_get/post, SELECT cron.job (all rows, BYPASSRLS), write cron.job_run_details, no read of the net queue or responses.
    //  - authenticator may assume anon, authenticated, service_role (R1b): what SUPABASE_JWT_SECRET can mint.
    psql(`do $r$ begin if to_regrole('authenticator') is null then create role authenticator noinherit nologin; end if; end $r$;
      grant anon, authenticated, service_role to authenticator;
      grant usage on schema fhfh_internal, vault, net to service_role;
      grant select, insert, update on vault.decrypted_secrets to service_role;
      grant execute on function net.http_post(text, jsonb, jsonb, jsonb, integer), net.http_get(text, jsonb, integer) to service_role;
      grant usage on schema cron to service_role;
      grant execute on function cron.schedule(text,text,text), cron.unschedule(bigint) to service_role;
      grant select on cron.job to service_role;
      grant select, insert, update, delete on cron.job_run_details to service_role; grant usage on sequence cron.job_run_details_runid_seq to service_role;
      create or replace function public.execute_sql(sql_statement text) returns void language plpgsql security definer as $f$begin execute sql_statement; end;$f$;
      revoke execute on function public.execute_sql(text) from public, anon, authenticated, service_role;`);
    jump(C + "T11:30:00Z"); psql(shifted(readFileSync(join(PROOF, "sql/AUTOMATE-ONCE-SUPABASE.sql"), "utf8")), { vars: { signer_url: SUPA_URL } });
    jump(C + "T12:00:00Z"); psql(shifted(readFileSync(join(LIVE, "ARM.sql"), "utf8")), { vars: pins });
    seedNative(nativePacket());
    nhl = async () => schedule;
  }
  const asRole = (role: string, stmt: string, error = "permission denied") => psql(`set role ${role};\n${stmt}`, { expectError: error });

  it("full hand-off, then replay, wrong slate, expiry and stop switch at Y's handlers; app credentials cannot read keys, change policy or mint", async () => {
    await e2World("e2_boundary");
    fire("blsh-signer-rc-sign-20261122", C + "T12:35:00.200Z"); await drainNet();
    fire("blsh-signer-rc-post-20261122", C + "T12:36:00.150Z"); await drainNet();
    const rcEnvelope = appRequests.at(-1)!.bodyBytes;
    expect(JSON.parse(appRequests.at(-1)!.body).state).toBe("packet_complete_pending_review");
    fire("blsh-signer-official-sign-20261122", C + "T12:41:00.300Z"); await drainNet();
    fire("blsh-signer-official-store-20261122", C + "T12:42:00.100Z");
    const grant = psql(`select decrypted_secret from vault.decrypted_secrets where name = 'blsh_official_grant_20261122'`);
    fire("blsh-official-once-20261122", C + "T12:45:01.000Z"); process.execArgv.splice(0); await drainNet();
    expect(JSON.parse(appRequests.at(-1)!.body).state).toBe("packet_complete_pending_review");
    results.push("PASS baseline hand-off through Y's handlers with the production-like grants in place");
    // Replay at the verifier: the same envelopes never produce a second run.
    jump(C + "T12:45:20Z");
    const rcReplay = await send(bases.app, "POST", "/api/v1/db/blsh-request-context", { authorization: "Bearer fixture-cron", "content-type": "application/json" }, rcEnvelope);
    expect(JSON.parse(rcReplay.text)).toMatchObject({ state: "skipped", reason: "already_claimed" });
    const offReplay = await send(bases.app, "GET", "/api/v1/db/blsh-official-boxscores", { authorization: "Bearer fixture-cron", "x-blsh-official-grant": grant });
    expect(JSON.parse(offReplay.text)).toMatchObject({ state: "skipped", reason: "already_claimed" });
    jump(C + "T12:47:00Z");
    const offLate = await send(bases.app, "GET", "/api/v1/db/blsh-official-boxscores", { authorization: "Bearer fixture-cron", "x-blsh-official-grant": grant });
    expect(JSON.parse(offLate.text)).toMatchObject({ reason: "outside_official_slot" });
    expect(psql("select count(*) from public.blsh_context_runs") + "/" + psql("select count(*) from public.blsh_official_runs")).toBe("1/1");
    results.push("PASS replay: the request-context envelope and the official grant re-sent -> already_claimed; official grant after the slot -> outside_official_slot; still 1 context run and 1 official run");
    // Signer-side replay / one-shot / wrong slate / expiry / stop switch.
    const callSigner = (path: string, at: string, bearer = TRIGGER) => { jump(at); return supaSigner().handle({ method: "POST", path, rawQuery: "", body: "{}",
      headers: { authorization: "Bearer " + bearer, "content-type": "application/json" } }); };
    expect((await callSigner("/request-context", C + "T12:37:00Z")).body).toEqual({ state: "refused", reason: "duplicate_request" });
    expect((await callSigner("/official", C + "T12:43:00Z")).body).toEqual({ state: "refused", reason: "evidence_conflict" });
    expect((await callSigner("/request-context", C + "T12:39:30Z")).body).toEqual({ state: "refused", reason: "outside_signing_window" });
    const saved = mandate;
    mandate = { ...saved, sourceDate: "2026-11-23", captureDate: "2026-11-24", gameIds: [2026020378],
      windows: { requestContext: ["2026-11-24T12:35:00Z", "2026-11-24T12:38:00Z"], official: ["2026-11-24T12:41:00Z", "2026-11-24T12:44:00Z"] } };
    expect((await callSigner("/request-context", C + "T12:37:00Z")).body).toEqual({ state: "refused", reason: "outside_signing_window" });
    mandate = { ...saved, armed: false };
    expect((await callSigner("/request-context", C + "T12:37:00Z")).body).toEqual({ state: "refused", reason: "signer_disarmed" });
    mandate = saved;
    results.push("PASS signer: one-shot (duplicate_request), official after issuance (evidence_conflict: an official run exists), expiry, wrong slate, stop switch");

    // Every credential the Vercel runtime holds, after E2.
    // (1) service_role = SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY, and a SUPABASE_JWT_SECRET token for service_role.
    for (const [what, stmt] of [
      ["read the private keys or bearer", "select secret from fhfh_internal.blsh_signer_secrets"],
      ["replace a key", "update fhfh_internal.blsh_signer_secrets set secret = repeat('x', 44)"],
      ["insert a key", "insert into fhfh_internal.blsh_signer_secrets(name, secret) values ('blsh_signer_rc_key_20261123', repeat('x', 44))"],
      ["rewrite the evidence function", "create or replace function fhfh_internal.blsh_signer_evidence_20261122(p_kind text) returns jsonb language sql as $f$select '{}'::jsonb$f$"],
      ["rewrite the step function", "create or replace function fhfh_internal.blsh_signer_step_20261122(p_step text) returns void language sql as $f$select$f$"],
      ["redirect the signer URL", "update fhfh_internal.blsh_signer_config_20261122 set signer_url = 'https://abcdefghijklmnopqrsx.supabase.co/functions/v1/blsh-signer'"],
      ["reset a step", "update fhfh_internal.blsh_signer_steps_20261122 set disposition = 'registered'"],
      ["clear the one-shot ledger", "delete from fhfh_internal.blsh_signer_issuance_20261122"],
      ["forge a ledger row", "insert into fhfh_internal.blsh_signer_issuance_20261122(slot, record) values ('official#2026-11-22', '{}')"],
      ["call the evidence function", "select fhfh_internal.blsh_signer_evidence_20261122('official')"],
      ["call the step function", "select fhfh_internal.blsh_signer_step_20261122('rc_sign')"],
      ["schedule or edit pg_cron jobs", "update cron.job set schedule = '* * * * *'"],
      ["edit the INSTALL pin", "update public.blsh_pilot_20261123 set deployment_id = 'dpl_Other'"],
      ["write the native receipt", "update public.blsh_capture_runs set manifest_sha256 = repeat('0', 64)"],
      ["write a context run", "update public.blsh_context_runs set state = 'claimed'"],
      ["use execute_sql", "select public.execute_sql('select 1')"],
    ] as const) asRole("service_role", stmt);
    results.push("PASS service_role (service-role key, secret key, JWT-minted service_role): denied reading/replacing/inserting keys, rewriting evidence/step functions, signer URL, steps, ledger, cron jobs, INSTALL pin, native/context rows, execute_sql");
    // (2) anon and authenticated (publishable/anon key, JWT-minted tokens).
    for (const role of ["anon", "authenticated"]) {
      for (const stmt of ["select secret from fhfh_internal.blsh_signer_secrets", "select fhfh_internal.blsh_signer_evidence_20261122('official')",
        "delete from fhfh_internal.blsh_signer_issuance_20261122", "select decrypted_secret from vault.decrypted_secrets"]) asRole(role, stmt);
    }
    results.push("PASS anon and authenticated (anon/publishable keys, JWT-minted tokens): denied keys, evidence, ledger, Vault");
    // (3) The mandate is not in the database: no row the app can write changes what the signer will sign.
    psql(`set role service_role; insert into vault.decrypted_secrets values ('BLSH_SIGNER_MANDATE', ${dq(JSON.stringify({ ...mandate, deploymentId: "dpl_AttackerChoice" }))})`);
    const probe = await (async () => { jump(C + "T12:20:00Z"); return supaSigner().handle({ method: "POST", path: "/selfcheck", rawQuery: "", body: "{}",
      headers: { authorization: "Bearer " + TRIGGER } }); })();
    expect((probe.body as { mandateArmed: boolean }).mandateArmed).toBe(true);
    expect(JSON.stringify(mandate)).not.toContain("dpl_AttackerChoice");
    results.push("PASS the mandate lives only in the Edge Function secret: a service_role-written Vault row named BLSH_SIGNER_MANDATE changes nothing the signer reads");
    // (4) Minting: without a private key, a grant signed by any other key is refused by Y's verifier.
    const { generateKeyPairSync: gen, sign: edSign2 } = await import("node:crypto");
    const forgedKey = gen("ed25519").privateKey;
    const approval = JSON.parse(Buffer.from(grant, "base64").toString("utf8")).approval;
    const forged = Buffer.from(JSON.stringify({ approval, signature: edSign2(null, officialPilotApprovalBytes(approval), forgedKey).toString("base64") })).toString("base64");
    jump(C + "T12:45:30Z");
    const forgedOut = await send(bases.app, "GET", "/api/v1/db/blsh-official-boxscores", { authorization: "Bearer fixture-cron", "x-blsh-official-grant": forged });
    expect(JSON.parse(forgedOut.text)).toMatchObject({ state: "refused", reason: "approval_invalid" });
    const rcApproval = JSON.parse(rcEnvelope).approval;
    const rcForged = JSON.stringify({ approval: rcApproval, signature: edSign2(null, requestContextApprovalBytes(rcApproval), forgedKey).toString("base64") });
    const rcForgedOut = await send(bases.app, "POST", "/api/v1/db/blsh-request-context", { authorization: "Bearer fixture-cron", "content-type": "application/json" }, rcForged);
    expect(JSON.parse(rcForgedOut.text)).toMatchObject({ state: "refused", reason: "approval_invalid" });
    results.push("PASS minting: approvals signed with any key the app could hold are refused by Y's request-context and official handlers (approval_invalid)");
    // (5) What the app CAN still do (denial of service only): overwrite the Vault grant; see the bearer while a request is pending.
    psql(`set role service_role; update vault.decrypted_secrets set decrypted_secret = ${dq(forged)} where name = 'blsh_official_grant_20261122'`);
    results.push("RESIDUAL-DOS service_role can overwrite the Vault grant (Y then refuses it: approval_invalid) or pre-create it (the 12:42 step refuses): denial of service, never an accepted approval");
  }, 180000);

  it("E2 rotation: the old owner password stops new logins at once; sessions already open survive until pg_terminate_backend", async () => {
    await e2World("e2_rotation");
    psql(`create role owner_emul login password 'old-owner-password-fixture-0001'; grant usage on schema fhfh_internal to owner_emul;
      grant select on fhfh_internal.blsh_signer_secrets to owner_emul;`);
    const connect = (password: string) => { const c = new pg.Client({ host: "127.0.0.1", port: pgPort, user: "owner_emul", password, database: DB }); return c.connect().then(() => c); };
    const held = await connect("old-owner-password-fixture-0001");
    expect((await held.query("select count(*)::int as n from fhfh_internal.blsh_signer_secrets where name like 'blsh_signer_%_key_%'")).rows[0].n).toBe(2);
    results.push("RESIDUAL (today) the owner credential (POSTGRES_* in Vercel) reads both keys over the network");
    psql("alter role owner_emul password 'new-owner-password-fixture-0002'");
    await expect(connect("old-owner-password-fixture-0001")).rejects.toThrow(/password authentication failed/);
    results.push("PASS after rotation a new login with the old password fails (password authentication failed)");
    expect((await held.query("select 1 as one")).rows[0].one).toBe(1);
    results.push("FINDING a session opened with the old password before rotation keeps working: E2 must end pre-existing owner sessions (pg_terminate_backend), as a separate line");
    const pid = Number(psql("select pid from pg_stat_activity where usename = 'owner_emul' limit 1"));
    expect(psql(`select pg_terminate_backend(${pid})`)).toBe("t");
    await expect(held.query("select 1")).rejects.toThrow();
    await held.end().catch(() => {});
    const fresh = await connect("new-owner-password-fixture-0002"); await fresh.end();
    results.push("PASS pg_terminate_backend ends the held session; the new password works");
    const r2 = psql(readFileSync(join(PROOF, "sql/R2-READONLY.sql"), "utf8"));
    writeFileSync(join(OUT, "r2-local-emulation.txt"), r2.replace(/127\.0\.0\.1/g, "127.0.0.1") + "\n");
    expect(r2).toMatch(/^terminate\|/m);
    expect(r2).toMatch(/^service_role_fn\|public\.execute_sql\(text\)\|f$/m);
    results.push("PASS R2-READONLY.sql runs read-only locally: session counts, service_role cron/net reach, terminate capability (out/r2-local-emulation.txt)");
  }, 120000);

  it("R2 reach: cron and pg_net give service_role no path to the bearer, keys, ledger, mandate or the BLSH jobs (pg_cron 1.4 semantics)", async () => {
    await e2World("e2_cron");
    // (a) No job command embeds the bearer or a grant: they are read at run time from the private table / Vault.
    fire("blsh-signer-rc-sign-20261122", C + "T12:35:00.200Z"); await drainNet();
    fire("blsh-signer-rc-post-20261122", C + "T12:36:00.150Z"); await drainNet();
    fire("blsh-signer-official-sign-20261122", C + "T12:41:00.300Z"); await drainNet();
    fire("blsh-signer-official-store-20261122", C + "T12:42:00.100Z");
    const grantNow = psql(`select decrypted_secret from vault.decrypted_secrets where name = 'blsh_official_grant_20261122'`);
    expect(grantNow.length).toBeGreaterThan(200);
    const visible = psql(`set role service_role; select coalesce(string_agg(command, E'\\n'), '') from cron.job`);
    expect(visible).toContain("blsh_official_dispatch_20261122");
    expect(visible.includes(TRIGGER)).toBe(false);
    expect(visible.includes(grantNow)).toBe(false);
    expect(/[A-Za-z0-9+/]{120,}={0,2}/.test(visible)).toBe(false);
    for (const f of ["sql/AUTOMATE-ONCE-SUPABASE.sql", "sql/AUTOMATE-ONCE.sql"]) {
      const text = readFileSync(join(PROOF, f), "utf8");
      expect(/[A-Za-z0-9+/]{120,}={0,2}/.test(text) || text.includes(TRIGGER)).toBe(false);
    }
    expect(/[A-Za-z0-9+/]{120,}={0,2}/.test(readFileSync(join(LIVE, "SCHEDULE-ONCE.sql"), "utf8"))).toBe(false);
    results.push("PASS (a) service_role sees every job command (BYPASSRLS) but none embeds the bearer or the grant: the step and dispatch commands read them at run time (AUTOMATE-ONCE-SUPABASE, AUTOMATE-ONCE and SCHEDULE-ONCE texts carry no secret literal)");
    // (b) service_role cannot unschedule, overwrite or edit postgres-owned BLSH jobs.
    const dispatchId = psql(`select jobid from cron.job where jobname = 'blsh-official-once-20261122' and username = 'postgres'`);
    const before = psql(`select string_agg(jobid || ':' || jobname || ':' || schedule || ':' || md5(command), ',' order by jobid) from cron.job where username = 'postgres'`);
    asRole("service_role", `select cron.unschedule(${dispatchId})`, "permission denied for table job");
    asRole("service_role", `update cron.job set command = 'select 1' where jobid = ${dispatchId}`);
    asRole("service_role", `delete from cron.job where jobid = ${dispatchId}`);
    const shadow = psql(`set role service_role; select cron.schedule('blsh-official-once-20261122', '45 12 23 11 *', 'select 1')`).split("\n").at(-1);
    expect(shadow).not.toBe(dispatchId);
    expect(psql(`select string_agg(jobid || ':' || jobname || ':' || schedule || ':' || md5(command), ',' order by jobid) from cron.job where username = 'postgres'`)).toBe(before);
    results.push("PASS (b) service_role: cron.unschedule of the postgres dispatch job refused; UPDATE/DELETE on cron.job denied; scheduling the same name creates a separate service_role job and leaves the postgres job byte-identical");
    // (c) A service_role job runs as service_role: no escalation to the secrets, ledger, signer functions or steps.
    for (const [label, cmd] of [
      ["read the keys", "select secret from fhfh_internal.blsh_signer_secrets"],
      ["clear the ledger", "delete from fhfh_internal.blsh_signer_issuance_20261122"],
      ["run a signer step", "select fhfh_internal.blsh_signer_step_20261122('official_store')"],
      ["call the evidence function", "select fhfh_internal.blsh_signer_evidence_20261122('official')"],
      ["reset a step", "update fhfh_internal.blsh_signer_steps_20261122 set disposition = 'registered'"],
    ] as const) {
      psql(`set role service_role; select cron.schedule('sr-probe-${label.replaceAll(" ", "-")}', '* * * * *', ${dq(cmd)})`);
      expect(() => fire(`sr-probe-${label.replaceAll(" ", "-")}`, C + "T12:43:00Z", "service_role")).toThrow(/permission denied/);
    }
    results.push("PASS (c) jobs scheduled by service_role execute as service_role and are denied: keys, ledger, signer step, evidence, step reset");
    // (d) net.http_post from service_role reaches the signer only without the bearer, which it cannot read.
    asRole("service_role", "select secret from fhfh_internal.blsh_signer_secrets where name = 'blsh_signer_trigger_secret'");
    asRole("service_role", "select * from net.queue");
    psql(`set role service_role; select net.http_post(url := '${SUPA_URL}/official', body := '{}'::jsonb,
      headers := '{"Authorization":"Bearer guessed-or-empty","Content-Type":"application/json"}'::jsonb)`);
    const beforeEvidence = evidenceCalls;
    await drainNet();
    const resp = JSON.parse(psql(`select content from net._http_response order by id desc limit 1`));
    expect(resp).toEqual({ state: "refused", reason: "trigger_bearer_required" });
    expect(evidenceCalls).toBe(beforeEvidence);
    results.push("PASS (d) service_role's net.http_post reaches the Edge signer without the bearer -> 403 trigger_bearer_required, no evidence query; service_role cannot read the bearer (private table) or the pg_net queue (per R2)");
    // job_run_details: writable by service_role, but authoritative state is in the fhfh_internal tables.
    const stepsBefore = steps();
    psql(`set role service_role; insert into cron.job_run_details(jobid, username, command, status, return_message) values (${dispatchId}, 'postgres', 'forged', 'succeeded', 'ok');`);
    expect(steps()).toBe(stepsBefore);
    results.push("PASS job_run_details tampering by service_role changes no signer step, ledger or dispatch row: observability/DoS only");
  }, 180000);
});
