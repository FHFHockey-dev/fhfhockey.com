import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import {
  computeSosRatingsV2,
  TEAM_SOS_READER_COLUMNS,
  type SosRatingV2,
  type TeamSosReaderRow
} from "lib/trends/strengthOfSchedule";
import { DESCRIPTIVE_SOS_VERSION } from "lib/trends/strengthOfScheduleContract";
import { TEAM_SOS_PAST_VIEW, TEAM_SOS_TABLE } from "lib/trends/teamSosSnapshot";
import { ACTIVE_TEAM_ABBREVIATIONS } from "lib/trends/teamMetricConfig";

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials for team SOS API.");
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

const SOS_DEFINITION =
  "Mean over fixtures of opponents' win% (W / GP), excluding games against the team. Past counts final games only, with opponents' records as of the cutoff; started or postponed games are pending, never played. Future uses opponents' records to date.";

/** Latest descriptive-sos-v2 snapshot; v1 sos_standings rows are not served. */
async function fetchLatestRows(seasonId: number): Promise<TeamSosReaderRow[]> {
  const { data: latestDateData, error: latestErr } = await supabase
    .from(TEAM_SOS_TABLE)
    .select("snapshot_date")
    .eq("season_id", seasonId)
    .eq("sos_version", DESCRIPTIVE_SOS_VERSION)
    .order("snapshot_date", { ascending: false })
    .limit(1);
  if (latestErr) throw latestErr;
  const latestDate = latestDateData?.[0]?.snapshot_date as string | undefined;
  if (!latestDate) return [];

  const { data, error } = await supabase
    .from(TEAM_SOS_TABLE)
    .select(TEAM_SOS_READER_COLUMNS)
    .eq("season_id", seasonId)
    .eq("sos_version", DESCRIPTIVE_SOS_VERSION)
    .eq("snapshot_date", latestDate);
  if (error) throw error;
  return (data as unknown as TeamSosReaderRow[]) ?? [];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const debug =
    req.query.debug === "1" || req.query.debug === "true" || req.query.debug === "yes";

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const season = await fetchCurrentSeason();
    const seasonId = season.id;
    const labels = {
      sosVersion: DESCRIPTIVE_SOS_VERSION,
      pastView: TEAM_SOS_PAST_VIEW,
      definition: SOS_DEFINITION
    };

    const rows = await fetchLatestRows(seasonId);
    if (rows.length === 0) {
      return res.status(200).json({
        seasonId,
        ...labels,
        generatedAt: new Date().toISOString(),
        dateUsed: null,
        cutoffAt: null,
        coverage: {
          expectedTeams: ACTIVE_TEAM_ABBREVIATIONS.length,
          teamCount: 0,
          sourceRowCount: 0,
          partial: true
        },
        warnings: [
          "Strength of schedule (descriptive-sos-v2) has not been computed for this season yet."
        ],
        message: "No descriptive-sos-v2 snapshot for this season.",
        teams: []
      });
    }

    const ratings: SosRatingV2[] = computeSosRatingsV2(rows);
    const dateUsed = String(rows[0]?.snapshot_date ?? "").slice(0, 10) || null;
    const cutoffAt = rows[0]?.cutoff_at ?? null;
    const partial = ratings.length < ACTIVE_TEAM_ABBREVIATIONS.length;
    const pending = ratings.reduce((sum, r) => sum + r.past.pendingFixtures, 0);
    const warnings = [
      ...(partial ? ["Strength-of-schedule team coverage is incomplete."] : []),
      ...(pending > 0
        ? [
            `${pending} team-games started before the cutoff without a final result are pending and not counted as past.`
          ]
        : [])
    ];

    const debugStats = (() => {
      const summarize = (values: Array<number | null>) => {
        const filtered = values.filter(
          (v): v is number => typeof v === "number" && Number.isFinite(v)
        );
        if (filtered.length === 0) return null;
        const avg = filtered.reduce((sum, v) => sum + v, 0) / filtered.length;
        return {
          min: Number(Math.min(...filtered).toFixed(3)),
          max: Number(Math.max(...filtered).toFixed(3)),
          avg: Number(avg.toFixed(3)),
          count: filtered.length
        };
      };
      const summary = {
        pastWinPct: summarize(ratings.map((r) => r.past.winPct)),
        futureWinPct: summarize(ratings.map((r) => r.future.winPct)),
        combinedWinPct: summarize(ratings.map((r) => r.combinedWinPct))
      };
      if (debug) {
        console.log("[SOS] debug summary", JSON.stringify(summary));
      }
      return summary;
    })();

    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=60");
    return res.status(200).json({
      seasonId,
      ...labels,
      generatedAt: cutoffAt ?? new Date().toISOString(),
      dateUsed,
      cutoffAt,
      coverage: {
        expectedTeams: ACTIVE_TEAM_ABBREVIATIONS.length,
        teamCount: ratings.length,
        sourceRowCount: rows.length,
        partial
      },
      warnings,
      teams: ratings,
      ...(debug ? { debug: debugStats } : {})
    });
  } catch (error: any) {
    console.error("team-sos API error", error);
    return res.status(500).json({
      message: "Failed to compute strength of schedule.",
      error: "TEAM_SOS_UNAVAILABLE"
    });
  }
}
