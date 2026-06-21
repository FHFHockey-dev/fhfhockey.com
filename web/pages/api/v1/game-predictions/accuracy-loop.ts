import type { NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  ACCURACY_IMPROVEMENT_ABLATION_VARIANT_KEYS,
  DEFAULT_BACKTEST_ABLATION_VARIANTS,
  runGamePredictionAccuracyImprovementLoop,
} from "lib/game-predictions/accountability";
import type { Database } from "lib/supabase/database-generated.types";
import adminOnly from "utils/adminOnlyMiddleware";

type RequestWithSupabase = {
  method?: string;
  query: {
    seasonId?: string | string[];
    gameType?: string | string[];
    modelName?: string | string[];
    baseModelVersion?: string | string[];
    featureSetVersion?: string | string[];
    trainStartDate?: string | string[];
    analysisEndDate?: string | string[];
    maxSignalGames?: string | string[];
    blindDate?: string | string[];
    replayEndDate?: string | string[];
    horizonDays?: string | string[];
    maxSimulationDays?: string | string[];
    retrainCadenceGames?: string | string[];
    maxTrainingGames?: string | string[];
    maxReplayGames?: string | string[];
    variants?: string | string[];
    dryRun?: string | string[];
    persistEvidence?: string | string[];
    confirmPersist?: string | string[];
  };
  supabase: SupabaseClient<Database>;
};

function readSingleQueryValue(
  value: string | string[] | undefined,
): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function readInteger(value: string | string[] | undefined): number | undefined {
  const raw = readSingleQueryValue(value);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function readIntegerList(value: string | string[] | undefined): number[] | undefined {
  const raw = readSingleQueryValue(value);
  if (!raw) return undefined;
  const values = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isInteger(part) && part >= 0);
  return values.length > 0 ? values : undefined;
}

function readVariantKeys(value: string | string[] | undefined): string[] | undefined {
  const raw = readSingleQueryValue(value);
  if (!raw) return undefined;
  const keys = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return keys.length > 0 ? Array.from(new Set(keys)) : undefined;
}

function readBoolean(value: string | string[] | undefined): boolean {
  return readSingleQueryValue(value) === "true";
}

async function handler(req: RequestWithSupabase, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  if (readSingleQueryValue(req.query.dryRun) === "false") {
    return res.status(400).json({
      success: false,
      error: "The accuracy loop endpoint is dry-run only.",
    });
  }

  const persistEvidence = readBoolean(req.query.persistEvidence);
  if (persistEvidence && req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Persisting accuracy-loop evidence requires POST.",
    });
  }
  if (persistEvidence && !readBoolean(req.query.confirmPersist)) {
    return res.status(400).json({
      success: false,
      error:
        "Persisting accuracy-loop evidence requires confirmPersist=true.",
    });
  }

  const seasonId = readInteger(req.query.seasonId);
  if (!seasonId) {
    return res.status(400).json({
      success: false,
      error: "A numeric seasonId query parameter is required.",
    });
  }

  const variantKeys = readVariantKeys(req.query.variants);
  const availableVariants = DEFAULT_BACKTEST_ABLATION_VARIANTS.map(
    (variant) => variant.key,
  );
  const unknownVariantKeys = (variantKeys ?? []).filter(
    (key) => !availableVariants.includes(key),
  );
  if (unknownVariantKeys.length > 0) {
    return res.status(400).json({
      success: false,
      error: "Unknown ablation variant key(s).",
      unknownVariantKeys,
      availableVariants,
    });
  }

  const result = await runGamePredictionAccuracyImprovementLoop({
    client: req.supabase,
    seasonId,
    gameType: readInteger(req.query.gameType),
    modelName: readSingleQueryValue(req.query.modelName) ?? undefined,
    baseModelVersion:
      readSingleQueryValue(req.query.baseModelVersion) ?? undefined,
    featureSetVersion:
      readSingleQueryValue(req.query.featureSetVersion) ?? undefined,
    trainStartDate: readSingleQueryValue(req.query.trainStartDate) ?? undefined,
    analysisEndDate:
      readSingleQueryValue(req.query.analysisEndDate) ?? undefined,
    maxSignalGames: readInteger(req.query.maxSignalGames),
    blindDate: readSingleQueryValue(req.query.blindDate) ?? undefined,
    replayEndDate: readSingleQueryValue(req.query.replayEndDate) ?? undefined,
    horizonDays: readIntegerList(req.query.horizonDays),
    maxSimulationDays: readInteger(req.query.maxSimulationDays),
    retrainCadenceGames: readInteger(req.query.retrainCadenceGames),
    maxTrainingGames: readInteger(req.query.maxTrainingGames),
    maxReplayGames: readInteger(req.query.maxReplayGames),
    persistEvidence,
    variantKeys:
      variantKeys ?? Array.from(ACCURACY_IMPROVEMENT_ABLATION_VARIANT_KEYS),
  });

  return res.status(200).json({
    success: true,
    dryRun: true,
    evidencePersisted: result.ablations.promotionEvidencePersisted,
    result,
  });
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "game-predictions-accuracy-loop",
});
