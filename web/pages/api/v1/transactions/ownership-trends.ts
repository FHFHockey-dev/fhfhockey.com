import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

interface OwnershipPoint {
  date: string;
  value: number;
}
interface PlayerRow {
  player_key: string;
  full_name: string | null;
  headshot_url: string | null;
  display_position: string | null;
  editorial_full_team_name: string | null;
  ownership_timeline: OwnershipPoint[] | null;
}

type TrendPlayer = {
  playerKey: string;
  name: string;
  headshot: string | null;
  displayPosition?: string | null;
  teamFullName?: string | null;
  latest: number;
  previous: number;
  delta: number;
  deltaPct: number;
  sparkline: OwnershipPoint[];
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
    const season = req.query.season ? Number(req.query.season) : undefined;

    const { url, key } = resolveKey();
    const supabase = createClient(url, key, {
      auth: { persistSession: false }
    });

    let query = supabase
      .from("yahoo_players")
      .select(
        "player_key, full_name, headshot_url, display_position, editorial_full_team_name, ownership_timeline"
      )
      .limit(2500);
    if (season) query = query.eq("season", season);

    const { data, error } = await query;
    if (error) throw error;

    const today = new Date();
    const targetDateObj = new Date(today);
    targetDateObj.setDate(targetDateObj.getDate() - windowDays);
    const targetDateStr = targetDateObj.toISOString().slice(0, 10);

    const risers: TrendPlayer[] = [];
    const fallers: TrendPlayer[] = [];

    (data as PlayerRow[]).forEach((row) => {
      const tl = Array.isArray(row.ownership_timeline)
        ? (row.ownership_timeline as OwnershipPoint[])
        : [];
      if (tl.length < 2) return;
      tl.sort((a, b) => a.date.localeCompare(b.date));
      const latestPoint = tl[tl.length - 1];
      if (typeof latestPoint.value !== "number") return;

      let previousPoint: OwnershipPoint | undefined = undefined;
      previousPoint = tl.find((p) => p.date === targetDateStr);
      if (!previousPoint) {
        for (let i = tl.length - 2; i >= 0; i--) {
          if (tl[i].date <= targetDateStr) {
            previousPoint = tl[i];
            break;
          }
        }
      }
      if (!previousPoint) return;
      const latest = latestPoint.value;
      const previous = previousPoint.value;
      if (typeof previous !== "number") return;
      const delta = Number((latest - previous).toFixed(2));
      if (delta === 0) return;
      const sparkSlice = tl.slice(-Math.max(12, windowDays + 2));
      const obj: TrendPlayer = {
        playerKey: row.player_key,
        name: row.full_name || row.player_key,
        headshot: row.headshot_url || null,
        displayPosition: row.display_position ?? null,
        teamFullName: row.editorial_full_team_name ?? null,
        latest,
        previous,
        delta,
        deltaPct: delta,
        sparkline: sparkSlice
      };
      if (delta > 0) risers.push(obj);
      else fallers.push(obj);
    });

    risers.sort((a, b) => b.delta - a.delta);
    fallers.sort((a, b) => a.delta - b.delta);

    const payload = {
      success: true,
      windowDays,
      generatedAt: new Date().toISOString(),
      risers: risers.slice(0, limit),
      fallers: fallers.slice(0, limit)
    };
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    return res.status(200).json(payload);
  } catch (err: any) {
    console.error("ownership-trends error", err?.message || err);
    return res
      .status(500)
      .json({ success: false, error: err?.message || String(err) });
  }
}
