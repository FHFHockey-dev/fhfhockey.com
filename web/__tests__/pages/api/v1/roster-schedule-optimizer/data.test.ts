import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn(), select: vi.fn(), db: {} }));
vi.mock("lib/supabase/server", () => ({ default: mocks.db }));
vi.mock("lib/rosterScheduleData/planning", async importOriginal => ({
  ...await importOriginal<typeof import("lib/rosterScheduleData/planning")>(), loadPlanningData: mocks.load,
}));
vi.mock("lib/player-forecasts/forecastServingSource", async importOriginal => ({
  ...await importOriginal<typeof import("lib/player-forecasts/forecastServingSource")>(), selectForecastServingSource: mocks.select,
}));
import { decodePlanningDataTransport } from "lib/rosterScheduleData/planningDataTransport";
import handler from "pages/api/v1/roster-schedule-optimizer/data";

const query = { seasonId: "20262027", startDate: "2026-10-15", endDate: "2026-10-21" };
const data = { players: [], games: [], forecasts: [], evidence: {} };
const native = { kind: "native", headId: "00000000-0000-4000-8000-000000000001", headRevision: 3,
  issuedAt: "2026-10-15T11:00:00.000Z", expiresAt: "2026-10-15T12:01:00.000Z", environment: {} };
function response() {
  const res: any = { code: 200, body: null, headers: {}, setHeader: vi.fn((k, v) => { res.headers[k] = v; }),
    status: vi.fn(code => { res.code = code; return res; }), end: vi.fn(), json: vi.fn(body => { res.body = body; return res; }) };
  return res;
}
async function request(changes = {}) {
  const res = response(); await handler({ method: "GET", query, ...changes } as any, res); return res;
}
beforeEach(async () => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
  vi.stubEnv("PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID", "");
  const actual = await vi.importActual<typeof import("lib/player-forecasts/forecastServingSource")>("lib/player-forecasts/forecastServingSource");
  mocks.select.mockImplementation(actual.selectForecastServingSource);
  mocks.load.mockResolvedValue(data);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("/api/v1/roster-schedule-optimizer/data", () => {
  it("selects legacy before activation without a lookup and keeps today's caching", async () => {
    const res = await request();
    expect(res.code).toBe(200);
    expect(mocks.select).toHaveBeenCalledExactlyOnceWith(mocks.db, 20262027, new Date());
    const source = await mocks.select.mock.results[0].value;
    expect(source).toMatchObject({ kind: "legacy", reason: "native_not_activated" });
    expect(mocks.load).toHaveBeenCalledExactlyOnceWith(mocks.db, { seasonId: 20262027, startDate: query.startDate, endDate: query.endDate },
      { now: new Date(), source, forgeDailyBridge: true });
    expect(res.headers["Cache-Control"]).toBe("public, s-maxage=300, stale-while-revalidate=300");
    expect(res.body.forecastSource).toEqual({ kind: "legacy", headRevision: null, expiresAt: null, reason: "native_not_activated" });
    expect(decodePlanningDataTransport(res.body.data)).toEqual(data);
  });

  it("passes the one native selection to planning and never lets a shared copy outlive the catalog", async () => {
    mocks.select.mockResolvedValue(native);
    const res = await request();
    expect(mocks.select).toHaveBeenCalledTimes(1);
    expect(mocks.load.mock.calls[0][2]).toEqual({ now: new Date(), source: native, forgeDailyBridge: true });
    expect(res.headers["Cache-Control"]).toBe("public, s-maxage=60, stale-while-revalidate=0");
    expect(res.body.forecastSource).toEqual({ kind: "native", headRevision: 3, expiresAt: native.expiresAt, reason: null });
    expect(decodePlanningDataTransport(res.body.data)).toEqual(data);
  });

  it.each(["empty", "legacy_flagged"] as const)("reports the %s fallback reason; RSO has no legacy forecasts to serve", async kind => {
    const source = { kind, reason: "native_catalog_expired", environment: { PLAYER_FORECAST_BASELINE_RELEASE_IDS: "" } };
    mocks.select.mockResolvedValue(source);
    const res = await request();
    expect(mocks.load.mock.calls[0][2]).toEqual({ now: new Date(), source, forgeDailyBridge: true });
    expect(res.headers["Cache-Control"]).toBe("public, s-maxage=300, stale-while-revalidate=300");
    expect(res.body.forecastSource).toEqual({ kind, headRevision: null, expiresAt: null, reason: "native_catalog_expired" });
  });

  it("rejects an invalid range before selecting a source and redacts load failures", async () => {
    const invalid = await request({ query: { ...query, endDate: "2026-10-14" } });
    expect(invalid.code).toBe(400); expect(mocks.select).not.toHaveBeenCalled();
    expect((await request({ method: "POST" })).code).toBe(405);
    mocks.load.mockRejectedValue(new Error("fixture-secret-database-url"));
    const failed = await request();
    expect(failed.code).toBe(503); expect(JSON.stringify(failed.body)).not.toContain("fixture-secret");
  });
});
