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
