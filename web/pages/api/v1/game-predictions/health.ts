import type { NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchGamePredictionHealthReport } from "lib/game-predictions/adminHealth";
import type { Database } from "lib/supabase/database-generated.types";
import adminOnly from "utils/adminOnlyMiddleware";

type RequestWithSupabase = {
  query: {
    fromDate?: string | string[];
    toDate?: string | string[];
  };
  supabase: SupabaseClient<Database>;
};

function readSingleQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function handler(req: RequestWithSupabase, res: NextApiResponse) {
  const report = await fetchGamePredictionHealthReport({
    client: req.supabase,
    fromDate: readSingleQueryValue(req.query.fromDate),
    toDate: readSingleQueryValue(req.query.toDate),
  });

  return res.status(200).json({
    success: true,
    report,
  });
}

export default adminOnly(handler as any);
