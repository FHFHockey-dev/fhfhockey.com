import { describe, expect, it } from "vitest";
import { ArtifactReference, CATEGORIES, CategoryMeans, QualificationManifest, available, unavailable } from "./contracts";
import { FIXTURE_TARGET, fixtureVintage } from "./fixtures";
import { DEFAULT_SCORING, scoringProfile } from "./identity";
import { contentHash } from "./hash.server";
import { QualificationEvidence, qualificationScopeHash } from "./qualification";
import { CalibrationArtifact, CalibrationObservation, INTERVAL_CALCULATION, JOINT_ALGORITHM, JOINT_DECODER, JOINT_SCHEMA, JointDistribution, fitIntervalCalibration, reproduceIntervals, scoreJoint, validateJoint } from "./uncertainty";

function joint(): JointDistribution {
  return { ...FIXTURE_TARGET, schemaVersion: JOINT_SCHEMA, inputCutoffAt: "2026-01-01T12:00:00.000Z", modelVersion: "fixture-model-v1", modelArtifactHash: "c".repeat(64), algorithmVersion: JOINT_ALGORITHM, categories: [...CATEGORIES], outcomes: [
    { probability: 0.5, values: { G: 1, A: 0, PPP: 1, SOG: 3, HIT: 1, BLK: 0, PIM: 0 } },
    { probability: 0.5, values: { G: 0, A: 1, PPP: 1, SOG: 0, HIT: 0, BLK: 1, PIM: 2 } },
  ] };
}
// All evidence below is fabricated trusted-reader input for gate tests, never acceptance evidence.
function pinnedScenario(calibrationAvailableAt = "2025-11-01T00:00:01.000Z") {
  const payload = joint();
  const calibrated: CalibrationArtifact = { schemaVersion: "profile-tail-padding-v1", calculationVersion: INTERVAL_CALCULATION, modelVersion: payload.modelVersion, profileId: DEFAULT_SCORING.id, horizon: 10, cohort: "synthetic-skater", fittedAt: "2025-11-01T00:00:00.000Z", availableAt: calibrationAvailableAt, dependencyAvailableAt: "2025-10-31T00:00:00.000Z", protocolId: "protocol", sampleIds: ["retained-sample"], evidence: "development_only", padding: [{ level: 0.5, lower: 0, upper: 0 }, { level: 0.9, lower: 1, upper: 1 }] };
  const pin = (kind: ArtifactReference["kind"], body: JointDistribution | CalibrationArtifact): ArtifactReference => ({ id: kind, version: "v1", sha256: contentHash(body), kind, schemaVersion: body.schemaVersion, decoderVersion: JOINT_DECODER, calculationVersion: INTERVAL_CALCULATION, categories: [...CATEGORIES], horizons: [10], cohorts: ["synthetic-skater"], profileIds: [DEFAULT_SCORING.id], targetVersion: FIXTURE_TARGET.targetVersion, conditioning: FIXTURE_TARGET.conditioning });
  const distribution = { reference: pin("joint_distribution", payload), payload };
  const calibration = { reference: pin("calibration", calibrated), payload: calibrated };
  const vintage = fixtureVintage({ qualificationId: "q", evidenceClass: "public_serving", means: Object.fromEntries(CATEGORIES.map(c => [c, available(payload.outcomes.reduce((sum, r) => sum + r.values[c]! * r.probability, 0))])) as CategoryMeans, distribution: available(distribution.reference), calibration: available(calibration.reference) });
  const manifest: QualificationManifest = { id: "q", version: "v1", createdAt: "2025-12-31T00:00:00.000Z", targetVersion: vintage.targetVersion, conditioning: vintage.conditioning, modelVersion: vintage.modelVersion, featureVersion: vintage.featureVersion, codeVersion: vintage.codeVersion, horizons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], cohorts: [vintage.cohort], categories: [...CATEGORIES], profileIds: [DEFAULT_SCORING.id], participationModelVersion: vintage.participation.modelVersion, participationQualified: true, intervalLevels: [0.5, 0.9], artifactHashes: [payload.modelArtifactHash, calibration.reference.sha256], jointGenerator: { modelArtifactHash: payload.modelArtifactHash, algorithmVersion: JOINT_ALGORITHM, schemaVersion: JOINT_SCHEMA, decoderVersion: JOINT_DECODER, calculationVersion: INTERVAL_CALCULATION }, finalEvaluationId: "final", prospectiveEvaluationId: "shadow", independentReviewId: "review", status: "qualified", evidenceClass: "public_serving" };
  const kinds = ["frozen_protocol", "independent_final", "prospective_shadow", "independent_review"] as const;
  const classes = ["protocol", "final", "prospective", "review"] as const;
  const evidence: QualificationEvidence[] = ["protocol", "final", "shadow", "review"].map((id, i) => {
    const body: QualificationEvidence["payload"] = { scopeHash: qualificationScopeHash(manifest), protocolId: "protocol", issuedAt: `2025-12-${10 + i}T00:00:00.000Z`, authorId: "author", reviewerId: "reviewer", independent: true, approved: true, passed: true, evidenceClass: classes[i], untouched: true, artifactHashes: manifest.artifactHashes, numericalThresholdsHash: "a".repeat(64), sampleManifestHash: String(i).repeat(64) };
    return { id, kind: kinds[i], sha256: contentHash(body), payload: body };
  });
  return { vintage, manifest, evidence, distribution, calibration };
}

describe("joint count transformations", () => {
  it("uses the joint distribution rather than adding marginal intervals", () => {
    const profile = scoringProfile({ G: 1, A: 1, PPP: 0, SOG: 0, HIT: 0, BLK: 0, PIM: 0 });
    expect(scoreJoint(joint(), profile)).toEqual(available({ mean: 1, intervals: [{ level: 0.5, lower: 1, upper: 1 }, { level: 0.9, lower: 1, upper: 1 }] }));
    const signed = scoringProfile({ ...profile.weights, G: -2 });
    expect(scoreJoint(joint(), signed)).toEqual(available({ mean: -0.5, intervals: [{ level: 0.5, lower: -2, upper: 1 }, { level: 0.9, lower: -2, upper: 1 }] }));
  });
  it("ignores absent zero-weight categories and blocks nonzero weights", () => {
    const missing = joint(); missing.categories = missing.categories.filter(c => c !== "PIM"); missing.outcomes.forEach(o => delete o.values.PIM);
    expect(scoreJoint(missing, DEFAULT_SCORING).state).toBe("available");
    expect(scoreJoint(missing, scoringProfile({ ...DEFAULT_SCORING.weights, PIM: -0.5 })).state).toBe("unavailable");
  });
  it("rejects logically impossible counts and invalid probability mass", () => {
    const impossible = joint(); impossible.outcomes[0].values.PPP = 2;
    expect(() => validateJoint(impossible)).toThrow(/PPP/);
    const invalid = joint(); invalid.outcomes[0].probability = 0.8;
    expect(scoreJoint(invalid, DEFAULT_SCORING).state).toBe("unavailable");
    invalid.outcomes[0].probability = NaN;
    expect(scoreJoint(invalid, DEFAULT_SCORING).state).toBe("unavailable");
  });
});

describe("pinned interval calibration and qualification", () => {
  it("qualifies a second future target without rewriting frozen dependencies or evidence", () => {
    const s = pinnedScenario();
    const frozen = contentHash({ manifest: s.manifest, evidence: s.evidence });
    const nextPayload: JointDistribution = { ...s.distribution.payload, playerId: s.vintage.playerId + 1, gameId: s.vintage.gameId + 1, inputCutoffAt: "2026-01-02T12:00:00.000Z", outcomes: structuredClone(s.distribution.payload.outcomes) };
    const nextReference = { ...s.distribution.reference, id: "second-future-joint", sha256: contentHash(nextPayload) };
    const nextVintage = { ...s.vintage, id: "second-future-vintage", playerId: nextPayload.playerId, gameId: nextPayload.gameId, inputCutoffAt: nextPayload.inputCutoffAt, generatedAt: "2026-01-02T12:00:01.000Z", distribution: available(nextReference) };
    const nextJoint = { reference: nextReference, payload: nextPayload };
    expect(s.manifest.artifactHashes).not.toContain(nextReference.sha256);
    expect(reproduceIntervals(s.vintage, DEFAULT_SCORING, s.manifest, s.evidence, s.distribution, s.calibration).state).toBe("available");
    expect(reproduceIntervals(nextVintage, DEFAULT_SCORING, s.manifest, s.evidence, nextJoint, s.calibration).state).toBe("available");
    expect(contentHash({ manifest: s.manifest, evidence: s.evidence })).toBe(frozen);
    nextPayload.outcomes[0].values.SOG = 9;
    expect(reproduceIntervals(nextVintage, DEFAULT_SCORING, s.manifest, s.evidence, nextJoint, s.calibration)).toEqual(unavailable("artifact_integrity_or_applicability_mismatch"));
    nextReference.sha256 = contentHash(nextPayload);
    expect(reproduceIntervals(nextVintage, DEFAULT_SCORING, s.manifest, s.evidence, nextJoint, s.calibration)).toEqual(unavailable("joint_mean_mismatch"));
  });
  it("rejects repinned outputs from another generator or cutoff", () => {
    for (const property of ["modelArtifactHash", "inputCutoffAt"] as const) {
      const s = pinnedScenario();
      s.distribution.payload[property] = property === "modelArtifactHash" ? "d".repeat(64) : "2026-01-02T12:00:00.000Z";
      s.distribution.reference.sha256 = contentHash(s.distribution.payload);
      expect(reproduceIntervals(s.vintage, DEFAULT_SCORING, s.manifest, s.evidence, s.distribution, s.calibration)).toEqual(unavailable(property === "modelArtifactHash" ? "joint_generator_mismatch" : "joint_target_or_model_mismatch"));
    }
  });
  it("refuses a fitted calibration artifact first available after the issuance cutoff", () => {
    const s = pinnedScenario("2026-01-02T00:00:00.000Z");
    expect(reproduceIntervals(s.vintage, DEFAULT_SCORING, s.manifest, s.evidence, s.distribution, s.calibration)).toEqual(unavailable("calibration_not_available_at_cutoff"));
  });
  it("reproduces both levels from pinned dependencies and refuses altered or missing artifacts", () => {
    const s = pinnedScenario();
    const reproduce = () => reproduceIntervals(s.vintage, DEFAULT_SCORING, s.manifest, s.evidence, s.distribution, s.calibration);
    expect(reproduce().state).toBe("available");
    expect(reproduceIntervals(s.vintage, DEFAULT_SCORING, s.manifest, s.evidence, null, s.calibration)).toEqual(unavailable("required_artifact_unavailable"));
    s.distribution.payload.outcomes[0].values.SOG = 9;
    expect(reproduce()).toEqual(unavailable("artifact_integrity_or_applicability_mismatch"));
  });
  it("blocks decoder, applicability, evidence, target and cutoff substitutions", () => {
    for (const modify of [
      (s: ReturnType<typeof pinnedScenario>) => { s.distribution.reference.decoderVersion = "new-decoder"; },
      (s: ReturnType<typeof pinnedScenario>) => { s.calibration.reference.cohorts = ["other"]; },
      (s: ReturnType<typeof pinnedScenario>) => { s.vintage.evidenceClass = "fixture"; },
      (s: ReturnType<typeof pinnedScenario>) => { s.distribution.payload.gameId++; },
      (s: ReturnType<typeof pinnedScenario>) => { s.calibration.payload.fittedAt = "2026-02-01T00:00:00.000Z"; },
    ]) { const s = pinnedScenario(); modify(s); expect(reproduceIntervals(s.vintage, DEFAULT_SCORING, s.manifest, s.evidence, s.distribution, s.calibration).state).toBe("unavailable"); }
  });
  it("requires calibration support and keeps fitted artifacts development-only", () => {
    const applicability = { modelVersion: "m1", profileId: DEFAULT_SCORING.id, horizon: 10, cohort: "F" };
    const rows: CalibrationObservation[] = Array.from({ length: 20 }, (_, i) => ({ ...applicability, id: `c-${i}`, target: { ...FIXTURE_TARGET, gameId: FIXTURE_TARGET.gameId + i }, partition: "calibration", inputCutoffAt: "2025-10-01T00:00:00.000Z", gameStartAt: "2025-10-01T12:00:00.000Z", outcomeAvailableAt: "2025-10-02T00:00:00.000Z", intervals: [{ level: 0.5, lower: 0, upper: 1 }, { level: 0.9, lower: 0, upper: 2 }], actual: i % 3 }));
    const protocol = { id: "registered", registeredAt: "2025-09-01T00:00:00.000Z", independentlyReviewed: true, admissibleIds: rows.map(r => r.id), admissibleHashes: Object.fromEntries(rows.map(r => [r.id, contentHash(r)])), startAt: "2025-10-01T00:00:00.000Z", endAt: "2025-10-31T00:00:00.000Z", fittedAt: "2025-11-01T00:00:00.000Z", availableAt: "2025-11-02T00:00:00.000Z", minimumSupport: 20 };
    const fitted = fitIntervalCalibration(rows, protocol, applicability);
    expect(fitted.state).toBe("available");
    if (fitted.state === "available") expect(fitted.value.evidence).toBe("development_only");
    expect(fitIntervalCalibration(rows.slice(0, 1), protocol, applicability).state).toBe("unavailable");
    expect(() => fitIntervalCalibration(rows, { ...protocol, independentlyReviewed: false }, applicability)).toThrow();
  });
});
