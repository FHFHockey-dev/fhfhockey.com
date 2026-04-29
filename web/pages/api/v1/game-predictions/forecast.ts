import type { NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { generatePregamePredictionsForWindow } from "lib/game-predictions/workflow";
import type { Database } from "lib/supabase/database-generated.types";
import adminOnly from "utils/adminOnlyMiddleware";

type RequestWithSupabase = {
  method?: string;
  query: {
    fromDate?: string | string[];
    toDate?: string | string[];
    fromOffsetDays?: string | string[];
    toOffsetDays?: string | string[];
    sourceAsOfDate?: string | string[];
    predictionCutoffAt?: string | string[];
    limit?: string | string[];
    maxRuntimeMs?: string | string[];
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

function addUtcDays(date: Date, days: number): string {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

async function handler(req: RequestWithSupabase, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  const now = new Date();
  const predictionCutoffAt =
    readSingleQueryValue(req.query.predictionCutoffAt) ?? now.toISOString();
  const sourceAsOfDate =
    readSingleQueryValue(req.query.sourceAsOfDate) ??
    predictionCutoffAt.slice(0, 10);
  const fromOffsetDays = readInteger(req.query.fromOffsetDays);
  const toOffsetDays = readInteger(req.query.toOffsetDays);
  const fromDate =
    readSingleQueryValue(req.query.fromDate) ??
    addUtcDays(now, fromOffsetDays ?? 0);
  const toDate =
    readSingleQueryValue(req.query.toDate) ??
    addUtcDays(now, toOffsetDays ?? fromOffsetDays ?? 0);

  const result = await generatePregamePredictionsForWindow({
    client: req.supabase,
    fromDate,
    toDate,
    sourceAsOfDate,
    predictionCutoffAt,
    limit: readInteger(req.query.limit),
    maxRuntimeMs: readInteger(req.query.maxRuntimeMs),
    dryRun: readSingleQueryValue(req.query.dryRun) === "true",
  });

  return res.status(200).json({
    success: true,
    result,
  });
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "game-predictions-forecast",
});
