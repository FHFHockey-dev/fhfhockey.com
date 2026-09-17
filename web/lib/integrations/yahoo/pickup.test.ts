import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseYahooPickupRosters, isYahooPickupPlayer, type YahooPickupContext } from "./pickup";

const player = (id: number) => ({ player: [[{ player_key: `477.p.${id}` }, { name: { full: `Player ${id}` } }], { selected_position: [{ position: "C" }] }] });
const team = (id: number, ids: number[]) => ({ team: [[{ team_key: `477.l.1.t.${id}` }], { roster: { players: { ...Object.fromEntries(ids.map((id, i) => [i, player(id)])), count: ids.length } } }] });
const payload = () => ({ fantasy_content: { league: [{ league_key: "477.l.1" }, { teams: { 0: team(1, [1]), 1: team(2, [2]), count: 2 } }] } });

describe("Yahoo pickup rosters", () => {
  it("reads every league roster and the selected team's full roster", () => {
    expect(parseYahooPickupRosters(payload(), "477.l.1", "477.l.1.t.1")).toEqual({
      rosteredPlayerKeys: ["477.p.1", "477.p.2"], roster: [{ key: "477.p.1", name: "Player 1", position: "C" }],
    });
  });
  it("accepts an explicitly empty predraft roster", () => {
    const data = { teams: { 0: team(1, []), count: 1 } };
    expect(parseYahooPickupRosters(data, "477.l.1", "477.l.1.t.1").roster).toEqual([]);
  });
  it.each([
    { teams: { 0: team(1, [1]), count: 2 } },
    { teams: { 0: { team: { team_key: "477.l.1.t.1" } }, count: 1 } },
    { teams: { 0: team(1, [1]), 1: team(2, [1]), count: 2 } },
    { teams: { 0: team(2, [1]), count: 1 } },
  ])("rejects incomplete, missing, duplicated, or wrong-team rosters", (data) => {
    expect(() => parseYahooPickupRosters(data, "477.l.1", "477.l.1.t.1")).toThrow();
  });
  it("excludes other teams' players and never matches a different season by numeric tail", () => {
    const context: YahooPickupContext = { ...parseYahooPickupRosters(payload(), "477.l.1", "477.l.1.t.1"), gameKey: "477", season: 2026, fetchedAt: "", leagueName: "League", teamName: "Team" };
    expect(isYahooPickupPlayer("477.p.1", context, "available")).toBe(false);
    expect(isYahooPickupPlayer("477.p.2", context, "available")).toBe(false);
    expect(isYahooPickupPlayer("477.p.3", context, "available")).toBe(true);
    expect(isYahooPickupPlayer("1", context, "roster")).toBe(true);
    expect(isYahooPickupPlayer("465.p.1", context, "roster")).toBe(false);
    expect(isYahooPickupPlayer("465.p.3", context, "available")).toBe(false);
    expect(isYahooPickupPlayer(null, context, "available")).toBe(false);
  });
});


const provider = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("lib/supabase/server", () => ({ default: {} }));
vi.mock("./providerClient", () => ({ fetchYahooBoardResource: provider.fetch }));
vi.mock("./gameContext", () => ({
  resolveYahooGameContext: async () => ({ gameKey: "477", season: "2026" }),
  assertYahooLeagueGameContext: (key: string) => { if (!key.startsWith("477.l.")) throw new Error("Wrong season"); },
}));
import { loadYahooPickupContext } from "./pickupServer";
const records = () => ({
  user_provider_preferences: { default_external_team_id: "default-team" },
  user_settings: { active_context: { provider: "yahoo", external_team_id: "selected-team" } },
  external_teams: { id: "selected-team", external_team_key: "477.l.1.t.1", external_league_id: "league-id", connected_account_id: "account-id", team_name: "My team", team_metadata: { is_owned: true } },
  external_leagues: { external_league_key: "477.l.1", connected_account_id: "account-id", league_name: "My league" },
});
function database(rows: Record<string, unknown>) {
  const filters: unknown[] = [];
  const client: any = { from: (table: string) => {
    const query: any = { select: () => query, eq: (key: string, value: unknown) => { filters.push([table, key, value]); return query; }, maybeSingle: async () => ({ data: rows[table], error: null }) };
    return query;
  } };
  return { client, filters };
}
beforeEach(() => { provider.fetch.mockReset(); provider.fetch.mockResolvedValue({ payload: payload() }); });
describe("Yahoo pickup account context", () => {
  it("uses the account's active team and constrains every private read to its owner", async () => {
    const { client, filters } = database(records());
    const result = await loadYahooPickupContext("owner", client);
    expect(result?.roster).toHaveLength(1);
    expect(filters).toContainEqual(["external_teams", "id", "selected-team"]);
    for (const table of Object.keys(records())) expect(filters).toContainEqual([table, "user_id", "owner"]);
    expect(provider.fetch).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner", connectedAccountId: "account-id", leagueKey: "477.l.1", resource: { type: "league_rosters" } }));
  });
  it("uses the saved Yahoo default when no active Yahoo team exists", async () => {
    const rows = { ...records(), user_settings: null }; const { client, filters } = database(rows);
    await loadYahooPickupContext("owner", client);
    expect(filters).toContainEqual(["external_teams", "id", "default-team"]);
  });
  it("does not call Yahoo when no team is selected", async () => {
    const { client } = database({ user_settings: null, user_provider_preferences: null });
    expect(await loadYahooPickupContext("owner", client)).toBeNull();
    expect(provider.fetch).not.toHaveBeenCalled();
  });
  it("rejects unowned teams before contacting Yahoo", async () => {
    const rows = records(); rows.external_teams.team_metadata.is_owned = false;
    await expect(loadYahooPickupContext("owner", database(rows).client)).rejects.toThrow("Select your Yahoo team");
    expect(provider.fetch).not.toHaveBeenCalled();
  });
});
