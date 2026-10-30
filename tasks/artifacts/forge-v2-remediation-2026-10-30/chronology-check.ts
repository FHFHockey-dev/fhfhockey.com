/** Executable synthetic staging receipt. No sources, labels, or authorization are real. */
import assert from "node:assert/strict";
import { CATEGORIES, CategoryMeans, available } from "../../../web/lib/forge-v2/contracts";
import { FIXTURE_TARGET, fixtureSource, fixtureVintage } from "../../../web/lib/forge-v2/fixtures";
import { CandidateModel, FitProtocol, ModelExample, fitCandidate, predictConditional } from "../../../web/lib/forge-v2/model";
import { CalibrationObservation, CalibrationProtocol, INTERVAL_CALCULATION, JOINT_DECODER, JOINT_SCHEMA, evaluatePinnedIntervals, fitIntervalCalibration, predictJoint, scoreJoint } from "../../../web/lib/forge-v2/uncertainty";
import { DEFAULT_SCORING } from "../../../web/lib/forge-v2/identity";
import { contentHash } from "../../../web/lib/forge-v2/hash.server";

const iso = (day: number) => new Date(Date.UTC(2030, 0, day, 12)).toISOString();
function example(index: number, startDay: number): ModelExample {
  return { ...FIXTURE_TARGET, id: `synthetic-train-${index}`, gameId: 2099001000 + index, inputCutoffAt: iso(startDay - 1), gameStartAt: iso(startDay), outcomeAvailableAt: iso(startDay + 1), appearance: "official_appearance", features: { opponent: available(1) }, values: Object.fromEntries(CATEGORIES.map(c => [c, available(c === "PPP" ? 0 : index % 2)])) as CategoryMeans, sources: [fixtureSource()], outcomeSource: fixtureSource() };
}
const rows = [...Array.from({ length: 5 }, (_, i) => example(i, i + 3)), example(6, 14)];
const protocol: FitProtocol = { id: "staged-fixture-only", registeredAt: iso(1), independentlyReviewed: true, admissibleIds: rows.map(row => row.id), admissibleHashes: Object.fromEntries(rows.map(row => [row.id, contentHash(row)])), trainEndAt: iso(10), developmentEndAt: iso(18), calibrationEndAt: iso(19), fitAt: iso(20), availableAt: iso(21), recipes: [{ id: "fixed-synthetic", featureNames: ["opponent"], bandwidth: 1, minimumSupport: 1 }] };
const fitted = fitCandidate(rows, protocol);
assert.equal(fitted.state, "available");
const model: CandidateModel = (fitted as Extract<typeof fitted, { state: "available" }>).value.model;
assert.equal(predictConditional(model, { ...rows.at(-1)!, limitations: [] }).means.G.state, "unavailable");
// The mean fitter's legacy calibration bucket is empty. It is NOT the interval window.
// These distinct later observations are generated only after actual model availability.
const calibrationRows: CalibrationObservation[] = Array.from({ length: 32 }, (_, i) => {
  const cutoff = iso(25 + i), context = { ...FIXTURE_TARGET, gameId: 2099002000 + i, inputCutoffAt: cutoff, features: { opponent: available(1) }, sources: [fixtureSource()], limitations: ["synthetic_only"] };
  const joint = predictJoint(model, context, [...CATEGORIES]); assert.equal(joint.state, "available");
  const scored = scoreJoint((joint as Extract<typeof joint, { state: "available" }>).value, DEFAULT_SCORING); assert.equal(scored.state, "available");
  return { id: `synthetic-calibration-${i}`, target: context, partition: "calibration", gameStartAt: iso(26 + i), inputCutoffAt: cutoff, outcomeAvailableAt: iso(27 + i), intervals: (scored as Extract<typeof scored, { state: "available" }>).value.intervals, actual: i % 2, modelVersion: model.version, profileId: DEFAULT_SCORING.id, horizon: 10, cohort: "fixture-skater" };
});
const calibrationProtocol: CalibrationProtocol = { id: protocol.id, registeredAt: iso(1), independentlyReviewed: true, admissibleIds: calibrationRows.map(row => row.id), admissibleHashes: Object.fromEntries(calibrationRows.map(row => [row.id, contentHash(row)])), startAt: iso(25), endAt: iso(60), fittedAt: iso(61), availableAt: iso(62), minimumSupport: 32 };
const calibration = fitIntervalCalibration(calibrationRows, calibrationProtocol, { modelVersion: model.version, profileId: DEFAULT_SCORING.id, horizon: 10, cohort: "fixture-skater" }); assert.equal(calibration.state, "available");
const payload = (calibration as Extract<typeof calibration, { state: "available" }>).value;
function replay(day: number) {
  const context = { ...FIXTURE_TARGET, inputCutoffAt: iso(day), features: { opponent: available(1) }, sources: [fixtureSource()], limitations: ["synthetic_only"] };
  const prediction = predictJoint(model, context, [...CATEGORIES]); assert.equal(prediction.state, "available");
  const joint = (prediction as Extract<typeof prediction, { state: "available" }>).value;
  const common = { version: "synthetic-v1", decoderVersion: JOINT_DECODER, calculationVersion: INTERVAL_CALCULATION, targetVersion: FIXTURE_TARGET.targetVersion, conditioning: FIXTURE_TARGET.conditioning, categories: [...CATEGORIES], horizons: [10 as const], cohorts: ["fixture-skater"], profileIds: [DEFAULT_SCORING.id] };
  const distributionRef = { ...common, id: `synthetic-joint-${day}`, sha256: contentHash(joint), kind: "joint_distribution" as const, schemaVersion: JOINT_SCHEMA };
  const calibrationRef = { ...common, id: "synthetic-calibrator", sha256: contentHash(payload), kind: "calibration" as const, schemaVersion: payload.schemaVersion };
  const vintage = fixtureVintage({ modelVersion: model.version, means: predictConditional(model, context).means, cohort: "fixture-skater", inputCutoffAt: iso(day), generatedAt: iso(day), sourceGameDate: iso(day + 1).slice(0, 10), scheduledStartAt: iso(day + 1), distribution: available(distributionRef), calibration: available(calibrationRef), qualificationId: null });
  return evaluatePinnedIntervals(vintage, DEFAULT_SCORING, { reference: distributionRef, payload: joint }, { reference: calibrationRef, payload }, protocol.id);
}
const reproduced = replay(63);
assert.equal(reproduced.state, "available", JSON.stringify(reproduced));
assert.deepEqual(replay(60), { state: "unavailable", reason: "calibration_not_available_at_cutoff" });
assert.ok(calibrationRows.every(row => Date.parse(row.inputCutoffAt) > Date.parse(model.availableAt)));
console.log(JSON.stringify({ status: "SYNTHETIC_CHRONOLOGY_PASSED", codeCandidate: "7113329d2c24b8629f54484df37441f95a63d853", meanFittedAt: model.fittedAt, meanAvailableAt: model.availableAt, intervalCalibrationStartAt: calibrationProtocol.startAt, intervalCalibrationEndAt: calibrationProtocol.endAt, calibratorAvailableAt: payload.availableAt, calibrationRows: calibrationRows.length, pastSelectedModelRefused: true, preCalibratorCutoffRefused: true, postAvailabilityIntervalsReproduced: true, scientificallyQualified: false, originalIssuedEvidence: false, protectedLabelsOpened: false }, null, 2));
