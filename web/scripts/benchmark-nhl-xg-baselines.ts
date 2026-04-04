import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type CliOptions = {
  artifacts: string[];
  outputPath: string | null;
  approvalGrade: boolean;
};

type SplitEvaluation = {
  exampleCount: number;
  goalCount: number;
  goalRate: number | null;
  averagePrediction: number | null;
  logLoss: number | null;
  brierScore: number | null;
};

type ModelArtifact = {
  artifactTag: string;
  family: string;
  featureKeys: string[];
  splitConfig: Record<string, number>;
  trainExampleCount: number;
  validationExampleCount: number;
  testExampleCount: number;
  holdoutEvaluation: SplitEvaluation;
  holdoutSliceEvaluations?: {
    strengthState?: Array<{
      sliceValue: string;
      evaluation: SplitEvaluation;
    }>;
    rebound?: Array<{
      sliceValue: string;
      evaluation: SplitEvaluation;
    }>;
    rush?: Array<{
      sliceValue: string;
      evaluation: SplitEvaluation;
    }>;
  };
  approvalGradeEligibility?: {
    isEligible: boolean;
    blockingReasons: string[];
  };
};

function printHelp(): void {
  console.log(`Usage: npm run benchmark:nhl-xg-baselines -- [options]

Options:
  --artifacts <csv>   Comma-separated model artifact paths
  --output <path>     Optional markdown output path
  --approvalGrade     Fail if any artifact is not approval-grade eligible
  --help              Show this help
`);
}

function parseCliArgs(argv: string[]): CliOptions {
  const options: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const withoutPrefix = token.slice(2);
    const [key, inlineValue] = withoutPrefix.split("=", 2);
    const nextToken = argv[index + 1];
    const value =
      inlineValue ?? (nextToken && !nextToken.startsWith("--") ? nextToken : "true");

    options[key] = value;

    if (inlineValue == null && nextToken && !nextToken.startsWith("--")) {
      index += 1;
    }
  }

  if (options.help === "true") {
    printHelp();
    process.exit(0);
  }

  const artifacts = (options.artifacts ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (!artifacts.length) {
    throw new Error("At least one model artifact path is required via --artifacts.");
  }

  return {
    artifacts,
    outputPath: options.output ?? null,
    approvalGrade: options.approvalGrade === "true",
  };
}

function roundMetric(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }

  return value.toFixed(6);
}

function loadArtifact(filePath: string): ModelArtifact {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as ModelArtifact;
}

export function getApprovalGradeBlockingReasons(artifact: ModelArtifact): string[] {
  if (artifact.approvalGradeEligibility?.blockingReasons?.length) {
    return artifact.approvalGradeEligibility.blockingReasons;
  }

  const blockingReasons: string[] = [];
  if (artifact.testExampleCount === 0) {
    blockingReasons.push(
      "Dedicated test split is empty; approval-grade benchmark artifacts require at least one test example."
    );
  }

  return blockingReasons;
}

export function assertApprovalGradeArtifacts(artifacts: ModelArtifact[]): void {
  const failures = artifacts
    .map((artifact) => ({
      artifactTag: artifact.artifactTag,
      blockingReasons: getApprovalGradeBlockingReasons(artifact),
    }))
    .filter((entry) => entry.blockingReasons.length > 0);

  if (!failures.length) {
    return;
  }

  throw new Error(
    `Approval-grade benchmark requires eligible artifacts. ${failures
      .map((failure) => `${failure.artifactTag}: ${failure.blockingReasons.join(" | ")}`)
      .join("; ")}`
  );
}

function verifySharedContract(artifacts: ModelArtifact[]): string[] {
  const warnings: string[] = [];
  const [first] = artifacts;
  if (!first) return warnings;

  for (const artifact of artifacts.slice(1)) {
    if (
      artifact.trainExampleCount !== first.trainExampleCount ||
      artifact.validationExampleCount !== first.validationExampleCount ||
      artifact.testExampleCount !== first.testExampleCount
    ) {
      warnings.push(
        `Split-count mismatch detected: ${artifact.artifactTag} differs from ${first.artifactTag}.`
      );
    }
  }

  return warnings;
}

function detectBenchmarkWarnings(artifacts: ModelArtifact[]): string[] {
  const warnings = verifySharedContract(artifacts);

  if (artifacts.some((artifact) => artifact.featureKeys.includes("shotEventType:goal"))) {
    warnings.push(
      "Label leakage detected: feature set still includes shotEventType:goal, so baseline ranking is not yet trustworthy."
    );
  }

  if (artifacts.some((artifact) => artifact.testExampleCount === 0)) {
    warnings.push("Test split is empty for at least one benchmarked artifact.");
  }

  if (
    artifacts.every(
      (artifact) =>
        artifact.holdoutSliceEvaluations?.rebound?.every(
          (slice) => slice.sliceValue !== "rebound"
        ) ?? true
    )
  ) {
    warnings.push("Positive rebound holdout coverage is absent in the current benchmark set.");
  }

  if (
    artifacts.every(
      (artifact) =>
        artifact.holdoutSliceEvaluations?.rush?.every(
          (slice) => slice.sliceValue !== "rush"
        ) ?? true
    )
  ) {
    warnings.push("Positive rush holdout coverage is absent in the current benchmark set.");
  }

  return warnings;
}

export function renderMarkdown(artifacts: ModelArtifact[]): string {
  const warnings = detectBenchmarkWarnings(artifacts);
  const byLogLoss = [...artifacts].sort(
    (left, right) =>
      (left.holdoutEvaluation.logLoss ?? Number.POSITIVE_INFINITY) -
      (right.holdoutEvaluation.logLoss ?? Number.POSITIVE_INFINITY)
  );
  const byBrier = [...artifacts].sort(
    (left, right) =>
      (left.holdoutEvaluation.brierScore ?? Number.POSITIVE_INFINITY) -
      (right.holdoutEvaluation.brierScore ?? Number.POSITIVE_INFINITY)
  );

  return `# NHL xG Baseline Benchmark

## Families

${artifacts
  .map((artifact) => `- \`${artifact.family}\` (${artifact.artifactTag})`)
  .join("\n")}

## Shared Contract

- Train rows: \`${artifacts[0]?.trainExampleCount ?? 0}\`
- Validation rows: \`${artifacts[0]?.validationExampleCount ?? 0}\`
- Test rows: \`${artifacts[0]?.testExampleCount ?? 0}\`

## Approval-Grade Eligibility

${artifacts
  .map((artifact) => {
    const blockingReasons = getApprovalGradeBlockingReasons(artifact);

    if (!blockingReasons.length) {
      return `- \`${artifact.family}\`: eligible`;
    }

    return `- \`${artifact.family}\`: not eligible\n${blockingReasons
      .map((reason) => `  - ${reason}`)
      .join("\n")}`;
  })
  .join("\n")}

## Holdout Metrics

| Family | Holdout Log Loss | Holdout Brier | Avg Prediction | Holdout Count |
| --- | ---: | ---: | ---: | ---: |
${artifacts
  .map(
    (artifact) =>
      `| \`${artifact.family}\` | ${roundMetric(
        artifact.holdoutEvaluation.logLoss
      )} | ${roundMetric(artifact.holdoutEvaluation.brierScore)} | ${roundMetric(
        artifact.holdoutEvaluation.averagePrediction
      )} | ${artifact.holdoutEvaluation.exampleCount} |`
  )
  .join("\n")}

## Ranking

- By holdout log loss:
${byLogLoss
  .map(
    (artifact, index) =>
      `  ${index + 1}. \`${artifact.family}\` (${roundMetric(
        artifact.holdoutEvaluation.logLoss
      )})`
  )
  .join("\n")}
- By holdout Brier:
${byBrier
  .map(
    (artifact, index) =>
      `  ${index + 1}. \`${artifact.family}\` (${roundMetric(
        artifact.holdoutEvaluation.brierScore
      )})`
  )
  .join("\n")}

## Warnings

${warnings.map((warning) => `- ${warning}`).join("\n")}
`;
}

function main(): void {
  const options = parseCliArgs(process.argv.slice(2));
  const artifacts = options.artifacts.map(loadArtifact);
  if (options.approvalGrade) {
    assertApprovalGradeArtifacts(artifacts);
  }
  const markdown = renderMarkdown(artifacts);

  if (options.outputPath) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, `${markdown}\n`, "utf8");
  }

  console.log(markdown);
}

if (require.main === module) {
  main();
}
