import type { NextApiRequest, NextApiResponse } from "next";

import supabase from "lib/supabase/server";
import { parseMetricParam, parseWindowParam } from "lib/sustainability/bandService";
import { normalizeSustainabilityDate } from "lib/sustainability/dates";
import {
  summarizeCoverageAudit,
  type CoverageAuditRow
} from "lib/sustainability/coverageAudit";

function parseIntParam(value: string | string[] | undefined, fallback: number): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return fallback;
  const parsed = Number.parseInt(candidate, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseSeasonIdParam(value: string | string[] | undefined): number | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return null;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchAllRows<T>(buildQuery: (from: number, to: number) => any): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw error;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) {
      break;
    }
  }

  return rows;
}

async function fetchSeasonPlayerIds(args: {
  seasonId: number | null;
  limit: number;
  offset: number;
  playerId?: number | null;
}): Promise<number[]> {
  if (args.playerId && Number.isFinite(args.playerId)) {
    return [Number(args.playerId)];
  }

  let query = supabase
    .from("player_totals_unified")
    .select("player_id")
    .order("player_id", { ascending: true })
    .range(args.offset, args.offset + args.limit - 1);

  if (args.seasonId !== null) {
    query = query.eq("season_id", args.seasonId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => Number((row as any).player_id ?? Number.NaN))
        .filter((id) => Number.isFinite(id))
    )
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const playerId = Number(req.query.player_id);
  const seasonId = parseSeasonIdParam(req.query.season_id);
  const limit = Math.max(1, Math.min(500, parseIntParam(req.query.limit, 50)));
  const offset = Math.max(0, parseIntParam(req.query.offset, 0));
  const metricKey = parseMetricParam(req.query.metric)[0];
  const windowCode = parseWindowParam(req.query.window)[0];

  if (!metricKey || !windowCode) {
    return res.status(400).json({ success: false, message: "Missing metric or window" });
  }

  try {
    const playerIds = await fetchSeasonPlayerIds({
      seasonId,
      limit,
      offset,
      playerId: Number.isFinite(playerId) ? playerId : null
    });

    if (!playerIds.length) {
      return res.status(200).json({
        success: true,
        metric_key: metricKey,
        window_code: windowCode,
        season_id: seasonId,
        playersAudited: 0,
        rows: []
      });
    }

    const [playedRows, bandRows] = await Promise.all([
      fetchAllRows<any>((from, to) => {
        let query = supabase
          .from("player_stats_unified")
          .select("player_id,date,season_id")
          .in("player_id", playerIds)
          .order("player_id", { ascending: true })
          .order("date", { ascending: true })
          .range(from, to);
        if (seasonId !== null) {
          query = query.eq("season_id", seasonId);
        }
        return query;
      }),
      fetchAllRows<any>((from, to) => {
        let query = supabase
          .from("sustainability_trend_bands")
          .select("player_id,snapshot_date,season_id")
          .in("player_id", playerIds)
          .eq("metric_key", metricKey)
          .eq("window_code", windowCode)
          .order("player_id", { ascending: true })
          .order("snapshot_date", { ascending: true })
          .range(from, to);
        if (seasonId !== null) {
          query = query.eq("season_id", seasonId);
        }
        return query;
      })
    ]);

    const auditRowsByPlayer = new Map<number, CoverageAuditRow>();
    for (const id of playerIds) {
      auditRowsByPlayer.set(id, {
        playerId: id,
        playedDates: [],
        bandDates: []
      });
    }

    for (const row of playedRows ?? []) {
      const player = auditRowsByPlayer.get(Number((row as any).player_id));
      const rawDate = (row as any).date ?? "";
      const date = rawDate ? normalizeSustainabilityDate(String(rawDate), "") : "";
      if (player && date) {
        player.playedDates.push(date);
      }
    }

    for (const row of bandRows ?? []) {
      const player = auditRowsByPlayer.get(Number((row as any).player_id));
      const rawDate = (row as any).snapshot_date ?? "";
      const date = rawDate ? normalizeSustainabilityDate(String(rawDate), "") : "";
      if (player && date) {
        player.bandDates.push(date);
      }
    }

    const summary = summarizeCoverageAudit(Array.from(auditRowsByPlayer.values()));
    const worstPlayers = summary.playerSummaries
      .filter((row) => row.missingDateCount > 0)
      .sort((left, right) => {
        if (right.missingDateCount !== left.missingDateCount) {
          return right.missingDateCount - left.missingDateCount;
        }
        return left.coveragePct - right.coveragePct;
      })
      .slice(0, 25);

    return res.status(200).json({
      success: true,
      season_id: seasonId,
      metric_key: metricKey,
      window_code: windowCode,
      limit,
      offset,
      playersAudited: summary.playersAudited,
      playersWithGaps: summary.playersWithGaps,
      totalPlayedDates: summary.totalPlayedDates,
      totalMissingDates: summary.totalMissingDates,
      overallCoveragePct: summary.overallCoveragePct,
      worstPlayers
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message ?? String(error)
    });
  }
}
