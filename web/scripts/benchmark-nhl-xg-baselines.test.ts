import { describe, expect, it } from "vitest";

import {
  assertApprovalGradeArtifacts,
  renderMarkdown,
} from "./benchmark-nhl-xg-baselines";

describe("benchmark-nhl-xg-baselines", () => {
  it("throws in approval-grade mode when an artifact has no dedicated test split", () => {
    expect(() =>
      assertApprovalGradeArtifacts([
        {
          artifactTag: "artifact-no-test",
          family: "logistic_unregularized",
          featureKeys: [],
          splitConfig: {},
          trainExampleCount: 10,
          validationExampleCount: 4,
          testExampleCount: 0,
          holdoutEvaluation: {
            exampleCount: 4,
            goalCount: 1,
            goalRate: 0.25,
            averagePrediction: 0.2,
            logLoss: 0.5,
            brierScore: 0.1,
          },
          approvalGradeEligibility: {
            isEligible: false,
            blockingReasons: [
              "Dedicated test split is empty; approval-grade benchmark artifacts require at least one test example.",
            ],
          },
        },
      ] as never)
    ).toThrow("Approval-grade benchmark requires eligible artifacts.");
  });

  it("renders approval-grade eligibility in markdown output", () => {
    const markdown = renderMarkdown([
      {
        artifactTag: "artifact-with-test",
        family: "logistic_unregularized",
        featureKeys: [],
        splitConfig: {},
        trainExampleCount: 10,
        validationExampleCount: 4,
        testExampleCount: 2,
        holdoutEvaluation: {
          exampleCount: 6,
          goalCount: 1,
          goalRate: 0.166667,
          averagePrediction: 0.15,
          logLoss: 0.4,
          brierScore: 0.08,
        },
        approvalGradeEligibility: {
          isEligible: true,
          blockingReasons: [],
        },
      },
    ] as never);

    expect(markdown).toContain("## Approval-Grade Eligibility");
    expect(markdown).toContain("`logistic_unregularized`: eligible");
  });
});
