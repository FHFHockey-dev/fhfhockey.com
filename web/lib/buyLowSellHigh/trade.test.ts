import { describe, expect, it } from "vitest";
import type { InterpretationRecord } from "lib/skoElement/contract";
import { FIXTURE_CONFIG, FIXTURE_PLAYERS, fixtureRecords } from "lib/skoElement/fixtures";
import { interpretPlayer } from "lib/skoElement/interpret";
import { compareTrade, type TradeScoring } from "./trade";

const records = fixtureRecords(10);
const byId = (list: InterpretationRecord[], id: string) => list.find(record => record.identity.playerId === id)!;
const points: TradeScoring = { mode: "points", scoringBasis: "points:fixture-league", weights: { GOALS: 3, ASSISTS: 2, SHOTS_ON_GOAL: 0.5, SAVES_GOALIE: 0.2, GOALS_AGAINST_GOALIE: -1 } };
const total = (id: string, target: string) => byId(records, id).forecastTotals[target].expected!;
const issueCodes = (result: ReturnType<typeof compareTrade>) => result.issues.map(issue => issue.code);

describe("trade arithmetic", () => {
  it("matches independently calculated league points and flags uneven sides without blocking", () => {
    const result = compareTrade({ give: ["fx-f5"], receive: ["fx-f1", "fx-f7"], scoring: points }, records);
    const fp = (id: string) => 3 * total(id, "GOALS") + 2 * total(id, "ASSISTS") + 0.5 * total(id, "SHOTS_ON_GOAL");
    expect(result.rows[0].give.value).toBeCloseTo(fp("fx-f5"), 12);
    expect(result.rows[0].receive.value).toBeCloseTo(fp("fx-f1") + fp("fx-f7"), 12);
    expect(result.rows[0].net).toBeCloseTo(fp("fx-f1") + fp("fx-f7") - fp("fx-f5"), 12);
    expect(result.complete).toBe(true);
    expect(result.issues).toEqual([expect.objectContaining({ code: "uneven_roster", blocking: false })]);
    expect(result.summary).toMatch(/Raw projected production/);
    expect(result.players.map(player => [player.startDate, player.endDate])).toContainEqual(["2026-10-20", "2026-11-07"]);
  });

  it("applies goalie weights only to goalies and skater weights only to skaters", () => {
    const result = compareTrade({ give: ["fx-g1"], receive: ["fx-f6"], scoring: points }, records);
    expect(result.rows[0].give.value).toBeCloseTo(0.2 * total("fx-g1", "SAVES_GOALIE") - total("fx-g1", "GOALS_AGAINST_GOALIE"), 12);
  });

  it("keeps category vectors, lower-is-better direction and no overall winner", () => {
    const result = compareTrade({ give: ["fx-g1", "fx-f6"], receive: ["fx-f1"],
      scoring: { mode: "categories", categories: ["POINTS", "HITS", "GOALS_AGAINST_GOALIE", "SAVE_PERCENTAGE"] } }, records);
    const row = (key: string) => result.rows.find(item => item.key === key)!;
    expect(row("POINTS").net).toBeCloseTo(total("fx-f1", "POINTS") - total("fx-f6", "POINTS"), 12);
    expect(row("GOALS_AGAINST_GOALIE")).toMatchObject({ lowerIsBetter: true, favorableForReceiver: true });
    expect(row("SAVE_PERCENTAGE").receive.reason).toBe("no_goalies");
    expect(result.complete).toBe(true);
    expect(result.summary).toMatch(/No overall winner/);
  });

  it("aggregates goalie ratios from summed primitives, not by averaging ratios", () => {
    const g1 = byId(records, "fx-g1");
    const g2: InterpretationRecord = { ...structuredClone(g1), identity: { ...g1.identity, playerId: "fx-g2", name: "Fixture Goalie Two" },
      forecastTotals: { ...g1.forecastTotals, SAVES_GOALIE: { expected: 100, unit: "count", reason: null }, SHOTS_AGAINST_GOALIE: { expected: 120, unit: "count", reason: null } } };
    const result = compareTrade({ give: ["fx-g1", "fx-g2"], receive: ["fx-f1"], scoring: { mode: "categories", categories: ["SAVE_PERCENTAGE"] } }, [...records, g2]);
    const pooled = (g1.forecastTotals.SAVES_GOALIE.expected! + 100) / (g1.forecastTotals.SHOTS_AGAINST_GOALIE.expected! + 120);
    const averaged = (g1.forecastTotals.SAVES_GOALIE.expected! / g1.forecastTotals.SHOTS_AGAINST_GOALIE.expected! + 100 / 120) / 2;
    expect(result.rows[0].give.value).toBeCloseTo(pooled, 12);
    expect(result.rows[0].give.value).not.toBeCloseTo(averaged, 6);
  });

  it("withholds an unsupported goalie ratio when a primitive is missing", () => {
    const g1 = byId(records, "fx-g1");
    const broken: InterpretationRecord = { ...g1, forecastTotals: { ...g1.forecastTotals, SHOTS_AGAINST_GOALIE: { expected: null, unit: "count", reason: "incomplete_target" } } };
    const result = compareTrade({ give: ["fx-g1"], receive: ["fx-f1"], scoring: { mode: "categories", categories: ["SAVE_PERCENTAGE"] } },
      records.map(record => (record === g1 ? broken : record)));
    expect(result.rows[0].give).toMatchObject({ value: null, reason: "incomplete_primitives", missingPlayerIds: ["fx-g1"] });
    expect(result.complete).toBe(false);
    expect(result.summary).toMatch(/incomplete/);
  });
});

describe("trade validation", () => {
  it.each([
    ["empty_give", { give: [], receive: ["fx-f1"] }],
    ["duplicate_receive", { give: ["fx-f5"], receive: ["fx-f1", "fx-f1"] }],
    ["both_sides", { give: ["fx-f1"], receive: ["fx-f1"] }],
    ["unknown_player", { give: ["fx-f1"], receive: ["fx-nobody"] }],
  ])("blocks %s", (code, sides) => {
    const result = compareTrade({ ...sides, scoring: points }, records);
    expect(issueCodes(result)).toContain(code);
    expect(result.complete).toBe(false);
  });

  it("blocks mixed horizons and short horizons rather than comparing unequal spans", () => {
    const mixed = compareTrade({ give: ["fx-f5"], receive: ["fx-f1"], scoring: points },
      [byId(records, "fx-f5"), byId(fixtureRecords(5), "fx-f1")]);
    expect(issueCodes(mixed)).toContain("mixed_horizons");
    const short = compareTrade({ give: ["fx-f3"], receive: ["fx-f1"], scoring: points }, fixtureRecords(20));
    expect(issueCodes(short)).toContain("incomplete_horizon");
    expect(short.rows[0].give.value).toBeNull();
  });

  it("blocks an expired forecast, while partial observed participation does not alter forecast totals", () => {
    const player = FIXTURE_PLAYERS.find(item => item.key === "f1")!;
    const expired = interpretPlayer({ evidence: player.evidence, forecast: player.forecasts[10], config: { ...FIXTURE_CONFIG, maxEvidenceAgeHours: 1000 },
      asOf: "2026-10-19T13:00:00.000Z", horizon: 10, fixture: true });
    expect(issueCodes(compareTrade({ give: ["fx-f5"], receive: ["fx-f1"], scoring: points }, [byId(records, "fx-f5"), expired]))).toContain("expired_forecast");
    const partial = compareTrade({ give: ["fx-f8"], receive: ["fx-f5"], scoring: points }, records);
    expect(partial.complete).toBe(true);
  });
});
