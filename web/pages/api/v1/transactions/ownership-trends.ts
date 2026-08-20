import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { normalizeDependencyError } from "lib/cron/normalizeDependencyError";
import {
  normalizeTrendPositions,
  normalizeTrendTeamAbbreviation,
  normalizeTrendTeamName,
} from "lib/transactions/ownershipTrendMetadata";

export type TrendMetric = "ownership" | "adp";
type TrendPoint = { date: string; value: number };
type TrendPlayer = {
  playerKey: string;
  playerId: number | null;
  name: string;
  headshot: string | null;
  displayPosition?: string | null;
  teamFullName?: string | null;
  teamAbbrev?: string | null;
  eligiblePositions?: string[] | null;
  uniformNumber?: number | null;
  latest: number;
  previous: number;
  delta: number;
  deltaPct: number;
  sparkline: TrendPoint[];
};

type YahooToNhlMap = Map<number, number>;

type SupabaseQueryClient = {
  from(table: string): any;
};

type OwnershipTrendPayload = {
  success: boolean;
  metric: TrendMetric;
  windowDays: number;
  generatedAt: string | null;
  sourceDate: string | null;
  requestedSeason: number | null;
  seasonFallbackApplied: boolean;
  mappedPlayerCount: number;
  unmappedPlayerCount: number;
  page: number;
  pageSize: number;
  offset: number;
  pos: string | null;
  totalRisers: number;
  totalFallers: number;
  risers: TrendPlayer[];
  fallers: TrendPlayer[];
  selectedPlayers?: TrendPlayer[];
};

const ALLOWED_WINDOWS = [1, 3, 5, 10];
const PAGE_SIZE = 1000;
const MAP_CHUNK_SIZE = 500;
const ADP_HISTORY_LOOKBACK_DAYS = 14;

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export async function fetchYahooPlayerRows(args: {
  supabase: SupabaseQueryClient;
  select: string;
  season?: number;
}): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = args.supabase
      .from("yahoo_players_with_normalized_history")
      .select(args.select)
      .order("player_id", { ascending: true })
      .order("season", { ascending: true, nullsFirst: true })
      .range(from, from + PAGE_SIZE - 1);
    if (args.season != null) query = query.eq("season", args.season);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchYahooDraftHistoryRows(args: {
  supabase: SupabaseQueryClient;
  capturedAfter: string;
}): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await args.supabase
      .from("yahoo_player_draft_analysis_history")
      .select("player_key,captured_at,average_draft_pick")
      .gte("captured_at", args.capturedAfter)
      .gt("average_draft_pick", 0)
      .order("player_key", { ascending: true })
      .order("captured_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

export function buildAdpTimelines(rows: any[]): Map<string, TrendPoint[]> {
  const timelines = new Map<
    string,
    Map<string, { capturedAt: string; value: number }>
  >();

  rows.forEach((row) => {
    const playerKey =
      typeof row?.player_key === "string" ? row.player_key.trim() : "";
    const capturedAt =
      typeof row?.captured_at === "string" ? row.captured_at : "";
    const date = capturedAt.slice(0, 10);
    const value = Number(row?.average_draft_pick);
    if (
      !playerKey ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(value) ||
      value <= 0
    ) {
      return;
    }

    const pointsByDate = timelines.get(playerKey) ?? new Map();
    const existing = pointsByDate.get(date);
    if (!existing || capturedAt >= existing.capturedAt) {
      pointsByDate.set(date, { capturedAt, value });
    }
    timelines.set(playerKey, pointsByDate);
  });

  return new Map(
    Array.from(timelines.entries()).map(([playerKey, pointsByDate]) => [
      playerKey,
      Array.from(pointsByDate.entries())
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .map(([date, point]) => ({ date, value: point.value }))
    ])
  );
}

export function calculateTrendMovement(
  metric: TrendMetric,
  latest: number,
  previous: number
): { delta: number; deltaPct: number } | null {
  if (!Number.isFinite(latest) || !Number.isFinite(previous)) return null;
  if (metric === "adp" && (latest <= 0 || previous <= 0)) return null;

  const rawDelta = metric === "adp" ? previous - latest : latest - previous;
  const rawDeltaPct =
    metric === "adp" ? (rawDelta / previous) * 100 : rawDelta;
  if (!Number.isFinite(rawDelta) || !Number.isFinite(rawDeltaPct)) return null;

  return {
    delta: Number(rawDelta.toFixed(2)),
    deltaPct: Number(rawDeltaPct.toFixed(2))
  };
}

function latestTimelineDate(
  timelines: Array<Array<{ date: string }>>
): string | null {
  return timelines.reduce<string | null>((latest, timeline) => {
    return timeline.reduce((timelineLatest: string | null, point) => {
      return point.date && (!timelineLatest || point.date > timelineLatest)
        ? point.date
        : timelineLatest;
    }, latest);
  }, null);
}

export function matchesPositionFilter(
  filter: string | null,
  eligiblePositions: string[] | null,
  displayPositionTokens: string[]
): boolean {
  if (!filter) return true;
  const positions = new Set([...(eligiblePositions ?? []), ...displayPositionTokens]);
  if (filter === "F") {
    return ["F", "C", "LW", "RW", "W"].some((position) => positions.has(position));
  }
  return positions.has(filter);
}

export function latestOwnershipTimelineDate(rows: any[]): string | null {
  return latestTimelineDate(
    rows.map((row) =>
      Array.isArray(row?.ownership_timeline)
        ? row.ownership_timeline.filter(
            (point: any): point is { date: string } =>
              typeof point?.date === "string"
          )
        : []
    )
  );
}

function resolveKey(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("Missing Supabase key env var");
  return { url, key };
}

async function fetchYahooToNhlMap(
  supabase: SupabaseQueryClient,
  yahooPlayerIds: number[]
): Promise<YahooToNhlMap> {
  const uniqueIds = Array.from(
    new Set(yahooPlayerIds.filter((id) => Number.isFinite(id)))
  );
  if (uniqueIds.length === 0) return new Map();

  const map: YahooToNhlMap = new Map();
  for (const idChunk of chunk(uniqueIds, MAP_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("yahoo_nhl_player_map_read")
      .select("nhl_player_id, yahoo_player_id")
      .in("yahoo_player_id", idChunk.map(String));
    if (error) throw error;
    (data ?? []).forEach((row: any) => {
      const yahooId = Number(row?.yahoo_player_id);
      const nhlId = Number(row?.nhl_player_id);
      if (Number.isFinite(yahooId) && Number.isFinite(nhlId)) {
        map.set(yahooId, nhlId);
      }
    });
  }
  return map;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const windowParam = parseInt(String(req.query.window ?? "5"), 10);
    const windowDays = ALLOWED_WINDOWS.includes(windowParam) ? windowParam : 5;
    const metric: TrendMetric =
      String(req.query.metric ?? "").toLowerCase() === "adp"
        ? "adp"
        : "ownership";
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit ?? "10"), 10))
    );
    const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10));
    const posFilterRaw = String(req.query.pos ?? "").trim();
    const posFilter = posFilterRaw ? posFilterRaw.toUpperCase() : null;
    const season = req.query.season ? Number(req.query.season) : undefined;
    const playerIds = String(req.query.playerIds ?? "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));
    const playerIdSet =
      playerIds.length > 0 ? new Set(playerIds) : null;
    const includeFlat =
      String(req.query.includeFlat ?? "").toLowerCase() === "1" ||
      String(req.query.includeFlat ?? "").toLowerCase() === "true";

    const { url, key } = resolveKey();
    const supabase = createClient(url, key, {
      auth: { persistSession: false }
    });

    const metricSelect =
      metric === "adp"
        ? "average_draft_pick"
        : "ownership_timeline:normalized_ownership_timeline";
    const selectWithMeta = `player_key, player_id, full_name, headshot_url, display_position, editorial_team_full_name, editorial_team_abbreviation, eligible_positions, uniform_number, ${metricSelect}`;
    const selectMinimal = `player_key, player_id, full_name, headshot_url, ${metricSelect}`;

    let data: any[] = [];
    let seasonFallbackApplied = false;
    try {
      data = await fetchYahooPlayerRows({
        supabase,
        select: selectWithMeta,
        season
      });
    } catch (error: any) {
      const msg = String(error.message || "").toLowerCase();
      const missingCols =
        msg.includes("display_position") ||
        msg.includes("editorial_team_full_name") ||
        msg.includes("editorial_team_abbreviation") ||
        msg.includes("eligible_positions") ||
        msg.includes("uniform_number") ||
        msg.includes("column") ||
        msg.includes("does not exist");
      if (!missingCols) throw error;
      data = await fetchYahooPlayerRows({
        supabase,
        select: selectMinimal,
        season
      });
    }
    if (data.length === 0 && season) {
      seasonFallbackApplied = true;
      try {
        data = await fetchYahooPlayerRows({
          supabase,
          select: selectWithMeta
        });
      } catch (error: any) {
        const msg = String(error.message || "").toLowerCase();
        const missingCols =
          msg.includes("display_position") ||
          msg.includes("editorial_team_full_name") ||
          msg.includes("editorial_team_abbreviation") ||
          msg.includes("eligible_positions") ||
          msg.includes("uniform_number") ||
          msg.includes("column") ||
          msg.includes("does not exist");
        if (!missingCols) throw error;
        data = await fetchYahooPlayerRows({
          supabase,
          select: selectMinimal
        });
      }
    }
    const rows: any[] = Array.isArray(data) ? data : [];
    let adpTimelines = new Map<string, TrendPoint[]>();
    if (metric === "adp") {
      const capturedAfter = new Date();
      capturedAfter.setUTCDate(
        capturedAfter.getUTCDate() - ADP_HISTORY_LOOKBACK_DAYS
      );
      capturedAfter.setUTCHours(0, 0, 0, 0);
      adpTimelines = buildAdpTimelines(
        await fetchYahooDraftHistoryRows({
          supabase,
          capturedAfter: capturedAfter.toISOString()
        })
      );
    }
    const yahooToNhl = await fetchYahooToNhlMap(
      supabase,
      rows
        .map((row) => Number(row?.player_id))
        .filter((id) => Number.isFinite(id))
    );

    const risers: TrendPlayer[] = [];
    const fallers: TrendPlayer[] = [];
    const selectedPlayers: TrendPlayer[] = [];

    for (const row of rows) {
      if (metric === "adp") {
        const currentAveragePick = Number(row.average_draft_pick);
        if (!Number.isFinite(currentAveragePick) || currentAveragePick <= 0) {
          continue;
        }
      }

      const tl: TrendPoint[] =
        metric === "adp"
          ? [...(adpTimelines.get(String(row.player_key)) ?? [])]
          : Array.isArray(row.ownership_timeline)
            ? (row.ownership_timeline as TrendPoint[])
            : [];
      if (tl.length < 2) continue;
      tl.sort((a, b) => a.date.localeCompare(b.date));
      const latestPoint = tl[tl.length - 1];
      if (typeof latestPoint?.value !== "number") continue;

      const targetDateObj =
        metric === "adp"
          ? new Date(`${latestPoint.date}T00:00:00.000Z`)
          : new Date();
      targetDateObj.setUTCDate(targetDateObj.getUTCDate() - windowDays);
      const targetDateStr = targetDateObj.toISOString().slice(0, 10);

      // Find previous value at or before target date
      let previousPoint: TrendPoint | undefined = tl.find(
        (p) => p.date === targetDateStr
      );
      if (!previousPoint) {
        for (let i = tl.length - 2; i >= 0; i--) {
          if (tl[i].date <= targetDateStr) {
            previousPoint = tl[i];
            break;
          }
        }
      }
      if (!previousPoint) continue;

      const latest = Number(latestPoint.value);
      const previous = Number(previousPoint.value);
      const movement = calculateTrendMovement(metric, latest, previous);
      if (!movement) continue;
      const { delta, deltaPct } = movement;

      const sparkSlice = tl.slice(-Math.max(12, windowDays + 2));

      // Normalize positions
      const normalizedEligiblePositions = normalizeTrendPositions(
        row.eligible_positions
      );
      const eligiblePositions = normalizedEligiblePositions.length
        ? normalizedEligiblePositions
        : null;
      const displayPosTokens = normalizeTrendPositions(row.display_position);

      // Optional position filter
      if (posFilter) {
        if (!matchesPositionFilter(posFilter, eligiblePositions, displayPosTokens)) continue;
      }

      const yahooPlayerId =
        row.player_id == null || Number.isNaN(Number(row.player_id))
          ? null
          : Number(row.player_id);
      const nhlPlayerId =
        yahooPlayerId != null ? yahooToNhl.get(yahooPlayerId) ?? null : null;

      const obj: TrendPlayer = {
        playerKey: row.player_key,
        playerId: nhlPlayerId,
        name: row.full_name || row.player_key,
        headshot: row.headshot_url || null,
        displayPosition: displayPosTokens.join(", ") || null,
        teamFullName: normalizeTrendTeamName(
          row.editorial_team_full_name
        ),
        teamAbbrev: normalizeTrendTeamAbbreviation(
          row.editorial_team_abbreviation
        ),
        eligiblePositions,
        uniformNumber:
          typeof row.uniform_number === "number" ? row.uniform_number : null,
        latest,
        previous,
        delta,
        deltaPct,
        sparkline: sparkSlice
      };

      if (playerIdSet?.has(obj.playerId ?? Number.NaN)) {
        selectedPlayers.push(obj);
      }

      if (delta > 0) risers.push(obj);
      else if (delta < 0) fallers.push(obj);
      else if (!includeFlat) continue;
    }

    const sortValue = (player: TrendPlayer) =>
      metric === "adp" ? player.deltaPct : player.delta;
    risers.sort((a, b) => sortValue(b) - sortValue(a));
    fallers.sort((a, b) => sortValue(a) - sortValue(b));

    const totalRisers = risers.length;
    const totalFallers = fallers.length;
    const sourceDate =
      metric === "adp"
        ? latestTimelineDate(Array.from(adpTimelines.values()))
        : latestOwnershipTimelineDate(rows);
    const mappedPlayerCount = rows.filter((row) => {
      const yahooId = Number(row?.player_id);
      return Number.isFinite(yahooId) && yahooToNhl.has(yahooId);
    }).length;
    const unmappedPlayerCount = rows.length - mappedPlayerCount;
    const risersPage = risers.slice(offset, offset + limit);
    const fallersPage = fallers.slice(offset, offset + limit);

    const payload: OwnershipTrendPayload = {
      success: true,
      metric,
      windowDays,
      generatedAt: sourceDate ? `${sourceDate}T23:59:59.999Z` : null,
      sourceDate,
      requestedSeason: season ?? null,
      seasonFallbackApplied,
      mappedPlayerCount,
      unmappedPlayerCount,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      offset,
      pos: posFilter,
      totalRisers,
      totalFallers,
      risers: risersPage,
      fallers: fallersPage,
      ...(playerIdSet ? { selectedPlayers } : {})
    };
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    return res.status(200).json(payload);
  } catch (err: any) {
    const normalized = normalizeDependencyError(err);
    console.error("ownership-trends error", {
      message: normalized.message,
      detail: normalized.detail
    });
    return res
      .status(normalized.source === "supabase_or_proxy" ? 503 : 500)
      .json({
        success: false,
        error: "OWNERSHIP_TRENDS_UNAVAILABLE"
      });
  }
}
