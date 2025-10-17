import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import {
  computeAndStoreTrendBands,
  computeAndStoreTrendBandHistory,
  parseDateParam,
  parseMetricParam,
  parseWindowParam
} from "lib/sustainability/bandService";
import type { SustainabilityMetricKey } from "lib/sustainability/bands";
import { WindowCode } from "lib/sustainability/windows";

type Summary = {
  player_id: number;
  bands_computed: number;
  snapshots?: number;
  season_ids?: Array<number | null>;
};

type ErrorSummary = {
  player_id: number;
  message: string;
};

function parseBoolean(value: string | string[] | undefined): boolean {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return false;
  return ["1", "true", "yes", "on"].includes(candidate.toLowerCase());
}

function parseOptionalDateParam(
  value: string | string[] | undefined
): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
}

function parseIntParam(
  value: string | string[] | undefined,
  fallback: number
): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return fallback;
  const parsed = Number.parseInt(candidate, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function fetchPlayerIds(
  offset: number,
  limit: number
): Promise<number[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id")
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? [])
    .map((row) => Number((row as any).id ?? Number.NaN))
    .filter((id) => Number.isFinite(id));
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET,POST");
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  const snapshotDate = parseDateParam(
    req.body?.snapshot_date ?? req.query.snapshot_date
  );
  const startDate = parseOptionalDateParam(
    req.body?.start_date ?? req.query.start_date
  );
  const endDateOverride = parseOptionalDateParam(
    req.body?.end_date ?? req.query.end_date
  );
  const metrics: SustainabilityMetricKey[] = parseMetricParam(
    req.body?.metrics ?? req.query.metric
  );
  const windows: WindowCode[] = parseWindowParam(
    req.body?.windows ?? req.query.window
  );
  const limit = Math.max(
    1,
    parseIntParam(req.body?.limit ?? req.query.limit, 250)
  );
  const offset = Math.max(
    0,
    parseIntParam(req.body?.offset ?? req.query.offset, 0)
  );
  const dry = parseBoolean(req.body?.dry ?? req.query.dry);
  const gameLimit = Math.max(
    1,
    parseIntParam(req.body?.game_limit ?? req.query.game_limit, 40)
  );
  const historyRequested =
    parseBoolean(req.body?.history ?? req.query.history) ||
    Boolean(startDate) ||
    Boolean(endDateOverride);
  const effectiveEndDate = endDateOverride ?? snapshotDate;

  try {
    const playerIds = await fetchPlayerIds(offset, limit);
    if (!playerIds.length) {
      return res.status(200).json({
        success: true,
        history: historyRequested,
        start_date: startDate ?? null,
        snapshot_date: effectiveEndDate,
        processed: 0,
        snapshots_processed: 0,
        computed_bands: 0,
        updated_bands: 0,
        summaries: [],
        errors: []
      });
    }

    const summaries: Summary[] = [];
    const errors: ErrorSummary[] = [];
    let totalBands = 0;
    let totalSnapshots = 0;

    for (const playerId of playerIds) {
      try {
        if (historyRequested) {
          const result = await computeAndStoreTrendBandHistory({
            playerId,
            metrics,
            windows,
            startDate,
            endDate: effectiveEndDate,
            gameLimit,
            dry
          });
          totalBands += result.totalRows;
          totalSnapshots += result.snapshots;
          const summary: Summary = {
            player_id: playerId,
            bands_computed: result.totalRows
          };
          if (result.snapshots) {
            summary.snapshots = result.snapshots;
          }
          if (result.seasonIds.length) {
            summary.season_ids = result.seasonIds;
          }
          summaries.push(summary);
        } else {
          const { rows } = await computeAndStoreTrendBands({
            playerId,
            snapshotDate: effectiveEndDate,
            metrics,
            windows,
            gameLimit,
            dry
          });
          totalBands += rows.length;
          summaries.push({ player_id: playerId, bands_computed: rows.length });
        }
      } catch (error: any) {
        // eslint-disable-next-line no-console
        console.error(
          "trend-band bulk error",
          playerId,
          error?.message ?? error
        );
        errors.push({
          player_id: playerId,
          message: error?.message ?? String(error)
        });
      }
    }

    return res.status(200).json({
      success: true,
      history: historyRequested,
      start_date: startDate ?? null,
      snapshot_date: effectiveEndDate,
      dry_run: dry,
      processed: playerIds.length,
      snapshots_processed: totalSnapshots,
      computed_bands: totalBands,
      updated_bands: dry ? 0 : totalBands,
      summaries,
      errors
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("rebuild-trend-bands error", error?.message ?? error);
    return res
      .status(500)
      .json({ success: false, message: error?.message ?? String(error) });
  }
}

export default handler;
