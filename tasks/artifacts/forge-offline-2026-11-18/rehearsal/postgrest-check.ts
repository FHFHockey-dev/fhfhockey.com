// Local process only. The bootstrap creates this database, role, JWT and signer exclusively for the check.
import assert from "node:assert/strict";
import { createHash, X509Certificate } from "node:crypto";
import { createServer, type Server } from "node:http";
import { Client } from "pg";
import type { NextApiRequest, NextApiResponse } from "next";
import { mintTimeStampResponse, testTsaTrust } from "lib/projections/pregameCapture/__fixtures__/testTsa";
import { TSA_PROFILES } from "lib/projections/pregameCapture/tsaProfiles";
import capture from "pages/api/v1/db/forge-pregame-capture-v2";
import stage from "pages/api/v1/db/forge-pregame-stage";
import { runWitnessOnce } from "scripts/forge-independent-witness";

async function listen(server: Server) {
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}

async function main() {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const socket = process.env.FORGE_FIXTURE_SOCKET!;
  assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.match(socket, /^\/[^?#]*\/forge-pub-[^/]+$/);
  const request = JSON.parse(process.env.FORGE_REHEARSAL_REQUEST!);
  assert.equal(request.gameId, 2099020991);
  const database = { host: socket, port: Number(process.env.FORGE_FIXTURE_PG_PORT), database: "synthetic_rehearsal" };
  const owner = new Client({ ...database, user: "postgres" });
  const witness = new Client({ ...database, user: "forge_independent_verifier" });
  const query = async (sql: string, args: unknown[] = []) => (await owner.query(sql,args)).rows[0];
  await owner.connect();
  await witness.connect();
  const trust = testTsaTrust();
  let tsaCalls = 0;
  const tsa = createServer(async (req, res) => {
    const blocks = [];
    for await (const part of req) blocks.push(part);
    tsaCalls++;
    res.setHeader("content-type","application/timestamp-reply");
    res.end(mintTimeStampResponse(Buffer.concat(blocks), { genTimeMicros: BigInt(Date.now()) * BigInt(1000) }));
  });
  const tsaUrl = await listen(tsa);
  // Install the test profile in this isolated process only. All production route code remains intact.
  Object.assign(TSA_PROFILES["digicert-g4-v1"], { ...trust, url: tsaUrl, fallbackAccuracyMicros: undefined,
    anchorSha256: trust.anchorsPem.map(pem => createHash("sha256").update(new X509Certificate(pem).raw).digest("hex")), extraCertsSha256: [] });
  const app = createServer(async (req, res) => {
    try {
      const blocks = [];
      for await (const part of req) blocks.push(part);
      Object.assign(req, { query: {}, body: JSON.parse(Buffer.concat(blocks).toString()) });
      Object.assign(res, { status(code: number) { res.statusCode = code; return res; },
        json(body: unknown) { res.setHeader("content-type","application/json"); res.end(JSON.stringify(body)); } });
      assert.equal(req.method,"POST");
      const handler = req.url === "/api/v1/db/forge-pregame-capture-v2" ? capture : stage;
      assert.ok(handler === capture || req.url === "/api/v1/db/forge-pregame-stage");
      await handler(req as NextApiRequest,res as NextApiResponse);
    } catch { res.writeHead(500); res.end(); }
  });
  const appUrl = await listen(app);
  const http = globalThis.fetch;
  const errors: string[] = [];
  let step = "", deliveries = 0;
  const calls: Record<string,number> = {};
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.origin === origin && url.pathname.startsWith("/rest/v1/")) {
      url.pathname = url.pathname.slice("/rest/v1".length);
      calls[step] = (calls[step] ?? 0) + 1;
    } else assert.equal(url.origin,tsaUrl,"unexpected non-fixture request");
    const result = await http(url,{ ...init, redirect: "error" });
    if (!result.ok && errors.length < 8) errors.push(`${url.pathname} ${result.status} ${(await result.clone().text()).slice(0,260)}`);
    return result;
  };
  try {
    await owner.query(`create table net.fixture_deliveries(id bigint generated always as identity, url text, body jsonb, headers jsonb);
      create or replace function net.http_post(url text,body jsonb,params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 2000)
        returns bigint language sql as $$insert into net.fixture_deliveries(url,body,headers) values($1,$2,$4) returning id$$;`);
    await query("insert into vault.decrypted_secrets values('forge_pregame_dispatch_secret',$1)",[process.env.FORGE_PREGAME_DISPATCH_SECRET]);
    await query(`insert into forge_pregame_capture.hosted_runs(game_id,expected_code_version,slate_date,scheduled_start,open_at,close_at,
      witness_authority,witness_principal,player_id,context_id,app_origin) values ($1,$2,$3,$4,clock_timestamp()+interval '0.5 seconds',
      $4::timestamptz-interval '67 minutes','automated','forge_independent_verifier',8471001,'synthetic-single-center-points-v1','https://fixture.invalid')`,
    [request.gameId,request.codeVersion,request.slateDate,request.scheduledStart]);
    await query("select forge_pregame_capture.hosted_arm_v2($1)",[request.gameId]);
    await query("select pg_sleep(0.51)");
    const tick = async (expected: string) => assert.equal((await query("select forge_pregame_capture.hosted_tick_v2() phase")).phase,expected);
    const deliver = async (phase: string, status: string) => {
      await tick(phase);
      const cmd = await query("select * from net.fixture_deliveries order by id desc limit 1");
      const route = new URL(cmd.url);
      assert.equal(route.origin, "https://fixture.invalid");
      step = phase;
      const response = await http(appUrl + route.pathname, {method:"POST",headers:cmd.headers,body:JSON.stringify(cmd.body),redirect:"error"});
      const body = await response.json();
      assert.ok(response.status === 200 && body.status === status, JSON.stringify({phase,body,errors}));
      deliveries++;
    };
    await deliver("preflight","ready");
    await deliver("capture","finished");
    await tick("verify");
    assert.equal(await runWitnessOnce(witness,request.gameId,request.codeVersion,trust),"accepted");
    await deliver("publish","awaiting_receipt");
    await deliver("readers","succeeded");
    const { receipt } = await query("select forge_pregame_capture.hosted_receipt_v2($1) receipt",[request.gameId]);
    assert.equal(receipt.phase,"succeeded");
    assert.equal(receipt.independent.verifier_role,"forge_independent_verifier");
    assert.equal(receipt.independent.verdict,"accepted");
    assert.equal(receipt.claim,receipt.independent.claim_id);
    assert.equal(receipt.claim,receipt.publication.runId);
    const { daily, detailed } = receipt.readers;
    assert.equal(daily.selectedRun,receipt.claim);
    assert.ok(daily.reason === null && daily.points > 0 && daily.legalSlot === "C#1");
    assert.ok(detailed.selectedRun === receipt.claim && detailed.revisionId === receipt.publication.revisionId &&
      detailed.points === null && detailed.reason === "missing_participation");
    assert.equal((await query("select count(*)::int n from net.fixture_deliveries")).n,deliveries);
    assert.equal(tsaCalls,1);
    await tick("idle");
    console.log(JSON.stringify({gameId:request.gameId,releaseLabel:request.codeVersion,phase:receipt.phase,
      claim:receipt.claim,revisionId:receipt.publication.revisionId,independent:receipt.independent.verdict,
      applicationDeliveries:deliveries,tsaCalls,appToDbHttpRequests:calls,receipt}));
  } finally {
    globalThis.fetch = http;
    app.close(); tsa.close();
    await Promise.all([owner.end(),witness.end()]);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
