import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "lib/supabase/database-generated.types";

function assertServerCredentials(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase credentials missing");
  return { url, key };
}

function parseString(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}

function parseIso(value?: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

function parseIntParam(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) ? n : undefined;
}

function parseIds(value: unknown): number[] | undefined {
  if (!value) return undefined;
  const s = Array.isArray(value) ? value.join(",") : String(value);
  const out = s
    .split(",")
    .map((t) => Number(t.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return out.length ? Array.from(new Set(out)) : undefined;
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
    const asOfDate = parseIso(parseString(req.query.asOfDate));
    const since = parseIso(parseString(req.query.since));
    const until = parseIso(parseString(req.query.until));
    const horizon = parseIntParam(req.query.horizon);
    const playerIds = parseIds(req.query.playerId ?? req.query.playerIds);
    const limit = parseIntParam(req.query.limit) ?? 500;
    const order =
      (parseString(req.query.order) ?? "desc").toLowerCase() === "asc"
        ? "asc"
        : "desc";

    const { url, key } = assertServerCredentials();
    const admin = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    let query = admin
      .from("predictions_sko")
      .select(
        "player_id, as_of_date, horizon_games, pred_points, pred_points_per_game, stability_cv, stability_multiplier, sko, top_features, created_at"
      )
      .order("as_of_date", { ascending: order === "asc" })
      .limit(limit);

    if (horizon) query = query.eq("horizon_games", horizon);
    if (asOfDate) query = query.eq("as_of_date", asOfDate);
    if (since) query = query.gte("as_of_date", since);
    if (until) query = query.lte("as_of_date", until);
    if (playerIds?.length) query = query.in("player_id", playerIds);

    const { data, error } = await query;
    if (error) throw error;

    return res
      .status(200)
      .json({ success: true, count: data?.length ?? 0, rows: data ?? [] });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("get-predictions-sko error", err?.message || err);
    return res
      .status(500)
      .json({ success: false, error: err?.message || String(err) });
  }
}
