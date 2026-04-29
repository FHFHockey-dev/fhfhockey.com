import type { NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { runWalkForwardBacktest } from "lib/game-predictions/accountability";
import { BASELINE_MODEL_NAME } from "lib/game-predictions/baselineModel";
import { GAME_PREDICTION_FEATURE_SET_VERSION } from "lib/game-predictions/featureSources";
import type { Database } from "lib/supabase/database-generated.types";
import adminOnly from "utils/adminOnlyMiddleware";

type RequestWithSupabase = {
  method?: string;
  query: {
    seasonId?: string | string[];
    gameType?: string | string[];
    modelName?: string | string[];
    modelVersion?: string | string[];
    featureSetVersion?: string | string[];
    trainStartDate?: string | string[];
    blindDate?: string | string[];
    replayEndDate?: string | string[];
    horizonDays?: string | string[];
    maxSimulationDays?: string | string[];
    retrainCadenceGames?: string | string[];
    maxReplayGames?: string | string[];
    persist?: string | string[];
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

  const persist = readSingleQueryValue(req.query.persist) === "true";
  const result = await runWalkForwardBacktest({
    client: req.supabase,
    seasonId,
    gameType: readInteger(req.query.gameType),
    modelName: readSingleQueryValue(req.query.modelName) ?? BASELINE_MODEL_NAME,
    modelVersion:
      readSingleQueryValue(req.query.modelVersion) ??
      `v1_walk_forward_${seasonId}`,
    featureSetVersion:
      readSingleQueryValue(req.query.featureSetVersion) ??
      GAME_PREDICTION_FEATURE_SET_VERSION,
    trainStartDate: readSingleQueryValue(req.query.trainStartDate) ?? undefined,
    blindDate: readSingleQueryValue(req.query.blindDate) ?? undefined,
    replayEndDate: readSingleQueryValue(req.query.replayEndDate) ?? undefined,
    horizonDays: readIntegerList(req.query.horizonDays),
    maxSimulationDays: readInteger(req.query.maxSimulationDays),
    retrainCadenceGames: readInteger(req.query.retrainCadenceGames),
    maxReplayGames: readInteger(req.query.maxReplayGames),
    persist,
  });

  return res.status(200).json({
    success: true,
    dryRun: !persist,
    result,
  });
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "game-predictions-backtest",
});
