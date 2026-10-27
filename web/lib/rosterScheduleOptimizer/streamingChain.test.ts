import { beforeEach, describe, expect, it, vi } from "vitest";
import * as rsoPolicy from "../player-forecasts/rsoUsePolicy";
import { defaultIntent, defaultWorkspace } from "./workspace";
import { evaluatePlan, forecastPointsReader, planRoster, playerAssignedPoints } from "./planning";
import { knownDropOrder } from "./retention";
import { reconcileIntent } from "./reconciliation";
import { buildStreamingChains, streamingChainSteps } from "./streamingChain";
import { zonedMidnight } from "./planningDates";
import { snapshotSchema } from "../in-season/workspaceSchema";
import type { GameForecast, PlanIntent, PlanStep, PlanningPlayer, PlanningSnapshot, StreamingChain } from "./planningTypes";

// Synthetic teams and players only. One fictional review covers the single scored target.
const fixtureScope = { component: "fictional-streams", modelMode: "synthetic", codeVersion: "fixture",
  configurationHash: "a".repeat(64), artifactHash: "b".repeat(64), targetKey: "GOALS", horizonGames: 1,
  conditioning: "synthetic-unconditional", participationLineage: "synthetic-only" };
const fixturePolicy: rsoPolicy.RsoUsePolicy = { version: "rso-target-use-v1", revision: "fictional-stream-reviews",
  revokedReviewIds: [], reviews: [{ id: "fictional-GOALS", binding: fixtureScope, reviewedAt: "2026-09-01T00:00:00Z",
    expiresAt: "2100-01-01T00:00:00Z", inputCutoffFrom: "2026-09-01T00:00:00Z", inputCutoffUntil: "2100-01-01T00:00:00Z",
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
    prospectiveEvidenceRef: "fictional-evidence", ownerApprovalRef: "fictional-approval" }] };
beforeEach(() => vi.spyOn(rsoPolicy, "currentRsoUsePolicy").mockReturnValue(fixturePolicy));

const ZONE = "America/New_York";
// Mon 2026-10-26 … Sun 2026-11-01; every game starts 7 p.m. ET.
const WEEK = Array.from({ length: 7 }, (_, day) => new Date(Date.UTC(2026, 9, 26 + day)).toISOString().slice(0, 10));
type Spec = { id: string; team: string; days: number[]; perGame: number; rostered?: boolean; positions?: string[];
  recentTotals?: PlanningPlayer["recentTotals"]; startProbability?: number };
type WeekOptions = { asOf?: string; remaining?: number; slots?: Record<string, number>; startDate?: string;
  goalieMinimum?: Partial<PlanningSnapshot["rules"]["goalieMinimum"]> };

function week(specs: Spec[], options: WeekOptions = {}): PlanningSnapshot {
  const workspace = defaultWorkspace(new Date("2026-10-26T12:00:00Z"));
  const asOf = options.asOf ?? "2026-10-26T14:00:00Z";
  const teams = new Map<string, number[]>();
  for (const spec of specs) teams.set(spec.team, [...new Set([...(teams.get(spec.team) ?? []), ...spec.days])]);
  const games = [...teams].flatMap(([team, days]) => days.map(day => ({ id: `${team}-${day}`, date: WEEK[day],
    startsAt: `${WEEK[day]}T23:00:00Z`, scheduleRevision: `schedule-${team}`, teamAbbreviation: team, opponent: "OPP",
    home: true, status: "scheduled" as const })));
  const players: PlanningPlayer[] = specs.map((spec, index) => ({ id: spec.id, nhlId: index + 1, nhlTeamId: index + 1,
    rosterRevision: `roster-${spec.id}`, name: `Synthetic ${spec.id}`, teamAbbreviation: spec.team,
    eligiblePositions: spec.positions ?? ["C"], eligibilityVerified: true, playerClass: spec.positions?.includes("G") ? "goalie" : "skater",
    availability: spec.rostered ? "rostered" : "free_agent", canDrop: true, ownership: null, holdValue: null,
    reserveEligibility: [], ...(spec.recentTotals ? { recentTotals: spec.recentTotals } : {}) }));
  const snapshot: PlanningSnapshot = { id: "streaming-week", context: { ...workspace.context, startDate: options.startDate ?? WEEK[0], endDate: WEEK[6], timeZone: ZONE, asOf },
    players, roster: specs.filter(spec => spec.rostered).map(spec => ({ playerId: spec.id, position: "active" as const })), games, forecasts: [],
    rules: { ...workspace.rules, lineupMode: "daily", rosterSlots: options.slots ?? { C: 1, UTIL: 1, BN: 0 }, acquisitionTiming: "same_day", acquisitionCost: 1,
      periods: [{ id: "week", start: zonedMidnight(WEEK[0], ZONE), end: zonedMidnight("2026-11-02", ZONE), remaining: options.remaining ?? 4, source: "provider" }],
      scoring: { mode: "points", weights: { GOALS: 1 }, categories: [] },
      goalieMinimum: { ...workspace.rules.goalieMinimum, ...options.goalieMinimum } },
    lockedAssignments: [], realized: {}, opponent: null,
    evidence: { schedule: { source: "Local fixture", asOf, seasonId: workspace.context.seasonId, completeness: "complete", limitations: [] } } };
  snapshot.forecasts = specs.flatMap((spec, index) => spec.days.map(day => {
    const game = games.find(row => row.id === `${spec.team}-${day}`)!;
    return { playerId: spec.id, gameId: game.id, stats: { GOALS: spec.perGame }, conditioning: "unconditional", sourceKind: "detailed",
      sourceWatermark: "fixture-only", cutoffAt: "2026-10-25T12:00:00Z", issuedAt: "2026-10-25T12:00:00Z", expiresAt: game.startsAt,
      revisionId: `revision-${spec.id}-${day}`, modelVersion: "fixture", startProbability: spec.startProbability ?? null, confirmedStart: false,
      allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false }, limitations: [],
      rsoTargetBindings: { GOALS: { ...fixtureScope, cutoffAt: "2026-10-25T12:00:00Z" } },
      issuedContext: { version: "forge-issued-context-v1", playerId: spec.id, gameId: game.id, nhlPlayerId: index + 1, teamId: index + 1,
        seasonId: snapshot.context.seasonId, scheduledAt: game.startsAt, scheduleRevision: game.scheduleRevision, rosterRevision: `roster-${spec.id}`,
        observedAt: "2026-10-25T12:00:00Z", scheduleSourceUpdatedAt: "2026-10-25T12:00:00Z", scheduleFetchedAt: "2026-10-25T12:00:00Z",
        identityUpdatedAt: "2026-10-25T12:00:00Z", membershipCreatedAt: ["2026-09-01T00:00:00Z"] } } as GameForecast;
  }));
  return snapshot;
}

/** TJ's example week (10-27): one open UTIL spot, a drop candidate with no games, team schedules that chain to +7. */
const tjWeek: Spec[] = [
  { id: "core", team: "CORE", days: [0, 1, 2, 3, 4, 5, 6], perGame: 3, rostered: true },
  { id: "drop", team: "IDLE", days: [], perGame: 0, rostered: true },
  { id: "lak", team: "LAK", days: [0], perGame: 1.1 },
  { id: "njd", team: "NJD", days: [1, 2], perGame: 1.2 },
  { id: "phi", team: "PHI", days: [1, 2], perGame: 1.6, positions: ["LW"] },
  { id: "wpg", team: "WPG", days: [3, 4], perGame: 2 },
  { id: "ott", team: "OTT", days: [5, 6], perGame: 1.5, recentTotals: { games: 10, stats: { GOALS: 4 } } },
  { id: "edm", team: "EDM", days: [5, 6], perGame: 1.52, recentTotals: { games: 10, stats: { GOALS: 20 } } },
  // Four spread games for one add: the greedy pick a chain must beat.
  { id: "dec", team: "DEC", days: [0, 2, 4, 6], perGame: 1 },
];
const intent = (): PlanIntent => defaultIntent();
const legSummary = (snapshot: PlanningSnapshot) => planRoster(snapshot, intent()).streaming!;

describe("streaming chain", () => {
  it("builds TJ's +7 four-add chain with hold days, ranked by projection", () => {
    const plan = legSummary(week(tjWeek));
    expect(plan.recommended).toBe(1);
    const [chain] = plan.chains;
    expect(chain).toMatchObject({ spots: 1, netGames: 7, addsUsed: 4, addsAvailable: 4 });
    expect(chain.evaluation).toMatchObject({ legal: true, budgetVerified: true });
    expect(chain.legs.map(leg => [leg.startDate, leg.endDate, leg.playerId, leg.dropPlayerId, leg.games])).toEqual([
      [WEEK[0], WEEK[0], "lak", "drop", 1],
      // NJD and PHI both cover Tue/Wed; PHI projects more.
      [WEEK[1], WEEK[2], "phi", "lak", 2],
      [WEEK[3], WEEK[4], "wpg", "phi", 2],
      // OTT and EDM project within the near-tie band, so last-10 FPts/G orders them.
      [WEEK[5], WEEK[6], "edm", "wpg", 2],
    ]);
    expect(chain.legs[1].options.map(option => option.playerId).slice(0, 2)).toEqual(["phi", "njd"]);
    expect(chain.legs[3].options.slice(0, 2).map(option => [option.playerId, option.recentPointsPerGame])).toEqual([["edm", 2], ["ott", 0.4]]);
    expect(chain.netPoints).toBeCloseTo(1.1 + 3.2 + 4 + 3.04);
    // Today's move is due before puck drop (latest equivalent instant) and conditional; later ones at league midnight.
    expect(chain.steps.map(step => [step.at, step.conditional])).toEqual([
      ["2026-10-26T22:59:00.000Z", true], [zonedMidnight(WEEK[1], ZONE), true], [zonedMidnight(WEEK[3], ZONE), true], [zonedMidnight(WEEK[5], ZONE), true]]);
    expect(chain.steps.map(step => step.dependsOn)).toEqual([[], [chain.steps[0].id], [chain.steps[1].id], [chain.steps[2].id]]);
  });

  it("starts mid-week from the provider's remaining adds and skips past days", () => {
    const plan = legSummary(week(tjWeek, { asOf: "2026-10-28T14:00:00Z", remaining: 2 }));
    const [chain] = plan.chains;
    expect(chain).toMatchObject({ spots: 1, netGames: 4, addsUsed: 2, addsAvailable: 2 });
    expect(chain.legs.map(leg => [leg.startDate, leg.playerId, leg.games])).toEqual([[WEEK[3], "wpg", 2], [WEEK[5], "edm", 2]]);
    expect(chain.steps.every(step => Date.parse(step.at) >= Date.parse("2026-10-28T14:00:00Z"))).toBe(true);
  });

  it("suggests a two-spot split only when it adds more, and always offers the one-spot chain", () => {
    const twoOpen: Spec[] = [
      { id: "core", team: "CORE", days: [0, 1, 2, 3, 4, 5, 6], perGame: 3, rostered: true },
      { id: "drop1", team: "IDLE", days: [], perGame: 0, rostered: true },
      { id: "drop2", team: "IDLE", days: [], perGame: 0, rostered: true },
      { id: "early1", team: "EAR", days: [0, 1, 2, 3], perGame: 1 },
      { id: "early2", team: "EAR", days: [0, 1, 2, 3], perGame: 0.9 },
      { id: "late1", team: "LAT", days: [4, 5, 6], perGame: 1 },
      { id: "late2", team: "LAT", days: [4, 5, 6], perGame: 0.9 },
    ];
    const plan = legSummary(week(twoOpen, { slots: { C: 1, UTIL: 2, BN: 0 } }));
    expect(plan.recommended).toBe(2);
    expect(plan.chains.map(chain => [chain.spots, chain.netGames, chain.addsUsed])).toEqual([[2, 14, 4], [1, 7, 2]]);
    expect(new Set(plan.chains[0].legs.map(leg => leg.playerId)).size).toBe(4);
    expect(plan.chains[0].legs.filter(leg => leg.dropPlayerId.startsWith("drop")).map(leg => leg.dropPlayerId).sort()).toEqual(["drop1", "drop2"]);
    // With one open spot a second stream only costs games: the one-spot chain stands alone.
    expect(legSummary(week(tjWeek)).chains.map(chain => chain.spots)).toEqual([1]);
  });

  it("keeps chain steps legal on newer reads", () => {
    const read = week(tjWeek);
    const chain = legSummary(read).chains[0];
    // Same copy as the component's select handler.
    const selected: PlanIntent = { ...intent(), revision: 1, steps: chain.steps.map(step => ({ ...step, dependsOn: [...step.dependsOn] })) };
    for (const asOf of ["2026-10-26T13:58:00Z", read.context.asOf, "2026-10-26T14:03:20Z", "2026-10-26T14:45:00Z"]) {
      const snapshot = { ...read, id: `${read.id}:${asOf}`, context: { ...read.context, asOf } };
      const evaluation = evaluatePlan(snapshot, selected, "outcome", selected.steps);
      expect(evaluation.legal, evaluation.limitations.join(" ")).toBe(true);
      expect(evaluation.activeGames - evaluatePlan(snapshot, selected, "outcome", []).activeGames).toBe(7);
      expect(reconcileIntent(snapshot, selected, read)).toMatchObject({ issues: [], suggestedSteps: null });
    }
  });

  it("times next-day adds the day before they take effect", () => {
    const read = week(tjWeek);
    read.rules.acquisitionTiming = "next_day";
    const [chain] = legSummary(read).chains;
    // Monday's game can't be reached any more; the chain starts Tuesday.
    expect(chain).toMatchObject({ netGames: 6, addsUsed: 3 });
    expect(chain.legs.map(leg => [leg.actionDate, leg.startDate, leg.playerId])).toEqual([[WEEK[0], WEEK[1], "phi"], [WEEK[2], WEEK[3], "wpg"], [WEEK[4], WEEK[5], "edm"]]);
    expect(chain.steps.map(step => [step.at, step.effectiveAt])).toEqual([
      ["2026-10-26T22:59:00.000Z", zonedMidnight(WEEK[1], ZONE)],
      [zonedMidnight(WEEK[2], ZONE), zonedMidnight(WEEK[3], ZONE)],
      [zonedMidnight(WEEK[4], ZONE), zonedMidnight(WEEK[5], ZONE)]]);
    expect(evaluatePlan(read, { ...intent(), steps: chain.steps }, "outcome", chain.steps).legal).toBe(true);
  });

  it("swaps a leg to another ranked option and re-links the next drop", () => {
    const chain = legSummary(week(tjWeek)).chains[0];
    const steps: PlanStep[] = streamingChainSteps(chain, { 1: "njd" });
    expect(steps.map(step => [step.playerId, step.dropPlayerId])).toEqual([["lak", "drop"], ["njd", "lak"], ["wpg", "njd"], ["edm", "wpg"]]);
    expect(steps[2].dependsOn).toEqual([steps[1].id]);
    const read = week(tjWeek);
    const evaluation = evaluatePlan(read, { ...intent(), steps }, "outcome", steps);
    expect(evaluation.legal, evaluation.limitations.join(" ")).toBe(true);
    expect(evaluation.activeGames - evaluatePlan(read, intent(), "outcome", []).activeGames).toBe(7);
  });
});

/** TJ's league mid-week (Wed): 2 adds left, a 3-start goalie minimum with 1 credited, and one rostered goalie who starts Thu. */
const goalieWeek: Spec[] = [
  { id: "core", team: "CORE", days: [0, 1, 2, 3, 4, 5, 6], perGame: 3, rostered: true },
  { id: "drop", team: "IDLE", days: [], perGame: 0, rostered: true },
  { id: "g1", team: "GA", days: [3], perGame: 4, rostered: true, positions: ["G"], startProbability: 1 },
  { id: "wpg", team: "WPG", days: [3, 4], perGame: 2 },
  { id: "edm", team: "EDM", days: [5, 6], perGame: 1.52 },
  { id: "gs", team: "GS", days: [4, 5], perGame: 0.8, positions: ["G"], startProbability: 0.6 },
  { id: "gx", team: "GX", days: [6], perGame: 0.5, positions: ["G"], startProbability: 0.4 },
];
const midWeek = (credited: number | null, required: number | null = 3): WeekOptions => ({ asOf: "2026-10-28T14:00:00Z", remaining: 2,
  slots: { C: 1, UTIL: 1, G: 1, BN: 0 }, goalieMinimum: { required, credited, counts: "starts", penalty: "lose_goalie_categories",
    periodStart: "2026-10-26", periodEnd: "2026-11-02" } });
const legRows = (chain: StreamingChain) => chain.legs.map(leg => [leg.startDate, leg.endDate, leg.playerId, leg.dropPlayerId]);
const cover = (extra: Partial<PlanIntent> = {}): PlanIntent => ({ ...intent(), goalieCoverage: "cover", ...extra });

describe("streaming chain goalie minimum", () => {
  it("streams a goalie to reach 3/3 when the lineup would miss, and still offers the most-games chain", () => {
    const plan = planRoster(week(goalieWeek, midWeek(1)), cover()).streaming!;
    expect(plan.goalieMinimum).toEqual({ required: 3, baseline: 2, met: false, cover: true });
    // Best: a second spot swaps the rostered goalie, after his last start, for a goalie streamer.
    expect(plan.recommended).toBe(2);
    expect(plan.chains.map(chain => [chain.spots, chain.netGames, chain.evaluation.goalie.risk])).toEqual([[2, 4, false], [1, 3, false], [1, 4, true]]);
    const [two, one, mostGames] = plan.chains;
    expect(legRows(two)).toEqual([[WEEK[4], WEEK[6], "gs", "g1"], [WEEK[3], WEEK[6], "wpg", "drop"]]);
    expect(two.evaluation).toMatchObject({ legal: true, budgetVerified: true });
    expect(two.evaluation.goalie.projected).toBeCloseTo(3.2);
    expect(legRows(one)).toEqual([[WEEK[3], WEEK[3], "wpg", "drop"], [WEEK[4], WEEK[6], "gs", "wpg"]]);
    // The chain with more points misses the minimum: it stays visible, ranked after the ones that meet it.
    expect(legRows(mostGames)).toEqual([[WEEK[3], WEEK[4], "wpg", "drop"], [WEEK[5], WEEK[6], "edm", "wpg"]]);
    expect(mostGames.netPoints!).toBeGreaterThan(two.netPoints!);
    expect(mostGames.evaluation.goalie.projected).toBe(2);
    expect(plan.limitations).not.toContain("No streaming chain reaches the goalie minimum with the adds left.");
  });

  it("streams a goalie through the one open spot when the rostered goalie is protected", () => {
    const plan = planRoster(week(goalieWeek, midWeek(1)), cover({ protectedPlayerIds: ["g1"] })).streaming!;
    expect(plan.recommended).toBe(1);
    const [chain, mostGames] = plan.chains;
    expect(legRows(chain)).toEqual([[WEEK[3], WEEK[3], "wpg", "drop"], [WEEK[4], WEEK[6], "gs", "wpg"]]);
    expect(chain).toMatchObject({ netGames: 3, evaluation: { legal: true, goalie: { risk: false } } });
    expect(chain.evaluation.goalie.projected).toBeCloseTo(3.2);
    // Meeting the minimum costs one AGP here; the +4 chain that misses it is shown beside it.
    expect(mostGames).toMatchObject({ spots: 1, netGames: 4, evaluation: { goalie: { risk: true, projected: 2 } } });
    expect(plan.chains).toHaveLength(2);
  });

  it("leaves the chain alone when the minimum is met, absent or its risk accepted", () => {
    const met = planRoster(week(goalieWeek, midWeek(3)), cover()).streaming!;
    const none = planRoster(week(goalieWeek, midWeek(null, null)), cover()).streaming!;
    // "Accept risk" reports the shortfall but never pushes goalies up.
    const accepted = legSummary(week(goalieWeek, midWeek(1)));
    expect(met.goalieMinimum).toMatchObject({ required: 3, met: true });
    expect(none.goalieMinimum).toBeUndefined();
    expect(accepted.goalieMinimum).toEqual({ required: 3, baseline: 2, met: false, cover: false });
    expect(accepted.chains[0].evaluation.goalie.risk).toBe(true);
    for (const plan of [met, none, accepted]) {
      expect(plan.chains.map(legRows)).toEqual([[[WEEK[3], WEEK[4], "wpg", "drop"], [WEEK[5], WEEK[6], "edm", "wpg"]]]);
      expect(plan.chains[0].netGames).toBe(4);
    }
  });

  it("says so when no chain can reach the minimum", () => {
    const short = goalieWeek.filter(spec => spec.id !== "gs");
    const plan = planRoster(week(short, midWeek(0)), cover()).streaming!;
    expect(plan.goalieMinimum).toMatchObject({ baseline: 1, met: false });
    expect(plan.limitations).toContain("No streaming chain reaches the goalie minimum with the adds left.");
    expect(plan.chains[0].netGames).toBeGreaterThan(0);
  });
});

/** One add left on Wed: a one-game star (Thu) against a two-game streamer (Thu–Fri) for the one open spot. */
const starWeek = (twoPerGame: number, starForm?: number): Spec[] => [
  { id: "core", team: "CORE", days: [0, 1, 2, 3, 4, 5, 6], perGame: 3, rostered: true },
  { id: "drop", team: "IDLE", days: [], perGame: 0, rostered: true },
  { id: "star", team: "STA", days: [3], perGame: 5, ...(starForm === undefined ? {} : { recentTotals: { games: 10, stats: { GOALS: starForm * 10 } } }) },
  { id: "two", team: "TWO", days: [3, 4], perGame: twoPerGame },
];
const pick = (specs: Spec[], objective: "agp" | "outcome") => {
  const plan = planRoster(week(specs, { asOf: "2026-10-28T14:00:00Z", remaining: 1 }), { ...intent(), objective }).streaming!;
  expect(plan.chains[0].evaluation.objective).toBe(objective);
  return plan.chains[0].legs.map(leg => leg.playerId);
};

describe("streaming chain star vs streamer", () => {
  it("takes the one-game star under Best projected points only when he adds more for the week", () => {
    // 5 FPts in one game beats 2 + 2; 3 + 3 beats 5.
    expect(pick(starWeek(2), "outcome")).toEqual(["star"]);
    expect(pick(starWeek(3), "outcome")).toEqual(["two"]);
    // Most starts stays games-first.
    expect(pick(starWeek(2), "agp")).toEqual(["two"]);
  });

  it("ranks by the average of projected FPts and last-10 FPts/G", () => {
    // The star's blend is (5 + 1) / 2 = 3 for one game, under the streamer's 2 + 2.
    expect(pick(starWeek(2, 1), "outcome")).toEqual(["two"]);
    // A hot last 10 (7 FPts/G) lifts him to 6 for one game.
    expect(pick(starWeek(2.9, 7), "outcome")).toEqual(["star"]);
    const plan = planRoster(week(starWeek(2, 1), { asOf: "2026-10-28T14:00:00Z", remaining: 1 }), { ...intent(), objective: "outcome" }).streaming!;
    // Shown totals stay projected FPts; the blend is the ranking net.
    expect(plan.chains[0]).toMatchObject({ netGames: 2, netPoints: 4, netScore: 4 });
  });
});

/** C/LW/RW play daily for little, so they rank first to drop, but dropping one loses as many games as the D streamer adds.
 * The D plays Monday only (4th in drop order): only his drop gains. */
const fourthDrop: Spec[] = [
  { id: "c1", team: "TC", days: [0, 1, 2, 3, 4, 5, 6], perGame: 0.01, rostered: true, positions: ["C"] },
  { id: "lw1", team: "TL", days: [0, 1, 2, 3, 4, 5, 6], perGame: 0.02, rostered: true, positions: ["LW"] },
  { id: "rw1", team: "TR", days: [0, 1, 2, 3, 4, 5, 6], perGame: 0.03, rostered: true, positions: ["RW"] },
  { id: "d1", team: "TD", days: [0], perGame: 0.4, rostered: true, positions: ["D"] },
  { id: "dfa", team: "DFA", days: [1, 2, 3, 4, 5, 6], perGame: 1, positions: ["D"] },
];
const fourSlots = { slots: { C: 1, LW: 1, RW: 1, D: 1, BN: 0 } };

describe("streaming chain drop candidates", () => {
  it("tries drops past the first three", () => {
    const plan = legSummary(week(fourthDrop, fourSlots));
    expect(plan.chains[0].legs.map(leg => [leg.startDate, leg.endDate, leg.playerId, leg.dropPlayerId])).toEqual([[WEEK[1], WEEK[6], "dfa", "d1"]]);
    expect(plan.chains[0].netGames).toBe(6);
    expect(plan.limitations).not.toContain("Streaming search reached its time limit; some drop candidates were not tried.");
  });

  it("stops after the first three past the deadline and says so", () => {
    const snapshot = week(fourthDrop, fourSlots), base = intent();
    // Most starts: under Best projected points, swapping a 0.01 C for the 1.0 D is a points gain on its own.
    const baseline = evaluatePlan(snapshot, base, "agp", []);
    const dropOrder = knownDropOrder(snapshot.players.filter(player => player.availability === "rostered"),
      player => playerAssignedPoints(snapshot, baseline, player.id));
    expect([...dropOrder.keys()]).toEqual(["c1", "lw1", "rw1", "d1"]);
    const plan = buildStreamingChains({ snapshot, intent: base, baseline, dropOrder, dueNow: null, deadline: 0,
      evaluate: steps => evaluatePlan(snapshot, base, "agp", steps, false), points: forecastPointsReader(snapshot) });
    expect(plan.chains).toEqual([]);
    expect(plan.limitations).toContain("Streaming search reached its time limit; some drop candidates were not tried.");
  });
});

describe("streaming chain planning range", () => {
  it("starts at a later plan-from day (Thu) and runs to the range end", () => {
    const plan = legSummary(week(tjWeek, { startDate: WEEK[3] }));
    const [chain] = plan.chains;
    expect(chain.legs.map(leg => [leg.startDate, leg.endDate, leg.playerId])).toEqual([[WEEK[3], WEEK[4], "wpg"], [WEEK[5], WEEK[6], "edm"]]);
    expect(chain).toMatchObject({ netGames: 4, addsUsed: 2, evaluation: { legal: true } });
    expect(chain.steps.map(step => step.at)).toEqual([zonedMidnight(WEEK[3], ZONE), zonedMidnight(WEEK[5], ZONE)]);
    expect(chain.legs.every(leg => leg.gameDates.every(date => date >= WEEK[3] && date <= WEEK[6]))).toBe(true);
  });
});

describe("saved snapshots with recent totals", () => {
  it("round-trips recentTotals and still accepts an older snapshot without it", () => {
    const withTotals = week(tjWeek);
    withTotals.players[2].recentTotals = { games: 10, stats: { GOALS: 4, FACEOFFS_WON: null } };
    const saved = JSON.parse(JSON.stringify(withTotals));
    expect(snapshotSchema.parse(saved).players.map(player => player.recentTotals ?? null))
      .toEqual(withTotals.players.map(player => player.recentTotals ?? null));
    const older = JSON.parse(JSON.stringify({ ...withTotals, players: withTotals.players.map(({ recentTotals: _, ...player }) => player) }));
    expect(snapshotSchema.parse(older).players.every(player => player.recentTotals === undefined)).toBe(true);
    // The field stays strict: an unknown key inside it is still rejected.
    const extra = JSON.parse(JSON.stringify(withTotals));
    extra.players[2].recentTotals.label = "hot";
    expect(snapshotSchema.safeParse(extra).success).toBe(false);
  });
});
