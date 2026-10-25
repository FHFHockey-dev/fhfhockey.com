// @vitest-environment node
// RSO daily beta: offline manual/free acceptance packet (lane RSO-MANUAL).
// Drives the real planner (planning, planningTimeline, workspace, reconciliation)
// through the daily-league scenarios a manager runs, and checks the product
// contract end to end. Every input is a synthetic fixture: no Supabase, Yahoo,
// network or production read. Forecast rows are labelled interim FORGE bridge
// fixtures and are admitted only under fictional fixture reviews (the
// production review catalog stays empty; scenario (e) checks that path).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as rsoPolicy from "../player-forecasts/rsoUsePolicy";
import { fixtureRsoBindings, fixtureRsoPolicy } from "../player-forecasts/rsoUsePolicy.fixtures";
import { canEligibilityOccupySlot, normalizeEligibility } from "./eligibility";
import { acquisitionEffectiveAt } from "./planningTimeline";
import { evaluatePlan, planRoster } from "./planning";
import { nextLocalMidnight, zonedMidnight } from "./planningDates";
import { reconcileIntent } from "./reconciliation";
import { retentionCaution } from "./retention";
import { expandActiveSlots } from "./slots";
import { defaultIntent, defaultWorkspace, readWorkspace, readWorkspaceHistory, writeWorkspace } from "./workspace";
import type { GameForecast, LeagueRules, PlanEvaluation, PlanIntent, PlanStep, PlanningGame, PlanningPlayer,
  PlanningSnapshot, PlanningWorkspace, StatLine } from "./planningTypes";

// --- League: 12-team Yahoo-style daily points league ---
const SEASON = 20262027;
const TZ = "America/Toronto";
const MON = "2026-10-19", TUE = "2026-10-20", WED = "2026-10-21", THU = "2026-10-22", FRI = "2026-10-23", SAT = "2026-10-24", SUN = "2026-10-25";
const WEEK = [MON, TUE, WED, THU, FRI, SAT, SUN];
const MON_ASOF = "2026-10-19T14:00:00Z"; // 10:00 Toronto, before every 19:00 puck drop
const INTERIM_MODEL = "interim-forge-bridge-fixture-v1";
const INTERIM_LABEL = "Interim FORGE bridge fixture value (synthetic); not a calibrated FORGE forecast.";
const WEIGHTS = { GOALS: 3, ASSISTS: 2, SHOTS: 0.5, WINS_GOALIE: 4, SAVES_GOALIE: 0.2, GOALS_AGAINST_GOALIE: -1 };
const TARGETS = [...Object.keys(WEIGHTS), "HITS"];
const SLOTS = { C: 2, LW: 2, RW: 2, D: 4, G: 2, UTIL: 1, BN: 4, IR: 1, "IR+": 1 };

beforeEach(() => vi.spyOn(rsoPolicy, "currentRsoUsePolicy").mockReturnValue(fixtureRsoPolicy([INTERIM_MODEL], TARGETS)));
afterEach(() => vi.restoreAllMocks());

const fixtureId = (value: string) => [...value].reduce((id, char) => (id * 31 + char.charCodeAt(0)) % 100000000, 1) + 1;
const hoursBefore = (iso: string, hours: number) => new Date(Date.parse(iso) - hours * 3600000).toISOString();
const skater = (id: string, team: string, positions: string[], availability: PlanningPlayer["availability"] = "rostered",
  extra: Partial<PlanningPlayer> = {}): PlanningPlayer => ({
  id, nhlId: fixtureId(id), nhlTeamId: fixtureId(team), rosterRevision: `roster-${id}-${team}`, name: id, teamAbbreviation: team,
  eligiblePositions: positions, eligibilityVerified: true, playerClass: "skater", availability, ownership: null, canDrop: true,
  holdValue: null, reserveEligibility: [], ...extra });
const goalie = (id: string, team: string, availability: PlanningPlayer["availability"] = "rostered", extra: Partial<PlanningPlayer> = {}) =>
  skater(id, team, ["G"], availability, { playerClass: "goalie", ...extra });
const matchups = (date: string, pairs: Array<[string, string]>): PlanningGame[] => pairs.flatMap(([home, away]) => [[home, away, true], [away, home, false]] as const)
  .map(([team, opponent, home]) => ({ id: `${team}-${date}`, scheduleRevision: `schedule-${team}-${date}`, date,
    startsAt: `${date}T23:00:00Z`, teamAbbreviation: team, opponent, home, status: "scheduled" as const }));
const SCHEDULE: Record<string, PlanningGame[]> = {
  [MON]: matchups(MON, [["TOR", "BOS"], ["MTL", "NYR"], ["EDM", "WPG"], ["VAN", "CGY"], ["PHI", "NJD"]]),
  [TUE]: matchups(TUE, [["CHI", "SEA"], ["DAL", "COL"], ["PHI", "CBJ"]]),
  [THU]: matchups(THU, [["TOR", "OTT"]]),
  [FRI]: matchups(FRI, [["BOS", "BUF"]]),
  [SAT]: matchups(SAT, [["TOR", "DET"]]),
  [SUN]: matchups(SUN, [["BOS", "PIT"]]),
};

// Per-game expected lines (interim fixture values). Skater lines: goals, assists, shots on goal.
const sk = (goals: number, assists: number, shots: number): StatLine => ({ GOALS: goals, ASSISTS: assists, SHOTS: shots });
const gl = (wins: number, saves: number, against: number): StatLine => ({ WINS_GOALIE: wins, SAVES_GOALIE: saves, GOALS_AGAINST_GOALIE: against });
/** Independent oracle: league points for one stat line under WEIGHTS. */
const fp = (stats: StatLine) => Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + (stats[key] ?? 0) * weight, 0);
const LINES: Record<string, StatLine> = {
  c1: sk(0.4, 0.5, 3), c2: sk(0.3, 0.4, 2.6), c3: sk(0.35, 0.3, 2.4), lw1: sk(0.3, 0.3, 2.2), lw2: sk(0.3, 0.35, 2.4),
  lw3: sk(0.2, 0.3, 2), rw1: sk(0.45, 0.5, 3.2), rw2: sk(0.25, 0.35, 2), rw3: sk(0.1, 0.2, 1.2),
  d1: sk(0.1, 0.4, 2), d2: sk(0.08, 0.3, 1.8), d3: sk(0.1, 0.35, 2.2), d4: sk(0.06, 0.25, 1.4), d5: sk(0.12, 0.3, 2),
  g1: gl(0.55, 26, 2.6), g2: gl(0.2, 14, 4.2), g3: gl(0.5, 25, 2.8),
  fa1: sk(0.45, 0.55, 3.4), fa2: sk(0.3, 0.3, 2), mystery: sk(0.9, 0.9, 5),
};
const START_PROBABILITY: Record<string, number> = { g1: 0.9, g2: 0.6, g3: 0.8 };

/** Full 17-player roster. Monday: 11 skaters + 2 goalies play (the 13 active slots); Tuesday: lw2, lw3, rw3, g3. */
function fullRoster(): PlanningPlayer[] {
  return [
    skater("c1", "TOR", ["C"]), skater("c2", "BOS", ["C"]), skater("c3", "MTL", ["C", "LW"]),
    skater("lw1", "NYR", ["LW"]), skater("lw2", "CHI", ["LW"]), skater("lw3", "SEA", ["LW"]),
    skater("rw1", "EDM", ["RW"]), skater("rw2", "WPG", ["RW"]), skater("rw3", "DAL", ["RW"]),
    skater("d1", "TOR", ["D"]), skater("d2", "BOS", ["D"]), skater("d3", "MTL", ["D"]), skater("d4", "NYR", ["D"]), skater("d5", "EDM", ["D"]),
    goalie("g1", "VAN"), goalie("g2", "CGY"), goalie("g3", "COL"),
  ];
}
const freeAgents = () => [skater("fa1", "PHI", ["C"], "free_agent"), skater("fa2", "NJD", ["LW", "RW"], "free_agent")];
const dailyPeriods = (dates: string[], remaining: number | null) => dates.map(date => ({ id: `day-${date}`,
  start: zonedMidnight(date, TZ), end: nextLocalMidnight(date, TZ), remaining, source: "manager" as const, timeZone: TZ }));
function dailyRules(overrides: Partial<LeagueRules> = {}): LeagueRules {
  return { lineupMode: "daily", rosterSlots: { ...SLOTS }, acquisitionTiming: "same_day", acquisitionCost: 1,
    waivers: { mode: "priority", remainingBudget: null }, periods: dailyPeriods(WEEK, 1),
    scoring: { mode: "points", weights: { ...WEIGHTS }, categories: [] },
    goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "none" }, unsupported: [], ...overrides };
}
function interimForecast(data: PlanningSnapshot, playerId: string, gameId: string, stats: StatLine, overrides: Partial<GameForecast> = {}): GameForecast {
  const member = data.players.find(row => row.id === playerId)!;
  const match = data.games.find(row => row.id === gameId)!;
  const issuedAt = hoursBefore(data.context.asOf, 2);
  return { playerId, gameId, stats, conditioning: "unconditional", sourceKind: "detailed", sourceWatermark: "interim-forge-bridge-fixture",
    cutoffAt: issuedAt, issuedAt, expiresAt: match.startsAt!, modelVersion: INTERIM_MODEL, revisionId: `interim-bridge:${playerId}:${gameId}`,
    rsoTargetBindings: fixtureRsoBindings(INTERIM_MODEL, issuedAt, Object.keys(stats)),
    issuedContext: { version: "forge-issued-context-v1", playerId, gameId, nhlPlayerId: member.nhlId!, teamId: member.nhlTeamId!,
      seasonId: SEASON, scheduledAt: match.startsAt!, scheduleRevision: match.scheduleRevision!, rosterRevision: member.rosterRevision!,
      observedAt: issuedAt, scheduleSourceUpdatedAt: issuedAt, scheduleFetchedAt: issuedAt, identityUpdatedAt: issuedAt,
      membershipCreatedAt: ["2026-09-01T00:00:00Z"] },
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
    startProbability: member.playerClass === "goalie" ? START_PROBABILITY[playerId] ?? null : null,
    confirmedStart: false, limitations: [INTERIM_LABEL], ...overrides };
}
/** Manual-provider daily snapshot; one interim forecast row per rostered/available player's game in range. */
function dailySnapshot(input: { id: string; startDate: string; endDate: string; asOf?: string; players: PlanningPlayer[];
  roster?: PlanningSnapshot["roster"]; rules?: Partial<LeagueRules>; lines?: Record<string, StatLine> }): PlanningSnapshot {
  const asOf = input.asOf ?? MON_ASOF;
  const dates = WEEK.filter(date => date >= input.startDate && date <= input.endDate);
  const data: PlanningSnapshot = {
    id: input.id, context: { provider: "manual", seasonId: SEASON, leagueId: "manual", teamId: "manual",
      startDate: input.startDate, endDate: input.endDate, timeZone: TZ, asOf },
    players: input.players,
    roster: input.roster ?? input.players.filter(row => row.availability === "rostered").map((row, index) => ({ playerId: row.id, position: index < 13 ? "active" : "bench" })),
    games: dates.flatMap(date => SCHEDULE[date] ?? []), forecasts: [], rules: dailyRules(input.rules), lockedAssignments: [],
    realized: {}, opponent: null,
    evidence: { schedule: { source: "Synthetic complete NHL schedule fixture", asOf: hoursBefore(asOf, 2), seasonId: SEASON, completeness: "complete", limitations: [] } },
  };
  const lines = { ...LINES, ...input.lines };
  data.forecasts = data.games.flatMap(match => data.players.filter(row => row.teamAbbreviation === match.teamAbbreviation && lines[row.id])
    .map(row => interimForecast(data, row.id, match.id, lines[row.id])));
  return data;
}

const intent = (overrides: Partial<PlanIntent> = {}): PlanIntent => ({ ...defaultIntent(), revision: 1, goalieWindow: "any", alternativeCount: 10, ...overrides });
const assigned = (plan: PlanEvaluation, date?: string) => plan.assignments.filter(row => !date || row.date === date).map(row => row.playerId).sort();
const slotOf = (plan: PlanEvaluation, playerId: string, date: string) => plan.assignments.find(row => row.playerId === playerId && row.date === date)?.slotId;
/** Oracle value of a set of (player, date) starts under WEIGHTS. */
const value = (starts: Array<[string, string]>) => starts.reduce((sum, [id]) => sum + fp(LINES[id]), 0);
const startsOf = (plan: PlanEvaluation) => plan.assignments.map(row => [row.playerId, row.date] as [string, string]);
const addStep = (id: string, playerId: string, at: string, extra: Partial<PlanStep> = {}): PlanStep => ({
  id, type: "add", playerId, at, effectiveAt: at, conditional: Date.parse(at) > Date.parse(MON_ASOF), dependsOn: [], ...extra });
/** Every active slot is legal for its player, filled once per day, and the player's team plays that game. */
function expectLegalLineup(data: PlanningSnapshot, plan: PlanEvaluation) {
  const slots = new Map(expandActiveSlots(data.rules.rosterSlots).activeSlots.map(slot => [slot.id, slot.type]));
  const daySlots = new Set<string>(), dayPlayers = new Set<string>();
  for (const row of plan.assignments) {
    const player = data.players.find(item => item.id === row.playerId)!;
    const match = data.games.find(item => item.id === row.gameId)!;
    expect(slots.has(row.slotId), `${row.slotId} exists`).toBe(true);
    expect(canEligibilityOccupySlot(normalizeEligibility(player.eligiblePositions), slots.get(row.slotId)!), `${row.playerId} in ${row.slotId}`).toBe(true);
    expect(match.teamAbbreviation).toBe(player.teamAbbreviation);
    expect(match.date).toBe(row.date);
    expect(daySlots.has(`${row.date}:${row.slotId}`)).toBe(false);
    expect(dayPlayers.has(`${row.date}:${row.playerId}`)).toBe(false);
    daySlots.add(`${row.date}:${row.slotId}`); dayPlayers.add(`${row.date}:${row.playerId}`);
  }
}

describe("RSO daily beta: manual/free acceptance packet", () => {
  describe("(a) full roster, no moves: legal dual-eligibility lineup and the optimized baseline", () => {
    const monday = () => dailySnapshot({ id: "a-monday", startDate: MON, endDate: MON, players: fullRoster() });
    const MONDAY_PLAYING = ["c1", "c2", "c3", "lw1", "rw1", "rw2", "d1", "d2", "d3", "d4", "d5", "g1", "g2"];

    it("fills all 13 active slots only by using the C/LW player at LW, with a legal lineup", () => {
      const data = monday();
      const agp = evaluatePlan(data, intent(), "agp", []);
      expectLegalLineup(data, agp);
      expect(agp).toMatchObject({ legal: true, budgetVerified: true, scheduledGames: 13, activeGames: 13, benchGames: 0, steps: [] });
      expect(assigned(agp)).toEqual([...MONDAY_PLAYING].sort());
      expect(slotOf(agp, "c3", MON)).toMatch(/^LW#/);
      // Five playing defensemen for four D slots: the fifth takes UTIL rather than the bench.
      expect(["d1", "d2", "d3", "d4", "d5"]).toContain(agp.assignments.find(row => row.slotId === "UTIL#1")?.playerId);
      // Counterfactual: without the dual eligibility, one start is lost.
      const singleEligibility = { ...data, players: data.players.map(row => row.id === "c3" ? { ...row, eligiblePositions: ["C"] } : row) };
      expect(evaluatePlan(singleEligibility, intent(), "agp", []).activeGames).toBe(12);
    });

    it("separates maximum usable starts from best projected outcome against the same no-move baseline", () => {
      const data = monday(), before = structuredClone(data);
      const result = planRoster(data, intent());
      expect(result.noMoveAgp.activeGames).toBe(13);
      expect(result.noMoveAgp.projectedValue).toBeCloseTo(value(MONDAY_PLAYING.map(id => [id, MON])), 9);
      // g2 projects negative points: best outcome benches him, maximum starts does not.
      expect(fp(LINES.g2)).toBeLessThan(0);
      expect(result.noMoveOutcome.activeGames).toBe(12);
      expect(assigned(result.noMoveOutcome)).not.toContain("g2");
      expect(result.noMoveOutcome.recommendation?.exclusions).toEqual(expect.arrayContaining([
        expect.objectContaining({ playerId: "g2", date: MON, reason: "negative_value" })]));
      expect(result.noMoveOutcome.projectedValue).toBeCloseTo(value(MONDAY_PLAYING.filter(id => id !== "g2").map(id => [id, MON])), 9);
      expect(result.noMoveOutcome.projectedValue!).toBeGreaterThan(result.noMoveAgp.projectedValue!);
      expectLegalLineup(data, result.noMoveOutcome);
      // Auto objective uses points because every lineup projection qualifies; the selected no-move plan is that baseline.
      expect(result.noMoveOutcome.recommendation?.eligible).toBe(true);
      expect(result.baseline).toEqual(result.noMoveOutcome);
      expect(result.selected).toMatchObject({ objective: "outcome", steps: [], legal: true, comparisonEligible: true,
        projectedValue: result.baseline.projectedValue, assignments: result.baseline.assignments });
      expect(result.selected.limitations).not.toContain(expect.stringMatching(/unknown/i));
      // The manager's "most starts" goal uses the AGP baseline instead.
      expect(planRoster(data, intent({ objective: "agp" })).baseline).toEqual(result.noMoveAgp);
      expect(data).toEqual(before);
    });

    it("is deterministic under input reordering", () => {
      const data = monday();
      const reversed = { ...data, players: [...data.players].reverse(), roster: [...data.roster].reverse(),
        games: [...data.games].reverse(), forecasts: [...data.forecasts].reverse() };
      const sorted = (plan: PlanEvaluation) => [...plan.assignments].sort((a, b) => a.slotId.localeCompare(b.slotId));
      const a = planRoster(data, intent()), b = planRoster(reversed, intent());
      expect(sorted(b.selected)).toEqual(sorted(a.selected));
      expect(b.selected.projectedValue).toBeCloseTo(a.selected.projectedValue!, 9);
    });
  });

  describe("(b) one-add/one-drop stream: submit/effective timing, daily add limit, displaced starts and lost contribution", () => {
    const stream = () => dailySnapshot({ id: "b-stream", startDate: MON, endDate: TUE, players: [...fullRoster(), ...freeAgents()] });
    const add = addStep("stream", "fa1", MON_ASOF, { dropPlayerId: "lw3" });

    it("counts the displaced start and the dropped player's lost games in the net gain", () => {
      const data = stream();
      const baseline = evaluatePlan(data, intent(), "outcome", []);
      const selected = evaluatePlan(data, intent(), "outcome", [add]);
      expectLegalLineup(data, selected);
      expect(selected).toMatchObject({ legal: true, budgetVerified: true, acquisitions: { [`day-${MON}`]: 1 }, comparisonEligible: true });
      // Monday: fa1 starts and d4 (lowest eligible value) is displaced; Tuesday: lw3's start is lost with the drop.
      expect(assigned(baseline, MON)).toContain("d4");
      expect(assigned(selected, MON)).toContain("fa1");
      expect(assigned(selected, MON)).not.toContain("d4");
      expect(selected.recommendation?.exclusions).toEqual(expect.arrayContaining([expect.objectContaining({ playerId: "d4", date: MON })]));
      expect(assigned(baseline, TUE)).toContain("lw3");
      expect(assigned(selected, TUE)).toEqual(expect.arrayContaining(["fa1"]));
      expect(assigned(selected, TUE)).not.toContain("lw3");
      const expectedGain = (fp(LINES.fa1) - fp(LINES.d4)) + (fp(LINES.fa1) - fp(LINES.lw3));
      expect(selected.projectedValue! - baseline.projectedValue!).toBeCloseTo(expectedGain, 9);
      expect(selected.projectedValue! - baseline.projectedValue!).not.toBeCloseTo(2 * fp(LINES.fa1), 3);
      expect(selected.activeGames).toBe(baseline.activeGames);
    });

    it("keeps the manager's selected stream against the same optimized no-move baseline", () => {
      const data = stream();
      const result = planRoster(data, intent({ steps: [add] }), { maxSteps: 1, maxCandidates: 2, maxEvaluations: 120 });
      expect(result.selected.steps).toEqual([add]);
      expect(result.baseline.steps).toEqual([]);
      expect(result.baseline).toEqual(result.noMoveOutcome);
      expect(result.selected.legal).toBe(true);
    });

    it("enforces a one-add daily limit per league day, and a new day resets it", () => {
      const data = stream();
      const second = addStep("second", "fa2", MON_ASOF, { dropPlayerId: "rw3", dependsOn: ["stream"] });
      const sameDay = evaluatePlan(data, intent(), "agp", [add, second]);
      expect(sameDay.legal).toBe(false);
      expect(sameDay.limitations).toContain(`Acquisition allowance exceeded for day-${MON}.`);
      const tuesday = addStep("tuesday", "fa2", zonedMidnight(TUE, TZ), { dropPlayerId: "rw3", dependsOn: ["stream"] });
      expect(tuesday.conditional).toBe(true);
      const nextDay = evaluatePlan(data, intent(), "agp", [add, tuesday]);
      expect(nextDay).toMatchObject({ legal: true, budgetVerified: true, acquisitions: { [`day-${MON}`]: 1, [`day-${TUE}`]: 1 } });
      expect(nextDay.limitations).toContain("Future availability for fa2 must be rechecked before tuesday.");
      // Streaming the streamer: Tuesday's add may drop Monday's pickup.
      const churn = addStep("churn", "fa2", zonedMidnight(TUE, TZ), { dropPlayerId: "fa1", dependsOn: ["stream"] });
      expect(evaluatePlan(data, intent(), "agp", [add, churn]).legal).toBe(true);
      expect(reconcileIntent(data, intent({ steps: [add, churn] })).issues).toEqual([]);
    });

    it("only credits games after the effective time of the move", () => {
      const data = stream();
      const baseline = evaluatePlan(data, intent(), "outcome", []);
      // Submitted after the 19:00 Toronto puck drop: same-day effective, so fa1's Monday game is gone.
      const late = evaluatePlan(data, intent(), "outcome", [addStep("late", "fa1", "2026-10-19T23:30:00Z", { dropPlayerId: "lw3" })]);
      expect(late.legal).toBe(true);
      expect(assigned(late, MON)).not.toContain("fa1");
      expect(assigned(late, MON)).toContain("d4");
      expect(assigned(late, TUE)).toContain("fa1");
      expect(late.projectedValue! - baseline.projectedValue!).toBeCloseTo(fp(LINES.fa1) - fp(LINES.lw3), 9);
      // Next-day leagues: a Monday submission takes effect at Tuesday 00:00 Toronto (04:00Z), never earlier.
      const nextDayRules = { ...data, rules: { ...data.rules, acquisitionTiming: "next_day" as const } };
      const fa1 = data.players.find(row => row.id === "fa1")!;
      expect(acquisitionEffectiveAt(nextDayRules, fa1, MON_ASOF)).toBe("2026-10-20T04:00:00.000Z");
      const early = evaluatePlan(nextDayRules, intent(), "agp", [add]);
      expect(early.legal).toBe(false);
      expect(early.limitations).toContain("Next-day acquisition stream is effective too early.");
      const onTime = evaluatePlan(nextDayRules, intent(), "outcome", [{ ...add, effectiveAt: "2026-10-20T04:00:00.000Z" }]);
      expect(onTime.legal).toBe(true);
      expect(assigned(onTime, MON)).not.toContain("fa1");
      // Unknown acquisition timing cannot establish a legal move.
      const unknownTiming = { ...data, rules: { ...data.rules, acquisitionTiming: "unknown" as const } };
      expect(acquisitionEffectiveAt(unknownTiming, fa1, MON_ASOF)).toBeNull();
      expect(evaluatePlan(unknownTiming, intent(), "agp", [add]).legal).toBe(false);
    });

    it("waits for waiver clearance and enforces a FAAB budget", () => {
      const players = [...fullRoster(), skater("wv", "PHI", ["C"], "waivers", { waiverClearsAt: "2026-10-20T08:00:00Z" })];
      const data = dailySnapshot({ id: "b-waivers", startDate: MON, endDate: TUE, players, lines: { wv: LINES.fa1 },
        rules: { waivers: { mode: "budget", remainingBudget: 5 } } });
      expect(acquisitionEffectiveAt(data, players.at(-1)!, MON_ASOF)).toBe("2026-10-20T08:00:00Z");
      const claim = (spend: number) => addStep("claim", "wv", MON_ASOF, { effectiveAt: "2026-10-20T08:00:00Z", conditional: true, dropPlayerId: "lw3", waiverSpend: spend });
      const over = evaluatePlan(data, intent(), "agp", [claim(7)]);
      expect(over.legal).toBe(false);
      expect(over.limitations).toContain("Waiver budget exceeded.");
      const within = evaluatePlan(data, intent(), "outcome", [claim(3)]);
      expect(within).toMatchObject({ legal: true, budgetVerified: true });
      expect(assigned(within, MON)).not.toContain("wv");
      expect(assigned(within, TUE)).toContain("wv");
      expect(evaluatePlan(data, intent(), "agp", [{ ...claim(3), conditional: false }]).legal).toBe(false);
    });
  });

  describe("(c) an IR/IR+ vacancy is used before any drop", () => {
    // lw2 is out (provider-style IR designation) and reserve-eligible; the 17 active/bench places are full.
    const injured = (capacity: "IR" | "IR+") => dailySnapshot({ id: `c-${capacity}`, startDate: MON, endDate: TUE,
      players: [...fullRoster().map(row => row.id === "lw2" ? { ...row, reserveEligibility: [capacity],
        injury: { status: "IR", label: "Injured Reserve", note: null } } : row), freeAgents()[0]] });

    it.each(["IR", "IR+"] as const)("moves the injured player to an open %s slot instead of dropping anyone", capacity => {
      const data = injured(capacity), before = structuredClone(data);
      const result = planRoster(data, intent(), { maxSteps: 1, maxCandidates: 1, maxEvaluations: 200 });
      const addPlans = result.alternatives.filter(plan => plan.steps.some(step => step.type === "add"));
      expect(addPlans.length).toBeGreaterThan(0);
      const best = addPlans[0];
      expect(best.steps.map(step => step.type)).toEqual(["reserve", "add"]);
      expect(best.steps[0]).toMatchObject({ playerId: "lw2", reservePosition: capacity });
      expect(best.steps.some(step => step.dropPlayerId || step.type === "drop")).toBe(false);
      expect(best).toMatchObject({ legal: true, budgetVerified: true, acquisitions: { [`day-${MON}`]: 1 } });
      expectLegalLineup(data, best);
      // Net gain counts fa1 over displaced d4 on Monday and fa1's whole Tuesday start; lw2 (out) contributed nothing.
      expect(best.projectedValue! - result.baseline.projectedValue!).toBeCloseTo((fp(LINES.fa1) - fp(LINES.d4)) + fp(LINES.fa1), 9);
      expect(result.baseline.limitations).toContain("Not lined up while injured (provider IR/out): lw2.");
      // Every drop plan ranks after the reserve plan.
      const dropIndex = result.alternatives.findIndex(plan => plan.steps.some(step => step.dropPlayerId || step.type === "drop"));
      expect(dropIndex === -1 || dropIndex > result.alternatives.indexOf(best)).toBe(true);
      expect(data).toEqual(before);
    });

    it("uses an open bench place without a drop or reserve move", () => {
      const players = [...fullRoster().filter(row => row.id !== "rw3"), freeAgents()[0]];
      const data = dailySnapshot({ id: "c-vacancy", startDate: MON, endDate: TUE, players });
      const result = planRoster(data, intent(), { maxSteps: 1, maxCandidates: 1, maxEvaluations: 200 });
      const best = result.alternatives.find(plan => plan.steps.some(step => step.type === "add"))!;
      expect(best.steps.map(step => step.type)).toEqual(["add"]);
      expect(best.steps[0].dropPlayerId).toBeUndefined();
    });

    // Regression for MANUAL D1: reconciliation rechecks selected reserve moves.
    it("refresh flags a selected IR move whose player is no longer reserve-eligible", () => {
      const data = injured("IR");
      const reserve: PlanStep = { id: "reserve", type: "reserve", playerId: "lw2", reservePosition: "IR", at: MON_ASOF, effectiveAt: MON_ASOF, conditional: false, dependsOn: [] };
      const selected = intent({ steps: [reserve, addStep("add", "fa1", MON_ASOF, { dependsOn: ["reserve"] })] });
      expect(evaluatePlan(data, selected, "agp").legal).toBe(true);
      expect(reconcileIntent(data, selected, data).issues).toEqual([]);
      // Refresh: lw2 was activated from IR, so the selected IR move (and the add that needs its room) is now illegal.
      const healthy = { ...data, players: data.players.map(row => row.id === "lw2" ? { ...row, reserveEligibility: [], injury: null } : row) };
      expect(evaluatePlan(healthy, selected, "agp").legal).toBe(false);
      const proposal = reconcileIntent(healthy, selected, data);
      expect(proposal.issues.map(issue => issue.stepId)).toEqual(expect.arrayContaining(["reserve", "add"]));
      expect(proposal.suggestedSteps).toEqual([]);
    });

    it("rejects a reserve move without verified reserve eligibility or room", () => {
      const data = injured("IR");
      const at = MON_ASOF;
      const bad = evaluatePlan(data, intent(), "agp", [{ id: "reserve", type: "reserve", playerId: "lw3", reservePosition: "IR", at, effectiveAt: at, conditional: false, dependsOn: [] }]);
      expect(bad.legal).toBe(false);
      expect(bad.limitations).toContain("Invalid reserve move for lw3.");
      const full = { ...data, rules: { ...data.rules, rosterSlots: { ...data.rules.rosterSlots, IR: 0 } } };
      expect(evaluatePlan(full, intent(), "agp", [{ id: "reserve", type: "reserve", playerId: "lw2", reservePosition: "IR", at, effectiveAt: at, conditional: false, dependsOn: [] }]).limitations)
        .toContain("IR capacity exceeded.");
    });
  });

  describe("(d) goalie minimum keeps credited, confirmed and projected starts separate", () => {
    // Thursday check-in, Yahoo-style 3-start weekly minimum; one start already credited Monday.
    const THU_ASOF = "2026-10-22T14:00:00Z";
    const probabilities: Record<string, number | null> = { [`gB-BOS-${FRI}`]: 0.6, [`gA-TOR-${SAT}`]: 0.55 };
    function midweek(sunday: number | null, override: Record<string, number | null> = {}) {
      const data = dailySnapshot({ id: "d-goalies", startDate: THU, endDate: SUN, asOf: THU_ASOF, lines: { gA: gl(0.5, 25, 2.7), gB: gl(0.45, 24, 2.9) },
        players: [goalie("gA", "TOR"), goalie("gB", "BOS"), skater("c1", "TOR", ["C"]), skater("d2", "BOS", ["D"])],
        rules: { goalieMinimum: { required: 3, credited: 1, counts: "starts", penalty: "none", periodStart: MON, periodEnd: "2026-10-26" } } });
      const table: Record<string, number | null> = { ...probabilities, [`gB-BOS-${SUN}`]: sunday, ...override };
      data.forecasts = data.forecasts.map(row => row.playerId === "gA" && row.gameId === `TOR-${THU}`
        ? { ...row, confirmedStart: true, startProbability: 1 }
        : `${row.playerId}-${row.gameId}` in table ? { ...row, startProbability: table[`${row.playerId}-${row.gameId}`] } : row);
      return data;
    }
    const cover = intent({ goalieCoverage: "cover" });

    it("keeps projected unknown when a selected goalie start probability is missing", () => {
      const data = midweek(null);
      const plan = evaluatePlan(data, cover, "agp", []);
      expect(assigned(plan).filter(id => id.startsWith("g"))).toHaveLength(4);
      expect(plan.goalie).toMatchObject({ required: 3, credited: 1, confirmed: 1, expectedStarts: null, projected: null, risk: true, minimumSatisfied: false });
      expect(plan.limitations).toContain("Missing starter probabilities leave requested projected goalie coverage unresolved.");
      expect(plan.limitations).toContain("Goalie minimum coverage is not verified.");
    });

    it("adds probabilities to projected starts without ever crediting them", () => {
      const data = midweek(0.5), before = structuredClone(data);
      const plan = evaluatePlan(data, cover, "agp", []);
      expect(plan.goalie.expectedStarts).toBeCloseTo(1 + 0.6 + 0.55 + 0.5, 9);
      expect(plan.goalie.projected).toBeCloseTo(1 + 2.65, 9);
      expect(plan.goalie).toMatchObject({ credited: 1, confirmed: 1, required: 3, risk: false, minimumSatisfied: false });
      const result = planRoster(data, cover, { maxSteps: 0 });
      expect(result.selected.goalie.credited).toBe(1);
      expect(data.rules.goalieMinimum.credited).toBe(1);
      expect(data).toEqual(before);
      // Low probabilities leave the minimum at risk even though four starts are scheduled.
      const thin = evaluatePlan(midweek(0.3, { [`gB-BOS-${FRI}`]: 0.2, [`gA-TOR-${SAT}`]: 0.1 }), cover, "agp", []);
      expect(thin.goalie.projected).toBeCloseTo(1 + 1 + 0.2 + 0.1 + 0.3, 9);
      expect(thin.goalie).toMatchObject({ credited: 1, confirmed: 1, risk: true });
      expect(thin.limitations).toContain("Goalie minimum coverage is not verified.");
    });

    // Regression for MANUAL D2: a met minimum never turns an unknown start probability into zero.
    it("keeps projected starts unknown after the minimum is met when a start probability is missing", () => {
      const data = midweek(null);
      data.rules = { ...data.rules, goalieMinimum: { ...data.rules.goalieMinimum, credited: 3 } };
      const plan = evaluatePlan(data, cover, "agp", []);
      expect(plan.goalie).toMatchObject({ credited: 3, confirmed: 1, minimumSatisfied: true, risk: false, expectedStarts: null });
      expect(plan.goalie.projected).toBeNull();
    });

    it("flags changed starter evidence on refresh", () => {
      const previous = midweek(0.5), next = midweek(0.7);
      const issues = reconcileIntent(next, cover, previous).issues;
      expect(issues).toContainEqual({ stepId: null, message: "Goalie minimum progress or starter evidence changed; review coverage and outcome tradeoffs." });
    });
  });

  describe("(e) missing evidence stays unknown or narrows the comparison, never zero", () => {
    const monday = (players = fullRoster()) => dailySnapshot({ id: "e-monday", startDate: MON, endDate: MON, players });

    it("a missing forecast head leaves points unknown but keeps schedule capacity", () => {
      const data = monday();
      data.forecasts = data.forecasts.filter(row => !(row.playerId === "rw2" && row.gameId === `WPG-${MON}`));
      const outcome = evaluatePlan(data, intent(), "outcome", []);
      expect(outcome.projectedValue).toBeNull();
      expect(outcome.projectedStats.GOALS).toBeNull();
      expect(outcome.comparisonEligible).toBe(false);
      expect(outcome.recommendation).toMatchObject({ eligible: false, mode: "schedule_capacity" });
      expect(outcome.recommendation?.unresolved).toEqual(expect.arrayContaining([expect.objectContaining({ playerId: "rw2", gameId: `WPG-${MON}` })]));
      expect(evaluatePlan(data, intent(), "agp", []).activeGames).toBe(13);
      const result = planRoster(data, intent({ objective: "outcome" }), { maxSteps: 0 });
      expect(result.baseline).toEqual(result.noMoveAgp);
      expect(result.search.limitations).toContain("Best projected points needs projections for your whole lineup; planning for most starts until then.");
      expect(result.selected.projectedValue).toBeNull();
    });

    it("an unentered or unmatched scoring weight leaves projected points unknown", () => {
      const data = monday();
      const withHits = { ...data, rules: { ...data.rules, scoring: { ...data.rules.scoring, weights: { ...WEIGHTS, HITS: 0.1 } } } };
      const hits = evaluatePlan(withHits, intent(), "outcome", []);
      expect(hits.projectedValue).toBeNull();
      expect(hits.limitations).toContain("Projected HITS is incomplete.");
      const blank = { ...data, rules: { ...data.rules, scoring: { mode: "points" as const, weights: {}, categories: [] } } };
      const empty = evaluatePlan(blank, intent(), "outcome", []);
      expect(empty.projectedValue).toBeNull();
      expect(empty.assignmentValue).toBeNull();
      expect(evaluatePlan(blank, intent(), "agp", []).activeGames).toBe(13);
    });

    it("never adds a player whose availability is unknown", () => {
      const players = [...fullRoster(), skater("mystery", "PHI", ["C"], "unknown")];
      const data = dailySnapshot({ id: "e-availability", startDate: MON, endDate: MON, players });
      const result = planRoster(data, intent(), { maxSteps: 1, maxCandidates: 5, maxEvaluations: 120 });
      expect(result.alternatives.flatMap(plan => plan.steps).some(step => step.playerId === "mystery")).toBe(false);
      const forced = evaluatePlan(data, intent(), "agp", [addStep("x", "mystery", MON_ASOF, { dropPlayerId: "d4" })]);
      expect(forced.legal).toBe(false);
      expect(forced.limitations).toContain("Player mystery is not verified available.");
      // The manager can mark him available (manual "Mark available"), which makes the move legal.
      const marked = { ...data, players: data.players.map(row => row.id === "mystery" ? { ...row, availability: "manager_available" as const } : row) };
      expect(evaluatePlan(marked, intent(), "agp", [addStep("x", "mystery", MON_ASOF, { dropPlayerId: "d4" })]).legal).toBe(true);
    });

    it("unknown NHL team membership makes opportunities indeterminate", () => {
      const data = monday(fullRoster().map(row => row.id === "lw3" ? { ...row, teamAbbreviation: null } : row));
      const plan = evaluatePlan(data, intent(), "outcome", []);
      expect(plan.projectedValue).toBeNull();
      expect(plan.limitations).toContain("Player lw3 has unknown current NHL team membership; remaining opportunities and net gains are indeterminate.");
    });

    it("unreviewed interim rows under the production review catalog are unknown, not zero", () => {
      vi.spyOn(rsoPolicy, "currentRsoUsePolicy").mockReturnValue(rsoPolicy.RSO_USE_POLICY);
      const data = monday();
      const outcome = evaluatePlan(data, intent(), "outcome", []);
      expect(outcome.projectedValue).toBeNull();
      expect(outcome.recommendation?.eligible).toBe(false);
      expect(evaluatePlan(data, intent(), "agp", []).activeGames).toBe(13);
    });
  });

  describe("(f) protections are separate from locks, and automatic must-keep is off", () => {
    // g2 is a widely rostered starter who projects negative points this horizon.
    const contested = () => dailySnapshot({ id: "f-protect", startDate: MON, endDate: TUE,
      players: [...fullRoster().map(row => row.id === "g2" ? { ...row, ownership: 92, holdValue: 50 } : row), freeAgents()[0]] });
    const options = { maxSteps: 1, maxCandidates: 1, maxEvaluations: 200 };
    const drops = (plans: PlanEvaluation[]) => plans.flatMap(plan => plan.steps.flatMap(step => step.dropPlayerId ? [step.dropPlayerId] : step.type === "drop" ? [step.playerId] : []));

    it("has no automatic must-keep: a high-demand player is cautioned, not protected", () => {
      expect(defaultIntent().protectedPlayerIds).toEqual([]);
      expect(defaultWorkspace(new Date(MON_ASOF)).intent.protectedPlayerIds).toEqual([]);
      const data = contested();
      expect(retentionCaution(data.players.find(row => row.id === "g2"))).toEqual({ level: "high_demand", ownership: 92 });
      const result = planRoster(data, intent(), options);
      expect(drops(result.alternatives)).toContain("g2");
    });

    it("a protection blocks drops but does not force a start", () => {
      const data = contested();
      const guarded = intent({ protectedPlayerIds: ["g2"] });
      const result = planRoster(data, guarded, options);
      expect(drops(result.alternatives)).not.toContain("g2");
      expect(assigned(result.baseline, MON)).not.toContain("g2");
      const forced = evaluatePlan(data, guarded, "agp", [addStep("x", "fa1", MON_ASOF, { dropPlayerId: "g2" })]);
      expect(forced.legal).toBe(false);
      expect(forced.limitations).toContain("Invalid drop prerequisite for x.");
    });

    it("a lock fixes the slot for its day but is not a protection", () => {
      const data = contested();
      data.lockedAssignments = [{ date: MON, playerId: "g2", slotId: "G#2", source: "manager" }];
      const locked = evaluatePlan(data, intent(), "outcome", []);
      expect(locked.assignments).toContainEqual(expect.objectContaining({ playerId: "g2", date: MON, slotId: "G#2", locked: true }));
      expectLegalLineup(data, locked);
      const sameDay = evaluatePlan(data, intent(), "agp", [addStep("x", "fa1", MON_ASOF, { dropPlayerId: "g2" })]);
      expect(sameDay.legal).toBe(false);
      expect(sameDay.limitations).toContain("Drop conflicts with locked assignment for g2.");
      const tuesday = evaluatePlan(data, intent(), "agp", [addStep("x", "fa1", zonedMidnight(TUE, TZ), { dropPlayerId: "g2" })]);
      expect(tuesday.legal).toBe(true);
    });
  });

  describe("(g) refresh-style reconciliation keeps the selected moves and Undo", () => {
    const SELECTED_AT = "2026-10-19T18:00:00Z"; // planned for 14:00 Toronto, before puck drop
    const stream = (asOf = MON_ASOF) => dailySnapshot({ id: `g-${asOf}`, startDate: MON, endDate: TUE, asOf, players: [...fullRoster(), ...freeAgents()] });
    const selectedSteps = [addStep("stream", "fa1", SELECTED_AT, { dropPlayerId: "lw3", conditional: true })];
    function memoryStorage() {
      const values = new Map<string, string>();
      return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    }
    function savedWorkspaces(data: PlanningSnapshot) {
      const storage = memoryStorage();
      const original: PlanningWorkspace = { ...defaultWorkspace(new Date(MON_ASOF)), context: data.context, rules: data.rules, roster: data.roster };
      expect(writeWorkspace(storage, original, [])).toBeNull();
      const chosen: PlanningWorkspace = { ...original, intent: { ...original.intent, revision: 1, goalieWindow: "any", steps: selectedSteps } };
      expect(writeWorkspace(storage, chosen, [original])).toBeNull();
      return { storage, original, chosen };
    }

    it("saves the selected moves with an Undo entry", () => {
      const data = stream();
      const { storage, original, chosen } = savedWorkspaces(data);
      expect(readWorkspace(storage, chosen.context)?.intent.steps).toEqual(selectedSteps);
      expect(readWorkspaceHistory(storage, chosen)).toEqual([original]);
    });

    it("a refresh with better alternatives never replaces the selected moves", () => {
      const first = stream(), { storage, chosen } = savedWorkspaces(first);
      const frozen = structuredClone(chosen.intent);
      // 15:00Z refresh: fa2 now projects far above fa1.
      const refreshed = stream("2026-10-19T15:00:00Z");
      refreshed.forecasts = refreshed.forecasts.map(row => row.playerId === "fa2" ? { ...row, stats: sk(1.2, 1.2, 6) } : row);
      const proposal = reconcileIntent(refreshed, chosen.intent, first);
      expect(proposal).toMatchObject({ issues: [], suggestedSteps: null, intentRevision: 1 });
      const result = planRoster(refreshed, chosen.intent, { maxSteps: 1, maxCandidates: 2, maxEvaluations: 160 });
      expect(result.selected.steps).toEqual(selectedSteps);
      expect(result.selected.legal).toBe(true);
      expect(result.alternatives.some(plan => plan.steps.some(step => step.playerId === "fa2")
        && plan.projectedValue! > result.selected.projectedValue!)).toBe(true);
      expect(chosen.intent).toEqual(frozen);
      expect(readWorkspaceHistory(storage, chosen)).toHaveLength(1);
    });

    it("an invalidating refresh proposes a repair but keeps the moves until accepted, and Undo restores them", () => {
      const first = stream(), { storage, original, chosen } = savedWorkspaces(first);
      const claimed = stream("2026-10-19T15:00:00Z");
      claimed.players = claimed.players.map(row => row.id === "fa1" ? { ...row, availability: "unknown" as const } : row);
      claimed.rules = { ...claimed.rules, periods: claimed.rules.periods.map(period => period.id === `day-${MON}` ? { ...period, remaining: 0 } : period) };
      const proposal = reconcileIntent(claimed, chosen.intent, first);
      expect(proposal.issues).toEqual(expect.arrayContaining([
        { stepId: null, message: "Acquisition allowances or waiver constraints changed; review the selected itinerary." },
        { stepId: "stream", message: "fa1 is no longer verified as available." }]));
      expect(proposal.suggestedSteps).toEqual([]);
      expect(chosen.intent.steps).toEqual(selectedSteps);
      // The planner evaluates the manager's moves as selected (now illegal) instead of silently swapping them.
      const result = planRoster(claimed, chosen.intent, { maxSteps: 0 });
      expect(result.selected.steps).toEqual(selectedSteps);
      expect(result.selected.legal).toBe(false);
      // Accepting the repair is an explicit new revision; Undo returns the selected moves.
      const repaired: PlanningWorkspace = { ...chosen, intent: { ...chosen.intent, revision: 2, steps: proposal.suggestedSteps! } };
      expect(writeWorkspace(storage, repaired, [original, chosen])).toBeNull();
      const history = readWorkspaceHistory(storage, repaired);
      expect(history.at(-1)?.intent.steps).toEqual(selectedSteps);
      expect(history.at(-1)?.intent.revision).toBe(1);
    });
  });
});
