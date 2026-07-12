import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type SnapshotRow = {
  playerId: number;
  ownership: number | null;
};

type PlayerIdResolution = {
  requestedId: string;
  yahooPlayerId: string;
};

type SupabaseQueryClient = {
  from(table: string): any;
};

const ID_CHUNK_SIZE = 500;

function chunk<T>(values: T[], size = ID_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
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

const normalizePlayerIds = (raw: string | string[] | undefined): string[] => {
  if (!raw) return [];
  const joined = Array.isArray(raw) ? raw.join(",") : raw;
  return joined
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
};

const resolveOwnership = (row: Record<string, unknown>): number | null => {
  const timeline = Array.isArray(row.ownership_timeline)
    ? [...(row.ownership_timeline as Array<{ date?: unknown; value?: unknown }>)]
        .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")))
    : [];
  const latestPoint = timeline[timeline.length - 1];
  const latestValue =
    latestPoint && typeof latestPoint.value === "number" && Number.isFinite(latestPoint.value)
      ? latestPoint.value
      : null;

  if (latestValue != null) return latestValue;

  const fallback =
    typeof row.percent_ownership === "number" && Number.isFinite(row.percent_ownership)
      ? row.percent_ownership
      : row.percent_ownership != null
        ? Number(row.percent_ownership)
        : null;

  return fallback != null && Number.isFinite(fallback) ? fallback : null;
};

function getLatestTimelineDate(row: Record<string, unknown>): string | null {
  const timeline = Array.isArray(row.ownership_timeline)
    ? (row.ownership_timeline as Array<{ date?: unknown }>)
    : [];
  return timeline.reduce<string | null>((latest, point) => {
    const date = typeof point?.date === "string" ? point.date : null;
    return date && (!latest || date > latest) ? date : latest;
  }, null);
}

async function resolveYahooPlayerIds(
  supabase: SupabaseQueryClient,
  playerIds: string[]
): Promise<PlayerIdResolution[]> {
  const byNhlId = new Map<string, string>();
  for (const idChunk of chunk(playerIds)) {
    const { data, error } = await supabase
      .from("yahoo_nhl_player_map_mat")
      .select("nhl_player_id, yahoo_player_id")
      .in("nhl_player_id", idChunk);
    if (error) throw error;
    (data ?? []).forEach((row: any) => {
      const nhlPlayerId = row?.nhl_player_id != null ? String(row.nhl_player_id) : null;
      const yahooPlayerId =
        row?.yahoo_player_id != null ? String(row.yahoo_player_id) : null;
      if (nhlPlayerId && yahooPlayerId) byNhlId.set(nhlPlayerId, yahooPlayerId);
    });
  }

  const unresolvedIds = playerIds.filter((playerId) => !byNhlId.has(playerId));
  if (unresolvedIds.length > 0) {
    const namesById = new Map<string, string>();
    for (const idChunk of chunk(unresolvedIds)) {
      const { data: players, error: playersError } = await supabase
        .from("players")
        .select("id, fullName")
        .in("id", idChunk.map(Number));
      if (playersError) throw playersError;
      (players ?? []).forEach((row: any) => {
        const id = row?.id != null ? String(row.id) : null;
        const name = typeof row?.fullName === "string" ? row.fullName.trim() : "";
        if (id && name) namesById.set(id, name);
      });
    }

    const names = Array.from(new Set(namesById.values()));
    if (names.length > 0) {
      const yahooRows: any[] = [];
      for (const nameChunk of chunk(names, 100)) {
        const { data, error: yahooError } = await supabase
          .from("yahoo_players")
          .select("player_id, full_name, player_name, ownership_timeline, season")
          .in("full_name", nameChunk)
          .order("player_id", { ascending: true })
          .order("season", { ascending: true, nullsFirst: true })
          .range(0, 999);
        if (yahooError) throw yahooError;
        yahooRows.push(...(data ?? []));
      }

      const yahooByName = new Map<string, Record<string, unknown>>();
      (yahooRows ?? []).forEach((row: any) => {
        const name =
          typeof row?.full_name === "string"
            ? row.full_name.trim()
            : typeof row?.player_name === "string"
              ? row.player_name.trim()
              : "";
        if (!name) return;

        const existing = yahooByName.get(name);
        const existingTimelineDate = existing ? getLatestTimelineDate(existing) : null;
        const nextTimelineDate = getLatestTimelineDate(row);
        if (
          !existing ||
          (nextTimelineDate &&
            (!existingTimelineDate || nextTimelineDate > existingTimelineDate))
        ) {
          yahooByName.set(name, row);
        }
      });

      namesById.forEach((name, nhlId) => {
        const yahooPlayerId = yahooByName.get(name)?.player_id;
        if (yahooPlayerId != null) byNhlId.set(nhlId, String(yahooPlayerId));
      });
    }
  }

  return playerIds.map((requestedId) => ({
    requestedId,
    yahooPlayerId: byNhlId.get(requestedId) ?? requestedId
  }));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const playerIds = normalizePlayerIds(req.query.playerIds);
    if (playerIds.length === 0) {
      return res.status(200).json({ success: true, players: [] });
    }

    const season = req.query.season ? Number(req.query.season) : null;
    const { url, key } = resolveKey();
    const supabase = createClient(url, key, {
      auth: { persistSession: false }
    });
    const idResolution = await resolveYahooPlayerIds(supabase, playerIds);
    const yahooPlayerIds = Array.from(
      new Set(idResolution.map((entry) => entry.yahooPlayerId))
    );

    const loadRows = async (requestedSeason: number | null) => {
      const loaded: Array<Record<string, unknown>> = [];
      for (const idChunk of chunk(yahooPlayerIds)) {
        let query = supabase
          .from("yahoo_players")
          .select("player_id, percent_ownership, ownership_timeline, season")
          .in("player_id", idChunk)
          .order("player_id", { ascending: true })
          .order("season", { ascending: true, nullsFirst: true })
          .range(0, 999);
        if (requestedSeason != null) query = query.eq("season", requestedSeason);
        const { data, error } = await query;
        if (error) throw error;
        loaded.push(...(data ?? []));
      }
      return loaded;
    };

    let rows = await loadRows(season && Number.isFinite(season) ? season : null);
    let seasonFallbackApplied = false;
    if (rows.length === 0 && season && Number.isFinite(season)) {
      rows = await loadRows(null);
      seasonFallbackApplied = true;
    }
    const byPlayer = new Map<string, Record<string, unknown>>();

    rows.forEach((row) => {
      const playerId = row.player_id != null ? String(row.player_id) : null;
      if (!playerId) return;
      const existing = byPlayer.get(playerId);
      const existingTimelineDate = existing ? getLatestTimelineDate(existing) : null;
      const nextTimelineDate = getLatestTimelineDate(row);
      if (
        !existing ||
        (nextTimelineDate && (!existingTimelineDate || nextTimelineDate > existingTimelineDate))
      ) {
        byPlayer.set(playerId, row);
        return;
      }
      const existingSeason =
        existing && typeof existing.season === "number" ? existing.season : -Infinity;
      const nextSeason = typeof row.season === "number" ? row.season : -Infinity;
      if (!existingTimelineDate && !nextTimelineDate && nextSeason >= existingSeason) {
        byPlayer.set(playerId, row);
      }
    });

    const players: SnapshotRow[] = idResolution.map((entry) => ({
      playerId: Number(entry.requestedId),
      ownership: byPlayer.has(entry.yahooPlayerId)
        ? resolveOwnership(byPlayer.get(entry.yahooPlayerId)!)
        : null
    }));

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    const sourceDate = rows.reduce<string | null>((latest, row) => {
      const date = getLatestTimelineDate(row);
      return date && (!latest || date > latest) ? date : latest;
    }, null);
    return res.status(200).json({
      success: true,
      requestedSeason: season && Number.isFinite(season) ? season : null,
      seasonFallbackApplied,
      sourceDate,
      generatedAt: sourceDate ? `${sourceDate}T23:59:59.999Z` : null,
      players
    });
  } catch (err: any) {
    console.error("ownership-snapshots error", err?.message || err);
    return res
      .status(500)
      .json({ success: false, error: err?.message || String(err) });
  }
}
