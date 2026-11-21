// @vitest-environment node
import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, expect, it, vi } from "vitest";
import route from "pages/api/v1/db/forge-replay-run";

const sha = "0123456789abcdef0123456789abcdef01234567";
const cron = "local-cron-secret-for-route-tests";
const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = (claims: object) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64(claims)}.c2lnbmF0dXJl`;
const hours = (n: number) => Math.floor(Date.now() / 1000) + n * 3600;
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function stub(overrides: Record<string, string | undefined> = {}) {
  for (const [name, value] of Object.entries({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: sha, CRON_SECRET: cron,
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.invalid", NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: "anon-key",
    FORGE_SANDBOX_API_TOKEN: token({ role: "forge_sandbox_api", exp: hours(11) }), ...overrides })) vi.stubEnv(name, value);
}

async function call(req: Partial<NextApiRequest>) {
  let code = 0, body: any;
  const headers: Record<string, string> = {};
  const res = { setHeader: (k: string, v: string) => { headers[k] = v; }, status(value: number) { code = value; return this; },
    json(value: unknown) { body = value; return this; }, end() { return this; } };
  await route({ method: "GET", query: {}, headers: { authorization: `Bearer ${cron}` }, ...req } as unknown as NextApiRequest,
    res as unknown as NextApiResponse);
  return { code, body, headers };
}

it.each([
  [{ method: "POST" }, {}, 405, "method_not_allowed"],
  [{ query: { gameId: "2099020991" } }, {}, 400, "unexpected_parameters"],
  [{ headers: {} }, {}, 401, "unauthorized"],
  [{ headers: { authorization: `Bearer ${cron}x` } }, {}, 401, "unauthorized"],
  [{}, { CRON_SECRET: "" }, 401, "unauthorized"],
  [{}, { VERCEL_ENV: "preview" }, 503, "release_unpinned"],
  [{}, { VERCEL_GIT_COMMIT_SHA: undefined }, 503, "release_unpinned"],
  [{}, { FORGE_SANDBOX_API_TOKEN: undefined }, 503, "replay_disabled"],
  [{}, { FORGE_SANDBOX_API_TOKEN: token({ role: "service_role", exp: hours(23) }) }, 503, "replay_disabled"],
  [{}, { FORGE_SANDBOX_API_TOKEN: token({ role: "authenticated", exp: hours(23) }) }, 503, "replay_disabled"],
  [{}, { FORGE_SANDBOX_API_TOKEN: token({ role: "forge_sandbox_api", exp: hours(-1) }) }, 503, "replay_disabled"],
  [{}, { FORGE_SANDBOX_API_TOKEN: token({ role: "forge_sandbox_api", exp: hours(13) }) }, 503, "replay_disabled"],
  [{}, { FORGE_SANDBOX_API_TOKEN: token({ role: "forge_sandbox_api" }) }, 503, "replay_disabled"],
  [{}, { FORGE_SANDBOX_API_TOKEN: "not-a-jwt" }, 503, "replay_disabled"],
  [{}, { NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: undefined }, 503, "replay_disabled"],
])("refuses %j %j before any request, without caching", async (req, env, code, status) => {
  stub(env);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const result = await call(req);
  expect(result).toMatchObject({ code, body: { status } });
  expect(result.headers["Cache-Control"]).toBe("no-store, max-age=0");
  expect(fetch).not.toHaveBeenCalled();
});

it("talks only to the sandbox API schema with the sandbox token, and fails closed when it cannot begin", async () => {
  stub();
  const fetch = vi.fn(async () => new Response(JSON.stringify({ message: "unavailable" }), { status: 503 }));
  vi.stubGlobal("fetch", fetch);
  expect(await call({})).toMatchObject({ code: 503, body: { status: "begin_unconfirmed", sha } });
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(String(url)).toBe("https://project.supabase.invalid/rest/v1/rpc/forge_replay_step_begin_v1");
  const headers = new Headers(init.headers);
  expect(headers.get("content-profile")).toBe("forge_sandbox_api");
  expect(headers.get("authorization")).toBe(`Bearer ${process.env.FORGE_SANDBOX_API_TOKEN}`);
  expect(headers.get("apikey")).toBe("anon-key");
  expect(JSON.parse(String(init.body))).toEqual({ p_code_version: sha });
});

it.each([
  ["wait", 202], ["busy", 202], ["halted", 202], ["expired", 202], ["complete", 409],
])("writes nothing when the ledger says %s (one begin call, status %i)", async (due, code) => {
  stub();
  const fetch = vi.fn(async () => new Response(JSON.stringify({ status: due, due: { due } }), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  expect(await call({})).toMatchObject({ code, body: { status: due, sha } });
  expect(fetch).toHaveBeenCalledTimes(1);
});

// Sealed replay (TJ 2026-11-20): the envelope reaches the route only from the sandbox ledger, hash-checked; anything
// else stops before a claim, and the step's report is labelled replay only.
import { createHash } from "node:crypto";
import { SEALED_LABEL, sealedClaim, sealedCollector, verifySealedEnvelope } from "pages/api/v1/db/forge-replay-run";

const hex = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const cutoff = "2026-11-20T15:27:03.210100Z";
const envelopeText = JSON.stringify({ gameId: 2026020359, inputCutoff: "2026-11-20T15:27:03.210100+00:00",
  pinned: { gameId: 2026020359 }, reads: [{ request: [{ method: "from", args: ["games"] }], result: { data: [] }, receivedAt: cutoff }],
  transport: { refusals: [] } });
const sealed = (overrides: Record<string, unknown> = {}) => ({ mode: "sealed", fixtureLabel: SEALED_LABEL, gameId: 2026020359,
  playerNhlId: 8478402, inputCutoff: cutoff, envelope: envelopeText, envelopeSha256: hex(envelopeText),
  readerInputs: "{}", readerInputsSha256: hex("{}"), ...overrides });
const due = { gameId: 2026020359, playerNhlId: 8478402 };

it("verifies the sealed envelope and the reader inputs by their recorded hashes and binding", () => {
  expect(verifySealedEnvelope({ mode: "synthetic_control" }, due)).toEqual({ ok: true, envelope: null, hashes: null });
  expect(verifySealedEnvelope(sealed(), due)).toMatchObject({ ok: true, envelope: { gameId: 2026020359 },
    hashes: { envelopeSha256: hex(envelopeText), readerInputsSha256: hex("{}") } });
  expect(verifySealedEnvelope(sealed({ envelope: envelopeText + " " }), due)).toEqual({ ok: false, reason: "sealed_hash_mismatch" });
  expect(verifySealedEnvelope(sealed({ readerInputs: "[]" }), due)).toEqual({ ok: false, reason: "sealed_hash_mismatch" });
  expect(verifySealedEnvelope(sealed({ fixtureLabel: "reconstructed" }), due)).toEqual({ ok: false, reason: "sealed_envelope_unavailable" });
  expect(verifySealedEnvelope(sealed({ playerNhlId: 8484144 }), due)).toEqual({ ok: false, reason: "sealed_envelope_mismatch" });
  expect(verifySealedEnvelope(sealed({ inputCutoff: "2026-11-20T15:27:03.210101Z" }), due)).toEqual({ ok: false, reason: "sealed_envelope_mismatch" });
  expect(verifySealedEnvelope(null, due)).toEqual({ ok: false, reason: "sealed_envelope_unavailable" });
});

it("sealed collect: the recorded cutoff only, and a read the envelope did not record stops it (no live fallback)", async () => {
  const { envelope } = verifySealedEnvelope(sealed(), due) as { envelope: any };
  const collectNative = vi.fn(async () => ({ candidates: [], issuedContextAfter: { schedule: [] } }));
  const deps = sealedCollector(envelope, { collectNative: collectNative as never, seasonBootstrap: () => false });
  expect(await deps.pin(2026020359, "2026-11-21", 0)).toEqual({ gameId: 2026020359 });
  const binding = { gameId: 2026020359, slateDate: "2026-11-21", inputCutoff: cutoff } as never;
  await expect(deps.collect({ ...(binding as object), inputCutoff: "2026-11-20T19:00:00Z" } as never, 0)).rejects.toThrow("sealed_cutoff_mismatch");
  expect(collectNative).not.toHaveBeenCalled();
  // The collector consumed none of the recorded reads: the replay refuses (every sealed read must be used).
  await expect(deps.collect(binding, 0)).rejects.toThrow(/did not consume every captured input/);
});

// A route stub: begin answers pass_capture (sealed when `mode` is given); the sealed RPC answers `sealedAnswer`.
async function sealedStep(mode: string | undefined, sealedAnswer: () => Response) {
  stub();
  const calls: Array<{ url: string; profile: string | null; auth: string | null }> = [];
  const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    calls.push({ url: String(url), profile: headers.get("content-profile") ?? headers.get("accept-profile"), auth: headers.get("authorization") });
    if (String(url).endsWith("/forge_replay_step_begin_v1")) return json({ status: "due", step: "pass_capture", gameId: 2026020359,
      playerNhlId: 8478402, slateDate: "2026-11-21", scheduledStart: "2026-11-21T18:00:00+00:00", seasonId: 20262027, ...(mode ? { mode } : {}) });
    if (String(url).endsWith("/forge_replay_sealed_v1")) return sealedAnswer();
    if (String(url).endsWith("/forge_replay_step_finish_v1")) return json({ steps: [{ step: "pass_capture", outcome: "failed" }] });
    return new Response(JSON.stringify({ message: "unavailable in this test" }), { status: 500, headers: { "content-type": "application/json" } });
  }));
  return { result: await call({}), calls, names: () => calls.map(c => c.url.split("/").at(-1)) };
}
const okJson = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });

it.each([
  ["a hash mismatch", () => okJson(sealed({ envelope: envelopeText + " " })), "sealed_hash_mismatch"],
  ["a missing sealed function (stale schema cache)", () => new Response(JSON.stringify({ code: "PGRST202", message: "not found" }),
    { status: 404, headers: { "content-type": "application/json" } }), "sealed_envelope_unavailable"],
  ["a synthetic answer on a sealed ledger", () => okJson({ mode: "synthetic_control" }), "sealed_envelope_unavailable"],
])("a sealed ledger with %s stops before any claim (no live fallback), labelled replay only, on the sandbox API only", async (_, answer, reason) => {
  const { result, calls, names } = await sealedStep("sealed", answer);
  expect(result.code).toBe(503);
  expect(result.body.report).toMatchObject({ outcome: "not_started", reason, mode: "sealed_replay", replayOnly: true, fixtureLabel: SEALED_LABEL });
  expect(names()).toEqual(["forge_replay_step_begin_v1", "forge_replay_sealed_v1", "forge_replay_step_finish_v1"]);
  for (const c of calls) {
    expect(c.url.startsWith("https://project.supabase.invalid/rest/v1/rpc/")).toBe(true);
    expect(c.profile).toBe("forge_sandbox_api");
    expect(c.auth).toBe(`Bearer ${process.env.FORGE_SANDBOX_API_TOKEN}`);
  }
});

it("the synthetic control's ledger (no mode) never asks for a sealed envelope", async () => {
  const { names, result } = await sealedStep(undefined, () => okJson(sealed()));
  expect(names()).not.toContain("forge_replay_sealed_v1");
  expect(result.body.report?.replayOnly).toBeUndefined();
});

it("sealed claim: the claim's stand-in cutoff must be the envelope's instant, and the binding carries the envelope's text", async () => {
  const { envelope } = verifySealedEnvelope(sealed(), due) as { envelope: any };
  const row = (inputCutoff: string, outcome = "claimed") => ({ outcome, claimId: "c", ackDeadline: "x", dbNow: inputCutoff, inputCutoff });
  const writer = (r: any) => ({ claim: vi.fn(async () => r), lookup: vi.fn() });
  expect(await sealedClaim(writer(row("2026-11-20T15:27:03.2101+00:00")) as any, envelope).claim({} as never))
    .toMatchObject({ outcome: "claimed", inputCutoff: "2026-11-20T15:27:03.210100+00:00" });
  await expect(sealedClaim(writer(row("2026-11-20T19:00:00+00:00")) as any, envelope).claim({} as never)).rejects.toThrow("sealed_cutoff_mismatch");
  expect(await sealedClaim(writer(row("x", "duplicate")) as any, envelope).claim({} as never)).toMatchObject({ outcome: "duplicate" });
});
