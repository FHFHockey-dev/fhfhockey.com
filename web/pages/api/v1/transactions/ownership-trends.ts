import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { normalizeDependencyError } from "lib/cron/normalizeDependencyError";

type OwnershipPoint = { date: string; value: number };
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
  sparkline: OwnershipPoint[];
};

type YahooToNhlMap = Map<number, number>;

type SupabaseQueryClient = {
  from(table: string): any;
};

type OwnershipTrendPayload = {
  success: boolean;
  windowDays: number;
  generatedAt: string;
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

  const { data, error } = await supabase
    .from("yahoo_nhl_player_map_mat")
    .select("nhl_player_id, yahoo_player_id")
    .in("yahoo_player_id", uniqueIds.map(String));

  if (error) throw error;

  const map: YahooToNhlMap = new Map();
  (data ?? []).forEach((row: any) => {
    const yahooId = Number(row?.yahoo_player_id);
    const nhlId = Number(row?.nhl_player_id);
    if (Number.isFinite(yahooId) && Number.isFinite(nhlId)) {
      map.set(yahooId, nhlId);
    }
  });
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

    const selectWithMeta =
      "player_key, player_id, full_name, headshot_url, display_position, editorial_team_full_name, editorial_team_abbreviation, eligible_positions, uniform_number, ownership_timeline";
    const selectMinimal =
      "player_key, player_id, full_name, headshot_url, ownership_timeline";

    // Try metadata fields first
    let query = supabase
      .from("yahoo_players")
      .select(selectWithMeta)
      .limit(2500);
    if (season) query = query.eq("season", season);
    let data: any[] | null = null;
    let error: any = null;
    {
      const r1 = await query;
      data = (r1.data as any[] | null) ?? null;
      error = r1.error;
    }

    if (error) {
      const msg = String(error.message || "").toLowerCase();
      const missingCols =
        msg.includes("display_position") ||
        msg.includes("editorial_team_full_name") ||
        msg.includes("editorial_team_abbreviation") ||
        msg.includes("eligible_positions") ||
        msg.includes("uniform_number") ||
        msg.includes("column") ||
        msg.includes("does not exist");
      if (missingCols) {
        let fb = supabase
          .from("yahoo_players")
          .select(selectMinimal)
          .limit(2500);
        if (season) fb = fb.eq("season", season);
        const r2 = await fb;
        data = (r2.data as any[] | null) ?? null;
        error = r2.error;
      }
    }
    if (error) throw error;
    if ((!data || data.length === 0) && season) {
      let fallback = supabase
        .from("yahoo_players")
        .select(selectWithMeta)
        .limit(2500);
      let r3: any = await fallback;
      data = (r3.data as any[] | null) ?? null;
      error = r3.error;

      if (error) {
        const msg = String(error.message || "").toLowerCase();
        const missingCols =
          msg.includes("display_position") ||
          msg.includes("editorial_team_full_name") ||
          msg.includes("editorial_team_abbreviation") ||
          msg.includes("eligible_positions") ||
          msg.includes("uniform_number") ||
          msg.includes("column") ||
          msg.includes("does not exist");
        if (missingCols) {
          r3 = await supabase
            .from("yahoo_players")
            .select(selectMinimal)
            .limit(2500);
          data = (r3.data as any[] | null) ?? null;
          error = r3.error;
        }
      }
      if (error) throw error;
    }
    const rows: any[] = Array.isArray(data) ? (data as any[]) : [];
    const yahooToNhl = await fetchYahooToNhlMap(
      supabase,
      rows
        .map((row) => Number(row?.player_id))
        .filter((id) => Number.isFinite(id))
    );

    const today = new Date();
    const targetDateObj = new Date(today);
    targetDateObj.setDate(targetDateObj.getDate() - windowDays);
    const targetDateStr = targetDateObj.toISOString().slice(0, 10);

    const risers: TrendPlayer[] = [];
    const fallers: TrendPlayer[] = [];
    const selectedPlayers: TrendPlayer[] = [];

    for (const row of rows) {
      const tl: OwnershipPoint[] = Array.isArray(row.ownership_timeline)
        ? (row.ownership_timeline as OwnershipPoint[])
        : [];
      if (tl.length < 2) continue;
      tl.sort((a, b) => a.date.localeCompare(b.date));
      const latestPoint = tl[tl.length - 1];
      if (typeof latestPoint?.value !== "number") continue;

      // Find previous value at or before target date
      let previousPoint: OwnershipPoint | undefined = tl.find(
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
      const delta = Number((latest - previous).toFixed(2));
      if (!Number.isFinite(delta)) continue;

      const sparkSlice = tl.slice(-Math.max(12, windowDays + 2));

      // Normalize positions
      const eligibleRaw = row.eligible_positions;
      let eligiblePositions: string[] | null = null;
      if (Array.isArray(eligibleRaw)) {
        eligiblePositions = eligibleRaw.map((p: any) =>
          String(p).toUpperCase()
        );
      } else if (typeof eligibleRaw === "string") {
        eligiblePositions = [eligibleRaw.toUpperCase()];
      }
      const displayPosTokens = (row.display_position || "")
        .toString()
        .toUpperCase()
        .split(/[\s,/]+/)
        .filter(Boolean);

      // Optional position filter
      if (posFilter) {
        const all = new Set<string>([
          ...(eligiblePositions ?? []),
          ...displayPosTokens
        ]);
        if (!all.has(posFilter)) continue;
      }

      const yahooPlayerId =
        row.player_id == null || Number.isNaN(Number(row.player_id))
          ? null
          : Number(row.player_id);
      const nhlPlayerId =
        yahooPlayerId != null ? yahooToNhl.get(yahooPlayerId) ?? yahooPlayerId : null;

      const obj: TrendPlayer = {
        playerKey: row.player_key,
        playerId: nhlPlayerId,
        name: row.full_name || row.player_key,
        headshot: row.headshot_url || null,
        displayPosition: row.display_position ?? null,
        teamFullName: row.editorial_team_full_name ?? null,
        teamAbbrev: row.editorial_team_abbreviation ?? null,
        eligiblePositions,
        uniformNumber:
          typeof row.uniform_number === "number" ? row.uniform_number : null,
        latest,
        previous,
        delta,
        deltaPct: delta,
        sparkline: sparkSlice
      };

      if (playerIdSet?.has(obj.playerId ?? Number.NaN)) {
        selectedPlayers.push(obj);
      }

      if (delta > 0) risers.push(obj);
      else if (delta < 0) fallers.push(obj);
      else if (!includeFlat) continue;
    }

    risers.sort((a, b) => b.delta - a.delta);
    fallers.sort((a, b) => a.delta - b.delta);

    const totalRisers = risers.length;
    const totalFallers = fallers.length;
    const risersPage = risers.slice(offset, offset + limit);
    const fallersPage = fallers.slice(offset, offset + limit);

    const payload: OwnershipTrendPayload = {
      success: true,
      windowDays,
      generatedAt: new Date().toISOString(),
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
        error: normalized.message,
        ...(normalized.detail ? { detail: normalized.detail } : {})
      });
  }
}
