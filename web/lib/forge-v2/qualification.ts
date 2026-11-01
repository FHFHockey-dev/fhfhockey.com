import { CATEGORIES, CategoryMeans, Component, CONDITIONING, Horizon, QualificationManifest, ScoringProfile, TARGET_VERSION, Vintage, available, assertVintage, instant, unavailable } from "./contracts";
import { contentHash } from "./hash.server";
import { DEFAULT_SCORING, scoringProfile } from "./identity";

/** Evidence is supplied by a trusted read layer, never accepted from a public request. */
export interface QualificationEvidence {
  id: string;
  kind: "frozen_protocol" | "independent_final" | "prospective_shadow" | "independent_review";
  sha256: string;
  payload: {
    scopeHash: string;
    protocolId: string;
    issuedAt: string;
    authorId: string;
    reviewerId: string;
    independent: boolean;
    approved: boolean;
    passed: boolean;
    evidenceClass: "fixture" | "development" | "final" | "prospective" | "review" | "protocol";
    untouched: boolean;
    artifactHashes: string[];
    numericalThresholdsHash: string;
    sampleManifestHash: string;
  };
}
export type QualificationDecision = Component<{ id: string; scope: "full_v2" | "contiguous_subset"; horizons: Horizon[] }>;

export function qualificationScope(manifest: QualificationManifest): Component<"full_v2" | "contiguous_subset"> {
  const horizons = [...manifest.horizons].sort((a, b) => a - b);
  if (!horizons.length || horizons[0] !== 1 || new Set(horizons).size !== horizons.length || horizons.some((h, i) => !Number.isInteger(h) || h < 1 || h > 10 || (i > 0 && h !== horizons[i - 1] + 1))) return unavailable("release_scope_must_be_h1_through_hk");
  if (!manifest.categories.length || new Set(manifest.categories).size !== manifest.categories.length || manifest.categories.some(c => !CATEGORIES.includes(c))) return unavailable("invalid_category_scope");
  if (CATEGORIES.some(c => DEFAULT_SCORING.weights[c] !== 0 && !manifest.categories.includes(c)) || !manifest.profileIds.includes(DEFAULT_SCORING.id) || !manifest.participationQualified || !manifest.intervalLevels.includes(0.5) || !manifest.intervalLevels.includes(0.9)) return unavailable("incomplete_default_release_scope");
  const generator = manifest.jointGenerator;
  if (!generator || !/^[a-f0-9]{64}$/.test(generator.modelArtifactHash) || !manifest.artifactHashes.includes(generator.modelArtifactHash) || !generator.algorithmVersion || !generator.schemaVersion || !generator.decoderVersion || !generator.calculationVersion) return unavailable("missing_qualified_joint_generator");
  return available(horizons.length === 10 && CATEGORIES.every(c => manifest.categories.includes(c)) ? "full_v2" : "contiguous_subset");
}

/** Excludes mutable status and evidence pointers; the preregistered scope binds all applicability. */
export function qualificationScopeHash(manifest: QualificationManifest): string {
  return contentHash({ targetVersion: manifest.targetVersion, conditioning: manifest.conditioning, modelVersion: manifest.modelVersion, featureVersion: manifest.featureVersion, codeVersion: manifest.codeVersion, horizons: manifest.horizons, cohorts: manifest.cohorts, categories: manifest.categories, profileIds: manifest.profileIds, participationModelVersion: manifest.participationModelVersion, participationQualified: manifest.participationQualified, intervalLevels: manifest.intervalLevels, artifactHashes: manifest.artifactHashes, jointGenerator: manifest.jointGenerator });
}

export function assessQualification(vintage: Vintage, manifest: QualificationManifest | null, evidence: QualificationEvidence[], profile: ScoringProfile = vintage.scoring): QualificationDecision {
  try { assertVintage(vintage); } catch { return unavailable("invalid_vintage"); }
  if (!manifest || manifest.status !== "qualified" || vintage.qualificationId !== manifest.id) return unavailable("not_qualified");
  if (vintage.evidenceClass !== "public_serving" || manifest.evidenceClass !== "public_serving") return unavailable("nonpublic_evidence");
  if (manifest.targetVersion !== TARGET_VERSION || vintage.targetVersion !== manifest.targetVersion || manifest.conditioning !== CONDITIONING || vintage.conditioning !== manifest.conditioning) return unavailable("target_definition_mismatch");
  if (manifest.modelVersion !== vintage.modelVersion || manifest.featureVersion !== vintage.featureVersion || manifest.codeVersion !== vintage.codeVersion) return unavailable("model_dependency_mismatch");
  if (!manifest.horizons.includes(vintage.horizon) || !manifest.cohorts.includes(vintage.cohort)) return unavailable("unsupported_horizon_or_cohort");
  try { if (scoringProfile(profile.weights).id !== profile.id || profile.ruleVersion !== "linear-seven-v1") return unavailable("scoring_identity_mismatch"); }
  catch { return unavailable("invalid_scoring_profile"); }
  if (CATEGORIES.some(c => profile.weights[c] !== 0 && (!manifest.categories.includes(c) || vintage.means[c].state !== "available"))) return unavailable("unsupported_contributing_category");
  const scope = qualificationScope(manifest);
  if (scope.state !== "available") return scope;
  const digest = qualificationScopeHash(manifest);
  const records = [manifest.finalEvaluationId, manifest.prospectiveEvaluationId, manifest.independentReviewId].map(id => evidence.find(record => record.id === id));
  const kinds = ["independent_final", "prospective_shadow", "independent_review"];
  if (records.some((record, i) => !record || record.kind !== kinds[i])) return unavailable("missing_independent_evidence");
  const protocol = evidence.find(record => record.id === records[0]!.payload.protocolId && record.kind === "frozen_protocol");
  if (!protocol) return unavailable("missing_frozen_protocol");
  const all = [protocol, ...records as QualificationEvidence[]];
  const classes = ["protocol", "final", "prospective", "review"];
  for (const [index, record] of all.entries()) {
    const p = record.payload;
    if (contentHash(p) !== record.sha256 || p.scopeHash !== digest || p.protocolId !== protocol.id || !p.approved || !p.passed || !p.independent || !p.authorId || !p.reviewerId || p.authorId === p.reviewerId || p.evidenceClass !== classes[index] || !/^[a-f0-9]{64}$/.test(p.numericalThresholdsHash) || !/^[a-f0-9]{64}$/.test(p.sampleManifestHash) || p.numericalThresholdsHash !== protocol.payload.numericalThresholdsHash || manifest.artifactHashes.some(hash => !p.artifactHashes.includes(hash))) return unavailable("invalid_independent_evidence");
    try {
      if (instant(p.issuedAt) > instant(manifest.createdAt) || instant(manifest.createdAt) > instant(vintage.generatedAt) || (index > 0 && instant(p.issuedAt) <= instant(protocol.payload.issuedAt))) return unavailable("qualification_chronology_mismatch");
    } catch { return unavailable("invalid_qualification_clock"); }
  }
  if (!records[0]!.payload.untouched || new Set(all.map(r => r.id)).size !== 4 || records[0]!.payload.sampleManifestHash === records[1]!.payload.sampleManifestHash) return unavailable("final_not_untouched_or_independent");
  if (instant(records[2]!.payload.issuedAt) < Math.max(instant(records[0]!.payload.issuedAt), instant(records[1]!.payload.issuedAt))) return unavailable("review_precedes_evaluation");
  return available({ id: manifest.id, scope: scope.value, horizons: manifest.horizons });
}

export function qualifiedMeans(vintage: Vintage, manifest: QualificationManifest | null, evidence: QualificationEvidence[], profile = vintage.scoring): CategoryMeans {
  const decision = assessQualification(vintage, manifest, evidence, profile);
  return Object.fromEntries(CATEGORIES.map(c => [c, decision.state === "available" && manifest!.categories.includes(c) ? vintage.means[c] : unavailable(decision.state === "unavailable" ? decision.reason : "unqualified_category")])) as CategoryMeans;
}

export function qualifiedParticipation(vintage: Vintage, manifest: QualificationManifest | null, evidence: QualificationEvidence[]): Component<number> {
  const decision = assessQualification(vintage, manifest, evidence);
  if (decision.state !== "available") return decision;
  const participation = vintage.participation;
  if (!manifest!.participationQualified || participation.event !== CONDITIONING || participation.modelVersion !== manifest!.participationModelVersion || participation.qualificationId !== manifest!.id || !participation.evidenceIds.length || participation.evidenceIds.some(id => !evidence.some(record => record.id === id))) return unavailable("participation_not_qualified");
  if (participation.probability.state !== "available") return participation.probability;
  const value = participation.probability.value;
  return Number.isFinite(value) && value >= 0 && value <= 1 ? available(value) : unavailable("invalid_participation_probability");
}
