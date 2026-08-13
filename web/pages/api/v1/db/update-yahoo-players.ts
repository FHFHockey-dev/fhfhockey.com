// /web/pages/api/v1/db/update-yahoo-players.ts

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { randomUUID } from "node:crypto";
import adminOnly from "utils/adminOnlyMiddleware";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import {
  extractYahooPlayerBatch,
  fetchCompleteYahooPlayerKeySnapshot,
  fetchYahooPublicJson,
  isYahooGameWeekSnapshotReceipt,
  isYahooSheetExportEligible,
  prepareYahooGameWeekSnapshot,
  requestYahooSheetExport,
  withYahooRetry,
  type YahooGameWeekSnapshotReceipt,
} from "lib/integrations/yahoo/ingestionLifecycle";
import { classifyYahooLifecycleError } from "lib/integrations/yahoo/lifecycleHealth";
import type { Database } from "lib/supabase/database-generated.types";
import {
  dedupeYahooPlayerPayloads,
  persistYahooPlayerPayloadBatch,
  prepareYahooPlayerAtomicPayload,
  type YahooPlayerAtomicPayload,
} from "lib/integrations/yahoo/playerWriter";

async function getPlayerKeys(
  supabase: SupabaseClient<Database>,
  gameId: number,
): Promise<string[]> {
  const rows = await fetchAllSupabasePages<{ player_key: string }>(
    ({ from, to }) => {
      return supabase
        .from("yahoo_player_keys")
        .select("player_key")
        .eq("game_id", gameId)
        .eq("is_active", true)
        .order("player_key", { ascending: true })
        .range(from, to) as any;
    },
    { pageSize: 1000 },
  );

  return Array.from(new Set(rows.map((row) => row.player_key).filter(Boolean)));
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!["GET", "POST"].includes(req.method || "")) {
    return res
      .status(405)
      .json({ success: false, message: "Method Not Allowed" });
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  console.log("Starting update-yahoo-players handler.");

  let retries = 0;
  let rateLimitEvents = 0;

  try {
    // Allow explicit override of gameId via query or JSON body for one-off runs
    // while the scheduled path follows Yahoo's live NHL alias.
    const rawOverrideGameId =
      (req.query?.gameId as string) ||
      (req.body && (req.body.gameId as string));
    const overrideGameId = rawOverrideGameId ? String(rawOverrideGameId) : null;
    if (overrideGameId && !/^\d+$/.test(overrideGameId)) {
      throw new Error("Yahoo game override is invalid.");
    }

    const requestedGameKey = overrideGameId || "nhl";
    const gameResponse = await withYahooRetry(
      () =>
        fetchYahooPublicJson(
          `game/${encodeURIComponent(requestedGameKey)}/game_weeks`,
        ),
      {
        maxAttempts: 3,
        onRetry: ({ rateLimited }) => {
          retries += 1;
          if (rateLimited) rateLimitEvents += 1;
        },
      },
    );
    const gameSnapshot = prepareYahooGameWeekSnapshot(gameResponse);
    if (
      overrideGameId &&
      gameSnapshot.game.game_id !== Number(overrideGameId)
    ) {
      throw new Error("Yahoo game override resolved to another game.");
    }
    const gameId = gameSnapshot.game.game_id;
    const season = gameSnapshot.game.season;

    const { data: storedGame, error: storedGameError } = await supabase
      .from("yahoo_game_keys")
      .select("game_id, game_key, season")
      .eq("game_id", gameId)
      .maybeSingle();
    if (storedGameError) {
      throw new Error("Yahoo game metadata lookup failed.");
    }
    if (
      !storedGame ||
      storedGame.game_key !== gameSnapshot.game.game_key ||
      Number(storedGame.season) !== season
    ) {
      const gameSnapshotId = randomUUID();
      const { data, error } = await supabase.rpc(
        "replace_yahoo_game_weeks_snapshot",
        {
          p_snapshot_id: gameSnapshotId,
          p_game: gameSnapshot.game,
          p_weeks: gameSnapshot.weeks,
        },
      );
      if (error) {
        throw new Error("Yahoo game metadata persistence failed.");
      }
      if (
        !isYahooGameWeekSnapshotReceipt(
          data as YahooGameWeekSnapshotReceipt | null,
          {
            snapshotId: gameSnapshotId,
            gameId,
            gameKey: gameSnapshot.game.game_key,
            season,
            sourceCount: gameSnapshot.weeks.length,
          },
        )
      ) {
        throw new Error("Yahoo game metadata receipt is invalid.");
      }
    }

    const [mappedResult, unmatchedResult] = await Promise.all([
      supabase
        .from("yahoo_nhl_player_map")
        .select("*", { count: "exact", head: true })
        .not("yahoo_player_id", "is", null),
      supabase
        .from("yahoo_nhl_player_map_unmatched")
        .select("*", { count: "exact", head: true }),
    ]);
    if (mappedResult.error || unmatchedResult.error) {
      throw new Error("Yahoo mapping health schema query failed.");
    }
    const health = {
      mappedPlayers: mappedResult.count ?? 0,
      unmatchedPlayers: unmatchedResult.count ?? 0,
    };
    console.log(
      `${
        overrideGameId ? "Using override" : "Detected live"
      } NHL game_id=${gameId}, season=${season}`,
    );
    const keySnapshot = await fetchCompleteYahooPlayerKeySnapshot(
      String(gameId),
      (url) =>
        withYahooRetry(() => fetchYahooPublicJson(url), {
          maxAttempts: 3,
          onRetry: ({ rateLimited }) => {
            retries += 1;
            if (rateLimited) rateLimitEvents += 1;
          },
        }),
    );
    if (!keySnapshot.players.length) {
      throw new Error("Yahoo complete player-key snapshot is empty.");
    }

    const snapshotId = randomUUID();
    const { data: keyReceiptData, error: keyReceiptError } = await supabase.rpc(
      "replace_yahoo_player_keys_snapshot",
      {
        p_game_id: gameId,
        p_snapshot_id: snapshotId,
        p_players: keySnapshot.players,
      },
    );
    if (keyReceiptError) {
      throw new Error("Yahoo player-key snapshot persistence failed.");
    }
    const keyReceipt = keyReceiptData as {
      snapshotId?: string;
      gameId?: number;
      sourceCount?: number;
      added?: number;
      reactivated?: number;
      changed?: number;
      deactivated?: number;
      replayed?: boolean;
    } | null;
    if (
      keyReceipt?.snapshotId !== snapshotId ||
      keyReceipt.gameId !== gameId ||
      keyReceipt.sourceCount !== keySnapshot.players.length ||
      !Number.isFinite(keyReceipt.added) ||
      !Number.isFinite(keyReceipt.reactivated) ||
      !Number.isFinite(keyReceipt.changed) ||
      !Number.isFinite(keyReceipt.deactivated) ||
      keyReceipt.replayed !== false
    ) {
      throw new Error("Yahoo player-key snapshot receipt is invalid.");
    }

    const playerKeys = await getPlayerKeys(supabase, gameId);
    console.log(`Fetched ${playerKeys.length} player keys.`);

    if (!playerKeys.length) {
      return res.status(200).json({
        success: true,
        status: "success",
        gameId,
        season: season ?? null,
        sourceRows: 0,
        processed: 0,
        succeeded: 0,
        failedRows: 0,
        omitted: 0,
        retries: 0,
        rateLimitEvents: 0,
        completeSnapshot: true,
        keySnapshotId: snapshotId,
        keyPagesFetched: keySnapshot.pagesFetched,
        keyAdded: keyReceipt.added,
        keyReactivated: keyReceipt.reactivated,
        keyChanged: keyReceipt.changed,
        keyDeactivated: keyReceipt.deactivated,
        deactivationApplied: true,
        health,
        message: "No player keys found.",
      });
    }

    const allRpcPayloads: YahooPlayerAtomicPayload[] = [];

    const BATCH_SIZE = 25;
    const currentDate = format(new Date(), "yyyy-MM-dd");
    let failedRows = 0;
    let omitted = 0;
    let errorCategory:
      | "token_failure"
      | "schema_drift"
      | "provider_unavailable"
      | null = null;
    for (let i = 0; i < playerKeys.length; i += BATCH_SIZE) {
      const batchKeys = playerKeys.slice(i, i + BATCH_SIZE);
      console.log(
        `Fetching players ${i + 1}-${Math.min(
          i + BATCH_SIZE,
          playerKeys.length,
        )}/${playerKeys.length}`,
      );

      try {
        const response = await withYahooRetry(
          () =>
            fetchYahooPublicJson(
              `players;player_keys=${batchKeys
                .map(encodeURIComponent)
                .join(",")};out=draft_analysis,percent_owned`,
            ),
          {
            maxAttempts: 3,
            onRetry: ({ rateLimited }) => {
              retries += 1;
              if (rateLimited) rateLimitEvents += 1;
            },
          },
        );
        const players = extractYahooPlayerBatch(response);

        if (players.length) {
          const requestedKeys = new Set(batchKeys);
          const returnedKeys = new Set(
            players
              .map((playerData: any) => String(playerData?.player_key ?? ""))
              .filter(Boolean),
          );
          if ([...returnedKeys].some((key) => !requestedKeys.has(key))) {
            throw new Error("Yahoo player batch returned an unexpected key.");
          }
          omitted += batchKeys.filter((key) => !returnedKeys.has(key)).length;
          players.forEach((playerData: any) => {
            if (!playerData?.player_key) return;
            allRpcPayloads.push(
              prepareYahooPlayerAtomicPayload(
                playerData,
                currentDate,
                String(gameId),
                season,
              ),
            ); // Pass current date + season context
            console.log(
              `Player payload queued: ${
                playerData.name?.full || playerData.player_key
              }`,
            );
          });
        } else {
          omitted += batchKeys.length;
          console.warn(
            `No data returned for batch starting with: ${batchKeys[0]}`,
          );
        }
      } catch (error) {
        failedRows += batchKeys.length;
        errorCategory ??= classifyYahooLifecycleError(error);
        console.error(`Yahoo player batch failed at record ${i + 1}.`);
        continue; // continue with next batch
      }

      await new Promise((r) =>
        setTimeout(r, 450 + Math.floor(Math.random() * 200)),
      );
    }

    const RPC_BATCH_SIZE = 500; // Adjust as needed for performance/limits
    // Deduplicate payloads by player_key so we keep one payload per canonical
    // player_key (which includes the game/season prefix). This avoids
    // collapsing different-season entries that share the same player_id.
    const dedupedRpcPayloads = dedupeYahooPlayerPayloads(allRpcPayloads);
    const providerComplete = failedRows === 0 && omitted === 0;
    let ownershipHistoryUpserted = 0;
    let draftHistoryUpserted = 0;
    let ownershipOmitted = 0;

    if (dedupedRpcPayloads.length) {
      console.log(
        `Upserting ${dedupedRpcPayloads.length} players to Supabase in batches (deduped from ${allRpcPayloads.length}).`,
      );
      for (let i = 0; i < dedupedRpcPayloads.length; i += RPC_BATCH_SIZE) {
        const batch = dedupedRpcPayloads.slice(i, i + RPC_BATCH_SIZE);
        console.log(
          `Upserting batch ${i + 1}-${Math.min(
            i + RPC_BATCH_SIZE,
            dedupedRpcPayloads.length,
          )}`,
        );

        const result = await persistYahooPlayerPayloadBatch(supabase, batch);
        ownershipHistoryUpserted += result.ownershipHistoryUpserted;
        draftHistoryUpserted += result.draftHistoryUpserted;
        ownershipOmitted += result.ownershipOmitted;

        await new Promise((resolve) => setTimeout(resolve, 500)); // Keep delay between batches
      }

      console.log(
        `Successfully processed all ${allRpcPayloads.length} player payloads via RPC.`,
      );

      const completeSnapshot = isYahooSheetExportEligible({
        providerComplete,
        ownershipOmitted,
        persistedRows: dedupedRpcPayloads.length,
        sourceRows: playerKeys.length,
      });
      const sheetExportEligible = completeSnapshot;
      const sheetExport = sheetExportEligible
        ? await requestYahooSheetExport({
            gameId,
            cronSecret: process.env.CRON_SECRET,
          })
        : {
            attempted: false,
            succeeded: false,
            statusCode: null,
            reason: "incomplete_player_receipt" as const,
          };
      const warnings =
        sheetExportEligible && !sheetExport.succeeded
          ? [
              {
                code: "yahoo_sheet_export_failed",
                message:
                  "Player persistence completed, but the receipt-gated sheet export did not succeed.",
              },
            ]
          : [];
      return res.status(200).json({
        success: true,
        status: completeSnapshot ? "success" : "partial",
        gameId,
        season: season ?? null,
        sourceRows: playerKeys.length,
        processed: playerKeys.length,
        succeeded: dedupedRpcPayloads.length,
        rowsUpserted: dedupedRpcPayloads.length,
        failedRows,
        omitted: omitted + ownershipOmitted,
        providerOmitted: omitted,
        ownershipOmitted,
        ownershipHistoryUpserted,
        draftHistoryUpserted,
        retries,
        rateLimitEvents,
        errorCategory,
        completeSnapshot,
        keySnapshotId: snapshotId,
        keyPagesFetched: keySnapshot.pagesFetched,
        keyAdded: keyReceipt.added,
        keyReactivated: keyReceipt.reactivated,
        keyChanged: keyReceipt.changed,
        keyDeactivated: keyReceipt.deactivated,
        deactivationApplied: true,
        sheetExport,
        health,
        warnings,
        message: `Processed ${dedupedRpcPayloads.length} players via RPC.`,
      });
    }

    return res.status(failedRows > 0 ? 502 : 200).json({
      success: failedRows === 0,
      status: failedRows > 0 ? "failure" : "partial",
      gameId,
      season: season ?? null,
      sourceRows: playerKeys.length,
      processed: playerKeys.length,
      succeeded: 0,
      rowsUpserted: 0,
      failedRows,
      omitted,
      providerOmitted: omitted,
      ownershipOmitted: 0,
      ownershipHistoryUpserted: 0,
      draftHistoryUpserted: 0,
      retries,
      rateLimitEvents,
      errorCategory,
      completeSnapshot: false,
      keySnapshotId: snapshotId,
      keyPagesFetched: keySnapshot.pagesFetched,
      keyAdded: keyReceipt.added,
      keyReactivated: keyReceipt.reactivated,
      keyChanged: keyReceipt.changed,
      keyDeactivated: keyReceipt.deactivated,
      deactivationApplied: true,
      health,
      message:
        failedRows > 0
          ? "Yahoo player batches failed."
          : "Yahoo omitted all requested player data.",
    });
  } catch (error) {
    console.error("Yahoo player update failed.");
    const errorCategory = classifyYahooLifecycleError(error);
    return res.status(500).json({
      success: false,
      status: "failure",
      errorCategory,
      retries,
      rateLimitEvents,
      message: "Yahoo player update failed",
    });
  }
}

export default withCronJobAudit(adminOnly(handler as any));
