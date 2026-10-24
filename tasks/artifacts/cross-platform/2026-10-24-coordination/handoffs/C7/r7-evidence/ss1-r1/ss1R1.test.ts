// @vitest-environment node
// C7 controls for SS1-3 (SS1-O1..O4): cache policy, read ordering, season bounds, explicit limit, no leak.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
const OUT = process.env.C7_SS1R1_OUT; const observed: Record<string, unknown> = {};
afterAll(() => { if (OUT) writeFileSync(OUT, JSON.stringify(observed, null, 2)); });
const m = vi.hoisted(() => ({ schedule: vi.fn(), rates: vi.fn(), pg: { calls: [] as any[], count: 32, rows: 32, select: "", abbr: [] as string[] } }));
vi.mock("lib/NHL/server", () => ({ getSchedule: m.schedule }));
vi.mock("lib/supabase/public-client", () => ({ default: { from: () => { const q: any = {
  select(cols: string) { m.pg.select = cols; return q; }, eq() { return q; }, order() { return q; },
  range(from: number, to: number) { m.pg.calls.push([from, to]); const n = Math.max(0, Math.min(m.pg.rows - from, to - from + 1));
    return Promise.resolve({ error: null, count: m.pg.count, data: Array.from({ length: n }, (_, i) => ({ team_abbreviation: m.pg.abbr[from + i] ?? `T${from + i}`, gp: 10, xgf: 25, xga: 24, season: 20262027, situation: "all", updated_at: "2026-10-26T08:00:00Z", team_name: "LEAK", secret: "SECRET" })) }); } }; return q; } } }));
import { loadScheduleShareSnapshot, shareCacheControl } from "lib/socialShare/server";
import { loadShareTeamRates, TEAM_RATE_ROW_LIMIT } from "lib/socialShare/teamRates";
import { fictionalLeagueWeek, fictionalTeamStats } from "lib/socialShare/fixtures";
import handler from "pages/api/v1/social-share/[format]";

const WEEK = "2026-10-26", NOW = "2026-10-26T12:00:00Z";
const res = () => { const r: any = { headers: {} as any, code: 200, body: null, setHeader: (k: string, v: string) => { r.headers[k] = v; } }; r.status = (c: number) => { r.code = c; return r; }; r.json = (b: any) => { r.body = b; return r; }; return r; };
const parse = (cc: string) => Object.fromEntries(cc.split(",").map(s => s.trim().split("=")).map(([k, v]) => [k, v === undefined ? true : Number(v)]));
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date(NOW)); m.pg.calls = []; m.pg.count = 32; m.pg.rows = 32; m.pg.abbr = Object.keys(fictionalTeamStats(20262027, NOW)); // run1: T0..T31 matched no team (reviewer error)
  m.schedule.mockResolvedValue(fictionalLeagueWeek(WEEK, NOW)); });

describe("SS1-O1 cache policy", () => {
  it("O1a ready edition: public, max-age=0, bounded s-maxage/swr; s-maxage+swr never reaches expiresAt−600 s", async () => {
    const snap = await loadScheduleShareSnapshot("game-grid", WEEK);
    const now = Date.now(); const cc = shareCacheControl(snap, now);
    const viol: any[] = [];
    for (let left = 0; left <= 8 * 3600; left += 17) {
      const s = { ...snap, expiresAt: new Date(now + left * 1000).toISOString() } as any;
      for (const opp of ["ready", "missing", "partial", "stale"]) {
        s.opponents = { ...snap.opponents, state: opp }; const v = shareCacheControl(s, now);
        if (v === "no-store") { if (left - 600 >= 60) viol.push({ left, opp, v, why: "unexpected no-store" }); continue; }
        const p = parse(v); if (!p.public || p["max-age"] !== 0) viol.push({ left, opp, v });
        if ((p["s-maxage"] ?? 0) + (p["stale-while-revalidate"] ?? 0) > left - 600) viol.push({ left, opp, v, why: "outlives expiry margin" });
        if (opp !== "ready" && (p["s-maxage"] > 60 || p["stale-while-revalidate"])) viol.push({ left, opp, v, why: "unready opponents cached long" });
        if (p["s-maxage"] > 300 || (p["stale-while-revalidate"] ?? 0) > 300) viol.push({ left, opp, v, why: "over ceiling" });
      }
    }
    observed.O1a = { real: { state: snap.state, opponents: snap.opponents?.state, expiresAt: snap.expiresAt, cc }, violations: viol.slice(0, 5), violationCount: viol.length };
    expect(viol).toEqual([]);
  });
  it.each(["partial", "stale", "blocked"])("O1b %s edition → no-store", async kind => {
    const snap: any = await loadScheduleShareSnapshot("game-grid", WEEK);
    if (kind === "partial") snap.state = "partial"; if (kind === "stale") snap.source = { ...snap.source, state: "stale" };
    const b = kind === "blocked" ? await loadScheduleShareSnapshot("tuesday-trends" as any, WEEK) : snap;
    expect(shareCacheControl(b)).toBe("no-store");
  });
  it("O1c API: 200 ready gets public s-maxage; 400/503/405 stay no-store", async () => {
    const ok = res(); await handler({ method: "GET", query: { format: "game-grid", weekStart: WEEK } } as any, ok);
    const bad = res(); await handler({ method: "GET", query: { format: "game-grid", weekStart: "2099-01-05" } } as any, bad);
    m.schedule.mockRejectedValueOnce(new Error("down")); const down = res(); await handler({ method: "GET", query: { format: "game-grid", weekStart: WEEK } } as any, down);
    const post = res(); await handler({ method: "POST", query: { format: "game-grid" } } as any, post);
    observed.O1c = { ok: [ok.code, ok.headers["Cache-Control"]], bad: [bad.code, bad.headers["Cache-Control"], bad.body], down: [down.code, down.headers["Cache-Control"]], post: [post.code, post.headers["Cache-Control"]] };
    expect(ok.headers["Cache-Control"]).toMatch(/^public, max-age=0, s-maxage=\d+/);
    for (const r of [bad, down, post]) expect(r.headers["Cache-Control"]).toBe("no-store");
  });
});

describe("SS1-O2/O3/O4 and leaks", () => {
  it("O2 schedule failure → 0 stats reads; success → exactly 1 range read after the schedule", async () => {
    m.schedule.mockRejectedValueOnce(new Error("down"));
    await loadScheduleShareSnapshot("game-grid", WEEK).catch(() => undefined);
    const afterFail = m.pg.calls.length;
    await loadScheduleShareSnapshot("game-grid", WEEK);
    observed.O2 = { readsAfterFailure: afterFail, readsAfterSuccess: m.pg.calls.length };
    expect(afterFail).toBe(0); expect(m.pg.calls).toEqual([[0, 63]]);
  });
  it.each([["2025-08-04", true], ["2028-07-31", true], ["2025-07-28", false], ["2028-08-07", false], ["2099-01-05", false], ["1990-01-01", false]])("O3 weekStart %s accepted=%s (request date 2026-10-26)", async (week, ok) => {
    const r = res(); await handler({ method: "GET", query: { format: "remaining-week", weekStart: week } } as any, r);
    (observed.O3 ??= {} as any)[week] = { code: r.code, cc: r.headers["Cache-Control"], error: r.body?.error ?? null, scheduleCalls: m.schedule.mock.calls.length, rateReads: m.pg.calls.length };
    if (ok) expect(r.code).toBe(200); else { expect(r.code).toBe(400); expect(r.body.error).toMatch(/NHL season/); expect(m.schedule).not.toHaveBeenCalled(); expect(m.pg.calls).toEqual([]); }
  });
  it("O4 explicit limit: 70-row source fails closed after one [0,63] page; 32 rows load with only 7 columns", async () => {
    m.pg.count = 70; m.pg.rows = 70;
    const over = await loadShareTeamRates(20262027).then(() => "loaded", e => e.message);
    const overCalls = [...m.pg.calls]; m.pg.calls = []; m.pg.count = 32; m.pg.rows = 32; m.pg.abbr = Object.keys(fictionalTeamStats(20262027, NOW)); // run1: T0..T31 matched no team (reviewer error)
    const ok = await loadShareTeamRates(20262027);
    observed.O4 = { limit: TEAM_RATE_ROW_LIMIT, over, overCalls, okCalls: m.pg.calls, select: m.pg.select, okKeys: Object.keys(Object.values(ok)[0]) };
    expect(over).toMatch(/incomplete or over the row limit/); expect(overCalls).toEqual([[0, 63]]);
    expect(m.pg.select.split(",")).toHaveLength(7); expect(m.pg.select).not.toMatch(/team_name/);
  });
  it("L1 API JSON carries only gp/xgf/xga per team; no source extras or names", async () => {
    const r = res(); await handler({ method: "GET", query: { format: "game-grid", weekStart: WEEK } } as any, r);
    const json = JSON.stringify(r.body); const keys = new Set(Object.values(r.body.opponents.teams).flatMap((t: any) => Object.keys(t)));
    observed.L1 = { keys: [...keys], leak: /LEAK|SECRET|team_name/.test(json), opponents: r.body.opponents.state };
    expect([...keys].sort()).toEqual(["gp", "xga", "xgf"]); expect(json).not.toMatch(/LEAK|SECRET|team_name/);
  });
});
