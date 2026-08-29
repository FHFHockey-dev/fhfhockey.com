import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { getLatestStartedSeasonForDate } from "lib/NHL/server";
import {
  isTrustedRecentTeamFormPayload,
  type CtpiScore,
} from "lib/trends/ctpi";
import { buildRequestedDateServingState } from "lib/dashboard/freshness";
import { ACTIVE_TEAM_ABBREVIATIONS } from "lib/trends/teamMetricConfig";

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials for team CTPI API.");
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

const DAILY_TABLE = "team_ctpi_daily";
const PAGE_SIZE = 1000;

type PersistedTeamFormRow = {
  team: string;
  date: string;
  ctpi_raw: number;
  ctpi_0_to_100: number;
  offense: number;
  defense: number;
  goaltending: number;
  special_teams: number;
  luck: number;
  computed_at: string | null;
  publication_status: string | null;
  formula_version: string | null;
  input_version: string | null;
  source_game_count: string | number | null;
};

async function fetchAllPages<T>(buildQuery: () => any): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(
      from,
      from + PAGE_SIZE - 1,
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

async function fetchCtpiDaily(
  seasonId: number,
  requestedDate: string,
): Promise<{
  scores: CtpiScore[];
  sourceDate: string | null;
  computedAt: string | null;
  sourceRowCount: number;
  trustedRowCount: number;
  untrustedRowCount: number;
  formulaVersion: string | null;
  inputVersion: string | null;
} | null> {
  const data = await fetchAllPages<PersistedTeamFormRow>(() =>
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
          "computed_at",
          "publication_status:payload->>publicationStatus",
          "formula_version:payload->>formulaVersion",
          "input_version:payload->>inputVersion",
          "source_game_count:payload->>sourceGameCount",
        ].join(","),
      )
      .eq("season_id", seasonId)
      .lte("date", requestedDate)
      .order("date", { ascending: true })
      .order("team", { ascending: true }),
  );
  if (!data || data.length === 0) return null;

  const trustedRows = data.filter((row) =>
    isTrustedRecentTeamFormPayload({
      publicationStatus: row.publication_status,
      formulaVersion: row.formula_version,
      inputVersion: row.input_version,
      sourceGameCount: row.source_game_count,
    }),
  );

  const teamMap = new Map<string, PersistedTeamFormRow[]>();
  let latestComputedAt: string | null = null;
  let sourceDate: string | null = null;
  data.forEach((row) => {
    if (
      row.computed_at &&
      (!latestComputedAt || row.computed_at > latestComputedAt)
    ) {
      latestComputedAt = row.computed_at;
    }
  });
  trustedRows.forEach((row) => {
    if (!teamMap.has(row.team)) teamMap.set(row.team, []);
    teamMap.get(row.team)!.push(row);
    if (row.date && (!sourceDate || row.date > sourceDate))
      sourceDate = row.date;
  });

  const scores: CtpiScore[] = [];
  teamMap.forEach((rows, team) => {
    const sorted = rows.sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    scores.push({
      team,
      publicationStatus: latest.publication_status as "approved",
      formulaVersion: latest.formula_version as CtpiScore["formulaVersion"],
      inputVersion: latest.input_version as CtpiScore["inputVersion"],
      sourceGameCount: Number(latest.source_game_count),
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
        .map((row) => ({ date: row.date, value: row.ctpi_0_to_100 })),
    });
  });
  return {
    scores,
    sourceDate,
    computedAt: latestComputedAt,
    sourceRowCount: data.length,
    trustedRowCount: trustedRows.length,
    untrustedRowCount: data.length - trustedRows.length,
    formulaVersion: trustedRows[0]?.formula_version ?? null,
    inputVersion: trustedRows[0]?.input_version ?? null,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const requestedDateRaw = String(
      Array.isArray(req.query.date)
        ? req.query.date[0]
        : (req.query.date ?? ""),
    ).trim();
    const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDateRaw)
      ? requestedDateRaw
      : new Date().toISOString().slice(0, 10);
    const season = await getLatestStartedSeasonForDate(requestedDate, supabase);
    const seasonId = Number(season?.id);
    if (!Number.isSafeInteger(seasonId) || seasonId <= 0) {
      throw new Error(
        `Unable to resolve season for Recent Team Form date=${requestedDate}`,
      );
    }

    const dailyCtpi = await fetchCtpiDaily(seasonId, requestedDate);
    const ctpi = dailyCtpi?.scores ?? [];
    const sourceDate = dailyCtpi?.sourceDate ?? null;
    const computedAt = dailyCtpi?.computedAt ?? null;
    const sourceRowCount = dailyCtpi?.sourceRowCount ?? 0;
    const trustedRowCount = dailyCtpi?.trustedRowCount ?? 0;
    const untrustedRowCount = dailyCtpi?.untrustedRowCount ?? 0;

    const dateUsed = sourceDate ?? requestedDate;
    const fallbackApplied = dateUsed !== requestedDate;
    const serving = buildRequestedDateServingState({
      requestedDate,
      resolvedDate: dateUsed,
      fallbackApplied,
      strategy: fallbackApplied
        ? "latest_available_with_data"
        : "requested_date",
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
        kind: "team_ctpi_daily",
        sourceDate,
        computedAt,
        rowCount: sourceRowCount,
        trustedRowCount,
        untrustedRowCount,
        formulaVersion: dailyCtpi?.formulaVersion ?? null,
        inputVersion: dailyCtpi?.inputVersion ?? null,
      },
      coverage: {
        expectedTeams: ACTIVE_TEAM_ABBREVIATIONS.length,
        teamCount: ctpi.length,
        sourceRowCount,
        trustedRowCount,
        untrustedRowCount,
        partial,
      },
      warnings: [
        ...(fallbackApplied
          ? ["Recent Team Form is using the latest approved fallback date."]
          : []),
        ...(untrustedRowCount > 0
          ? [
              "Recent Team Form history is hidden unless its formula and source provenance are explicitly approved.",
            ]
          : []),
        ...(ctpi.length < ACTIVE_TEAM_ABBREVIATIONS.length
          ? ["Recent Team Form team coverage is incomplete."]
          : []),
      ],
      teams: ctpi,
    });
  } catch (error: any) {
    console.error("team-ctpi API error", error);
    return res.status(500).json({
      message: "Failed to load Recent Team Form.",
      error: "TEAM_CTPI_UNAVAILABLE",
    });
  }
}
