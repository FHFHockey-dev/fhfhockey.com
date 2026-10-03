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

import { yahooPlanningAcquisitions, yahooPlanningCategories, yahooPlanningEditable, yahooPlanningPlayers, yahooPlanningStats, yahooPlanningTeams } from "./rosterPlanning";
import type { YahooProviderJsonResult } from "./providerClient";
import { YahooLiveDraftError } from "./liveDraft";
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
  function acquisitionInputs() {
    const now = new Date("2026-10-01T12:00:00Z");
    const response = (payload: unknown): YahooProviderJsonResult => ({ payload, transport: {
      responseDate: now.toISOString(), ageSeconds: 0, cacheControl: null, contentType: "application/json", etagPresent: false,
      httpStatus: 200, lastModifiedPresent: false, refreshRate: null, requestDurationMs: 1, requestId: null,
      responseFormat: "standard_json", retryAfterSeconds: null, tokenRefreshAttempted: false, tokenRefreshOutcome: "not_needed",
    } });
    return { now, response, settings: response({ settings: { max_weekly_adds: "5" } }),
      league: response({ league: [{ league_key: "453.l.1" }, { current_week: "1" }] }),
      team: response({ team: [{ team_key: "453.l.1.t.1" }, { is_owned_by_current_login: "1" }, { number_of_moves: 999 },
        { roster_adds: [{ coverage_type: "week" }, { coverage_value: "1" }, { value: "3" }] }] }),
      weeks: [{ gameKey: "453", week: 1, startDate: "2026-09-29", endDate: "2026-10-04" }],
      gameKey: "453", leagueKey: "453.l.1", teamKey: "453.l.1.t.1", startDate: "2026-10-01", endDate: "2026-10-03" };
  }
  it("retains scoped weekly usage, source and dates separately from unverified NHL limits", () => {
    const args = acquisitionInputs(), evidence = yahooPlanningAcquisitions(args);
    expect(evidence.counter).toEqual({ present: true, coverageType: "week", coverageWeek: 1, reportedValue: "3", used: 3 });
    expect(evidence.period).toEqual({ week: 1, startDate: "2026-09-29", endDate: "2026-10-04", containsHorizon: true });
    expect(evidence.limit).toEqual({ present: true, reportedValue: "5", verified: false });
    expect(evidence.remaining).toBeNull();
    expect(evidence.asOf).toBe(args.now.toISOString());
    expect(evidence.fetchedAt).toBe(args.now.toISOString());
    expect(evidence.source).toContain("roster_adds");
  });
  it.each([0, "0", null, undefined, false, "", "-", -1, 1.5])("preserves zero and rejects malformed counter value %s", value => {
    const args = acquisitionInputs();
    args.team = args.response({ team: [{ team_key: args.teamKey }, { is_owned_by_current_login: 1 }, { number_of_moves: 999 },
      { roster_adds: { coverage_type: "week", coverage_value: 1, value } }] });
    expect(yahooPlanningAcquisitions(args).counter.used).toBe(value === 0 || value === "0" ? 0 : null);
  });
  it.each([undefined, null, 0, "0", -1, "-1", "unlimited", ""])("keeps unverified limit encoding %s unknown", value => {
    const args = acquisitionInputs();
    args.settings = args.response({ settings: value === undefined ? {} : { max_weekly_adds: value } });
    const evidence = yahooPlanningAcquisitions(args);
    expect(evidence.limit).toEqual({ present: value !== undefined, reportedValue: value ?? null, verified: false });
    expect(evidence.remaining).toBeNull();
    expect(evidence.counter.used).toBe(3);
  });
  it("rejects stale, absent, wrong-scope and non-week counters without using season moves", () => {
    const args = acquisitionInputs();
    for (const team of [null, args.response({ team: [{ team_key: args.teamKey }, { is_owned_by_current_login: 1 }, { number_of_moves: 999 }] }),
      { ...args.team, transport: { ...args.team.transport, ageSeconds: 61 } },
      { ...args.team, transport: { ...args.team.transport, ageSeconds: -1 } },
      { ...args.team, transport: { ...args.team.transport, responseDate: "2026-09-30T00:00:00Z" } },
      args.response({ team: [{ team_key: "453.l.2.t.1" }, { is_owned_by_current_login: 1 }, { roster_adds: { coverage_type: "week", coverage_value: 1, value: 3 } }] }),
      args.response({ team: [{ team_key: args.teamKey }, { is_owned_by_current_login: 0 }, { roster_adds: { coverage_type: "week", coverage_value: 1, value: 3 } }] }),
      args.response({ team: [{ team_key: args.teamKey }, { is_owned_by_current_login: 1 }, { roster_adds: { coverage_type: "season", coverage_value: 1, value: 3 } }] }),
    ]) expect(yahooPlanningAcquisitions({ ...args, team }).counter.used).toBeNull();
    expect(yahooPlanningAcquisitions({ ...args, league: null }).counter.used).toBeNull();
  });
  it("requires current-week coverage and contained custom dates, not a historical scoreboard week", () => {
    const args = acquisitionInputs();
    expect(yahooPlanningAcquisitions({ ...args, endDate: "2026-10-05" }).counter.used).toBeNull();
    expect(yahooPlanningAcquisitions({ ...args, weeks: [] }).counter.used).toBeNull();
    expect(yahooPlanningAcquisitions({ ...args, weeks: [...args.weeks, ...args.weeks] }).counter.used).toBeNull();
    args.now.setTime(Date.parse("2027-01-20T12:00:00Z"));
    args.league = args.response({ league: [{ league_key: args.leagueKey }, { current_week: 17 }] });
    args.team = args.response({ team: [{ team_key: args.teamKey }, { is_owned_by_current_login: 1 }, { roster_adds: { coverage_type: "week", coverage_value: 17, value: 3 } }] });
    args.weeks.push({ gameKey: "453", week: 17, startDate: "2027-01-18", endDate: "2027-01-24" });
    expect(yahooPlanningAcquisitions(args).counter.used).toBeNull();
    expect(yahooPlanningAcquisitions({ ...args, startDate: "2027-01-20", endDate: "2027-01-22" }).counter.used).toBe(3);
    args.team = args.response({ team: [{ team_key: args.teamKey }, { is_owned_by_current_login: 1 }, { roster_adds: { coverage_type: "week", coverage_value: 1, value: 3 } }] });
    expect(yahooPlanningAcquisitions({ ...args, startDate: "2027-01-20", endDate: "2027-01-22" }).counter.used).toBeNull();
  });
  it("validates nested standard-JSON collections and Yahoo's empty-array representation", () => {
    const player = { player: [[{ player_key: "453.p.2001" }], { selected_position: [{ position: "C" }] }] };
    expect(yahooPlanningPlayers({ roster: { 0: { players: { count: 1, 0: player } } } })).toHaveLength(1);
    expect(yahooPlanningPlayers({ roster: { 0: { players: [] } } })).toEqual([]);
    expect(() => yahooPlanningPlayers({ roster: { 0: { players: { count: 2, 0: player } } } })).toThrow("incomplete player list");
    expect(() => yahooPlanningPlayers({ roster: {} })).toThrow("incomplete player list");
  });
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
  it.each([false, true])("reads nested roster collections and leaves acquisition timing unknown (empty: %s)", async (empty) => {
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
          return { data: start === 0 ? Array.from({ length: 1000 }, (_, index) => ({ nhl_player_id: index + 1, yahoo_player_id: index + 1 })) : [
            { nhl_player_id: "2001", yahoo_player_id: "453.p.2001" },
            { nhl_player_id: "2002", yahoo_player_id: "453.p.2002" },
            { nhl_player_id: "2001", yahoo_player_id: "465.p.9999" },
            { nhl_player_id: "9999", yahoo_player_id: "465.p.2001" },
          ], error: null };
        },
      };
      return query;
    } };
    const now = new Date("2026-10-01T12:00:00Z");
    const transport = { responseDate: now.toISOString(), ageSeconds: 0 };
    mocks.planningData.mockResolvedValue({ players: [
      { id: "canonical", nhlId: 2001, providerId: null, name: "Mapped Player", teamAbbreviation: "TOR", eligiblePositions: ["C"], eligibilityVerified: false, playerClass: "skater", availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] },
      { id: "candidate", nhlId: 2002, providerId: null, name: "Available Player", teamAbbreviation: "OTT", eligiblePositions: ["C"], eligibilityVerified: false, playerClass: "skater", availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] },
    ], games: [], forecasts: [], baselineSources: [{ sourceId: "shared-rate" }], forecastManifest: { id: "shared-manifest" }, evidence: {} });
    mocks.settings.mockReturnValue({ rosterType: "date", weeklyDeadline: "intraday", rosterConfig: { C: 1 }, scoringTypeRecognized: true, unsupportedStatIds: [], unsupportedRosterSlots: [], leagueType: "points", scoringCategories: {}, categoryWeights: {}, minimumGoalieStarts: null });
    mocks.draftResource.mockResolvedValue({ payload: { league_key: "453.l.1", time_zone: "UTC", draft_status: empty ? "predraft" : "postdraft" }, transport });
    mocks.boardResource.mockImplementation(async ({ resource }: any) => {
      if (resource.type !== "roster") throw new Error("Optional league roster read unavailable");
      return { payload: { team_key: "453.l.1.t.1", is_owned_by_current_login: "1", roster: { date: "2026-10-01", coverage_type: "date", is_editable: "1", 0: { players: empty ? [] : { count: 1, 0: { player: [{ player_key: "453.p.2001" }, { selected_position: [{ position: "C" }] }] } } } } }, transport };
    });
    mocks.planningResource.mockImplementation(async ({ resource }: any) => {
      if (resource.type !== "available_page") throw new Error("Optional scoreboard read unavailable");
      return { payload: { league_key: "453.l.1", players: { count: 1, 0: { player: [{ player_key: "453.p.2002" }, { ownership: { ownership_type: "freeagents" } }] } } }, transport };
    });
    const actual = await vi.importActual<typeof import("./rosterPlanning")>("./rosterPlanning");
    if (empty) {
      await expect(actual.loadYahooPlanningSnapshot({ db: db as any, userId: "owner-a", teamId: "team-a", startDate: "2026-10-01", endDate: "2026-10-07", now })).rejects.toMatchObject({ statusCode: 409, code: "yahoo_roster_empty", message: expect.stringContaining("pre-draft") });
      expect(mappingRanges).toEqual([]);
      return;
    }
    const result = await actual.loadYahooPlanningSnapshot({ db: db as any, userId: "owner-a", teamId: "team-a", startDate: "2026-10-01", endDate: "2026-10-07", now });
    expect(mappingRanges).toEqual([[0, 999], [1000, 1999]]);
    expect(result.snapshot.roster).toEqual([{ playerId: "canonical", position: "active" }]);
    expect(result.snapshot.players[0].eligibilityVerified).toBe(false);
    expect(result.snapshot.players[1].eligibilityVerified).toBe(false);
    expect(result.snapshot.baselineSources).toEqual([{ sourceId: "shared-rate" }]);
    expect(result.snapshot.forecastManifest).toEqual({ id: "shared-manifest" });
    expect(result.snapshot.rules.acquisitionTiming).toBe("unknown");
    expect(result.snapshot.lockedAssignments).toEqual([{ date: "2026-10-01", playerId: "canonical", slotId: "C#1" }]);
    expect(result.capabilities.availability).toBe(true);
    mocks.boardResource.mockImplementation(async ({ resource }: any) => {
      if (resource.type !== "roster") throw new Error("Optional league roster read unavailable");
      return { payload: { team_key: "453.l.1.t.1", is_owned_by_current_login: "1", roster: { date: "2026-10-01", coverage_type: "date", is_editable: "1",
        0: { players: { count: 1, 0: { player: [{ player_key: "453.p.2001" }, { selected_position: [{ position: "C" }] }, { eligible_positions: { position: "C" } }] } } } } }, transport };
    });
    mocks.planningResource.mockImplementation(async ({ resource }: any) => {
      if (resource.type !== "available_page") throw new Error("Optional scoreboard read unavailable");
      return { payload: { league_key: "453.l.1", players: { count: 1, 0: { player: [{ player_key: "453.p.2002" }, { ownership: { ownership_type: "freeagents" } }, { eligible_positions: { position: "C" } }] } } }, transport };
    });
    const verified = await actual.loadYahooPlanningSnapshot({ db: db as any, userId: "owner-a", teamId: "team-a", startDate: "2026-10-01", endDate: "2026-10-07", now });
    expect(verified.snapshot.players[0].eligibilityVerified).toBe(true);
    expect(verified.snapshot.players[1].eligibilityVerified).toBe(true);
    const availabilityRead = mocks.planningResource.getMockImplementation()!;
    mocks.planningResource.mockImplementation(async (args: any) => args.resource.type === "league"
      ? { payload: { league: [{ league_key: "453.l.1" }, { current_week: "1" }] }, transport }
      : args.resource.type === "team" ? { payload: { team: [{ team_key: "453.l.1.t.1" }, { is_owned_by_current_login: "1" },
        { roster_adds: { coverage_type: "week", coverage_value: "1", value: "0" } }] }, transport } : availabilityRead(args));
    mocks.planningData.mockResolvedValue({ ...await mocks.planningData(), matchupWeeks: [{ gameKey: "453", week: 1, startDate: "2026-09-29", endDate: "2026-10-04" }] });
    const counted = await actual.loadYahooPlanningSnapshot({ db: db as any, userId: "owner-a", teamId: "team-a", startDate: "2026-10-01", endDate: "2026-10-03", now });
    expect(counted.snapshot.acquisitionEvidence?.counter.used).toBe(0);
    expect(counted.snapshot.acquisitionEvidence?.remaining).toBeNull();
    expect(counted.snapshot.rules.periods).toEqual([]);
    expect(counted.capabilities.acquisitions).toBe(false);
    expect(mocks.planningResource).toHaveBeenCalledWith(expect.objectContaining({ resource: { type: "team", teamKey: "453.l.1.t.1" } }));

  });
});

describe("provider snapshot route", () => {
  it("returns curated provider diagnostics while keeping raw exceptions private", async () => {
    mocks.allowed = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      mocks.snapshot.mockRejectedValueOnce(new YahooLiveDraftError("Yahoo returned an incomplete player list.", 502, "yahoo_player_collection_incomplete"));
      const typed = res(); await providerHandler(req("POST", { provider: "yahoo", teamId: "selected", startDate: "2026-10-01", endDate: "2026-10-07" }), typed);
      expect(typed.statusCode).toBe(502);
      expect(typed.body).toMatchObject({ error: "Yahoo returned an incomplete player list.", code: "yahoo_player_collection_incomplete" });
      mocks.snapshot.mockRejectedValueOnce(new Error("private upstream response"));
      const raw = res(); await providerHandler(req("POST", { provider: "yahoo", teamId: "selected", startDate: "2026-10-01", endDate: "2026-10-07" }), raw);
      expect(raw.statusCode).toBe(503);
      expect(raw.body.error).not.toContain("private upstream response");
      expect(JSON.stringify(log.mock.calls)).not.toContain("private upstream response");
    } finally { log.mockRestore(); }
  });
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


it("retries one timeout for required planning reads but never retries rate limits", async () => {
  const { readRequiredPlanningResource } = await import("./rosterPlanning");
  const { YahooLiveDraftError } = await import("./liveDraft");
  const read = vi.fn().mockRejectedValueOnce(new YahooLiveDraftError("timeout", 502, "yahoo_api_timeout")).mockResolvedValue("roster");
  expect(await readRequiredPlanningResource(read)).toBe("roster");
  expect(read).toHaveBeenCalledTimes(2);
  const limited = vi.fn().mockRejectedValue(new YahooLiveDraftError("limited", 429, "yahoo_rate_limited"));
  await expect(readRequiredPlanningResource(limited)).rejects.toThrow("limited");
  expect(limited).toHaveBeenCalledTimes(1);
});
