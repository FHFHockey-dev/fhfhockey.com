import { describe, expect, it } from "vitest";
import type { InterpretationRecord, ObservedEvidence } from "./contract";
import { FIXTURE_AS_OF, FIXTURE_CONFIG, FIXTURE_PLAYERS, fixtureRecords } from "./fixtures";
import { interpretPlayer, normalizeTeamGames, weightedPointsGap } from "./interpret";

const fixture = (key: string) => FIXTURE_PLAYERS.find(player => player.key === key)!;
const run = (key: string, overrides: Partial<Parameters<typeof interpretPlayer>[0]> = {}) => {
  const player = fixture(key);
  return interpretPlayer({ evidence: player.evidence, forecast: player.forecasts[10], priorForecast: player.priorForecasts?.[10],
    config: FIXTURE_CONFIG, asOf: FIXTURE_AS_OF, horizon: 10, fixture: true, ...overrides });
};
const metric = (record: InterpretationRecord, target: string) => record.metrics.find(item => item.target === target)!;
const deepFreeze = <T,>(value: T): T => {
  if (value && typeof value === "object") { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
};

describe("sustainability gap arithmetic", () => {
  it("computes D = expected − recent per team game from the unmodified FORGE total", () => {
    const record = run("f5");
    const points = metric(record, "POINTS");
    const recent = fixture("f5").evidence.teamGames.slice(-10).reduce((sum, game) => sum + (game.stats.POINTS ?? 0), 0);
    expect(points.observedPerTeamGame.value).toBeCloseTo(recent / 10, 12);
    expect(points.expectedPerTeamGame.value).toBeCloseTo(fixture("f5").forecasts[10].player.totals.POINTS.expected! / 10, 12);
    expect(points.gapPerTeamGame.value).toBeCloseTo(0.65 - recent / 10, 12);
    expect(points.direction).toBe("cooling");
    expect(record.forecastTotals.POINTS.expected).toBe(fixture("f5").forecasts[10].player.totals.POINTS.expected);
  });

  it("does not apply appearance probability a second time and keeps conditional values labeled separately", () => {
    const points = metric(run("f1"), "POINTS");
    expect(points.expectedPerTeamGame.value).toBeCloseTo(0.75, 12);
    expect(points.expectedPerAppearanceConditional.value).toBeCloseTo(0.75 / 0.95, 12);
  });

  it("keeps outlook change separate from the gap: cooling can coexist with an upgraded outlook", () => {
    const record = run("f1");
    const points = metric(record, "POINTS");
    expect(points.gapPerTeamGame.value).toBeCloseTo(0.75 - 0.9, 12);
    expect(points.outlookChangePerTeamGame.value).toBeCloseTo(0.3, 12);
    expect(record.explanations.map(item => item.id)).toContain("cooling-with-upgrade");
    expect(metric(run("f6"), "POINTS").outlookChangePerTeamGame.reason).toBe("no_prior_forecast");
  });

  it("computes the league points view from explicit weights and gates missing categories", () => {
    const record = run("f5");
    const weights = { GOALS: 3, ASSISTS: 2, SHOTS_ON_GOAL: 0.5 };
    const view = weightedPointsGap(record, weights);
    const expected = (["GOALS", "ASSISTS", "SHOTS_ON_GOAL"] as const).reduce((sum, target) =>
      sum + weights[target] * metric(record, target).expectedPerTeamGame.value!, 0);
    expect(view.expected.value).toBeCloseTo(expected, 12);
    expect(view.gap.value).toBeCloseTo(view.expected.value! - view.observed.value!, 12);
    expect(weightedPointsGap(run("f8"), weights).gap.value).toBeNull();
    expect(weightedPointsGap(run("g1"), weights).expected.reason).toBe("not_applicable");
  });
});

describe("horizons", () => {
  it("supports 5/10/20 scheduled team games with exact game membership", () => {
    for (const horizon of [5, 10, 20] as const) {
      const record = fixtureRecords(horizon).find(item => item.identity.playerId === "fx-f1")!;
      expect(record.horizon.requestedGames).toBe(horizon);
      expect(record.horizon.gameIds).toHaveLength(horizon);
      expect(record.horizon.complete).toBe(true);
    }
  });

  it("blocks the gap for a short season horizon instead of relabeling 14 games as 20", () => {
    const record = fixtureRecords(20).find(item => item.identity.playerId === "fx-f3")!;
    expect(record.horizon).toMatchObject({ requestedGames: 20, scheduledGames: 14, complete: false, reason: "incomplete_horizon" });
    expect(metric(record, "POINTS").gapPerTeamGame.reason).toBe("expected_incomplete_horizon");
    expect(metric(record, "POINTS").observedPerTeamGame.value).not.toBeNull();
  });

  it("rejects a forecast whose scope does not match the requested horizon", () => {
    const record = run("f1", { horizon: 5 });
    expect(metric(record, "POINTS").expectedPerTeamGame.reason).toBe("horizon_mismatch");
  });

  it("withholds expected values from an expired forecast", () => {
    const record = run("f1", { asOf: "2026-10-19T13:00:00.000Z", config: { ...FIXTURE_CONFIG, maxEvidenceAgeHours: 1000 } });
    expect(record.freshness.forecastStatus).toBe("expired");
    expect(metric(record, "POINTS").expectedPerTeamGame.reason).toBe("forecast_expired");
  });
});

describe("sparse, partial and stale evidence", () => {
  it("counts confirmed absences as zero per team game and flags a sparse sample", () => {
    const record = run("d2");
    expect(record.recentWindow).toMatchObject({ appearances: 2, confirmedAbsences: 8, unknownGames: 0 });
    expect(metric(record, "POINTS").observedPerTeamGame.value).toBeCloseTo(0.2, 12);
    expect(metric(record, "POINTS").observedPerAppearance.value).toBeCloseTo(1, 12);
    expect(metric(record, "POINTS").sparse).toBe(true);
  });

  it("never treats an unknown team game as a zero-output absence", () => {
    const record = run("f8");
    expect(metric(record, "POINTS").observedPerTeamGame.reason).toBe("unknown_team_game_status");
    expect(metric(record, "POINTS").gapPerTeamGame.value).toBeNull();
    expect(metric(record, "POINTS").observedPerAppearance.value).not.toBeNull();
    expect(record.limitations.join(" ")).toMatch(/unknown participation/);
  });

  it("withholds gaps on stale evidence while still showing observed values", () => {
    const record = run("d3");
    expect(record.freshness.evidenceStatus).toBe("stale");
    expect(metric(record, "POINTS").gapPerTeamGame.reason).toBe("stale_evidence");
    expect(metric(record, "POINTS").observedPerTeamGame.value).not.toBeNull();
  });

  it("reports contradictory rows instead of summing them", () => {
    const record = run("f9");
    expect(record.diagnostics.conflictingGameIds).toEqual(["FX4-PRE-020"]);
    expect(metric(record, "POINTS").gapPerTeamGame.value).toBeNull();
  });

  it("excludes later-available rows, rejects invalid rows and drops identical duplicates", () => {
    const base = fixture("f6").evidence;
    const last = base.teamGames.at(-1)!;
    const evidence: ObservedEvidence = { ...base, teamGames: [...base.teamGames,
      { ...last, availableAt: "2026-10-16T08:00:00.000Z" },
      { ...last, gameId: "FX3-LATE", date: "2026-10-17", availableAt: "2026-10-19T08:00:00.000Z" },
      { ...last, gameId: "FX3-BAD", date: "Oct 17" },
      { ...last, gameId: "FX3-NEG", toiMinutes: -1 },
    ] };
    const normalized = normalizeTeamGames(evidence, Date.parse(FIXTURE_AS_OF));
    expect(normalized).toMatchObject({ excludedFutureRows: 1, invalidRows: 2, duplicateRows: 1, conflictingGameIds: [] });
    expect(normalized.games).toHaveLength(20);
  });
});

describe("forward and defense separation", () => {
  it("gives the same observed IPP different deviations against separate F and D references", () => {
    const forward = run("f7"), defense = run("d1");
    expect(forward.ipp.observed.value).toBeCloseTo(defense.ipp.observed.value!, 12);
    expect(forward.ipp.deviation.value).toBeCloseTo(forward.ipp.observed.value! - 0.65, 12);
    expect(defense.ipp.deviation.value).toBeCloseTo(defense.ipp.observed.value! - 0.35, 12);
  });

  it("leaves IPP unavailable without a class reference or a positive denominator", () => {
    const missing = run("d1", { config: { ...FIXTURE_CONFIG, ippReferences: { F: FIXTURE_CONFIG.ippReferences.F } } });
    expect(missing.ipp.deviation.reason).toBe("class_reference_missing");
    const base = fixture("f6").evidence;
    const zero = run("f6", { evidence: { ...base, teamGames: base.teamGames.map(game => ({ ...game, onIceGoalsFor: 0, stats: { ...game.stats, POINTS: 0 } })) } });
    expect(zero.ipp.observed.reason).toBe("zero_denominator");
    expect(run("g1").ipp.observed.reason).toBe("not_applicable");
  });

  it("rejects mismatched identity or class", () => {
    expect(() => run("f1", { forecast: fixture("f2").forecasts[10] })).toThrow(/different players/);
    expect(() => run("f1", { evidence: { ...fixture("f1").evidence, modelClass: "G" } })).toThrow(/class/);
  });
});

describe("opportunity context", () => {
  it("labels rising and falling opportunity with durability uncertain and shows the comparison blocks", () => {
    const rising = run("f1").opportunity!;
    expect(rising.label).toBe("Opportunity rising; durability uncertain");
    expect(rising.toiChangeMinutes.value).toBeCloseTo(5, 12);
    expect(rising.prior).toMatchObject({ startDate: "2026-09-25", endDate: "2026-10-04", appearances: 10 });
    expect(rising.observedDuration).toEqual({ appearances: 10, startDate: "2026-10-05", endDate: "2026-10-14" });
    expect(rising.powerPlayRole).toMatchObject({ status: "sourced", value: "PP1 (fixture lineup report)" });
    expect(run("f3").opportunity!.label).toBe("Opportunity falling; durability uncertain");
  });

  it("does not infer a PP role, scenario probability or classification without evidence or an accepted rule", () => {
    const temporary = run("f2").opportunity!;
    expect(temporary.powerPlayRole.status).toBe("unavailable");
    expect(temporary.scenarios.status).toBe("not_supplied");
    const noRule = run("f1", { config: { ...FIXTURE_CONFIG, opportunityRule: null } }).opportunity!;
    expect(noRule.direction).toBe("unclassified");
    expect(noRule.toiChangeMinutes.value).toBeCloseTo(5, 12);
  });

  it("separates a stable-role finishing heater from an opportunity change", () => {
    const record = run("f5");
    expect(record.opportunity!.direction).toBe("steady");
    expect(record.explanations.map(item => item.id)).toContain("conversion-not-role");
    expect(record.explanations.find(item => item.id === "conversion-not-role")!.text).toMatch(/not proven luck/);
  });

  it("shows higher observed variability for role switching without changing the expected mean", () => {
    const switching = metric(run("f4"), "POINTS"), stable = metric(run("f6"), "POINTS");
    expect(switching.observedVariability.value!).toBeGreaterThan(stable.observedVariability.value!);
    expect(switching.expectedPerTeamGame.value).toBeCloseTo(0.5, 12);
    expect(run("f4").uncertainty.predictiveSpread.reason).toBe("not_supplied_by_forge_v1");
  });
});

describe("VuDu goalie context", () => {
  it("aggregates SV% and GAA from primitives and passes FORGE ratios through, with the gap pending", () => {
    const record = run("g1");
    const goalie = record.goalie!;
    expect(goalie.observed.savePercentage.value).toBeCloseTo(goalie.observed.saves! / goalie.observed.shotsAgainst!, 12);
    expect(goalie.observed.goalsAgainstAverage.value).toBeCloseTo(60 * goalie.observed.goalsAgainst! / goalie.observed.minutes!, 12);
    expect(goalie.expected.savePercentage.value).toBe(fixture("g1").forecasts[10].player.ratios.SAVE_PERCENTAGE.value);
    expect(goalie.expected.expectedStarts.value).toBe(fixture("g1").forecasts[10].player.expectedStarts);
    expect(goalie.gap.status).toBe("pending_goalie_adapter");
    expect(record.metrics).toEqual([]);
  });
});

describe("purity", () => {
  it("does not mutate frozen inputs and is deterministic", () => {
    const player = fixture("f1");
    const input = deepFreeze(structuredClone({ evidence: player.evidence, forecast: player.forecasts[10], priorForecast: player.priorForecasts![10] }));
    const first = interpretPlayer({ ...input, config: FIXTURE_CONFIG, asOf: FIXTURE_AS_OF, horizon: 10, fixture: true });
    const second = interpretPlayer({ ...input, config: FIXTURE_CONFIG, asOf: FIXTURE_AS_OF, horizon: 10, fixture: true });
    expect(first).toEqual(second);
  });
});
