import { describe, expect, it } from "vitest";
import type { InterpretationRecord, ObservedEvidence } from "./contract";
import { FIXTURE_AS_OF, FIXTURE_CONFIG, FIXTURE_PLAYERS, fixtureRecords } from "./fixtures";
import { interpretPlayer, normalizeTeamGames, weightedPointsGap } from "./interpret";
import { compareTrade, FHFH_STANDARD_SCORING, forecastQualification } from "lib/buyLowSellHigh/trade";

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

  it("keeps outlook change separate from the gap: a forecast below recent can coexist with an upgraded outlook", () => {
    const record = run("f1");
    const points = metric(record, "POINTS");
    expect(points.gapPerTeamGame.value).toBeCloseTo(0.75 - 0.9, 12);
    expect(points.outlookChangePerTeamGame.value).toBeCloseTo(0.3, 12);
    expect(record.explanations.map(item => item.id)).toContain("forecast-below-recent-with-upgrade");
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
    // A2: the per-appearance subset is withheld too, not presented as the complete window.
    expect(metric(record, "POINTS").observedPerAppearance.reason).toBe("unknown_team_game_status");
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
    expect(normalized).toMatchObject({ excludedFutureRows: 1, invalidRows: 2, duplicateRows: 1, unplacedRows: 1, conflictingGameIds: [] });
    // A2: the played-but-unavailable game keeps its identity as unknown; the unplaceable date does not enter the sequence.
    expect(normalized.games).toHaveLength(22);
    expect(normalized.games.find(g => g.gameId === "FX3-LATE")?.status).toBe("unknown");
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
    expect(rising.blockCoverage).toEqual({ kind: "comparison_block_not_episode", teamGames: 10, appearances: 10, startDate: "2026-10-05", endDate: "2026-10-14" });
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

// ---------------------------------------------------------------------------
// L21 (W3-7 A1–A3, D3, D4, D7, D10): Stage 1 deterministic contracts
// ---------------------------------------------------------------------------
type Forecast = NonNullable<Parameters<typeof interpretPlayer>[0]["forecast"]>;
const editForecast = (key: string, edit: (forecast: Forecast) => void, horizon: 5 | 10 | 20 = 10) => {
  const forecast = structuredClone(fixture(key).forecasts[horizon]);
  edit(forecast);
  return forecast;
};
const eachTarget = (forecast: Forecast, target: string, edit: (value: Forecast["player"]["games"][number]["targets"][string]) => void) =>
  forecast.player.games.forEach(game => edit(game.targets[target]));
const editEvidence = (key: string, edit: (evidence: ObservedEvidence) => void) => {
  const evidence = structuredClone(fixture(key).evidence);
  edit(evidence);
  return evidence;
};
const appearedLine = (game: ObservedEvidence["teamGames"][number], toi: number, pp: number | null) =>
  ({ ...game, status: "appeared" as const, toiMinutes: toi, ppToiMinutes: pp, stats: { ...game.stats, POINTS: 0, GOALS: 0, ASSISTS: 0 }, onIceGoalsFor: 1 });

describe("A1: forecast admission (information time, permitted use, coverage)", () => {
  it("bumps the contract version for the v0.3 record shape", () => {
    expect(run("f1").contractVersion).toBe("sko-interpretation-v0.3");
  });

  it("does not admit a forecast read after the evaluated as-of: no gap, no current status, no qualified trade", () => {
    const forecast = editForecast("f1", f => {
      f.readAsOf = "2026-10-19T10:00:00.000Z";
      f.player.games.forEach(game => Object.values(game.targets).forEach(t => { t.issuedAt = "2026-10-19T10:00:00.000Z"; t.expiresAt = "2026-10-20T12:00:00.000Z"; }));
    });
    const record = run("f1", { forecast, fixture: false });
    expect(record.forecastAdmission).toMatchObject({ status: "not_admitted", reasons: ["read_after_as_of"] });
    expect(metric(record, "POINTS").gapPerTeamGame.value).toBeNull();
    expect(metric(record, "POINTS").expectedPerTeamGame.reason).toBe("forecast_read_after_as_of");
    expect(record.freshness.forecastStatus).toBe("not_admitted");
    expect(record.forecastTotals.POINTS.expected).toBeNull();
    expect(forecastQualification(record).status).toBe("unavailable");
    const records = fixtureRecords(10).filter(item => item.identity.playerId !== "fx-f1");
    expect(compareTrade({ give: ["fx-f5"], receive: ["fx-f1"], scoring: FHFH_STANDARD_SCORING }, [...records, record]).complete).toBe(false);
  });

  it("withholds one target whose own issuance is after as-of while other targets stay admitted", () => {
    const forecast = editForecast("f1", f => eachTarget(f, "POINTS", t => { t.issuedAt = "2026-10-19T10:00:00.000Z"; }));
    const record = run("f1", { forecast });
    expect(record.forecastAdmission.targets.POINTS).toMatchObject({ status: "withheld", reasons: ["issued_after_as_of"] });
    expect(metric(record, "POINTS").gapPerTeamGame.value).toBeNull();
    expect(metric(record, "POINTS").expectedPerTeamGame.reason).toBe("target_issued_after_as_of");
    expect(metric(record, "GOALS").gapPerTeamGame.value).not.toBeNull();
  });

  it("does not let other targets' expiries mask a target with no expiry (D10 fail-open guard)", () => {
    const forecast = editForecast("f1", f => eachTarget(f, "POINTS", t => { t.expiresAt = null; }));
    const record = run("f1", { forecast, fixture: false });
    expect(record.freshness.forecastStatus).toBe("unknown");
    expect(record.forecastAdmission.targets.POINTS.reasons).toContain("target_clock_missing");
    expect(metric(record, "POINTS").gapPerTeamGame.value).toBeNull();
    expect(record.forecastTotals.POINTS).toMatchObject({ expected: null, reason: "target_clock_missing" });
  });

  it("does not let a value approved for totals but not comparisons reach a trade comparison", () => {
    const forecast = editForecast("f1", f => eachTarget(f, "GOALS", t => { t.allowedUses = { ...t.allowedUses, comparison: false }; }));
    const record = run("f1", { forecast });
    expect(record.forecastAdmission.targets.GOALS).toMatchObject({ status: "withheld", reasons: ["comparison_not_permitted"],
      allowedUses: { totals: true, comparison: false } });
    expect(metric(record, "GOALS").gapPerTeamGame.value).toBeNull();
    // The denied value cannot be recovered by summing the record's totals.
    expect(record.forecastTotals.GOALS.expected).toBeNull();
    const records = fixtureRecords(10).filter(item => item.identity.playerId !== "fx-f1");
    const trade = compareTrade({ give: ["fx-f5"], receive: ["fx-f1"], scoring: FHFH_STANDARD_SCORING }, [...records, record]);
    expect(trade.complete).toBe(false);
    expect(trade.rows[0].receive.value).toBeNull();
  });

  it.each([
    ["incomplete coverage behind a numeric total", (f: Forecast) => { f.player.totals.POINTS.coveredGames = 1; }, "incomplete_target_coverage"],
    ["a total that does not reconcile with its games", (f: Forecast) => { f.player.totals.POINTS.expected! *= 2; }, "total_does_not_reconcile"],
    ["a non-finite total", (f: Forecast) => { f.player.totals.POINTS.expected = Number.NaN; }, "invalid_total"],
    ["a non-unconditional game basis", (f: Forecast) => eachTarget(f, "POINTS", t => { t.basis = "conditional_game"; }), "basis_not_unconditional"],
    ["a game value with no source", (f: Forecast) => eachTarget(f, "POINTS", t => { t.sourceIds = []; }), "source_missing"],
    ["a cutoff after issuance", (f: Forecast) => eachTarget(f, "POINTS", t => { t.cutoffAt = "2026-10-18T13:00:00.000Z"; }), "cutoff_after_issue"],
  ])("withholds %s", (_label, edit, reason) => {
    const record = run("f1", { forecast: editForecast("f1", edit) });
    expect(record.forecastAdmission.targets.POINTS.reasons).toContain(reason);
    const points = metric(record, "POINTS");
    expect(points.gapPerTeamGame.value).toBeNull();
    expect(points.gapSign).toBe("unavailable");
    expect(record.forecastTotals.POINTS.expected).toBeNull();
  });

  it("withholds expected starts that exceed the scheduled games", () => {
    const forecast = editForecast("g1", f => { f.player.expectedStarts = 11; });
    expect(run("g1", { forecast }).goalie!.expected.expectedStarts).toEqual({ value: null, reason: "invalid_expected_starts" });
  });

  it("validates the prior issuance at its own read time and rejects an invalid prior clock", () => {
    const prior = structuredClone(fixture("f1").priorForecasts![10]);
    prior.readAsOf = "not a time";
    expect(metric(run("f1", { priorForecast: prior }), "POINTS").outlookChangePerTeamGame.reason).toBe("prior_read_as_of_invalid");
    const record = run("f1");
    expect(record.priorForecastAdmission).toMatchObject({ status: "admitted", sameGameIds: true });
  });

  it("labels an observation-only record as having no forecast to admit", () => {
    const evidence = editEvidence("f5", e => { e.playerName = "Observed Skater"; });
    expect(run("f5", { evidence, forecast: undefined, priorForecast: undefined }).forecastAdmission).toEqual({
      status: "no_forecast", reasons: ["no_forecast"], readAsOf: null, policy: "read_and_issued_at_or_before_as_of", targets: {} });
  });
});

describe("A2: identity-complete window skeleton", () => {
  const ids = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `FX1-PRE-${String(from + i).padStart(3, "0")}`);

  it("records exact window game ids", () => {
    const record = run("f1");
    expect(record.recentWindow.gameIds).toEqual(ids(11, 20));
    expect(record.personalReferenceWindow.gameIds).toEqual(ids(1, 10));
    expect(record.recentWindow.membership).toBe("complete");
  });

  it("keeps a game with a malformed availability clock as unknown instead of backfilling an older game", () => {
    const evidence = editEvidence("f1", e => { e.teamGames.at(-1)!.availableAt = "yesterday"; });
    const record = run("f1", { evidence });
    expect(record.recentWindow).toMatchObject({ startDate: "2026-10-05", endDate: "2026-10-14", unknownGames: 1, gameIds: ids(11, 20) });
    expect(metric(record, "POINTS").observedPerTeamGame.reason).toBe("unknown_team_game_status");
    expect(record.diagnostics.invalidRows).toBe(1);
  });

  it("rejects an impossible calendar date and marks window membership incomplete", () => {
    const evidence = editEvidence("f1", e => { e.teamGames.push({ ...e.teamGames.at(-1)!, gameId: "FX1-IMPOSSIBLE", date: "2026-99-99" }); });
    const record = run("f1", { evidence });
    expect(record.recentWindow).toMatchObject({ endDate: "2026-10-14", membership: "incomplete", unplacedRows: 1 });
    expect(metric(record, "POINTS").observedPerTeamGame.reason).toBe("window_membership_incomplete");
    expect(metric(record, "POINTS").gapPerTeamGame.value).toBeNull();
  });

  it("keeps a completed game whose row was not yet available at as-of in the window as unknown", () => {
    const evidence = editEvidence("f1", e => {
      e.teamGames.push({ ...e.teamGames.at(-1)!, gameId: "FX1-LATE", date: "2026-10-16", availableAt: "2026-10-19T08:00:00.000Z" });
    });
    const record = run("f1", { evidence });
    expect(record.recentWindow.gameIds).toEqual([...ids(12, 20), "FX1-LATE"]);
    expect(record.recentWindow.unknownGames).toBe(1);
    expect(record.diagnostics.excludedFutureRows).toBe(1);
  });

  it("withholds IPP and opportunity, like per-team-game rates, when a window game is unknown", () => {
    const evidence = editEvidence("f5", e => { e.teamGames.at(-1)!.status = "unknown"; });
    const record = run("f5", { evidence });
    expect(record.ipp.observed.reason).toBe("unknown_team_game_status");
    expect(metric(record, "POINTS").observedPerAppearance.reason).toBe("unknown_team_game_status");
    expect(record.opportunity!.direction).toBe("unknown");
    expect(record.explanations.map(item => item.id)).not.toContain("conversion-not-role");
  });

  it("validates IPP counts per game before pooling", () => {
    const evidence = editEvidence("f6", e => {
      const games = e.teamGames.slice(-10);
      games.forEach(game => { game.stats.POINTS = 0; game.onIceGoalsFor = 0; });
      games[0].stats.POINTS = 2; games[0].onIceGoalsFor = 1;
      games[1].stats.POINTS = 0; games[1].onIceGoalsFor = 3;
    });
    expect(run("f6", { evidence }).ipp.observed.reason).toBe("inconsistent_counts");
  });
});

describe("A3 and D4: opportunity unknown states, participation and role evidence", () => {
  it("does not call 10 → 5 appearances at fixed minutes per appearance steady", () => {
    const evidence = editEvidence("f5", e => {
      e.teamGames = e.teamGames.map((game, i) => i >= 10 && i % 2 ? { ...game, status: "confirmed_absent", toiMinutes: 0, ppToiMinutes: 0, stats: {}, onIceGoalsFor: null }
        : appearedLine(game, 18, 2));
    });
    const opportunity = run("f5", { evidence }).opportunity!;
    expect(opportunity.toiChangeMinutes.value).toBeCloseTo(0, 12);
    expect(opportunity.prior.toiPerTeamGame.value).toBeCloseTo(18, 12);
    expect(opportunity.recent.toiPerTeamGame.value).toBeCloseTo(9, 12);
    expect(opportunity.appearanceShareChange.value).toBeCloseTo(-0.5, 12);
    expect(opportunity.direction).not.toBe("steady");
    expect(opportunity.label).toMatch(/appearances changed from 10 of 10 to 5 of 10 team games/);
  });

  it("treats unknown PP minutes as unknown opportunity, not steady (D4)", () => {
    const evidence = editEvidence("f5", e => { e.teamGames.slice(-10).forEach(game => { game.ppToiMinutes = null; }); });
    const record = run("f5", { evidence });
    expect(record.opportunity!.direction).toBe("unknown");
    expect(record.explanations.map(item => item.id)).not.toContain("conversion-not-role");
  });

  it("reports block coverage, not an observed duration, for a one-game spike", () => {
    const evidence = editEvidence("f5", e => {
      e.teamGames = e.teamGames.map((game, i) => appearedLine(game, i === 19 ? 38 : 18, 2));
    });
    const record = run("f5", { evidence });
    const opportunity = record.opportunity!;
    expect(opportunity.direction).toBe("rising");
    expect("observedDuration" in opportunity).toBe(false);
    expect(opportunity.blockCoverage).toEqual({ kind: "comparison_block_not_episode", teamGames: 10, appearances: 10, startDate: "2026-10-05", endDate: "2026-10-14" });
    const text = record.explanations.find(item => item.id === "opportunity")!.text;
    expect(text).not.toMatch(/Observed over 10 appearances/);
    expect(text).toMatch(/block coverage, not how long the change has lasted/);
  });

  it("uses role evidence only once it was known by as-of", () => {
    const evidence = editEvidence("f2", e => {
      e.roleEvidence = [{ kind: "pp_unit", label: "PP1 (retrospective report)", effectiveAt: "2026-10-05T16:00:00.000Z", knownAt: "2026-10-19T09:00:00.000Z", source: "fixture" }];
    });
    const opportunity = run("f2", { evidence }).opportunity!;
    expect(opportunity.powerPlayRole.status).toBe("unavailable");
    expect(opportunity.roleEvidenceExcluded).toBe(1);
  });

  it("does not call a known line change at unchanged minutes steady", () => {
    const evidence = editEvidence("f5", e => {
      e.roleEvidence = [{ kind: "line", label: "Moved to third line (fixture report)", effectiveAt: "2026-10-08T16:00:00.000Z", knownAt: "2026-10-08T18:00:00.000Z", source: "fixture" }];
    });
    const record = run("f5", { evidence });
    expect(record.opportunity!.direction).toBe("unclassified");
    expect(record.opportunity!.roleChanges).toHaveLength(1);
    expect(record.opportunity!.label).toMatch(/Moved to third line/);
    expect(record.explanations.map(item => item.id)).not.toContain("conversion-not-role");
  });
});

describe("D3: signed gap with units and three separate comparisons (decisions 130, 131)", () => {
  it("states the forecast-minus-recent gap in units, without Rebound/Cooling or watch words", () => {
    const record = run("f5");
    const points = metric(record, "POINTS");
    expect(points.gapSign).toBe("negative");
    const text = record.explanations.map(item => item.text).join(" ");
    expect(text).not.toMatch(/rebound|cooling|watch/i);
    expect(record.explanations.find(item => item.id === "points-gap")!.text).toMatch(/Forecast minus recent: -0\.\d\d points per team game/);
  });

  it("keeps forecast vs recent, recent vs personal reference and observed vs same-window support separate", () => {
    const points = metric(run("f5"), "POINTS");
    expect(points.comparisons.forecastVsRecent).toMatchObject({ value: points.gapPerTeamGame.value, unit: "count_per_team_game",
      minuend: "forge_expected_per_scheduled_team_game", subtrahend: "recent_observed_per_team_game" });
    expect(points.comparisons.recentVsPersonalReference).toMatchObject({ value: points.personalReference.changePerTeamGame.value,
      minuend: "recent_observed_per_team_game", subtrahend: "preceding_disjoint_block_per_team_game" });
    expect(points.comparisons.observedVsSameWindowSupport).toMatchObject({ value: null, reason: "same_window_support_expectation_not_supplied" });
    // Recent above its prior block and forecast below recent are different questions; neither is folded into the other.
    expect(points.comparisons.recentVsPersonalReference.value!).toBeGreaterThan(0);
    expect(points.comparisons.forecastVsRecent.value!).toBeLessThan(0);
  });
});

describe("D7: IPP exposure and a versioned pre-window reference", () => {
  it("carries on-ice-goal exposure, the reference version and the player's own prior-block IPP", () => {
    const record = run("f7");
    const recent = fixture("f7").evidence.teamGames.slice(-10);
    expect(record.ipp.exposure).toEqual({ appearances: 10,
      points: recent.reduce((sum, game) => sum + game.stats.POINTS!, 0), onIceGoalsFor: recent.reduce((sum, game) => sum + game.onIceGoalsFor!, 0) });
    expect(record.ipp.referenceMeta).toMatchObject({ version: FIXTURE_CONFIG.ippReferences.F!.version, status: "fixture_illustrative" });
    expect(record.ipp.personalReference.value).toBeCloseTo(0, 12);
  });

  it("withholds a class reference that is not from before the window", () => {
    const config = { ...FIXTURE_CONFIG, ippReferences: { ...FIXTURE_CONFIG.ippReferences, F: { ...FIXTURE_CONFIG.ippReferences.F!, cutoffAt: "2026-10-10T00:00:00.000Z" } } };
    expect(run("f7", { config }).ipp.reference).toEqual({ value: null, reason: "reference_not_pre_window" });
    const unknown = { ...FIXTURE_CONFIG, ippReferences: { ...FIXTURE_CONFIG.ippReferences, F: { ...FIXTURE_CONFIG.ippReferences.F!, cutoffAt: null } } };
    expect(run("f7", { config: unknown }).ipp.reference).toEqual({ value: null, reason: "reference_cutoff_unknown" });
  });
});
