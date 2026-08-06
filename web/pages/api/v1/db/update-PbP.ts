/**
 * One-release compatibility adapter for the historical update-PbP route.
 *
 * Bounded requests are delegated to the canonical projection-input ingestion
 * handler so PBP and shift inputs share the same raw snapshots, transaction,
 * manifest, and verification boundary. The legacy full-history mode remains
 * available behind the route's admin/cron authorization boundary until its
 * callers and replacement backfill contract are separately approved.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { Database } from "lib/supabase/database-generated.types";
import type { NextApiRequest, NextApiResponse } from "next";
import adminOnly from "utils/adminOnlyMiddleware";

import {
  ingestProjectionInputsHandler,
  previousUtcDate,
} from "./ingest-projection-inputs";

type AuthorizedRequest = NextApiRequest & {
  supabase?: SupabaseClient<Database>;
};

type AdapterResponse = {
  message?: string;
  success?: boolean;
  mode?: "legacy-games-all";
};

const CONTROL_KEYS = ["gameId", "startDate", "endDate", "games"] as const;

function queryString(req: NextApiRequest, key: string): string | undefined {
  const value = req.query[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function currentUtcDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function parseExactGameId(value: string): number | null {
  if (!/^\d{10}$/.test(value)) return null;
  const gameId = Number(value);
  return Number.isSafeInteger(gameId) && gameId > 0 ? gameId : null;
}

function canonicalRequest(
  req: NextApiRequest,
  query: Record<string, string>,
): NextApiRequest {
  return Object.assign(Object.create(req), {
    query,
    // The legacy route has always accepted its controls from the query string.
    // Clear the body so unrelated fields cannot override this bounded mapping.
    body: {},
  }) as NextApiRequest;
}

async function resolveGameDate(
  req: AuthorizedRequest,
  gameId: number,
): Promise<{ date: string | null; error: unknown | null }> {
  if (!req.supabase) {
    return {
      date: null,
      error: new Error("Authorized Supabase client not available"),
    };
  }

  const { data, error } = await req.supabase
    .from("games")
    .select("id,date")
    .eq("id", gameId)
    .maybeSingle();
  if (error) return { date: null, error };

  const date = typeof data?.date === "string" ? data.date.slice(0, 10) : null;
  return { date, error: null };
}

async function delegateCanonicalRange(
  req: NextApiRequest,
  res: NextApiResponse,
  query: Record<string, string>,
) {
  return ingestProjectionInputsHandler(
    canonicalRequest(req, query),
    res as any,
  );
}

async function handler(
  req: AuthorizedRequest,
  res: NextApiResponse<AdapterResponse>,
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  const repeatedControl = CONTROL_KEYS.find((key) =>
    Array.isArray(req.query[key]),
  );
  if (repeatedControl) {
    return res.status(400).json({
      success: false,
      message: `${repeatedControl} must be supplied at most once`,
    });
  }

  const requestedGameId = queryString(req, "gameId");
  const requestedStartDate = queryString(req, "startDate");
  const requestedEndDate = queryString(req, "endDate");
  const requestedGames = queryString(req, "games");

  try {
    // Keep the historical precedence: `recent` ignores all other controls.
    if (requestedGameId === "recent") {
      const date = previousUtcDate();
      return delegateCanonicalRange(req, res, {
        startDate: date,
        endDate: date,
      });
    }

    // A numeric legacy game request becomes an exact one-game canonical range.
    // resumeFromGameId prevents another same-date game from being selected.
    if (requestedGameId) {
      const gameId = parseExactGameId(requestedGameId);
      if (gameId == null) {
        return res.status(400).json({
          success: false,
          message: "gameId must be a 10-digit NHL game ID or recent",
        });
      }

      const game = await resolveGameDate(req, gameId);
      if (game.error) {
        console.error("Unable to resolve play-by-play game date", game.error);
        return res.status(500).json({
          success: false,
          message: "Unable to resolve the requested game",
        });
      }
      if (!game.date) {
        return res.status(404).json({
          success: false,
          message: "Requested game was not found",
        });
      }

      return delegateCanonicalRange(req, res, {
        startDate: game.date,
        endDate: game.date,
        resumeFromGameId: String(gameId),
        maxGames: "1",
      });
    }

    // Preserve the documented legacy full-history contract for one release.
    // It is no longer reachable anonymously because adminOnly wraps this route.
    if (requestedGames === "all") {
      const { main } = await import("lib/supabase/Upserts/fetchPbP");
      await main(true, undefined, requestedStartDate, requestedEndDate);
      return res.status(200).json({
        success: true,
        mode: "legacy-games-all",
        message: "Play-by-play full-history compatibility run completed",
      });
    }

    // Preserve the old start-only behavior by bounding it at today's UTC date.
    // An endDate without a startDate was historically ignored in favor of today.
    const startDate = requestedStartDate ?? currentUtcDate();
    const endDate = requestedStartDate
      ? (requestedEndDate ?? currentUtcDate())
      : startDate;
    return delegateCanonicalRange(req, res, { startDate, endDate });
  } catch (error) {
    console.error("Error processing play-by-play data", error);
    return res.status(500).json({
      success: false,
      message: "Play-by-play processing failed",
    });
  }
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "update-PbP",
});
