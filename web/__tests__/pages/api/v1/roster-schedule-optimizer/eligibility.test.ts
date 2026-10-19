import { beforeEach, expect, it, vi } from "vitest";
const reader = vi.hoisted(() => vi.fn());
vi.mock("lib/supabase/server", () => ({ default: {} }));
vi.mock("lib/rosterScheduleOptimizer/yahooEligibilityCache", () => ({ readYahooEligibilityCache: reader }));
import handler from "pages/api/v1/roster-schedule-optimizer/eligibility";
const response = () => ({ statusCode: 200, body: null as any, setHeader: vi.fn(), status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; }, end() { return this; } });
beforeEach(() => reader.mockReset().mockResolvedValue({ source: "yahoo_players", players: [] }));
it("bounds a read-only public source lookup with no account or provider call", async () => {
  const res = response(); await handler({ method: "GET", query: { seasonId: "20262027", playerIds: "8157,9857" } } as any, res as any);
  expect(reader).toHaveBeenCalledWith({}, 20262027, ["8157", "9857"]);
  expect(res.body).toMatchObject({ success: true, receipt: { source: "yahoo_players" } });
  expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
});
it.each([{}, { seasonId: "20262026", playerIds: "8157" }, { seasonId: "20262027", playerIds: "8157,8157" },
  { seasonId: "20262027", playerIds: "not-an-id" }, { seasonId: "20262027", playerIds: Array.from({ length: 61 }, (_, i) => String(i + 1)).join(",") }])("rejects invalid or unbounded %s before database access", async query => {
  const res = response(); await handler({ method: "GET", query } as any, res as any); expect(res.statusCode).toBe(400); expect(reader).not.toHaveBeenCalled();
});
it("rejects mutation methods", async () => { const res = response(); await handler({ method: "POST", query: {} } as any, res as any); expect(res.statusCode).toBe(405); expect(reader).not.toHaveBeenCalled(); });
