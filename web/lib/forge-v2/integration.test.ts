import { describe, expect, it } from "vitest";
import { CATEGORIES, QualificationManifest, available, unavailable } from "./contracts";
import { fixtureVintage } from "./fixtures";
import { contentHash } from "./hash.server";
import { scoringProfile } from "./identity";
import { QualificationEvidence, assessQualification, qualificationScope, qualificationScopeHash, qualifiedParticipation } from "./qualification";
import { availabilityAdjusted } from "./participation";
import { RSO_V2_ADAPTER_ENABLED, disabledRsoAdapter } from "./integration";
import { JOINT_ALGORITHM, JOINT_SCHEMA, JOINT_DECODER, INTERVAL_CALCULATION } from "./uncertainty";
import { createReleaseState, releaseCandidateHash, transitionRelease } from "./operations";

// Fabricated trusted-reader responses exercise validation only; they are never persisted or released.
function scenario() {
  const vintage = fixtureVintage({ evidenceClass: "public_serving", qualificationId: "q", horizon: 3, generatedAt: "2026-01-01T12:00:01.000Z" });
  const manifest: QualificationManifest = { id: "q", version: "v1", createdAt: "2025-12-31T00:00:00.000Z", targetVersion: vintage.targetVersion, conditioning: vintage.conditioning, modelVersion: vintage.modelVersion, featureVersion: vintage.featureVersion, codeVersion: vintage.codeVersion, horizons: [1, 2, 3], cohorts: [vintage.cohort], categories: [...CATEGORIES], profileIds: [vintage.scoring.id], participationModelVersion: vintage.participation.modelVersion, participationQualified: true, intervalLevels: [0.5, 0.9], artifactHashes: ["c".repeat(64)], jointGenerator: { modelArtifactHash: "c".repeat(64), algorithmVersion: JOINT_ALGORITHM, schemaVersion: JOINT_SCHEMA, decoderVersion: JOINT_DECODER, calculationVersion: INTERVAL_CALCULATION }, finalEvaluationId: "final", prospectiveEvaluationId: "shadow", independentReviewId: "review", status: "qualified", evidenceClass: "public_serving" };
  const kinds = ["frozen_protocol", "independent_final", "prospective_shadow", "independent_review"] as const;
  const classes = ["protocol", "final", "prospective", "review"] as const;
  const evidence: QualificationEvidence[] = ["protocol", "final", "shadow", "review"].map((id, i) => {
    const payload: QualificationEvidence["payload"] = { scopeHash: qualificationScopeHash(manifest), protocolId: "protocol", issuedAt: `2025-12-${10 + i}T00:00:00.000Z`, authorId: "author", reviewerId: "independent-reviewer", independent: true, approved: true, passed: true, evidenceClass: classes[i], untouched: true, artifactHashes: manifest.artifactHashes, numericalThresholdsHash: "a".repeat(64), sampleManifestHash: String(i).repeat(64) };
    return { id, kind: kinds[i], sha256: contentHash(payload), payload };
  });
  vintage.participation = { ...vintage.participation, probability: available(0.5), qualificationId: manifest.id, evidenceIds: ["final", "shadow"] };
  return { vintage, manifest, evidence };
}

describe("qualification boundary and disabled RSO adapter", () => {
  it("never promotes fixture, development, missing, withdrawn or unreviewed evidence", () => {
    const { vintage, manifest, evidence } = scenario();
    expect(assessQualification(vintage, manifest, evidence).state).toBe("available");
    expect(assessQualification({ ...vintage, evidenceClass: "fixture" }, manifest, evidence).state).toBe("unavailable");
    expect(assessQualification(vintage, { ...manifest, evidenceClass: "retrospective_reconstruction" }, evidence).state).toBe("unavailable");
    expect(assessQualification(vintage, { ...manifest, status: "withdrawn" }, evidence).state).toBe("unavailable");
    expect(assessQualification(vintage, null, evidence).state).toBe("unavailable");
    expect(assessQualification(vintage, manifest, evidence.slice(1)).state).toBe("unavailable");
    evidence[1].payload.evidenceClass = "development"; evidence[1].sha256 = contentHash(evidence[1].payload);
    expect(assessQualification(vintage, manifest, evidence).state).toBe("unavailable");
  });
  it("binds all dependencies and permits supported means for zero-PIM profiles", () => {
    const { vintage, manifest, evidence } = scenario();
    for (const change of [{ modelVersion: "changed" }, { featureVersion: "changed" }, { codeVersion: "changed" }, { cohort: "other" }, { horizon: 10 as const }]) expect(assessQualification({ ...vintage, ...change }, manifest, evidence).state).toBe("unavailable");
    vintage.means.PIM = unavailable("no_pim");
    expect(assessQualification(vintage, manifest, evidence).state).toBe("available");
    const withPim = scoringProfile({ ...vintage.scoring.weights, PIM: -1 });
    expect(assessQualification(vintage, manifest, evidence, withPim).state).toBe("unavailable");
    manifest.categories.pop();
    expect(assessQualification(vintage, manifest, evidence).state).toBe("unavailable");
  });
  it("distinguishes full v2 and contiguous subsets", () => {
    const { manifest } = scenario();
    expect(qualificationScope(manifest)).toEqual(available("contiguous_subset"));
    expect(qualificationScope({ ...manifest, horizons: [1, 3] }).state).toBe("unavailable");
    expect(qualificationScope({ ...manifest, horizons: [4, 5, 6] }).state).toBe("unavailable");
    expect(qualificationScope({ ...manifest, horizons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })).toEqual(available("full_v2"));
  });
  it("requires default contributing categories, participation and both interval levels even for zero-weight profiles", () => {
    const { vintage, manifest, evidence } = scenario();
    const zero = scoringProfile({ G: 0, A: 0, PPP: 0, SOG: 0, HIT: 0, BLK: 0, PIM: 0 });
    for (const changed of [
      { ...manifest, categories: manifest.categories.filter(c => c !== "SOG") },
      { ...manifest, participationQualified: false },
      { ...manifest, intervalLevels: [0.5 as const] },
      { ...manifest, profileIds: [zero.id] },
    ]) {
      expect(qualificationScope(changed)).toEqual(unavailable("incomplete_default_release_scope"));
      expect(assessQualification(vintage, changed, evidence, zero).state).toBe("unavailable");
    }
  });
  it("adjusts once with matching identity/cutoff and refuses unknown or invalid probabilities", () => {
    const { vintage, manifest, evidence } = scenario();
    const result = availabilityAdjusted(vintage, vintage, manifest, evidence);
    expect(result.state).toBe("available");
    if (result.state === "available") {
      expect(result.value.means.G).toEqual(available(0.2));
      expect(availabilityAdjusted(result.value, vintage, manifest, evidence)).toEqual(unavailable("participation_already_applied"));
    }
    expect(availabilityAdjusted(vintage, { ...vintage, gameId: vintage.gameId + 1 }, manifest, evidence).state).toBe("unavailable");
    expect(availabilityAdjusted(vintage, { ...vintage, inputCutoffAt: "2026-01-01T11:59:00.000Z" }, manifest, evidence).state).toBe("unavailable");
    for (const value of [NaN, -0.1, 1.1]) expect(qualifiedParticipation({ ...vintage, participation: { ...vintage.participation, probability: available(value) } }, manifest, evidence).state).toBe("unavailable");
    expect(qualifiedParticipation({ ...vintage, participation: { ...vintage.participation, probability: unavailable("unknown") } }, manifest, evidence)).toEqual(unavailable("unknown"));
    expect(qualifiedParticipation({ ...vintage, participation: { ...vintage.participation, probability: available(0) } }, manifest, evidence)).toEqual(available(0));
  });
  it("keeps RSO disabled even with structurally qualifying evidence", () => {
    const { vintage, manifest, evidence } = scenario();
    expect(RSO_V2_ADAPTER_ENABLED).toBe(false);
    expect(disabledRsoAdapter(vintage, manifest, evidence)).toEqual(unavailable("rso_v2_adapter_disabled_pending_owner_acceptance"));
    expect(disabledRsoAdapter(fixtureVintage(), null, []).state).toBe("unavailable");
  });
  it("rehearses scoped promotion, disable and restore with fabricated proof and exact approval", () => {
    const { vintage, manifest, evidence } = scenario();
    const scope = { id: "synthetic-only", horizons: manifest.horizons, cohorts: manifest.cohorts, profileId: vintage.scoring.id };
    const body = { manifest, evidence, representatives: manifest.horizons.map(horizon => ({ ...vintage, horizon, id: `synthetic-H${horizon}` })) };
    const candidate = { ...body, hash: releaseCandidateHash(body) };
    const approval = { id: "fabricated-test-approval", candidateHash: candidate.hash, scopeHash: contentHash(scope), environment: "production" as const, approvedAt: "2026-01-01T12:00:01.000Z", expiresAt: "2026-01-02T00:00:00.000Z" };
    const initial = createReleaseState([scope, { ...scope, id: "unrelated" }]);
    const promoted = transitionRelease(initial, { id: "synthetic-promote", scopeId: scope.id, action: "promote", at: "2026-01-01T12:00:02.000Z", reason: "fixture_only", candidate, approval });
    const disabled = transitionRelease(promoted, { id: "synthetic-disable", scopeId: scope.id, action: "disable", at: "2026-01-01T12:00:03.000Z", reason: "fixture_integrity_incident" });
    const restored = transitionRelease(disabled, { id: "synthetic-restore", scopeId: scope.id, action: "restore", at: "2026-01-01T12:00:04.000Z", reason: "fixture_verified_recovery", candidate, approval });
    expect(restored.scopes[0]).toMatchObject({ enabled: true, candidateHash: candidate.hash });
    expect(restored.scopes[1]).toEqual(initial.scopes[1]); expect(restored.events).toHaveLength(3);
    expect(initial.events).toHaveLength(0); expect(disabled.scopes[0].enabled).toBe(false);
    for (const changed of [{ ...approval, candidateHash: "wrong" }, { ...approval, scopeHash: "wrong" }, { ...approval, expiresAt: "2026-01-01T12:00:03.000Z" }]) expect(() => transitionRelease(disabled, { id: "refused", scopeId: scope.id, action: "restore", at: "2026-01-01T12:00:04.000Z", reason: "fixture_only", candidate, approval: changed })).toThrow(/approval/);
    expect(() => transitionRelease(initial, { id: "never-accepted", scopeId: scope.id, action: "restore", at: "2026-01-01T12:00:04.000Z", reason: "fixture_only", candidate, approval })).toThrow(/never accepted/);
    expect(RSO_V2_ADAPTER_ENABLED).toBe(false);
  });
});
