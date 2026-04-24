import type { SupabaseClient } from "@supabase/supabase-js";

import supabaseServer from "lib/supabase/server";
import type { Database } from "lib/supabase/database-generated.types";

type Client = SupabaseClient<Database>;

export type UlsStatusSnapshot = {
  latestSnapshotDate: string | null;
  rowCount: number;
  status: "ready" | "pending";
};

export type UlsRouteStatus = {
  teamRatings: UlsStatusSnapshot;
  skaterOffenseRatings: UlsStatusSnapshot;
  skaterDefenseRatings: UlsStatusSnapshot;
  goalieRatings: UlsStatusSnapshot;
  gamePredictions: UlsStatusSnapshot;
  playerPredictions: UlsStatusSnapshot;
  modelMarketFlags: UlsStatusSnapshot;
};

type CountRow = {
  latest_snapshot_date?: string | null;
  row_count?: number | null;
};

async function fetchSnapshotStatus(args: {
  client: Client;
  table: string;
  dateColumn?: string;
}): Promise<UlsStatusSnapshot> {
  return fetchSnapshotStatusViaSelect(args);
}

// Supabase RPC coverage varies between environments, so keep a SQL fallback via pg-style select.
async function fetchSnapshotStatusViaSelect(args: {
  client: Client;
  table: string;
  dateColumn?: string;
}): Promise<UlsStatusSnapshot> {
  const dateColumn = args.dateColumn ?? "snapshot_date";
  const { data, error } = await args.client
    .from(args.table as never)
    .select(`${dateColumn}`, { count: "exact", head: false })
    .order(dateColumn, { ascending: false })
    .limit(1);
  if (error) {
    throw error;
  }

  const rowCount = typeof data?.length === "number" ? (data.length > 0 ? NaN : 0) : 0;
  const latestSnapshotDate =
    Array.isArray(data) && data.length > 0
      ? String((data[0] as Record<string, unknown>)[dateColumn] ?? "")
      : null;

  const { count, error: countError } = await args.client
    .from(args.table as never)
    .select("*", { count: "exact", head: true });
  if (countError) {
    throw countError;
  }

  const resolvedRowCount = Number(count ?? (Number.isFinite(rowCount) ? rowCount : 0));

  return {
    latestSnapshotDate: latestSnapshotDate && latestSnapshotDate.length > 0 ? latestSnapshotDate : null,
    rowCount: resolvedRowCount,
    status: resolvedRowCount > 0 ? "ready" : "pending",
  };
}

async function safeFetchSnapshotStatus(args: {
  client: Client;
  table: string;
  dateColumn?: string;
}): Promise<UlsStatusSnapshot> {
  try {
    return await fetchSnapshotStatusViaSelect(args);
  } catch {
    return {
      latestSnapshotDate: null,
      rowCount: 0,
      status: "pending",
    };
  }
}

export async function fetchUlsRouteStatus(
  client: Client = supabaseServer
): Promise<UlsRouteStatus> {
  const [
    teamRatings,
    skaterOffenseRatings,
    skaterDefenseRatings,
    goalieRatings,
    gamePredictions,
    playerPredictions,
    modelMarketFlags,
  ] = await Promise.all([
    safeFetchSnapshotStatus({ client, table: "team_power_ratings_daily", dateColumn: "date" }),
    safeFetchSnapshotStatus({ client, table: "skater_offensive_ratings_daily" }),
    safeFetchSnapshotStatus({ client, table: "skater_defensive_ratings_daily" }),
    safeFetchSnapshotStatus({ client, table: "goalie_ratings_daily" }),
    safeFetchSnapshotStatus({ client, table: "game_prediction_outputs" }),
    safeFetchSnapshotStatus({ client, table: "player_prediction_outputs" }),
    safeFetchSnapshotStatus({ client, table: "model_market_flags_daily" }),
  ]);

  return {
    teamRatings,
    skaterOffenseRatings,
    skaterDefenseRatings,
    goalieRatings,
    gamePredictions,
    playerPredictions,
    modelMarketFlags,
  };
}
