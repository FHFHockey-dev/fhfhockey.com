import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import {
  computeSosRatings,
  type SosRating,
  type SosStandingRow
} from "lib/trends/strengthOfSchedule";

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials for team SOS API.");
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);
const SOS_TABLE = "sos_standings";

async function fetchLatestRows(
  seasonId: number
): Promise<SosStandingRow[] | null> {
  // Get the latest game_date for this season
  const { data: latestDateData, error: latestErr } = await supabase
    .from(SOS_TABLE)
    .select("game_date")
    .eq("season_id", seasonId)
    .order("game_date", { ascending: false })
    .limit(1);
  if (latestErr) {
    console.error("sos latest date error", latestErr);
    return null;
  }
  const latestDate = latestDateData?.[0]?.game_date as string | undefined;
  if (!latestDate) return null;

  const { data, error } = await supabase
    .from(SOS_TABLE)
    .select("*")
    .eq("season_id", seasonId)
    .eq("game_date", latestDate);
  if (error) {
    console.error("sos rows error", error);
    return null;
  }
  return (data as SosStandingRow[]) ?? null;
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

    const rows = await fetchLatestRows(seasonId);
    if (!rows || rows.length === 0) {
      return res.status(200).json({
        seasonId,
        generatedAt: new Date().toISOString(),
        message:
          "No strength-of-schedule data available (sos_standings empty for this season).",
        teams: []
      });
    }

    const ratings: SosRating[] = computeSosRatings(rows);

    // Optional debugging: expose distribution stats when debug query flag is set.
    const debugStats = (() => {
      const summarize = (values: number[]) => {
        const filtered = values.filter((v) => Number.isFinite(v));
        if (filtered.length === 0) return null;
        const min = Math.min(...filtered);
        const max = Math.max(...filtered);
        const avg =
          filtered.reduce((sum, v) => sum + v, 0) / filtered.length;
        return {
          min: Number(min.toFixed(3)),
          max: Number(max.toFixed(3)),
          avg: Number(avg.toFixed(3)),
          count: filtered.length
        };
      };

      const totals = ratings.reduce(
        (acc, r) => {
          acc.pastWins += r.past.wins;
          acc.pastLosses += r.past.losses;
          acc.pastOtl += r.past.otl;
          acc.futureWins += r.future.wins;
          acc.futureLosses += r.future.losses;
          acc.futureOtl += r.future.otl;
          return acc;
        },
        {
          pastWins: 0,
          pastLosses: 0,
          pastOtl: 0,
          futureWins: 0,
          futureLosses: 0,
          futureOtl: 0
        }
      );
      const pastGames = totals.pastWins + totals.pastLosses + totals.pastOtl;
      const futureGames =
        totals.futureWins + totals.futureLosses + totals.futureOtl;

      const aggregate = {
        past: {
          wins: totals.pastWins,
          losses: totals.pastLosses,
          otl: totals.pastOtl,
          games: pastGames,
          winPct: pastGames > 0 ? Number((totals.pastWins / pastGames).toFixed(3)) : null
        },
        future: {
          wins: totals.futureWins,
          losses: totals.futureLosses,
          otl: totals.futureOtl,
          games: futureGames,
          winPct:
            futureGames > 0
              ? Number((totals.futureWins / futureGames).toFixed(3))
              : null
        }
      };

      const summary = {
        pastWinPct: summarize(ratings.map((r) => r.past.winPct)),
        futureWinPct: summarize(ratings.map((r) => r.future.winPct)),
        combinedWinPct: summarize(ratings.map((r) => r.combinedWinPct)),
        aggregate
      };

      if (debug) {
        console.log("[SOS] debug summary", JSON.stringify(summary));
      }
      return summary;
    })();

    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=60");
    return res.status(200).json({
      seasonId,
      generatedAt: new Date().toISOString(),
      teams: ratings,
      ...(debug ? { debug: debugStats } : {})
    });
  } catch (error: any) {
    console.error("team-sos API error", error);
    return res.status(500).json({
      message: "Failed to compute strength of schedule.",
      error: error?.message ?? "Unknown error"
    });
  }
}
