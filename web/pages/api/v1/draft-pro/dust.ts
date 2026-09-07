import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { requireApiUser } from "lib/api/requireApiUser";
import { evaluateDraftProDust, type DraftProDustInput } from "lib/draft-pro/dust";
import { enforceDraftProDustRateLimit } from "lib/draft-pro/dustRateLimit";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { loadDraftProAccess, requireDraftProServerCapability } from "lib/draft-pro/server";
import { parseRosterScheduleReadFilter, readRosterSchedule, type ScheduleReadClient } from "lib/rosterScheduleData";
import serviceRoleClient from "lib/supabase/server";

const playerSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(200).optional(),
  teamAbbreviation: z.string().trim().min(1).max(8).nullable(),
  eligiblePositions: z.union([z.string().trim().max(100), z.array(z.string().trim().max(20)).max(10)]).nullable(),
  value: z.number().finite().min(-1_000_000).max(1_000_000),
  status: z.enum(["active", "bench", "ir", "ir+", "na", "inactive"]).optional(),
  available: z.boolean().optional(),
  projectionSeason: z.string().trim().min(1).max(40),
}).strict();

const requestSchema = z.object({
  season: z.string().trim().min(1).max(40),
  lineupMode: z.enum(["daily", "weekly"]),
  gameKey: z.string().trim().min(1).max(40),
  startWeek: z.number().int().min(1).max(40),
  endWeek: z.number().int().min(1).max(40),
  roster: z.array(playerSchema).max(60),
  candidates: z.array(playerSchema).max(500),
  rosterSlots: z.record(z.number().int().min(0).max(30)).refine((value) => Object.keys(value).length <= 30),
}).strict().refine((value) => value.endWeek >= value.startWeek && value.endWeek - value.startWeek < 40, {
  message: "The matchup-week range is invalid.",
});

function failure(res: NextApiResponse, status: number, code: string, message: string, retryAfterSeconds?: number) {
  if (retryAfterSeconds) res.setHeader("Retry-After", String(retryAfterSeconds));
  return res.status(status).json({ success: false, error: { code, message } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return failure(res, 405, "method_not_allowed", "POST is required.");
  }
  const user = await requireApiUser(req, res, {
    onUnauthorized: (message) => failure(res, 401, "authentication_required", message),
  });
  if (!user) return;
  try {
    const access = await loadDraftProAccess(user.id, {
      now: new Date(),
      patreonVerificationAvailable: true,
      flags: getDraftProFeatureFlags(),
    });
    requireDraftProServerCapability(access, "dust");
    const rate = await enforceDraftProDustRateLimit(user.id);
    const parsed = requestSchema.parse(req.body);
    const filter = parseRosterScheduleReadFilter({
      gameKey: parsed.gameKey,
      startWeek: String(parsed.startWeek),
      endWeek: String(parsed.endWeek),
    });
    const games = await readRosterSchedule(serviceRoleClient as unknown as ScheduleReadClient, filter);
    const seasons = new Set(games.map((game) => game.season));
    const fetchedAt = games.map((game) => game.fetched_at).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
    const result = evaluateDraftProDust({
      ...parsed,
      schedule: {
        season: seasons.size === 1 ? [...seasons][0] : "",
        fetchedAt,
        games: games.map((game) => ({
          gameId: String(game.source_game_id),
          date: game.game_date,
          teamAbbreviation: game.team_abbreviation,
          yahooWeek: game.week,
          status: "scheduled" as const,
          season: game.season,
        })),
      },
    } satisfies DraftProDustInput);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-RateLimit-Remaining", String(rate.remainingPoints));
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const status = Number((error as { statusCode?: number }).statusCode);
    if (status) return failure(res, status, String((error as { code?: string }).code ?? "draft_pro_unavailable"), error instanceof Error ? error.message : "DUST is unavailable.", Number((error as { retryAfterSeconds?: number }).retryAfterSeconds) || undefined);
    if (error instanceof z.ZodError) return failure(res, 400, "invalid_input", error.issues[0]?.message ?? "Invalid DUST input.");
    return failure(res, 500, "dust_calculation_failed", "DUST could not be calculated.");
  }
}
