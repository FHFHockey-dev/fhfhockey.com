import path from "path";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import {
  ACCURACY_IMPROVEMENT_ABLATION_VARIANT_KEYS,
  runGamePredictionAccuracyImprovementLoop,
  type GamePredictionAccuracyImprovementLoopResult,
} from "lib/game-predictions/accountability";
import type { Database } from "lib/supabase/database-generated.types";

export type AccuracyLoopCliOptions = {
  seasonId?: number;
  gameType?: number;
  modelName?: string;
  baseModelVersion?: string;
  featureSetVersion?: string;
  trainStartDate?: string;
  analysisEndDate?: string;
  maxSignalGames?: number;
  blindDate?: string;
  replayEndDate?: string;
  horizonDays?: number[];
  maxSimulationDays?: number;
  retrainCadenceGames?: number;
  maxTrainingGames?: number;
  maxReplayGames?: number;
  variantKeys?: string[];
  persistEvidence: boolean;
  confirmPersist: boolean;
  help: boolean;
};

function loadEnv(): void {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  dotenv.config({ path: path.resolve(process.cwd(), "scripts/.env") });
  dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
}

function readFlagValue(argv: string[], index: number): {
  value: string | undefined;
  nextIndex: number;
} {
  const current = argv[index] ?? "";
  const equalsIndex = current.indexOf("=");
  if (equalsIndex >= 0) {
    return {
      value: current.slice(equalsIndex + 1),
      nextIndex: index,
    };
  }
  return {
    value: argv[index + 1],
    nextIndex: index + 1,
  };
}

function parseIntegerValue(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function parseIntegerList(value: string | undefined, minValue = 0): number[] | undefined {
  if (!value) return undefined;
  const values = value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isInteger(part) && part >= minValue);
  return values.length > 0 ? Array.from(new Set(values)) : undefined;
}

function parseVariantKeys(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const values = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return values.length > 0 ? Array.from(new Set(values)) : undefined;
}

export function formatAccuracyLoopVariantKeys(): string {
  return Array.from(ACCURACY_IMPROVEMENT_ABLATION_VARIANT_KEYS).join(", ");
}

export function parseAccuracyLoopArgs(argv: string[]): AccuracyLoopCliOptions {
  const options: AccuracyLoopCliOptions = {
    persistEvidence: false,
    confirmPersist: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    const flag = arg.split("=")[0];

    switch (flag) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--season-id": {
        const parsed = readFlagValue(argv, index);
        options.seasonId = parseIntegerValue(parsed.value);
        index = parsed.nextIndex;
        break;
      }
      case "--game-type": {
        const parsed = readFlagValue(argv, index);
        options.gameType = parseIntegerValue(parsed.value);
        index = parsed.nextIndex;
        break;
      }
      case "--model-name": {
        const parsed = readFlagValue(argv, index);
        options.modelName = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      case "--base-model-version": {
        const parsed = readFlagValue(argv, index);
        options.baseModelVersion = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      case "--feature-set-version": {
        const parsed = readFlagValue(argv, index);
        options.featureSetVersion = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      case "--train-start-date": {
        const parsed = readFlagValue(argv, index);
        options.trainStartDate = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      case "--analysis-end-date": {
        const parsed = readFlagValue(argv, index);
        options.analysisEndDate = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      case "--max-signal-games": {
        const parsed = readFlagValue(argv, index);
        options.maxSignalGames = parseIntegerValue(parsed.value);
        index = parsed.nextIndex;
        break;
      }
      case "--blind-date": {
        const parsed = readFlagValue(argv, index);
        options.blindDate = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      case "--replay-end-date": {
        const parsed = readFlagValue(argv, index);
        options.replayEndDate = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      case "--horizon-days": {
        const parsed = readFlagValue(argv, index);
        options.horizonDays = parseIntegerList(parsed.value);
        index = parsed.nextIndex;
        break;
      }
      case "--max-simulation-days": {
        const parsed = readFlagValue(argv, index);
        options.maxSimulationDays = parseIntegerValue(parsed.value);
        index = parsed.nextIndex;
        break;
      }
      case "--retrain-cadence-games": {
        const parsed = readFlagValue(argv, index);
        options.retrainCadenceGames = parseIntegerValue(parsed.value);
        index = parsed.nextIndex;
        break;
      }
      case "--max-training-games": {
        const parsed = readFlagValue(argv, index);
        options.maxTrainingGames = parseIntegerValue(parsed.value);
        index = parsed.nextIndex;
        break;
      }
      case "--max-replay-games": {
        const parsed = readFlagValue(argv, index);
        options.maxReplayGames = parseIntegerValue(parsed.value);
        index = parsed.nextIndex;
        break;
      }
      case "--variants": {
        const parsed = readFlagValue(argv, index);
        options.variantKeys = parseVariantKeys(parsed.value);
        index = parsed.nextIndex;
        break;
      }
      case "--persist-evidence":
        options.persistEvidence = true;
        break;
      case "--confirm-persist":
        options.confirmPersist = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

export function validateAccuracyLoopOptions(options: AccuracyLoopCliOptions): void {
  if (options.help) return;
  if (!options.seasonId) {
    throw new Error("--season-id is required.");
  }
  if (options.persistEvidence && !options.confirmPersist) {
    throw new Error(
      "Refusing to persist accuracy-loop evidence without --confirm-persist.",
    );
  }
  const knownVariantKeys = new Set(ACCURACY_IMPROVEMENT_ABLATION_VARIANT_KEYS);
  const unknownVariantKeys = (options.variantKeys ?? []).filter(
    (variantKey) => !knownVariantKeys.has(variantKey as never),
  );
  if (unknownVariantKeys.length > 0) {
    throw new Error(
      [
        `Unknown variant key(s): ${unknownVariantKeys.join(", ")}.`,
        `Known variant keys: ${formatAccuracyLoopVariantKeys()}.`,
      ].join(" "),
    );
  }
}

function supabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=,+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function accuracyLoopBackfillCommand(options?: Partial<AccuracyLoopCliOptions>): string | null {
  if (!options?.seasonId) return null;
  const args = [
    "npm",
    "run",
    "import:historical-market-odds",
    "--",
    "--print-expected-games",
    "--season-id",
    String(options.seasonId),
  ];
  if (options.gameType != null) args.push("--game-type", String(options.gameType));
  if (options.trainStartDate) args.push("--train-start-date", options.trainStartDate);
  if (options.blindDate) args.push("--blind-date", options.blindDate);
  if (options.replayEndDate) args.push("--replay-end-date", options.replayEndDate);
  if (options.analysisEndDate) {
    args.push("--analysis-end-date", options.analysisEndDate);
  }
  if (options.horizonDays?.length) {
    args.push("--horizon-days", options.horizonDays.join(","));
  }
  if (options.maxSimulationDays != null) {
    args.push("--max-simulation-days", String(options.maxSimulationDays));
  }
  if (options.maxTrainingGames != null) {
    args.push("--max-training-games", String(options.maxTrainingGames));
  }
  if (options.maxReplayGames != null) {
    args.push("--max-replay-games", String(options.maxReplayGames));
  }
  return args.map(shellQuote).join(" ");
}

export function buildAccuracyLoopNextActions(args: {
  result: GamePredictionAccuracyImprovementLoopResult;
  options?: Partial<AccuracyLoopCliOptions>;
}) {
  const marketOdds = args.result.sourceReadiness.marketOdds;
  const needsMarketOddsBackfill = !marketOdds.trainingFeatureEligible;
  return {
    marketOddsBackfill: needsMarketOddsBackfill
      ? {
          requiredGames: marketOdds.requiredGames,
          snapshotGames: marketOdds.snapshotGames,
          trustedSnapshotSourceGames: marketOdds.trustedSnapshotSourceGames,
          warnings: marketOdds.warnings,
          printExpectedGamesCommand: accuracyLoopBackfillCommand(args.options),
          importCommand:
            "npm run import:historical-market-odds -- --file odds.csv --write --confirm-write",
          guardrail:
            "Only import historical odds rows whose captured_at/source provenance proves a pre-cutoff, pre-start observation.",
        }
      : null,
  };
}

export function summarizeAccuracyLoopResult(
  result: GamePredictionAccuracyImprovementLoopResult,
  options?: Partial<AccuracyLoopCliOptions>,
) {
  return {
    generatedAt: result.generatedAt,
    seasonId: result.seasonId,
    gameType: result.gameType,
    featureSetVersion: result.featureSetVersion,
    dryRun: result.dryRun,
    evidencePersisted: result.ablations.promotionEvidencePersisted,
    sourceReadiness: {
      marketOdds: {
        requiredGames: result.sourceReadiness.marketOdds.requiredGames,
        snapshotGames: result.sourceReadiness.marketOdds.snapshotGames,
        trustedSnapshotSourceGames:
          result.sourceReadiness.marketOdds.trustedSnapshotSourceGames,
        trainingFeatureEligible:
          result.sourceReadiness.marketOdds.trainingFeatureEligible,
        warnings: result.sourceReadiness.marketOdds.warnings,
      },
    },
    signalAnalysis: {
      analyzedGames: result.signalAnalysis.analyzedGames,
      analysisStartDate: result.signalAnalysis.analysisStartDate,
      analysisEndDate: result.signalAnalysis.analysisEndDate,
      topSignals: result.signalAnalysis.analysis.signals
        .slice(0, 10)
        .map((signal) => ({
          featureKey: signal.featureKey,
          rank: signal.rank,
          mutualInformationScore: signal.mutualInformationScore,
          absoluteCorrelation: signal.absoluteCorrelation,
          multivariateLogisticWeight: signal.multivariateLogisticWeight,
        })),
      blockedFeatureKeys: result.signalAnalysis.analysis.leakageChecks
        .filter((check) => check.status === "blocked_by_default")
        .map((check) => check.featureKey),
    },
    variants: result.ablations.variants.map((variant) => ({
      key: variant.key,
      recommendation: variant.recommendation,
      modelFamily: variant.modelFamily,
      calibrationMethod: variant.calibrationMethod,
      evaluatedGames: variant.summary.evaluatedGames,
      accuracy: variant.summary.accuracy,
      brierScore: variant.summary.brierScore,
      logLoss: variant.summary.logLoss,
      deltaVsBaseline: variant.deltaVsBaseline,
      excludedFeatureKeys: variant.excludedFeatureKeys,
    })),
    promotionEvidence: result.ablations.promotionEvidence.map((evidence) => ({
      candidateKey: evidence.candidateKey,
      usesMarketFeatures: evidence.usesMarketFeatures,
      marketSourceTrainingEligible: evidence.marketSourceTrainingEligible,
      marketFeatureTrainingEligible: evidence.marketFeatureTrainingEligible,
      marketFeatureSuppressedBySourceReadiness:
        evidence.marketFeatureSuppressedBySourceReadiness,
      publicExplanationReady: evidence.publicExplanationReady,
      segmentRegressionCount: evidence.segmentRegressionCount,
      decision: evidence.decision,
    })),
    nextActions: buildAccuracyLoopNextActions({ result, options }),
  };
}

function usage(): string {
  return [
    "Usage:",
    "  npm run accuracy-loop:game-prediction -- --season-id 20252026 --blind-date 2026-01-15 --replay-end-date 2026-02-15",
    "",
    "Promotion evidence persistence is blocked unless both --persist-evidence and --confirm-persist are supplied.",
    `Available variants: ${formatAccuracyLoopVariantKeys()}`,
  ].join("\n");
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseAccuracyLoopArgs(argv);
  if (options.help) {
    console.log(usage());
    return;
  }
  validateAccuracyLoopOptions(options);
  loadEnv();

  const result = await runGamePredictionAccuracyImprovementLoop({
    client: supabaseClient(),
    seasonId: options.seasonId!,
    gameType: options.gameType,
    modelName: options.modelName,
    baseModelVersion: options.baseModelVersion,
    featureSetVersion: options.featureSetVersion,
    trainStartDate: options.trainStartDate,
    analysisEndDate: options.analysisEndDate,
    maxSignalGames: options.maxSignalGames,
    blindDate: options.blindDate,
    replayEndDate: options.replayEndDate,
    horizonDays: options.horizonDays,
    maxSimulationDays: options.maxSimulationDays,
    retrainCadenceGames: options.retrainCadenceGames,
    maxTrainingGames: options.maxTrainingGames,
    maxReplayGames: options.maxReplayGames,
    persistEvidence: options.persistEvidence,
    variantKeys:
      options.variantKeys ??
      Array.from(ACCURACY_IMPROVEMENT_ABLATION_VARIANT_KEYS),
  });

  console.log(JSON.stringify(summarizeAccuracyLoopResult(result, options), null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
