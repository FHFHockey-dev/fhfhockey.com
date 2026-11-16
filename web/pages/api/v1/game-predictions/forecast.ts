import type { NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { withNhlOffSeasonSkip } from "lib/cron/nhlOffSeason";
import {
  captureLiveH0FeaturesWithoutPublishing,
  generatePregamePredictionsForWindow,
  summarizePredictionWindowOutcome,
} from "lib/game-predictions/workflow";
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
    allowBaselineBootstrap?: string | string[];
    captureGameId?: string | string[];
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

  if (req.query.captureGameId !== undefined) {
    const gameIdText = req.query.captureGameId;
    const gameId = Number(gameIdText);
    const captureInputs = new Set(["captureGameId", "fromOffsetDays", "toOffsetDays"]);
    if (req.method !== "POST" || typeof gameIdText !== "string" || !/^\d+$/.test(gameIdText)
      || !Number.isSafeInteger(gameId) || gameId <= 0 || req.query.fromOffsetDays !== "0" || req.query.toOffsetDays !== "0"
      || Object.keys(req.query).some(key => !captureInputs.has(key))) {
      return res.status(400).json({ success: false, error: "Capture requires an explicit single live H0 game and no other overrides." });
    }

    const result = await captureLiveH0FeaturesWithoutPublishing({ client: req.supabase, gameId });
    if (result.status === "refused") {
      return res.status(409).json({ success: false, status: result.status, reason: result.reason, result });
    }
    return res.status(200).json({
      success: true,
      status: "captured_not_published",
      skipped: true,
      outcome: "skipped",
      reason: "captured_not_published",
      persistedPredictions: 0,
      result,
    });
  }

  const now = new Date();
  const requestedCutoffAt = readSingleQueryValue(req.query.predictionCutoffAt);
  const requestedSourceAsOfDate = readSingleQueryValue(req.query.sourceAsOfDate);
  const predictionCutoffAt = requestedCutoffAt ?? now.toISOString();
  const sourceAsOfDate =
    requestedSourceAsOfDate ?? predictionCutoffAt.slice(0, 10);
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
    allowBaselineBootstrap:
      readSingleQueryValue(req.query.allowBaselineBootstrap) === "true",
    dryRun: readSingleQueryValue(req.query.dryRun) === "true",
    // The default run reads its inputs now, at the cutoff, so the target
    // game's current lineup is admissible; an explicit cutoff or date is a
    // reconstruction and stays fail-closed.
    liveIssuance: requestedCutoffAt == null && requestedSourceAsOfDate == null,
  });

  // Only per-game errors fail the run. With no production model the run is an
  // explicit skip (decision 42), recorded with the same receipt fields as the
  // off-season skip, never as a plain success. `status` and the counts say
  // what was actually written.
  const outcome = summarizePredictionWindowOutcome(result);
  const skippedForNoModel = outcome.status === "no_production_model";
  return res.status(200).json({
    success: outcome.failedGames === 0,
    ...(skippedForNoModel
      ? { skipped: true, outcome: "skipped", reason: "no_production_model" }
      : {}),
    ...outcome,
    result,
  });
}

export default adminOnly(withCronJobAudit(withNhlOffSeasonSkip(handler as any), {
  jobName: "game-predictions-forecast",
}));
