import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import supabase from "lib/supabase/server";
import {
  buildTeamGameTravelFatigueFeatures,
  type TravelFatigueGameRow,
} from "lib/xg/travelFatigue";

const DEFAULT_UPSERT_BATCH_SIZE = 500;

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseOptionalInteger(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: string | null, fallback: number): number {
  return parseOptionalInteger(value) ?? fallback;
}

function parseBoolean(value: string | null): boolean {
  return value != null && ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function parseIntegerList(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isInteger(entry));
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function fetchGames(args: {
  seasonId: number | null;
  gameTypes: number[];
  gameIds: number[];
  startDate: string | null;
  endDate: string | null;
  limit: number | null;
}): Promise<TravelFatigueGameRow[]> {
  let query = supabase
    .from("games")
    .select("id,seasonId,date,startTime,homeTeamId,awayTeamId,type")
    .order("startTime", { ascending: true })
    .order("id", { ascending: true });

  if (args.gameIds.length) query = query.in("id", args.gameIds);
  if (args.seasonId != null) query = query.eq("seasonId", args.seasonId);
  if (args.gameTypes.length) query = query.in("type", args.gameTypes);
  if (args.startDate) query = query.gte("date", args.startDate);
  if (args.endDate) query = query.lte("date", args.endDate);
  if (args.limit != null) query = query.limit(args.limit);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch games for travel/fatigue features: ${error.message}`);

  return ((data ?? []) as unknown as Array<Record<string, unknown>>)
    .map((row) => ({
      id: Number(row.id),
      seasonId: numberOrNull(row.seasonId),
      date: stringOrNull(row.date),
      startTime: String(row.startTime),
      homeTeamId: numberOrNull(row.homeTeamId),
      awayTeamId: numberOrNull(row.awayTeamId),
      type: numberOrNull(row.type),
    }))
    .filter((row) => Number.isFinite(row.id) && row.startTime !== "undefined");
}

async function upsertRows(rows: unknown[], batchSize: number) {
  let upserted = 0;
  for (const batch of chunkRows(rows, batchSize)) {
    const { error } = await supabase
      .from("nhl_xg_team_game_travel_fatigue_features" as any)
      .upsert(batch as any, { onConflict: "travel_fatigue_version,game_id,team_id" });
    if (error) throw new Error(`Failed to upsert travel/fatigue rows: ${error.message}`);
    upserted += batch.length;
  }
  return upserted;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const seasonId = parseOptionalInteger(firstQueryValue(req.query.seasonId));
  const gameTypes = parseIntegerList(firstQueryValue(req.query.gameTypes));
  const gameIds = parseIntegerList(firstQueryValue(req.query.gameIds));
  const startDate = firstQueryValue(req.query.startDate);
  const endDate = firstQueryValue(req.query.endDate);
  const limit = parseOptionalInteger(firstQueryValue(req.query.limit));
  const version = firstQueryValue(req.query.travelFatigueVersion) ?? "travel_fatigue_v1";
  const dryRun = parseBoolean(firstQueryValue(req.query.dryRun));
  const upsertBatchSize = Math.max(
    1,
    parseInteger(firstQueryValue(req.query.upsertBatchSize), DEFAULT_UPSERT_BATCH_SIZE)
  );

  if (seasonId == null && gameIds.length === 0 && (!startDate || !endDate)) {
    return res.status(400).json({
      success: false,
      error: "Provide seasonId, gameIds, or both startDate and endDate.",
    });
  }

  const games = await fetchGames({ seasonId, gameTypes, gameIds, startDate, endDate, limit });
  const rows = buildTeamGameTravelFatigueFeatures({ games, version });
  const counts = {
    games: games.length,
    teamGameRows: rows.length,
    missingVenueTimezoneRows: rows.filter(
      (row) => row.venue_timezone_source === "missing_home_team_timezone"
    ).length,
    backToBackRows: rows.filter((row) => row.is_back_to_back).length,
    threeInFourRows: rows.filter((row) => row.is_three_in_four).length,
    roadRows: rows.filter((row) => !row.is_home).length,
  };

  if (dryRun) {
    return res.status(200).json({
      success: true,
      dryRun,
      travelFatigueVersion: version,
      seasonId,
      gameTypes,
      gameIds,
      startDate,
      endDate,
      counts,
      samples: rows.slice(0, 10),
    });
  }

  const rowsUpserted = await upsertRows(rows, upsertBatchSize);
  return res.status(200).json({
    success: true,
    dryRun,
    travelFatigueVersion: version,
    seasonId,
    gameTypes,
    gameIds,
    startDate,
    endDate,
    counts,
    rowsUpserted,
    samples: rows.slice(0, 10),
  });
}

export default withCronJobAudit(handler, {
  jobName: "update-nhl-xg-travel-fatigue",
});
