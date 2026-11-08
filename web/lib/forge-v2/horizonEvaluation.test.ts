import { describe, expect, it } from "vitest";
import { evaluateHorizon, evaluateRollingOrigins, horizonCacheKey, horizonComparisonKey, participationMixtureMoments,
  pairedCalendarBlocks, scoreDistribution, trainingWindowMature, validateCalendarGame, validateFrozenForecast } from "./horizonEvaluation";
import { fixtureTime, freezeFixture, goalieGame, horizonFixture, horizonSource, skaterGame } from "./horizonEvaluation.fixtures";
import { runHorizonEvaluation } from "../../scripts/forge-horizon-evaluate";

describe("frozen cumulative 1/10/20 evaluation (synthetic correctness only)", () => {
  it("preserves all-or-none availability across nested horizons instead of daily redrawing", () => {
    const input = horizonFixture(), result = evaluateRollingOrigins([input], fixtureTime(30));
    for (const [index, horizon] of [1, 10, 20].entries()) {
      const row = result[0].horizons[index].candidate;
      expect(row.state).toBe("evaluated");
      if (row.state !== "evaluated") throw new Error("fixture failed");
      expect(row.scores.GP?.mean).toBe(horizon / 2);
      expect(row.scores.GP?.variance).toBe(horizon ** 2 / 4);
      expect(row.participation).toMatchObject({ probability: 0.5, brier: 0.25 });
      expect(row.scores.GP?.intervals[0]).toMatchObject({ lower: 0, upper: horizon });
      expect(row.scores.SOG?.mean).toBe(horizon);
    }
    expect(result[0].horizons[1].candidate).not.toMatchObject({ scores: { GP: { variance: 2.5 } } });
  });

  it("checks the participation mixture identity without adding a second structural-zero process", () => {
    expect(participationMixtureMoments(0.5, 10, 0)).toEqual({ mean: 5, variance: 25 });
    expect(participationMixtureMoments(0.4, 3, 3)).toEqual({ mean: 1.2000000000000002, variance: 3.3600000000000003 });
    expect(participationMixtureMoments(0, 3, 3)).toEqual({ mean: 0, variance: 0 });
    expect(() => participationMixtureMoments(NaN, 3, 3)).toThrow();
  });

  it("scores final distributions with exact CRPS, infinite log scores, and interval widths", () => {
    const row = scoreDistribution([{ value: 0, probability: 0.5 }, { value: 10, probability: 0.5 }], 10, true);
    expect(row).toMatchObject({ mean: 5, variance: 25, crps: 2.5, squaredError: 25, absoluteError: 5 });
    expect(row.logScore).toBeCloseTo(Math.log(2));
    expect(row.intervals.map(band => band.level)).toEqual([0.5, 0.8, 0.95]);
    expect(scoreDistribution([{ value: 0, probability: 1 }], 1, true)).toMatchObject({ logScore: null, logScoreState: "infinite" });
  });

  it("keeps missing counts distinct from observed zero, including rookie/uncovered inputs", () => {
    const input = horizonFixture();
    input.labels[0].games[0].counts.HIT = null;
    input.candidate.forecast.samples[0].games[0].counts.BLK = null;
    const result = evaluateHorizon(freezeFixture(input.candidate.forecast), input.labels[0], fixtureTime(30));
    if (result.state !== "evaluated") throw new Error("fixture failed");
    expect(result.scores.HIT).toBeNull(); expect(result.scores.BLK).toBeNull();
    expect(result.missingness).toMatchObject({ HIT: "missing_or_undefined_actual", BLK: "missing_forecast_input" });
    expect(result.scores.G?.mean).toBe(0);
    const bad = skaterGame(1); delete bad.counts.PIM;
    expect(() => validateCalendarGame(bad, "skater")).toThrow(/explicit null/);
  });

  it("retains DNPs, trades and more than H player games inside a frozen origin-team calendar", () => {
    const input = horizonFixture(), label = input.labels[1];
    label.games[0].counts = skaterGame(1, false).counts;
    const traded = { ...skaterGame(9), gameId: 2099029999, teamId: 2, startsAt: fixtureTime(9, 19), finalAt: fixtureTime(9, 22), availableAt: fixtureTime(9, 23) };
    label.games.push(traded); label.eligibleGameIds = label.games.map(game => game.gameId);
    let result = evaluateHorizon(input.candidate, label, fixtureTime(30));
    if (result.state !== "evaluated") throw new Error("fixture failed");
    expect(result.actual.GP).toBe(10); // Nine appearances + traded-team extra game.
    label.games[0].counts = skaterGame(1).counts;
    result = evaluateHorizon(input.candidate, label, fixtureTime(30));
    expect(result).toMatchObject({ state: "evaluated", actual: { GP: 11 } });
  });

  it("censors season-ending shortfalls and postponements rather than completing them with zeros", () => {
    const input = horizonFixture();
    input.candidate.forecast.windows[2].originGameIds.pop();
    expect(evaluateHorizon(freezeFixture(input.candidate.forecast), input.labels[2], fixtureTime(30))).toMatchObject({ state: "unavailable", reason: "incomplete_origin_schedule" });
    const postponed = horizonFixture();
    postponed.labels[0].anchors[0].startsAt = fixtureTime(3);
    expect(evaluateHorizon(postponed.candidate, postponed.labels[0], fixtureTime(30))).toMatchObject({ reason: "rescheduled_outside_frozen_window" });
    postponed.labels[0].coverageComplete = false;
    expect(evaluateHorizon(postponed.candidate, postponed.labels[0], fixtureTime(30))).toMatchObject({ reason: "incomplete_outcome_coverage" });
  });

  it("rejects future-data canaries, immature labels and actual-boundary training overlap", () => {
    const input = horizonFixture();
    expect(evaluateHorizon(input.candidate, input.labels[1], fixtureTime(5))).toMatchObject({ reason: "immature_window" });
    input.candidate.forecast.sourceManifest = [horizonSource(fixtureTime(1))];
    expect(() => validateFrozenForecast(freezeFixture(input.candidate.forecast))).toThrow(/cutoff/);
    const future = horizonFixture().candidate.forecast;
    future.modelAvailableAt = fixtureTime(1);
    expect(() => validateFrozenForecast(freezeFixture(future))).toThrow(/Future/);
    expect(trainingWindowMature({ endAt: fixtureTime(8), availableAt: fixtureTime(9) }, fixtureTime(10))).toBe(true);
    expect(trainingWindowMature({ endAt: fixtureTime(8), availableAt: fixtureTime(11) }, fixtureTime(10))).toBe(false);
    const overlap = horizonFixture().candidate.forecast;
    overlap.trainingWindows = [{ endAt: fixtureTime(5), availableAt: fixtureTime(6) }];
    expect(() => validateFrozenForecast(freezeFixture(overlap))).toThrow(/Immature training/);
  });

  it("does not silently drop unpaired origins, horizons, eligibility or incompatible cache versions", () => {
    const input = horizonFixture(), before = horizonCacheKey(input.candidate);
    const f = structuredClone(input.candidate.forecast);
    f.versions.calibration = "new-calibration";
    expect(horizonCacheKey(freezeFixture(f))).not.toBe(before);
    expect(horizonComparisonKey(f)).toBe(horizonComparisonKey(input.candidate.forecast));
    f.windows[0].endAt = fixtureTime(1, 22);
    expect(horizonComparisonKey(f)).not.toBe(horizonComparisonKey(input.candidate.forecast));
    input.comparators.bad = freezeFixture(f);
    expect(() => evaluateRollingOrigins([input], fixtureTime(30))).toThrow(/Unpaired/);
    delete input.comparators.bad;
    input.labels[0].games = [];
    expect(() => evaluateRollingOrigins([input], fixtureTime(30))).toThrow(/coverage mismatch/);
    const missing = horizonFixture(); missing.labels.pop();
    expect(() => evaluateRollingOrigins([missing], fixtureTime(30))).toThrow(/horizon labels/);
    const corrupt = horizonFixture().candidate; corrupt.forecast.versions.model = "rewritten";
    expect(() => validateFrozenForecast(corrupt)).toThrow(/hash mismatch/);
  });

  it("rejects impossible sample counts and non-nested windows", () => {
    const input = horizonFixture().candidate.forecast;
    input.samples[0].games[0].counts.PIM = 0.5;
    expect(() => validateFrozenForecast(freezeFixture(input))).toThrow(/count/);
    input.samples[0].games[0].counts.PIM = 0;
    input.windows[1].originGameIds.reverse();
    expect(() => validateFrozenForecast(freezeFixture(input))).toThrow(/Non-nested/);
    const ppp = skaterGame(1); ppp.counts.PPP = 1;
    expect(() => validateCalendarGame(ppp, "skater")).toThrow(/PPP/);
  });

  it("bounds paired calendar blocks by the target span and groups contemporaneous players", () => {
    const first = horizonFixture();
    expect(() => pairedCalendarBlocks([first], fixtureTime(30), "synthetic_incumbent", "SOG", 20, 10)).toThrow(/shorter/);
    expect(pairedCalendarBlocks([first], fixtureTime(30), "synthetic_incumbent", "SOG", 20, 30)).toMatchObject({ paired: 1, blocks: 1, interval95: null });
    const second = horizonFixture();
    for (const frozen of [second.candidate, ...Object.values(second.comparators)]) {
      frozen.forecast.playerId++;
      Object.assign(frozen, freezeFixture(frozen.forecast));
    }
    second.labels.forEach(label => { label.playerId++; });
    expect(pairedCalendarBlocks([first, second], fixtureTime(30), "synthetic_incumbent", "SOG", 20, 30)).toMatchObject({ paired: 2, blocks: 1 });
    const shift = (value: unknown): unknown => typeof value === "string" && /^2026-.*Z$/.test(value)
      ? new Date(Date.parse(value) + 40 * 86400000).toISOString()
      : Array.isArray(value) ? value.map(shift) : value && typeof value === "object"
        ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shift(item)])) : value;
    const later = shift(first) as typeof first;
    for (const frozen of [later.candidate, ...Object.values(later.comparators)]) Object.assign(frozen, freezeFixture(frozen.forecast));
    const result = pairedCalendarBlocks([first, second, later], fixtureTime(80), "synthetic_incumbent", "SOG", 20, 30, 100);
    expect(result).toMatchObject({ paired: 3, blocks: 2, improvement: -10, interval95: [-10, -10] });
  });

  it("runs the bounded offline benchmark and rejects unsupported command options", () => {
    const report = runHorizonEvaluation(["--fixture", "true"]);
    expect(report).toMatchObject({ evidenceClass: "fixture", requested: 3, evaluated: 3, unavailable: [], promotion: "none" });
    expect(report.summaries[1]).toMatchObject({ horizon: 10, requested: 1, evaluated: 1,
      metrics: { SOG: { count: 1, missing: 0, mae: 10, rmse: 10, crps: 5 } }, participation: { brier: 0.25 } });
    const paired = runHorizonEvaluation(["--fixture", "true", "--comparator", "synthetic_incumbent", "--category", "SOG", "--horizon", "20", "--block-days", "30"]);
    expect(paired.pairedComparison).toMatchObject({ paired: 1, blocks: 1, interval95: null });
    expect(() => runHorizonEvaluation(["--fixture", "true", "--execute", "true"])).toThrow();
    expect(() => scoreDistribution([{ value: 0, probability: 0.5 }], 0, true)).toThrow();
  });
});

describe("joint goalie accounting", () => {
  it("accepts relief wins, no-decision starts and shared team shutouts without individual SO", () => {
    const relief = goalieGame(1); Object.assign(relief.counts, { GS: 0, RELIEF: 1, SO: 0, MIN: 20 });
    expect(() => validateCalendarGame(relief, "goalie")).not.toThrow();
    const shared = goalieGame(1, { sharedShutout: true }); Object.assign(shared.counts, { W: 0, SO: 0, MIN: 40 });
    expect(() => validateCalendarGame(shared, "goalie")).not.toThrow();
    shared.counts.SO = 1;
    expect(() => validateCalendarGame(shared, "goalie")).toThrow(/shutout/);
    relief.counts.SA = 11;
    expect(() => validateCalendarGame(relief, "goalie")).toThrow(/saves\+GA/);
  });

  it("distinguishes expected realized ratios from ratios of expected counts and reports no exposure", () => {
    const input = horizonFixture(), f = input.candidate.forecast;
    f.kind = "goalie"; f.windows = [f.windows[0]];
    const first = goalieGame(1), second = goalieGame(1), unused = goalieGame(1);
    Object.assign(second.counts, { SV: 40, SA: 50, GA: 10, SO: 0, MIN: 30 });
    Object.keys(unused.counts).forEach(key => { unused.counts[key] = 0; });
    f.samples = [first, second, unused].map(game => ({ probability: 1 / 3, eligibleGameIds: [game.gameId], games: [game] }));
    const label = input.labels[0]; label.games[0] = { ...label.games[0], ...first };
    const result = evaluateHorizon(freezeFixture(f), label, fixtureTime(30));
    if (result.state !== "evaluated") throw new Error("fixture failed");
    expect(result.ratios.SV_PCT.expectedRealized).toBeCloseTo(0.9);
    expect(result.ratios.SV_PCT.ratioOfExpectedCounts).toBeCloseTo(25 / 30);
    expect(result.ratios.SV_PCT.noExposureProbability).toBeCloseTo(1 / 3);
    expect(result.ratios.GAA.expectedRealized).toBeCloseTo(10);
    expect(result.ratios.GAA.ratioOfExpectedCounts).toBeCloseTo(60 * 10 / 90);
    label.games[0] = { ...label.games[0], ...unused };
    const zero = evaluateHorizon(freezeFixture(f), label, fixtureTime(30));
    if (zero.state !== "evaluated") throw new Error("fixture failed");
    expect(zero.actual.SV_PCT).toBeNull(); expect(zero.actual.GAA).toBeNull();
    expect(zero.scores.SV_PCT).toBeNull(); expect(zero.scores.GAA).toBeNull();
    expect(zero.ratios.SV_PCT.noExposureBrier).toBeCloseTo(4 / 9);
  });
});
