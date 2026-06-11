import type { NextApiRequest, NextApiResponse } from "next";

import supabase from "lib/supabase/server";
import {
  fetchPptReplayCoverageForGame,
  type PptReplayEvent,
  type PptReplayGameCoverage,
} from "lib/NHL/pptReplayCoverage";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 250;
const SUPABASE_PAGE_SIZE = 1000;

type QueryValue = string | string[] | undefined;

type GameRow = {
  id: number | string | null;
  date: string | null;
  type: number | string | null;
};

type CoverageError = {
  gameId: number;
  error: string;
};

function firstQueryValue(value: QueryValue): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseInteger(value: QueryValue, fallback: number): number {
  const parsed = Number.parseInt(firstQueryValue(value) ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalInteger(value: QueryValue): number | null {
  const parsed = Number.parseInt(firstQueryValue(value) ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLimit(value: QueryValue): number {
  return Math.min(Math.max(parseInteger(value, DEFAULT_LIMIT), 1), MAX_LIMIT);
}

function parseGameTypes(value: QueryValue): number[] {
  const raw = firstQueryValue(value);
  if (!raw) return [2, 3];
  const parsed = raw
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isInteger(entry));
  return parsed.length ? Array.from(new Set(parsed)) : [2, 3];
}

function parseGameIds(value: QueryValue): number[] {
  const raw = firstQueryValue(value);
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isInteger(entry));
}

function inferCurrentSeasonId(now = new Date()): number {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const startYear = month >= 9 ? year : year - 1;
  return startYear * 10000 + startYear + 1;
}

async function fetchAllRows<TRow>(
  fetchPage: (from: number, to: number) => Promise<{
    data: TRow[] | null;
    error: { message?: string } | null;
  }>
): Promise<TRow[]> {
  const rows: TRow[] = [];
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw new Error(error.message ?? "Failed to fetch Supabase rows.");
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < SUPABASE_PAGE_SIZE) break;
  }
  return rows;
}

async function selectGameIds(args: {
  seasonId: number;
  gameTypes: number[];
  startDate: string | null;
  endDate: string | null;
  limit: number;
}): Promise<number[]> {
  const rows = await fetchAllRows<GameRow>(async (from, to) => {
    let query = (supabase as any)
      .from("games")
      .select("id,date,type")
      .eq("seasonId", args.seasonId)
      .in("type", args.gameTypes)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);

    if (args.startDate) query = query.gte("date", args.startDate);
    if (args.endDate) query = query.lte("date", args.endDate);
    return query;
  });

  return rows
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id))
    .slice(0, args.limit);
}

function mergeCounts(reports: PptReplayGameCoverage[]) {
  const replayEventTypes: Record<string, number> = {};
  const gameStates: Record<string, number> = {};
  let replayEventCount = 0;
  let nonGoalReplayEventCount = 0;
  let totalPlayCount = 0;

  for (const report of reports) {
    totalPlayCount += report.playCount;
    replayEventCount += report.replayEventCount;
    nonGoalReplayEventCount += report.nonGoalReplayEventCount;
    const gameState = report.gameState ?? "unknown";
    gameStates[gameState] = (gameStates[gameState] ?? 0) + 1;
    for (const [type, count] of Object.entries(report.replayEventTypes)) {
      replayEventTypes[type] = (replayEventTypes[type] ?? 0) + count;
    }
  }

  return {
    totalPlayCount,
    replayEventCount,
    gamesWithReplayUrls: reports.filter((report) => report.replayEventCount > 0).length,
    nonGoalReplayEventCount,
    replayEventTypes,
    gameStates,
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }

  const explicitGameIds = parseGameIds(req.query.gameIds ?? req.query.gameId);
  const seasonId = parseOptionalInteger(req.query.seasonId) ?? inferCurrentSeasonId();
  const gameTypes = parseGameTypes(req.query.gameTypes);
  const limit = parseLimit(req.query.limit);
  const startDate = firstQueryValue(req.query.startDate);
  const endDate = firstQueryValue(req.query.endDate);

  try {
    const gameIds = explicitGameIds.length
      ? explicitGameIds.slice(0, limit)
      : await selectGameIds({ seasonId, gameTypes, startDate, endDate, limit });

    const reports: PptReplayGameCoverage[] = [];
    const errors: CoverageError[] = [];
    for (const gameId of gameIds) {
      try {
        reports.push(await fetchPptReplayCoverageForGame(gameId));
      } catch (error) {
        errors.push({
          gameId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const counts = mergeCounts(reports);
    const samples = reports
      .flatMap<PptReplayEvent>((report) => report.events)
      .slice(0, 20);

    return res.status(200).json({
      success: true,
      seasonId,
      gameTypes,
      startDate,
      endDate,
      requestedGames: gameIds.length,
      processedGames: reports.length,
      failedGames: errors.length,
      counts,
      samples,
      errors,
      notes: [
        "Discovery is restricted to pptReplayUrl fields present in NHL gamecenter play-by-play responses.",
        "This endpoint intentionally does not probe guessed ev*.json URLs.",
      ],
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to audit replay coverage.",
    });
  }
}

export default handler;
