import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn(), db: {} }));
vi.mock("lib/supabase/server", () => ({ default: mocks.db }));
vi.mock("lib/rosterScheduleData/planning", async importOriginal => ({
  ...await importOriginal<typeof import("lib/rosterScheduleData/planning")>(), loadPlanningData: mocks.load,
}));
import { expandBridgeForecasts } from "lib/rosterScheduleData/bridgeForecastWire";
import handler from "pages/api/v1/roster-schedule-optimizer/data";

const query = { seasonId: "20262027", startDate: "2026-10-15", endDate: "2026-10-21" };
const data = { players: [], games: [], forecasts: [], evidence: {} };
const utf8 = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");
async function request() {
  const res: any = { code: 200, body: null, setHeader: vi.fn(), end: vi.fn(),
    status: vi.fn(code => { res.code = code; return res; }), json: vi.fn(body => { res.body = body; return res; }) };
  await handler({ method: "GET", query } as any, res); return res;
}
beforeEach(() => { vi.clearAllMocks(); });

describe("/api/v1/roster-schedule-optimizer/data", () => {
  it("fits the whole response, bridge siblings included, in exact UTF-8 bytes by trimming the latest bridge rows", async () => {
    // Non-ASCII names: about 3.7 MB of UTF-8 but only about 2 M characters.
    const players = Array.from({ length: 3600 }, (_, index) => ({ id: String(index + 1), nhlId: 8470000 + index, nhlTeamId: 10,
      rosterRevision: `roster-${index}`, name: `Ž${"ø".repeat(399)}`, teamAbbreviation: "TOR", eligiblePositions: ["C"], eligibilityVerified: true,
      playerClass: "skater", availability: "free_agent", ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] }));
    const games = ["2026020101", "2026020102"].map((id, index) => ({ id, scheduleRevision: `schedule-${id}`, date: `2026-10-1${6 + index}`,
      startsAt: `2026-10-1${6 + index}T23:00:00.000Z`, teamAbbreviation: "TOR", opponent: "MTL", home: true, status: "scheduled" }));
    const wire = { version: "forge-daily-bridge-wire-v1", seasonId: 20262027, limitations: ["Interim FORGE projection."],
      runs: [["forge-daily-bridge-v1:run-a", "forge-daily-bridge-v1:run-a", "forge-daily-bridge-v1:abc", "2026-10-15T11:00:00.000Z", "2026-10-15T11:00:00.000Z"]],
      rows: games.flatMap(game => players.map(player => [player.id, game.id, 0, game.startsAt, { GOALS: 0.3, ASSISTS: 0.4, SHOTS: 2.7 }, null, false, null])) };
    const forecasts = expandBridgeForecasts(wire, { players, games } as never);
    expect(forecasts).toHaveLength(7200);
    mocks.load.mockResolvedValue({ ...data, players, games, forecasts });
    const res = await request();
    expect(res.code).toBe(200);
    expect(JSON.stringify(res.body).length).toBeLessThan(4_000_000);
    expect(utf8(res.body)).toBeLessThanOrEqual(4_000_000);
    const sent = JSON.parse(JSON.stringify(res.body));
    const kept = sent.bridgeForecasts.rows.length;
    expect(kept).toBeGreaterThan(0);
    expect(kept).toBeLessThan(7200);
    expect(sent.bridgeForecasts.rows).toEqual(wire.rows.slice(0, kept));
    const rebuilt = expandBridgeForecasts(sent.bridgeForecasts, sent.data);
    expect(rebuilt).toHaveLength(kept);
    expect(rebuilt[0].limitations.at(-1)).toBe(`Interim projections were trimmed to the first ${kept} of 7200 player-games to fit the planning response; later games stay schedule-only.`);
  });

  it("refuses a range whose data cannot fit even without bridge rows, with a clear code", async () => {
    const players = Array.from({ length: 5000 }, (_, index) => ({ id: String(index + 1), nhlId: null, name: "ø".repeat(500),
      teamAbbreviation: null, eligiblePositions: [], playerClass: "skater", availability: "free_agent", ownership: null, canDrop: null,
      holdValue: null, reserveEligibility: [] }));
    mocks.load.mockResolvedValue({ ...data, players });
    const res = await request();
    expect(res.code).toBe(503);
    expect(res.body).toMatchObject({ success: false, code: "planning_range_too_large" });
  });
});
