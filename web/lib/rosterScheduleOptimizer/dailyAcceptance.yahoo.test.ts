// @vitest-environment node
// RSO daily beta: offline connected-Yahoo acceptance packet (lane RSO-YAHOO). Mirrors the manual packet
// (dailyAcceptance.manual.test.ts) for a connected Yahoo daily league. The real Yahoo loaders
// (loadYahooPlanningSnapshot, loadYahooPlanningConfirmations) run against the existing private-read mock pattern
// (rosterPlanning.test.ts, planningConfirmations.test.ts): a fake owned-account database, a mocked Yahoo provider
// client, the settings parser and loadPlanningData. Their output then flows through rules supplements, planning,
// reconciliation and the workspace. Every value is synthetic; global fetch is trapped so no network call can pass.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanningData, PlanningPlayer, PlanningSnapshot, PlanningWorkspace, PlanStep } from "./planningTypes";

const mocks = vi.hoisted(() => ({ settings: vi.fn(), planningData: vi.fn(), draftResource: vi.fn(), boardResource: vi.fn(), planningResource: vi.fn() }));
vi.mock("lib/rosterScheduleData/planning", async original => ({ ...await original<typeof import("../rosterScheduleData/planning")>(), loadPlanningData: mocks.planningData }));
vi.mock("lib/integrations/yahoo/gameContext", async original => ({ ...await original<typeof import("../integrations/yahoo/gameContext")>(),
  resolveYahooGameContext: async () => ({ gameKey: "453", targetSeasonId: 20262027 }), assertYahooLeagueGameContext: () => undefined }));
vi.mock("lib/integrations/yahoo/liveDraft", async original => ({ ...await original<typeof import("../integrations/yahoo/liveDraft")>(), parseYahooBoardSettings: mocks.settings }));
vi.mock("lib/integrations/yahoo/providerClient", async original => ({ ...await original<typeof import("../integrations/yahoo/providerClient")>(),
  fetchYahooDraftResource: mocks.draftResource, fetchYahooBoardResource: mocks.boardResource, fetchYahooPlanningResource: mocks.planningResource }));

import { loadYahooPlanningSnapshot } from "lib/integrations/yahoo/rosterPlanning";
import { loadYahooPlanningConfirmations } from "lib/integrations/yahoo/planningConfirmations";
import { evaluatePlan, planRoster } from "./planning";
import { reconcileIntent } from "./reconciliation";
import { retentionCaution } from "./retention";
import { supplementProviderRules } from "./providerRules";
import { currentProviderPeriod, defaultIntent, defaultWorkspace, readWorkspaceHistory, retainProviderInputs, writeWorkspace } from "./workspace";

// --- Synthetic connected league: 12-team Yahoo daily points league, Toronto time ---
const NOW = new Date("2026-10-19T14:00:00Z"); // Monday 10:00 Toronto
const TODAY = "2026-10-19", WEEK_END = "2026-10-25";
const LEAGUE_KEY = "453.l.1", TEAM_KEY = "453.l.1.t.1";
const INTERIM_LABEL = "Interim FORGE bridge fixture value (synthetic); not a calibrated FORGE forecast.";
const BRIDGE_REVISION = "forge-daily-bridge-v1:interim-fixture";
type Row = Record<string, unknown>;
type Catalog = { nhl: number; id: string; team: string; positions: string[]; ownership: number | null };
const CATALOG: Catalog[] = [
  { nhl: 1, id: "c1", team: "TOR", positions: ["C"], ownership: 41 },
  { nhl: 2, id: "lw1", team: "BOS", positions: ["LW"], ownership: 3 },
  { nhl: 3, id: "d1", team: "MTL", positions: ["D"], ownership: 97 },
  { nhl: 4, id: "inj", team: "CHI", positions: ["LW"], ownership: 22 },
  { nhl: 5, id: "g1", team: "VAN", positions: ["G"], ownership: 80 },
  { nhl: 6, id: "g2", team: "CGY", positions: ["G"], ownership: 35 },
  { nhl: 7, id: "vanBackup", team: "VAN", positions: ["G"], ownership: 4 },
  { nhl: 10, id: "fa1", team: "PHI", positions: ["C"], ownership: 1 },
  { nhl: 11, id: "wv1", team: "NJD", positions: ["LW"], ownership: 6 },
  { nhl: 12, id: "hot", team: "NYR", positions: ["C"], ownership: 88 },
  { nhl: 13, id: "elsewhere", team: "EDM", positions: ["RW"], ownership: 2 },
];
const teamId = (team: string) => [...team].reduce((id, char) => id * 31 + char.charCodeAt(0), 7);
const catalogPlayers = (): PlanningPlayer[] => CATALOG.map(row => ({ id: row.id, nhlId: row.nhl, nhlTeamId: teamId(row.team), rosterRevision: `roster-${row.id}`,
  name: row.id, teamAbbreviation: row.team, eligiblePositions: row.positions, eligibilityVerified: false,
  playerClass: row.positions.includes("G") ? "goalie" : "skater", availability: "unknown", ownership: row.ownership, canDrop: null, holdValue: null, reserveEligibility: [] }));
const games = () => ["TOR", "BOS", "MTL", "VAN", "CGY", "PHI", "NJD", "NYR", "EDM"].map(team => ({ id: `${team}-${TODAY}`, scheduleRevision: `schedule-${team}`,
  date: TODAY, startsAt: `${TODAY}T23:00:00Z`, teamAbbreviation: team, opponent: "OPP", home: true, status: "scheduled" as const }));

/** Mutable synthetic provider world; each test edits it before loading. */
type World = {
  responseDate: string; ageSeconds: number | null; teamOwned: string; counter: Row | null; numberOfMoves: number; maxWeeklyAdds: string | null;
  currentWeek: string; weeks: PlanningData["matchupWeeks"]; endDate: string; ownRows: Row[]; leagueTeams: Row[]; pages: Array<Row[] | Error>; userId: string;
  scoreboard: boolean; timeZone: string | null;
};
let world: World;
const transport = () => ({ responseDate: world.responseDate, ageSeconds: world.ageSeconds });
const playerRow = (nhl: number, fields: Row = {}): Row => ({ player: [{ player_key: `453.p.${nhl}` }, { name: { full: CATALOG.find(row => row.nhl === nhl)?.id ?? `Unmapped ${nhl}` } },
  { editorial_team_abbr: CATALOG.find(row => row.nhl === nhl)?.team ?? "XXX" }, ...Object.entries(fields).map(([key, value]) => ({ [key]: value }))] });
const owned = (nhl: number, selected: string, extra: Row = {}) => playerRow(nhl, { eligible_positions: [...CATALOG.find(row => row.nhl === nhl)!.positions.map(position => ({ position })), ...(extra.reserve ? [{ position: extra.reserve }] : [])],
  selected_position: { position: selected }, is_editable: "1", is_undroppable: "0", ...Object.fromEntries(Object.entries(extra).filter(([key]) => key !== "reserve")) });
const available = (nhl: number, ownership: Row) => playerRow(nhl, { eligible_positions: CATALOG.find(row => row.nhl === nhl)!.positions.map(position => ({ position })), ownership });
const collection = (rows: Row[]) => ({ count: rows.length, ...Object.fromEntries(rows.map((row, index) => [index, row])) });
function freshWorld(): World {
  return {
    responseDate: NOW.toISOString(), ageSeconds: 0, teamOwned: "1", numberOfMoves: 40, maxWeeklyAdds: "4", currentWeek: "2", endDate: WEEK_END, userId: "owner-a",
    scoreboard: false, timeZone: "America/Toronto",
    counter: { coverage_type: "week", coverage_value: "2", value: "1" },
    weeks: [{ gameKey: "453", week: 2, startDate: TODAY, endDate: WEEK_END }],
    ownRows: [owned(1, "C"), owned(2, "BN", { is_undroppable: "1" }), owned(3, "D"),
      owned(4, "IR", { reserve: "IR", status: "IR", status_full: "Injured Reserve" }),
      owned(5, "G", { starting_status: { coverage_type: "date", date: TODAY, is_starting: 1 } }), owned(6, "G")],
    leagueTeams: [{ team: [{ team_key: "453.l.1.t.2" }, { roster: { players: collection([playerRow(13)]) } }] }],
    // One short page: fa1 free agent, wv1 on waivers, plus unmatched Yahoo-only rows; "hot" is never listed.
    pages: [[available(10, { ownership_type: "freeagents" }), available(11, { ownership_type: "waivers", waiver_date: Date.parse("2026-10-20T08:00:00Z") / 1000 }),
      playerRow(900, { ownership: { ownership_type: "freeagents" } })]],
  };
}
function database(mapping = CATALOG.map(row => ({ nhl_player_id: row.nhl, yahoo_player_id: `453.p.${row.nhl}` }))) {
  const tables: Record<string, Row | Row[]> = {
    external_teams: { id: "team-a", user_id: "owner-a", provider: "yahoo", external_league_id: "league-a", connected_account_id: "account-a",
      external_team_key: TEAM_KEY, team_metadata: { is_owned: true } },
    external_leagues: { id: "league-a", user_id: "owner-a", provider: "yahoo", connected_account_id: "account-a", external_league_key: LEAGUE_KEY },
    yahoo_nhl_player_map_read: mapping,
  };
  return { from(table: string) {
    const filters: Row = {}; let inFilter: [string, unknown[]] | null = null;
    const rows = () => { const value = tables[table]; return Array.isArray(value) ? value.filter(row => !inFilter || inFilter[1].includes(row[inFilter[0]])) : value; };
    const query = { select: () => query, order: () => query, eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      in: (key: string, values: unknown[]) => { inFilter = [key, values]; return query; },
      limit: async () => ({ data: rows(), error: null }),
      range: async (start: number) => ({ data: start === 0 ? rows() : [], error: null }),
      maybeSingle: async () => { const row = rows() as Row; return { data: Object.entries(filters).every(([key, value]) => row?.[key] === value) ? row : null, error: null }; } };
    return query;
  } } as never;
}
function installProvider() {
  mocks.settings.mockReturnValue({ rosterType: "date", weeklyDeadline: "intraday", scoringTypeRecognized: true, unsupportedStatIds: [], unsupportedRosterSlots: [],
    rosterConfig: { C: 2, LW: 2, RW: 2, D: 4, G: 2, UTIL: 1, BN: 4 }, excludedInjurySlots: { IR: 1, "IR+": 1 }, leagueType: "points",
    scoringCategories: { GOALS: 3, ASSISTS: 2, SHOTS_ON_GOAL: 0.5, WINS_GOALIE: 4, SAVES_GOALIE: 0.2, GOALS_AGAINST_GOALIE: -1 }, categoryWeights: {}, minimumGoalieStarts: 3 });
  mocks.planningData.mockImplementation(async () => ({ players: catalogPlayers(), games: games(), forecasts: [], matchupWeeks: structuredClone(world.weeks),
    evidence: { schedule: { source: "Synthetic complete schedule", asOf: NOW.toISOString(), seasonId: 20262027, completeness: "complete", limitations: [] } } }));
  mocks.draftResource.mockImplementation(async () => ({ payload: { league_key: LEAGUE_KEY, ...(world.timeZone ? { time_zone: world.timeZone } : {}), draft_status: "postdraft",
    settings: world.maxWeeklyAdds === null ? {} : { max_weekly_adds: world.maxWeeklyAdds } }, transport: transport() }));
  mocks.boardResource.mockImplementation(async ({ resource }: { resource: Row }) => {
    if (resource.type === "league_rosters") return { payload: { league_key: LEAGUE_KEY, teams: collection(world.leagueTeams) }, transport: transport() };
    if (resource.type !== "roster" || resource.date !== TODAY) throw new Error("Synthetic optional read unavailable");
    return { payload: { team_key: TEAM_KEY, is_owned_by_current_login: "1", roster: { date: TODAY, coverage_type: "date", is_editable: "1",
      players: collection(world.ownRows) } }, transport: transport() };
  });
  mocks.planningResource.mockImplementation(async ({ resource }: { resource: Row }) => {
    if (resource.type === "scoreboard" && world.scoreboard) return { payload: { league_key: LEAGUE_KEY, scoreboard: { matchups: collection([{ matchup: [
      { week_start: TODAY }, { week_end: world.endDate }, { teams: collection([{ team: [{ team_key: TEAM_KEY }, { team_stats: { stats: [] } }] },
        { team: [{ team_key: "453.l.1.t.2" }, { team_stats: { stats: [] } }] }]) }] }]) } }, transport: transport() };
    if (resource.type === "league") return { payload: { league: [{ league_key: LEAGUE_KEY }, { current_week: world.currentWeek }] }, transport: transport() };
    if (resource.type === "team") return { payload: { team: [{ team_key: TEAM_KEY }, { is_owned_by_current_login: world.teamOwned }, { number_of_moves: world.numberOfMoves },
      ...(world.counter ? [{ roster_adds: world.counter }] : [])] }, transport: transport() };
    if (resource.type === "available_page") {
      const page = world.pages[Number(resource.start) / 25];
      if (page instanceof Error) throw page;
      return { payload: { league_key: LEAGUE_KEY, players: collection(page ?? []) }, transport: transport() };
    }
    throw new Error("Synthetic optional read unavailable");
  });
}
const load = (mapping?: Parameters<typeof database>[0]) => loadYahooPlanningSnapshot({ db: database(mapping), userId: world.userId, teamId: "team-a",
  startDate: TODAY, endDate: world.endDate, now: NOW });
const player = (snapshot: PlanningSnapshot, id: string) => snapshot.players.find(row => row.id === id)!;
const intent = (steps: PlanStep[] = [], extra = {}) => ({ ...defaultIntent(), revision: 1, goalieWindow: "any" as const, steps, ...extra });
const add = (id: string, playerId: string, at = NOW.toISOString(), extra: Partial<PlanStep> = {}): PlanStep => ({ id, type: "add", playerId, at, effectiveAt: at,
  conditional: Date.parse(at) > NOW.getTime() || extra.conditional === true, dependsOn: [], ...extra });
/** Yahoo reports no transaction timing; the manager supplies it (scenario b). */
const withTiming = (snapshot: PlanningSnapshot) => supplementProviderRules(snapshot, { acquisitionTiming: "same_day" }).snapshot;

let network: { mock: { calls: unknown[][] } };
beforeEach(() => {
  world = freshWorld();
  for (const mock of Object.values(mocks)) mock.mockReset();
  installProvider();
  network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected network request in offline Yahoo acceptance"));
});
afterEach(() => { expect(network).not.toHaveBeenCalled(); vi.restoreAllMocks(); });

describe("RSO daily beta: connected Yahoo acceptance packet", () => {
  describe("(a) snapshot import: legal inputs, explicit unknowns, rules never complete", () => {
    it("imports the owned roster as legal planner inputs", async () => {
      const { snapshot, capabilities } = await load();
      expect(snapshot.context).toMatchObject({ provider: "yahoo", timeZone: "America/Toronto", startDate: TODAY, endDate: WEEK_END });
      expect(snapshot.roster).toEqual([{ playerId: "c1", position: "active" }, { playerId: "lw1", position: "bench" }, { playerId: "d1", position: "active" },
        { playerId: "inj", position: "IR" }, { playerId: "g1", position: "active" }, { playerId: "g2", position: "active" }]);
      expect(player(snapshot, "c1")).toMatchObject({ eligibilityVerified: true, canDrop: true, providerId: "453.p.1", availability: "rostered" });
      expect(player(snapshot, "lw1").canDrop).toBe(false);
      expect(player(snapshot, "inj")).toMatchObject({ reserveEligibility: ["IR"], injury: { status: "IR", label: "Injured Reserve", note: null } });
      expect(snapshot.rules).toMatchObject({ lineupMode: "daily", rosterSlots: { C: 2, LW: 2, RW: 2, D: 4, G: 2, UTIL: 1, BN: 4, IR: 1, "IR+": 1 } });
      expect(snapshot.evidence.roster?.completeness).toBe("complete");
      expect(capabilities).toMatchObject({ roster: true, availability: true, acquisitions: true, rules: false });
      // The imported roster is a legal no-move lineup; the planner may start Yahoo's benched lw1 (BOS plays), never the IR player.
      const noMove = evaluatePlan(snapshot, intent(), "agp", []);
      expect(noMove.legal).toBe(true);
      expect(noMove.assignments.map(row => row.playerId).sort()).toEqual(["c1", "d1", "g1", "g2", "lw1"]);
    });

    it("keeps transaction timing and goalie-minimum semantics unknown, and never marks rules complete", async () => {
      const { snapshot, capabilities } = await load();
      expect(snapshot.rules.acquisitionTiming).toBe("unknown");
      expect(snapshot.rules.goalieMinimum).toMatchObject({ required: 3, credited: 0, counts: "unknown", penalty: "unknown", periodStart: TODAY, periodEnd: "2026-10-26" });
      expect(capabilities.rules).toBe(false);
      expect(Object.keys(snapshot.evidence)).not.toContain("rules");
      // Planning against provider rules alone discloses the gap and refuses acquisitions instead of assuming timing.
      const result = planRoster(snapshot, intent(), { maxSteps: 1, maxCandidates: 2, maxEvaluations: 40 });
      expect(result.search.limitations).toContain("Add/drop plans need acquisition-effective timing. Review League rules and scoring.");
      expect(result.alternatives.every(plan => plan.steps.length === 0)).toBe(true);
      expect(evaluatePlan(snapshot, intent(), "agp", [add("x", "fa1")]).legal).toBe(false);
    });

    // Regression for YAHOO Y1: with every read verified, capabilities.rules stays false and the unverified rule facts are named.
    it("names the unverified rule facts whenever capabilities.rules is false", async () => {
      world.scoreboard = true;
      const { snapshot, capabilities } = await load();
      expect(snapshot.opponent).not.toBeNull();
      expect(capabilities).toMatchObject({ roster: true, availability: true, acquisitions: true, matchup: true, rules: false });
      expect(snapshot.rules.acquisitionTiming).toBe("unknown");
      expect(capabilities.limitations).toEqual(["Yahoo does not report these league rules; confirm them in League rules: when an add takes effect (same-day or next-day); "
        + "waiver mode and FAAB budget; the exact weekly add reset time (league-local midnight is assumed); how the goalie minimum counts (starts or appearances) and its penalty."]);
      expect(snapshot.evidence.roster?.limitations).toEqual(capabilities.limitations);
      expect(snapshot.rules.waivers).toBeUndefined();
      expect(snapshot.rules.goalieMinimum).toMatchObject({ counts: "unknown", penalty: "unknown" });
    });

    it("keeps a missing league time zone explicit instead of assuming one", async () => {
      world.timeZone = null;
      const { snapshot, capabilities } = await load();
      expect(snapshot.context.timeZone).toBe("UTC");
      expect(capabilities.limitations).toContain("League time zone is unknown; UTC is a display fallback and timing requires verification.");
      expect(snapshot.rules.unsupported).toContain("Verify the league time zone before time-sensitive planning.");
      expect(evaluatePlan(snapshot, intent(), "agp", []).recommendation?.eligible).toBe(false);
    });

    it("keeps an unmapped roster player explicit and the roster partial", async () => {
      world.ownRows.push(playerRow(999, { eligible_positions: [{ position: "RW" }], selected_position: { position: "BN" } }));
      const { snapshot, capabilities } = await load();
      expect(snapshot.roster).toHaveLength(6);
      expect(capabilities.roster).toBe(false);
      expect(snapshot.evidence.roster).toMatchObject({ completeness: "partial" });
      expect(capabilities.limitations).toContain("Roster player Unmapped 999 has no unique canonical identity; review required.");
      expect(snapshot.rules.unsupported).toContain("Resolve missing roster identities before accepting a complete plan.");
    });

    it("locks a player Yahoo no longer lets the manager edit today", async () => {
      world.ownRows[0] = owned(1, "C", { is_editable: "0" });
      const { snapshot } = await load();
      expect(snapshot.lockedAssignments).toEqual([{ date: TODAY, playerId: "c1", slotId: "C#1" }]);
    });

    it("stale roster reads keep eligibility, drop permission and goalie marks unverified", async () => {
      world.ageSeconds = 61;
      const { snapshot, capabilities } = await load();
      expect(player(snapshot, "c1")).toMatchObject({ eligibilityVerified: false, canDrop: null });
      expect(player(snapshot, "g1").startingStatus).toBeNull();
      expect(player(snapshot, "inj").reserveEligibility).toEqual([]);
      expect(capabilities).toMatchObject({ roster: false, acquisitions: false });
      expect(snapshot.evidence.roster?.completeness).toBe("partial");
    });
  });

  describe("(b) manager overrides fill gaps; conflicts are disclosed", () => {
    it("fills unknown timing and goalie semantics without overriding provider settings", async () => {
      const { snapshot } = await load();
      const { snapshot: supplemented, conflicts } = supplementProviderRules(snapshot, { acquisitionTiming: "same_day",
        scoring: { weights: { GOALS: 6 } }, goalieMinimum: { counts: "starts", penalty: "none", required: 2 }, rosterSlots: { BN: 5 } });
      expect(supplemented.rules.acquisitionTiming).toBe("same_day");
      expect(supplemented.rules.goalieMinimum).toMatchObject({ counts: "starts", penalty: "none", required: 3 });
      expect(supplemented.rules.scoring.weights.GOALS).toBe(3);
      expect(supplemented.rules.rosterSlots.BN).toBe(4);
      expect(conflicts).toEqual(expect.arrayContaining(["GOALS weight differs from the manager input; provider setting retained.",
        "BN roster slots differs from the manager input; provider setting retained.", "Goalie required differs from the manager input; provider setting retained."]));
      expect(supplemented.evidence.managerRules).toMatchObject({ source: "manager-supplied", completeness: "partial" });
      expect(supplemented.id).not.toBe(snapshot.id);
      expect(snapshot.rules.acquisitionTiming).toBe("unknown");
      // With timing supplied, the weekly-counter-bounded add becomes legal and is charged to the Yahoo week.
      const plan = evaluatePlan(supplemented, intent(), "agp", [add("x", "fa1")]);
      expect(plan).toMatchObject({ legal: true, budgetVerified: true, acquisitions: { "yahoo-week-2": 1 } });
    });

    it("keeps a provider lock over a conflicting manager lock and says so", async () => {
      world.ownRows[0] = owned(1, "C", { is_editable: "0" });
      const { snapshot } = await load();
      const { snapshot: supplemented, conflicts } = supplementProviderRules(snapshot, {}, [{ date: TODAY, playerId: "c1", slotId: "UTIL#1", source: "manager" }]);
      expect(supplemented.lockedAssignments).toEqual([{ date: TODAY, playerId: "c1", slotId: "C#1" }]);
      expect(conflicts).toEqual(["Manager lock for c1 on 2026-10-19 conflicts with the provider lock for c1; provider lock retained and manager choice kept for review."]);
      expect(supplemented.evidence["Manager-selected lineup locks"]?.limitations).toContain("1 manager lock(s) conflict with provider authority and were not applied. Stored choices remain available for review.");
    });
  });

  describe("(c) bounded discovery: partial coverage reported, unseen candidates stay unknown", () => {
    it("reports complete discovery only when the provider list ends", async () => {
      const { snapshot, capabilities } = await load();
      expect(capabilities.availability).toBe(true);
      expect(player(snapshot, "fa1").availability).toBe("free_agent");
      expect(player(snapshot, "wv1")).toMatchObject({ availability: "waivers", waiverClearsAt: "2026-10-20T08:00:00.000Z" });
      expect(player(snapshot, "elsewhere").availability).toBe("rostered");
      // Not listed by Yahoo: unknown even after a complete read, never available.
      expect(player(snapshot, "hot").availability).toBe("unknown");
    });

    it("keeps a failed later page partial and its unseen players unknown", async () => {
      world.pages = [[available(10, { ownership_type: "freeagents" }), ...Array.from({ length: 24 }, (_, index) => playerRow(900 + index, { ownership: { ownership_type: "freeagents" } }))],
        new Error("Synthetic later page failure")];
      const { snapshot, capabilities } = await load();
      expect(capabilities.availability).toBe(false);
      expect(snapshot.evidence.availability).toMatchObject({ completeness: "partial", limitations: ["Only individually verified availability may be actionable."] });
      expect(capabilities.limitations).toEqual(expect.arrayContaining(["Availability coverage is partial; unverified players remain unknown.",
        "Available-player discovery did not reach the end of the provider list."]));
      expect(capabilities.diagnostics?.some(line => line.includes("Discovery partial; unseen players remain unknown."))).toBe(true);
      expect(player(snapshot, "fa1").availability).toBe("free_agent");
      expect(player(snapshot, "wv1").availability).toBe("unknown");
      const supplemented = withTiming(snapshot);
      const result = planRoster(supplemented, intent(), { maxSteps: 1, maxCandidates: 5, maxEvaluations: 60 });
      expect(result.alternatives.flatMap(plan => plan.steps).some(step => ["wv1", "hot"].includes(step.playerId))).toBe(false);
      expect(evaluatePlan(supplemented, intent(), "agp", [add("x", "wv1")]).legal).toBe(false);
    });
  });

  describe("(d) weekly allowance comes only from a fresh, owned, scoped current-week counter", () => {
    it("derives remaining adds from max_weekly_adds minus the week counter, never season moves", async () => {
      const { snapshot, capabilities } = await load();
      expect(snapshot.acquisitionEvidence).toMatchObject({ remaining: 3, counter: { used: 1, coverageType: "week", coverageWeek: 2 }, limit: { verified: true } });
      expect(snapshot.rules.periods).toEqual([{ id: "yahoo-week-2", start: "2026-10-19T04:00:00.000Z", end: "2026-10-26T04:00:00.000Z", remaining: 3, source: "provider", timeZone: "America/Toronto" }]);
      expect(snapshot.rules.acquisitionCost).toBe(1);
      expect(capabilities.acquisitions).toBe(true);
      expect(currentProviderPeriod(snapshot, snapshot.context, NOW)).toEqual({ week: 2, startDate: TODAY, endDate: WEEK_END, containsHorizon: true });
      const supplemented = withTiming(snapshot);
      const four = ["fa1", "wv1"].map((id, index) => add(`a${index}`, id, NOW.toISOString(), id === "wv1" ? { effectiveAt: "2026-10-20T08:00:00.000Z", conditional: true } : {}));
      expect(evaluatePlan(supplemented, intent(), "agp", four).legal).toBe(true);
    });

    it.each([
      ["not owned", (w: World) => { w.teamOwned = "0"; }],
      ["stale counter", (w: World) => { w.ageSeconds = 61; }],
      ["season counter", (w: World) => { w.counter = { coverage_type: "season", coverage_value: "2026", value: "1" }; }],
      ["previous week counter", (w: World) => { w.counter = { coverage_type: "week", coverage_value: "1", value: "1" }; }],
      ["counter absent (season moves only)", (w: World) => { w.counter = null; }],
      ["no weekly limit", (w: World) => { w.maxWeeklyAdds = "0"; }],
      ["horizon beyond the week", (w: World) => { w.endDate = "2026-10-27"; }],
    ])("withholds the allowance when the counter is %s", async (label, change) => {
      change(world);
      const { snapshot, capabilities } = await load();
      expect(snapshot.acquisitionEvidence?.remaining).toBeNull();
      expect(snapshot.rules.periods).toEqual([]);
      expect(snapshot.rules.acquisitionCost).toBeNull();
      expect(capabilities.acquisitions).toBe(false);
      // The current-week dates stay usable when only the limit is missing; they never carry an allowance.
      if (label === "no weekly limit") expect(currentProviderPeriod(snapshot, snapshot.context, NOW)).toMatchObject({ week: 2, containsHorizon: true });
      else expect(currentProviderPeriod(snapshot, snapshot.context, NOW)).toBeUndefined();
      expect(capabilities.limitations).toContain("Verify remaining acquisitions, reset periods and counting rules; these are not inferred from season transaction totals.");
      expect(evaluatePlan(withTiming(snapshot), intent(), "agp", [add("x", "fa1")]).legal).toBe(false);
    });
  });

  describe("(e) goalie Starting/Not Starting reaches bridge stats only from fresh verified evidence", () => {
    // One FORGE bridge team-game: g1 and his VAN backup, interim fixture per-start lines.
    function confirmationsFixture(isStarting: unknown = 1) {
      const players = catalogPlayers().filter(row => ["g1", "vanBackup"].includes(row.id));
      const conditional = { SAVES_GOALIE: 26, WINS_GOALIE: 0.55, GOALS_AGAINST_GOALIE: 2.6, SHUTOUTS_GOALIE: null };
      const data: PlanningData = { players, games: games().filter(row => row.teamAbbreviation === "VAN"), evidence: {},
        forecasts: players.map((row, index) => { const p = index ? 0.3 : 0.7; return { playerId: row.id, gameId: `VAN-${TODAY}`, conditioning: "unconditional" as const,
          stats: { SAVES_GOALIE: 26 * p, WINS_GOALIE: 0.55 * p, GOALS_AGAINST_GOALIE: 2.6 * p, SHUTOUTS_GOALIE: null }, conditionalStats: conditional,
          startProbability: p, confirmedStart: false, revisionId: BRIDGE_REVISION, issuedAt: NOW.toISOString(), cutoffAt: NOW.toISOString(),
          expiresAt: `${TODAY}T23:00:00Z`, modelVersion: "forge-daily-bridge-v1", limitations: [INTERIM_LABEL] }; }),
        forecastManifest: { version: "planning-forecasts-v1", id: "bridge-manifest", seasonId: 20262027, asOf: NOW.toISOString(), scheduleRevision: "s", rosterRevision: "r",
          issuedRevisionIds: [BRIDGE_REVISION], baselineChecksum: null, requiredOpportunities: 2, forecastedOpportunities: 2, exclusionCounts: {},
          rsoUsePolicy: { version: "rso-target-use-v1", revision: "interim-bridge-policy", bridgeRevisionIds: [BRIDGE_REVISION] } } };
      const status = (value: unknown) => ({ coverage_type: "date", date: TODAY, is_starting: value });
      world.ownRows = [playerRow(5, { starting_status: status(isStarting) })];
      const run = (extra: Partial<Parameters<typeof loadYahooPlanningConfirmations>[0]> = {}) => loadYahooPlanningConfirmations({ db: database(), userId: world.userId, teamId: "team-a",
        leagueId: "league-a", query: { seasonId: 20262027, startDate: TODAY, endDate: WEEK_END, timeZone: "America/Toronto" }, data, now: NOW, ...extra });
      return { data, run, status };
    }
    beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW); });
    afterEach(() => vi.useRealTimers());

    it.each([[1, [1, 0]], [0, [0, 1]]] as const)("a fresh verified is_starting=%s sets 1/0 and keeps the per-start line", async (value, chances) => {
      const { data, run } = confirmationsFixture(value), before = JSON.stringify(data);
      const { data: confirmed, expiresAt } = await run();
      expect(confirmed.forecasts.map(row => row.startProbability)).toEqual(chances);
      expect(confirmed.forecasts.map(row => row.stats.SAVES_GOALIE)).toEqual(chances.map(chance => 26 * chance));
      expect(confirmed.forecasts.map(row => row.confirmedStart)).toEqual(value === 1 ? [true, false] : [false, false]);
      for (const row of confirmed.forecasts) {
        expect(row.conditionalStats).toEqual(data.forecasts[0].conditionalStats);
        expect(row.stats.SHUTOUTS_GOALIE).toBeNull();
        expect(row.limitations).toContain(INTERIM_LABEL);
        expect(row.limitations.some(text => text.startsWith(`Yahoo lists g1 as ${value === 1 ? "starting" : "not starting"} on ${TODAY}`))).toBe(true);
      }
      expect(expiresAt).toBe("2026-10-19T14:02:00.000Z");
      expect(JSON.stringify(data)).toBe(before);
    });

    it.each([
      ["stale", (f: ReturnType<typeof confirmationsFixture>) => { world.responseDate = "2026-10-19T13:57:00Z"; return f.run(); }, "rejects"],
      ["expired cache age", (f: ReturnType<typeof confirmationsFixture>) => { world.ageSeconds = 121; return f.run(); }, "rejects"],
      ["wrong principal", (f: ReturnType<typeof confirmationsFixture>) => f.run({ userId: "owner-b" }), "rejects"],
      ["wrong game", (f: ReturnType<typeof confirmationsFixture>) => { f.data.games[0].id = "VAN-other"; return f.run(); }, "unchanged"],
      ["game already started", (f: ReturnType<typeof confirmationsFixture>) => { f.data.games[0].startsAt = "2026-10-19T13:00:00Z"; return f.run(); }, "unchanged"],
      ["unknown mark", (f: ReturnType<typeof confirmationsFixture>) => { world.ownRows = [playerRow(5, { starting_status: f.status("unknown") })]; return f.run(); }, "unchanged"],
      ["contradictory starters", (f: ReturnType<typeof confirmationsFixture>) => {
        world.ownRows = [playerRow(5, { starting_status: f.status(1) }), playerRow(7, { starting_status: f.status(1) })]; return f.run(); }, "unchanged"],
      ["contradicts a confirmed starter", (f: ReturnType<typeof confirmationsFixture>) => { f.data.forecasts[1].confirmedStart = true; return f.run(); }, "unchanged"],
      ["saved label only", (f: ReturnType<typeof confirmationsFixture>) => {
        world.ownRows = [playerRow(5)];
        f.data.players[0].startingStatus = { source: "yahoo", date: TODAY, isStarting: true, observedAt: NOW.toISOString() };
        return f.run(); }, "unchanged"],
    ] as const)("withholds %s evidence", async (_label, act, outcome) => {
      const fixture = confirmationsFixture();
      if (outcome === "rejects") await expect(act(fixture)).rejects.toThrow();
      // The loader never mutates its input, so the (case-adjusted) input rows are the withheld prior.
      else expect((await act(fixture)).data.forecasts).toEqual(fixture.data.forecasts);
    });

    it("the snapshot import keeps the mark only from a fresh roster read, never from saved metadata", async () => {
      vi.useRealTimers();
      const fresh = await load();
      expect(player(fresh.snapshot, "g1").startingStatus).toEqual({ source: "yahoo", date: TODAY, isStarting: true, observedAt: NOW.toISOString() });
      world.ownRows[4] = owned(5, "G");
      const unmarked = await load();
      expect(player(unmarked.snapshot, "g1").startingStatus).toBeNull();
    });
  });

  describe("(f) global rostered % is never addability or drop permission", () => {
    it("treats ownership as display and caution only", async () => {
      const { snapshot } = await load();
      const supplemented = withTiming(snapshot);
      // 88% owned but unseen by league discovery: unknown, not addable.
      expect(player(snapshot, "hot")).toMatchObject({ ownership: 88, availability: "unknown" });
      expect(evaluatePlan(supplemented, intent(), "agp", [add("x", "hot")]).legal).toBe(false);
      // 2% owned yet on another league roster: not addable.
      expect(player(snapshot, "elsewhere")).toMatchObject({ ownership: 2, availability: "rostered" });
      expect(evaluatePlan(supplemented, intent(), "agp", [add("x", "elsewhere")]).legal).toBe(false);
      // 1% owned free agent: addable.
      expect(evaluatePlan(supplemented, intent(), "agp", [add("x", "fa1")]).legal).toBe(true);
      // Drop permission follows Yahoo's is_undroppable, not ownership.
      expect(player(snapshot, "lw1")).toMatchObject({ ownership: 3, canDrop: false });
      expect(evaluatePlan(supplemented, intent(), "agp", [add("x", "fa1", undefined, { dropPlayerId: "lw1" })]).legal).toBe(false);
      expect(player(snapshot, "d1")).toMatchObject({ ownership: 97, canDrop: true });
      expect(retentionCaution(player(snapshot, "d1"))).toEqual({ level: "high_demand", ownership: 97 });
      expect(evaluatePlan(supplemented, intent(), "agp", [add("x", "fa1", undefined, { dropPlayerId: "d1" })]).legal).toBe(true);
      const result = planRoster(supplemented, intent(), { maxSteps: 1, maxCandidates: 5, maxEvaluations: 60 });
      expect(result.alternatives.flatMap(plan => plan.steps).some(step => ["hot", "elsewhere"].includes(step.playerId))).toBe(false);
    });
  });

  describe("(g) snapshot → plan → refresh: reconciliation proposes, never replaces, and Undo survives", () => {
    const SELECTED_AT = "2026-10-19T18:00:00.000Z";
    const steps = [add("stream", "fa1", SELECTED_AT, { dropPlayerId: "c1", conditional: true })];
    function memoryStorage() {
      const values = new Map<string, string>();
      return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    }

    it("keeps the selected moves through a refresh with changed facts and offers a repair", async () => {
      const first = withTiming((await load()).snapshot);
      const selected = intent(steps);
      expect(evaluatePlan(first, selected, "agp").legal).toBe(true);
      expect(reconcileIntent(first, selected, first)).toMatchObject({ issues: [], suggestedSteps: null });
      // Saved workspace with Undo history.
      const storage = memoryStorage();
      const base: PlanningWorkspace = retainProviderInputs({ ...defaultWorkspace(NOW), context: first.context }, first);
      const chosen: PlanningWorkspace = { ...base, intent: selected };
      expect(writeWorkspace(storage, base, [])).toBeNull();
      expect(writeWorkspace(storage, chosen, [base])).toBeNull();
      // Refresh: another manager claimed fa1 and the weekly counter moved.
      world.leagueTeams = [{ team: [{ team_key: "453.l.1.t.2" }, { roster: { players: collection([playerRow(13), playerRow(10)]) } }] }];
      world.counter = { coverage_type: "week", coverage_value: "2", value: "2" };
      const second = withTiming((await load()).snapshot);
      expect(player(second, "fa1").availability).toBe("rostered");
      const proposal = reconcileIntent(second, selected, first);
      expect(proposal.issues).toEqual(expect.arrayContaining([
        { stepId: null, message: "Acquisition allowances or waiver constraints changed; review the selected itinerary." },
        { stepId: "stream", message: "fa1 is no longer verified as available." }]));
      expect(proposal.suggestedSteps).toEqual([]);
      expect(selected.steps).toEqual(steps);
      const replanned = planRoster(second, selected, { maxSteps: 0 });
      expect(replanned.selected.steps).toEqual(steps);
      expect(replanned.selected.legal).toBe(false);
      // Accepting the repair is a new revision; Undo restores the selected moves.
      const repaired: PlanningWorkspace = { ...chosen, intent: { ...selected, revision: 2, steps: proposal.suggestedSteps! } };
      expect(writeWorkspace(storage, repaired, [base, chosen])).toBeNull();
      expect(readWorkspaceHistory(storage, repaired).at(-1)?.intent.steps).toEqual(steps);
    });

    it("a refresh that keeps the facts keeps the moves without issues", async () => {
      const first = withTiming((await load()).snapshot);
      const second = withTiming((await load()).snapshot);
      expect(reconcileIntent(second, intent(steps), first)).toMatchObject({ issues: [], suggestedSteps: null });
      expect(planRoster(second, intent(steps), { maxSteps: 0 }).selected.steps).toEqual(steps);
    });
  });
});
