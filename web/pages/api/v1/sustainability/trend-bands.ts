import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import {
  computeAndStoreTrendBands,
  parseDateParam,
  parseMetricParam,
  parseWindowParam
} from "lib/sustainability/bandService";
import type { Database } from "lib/supabase/database-generated.types";

type TrendBandRow =
  Database["public"]["Tables"]["sustainability_trend_bands"]["Row"];

function parseLimitParam(value: string | string[] | undefined, fallback = 180) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return fallback;
  const parsed = Number.parseInt(candidate, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(1000, parsed));
}

function shouldRecompute(method: string, query: NextApiRequest["query"]): boolean {
  if (method === "POST") return true;
  const flag = query?.recompute;
  if (!flag) return false;
  const value = Array.isArray(flag) ? flag[0] : flag;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const playerId = Number(req.query.player_id);
  if (!Number.isFinite(playerId)) {
    return res
      .status(400)
      .json({ success: false, message: "Missing or invalid player_id" });
  }
  const metrics = parseMetricParam(req.query.metric);
  const windows = parseWindowParam(req.query.window);
  const limit = parseLimitParam(req.query.limit, 180);
  const { data, error } = await supabase
    .from("sustainability_trend_bands")
    .select("*")
    .eq("player_id", playerId)
    .in("metric_key", metrics as string[])
    .in("window_code", windows as string[])
    .order("snapshot_date", { ascending: false })
    .limit(limit);
  if (error) {
    return res
      .status(500)
      .json({ success: false, message: error.message ?? String(error) });
  }
  return res
    .status(200)
    .json({ success: true, rows: (data ?? []) as TrendBandRow[] });
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const playerId = Number(req.body?.player_id ?? req.query.player_id);
  if (!Number.isFinite(playerId)) {
    return res
      .status(400)
      .json({ success: false, message: "Missing or invalid player_id" });
  }
  const snapshotDate = parseDateParam(
    req.body?.snapshot_date ?? req.query.snapshot_date
  );
  const metrics = parseMetricParam(req.body?.metrics ?? req.query.metric);
  const windows = parseWindowParam(req.body?.windows ?? req.query.window);

  try {
    const { rows } = await computeAndStoreTrendBands({
      playerId,
      snapshotDate,
      metrics,
      windows
    });

    if (!rows.length) {
      return res.status(200).json({
        success: true,
        message: "No bands computed (insufficient data)",
        rows: []
      });
    }

    return res.status(200).json({
      success: true,
      snapshot_date: snapshotDate,
      player_id: playerId,
      rows
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("trend-bands recompute error", error?.message ?? error);
    return res.status(500).json({
      success: false,
      message: error?.message ?? String(error)
    });
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET" || req.method === "POST") {
    if (shouldRecompute(req.method, req.query)) {
      return handlePost(req, res);
    }
    return handleGet(req, res);
  }
  res.setHeader("Allow", "GET,POST");
  return res
    .status(405)
    .json({ success: false, message: "Method not allowed" });
}
