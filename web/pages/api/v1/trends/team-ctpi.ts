import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import { TeamGameRow, computeCtpi, computeTrendMetrics } from "lib/trends/ctpi";

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials for team CTPI API.");
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

const AS_RATES_TABLE = "nst_team_gamelogs_as_rates";
const PP_COUNTS_TABLE = "nst_team_gamelogs_pp_counts";
const PK_COUNTS_TABLE = "nst_team_gamelogs_pk_counts";

async function fetchGameRows(seasonId: number): Promise<TeamGameRow[]> {
  // Pull last ~20 games per team (over-fetch and trim client-side)
  const { data: asRows, error: asErr } = await supabase
    .from(AS_RATES_TABLE)
    .select(
      [
        "team_abbreviation",
        "date",
        "xgf_per_60",
        "hdcf_per_60",
        "gf_per_60",
        "xga_per_60",
        "hdca_per_60",
        "cf_pct",
        "ga",
        "xga",
        "pdo"
      ].join(",")
    )
    .eq("season_id", seasonId)
    .order("date", { ascending: false })
    .limit(1200); // ~20 games * 32 teams
  if (asErr) throw asErr;

  const { data: ppRows, error: ppErr } = await supabase
    .from(PP_COUNTS_TABLE)
    .select(["team_abbreviation", "date", "gf", "toi_seconds"].join(","))
    .eq("season_id", seasonId)
    .order("date", { ascending: false })
    .limit(1200);
  if (ppErr) throw ppErr;

  const { data: pkRows, error: pkErr } = await supabase
    .from(PK_COUNTS_TABLE)
    .select(["team_abbreviation", "date", "ga", "toi_seconds"].join(","))
    .eq("season_id", seasonId)
    .order("date", { ascending: false })
    .limit(1200);
  if (pkErr) throw pkErr;

  // Index PP/PK rows by team+date for quick lookups
  const ppMap = new Map<string, { gf: number | null; toi: number | null }>();
  (ppRows ?? []).forEach((row: any) => {
    const key = `${row.team_abbreviation}|${row.date}`;
    ppMap.set(key, { gf: row.gf ?? null, toi: row.toi_seconds ?? null });
  });
  const pkMap = new Map<string, { ga: number | null; toi: number | null }>();
  (pkRows ?? []).forEach((row: any) => {
    const key = `${row.team_abbreviation}|${row.date}`;
    pkMap.set(key, { ga: row.ga ?? null, toi: row.toi_seconds ?? null });
  });

  return (asRows ?? []).map((row: any) => {
    const key = `${row.team_abbreviation}|${row.date}`;
    const pp = ppMap.get(key);
    const pk = pkMap.get(key);
    return {
      team: row.team_abbreviation,
      date: row.date,
      xgf_per_60: row.xgf_per_60,
      hdcf_per_60: row.hdcf_per_60,
      gf_per_60: row.gf_per_60,
      xga_per_60: row.xga_per_60,
      hdca_per_60: row.hdca_per_60,
      sat_pct: row.cf_pct,
      goals_against: row.ga,
      xga: row.xga,
      power_play_goals_for: pp?.gf ?? null,
      powerPlayToi: pp?.toi ?? null,
      pp_goals_against: pk?.ga ?? null,
      toi_shorthanded: pk?.toi ?? null,
      net_penalties_per_60: null,
      pdo: row.pdo != null ? Number(row.pdo) : null
    };
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const season = await fetchCurrentSeason();
    const seasonId = season.id;

    const rows = await fetchGameRows(seasonId);
    const teamMap = new Map<string, TeamGameRow[]>();
    rows.forEach((row) => {
      if (!teamMap.has(row.team)) teamMap.set(row.team, []);
      teamMap.get(row.team)!.push(row);
    });

    const trendMetrics = Array.from(teamMap.values()).map((games) =>
      computeTrendMetrics(games)
    );
    const ctpi = computeCtpi(trendMetrics);

    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=60");
    return res.status(200).json({
      seasonId,
      generatedAt: new Date().toISOString(),
      teams: ctpi
    });
  } catch (error: any) {
    console.error("team-ctpi API error", error);
    return res.status(500).json({
      message: "Failed to compute CTPI.",
      error: error?.message ?? "Unknown error"
    });
  }
}
