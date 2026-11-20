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

it("publish: without a signed verdict that verifies against the pinned keys, it never publishes, never reads, never enters the scope, and finishes failed", async () => {
  stub();
  const enter = vi.spyOn(scope, "withForgeEnv");
  const pub = vi.spyOn(publication, "publishQualifiedPregameCapture");
  const claimId = "c1aa0000-0000-4000-8000-000000000001";
  const calls: [string, Record<string, unknown>][] = [];
  const answer = (data: unknown) => ({ abortSignal() { return this; }, then: (resolve: (v: unknown) => void) => resolve({ error: null, data }) });
  const rpc = vi.fn((name: string, args: Record<string, unknown>) => {
    calls.push([name, args]);
    return answer(name === "forge_live_publish_begin_v1"
      ? { status: "started", gameId: 2026020358, claimId, slateDate: "2026-11-19", scheduledStart: "2026-11-20T03:00:00Z", seasonId: 20262027, playerNhlId: 8478402 }
      : name === "forge_live_claim_hashes_v1"
        ? { claimId, gameId: 2026020358, scheduledStart: "2026-11-20T03:00:00Z", raw: "a".repeat(64), canonical: "b".repeat(64), tsaTokenSha256: "c".repeat(64) }
        : { outcome: "failed", reason: args.p_reason });
  });
  // A row that looks right but is signed by nobody pinned in this release (the shipped keys file is empty).
  const witnessRpc = vi.fn((name: string, args: Record<string, unknown>) => { calls.push([`forge_witness_api.${name}`, args]);
    return answer({ payload: "{}", signature: "A".repeat(86) + "==" }); });
  vi.spyOn(server, "getServiceRoleClient").mockReturnValue({ rpc, schema: () => ({ rpc: witnessRpc }) } as unknown as ReturnType<typeof server.getServiceRoleClient>);
  const result = await call(publish, {});
  expect(result).toMatchObject({ code: 503, body: { status: "failed", reason: "signed_verdict:payload_invalid", revisionId: null, readers: null } });
  expect(calls.map(([name]) => name).sort()).toEqual(["forge_live_claim_hashes_v1", "forge_live_publish_begin_v1", "forge_live_publish_finish_v1",
    "forge_witness_api.signed_verdict_v1"]);
  expect(calls.find(([name]) => name === "forge_live_publish_finish_v1")![1]).toMatchObject({ p_revision_id: null, p_readers: null, p_reason: "signed_verdict:payload_invalid" });
  expect(enter).not.toHaveBeenCalled();
  expect(pub).not.toHaveBeenCalled();
});
