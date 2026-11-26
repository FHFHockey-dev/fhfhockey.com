import { describe, expect, it } from "vitest";
import { CATEGORIES, Interval, available, instant, unavailable } from "./contracts";
import { predictConditional } from "./model";
import { buildH10Model, buildH10Training, H10RateState } from "./h10Features";
import { GOALIE_CATEGORIES, GoalieRateState, buildGoalieTraining, goalieKernelMeans } from "./h10Goalies";
import { H10_SEASON, syntheticLeague } from "./h10Fixtures";
import {
  GOALIE_BAND_POLICY, H10_INTERVAL_POLICY, IntervalObservation, baselineBands, buildIntervalEdition, chooseBands, calibrate, calibrationAt, calibrationCutoffs, editionGaps, fitH10IntervalCalibration,
  goalieKernelTable, intervalsValid, predictKernel, skaterKernelTable,
} from "./h10Intervals";

describe("H1–H10 predictive intervals", () => {
  const anchor = Date.UTC(2026, 10, 23, 15), asOf = new Date(anchor - 5 * 60000).toISOString();
  const league = syntheticLeague({ anchor, teams: 6, pastDays: 40 });
  const model = buildH10Model(buildH10Training(league.logs, H10_SEASON, asOf, 2000).training, asOf)!;
  const state = H10RateState.from(league.logs, H10_SEASON, asOf);
  const future = league.schedule.filter(g => instant(g.scheduledStartAt!) > instant(asOf)).slice(0, 3);

  it("uses the point forecast's own kernel weights: skater and goalie means are reproduced exactly", () => {
    const t = skaterKernelTable(model);
    for (const game of future) for (const player of league.roster.filter(p => p.position !== "G" && [game.homeTeamId, game.awayTeamId].includes(p.teamId)).slice(0, 5)) {
      const home = player.teamId === game.homeTeamId, opponent = home ? game.awayTeamId : game.homeTeamId, features = state.features(player.playerId, opponent, home);
      const reference = predictConditional(model, { playerId: player.playerId, gameId: game.gameId, seasonId: H10_SEASON, targetVersion: model.training[0].targetVersion,
        conditioning: model.training[0].conditioning, inputCutoffAt: asOf, features, sources: [model.training[0].sources[0]], limitations: [] });
      const mine = predictKernel(t, { features, gameId: game.gameId, cutoff: asOf });
      for (const c of CATEGORIES) expect(mine.means[c]).toEqual(reference.means[c]);
    }
    const goalieTraining = buildGoalieTraining(league.logs, league.goalieLogs, H10_SEASON, asOf, 2000).training, gt = goalieKernelTable(goalieTraining);
    const gstate = GoalieRateState.from(league.logs, league.goalieLogs, H10_SEASON, asOf), goalie = league.roster.find(p => p.position === "G")!;
    const game = future.find(g => [g.homeTeamId, g.awayTeamId].includes(goalie.teamId)) ?? future[0], home = goalie.teamId === game.homeTeamId;
    const features = gstate.features(goalie.playerId, goalie.teamId, home ? game.awayTeamId : game.homeTeamId, home);
    const reference = goalieKernelMeans(goalieTraining, features, game.gameId, asOf), mine = predictKernel(gt, { features, gameId: game.gameId, cutoff: asOf });
    for (const c of GOALIE_CATEGORIES) expect(mine.means[c]).toEqual(reference.means[c]);
  });

  it("gives target-specific, ordered and nested 50%/90% bands inside each target's support", () => {
    const t = skaterKernelTable(model), game = future[0], player = league.roster.find(p => p.position !== "G" && p.teamId === game.homeTeamId)!;
    const p = predictKernel(t, { features: state.features(player.playerId, game.awayTeamId, true), gameId: game.gameId, cutoff: asOf });
    for (const c of CATEGORIES) {
      expect(p.raw[c].state).toBe("available");
      const bands = (p.raw[c] as { value: Interval[] }).value;
      expect(intervalsValid(bands, c)).toBe(true);
      expect(bands.every(b => Number.isInteger(b.lower) && Number.isInteger(b.upper))).toBe(true);
    }
    expect(intervalsValid([{ level: 0.5, lower: 0, upper: 2 }, { level: 0.9, lower: 1, upper: 3 }], "SOG")).toBe(false); // not nested
    expect(intervalsValid([{ level: 0.5, lower: 0, upper: 1 }, { level: 0.9, lower: 0, upper: 2 }], "WIN")).toBe(false); // outside support
  });

  it("refuses a band on too-thin evidence with an explicit reason, never a guess", () => {
    const thin = buildH10Model(buildH10Training(league.logs, H10_SEASON, asOf, 2000).training.slice(0, 26), asOf)!;
    const t = skaterKernelTable(thin), game = future[0], player = league.roster.find(p => p.position !== "G" && p.teamId === game.homeTeamId)!;
    // An extreme context gives almost all weight to one or two rows: low effective support.
    // An unusual context (a scoring rate past the training range) puts nearly all weight on a few rows.
    const top = Math.max(...thin.training.map(r => (r.features.player_points_rate as { value: number }).value));
    const features = { ...state.features(player.playerId, game.awayTeamId, true), player_points_rate: available(top + 1.5) };
    const p = predictKernel(t, { features, gameId: game.gameId, cutoff: asOf });
    expect(Object.values(p.raw).some(r => r.state === "unavailable" && r.reason === "effective_support_too_thin")).toBe(true);
    expect(Math.min(...Object.values(p.effectiveSupport))).toBeLessThan(H10_INTERVAL_POLICY.minimumEffectiveSupport);
  });

  it("fits calibration only on outcomes received by the issuing cutoff, and padding only widens", () => {
    const at = "2026-11-10T09:00:00.000Z", raw: Interval[] = [{ level: 0.5, lower: 1, upper: 2 }, { level: 0.9, lower: 0, upper: 3 }];
    const obs = (i: number, actual: number, received: string): IntervalObservation => ({ cls: "skater", category: "SOG", horizon: 1, cutoff: "2026-11-01T09:00:00.000Z",
      outcomeAvailableAt: received, playerId: i, gameId: 1, actual, mean: 1.5, raw, sparseHistory: false });
    const early = Array.from({ length: 60 }, (_, i) => obs(i, i % 2 ? 1 : 2, "2026-11-05T07:30:00.000Z"));
    const late = Array.from({ length: 60 }, (_, i) => obs(100 + i, 9, "2026-11-11T07:30:00.000Z")); // after the cutoff: must not count
    const fitted = fitH10IntervalCalibration([...early, ...late], at, calibrationCutoffs(at));
    expect(fitted.observations).toBe(60);
    expect(instant(fitted.dependencyAvailableAt!)).toBeLessThanOrEqual(instant(at));
    expect(fitted.cells["skater:SOG:H1"].padding).toEqual([{ level: 0.5, lower: 0, upper: 0 }, { level: 0.9, lower: 0, upper: 0 }]);
    const wide = fitH10IntervalCalibration(Array.from({ length: 60 }, (_, i) => obs(i, i < 30 ? 2 : 5, "2026-11-05T07:30:00.000Z")), at, []);
    const band = calibrate(available(raw), wide, "skater", "SOG", 1);
    expect(band.state).toBe("available");
    const value = (band as { value: Interval[] }).value;
    expect(value[0].upper).toBeGreaterThan(2); expect(value[1].upper).toBeGreaterThan(3); expect(value[1].lower).toBe(0);
    expect(calibrate(available(raw), wide, "skater", "SOG", 7)).toEqual(unavailable("calibration_support_too_thin"));
    expect(calibrate(available([{ level: 0.5, lower: 0, upper: 1 }, { level: 0.9, lower: 0, upper: 1 }]), { ...wide, cells: { "goalie:WIN:H1": { n: 50, padding: [{ level: 0.5, lower: 0, upper: 3 }, { level: 0.9, lower: 0, upper: 3 }] } } }, "goalie", "WIN", 1))
      .toEqual(available([{ level: 0.5, lower: 0, upper: 1 }, { level: 0.9, lower: 0, upper: 1 }])); // clamped to {0, 1}
  });

  it("replays the recipe at earlier cutoffs for the nightly calibration, with no outcome after the cutoff", () => {
    const calibration = calibrationAt({ logs: league.logs, goalieLogs: league.goalieLogs, schedule: league.schedule, seasonId: H10_SEASON, asOf, maximumTrainingExamples: 2000 });
    expect(calibration.cutoffs).toHaveLength(H10_INTERVAL_POLICY.calibrationCutoffs);
    expect(calibration.observations).toBeGreaterThan(0);
    expect(instant(calibration.dependencyAvailableAt!)).toBeLessThanOrEqual(instant(asOf));
    expect(Object.values(calibration.cells).some(c => c.padding)).toBe(true);
    expect(calibration.version).toMatch(/^[a-f0-9]{64}$/);
  }, 60000);

  it("applies TJ's goalie band policy and records the method behind every band", () => {
    const candidate = available([{ level: 0.5 as const, lower: 22, upper: 30 }, { level: 0.9 as const, lower: 15, upper: 36 }]), mean = available(26);
    // Goalie 50% is always the baseline; 90% too outside the selected H1–H7 cells.
    const base = (baselineBands("SAVES", 26) as { value: Interval[] }).value;
    expect(chooseBands("goalie", "SAVES", 3, candidate, mean, { candidate90: ["SAVES:H2"] })).toEqual({ intervals: available(base), methods: { "0.5": "poisson_baseline", "0.9": "poisson_baseline" } });
    expect(chooseBands("goalie", "SAVES", 2, candidate, mean, { candidate90: ["SAVES:H2"] }))
      .toEqual({ intervals: available([base[0], { level: 0.9, lower: 15, upper: 36 }]), methods: { "0.5": "poisson_baseline", "0.9": "kernel_calibrated" } });
    // H8–H10 never use the candidate, even if listed.
    expect(chooseBands("goalie", "SAVES", 9, candidate, mean, { candidate90: ["SAVES:H9"] }).methods["0.9"]).toBe("poisson_baseline");
    // A selected candidate that does not contain the 50% band gives way to the baseline at both levels.
    const narrow = available([{ level: 0.5 as const, lower: 25, upper: 27 }, { level: 0.9 as const, lower: 25, upper: 28 }]);
    expect(chooseBands("goalie", "SAVES", 2, narrow, mean, { candidate90: ["SAVES:H2"] }).methods).toEqual({ "0.5": "poisson_baseline", "0.9": "poisson_baseline" });
    expect(chooseBands("goalie", "WIN", 1, candidate, available(0.55)).methods).toEqual({ "0.5": "bernoulli_baseline", "0.9": "bernoulli_baseline" });
    expect(chooseBands("goalie", "SAVES", 1, candidate, unavailable("sparse_goalie_start_history")).intervals).toEqual(unavailable("no_valid_band:point_sparse_goalie_start_history"));
    expect(chooseBands("skater", "SOG", 9, candidate, mean).methods).toEqual({ "0.5": "kernel_calibrated", "0.9": "kernel_calibrated" });
    expect(GOALIE_BAND_POLICY.candidate90.every(cell => /^[A-Z_]+:H[1-7]$/.test(cell))).toBe(true);
    expect(intervalsValid(base, "SAVES")).toBe(true);
  });

  it("builds a conditional, non-summable edition that refuses on any mismatch with the stored point forecast", () => {
    const t = skaterKernelTable(model), game = future[0], player = league.roster.find(p => p.position !== "G" && p.teamId === game.homeTeamId)!;
    const prediction = predictKernel(t, { features: state.features(player.playerId, game.awayTeamId, true), gameId: game.gameId, cutoff: asOf });
    const calibration = calibrationAt({ logs: league.logs, goalieLogs: league.goalieLogs, schedule: league.schedule, seasonId: H10_SEASON, asOf, maximumTrainingExamples: 2000 });
    const vintage = { id: "vintage:x", outputHash: "h", playerId: player.playerId, gameId: game.gameId, teamId: player.teamId, horizon: 1, targetVersion: "nhl-official-skater-appearance-v1",
      conditioning: "official_appearance_given_game_occurs", inputCutoffAt: asOf, modelVersion: model.version, featureVersion: "f", means: prediction.means };
    const edition = buildIntervalEdition({ cls: "skater", vintage, prediction, modelVersion: model.version, calibration: { id: "cal:1", value: calibration }, generatedAt: asOf });
    expect(edition).toMatchObject({ conditionalOn: "official_appearance", combination: "marginal_per_category_not_summable", calibration: { id: "cal:1", version: calibration.version } });
    expect(edition.limitations).toContain("participation_not_modelled");
    for (const [c, cell] of Object.entries(edition.categories)) {
      expect(cell.point).toEqual(prediction.means[c]);
      if (cell.intervals.state === "available") expect(intervalsValid(cell.intervals.value, c)).toBe(true);
    }
    const shifted = buildIntervalEdition({ cls: "skater", vintage: { ...vintage, means: { ...vintage.means, SOG: available(99) } }, prediction, modelVersion: model.version, calibration: { id: "cal:1", value: calibration }, generatedAt: asOf });
    expect(shifted.categories.SOG.intervals).toEqual(unavailable("point_forecast_mismatch"));
    const other = buildIntervalEdition({ cls: "skater", vintage, prediction, modelVersion: "another-model", calibration: { id: "cal:1", value: calibration }, generatedAt: asOf });
    expect(editionGaps(other).every(g => g.reason === "model_version_mismatch")).toBe(true);
    const late = buildIntervalEdition({ cls: "skater", vintage, prediction, modelVersion: model.version, calibration: { id: "cal:2", value: { ...calibration, availableAt: new Date(anchor).toISOString() } }, generatedAt: asOf });
    expect(editionGaps(late).every(g => g.reason === "calibration_not_available_at_cutoff")).toBe(true);
  }, 60000);
});
