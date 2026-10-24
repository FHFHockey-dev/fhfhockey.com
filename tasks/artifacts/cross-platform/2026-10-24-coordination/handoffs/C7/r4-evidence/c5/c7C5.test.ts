// @vitest-environment node
// C7 independent controls for C5 CRON-AUDIT-COVERAGE r2. Real withCronJobAudit + real adminOnly; DB/provider mocked.
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";

const OUT = process.env.C7_C5_OUT ?? "/dev/null";
const observed: Record<string, unknown> = {};
afterAll(() => { if (OUT !== "/dev/null") writeFileSync(OUT, JSON.stringify(observed, null, 2)); });
const m = vi.hoisted(() => ({ run: vi.fn(), limit: vi.fn(), auditInsert: vi.fn(), getUser: vi.fn(), role: vi.fn(), chain: {} as any }));
vi.mock("lib/integrations/yahoo/pollCoordinator", () => ({ runYahooDraftPollCoordinator: m.run }));
vi.mock("lib/supabase/server", () => ({ default: { from: (t: string) => t === "cron_job_audit" ? { insert: m.auditInsert } : { select: () => ({ in: () => ({ limit: m.limit }) }) } } }));
vi.mock("lib/supabase", () => ({ createClientWithToken: () => ({ auth: { getUser: m.getUser }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: m.role }) }) }) }) }));
import yahoo from "pages/api/internal/yahoo-live-draft";
import prospects from "pages/api/v1/db/update-drafted-prospects";

const res = () => { const r: any = { statusCode: 200, headersSent: false, setHeader: vi.fn(), end: vi.fn(() => { r.headersSent = true; }) };
  r.json = r.sent = vi.fn(() => { r.headersSent = true; return r; }); r.status = vi.fn((c: number) => { r.statusCode = c; return r; }); return r; };
// run1: `undefined` hit the default parameter and sent a valid bearer (reviewer error); null now means "no header".
const req = (authorization: string | null = "Bearer test-secret", method = "GET", url = "/api/internal/yahoo-live-draft") => ({ method, url, query: {}, headers: authorization ? { authorization, host: "example.com" } : { host: "example.com" }, socket: { remoteAddress: "10.0.0.5" } });
const rows = () => m.auditInsert.mock.calls.map(c => c[0]).flat();

beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers();
  vi.stubEnv("CRON_SECRET", "test-secret"); vi.stubEnv("YAHOO_LIVE_DRAFT_ENABLED", "true");
  vi.stubEnv("YAHOO_LIVE_DRAFT_SEASON", "2026"); vi.stubEnv("YAHOO_LIVE_DRAFT_TARGET_SEASON_ID", "20262027");
  m.auditInsert.mockResolvedValue({ error: null }); m.limit.mockResolvedValue({ data: [], error: null });
  m.run.mockResolvedValue({ attempted: 1, succeeded: 1, failed: 0 });
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("C5 yahoo-live-draft heartbeat", () => {
  it.each([["suspended", "2026-12-01", undefined], ["disabled", "2027-09-01", "false"]])("Y1 %s: a full simulated day of per-minute runs writes exactly one row, response unchanged", async (state, day, enabled) => {
    if (enabled) vi.stubEnv("YAHOO_LIVE_DRAFT_ENABLED", enabled);
    const bodies = new Set<string>();
    for (let minute = 0; minute < 1440; minute++) {
      vi.setSystemTime(new Date(Date.parse(`${day}T00:00:00Z`) + minute * 60_000 + 2_500));
      const r = res(); await yahoo(req() as any, r); bodies.add(JSON.stringify(r.sent.mock.calls[0][0]) + r.statusCode);
      expect(r.sent).toHaveBeenCalledTimes(1);
    }
    const written = rows();
    observed[`Y1 ${state}`] = { rows: written.length, statuses: written.map((x: any) => x.status), distinctResponses: [...bodies], at: written.map((x: any) => x.run_started_at ?? x.started_at ?? null) };
    expect(written).toHaveLength(1); expect(written[0].status).toBe("success"); expect(bodies.size).toBe(1);
    expect(m.run).not.toHaveBeenCalled(); expect(m.limit).not.toHaveBeenCalled();
  });
  it("Y2 two invocations inside the same 12:00 minute write two rows (documented weak signal)", async () => {
    vi.stubEnv("YAHOO_LIVE_DRAFT_ENABLED", "false");
    for (const s of ["2027-09-01T12:00:01Z", "2027-09-01T12:00:59Z"]) { vi.setSystemTime(new Date(s)); await yahoo(req() as any, res()); }
    observed.Y2 = { rows: rows().length }; expect(rows()).toHaveLength(2);
  });
  it.each([["wrong bearer", "Bearer nope", "GET"], ["no header", null, "GET"], ["POST", "Bearer test-secret", "POST"]])("Y3 %s at 12:00 writes no row", async (_n, auth, method) => {
    vi.stubEnv("YAHOO_LIVE_DRAFT_ENABLED", "false"); vi.setSystemTime(new Date("2027-09-01T12:00:10Z"));
    const r = res(); await yahoo(req(auth, method) as any, r);
    expect(rows()).toHaveLength(0); expect([401, 405]).toContain(r.statusCode);
  });
  it("Y3b missing CRON_SECRET at 12:00 writes no row", async () => {
    vi.stubEnv("CRON_SECRET", ""); vi.stubEnv("YAHOO_LIVE_DRAFT_ENABLED", "false"); vi.setSystemTime(new Date("2027-09-01T12:00:10Z"));
    const r = res(); await yahoo(req() as any, r); expect(r.statusCode).toBe(503); expect(rows()).toHaveLength(0);
  });
  it.each([["11:00", "2027-10-01T11:00:00Z"], ["12:00", "2027-10-01T12:00:00Z"]])("Y4 active run with failed polls at %s → exactly one failure row, no heartbeat", async (_n, at) => {
    vi.setSystemTime(new Date(at)); m.limit.mockResolvedValue({ data: [{ id: "s" }], error: null });
    m.run.mockResolvedValue({ attempted: 4, succeeded: 3, failed: 1 });
    const r = res(); const p = yahoo(req() as any, r); await vi.advanceTimersByTimeAsync(66_000); await p;
    observed[`Y4 ${_n}`] = { status: r.statusCode, rows: rows().map((x: any) => x.status) };
    expect(r.statusCode).toBe(503); expect(rows()).toHaveLength(1); expect(rows()[0].status).toBe("failure");
  });
  it("Y5 coordinator throws → one failure row, generic body", async () => {
    vi.setSystemTime(new Date("2027-10-01T09:00:00Z")); m.limit.mockResolvedValue({ data: [{ id: "s" }], error: null }); m.run.mockRejectedValue(new Error("provider secret detail"));
    const r = res(); await yahoo(req() as any, r);
    observed.Y5 = { status: r.statusCode, body: r.sent.mock.calls[0][0], rows: rows().map((x: any) => x.status), leaks: JSON.stringify(rows()).includes("provider secret") };
    expect(rows()).toHaveLength(1); expect(rows()[0].status).toBe("failure"); expect(JSON.stringify(rows())).not.toContain("provider secret");
  });
  it("Y6 heartbeat insert rejects → response flushed once, no retry insert", async () => {
    vi.stubEnv("YAHOO_LIVE_DRAFT_ENABLED", "false"); vi.setSystemTime(new Date("2027-09-01T12:00:05Z")); m.auditInsert.mockRejectedValue(new Error("db down"));
    const r = res(); await yahoo(req() as any, r);
    expect(r.sent).toHaveBeenCalledTimes(1); expect(m.auditInsert).toHaveBeenCalledTimes(1);
  });
});

describe("C5 update-drafted-prospects with the real adminOnly", () => {
  it.each([["no header", null, 401], ["non-bearer", "Basic x", 401], ["bad token", "Bearer user-token", 401], ["non-admin", "Bearer user-token", 403]])("P1 %s is denied before the audit wrapper (no row)", async (name, auth, code) => {
    if (name === "bad token") m.getUser.mockResolvedValue({ data: { user: null }, error: new Error("bad") });
    else { m.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null }); m.role.mockResolvedValue({ data: { role: "user" } }); }
    const r = res(); await prospects(req(auth, "GET", "/api/v1/db/update-drafted-prospects") as any, r);
    (observed.P1 ??= {} as any)[name] = { status: r.statusCode, rows: rows().length };
    expect(r.statusCode).toBe(code); expect(rows()).toHaveLength(0);
  });
  it("P2 admitted cron call rejected inside the route (405) → exactly one failure row", async () => {
    const r = res(); await prospects(req("Bearer test-secret", "PUT", "/api/v1/db/update-drafted-prospects") as any, r);
    observed.P2 = { status: r.statusCode, rows: rows().map((x: any) => x.status) };
    expect(r.statusCode).toBe(405); expect(rows()).toHaveLength(1); expect(rows()[0].status).toBe("failure");
  });
});
