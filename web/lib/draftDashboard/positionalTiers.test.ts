import { describe, expect, it } from "vitest";
import { buildPositionTiers, remainingBands, advisePosition } from "./positionalTiers";
import { buildDashboardTiers } from "./tierDashboardAdapter";
import { buildPositionWeightMultipliers } from "./positionWeights";
import { estimatePlayerAvailability } from "./availability";
import { buildPersonalizedRecommendations } from "lib/draft-pro/recommendations";

const rows = (values: (number | null)[], adp = 20) => values.map((value, index) => ({ id: String(index), name: `Player ${index}`, value, adp }));
const pool = rows([100, 100, 99, 50, 50, 49]);
const available = new Set(pool.map(player => player.id));
const horizon = { currentPick: 20, targetPick: 40, opposingPicks: 19 };

describe("positional tiers", () => {
  it("separates small elite groups and bounds every tier's projected-value spread", () => {
    // Illustrative scoring groups, not fixed player rankings or live projections.
    const values = [424.9, 418, 385, 380, 345, 342, 339, 335,
      ...Array.from({ length: 100 }, (_, i) => 290 - i * 2), 0];
    const result = buildPositionTiers("C", rows(values));
    expect(result.bands.slice(0, 3).map(band => band.players.map(player => player.value)))
      .toEqual([[424.9, 418], [385, 380], [345, 342, 339, 335]]);
    expect(result.bands.length).toBeGreaterThan(8);
    expect(result.bands.every(band => band.max - band.min <= 424.9 * 0.05 + 1e-9)).toBe(true);
    expect(buildPositionTiers("C", rows(values).reverse())).toEqual(result);
    const shifted = buildPositionTiers("C", rows(values.map(value => value * 2 - 1000)));
    expect(shifted.bands.map(band => band.players.map(player => player.id)))
      .toEqual(result.bands.map(band => band.players.map(player => player.id)));
  });
  it("finds clusters without splitting ties and is independent of input order", () => {
    const result = buildPositionTiers("D", pool);
    expect(result.bands.map(band => band.players.length)).toEqual([3, 3]);
    expect(buildPositionTiers("D", [...pool].reverse())).toEqual(result);
    expect(remainingBands(result, available)[0].meaningfulBreak).toBe(true);
  });
  it("does not advertise smooth value bands as cliffs", () => {
    const players = rows(Array.from({ length: 40 }, (_, i) => 100 - i));
    const result = buildPositionTiers("C", players);
    expect(result.bands.length).toBeGreaterThan(1);
    expect(remainingBands(result, new Set(players.map(p => p.id))).every(band => !band.meaningfulBreak)).toBe(true);
  });
  it("handles negative values, one elite outlier, sparse and missing values", () => {
    expect(buildPositionTiers("G", rows([-1, -1, -1, -1])).bands).toHaveLength(1);
    expect(buildPositionTiers("G", rows([10, 9, 8])).bands[0].tier).toBeNull();
    expect(buildPositionTiers("G", rows([null, NaN])).missing).toHaveLength(2);
    const elite = buildPositionTiers("C", rows([100, 20, 19, 18, 17, 16]));
    expect(elite.bands[0].players).toHaveLength(1);
  });
  it("updates remaining counts and restores them without changing membership", () => {
    const tiers = buildPositionTiers("D", pool);
    const before = JSON.stringify(tiers);
    expect(remainingBands(tiers, new Set(["2", "3", "4", "5"]))[0].remaining).toHaveLength(1);
    expect(remainingBands(tiers, available)[0].remaining).toHaveLength(3);
    expect(JSON.stringify(tiers)).toBe(before);
  });
  it("gives conservative take/wait/uncertain advice and never treats previews as instructions", () => {
    const tiers = buildPositionTiers("D", pool);
    expect(advisePosition(tiers, available, horizon, 2, true, true).label).toBe("Take now");
    expect(advisePosition(tiers, available, { ...horizon, opposingPicks: 0 }, 12, true, true).label).toBe("Can wait");
    expect(advisePosition(tiers, available, horizon, 2, false, true).label).toBe("Next-turn preview");
    expect(advisePosition(tiers, available, null, 12, true, true).label).toBe("No later pick");
    expect(advisePosition(tiers, available, horizon, 2, true, false).label).toBe("No open starting slot");
    expect(advisePosition(buildPositionTiers("D", pool.map(p => ({ ...p, adp: null }))), available, horizon, 12, true, true).label).toBe("Uncertain");
    expect(advisePosition(tiers, available, horizon, 2, true, true, false).label).toBe("Draft context unavailable");
  });
  it("clusters the full 2,000-player limit within a practical browser budget", () => {
    const start = performance.now();
    const result = buildPositionTiers("FWD", rows(Array.from({ length: 2000 }, (_, i) => 2000 - i + (i % 3) / 10)));
    expect(result.bands.flatMap(b => b.players)).toHaveLength(2000);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe("shared availability", () => {
  it("conditions on availability now and handles absent, extreme and zero-pick contexts", () => {
    expect(estimatePlayerAvailability(1, { currentPick: 500, targetPick: 520, opposingPicks: 19 })).toBeGreaterThanOrEqual(0);
    expect(estimatePlayerAvailability(1, { ...horizon, opposingPicks: 0 })).toBe(1);
    expect(estimatePlayerAvailability(null, horizon)).toBeNull();
    expect(estimatePlayerAvailability(20, null)).toBeNull();
    expect(estimatePlayerAvailability(20, { ...horizon, opposingPicks: 100 })).toBeNull();
    expect(estimatePlayerAvailability(20, horizon, 2)).toBeLessThan(estimatePlayerAvailability(20, horizon, 40)!);
  });
  it("uses exactly the same estimate in recommendations and omits legacy estimates", () => {
    const candidate = { id: "1", name: "P", role: "skater" as const, eligiblePositions: ["D"], globalVorp: 10, rankValue: 10, adp: 20 };
    expect(buildPersonalizedRecommendations([candidate], { leagueType: "points", selectionHorizon: horizon, availabilitySpread: 15 })[0].availabilityEstimate).toBe(estimatePlayerAvailability(20, horizon, 15));
    expect(buildPersonalizedRecommendations([candidate], { leagueType: "points", currentPick: 20, teamCount: 12 })[0].availabilityEstimate).toBeNull();
  });
});

describe("tier scoring adapter", () => {
  const scoring = { GOALS: 10, ASSISTS: 0, PP_POINTS: 0, SHOTS_ON_GOAL: 0, HITS: 0, BLOCKED_SHOTS: 0 };
  const players = [10, 9, 3, 2].map((goals, i) => ({ playerId: i, fullName: `P${i}`, displayPosition: "C,LW", eligiblePositions: ["C", "LW"], fantasyPoints: { projected: goals * 10 }, combinedStats: { GOALS: { projected: goals }, GAMES_PLAYED: { projected: 42 } } })) as any;
  const input = { players, draftSettings: { teamCount: 12, rosterConfig: { C: 2, LW: 2 } }, leagueType: "points" as const, fantasyPointSettings: scoring, goaliePointValues: {} };
  it("uses custom scoring during proration and preserves multi-position eligibility", () => {
    const result = buildDashboardTiers({ ...input, prorate84: true });
    expect(result.find(p => p.position === "C")?.bands[0].max).toBe(200);
    expect(result.find(p => p.position === "LW")?.bands[0].max).toBe(200);
    expect(buildDashboardTiers({ ...input, prorate84: true, fantasyPointSettings: { ...scoring, GOALS: 5 } })[0].bands[0].max).toBe(100);
    expect(buildDashboardTiers({ ...input, forwardGrouping: "fwd" })[0].position).toBe("FWD");
  });
  it("marks missing active scoring inputs unavailable instead of assigning zero", () => {
    const result = buildDashboardTiers({ ...input, fantasyPointSettings: { ...scoring, HITS: 1 } });
    expect(result[0].bands).toHaveLength(0);
    expect(result[0].missing).toHaveLength(4);
  });
  it("uses weighted category scores rather than projected points", () => {
    const result = buildDashboardTiers({ ...input, leagueType: "categories", categoryWeights: { GOALS: 1 } });
    expect(result[0].bands[0].max).toBeLessThan(2);
    expect(result[0].bands.at(-1)!.min).toBeLessThan(0);
    const inverted = buildDashboardTiers({ ...input, leagueType: "categories", categoryWeights: { GOALS: -1 } });
    expect(inverted[0].bands[0].players[0].id).toBe("3");
  });
  it("requires goalie workloads for rate categories and never prorates goalie points", () => {
    const goalies = [0.93, 0.92, 0.9, 0.89].map((rate, i) => ({ playerId: i, fullName: `G${i}`, displayPosition: "G", eligiblePositions: ["G"], fantasyPoints: { projected: 500 + i }, combinedStats: { SAVE_PERCENTAGE: { projected: rate }, SHOTS_AGAINST_GOALIE: { projected: 1000 }, WINS_GOALIE: { projected: 30 }, GOALS_AGAINST_GOALIE: { projected: 100 }, SAVES_GOALIE: { projected: 900 }, SHUTOUTS_GOALIE: { projected: 3 } } })) as any;
    const categories = buildDashboardTiers({ ...input, players: goalies, leagueType: "categories", categoryWeights: { SAVE_PERCENTAGE: 1 } }).find(p => p.position === "G")!;
    expect(categories.bands[0].players[0].id).toBe("0");
    delete goalies[0].combinedStats.SHOTS_AGAINST_GOALIE;
    delete goalies[0].combinedStats.SAVES_GOALIE;
    expect(buildDashboardTiers({ ...input, players: goalies, leagueType: "categories", categoryWeights: { SAVE_PERCENTAGE: 1 } }).find(p => p.position === "G")!.missing).toHaveLength(1);
    expect(buildDashboardTiers({ ...input, players: goalies.slice(1), prorate84: true }).find(p => p.position === "G")!.bands[0].max).toBe(503);
  });
  it("does not silently use unprorated values when projected games are missing", () => {
    const noGames = players.map((p: any) => ({ ...p, combinedStats: { GOALS: p.combinedStats.GOALS } }));
    expect(buildDashboardTiers({ ...input, players: noGames, prorate84: true })[0].missing).toHaveLength(4);
  });
  it("keeps neutral tiers identical and weights defense values after points proration", () => {
    const defenders = players.map((p: any) => ({ ...p, displayPosition: "D", eligiblePositions: ["D"] }));
    const defenderInput = { ...input, players: defenders, prorate84: true };
    const snapshot = JSON.stringify(defenders);
    const neutral = buildDashboardTiers(defenderInput);
    const explicitNeutral = buildDashboardTiers({
      ...defenderInput,
      positionWeightMultipliers: buildPositionWeightMultipliers(defenders, { D: 1 }, true)
    });
    const weighted = buildDashboardTiers({
      ...defenderInput,
      positionWeightMultipliers: buildPositionWeightMultipliers(defenders, { D: 0.5 }, true)
    });
    const bandValues = (tiers: typeof neutral) => tiers.find(tier => tier.position === "D")!
      .bands.flatMap(band => band.players.map(player => player.value));

    expect(explicitNeutral).toEqual(neutral);
    expect(bandValues(neutral)).toEqual([200, 180, 60, 40]);
    expect(bandValues(weighted)).toEqual([100, 90, 30, 20]);
    expect(JSON.stringify(defenders)).toBe(snapshot);
  });
  it("uses the same signed category composite in tiers as in valuation", () => {
    const categoryInput = { ...input, leagueType: "categories" as const, categoryWeights: { GOALS: 1 } };
    const before = buildDashboardTiers(categoryInput);
    const weighted = buildDashboardTiers({
      ...categoryInput,
      positionWeightMultipliers: buildPositionWeightMultipliers(players, { C: 0.5, LW: 0.5 }, true)
    });
    const values = (tiers: typeof before) => new Map(tiers.find(tier => tier.position === "C")!
      .bands.flatMap(band => band.players.map(player => [player.id, player.value] as const)));
    const neutralValues = values(before);
    const weightedValues = values(weighted);

    expect(neutralValues.get("0")!).toBeGreaterThan(0);
    expect(neutralValues.get("3")!).toBeLessThan(0);
    for (const [id, value] of neutralValues) {
      expect(weightedValues.get(id)).toBeCloseTo(value! * 0.5);
    }
  });
});
