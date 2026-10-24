// @vitest-environment node
// C7 controls for SS1-2's server-side nst_team_stats read: bounded, leak-free, never blocks the schedule edition.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
const OUT = process.env.C7_SS1_OUT; const observed: Record<string, unknown> = {};
afterAll(() => { if (OUT) writeFileSync(OUT, JSON.stringify(observed, null, 2)); });
const m = vi.hoisted(() => ({ schedule: vi.fn(), stats: vi.fn() }));
vi.mock("lib/NHL/server", () => ({ getSchedule: m.schedule }));
vi.mock("components/GameGrid/utils/useOpponentMetricsData", () => ({ loadCurrentSeasonStats: m.stats }));
import { loadScheduleShareSnapshot } from "lib/socialShare/server";
import { fictionalLeagueWeek, fictionalTeamStats } from "lib/socialShare/fixtures";
import handler from "pages/api/v1/social-share/[format]";

const WEEK = "2026-10-26", NOW = "2026-10-26T12:00:00Z";
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date(NOW)); m.schedule.mockResolvedValue(fictionalLeagueWeek(WEEK, NOW)); });
const res = () => { const r: any = { headers: {} as any, code: 200, body: null, setHeader: (k: string, v: string) => { r.headers[k] = v; } }; r.status = (c: number) => { r.code = c; return r; }; r.json = (b: any) => { r.body = b; return r; }; return r; };

describe("SS1 nst_team_stats read", () => {
  it("S1 only gp/xgf/xga per team reach the API JSON; extra columns and team names never do", async () => {
    const stats = fictionalTeamStats(20262027, "2026-10-26T06:00:00Z");
    for (const row of Object.values(stats) as any[]) { row.team_name = "LEAKY TEAM NAME"; row.points = 99; row.secret_note = "SECRET-COLUMN"; }
    m.stats.mockResolvedValue(stats);
    const snap = await loadScheduleShareSnapshot("game-grid", WEEK);
    const json = JSON.stringify(snap); const keys = new Set(Object.values(snap.opponents!.teams).flatMap(t => Object.keys(t)));
    observed.S1 = { state: snap.opponents!.state, teamKeys: [...keys], leaksName: json.includes("LEAKY"), leaksSecret: json.includes("SECRET-COLUMN"), statsCalls: m.stats.mock.calls };
    expect([...keys].sort()).toEqual(["gp", "xga", "xgf"]); expect(json).not.toContain("LEAKY"); expect(json).not.toContain("SECRET-COLUMN");
    expect(m.stats).toHaveBeenCalledTimes(1); expect(m.stats).toHaveBeenCalledWith(20262027);
  });
  it("S2 a failing stats read degrades to 'missing' without error text; the schedule edition still succeeds", async () => {
    m.stats.mockRejectedValue(new Error("SECRET-DB-DETAIL relation nst_team_stats"));
    const snap = await loadScheduleShareSnapshot("game-grid", WEEK);
    observed.S2 = { scheduleState: snap.state, opponents: { state: snap.opponents!.state, reasons: snap.opponents!.reasons } };
    expect(snap.state).toBe("ready"); expect(snap.opponents!.state).toBe("missing"); expect(JSON.stringify(snap)).not.toContain("SECRET-DB-DETAIL");
  });
  it("S3 schedule failure → 503 and the parallel stats rejection is handled (no unhandled rejection)", async () => {
    const unhandled: unknown[] = []; const h = (e: unknown) => unhandled.push(e); process.on("unhandledRejection", h);
    m.schedule.mockRejectedValue(new Error("nhl down")); m.stats.mockImplementation(() => new Promise((_, rej) => setTimeout(() => rej(new Error("late")), 5)));
    await expect(loadScheduleShareSnapshot("game-grid", WEEK)).rejects.toMatchObject({ status: 503 });
    await vi.advanceTimersByTimeAsync(20); vi.useRealTimers(); await new Promise(r => setTimeout(r, 20)); process.off("unhandledRejection", h);
    observed.S3 = { unhandled: unhandled.length, statsCalled: m.stats.mock.calls.length };
    expect(unhandled).toEqual([]);
  });
  it.each([
    ["unsupported format", () => loadScheduleShareSnapshot("tuesday-trends" as any, WEEK)],
    ["invalid weekStart", () => loadScheduleShareSnapshot("game-grid", "2026-13-40")],
    ["duplicate selected dates", () => loadScheduleShareSnapshot("game-grid", WEEK, ["2026-10-27", "2026-10-27"])],
    ["date outside week", () => loadScheduleShareSnapshot("game-grid", WEEK, ["2026-11-30"])],
  ])("S4 %s makes no stats read", async (_n, call) => {
    m.stats.mockResolvedValue({});
    await call().catch(() => undefined);
    expect(m.stats).not.toHaveBeenCalled();
  });
  it("S5 API: extra query key or POST → no reads; GET is no-store and noindex", async () => {
    m.stats.mockResolvedValue(fictionalTeamStats(20262027, "2026-10-26T06:00:00Z"));
    const a = res(); await handler({ method: "GET", query: { format: "game-grid", weekStart: WEEK, x: "1" } } as any, a);
    const b = res(); await handler({ method: "POST", query: { format: "game-grid" } } as any, b);
    const c = res(); await handler({ method: "GET", query: { format: "game-grid", weekStart: WEEK } } as any, c);
    observed.S5 = { extraKey: a.code, post: b.code, ok: c.code, headers: c.headers, statsCalls: m.stats.mock.calls.length, scheduleCalls: m.schedule.mock.calls.length };
    expect(a.code).toBe(400); expect(b.code).toBe(405); expect(c.code).toBe(200);
    expect(m.stats).toHaveBeenCalledTimes(1); expect(c.headers["Cache-Control"]).toBe("no-store"); expect(c.headers["X-Robots-Tag"]).toContain("noindex");
  });
  it("S6 (observation) any calendar weekStart picks its season; a far-future week reads that season once", async () => {
    m.stats.mockResolvedValue({}); m.schedule.mockResolvedValue({ data: {}, numGamesPerDay: [], coveredDates: [] });
    await loadScheduleShareSnapshot("game-grid", "2099-01-05").catch(() => undefined);
    observed.S6 = { statsArgs: m.stats.mock.calls };
    expect(m.stats).toHaveBeenCalledTimes(1);
  });
});
