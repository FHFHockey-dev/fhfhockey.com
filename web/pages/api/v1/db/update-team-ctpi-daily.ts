import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import {
  type TeamGameRow,
  computeTrendMetrics,
  computeCtpi
} from "lib/trends/ctpi";

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials for CTPI cron endpoint.");
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

const AS_RATES_TABLE = "nst_team_gamelogs_as_rates";
const AS_COUNTS_TABLE = "nst_team_gamelogs_as_counts";
const PP_COUNTS_TABLE = "nst_team_gamelogs_pp_counts";
const PK_COUNTS_TABLE = "nst_team_gamelogs_pk_counts";
const DEST_TABLE = "team_ctpi_daily";

type CtpiRow = {
  season_id: number;
  team: string;
  date: string;
  computed_at: string;
  ctpi_raw: number;
  ctpi_0_to_100: number;
  offense: number;
  defense: number;
  goaltending: number;
  special_teams: number;
  luck: number;
  payload: any;
};

async function ensureTable(): Promise<void> {
  // Cheap, schema-independent call to keep the client warm.
  const { error } = await supabase
    .from(DEST_TABLE)
    .select("season_id", { head: true, count: "exact" });
  if (error) {
    console.error("Supabase warmup failed", error.message);
  }
}

async function fetchGameRows(seasonId: number): Promise<TeamGameRow[]> {
  const baseSelect = [
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
  ].join(",");

  const { data: asRows, error: asErr } = await supabase
    .from(AS_RATES_TABLE)
    .select(baseSelect)
    .eq("season_id", seasonId)
    .order("date", { ascending: false });
  if (asErr) throw asErr;

  const { data: ppRows, error: ppErr } = await supabase
    .from(PP_COUNTS_TABLE)
    .select(["team_abbreviation", "date", "gf", "xgf", "toi_seconds"].join(","))
    .eq("season_id", seasonId)
    .order("date", { ascending: false });
  if (ppErr) throw ppErr;

  const { data: pkRows, error: pkErr } = await supabase
    .from(PK_COUNTS_TABLE)
    .select(["team_abbreviation", "date", "ga", "xga", "toi_seconds"].join(","))
    .eq("season_id", seasonId)
    .order("date", { ascending: false });
  if (pkErr) throw pkErr;

  const { data: asCountRows, error: asCountErr } = await supabase
    .from(AS_COUNTS_TABLE)
    .select(["team_abbreviation", "date", "toi_seconds", "ga", "xga"].join(","))
    .eq("season_id", seasonId)
    .order("date", { ascending: false });
  if (asCountErr) throw asCountErr;

  const ppMap = new Map<
    string,
    { gf: number | null; xgf: number | null; toi: number | null }
  >();
  (ppRows ?? []).forEach((row: any) => {
    ppMap.set(`${row.team_abbreviation}|${row.date}`, {
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
    pkMap.set(`${row.team_abbreviation}|${row.date}`, {
      ga: row.ga ?? null,
      xga: row.xga ?? null,
      toi: row.toi_seconds ?? null
    });
  });

  const asCountMap = new Map<
    string,
    { toi: number | null; ga: number | null; xga: number | null }
  >();
  (asCountRows ?? []).forEach((row: any) => {
    asCountMap.set(`${row.team_abbreviation}|${row.date}`, {
      toi: row.toi_seconds ?? null,
      ga: row.ga ?? null,
      xga: row.xga ?? null
    });
  });

  return (asRows ?? []).map((row: any) => {
    const key = `${row.team_abbreviation}|${row.date}`;
    const pp = ppMap.get(key);
    const pk = pkMap.get(key);
    const asCount = asCountMap.get(key);
    return {
      team: row.team_abbreviation,
      date: row.date,
      xgf_per_60: row.xgf_per_60,
      hdcf_per_60: row.hdcf_per_60,
      gf_per_60: row.gf_per_60,
      xga_per_60: row.xga_per_60,
      hdca_per_60: row.hdca_per_60,
      ca_per_60: row.ca_per_60,
      sat_pct: row.cf_pct,
      goals_against: row.ga,
      xga: row.xga,
      power_play_goals_for: pp?.gf ?? null,
      powerPlayToi: pp?.toi ?? null,
      pp_xgf: pp?.xgf ?? null,
      pp_goals_against: pk?.ga ?? null,
      toi_shorthanded: pk?.toi ?? null,
      pk_xga: pk?.xga ?? null,
      net_penalties_per_60: null,
      pdo: row.pdo != null ? Number(row.pdo) : null,
      toi_all_seconds: asCount?.toi ?? null
    };
  });
}

const buildDateRange = (start: string, end: string) => {
  const dates: string[] = [];
  const startDate = new Date(start);
  const endDate = new Date(end);
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d).toISOString().slice(0, 10));
  }
  return dates;
};

async function resolveStartDate(
  seasonId: number,
  seasonStart: string
): Promise<string> {
  const { data, error } = await supabase
    .from(DEST_TABLE)
    .select("date")
    .eq("season_id", seasonId)
    .order("date", { ascending: false })
    .limit(1);
  if (error) throw error;
  const lastDate = data?.[0]?.date as string | undefined;
  // If nothing exists, start at season start; otherwise overwrite the most recent date.
  if (!lastDate) return seasonStart.slice(0, 10);
  return lastDate.slice(0, 10);
}

async function upsertRows(rows: CtpiRow[]) {
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from(DEST_TABLE)
      .upsert(slice, { onConflict: "season_id,team,date" });
    if (error) throw error;
  }
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
    await ensureTable();
    const season = await fetchCurrentSeason();
    const seasonId = season.id;
    const todayIso = new Date().toISOString().slice(0, 10);
    const seasonEnd = season.endDate || season.regularSeasonEndDate || todayIso;
    const endDate = seasonEnd > todayIso ? todayIso : seasonEnd;
    const startParam =
      typeof req.query.start === "string" ? req.query.start.slice(0, 10) : undefined;
    const startCandidate = startParam
      ? startParam
      : await resolveStartDate(seasonId, season.startDate.slice(0, 10));
    const startDate =
      startCandidate > endDate
        ? endDate
        : startCandidate < season.startDate.slice(0, 10)
          ? season.startDate.slice(0, 10)
          : startCandidate;

    if (startDate > endDate) {
      return res.status(200).json({
        message: "No dates to process (start is after today/season end).",
        startDate,
        endDate,
        rowsUpserted: 0,
        datesComputed: 0
      });
    }

    const dates = buildDateRange(startDate, endDate);

    const allRows = await fetchGameRows(seasonId);
    const teamMap = new Map<string, TeamGameRow[]>();
    allRows.forEach((row) => {
      if (!teamMap.has(row.team)) teamMap.set(row.team, []);
      teamMap.get(row.team)!.push(row);
    });

    const insertRows: CtpiRow[] = [];
    for (const date of dates) {
      const metrics = Array.from(teamMap.values()).map((games) =>
        computeTrendMetrics(
          games.filter((g) => g.date <= date),
          undefined,
          10
        )
      );
      const ctpi = computeCtpi(metrics);
      const computedAt = new Date().toISOString();
      ctpi.forEach((c) => {
        insertRows.push({
          season_id: seasonId,
          team: c.team,
          date,
          computed_at: computedAt,
          ctpi_raw: c.ctpi_raw,
          ctpi_0_to_100: c.ctpi_0_to_100,
          offense: c.offense,
          defense: c.defense,
          goaltending: c.goaltending,
          special_teams: c.specialTeams,
          luck: c.luck,
          payload: c
        });
      });
    }

    await upsertRows(insertRows);

    return res.status(200).json({
      message: "CTPI daily processed",
      seasonId,
      datesComputed: dates.length,
      rowsUpserted: insertRows.length,
      startDate,
      endDate
    });
  } catch (error: any) {
    console.error("update-team-ctpi-daily error", error);
    return res.status(500).json({
      message: "Failed to compute daily CTPI.",
      error: error?.message ?? "Unknown error"
    });
  }
}
