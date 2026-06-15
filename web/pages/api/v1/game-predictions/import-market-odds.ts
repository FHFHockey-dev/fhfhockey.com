import type { NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  importHistoricalMarketOddsSnapshots,
  type HistoricalMarketOddsImportRow,
} from "lib/game-predictions/espnOdds";
import type { Database } from "lib/supabase/database-generated.types";
import adminOnly from "utils/adminOnlyMiddleware";

type RequestWithSupabase = {
  method?: string;
  query: {
    dryRun?: string | string[];
  };
  body?: {
    rows?: HistoricalMarketOddsImportRow[];
    importedAt?: string;
    importBatchId?: string;
    dryRun?: boolean;
  };
  supabase: SupabaseClient<Database>;
};

function readSingleQueryValue(
  value: string | string[] | undefined,
): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function readBoolean(
  queryValue: string | string[] | undefined,
  bodyValue: boolean | undefined,
  defaultValue: boolean,
): boolean {
  const raw = readSingleQueryValue(queryValue);
  if (raw != null) return raw === "true";
  return bodyValue ?? defaultValue;
}

async function handler(req: RequestWithSupabase, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (rows.length === 0) {
    return res.status(400).json({
      success: false,
      error: "A non-empty rows array is required.",
    });
  }

  const result = await importHistoricalMarketOddsSnapshots({
    client: req.supabase,
    rows,
    importedAt: req.body?.importedAt,
    importBatchId: req.body?.importBatchId,
    dryRun: readBoolean(req.query.dryRun, req.body?.dryRun, true),
  });

  return res.status(200).json({
    success: true,
    dryRun: result.dryRun,
    result,
  });
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "game-predictions-import-market-odds",
});
