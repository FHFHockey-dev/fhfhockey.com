import { describe, expect, it } from "vitest";
import type { InterpretationRecord, ObservedEvidence } from "./contract";
import { FIXTURE_AS_OF, FIXTURE_CONFIG, FIXTURE_PLAYERS, fixtureRecords } from "./fixtures";
import { interpretPlayer, normalizeTeamGames, weightedPointsGap } from "./interpret";
import { forecastQualification } from "lib/buyLowSellHigh/trade";

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
    expect(metric(record, "POINTS").expectedPerAppearanceConditional.reason).toBe("forecast_expired");
  });

  it("keeps the player's pre-window comparison independent of current output and forecast horizon", () => {
    const base = fixture("f1");
    const before = run("f1");
    const evidence = structuredClone(base.evidence);
    evidence.teamGames.slice(-10).forEach(g => { g.stats.POINTS = 20; });
    const changed = run("f1", { evidence, horizon: 5, forecast: base.forecasts[5] });
    expect(changed.personalReferenceWindow).toEqual(before.personalReferenceWindow);
    expect(changed.personalReferenceWindow.endDate! < changed.recentWindow.startDate!).toBe(true);
    const old = metric(before, "POINTS"), now = metric(changed, "POINTS");
    expect(now.personalReference.perTeamGame).toEqual(old.personalReference.perTeamGame);
    expect(now.personalReference.perAppearance).toEqual(old.personalReference.perAppearance);
    expect(now.personalReference.changePerTeamGame.value).toBeCloseTo(20 - old.personalReference.perTeamGame.value!);
  });

  it("shows thin personal history as missing rather than a zero baseline", () => {
    const record = run("f1", { config: { ...FIXTURE_CONFIG, recentWindowTeamGames: 20 } });
    expect(record.personalReferenceWindow.teamGames).toBe(0);
    expect(metric(record, "POINTS").personalReference.perTeamGame).toEqual({ value: null, reason: "no_completed_team_games" });
    expect(metric(record, "POINTS").personalReference.changePerTeamGame.value).toBeNull();
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
    expect(normalized.games).toHaveLength(21);
    expect(normalized.games.find(g => g.gameId === "FX3-NEG")?.status).toBe("unknown");
  });

  it("retains an invalid recent game as unknown instead of backfilling an older result", () => {
    const evidence = structuredClone(fixture("f6").evidence);
    const before = run("f6");
    evidence.teamGames.at(-1)!.toiMinutes = -1;
    const record = run("f6", { evidence });
    expect(record.recentWindow.startDate).toBe(before.recentWindow.startDate);
    expect(record.recentWindow.unknownGames).toBe(1);
    expect(metric(record, "POINTS").gapPerTeamGame.value).toBeNull();
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
  const withGames = (goalies: NonNullable<ObservedEvidence["teamGames"][number]["goalie"]>[]) => {
    const evidence = structuredClone(fixture("g1").evidence);
    evidence.teamGames = evidence.teamGames.slice(-goalies.length).map((g, i) => ({ ...g, status: "appeared", goalie: goalies[i] }));
    return evidence;
  };

  it("weights a relief appearance by shots and minutes, not equally with a start", () => {
    const evidence = withGames([
      { saves: 9, shotsAgainst: 10, goalsAgainst: 1, minutes: 10, appearanceType: "relief" },
      { saves: 99, shotsAgainst: 100, goalsAgainst: 1, minutes: 60, appearanceType: "start" },
    ]);
    const goalie = run("g1", { evidence }).goalie!;
    expect(goalie.observed.savePercentage.value).toBeCloseTo(108 / 110);
    expect(goalie.observed.goalsAgainstAverage.value).toBeCloseTo(60 * 2 / 70);
    expect(goalie.observed.starts.value).toBe(1);
    expect(goalie.observed.reliefAppearances.value).toBe(1);
    expect(goalie.observed.startShare.value).toBe(0.5);
  });

  it.each([
    { saves: 31, shotsAgainst: 30, goalsAgainst: 1, minutes: 60 },
    { saves: 29, shotsAgainst: 30, goalsAgainst: 2, minutes: 60 },
    { saves: 29, shotsAgainst: 30, goalsAgainst: 1, minutes: 0 },
  ])("withholds inconsistent goalie primitives: %j", primitives => {
    const observed = run("g1", { evidence: withGames([primitives]) }).goalie!.observed;
    expect(observed.savePercentage.reason).toBe("inconsistent_goalie_primitives");
    expect(observed.goalsAgainstAverage.value).toBeNull();
  });

  it("keeps zero exposure, missing saves and unknown participation distinct", () => {
    const evidence = withGames([{ saves: 0, shotsAgainst: 0, goalsAgainst: 0, minutes: 10 }]);
    let observed = run("g1", { evidence }).goalie!.observed;
    expect(observed.savePercentage.reason).toBe("zero_denominator");
    expect(observed.goalsAgainstAverage.value).toBe(0);
    expect(observed.starts.value).toBeNull();
    evidence.teamGames[0].goalie!.saves = null;
    observed = run("g1", { evidence }).goalie!.observed;
    expect(observed.savePercentage.reason).toBe("incomplete_primitives");
    evidence.teamGames[0].status = "unknown";
    expect(run("g1", { evidence }).goalie!.observed.savePercentage.reason).toBe("unknown_team_game_status");
  });

  it("withholds expired forecast ratios and starts while preserving recorded results", () => {
    const record = run("g1", { asOf: "2026-10-19T13:00:00.000Z" });
    expect(record.freshness.forecastStatus).toBe("expired");
    for (const value of Object.values(record.goalie!.expected).filter(v => typeof v === "object")) expect(value).toEqual({ value: null, reason: "forecast_expired" });
    expect(record.goalie!.observed.savePercentage.value).not.toBeNull();
  });

  it("keeps improving save results separate from a falling start share", () => {
    const evidence = structuredClone(fixture("g1").evidence);
    evidence.teamGames = evidence.teamGames.map((g, i) => ({ ...g, status: "appeared",
      goalie: { saves: i < 10 ? 27 : 29, shotsAgainst: 30, goalsAgainst: i < 10 ? 3 : 1, minutes: 60, appearanceType: i < 10 ? "start" : "relief" } }));
    const goalie = run("g1", { evidence }).goalie!;
    expect(goalie.observed.savePercentage.value!).toBeGreaterThan(goalie.personalReference.savePercentage.value!);
    expect(goalie.observed.startShare.value).toBe(0);
    expect(goalie.personalReference.startShare.value).toBe(1);
    expect(goalie.gap.status).toBe("pending_goalie_adapter");
  });
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

describe("observation-only records (no FORGE forecast)", () => {
  const observedOnly = (key: string, mutate?: (evidence: ObservedEvidence) => void) => {
    const evidence = structuredClone(fixture(key).evidence);
    evidence.playerName = "Observed Goalie";
    mutate?.(evidence);
    return run(key, { evidence, forecast: undefined, priorForecast: undefined });
  };

  it("produces the same observed goalie results as the forecast-present path, with every expected value withheld", () => {
    const withForecast = run("g1");
    const record = observedOnly("g1");
    expect(record.goalie!.observed).toEqual(withForecast.goalie!.observed);
    expect(record.goalie!.personalReference).toEqual(withForecast.goalie!.personalReference);
    expect(record.recentWindow).toEqual(withForecast.recentWindow);
    expect(record.goalie!.expected).toEqual({
      savePercentage: { value: null, reason: "no_forecast" },
      goalsAgainstAverage: { value: null, reason: "no_forecast" },
      expectedStarts: { value: null, reason: "no_forecast" },
      interpretation: "ratio_of_expected_totals",
    });
    expect(record.goalie!.gap.status).toBe("pending_goalie_adapter");
    expect(record.horizon).toMatchObject({ complete: false, scheduledGames: 0, gameIds: [], reason: "no_forecast",
      expectedAppearances: null, expectedStarts: null });
    expect(record.forecastTotals).toEqual({});
    expect(record.identity).toMatchObject({ playerId: fixture("g1").evidence.playerId, name: "Observed Goalie",
      forecastVersion: null, forecastManifestId: null, forecastReadAsOf: null, baselineChecksum: null });
    expect(record.identity.team).toBe(fixture("g1").evidence.teamGames.at(-1)!.team);
    expect(record.freshness).toMatchObject({ forecastStatus: "unknown", forecastExpiresAt: null });
    expect(record.limitations).toContain("No FORGE forecast was supplied: observed results only; every expected value and gap is withheld.");
  });

  it("keeps unknown team games in the window as unknown instead of dropping them", () => {
    const record = observedOnly("g1", evidence => {
      const last = evidence.teamGames.at(-1)!;
      last.status = "unknown";
      last.goalie = undefined;
    });
    const k = FIXTURE_CONFIG.recentWindowTeamGames;
    expect(record.recentWindow.teamGames).toBe(k);
    expect(record.recentWindow.unknownGames).toBe(1);
    expect(record.recentWindow.endDate).toBe(fixture("g1").evidence.teamGames.at(-1)!.date);
    expect(record.goalie!.observed.savePercentage.reason).toBe("unknown_team_game_status");
    expect(record.goalie!.observed.starts.reason).toBe("start_relief_evidence_unavailable");
    expect(record.limitations.some(text => text.includes("1 recent team game(s) have unknown participation"))).toBe(true);
  });

  it("is never qualified as a forecast by Buy Low/Sell High", () => {
    expect(forecastQualification(observedOnly("g1")).status).toBe("unavailable");
  });

  it("requires a sourced display name rather than inventing one", () => {
    expect(() => run("g1", { forecast: undefined, priorForecast: undefined })).toThrow("needs evidence.playerName");
  });

  it("works for skaters too: observed rates stay, expected values and gaps are withheld", () => {
    const record = observedOnly("f5");
    const points = metric(record, "POINTS");
    expect(points.observedPerTeamGame).toEqual(metric(run("f5"), "POINTS").observedPerTeamGame);
    expect(points.expectedPerTeamGame.reason).toBe("no_forecast");
    expect(points.expectedPerAppearanceConditional.reason).toBe("no_forecast");
    expect(points.gapPerTeamGame.reason).toBe("expected_no_forecast");
    expect(points.outlookChangePerTeamGame.reason).toBe("no_forecast");
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
