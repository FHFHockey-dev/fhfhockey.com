import type { NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { generatePregamePredictionForGame } from "lib/game-predictions/workflow";
import type { Database } from "lib/supabase/database-generated.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import adminOnly from "utils/adminOnlyMiddleware";

type RequestWithSupabase = {
  query: {
    gameId?: string | string[];
    sourceAsOfDate?: string | string[];
    predictionCutoffAt?: string | string[];
    dryRun?: string | string[];
  };
  supabase: SupabaseClient<Database>;
};

function readSingleQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function handler(req: RequestWithSupabase, res: NextApiResponse) {
  const gameId = Number(readSingleQueryValue(req.query.gameId));
  if (!Number.isInteger(gameId)) {
    return res.status(400).json({
      success: false,
      message: "A numeric gameId query parameter is required.",
    });
  }

  const dryRun = readSingleQueryValue(req.query.dryRun) === "true";
  const result = await generatePregamePredictionForGame({
    client: req.supabase,
    gameId,
    sourceAsOfDate: readSingleQueryValue(req.query.sourceAsOfDate) ?? undefined,
    predictionCutoffAt:
      readSingleQueryValue(req.query.predictionCutoffAt) ?? undefined,
    dryRun,
  });

  return res.status(200).json({
    success: true,
    result,
  });
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "game-predictions-generate",
});
