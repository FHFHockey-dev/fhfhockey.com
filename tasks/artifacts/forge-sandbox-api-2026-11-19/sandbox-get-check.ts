// Local process only (check_sandbox.py). The real route through real PostgREST 16.6 as forge_sandbox_api, then the
// denial matrix over HTTP. PostgREST serves at its root; supabase-js's /rest/v1 prefix (Supabase's gateway path) is
// stripped here. Any other non-TSA network request fails the check.
import assert from "node:assert/strict";
import { createHash, X509Certificate } from "node:crypto";
import { createServer, type Server } from "node:http";
import { Client } from "pg";
import type { NextApiRequest, NextApiResponse } from "next";
import { mintTimeStampResponse, testTsaTrust } from "lib/projections/pregameCapture/__fixtures__/testTsa";
import { TSA_PROFILES } from "lib/projections/pregameCapture/tsaProfiles";
import route from "pages/api/v1/db/forge-sandbox-run";

async function listen(server: Server) {
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}

async function call(headers: Record<string, string>, query: Record<string, string> = {}) {
  let status = 0, body: any = null;
  const cache: string[] = [];
  const res = { setHeader(k: string, v: string) { if (k === "Cache-Control") cache.push(v); },
    status(code: number) { status = code; return res; }, json(value: unknown) { body = value; return res; }, end() { return res; } };
  const started = Date.now();
  await route({ method: "GET", query, headers } as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return { status, body, cache: cache[0], wallMs: Date.now() - started };
}

async function main() {
  const rest = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const tokens = JSON.parse(process.env.FORGE_TEST_TOKENS!) as Record<"anon" | "authenticated" | "sandbox", string>;
  const owner = new Client(JSON.parse(process.env.FORGE_SANDBOX_OWNER_DSN!));
  await owner.connect();
  const trust = testTsaTrust();
  let tsaCalls = 0;
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
  const http = globalThis.fetch;
  const profiles: Record<string, number> = {};
  let restCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.origin === new URL(rest).origin && url.pathname.startsWith("/rest/v1/")) {
      url.pathname = url.pathname.slice("/rest/v1".length);
      restCalls++;
      const headers = new Headers(init?.headers);
      const profile = headers.get("accept-profile") ?? headers.get("content-profile") ?? "(none)";
      profiles[profile] = (profiles[profile] ?? 0) + 1;
      assert.equal(headers.get("authorization"), `Bearer ${tokens.sandbox}`, "route used a credential other than the sandbox token");
    } else assert.equal(url.origin, tsaUrl, `unexpected network request ${url.origin}${url.pathname}`);
    return http(url, { ...init, redirect: "error" });
  };
  const counts = `select (select count(*) from forge_sandbox_capture.claims)::int claims, (select count(*) from forge_sandbox_capture.artifacts)::int artifacts,
    (select count(*) from forge_sandbox_capture.witnesses)::int witnesses, (select count(*) from forge_sandbox_capture.outcomes)::int outcomes,
    (select count(*) from forge_sandbox_capture.sandbox_runs)::int sandbox, (select xmin::text from forge_sandbox_capture.sandbox_runs) row_version`;
  const rows = async () => (await owner.query(counts)).rows[0];

  // Raw PostgREST requests for the denial matrix.
  const raw = async (token: string | null, method: string, path: string, profile: string | null, body?: unknown) => {
    const headers: Record<string, string> = { "content-type": "application/json", apikey: tokens.anon };
    if (token) headers.authorization = `Bearer ${token}`;
    if (profile) headers[method === "GET" || method === "HEAD" ? "accept-profile" : "content-profile"] = profile;
    const response = await http(rest + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return response.status;
  };
  try {
    const auth = { authorization: `Bearer ${process.env.CRON_SECRET}` };
    assert.equal((await call({ authorization: "Bearer wrong" })).status, 401);
    assert.equal((await call(auth, { gameId: "2099020991" })).status, 400);

    const first = await call(auth);
    const before = await rows();
    const second = await call(auth);
    const after = await rows();
    assert.equal(first.cache, "no-store, max-age=0");
    assert.ok(second.status === 409 && second.body.status === "duplicate", JSON.stringify(second.body));
    assert.deepEqual(after, before);

    const denials: Record<string, number> = {};
    const deny = async (name: string, status: Promise<number>) => {
      denials[name] = await status;
      assert.ok(denials[name] >= 400 && denials[name] < 500, `${name} was not refused: ${denials[name]}`);
    };
    // Anonymous and ordinary signed-in clients get nothing from the sandbox API.
    for (const who of ["anon", "authenticated"] as const) {
      await deny(`${who}: GET forge_sandbox_api.games`, raw(tokens[who], "GET", "/games?select=id&limit=1", "forge_sandbox_api"));
      await deny(`${who}: GET forge_sandbox_api.forge_goalie_game`, raw(tokens[who], "GET", "/forge_goalie_game?limit=1", "forge_sandbox_api"));
      await deny(`${who}: RPC forge_sandbox_receipt_v1`, raw(tokens[who], "POST", "/rpc/forge_sandbox_receipt_v1", "forge_sandbox_api", { p_game: 2099020991 }));
      await deny(`${who}: RPC forge_sandbox_run_begin_v1`, raw(tokens[who], "POST", "/rpc/forge_sandbox_run_begin_v1", "forge_sandbox_api",
        { p_game_id: 2099020991, p_code_version: "0".repeat(40) }));
    }
    await deny("no token: GET forge_sandbox_api.games", raw(null, "GET", "/games?limit=1", "forge_sandbox_api"));
    // The sandbox token cannot write anything in public, call public definers, write its own views, or name a private schema.
    const s = tokens.sandbox;
    await deny("sandbox: POST public.games", raw(s, "POST", "/games", "public", { id: 1, date: "2026-11-19", seasonId: 20262027 }));
    await deny("sandbox: PATCH public.games", raw(s, "PATCH", "/games?id=eq.2099020991", "public", { type: 3 }));
    await deny("sandbox: DELETE public.games", raw(s, "DELETE", "/games?id=eq.2099020991", "public"));
    await deny("sandbox: POST public.forge_runs", raw(s, "POST", "/forge_runs", "public", { run_id: "00000000-0000-4000-8000-000000000001" }));
    await deny("sandbox: DELETE public.forge_runs", raw(s, "DELETE", "/forge_runs?run_id=not.is.null", "public"));
    await deny("sandbox: GET public.games", raw(s, "GET", "/games?limit=1", "public"));
    await deny("sandbox: RPC public.forge_pregame_capture_claim_v1", raw(s, "POST", "/rpc/forge_pregame_capture_claim_v1", "public", {
      p_game_id: 2099020991, p_policy_id: "pregame-native-v1", p_slate_date: "2026-11-19", p_home_team_id: 10, p_away_team_id: 6,
      p_calendar_revision: "x", p_scheduled_start: new Date().toISOString(), p_required_ms: 1, p_code_version: "0".repeat(40) }));
    await deny("sandbox: RPC public.forge_pregame_publish_v1", raw(s, "POST", "/rpc/forge_pregame_publish_v1", "public", {
      p_claim_id: "00000000-0000-4000-8000-000000000001", p_code_version: "x", p_raw_sha256: "x", p_canonical_sha256: "x",
      p_snapshot: {}, p_metrics: {}, p_players: [], p_teams: [], p_goalies: [], p_reserves: [] }));
    await deny("sandbox: POST forge_sandbox_api.games (view)", raw(s, "POST", "/games", "forge_sandbox_api", { id: 1 }));
    await deny("sandbox: DELETE forge_sandbox_api.games (view)", raw(s, "DELETE", "/games?id=eq.2099020991", "forge_sandbox_api"));
    for (const schema of ["forge_sandbox", "forge_sandbox_capture", "forge_sandbox_internal", "forge_sandbox_exec", "pgsodium", "vault"]) {
      await deny(`sandbox: Accept-Profile ${schema}`, raw(s, "GET", "/games?limit=1", schema));
    }
    // A positive control: the sandbox token can read its own API (proves the denials are not a broken server).
    const own = await raw(s, "GET", "/games?select=id&limit=1", "forge_sandbox_api");
    assert.equal(own, 200);
    assert.deepEqual(await rows(), after);
    assert.equal(tsaCalls, 1, JSON.stringify(first.body).slice(0, 1500));
    console.log(JSON.stringify({ gameId: 2099020991, sha: first.body?.sha,
      first: { httpStatus: first.status, wallMs: first.wallMs, status: first.body?.status, reason: first.body?.reason,
        elapsedMs: first.body?.elapsedMs, claimId: first.body?.claimId, summary: first.body?.summary, receipt: first.body?.receipt, body: first.body },
      duplicate: { httpStatus: second.status, status: second.body.status, rowsBefore: before, rowsAfter: after },
      routeRestCalls: restCalls, routeProfiles: profiles, tsaCalls, positiveControl: own, denials }));
  } finally {
    globalThis.fetch = http;
    tsa.close();
    await owner.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
