import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { withCronJobTiming } from "lib/cron/timingContract";
import supabase from "lib/supabase/server";
import {
  processSustainabilityRecomputeQueue,
  type SustainabilityRecomputeCursor,
} from "lib/sustainability/recomputeQueue";
import { resolveSeasonId } from "lib/sustainability/resolveSeasonId";
import adminOnly from "utils/adminOnlyMiddleware";
import { rebuildPriorsHandler } from "./rebuild-priors";
import { rebuildScoreHandler } from "./rebuild-score";
import { rebuildTrendBandsHandler } from "./rebuild-trend-bands";
import { rebuildWindowZHandler } from "./rebuild-window-z";

async function invokeStageHandler(
  handler: NextApiHandler,
  query: Record<string, string>,
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  let statusCode = 200;
  let body: Record<string, unknown> | undefined;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: Record<string, unknown>) {
      body = value;
      return this;
    },
    setHeader() {
      return this;
    },
  };
  await handler(
    {
      method: "GET",
      query,
      body: {},
      headers: {},
    } as unknown as NextApiRequest,
    response as unknown as NextApiResponse,
  );
  if (!body) {
    throw new Error("Sustainability recompute stage returned no receipt");
  }
  return { statusCode, body };
}

function numericReceiptField(
  body: Record<string, unknown>,
  field: string,
): number {
  const value = Number(body[field]);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Sustainability recompute stage count is invalid");
  }
  return value;
}

export async function runCanonicalSustainabilityStage(
  cursor: SustainabilityRecomputeCursor,
  job: {
    configRevision: number;
    modelVersion: string;
    configHash: string;
  },
) {
  const resolvedSeasonId =
    cursor.stage === "finalize" || cursor.stage === "trend_bands"
      ? await resolveSeasonId(String(cursor.season))
      : null;
  if (cursor.stage === "finalize") {
    const { data, error } = await supabase.rpc(
      "finalize_sustainability_score_snapshot",
      {
        p_config_revision: job.configRevision,
        p_model_version: job.modelVersion,
        p_config_hash: job.configHash,
        p_season_id: resolvedSeasonId!,
        p_snapshot_date: cursor.snapshotDate,
      },
    );
    if (error) throw error;
    const receipt =
      data && typeof data === "object" && !Array.isArray(data) ? data : null;
    return {
      success: true,
      processed: numericReceiptField(
        receipt as Record<string, unknown>,
        "snapshotRows",
      ),
    };
  }
  const common = {
    season: String(cursor.season),
    snapshot_date: cursor.snapshotDate,
    offset: String(cursor.offset),
    limit: String(cursor.limit),
  };
  const invocation =
    cursor.stage === "priors"
      ? await invokeStageHandler(rebuildPriorsHandler as NextApiHandler, {
          ...common,
          offset: "0",
          limit: "2000",
        })
      : cursor.stage === "window_z"
        ? await invokeStageHandler(
            rebuildWindowZHandler as NextApiHandler,
            common,
          )
        : cursor.stage === "score"
          ? await invokeStageHandler(rebuildScoreHandler as NextApiHandler, {
              ...common,
              force: "true",
            })
          : await invokeStageHandler(
              rebuildTrendBandsHandler as NextApiHandler,
              {
                ...common,
                season_id: String(resolvedSeasonId),
              },
            );
  if (invocation.statusCode >= 300 || invocation.body.success !== true) {
    throw new Error("Sustainability recompute stage failed");
  }
  const processed =
    cursor.stage === "priors"
      ? numericReceiptField(invocation.body, "inserted_player_rows")
      : cursor.stage === "trend_bands"
        ? numericReceiptField(invocation.body, "processed")
        : numericReceiptField(invocation.body, "processed_players");
  return { success: true, processed };
}

export async function processRecomputeQueueHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const started = Date.now();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res
      .status(405)
      .json(
        withCronJobTiming(
          { success: false, message: "Method not allowed" },
          started,
        ),
      );
  }
  try {
    const result = await processSustainabilityRecomputeQueue({
      client: supabase,
      runStage: runCanonicalSustainabilityStage,
    });
    return res
      .status(200)
      .json(withCronJobTiming({ success: true, ...result }, started));
  } catch {
    return res
      .status(500)
      .json(
        withCronJobTiming(
          { success: false, message: "Sustainability queue processing failed" },
          started,
        ),
      );
  }
}

export default withCronJobAudit(
  adminOnly(processRecomputeQueueHandler as any),
  {
    jobName: "process-sustainability-recompute-queue",
  },
);
