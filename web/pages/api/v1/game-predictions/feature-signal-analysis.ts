import type { NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { runGamePredictionFeatureSignalAnalysis } from "lib/game-predictions/accountability";
import {
  BASELINE_FEATURE_KEYS,
  type BaselineFeatureKey,
} from "lib/game-predictions/baselineModel";
import { GAME_PREDICTION_FEATURE_SET_VERSION } from "lib/game-predictions/featureSources";
import type { Database } from "lib/supabase/database-generated.types";
import adminOnly from "utils/adminOnlyMiddleware";

type RequestWithSupabase = {
  method?: string;
  query: {
    seasonId?: string | string[];
    gameType?: string | string[];
    featureSetVersion?: string | string[];
    trainStartDate?: string | string[];
    analysisEndDate?: string | string[];
    maxGames?: string | string[];
    includeDefaultExcludedFeatureKeys?: string | string[];
    excludedFeatureKeys?: string | string[];
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

function readBoolean(
  value: string | string[] | undefined,
): boolean | undefined {
  const raw = readSingleQueryValue(value);
  if (raw == null) return undefined;
  if (["1", "true", "yes"].includes(raw.toLowerCase())) return true;
  if (["0", "false", "no"].includes(raw.toLowerCase())) return false;
  return undefined;
}

function readFeatureKeys(
  value: string | string[] | undefined,
): BaselineFeatureKey[] | undefined {
  const raw = readSingleQueryValue(value);
  if (!raw) return undefined;
  const validKeys = new Set<string>(BASELINE_FEATURE_KEYS);
  const keys = raw
    .split(",")
    .map((part) => part.trim())
    .filter((key): key is BaselineFeatureKey => validKeys.has(key));
  return keys.length > 0 ? Array.from(new Set(keys)) : undefined;
}

async function handler(req: RequestWithSupabase, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  const seasonId = readInteger(req.query.seasonId);
  if (!seasonId) {
    return res.status(400).json({
      success: false,
      error: "A numeric seasonId query parameter is required.",
    });
  }

  const result = await runGamePredictionFeatureSignalAnalysis({
    client: req.supabase,
    seasonId,
    gameType: readInteger(req.query.gameType),
    featureSetVersion:
      readSingleQueryValue(req.query.featureSetVersion) ??
      GAME_PREDICTION_FEATURE_SET_VERSION,
    trainStartDate: readSingleQueryValue(req.query.trainStartDate) ?? undefined,
    analysisEndDate:
      readSingleQueryValue(req.query.analysisEndDate) ?? undefined,
    maxGames: readInteger(req.query.maxGames),
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys:
        readBoolean(req.query.includeDefaultExcludedFeatureKeys) ?? true,
      excludedFeatureKeys: readFeatureKeys(req.query.excludedFeatureKeys),
    },
  });

  return res.status(200).json({
    success: true,
    dryRun: true,
    result,
  });
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "game-predictions-feature-signal-analysis",
});
