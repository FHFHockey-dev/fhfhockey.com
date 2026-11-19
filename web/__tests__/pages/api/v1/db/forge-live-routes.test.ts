// @vitest-environment node
import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, expect, it, vi } from "vitest";
import capture from "pages/api/v1/db/forge-live-capture";
import publish from "pages/api/v1/db/forge-live-publish";
import * as server from "lib/supabase/server";
import * as scope from "lib/projections/forgeEnvScope";
import * as hosted from "lib/projections/pregameCapture/hostedGame";
import * as publication from "lib/projections/pregameCapture/publication";

const sha = "0123456789abcdef0123456789abcdef01234567";
const cron = "local-cron-secret-for-live-route-tests";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

function stub(overrides: Record<string, string | undefined> = {}) {
  for (const [name, value] of Object.entries({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: sha, CRON_SECRET: cron, ...overrides })) {
    vi.stubEnv(name, value);
  }
}

async function call(route: typeof capture, req: Partial<NextApiRequest>) {
  let code = 0, body: any;
  const headers: Record<string, string> = {};
  const res = { setHeader: (k: string, v: string) => { headers[k] = v; }, status(value: number) { code = value; return this; },
    json(value: unknown) { body = value; return this; }, end() { return this; } };
  await route({ method: "GET", query: {}, headers: { authorization: `Bearer ${cron}` }, ...req } as unknown as NextApiRequest,
    res as unknown as NextApiResponse);
  return { code, body, headers };
}

for (const [name, route] of [["capture", capture], ["publish", publish]] as const) {
  it.each([
    [{ method: "POST" }, {}, 405, "method_not_allowed"],
    [{ query: { game: "2026020358" } }, {}, 400, "unexpected_parameters"],
    [{ headers: {} }, {}, 401, "unauthorized"],
    [{ headers: { authorization: `Bearer ${cron}x` } }, {}, 401, "unauthorized"],
    [{}, { VERCEL_ENV: "preview" }, 503, "release_unpinned"],
    [{}, { VERCEL_GIT_COMMIT_SHA: undefined }, 503, "release_unpinned"],
  ])(`${name}: refuses %j %j before any database call, without caching`, async (req, env, code, status) => {
    stub(env);
    const rpc = vi.fn();
    vi.spyOn(server, "getServiceRoleClient").mockReturnValue({ rpc } as unknown as ReturnType<typeof server.getServiceRoleClient>);
    const result = await call(route, req);
    expect(result).toMatchObject({ code, body: { status } });
    expect(result.headers["Cache-Control"]).toBe("no-store, max-age=0");
    expect(rpc).not.toHaveBeenCalled();
  });
}

it.each([
  [capture, "forge_live_capture_begin_v1", ["none_armed", "release_mismatch", "stopped", "capture_window_closed", "schedule_changed"]],
  [publish, "forge_live_publish_begin_v1", ["none_ready", "release_mismatch", "stopped", "awaiting_verdict", "witness_rejected",
    "independent_deadline_missed", "publish_window_closed"]],
] as const)("refusals from the database start nothing and never enter the game scope (%#)", async (route, rpcName, statuses) => {
  stub();
  const enter = vi.spyOn(scope, "withForgeEnv");
  const run = vi.spyOn(hosted, "runHostedPregameGame");
  const pub = vi.spyOn(publication, "publishQualifiedPregameCapture");
  for (const status of statuses) {
    const rpc = vi.fn(() => ({ abortSignal: async () => ({ error: null, data: { status } }) }));
    vi.spyOn(server, "getServiceRoleClient").mockReturnValue({ rpc } as unknown as ReturnType<typeof server.getServiceRoleClient>);
    expect(await call(route, {})).toMatchObject({ code: 409, body: { status, sha } });
    expect(rpc.mock.calls).toEqual([[rpcName, { p_code_version: sha }]]);
  }
  expect(enter).not.toHaveBeenCalled();
  expect(run).not.toHaveBeenCalled();
  expect(pub).not.toHaveBeenCalled();
});
