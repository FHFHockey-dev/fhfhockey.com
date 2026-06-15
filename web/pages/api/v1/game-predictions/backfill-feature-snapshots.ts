import type { NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { backfillGamePredictionFeatureSnapshotsForWindow } from "lib/game-predictions/workflow";
import type { Database } from "lib/supabase/database-generated.types";
import adminOnly from "utils/adminOnlyMiddleware";

type RequestWithSupabase = {
  method?: string;
  query: {
    fromDate?: string | string[];
    toDate?: string | string[];
    cutoffHoursBeforeStart?: string | string[];
    modelName?: string | string[];
    modelVersion?: string | string[];
    limit?: string | string[];
    maxRuntimeMs?: string | string[];
    skipExisting?: string | string[];
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

function readNumber(value: string | string[] | undefined): number | undefined {
  const raw = readSingleQueryValue(value);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readBoolean(
  value: string | string[] | undefined,
  defaultValue: boolean,
): boolean {
  const raw = readSingleQueryValue(value);
  if (raw == null) return defaultValue;
  return raw === "true";
}

async function handler(req: RequestWithSupabase, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  const fromDate = readSingleQueryValue(req.query.fromDate);
  const toDate = readSingleQueryValue(req.query.toDate);
  if (!fromDate || !toDate) {
    return res.status(400).json({
      success: false,
      error: "fromDate and toDate query parameters are required.",
    });
  }

  const result = await backfillGamePredictionFeatureSnapshotsForWindow({
    client: req.supabase,
    fromDate,
    toDate,
    cutoffHoursBeforeStart: readNumber(req.query.cutoffHoursBeforeStart),
    modelName: readSingleQueryValue(req.query.modelName) ?? undefined,
    modelVersion: readSingleQueryValue(req.query.modelVersion) ?? undefined,
    limit: readInteger(req.query.limit),
    maxRuntimeMs: readInteger(req.query.maxRuntimeMs),
    skipExisting: readBoolean(req.query.skipExisting, true),
    dryRun: readBoolean(req.query.dryRun, true),
  });

  return res.status(200).json({
    success: true,
    dryRun: result.dryRun,
    result,
  });
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "game-predictions-backfill-feature-snapshots",
});
