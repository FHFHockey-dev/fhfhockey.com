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


describe("outside audit: calibrated custom scoring", () => {
  it("can reproduce two qualified profiles from one unchanged issued vintage", () => {
    const s = pinnedScenario(), custom = scoringProfile({...DEFAULT_SCORING.weights, G:-3});
    s.manifest.profileIds.push(custom.id);
    s.distribution.reference.profileIds.push(custom.id);
    s.calibration.reference.profileIds.push(custom.id);
    const customPayload = {...s.calibration.payload,profileId:custom.id};
    const customCalibration = {payload:customPayload,reference:{...s.calibration.reference,id:"custom-calibration",sha256:contentHash(customPayload)}};
    s.manifest.artifactHashes.push(customCalibration.reference.sha256);
    for(const e of s.evidence){e.payload.scopeHash=qualificationScopeHash(s.manifest); e.payload.artifactHashes=s.manifest.artifactHashes; e.sha256=contentHash(e.payload);}
    const before=contentHash(s.vintage);
    expect(reproduceIntervals(s.vintage,DEFAULT_SCORING,s.manifest,s.evidence,s.distribution,s.calibration).state).toBe("available");
    const originalPin = reproduceIntervals(s.vintage,custom,s.manifest,s.evidence,s.distribution,s.calibration);
    const customPin = reproduceIntervals(s.vintage,custom,s.manifest,s.evidence,s.distribution,customCalibration);
    expect(contentHash(s.vintage)).toBe(before);
    expect({originalPin,customPin}, "Neither the original multi-profile pin nor separately pinned approved custom calibration can reproduce the custom profile").toMatchObject({customPin:{state:"available"}});
  });
});
