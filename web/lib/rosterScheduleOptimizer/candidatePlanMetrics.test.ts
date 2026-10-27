import { beforeEach, describe, expect, it, vi } from "vitest";
import * as rsoPolicy from "../player-forecasts/rsoUsePolicy";
import { candidatePlanMetrics as candidateMetrics, candidatePlanForSort } from "./candidatePlanMetrics";
import { defaultIntent, defaultWorkspace } from "./workspace";
import { evaluatePlan } from "./planning";
import { buildTimeline } from "./planningTimeline";
import { reconcileIntent } from "./reconciliation";
import type { GameForecast, PlanIntent, PlanStep, PlanningSnapshot } from "./planningTypes";

// Native fixture rows carry an explicit fictional review of their one scored target.
// The production catalog stays empty; the denial case below removes the binding.
const fixtureScope = { component: "fictional-candidates", modelMode: "synthetic", codeVersion: "fixture",
  configurationHash: "a".repeat(64), artifactHash: "b".repeat(64), targetKey: "GOALS", horizonGames: 1,
  conditioning: "synthetic-unconditional", participationLineage: "synthetic-only" };
const fixturePolicy: rsoPolicy.RsoUsePolicy = { version: "rso-target-use-v1", revision: "fictional-candidate-reviews",
  revokedReviewIds: [], reviews: [{ id: "fictional-GOALS", binding: fixtureScope, reviewedAt: "2026-09-01T00:00:00Z",
    expiresAt: "2100-01-01T00:00:00Z", inputCutoffFrom: "2026-09-01T00:00:00Z", inputCutoffUntil: "2100-01-01T00:00:00Z",
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
    prospectiveEvidenceRef: "fictional-evidence", ownerApprovalRef: "fictional-approval" }] };
beforeEach(() => vi.spyOn(rsoPolicy, "currentRsoUsePolicy").mockReturnValue(fixturePolicy));

function fixture(): PlanningSnapshot {
  const workspace = defaultWorkspace(new Date("2026-10-04T12:00:00Z"));
  const players = ["a", "b", "c"].map((id, index) => ({ id, nhlId: index + 1, nhlTeamId: index + 1,
    rosterRevision: `roster-${id}`, name: id, teamAbbreviation: id.toUpperCase(), eligiblePositions: ["C"],
    eligibilityVerified: true, playerClass: "skater" as const, availability: id === "c" ? "free_agent" as const : "rostered" as const,
    canDrop: true, ownership: null, holdValue: null, reserveEligibility: [] }));
  const games = players.map(row => { const date = row.id === "c" ? "2026-10-05" : "2026-10-06";
    return { id: row.id, date, startsAt: `${date}T20:00:00Z`, scheduleRevision: `schedule-${row.id}`,
      teamAbbreviation: row.teamAbbreviation, opponent: "X", home: true, status: "scheduled" as const }; });
  const snapshot: PlanningSnapshot = { id: "net-candidate-fixture", context: { ...workspace.context, startDate: "2026-10-05", endDate: "2026-10-06", timeZone: "UTC" },
    players, roster: [{ playerId: "a", position: "active" }, { playerId: "b", position: "bench" }], games, forecasts: [],
    rules: { ...workspace.rules, rosterSlots: { C: 1, BN: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
      periods: [{ id: "week", start: "2026-10-04T00:00:00Z", end: "2026-10-08T00:00:00Z", remaining: 1, source: "manager" }],
      scoring: { mode: "points", weights: { GOALS: 1 }, categories: [] } }, lockedAssignments: [], realized: {}, opponent: null,
    evidence: { schedule: { source: "Local fixture", asOf: workspace.context.asOf, seasonId: workspace.context.seasonId, completeness: "complete", limitations: [] } } };
  snapshot.forecasts = players.map(row => {
    const game = games.find(game => game.id === row.id)!;
    return { playerId: row.id, gameId: game.id, stats: { GOALS: row.id === "a" ? 10 : row.id === "b" ? 1 : 2 },
      conditioning: "unconditional", sourceKind: "detailed", sourceWatermark: "fixture-only", cutoffAt: snapshot.context.asOf,
      issuedAt: snapshot.context.asOf, expiresAt: game.startsAt, revisionId: `revision-${row.id}`, modelVersion: "fixture",
      startProbability: null, confirmedStart: false, allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false }, limitations: [],
      rsoTargetBindings: { GOALS: { ...fixtureScope, cutoffAt: snapshot.context.asOf } },
      issuedContext: { version: "forge-issued-context-v1", playerId: row.id, gameId: game.id, nhlPlayerId: row.nhlId, teamId: row.nhlTeamId,
        seasonId: snapshot.context.seasonId, scheduledAt: game.startsAt, scheduleRevision: game.scheduleRevision, rosterRevision: row.rosterRevision,
        observedAt: snapshot.context.asOf, scheduleSourceUpdatedAt: snapshot.context.asOf, scheduleFetchedAt: snapshot.context.asOf,
        identityUpdatedAt: snapshot.context.asOf, membershipCreatedAt: ["2026-09-01T00:00:00Z"] } } as GameForecast;
  });
  return snapshot;
}

function auditSearchFixture(candidateCount: number): PlanningSnapshot {
  const data = fixture(), template = data.players[0], forecast = data.forecasts[0];
  data.context.endDate = data.context.startDate;
  const game = { ...data.games[0], id: "audit-game", date: data.context.startDate,
    startsAt: `${data.context.startDate}T20:00:00Z`, teamAbbreviation: "A" };
  data.games = [game];
  data.players = Array.from({ length: candidateCount + 3 }, (_, index) => ({ ...template,
    id: String(index < 3 ? index + 1 : index + 97), nhlId: index + 10000,
    name: `Synthetic ${index}`, availability: index < 3 ? "rostered" : "free_agent" }));
  data.roster = data.players.slice(0, 3).map(player => ({ playerId: player.id, position: "active" }));
  data.rules.rosterSlots = { C: 3, BN: 0 };
  data.forecasts = data.players.map((player, index) => ({ ...forecast, playerId: player.id, gameId: game.id,
    stats: { GOALS: [100, 90, 1][index] ?? 10 }, appearanceProbability: 1,
    expiresAt: game.startsAt, revisionId: `audit-${player.id}`, issuedContext: { ...forecast.issuedContext!,
      playerId: player.id, nhlPlayerId: player.nhlId!, gameId: game.id, scheduledAt: game.startsAt } }));
  return data;
}

// Exhaust all injective assignments for these single-day, unconditional points
// fixtures. No production optimizer, eligibility helper or ledger is used.
function exhaustiveDayPoints(data: PlanningSnapshot, ids: string[]): number {
  const slots = Object.entries(data.rules.rosterSlots).filter(([slot]) => !["BN", "IR", "IR+", "NA"].includes(slot))
    .flatMap(([slot, count]) => Array.from({ length: count }, () => slot));
  function assign(index: number, remaining: string[]): number {
    if (index === slots.length) return 0;
    let best = assign(index + 1, remaining);
    for (const id of remaining) {
      const player = data.players.find(row => row.id === id)!;
      if (!player.eligiblePositions.includes(slots[index])) continue;
      const forecast = data.forecasts.find(row => row.playerId === id)!;
      const value = Object.entries(data.rules.scoring.weights).reduce((sum, [key, weight]) => sum + forecast.stats[key]! * weight, 0);
      best = Math.max(best, value + assign(index + 1, remaining.filter(other => other !== id)));
    }
    return best;
  }
  return assign(0, ids);
}

function exhaustiveSingleSwap(data: PlanningSnapshot, candidateId: string, protectedIds: string[] = []) {
  const candidate = data.players.find(player => player.id === candidateId)!;
  const owned = data.roster.map(row => row.playerId);
  const actionAt = Math.max(Date.parse(data.context.asOf), Date.parse(`${data.context.startDate}T00:00:00Z`));
  const period = data.rules.periods.find(row => Date.parse(row.start) <= actionAt && actionAt < Date.parse(row.end));
  if (data.rules.lineupMode !== "daily" || data.rules.acquisitionTiming !== "same_day"
    || candidate.availability !== "free_agent" || !candidate.eligibilityVerified || owned.includes(candidateId)
    || !period || period.remaining == null || data.rules.acquisitionCost == null || period.remaining < data.rules.acquisitionCost
    || data.games.some(game => Date.parse(game.startsAt!) <= actionAt)) return null;
  const baseline = exhaustiveDayPoints(data, owned);
  const options = owned.filter(id => !protectedIds.includes(id) && data.players.find(row => row.id === id)?.canDrop === true
    && !data.lockedAssignments.some(row => row.playerId === id && row.slotId !== null))
    .map(drop => ({ drop, netPoints: exhaustiveDayPoints(data, [...owned.filter(id => id !== drop), candidateId]) - baseline }));
  return options.sort((a, b) => b.netPoints - a.netPoints)[0] ?? null;
}

describe("complete timed candidate metrics", () => {
  it("retains a verified category comparison at zero AGP without a points utility", () => {
    const data = fixture();
    data.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "GOALS", direction: "higher" }] };
    data.opponent = { roster: [], realized: { GOALS: 0 }, remaining: { GOALS: 11 } };
    data.games = data.games.map(game => ({ ...game, date: "2026-10-06", startsAt: "2026-10-06T20:00:00Z" }));
    data.forecasts = data.forecasts.map(row => ({ ...row, stats: { GOALS: row.playerId === "c" ? 12 : row.stats.GOALS },
      expiresAt: "2026-10-06T20:00:00Z", issuedContext: { ...row.issuedContext!, scheduledAt: "2026-10-06T20:00:00Z" } }));
    const result = candidateMetrics(data, defaultIntent());
    expect(result.candidates[0].plans.some(plan => plan.netAGP === 0 && plan.netPoints === null
      && plan.categoryComparisonVerified === true)).toBe(true);
    data.opponent.remaining = null;
    const partial = candidateMetrics(data, defaultIntent());
    expect(partial.candidates[0].plans.length).toBeGreaterThan(0);
    expect(partial.candidates[0].plans.every(plan => plan.categoryComparisonVerified === false)).toBe(true);
  });
  it("finds the exhaustive +9 swap among exactly 40 candidates within the default budget", () => {
    const data = auditSearchFixture(40), owned = data.roster.map(row => row.playerId);
    const baseline = exhaustiveDayPoints(data, owned);
    expect(baseline).toBe(191);
    const result = candidateMetrics(data, defaultIntent());
    expect(result.candidates).toHaveLength(40);
    expect(result.search.eligibleCandidates).toBe(40);
    expect(result.search.evaluated).toBeLessThanOrEqual(160);
    expect(result.search.complete).toBe(false);
    for (const candidate of result.candidates) {
      const expected = exhaustiveSingleSwap(data, candidate.playerId)!.netPoints;
      const actual = candidatePlanForSort(candidate.plans, "points")!;
      expect(expected).toBe(9);
      expect(actual.netPoints).toBe(expected);
      expect(actual.steps[0].dropPlayerId).toBe("3");
      expect(actual.dropped).toEqual([{ playerId: "3", lostAGP: 1, lostPoints: 1 }]);
    }
  });

  it.each(["budget", "protected", "locked"])("agrees with the independent single-swap legality oracle on %s", constraint => {
    const data = auditSearchFixture(1), intent = defaultIntent();
    if (constraint === "budget") data.rules.periods[0].remaining = 0;
    if (constraint === "protected") intent.protectedPlayerIds = ["1", "2", "3"];
    if (constraint === "locked") data.lockedAssignments = ["1", "2", "3"].map((playerId, index) => ({
      date: data.context.startDate, playerId, slotId: `C#${index + 1}`,
    }));
    expect(exhaustiveSingleSwap(data, "100", intent.protectedPlayerIds)).toBeNull();
    expect(candidateMetrics(data, intent).candidates[0].plans).toEqual([]);
  });

  it("selects the stronger 41st candidate by supported horizon value, separately from drop exploration", () => {
    const data = auditSearchFixture(41);
    data.forecasts.find(row => row.playerId === "140")!.stats.GOALS = 1000;
    const result = candidateMetrics(data, defaultIntent());
    expect(result.candidates[0].playerId).toBe("140");
    expect(candidatePlanForSort(result.candidates[0].plans, "points")?.netPoints).toBe(999);
    expect(result.search).toMatchObject({ candidates: 40, eligibleCandidates: 41, complete: false });
    expect(result.diagnostics.filter(row => row.stopReason === "candidate_limit")).toHaveLength(1);
  });

  it("boosts goalie candidates into the bounded set only while a league goalie minimum may be missed", () => {
    const data = auditSearchFixture(44), [template] = data.players, [forecast] = data.forecasts;
    data.players.push({ ...template, id: "g1", nhlId: 20000, name: "Synthetic goalie", eligiblePositions: ["G"], playerClass: "goalie", availability: "free_agent" });
    data.forecasts.push({ ...forecast, playerId: "g1", stats: { GOALS: 0 }, startProbability: 0.8, revisionId: "audit-g1",
      issuedContext: { ...forecast.issuedContext!, playerId: "g1", nhlPlayerId: 20000 } });
    data.rules.rosterSlots = { C: 3, G: 1, BN: 0 };
    data.rules.goalieMinimum = { ...data.rules.goalieMinimum, required: 2, credited: null };
    const boosted = candidateMetrics(data, defaultIntent());
    expect(boosted.goalieBoost).toBe(true);
    expect(boosted.diagnostics.find(row => row.playerId === "g1")?.status).not.toBe("not_selected");
    expect(boosted.candidates.find(row => row.playerId === "g1")?.plans[0]).toMatchObject({ netGoalieStarts: 0.8 });
    data.rules.goalieMinimum.required = 0;
    const none = candidateMetrics(data, defaultIntent());
    expect(none.goalieBoost).toBe(false);
    expect(none.diagnostics.find(row => row.playerId === "g1")?.status).toBe("not_selected");
  });
  it("evaluates a requested player outside the bounded set without bypassing checks or the cap", () => {
    const data = auditSearchFixture(41);
    const bounded = candidateMetrics(data, defaultIntent());
    const outside = bounded.diagnostics.filter(row => row.stopReason === "candidate_limit");
    expect(outside).toMatchObject([{ playerId: "140", status: "not_selected", evaluated: 0 }]);
    const requested = candidateMetrics(data, defaultIntent(), { requestedPlayerIds: ["140", "1"] });
    expect(requested.search).toMatchObject({ candidates: 40, eligibleCandidates: 41, maxCandidates: 40 });
    expect(requested.candidates[0].playerId).toBe("140");
    expect(candidatePlanForSort(requested.candidates[0].plans, "points")).toMatchObject({
      netPoints: exhaustiveSingleSwap(data, "140")!.netPoints, steps: [{ dropPlayerId: "3" }] });
    // An owned player stays filtered; another tied player leaves the bounded set instead.
    expect(requested.diagnostics.find(row => row.playerId === "1")).toMatchObject({ status: "filtered", evaluated: 0 });
    expect(requested.diagnostics.filter(row => row.stopReason === "candidate_limit").map(row => row.playerId)).toEqual(["139"]);
  });

  it("matches independent exhaustive legal assignments with dual positions and a negative-value bench option", () => {
    const data = auditSearchFixture(1);
    data.players[0].eligiblePositions = ["C", "LW"];
    data.players[2].eligiblePositions = ["LW"];
    data.players[3].eligiblePositions = ["LW"];
    data.rules.rosterSlots = { C: 1, LW: 1, BN: 1 };
    data.forecasts[2].stats.GOALS = -5;
    const owned = data.roster.map(row => row.playerId), baseline = exhaustiveDayPoints(data, owned);
    const result = candidateMetrics(data, defaultIntent());
    expect(result.baseline.projectedPoints).toBe(baseline);
    const expected = Math.max(...owned.map(drop => exhaustiveDayPoints(data,
      [...owned.filter(id => id !== drop), "100"]) - baseline));
    expect(candidatePlanForSort(result.candidates[0].plans, "points")?.netPoints).toBe(expected);
  });
  it.each(["unknown team", "missing member", "partial schedule", "unknown participation"])("does not certify a gain with %s on the owned side", problem => {
    const snapshot = fixture();
    if (problem === "unknown team") snapshot.players[0].teamAbbreviation = null;
    if (problem === "missing member") snapshot.players = snapshot.players.filter(player => player.id !== "a");
    if (problem === "partial schedule") snapshot.evidence.schedule!.completeness = "partial";
    if (problem === "unknown participation") {
      const forecast = snapshot.forecasts.find(row => row.playerId === "a")!;
      forecast.conditionalStats = { ...forecast.stats };
      forecast.stats = { GOALS: null };
      forecast.appearanceProbability = null;
      forecast.allowedUses = { assignment: false, totals: false, comparison: false, conditionalTieBreak: true };
    }
    const baseline = evaluatePlan(snapshot, defaultIntent(), "outcome", [], false);
    expect(baseline.comparisonEligible).toBe(false);
    expect(baseline.projectedValue).toBeNull();
    const metrics = candidateMetrics(snapshot, defaultIntent());
    expect(metrics.baseline.projectedPoints).toBeNull();
    if (problem !== "missing member") expect(metrics.candidates.flatMap(row => row.plans).length).toBeGreaterThan(0);
    expect(metrics.candidates.flatMap(row => row.plans).every(plan => plan.netPoints === null)).toBe(true);
    if (problem !== "unknown participation")
      expect(metrics.candidates.flatMap(row => row.plans).every(plan => plan.netAGP === null)).toBe(true);
  });
  it("cannot remove unknown owned coverage by dropping that player", () => {
    const snapshot = fixture(); snapshot.players[0].teamAbbreviation = null;
    const result = evaluatePlan(snapshot, defaultIntent(), "outcome", [{ id: "drop-unknown", type: "add",
      playerId: "c", dropPlayerId: "a", at: snapshot.context.asOf, effectiveAt: snapshot.context.asOf,
      conditional: false, dependsOn: [] }], false);
    expect(result.legal).toBe(true);
    expect(result.comparisonEligible).toBe(false);
    expect(result.projectedValue).toBeNull();
    expect(result.limitations.some(reason => reason.includes("Player a has unknown"))).toBe(true);
  });
  it.each([false, true])("admits the known652of849 pool before the40candidate cap (timing reviewed: %s)", reviewed => {
    const snapshot = fixture(), intent = defaultIntent();
    const template = snapshot.players[2];
    const known = Array.from({ length: 652 }, (_, index) => ({ ...template, id: `known-${String(index).padStart(3, "0")}`,
      nhlId: 10000 + index, name: `Known ${index}` }));
    const unknown = Array.from({ length: 197 }, (_, index) => ({ ...template, id: `0-unknown-${String(index).padStart(3, "0")}`,
      nhlId: 20000 + index, name: `Unknown ${index}`, eligibilityVerified: false, availability: "unknown" as const }));
    snapshot.players = [...snapshot.players.slice(0, 2), ...unknown, ...known]; snapshot.forecasts = [];
    if (!reviewed) { snapshot.rules.acquisitionTiming = "unknown"; snapshot.rules.acquisitionCost = null; snapshot.rules.periods = []; }
    const before = JSON.stringify({ snapshot, intent });
    const result = candidateMetrics(snapshot, intent);
    expect(result.search).toMatchObject({ candidates: 40, eligibleCandidates: 652, maxCandidates: 40, maxEvaluations: 160, complete: false });
    expect(result.candidates.map(row => row.playerId)).toEqual(known.slice(0, 40).map(row => row.id));
    expect(result.diagnostics.filter(row => row.playerId.startsWith("0-unknown-") && row.status === "filtered")).toHaveLength(197);
    expect(result.diagnostics.filter(row => row.playerId.startsWith("known-") && row.status === "not_selected")).toHaveLength(612);
    const selected = result.diagnostics.filter(row => result.candidates.some(candidate => candidate.playerId === row.playerId));
    expect(selected).toHaveLength(40);
    expect(selected.every(row => row.status === (reviewed ? "evaluated" : "no_proposals"))).toBe(true);
    expect(reviewed ? selected.every(row => row.evaluated > 0 && row.retained > 0) : selected.every(row => row.generated === 0 && row.evaluated === 0)).toBe(true);
    expect(result.search.evaluated).toBeLessThanOrEqual(160);
    expect(JSON.stringify({ snapshot, intent })).toBe(before);
  });
  it("automatically proposes legal full-roster swaps from empty intent without forecasts", () => {
    const snapshot = fixture(); snapshot.forecasts = [];
    const intent = defaultIntent();
    const before = JSON.stringify({ snapshot, intent });
    const metrics = candidateMetrics(snapshot, intent);
    const plan = candidatePlanForSort(metrics.candidates[0].plans, "schedule")!;
    expect(intent.steps).toEqual([]);
    expect(plan).toMatchObject({ netAGP: 1, netPoints: null });
    expect(plan.steps).toHaveLength(1);
    expect(["a", "b"]).toContain(plan.steps[0].dropPlayerId);
    expect(evaluatePlan(snapshot, intent, "agp", plan.steps, false)).toMatchObject({ legal: true, budgetVerified: true });
    expect(metrics.diagnostics.find(row => row.playerId === "c")).toMatchObject({ status: "evaluated", stopReason: "exhausted",
      generated: 3, skipped: 1, evaluated: 2, illegal: 0, unverifiedBudget: 0, retained: 2 });
    expect(JSON.stringify({ snapshot, intent })).toBe(before);
  });

  it("compares the original full roster independently of selected transactions", () => {
    const snapshot = fixture();
    const intent = { ...defaultIntent(), protectedPlayerIds: ["a"] };
    const before = JSON.stringify({ snapshot, intent });
    const metrics = candidateMetrics(snapshot, intent);
    expect(candidatePlanForSort(metrics.candidates[0].plans, "points")).toMatchObject({ netAGP: 1, netPoints: 2 });
    const selectedIntent = { ...intent, steps: [{ id: "already-selected", type: "drop" as const, playerId: "b",
      at: snapshot.context.asOf, effectiveAt: snapshot.context.asOf, conditional: false, dependsOn: [] }] };
    const selectedBefore = JSON.stringify(selectedIntent);
    expect(candidateMetrics(snapshot, selectedIntent)).toEqual(metrics);
    expect(JSON.stringify(selectedIntent)).toBe(selectedBefore);
    expect(JSON.stringify({ snapshot, intent })).toBe(before);
  });

  it.each(["unbound", "production catalog"])("withholds native fixture values when the target is %s", denial => {
    const snapshot = fixture(), intent = { ...defaultIntent(), protectedPlayerIds: ["a"] };
    if (denial === "unbound") snapshot.forecasts = snapshot.forecasts.map(({ rsoTargetBindings: _binding, ...row }) => row);
    else vi.mocked(rsoPolicy.currentRsoUsePolicy).mockReturnValue(rsoPolicy.RSO_USE_POLICY);
    const plans = candidateMetrics(snapshot, intent).candidates.flatMap(candidate => candidate.plans);
    // Schedule capacity stays; the +2 points the reviewed fixture earns is withheld, not zeroed.
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ netAGP: 1, netPoints: null });
  });

  it.each(["availability", "eligibility", "excluded", "no game"])("reports filtered input for %s without pretending it was evaluated", problem => {
    const snapshot = fixture(), intent = defaultIntent();
    if (problem === "availability") snapshot.players[2].availability = "unknown";
    if (problem === "eligibility") snapshot.players[2].eligibilityVerified = false;
    if (problem === "excluded") intent.excludedPlayerIds = ["c"];
    if (problem === "no game") snapshot.games = snapshot.games.filter(game => game.teamAbbreviation !== "C");
    const result = candidateMetrics(snapshot, intent);
    const state = result.diagnostics.find(row => row.playerId === "c")!;
    expect(state).toMatchObject({ status: "filtered", generated: 0, evaluated: 0, retained: 0 });
    expect(state.reasons.length).toBeGreaterThan(0);
    expect(result.candidates).toEqual([]);
  });

  it.each(["timing", "waiver clearance", "elapsed games"])("distinguishes no generated proposal for %s", problem => {
    const snapshot = fixture();
    if (problem === "timing") snapshot.rules.acquisitionTiming = "unknown";
    if (problem === "waiver clearance") snapshot.players[2].availability = "waivers";
    if (problem === "elapsed games") snapshot.context.asOf = "2026-10-07T12:00:00Z";
    const result = candidateMetrics(snapshot, defaultIntent());
    expect(result.diagnostics.find(row => row.playerId === "c")).toMatchObject({ status: "no_proposals", stopReason: "exhausted", generated: 0, evaluated: 0 });
    expect(result.candidates[0].plans).toEqual([]);
  });

  it.each(["exceeded", "unverified"])("reports actual %s budget rejection from the evaluator", problem => {
    const snapshot = fixture(); snapshot.rules.periods[0].remaining = problem === "exceeded" ? 0 : null;
    const result = candidateMetrics(snapshot, defaultIntent());
    const state = result.diagnostics.find(row => row.playerId === "c")!;
    expect(state).toMatchObject({ status: "rejected", stopReason: "exhausted", retained: 0 });
    expect(state.evaluated).toBeGreaterThan(0);
    expect(problem === "exceeded" ? state.illegal : state.unverifiedBudget).toBeGreaterThan(0);
    expect(state.reasons.some(reason => /allowance|counting cost/.test(reason))).toBe(true);
  });

  it("distinguishes candidate and evaluation limits from rejection", () => {
    const snapshot = fixture();
    expect(candidateMetrics(snapshot, defaultIntent(), { maxCandidates: 0 }).diagnostics.find(row => row.playerId === "c"))
      .toMatchObject({ status: "not_selected", stopReason: "candidate_limit", generated: 0, evaluated: 0 });
    expect(candidateMetrics(snapshot, defaultIntent(), { maxEvaluations: 2 }).diagnostics.find(row => row.playerId === "c"))
      .toMatchObject({ status: "partial", stopReason: "evaluation_limit", generated: 0, evaluated: 0 });
    expect(candidateMetrics(snapshot, defaultIntent(), { maxProposalsPerCandidate: 1 }).diagnostics.find(row => row.playerId === "c"))
      .toMatchObject({ status: "partial", stopReason: "proposal_limit", generated: 2, skipped: 1 });
  });

  it("retains evaluated options separately from missing metric evidence", () => {
    const snapshot = fixture(); snapshot.evidence.schedule!.completeness = "partial";
    const result = candidateMetrics(snapshot, defaultIntent());
    expect(result.diagnostics.find(row => row.playerId === "c")).toMatchObject({ status: "evaluated", stopReason: "exhausted",
      reasons: ["Planning schedule coverage is incomplete or unknown."] });
    expect(result.candidates[0].plans.length).toBeGreaterThan(0);
    expect(result.candidates[0].plans.every(plan => plan.netAGP === null && plan.netPoints === null)).toBe(true);
  });

  it("does not let skipped full-roster adds consume the twelve evaluated-proposal allowance", () => {
    const snapshot = fixture(); snapshot.forecasts = [];
    snapshot.context.endDate = "2026-10-09";
    snapshot.rules.rosterSlots.BN = 2;
    snapshot.rules.periods[0].end = "2026-10-12T00:00:00Z";
    snapshot.players.push({ ...snapshot.players[0], id: "d", nhlId: 4, name: "d", teamAbbreviation: "D" });
    snapshot.roster.push({ playerId: "d", position: "bench" });
    snapshot.games = snapshot.players.flatMap(player => Array.from({ length: 5 }, (_, index) => {
      const date = `2026-10-0${index + 5}`;
      return { id: `${player.id}:${date}`, date, startsAt: `${date}T20:00:00Z`, teamAbbreviation: player.teamAbbreviation!,
        opponent: "X", home: true, status: "scheduled" as const };
    }));
    snapshot.lockedAssignments = [{ date: "2026-10-09", playerId: "a", slotId: "C#1" },
      { date: "2026-10-09", playerId: "b", slotId: null }];
    const intent = defaultIntent();
    const before = JSON.stringify({ snapshot, intent });
    expect(evaluatePlan(snapshot, intent, "agp", [], false).legal).toBe(true);
    const control = candidateMetrics(snapshot, intent, { maxProposalsPerCandidate: 24 });
    expect(control.candidates[0].plans.some(plan => plan.steps.some(step => step.dropPlayerId === "d"))).toBe(true);
    const bounded = candidateMetrics(snapshot, intent);
    expect(bounded.candidates[0].plans.some(plan => plan.steps.some(step => step.dropPlayerId === "d"))).toBe(true);
    expect(bounded.search.evaluated).toBeLessThanOrEqual(14);
    expect(JSON.stringify({ snapshot, intent })).toBe(before);
  });

  it("includes lost drop contribution and the remaining roster's reshuffling, rather than crediting an extra place", () => {
    const snapshot = fixture();
    const intent = { ...defaultIntent(), protectedPlayerIds: ["b"] };
    const before = JSON.stringify({ snapshot, intent });
    const metrics = candidateMetrics(snapshot, intent);
    expect(new Map(metrics.activePoints).get("c")).toBe(-7);
    const plan = metrics.candidates[0].plans[0];
    expect(plan).toMatchObject({ netAGP: 1, netPoints: -7, dropped: [{ playerId: "a", lostAGP: 1, lostPoints: 10 }] });
    expect(plan.displacedPlayerIds).toContain("a");
    expect(JSON.stringify({ snapshot, intent })).toBe(before);
  });

  it("uses a real vacancy before an equivalent forced drop", () => {
    const snapshot = fixture(); snapshot.rules.rosterSlots.BN = 2;
    const metrics = candidateMetrics(snapshot, defaultIntent());
    const plan = candidatePlanForSort(metrics.candidates[0].plans, "points")!;
    expect(plan).toMatchObject({ netAGP: 1, netPoints: 2, dropped: [] });
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].dropPlayerId).toBeUndefined();
  });

  it("does not credit a candidate duplicating crowded bench dates as a net gain", () => {
    const snapshot = fixture();
    moveGame(snapshot, "c", "2026-10-06");
    const plan = candidatePlanForSort(candidateMetrics(snapshot, { ...defaultIntent(), protectedPlayerIds: ["a"] }).candidates[0].plans, "points")!;
    expect(plan).toMatchObject({ netAGP: 0, netPoints: 0 });
  });

  it("reassigns dual eligibility and includes the dropped player's actual lost starts", () => {
    const snapshot = fixture();
    moveGame(snapshot, "c", "2026-10-06");
    snapshot.players[0].eligiblePositions = ["C", "LW"];
    snapshot.players[2].eligiblePositions = ["LW"];
    snapshot.rules.rosterSlots = { C: 1, LW: 1, BN: 0 };
    snapshot.forecasts.find(row => row.playerId === "c")!.stats.GOALS = 20;
    const plan = candidatePlanForSort(candidateMetrics(snapshot, { ...defaultIntent(), protectedPlayerIds: ["a"] }).candidates[0].plans, "points")!;
    expect(plan).toMatchObject({ netAGP: 0, netPoints: 19, dropped: [{ playerId: "b", lostAGP: 1, lostPoints: 1 }] });
    expect(plan.displacedPlayerIds).toEqual(["a", "b"]);
  });

  it("respects next-day timing instead of claiming today's game", () => {
    const snapshot = fixture(); snapshot.context.asOf = "2026-10-05T12:00:00Z"; snapshot.rules.acquisitionTiming = "next_day";
    expect(candidateMetrics(snapshot, defaultIntent()).candidates[0].plans).toEqual([]);
  });

  it("keeps legal reserve prerequisites ahead of equivalent drops", () => {
    const snapshot = fixture(); snapshot.players[0].reserveEligibility = ["IR"];
    snapshot.rules.rosterSlots.IR = 1;
    const plan = candidatePlanForSort(candidateMetrics(snapshot, { ...defaultIntent(), protectedPlayerIds: ["b"] }).candidates[0].plans, "points")!;
    expect(plan.steps.map(row => row.type)).toEqual(["reserve", "add"]);
    expect(plan.dropped).toEqual([]);
    expect(plan).toMatchObject({ netAGP: 1, netPoints: -7 });
  });

  it.each(["no budget", "unknown allowance", "unknown timing", "protected", "locked", "excluded", "invalid eligibility"])("withholds dependent plans for %s", problem => {
    const snapshot = fixture(); const intent = defaultIntent();
    if (problem === "no budget") snapshot.rules.periods[0].remaining = 0;
    if (problem === "unknown allowance") snapshot.rules.periods[0].remaining = null;
    if (problem === "unknown timing") snapshot.rules.acquisitionTiming = "unknown";
    if (problem === "protected") intent.protectedPlayerIds = ["a", "b"];
    if (problem === "locked") { intent.protectedPlayerIds = ["b"]; snapshot.lockedAssignments = [{ date: "2026-10-06", playerId: "a", slotId: "C#1" }]; }
    if (problem === "excluded") intent.excludedPlayerIds = ["c"];
    if (problem === "invalid eligibility") snapshot.players[2].eligiblePositions = ["UNSUPPORTED"];
    expect(candidateMetrics(snapshot, intent).candidates.every(row => !row.plans.length)).toBe(true);
  });

  it.each(["conditional", "missing", "unsupported", "partial schedule", "categories"])("does not fabricate net points for %s", problem => {
    const snapshot = fixture();
    if (problem === "conditional") snapshot.forecasts.find(row => row.playerId === "c")!.conditioning = "conditional_playing" as GameForecast["conditioning"];
    if (problem === "missing") snapshot.forecasts = snapshot.forecasts.filter(row => row.playerId !== "c");
    if (problem === "unsupported") snapshot.rules.unsupported = ["Unverified league rule"];
    if (problem === "partial schedule") snapshot.evidence.schedule!.completeness = "partial";
    if (problem === "categories") snapshot.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "GOALS", direction: "higher" }] };
    const metrics = candidateMetrics(snapshot, defaultIntent());
    expect(metrics.candidates[0].plans.length).toBeGreaterThan(0);
    expect(metrics.candidates[0].plans.every(row => row.netPoints === null)).toBe(true);
    if (problem === "unsupported" || problem === "partial schedule") expect(metrics.candidates[0].plans.every(row => row.netAGP === null)).toBe(true);
  });

  it("retains AGP-versus-points tradeoffs as separate actual plan pairs", () => {
    const snapshot = fixture(); snapshot.rules.rosterSlots.BN = 2;
    snapshot.forecasts.find(row => row.playerId === "c")!.stats.GOALS = -2;
    const plans = candidateMetrics(snapshot, defaultIntent()).candidates[0].plans;
    expect(candidatePlanForSort(plans, "points")).toMatchObject({ netAGP: 0, netPoints: 0 });
    expect(candidatePlanForSort(plans, "schedule")).toMatchObject({ netAGP: 1, netPoints: -2 });
  });

  it("caps a 1000-candidate catalogue and remains deterministic without a broad sequence search", () => {
    const snapshot = fixture();
    for (let i = 0; i < 999; i++) snapshot.players.push({ ...snapshot.players[2], id: `candidate-${String(i).padStart(4, "0")}`, nhlId: 1000 + i });
    const options = { maxCandidates: 4, maxEvaluations: 18, maxProposalsPerCandidate: 3 };
    const result = candidateMetrics(snapshot, defaultIntent(), options);
    expect(result.search).toMatchObject({ candidates: 4, eligibleCandidates: 1000, complete: false });
    expect(result.search.evaluated).toBeLessThanOrEqual(18);
    const reversed = { ...snapshot, players: [...snapshot.players].reverse(), games: [...snapshot.games].reverse(), forecasts: [...snapshot.forecasts].reverse() };
    expect(candidateMetrics(reversed, defaultIntent(), options)).toEqual(result);
  });
});

function moveGame(snapshot: PlanningSnapshot, id: string, date: string) {
  const game = snapshot.games.find(row => row.id === id)!;
  game.date = date; game.startsAt = `${date}T20:00:00Z`;
  const forecast = snapshot.forecasts.find(row => row.gameId === id)!;
  forecast.expiresAt = game.startsAt; forecast.issuedContext!.scheduledAt = game.startsAt;
}

// Astra audit F2: SOG approved for totals/comparison with assignment and conditional tie-break denied.
// Port of tasks/artifacts/astra-audit-2026-10-26/reproduction.test.ts (control + denied case) as a regression.
describe("approved totals/comparison without assignment permission", () => {
  const uses = (assignment: boolean, totals = true, comparison = true) => {
    vi.spyOn(rsoPolicy, "currentRsoUsePolicy").mockReturnValue({ ...fixturePolicy, reviews: [{ ...fixturePolicy.reviews[0],
      binding: { ...fixtureScope, targetKey: "SHOTS_ON_GOAL" }, allowedUses: { assignment, totals, comparison, conditionalTieBreak: false } }] });
  };
  /** The audit's SOG-only league: a (10) and b (1) compete for the one C slot on Oct 6; c (2) is a free agent on Oct 5. */
  function sogFixture(values: Record<string, number> = { a: 10, b: 1, c: 2 }): PlanningSnapshot {
    const data = fixture();
    data.rules.scoring = { mode: "points", weights: { SHOTS_ON_GOAL: 1 }, categories: [] };
    data.forecasts = data.forecasts.map(row => ({ ...row, stats: { SHOTS_ON_GOAL: values[row.playerId] },
      conditionalStats: { SHOTS_ON_GOAL: values[row.playerId] }, rsoTargetBindings: { SHOTS_ON_GOAL: { ...fixtureScope, targetKey: "SHOTS_ON_GOAL", cutoffAt: data.context.asOf } } }));
    return data;
  }
  const started = (plan: ReturnType<typeof evaluatePlan>) => plan.assignments.map(row => row.playerId).sort();
  const sum = (data: PlanningSnapshot, plan: ReturnType<typeof evaluatePlan>) => plan.assignments
    .reduce((total, row) => total + data.forecasts.find(item => item.playerId === row.playerId && item.gameId === row.gameId)!.stats.SHOTS_ON_GOAL!, 0);

  it("control: assignment granted chooses by quality and compares (audit control)", () => {
    uses(true);
    const data = sogFixture(), plan = evaluatePlan(data, defaultIntent(), "agp", [], false);
    expect(plan).toMatchObject({ legal: true, comparisonEligible: true, projectedValue: 10, selectionMethod: "quality", recommendation: { eligible: true, mode: "quality" } });
    // Quality decides between equally scheduled players: swapping their values swaps the starter.
    expect(started(evaluatePlan(sogFixture({ a: 1, b: 10, c: 2 }), defaultIntent(), "agp", [], false))).toEqual(["b"]);
  });

  it("assignment denied: capacity-chosen legal lineup, approved SOG totals and a comparable plan (audit repro)", () => {
    uses(false);
    const data = sogFixture(), plan = evaluatePlan(data, defaultIntent(), "agp", [], false);
    expect(plan).toMatchObject({ legal: true, activeGames: 1, comparisonEligible: true, selectionMethod: "schedule_capacity",
      recommendation: { eligible: false, mode: "schedule_capacity" } });
    expect(plan.projectedValue).toBe(sum(data, plan));
    expect(plan.assignmentValue).toBeNull();
    expect(plan.limitations).toContain("Lineup chosen by schedule capacity: approved totals and comparisons are computed on it, but no projection chose slots or broke ties.");
    // SOG never chooses the slot: swapping the competing values leaves the same starter.
    const swapped = sogFixture({ a: 1, b: 10, c: 2 });
    expect(started(evaluatePlan(swapped, defaultIntent(), "agp", [], false))).toEqual(started(plan));
    // The outcome objective cannot quality-optimize either; it is the same capacity lineup, never a recommendation.
    const outcome = evaluatePlan(data, defaultIntent(), "outcome", [], false);
    expect(started(outcome)).toEqual(started(plan));
    expect(outcome.recommendation?.eligible).toBe(false);
  });

  it("assignment denied: candidate selection compares approved totals on the legal plan and keeps drop-loss accounting", () => {
    uses(false);
    const data = sogFixture();
    const result = candidateMetrics(data, defaultIntent());
    expect(result.baseline).toMatchObject({ objective: "agp", activeGames: 1 });
    const baseline = evaluatePlan(data, { ...defaultIntent(), steps: [] }, "agp", [], false);
    expect(result.baseline.projectedPoints).toBe(baseline.projectedValue);
    const plans = result.candidates.find(row => row.playerId === "c")!.plans;
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every(plan => plan.objective === "agp")).toBe(true);
    for (const plan of plans) {
      const evaluation = evaluatePlan(data, { ...defaultIntent(), steps: plan.steps }, "agp", plan.steps, false);
      expect(plan.netAGP).toBe(evaluation.activeGames - baseline.activeGames);
      expect(plan.netPoints).toBe(evaluation.projectedValue! - baseline.projectedValue!);
      for (const drop of plan.dropped) expect(drop.lostAGP).not.toBeNull();
    }
  });

  it.each([
    ["totals denied", false, true],
    ["comparison denied", true, false],
  ] as const)("assignment denied and %s: totals stay unknown, never zero, and nothing is comparable", (_label, totals, comparison) => {
    uses(false, totals, comparison);
    const data = sogFixture(), plan = evaluatePlan(data, defaultIntent(), "agp", [], false);
    expect(plan).toMatchObject({ legal: true, activeGames: 1, comparisonEligible: false, projectedValue: null, selectionMethod: "schedule_capacity" });
    const plans = candidateMetrics(data, defaultIntent()).candidates.find(row => row.playerId === "c")!.plans;
    expect(plans.every(row => row.netPoints === null)).toBe(true);
  });
});

// RSO-2b-A3: card plans come from the current read (asOf = server evaluation time). The timeline and reconciliation
// check the provider snapshot, whose asOf is older at selection and newer after the confirmation re-read or a Refresh.
describe("Preview swap legality across newer reads", () => {
  const reread = (data: PlanningSnapshot, asOf: string): PlanningSnapshot => ({ ...data, id: `${data.id}:${asOf}`, context: { ...data.context, asOf } });
  // Same copy as the component's selectPlan handler.
  const selectPlan = (steps: PlanStep[]): PlanIntent => ({ ...defaultIntent(), revision: 1, steps: steps.map(step => ({ ...step, dependsOn: [...step.dependsOn] })) });
  const timeline = (data: PlanningSnapshot, intent: PlanIntent) => { const result = buildTimeline(data, intent, intent.steps); result.at("9999-12-31T23:59:59Z"); return result; };
  const cardRead = (timing: "same_day" | "next_day", gameDate: string) => {
    const data = auditSearchFixture(1), startsAt = `${gameDate}T20:00:00Z`;
    data.context = { ...data.context, timeZone: "America/New_York", asOf: "2026-10-05T12:03:00Z", endDate: gameDate };
    data.rules.acquisitionTiming = timing;
    data.games = data.games.map(game => ({ ...game, date: gameDate, startsAt }));
    data.forecasts = data.forecasts.map(row => ({ ...row, expiresAt: startsAt, issuedContext: { ...row.issuedContext!, scheduledAt: startsAt } }));
    return data;
  };

  it.each([
    // Same-day: due before the 4:00 p.m. ET puck drop. Next-day: due before league midnight, effective at midnight.
    ["same_day", "2026-10-05", "2026-10-05T19:59:00.000Z", "2026-10-05T19:59:00.000Z"],
    ["next_day", "2026-10-06", "2026-10-06T03:59:00.000Z", "2026-10-06T04:00:00.000Z"],
  ] as const)("%s: card plan → selectPlan → legal timeline, kept by reconcileIntent on later reads", (timing, gameDate, at, effectiveAt) => {
    const read = cardRead(timing, gameDate);
    const plan = candidatePlanForSort(candidateMetrics(read, defaultIntent()).candidates[0].plans, "points")!;
    expect(plan.netPoints).toBe(9);
    expect(plan.steps).toHaveLength(1);
    // A move timed after the read is a future acquisition, so it carries the availability recheck.
    expect(plan.steps[0]).toMatchObject({ type: "add", playerId: "100", dropPlayerId: "3", at, effectiveAt, conditional: true });
    const intent = selectPlan(plan.steps);
    const projected = evaluatePlan(read, intent, "outcome", intent.steps).projectedValue;
    // Provider snapshot older than the card read, the card read, the confirmation re-read and a manual Refresh provider.
    for (const asOf of ["2026-10-05T12:00:00Z", read.context.asOf, "2026-10-05T12:03:20Z", "2026-10-05T12:45:00Z"]) {
      const snapshot = reread(read, asOf), result = timeline(snapshot, intent);
      expect(result.legal, result.limitations.join(" ")).toBe(true);
      expect(reconcileIntent(snapshot, intent, read)).toMatchObject({ issues: [], suggestedSteps: null });
      expect(evaluatePlan(snapshot, intent, "outcome", intent.steps)).toMatchObject({ legal: true, projectedValue: projected });
    }
    // Past-time detection is unchanged once the planned action time has passed.
    const passed = reconcileIntent(reread(read, new Date(Date.parse(at) + 30_000).toISOString()), intent, read);
    expect(passed.issues).toContainEqual({ stepId: plan.steps[0].id, message: "Selected action time has passed; review this step." });
    expect(passed.suggestedSteps).toEqual([]);
    // The defect's shape, a non-conditional move pinned to the read's asOf, is still rejected on an older snapshot.
    const pinned = timeline(reread(read, "2026-10-05T12:00:00Z"), selectPlan([{ ...plan.steps[0], at: read.context.asOf, conditional: false }]));
    expect(pinned.limitations.join(" ")).toContain("must be conditional on availability recheck");
  });
});
