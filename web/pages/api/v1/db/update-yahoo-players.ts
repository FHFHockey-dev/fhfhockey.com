// /web/pages/api/v1/db/update-yahoo-players.ts

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  loadYahooGlobalCredentials,
  persistYahooGlobalTokens,
} from "lib/integrations/yahoo/globalCredentials";
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import YahooFantasy from "yahoo-fantasy";
import { format } from "date-fns";
import { randomUUID } from "node:crypto";
import adminOnly from "utils/adminOnlyMiddleware";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import {
  fetchCompleteYahooPlayerKeySnapshot,
  selectCanonicalYahooGame,
  withYahooRetry,
} from "lib/integrations/yahoo/ingestionLifecycle";
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

  try {
    const creds = await loadYahooGlobalCredentials(supabase);

    // Allow explicit override of gameId via query or JSON body for one-off runs
    // e.g. GET /api/v1/db/update-yahoo-players?gameId=465
    const overrideGameId =
      (req.query?.gameId as string) ||
      (req.body && (req.body.gameId as string));
    if (overrideGameId && !/^\d+$/.test(overrideGameId)) {
      throw new Error("Yahoo game override is invalid.");
    }

    let gameQuery = supabase
      .from("yahoo_game_keys")
      .select(
        "game_id, game_key, season, is_offseason, is_game_over, current_week",
      )
      .eq("code", "nhl");
    gameQuery = overrideGameId
      ? gameQuery.eq("game_id", Number(overrideGameId)).limit(1)
      : gameQuery
          .order("season", { ascending: false })
          .order("game_id", { ascending: false })
          .limit(10);
    const { data: gameRows, error: gameErr } = await gameQuery;
    if (gameErr) {
      throw new Error("Yahoo canonical game lookup failed.");
    }

    const gameRow = selectCanonicalYahooGame(
      (gameRows ?? []).map((row) => ({
        ...row,
        is_offseason:
          row.is_offseason == null ? null : Boolean(row.is_offseason),
        is_game_over:
          row.is_game_over == null ? null : Boolean(row.is_game_over),
      })),
    );
    if (!gameRow) {
      throw new Error("Yahoo canonical game is unavailable.");
    }
    const gameId = Number(gameRow.game_id);
    const season = gameRow.season ? Number(gameRow.season) : undefined;
    console.log(
      `${
        overrideGameId ? "Using override" : "Detected canonical"
      } NHL game_id=${gameId}, season=${season}`,
    );

    const yf = new YahooFantasy(
      creds.consumer_key,
      creds.consumer_secret,
      async ({
        access_token,
        refresh_token,
      }: {
        access_token: string;
        refresh_token: string;
      }) => {
        console.log("Refreshing tokens...");
        await persistYahooGlobalTokens(supabase, creds.id, {
          access_token,
          refresh_token,
        });
        console.log("Tokens refreshed and stored.");
      },
    );

    yf.setUserToken(creds.access_token);
    yf.setRefreshToken(creds.refresh_token);

    let retries = 0;
    let rateLimitEvents = 0;
    const keySnapshot = await fetchCompleteYahooPlayerKeySnapshot(
      String(gameId),
      (url) =>
        withYahooRetry(() => (yf as any).api((yf as any).GET, url), {
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
        message: "No player keys found.",
      });
    }

    const subresources = ["draft_analysis", "percent_owned"];
    const allRpcPayloads: YahooPlayerAtomicPayload[] = [];

    const BATCH_SIZE = 25;
    const currentDate = format(new Date(), "yyyy-MM-dd");
    let failedRows = 0;
    let omitted = 0;
    for (let i = 0; i < playerKeys.length; i += BATCH_SIZE) {
      const batchKeys = playerKeys.slice(i, i + BATCH_SIZE);
      console.log(
        `Fetching players ${i + 1}-${Math.min(
          i + BATCH_SIZE,
          playerKeys.length,
        )}/${playerKeys.length}`,
      );

      try {
        let refreshedExpiredToken = false;
        const players = await withYahooRetry(
          async () => {
            try {
              return await yf.players.fetch(batchKeys, subresources);
            } catch (fetchErr: any) {
              const tokenExpired =
                fetchErr.description?.includes("Invalid cookie") ||
                fetchErr.message?.includes("Request denied") ||
                fetchErr.message?.includes("Unexpected token");

              if (!tokenExpired || refreshedExpiredToken) throw fetchErr;
              refreshedExpiredToken = true;
              console.warn("Yahoo token expired; refreshing once.");
              await new Promise<void>((resolve, reject) => {
                yf.refreshToken((err: any) => (err ? reject(err) : resolve()));
              });
              return yf.players.fetch(batchKeys, subresources);
            }
          },
          {
            maxAttempts: 3,
            onRetry: ({ rateLimited }) => {
              retries += 1;
              if (rateLimited) rateLimitEvents += 1;
            },
          },
        );

        if (players && players.length) {
          const returnedKeys = new Set(
            players
              .map((playerData: any) => String(playerData?.player_key ?? ""))
              .filter(Boolean),
          );
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
      } catch {
        failedRows += batchKeys.length;
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

      // Fire-and-forget trigger to sync Google Sheet. Do not block response.
      try {
        const targetUrl = `https://fhfhockey.com/api/internal/sync-yahoo-players-to-sheet${
          gameId ? `?gameId=${encodeURIComponent(gameId)}` : ""
        }`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        fetch(targetUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
          signal: controller.signal as any,
        })
          .then(() => console.log("Triggered sheet sync endpoint"))
          .catch(() => console.warn("Sheet sync trigger failed (non-fatal)."))
          .finally(() => clearTimeout(timeout));
      } catch {
        console.warn("Could not trigger sheet sync (non-fatal).");
      }

      const completeSnapshot = providerComplete && ownershipOmitted === 0;
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
        completeSnapshot,
        keySnapshotId: snapshotId,
        keyPagesFetched: keySnapshot.pagesFetched,
        keyAdded: keyReceipt.added,
        keyReactivated: keyReceipt.reactivated,
        keyChanged: keyReceipt.changed,
        keyDeactivated: keyReceipt.deactivated,
        deactivationApplied: true,
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
      completeSnapshot: false,
      keySnapshotId: snapshotId,
      keyPagesFetched: keySnapshot.pagesFetched,
      keyAdded: keyReceipt.added,
      keyReactivated: keyReceipt.reactivated,
      keyChanged: keyReceipt.changed,
      keyDeactivated: keyReceipt.deactivated,
      deactivationApplied: true,
      message:
        failedRows > 0
          ? "Yahoo player batches failed."
          : "Yahoo omitted all requested player data.",
    });
  } catch {
    console.error("Yahoo player update failed.");
    return res.status(500).json({
      success: false,
      message: "Yahoo player update failed",
    });
  }
}

export default withCronJobAudit(adminOnly(handler as any));
