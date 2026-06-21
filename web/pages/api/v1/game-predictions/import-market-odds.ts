import type { NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  importHistoricalMarketOddsSnapshots,
  type HistoricalMarketOddsImportRow,
} from "lib/game-predictions/espnOdds";
import {
  fetchAccuracyLoopExpectedMarketOddsGameIds,
  type AccuracyLoopExpectedMarketOddsGameIds,
  type AccuracyLoopExpectedMarketOddsGameWindow,
} from "lib/game-predictions/accountability";
import type { Database } from "lib/supabase/database-generated.types";
import adminOnly from "utils/adminOnlyMiddleware";

type RequestWithSupabase = {
  method?: string;
  query: {
    dryRun?: string | string[];
    allowPartialExpectedCoverage?: string | string[];
    confirmWrite?: string | string[];
  };
  body?: {
    rows?: HistoricalMarketOddsImportRow[];
    expectedGameIds?: number[];
    expectedWindow?: Partial<AccuracyLoopExpectedMarketOddsGameWindow>;
    importedAt?: string;
    importBatchId?: string;
    dryRun?: boolean;
    allowPartialExpectedCoverage?: boolean;
    confirmWrite?: boolean;
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

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberArrayValue(value: unknown, minValue = 1): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.filter(
    (item): item is number => Number.isInteger(item) && item >= minValue,
  );
  return values.length > 0 ? Array.from(new Set(values)) : undefined;
}

function readExpectedWindow(
  value: Partial<AccuracyLoopExpectedMarketOddsGameWindow> | undefined,
): AccuracyLoopExpectedMarketOddsGameWindow | null {
  const seasonId = numberValue(value?.seasonId);
  if (!seasonId) return null;
  return {
    seasonId,
    gameType: numberValue(value?.gameType),
    trainStartDate: stringValue(value?.trainStartDate),
    blindDate: stringValue(value?.blindDate),
    replayEndDate: stringValue(value?.replayEndDate),
    analysisEndDate: stringValue(value?.analysisEndDate),
    horizonDays: numberArrayValue(value?.horizonDays, 0),
    maxSimulationDays: numberValue(value?.maxSimulationDays),
    maxTrainingGames: numberValue(value?.maxTrainingGames),
    maxReplayGames: numberValue(value?.maxReplayGames),
  };
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

  const explicitExpectedGameIds = numberArrayValue(req.body?.expectedGameIds);
  let expectedWindow: AccuracyLoopExpectedMarketOddsGameIds | null = null;
  if (!explicitExpectedGameIds?.length) {
    const windowRequest = readExpectedWindow(req.body?.expectedWindow);
    if (windowRequest) {
      expectedWindow = await fetchAccuracyLoopExpectedMarketOddsGameIds({
        client: req.supabase,
        window: windowRequest,
      });
    }
  }

  const dryRun = readBoolean(req.query.dryRun, req.body?.dryRun, true);
  const confirmWrite = readBoolean(
    req.query.confirmWrite,
    req.body?.confirmWrite,
    false,
  );
  if (!dryRun && !confirmWrite) {
    return res.status(400).json({
      success: false,
      error:
        "Writing historical market odds requires confirmWrite=true.",
    });
  }
  const allowIncompleteExpectedCoverage = readBoolean(
    req.query.allowPartialExpectedCoverage,
    req.body?.allowPartialExpectedCoverage,
    false,
  );

  const result = await importHistoricalMarketOddsSnapshots({
    client: req.supabase,
    rows,
    expectedGameIds: explicitExpectedGameIds ?? expectedWindow?.gameIds,
    importedAt: req.body?.importedAt,
    importBatchId: req.body?.importBatchId,
    dryRun,
    allowIncompleteExpectedCoverage,
  });

  const statusCode = result.blocked ? 409 : 200;
  return res.status(statusCode).json({
    success: !result.blocked,
    error: result.blocked
      ? "Historical market odds import blocked by preflight coverage guardrails."
      : undefined,
    dryRun: result.dryRun,
    expectedGameSource: explicitExpectedGameIds?.length
      ? "body_expected_game_ids"
      : expectedWindow
        ? "expected_window"
        : "none",
    expectedWindow,
    result,
  });
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "game-predictions-import-market-odds",
});
