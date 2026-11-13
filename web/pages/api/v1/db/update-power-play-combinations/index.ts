import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { withNhlOffSeasonSkip } from "lib/cron/nhlOffSeason";
import pLimit from "p-limit";
import adminOnly from "utils/adminOnlyMiddleware";
import { SupabaseType } from "lib/supabase/client";

import {
  isSuccessfulDryRunBody,
  ppStoredCalculationWritesEnabled,
  storedWritesDisabledBody,
  updatePowerPlayCombinations,
  type PowerPlayCombinationUpdateSummary
} from "./[gameId]";

// About a week of games, which still finishes well inside the 240 s function limit at this concurrency.
export const MAX_GAMES_PER_CALL = 60;
export const MAX_CONCURRENT_GAMES = 4;

/**
 * A dry run (dryRun=true) returns every game's full result: its two clock rows, the computed player rows and the
 * diff against the stored rows (deleted, updated with before/after, inserted, unchanged), plus totals. It never
 * truncates: at the 60-game cap that is roughly 0.5 MB (about 25 rows of ~230 bytes per game), well under the
 * response limit. A complete, successful dry run writes nothing, not even its cron_job_audit row.
 */
type DryRunGame = Pick<PowerPlayCombinationUpdateSummary, "gameId" | "clock" | "rows" | "diff">;

function dryRunTotals(games: DryRunGame[]) {
  const clocks = games.flatMap((game) => game.clock);
  return {
    games: games.length,
    clockRows: clocks.length,
    available: clocks.filter((row) => row.availability === "available").length,
    notApplicable: clocks.filter((row) => row.availability === "not_applicable").length,
    unavailable: clocks.filter((row) => row.availability === "unavailable").length,
    playerRows: games.reduce((sum, game) => sum + game.rows.length, 0),
    deleted: games.reduce((sum, game) => sum + game.diff.deleted.length, 0),
    updated: games.reduce((sum, game) => sum + game.diff.updated.length, 0),
    inserted: games.reduce((sum, game) => sum + game.diff.inserted.length, 0),
    unchanged: games.reduce((sum, game) => sum + game.diff.unchanged, 0)
  };
}

function parseConcurrency(value: string | string[] | undefined): number | null {
  if (value === undefined) return MAX_CONCURRENT_GAMES;
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_CONCURRENT_GAMES ? parsed : null;
}

const tooManyGamesMessage = (scope: string) =>
  `${scope} exceeds the limit of ${MAX_GAMES_PER_CALL} games per call. Split the repair into smaller calls.`;

type GameRow = {
  id: number;
  date: string;
};

type PowerPlayFailure = {
  gameId: number;
  message: string;
};

function parseGameIdsParam(value: string | string[] | undefined): number[] {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  return rawValues
    .flatMap((entry) => entry.split(","))
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
}

function isSkippablePowerPlayFailure(message: string): boolean {
  return /gameState.*\b(?:FUT|PRE)\b/i.test(message);
}

async function listGamesInRange(args: {
  startDate: string;
  endDate: string;
  supabase: SupabaseType;
}): Promise<GameRow[]> {
  const { data } = await args.supabase
    .from("games")
    .select("id,date")
    .gte("date", args.startDate)
    .lte("date", args.endDate)
    .order("date", { ascending: true })
    .limit(MAX_GAMES_PER_CALL + 1)
    .throwOnError();

  return (data ?? []) as GameRow[];
}

async function listGamesByIds(args: {
  gameIds: number[];
  supabase: SupabaseType;
}): Promise<GameRow[]> {
  const { data } = await args.supabase
    .from("games")
    .select("id,date")
    .in("id", args.gameIds)
    .order("date", { ascending: true })
    .throwOnError();

  return (data ?? []) as GameRow[];
}

export default adminOnly(withCronJobAudit(withNhlOffSeasonSkip(async (req, res) => {
  const { supabase } = req;
  const gameIds = [...new Set(parseGameIdsParam(req.query.gameIds))];
  const startDate =
    typeof req.query.startDate === "string" ? req.query.startDate.slice(0, 10) : null;
  const endDate =
    typeof req.query.endDate === "string"
      ? req.query.endDate.slice(0, 10)
      : startDate;

  if (gameIds.length === 0 && (!startDate || !endDate)) {
    return res.status(400).json({
      success: false,
      message:
        "Provide gameIds or a startDate/endDate range for bulk power-play combination repair."
    });
  }

  if (gameIds.length > MAX_GAMES_PER_CALL) {
    return res.status(400).json({
      success: false,
      message: tooManyGamesMessage(`The list of ${gameIds.length} game ids`)
    });
  }

  // Both default to today's behaviour: writes, at MAX_CONCURRENT_GAMES.
  const dryRun = req.query.dryRun === "true" || req.query.dryRun === "1";
  const concurrency = parseConcurrency(req.query.concurrency);
  if (concurrency === null) {
    return res.status(400).json({
      success: false,
      message: `concurrency must be a whole number from 1 to ${MAX_CONCURRENT_GAMES}.`
    });
  }
  // Writes stay off until TJ sets the flag: a write call (nightly cron 388 included) reads and writes nothing.
  if (!dryRun && !ppStoredCalculationWritesEnabled()) {
    return res.json(storedWritesDisabledBody({
      gameIds: [],
      processed: 0,
      failed: 0,
      requestedScope: gameIds.length > 0 ? { gameIds } : { startDate: startDate!, endDate: endDate! }
    }));
  }

  try {
    const games =
      gameIds.length > 0
        ? await listGamesByIds({ gameIds, supabase })
        : await listGamesInRange({
            startDate: startDate!,
            endDate: endDate!,
            supabase
          });

    if (games.length === 0) {
      return res.json({
        success: true,
        message: "No games matched the requested bulk power-play repair scope.",
        gameIds: [],
        processed: 0,
        failed: 0,
        requestedScope:
          gameIds.length > 0
            ? { gameIds }
            : { startDate: startDate!, endDate: endDate! }
      });
    }

    if (games.length > MAX_GAMES_PER_CALL) {
      return res.status(400).json({
        success: false,
        message: tooManyGamesMessage(`The range ${startDate} to ${endDate}`)
      });
    }

    const limit = pLimit(concurrency);
    const results = await Promise.allSettled(
      games.map((game) =>
        limit(() =>
          dryRun
            ? updatePowerPlayCombinations(game.id, supabase, { dryRun: true })
            : updatePowerPlayCombinations(game.id, supabase)
        )
      )
    );
    const succeededGameIds: number[] = [];
    let keptUnproven = 0;
    const failures: PowerPlayFailure[] = [];
    const skippedGames: PowerPlayFailure[] = [];
    const dryRunGames: DryRunGame[] = [];

    results.forEach((result, index) => {
      const game = games[index];
      if (!game) return;
      if (result.status === "fulfilled") {
        succeededGameIds.push(game.id);
        keptUnproven += result.value?.keptUnproven ?? 0;
        if (dryRun && result.value) {
          const { gameId, clock, rows, diff } = result.value;
          dryRunGames.push({ gameId, clock, rows, diff });
        }
        return;
      }
      const failure = {
        gameId: game.id,
        message: result.reason?.message ?? String(result.reason)
      };
      if (isSkippablePowerPlayFailure(failure.message)) {
        skippedGames.push(failure);
        return;
      }
      failures.push(failure);
    });

    const succeededOrSkippedGameIds = [
      ...succeededGameIds,
      ...skippedGames.map((entry) => entry.gameId)
    ];
    const dryRunFields = dryRun
      ? { dryRun: true, totals: dryRunTotals(dryRunGames), games: dryRunGames }
      : {};
    const payload = {
      success: failures.length === 0,
      message: dryRun
        ? `Dry run: computed power-play combinations for games [${succeededGameIds.join(", ")}]; nothing was written.${
            failures.length > 0
              ? ` Failed games [${failures.map((failure) => `${failure.gameId}: ${failure.message}`).join("; ")}]`
              : ""
          }`
        : failures.length === 0
          ? skippedGames.length === 0
            ? `Successfully updated power-play combinations for games [${succeededGameIds.join(", ")}].`
            : `Updated power-play combinations for games [${succeededGameIds.join(", ")}]. Skipped pregame games [${skippedGames
                .map((skip) => `${skip.gameId}: ${skip.message}`)
                .join("; ")}].`
          : `Updated power-play combinations for games [${succeededOrSkippedGameIds.join(", ")}]. Failed games [${failures
              .map((failure) => `${failure.gameId}: ${failure.message}`)
              .join("; ")}]`,
      gameIds: games.map((game) => game.id),
      processed: succeededGameIds.length,
      skipped: skippedGames.length,
      failed: failures.length,
      keptUnproven,
      requestedScope:
        gameIds.length > 0
          ? { gameIds }
          : { startDate: startDate!, endDate: endDate! },
      skips: skippedGames,
      failures,
      ...dryRunFields
    };

    if (failures.length > 0) {
      return res.status(500).json(payload);
    }

    return res.json(payload);
  } catch (e: any) {
    return res.status(400).json({
      success: false,
      message: e?.message ?? "Failed to bulk update power-play combinations."
    });
  }
}), { skipAuditWhenNoOp: isSuccessfulDryRunBody }));
