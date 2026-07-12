import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { Database } from "lib/supabase/database-generated.types";
import {
  buildTeamUnitToiSnapshotRows,
  createTeamUnitToiBuildRequest,
  upsertTeamUnitToiRows,
} from "lib/rankings/teamUnitToiWriter";
import adminOnly from "utils/adminOnlyMiddleware";

type RequestWithSupabase = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  supabase: SupabaseClient<Database>;
};

function first(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function readInteger(
  value: string | string[] | undefined,
  fallback: number | null,
  options: { min?: number; max?: number } = {},
) {
  const raw = first(value);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return fallback;
  if (options.min != null && parsed < options.min) return fallback;
  if (options.max != null && parsed > options.max) return fallback;
  return parsed;
}

function readBoolean(value: string | string[] | undefined, fallback: boolean) {
  const raw = first(value).toLowerCase();
  if (["1", "true", "yes"].includes(raw)) return true;
  if (["0", "false", "no"].includes(raw)) return false;
  return fallback;
}

function readDate(value: string | string[] | undefined) {
  const raw = first(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function readCsvIntegers(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return Array.from(
    new Set(
      values
        .flatMap((entry) => entry.split(","))
        .map((entry) => Number(entry.trim()))
        .filter((entry) => Number.isInteger(entry) && entry > 0),
    ),
  );
}

async function handler(req: RequestWithSupabase, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const season = readInteger(req.query.season, null, {
      min: 19000000,
      max: 21000000,
    });
    if (season == null) {
      throw new Error("A numeric season query parameter is required.");
    }

    const request = createTeamUnitToiBuildRequest({
      season,
      snapshotDate: readDate(req.query.snapshot_date),
      gameIds: readCsvIntegers(req.query.gameIds ?? req.query.game_ids),
      startDate: readDate(req.query.startDate ?? req.query.start_date),
      endDate: readDate(req.query.endDate ?? req.query.end_date),
    });
    const dryRun = readBoolean(req.query.dryRun, true);
    const upsertChunkSize = readInteger(req.query.upsertChunkSize, 500, {
      min: 1,
      max: 500,
    });
    const built = await buildTeamUnitToiSnapshotRows(req.supabase, request);
    const rowsUpserted = dryRun
      ? 0
      : await upsertTeamUnitToiRows(req.supabase, built.rows, {
          chunkSize: upsertChunkSize ?? undefined,
        });

    return res.status(200).json({
      success: true,
      dryRun,
      request,
      generatedRows: built.rows.length,
      rowsUpserted,
      sourceCounts: built.sourceCounts,
      coverage: built.coverage,
      sampleRows: built.rows.slice(0, 5),
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update team unit TOI.",
    });
  }
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "update-team-unit-toi",
});
