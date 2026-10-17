/** Synthetic only: every network request is injected and checked; no server environment is used. */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { captureYahooSources, CaptureTransport, cli, LIMITS, sha, validateAllocation, type Allocation } from "./capture-yahoo-planning";

const requireWeb = createRequire(resolve(__dirname, "../../../web/package.json"));
const { createClient } = requireWeb("@supabase/supabase-js");
const ownerId = "11111111-1111-4111-8111-111111111111", accountId = "22222222-2222-4222-8222-222222222222";
const token = "synthetic-yahoo-access-secret";
const now = Date.parse("2026-10-16T12:00:00Z");
const allocation: Allocation = { version: "yahoo-rso-original-source-allocation-v1", projectRef: "fyhftlxokyjtpndbkfse",
  teamId: "33333333-3333-4333-8333-333333333333", leagueId: "44444444-4444-4444-8444-444444444444",
  yahooLeagueKey: "477.l.125593", yahooTeamKey: "477.l.125593.t.10", gameKey: "477", season: "2026", targetSeasonId: 20262027,
  startDate: "2026-10-12", endDate: "2026-10-18", rosterDate: "2026-10-16", fallbackTimeZone: "America/New_York",
  verifiedMetadataRef: "synthetic identity metadata only" };

function fixture(change?: (operation: string, payload: any) => any) {
  const root = mkdtempSync(join(tmpdir(), "yahoo-private-synthetic-")), output = join(root, "out");
  const bytes = Buffer.from(JSON.stringify(allocation));
  const calls: Array<{ operation: string; method: string }> = [];
  const payloads: Record<string, any> = {
    external_teams: { id: allocation.teamId, user_id: ownerId, provider: "yahoo", external_team_key: allocation.yahooTeamKey,
      external_league_id: allocation.leagueId, connected_account_id: accountId, team_metadata: { is_owned: true } },
    external_leagues: { id: allocation.leagueId, user_id: ownerId, provider: "yahoo", external_league_key: allocation.yahooLeagueKey, connected_account_id: accountId },
    connected_accounts: { id: accountId, user_id: ownerId, provider: "yahoo", status: "connected" },
    yahoo_game_keys: [{ game_id: 477, game_key: "477", code: "nhl", season: 2026 }],
    auth_owner: { id: ownerId, identities: [{ provider: "github", id: "52942235" }] },
    secure_token_read: [{ access_token: token, expires_at: "2026-10-16T13:00:00Z" }],
    settings: { league_key: allocation.yahooLeagueKey, time_zone: "America/New_York" },
    roster: { team_key: allocation.yahooTeamKey, is_owned_by_current_login: "1",
      roster: { date: allocation.rosterDate, coverage_type: "date", players: { count: 1 } } },
    availability: { league_key: allocation.yahooLeagueKey, players: { count: 25 } },
  };
  const network: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const operation = url.pathname.includes("/auth/") ? "auth_owner"
      : url.pathname.endsWith("get_connected_account_tokens_secure") ? "secure_token_read"
      : url.pathname.endsWith("/settings") ? "settings" : url.pathname.includes("/roster;") ? "roster"
      : url.hostname === "fantasysports.yahooapis.com" ? "availability" : url.pathname.split("/").pop()!;
    if (operation === "yahoo_game_keys") assert.equal(url.searchParams.get("limit"), "2");
    if (operation === "secure_token_read") {
      assert.deepEqual([...url.searchParams], [["select", "access_token,expires_at"]]);
      assert.deepEqual(Object.keys(payloads.secure_token_read[0]).sort(), ["access_token", "expires_at"]);
    }
    assert.equal(init?.redirect, "error"); assert.ok(init?.signal);
    if (url.hostname === "fantasysports.yahooapis.com") assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${token}`);
    calls.push({ operation, method: init?.method ?? "GET" });
    const payload = change ? change(operation, structuredClone(payloads[operation])) : payloads[operation];
    if (payload instanceof Response) return payload;
    return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json", date: new Date(now).toUTCString() } });
  };
  const run = () => captureYahooSources({ allocationBytes: bytes, approvedSHA256: sha(bytes), approvalRef: "synthetic-test-only", output,
    now: () => now, network, clientFactory: bounded => createClient(`https://${allocation.projectRef}.supabase.co`, "synthetic-service-key",
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: bounded } }) });
  return { root, output, calls, run, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("captures four exact original Yahoo responses through six scoped SDK reads without leaking credentials", async () => {
  const f = fixture();
  try {
    const result = await f.run();
    assert.equal(result.status, "captured_private_sources");
    assert.equal(result.databaseRequests, 6); assert.equal(result.yahooRequests, 4);
    assert.deepEqual(f.calls.map(c => c.operation), ["external_teams", "external_leagues", "connected_accounts", "auth_owner",
      "yahoo_game_keys", "secure_token_read", "settings", "roster", "availability", "availability"]);
    const files = readdirSync(f.output);
    assert.equal(files.filter(path => /^\d-yahoo\.json$/.test(path)).length, 4);
    assert.equal(statSync(f.output).mode & 0o777, 0o700);
    for (const path of files) {
      assert.equal(statSync(join(f.output, path)).mode & 0o777, 0o600);
      const retained = readFileSync(join(f.output, path), "utf8");
      assert.ok(!retained.includes(token)); assert.ok(!retained.includes("synthetic-refresh"));
      assert.ok(!retained.includes("Authorization")); assert.ok(!retained.includes("synthetic-service-key"));
    }
    assert.deepEqual(JSON.parse(readFileSync(join(f.output, "1-yahoo.json"), "utf8")), { league_key: allocation.yahooLeagueKey, time_zone: "America/New_York" });
    await assert.rejects(f.run(), /EEXIST/);
    assert.equal(f.calls.length, 10);
  } finally { f.cleanup(); }
});

for (const problem of ["foreign team", "foreign league", "foreign account", "not owner", "disconnected", "context", "expired token", "unknown expiry", "Yahoo unowned"] as const) {
  test(`fails closed on ${problem} without token refresh or later requests`, async () => {
    const f = fixture((op, payload) => {
      if (problem === "foreign team" && op === "external_teams") payload.external_team_key = "477.l.125593.t.11";
      if (problem === "foreign league" && op === "external_leagues") payload.user_id = accountId;
      if (problem === "foreign account" && op === "connected_accounts") payload.user_id = accountId;
      if (problem === "not owner" && op === "auth_owner") payload.identities = [];
      if (problem === "disconnected" && op === "connected_accounts") payload.status = "reauth_required";
      if (problem === "context" && op === "yahoo_game_keys") payload[0].game_key = "465";
      if (problem === "expired token" && op === "secure_token_read") payload[0].expires_at = "2026-10-16T12:01:30Z";
      if (problem === "unknown expiry" && op === "secure_token_read") delete payload[0].expires_at;
      if (problem === "Yahoo unowned" && op === "roster") payload.is_owned_by_current_login = "0";
      return payload;
    });
    try {
      const result = await f.run(); assert.equal(result.status, "stopped");
      if (!["expired token", "unknown expiry", "Yahoo unowned"].includes(problem)) assert.ok(!f.calls.some(c => c.operation === "secure_token_read"));
      if (problem !== "Yahoo unowned") assert.ok(!f.calls.some(c => c.operation === "settings"));
      assert.ok(f.calls.every(c => c.method === "GET" || c.operation === "secure_token_read"));
    } finally { f.cleanup(); }
  });
}

test("rejects redirects and oversized bodies, retaining bounded failed exposure and stopping the run", async () => {
  for (const mode of ["redirect", "bytes"] as const) {
    const f = fixture((op, payload) => op !== "settings" ? payload : mode === "redirect"
      ? new Response(null, { status: 302, headers: { location: "https://elsewhere.invalid/" } })
      : new Response(Buffer.alloc(LIMITS.bodyBytes + 1)));
    try {
      const result = await f.run(); assert.equal(result.status, "stopped"); assert.equal(result.yahooRequests, 1);
      assert.equal(f.calls.length, 7);
      assert.equal(statSync(join(f.output, "1-yahoo-failed.bin")).size, mode === "bytes" ? LIMITS.bodyBytes : 0);
    } finally { f.cleanup(); }
  }
});

test("holds a roster date outside the exact approved date and discloses partial candidate discovery", async () => {
  const f = fixture((op, payload) => op === "settings" ? { ...payload, time_zone: "Pacific/Auckland" } : payload);
  try { const result = await f.run(); assert.equal(result.status, "stopped"); assert.equal(result.yahooRequests, 1); }
  finally { f.cleanup(); }
  const empty = fixture((op, payload) => op === "availability" ? { ...payload, players: [] } : payload);
  try { const result = await empty.run(); assert.equal(result.status, "captured_private_sources"); assert.equal(result.yahooRequests, 3);
    assert.equal(JSON.parse(readFileSync(join(empty.output, "receipt.json"), "utf8")).availabilityComplete, false); }
  finally { empty.cleanup(); }
});

test("transport rejects writes, arbitrary origins, RPCs, duplicate requests and concurrency before another network request", async () => {
  const root = mkdtempSync(join(tmpdir(), "yahoo-transport-synthetic-"));
  try {
    for (const [url, method] of [[`https://${allocation.projectRef}.supabase.co/rest/v1/external_teams`, "PATCH"],
      [`https://${allocation.projectRef}.supabase.co/rest/v1/rpc/claim_yahoo_token_refresh_lease`, "POST"],
      ["https://elsewhere.invalid/", "GET"]]) {
      let calls = 0;
      const transport = new CaptureTransport(allocation, root, "synthetic", "synthetic", async () => { calls++; throw new Error("network forbidden"); });
      await assert.rejects(transport.fetch(url, { method }), /scope_denied/); assert.equal(calls, 0);
    }
    for (const query of ["", "?select=access_token,expires_at,refresh_token"]) {
      let tokenCalls = 0;
      const scoped = new CaptureTransport(allocation, root, "synthetic", "synthetic", async () => { tokenCalls++; throw new Error("network forbidden"); });
      scoped.bindOwner(ownerId, accountId);
      await assert.rejects(scoped.fetch(`https://${allocation.projectRef}.supabase.co/rest/v1/rpc/get_connected_account_tokens_secure${query}`,
        { method: "POST", body: JSON.stringify({ p_user_id: ownerId, p_connected_account_id: accountId }) }), /scope_denied/);
      assert.equal(tokenCalls, 0);
    }
    let calls = 0;
    const transport = new CaptureTransport(allocation, root, "synthetic", "synthetic", async () => { calls++; return new Response("{}"); });
    const url = `https://fantasysports.yahooapis.com/fantasy/v2/league/${allocation.yahooLeagueKey}/settings?format=json`;
    await transport.fetch(url);
    await assert.rejects(transport.fetch(url), /replay_or_concurrency/); assert.equal(calls, 1);
    let settle!: (response: Response) => void;
    const parallelRoot = join(root, "parallel"); mkdirSync(parallelRoot, { mode: 0o700 });
    const parallel = new CaptureTransport(allocation, parallelRoot, "synthetic", "synthetic", async () => { calls++; return new Promise<Response>(r => { settle = r; }); });
    const first = parallel.fetch(url);
    await assert.rejects(parallel.fetch(url), /replay_or_concurrency/);
    settle(new Response("{}")); await first; assert.equal(calls, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("total deadline and byte budget fail closed before an additional network request", async () => {
  const root = mkdtempSync(join(tmpdir(), "yahoo-deadline-synthetic-"));
  try {
    let elapsed = 0, calls = 0;
    const transport = new CaptureTransport(allocation, root, "synthetic", "synthetic", async () => { calls++; return new Response("{}"); }, () => now, () => elapsed);
    elapsed = LIMITS.totalMs;
    await assert.rejects(transport.fetch(`https://fantasysports.yahooapis.com/fantasy/v2/league/${allocation.yahooLeagueKey}/settings?format=json`), /total_deadline/);
    assert.equal(calls, 0);
    const capped = new CaptureTransport(allocation, root, "synthetic", "synthetic", async () => new Response(Buffer.alloc(20)), () => now);
    capped.bodyBytes = LIMITS.totalBytes - 10;
    await assert.rejects(capped.fetch(`https://fantasysports.yahooapis.com/fantasy/v2/league/${allocation.yahooLeagueKey}/settings?format=json`), /body_byte_cap/);
    assert.equal(capped.bodyBytes, LIMITS.totalBytes);
    const count = new CaptureTransport(allocation, root, "synthetic", "synthetic", async () => { calls++; return new Response("{}"); });
    count.yahooRequests = LIMITS.yahooRequests;
    await assert.rejects(count.fetch(`https://fantasysports.yahooapis.com/fantasy/v2/league/${allocation.yahooLeagueKey}/settings?format=json`), /request_cap/);
    assert.equal(calls, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("shared remaining time aborts hung headers and body reads without another request", async () => {
  for (const mode of ["headers", "body"] as const) {
    const root = mkdtempSync(join(tmpdir(), "yahoo-timeout-synthetic-"));
    try {
      let elapsed = 0, signal: AbortSignal | null | undefined;
      const transport = new CaptureTransport(allocation, root, "synthetic", "synthetic", async (_url, init) => {
        signal = init?.signal;
        return mode === "headers" ? new Promise<Response>(() => {}) : new Response(new ReadableStream({ type: "bytes", pull() {} }));
      }, () => now, () => elapsed);
      elapsed = LIMITS.totalMs - 10;
      const started = performance.now();
      await assert.rejects(transport.fetch(`https://fantasysports.yahooapis.com/fantasy/v2/league/${allocation.yahooLeagueKey}/settings?format=json`), /request_deadline/);
      assert.ok(performance.now() - started < 1000);
      assert.equal(signal?.aborted, true);
      assert.equal(transport.yahooRequests, 1);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test("dry validation never constructs a client or uses secret environment/network configuration", async () => {
  const f = fixture();
  try {
    const path = join(f.root, "allocation.json");
    const { writeFileSync } = await import("node:fs"); writeFileSync(path, JSON.stringify(allocation));
    const result = await cli(["--allocation", path]); assert.equal(result.mode, "plan_only"); assert.equal(result.networkRequests, 0);
    assert.equal(f.calls.length, 0);
    assert.throws(() => validateAllocation({ ...allocation, access_token: token }), /invalid_allocation/);
    await assert.rejects(cli(["--allocation", path, "--execute-approved-sha256", "wrong", "--approval-ref", "synthetic", "--out", f.output]), /exact_approval/);
  } finally { f.cleanup(); }
});
