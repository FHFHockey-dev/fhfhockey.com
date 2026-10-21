import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluatePlan } from "lib/rosterScheduleOptimizer/planning";
import { acquisitionEffectiveAt } from "lib/rosterScheduleOptimizer/planningTimeline";
import { supplementProviderRules } from "lib/rosterScheduleOptimizer/providerRules";
import { defaultIntent } from "lib/rosterScheduleOptimizer/workspace";
import { candidatePlanMetrics } from "lib/rosterScheduleOptimizer/candidatePlanMetrics";

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

import { yahooCreditedGoalieAppearances, yahooInjury, yahooPastLineupPoints, yahooPlanningAcquisitions, yahooPlanningCategories, yahooPlanningEditable, yahooPlanningPlayers, yahooPlanningStats, yahooPlanningTeams } from "./rosterPlanning";
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
  it("derives remaining weekly adds from a positive limit and the scoped weekly counter, not season moves", () => {
    const args = acquisitionInputs(), evidence = yahooPlanningAcquisitions(args);
    expect(evidence.counter).toEqual({ present: true, coverageType: "week", coverageWeek: 1, reportedValue: "3", used: 3 });
    expect(evidence.period).toEqual({ week: 1, startDate: "2026-09-29", endDate: "2026-10-04", containsHorizon: true });
    expect(evidence.limit).toEqual({ present: true, reportedValue: "5", verified: true });
    expect(evidence.remaining).toBe(2);
    expect(evidence.limitations).toEqual([]);
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
    expect(evidence.limitations).toContain("Yahoo did not report a positive weekly add limit. Remaining allowance is unknown; zero is not assumed to mean unlimited.");
  });
  it("derives three remaining adds from the Oct 16 Yahoo capture values (limit 4, week counter 1)", () => {
    const args = acquisitionInputs();
    args.settings = args.response({ settings: { max_weekly_adds: "4", weekly_deadline: "intraday" } });
    args.team = args.response({ team: [{ team_key: args.teamKey }, { is_owned_by_current_login: 1 },
      { roster_adds: { coverage_type: "week", coverage_value: 1, value: "1" } }] });
    expect(yahooPlanningAcquisitions(args)).toMatchObject({ remaining: 3, limit: { present: true, reportedValue: "4", verified: true },
      counter: { used: 1, coverageWeek: 1 }, limitations: [] });
  });
  it("keeps remaining unknown when weekly usage exceeds the limit or the counter is unverified", () => {
    const args = acquisitionInputs();
    args.settings = args.response({ settings: { max_weekly_adds: "2" } });
    expect(yahooPlanningAcquisitions(args)).toMatchObject({ remaining: null, limit: { verified: true },
      limitations: ["Yahoo weekly adds used exceed the reported weekly limit; remaining allowance is unknown."] });
    args.settings = args.response({ settings: { max_weekly_adds: "5" } });
    expect(yahooPlanningAcquisitions({ ...args, endDate: "2026-10-05" }).remaining).toBeNull();
    expect(yahooPlanningAcquisitions({ ...args, league: null }).remaining).toBeNull();
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
    const future = yahooPlanningAcquisitions({ ...args, startDate: "2026-10-05", endDate: "2026-10-11",
      weeks: [...args.weeks, { gameKey: "453", week: 2, startDate: "2026-10-05", endDate: "2026-10-11" }] });
    expect(future.counter.used).toBeNull();
    expect(future.remaining).toBeNull();
    expect(future.period.containsHorizon).toBe(false);
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
  it.each(["deadline", "failed-next-page", "stale-next-page", "wrong-league-next-page", "repeated-next-page", "unmapped", "ambiguous", "foreign-game", "eligibility-only", "availability-only", "class-mismatch"])("keeps individually verified partial discovery facts (%s)", async mode => {
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected network request in synthetic discovery test"));
    let elapsed = 0;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => elapsed);
    const starts: number[] = [];
    const stopsAfterFirstPage = ["deadline", "unmapped", "ambiguous", "foreign-game", "eligibility-only", "availability-only", "class-mismatch"].includes(mode);
    try {
      const mapping = [{ nhl_player_id: "1", yahoo_player_id: "453.p.1" },
        ...(mode === "unmapped" ? [] : [{ nhl_player_id: "2", yahoo_player_id: "453.p.2" }]),
        { nhl_player_id: "3", yahoo_player_id: "453.p.3" },
        ...(mode === "ambiguous" ? [{ nhl_player_id: "99", yahoo_player_id: "453.p.2" }] : [])];
      const db = { from(table: string) {
        const query = { select() { return query; }, order() { return query; }, eq() { return query; },
          async maybeSingle() { return { data: table === "external_teams"
            ? { id: "team-a", team_metadata: { is_owned: true }, connected_account_id: "account-a", external_league_id: "league-a", external_team_key: "453.l.1.t.1" }
            : { id: "league-a", connected_account_id: "account-a", external_league_key: "453.l.1" }, error: null }; },
          async range() { return { data: mapping, error: null }; } };
        return query;
      } };
      const now = new Date("2026-10-01T12:00:00Z");
      const transport = { responseDate: now.toISOString(), ageSeconds: 0 };
      mocks.planningData.mockImplementation(async () => ({ players: [1, 2, 3, 4].map(id => ({ id: `canonical-${id}`, nhlId: id,
        name: `Player ${id}`, teamAbbreviation: "TOR", eligiblePositions: ["C"], eligibilityVerified: false,
        playerClass: "skater", availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] })),
        games: [{ id: "game", date: "2026-10-02", startsAt: "2026-10-02T23:00:00Z", teamAbbreviation: "TOR", opponent: "OTT", home: true, status: "scheduled" }],
        forecasts: [], evidence: { schedule: { source: "Synthetic partial schedule", asOf: now.toISOString(), seasonId: 20262027, completeness: "partial", limitations: [] } } }));
      mocks.settings.mockReturnValue({ rosterType: "date", rosterConfig: { C: 1, BN: 1 }, scoringTypeRecognized: true,
        unsupportedStatIds: [], unsupportedRosterSlots: [], leagueType: "points", scoringCategories: { GOALS: 1 }, categoryWeights: {}, minimumGoalieStarts: null });
      mocks.draftResource.mockResolvedValue({ payload: { league_key: "453.l.1", time_zone: "UTC" }, transport });
      mocks.boardResource.mockImplementation(async ({ resource }: any) => {
        if (resource.type !== "roster") throw new Error("Synthetic optional read unavailable");
        return { payload: { team_key: "453.l.1.t.1", is_owned_by_current_login: "1", roster: { date: "2026-10-01", coverage_type: "date", is_editable: "1",
          players: { count: 1, 0: { player: [{ player_key: "453.p.1" }, { eligible_positions: { position: "C" } }, { selected_position: { position: "C" } }, { is_editable: "1" }] } } } }, transport };
      });
      mocks.planningResource.mockImplementation(async ({ resource }: any) => {
        if (resource.type !== "available_page") throw new Error("Synthetic optional read unavailable");
        starts.push(resource.start);
        if (resource.start && mode === "failed-next-page") throw new Error("Synthetic later page failure");
        const ids = resource.start ? [2] : [2, 3, ...Array.from({ length: 23 }, (_, index) => 100 + index)];
        if (stopsAfterFirstPage) elapsed = 8000;
        return { payload: { league_key: resource.start && mode === "wrong-league-next-page" ? "453.l.other" : "453.l.1",
          players: { count: ids.length, ...Object.fromEntries(ids.map((id, index) => [index, { player: [
            { player_key: `${mode === "foreign-game" && id === 2 ? "452" : "453"}.p.${id}` },
            { eligible_positions: id === 2 && mode === "availability-only" ? undefined : { position: id === 2 && mode === "class-mismatch" ? "G" : "LW" } },
            { ownership: id === 2 && mode === "eligibility-only" ? {} : { ownership_type: "freeagents" } },
          ] }])) } }, transport: resource.start && mode === "stale-next-page" ? { ...transport, ageSeconds: 61 } : transport };
      });
      const actual = await vi.importActual<typeof import("./rosterPlanning")>("./rosterPlanning");
      const result = await actual.loadYahooPlanningSnapshot({ db: db as any, userId: "owner-a", teamId: "team-a", startDate: "2026-10-01", endDate: "2026-10-03", now });
      expect(result.capabilities.availability).toBe(false);
      expect(result.snapshot.evidence.availability?.completeness).toBe("partial");
      expect(starts).toEqual(stopsAfterFirstPage ? [0] : [0, 25, 50, 75]);
      const candidate = result.snapshot.players.find(player => player.id === "canonical-2")!;
      const unresolved = ["unmapped", "ambiguous", "foreign-game"].includes(mode);
      expect(candidate.eligibilityVerified).toBe(!unresolved && mode !== "availability-only");
      expect(candidate.availability).toBe(unresolved || ["repeated-next-page", "eligibility-only"].includes(mode) ? "unknown" : "free_agent");
      expect(candidate.eligiblePositions).toEqual(unresolved || mode === "availability-only" ? ["C"] : mode === "class-mismatch" ? ["G"] : ["LW"]);
      expect(result.snapshot.players.find(player => player.id === "canonical-3")).toMatchObject({ eligibilityVerified: true, eligiblePositions: ["LW"], availability: "free_agent" });
      expect(result.snapshot.players.find(player => player.id === "canonical-4")).toMatchObject({ eligibilityVerified: false, availability: "unknown" });
      expect(result.snapshot.roster).toEqual([{ playerId: "canonical-1", position: "active" }]);
      const metrics = candidatePlanMetrics(result.snapshot, defaultIntent(), { maxCandidates: 1 });
      const known = metrics.diagnostics.find(row => row.playerId === "canonical-3")!;
      expect(known.reasons).not.toContain("League positional eligibility is unverified.");
      expect(known.reasons).not.toContain("League availability is not verified for acquisition.");
      expect(result.snapshot.rules.acquisitionTiming).toBe("unknown");
      expect(result.snapshot.rules.acquisitionCost).toBeNull();
      expect(result.snapshot.rules.periods).toEqual([]);
      const repeated = mode === "repeated-next-page";
      const matches = unresolved ? 1 : 2;
      const both = unresolved || repeated || ["eligibility-only", "availability-only", "class-mismatch"].includes(mode) ? 1 : 2;
      const eligibilityOnly = repeated || mode === "eligibility-only" ? 1 : 0;
      const availabilityOnly = ["availability-only", "class-mismatch"].includes(mode) ? 1 : 0;
      const stop = stopsAfterFirstPage ? "time budget" : repeated ? "end of list with repeated identities"
        : mode === "failed-next-page" ? "request failure" : mode === "stale-next-page" ? "unverified freshness" : "league scope mismatch";
      expect(result.capabilities.diagnostics).toContain(`Yahoo availability read: ${starts.length} pages attempted, ${mode === "failed-next-page" ? 1 : starts.length} returned, ${repeated ? 2 : 1} accepted; ${repeated ? 26 : 25} accepted rows, 25 unique, ${repeated ? 1 : 0} repeats. ${elapsed} ms elapsed; 8000 ms budget checked between page batches. Stopped: ${stop}.`);
      expect(result.capabilities.diagnostics).toContain(`Yahoo availability matches: ${matches} unique catalog matches, ${25 - matches} unmatched; 0 rostered/excluded, ${matches} candidate matches.`);
      expect(result.capabilities.diagnostics).toContain(`Yahoo provider catalog before search: 3 candidates; ${both} both known, ${eligibilityOnly} eligibility only, ${availabilityOnly} availability only, ${3 - both - eligibilityOnly - availabilityOnly} neither known. Eligibility means usable verified positions; availability means free agent or waivers. Discovery partial; unseen players remain unknown.`);
      expect(JSON.stringify(result.snapshot)).not.toContain("Yahoo availability read:");
      expect(result.capabilities.limitations.some(item => /^Yahoo (availability read|availability matches|provider catalog)/.test(item))).toBe(false);
      expect(mocks.planningResource).toHaveBeenCalledTimes(3 + starts.length);
      expect(mocks.boardResource).toHaveBeenCalledTimes(2);
      expect(mocks.draftResource).toHaveBeenCalledTimes(1);
      expect(network).not.toHaveBeenCalled();
    } finally { clock.mockRestore(); network.mockRestore(); }
  });
  it.each([
    { waiverDate: 1e100, clearsAt: null },
    { waiverDate: 8_640_000_000_001, clearsAt: null },
    { waiverDate: -8_640_000_000_001, clearsAt: null },
    { waiverDate: "invalid", clearsAt: null },
    { waiverDate: null, clearsAt: null },
    { waiverDate: Date.parse("2026-10-02T12:00:00Z") / 1000, clearsAt: "2026-10-02T12:00:00.000Z" },
  ])("preserves the roster when a candidate waiver date is $waiverDate", async ({ waiverDate, clearsAt }) => {
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected network request in synthetic waiver test"));
    try {
      const db = { from(table: string) {
        const query = {
          select() { return query; }, order() { return query; }, eq() { return query; },
          async maybeSingle() { return { data: table === "external_teams"
            ? { id: "team-a", team_metadata: { is_owned: true }, connected_account_id: "account-a", external_league_id: "league-a", external_team_key: "453.l.1.t.1" }
            : { id: "league-a", connected_account_id: "account-a", external_league_key: "453.l.1" }, error: null }; },
          async range() { return { data: [{ nhl_player_id: 1, yahoo_player_id: 1 }, { nhl_player_id: 2, yahoo_player_id: 2 }], error: null }; },
        };
        return query;
      } };
      const now = new Date("2026-10-01T12:00:00Z");
      const transport = { responseDate: now.toISOString(), ageSeconds: 0 };
      mocks.planningData.mockResolvedValue({ players: [1, 2].map(id => ({ id: `player-${id}`, nhlId: id, name: `Player ${id}`,
        teamAbbreviation: "TOR", eligiblePositions: ["C"], eligibilityVerified: false, playerClass: "skater", availability: "unknown",
        ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] })), games: [], forecasts: [], evidence: {} });
      mocks.settings.mockReturnValue({ rosterType: "date", rosterConfig: { C: 1 }, scoringTypeRecognized: true,
        unsupportedStatIds: [], unsupportedRosterSlots: [], leagueType: "points", scoringCategories: {}, categoryWeights: {}, minimumGoalieStarts: null });
      mocks.draftResource.mockResolvedValue({ payload: { league_key: "453.l.1", time_zone: "UTC" }, transport });
      mocks.boardResource.mockImplementation(async ({ resource }: any) => {
        if (resource.type !== "roster") throw new Error("Synthetic optional read unavailable");
        return { payload: { team_key: "453.l.1.t.1", is_owned_by_current_login: "1",
          roster: { date: "2026-10-01", coverage_type: "date", is_editable: "1", players: { count: 1,
            0: { player: [{ player_key: "453.p.1" }, { selected_position: { position: "C" } }, { eligible_positions: { position: "C" } }, { is_editable: "1" }] } } } }, transport };
      });
      mocks.planningResource.mockImplementation(async ({ resource }: any) => {
        if (resource.type !== "available_page") throw new Error("Synthetic optional read unavailable");
        return { payload: { league_key: "453.l.1", players: { count: 1,
          0: { player: [{ player_key: "453.p.2" }, { ownership: { ownership_type: "waivers", waiver_date: waiverDate } }, { eligible_positions: { position: "C" } }] } } }, transport };
      });
      const actual = await vi.importActual<typeof import("./rosterPlanning")>("./rosterPlanning");
      const result = await actual.loadYahooPlanningSnapshot({ db: db as any, userId: "owner-a", teamId: "team-a", startDate: "2026-10-01", endDate: "2026-10-03", now });
      expect(result.snapshot.roster).toEqual([{ playerId: "player-1", position: "active" }]);
      const candidate = result.snapshot.players.find(player => player.id === "player-2")!;
      expect(candidate).toMatchObject({ availability: "waivers", waiverClearsAt: clearsAt });
      expect(acquisitionEffectiveAt({ ...result.snapshot, rules: { ...result.snapshot.rules, acquisitionTiming: "same_day" } }, candidate, now.toISOString())).toBe(clearsAt);
      expect(result.capabilities).toMatchObject({ roster: true, rules: false, acquisitions: false });
      expect(result.snapshot.acquisitionEvidence?.remaining).toBeNull();
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });
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
    expect(result.snapshot.pastLineups).toEqual([]);

    // Elapsed matchup days come from Yahoo's recorded lineups, display-only; a failed day is disclosed, not invented.
    mocks.boardResource.mockImplementation(async ({ resource }: any) => {
      if (resource.type !== "roster") throw new Error("Optional league roster read unavailable");
      if (resource.date === "2026-09-29") throw new Error("Past roster read unavailable");
      const past = resource.date !== "2026-10-01";
      return { payload: { team_key: "453.l.1.t.1", is_owned_by_current_login: "1", roster: { date: resource.date, coverage_type: "date", is_editable: "1",
        0: { players: { count: past ? 2 : 1, 0: { player: [{ player_key: "453.p.2001" }, { selected_position: [{ position: "C" }] }] },
          ...(past ? { 1: { player: [{ player_key: "453.p.7777" }, { name: { full: "Gone Player" } }, { selected_position: [{ position: "BN" }] }] } } : {}) } } } }, transport };
    });
    const withPast = await actual.loadYahooPlanningSnapshot({ db: db as any, userId: "owner-a", teamId: "team-a", startDate: "2026-09-28", endDate: "2026-10-04", now });
    const recorded = [{ playerId: "canonical", name: "Mapped Player", position: "C", slotId: "C#1", points: null }, { playerId: null, name: "Gone Player", position: "BN", slotId: null, points: null }];
    expect(withPast.snapshot.pastLineups).toEqual([{ date: "2026-09-28", source: "yahoo", entries: recorded }, { date: "2026-09-30", source: "yahoo", entries: recorded }]);
    expect(withPast.snapshot.evidence.roster.limitations).toContain("Yahoo's recorded lineup for 2026-09-29 could not be read; that day shows no lineup.");
    expect(withPast.snapshot.lockedAssignments).toEqual([{ date: "2026-10-01", playerId: "canonical", slotId: "C#1" }]);
    const readsBefore = mocks.boardResource.mock.calls.length;
    const again = await actual.loadYahooPlanningSnapshot({ db: db as any, userId: "owner-a", teamId: "team-a", startDate: "2026-09-28", endDate: "2026-10-04", now });
    expect(again.snapshot.pastLineups?.map(day => day.date)).toEqual(["2026-09-28", "2026-09-30"]);
    // Recorded days already read are reused; only today's roster and the failed day go back to Yahoo.
    expect(mocks.boardResource.mock.calls.slice(readsBefore).map(([args]: any) => args.resource).filter((resource: any) => resource.type === "roster")
      .map((resource: any) => resource.date).sort()).toEqual(["2026-09-29", "2026-10-01"]);

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
    expect(counted.capabilities.limitations).toContain("Verify remaining acquisitions, reset periods and counting rules and goalie minimum progress; these are not inferred from season transaction totals.");
    expect(counted.capabilities.limitations.some(item => /time zone/i.test(item))).toBe(false);
    mocks.draftResource.mockResolvedValue({ payload: { league_key: "453.l.1", draft_status: "postdraft", max_weekly_adds: "4" }, transport });
    const limited = await actual.loadYahooPlanningSnapshot({ db: db as any, userId: "owner-a", teamId: "team-a", startDate: "2026-10-01", endDate: "2026-10-03", timeZone: "America/New_York", now });
    expect(limited.snapshot.acquisitionEvidence).toMatchObject({ remaining: 4, limit: { verified: true } });
    expect(limited.snapshot.rules).toMatchObject({ acquisitionCost: 1, periods: [{ id: "yahoo-week-1", start: "2026-09-29T04:00:00.000Z",
      end: "2026-10-05T04:00:00.000Z", remaining: 4, source: "provider", timeZone: "America/New_York" }] });
    // The goalie minimum covers the same matchup week; its end date is exclusive.
    expect(limited.snapshot.rules.goalieMinimum).toMatchObject({ periodStart: "2026-09-29", periodEnd: "2026-10-05" });
    expect(limited.capabilities.acquisitions).toBe(true);
    expect(limited.capabilities.limitations).toContain("Verify goalie minimum progress; these are not inferred from season transaction totals.");
    expect(limited.capabilities.limitations.some(item => /weekly add limit|remaining acquisitions|time zone/i.test(item))).toBe(false);
    const beyondWeek = await actual.loadYahooPlanningSnapshot({ db: db as any, userId: "owner-a", teamId: "team-a", startDate: "2026-10-01", endDate: "2026-10-07", timeZone: "America/New_York", now });
    expect(beyondWeek.snapshot.rules).toMatchObject({ acquisitionCost: null, periods: [] });
    mocks.draftResource.mockResolvedValue({ payload: { league_key: "453.l.1", draft_status: "postdraft" }, transport });
    const unknownZone = await actual.loadYahooPlanningSnapshot({ db: db as any, userId: "owner-a", teamId: "team-a", startDate: "2026-10-01", endDate: "2026-10-03", now });
    expect(unknownZone.capabilities.limitations).toContain("League time zone is unknown; UTC is a display fallback and timing requires verification.");

    mocks.draftResource.mockResolvedValue({ payload: { league_key: "453.l.1", time_zone: "America/New_York", draft_status: "postdraft" }, transport });
    const normalized = await actual.loadYahooPlanningSnapshot({ db: db as any, userId: "owner-a", teamId: "team-a",
      startDate: "2026-10-01", endDate: "2026-10-03", timeZone: "UTC", now });
    expect(normalized.snapshot.context.timeZone).toBe("America/New_York");
    expect(mocks.planningData).toHaveBeenLastCalledWith(db, expect.objectContaining({ timeZone: "America/New_York" }), { now, forgeDailyBridge: true });
    mocks.draftResource.mockResolvedValue({ payload: { league_key: "453.l.1", time_zone: "UTC", draft_status: "postdraft" }, transport });

    for (const mode of ["repeated", "oversized", "stale", "wrong-scope", "failed", "rate-limited", "optional-limited", "deadline", "bounded", "ownership-only"]) {
      const starts: number[] = [];
      const clock = mode === "deadline" ? vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(8000) : null;
      mocks.planningResource.mockImplementation(async ({ resource }: any) => {
        if (resource.type !== "available_page") {
          if (mode === "optional-limited") throw new YahooLiveDraftError("Slow down.", 429, "yahoo_rate_limited", resource.type === "team" ? 3600 : 1200);
          throw new Error("Optional availability read failed");
        }
        if (mode === "failed") throw new Error("Optional availability read failed");
        starts.push(resource.start);
        if (mode === "rate-limited") throw new YahooLiveDraftError("Slow down.", 429, "yahoo_rate_limited", 3600);
        const ids = mode === "bounded" ? Array.from({ length: 25 }, (_, index) => 2002 + resource.start + index)
          : mode === "repeated" && resource.start === 0 ? [2002, ...Array.from({ length: 24 }, (_, index) => 2100 + index)]
            : mode === "oversized" ? Array.from({ length: 26 }, (_, index) => 2002 + index) : [2002];
        const rows = ids.map(id => [{ player_key: `453.p.${id}` },
          { ownership: mode === "ownership-only" ? { percent_owned: "1" } : { ownership_type: "freeagents" } }]);
        return { payload: { league_key: mode === "wrong-scope" ? "453.l.other" : "453.l.1",
          players: { count: rows.length, ...Object.fromEntries(rows.map((row, index) => [index, { player: row }])) } },
          transport: mode === "stale" ? { ...transport, ageSeconds: 61 } : transport };
      });
      try {
        const partial = await actual.loadYahooPlanningSnapshot({ db: db as any, userId: "owner-a", teamId: "team-a", startDate: "2026-10-01", endDate: "2026-10-03", now });
        expect(partial.capabilities.availability, mode).toBe(mode === "ownership-only");
        expect(partial.snapshot.evidence.availability?.completeness, mode).toBe(mode === "ownership-only" ? "complete" : "partial");
        expect(partial.snapshot.players.find(row => row.id === "candidate")?.availability, mode).toBe(mode === "bounded" ? "free_agent" : "unknown");
        if (mode === "repeated") {
          expect(starts).toEqual([0, 25, 50, 75]);
          expect(partial.capabilities.limitations.join(" ")).toContain("repeated identities remain unknown");
        }
        if (mode === "deadline") {
          expect(starts).toEqual([]);
          expect(partial.capabilities.limitations.join(" ")).toContain("time budget");
        }
        if (mode === "rate-limited" || mode === "optional-limited") {
          expect(partial).toMatchObject({ code: "yahoo_rate_limited", retryAfterSeconds: 3600 });
          expect(starts).toEqual(mode === "rate-limited" ? [0] : []);
        }
        if (mode === "bounded") {
          expect(starts).toHaveLength(81);
          expect(starts.at(-1)).toBe(2000);
          expect(partial.capabilities.limitations.join(" ")).toContain("did not reach the end");
        }
      } finally { clock?.mockRestore(); }
    }

    mocks.settings.mockReturnValue({ ...mocks.settings(), excludedInjurySlots: { "IR-LT": 1 } });
    const activeOnly = await actual.loadYahooPlanningSnapshot({ db: db as any, userId: "owner-a", teamId: "team-a", startDate: "2026-10-01", endDate: "2026-10-03", now });
    expect(activeOnly.snapshot.rules.rosterSlots).not.toHaveProperty("IR-LT");
    const activeHold = evaluatePlan(activeOnly.snapshot, defaultIntent(), "agp");
    expect(activeHold.legal, activeHold.limitations.join(" ")).toBe(true);

    mocks.settings.mockReturnValue({ ...mocks.settings(), excludedInjurySlots: { "IR+": 2, IR: 1, NA: 1, "IR-LT": 1 } });
    mocks.planningData.mockResolvedValue({ ...await mocks.planningData(), games: [
      { id: "reserved-game", date: "2026-10-02", startsAt: "2026-10-02T23:00:00Z", teamAbbreviation: "TOR", opponent: "OTT", home: true, status: "scheduled" },
    ] });
    mocks.boardResource.mockImplementation(async ({ resource }: any) => {
      if (resource.type !== "roster") throw new Error("Optional league roster read unavailable");
      return { payload: { team_key: "453.l.1.t.1", is_owned_by_current_login: "1", roster: { date: "2026-10-01", coverage_type: "date", is_editable: "1",
        0: { players: { count: 2, ...Object.fromEntries([2001, 2002].map((id, index) => [index, { player: [
          { player_key: `453.p.${id}` }, { selected_position: [{ position: "IR+" }] }, { eligible_positions: [{ position: "C" }, { position: "IR+" }] },
        ] }])) } } } }, transport };
    });
    mocks.planningResource.mockRejectedValue(new Error("Optional planning read unavailable"));
    const reserved = await actual.loadYahooPlanningSnapshot({ db: db as any, userId: "owner-a", teamId: "team-a", startDate: "2026-10-01", endDate: "2026-10-03", now });
    expect(reserved.snapshot.rules.rosterSlots).toMatchObject({ "IR+": 2, IR: 1, NA: 1 });
    expect(reserved.snapshot.rules.rosterSlots).not.toHaveProperty("IR-LT");
    expect(reserved.snapshot.roster).toEqual([{ playerId: "canonical", position: "IR+" }, { playerId: "candidate", position: "IR+" }]);
    const hold = evaluatePlan(reserved.snapshot, defaultIntent(), "agp");
    expect(hold.legal, hold.limitations.join(" ")).toBe(true);
    expect(hold.activeGames).toBe(0);
    expect(hold.assignments).toEqual([]);
    expect(reserved.snapshot.rules.periods).toEqual([]);
    expect(reserved.snapshot.acquisitionEvidence?.remaining).toBeNull();
    expect(reserved.capabilities.acquisitions).toBe(false);
    const supplemented = supplementProviderRules(reserved.snapshot, { rosterSlots: { "IR+": 1 }, goalieMinimum: { required: 3, counts: "appearances" } });
    expect(supplemented.snapshot.rules.rosterSlots["IR+"]).toBe(2);
    expect(supplemented.conflicts).toContain("IR+ roster slots differs from the manager input; provider setting retained.");
    expect(supplemented.snapshot.evidence.managerRules?.source).toBe("manager-supplied");
    expect(supplemented.snapshot.rules.goalieMinimum).toMatchObject({ required: 3, counts: "appearances", credited: null });
    expect(supplemented.snapshot.rules.periods).toEqual([]);
    expect(supplemented.snapshot.acquisitionEvidence?.remaining).toBeNull();
    expect(evaluatePlan(supplemented.snapshot, defaultIntent(), "agp").goalie.minimumSatisfied).toBe(false);
  });
});

describe("provider snapshot route", () => {
  it("propagates curated cooldowns for required failures and partial snapshots", async () => {
    mocks.allowed = true;
    mocks.snapshot.mockRejectedValueOnce(new YahooLiveDraftError("Slow down.", 429, "yahoo_rate_limited", 3600));
    const limited = res(); await providerHandler(req("POST", { provider: "yahoo", teamId: "selected", startDate: "2026-10-01", endDate: "2026-10-07" }), limited);
    expect(limited.statusCode).toBe(429);
    expect(limited.body).toMatchObject({ success: false, code: "yahoo_rate_limited", retryAfterSeconds: 3600 });
    mocks.snapshot.mockResolvedValueOnce({ snapshot: { id: "partial" }, capabilities: { availability: false }, code: "yahoo_rate_limited", retryAfterSeconds: 1200 });
    const partial = res(); await providerHandler(req("POST", { provider: "yahoo", teamId: "selected", startDate: "2026-10-01", endDate: "2026-10-07" }), partial);
    expect(partial.body).toMatchObject({ success: true, code: "yahoo_rate_limited", retryAfterSeconds: 1200 });
  });
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

describe("Yahoo injury status", () => {
  it("keeps Yahoo's injury designations and ignores other statuses", () => {
    expect(yahooInjury({ status: "DTD", status_full: "Day-to-Day", injury_note: "Lower Body" })).toEqual({ status: "DTD", label: "Day-to-Day", note: "Lower Body" });
    expect(yahooInjury({ status: "ir-lt" })).toEqual({ status: "IR-LT", label: "IR-LT", note: null });
    expect(yahooInjury({ status: "NA", status_full: "Not Active" })).toBeNull();
    expect(yahooInjury({})).toBeNull();
  });
});

describe("Yahoo goalie appearances already credited", () => {
  const goalie = (id: string, nhlId: number, team: string) => ({ id, nhlId, name: id, teamAbbreviation: team, eligiblePositions: ["G"],
    eligibilityVerified: true, playerClass: "goalie" as const, availability: "rostered" as const, ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] });
  const players = [goalie("dal", 1, "DAL"), goalie("vgk", 2, "VGK"), goalie("bench", 3, "TOR")];
  const game = (id: string, date: string, team: string, status: "final" | "live" | "postponed" = "final") =>
    ({ id, date, startsAt: `${date}T23:00:00Z`, teamAbbreviation: team, opponent: "OPP", home: true, status });
  const games = [game("101", "2026-10-19", "DAL"), game("102", "2026-10-20", "DAL"), game("103", "2026-10-20", "VGK"), game("104", "2026-10-19", "TOR")];
  const slots = [{ id: "G#1", type: "G" }, { id: "G#2", type: "G" }, { id: "C#1", type: "C" }];
  const lineup = (date: string) => ({ date, source: "yahoo" as const, entries: [
    { playerId: "dal", name: "dal", position: "G", slotId: "G#1" }, { playerId: "vgk", name: "vgk", position: "G", slotId: "G#2" },
    { playerId: "bench", name: "bench", position: "BN", slotId: null }] });
  const db = (rows: Array<{ goalie_id: number; game_id: number; games_played: number }>) => ({ from: () => ({ select: () => ({
    in: async (_column: string, ids: number[]) => ({ data: rows.filter(row => ids.includes(row.game_id)), error: null }) }) }) }) as any;
  // DAL's goalie played both nights; VGK's goalie sat 10-20 (his backup played); the benched TOR goalie's start doesn't count.
  const played = [{ goalie_id: 1, game_id: 101, games_played: 1 }, { goalie_id: 1, game_id: 102, games_played: 1 },
    { goalie_id: 9, game_id: 103, games_played: 1 }, { goalie_id: 3, game_id: 104, games_played: 1 }];
  const base = { periodStart: "2026-10-19", today: "2026-10-21", pastLineups: [lineup("2026-10-19"), lineup("2026-10-20")], slots, players, games };

  it("counts active-slot goalies who played on elapsed days", async () => {
    await expect(yahooCreditedGoalieAppearances(db(played), base)).resolves.toBe(2);
  });
  it("is zero before the matchup's first day ends", async () => {
    await expect(yahooCreditedGoalieAppearances(db(played), { ...base, today: "2026-10-19", pastLineups: [] })).resolves.toBe(0);
  });
  it("stays unknown instead of undercounting", async () => {
    // A day's lineup wasn't read.
    await expect(yahooCreditedGoalieAppearances(db(played), { ...base, pastLineups: [lineup("2026-10-19")] })).resolves.toBeNull();
    // A final game whose goalie rows haven't landed.
    await expect(yahooCreditedGoalieAppearances(db(played.filter(row => row.game_id !== 103)), base)).resolves.toBeNull();
    // A past game that isn't final yet.
    await expect(yahooCreditedGoalieAppearances(db(played), { ...base, games: [...games.filter(row => row.id !== "103"), game("103", "2026-10-20", "VGK", "live")] })).resolves.toBeNull();
    // No period start.
    await expect(yahooCreditedGoalieAppearances(db(played), { ...base, periodStart: null })).resolves.toBeNull();
  });
  it("skips postponed games without an appearance", async () => {
    await expect(yahooCreditedGoalieAppearances(db(played), { ...base, games: [...games.filter(row => row.id !== "103"), game("103", "2026-10-20", "VGK", "postponed")] })).resolves.toBe(2);
  });
});

describe("Actual fantasy points on recorded past lineups", () => {
  const person = (id: string, nhlId: number, team: string, playerClass: "skater" | "goalie") => ({ id, nhlId, name: id, teamAbbreviation: team,
    eligiblePositions: [playerClass === "goalie" ? "G" : "C"], eligibilityVerified: true, playerClass, availability: "rostered" as const,
    ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] });
  const players = [person("larkin", 10, "DET", "skater"), person("scratch", 11, "DET", "skater"), person("oettinger", 20, "DAL", "goalie"),
    person("idle", 12, "CHI", "skater"), person("late", 13, "VGK", "skater")];
  const game = (id: string, team: string, status: "final" | "live" = "final") => ({ id, date: "2026-10-20", startsAt: "2026-10-20T23:00:00Z",
    teamAbbreviation: team, opponent: "OPP", home: true, status });
  const games = [game("201", "DET"), game("202", "DAL"), game("203", "VGK")];
  const lineup = [{ date: "2026-10-20", source: "yahoo" as const, entries: ["larkin", "scratch", "oettinger", "idle", "late"]
    .map(id => ({ playerId: id, name: id, position: "C", slotId: null })) }];
  const scoring = { mode: "points" as const, categories: [], weights: { GOALS: 3, ASSISTS: 2, PP_POINTS: 1, SHOTS_ON_GOAL: 0.2, HITS: 0.2,
    BLOCKED_SHOTS: 0.25, WINS_GOALIE: 4, GOALS_AGAINST_GOALIE: -1, SAVES_GOALIE: 0.2, SHUTOUTS_GOALIE: 3 } };
  const tables: Record<string, Array<Record<string, number>>> = {
    wgo_skater_stats: [{ player_id: 10, game_id: 201, goals: 1, assists: 1, pp_points: 1, shots: 4, hits: 2, blocked_shots: 0 },
      { player_id: 99, game_id: 201, goals: 0, assists: 0, pp_points: 0, shots: 1, hits: 0, blocked_shots: 1 }],
    wgo_goalie_stats: [{ goalie_id: 20, game_id: 202, wins: 1, goals_against: 2, saves: 30, shutouts: 0 }],
  };
  const db = { from: (table: string) => { const query: any = { select: () => query, in: (_c: string, ids: number[]) => { query.ids = ids; return query; },
    order: () => query, range: async () => ({ data: tables[table].filter(row => query.ids.includes(row.game_id)), error: null }) }; return query; } } as any;
  const points = async (overrides: Partial<Parameters<typeof yahooPastLineupPoints>[1]> = {}) => Object.fromEntries((await yahooPastLineupPoints(db,
    { pastLineups: lineup, players, games, scoring, ...overrides }))[0].entries.map(entry => [entry.playerId, entry.points]));

  it("scores each player's night with the league weights", async () => {
    // Larkin 3 + 2 + 1 + 0.8 + 0.4; Oettinger 4 - 2 + 6; a scratch in a landed game scores 0; no game and unlanded stats stay unknown.
    await expect(points()).resolves.toEqual({ larkin: 7.2, scratch: 0, oettinger: 8, idle: null, late: null });
  });
  it("leaves points unknown when a weighted stat can't be scored per game, or outside points leagues", async () => {
    await expect(points({ scoring: { ...scoring, weights: { ...scoring.weights, SAVE_PERCENTAGE: 5 } } })).resolves
      .toMatchObject({ larkin: 7.2, oettinger: null });
    const categories = await yahooPastLineupPoints(db, { pastLineups: lineup, players, games, scoring: { mode: "categories", weights: {}, categories: [] } });
    expect(categories).toBe(lineup);
  });
  it("does not score a game that is not final", async () => {
    await expect(points({ games: [game("201", "DET", "live"), game("202", "DAL")] })).resolves.toMatchObject({ larkin: null, oettinger: 8 });
  });
});
