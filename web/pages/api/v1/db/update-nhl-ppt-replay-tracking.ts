import type { NextApiRequest, NextApiResponse } from "next";

import supabase from "lib/supabase/server";
import {
  buildPptReplayRows,
  fetchPptReplayJson,
  type PptReplayFrameRow,
  type PptReplayPayloadRow,
} from "lib/NHL/pptReplayIngestion";
import { fetchPptReplayCoverageForGame } from "lib/NHL/pptReplayCoverage";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const DEFAULT_UPSERT_BATCH_SIZE = 500;
const SUPABASE_PAGE_SIZE = 1000;

type QueryValue = string | string[] | undefined;

type GameRow = {
  id: number | string | null;
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

function parseBoolean(value: QueryValue): boolean {
  const normalized = firstQueryValue(value)?.toLowerCase();
  return normalized != null && ["1", "true", "yes", "y"].includes(normalized);
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

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
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
      .select("id")
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

async function upsertPayloadRows(rows: PptReplayPayloadRow[], batchSize: number) {
  let upserted = 0;
  for (const batch of chunkRows(rows, batchSize)) {
    const { error } = await supabase
      .from("nhl_ppt_replay_payloads_raw" as any)
      .upsert(batch as any, { onConflict: "game_id,event_id" });
    if (error) throw new Error(`Failed to upsert replay payload rows: ${error.message}`);
    upserted += batch.length;
  }
  return upserted;
}

async function replaceFrameRows(rows: PptReplayFrameRow[], batchSize: number) {
  let upserted = 0;
  const eventKeys = Array.from(
    new Set(rows.map((row) => `${row.game_id}:${row.event_id}`))
  ).map((key) => {
    const [gameId, eventId] = key.split(":").map(Number);
    return { gameId, eventId };
  });

  for (const eventKey of eventKeys) {
    const { error } = await supabase
      .from("nhl_ppt_replay_frames" as any)
      .delete()
      .eq("game_id", eventKey.gameId)
      .eq("event_id", eventKey.eventId);
    if (error) throw new Error(`Failed to clear old replay frame rows: ${error.message}`);
  }

  for (const batch of chunkRows(rows, batchSize)) {
    const { error } = await supabase
      .from("nhl_ppt_replay_frames" as any)
      .upsert(batch as any, {
        onConflict: "game_id,event_id,frame_index,tracking_object_id",
      });
    if (error) throw new Error(`Failed to upsert replay frame rows: ${error.message}`);
    upserted += batch.length;
  }
  return upserted;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }

  const explicitGameIds = parseGameIds(req.query.gameIds ?? req.query.gameId);
  const seasonId = parseOptionalInteger(req.query.seasonId) ?? inferCurrentSeasonId();
  const gameTypes = parseGameTypes(req.query.gameTypes);
  const limit = parseLimit(req.query.limit);
  const startDate = firstQueryValue(req.query.startDate);
  const endDate = firstQueryValue(req.query.endDate);
  const dryRun = parseBoolean(req.query.dryRun);
  const upsertBatchSize = Math.max(
    1,
    parseInteger(req.query.upsertBatchSize, DEFAULT_UPSERT_BATCH_SIZE)
  );

  try {
    const gameIds = explicitGameIds.length
      ? explicitGameIds.slice(0, limit)
      : await selectGameIds({ seasonId, gameTypes, startDate, endDate, limit });

    const payloadRows: PptReplayPayloadRow[] = [];
    const frameRows: PptReplayFrameRow[] = [];
    const errors: Array<{ gameId: number; eventId?: number; error: string }> = [];

    for (const gameId of gameIds) {
      try {
        const coverage = await fetchPptReplayCoverageForGame(gameId);
        for (const event of coverage.events) {
          const fetchResult = await fetchPptReplayJson(event.pptReplayUrl);
          const built = buildPptReplayRows({ event, fetchResult });
          payloadRows.push(built.payloadRow);
          frameRows.push(...built.frameRows);
          if (!fetchResult.ok) {
            errors.push({
              gameId,
              eventId: event.eventId,
              error: fetchResult.errorMessage ?? "Replay fetch failed.",
            });
          }
        }
      } catch (error) {
        errors.push({
          gameId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const fetchedPayloadRows = payloadRows.filter((row) => row.fetch_status === "fetched").length;
    const failedPayloadRows = payloadRows.filter((row) => row.fetch_status === "failed").length;

    if (dryRun) {
      return res.status(200).json({
        success: true,
        dryRun,
        seasonId,
        gameTypes,
        startDate,
        endDate,
        requestedGames: gameIds.length,
        payloadRows: payloadRows.length,
        fetchedPayloadRows,
        failedPayloadRows,
        frameRows: frameRows.length,
        samples: payloadRows.slice(0, 5).map((row) => ({
          gameId: row.game_id,
          eventId: row.event_id,
          eventType: row.event_type,
          frameCount: row.frame_count,
          entityFrameCount: row.entity_frame_count,
          url: row.ppt_replay_url,
        })),
        errors,
        notes: [
          "Replay URLs are fetched only after NHL gamecenter PBP exposes the exact pptReplayUrl.",
          "This endpoint does not probe guessed ev*.json URLs.",
        ],
      });
    }

    const upsertedPayloadRows = await upsertPayloadRows(payloadRows, upsertBatchSize);
    const upsertedFrameRows = await replaceFrameRows(frameRows, upsertBatchSize);

    return res.status(200).json({
      success: true,
      dryRun,
      seasonId,
      gameTypes,
      startDate,
      endDate,
      requestedGames: gameIds.length,
      payloadRows: payloadRows.length,
      fetchedPayloadRows,
      failedPayloadRows,
      frameRows: frameRows.length,
      upsertedPayloadRows,
      upsertedFrameRows,
      errors,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to update replay tracking.",
    });
  }
}

export default handler;
