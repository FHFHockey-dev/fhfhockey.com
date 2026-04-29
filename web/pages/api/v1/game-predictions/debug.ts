import type { NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchGamePredictionDebugDetail } from "lib/game-predictions/adminHealth";
import type { Database } from "lib/supabase/database-generated.types";
import adminOnly from "utils/adminOnlyMiddleware";

type RequestWithSupabase = {
  query: {
    predictionId?: string | string[];
  };
  supabase: SupabaseClient<Database>;
};

function readSingleQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function handler(req: RequestWithSupabase, res: NextApiResponse) {
  const predictionId = readSingleQueryValue(req.query.predictionId);
  if (!predictionId) {
    return res.status(400).json({
      success: false,
      message: "predictionId is required.",
    });
  }

  const detail = await fetchGamePredictionDebugDetail({
    client: req.supabase,
    predictionId,
  });

  if (!detail) {
    return res.status(404).json({
      success: false,
      message: "Prediction not found.",
    });
  }

  return res.status(200).json({
    success: true,
    detail,
  });
}

export default adminOnly(handler as any);
