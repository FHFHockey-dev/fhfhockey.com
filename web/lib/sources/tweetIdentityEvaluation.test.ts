// @vitest-environment node
import { describe, expect, it } from "vitest";
import { gradeLocalIdentityComparison } from "./tweetIdentityEvaluation";
import { runIdentityDevelopmentComparison } from "./fixtures/tweetIdentityDevelopmentComparison";

describe("offline comparison provenance and matched denominators", () => {
  it("separates synthetic plumbing from ungraded real development and an empty independent holdout", async () => {
    const { report } = await runIdentityDevelopmentComparison();
    expect(report.cohorts).toMatchObject([
      { cohort: "synthetic_development", samples: 9, gradedSamples: 9, mockArmSamples: 9, interpretation: "synthetic_plumbing_only_not_model_accuracy" },
      { cohort: "real_development", samples: 4, gradedSamples: 0, ungradedSamples: 4, distinctLineages: 3 },
      { cohort: "real_holdout", samples: 0, gradedSamples: 0 },
    ]);
    const alias = report.cases.find(c => c.id === "synthetic:alias")!.occurrences[0]!;
    expect(alias).toMatchObject({ baselineCandidateIds: [], deterministicSelectedId: "nhl:1001", modelProposal: { canonicalId: "nhl:1001" } });
    const typo = report.cases.find(c => c.id === "synthetic:typo")!.occurrences[0]!;
    expect(typo).toMatchObject({ baselineSelectedId: null, deterministicSelectedId: null, modelProposal: { canonicalId: "nhl:1001" } });
    expect(report.cases.find(c => c.id === "retained:S10A")).toMatchObject({ labelStatus: "ungraded", reason: "missing_retained_receipt_time" });
    expect(report.cohorts.every(c => c.realModelAccuracy === null && c.certaintyInflation === null)).toBe(true);
  });
  it("counts wrong IDs, non-player assignments and abstentions separately from retrieval coverage", async () => {
    const { samples } = await runIdentityDevelopmentComparison();
    const alias = structuredClone(samples.find(s => s.id === "synthetic:alias")!);
    alias.result!.occurrences[0]!.deterministicSelectedId = "nhl:1002";
    const nonPlayer = structuredClone(samples.find(s => s.id === "synthetic:non-player")!);
    nonPlayer.result!.occurrences[0]!.deterministicSelectedId = "nhl:1001";
    const report = gradeLocalIdentityComparison([alias, nonPlayer]);
    expect(report.cohorts[0]!.arms.deterministic).toMatchObject({ expectedPlayers: 1, retrievalHits: 1, assignments: 2, wrongPlayers: 2,
      nonPlayerCases: 1, nonPlayerAssignments: 1, abstentions: 0 });
    expect(report.cohorts[0]!.arms.baseline).toMatchObject({ assignments: 0, abstentions: 2 });
  });
  it("rejects duplicate documents, cross-cohort lineage leaks and missing independent holdout labels", async () => {
    const { samples } = await runIdentityDevelopmentComparison();
    expect(() => gradeLocalIdentityComparison([samples[0]!, { ...samples[0]!, id: "duplicate" }])).toThrow("duplicate_or_cross_cohort_source_lineage");
    const a = samples[0]!, b = { ...samples[1]!, lineageKey: a.lineageKey, cohort: "real_development" as const, result: null, label: null };
    expect(() => gradeLocalIdentityComparison([a, b])).toThrow("duplicate_or_cross_cohort_source_lineage");
    expect(() => gradeLocalIdentityComparison([{ ...samples[1]!, cohort: "real_holdout", label: null }])).toThrow("holdout_requires_independent_identity_adjudication");
  });
  it("rejects changed source/directory bindings and malformed label spans without relabeling provisional real data", async () => {
    const { samples } = await runIdentityDevelopmentComparison();
    const altered = structuredClone(samples[0]!); altered.label!.occurrences[0]!.span.text = "invented";
    expect(() => gradeLocalIdentityComparison([altered])).toThrow("invalid_or_unbound_identity_labels");
    const mismatch = structuredClone(samples[0]!); mismatch.result!.directoryHash = "other";
    expect(() => gradeLocalIdentityComparison([mismatch])).toThrow("evaluation_input_binding_mismatch");
    const provisional = { ...samples[0]!, cohort: "real_development" as const };
    expect(gradeLocalIdentityComparison([provisional]).cohorts[1]).toMatchObject({ gradedSamples: 0, ungradedSamples: 1 });
  });
  it("does not score incomplete annotations as if omitted identities were non-players", async () => {
    const { samples } = await runIdentityDevelopmentComparison();
    const incomplete = structuredClone(samples[0]!); incomplete.label!.complete = false;
    expect(gradeLocalIdentityComparison([incomplete]).cohorts[0]).toMatchObject({ gradedSamples: 0, ungradedSamples: 1,
      arms: { deterministic: { assignments: 0, wrongPlayers: 0, expectedPlayers: 0 } } });
  });
});
