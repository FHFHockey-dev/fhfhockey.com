import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), provider: vi.fn(), parse: vi.fn() }));
vi.mock("lib/supabase/server", () => ({ default: {} }));
vi.mock("./gameContext", () => ({ resolveYahooGameContext: mocks.context, assertYahooLeagueGameContext: vi.fn() }));
vi.mock("./providerClient", () => ({ fetchYahooBoardResource: mocks.provider }));
vi.mock("./pickup", () => ({ parseYahooPickupRosters: mocks.parse }));
import { loadYahooPickupContext } from "./pickupServer";

function client(failedTable?: string) {
  const rows: Record<string, unknown> = {
    user_provider_preferences: { default_external_team_id: "team" }, user_settings: null,
    external_teams: { team_metadata: { is_owned: true }, external_league_id: "league", connected_account_id: "account", external_team_key: "1.l.2.t.3" },
    external_leagues: { connected_account_id: "account", external_league_key: "1.l.2" },
  };
  return { from: (table: string) => {
    const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({
      data: rows[table], error: table === failedTable ? new Error("private DB detail") : null,
    }) }; return q;
  } };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({ gameKey: "1", season: "2026" });
  mocks.provider.mockResolvedValue({ payload: { private: "provider data" } });
  mocks.parse.mockReturnValue({ roster: [], rosteredPlayerKeys: [] });
});
describe("Yahoo pickup loader error boundaries", () => {
  it.each([
    ["user_provider_preferences", "yahoo_pickup_settings_unavailable"],
    ["user_settings", "yahoo_pickup_settings_unavailable"],
    ["external_teams", "yahoo_pickup_team_unavailable"],
    ["external_leagues", "yahoo_pickup_league_unavailable"],
  ])("labels %s failure without exposing DB details or reaching Yahoo", async (table, code) => {
    await expect(loadYahooPickupContext("owner", client(table) as any)).rejects.toMatchObject({ code, statusCode: 503 });
    expect(mocks.provider).not.toHaveBeenCalled();
  });
  it("labels invalid rosters without returning a fabricated empty pool", async () => {
    mocks.parse.mockImplementation(() => { throw new Error("private parser detail"); });
    await expect(loadYahooPickupContext("owner", client() as any)).rejects.toMatchObject({
      code: "yahoo_pickup_roster_invalid", statusCode: 503,
      message: "Yahoo roster response is incomplete or invalid.",
    });
  });
  it("preserves a valid roster result", async () => {
    mocks.parse.mockReturnValue({ roster: [{ key: "1.p.4", name: "Test", position: "C" }], rosteredPlayerKeys: ["1.p.4"] });
    await expect(loadYahooPickupContext("owner", client() as any)).resolves.toMatchObject({
      rosteredPlayerKeys: ["1.p.4"], roster: [{ key: "1.p.4", name: "Test", position: "C" }], gameKey: "1", season: 2026,
    });
  });
});
