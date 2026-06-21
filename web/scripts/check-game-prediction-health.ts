import path from "path";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import {
  fetchGamePredictionHealthReport,
  type GamePredictionHealthReport,
} from "lib/game-predictions/adminHealth";
import type { Database } from "lib/supabase/database-generated.types";

export type GamePredictionHealthCliOptions = {
  fromDate?: string;
  toDate?: string;
  failOnAlerts: boolean;
  output: "summary" | "json";
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

export function parseGamePredictionHealthArgs(
  argv: string[],
): GamePredictionHealthCliOptions {
  const options: GamePredictionHealthCliOptions = {
    failOnAlerts: false,
    output: "summary",
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
      case "--from-date": {
        const parsed = readFlagValue(argv, index);
        options.fromDate = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      case "--to-date": {
        const parsed = readFlagValue(argv, index);
        options.toDate = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      case "--fail-on-alerts":
        options.failOnAlerts = true;
        break;
      case "--output": {
        const parsed = readFlagValue(argv, index);
        if (parsed.value !== "summary" && parsed.value !== "json") {
          throw new Error("--output must be summary or json.");
        }
        options.output = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function isIsoDate(value: string | undefined): boolean {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validateGamePredictionHealthOptions(
  options: GamePredictionHealthCliOptions,
): void {
  if (options.help) return;
  if (!isIsoDate(options.fromDate) || !isIsoDate(options.toDate)) {
    throw new Error("--from-date and --to-date must use YYYY-MM-DD.");
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

export function hasGamePredictionHealthAlerts(
  report: GamePredictionHealthReport,
): boolean {
  return report.alerts.some((alert) => alert.status === "warn");
}

export function summarizeGamePredictionHealthReport(
  report: GamePredictionHealthReport,
) {
  const promotionAudit = report.productionModel?.promotionAudit ?? null;
  const warningAlerts = report.alerts.filter((alert) => alert.status === "warn");

  return {
    generatedAt: report.generatedAt,
    productionModel: report.productionModel
      ? {
          modelName: report.productionModel.modelName,
          modelVersion: report.productionModel.modelVersion,
          featureSetVersion: report.productionModel.featureSetVersion,
          promotedAt: report.productionModel.promotedAt,
          ageDays: report.productionModel.ageDays,
        }
      : null,
    latestMetric: report.latestMetric,
    predictionCoverage: {
      scheduledGames: report.predictionCoverage.scheduledGames,
      predictedGames: report.predictionCoverage.predictedGames,
      missingPredictionCount: report.predictionCoverage.missingPredictionCount,
    },
    dataFreshness: {
      auditedSources: report.dataFreshness.auditedSources,
      staleSourceCount: report.dataFreshness.staleSourceCount,
      nullExpiryCount: report.dataFreshness.nullExpiryCount,
    },
    jobs: {
      failedJobCount: report.jobs.failedJobCount,
      failedJobNames: report.jobs.failedJobs.map((job) => job.jobName),
    },
    featureQuality: report.featureQuality,
    marketOddsReadiness: {
      requiredGames: report.marketOddsReadiness.requiredGames,
      snapshotGames: report.marketOddsReadiness.snapshotGames,
      trustedSnapshotSourceGames:
        report.marketOddsReadiness.trustedSnapshotSourceGames,
      trustedSnapshotSourceCoveragePct:
        report.marketOddsReadiness.trustedSnapshotSourceCoveragePct,
      trainingFeatureEligible:
        report.marketOddsReadiness.trainingFeatureEligible,
      warnings: report.marketOddsReadiness.warnings,
    },
    segmentPerformance: {
      monitoredSegmentKeys: report.segmentPerformance.monitoredSegmentKeys,
      missingSegmentKeys: report.segmentPerformance.missingSegmentKeys,
      windowMismatchCount: report.segmentPerformance.windowMismatches.length,
    },
    promotionAudit: promotionAudit
      ? {
          promotionStatus: promotionAudit.promotionStatus,
          decisionPromote: promotionAudit.decisionPromote,
          evaluatedGames: promotionAudit.evaluatedGames,
          validationStartDate: promotionAudit.validationStartDate,
          validationEndDate: promotionAudit.validationEndDate,
          usesMarketFeatures: promotionAudit.usesMarketFeatures,
          marketFeatureTrainingEligible:
            promotionAudit.marketFeatureTrainingEligible,
          marketTrustedSnapshotSourceGames:
            promotionAudit.marketTrustedSnapshotSourceGames,
          marketRequiredGames: promotionAudit.marketRequiredGames,
          marketTrustedSnapshotSourceCoveragePct:
            promotionAudit.marketTrustedSnapshotSourceCoveragePct,
          publicExplanationReady: promotionAudit.publicExplanationReady,
          explanationBlockers: promotionAudit.explanationBlockers,
          segmentRegressionCount: promotionAudit.segmentRegressionCount,
        }
      : null,
    alertCount: warningAlerts.length,
    alerts: warningAlerts.map((alert) => ({
      code: alert.code,
      message: alert.message,
    })),
  };
}

function usage(): string {
  return [
    "Usage:",
    "  npm run check:game-prediction-health -- --from-date 2026-06-15 --to-date 2026-06-22",
    "",
    "Use --fail-on-alerts for CI or cron monitoring that should fail on health warnings.",
  ].join("\n");
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseGamePredictionHealthArgs(argv);
  if (options.help) {
    console.log(usage());
    return;
  }
  validateGamePredictionHealthOptions(options);
  loadEnv();

  const report = await fetchGamePredictionHealthReport({
    client: supabaseClient(),
    fromDate: options.fromDate,
    toDate: options.toDate,
  });
  const output =
    options.output === "json" ? report : summarizeGamePredictionHealthReport(report);
  console.log(JSON.stringify(output, null, 2));

  if (options.failOnAlerts && hasGamePredictionHealthAlerts(report)) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
