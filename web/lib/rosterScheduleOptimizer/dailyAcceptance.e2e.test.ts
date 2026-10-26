// @vitest-environment node
// RSO daily beta: end-to-end acceptance packet on the interim FORGE bridge (Astra slice 2, lane RSO-FLAKE).
// Drives the real planner, candidate comparison, reconciliation and per-account workspace storage through one
// small daily points league, and asserts outcomes only (not planner internals). Every input is a synthetic
// fixture labelled as an interim bridge value: no Supabase, Yahoo, network or production read. The bridge is
// admitted only under the fictional fixture review; it never stands in for a native permission denial.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as rsoPolicy from "../player-forecasts/rsoUsePolicy";
import { fixtureRsoBindings, fixtureRsoPolicy } from "../player-forecasts/rsoUsePolicy.fixtures";
import { candidatePlanMetrics, type CandidatePlan } from "./candidatePlanMetrics";
import { evaluatePlan } from "./planning";
import { nextLocalMidnight, zonedMidnight } from "./planningDates";
import { reconcileIntent } from "./reconciliation";
import { defaultIntent, defaultWorkspace, readWorkspace, readWorkspaceHistory, workspaceStorageKey, writeWorkspace } from "./workspace";
import type { GameForecast, LeagueRules, PlanIntent, PlanningGame, PlanningPlayer, PlanningSnapshot, PlanningWorkspace, StatLine } from "./planningTypes";

const SEASON = 20262027;
const TZ = "America/Toronto";
const MON = "2026-10-19", TUE = "2026-10-20", WED = "2026-10-21";
const WEEK = [MON, TUE, WED];
const AS_OF = "2026-10-19T14:00:00Z"; // 10:00 Toronto, before every 19:00 puck drop
const INTERIM_MODEL = "interim-forge-bridge-fixture-v1";
const INTERIM_LABEL = "Interim FORGE bridge fixture value (synthetic); not a calibrated FORGE forecast.";
const WEIGHTS = { GOALS: 3, ASSISTS: 2, SHOTS: 0.5 };

beforeEach(() => vi.spyOn(rsoPolicy, "currentRsoUsePolicy").mockReturnValue(fixtureRsoPolicy([INTERIM_MODEL], Object.keys(WEIGHTS))));
afterEach(() => vi.restoreAllMocks());

const fixtureId = (value: string) => [...value].reduce((id, char) => (id * 31 + char.charCodeAt(0)) % 100000000, 1) + 1;
const hoursBefore = (iso: string, hours: number) => new Date(Date.parse(iso) - hours * 3600000).toISOString();
const skater = (id: string, team: string, positions: string[], availability: PlanningPlayer["availability"] = "rostered"): PlanningPlayer => ({
  id, nhlId: fixtureId(id), nhlTeamId: fixtureId(team), rosterRevision: `roster-${id}-${team}`, name: id, teamAbbreviation: team,
  eligiblePositions: positions, eligibilityVerified: true, playerClass: "skater", availability, ownership: null, canDrop: true,
  holdValue: null, reserveEligibility: [] });
const matchups = (date: string, pairs: Array<[string, string]>): PlanningGame[] => pairs.flatMap(([home, away]) => [[home, away, true], [away, home, false]] as const)
  .map(([team, opponent, home]) => ({ id: `${team}-${date}`, scheduleRevision: `schedule-${team}-${date}`, date,
    startsAt: `${date}T23:00:00Z`, teamAbbreviation: team, opponent, home, status: "scheduled" as const }));
// Monday: TOR, NYR, BOS, MTL. Tuesday: PHI, SEA, CHI, DAL. Wednesday: TOR, PHI, BOS, DAL.
// Adds take effect Tuesday, so only Tuesday/Wednesday games can change; d1 (BOS) still has a Wednesday game to lose.
const SCHEDULE: PlanningGame[] = [...matchups(MON, [["TOR", "NYR"], ["BOS", "MTL"]]), ...matchups(TUE, [["PHI", "SEA"], ["CHI", "DAL"]]),
  ...matchups(WED, [["TOR", "PHI"], ["BOS", "DAL"]])];

const sk = (goals: number, assists: number, shots: number): StatLine => ({ GOALS: goals, ASSISTS: assists, SHOTS: shots });
/** Independent oracle: league points for one stat line. */
const fp = (stats: StatLine) => Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + (stats[key] ?? 0) * weight, 0);
const LINES: Record<string, StatLine> = {
  c1: sk(0.4, 0.5, 3), lw1: sk(0.3, 0.3, 2.2), d1: sk(0.1, 0.4, 2), b1: sk(0.2, 0.2, 1.5),
  faGood: sk(0.35, 0.4, 2.6), faStar: sk(1.2, 1.2, 6), faWeak: sk(0.02, 0.03, 0.4),
};
/** Full roster: C, LW and D active plus one bench player (all four slots filled). faMissing has no forecast row. */
const roster = () => [skater("c1", "TOR", ["C"]), skater("lw1", "NYR", ["LW"]), skater("d1", "BOS", ["D"]), skater("b1", "MTL", ["C"])];
const pool = () => [skater("faGood", "PHI", ["LW"], "free_agent"), skater("faStar", "SEA", ["RW"], "free_agent"),
  skater("faWeak", "CHI", ["C", "LW"], "free_agent"), skater("faMissing", "SEA", ["LW"], "free_agent")];
function rules(): LeagueRules {
  return { lineupMode: "daily", rosterSlots: { C: 1, LW: 1, D: 1, BN: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
    waivers: { mode: "priority", remainingBudget: null },
    periods: WEEK.map(date => ({ id: `day-${date}`, start: zonedMidnight(date, TZ), end: nextLocalMidnight(date, TZ), remaining: 1, source: "manager" as const, timeZone: TZ })),
    scoring: { mode: "points", weights: { ...WEIGHTS }, categories: [] },
    goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "none" }, unsupported: [] };
}
function bridgeForecast(data: PlanningSnapshot, playerId: string, gameId: string, stats: StatLine): GameForecast {
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
    startProbability: null, confirmedStart: false, limitations: [INTERIM_LABEL] };
}
function snapshot(id = "acceptance", players = [...roster(), ...pool()]): PlanningSnapshot {
  const data: PlanningSnapshot = {
    id, context: { provider: "manual", seasonId: SEASON, leagueId: "manual", teamId: "manual", startDate: MON, endDate: WED, timeZone: TZ, asOf: AS_OF },
    players, roster: players.filter(row => row.availability === "rostered").map(row => ({ playerId: row.id, position: row.id === "b1" ? "bench" : "active" })),
    games: SCHEDULE, forecasts: [], rules: rules(), lockedAssignments: [], realized: {}, opponent: null,
    evidence: { schedule: { source: "Synthetic complete NHL schedule fixture", asOf: hoursBefore(AS_OF, 2), seasonId: SEASON, completeness: "complete", limitations: [] } },
  };
  data.forecasts = data.games.flatMap(match => data.players.filter(row => row.teamAbbreviation === match.teamAbbreviation && LINES[row.id])
    .map(row => bridgeForecast(data, row.id, match.id, LINES[row.id])));
  return data;
}
const intent = (overrides: Partial<PlanIntent> = {}): PlanIntent => ({ ...defaultIntent(), revision: 1, goalieWindow: "any", alternativeCount: 10, ...overrides });
const plansFor = (result: ReturnType<typeof candidatePlanMetrics>, playerId: string) => result.candidates.find(row => row.playerId === playerId)?.plans ?? [];
const best = (plans: CandidatePlan[]) => [...plans].sort((a, b) => (b.netPoints ?? -Infinity) - (a.netPoints ?? -Infinity))[0];

/** The legal-plan difference the comparison must display: same objective, same no-move baseline, candidate steps applied. */
function planDifference(data: PlanningSnapshot, plan: CandidatePlan, base = intent()) {
  const withMove = evaluatePlan(data, base, plan.objective, plan.steps), without = evaluatePlan(data, { ...base, steps: [] }, plan.objective, []);
  expect(withMove.legal).toBe(true);
  return withMove.projectedValue! - without.projectedValue!;
}
const dropping = (plans: CandidatePlan[], playerId: string) => plans.find(plan => plan.steps.some(step => step.dropPlayerId === playerId));

describe("RSO daily beta: end-to-end acceptance on the interim bridge", () => {
  it("(1) a complete roster and an eligible pickup pool are compared against one legal no-move baseline", () => {
    const data = snapshot();
    const baseline = evaluatePlan(data, intent(), "outcome", []);
    expect(baseline.legal).toBe(true);
    // Every roster place is used: 3 active + 1 bench.
    expect(data.roster).toHaveLength(Object.values(data.rules.rosterSlots).reduce((sum, count) => sum + count, 0));
    // Monday C/LW/D and Wednesday C start; b1 (bench C) never displaces c1.
    expect(baseline.projectedValue).toBeCloseTo(fp(LINES.c1) * 2 + fp(LINES.lw1) + fp(LINES.d1) + fp(LINES.d1), 10);
    const result = candidatePlanMetrics(data, intent());
    expect(result.candidates.map(row => row.playerId).sort()).toEqual(["faGood", "faMissing", "faStar", "faWeak"]);
    expect(result.candidates.every(row => row.complete)).toBe(true);
    for (const id of ["c1", "lw1", "d1", "b1"]) expect(result.diagnostics.find(row => row.playerId === id)?.status).toBe("filtered");
  });

  // Only the best-ranked plans per pickup are shown, so the lost-contribution and negative cases protect the two
  // free drops (b1 on the bench, lw1 with no game left) and leave drops that still have a Wednesday game.
  const costlyDrops = () => intent({ protectedPlayerIds: ["b1", "lw1"] });
  it("(2) an improving legal drop/add displays exactly the legal-plan difference, including the dropped player's lost games", () => {
    const data = snapshot();
    // Free drop: faGood fills the idle LW slot on Tuesday and Wednesday; the bench player costs nothing.
    const free = best(plansFor(candidatePlanMetrics(data, intent()), "faGood"));
    expect(free.steps[0].dropPlayerId).toBe("b1");
    expect(free.netPoints).toBeCloseTo(2 * fp(LINES.faGood), 10);
    expect(free.dropped).toEqual([{ playerId: "b1", lostAGP: 0, lostPoints: 0 }]);
    expect(free.netPoints).toBeCloseTo(planDifference(data, free), 10);
    // Costly drop: the best remaining plan gives up d1's Wednesday game, and the displayed net subtracts it.
    const costly = best(plansFor(candidatePlanMetrics(data, costlyDrops()), "faGood"));
    expect(costly.steps[0].dropPlayerId).toBe("d1");
    expect(costly.dropped[0]).toMatchObject({ playerId: "d1", lostAGP: 1 });
    expect(costly.dropped[0].lostPoints).toBeCloseTo(fp(LINES.d1), 10);
    expect(costly.netPoints).toBeCloseTo(2 * fp(LINES.faGood) - fp(LINES.d1), 10);
    expect(costly.netPoints!).toBeGreaterThan(0);
    expect(costly.netPoints).toBeCloseTo(planDifference(data, costly, costlyDrops()), 10);
  });

  it("(3) an attractive but unstartable pickup gains nothing, however strong its forecast", () => {
    const data = snapshot();
    expect(fp(LINES.faStar)).toBeGreaterThan(2 * fp(LINES.faGood));
    const plans = plansFor(candidatePlanMetrics(data, intent()), "faStar");
    expect(plans.length).toBeGreaterThan(0);
    // RW has no slot in this league, so faStar never starts: no plan shows a gain.
    for (const plan of plans) { expect(plan.netAGP).toBe(0); expect(plan.netPoints).toBeLessThanOrEqual(0); expect(plan.netPoints).toBeCloseTo(planDifference(data, plan), 10); }
  });

  it("(4) a negative option is reported as a loss, not hidden as zero", () => {
    const data = snapshot();
    const loss = best(plansFor(candidatePlanMetrics(data, costlyDrops()), "faWeak"));
    expect(loss).toBeDefined();
    // faWeak's one Tuesday game is worth less than the Wednesday game the cheapest remaining drop gives up.
    expect(loss.steps[0].dropPlayerId).toBe("d1");
    expect(loss.netPoints).toBeCloseTo(fp(LINES.faWeak) - fp(LINES.d1), 10);
    expect(loss.netPoints!).toBeLessThan(0);
    expect(loss.netPoints).toBeCloseTo(planDifference(data, loss, costlyDrops()), 10);
  });

  it("(5) a protected player is never offered as a drop", () => {
    const data = snapshot();
    const result = candidatePlanMetrics(data, intent({ protectedPlayerIds: ["b1", "d1"] }));
    const steps = result.candidates.flatMap(row => row.plans.flatMap(plan => plan.steps));
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.some(step => step.dropPlayerId === "b1" || step.dropPlayerId === "d1")).toBe(false);
  });

  it("(6) missing forecast data stays unknown, never zero", () => {
    const data = snapshot();
    const plans = plansFor(candidatePlanMetrics(data, intent()), "faMissing");
    expect(plans.length).toBeGreaterThan(0);
    // Its schedule value is known (a Tuesday start); its points are not.
    expect(plans.some(plan => plan.netAGP === 1)).toBe(true);
    for (const plan of plans) { expect(plan.netPoints).toBeNull(); expect(plan.dropped.every(row => row.lostPoints === null)).toBe(true); }
  });

  describe("(7) refresh, Undo, save/reopen and account isolation", () => {
    const memory = () => {
      const values = new Map<string, string>();
      return { values, storage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); },
        removeItem: (key: string) => { values.delete(key); }, key: (index: number) => [...values.keys()][index] ?? null, get length() { return values.size; } } };
    };
    const selected = () => {
      const data = snapshot();
      const move = dropping(plansFor(candidatePlanMetrics(data, intent()), "faGood"), "b1")!;
      return { data, move, chosen: intent({ revision: 2, steps: move.steps }) };
    };
    it("saves the selected move for this account with an Undo entry and reopens it exactly; other accounts and the signed-out slot see nothing", () => {
      const { storage } = memory();
      const { data, chosen } = selected();
      const base: PlanningWorkspace = { ...defaultWorkspace(new Date(AS_OF)), context: data.context, rules: data.rules, roster: data.roster, manualPlayers: data.players, intent: intent() };
      const after: PlanningWorkspace = { ...base, intent: chosen };
      expect(writeWorkspace(storage, after, [base], "owner-a")).toBeNull();
      expect(readWorkspace(storage, undefined, "owner-a")).toEqual(after);
      expect(readWorkspaceHistory(storage, after, "owner-a")).toEqual([base]);
      expect(readWorkspace(storage, undefined, "owner-b")).toBeNull();
      expect(readWorkspace(storage)).toBeNull();
      expect(workspaceStorageKey("owner-a")).not.toBe(workspaceStorageKey("owner-b"));
    });
    it("a refresh that invalidates the pickup proposes a repair but keeps the selected move; Undo returns the pre-selection plan", () => {
      const { data, chosen } = selected();
      const refreshed = snapshot("acceptance-refresh", [...roster(), ...pool().map(row => row.id === "faGood" ? { ...row, availability: "rostered" as const } : row)]);
      refreshed.roster = data.roster;
      const proposal = reconcileIntent(refreshed, chosen, data);
      expect(proposal.issues.length).toBeGreaterThan(0);
      expect(proposal.issues.some(issue => issue.stepId === chosen.steps[0].id)).toBe(true);
      expect(chosen.steps).toHaveLength(1);
      const unchanged = reconcileIntent(snapshot("acceptance-same"), chosen, data);
      expect(unchanged.issues).toEqual([]);
      const { storage } = memory();
      const base: PlanningWorkspace = { ...defaultWorkspace(new Date(AS_OF)), context: data.context, intent: intent() };
      writeWorkspace(storage, { ...base, intent: chosen }, [base], "owner-a");
      expect(readWorkspaceHistory(storage, { ...base, intent: chosen }, "owner-a").at(-1)?.intent.steps).toEqual([]);
    });
  });
});
