// /web/pages/api/v1/db/update-yahoo-players.ts

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  loadYahooGlobalCredentials,
  persistYahooGlobalTokens
} from "lib/integrations/yahoo/globalCredentials";
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import YahooFantasy from "yahoo-fantasy";
import { format } from "date-fns";
import adminOnly from "utils/adminOnlyMiddleware";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import {
  selectCanonicalYahooGame,
  withYahooRetry
} from "lib/integrations/yahoo/ingestionLifecycle";

async function getPlayerKeys(
  supabase: SupabaseClient,
  gameId?: string
): Promise<string[]> {
  const rows = await fetchAllSupabasePages<{ player_key: string }>(
    ({ from, to }) => {
      let query = supabase
        .from("yahoo_player_keys")
        .select("player_key")
        .order("player_key", { ascending: true });
      if (gameId) {
        query = query.like("player_key", `${gameId}.%`);
      }
      return query.range(from, to) as any;
    },
    { pageSize: 1000 }
  );

  return Array.from(new Set(rows.map((row) => row.player_key).filter(Boolean)));
}

// Handles Yahoo "percent_owned" in array/object/primitive forms.
// Returns a number (0-100) or null if unknown/offseason.
function extractPercentOwned(player: any): number | null {
  const po = player?.percent_owned;
  if (!po) return null;

  // Array shape: find the first element with a numeric "value" / "Value"
  if (Array.isArray(po)) {
    const item = po.find((x: any) => x && (x.value != null || x.Value != null));
    const v = item?.value ?? item?.Value;
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // Object shape: { coverage_type, value, delta }
  if (typeof po === "object") {
    const v = (po as any).value ?? (po as any).Value;
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // Primitive shape: "37" | 37
  const n = typeof po === "string" ? parseFloat(po) : Number(po);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function prepareRpcPayload(
  player: any,
  currentDate: string,
  gameId?: string,
  season?: number
) {
  const val = extractPercentOwned(player);

  return {
    player_key: player.player_key,
    player_id: player.player_id,
    player_name: player.name?.full || null,
    draft_analysis: player.draft_analysis ?? null,
    average_draft_pick: parseOptionalNumber(
      player.draft_analysis?.average_pick
    ),
    average_draft_round: parseOptionalNumber(
      player.draft_analysis?.average_round
    ),
    average_draft_cost: parseOptionalNumber(
      player.draft_analysis?.average_cost
    ),
    percent_drafted: parseOptionalNumber(
      player.draft_analysis?.percent_drafted
    ),
    editorial_player_key: player.editorial_player_key || null,
    editorial_team_abbreviation: player.editorial_team_abbr || null,
    editorial_team_full_name: player.editorial_team_full_name || null,
    eligible_positions: player.eligible_positions || [],
    display_position: player.display_position || null,
    headshot_url: player.headshot?.url || null,
    injury_note: player.injury_note || null,
    full_name: player.name?.full || null,

    percent_ownership: val,
    snapshot_status: val == null ? "omitted" : "observed",

    game_id: gameId || null,
    season: season ?? null,
    position_type: player.position_type || null,
    status: player.status || null,
    status_full: player.status_full || null,
    last_updated: new Date().toISOString(),
    uniform_number: player.uniform_number
      ? parseInt(player.uniform_number)
      : null,
    current_date: currentDate
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!["GET", "POST"].includes(req.method || "")) {
    return res
      .status(405)
      .json({ success: false, message: "Method Not Allowed" });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("Starting update-yahoo-players handler.");

  try {
    const creds = await loadYahooGlobalCredentials(supabase);

    // Allow explicit override of gameId via query or JSON body for one-off runs
    // e.g. GET /api/v1/db/update-yahoo-players?gameId=465
    let gameId: string | undefined = undefined;
    let season: number | undefined = undefined;

    const overrideGameId =
      (req.query?.gameId as string) ||
      (req.body && (req.body.gameId as string));
    if (overrideGameId) {
      gameId = overrideGameId;
      console.log(`Using override gameId from request: ${gameId}`);
    } else {
      const { data: gameRows, error: gameErr } = await supabase
        .from("yahoo_game_keys")
        .select(
          "game_id, game_key, season, is_offseason, is_game_over, current_week"
        )
        .eq("code", "nhl")
        .order("season", { ascending: false })
        .order("game_id", { ascending: false })
        .limit(10);
      if (gameErr) {
        throw new Error("Yahoo canonical game lookup failed.");
      }

      const gameRow = selectCanonicalYahooGame(gameRows ?? []);
      if (!gameRow) {
        throw new Error("Yahoo canonical game is unavailable.");
      }
      gameId = String(gameRow.game_id);
      season = gameRow.season ? Number(gameRow.season) : undefined;
      console.log(`Detected canonical NHL game_id=${gameId}, season=${season}`);
    }

    const yf = new YahooFantasy(
      creds.consumer_key,
      creds.consumer_secret,
      async ({
        access_token,
        refresh_token
      }: {
        access_token: string;
        refresh_token: string;
      }) => {
        console.log("Refreshing tokens...");
        await persistYahooGlobalTokens(supabase, creds.id, {
          access_token,
          refresh_token
        });
        console.log("Tokens refreshed and stored.");
      }
    );

    yf.setUserToken(creds.access_token);
    yf.setRefreshToken(creds.refresh_token);

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
        deactivationApplied: false,
        message: "No player keys found."
      });
    }

    const subresources = ["draft_analysis", "percent_owned"];
    const allRpcPayloads: ReturnType<typeof prepareRpcPayload>[] = []; // Store payloads for RPC

    const BATCH_SIZE = 25;
    const currentDate = format(new Date(), "yyyy-MM-dd");
    let failedRows = 0;
    let omitted = 0;
    let retries = 0;
    let rateLimitEvents = 0;

    for (let i = 0; i < playerKeys.length; i += BATCH_SIZE) {
      const batchKeys = playerKeys.slice(i, i + BATCH_SIZE);
      console.log(
        `Fetching players ${i + 1}-${Math.min(
          i + BATCH_SIZE,
          playerKeys.length
        )}/${playerKeys.length}`
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
            }
          }
        );

        if (players && players.length) {
          const returnedKeys = new Set(
            players
              .map((playerData: any) => String(playerData?.player_key ?? ""))
              .filter(Boolean)
          );
          omitted += batchKeys.filter((key) => !returnedKeys.has(key)).length;
          players.forEach((playerData: any) => {
            if (!playerData?.player_key) return;
            allRpcPayloads.push(
              prepareRpcPayload(playerData, currentDate, gameId, season)
            ); // Pass current date + season context
            console.log(
              `Player payload queued: ${
                playerData.name?.full || playerData.player_key
              }`
            );
          });
        } else {
          omitted += batchKeys.length;
          console.warn(
            `No data returned for batch starting with: ${batchKeys[0]}`
          );
        }
      } catch {
        failedRows += batchKeys.length;
        console.error(`Yahoo player batch failed at record ${i + 1}.`);
        continue; // continue with next batch
      }

      await new Promise((r) =>
        setTimeout(r, 450 + Math.floor(Math.random() * 200))
      );
    }

    const RPC_BATCH_SIZE = 500; // Adjust as needed for performance/limits
    // Deduplicate payloads by player_key so we keep one payload per canonical
    // player_key (which includes the game/season prefix). This avoids
    // collapsing different-season entries that share the same player_id.
    function dedupeByPlayerKey(arr: ReturnType<typeof prepareRpcPayload>[]) {
      const map = new Map<string, ReturnType<typeof prepareRpcPayload>>();
      arr.forEach((p) => {
        const key = String(p.player_key);
        // keep the last occurrence (overwrite)
        map.set(key, p);
      });
      return Array.from(map.values());
    }

    const dedupedRpcPayloads = dedupeByPlayerKey(allRpcPayloads);
    const providerComplete = failedRows === 0 && omitted === 0;
    let ownershipHistoryUpserted = 0;
    let draftHistoryUpserted = 0;
    let ownershipOmitted = 0;

    if (dedupedRpcPayloads.length) {
      console.log(
        `Upserting ${dedupedRpcPayloads.length} players to Supabase in batches (deduped from ${allRpcPayloads.length}).`
      );
      for (let i = 0; i < dedupedRpcPayloads.length; i += RPC_BATCH_SIZE) {
        const batch = dedupedRpcPayloads.slice(i, i + RPC_BATCH_SIZE);
        console.log(
          `Upserting batch ${i + 1}-${Math.min(
            i + RPC_BATCH_SIZE,
            dedupedRpcPayloads.length
          )}`
        );

        const { data, error } = await supabase.rpc(
          "upsert_yahoo_players_atomic" as any,
          { players_data: batch } as any
        );

        if (error) {
          console.error(`Yahoo player RPC batch ${i + 1} failed.`);
          throw new Error("Yahoo player persistence failed.");
        }

        const result = data as unknown as {
          processed?: number;
          ownershipHistoryUpserted?: number;
          draftHistoryUpserted?: number;
          ownershipOmitted?: number;
        };
        if (result?.processed !== batch.length) {
          throw new Error("Yahoo player persistence count mismatch.");
        }
        ownershipHistoryUpserted += result.ownershipHistoryUpserted ?? 0;
        draftHistoryUpserted += result.draftHistoryUpserted ?? 0;
        ownershipOmitted += result.ownershipOmitted ?? 0;

        await new Promise((resolve) => setTimeout(resolve, 500)); // Keep delay between batches
      }

      console.log(
        `Successfully processed all ${allRpcPayloads.length} player payloads via RPC.`
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
          signal: controller.signal as any
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
        deactivationApplied: false,
        message: `Processed ${dedupedRpcPayloads.length} players via RPC.`
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
      deactivationApplied: false,
      message:
        failedRows > 0
          ? "Yahoo player batches failed."
          : "Yahoo omitted all requested player data."
    });
  } catch {
    console.error("Yahoo player update failed.");
    return res.status(500).json({
      success: false,
      message: "Yahoo player update failed"
    });
  }
}

export default withCronJobAudit(adminOnly(handler as any));
