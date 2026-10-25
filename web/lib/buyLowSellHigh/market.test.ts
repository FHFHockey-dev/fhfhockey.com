import { describe, expect, it } from "vitest";
import type { InterpretationRecord } from "lib/skoElement/contract";
import { FIXTURE_AS_OF, fixtureRecords } from "lib/skoElement/fixtures";
import { weightedPointsGap } from "lib/skoElement/interpret";
import { buildWatchlists, compareMarketReference, type MarketExpectation, type MarketReference } from "./market";

const records = fixtureRecords(10);
const byId = (id: string) => records.find(record => record.identity.playerId === id)!;
const deepFreeze = <T,>(value: T): T => {
  if (value && typeof value === "object") { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
};

describe("watchlists", () => {
  it("ranks by the shared signed gap with deterministic order and keeps the Sko sign", () => {
    const lists = buildWatchlists(records, "POINTS");
    const rebound = lists.rebound.map(row => row.gap.value!);
    const cooling = lists.cooling.map(row => row.gap.value!);
    expect(rebound).toEqual([...rebound].sort((a, b) => b - a));
    expect(cooling).toEqual([...cooling].sort((a, b) => a - b));
    for (const row of [...lists.rebound, ...lists.cooling, ...lists.level]) {
      const metric = byId(row.playerId).metrics.find(item => item.target === "POINTS")!;
      expect(row.gap).toEqual(metric.gapPerTeamGame);
      expect(row.direction).toBe(metric.direction);
    }
  });

  it("lists unavailable gaps separately with their reasons, never as zero", () => {
    const unranked = buildWatchlists(records, "POINTS").unranked;
    const reasons = Object.fromEntries(unranked.map(row => [row.playerId, row.reason]));
    expect(reasons).toMatchObject({
      "fx-g1": "pending_goalie_adapter", "fx-f8": "observed_unknown_team_game_status",
      "fx-d3": "stale_evidence", "fx-f9": "observed_unknown_team_game_status",
    });
    expect(unranked.every(row => row.gap.value === null)).toBe(true);
  });

  it("breaks equal gaps by name then id", () => {
    const base = byId("fx-f5");
    const twin = { ...structuredClone(base), identity: { ...base.identity, playerId: "fx-twin", name: "Aaa Fixture Twin" } };
    const cooling = buildWatchlists([base, twin], "POINTS").cooling;
    expect(cooling.map(row => row.playerId)).toEqual(["fx-twin", "fx-f5"]);
  });

  it("keeps role context on a reversal instead of turning it into a recommendation", () => {
    const demoted = buildWatchlists(records, "POINTS").rebound.find(row => row.playerId === "fx-f3")!;
    expect(demoted.opportunityLabel).toBe("Opportunity falling; durability uncertain");
  });

  it("uses the shared league points view", () => {
    const weights = { GOALS: 3, ASSISTS: 2, SHOTS_ON_GOAL: 0.5 };
    const row = [...Object.values(buildWatchlists(records, "LEAGUE_POINTS", weights)).flat()].find(item => item.playerId === "fx-f1")!;
    expect(row.gap).toEqual(weightedPointsGap(byId("fx-f1"), weights).gap);
  });
});

describe("market reference comparability", () => {
  const expected: MarketExpectation = { value: 7.5, unit: "fantasy_points", horizonGames: 10, scoringBasis: "points:fixture-league" };
  const reference: MarketReference = { source: "Offer from fixture league manager", kind: "manager_entered", capturedAt: "2026-10-18T10:00:00.000Z",
    horizonGames: 10, scoringBasis: "points:fixture-league", unit: "fantasy_points", value: 6 };
  const options = { asOf: FIXTURE_AS_OF, maxAgeHours: 72 };

  it("shows a gap only for a comparable, sourced, dated reference", () => {
    const result = compareMarketReference(expected, reference, options);
    expect(result).toMatchObject({ status: "comparable", gap: 1.5 });
    expect(result.label).not.toMatch(/undervalued|buy|sell/i);
  });

  it.each([
    ["no_reference", null],
    ["missing_source", { ...reference, source: " " }],
    ["invalid_value", { ...reference, value: Number.NaN }],
    ["invalid_time", { ...reference, capturedAt: "yesterday" }],
    ["future_capture", { ...reference, capturedAt: "2026-10-19T00:00:00.000Z" }],
    ["stale_reference", { ...reference, capturedAt: "2026-10-10T00:00:00.000Z" }],
    ["unit_mismatch", { ...reference, unit: "count" as const }],
    ["horizon_mismatch", { ...reference, horizonGames: 5 }],
    ["scoring_mismatch", { ...reference, scoringBasis: "category:POINTS" }],
  ])("returns Market reference unavailable for %s", (reason, candidate) => {
    expect(compareMarketReference(expected, candidate, options)).toEqual({ status: "unavailable", reason, label: "Market reference unavailable" });
  });

  it("refuses a gap when the expectation itself is unavailable", () => {
    expect(compareMarketReference({ ...expected, value: null }, reference, options)).toMatchObject({ reason: "expected_unavailable" });
  });

  it("never changes the shared interpretation when a quote changes", () => {
    const frozen = deepFreeze(structuredClone(records)) as InterpretationRecord[];
    const before = structuredClone(frozen);
    for (const value of [0, 3, 100]) compareMarketReference(expected, { ...reference, value }, options);
    buildWatchlists(frozen, "POINTS");
    expect(frozen).toEqual(before);
    expect(fixtureRecords(10)).toEqual(before);
  });
});
