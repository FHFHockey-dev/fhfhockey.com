// Local process only (check_live.py). Fires the armed jobs' commands, delivers each GET to the real routes as pg_net would,
// and records the independent verdict as the verifier would. Production flags; service role through PostgREST.
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, X509Certificate } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createServer, type Server } from "node:http";
import { Client } from "pg";
import type { NextApiRequest, NextApiResponse } from "next";
import { mintTimeStampResponse, testTsaTrust } from "lib/projections/pregameCapture/__fixtures__/testTsa";
import { TSA_PROFILES } from "lib/projections/pregameCapture/tsaProfiles";
import capture from "pages/api/v1/db/forge-live-capture";
import publish from "pages/api/v1/db/forge-live-publish";
import verify from "pages/api/v1/db/forge-witness-verify";
import { requireLatestSucceededRunId } from "lib/projections/apiHelpers";
import { loadExternalInputProof } from "lib/projections/externalInputProof";
import { loadForgeGameRevisions } from "lib/projections/gameRevisions";
import { withForgeEnv } from "lib/projections/forgeEnvScope";
import { witnessKeyId } from "lib/projections/pregameCapture/signedVerdict";
import { WITNESS_SIGNING_KEYS } from "lib/projections/pregameCapture/witnessSigningKeys";
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
    // The independent verdict. With the verifier package installed, its own one-shot cron job fires and its real route
    // (pages/api/v1/db/forge-witness-verify) reads the claim back as forge_witness_api through PostgREST, re-verifies the
    // RFC 3161 token (the released profile re-pointed at this process's test TSA, as the verifier's rehearsal does) and
    // records the verdict. Otherwise the interface stub stands in.
    if ((await sql("select to_regclass('forge_witness.signed_verdicts') is not null as signed"))[0].signed) {
      // Track A: the verifier's own one-shot cron fire, then its committed Edge bundle (as deployed) judges the claim and
      // records an Ed25519-signed verdict with a TEST signing key. The release trusts it only if that key is pinned, which
      // this process does in memory for the success rehearsal (FORGE_SIGNED_MODE=pinned-test-key) and never ships.
      const job = (await sql("select command from cron.job where jobname = $1", [`forge-witness-signed-${game}`]))[0]?.command as string;
      assert.match(job, /forge_witness_ops\.fire_signed_v1\(2099020991, 1,/);
      const firedSigned = Object.values((await sql(job))[0])[0] as string;
      assert.match(firedSigned, /^fired \d+$/);
      const test = generateKeyPairSync("ed25519");
      const x = test.publicKey.export({ format: "jwk" }).x!, keyId = witnessKeyId(x);
      if (process.env.FORGE_SIGNED_MODE === "pinned-test-key") Object.assign(WITNESS_SIGNING_KEYS, { [keyId]: x });
      const [c] = await sql(`select c.slate_date::text slate, to_char(c.scheduled_start at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') start,
        c.home_team_id home, c.away_team_id away, (select abbreviation from public.teams where id = c.home_team_id) home_abbrev,
        (select abbreviation from public.teams where id = c.away_team_id) away_abbrev from forge_pregame_capture.claims c where c.id = $1`, [claimId]);
      const landing = { id: game, startTimeUTC: c.start, gameDate: c.slate, gameState: "FUT", gameScheduleState: "OK",
        homeTeam: { id: Number(c.home), abbrev: String(c.home_abbrev).trim() }, awayTeam: { id: Number(c.away), abbrev: String(c.away_abbrev).trim() } };
      const edgeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        if (url.origin === "https://api-web.nhle.com") return Response.json(landing);
        return globalThis.fetch(input, init);
      }) as typeof fetch;
      const importEsm = new Function("url", "return import(url)") as (url: string) => Promise<any>;
      const edge = await importEsm(pathToFileURL(process.env.FORGE_EDGE_BUNDLE!).href);
      const edgeEnv: Record<string, string> = { SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        FORGE_WITNESS_SIGNING_KEY: test.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64") };
      const response: Response = await edge.handleWitnessEdgeRequest(new Request("https://edge.local/forge-witness-verify", { method: "POST" }),
        (name: string) => edgeEnv[name], { fetch: edgeFetch, trust: testTsaTrust() });
      const edgeBody = await response.json();
      assert.equal(response.status, 200, JSON.stringify(edgeBody).slice(0, 2000));
      assert.equal(await count("forge_witness.signed_verdicts"), 1);
      assert.equal(await count("forge_witness.verdicts"), 0);   // never mixed with the unsigned verifier
      verifier = { package: "forge-witness-signed (committed Edge bundle)", fired: firedSigned, edge: edgeBody, keyId,
        pinned: process.env.FORGE_SIGNED_MODE === "pinned-test-key" };
    } else if ((await sql("select to_regnamespace('forge_witness_api') is not null as real"))[0].real) {
      const job = (await sql("select command from cron.job where jobname = $1", [`forge-witness-verify-${game}`]))[0]?.command as string;
      assert.match(job, /forge_witness_ops\.fire_v1\(2099020991, 1\)/);
      const firedVerify = (await sql(job))[0].fire_v1 as string;
      assert.match(firedVerify, /^fired \d+$/);
      // Deliver exactly what pg_net would send: the headers the fire function recorded (cron secret + witness token).
      const [request] = await sql("select url, headers from net.requests where id = $1", [Number(firedVerify.split(" ")[1])]);
      assert.equal(request.url, "https://fhfhockey.com/api/v1/db/forge-witness-verify");
      const verifyHeaders = Object.fromEntries(Object.entries(request.headers as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
      assert.deepEqual(Object.keys(verifyHeaders).sort(), ["authorization", "x-forge-witness-token"]);
      assert.equal((await call(verify as typeof capture, auth)).body.status, "witness_credential_required");
      const verified = await call(verify as typeof capture, verifyHeaders);
      assert.equal(verified.status, 200, JSON.stringify({ body: verified.body, errors }).slice(0, 2500));
      const verdicts = await sql(`select verdict, reason, verifier_role, verifier_release from forge_witness.verdicts where claim_id = $1`, [claimId]);
      assert.deepEqual(verdicts, [{ verdict: "accepted", reason: null, verifier_role: "forge_witness_api", verifier_release: process.env.VERCEL_GIT_COMMIT_SHA }]);
      const verifiedAgain = await call(verify as typeof capture, verifyHeaders);
      assert.equal(await count("forge_witness.verdicts"), 1);
      assert.equal(await count("cron.job where jobname like 'forge-witness-verify-%'"), 0);
      verifier = { package: "forge-witness-verifier route", fired: firedVerify, status: verified.status, body: verified.body,
        wallMs: verified.wallMs, duplicate: verifiedAgain.body, verdict: verdicts[0] };
    } else {
      await sql(`insert into forge_witness.stub_verdicts(claim_id, verdict, raw_sha256, canonical_sha256, token_sha256)
        values ($1, 'accepted', $2, $3, $4)`, [claimId, artifact.raw_sha256, artifact.canonical_sha256, artifact.tsa_token_sha256]);
      verifier = { package: "stub", verdict: "accepted", role: "postgres" };
    }
    const firedPublish = await fire("publish");
    assert.match(firedPublish, /^fired \d+$/);
    const published = await call(publish, auth);
    // With no key pinned (the shipped state), the release must refuse publication end to end.
    if (process.env.FORGE_SIGNED_MODE !== "pinned-test-key") {
      assert.match(String(published.body.reason), /^signed_verdict:/);
      assert.deepEqual({ status: published.body.status, revisionId: published.body.revisionId, readers: published.body.readers },
        { status: "failed", revisionId: null, readers: null });
      assert.equal(await count("forge_pregame_capture.publications"), 0);
      assert.equal(await count("cron.job where jobname like 'forge-live-%'"), 0);
      assert.equal((await sql("select active from cron.job where jobid = 408"))[0].active, false);
      console.log(JSON.stringify({ capture: { status: first.status, body: first.body, wallMs: first.wallMs },
        publish: { status: published.status, wallMs: published.wallMs, body: published.body },
        failClosed: "signed verdict not verifiable in this release: no publication, no readers", restCalls, errors, tsaCalls, verifier }));
      return;
    }
    assert.ok(published.status === 200 && published.body.status === "succeeded", JSON.stringify({ body: published.body, errors,
      gate: (await sql("select forge_pregame_capture.live_signed_gate_v1($1) g", [claimId]))[0].g,
      signedRow: (await sql("select payload from forge_witness.signed_verdicts"))[0]?.payload, edge: (verifier as { edge?: unknown }).edge }).slice(0, 5000));
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
