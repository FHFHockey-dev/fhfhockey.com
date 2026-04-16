import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import adminOnly from "utils/adminOnlyMiddleware";
import { SupabaseType } from "lib/supabase/client";

import { updatePowerPlayCombinations } from "./[gameId]";

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

export default withCronJobAudit(adminOnly(async (req, res) => {
  const { supabase } = req;
  const gameIds = parseGameIdsParam(req.query.gameIds);
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

    const results = await Promise.allSettled(
      games.map((game) => updatePowerPlayCombinations(game.id, supabase))
    );
    const succeededGameIds: number[] = [];
    const failures: PowerPlayFailure[] = [];
    const skippedGames: PowerPlayFailure[] = [];

    results.forEach((result, index) => {
      const game = games[index];
      if (!game) return;
      if (result.status === "fulfilled") {
        succeededGameIds.push(game.id);
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
    const payload = {
      success: failures.length === 0,
      message:
        failures.length === 0
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
      requestedScope:
        gameIds.length > 0
          ? { gameIds }
          : { startDate: startDate!, endDate: endDate! },
      skips: skippedGames,
      failures
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
}));
