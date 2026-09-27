import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: { id: "owner-a" }, allowed: false, requireUser: vi.fn(), access: vi.fn(), snapshot: vi.fn(), planningData: vi.fn(), settings: vi.fn(), draftResource: vi.fn(), boardResource: vi.fn(), planningResource: vi.fn() }));
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: mocks.requireUser }));
vi.mock("lib/in-season/server", () => ({
  loadInSeasonAccess: mocks.access,
  requireInSeasonCapability: (access: { capabilities: string[] }, capability: string) => {
    if (!access.capabilities.includes(capability)) throw Object.assign(new Error("Access required"), { statusCode: 403 });
  },
}));
vi.mock("lib/supabase/server", () => ({ default: { from: vi.fn() } }));
vi.mock("lib/rosterScheduleData/planning", async (original) => ({ ...await original<typeof import("../../rosterScheduleData/planning")>(), loadPlanningData: mocks.planningData }));
vi.mock("lib/integrations/yahoo/gameContext", async (original) => ({ ...await original<typeof import("./gameContext")>(), resolveYahooGameContext: async () => ({ gameKey: "453", targetSeasonId: 20262027 }), assertYahooLeagueGameContext: () => undefined }));
vi.mock("lib/integrations/yahoo/liveDraft", async (original) => ({ ...await original<typeof import("./liveDraft")>(), parseYahooBoardSettings: mocks.settings }));
vi.mock("lib/integrations/yahoo/providerClient", async (original) => ({ ...await original<typeof import("./providerClient")>(), fetchYahooDraftResource: mocks.draftResource, fetchYahooBoardResource: mocks.boardResource, fetchYahooPlanningResource: mocks.planningResource }));
vi.mock("lib/integrations/yahoo/rosterPlanning", async (original) => ({
  ...await original<typeof import("./rosterPlanning")>(),
  loadYahooPlanningSnapshot: mocks.snapshot,
}));

import { yahooPlanningCategories, yahooPlanningEditable, yahooPlanningStats, yahooPlanningTeams } from "./rosterPlanning";
import providerHandler from "../../../pages/api/v1/roster-schedule-optimizer/provider";

function req(method: string, body: unknown = {}) { return { method, body, headers: {} } as any; }
function res() { return { statusCode: 200, body: null as any, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; }, end() { return this; }, setHeader() {} } as any; }

beforeEach(() => {
  mocks.allowed = false;
  mocks.requireUser.mockReset().mockResolvedValue(mocks.user);
  mocks.access.mockReset().mockImplementation(async () => ({ capabilities: mocks.allowed ? ["rso_sync"] : [] }));
  mocks.snapshot.mockReset().mockResolvedValue({ snapshot: { id: "verified" }, capabilities: { roster: true } });
  mocks.planningData.mockReset(); mocks.settings.mockReset(); mocks.draftResource.mockReset(); mocks.boardResource.mockReset(); mocks.planningResource.mockReset();
});

describe("Yahoo planning parsers", () => {
  it("keeps missing statistics unknown and ignores unsupported stat identifiers", () => {
    const payload = { team_stats: { stats: { 0: { stat: [{ stat_id: "1" }, { value: "3" }] }, 1: { stat: [{ stat_id: "26" }, { value: "-" }] }, 2: { stat: [{ stat_id: "999" }, { value: "99" }] } } } };
    expect(yahooPlanningStats(payload)).toEqual({ GOALS: 3, SAVE_PERCENTAGE: null });
  });
  it("preserves ratio components and category direction", () => {
    expect(yahooPlanningCategories(["SAVE_PERCENTAGE", "GOALS_AGAINST_AVERAGE", "SHOOTING_PERCENTAGE", "LOSSES_GOALIE"])).toEqual([
      { key: "SAVE_PERCENTAGE", direction: "higher", numerator: "SAVES_GOALIE", denominator: "SHOTS_AGAINST_GOALIE" },
      { key: "GOALS_AGAINST_AVERAGE", direction: "lower", numerator: "GOALS_AGAINST_GOALIE", denominator: "GOALIE_MINUTES", multiplier: 60 },
      { key: "SHOOTING_PERCENTAGE", direction: "higher", numerator: "GOALS", denominator: "SHOTS_ON_GOAL" },
      { key: "LOSSES_GOALIE", direction: "lower" },
    ]);
  });
  it("retains separate team identities inside a matchup", () => {
    const payload = { matchup: { 0: { team: [{ team_key: "453.l.1.t.1" }, { team_stats: { stat: [] } }] }, 1: { team: [{ team_key: "453.l.1.t.2" }] } } };
    expect(yahooPlanningTeams(payload).map((team) => team.team_key)).toEqual(["453.l.1.t.1", "453.l.1.t.2"]);
  });
  it("requires affirmative fresh roster and player editability before unlocking", () => {
    expect(yahooPlanningEditable("1", undefined, true, false, true)).toBe(false);
    expect(yahooPlanningEditable("1", "0", true, false, true)).toBe(false);
    expect(yahooPlanningEditable("1", "1", false, false, true)).toBe(false);
    expect(yahooPlanningEditable("1", "1", true, true, true)).toBe(false);
    expect(yahooPlanningEditable("1", "1", true, false, false)).toBe(false);
    expect(yahooPlanningEditable("1", "1", true, false, true)).toBe(true);
  });
});

describe("Yahoo snapshot evidence", () => {
  it("pages identity mappings and leaves acquisition timing unknown", async () => {
    const mappingRanges: Array<[number, number]> = [];
    const db = { from(table: string) {
      const filters: Record<string, unknown> = {};
      const query = {
        select() { return query; }, order() { return query; }, eq(key: string, value: unknown) { filters[key] = value; return query; },
        async maybeSingle() {
          if (table === "external_teams" && filters.user_id === "owner-a" && filters.provider === "yahoo" && filters.id === "team-a") return { data: { id: "team-a", team_metadata: { is_owned: true }, connected_account_id: "account-a", external_league_id: "league-a", external_team_key: "453.l.1.t.1" }, error: null };
          if (table === "external_leagues" && filters.user_id === "owner-a" && filters.provider === "yahoo" && filters.id === "league-a") return { data: { id: "league-a", connected_account_id: "account-a", external_league_key: "453.l.1" }, error: null };
          return { data: null, error: null };
        },
        async range(start: number, end: number) {
          expect(table).toBe("yahoo_nhl_player_map_read"); mappingRanges.push([start, end]);
          return { data: start === 0 ? Array.from({ length: 1000 }, (_, index) => ({ nhl_player_id: index + 1, yahoo_player_id: index + 1 })) : [{ nhl_player_id: 2001, yahoo_player_id: 2001 }], error: null };
        },
      };
      return query;
    } };
    const now = new Date("2026-10-01T12:00:00Z");
    const transport = { responseDate: now.toISOString(), ageSeconds: 0 };
    mocks.planningData.mockResolvedValue({ players: [{ id: "canonical", nhlId: 2001, providerId: null, name: "Mapped Player", teamAbbreviation: "TOR", eligiblePositions: ["C"], playerClass: "skater", availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] }], games: [], forecasts: [], evidence: {} });
    mocks.settings.mockReturnValue({ rosterType: "date", weeklyDeadline: "intraday", rosterConfig: { C: 1 }, scoringTypeRecognized: true, unsupportedStatIds: [], unsupportedRosterSlots: [], leagueType: "points", scoringCategories: {}, categoryWeights: {}, minimumGoalieStarts: null });
    mocks.draftResource.mockResolvedValue({ payload: { league_key: "453.l.1", time_zone: "UTC" }, transport });
    mocks.boardResource.mockImplementation(async ({ resource }: any) => {
      if (resource.type !== "roster") throw new Error("Optional league roster read unavailable");
      return { payload: { team_key: "453.l.1.t.1", is_owned_by_current_login: "1", roster: { date: "2026-10-01", coverage_type: "date", is_editable: "1", players: { count: 1, 0: { player: [{ player_key: "453.p.2001" }, { selected_position: [{ position: "C" }] }] } } } }, transport };
    });
    mocks.planningResource.mockImplementation(async ({ resource }: any) => {
      if (resource.type !== "available_page") throw new Error("Optional scoreboard read unavailable");
      return { payload: { league_key: "453.l.1", players: { count: 0 } }, transport };
    });
    const actual = await vi.importActual<typeof import("./rosterPlanning")>("./rosterPlanning");
    const result = await actual.loadYahooPlanningSnapshot({ db: db as any, userId: "owner-a", teamId: "team-a", startDate: "2026-10-01", endDate: "2026-10-07", now });
    expect(mappingRanges).toEqual([[0, 999], [1000, 1999]]);
    expect(result.snapshot.roster).toEqual([{ playerId: "canonical", position: "active" }]);
    expect(result.snapshot.rules.acquisitionTiming).toBe("unknown");
    expect(result.snapshot.lockedAssignments).toEqual([{ date: "2026-10-01", playerId: "canonical", slotId: "C#1" }]);
  });
});

describe("provider snapshot route", () => {
  it("checks sync capability before any provider read", async () => {
    const response = res();
    await providerHandler(req("POST", { provider: "yahoo", teamId: "forged", startDate: "2026-10-01", endDate: "2026-10-07" }), response);
    expect(response.statusCode).toBe(403);
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
  it("passes only the authenticated user to the provider adapter", async () => {
    mocks.allowed = true;
    const response = res();
    await providerHandler(req("POST", { provider: "yahoo", userId: "owner-b", teamId: "selected", startDate: "2026-10-01", endDate: "2026-10-07" }), response);
    expect(response.body.success).toBe(true);
    expect(mocks.snapshot).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner-a", teamId: "selected" }));
  });
  it("rejects non-POST requests without authentication or provider reads", async () => {
    const response = res(); await providerHandler(req("GET"), response);
    expect(response.statusCode).toBe(405);
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
});
