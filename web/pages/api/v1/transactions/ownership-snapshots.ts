import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type SnapshotRow = {
  playerId: number;
  ownership: number | null;
};

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
    ? (row.ownership_timeline as Array<{ value?: unknown }>)
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

    let query = supabase
      .from("yahoo_players")
      .select("player_id, percent_ownership, ownership_timeline, season")
      .in("player_id", playerIds)
      .limit(Math.max(playerIds.length * 2, 50));

    if (season && Number.isFinite(season)) {
      query = query.eq("season", season);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
    const byPlayer = new Map<string, Record<string, unknown>>();

    rows.forEach((row) => {
      const playerId = typeof row.player_id === "string" ? row.player_id : null;
      if (!playerId) return;
      const existing = byPlayer.get(playerId);
      const existingSeason =
        existing && typeof existing.season === "number" ? existing.season : -Infinity;
      const nextSeason = typeof row.season === "number" ? row.season : -Infinity;
      if (!existing || nextSeason >= existingSeason) {
        byPlayer.set(playerId, row);
      }
    });

    const players: SnapshotRow[] = playerIds.map((playerId) => ({
      playerId: Number(playerId),
      ownership: byPlayer.has(playerId) ? resolveOwnership(byPlayer.get(playerId)!) : null
    }));

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    return res.status(200).json({ success: true, players });
  } catch (err: any) {
    console.error("ownership-snapshots error", err?.message || err);
    return res
      .status(500)
      .json({ success: false, error: err?.message || String(err) });
  }
}
