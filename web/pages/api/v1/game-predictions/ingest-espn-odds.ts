import type { NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  ingestEspnNhlOddsSnapshotsForWindow,
  parseRequestedOddsDateBatches,
} from "lib/game-predictions/espnOdds";
import type { Database } from "lib/supabase/database-generated.types";
import adminOnly from "utils/adminOnlyMiddleware";

type RequestWithSupabase = {
  method?: string;
  query: {
    dates?: string | string[];
    fromDate?: string | string[];
    toDate?: string | string[];
    fromOffsetDays?: string | string[];
    toOffsetDays?: string | string[];
    maxDates?: string | string[];
    dryRun?: string | string[];
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

async function handler(req: RequestWithSupabase, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  const dateBatches = parseRequestedOddsDateBatches({
    dates: req.query.dates,
    fromDate: req.query.fromDate,
    toDate: req.query.toDate,
    fromOffsetDays: readInteger(req.query.fromOffsetDays),
    toOffsetDays: readInteger(req.query.toOffsetDays),
    maxDates: readInteger(req.query.maxDates),
  });
  const result = await ingestEspnNhlOddsSnapshotsForWindow({
    client: req.supabase,
    dateBatches,
    dryRun: readSingleQueryValue(req.query.dryRun) === "true",
  });

  return res.status(200).json({
    success: true,
    result,
  });
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "game-predictions-ingest-espn-odds",
});
