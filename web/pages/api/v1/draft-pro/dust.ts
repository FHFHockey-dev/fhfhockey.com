import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { requireApiUser } from "lib/api/requireApiUser";
import { evaluateDraftProDust, type DraftProDustInput } from "lib/draft-pro/dust";
import { enforceDraftProDustRateLimit } from "lib/draft-pro/dustRateLimit";
import { assertDustScheduleRowsMatchResolution, DustScheduleSeasonUnavailableError, normalizeDustProjectionSeason, resolveDustScheduleSeason, type DustScheduleSeasonMetadata } from "lib/draft-pro/dustSeason";
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
  sort: z.enum(["ordinary", "schedule_fit"]).optional(),
  inputOrigin: z.enum(["draft", "private_import"]),
  privateImportAccountSaved: z.boolean().optional(),
  gameKey: z.string().trim().min(1).max(40).optional(),
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

type SeasonMetadataClient = {
  from(table: "roster_optimizer_team_games"): {
    select(columns: string): {
      eq(column: "source_season_id", value: number): {
        range(from: number, to: number): PromiseLike<{
          data: DustScheduleSeasonMetadata[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

const SEASON_MAPPING_PAGE_SIZE = 1_000;
const MAX_SEASON_MAPPING_PAGES = 10;

async function loadPersistedSeasonMapping(
  client: SeasonMetadataClient,
  projectionSeason: string,
  requestedGameKey?: string,
) {
  const sourceSeasonId = Number(projectionSeason);
  if (!/^\d{8}$/.test(projectionSeason) || !Number.isSafeInteger(sourceSeasonId)) {
    return resolveDustScheduleSeason(projectionSeason, [], requestedGameKey);
  }
  const rows: DustScheduleSeasonMetadata[] = [];
  for (let page = 0; page < MAX_SEASON_MAPPING_PAGES; page += 1) {
    const { data, error } = await client
      .from("roster_optimizer_team_games")
      .select("game_key,season,source_season_id")
      .eq("source_season_id", sourceSeasonId)
      .range(page * SEASON_MAPPING_PAGE_SIZE, (page + 1) * SEASON_MAPPING_PAGE_SIZE - 1);
    if (error) throw error;
    const pageRows = data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < SEASON_MAPPING_PAGE_SIZE) {
      return resolveDustScheduleSeason(projectionSeason, rows, requestedGameKey);
    }
  }
  throw new DustScheduleSeasonUnavailableError("The persisted schedule mapping exceeded the bounded metadata read limit.");
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
    const resolution = await loadPersistedSeasonMapping(
      serviceRoleClient as unknown as SeasonMetadataClient,
      parsed.season,
      parsed.gameKey,
    );
    const filter = parseRosterScheduleReadFilter({
      gameKey: resolution.gameKey,
      startWeek: String(parsed.startWeek),
      endWeek: String(parsed.endWeek),
    });
    const games = await readRosterSchedule(serviceRoleClient as unknown as ScheduleReadClient, filter);
    assertDustScheduleRowsMatchResolution(games, resolution);
    const fetchedAt = games.map((game) => game.fetched_at).filter((value): value is string => Boolean(value)).sort();
    const result = evaluateDraftProDust({
      ...parsed,
      season: String(resolution.sourceSeasonId),
      roster: normalizeDustProjectionSeason(parsed.roster, parsed.season, String(resolution.sourceSeasonId)),
      candidates: normalizeDustProjectionSeason(parsed.candidates, parsed.season, String(resolution.sourceSeasonId)),
      schedule: {
        season: String(resolution.sourceSeasonId),
        freshness: {
          // DUST is unavailable if any selected schedule row is stale or unverified.
          oldestFetchedAt: games.length && fetchedAt.length === games.length ? fetchedAt[0] ?? null : null,
          latestFetchedAt: fetchedAt.at(-1) ?? null,
        },
        games: games.map((game) => ({
          gameId: String(game.source_game_id),
          date: game.game_date,
          teamAbbreviation: game.team_abbreviation,
          yahooWeek: game.week,
          status: "scheduled" as const,
          season: String(resolution.sourceSeasonId),
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
