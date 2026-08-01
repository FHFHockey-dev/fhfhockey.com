import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  fetchEspnNhlOdds,
  fetchPersistedEspnNhlOddsSnapshots,
  mergeEspnOddsPreferPersisted,
  parseRequestedOddsDates,
  type EspnGameOdds,
  type EspnOddsPayload,
} from "lib/game-predictions/espnOdds";
import type { Database } from "lib/supabase/database-generated.types";

let serverClient: SupabaseClient<Database> | null = null;

function getServerClient(): SupabaseClient<Database> {
  if (serverClient) return serverClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase credentials missing for game prediction odds API.",
    );
  }

  serverClient = createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return serverClient;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EspnOddsPayload>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      success: false,
      generatedAt: new Date().toISOString(),
      count: 0,
      odds: [],
      error: "Method not allowed",
    });
  }

  try {
    const dates = parseRequestedOddsDates({
      dates: req.query.dates,
      fromDate: req.query.fromDate ?? req.query.since,
      toDate: req.query.toDate ?? req.query.until,
    });
    let persistedOdds: EspnGameOdds[] = [];
    try {
      persistedOdds = await fetchPersistedEspnNhlOddsSnapshots({
        client: getServerClient(),
        dates,
      });
    } catch (error: any) {
      console.warn(
        "game-predictions persisted odds lookup failed",
        error?.message ?? error,
      );
    }
    let odds = persistedOdds;
    try {
      odds = mergeEspnOddsPreferPersisted({
        persisted: persistedOdds,
        live: await fetchEspnNhlOdds(dates),
      });
    } catch (error) {
      if (persistedOdds.length === 0) throw error;
    }

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
    return res.status(200).json({
      success: true,
      generatedAt: new Date().toISOString(),
      count: odds.length,
      odds,
    });
  } catch (error: any) {
    console.error("game-predictions ESPN odds error", error?.message ?? error);
    return res.status(502).json({
      success: false,
      generatedAt: new Date().toISOString(),
      count: 0,
      odds: [],
      error: error?.message ?? "Unable to load ESPN odds",
    });
  }
}
