import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import {
  ACTIVE_TEAM_ABBREVIATIONS,
  MetricSource,
  TEAM_TREND_CATEGORIES,
  TrendCategoryId
} from "lib/trends/teamMetricConfig";
import {
  CategoryComputationResult,
  TeamGameMap,
  TeamSnapshot,
  computeCategoryResults
} from "lib/trends/teamPercentiles";
import { getTeamAbbreviationById } from "lib/teamsInfo";

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials for team trend API.");
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

type SourceColumnMap = Record<MetricSource, Set<string>>;

const SOURCE_METADATA_COLUMNS: Record<MetricSource, string[]> = {
  as: ["team_abbreviation", "gp", "date"],
  pp: ["team_abbreviation", "gp", "date"],
  pk: ["team_abbreviation", "gp", "date"],
  wgo: ["team_id", "games_played", "date"]
};

function buildSourceColumnMap(): SourceColumnMap {
  const map: SourceColumnMap = {
    as: new Set(SOURCE_METADATA_COLUMNS.as),
    pp: new Set(SOURCE_METADATA_COLUMNS.pp),
    pk: new Set(SOURCE_METADATA_COLUMNS.pk),
    wgo: new Set(SOURCE_METADATA_COLUMNS.wgo)
  };
  TEAM_TREND_CATEGORIES.forEach((category) => {
    category.metrics.forEach((metric) => {
      map[metric.source].add(metric.key);
    });
  });
  return map;
}

const sourceColumns = buildSourceColumnMap();

const SOURCE_TABLES: Record<MetricSource, string> = {
  as: "nst_team_gamelogs_as_counts",
  pp: "nst_team_gamelogs_pp_counts",
  pk: "nst_team_gamelogs_pk_counts",
  wgo: "wgo_team_stats"
};

type GenericRow = Record<string, any>;

async function fetchRowsForSource(
  source: MetricSource,
  seasonId: number,
  seasonStart: string,
  seasonEnd: string
): Promise<GenericRow[]> {
  const table = SOURCE_TABLES[source];
  const columns = Array.from(sourceColumns[source]).join(",");
  let query = supabase.from(table).select(columns);

  if (source === "wgo") {
    query = query
      .gte("date", seasonStart)
      .lte("date", seasonEnd)
      .order("date", { ascending: true });
  } else {
    query = query
      .eq("season_id", seasonId)
      .order("date", { ascending: true })
      .order("gp", { ascending: true });
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(
      `Failed to fetch ${table}: ${error.message || "unknown error"}`
    );
  }
  return data ?? [];
}

function getOrCreateTeamSnapshot(
  teamMap: Map<string, TeamSnapshot>,
  dateKey: string
): TeamSnapshot {
  if (!teamMap.has(dateKey)) {
    teamMap.set(dateKey, { date: dateKey, gp: 0 });
  }
  return teamMap.get(dateKey)!;
}

function ingestRows(
  rows: GenericRow[],
  source: MetricSource,
  teamGameMap: TeamGameMap
) {
  const teamKey = source === "wgo" ? "team_id" : "team_abbreviation";

  const metadata = SOURCE_METADATA_COLUMNS[source];
  const dataColumns = Array.from(sourceColumns[source]).filter(
    (col) => !metadata.includes(col)
  );

  rows.forEach((row) => {
    const team =
      source === "wgo"
        ? getTeamAbbreviationById(row[teamKey])
        : row[teamKey];
    const rawDate =
      row.date ??
      row.game_date ??
      row.gameDate ??
      row.created_at ??
      row.updated_at;
    if (!team || !rawDate) return;
    const dateValue =
      typeof rawDate === "string"
        ? rawDate.slice(0, 10)
        : new Date(rawDate).toISOString().slice(0, 10);

    if (!teamGameMap.has(team)) {
      teamGameMap.set(team, new Map());
    }
    const teamDateMap = teamGameMap.get(team)!;
    const snapshot = getOrCreateTeamSnapshot(teamDateMap, dateValue);
    const sourceKey =
      source === "as"
        ? "as"
        : source === "pp"
        ? "pp"
        : source === "pk"
        ? "pk"
        : "wgo";

    if (!snapshot[sourceKey]) {
      snapshot[sourceKey] = {};
    }
    const dest = snapshot[sourceKey]!;

    dataColumns.forEach((column) => {
      if (row[column] === undefined || row[column] === null) return;
      dest[column] = row[column];
    });
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
    const teamGameMap: TeamGameMap = new Map();
    const seasonId = season.id;
    const seasonStart = season.startDate;
    const seasonEnd = season.endDate || season.regularSeasonEndDate;

    for (const source of Object.keys(SOURCE_TABLES) as MetricSource[]) {
      const rows = await fetchRowsForSource(
        source,
        seasonId,
        seasonStart,
        seasonEnd
      );
      ingestRows(rows, source, teamGameMap);
    }

    // Ensure every active team has an entry even if empty to keep downstream logic predictable.
    ACTIVE_TEAM_ABBREVIATIONS.forEach((team) => {
      if (!teamGameMap.has(team)) {
        teamGameMap.set(team, new Map());
      }
    });

    const categoryResults: Record<TrendCategoryId, CategoryComputationResult> =
      computeCategoryResults(teamGameMap);

    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=60");
    return res.status(200).json({
      seasonId,
      generatedAt: new Date().toISOString(),
      categories: categoryResults
    });
  } catch (error: any) {
    console.error("team-power API error", error);
    return res.status(500).json({
      message: "Failed to compute team trends.",
      error: error?.message ?? "Unknown error"
    });
  }
}
