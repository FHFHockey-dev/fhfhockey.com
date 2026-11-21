import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { createTrendRequestCache } from "lib/transactions/trendRequestCache";
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
  movementStartDate: string;
  movementEndDate: string;
  sparkline: TrendPoint[];
};

type YahooToNhlMap = Map<string, number>;

type SupabaseQueryClient = {
  from(table: string): any;
};

type TrendQueryClient = SupabaseQueryClient & {
  rpc(name: string, params: Record<string, number>, options: { get: true }): PromiseLike<{ data: any; error: unknown }>;
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

export async function fetchOwnershipPlayerRows(
  supabase: Pick<TrendQueryClient, "rpc">,
  season?: number,
): Promise<any[]> {
  const rows: any[] = [];
  const seenKeys = new Set<string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.rpc("homepage_yahoo_ownership_page", {
      p_offset: from,
      ...(season == null ? {} : { p_season: season }),
    }, { get: true });
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("Missing ownership page");
    for (const record of data) {
      const { observation_dates: dates, observation_values: values, page_count, ...row } = record;
      if (page_count !== data.length || typeof row.player_key !== "string" ||
          !row.player_key || seenKeys.has(row.player_key)) {
        throw new Error("Incomplete ownership page");
      }
      if (!Array.isArray(dates) || !Array.isArray(values) || dates.length !== values.length) {
        throw new Error("Incomplete ownership observations");
      }
      seenKeys.add(row.player_key);
      rows.push({
        ...row,
        ownership_timeline: dates.map((date: string, index: number) => ({ date, value: values[index] })),
      });
    }
    if (data.length < PAGE_SIZE) return rows;
  }
}

export async function fetchYahooPlayerRows(args: {
  supabase: SupabaseQueryClient;
  select: string;
  season?: number;
}): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = args.supabase.from("yahoo_players_with_normalized_history")
      .select(args.select)
      .order("player_id", { ascending: true })
      .order("season", { ascending: true, nullsFirst: true })
      .range(from, from + PAGE_SIZE - 1);
    if (args.season != null) query = query.eq("season", args.season);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
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

export async function fetchYahooToNhlMap(
  supabase: SupabaseQueryClient,
  yahooPlayerKeys: string[]
): Promise<YahooToNhlMap> {
  const uniqueKeys = Array.from(
    new Set(yahooPlayerKeys.filter((key) => /^\d+\.p\.\d+$/.test(key)))
  );
  if (uniqueKeys.length === 0) return new Map();

  const map: YahooToNhlMap = new Map();
  const ambiguous = new Set<string>();
  for (const keyChunk of chunk(uniqueKeys, MAP_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("yahoo_nhl_player_map_read")
      .select("nhl_player_id, yahoo_player_id")
      .in("yahoo_player_id", keyChunk);
    if (error) throw error;
    (data ?? []).forEach((row: any) => {
      const yahooKey = row?.yahoo_player_id;
      const nhlId = Number(row?.nhl_player_id);
      if (keyChunk.includes(yahooKey) && Number.isSafeInteger(nhlId) && nhlId > 0) {
        if (map.has(yahooKey) && map.get(yahooKey) !== nhlId) ambiguous.add(yahooKey);
        map.set(yahooKey, nhlId);
      }
    });
  }
  for (const key of ambiguous) map.delete(key);
  return map;
}

type TrendSnapshot = {
  rows: any[];
  seasonFallbackApplied: boolean;
  adpTimelines: Map<string, TrendPoint[]>;
  yahooToNhl: YahooToNhlMap;
};
const trendSnapshots = createTrendRequestCache<TrendSnapshot>(60_000, 4);
export function clearOwnershipTrendCache() { trendSnapshots.clear(); }

async function loadTrendSnapshot(
  supabase: TrendQueryClient,
  metric: TrendMetric,
  season?: number,
): Promise<TrendSnapshot> {
    const readRows = async (sourceSeason?: number) => {
      if (metric === "ownership") return fetchOwnershipPlayerRows(supabase, sourceSeason);
      const columns = "player_key, player_id, full_name, headshot_url, average_draft_pick";
      try {
        return await fetchYahooPlayerRows({
          supabase,
          select: columns + ", display_position, editorial_team_full_name, editorial_team_abbreviation, eligible_positions, uniform_number",
          season: sourceSeason,
        });
      } catch (error: any) {
        const missingColumns = /display_position|editorial_team_full_name|editorial_team_abbreviation|eligible_positions|uniform_number|column|does not exist/i;
        if (!missingColumns.test(String(error?.message ?? ""))) throw error;
        return fetchYahooPlayerRows({ supabase, select: columns, season: sourceSeason });
      }
    };
    let rows = await readRows(season);
    const seasonFallbackApplied = Boolean(season) && rows.length === 0;
    if (seasonFallbackApplied) rows = await readRows();
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
      rows.map((row) => String(row?.player_key ?? ""))
    );

    return { rows, seasonFallbackApplied, adpTimelines, yahooToNhl };
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

    // Share public source reads across pages/filters and simultaneous mounts.
    // Date remains part of the key because ownership windows use today's date.
    const snapshotKey = JSON.stringify([url, metric, season ?? null, new Date().toISOString().slice(0, 10)]);
    const { rows, seasonFallbackApplied, adpTimelines, yahooToNhl } =
      await trendSnapshots.get(snapshotKey, () => loadTrendSnapshot(supabase, metric, season));

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

      const nhlPlayerId =
        yahooToNhl.get(String(row.player_key)) ?? null;

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
        movementStartDate: previousPoint.date,
        movementEndDate: latestPoint.date,
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
      return yahooToNhl.has(String(row?.player_key));
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
