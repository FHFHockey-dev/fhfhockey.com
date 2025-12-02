import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import {
  TeamGameRow,
  computeCtpi,
  computeTrendMetrics
} from "lib/trends/ctpi";
import { type CtpiScore } from "lib/trends/ctpi";

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials for team CTPI API.");
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

const AS_RATES_TABLE = "nst_team_gamelogs_as_rates";
const AS_COUNTS_TABLE = "nst_team_gamelogs_as_counts";
const PP_COUNTS_TABLE = "nst_team_gamelogs_pp_counts";
const PK_COUNTS_TABLE = "nst_team_gamelogs_pk_counts";
const DAILY_TABLE = "team_ctpi_daily";

async function fetchGameRows(seasonId: number): Promise<TeamGameRow[]> {
  // Pull all games for the season
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
        "ca_per_60", // Added
        "cf_pct",
        "ga",
        "xga",
        "pdo"
      ].join(",")
    )
    .eq("season_id", seasonId)
    .order("date", { ascending: false });
  // Removed limit(1200)
  if (asErr) throw asErr;

  const { data: asCountsRows, error: asCountsErr } = await supabase
    .from(AS_COUNTS_TABLE)
    .select(["team_abbreviation", "date", "toi_seconds", "xga", "ga"].join(","))
    .eq("season_id", seasonId)
    .order("date", { ascending: false });
  if (asCountsErr) throw asCountsErr;

  const { data: ppRows, error: ppErr } = await supabase
    .from(PP_COUNTS_TABLE)
    .select(["team_abbreviation", "date", "gf", "xgf", "toi_seconds"].join(",")) // Added xgf
    .eq("season_id", seasonId)
    .order("date", { ascending: false });
  // Removed limit(1200)
  if (ppErr) throw ppErr;

  const { data: pkRows, error: pkErr } = await supabase
    .from(PK_COUNTS_TABLE)
    .select(["team_abbreviation", "date", "ga", "xga", "toi_seconds"].join(",")) // Added xga
    .eq("season_id", seasonId)
    .order("date", { ascending: false });
  // Removed limit(1200)
  if (pkErr) throw pkErr;

  // Index AS Counts by team+date
  const asCountsMap = new Map<
    string,
    { toi: number | null; xga: number | null; ga: number | null }
  >();
  (asCountsRows ?? []).forEach((row: any) => {
    const key = `${row.team_abbreviation}|${row.date}`;
    asCountsMap.set(key, {
      toi: row.toi_seconds ?? null,
      xga: row.xga ?? null,
      ga: row.ga ?? null
    });
  });

  // Index PP/PK rows by team+date for quick lookups
  const ppMap = new Map<
    string,
    { gf: number | null; xgf: number | null; toi: number | null }
  >();
  (ppRows ?? []).forEach((row: any) => {
    const key = `${row.team_abbreviation}|${row.date}`;
    ppMap.set(key, {
      gf: row.gf ?? null,
      xgf: row.xgf ?? null,
      toi: row.toi_seconds ?? null
    });
  });
  const pkMap = new Map<
    string,
    { ga: number | null; xga: number | null; toi: number | null }
  >();
  (pkRows ?? []).forEach((row: any) => {
    const key = `${row.team_abbreviation}|${row.date}`;
    pkMap.set(key, {
      ga: row.ga ?? null,
      xga: row.xga ?? null,
      toi: row.toi_seconds ?? null
    });
  });

  return (asRows ?? []).map((row: any) => {
    const key = `${row.team_abbreviation}|${row.date}`;
    const pp = ppMap.get(key);
    const pk = pkMap.get(key);
    const asCounts = asCountsMap.get(key);

    return {
      team: row.team_abbreviation,
      date: row.date,
      xgf_per_60: row.xgf_per_60,
      hdcf_per_60: row.hdcf_per_60,
      gf_per_60: row.gf_per_60,
      xga_per_60: row.xga_per_60,
      hdca_per_60: row.hdca_per_60,
      ca_per_60: row.ca_per_60, // Added
      sat_pct: row.cf_pct,
      goals_against: asCounts?.ga ?? row.ga,
      xga: asCounts?.xga ?? row.xga,
      power_play_goals_for: pp?.gf ?? null,
      powerPlayToi: pp?.toi ?? null,
      pp_xgf: pp?.xgf ?? null, // Added
      pp_goals_against: pk?.ga ?? null,
      toi_shorthanded: pk?.toi ?? null,
      pk_xga: pk?.xga ?? null, // Added
      net_penalties_per_60: null,
      pdo: row.pdo != null ? Number(row.pdo) : null,
      toi_all_seconds: asCounts?.toi // Added
    };
  });
}

async function fetchCtpiDaily(seasonId: number): Promise<CtpiScore[] | null> {
  const { data, error } = await supabase
    .from(DAILY_TABLE)
    .select(
      [
        "team",
        "date",
        "ctpi_raw",
        "ctpi_0_to_100",
        "offense",
        "defense",
        "goaltending",
        "special_teams",
        "luck"
      ].join(",")
    )
    .eq("season_id", seasonId)
    .order("date", { ascending: true });

  if (error) {
    console.error("team-ctpi daily load error", error);
    return null;
  }
  if (!data || data.length === 0) return null;

  const teamMap = new Map<string, any[]>();
  data.forEach((row: any) => {
    if (!teamMap.has(row.team)) teamMap.set(row.team, []);
    teamMap.get(row.team)!.push(row);
  });

  const scores: CtpiScore[] = [];
  teamMap.forEach((rows, team) => {
    const sorted = rows.sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    scores.push({
      team,
      offense: latest.offense,
      defense: latest.defense,
      goaltending: latest.goaltending,
      specialTeams: latest.special_teams,
      luck: latest.luck,
      ctpi_raw: latest.ctpi_raw,
      ctpi_0_to_100: latest.ctpi_0_to_100,
      z: {},
      sparkSeries: sorted
        .slice(-10)
        .map((r: any) => ({ date: r.date, value: r.ctpi_0_to_100 }))
    });
  });
  return scores;
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

    // Prefer precomputed daily table for latest values + sparkline
    const dailyCtpi = await fetchCtpiDaily(seasonId);
    let ctpi: CtpiScore[] | null = dailyCtpi;

    // Fallback to on-the-fly compute if table empty
    if (!ctpi || ctpi.length === 0) {
      const rows = await fetchGameRows(seasonId);
      const teamMap = new Map<string, TeamGameRow[]>();
      rows.forEach((row) => {
        if (!teamMap.has(row.team)) teamMap.set(row.team, []);
        teamMap.get(row.team)!.push(row);
      });
      const trendMetrics = Array.from(teamMap.values()).map((games) =>
        computeTrendMetrics(games)
      );
      ctpi = computeCtpi(trendMetrics);
    }

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
