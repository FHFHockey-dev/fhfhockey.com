import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { normalizeDependencyError } from "lib/cron/normalizeDependencyError";
import {
  getGameStatsCompletenessFailureDetails,
  type GameStatsCompletenessFailureDetails,
} from "lib/cron/gameStatsCompleteness";
import {
  getTransactionalGameStatsFailureDetails,
  quarantineGameStatsBatch,
  type TransactionalGameStatsFailureDetails,
} from "lib/cron/transactionalGameStatsPersistence";
import {
  assertExactStatsStatusAdvancement,
  getStatsStatusAdvancementFailureDetails,
  type StatsStatusAdvancementFailureDetails,
} from "lib/cron/statsStatusAdvancement";
import {
  getStatsPreWriteQuarantineFailureDetails,
  sanitizeCronDiagnostic,
  type StatsPreWriteQuarantineFailureDetails,
} from "lib/cron/statsUpdateSafety";
import { tryFinalizeScheduleNotRealizedGameStats } from "lib/cron/nonRealizedGameStats";
import { getCurrentSeason } from "lib/NHL/server";
import adminOnly from "utils/adminOnlyMiddleware";
import { updateStats } from "../update-stats/[gameId]";

const DEFAULT_GAME_COUNT = 5;
const MIN_GAME_COUNT = 1;
const MAX_GAME_COUNT = 10;

type StatsUpdateFailure =
  | TransactionalGameStatsFailureDetails
  | GameStatsCompletenessFailureDetails
  | StatsStatusAdvancementFailureDetails
  | StatsPreWriteQuarantineFailureDetails
  | {
      kind: "stats_update_failure";
      code: "STATS_UPDATE_FAILED";
      gameId: number;
      message: string;
    };

function serializeStatsUpdateFailure(
  gameId: number,
  error: unknown,
): StatsUpdateFailure {
  return (
    getGameStatsCompletenessFailureDetails(error) ??
    getTransactionalGameStatsFailureDetails(error) ??
    getStatsStatusAdvancementFailureDetails(error) ??
    getStatsPreWriteQuarantineFailureDetails(error) ?? {
      kind: "stats_update_failure",
      code: "STATS_UPDATE_FAILED",
      gameId,
      message: sanitizeCronDiagnostic(error),
    }
  );
}

export function parseStatsCronCount(
  value: string | string[] | undefined,
): number | null {
  if (value === undefined) return DEFAULT_GAME_COUNT;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;

  const count = Number(value);
  return Number.isSafeInteger(count) &&
    count >= MIN_GAME_COUNT &&
    count <= MAX_GAME_COUNT
    ? count
    : null;
}

export default withCronJobAudit(
  adminOnly(async (req, res) => {
    const { supabase } = req;
    const count = parseStatsCronCount(req.query.count);
    if (count === null) {
      return res.status(400).json({
        message: `count must be an integer from ${MIN_GAME_COUNT} through ${MAX_GAME_COUNT}.`,
        success: false,
      });
    }

    try {
      // todo: temporarily disable this as it takes a while to run.
      // this cause the function execution to timeout
      // await processGameIDs(); // updating pbp

      //
      const currentSeasonId = String((await getCurrentSeason()).seasonId);
      if (!/^\d{8}$/.test(currentSeasonId)) {
        throw new Error("Current NHL season ID is not in YYYYYYYY format.");
      }
      const { data } = await supabase
        .rpc("get_unupdated_games_for_season", {
          p_season_id: Number(currentSeasonId),
        })
        .limit(count)
        .throwOnError();
      if (!Array.isArray(data)) {
        throw new Error(
          "get_unupdated_games_for_season returned a non-array result.",
        );
      }
      const selectedRows = data.slice(0, count) as Array<{ gameid?: unknown }>;
      const ids = selectedRows.map((game) => game?.gameid);
      if (
        ids.some(
          (gameId) =>
            typeof gameId !== "number" ||
            !Number.isSafeInteger(gameId) ||
            gameId <= 0,
        ) ||
        new Set(ids).size !== ids.length
      ) {
        throw new Error(
          "get_unupdated_games_for_season returned invalid or duplicate game IDs.",
        );
      }
      const boundedIds = ids as number[];
      if (boundedIds.length === 0) {
        return res.json({
          success: true,
          seasonId: currentSeasonId,
          message: "All game statistics have been successfully updated.",
          attemptedGameIds: [],
          updatedGameIds: [],
          nonRealizedGameIds: [],
        });
      }
      console.log(boundedIds);

      // Create an array of promises
      const updatePromises = boundedIds.map(async (id) => {
        console.log("updating the stats for game with id " + id);
        await updateStats(id, supabase);
        return id;
      });

      // Wait for all promises to resolve
      const results = await Promise.allSettled(updatePromises);

      const updatedGameIds: number[] = [];
      const nonRealizedGameIds: number[] = [];
      const failures: StatsUpdateFailure[] = [];
      for (const [index, result] of results.entries()) {
        if (result.status === "fulfilled") {
          updatedGameIds.push(result.value);
        } else {
          const failedGameId = boundedIds[index];
          try {
            const receipt = await tryFinalizeScheduleNotRealizedGameStats({
              supabase,
              gameId: failedGameId,
              landingError: result.reason,
            });
            if (receipt) {
              nonRealizedGameIds.push(receipt.gameId);
              continue;
            }
            failures.push(
              serializeStatsUpdateFailure(failedGameId, result.reason),
            );
          } catch (finalizationError) {
            failures.push(
              serializeStatsUpdateFailure(failedGameId, finalizationError),
            );
          }
        }
      }
      const failedGameIds = failures.map((failure) => failure.gameId);
      if (failedGameIds.length !== 0) {
        console.warn(
          "Stats backlog games failed and remain subject to explicit retry/quarantine policy.",
          failures.map(({ kind, code, gameId }) => ({ kind, code, gameId })),
        );
      }
      const staleCutoff = new Date();
      staleCutoff.setUTCHours(0, 0, 0, 0);
      staleCutoff.setUTCDate(staleCutoff.getUTCDate() - 30);
      let quarantinedGameIds: number[] = [];
      let statusAdvancementFailure: StatsStatusAdvancementFailureDetails | null =
        null;
      const quarantineEligibleFailureIds = new Set(
        failures
          .filter(
            (failure) => failure.kind === "stats_pre_write_quarantine_failure",
          )
          .map((failure) => failure.gameId),
      );
      const quarantineCandidateIds = failedGameIds.filter((gameId) =>
        quarantineEligibleFailureIds.has(gameId),
      );
      if (quarantineCandidateIds.length > 0) {
        const { data: failedGameMeta, error: failedGameMetaError } =
          await supabase
            .from("games")
            .select("id,date")
            .in("id", quarantineCandidateIds);
        if (failedGameMetaError) {
          throw failedGameMetaError;
        }
        const quarantineCandidateMatches = (
          (failedGameMeta ?? []) as Array<{
            id: number;
            date: string | null;
          }>
        )
          .filter((game) => {
            if (!game?.date) return false;
            const gameTime = Date.parse(`${game.date}T00:00:00.000Z`);
            return (
              Number.isFinite(gameTime) && gameTime < staleCutoff.getTime()
            );
          })
          .map((game) => game.id);

        if (quarantineCandidateMatches.length > 0) {
          let quarantineData: unknown = null;
          let quarantineError: unknown = null;
          try {
            const quarantineReceipts = await quarantineGameStatsBatch({
              supabase,
              gameIds: quarantineCandidateMatches,
              reason: "game_not_finished",
            });
            quarantineData = quarantineReceipts.map((receipt) => ({
              gameId: receipt.gameId,
            }));
          } catch (error) {
            quarantineError = error;
          }

          try {
            quarantinedGameIds = assertExactStatsStatusAdvancement({
              phase: "stale_quarantine",
              expectedGameIds: quarantineCandidateMatches,
              data: quarantineData,
              error: quarantineError,
            });
          } catch (error) {
            statusAdvancementFailure =
              getStatsStatusAdvancementFailureDetails(error);
            quarantinedGameIds = [];
          }
        }
      }
      const pendingRetryGameIds = failedGameIds.filter(
        (gameId) => !quarantinedGameIds.includes(gameId),
      );
      const failedRows = failures.reduce(
        (total, failure) =>
          total +
          (failure.kind === "stats_update_failure" ? 1 : failure.requestedRows),
        0,
      );
      let operationStatus: "success" | "warning" | "failure" = "success";
      let message = "Processed stats backlog successfully.";
      if (pendingRetryGameIds.length > 0) {
        operationStatus = "failure";
        message =
          "Stats backlog processing failed for games that remain pending retry.";
      } else if (quarantinedGameIds.length > 0) {
        operationStatus = "warning";
        message =
          "Processed stats backlog; some stale games were quarantined from automatic retry.";
      } else if (nonRealizedGameIds.length > 0) {
        operationStatus = "warning";
        message =
          "Processed current-season stats; some schedule rows were confirmed as not realized.";
      }

      const response = {
        success: pendingRetryGameIds.length === 0,
        operationStatus,
        seasonId: currentSeasonId,
        message,
        updatedGameIds,
        nonRealizedGameIds,
        failedGameIds,
        quarantinedGameIds,
        pendingRetryGameIds,
        rowsUpserted: updatedGameIds.length,
        failedRows,
        attemptedGameIds: boundedIds,
        failures,
        statusAdvancementFailure,
      };

      if (pendingRetryGameIds.length > 0) {
        return res.status(500).json(response);
      }

      return res.json(response);
    } catch (e: unknown) {
      const dependencyError = normalizeDependencyError(e);
      return res.status(500).json({
        message: dependencyError.message,
        success: false,
        operationStatus: "failure",
        dependencyError,
      });
    }
  }),
);
