import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type SnapshotRow = {
  playerId: number;
  ownership: number | null;
  observedOn: string | null;
};

type PlayerIdResolution = {
  requestedId: string;
  yahooPlayerId: string | null;
};

type SupabaseQueryClient = {
  from(table: string): any;
};

const ID_CHUNK_SIZE = 500;

function completeRows(data: any[] | null, count: number | null): any[] {
  if (!Array.isArray(data) || count == null || count !== data.length) {
    throw new Error("Incomplete ownership response");
  }
  return data;
}

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
  return Array.from(new Set(joined
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)));
};

const ownershipPct = (value: unknown): number | null => {
  const parsed = typeof value === "string" && /^\d+(\.\d+)?$/.test(value) ? Number(value)
    : typeof value === "number" ? value : NaN;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
};

const resolveOwnership = (row: Record<string, unknown>): Omit<SnapshotRow, "playerId"> => {
  const timeline = Array.isArray(row.ownership_timeline)
    ? [...(row.ownership_timeline as Array<{ date?: unknown; value?: unknown }>)]
        .filter(point => typeof point?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(point.date)
          && Number.isFinite(Date.parse(point.date)) && new Date(point.date).toISOString().slice(0, 10) === point.date
          && ownershipPct(point.value) !== null)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    : [];
  const latestPoint = timeline[timeline.length - 1];
  return latestPoint
    ? { ownership: ownershipPct(latestPoint.value), observedOn: latestPoint.date as string }
    : { ownership: ownershipPct(row.percent_ownership), observedOn: null };
};

function getLatestTimelineDate(row: Record<string, unknown>): string | null {
  return resolveOwnership(row).observedOn;
}

async function resolveYahooPlayerIds(
  supabase: SupabaseQueryClient,
  playerIds: string[]
): Promise<PlayerIdResolution[]> {
  const byNhlId = new Map<string, string | null>();
  for (const idChunk of chunk(playerIds)) {
    const { data, error, count } = await supabase
    .from("yahoo_nhl_player_map_read")
      .select("nhl_player_id, yahoo_player_id", { count: "exact" })
      .in("nhl_player_id", idChunk).range(0, 999);
    if (error) throw error;
    completeRows(data, count).forEach((row: any) => {
      const nhlPlayerId = row?.nhl_player_id != null ? String(row.nhl_player_id) : null;
      const yahooPlayerId =
        row?.yahoo_player_id != null ? String(row.yahoo_player_id) : null;
      if (nhlPlayerId && yahooPlayerId) byNhlId.set(nhlPlayerId,
        byNhlId.has(nhlPlayerId) && byNhlId.get(nhlPlayerId) !== yahooPlayerId ? null : yahooPlayerId);
    });
  }

  const unresolvedIds = playerIds.filter((playerId) => !byNhlId.has(playerId));
  if (unresolvedIds.length > 0) {
    const namesById = new Map<string, string>();
    for (const idChunk of chunk(unresolvedIds)) {
      const { data: players, error: playersError, count } = await supabase
        .from("players")
        .select("id, fullName", { count: "exact" })
        .in("id", idChunk.map(Number)).range(0, 999);
      if (playersError) throw playersError;
      completeRows(players, count).forEach((row: any) => {
        const id = row?.id != null ? String(row.id) : null;
        const name = typeof row?.fullName === "string" ? row.fullName.trim() : "";
        if (id && name) namesById.set(id, name);
      });
    }

    const names = Array.from(new Set(namesById.values()));
    if (names.length > 0) {
      const yahooRows: any[] = [];
      for (const nameChunk of chunk(names, 100)) {
        const { data, error: yahooError, count } = await supabase
          .from("yahoo_players_with_normalized_history")
          .select(
            "player_id, full_name, player_name, ownership_timeline:normalized_ownership_timeline, season", { count: "exact" }
          )
          .in("full_name", nameChunk)
          .order("player_id", { ascending: true })
          .order("season", { ascending: true, nullsFirst: true })
          .range(0, 999);
        if (yahooError) throw yahooError;
        yahooRows.push(...completeRows(data, count));
      }

      const yahooByName = new Map<string, Set<string>>();
      (yahooRows ?? []).forEach((row: any) => {
        const name =
          typeof row?.full_name === "string"
            ? row.full_name.trim()
            : typeof row?.player_name === "string"
              ? row.player_name.trim()
              : "";
        if (!name || row.player_id == null) return;
        const matches = yahooByName.get(name) ?? new Set<string>();
        matches.add(String(row.player_id));
        yahooByName.set(name, matches);
      });

      namesById.forEach((name, nhlId) => {
        const matches = yahooByName.get(name);
        if (matches?.size === 1) byNhlId.set(nhlId, [...matches][0]);
      });
    }
  }

  return playerIds.map((requestedId) => ({
    requestedId,
    yahooPlayerId: byNhlId.get(requestedId) ?? null
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
    if (playerIds.length > ID_CHUNK_SIZE || playerIds.some(id => !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))) {
      return res.status(400).json({ success: false, error: "Provide at most 500 valid NHL player IDs." });
    }

    const season = req.query.season ? Number(req.query.season) : null;
    const { url, key } = resolveKey();
    const supabase = createClient(url, key, {
      auth: { persistSession: false }
    });
    const idResolution = await resolveYahooPlayerIds(supabase, playerIds);
    const yahooPlayerIds = Array.from(
      new Set(idResolution.map((entry) => entry.yahooPlayerId).filter((id): id is string => id !== null))
    );

    const loadRows = async (requestedSeason: number | null) => {
      const loaded: Array<Record<string, unknown>> = [];
      for (const idChunk of chunk(yahooPlayerIds)) {
        let query = supabase
        .from("yahoo_players_with_normalized_history")
          .select(
            "player_id, percent_ownership, ownership_timeline:normalized_ownership_timeline, season", { count: "exact" }
          )
          .in("player_id", idChunk)
          .order("player_id", { ascending: true })
          .order("season", { ascending: true, nullsFirst: true })
          .range(0, 999);
        if (requestedSeason != null) query = query.eq("season", requestedSeason);
        const { data, error, count } = await query;
        if (error) throw error;
        loaded.push(...completeRows(data, count));
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
      ...(entry.yahooPlayerId !== null && byPlayer.has(entry.yahooPlayerId)
        ? resolveOwnership(byPlayer.get(entry.yahooPlayerId)!)
        : { ownership: null, observedOn: null })
    }));

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    const sourceDate = players.reduce<string | null>((latest, row) => {
      const date = row.observedOn;
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
      .json({ success: false, error: "OWNERSHIP_SNAPSHOTS_UNAVAILABLE" });
  }
}
