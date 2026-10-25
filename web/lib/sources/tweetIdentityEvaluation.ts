import { identityDigest } from "./playerIdentitySnapshot";
import { exactIdentitySpan, type IdentitySourceSpan } from "./tweetIdentityProposal";
import type { LocalIdentityReviewResult } from "./tweetIdentityLocalReview";

export type IdentityEvaluationCohort = "synthetic_development" | "real_development" | "real_holdout";
export type IdentityEvaluationLabel = {
  provenance: "synthetic_authored" | "independently_adjudicated";
  complete: boolean;
  adjudicator: string; evidence: string; sourceHash: string; directoryHash: string;
  occurrences: Array<{ span: IdentitySourceSpan; kind: "player" | "ambiguous" | "non_player"; canonicalId: string | null }>;
};
export type IdentityEvaluationSample = {
  id: string; lineageKey: string; sourceText: string; sourceHash: string; directoryHash: string; cohort: IdentityEvaluationCohort;
  result: LocalIdentityReviewResult | null; heldReason: string | null; label: IdentityEvaluationLabel | null;
};
const emptyArm = () => ({ expectedPlayers: 0, retrievalHits: 0, assignments: 0, wrongPlayers: 0, abstentions: 0,
  nonPlayerCases: 0, nonPlayerAssignments: 0, missingOccurrences: 0, extraOccurrences: 0 });

/** Labels are joined after execution and never sent to a model. Related documents stay in one cohort. */
export function gradeLocalIdentityComparison(samples: IdentityEvaluationSample[]) {
  const lineages = new Map<string, IdentityEvaluationCohort>(), documents = new Set<string>(), ids = new Set<string>();
  for (const sample of samples) {
    if (!sample.id || !sample.lineageKey || !sample.sourceHash || !sample.directoryHash
      || !["synthetic_development", "real_development", "real_holdout"].includes(sample.cohort)
      || sample.sourceHash !== identityDigest(sample.sourceText) || ids.has(sample.id)
      || lineages.has(sample.lineageKey) && lineages.get(sample.lineageKey) !== sample.cohort || documents.has(sample.sourceHash))
      throw new Error("duplicate_or_cross_cohort_source_lineage");
    ids.add(sample.id); lineages.set(sample.lineageKey, sample.cohort); documents.add(sample.sourceHash);
    if (sample.cohort === "real_holdout" && sample.label?.provenance !== "independently_adjudicated")
      throw new Error("holdout_requires_independent_identity_adjudication");
    if (sample.result && (sample.result.sourceHash !== sample.sourceHash || sample.result.directoryHash !== sample.directoryHash
      || sample.result.lineageKey !== sample.lineageKey)) throw new Error("evaluation_input_binding_mismatch");
  }
  const cohorts = (Object.keys({ synthetic_development: 0, real_development: 0, real_holdout: 0 }) as IdentityEvaluationCohort[]).map(cohort => {
    const group = samples.filter(sample => sample.cohort === cohort);
    const arms = { baseline: emptyArm(), deterministic: emptyArm(), mockedResolver: emptyArm() };
    let gradedSamples = 0, ungradedSamples = 0, heldSamples = 0, labeledOccurrences = 0, mockArmSamples = 0, mockRequests = 0;
    for (const sample of group) {
      const label = sample.label, result = sample.result;
      if (!result || result.status !== "evaluated") heldSamples++;
      if (!label || label.complete !== true || cohort !== "synthetic_development" && label.provenance !== "independently_adjudicated") { ungradedSamples++; continue; }
      if (!label.adjudicator.trim() || !label.evidence.trim() || label.sourceHash !== sample.sourceHash || label.directoryHash !== sample.directoryHash
        || cohort === "synthetic_development" && label.provenance !== "synthetic_authored"
        || new Set(label.occurrences.map(o => identityDigest(o.span))).size !== label.occurrences.length
        || label.occurrences.some(o => !exactIdentitySpan(sample.sourceText, o.span) || (o.kind === "player") !== (o.canonicalId !== null)
          || o.canonicalId !== null && !/^nhl:[1-9]\d*$/.test(o.canonicalId)))
        throw new Error("invalid_or_unbound_identity_labels");
      gradedSamples++; labeledOccurrences += label.occurrences.length;
      const modeled = result?.modelMode === "mock";
      if (modeled) { mockArmSamples++; mockRequests += result.attempts; }
      for (const [name, arm] of Object.entries(arms)) {
        if (name === "mockedResolver" && !modeled) continue;
        for (const expected of label.occurrences) {
          const actual = result?.occurrences.find(o => identityDigest(o.span) === identityDigest(expected.span));
          const candidates = name === "baseline" ? actual?.baselineCandidateIds ?? [] : name === "deterministic" ? actual?.candidateIds ?? [] : actual?.modelCandidateIds ?? [];
          const selected = name === "baseline" ? actual?.baselineSelectedId : name === "deterministic" ? actual?.deterministicSelectedId : actual?.modelProposal?.canonicalId;
          if (expected.canonicalId !== null) { arm.expectedPlayers++; if (candidates.includes(expected.canonicalId)) arm.retrievalHits++; }
          if (expected.kind === "non_player") { arm.nonPlayerCases++; if (selected) arm.nonPlayerAssignments++; }
          if (!actual) arm.missingOccurrences++;
          if (selected) { arm.assignments++; if (selected !== expected.canonicalId) arm.wrongPlayers++; } else arm.abstentions++;
        }
        for (const actual of result?.occurrences ?? []) {
          if (label.occurrences.some(expected => identityDigest(expected.span) === identityDigest(actual.span))) continue;
          arm.extraOccurrences++;
          const selected = name === "baseline" ? actual.baselineSelectedId : name === "deterministic" ? actual.deterministicSelectedId : actual.modelProposal?.canonicalId;
          if (selected) { arm.assignments++; arm.wrongPlayers++; }
        }
      }
    }
    return { cohort, interpretation: cohort === "synthetic_development" ? "synthetic_plumbing_only_not_model_accuracy" : "independent_labels_required",
      samples: group.length, distinctLineages: new Set(group.map(sample => sample.lineageKey)).size,
      gradedSamples, ungradedSamples, heldSamples, labeledOccurrences, mockArmSamples, mockRequests,
      arms, realModelAccuracy: null, certaintyInflation: null,
      note: "Identity-only proposals cannot grade claim certainty. Mock responses do not measure model efficacy; no real-model arm was run." };
  });
  return { version: "local-identity-comparison-v1", cohorts,
    cases: samples.map(sample => ({ id: sample.id, cohort: sample.cohort, lineageKey: sample.lineageKey, sourceHash: sample.sourceHash,
      labelStatus: sample.label?.provenance ?? "ungraded", status: sample.result?.status ?? "held", reason: sample.result?.reason ?? sample.heldReason,
      extractionHolds: sample.result?.holds ?? [], modelStatus: sample.result?.modelStatus ?? "not_run", modelReason: sample.result?.modelReason ?? null,
      mockRequests: sample.result?.attempts ?? 0,
      occurrences: sample.result?.occurrences ?? [] })) };
}
