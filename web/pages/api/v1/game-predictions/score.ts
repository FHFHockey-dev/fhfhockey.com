import type { NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  BASELINE_MODEL_NAME,
  BASELINE_MODEL_VERSION,
} from "lib/game-predictions/baselineModel";
import { GAME_PREDICTION_FEATURE_SET_VERSION } from "lib/game-predictions/featureSources";
import { scoreGamePredictions } from "lib/game-predictions/workflow";
import type { Database } from "lib/supabase/database-generated.types";
import adminOnly from "utils/adminOnlyMiddleware";

type RequestWithSupabase = {
  query: {
    startDate?: string | string[];
    endDate?: string | string[];
    modelName?: string | string[];
    modelVersion?: string | string[];
    featureSetVersion?: string | string[];
    dryRun?: string | string[];
  };
  supabase: SupabaseClient<Database>;
};

function readSingleQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function defaultDateWindow() {
  const end = new Date();
  const start = new Date(end.getTime() - 14 * 86_400_000);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

async function handler(req: RequestWithSupabase, res: NextApiResponse) {
  const defaults = defaultDateWindow();
  const startDate = readSingleQueryValue(req.query.startDate) ?? defaults.startDate;
  const endDate = readSingleQueryValue(req.query.endDate) ?? defaults.endDate;
  const dryRun = readSingleQueryValue(req.query.dryRun) === "true";

  const result = await scoreGamePredictions({
    client: req.supabase,
    modelName: readSingleQueryValue(req.query.modelName) ?? BASELINE_MODEL_NAME,
    modelVersion: readSingleQueryValue(req.query.modelVersion) ?? BASELINE_MODEL_VERSION,
    featureSetVersion:
      readSingleQueryValue(req.query.featureSetVersion) ?? GAME_PREDICTION_FEATURE_SET_VERSION,
    evaluationStartDate: startDate,
    evaluationEndDate: endDate,
    dryRun,
  });

  return res.status(200).json({
    success: true,
    result,
  });
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "game-predictions-score",
});
