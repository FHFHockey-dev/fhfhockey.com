// C:\Users\timbr\Desktop\FHFH\fhfhockey.com-3\web\pages\api\v1\db\update-line-combinations\index.ts

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { getCurrentSeason } from "lib/NHL/server";
import adminOnly from "utils/adminOnlyMiddleware";
import { SupabaseClient } from "@supabase/supabase-js";
import { updateLineCombos } from "./[id]";

type LineRepairMode = "recent_gap" | "historical_backfill";

type HistoricalGameRow = {
  id: number;
  date?: string | null;
  startTime?: string | null;
};

function parsePositiveCount(value: string | string[] | undefined, fallback: number) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number(rawValue ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function parseRepairMode(value: string | string[] | undefined): LineRepairMode {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "historical_backfill" ? "historical_backfill" : "recent_gap";
}

function parseGameIdsParam(value: string | string[] | undefined): number[] {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  return rawValues
    .flatMap((entry) => entry.split(","))
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
}

async function listHistoricalGamesInRange(args: {
  supabase: SupabaseClient;
  startDate: string;
  endDate: string;
}) {
  const { data } = await args.supabase
    .from("games")
    .select("id, date, startTime")
    .gte("date", args.startDate)
    .lte("date", args.endDate)
    .order("date", { ascending: true })
    .throwOnError();

  return (data ?? []) as HistoricalGameRow[];
}

async function listHistoricalGamesByIds(args: {
  supabase: SupabaseClient;
  gameIds: number[];
}) {
  const { data } = await args.supabase
    .from("games")
    .select("id, date, startTime")
    .in("id", args.gameIds)
    .order("date", { ascending: true })
    .throwOnError();

  return (data ?? []) as HistoricalGameRow[];
}

export default withCronJobAudit(adminOnly(async (req, res) => {
  const supabase = req.supabase;
  const repairMode = parseRepairMode(req.query.repairMode);
  const count = parsePositiveCount(req.query.count, 5);
  const gameIds = parseGameIdsParam(req.query.gameIds);
  const startDate =
    typeof req.query.startDate === "string" ? req.query.startDate.slice(0, 10) : null;
  const endDate =
    typeof req.query.endDate === "string"
      ? req.query.endDate.slice(0, 10)
      : startDate;

  try {
    if (repairMode === "historical_backfill") {
      if (gameIds.length === 0 && (!startDate || !endDate)) {
        return res.status(400).json({
          success: false,
          repairMode,
          message:
            "Historical line-combination backfill requires gameIds or a startDate/endDate range."
        });
      }

      const games =
        gameIds.length > 0
          ? await listHistoricalGamesByIds({ supabase, gameIds })
          : await listHistoricalGamesInRange({
              supabase,
              startDate: startDate!,
              endDate: endDate!
            });

      if (games.length === 0) {
        return res.json({
          success: true,
          repairMode,
          message: "No games matched the requested historical line-combination backfill scope.",
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
        games.map((game) => updateLineCombos(game.id, supabase))
      );
      const succeededGameIds: number[] = [];
      const failures: Array<{ gameId: number; message: string }> = [];

      results.forEach((result, index) => {
        const game = games[index];
        if (!game) return;
        if (result.status === "fulfilled") {
          succeededGameIds.push(game.id);
          return;
        }
        failures.push({
          gameId: game.id,
          message: result.reason?.message ?? String(result.reason)
        });
      });

      const payload = {
        success: failures.length === 0,
        repairMode,
        message:
          failures.length === 0
            ? `Successfully backfilled line combinations for games [${succeededGameIds.join(", ")}].`
            : `Backfilled line combinations for games [${succeededGameIds.join(", ")}]. Failed games [${failures
                .map((failure) => `${failure.gameId}: ${failure.message}`)
                .join("; ")}]`,
        gameIds: games.map((game) => game.id),
        processed: succeededGameIds.length,
        failed: failures.length,
        requestedScope:
          gameIds.length > 0
            ? { gameIds }
            : { startDate: startDate!, endDate: endDate! },
        failures
      };

      if (failures.length > 0) {
        return res.status(500).json(payload);
      }

      return res.json(payload);
    }

    const currentSeason = await getCurrentSeason();
    const candidateWindow = Math.max(count * 20, 100);

    const { data: recentGames } = await supabase
      .from("games")
      .select("id, startTime")
      .eq("seasonId", currentSeason.seasonId)
      .lte("startTime", new Date().toISOString())
      .order("startTime", { ascending: false })
      .limit(candidateWindow)
      .throwOnError();

    if (!recentGames || recentGames.length === 0) {
      return res.json({
        repairMode,
        message: "No current-season games were eligible for line-combo updates.",
        success: true
      });
    }

    const candidateIds = recentGames.map((game) => game.id);
    const { data: existingLineCombos } = await supabase
      .from("lineCombinations")
      .select("gameId")
      .in("gameId", candidateIds)
      .throwOnError();

    const comboCounts = new Map<number, number>();
    existingLineCombos?.forEach((combo) => {
      comboCounts.set(combo.gameId, (comboCounts.get(combo.gameId) ?? 0) + 1);
    });

    const repairTargets = candidateIds
      .filter((id) => (comboCounts.get(id) ?? 0) < 2)
      .slice(0, count)
      .map((id) => ({ id }));

    if (repairTargets.length === 0) {
      return res.json({
        repairMode,
        message: "Recent current-season line combination data are up to date.",
        success: true,
        candidateWindow,
        requestedScope: {
          count,
          seasonId: currentSeason.seasonId
        }
      });
    }

    const results = await Promise.allSettled(
      repairTargets.map((item) => updateLineCombos(item.id, supabase))
    );
    const updated = results.filter(
      (item) => item.status === "fulfilled"
    ) as PromiseFulfilledResult<any[]>[];
    const failed = results.filter(
      (item) => item.status === "rejected"
    ) as PromiseRejectedResult[];

    // Log the errors if any
    failed.forEach((item) => console.error(item.reason));

    const updatedGameIds = updated.map((item) => item.value[0].gameId);
    const failedMessages = failed.map((item) => item.reason.message);

    if (failed.length > 0) {
      return res.status(500).json({
        success: false,
        repairMode,
        candidateWindow,
        requestedScope: {
          count,
          seasonId: currentSeason.seasonId
        },
        message:
          `Updated line combinations for games [${updatedGameIds}]. ` +
          `Failed games [${failedMessages}]`
      });
    }

    res.json({
      success: true,
      repairMode,
      candidateWindow,
      requestedScope: {
        count,
        seasonId: currentSeason.seasonId
      },
      message: `Successfully updated the line combinations for these games [${updatedGameIds}]`
    });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ message: e.message, success: false });
  }
}));
