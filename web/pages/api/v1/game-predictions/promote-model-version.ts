import type { NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  previewGamePredictionModelVersionPromotion,
  promoteGamePredictionModelVersion,
} from "lib/game-predictions/workflow";
import type { Database } from "lib/supabase/database-generated.types";
import adminOnly from "utils/adminOnlyMiddleware";

type RequestWithSupabase = {
  method?: string;
  query: {
    modelName?: string | string[];
    modelVersion?: string | string[];
    featureSetVersion?: string | string[];
    minEvaluatedGames?: string | string[];
    dryRun?: string | string[];
    confirm?: string | string[];
  };
  supabase: SupabaseClient<Database>;
};

function readSingleQueryValue(
  value: string | string[] | undefined,
): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function readBoolean(value: string | string[] | undefined): boolean {
  return readSingleQueryValue(value) === "true";
}

function readInteger(value: string | string[] | undefined): number | undefined {
  const raw = readSingleQueryValue(value);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : undefined;
}

async function handler(req: RequestWithSupabase, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  const modelName = readSingleQueryValue(req.query.modelName);
  const modelVersion = readSingleQueryValue(req.query.modelVersion);
  const featureSetVersion = readSingleQueryValue(req.query.featureSetVersion);
  if (!modelName || !modelVersion || !featureSetVersion) {
    return res.status(400).json({
      success: false,
      error:
        "modelName, modelVersion, and featureSetVersion query parameters are required.",
    });
  }

  const minEvaluatedGames = readInteger(req.query.minEvaluatedGames);
  if (readSingleQueryValue(req.query.dryRun) !== "false") {
    const result = await previewGamePredictionModelVersionPromotion({
      client: req.supabase,
      modelName,
      modelVersion,
      featureSetVersion,
      minEvaluatedGames,
    });

    return res.status(200).json({
      success: true,
      dryRun: true,
      result,
    });
  }

  if (!readBoolean(req.query.confirm)) {
    return res.status(400).json({
      success: false,
      dryRun: false,
      error:
        "Promotion requires dryRun=false and confirm=true after persisted evidence review.",
    });
  }

  const result = await promoteGamePredictionModelVersion({
    client: req.supabase,
    modelName,
    modelVersion,
    featureSetVersion,
    minEvaluatedGames,
  });

  return res.status(result.promoted ? 200 : 409).json({
    success: result.promoted,
    dryRun: false,
    result,
  });
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "game-predictions-promote-model-version",
});
