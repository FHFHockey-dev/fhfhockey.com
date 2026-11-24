// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Pool } from "pg";
import { SqlConnection } from "./history.server";
import { beginH10Dispatch, finishH10Dispatch, H10_ROUTE, H10DispatchRequest, h10RunKey, signH10Dispatch, verifyH10Dispatch } from "./h10Dispatch.server";

const exec = promisify(execFile);
const bin = process.env.FORGE_V2_POSTGRES_BIN;
const migrations = ["20261029235656_forge_v2_immutable_history.sql", "20261123220000_forge_h10_hosted_dispatch.sql"].map(name => resolve(__dirname, "../../..", "supabase/migrations", name));
const SECRET = "h10-test-secret-0123456789abcdefghijklmnopqrstuvwxyz";

describe("h10 run key", () => {
  it("is the Eastern date of the latest 04:00 ET cutoff, in both EST and EDT", () => {
    expect(h10RunKey("nightly", Date.parse("2026-11-24T08:59:00Z"))).toBe("nightly:2026-11-23"); // 03:59 EST
    expect(h10RunKey("nightly", Date.parse("2026-11-24T09:00:00Z"))).toBe("nightly:2026-11-24"); // 04:00 EST
    expect(h10RunKey("material", Date.parse("2027-04-10T07:59:00Z"))).toBe("material:2027-04-09"); // 03:59 EDT
    expect(h10RunKey("material", Date.parse("2027-04-10T08:00:00Z"))).toBe("material:2027-04-10"); // 04:00 EDT
  });
});

/** Vault, pg_net and pgcrypto stand-ins with the production names and signatures: the secret row, a request log in
 * place of the HTTP queue, and the real HMAC. */
const STUBS = `
create schema extensions; create extension pgcrypto schema extensions;
create schema vault; create table vault.decrypted_secrets (name text, decrypted_secret text);
create schema net; create table net.requests (id bigserial primary key, url text, body jsonb, headers jsonb);
create function net.http_post(url text, body jsonb, headers jsonb, timeout_milliseconds integer) returns bigint
  language sql as $$ insert into net.requests (url, body, headers) values (url, body, headers) returning id $$;`;

describe.runIf(Boolean(bin))("h10 per-dispatch HMAC on disposable PostgreSQL", () => {
  let root: string, admin: Pool, service: Pool, started = false;
  const environment: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))), NODE_ENV: "test" };
  const tick = async (mode: string) => (await admin.query("select forge_v2_private.forge_h10_tick_v1($1) as s", [mode])).rows[0].s as string;
  /** The request pg_net would deliver, as the route sees it. */
  const delivered = async (): Promise<H10DispatchRequest & { rawHeaders: Record<string, string> }> => {
    const r = (await admin.query("select url, body, headers from net.requests order by id desc limit 1")).rows[0];
    return { method: "POST", path: new URL(r.url).pathname, query: {}, headers: { "x-forge-h10-signature": r.headers["X-Forge-H10-Signature"] }, body: r.body, rawHeaders: r.headers };
  };
  const state = async (id: string) => (await admin.query("select state, outcome from forge_v2_private.forge_h10_dispatches where dispatch_id = $1", [id])).rows[0];
  const db = () => service as unknown as SqlConnection;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "forge-h10-dispatch-"));
    const socket = join(root, "socket");
    await mkdir(socket, { mode: 0o700 });
    await exec(join(bin!, "initdb"), ["-D", join(root, "data"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "forge_v2_fixture"], { env: environment });
    await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-l", join(root, "server.log"), "-w", "-t", "10", "-o", `-c listen_addresses='' -c unix_socket_directories='${socket}' -p 65453`, "start"], { env: environment });
    started = true;
    admin = new Pool({ host: socket, port: 65453, user: "forge_v2_fixture", database: "postgres", max: 3 });
    await admin.query("create role anon; create role authenticated; create role service_role login");
    await admin.query(STUBS);
    for (const file of migrations) await admin.query(await readFile(file, "utf8"));
    service = new Pool({ host: socket, port: 65453, user: "service_role", database: "postgres", max: 4 });
  }, 30000);
  afterAll(async () => {
    await service?.end(); await admin?.end();
    if (started) await exec(join(bin!, "pg_ctl"), ["-D", join(root, "data"), "-w", "-t", "10", "stop", "-m", "fast"], { env: environment });
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("sends nothing without the Vault secret, and only the owner can tick", async () => {
    expect(await tick("nightly")).toBe("transport_unavailable");
    expect((await admin.query("select count(*)::int n from forge_v2_private.forge_h10_dispatches")).rows[0].n).toBe(0);
    await expect(service.query("select forge_v2_private.forge_h10_tick_v1('nightly')")).rejects.toThrow(/permission denied/);
    await admin.query("insert into vault.decrypted_secrets values ('forge_h10_dispatch_secret', $1)", [SECRET]);
  });

  it("a valid dispatch: the database's HMAC verifies, the secret never travels, and it starts exactly once", async () => {
    expect(await tick("nightly")).toBe("queued");
    const request = await delivered();
    expect(JSON.stringify(request.rawHeaders)).not.toContain(SECRET);
    expect(Object.keys(request.rawHeaders).sort()).toEqual(["Content-Type", "X-Forge-H10-Signature"]);
    expect(request.path).toBe(H10_ROUTE);
    const verified = verifyH10Dispatch(request, SECRET, Date.now());
    expect(verified).toMatchObject({ ok: true, dispatch: { mode: "nightly", runKey: h10RunKey("nightly", Date.now()) } });
    if (!verified.ok) throw new Error("unreachable");
    expect(await beginH10Dispatch(db(), verified.dispatch)).toEqual({ ok: true, dispatch: verified.dispatch });
    // While it runs, the next tick sends nothing: one dispatch in flight, so no second edition can start.
    expect(await tick("nightly")).toBe("in_flight");
    await finishH10Dispatch(db(), verified.dispatch.dispatchId, "complete");
    expect(await state(verified.dispatch.dispatchId)).toEqual({ state: "finished", outcome: "complete" });
    // A later retry of the same delivery reports the same run and does no work.
    expect(await beginH10Dispatch(db(), verified.dispatch)).toMatchObject({ ok: false, status: 200, body: { status: "duplicate", outcome: "complete", runKey: verified.dispatch.runKey } });
  });

  it("a concurrent duplicate delivery: one starts, the other is refused", async () => {
    expect(await tick("material")).toBe("queued");
    const verified = verifyH10Dispatch(await delivered(), SECRET, Date.now());
    if (!verified.ok) throw new Error("expected a valid dispatch");
    const results = await Promise.all([beginH10Dispatch(db(), verified.dispatch), beginH10Dispatch(db(), verified.dispatch), beginH10Dispatch(db(), verified.dispatch)]);
    expect(results.filter(r => r.ok)).toHaveLength(1);
    expect(results.filter(r => !r.ok).map(r => !r.ok && r.body.status)).toEqual(["duplicate", "duplicate"]);
    await finishH10Dispatch(db(), verified.dispatch.dispatchId, "no_change");
  });

  it("an expired signature is refused before any database call; an expired dispatch never starts", async () => {
    expect(await tick("nightly")).toBe("queued");
    const request = await delivered(), body = request.body as { expiresAt: number; dispatchId: string };
    expect(verifyH10Dispatch(request, SECRET, (body.expiresAt + 1) * 1000)).toEqual({ ok: false, status: 401, body: { status: "expired_signature" } });
    // A signature minted far ahead of time is refused too (at most 120 s of validity).
    const early = { ...(request.body as object), expiresAt: Math.floor(Date.now() / 1000) + 3600 } as never;
    expect(verifyH10Dispatch({ ...request, headers: { "x-forge-h10-signature": signH10Dispatch(SECRET, H10_ROUTE, early) }, body: early }, SECRET, Date.now()))
      .toMatchObject({ ok: false, status: 401, body: { status: "expired_signature" } });
    // In the database: the dispatch's own expiry has passed (moved back here), so begin refuses and closes it.
    await admin.query("update forge_v2_private.forge_h10_dispatches set expires_at = clock_timestamp() - interval '1 second' where dispatch_id = $1", [body.dispatchId]);
    const verified = verifyH10Dispatch(request, SECRET, Date.now());
    if (!verified.ok) throw new Error("signature still valid at the route");
    const moved = { ...verified.dispatch, expiresAt: Number((await admin.query("select extract(epoch from expires_at)::bigint e from forge_v2_private.forge_h10_dispatches where dispatch_id = $1", [body.dispatchId])).rows[0].e) };
    expect(await beginH10Dispatch(db(), moved)).toMatchObject({ ok: false, status: 401, body: { status: "expired" } });
    expect(await state(body.dispatchId)).toEqual({ state: "finished", outcome: "expired" });
  });

  it("an altered payload, the wrong route or another run is refused", async () => {
    expect(await tick("nightly")).toBe("queued");
    const request = await delivered(), body = request.body as Record<string, unknown>;
    for (const altered of [{ ...body, mode: "material" }, { ...body, runKey: "nightly:2026-01-01" }, { ...body, dispatchId: "00000000-0000-4000-8000-000000000000" },
      { ...body, expiresAt: (body.expiresAt as number) - 1 }]) {
      expect(verifyH10Dispatch({ ...request, body: altered }, SECRET, Date.now())).toEqual({ ok: false, status: 401, body: { status: "invalid_signature" } });
    }
    expect(verifyH10Dispatch({ ...request, body: { ...body, extra: 1 } }, SECRET, Date.now())).toMatchObject({ ok: false, status: 400 });
    expect(verifyH10Dispatch({ ...request, path: "/api/v1/db/forge-pregame-capture" }, SECRET, Date.now())).toEqual({ ok: false, status: 400, body: { status: "invalid_route" } });
    expect(verifyH10Dispatch({ ...request, query: { mode: "nightly" } }, SECRET, Date.now())).toMatchObject({ ok: false, status: 400 });
    // A signature for another route (the same secret reused elsewhere) does not verify here.
    expect(verifyH10Dispatch({ ...request, headers: { "x-forge-h10-signature": signH10Dispatch(SECRET, "/api/v1/db/forge-pregame-capture", body as never) } }, SECRET, Date.now()))
      .toMatchObject({ ok: false, status: 401, body: { status: "invalid_signature" } });
    expect(verifyH10Dispatch({ ...request, headers: {} }, SECRET, Date.now())).toMatchObject({ ok: false, status: 401 });
    expect(verifyH10Dispatch({ ...request, method: "GET" }, SECRET, Date.now())).toMatchObject({ ok: false, status: 405 });
    expect(verifyH10Dispatch(request, undefined, Date.now())).toMatchObject({ ok: false, status: 503 });
    // A correctly signed dispatch for another night is refused as the wrong run.
    const otherNight = { ...body, runKey: "nightly:2026-01-01" } as never;
    expect(verifyH10Dispatch({ ...request, headers: { "x-forge-h10-signature": signH10Dispatch(SECRET, H10_ROUTE, otherNight) }, body: otherNight }, SECRET, Date.now()))
      .toMatchObject({ ok: false, status: 409, body: { status: "run_mismatch" } });
    // Unknown or mismatched dispatches never start in the database either.
    const verified = verifyH10Dispatch(request, SECRET, Date.now());
    if (!verified.ok) throw new Error("expected a valid dispatch");
    expect(await beginH10Dispatch(db(), { ...verified.dispatch, dispatchId: "00000000-0000-4000-8000-000000000000" })).toMatchObject({ ok: false, body: { status: "not_found" } });
    expect(await beginH10Dispatch(db(), { ...verified.dispatch, mode: "material", runKey: verified.dispatch.runKey.replace("nightly", "material") })).toMatchObject({ ok: false, body: { status: "binding_mismatch" } });
    expect(await state(verified.dispatch.dispatchId)).toEqual({ state: "queued", outcome: null });
  });

  it("computes the same run key in SQL as the route", async () => {
    for (const at of ["2026-11-24T08:59:00Z", "2026-11-24T09:00:00Z", "2027-03-14T07:59:00Z", "2027-03-14T08:00:00Z", "2027-11-07T08:59:00Z", "2027-11-07T09:00:00Z"]) {
      expect((await admin.query("select forge_v2_private.forge_h10_run_key('nightly', $1) k", [at])).rows[0].k).toBe(h10RunKey("nightly", Date.parse(at)));
    }
  });
});
