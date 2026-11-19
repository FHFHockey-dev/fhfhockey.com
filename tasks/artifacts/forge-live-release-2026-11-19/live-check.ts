// Local process only (check_live.py). Fires the armed jobs' commands, delivers each GET to the real routes as pg_net would,
// and records the independent verdict as the verifier would. Production flags; service role through PostgREST.
import assert from "node:assert/strict";
import { createHash, X509Certificate } from "node:crypto";
import { createServer, type Server } from "node:http";
import { Client } from "pg";
import type { NextApiRequest, NextApiResponse } from "next";
import { mintTimeStampResponse, testTsaTrust } from "lib/projections/pregameCapture/__fixtures__/testTsa";
import { TSA_PROFILES } from "lib/projections/pregameCapture/tsaProfiles";
import capture from "pages/api/v1/db/forge-live-capture";
import publish from "pages/api/v1/db/forge-live-publish";
import { requireLatestSucceededRunId } from "lib/projections/apiHelpers";
import { loadExternalInputProof } from "lib/projections/externalInputProof";
import { loadForgeGameRevisions } from "lib/projections/gameRevisions";
import { withForgeEnv } from "lib/projections/forgeEnvScope";
import { getServiceRoleClient } from "lib/supabase/server";

async function listen(server: Server) {
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}

async function call(route: typeof capture, headers: Record<string, string>) {
  let status = 0, body: any = null;
  const res = { setHeader() { return res; }, status(code: number) { status = code; return res; }, json(value: unknown) { body = value; return res; }, end() { return res; } };
  const started = Date.now();
  await route({ method: "GET", query: {}, headers } as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return { status, body, wallMs: Date.now() - started };
}

async function main() {
  const game = Number(process.env.FORGE_LIVE_GAME);
  const owner = new Client(JSON.parse(process.env.FORGE_OWNER_DSN!));
  await owner.connect();
  const sql = async (text: string, args: unknown[] = []) => (await owner.query(text, args)).rows;
  const trust = testTsaTrust();
  let tsaCalls = 0;
  let verifier: Record<string, unknown> = {};
  const tsa = createServer(async (req, res) => {
    const blocks = [];
    for await (const part of req) blocks.push(part);
    tsaCalls++;
    res.setHeader("content-type", "application/timestamp-reply");
    res.end(mintTimeStampResponse(Buffer.concat(blocks), { genTimeMicros: BigInt(Date.now()) * BigInt(1000) }));
  });
  const tsaUrl = await listen(tsa);
  Object.assign(TSA_PROFILES["digicert-g4-v1"], { ...trust, url: tsaUrl, fallbackAccuracyMicros: undefined,
    anchorSha256: trust.anchorsPem.map(pem => createHash("sha256").update(new X509Certificate(pem).raw).digest("hex")), extraCertsSha256: [] });
  const rest = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
  const http = globalThis.fetch;
  const errors: string[] = [];
  let restCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.origin === rest && url.pathname.startsWith("/rest/v1/")) { url.pathname = url.pathname.slice("/rest/v1".length); restCalls++; }
    else assert.equal(url.origin, tsaUrl, `unexpected network request ${url.origin}${url.pathname}`);
    const response = await http(url, { ...init, redirect: "error" });
    if (!response.ok && url.origin === rest && errors.length < 10) errors.push(`${url.pathname} ${response.status} ${(await response.clone().text()).slice(0, 240)}`);
    return response;
  };
  const auth = { authorization: `Bearer ${process.env.CRON_SECRET}` };
  const count = async (table: string) => Number((await sql(`select count(*) n from ${table}`))[0].n);
  const fire = async (stage: string) => (await sql(`select forge_pregame_capture.live_fire_v1($1, $2) r`, [game, stage]))[0].r as string;
  const jobCommand = async (stage: string) => (await sql(`select command from cron.job where jobname = $1`, [`forge-live-${stage}-${game}`]))[0]?.command;
  try {
    assert.match(await jobCommand("capture"), /live_fire_v1\(2099020991, 'capture'\)/);
    // A publish before any capture is refused by the database (no claim), and nothing is consumed.
    assert.equal((await call(publish, auth)).body.status, "none_ready");
    const firedCapture = await fire("capture");
    assert.match(firedCapture, /^fired \d+$/);
    assert.equal(await fire("capture"), "already_fired");
    const first = await call(capture, auth);
    assert.ok(first.status === 200 && first.body.status === "captured", JSON.stringify({ body: first.body, errors }).slice(0, 2500));
    const claimId = first.body.claimId as string;
    const second = await call(capture, auth);
    assert.equal(second.body.status, "none_armed");
    assert.equal(await count("forge_pregame_capture.claims"), 1);

    // Verdict fence: with no verdict the publication stage is refused and nothing is consumed.
    assert.equal((await call(publish, auth)).body.status, "awaiting_verdict");
    const [artifact] = await sql(`select a.raw_sha256, a.canonical_sha256, w.tsa_token_sha256 from forge_pregame_capture.artifacts a
      join forge_pregame_capture.witnesses w on w.claim_id = a.claim_id where a.claim_id = $1`, [claimId]);
    assert.equal((await sql("select publish_began_at from forge_pregame_capture.live_runs where game_id = $1", [game]))[0].publish_began_at, null);
    // The verifier's accepted verdict. With the verifier migration installed, record it as that package's NOLOGIN API role
    // through its exposed record_v1 (the database re-derives every hash; its route's RFC 3161 check is rehearsed by the
    // verifier package, since this rehearsal's token comes from a local test TSA). Otherwise use the interface stub.
    if ((await sql("select to_regnamespace('forge_witness_api') is not null as real"))[0].real) {
      assert.equal((await sql("select forge_witness.arm_v1($1) r", [game]))[0].r.game_id, game);
      const [e] = await sql(`select encode(sha256(a.packet), 'hex') raw, a.canonical_sha256 canonical, encode(sha256(w.tsa_token), 'hex') token,
        w.statement_sha256 statement, c.input_cutoff::text cutoff, c.input_cutoff = c.claimed_at cutoff_is_claim from forge_pregame_capture.claims c
        join forge_pregame_capture.artifacts a on a.claim_id = c.id join forge_pregame_capture.witnesses w on w.claim_id = c.id
        where c.id = $1`, [claimId]);
      await sql("begin");
      await sql("set local role forge_witness_api");
      const [recorded] = await sql(`select forge_witness_api.record_v1($1, $2, 'accepted', null, $3, $4, $5, $6, $7, $8) r`,
        [game, claimId, e.raw, e.canonical, e.token, e.statement, e.cutoff, process.env.VERCEL_GIT_COMMIT_SHA]);
      await sql("commit");
      assert.ok(recorded.r.created && recorded.r.verdict.verdict === "accepted", JSON.stringify({ recorded: recorded.r, cutoffIsClaim: e.cutoff_is_claim }));
      verifier = { package: "forge-witness-verifier", verdict: recorded.r.verdict.verdict, role: recorded.r.verdict.verifier_role };
    } else {
      await sql(`insert into forge_witness.stub_verdicts(claim_id, verdict, raw_sha256, canonical_sha256, token_sha256)
        values ($1, 'accepted', $2, $3, $4)`, [claimId, artifact.raw_sha256, artifact.canonical_sha256, artifact.tsa_token_sha256]);
      verifier = { package: "stub", verdict: "accepted", role: "postgres" };
    }
    const firedPublish = await fire("publish");
    assert.match(firedPublish, /^fired \d+$/);
    const published = await call(publish, auth);
    assert.ok(published.status === 200 && published.body.status === "succeeded", JSON.stringify({ body: published.body, errors }).slice(0, 3000));
    const again = await call(publish, auth);
    assert.equal(again.body.status, "none_ready");
    assert.equal(await count("forge_pregame_capture.publications"), 1);
    assert.equal(await count("cron.job where jobname like 'forge-live-%'"), 0);
    assert.equal((await sql("select active from cron.job where jobid = 408"))[0].active, false);
    assert.equal(tsaCalls, 1);
    // Displacement fence: outside a game-scoped request no live reader selects the pregame publication.
    const date = (await sql("select slate_date::text d from forge_pregame_capture.live_runs where game_id = $1", [game]))[0].d;
    const outsideLatest = await requireLatestSucceededRunId(date).then(id => id, (error: { statusCode?: number }) => `error ${error.statusCode}`);
    const insideLatest = await withForgeEnv({}, () => requireLatestSucceededRunId(date));
    const outsideProof = (await loadExternalInputProof(getServiceRoleClient(), [claimId])).has(claimId);
    const insideProof = await withForgeEnv({}, async () => (await loadExternalInputProof(getServiceRoleClient(), [claimId])).has(claimId));
    const outsideRevisions = (await loadForgeGameRevisions(date)).filter(r => r.run_id === claimId).length;
    const insideRevisions = await withForgeEnv({}, async () => (await loadForgeGameRevisions(date)).filter(r => r.run_id === claimId).length);
    assert.deepEqual({ outsideLatest, insideLatest, outsideProof, insideProof, outsideRevisions, insideRevisions },
      { outsideLatest: "error 404", insideLatest: claimId, outsideProof: false, insideProof: true, outsideRevisions: 0, insideRevisions: 1 });
    console.log(JSON.stringify({ capture: { status: first.status, body: first.body, wallMs: first.wallMs },
      publish: { status: published.status, wallMs: published.wallMs, body: published.body },
      duplicates: { capture: second.body.status, publish: again.body.status }, fired: { capture: firedCapture, publish: firedPublish },
      restCalls, errors, tsaCalls, verifier, displacement: "outside scope: runs-latest 404, proof false, revisions 0; inside: claim, true, 1" }));
  } finally {
    globalThis.fetch = http;
    tsa.close();
    await owner.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
