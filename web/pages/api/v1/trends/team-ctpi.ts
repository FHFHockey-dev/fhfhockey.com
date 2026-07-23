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
import { buildRequestedDateServingState } from "lib/dashboard/freshness";
import { ACTIVE_TEAM_ABBREVIATIONS } from "lib/trends/teamMetricConfig";

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
const PAGE_SIZE = 1000;

async function fetchAllPages<T>(buildQuery: () => any): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(
      from,
      from + PAGE_SIZE - 1
    );
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

function sourceDateTimestamp(sourceDate: string | null): string | null {
  return sourceDate ? `${sourceDate}T23:59:59.999Z` : null;
}

async function fetchGameRows(
  seasonId: number,
  requestedDate: string
): Promise<TeamGameRow[]> {
  const asRows = await fetchAllPages<any>(() =>
    supabase
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
          "ca_per_60",
          "cf_pct",
          "ga",
          "xga",
          "pdo"
        ].join(",")
      )
      .eq("season_id", seasonId)
      .lte("date", requestedDate)
      .order("date", { ascending: true })
      .order("team_abbreviation", { ascending: true })
  );

  const asCountsRows = await fetchAllPages<any>(() =>
    supabase
      .from(AS_COUNTS_TABLE)
      .select(["team_abbreviation", "date", "toi_seconds", "xga", "ga"].join(","))
      .eq("season_id", seasonId)
      .lte("date", requestedDate)
      .order("date", { ascending: true })
      .order("team_abbreviation", { ascending: true })
  );

  const ppRows = await fetchAllPages<any>(() =>
    supabase
      .from(PP_COUNTS_TABLE)
      .select(["team_abbreviation", "date", "gf", "xgf", "toi_seconds"].join(","))
      .eq("season_id", seasonId)
      .lte("date", requestedDate)
      .order("date", { ascending: true })
      .order("team_abbreviation", { ascending: true })
  );

  const pkRows = await fetchAllPages<any>(() =>
    supabase
      .from(PK_COUNTS_TABLE)
      .select(["team_abbreviation", "date", "ga", "xga", "toi_seconds"].join(","))
      .eq("season_id", seasonId)
      .lte("date", requestedDate)
      .order("date", { ascending: true })
      .order("team_abbreviation", { ascending: true })
  );

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

async function fetchCtpiDaily(
  seasonId: number,
  requestedDate: string
): Promise<{
  scores: CtpiScore[];
  sourceDate: string;
  computedAt: string | null;
  sourceRowCount: number;
} | null> {
  let data: any[];
  try {
    data = await fetchAllPages<any>(() =>
      supabase
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
            "luck",
            "computed_at"
          ].join(",")
        )
        .eq("season_id", seasonId)
        .lte("date", requestedDate)
        .order("date", { ascending: true })
        .order("team", { ascending: true })
    );
  } catch (error) {
    console.error("team-ctpi daily load error", error);
    return null;
  }
  if (!data || data.length === 0) return null;

  const teamMap = new Map<string, any[]>();
  let latestComputedAt: string | null = null;
  let sourceDate = "";
  data.forEach((row: any) => {
    if (!teamMap.has(row.team)) teamMap.set(row.team, []);
    teamMap.get(row.team)!.push(row);
    if (row.date && row.date > sourceDate) sourceDate = row.date;
    if (
      row.computed_at &&
      (!latestComputedAt || row.computed_at > latestComputedAt)
    ) {
      latestComputedAt = row.computed_at;
    }
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
  return {
    scores,
    sourceDate,
    computedAt: latestComputedAt,
    sourceRowCount: data.length
  };
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
    const requestedDateRaw = String(
      Array.isArray(req.query.date) ? req.query.date[0] : req.query.date ?? ""
    ).trim();
    const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDateRaw)
      ? requestedDateRaw
      : new Date().toISOString().slice(0, 10);

    // Prefer precomputed daily table for latest values + sparkline
    const dailyCtpi = await fetchCtpiDaily(seasonId, requestedDate);
    let ctpi: CtpiScore[] | null = dailyCtpi?.scores ?? null;
    let sourceDate = dailyCtpi?.sourceDate ?? null;
    let computedAt = dailyCtpi?.computedAt ?? null;
    let sourceRowCount = dailyCtpi?.sourceRowCount ?? 0;
    let source: "team_ctpi_daily" | "on_the_fly" = "team_ctpi_daily";

    // Fallback to on-the-fly compute if table empty
    if (!ctpi || ctpi.length === 0) {
      const rows = await fetchGameRows(seasonId, requestedDate);
      const teamMap = new Map<string, TeamGameRow[]>();
      rows.forEach((row) => {
        if (!teamMap.has(row.team)) teamMap.set(row.team, []);
        teamMap.get(row.team)!.push(row);
        if (!sourceDate || row.date > sourceDate) sourceDate = row.date;
      });
      const trendMetrics = Array.from(teamMap.values()).map((games) =>
        computeTrendMetrics(games)
      );
      ctpi = computeCtpi(trendMetrics);
      source = "on_the_fly";
      sourceRowCount = rows.length;
      computedAt = null;
    }

    const dateUsed = sourceDate ?? requestedDate;
    const fallbackApplied = dateUsed !== requestedDate;
    const serving = buildRequestedDateServingState({
      requestedDate,
      resolvedDate: dateUsed,
      fallbackApplied,
      strategy: fallbackApplied
        ? "latest_available_with_data"
        : "requested_date"
    });
    const partial =
      ctpi.length < ACTIVE_TEAM_ABBREVIATIONS.length || fallbackApplied;

    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=60");
    return res.status(200).json({
      seasonId,
      generatedAt: sourceDateTimestamp(sourceDate),
      requestedDate,
      dateUsed,
      fallbackApplied,
      serving,
      source: {
        kind: source,
        sourceDate,
        computedAt,
        rowCount: sourceRowCount
      },
      coverage: {
        expectedTeams: ACTIVE_TEAM_ABBREVIATIONS.length,
        teamCount: ctpi.length,
        sourceRowCount,
        partial
      },
      warnings: [
        ...(fallbackApplied
          ? ["CTPI is using the latest available fallback date."]
          : []),
        ...(ctpi.length < ACTIVE_TEAM_ABBREVIATIONS.length
          ? ["CTPI team coverage is incomplete."]
          : [])
      ],
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
