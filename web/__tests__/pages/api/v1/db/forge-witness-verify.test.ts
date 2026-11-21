// @vitest-environment node
import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, expect, it, vi } from "vitest";
import route from "pages/api/v1/db/forge-witness-verify";

const sha = "0123456789abcdef0123456789abcdef01234567";
const cron = "local-cron-secret-for-route-tests";
const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = (claims: object) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64(claims)}.c2lnbmF0dXJl`;
const hours = (n: number) => Math.floor(Date.now() / 1000) + n * 3600;
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function stub(overrides: Record<string, string | undefined> = {}) {
  for (const [name, value] of Object.entries({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: sha, CRON_SECRET: cron,
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.invalid", NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: "anon-key",
    ...overrides })) vi.stubEnv(name, value);
}
const witness = token({ role: "forge_witness_api", exp: hours(11) });
const both = (credential: string | null = witness) => ({ authorization: `Bearer ${cron}`, ...(credential === null ? {} : { "x-forge-witness-token": credential }) });

async function call(req: Partial<NextApiRequest>) {
  let code = 0, body: any;
  const headers: Record<string, string> = {};
  const res = { setHeader: (k: string, v: string) => { headers[k] = v; }, status(value: number) { code = value; return this; },
    json(value: unknown) { body = value; return this; }, end() { return this; } };
  await route({ method: "GET", query: {}, headers: both(), ...req } as unknown as NextApiRequest,
    res as unknown as NextApiResponse);
  return { code, body, headers };
}

it.each([
  [{ method: "POST" }, {}, 405, "method_not_allowed"],
  [{ query: { gameId: "2099020991" } }, {}, 400, "unexpected_parameters"],
  [{ headers: { "x-forge-witness-token": witness } }, {}, 401, "unauthorized"],
  [{ headers: { ...both(), authorization: `Bearer ${cron}x` } }, {}, 401, "unauthorized"],
  [{}, { CRON_SECRET: "" }, 401, "unauthorized"],
  [{}, { VERCEL_ENV: "preview" }, 503, "release_unpinned"],
  [{}, { VERCEL_GIT_COMMIT_SHA: undefined }, 503, "release_unpinned"],
  // The cron secret alone is never enough, even if a witness token sits in the deployment's env (the writer's reach).
  [{ headers: both(null) }, {}, 401, "witness_credential_required"],
  [{ headers: both(null) }, { FORGE_WITNESS_API_TOKEN: witness }, 401, "witness_credential_required"],
  [{ headers: both(token({ role: "service_role", exp: hours(11) })) }, {}, 401, "witness_credential_required"],
  [{ headers: both(token({ role: "forge_sandbox_api", exp: hours(11) })) }, {}, 401, "witness_credential_required"],
  [{ headers: both(token({ role: "forge_witness_api", exp: hours(-1) })) }, {}, 401, "witness_credential_required"],
  [{ headers: both(token({ role: "forge_witness_api", exp: hours(13) })) }, {}, 401, "witness_credential_required"],
  [{ headers: both(token({ role: "forge_witness_api" })) }, {}, 401, "witness_credential_required"],
  [{ headers: both("not-a-jwt") }, {}, 401, "witness_credential_required"],
  [{ headers: { ...both(), "x-forge-witness-token": [witness, witness] } }, {}, 401, "witness_credential_required"],
  [{}, { NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: undefined }, 401, "witness_credential_required"],
])("refuses %j %j before any request, without caching", async (req, env, code, status) => {
  stub(env);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const result = await call(req);
  expect(result).toMatchObject({ code, body: { status } });
  expect(result.headers["Cache-Control"]).toBe("no-store, max-age=0");
  expect(fetch).not.toHaveBeenCalled();
});

it("talks only to the witness API schema with the header token, never echoes it, and fails closed when pending is unreadable", async () => {
  stub();
  const fetch = vi.fn(async () => new Response(JSON.stringify({ message: "unavailable" }), { status: 503 }));
  vi.stubGlobal("fetch", fetch);
  const result = await call({});
  expect(result).toMatchObject({ code: 503, body: { status: "pending_unconfirmed", sha } });
  expect(JSON.stringify(result.body)).not.toContain(witness.split(".")[1]);
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(String(url)).toBe("https://project.supabase.invalid/rest/v1/rpc/pending_v1");
  const headers = new Headers(init.headers);
  expect(headers.get("content-profile")).toBe("forge_witness_api");
  expect(headers.get("authorization")).toBe(`Bearer ${witness}`);
  expect(headers.get("apikey")).toBe("anon-key");
});

it("is idle with nothing armed, and leaves a claim that is not yet terminal undecided", async () => {
  stub();
  const replies = [[], [2099020991], { status: "not_terminal", gameId: 2099020991, claimId: "c1" }];
  const fetch = vi.fn(async (_url: unknown, _init?: unknown) => new Response(JSON.stringify(replies.shift()), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  expect(await call({})).toMatchObject({ code: 200, body: { status: "idle", results: [] } });
  expect(await call({})).toMatchObject({ code: 200, body: { status: "ok", results: [{ gameId: 2099020991, status: "not_terminal" }] } });
  expect(fetch.mock.calls.map(([url]) => String(url).split("/rpc/")[1])).toEqual(["pending_v1", "pending_v1", "evidence_v1"]);
});
