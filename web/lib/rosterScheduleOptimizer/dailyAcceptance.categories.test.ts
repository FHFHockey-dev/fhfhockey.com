// @vitest-environment node
// RSO daily beta: offline category-league acceptance packet for FR9/FR10 (Astra traceability), lane RSO-MANUAL.
// Drives the real planner (evaluatePlan, planRoster, candidatePlanMetrics, reconcileIntent) through a daily
// head-to-head CATEGORY league and checks outcomes against an independent oracle: banked plus future totals, pooled
// ratio categories, per-category matchup results, unknowns without probability claims, no scalar category blend, and
// the goalie-minimum contract. Every input is a synthetic fixture labelled as an interim bridge value.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as rsoPolicy from "../player-forecasts/rsoUsePolicy";
import { fixtureRsoBindings, fixtureRsoPolicy } from "../player-forecasts/rsoUsePolicy.fixtures";
import { candidatePlanMetrics } from "./candidatePlanMetrics";
import { evaluatePlan, planRoster } from "./planning";
import { nextLocalMidnight, zonedMidnight } from "./planningDates";
import { reconcileIntent } from "./reconciliation";
import { defaultIntent } from "./workspace";
import type { GameForecast, LeagueRules, PlanEvaluation, PlanIntent, PlanningGame, PlanningPlayer, PlanningSnapshot, ScoringCategory, StatLine } from "./planningTypes";

// --- League: 12-team Yahoo-style daily H2H categories, matchup week Mon 2026-10-19 → Sun 10-25, checked Thursday ---
const SEASON = 20262027;
const TZ = "America/Toronto";
const THU = "2026-10-22", FRI = "2026-10-23", SAT = "2026-10-24", SUN = "2026-10-25";
const HORIZON = [THU, FRI, SAT, SUN];
const AS_OF = "2026-10-22T14:00:00Z"; // Thursday 10:00 Toronto
const INTERIM_MODEL = "interim-forge-bridge-fixture-v1";
const INTERIM_LABEL = "Interim FORGE bridge fixture value (synthetic); not a calibrated FORGE forecast.";
const CATEGORIES: ScoringCategory[] = [
  { key: "GOALS", direction: "higher" }, { key: "ASSISTS", direction: "higher" }, { key: "SHOTS_ON_GOAL", direction: "higher" },
  { key: "SHOOTING_PERCENTAGE", direction: "higher", numerator: "GOALS", denominator: "SHOTS_ON_GOAL" },
  { key: "WINS_GOALIE", direction: "higher" },
  { key: "SAVE_PERCENTAGE", direction: "higher", numerator: "SAVES_GOALIE", denominator: "SHOTS_AGAINST_GOALIE" },
  { key: "GOALS_AGAINST_AVERAGE", direction: "lower", numerator: "GOALS_AGAINST_GOALIE", denominator: "GOALIE_MINUTES", multiplier: 60 },
];
const TARGETS = ["GOALS", "ASSISTS", "SHOTS_ON_GOAL", "WINS_GOALIE", "SAVES_GOALIE", "SHOTS_AGAINST_GOALIE", "GOALS_AGAINST_GOALIE", "GOALIE_MINUTES"];

beforeEach(() => vi.spyOn(rsoPolicy, "currentRsoUsePolicy").mockReturnValue(fixtureRsoPolicy([INTERIM_MODEL], TARGETS)));
afterEach(() => vi.restoreAllMocks());

const fixtureId = (value: string) => [...value].reduce((id, char) => (id * 31 + char.charCodeAt(0)) % 100000000, 1) + 1;
const player = (id: string, team: string, positions: string[], availability: PlanningPlayer["availability"] = "rostered"): PlanningPlayer => ({
  id, nhlId: fixtureId(id), nhlTeamId: fixtureId(team), rosterRevision: `roster-${id}-${team}`, name: id, teamAbbreviation: team,
  eligiblePositions: positions, eligibilityVerified: true, playerClass: positions.includes("G") ? "goalie" : "skater", availability,
  ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] });
const game = (team: string, date: string): PlanningGame => ({ id: `${team}-${date}`, scheduleRevision: `schedule-${team}-${date}`, date,
  startsAt: `${date}T23:00:00Z`, teamAbbreviation: team, opponent: "OPP", home: true, status: "scheduled" });
// TOR plays Thu/Sat, BOS Fri/Sun, PHI Fri/Sun.
const SCHEDULE = [game("TOR", THU), game("BOS", FRI), game("PHI", FRI), game("TOR", SAT), game("BOS", SUN), game("PHI", SUN)];

// Per-game interim lines (binary-exact values so the oracle's sums are exact).
const sk = (goals: number, assists: number, shots: number): StatLine => ({ GOALS: goals, ASSISTS: assists, SHOTS_ON_GOAL: shots });
const gl = (wins: number, saves: number, shotsAgainst: number, goalsAgainst: number, minutes = 60): StatLine =>
  ({ WINS_GOALIE: wins, SAVES_GOALIE: saves, SHOTS_AGAINST_GOALIE: shotsAgainst, GOALS_AGAINST_GOALIE: goalsAgainst, GOALIE_MINUTES: minutes });
const LINES: Record<string, StatLine> = { s1: sk(0.5, 0.5, 3), s2: sk(0.25, 0.25, 2), gA: gl(0.5, 27, 29, 2), gB: gl(0.25, 22, 25, 3), faG: sk(0.125, 0.5, 4) };
// Banked Mon–Wed (Yahoo realized team stats).
const REALIZED: StatLine = { GOALS: 4, ASSISTS: 6, SHOTS_ON_GOAL: 30, WINS_GOALIE: 1, SAVES_GOALIE: 50, SHOTS_AGAINST_GOALIE: 55, GOALS_AGAINST_GOALIE: 5, GOALIE_MINUTES: 120 };
const OPPONENT_REALIZED: StatLine = { GOALS: 3, ASSISTS: 5, SHOTS_ON_GOAL: 33, WINS_GOALIE: 2, SAVES_GOALIE: 70, SHOTS_AGAINST_GOALIE: 76, GOALS_AGAINST_GOALIE: 6, GOALIE_MINUTES: 180 };
const OPPONENT_REMAINING: StatLine = { GOALS: 2.5, ASSISTS: 3, SHOTS_ON_GOAL: 12, WINS_GOALIE: 1, SAVES_GOALIE: 40, SHOTS_AGAINST_GOALIE: 44, GOALS_AGAINST_GOALIE: 4, GOALIE_MINUTES: 120 };
const START: Record<string, number> = { [`gA-TOR-${THU}`]: 1, [`gB-BOS-${FRI}`]: 0.75, [`gA-TOR-${SAT}`]: 0.5, [`gB-BOS-${SUN}`]: 0.5 };

function rules(overrides: Partial<LeagueRules> = {}): LeagueRules {
  return { lineupMode: "daily", rosterSlots: { C: 1, LW: 1, G: 2, BN: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
    waivers: { mode: "priority", remainingBudget: null },
    periods: HORIZON.map(date => ({ id: `day-${date}`, start: zonedMidnight(date, TZ), end: nextLocalMidnight(date, TZ), remaining: 1, source: "manager" as const, timeZone: TZ })),
    scoring: { mode: "categories", weights: {}, categories: CATEGORIES },
    goalieMinimum: { required: 3, credited: 1, counts: "starts", penalty: "lose_goalie_categories", periodStart: "2026-10-19", periodEnd: "2026-10-26" },
    unsupported: [], ...overrides };
}
function forecast(data: PlanningSnapshot, playerId: string, gameId: string, stats: StatLine): GameForecast {
  const member = data.players.find(row => row.id === playerId)!, match = data.games.find(row => row.id === gameId)!;
  const issuedAt = new Date(Date.parse(AS_OF) - 2 * 3600000).toISOString(), key = `${playerId}-${gameId}`;
  return { playerId, gameId, stats, conditioning: "unconditional", sourceKind: "detailed", sourceWatermark: "interim-forge-bridge-fixture",
    cutoffAt: issuedAt, issuedAt, expiresAt: match.startsAt!, modelVersion: INTERIM_MODEL, revisionId: `interim-bridge:${key}`,
    rsoTargetBindings: fixtureRsoBindings(INTERIM_MODEL, issuedAt, Object.keys(stats)),
    issuedContext: { version: "forge-issued-context-v1", playerId, gameId, nhlPlayerId: member.nhlId!, teamId: member.nhlTeamId!, seasonId: SEASON,
      scheduledAt: match.startsAt!, scheduleRevision: match.scheduleRevision!, rosterRevision: member.rosterRevision!, observedAt: issuedAt,
      scheduleSourceUpdatedAt: issuedAt, scheduleFetchedAt: issuedAt, identityUpdatedAt: issuedAt, membershipCreatedAt: ["2026-09-01T00:00:00Z"] },
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
    startProbability: member.playerClass === "goalie" ? START[key] ?? null : null, confirmedStart: key === `gA-TOR-${THU}`, limitations: [INTERIM_LABEL] };
}
function league(extra: PlanningPlayer[] = [], ruleOverrides: Partial<LeagueRules> = {}): PlanningSnapshot {
  const players = [player("s1", "TOR", ["C"]), player("s2", "BOS", ["LW"]), player("gA", "TOR", ["G"]), player("gB", "BOS", ["G"]), ...extra];
  const data: PlanningSnapshot = { id: "categories-week", context: { provider: "manual", seasonId: SEASON, leagueId: "manual", teamId: "manual",
    startDate: THU, endDate: SUN, timeZone: TZ, asOf: AS_OF }, players,
    roster: players.filter(row => row.availability === "rostered").map(row => ({ playerId: row.id, position: "active" as const })),
    games: SCHEDULE, forecasts: [], rules: rules(ruleOverrides), lockedAssignments: [], realized: { ...REALIZED },
    opponent: { roster: [], realized: { ...OPPONENT_REALIZED }, remaining: { ...OPPONENT_REMAINING } },
    evidence: { schedule: { source: "Synthetic complete schedule", asOf: AS_OF, seasonId: SEASON, completeness: "complete", limitations: [] } } };
  data.forecasts = SCHEDULE.flatMap(match => players.filter(row => row.teamAbbreviation === match.teamAbbreviation && LINES[row.id])
    .map(row => forecast(data, row.id, match.id, LINES[row.id])));
  return data;
}

// --- Independent oracle: pooled components, then each category's value; never an average of rates ---
function pooled(data: PlanningSnapshot, plan: PlanEvaluation): StatLine {
  const totals: StatLine = { ...data.realized };
  for (const row of plan.assignments) {
    const line = data.forecasts.find(item => item.playerId === row.playerId && item.gameId === row.gameId)!.stats;
    for (const [key, value] of Object.entries(line)) totals[key] = (totals[key] ?? 0)! + value!;
  }
  return totals;
}
function oracleValue(stats: StatLine, category: ScoringCategory): number | null {
  const numerator = stats[category.numerator ?? category.key];
  if (typeof numerator !== "number") return null;
  if (!category.denominator) return numerator;
  const denominator = stats[category.denominator];
  return typeof denominator === "number" && denominator > 0 ? numerator / denominator * (category.multiplier ?? 1) : null;
}
function oracleResult(own: number | null, other: number | null, direction: "higher" | "lower") {
  if (own === null || other === null) return "unknown";
  if (own === other) return "tie";
  return (own > other) === (direction === "higher") ? "win" : "loss";
}
const opponentTotals = (data: PlanningSnapshot) => Object.fromEntries(Object.entries(data.opponent!.realized)
  .map(([key, value]) => [key, value! + (data.opponent!.remaining![key] ?? NaN)]));
const row = (plan: PlanEvaluation, key: string) => plan.categoryResults.find(item => item.key === key)!;
const intent = (overrides: Partial<PlanIntent> = {}): PlanIntent => ({ ...defaultIntent(), revision: 1, goalieWindow: "any", ...overrides });

describe("RSO daily beta: category league acceptance (FR9, FR10)", () => {
  describe("FR9 category and matchup decisions", () => {
    it("adds banked and future totals and pools ratio components, never averaging rates", () => {
      const data = league(), plan = evaluatePlan(data, intent(), "agp", []);
      expect(plan.legal).toBe(true);
      expect(plan.assignments.map(item => `${item.playerId}:${item.date}`).sort()).toEqual(
        [`gA:${SAT}`, `gA:${THU}`, `gB:${FRI}`, `gB:${SUN}`, `s1:${SAT}`, `s1:${THU}`, `s2:${FRI}`, `s2:${SUN}`].sort());
      const totals = pooled(data, plan);
      for (const category of CATEGORIES) expect(row(plan, category.key).own, category.key).toBeCloseTo(oracleValue(totals, category)!, 12);
      // Banked counts are included: goals = 4 banked + 2 × 0.5 + 2 × 0.25.
      expect(row(plan, "GOALS").own).toBe(5.5);
      // Pooled SV% = (50 + 2×27 + 2×22) / (55 + 2×29 + 2×25); the mean of the six per-game rates differs.
      const pooledSv = (50 + 54 + 44) / (55 + 58 + 50);
      const meanOfRates = (50 / 55 + 2 * (27 / 29) + 2 * (22 / 25)) / 5;
      expect(row(plan, "SAVE_PERCENTAGE").own).toBeCloseTo(pooledSv, 12);
      expect(Math.abs(pooledSv - meanOfRates)).toBeGreaterThan(1e-4);
      expect(row(plan, "GOALS_AGAINST_AVERAGE").own).toBeCloseTo((5 + 4 + 6) / (120 + 240) * 60, 12);
      expect(row(plan, "SHOOTING_PERCENTAGE").own).toBeCloseTo(5.5 / (30 + 6 + 4), 12);
      expect(plan.projectedStats).toMatchObject({ GOALS: 5.5, SAVES_GOALIE: 148, SHOTS_AGAINST_GOALIE: 163 });
    });

    it("gives win, loss or tie per category against a known opponent", () => {
      const data = league(), plan = evaluatePlan(data, intent(), "agp", []);
      const totals = pooled(data, plan), opponent = opponentTotals(data);
      for (const category of CATEGORIES) {
        const own = oracleValue(totals, category), other = oracleValue(opponent, category);
        expect(row(plan, category.key), category.key).toMatchObject({ opponent: expect.closeTo(other!, 12), result: oracleResult(own, other, category.direction) });
      }
      expect(row(plan, "GOALS").result).toBe("tie"); // 5.5 vs 3 + 2.5
      expect(new Set(plan.categoryResults.map(item => item.result))).toEqual(new Set(["win", "loss", "tie"]));
    });

    it("keeps every result unknown, with no probability claim, when the opponent is missing", () => {
      for (const opponent of [null, { roster: [], realized: { ...OPPONENT_REALIZED }, remaining: null }]) {
        const data = { ...league(), opponent }, plan = evaluatePlan(data, intent(), "outcome", []);
        expect(plan.categoryResults.every(item => item.result === "unknown" && item.opponent === null)).toBe(true);
        expect(plan.categoryResults.every(item => item.own !== null)).toBe(true);
        expect(plan.projectedValue).toBeNull();
        expect(plan.limitations).toEqual(expect.arrayContaining(["Opponent projection is unavailable; matchup strategy is unverified.",
          "Category outcomes use provisional means; calibrated joint probabilities are unavailable."]));
        expect(JSON.stringify(plan.categoryResults)).not.toMatch(/probab/i);
      }
    });

    it("keeps a ratio unknown when its denominator is missing or zero, leaving other categories known", () => {
      const ownMissing = league();
      ownMissing.forecasts = ownMissing.forecasts.map(item => item.playerId === "gB" && item.gameId === `BOS-${FRI}`
        ? { ...item, stats: Object.fromEntries(Object.entries(item.stats).filter(([key]) => key !== "SHOTS_AGAINST_GOALIE")) } : item);
      const own = evaluatePlan(ownMissing, intent(), "agp", []);
      expect(row(own, "SAVE_PERCENTAGE")).toMatchObject({ own: null, result: "unknown" });
      expect(row(own, "GOALS").result).toBe("tie");
      const opponentRealizedMissing = league();
      delete opponentRealizedMissing.opponent!.realized.SHOTS_AGAINST_GOALIE;
      const other = evaluatePlan(opponentRealizedMissing, intent(), "agp", []);
      expect(row(other, "SAVE_PERCENTAGE")).toMatchObject({ opponent: null, result: "unknown" });
      expect(row(other, "SAVE_PERCENTAGE").own).not.toBeNull();
      expect(row(other, "GOALS_AGAINST_AVERAGE").result).not.toBe("unknown");
      const zero = league();
      zero.opponent = { roster: [], realized: { ...OPPONENT_REALIZED, GOALIE_MINUTES: 0 }, remaining: { ...OPPONENT_REMAINING, GOALIE_MINUTES: 0 } };
      expect(row(evaluatePlan(zero, intent(), "agp", []), "GOALS_AGAINST_AVERAGE")).toMatchObject({ opponent: null, result: "unknown" });
      for (const plan of [own, other]) expect(plan.projectedValue).toBeNull();
    });

    // DEFECT FR9-D1 (slices/FR9-FR10/RECEIPT.md): opponentStats (planning.ts:78) only adds keys present in
    // opponent.remaining, so a missing remaining component keeps the banked value as the full total (remaining
    // treated as zero). Here opponent SV% becomes 110 / 76 = 1.447. Remove `.fails` once fixed.
    it.fails("keeps the opponent's ratio unknown when its remaining denominator is missing", () => {
      const data = league();
      delete data.opponent!.remaining!.SHOTS_AGAINST_GOALIE;
      const plan = evaluatePlan(data, intent(), "agp", []);
      expect(row(plan, "SAVE_PERCENTAGE")).toMatchObject({ opponent: null, result: "unknown" });
    });

    it("never blends categories into one score: tradeoffs stay per-category and no points value is claimed", () => {
      const data = league([player("faG", "PHI", ["C"], "free_agent")]);
      const plan = evaluatePlan(data, intent(), "agp", [{ id: "add", type: "add", playerId: "faG", at: AS_OF, effectiveAt: AS_OF, conditional: false, dependsOn: [] }]);
      const base = evaluatePlan(data, intent(), "agp", []);
      // faG adds two starts: more goals, assists and shots, but a lower pooled shooting percentage.
      expect(plan.activeGames - base.activeGames).toBe(2);
      expect(row(plan, "SHOTS_ON_GOAL").own!).toBeGreaterThan(row(base, "SHOTS_ON_GOAL").own!);
      expect(row(plan, "SHOOTING_PERCENTAGE").own!).toBeLessThan(row(base, "SHOOTING_PERCENTAGE").own!);
      for (const evaluation of [base, plan]) {
        expect(evaluation.recommendation?.eligible).toBe(false);
        expect(evaluation.limitations).toContain("Category assignments use schedule capacity and supported componentwise changes. Incomparable tradeoffs have no approved overall utility; start/sit and acquisition recommendations need manager choice.");
      }
      const metrics = candidatePlanMetrics(data, intent());
      const candidate = metrics.candidates.find(item => item.playerId === "faG")!.plans.find(item => item.steps.length === 1)!;
      expect(candidate).toMatchObject({ netAGP: 2, netPoints: null, categoryComparisonVerified: true });
      const breakdown = new Map(candidate.categoryBreakdown!.map(item => [item.key, item]));
      expect(breakdown.get("SHOOTING_PERCENTAGE")).toMatchObject({ ratio: true, coverage: "known",
        components: { numerator: { key: "GOALS", net: 0.25 }, denominator: { key: "SHOTS_ON_GOAL", net: 8 } } });
      expect(breakdown.get("SHOOTING_PERCENTAGE")!.after).toBeCloseTo(row(plan, "SHOOTING_PERCENTAGE").own!, 12);
      expect(breakdown.get("GOALS")).toMatchObject({ ratio: false, delta: 0.25 });
      // The tradeoff is kept as a choice, not resolved by a blended score.
      const result = planRoster(data, intent(), { maxSteps: 1, maxCandidates: 2, maxEvaluations: 60 });
      expect(result.alternatives.some(item => item.steps.some(step => step.playerId === "faG"))).toBe(true);
      expect(result.search.limitations).toContain("Category alternatives use projected means without calibrated joint scenarios and are not globally ranked. Presentation order is deterministic; incomparable supported tradeoffs remain available within search bounds.");
    });
  });

  // DEFECT FR9-D2 (slices/FR9-FR10/RECEIPT.md): in category mode PlanEvaluation.projectedValue is the sum of
  // win = +1 / loss = −1 over category results (planning.ts, category branch of projectedValue), a fixed equal-weight
  // scalar shown as "projected" in the Matchup panel. It does not rank plans (that stays a partial order), but FR9
  // allows no scalar category blend. Remove `.fails` once category mode reports no scalar score.
  it.fails("reports no scalar category score once every category result is known", () => {
    const plan = evaluatePlan(league(), intent(), "agp", []);
    expect(plan.categoryResults.every(item => item.result !== "unknown")).toBe(true);
    expect(plan.comparisonEligible).toBe(true);
    expect(plan.projectedValue).toBeNull();
  });

  describe("FR10 goalie minimum", () => {
    it("keeps credited, confirmed and projected starts separate", () => {
      const plan = evaluatePlan(league(), intent({ goalieCoverage: "cover" }), "agp", []);
      const expected = 1 + 0.75 + 0.5 + 0.5; // THU confirmed (1) + FRI + SAT + SUN probabilities
      expect(plan.goalie).toMatchObject({ required: 3, credited: 1, confirmed: 1, minimumSatisfied: false, risk: false });
      expect(plan.goalie.expectedStarts).toBeCloseTo(expected, 12);
      expect(plan.goalie.projected).toBeCloseTo(1 + expected, 12);
    });

    it("cover keeps the goalie start the minimum needs; accept risk may sit it and then nulls the matchup projection", () => {
      // Two starts credited; one more is needed and only Thursday's confirmed start is scheduled. That start hurts both ratios.
      const data = league([], { goalieMinimum: { required: 3, credited: 2, counts: "starts", penalty: "lose_goalie_categories", periodStart: "2026-10-19", periodEnd: "2026-10-26" } });
      // gA's start adds no wins and only hurts SV% and GAA; banked SV% (52/55) beats the opponent without it.
      data.games = SCHEDULE.filter(item => [`TOR-${THU}`, `PHI-${FRI}`, `PHI-${SUN}`].includes(item.id));
      data.realized = { ...REALIZED, SAVES_GOALIE: 52 };
      data.forecasts = data.forecasts.filter(item => data.games.some(match => match.id === item.gameId))
        .map(item => item.playerId === "gA" ? { ...item, stats: gl(0, 20, 26, 6) } : item);
      const covered = evaluatePlan(data, intent({ goalieCoverage: "cover" }), "outcome", []);
      expect(covered.assignments.some(item => item.playerId === "gA")).toBe(true);
      expect(row(covered, "SAVE_PERCENTAGE").result).toBe("loss");
      expect(covered.goalie).toMatchObject({ credited: 2, confirmed: 1, projected: 3, risk: false });
      expect(covered.projectedValue).not.toBeNull();
      const accepted = evaluatePlan(data, intent({ goalieCoverage: "accept_risk" }), "outcome", []);
      expect(accepted.assignments.some(item => item.playerId === "gA")).toBe(false);
      expect(accepted.goalie).toMatchObject({ credited: 2, confirmed: 0, projected: 2, risk: true });
      expect(row(accepted, "SAVE_PERCENTAGE")).toMatchObject({ own: 52 / 55, result: "win" });
      // Forfeiture path: an at-risk minimum with "lose goalie categories" leaves no matchup projection.
      expect(accepted.projectedValue).toBeNull();
      expect(accepted.limitations).toContain("Goalie-category forfeiture risk makes the matchup projection incomplete.");
      const noPenalty = evaluatePlan({ ...data, rules: { ...data.rules, goalieMinimum: { ...data.rules.goalieMinimum, penalty: "none" } } },
        intent({ goalieCoverage: "accept_risk" }), "outcome", []);
      expect(noPenalty.goalie.risk).toBe(true);
      expect(noPenalty.projectedValue).not.toBeNull();
    });

    it.each([
      ["counting unit", { counts: "unknown" as const }],
      ["penalty", { penalty: "unknown" as const }],
    ])("keeps an unknown %s incomplete instead of assuming it", (_label, change) => {
      const data = league([], { goalieMinimum: { ...rules().goalieMinimum, ...change } });
      const plan = evaluatePlan(data, intent({ goalieCoverage: "cover" }), "agp", []);
      expect(plan.limitations).toContain("Goalie minimum semantics are incomplete.");
      if ("counts" in change) expect(plan.goalie.projected).toBeNull();
      expect(plan.goalie.credited).toBe(1);
      expect(plan.goalie.minimumSatisfied).toBe(false);
    });

    it("never counts a starter probability as an appearance", () => {
      const data = league([], { goalieMinimum: { ...rules().goalieMinimum, counts: "appearances" } });
      const plan = evaluatePlan(data, intent({ goalieCoverage: "cover" }), "agp", []);
      expect(plan.goalie.projected).toBeNull();
      expect(plan.goalie.risk).toBe(true);
      expect(plan.limitations).toContain("Appearance probabilities are unavailable; starter probabilities cannot verify this goalie minimum.");
      // Start evidence is still reported as starts.
      expect(plan.goalie.expectedStarts).toBeCloseTo(2.75, 12);
      expect(plan.goalie.confirmed).toBe(1);
    });

    it("flags the preferred goalie window and changed starter evidence on refresh", () => {
      const data = league();
      const late = evaluatePlan(data, intent({ goalieCoverage: "cover", goalieWindow: "early", goalieSplit: "mon_wed" }), "agp", []);
      expect(late.limitations).toContain("Preferred goalie coverage window has no verified usable start; coverage is infeasible with current evidence.");
      const refreshed = league();
      refreshed.forecasts = refreshed.forecasts.map(item => item.playerId === "gB" ? { ...item, startProbability: 0.1 } : item);
      expect(reconcileIntent(refreshed, intent(), data).issues).toContainEqual({ stepId: null,
        message: "Goalie minimum progress or starter evidence changed; review coverage and outcome tradeoffs." });
    });
  });
});
