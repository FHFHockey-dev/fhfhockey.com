// /web/pages/api/v1/db/update-yahoo-players.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import YahooFantasy from "yahoo-fantasy";
import { format } from "date-fns";

interface YahooCredentials {
  id: number;
  consumer_key: string;
  consumer_secret: string;
  access_token: string;
  refresh_token: string;
}

async function getYahooAPICredentials(
  supabase: SupabaseClient
): Promise<YahooCredentials> {
  const { data, error } = await supabase
    .from("yahoo_api_credentials")
    .select("id, consumer_key, consumer_secret, access_token, refresh_token")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to fetch Yahoo API credentials: ${error?.message || "No data"}`
    );
  }

  return data;
}

async function getPlayerKeys(
  supabase: SupabaseClient,
  gameId?: string
): Promise<string[]> {
  // If gameId is provided, only fetch keys that start with the gameId prefix
  if (gameId) {
    console.log(`Fetching player keys for game_id=${gameId}`);
    const keys: string[] = [];
    const pageSize = 1000;
    let start = 0;
    let fetching = true;

    while (fetching) {
      console.log(
        `Fetching player keys for ${gameId} from ${start} to ${start + pageSize - 1}`
      );
      const { data, error } = await supabase
        .from("yahoo_player_keys")
        .select("player_key")
        .like("player_key", `${gameId}.%`)
        .range(start, start + pageSize - 1);

      if (error) {
        throw new Error(`Error fetching player keys: ${error.message}`);
      }

      if (data && data.length) {
        keys.push(...data.map((r: any) => r.player_key));
        if (data.length < pageSize) {
          fetching = false;
        } else {
          start += pageSize;
        }
      } else {
        fetching = false;
      }
    }

    console.log(`Total player keys fetched for ${gameId}: ${keys.length}`);
    return keys;
  }

  // fallback: full pagination scan
  const allPlayerKeys: string[] = [];
  const pageSize = 1000;
  let start = 0;
  let fetching = true;

  while (fetching) {
    console.log(
      `Fetching player keys from ${start} to ${start + pageSize - 1}`
    );

    const { data, error } = await supabase
      .from("yahoo_player_keys")
      .select("player_key")
      .range(start, start + pageSize - 1);

    if (error) {
      throw new Error(`Error fetching player keys: ${error.message}`);
    }

    if (data && data.length > 0) {
      allPlayerKeys.push(...data.map((row) => row.player_key));
      if (data.length < pageSize) {
        fetching = false;
      } else {
        start += pageSize;
      }
    } else {
      fetching = false;
    }
  }

  console.log(`Total player keys fetched: ${allPlayerKeys.length}`);
  return allPlayerKeys;
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

function prepareRpcPayload(
  player: any,
  currentDate: string,
  gameId?: string,
  season?: number
) {
  const val = extractPercentOwned(player);
  const currentOwnershipValue = val != null && Number.isFinite(val) ? val : 0; // keep your legacy numeric fields non-null

  // One-day entry for JSONB append; empty array if no valid reading (offseason)
  const timelineEntry =
    val != null && Number.isFinite(val)
      ? [{ date: currentDate, value: val }]
      : [];

  return {
    player_key: player.player_key,
    player_id: player.player_id,
    player_name: player.name?.full || null,
    draft_analysis: player.draft_analysis || {},
    average_draft_pick: parseFloat(player.draft_analysis?.average_pick || "0"),
    average_draft_round: parseFloat(
      player.draft_analysis?.average_round || "0"
    ),
    average_draft_cost: parseFloat(player.draft_analysis?.average_cost || "0"),
    percent_drafted: parseFloat(player.draft_analysis?.percent_drafted || "0"),
    editorial_player_key: player.editorial_player_key || null,
    editorial_team_abbreviation: player.editorial_team_abbr || null,
    editorial_team_full_name: player.editorial_team_full_name || null,
    eligible_positions: player.eligible_positions || [],
    display_position: player.display_position || null,
    headshot_url: player.headshot?.url || null,
    injury_note: player.injury_note || null,
    full_name: player.name?.full || null,

    // numeric column
    percent_ownership: val != null && Number.isFinite(val) ? val : undefined, // let SQL skip if null/undefined

    game_id: gameId || null,
    season: season ?? null,
    position_type: player.position_type || null,
    status: player.status || null,
    status_full: player.status_full || null,
    last_updated: new Date().toISOString(),
    uniform_number: player.uniform_number
      ? parseInt(player.uniform_number)
      : null,

    // timeline append support
    ownership_timeline: timelineEntry,

    // existing append helpers (used by RPC)
    current_ownership_value: currentOwnershipValue,
    current_date: currentDate
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
    const creds = await getYahooAPICredentials(supabase);

    // Allow explicit override of gameId via query or JSON body for one-off runs
    // e.g. GET /api/v1/db/update-yahoo-players?gameId=465
    let gameId: string | undefined = undefined;
    let season: number | undefined = undefined;

    const overrideGameId = (req.query?.gameId as string) || (req.body && (req.body.gameId as string));
    if (overrideGameId) {
      gameId = overrideGameId;
      console.log(`Using override gameId from request: ${gameId}`);
    } else {
      // Determine active NHL game_id / season from yahoo_game_keys
      try {
        const { data: gameRow, error: gameErr } = await supabase
          .from("yahoo_game_keys")
          .select(
            "game_id, game_key, season, is_offseason, is_game_over, current_week"
          )
          .eq("code", "nhl")
          .order("season", { ascending: false })
          .limit(1)
          .single();

        if (gameErr) {
          console.warn(
            "Could not determine active game_id from yahoo_game_keys:",
            gameErr.message || gameErr
          );
        } else if (gameRow && gameRow.game_id) {
          gameId = String(gameRow.game_id);
          season = gameRow.season ? Number(gameRow.season) : undefined;
          console.log(`Detected active NHL game_id=${gameId}, season=${season}`);
        }
      } catch (e) {
        console.warn(
          "Error while querying yahoo_game_keys for active season:",
          e
        );
      }
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
        const { error } = await supabase
          .from("yahoo_api_credentials")
          .update({
            access_token,
            refresh_token,
            updated_at: new Date().toISOString()
          })
          .eq("id", creds.id);

        if (error) {
          console.error("Failed to persist refreshed tokens:", error);
          throw error;
        } else {
          console.log("Tokens refreshed and stored.");
        }
      }
    );

    yf.setUserToken(creds.access_token);
    yf.setRefreshToken(creds.refresh_token);

    const playerKeys = await getPlayerKeys(supabase, gameId);
    console.log(`Fetched ${playerKeys.length} player keys.`);

    if (!playerKeys.length) {
      return res
        .status(200)
        .json({ success: true, message: "No player keys found." });
    }

    const subresources = ["draft_analysis", "percent_owned"];
    const allRpcPayloads: ReturnType<typeof prepareRpcPayload>[] = []; // Store payloads for RPC

    const BATCH_SIZE = 25;
    const currentDate = format(new Date(), "yyyy-MM-dd");

    for (let i = 0; i < playerKeys.length; i += BATCH_SIZE) {
      const batchKeys = playerKeys.slice(i, i + BATCH_SIZE);
      console.log(
        `Fetching players ${i + 1}-${Math.min(
          i + BATCH_SIZE,
          playerKeys.length
        )}/${playerKeys.length}`
      );

      try {
        let players;

        try {
          players = await yf.players.fetch(batchKeys, subresources);
        } catch (fetchErr: any) {
          const tokenExpired =
            fetchErr.description?.includes("Invalid cookie") ||
            fetchErr.message.includes("Request denied") ||
            fetchErr.message.includes("Unexpected token");

          if (tokenExpired) {
            console.warn("Token expired. Refreshing explicitly.");

            await new Promise<void>((resolve, reject) => {
              yf.refreshToken((err: any) => {
                if (err) {
                  console.error("Failed to refresh token explicitly:", err);
                  reject(err);
                } else {
                  console.log("Token refreshed explicitly.");
                  resolve();
                }
              });
            });

            players = await yf.players.fetch(batchKeys, subresources);
          } else {
            throw fetchErr;
          }
        }

        if (players && players.length) {
          players.forEach((playerData: any) => {
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
          console.warn(
            `No data returned for batch starting with: ${batchKeys[0]}`
          );
        }
      } catch (err: any) {
        console.error(
          `Failed fetching batch starting with ${batchKeys[0]}:`,
          err.message || err
        );
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

    // Fetch existing rows by player_key in pages to merge fields when Yahoo
    // returns nulls for certain fields. We intentionally avoid changing
    // payload.player_key or reconciling by player_id so new season-prefixed
    // keys will be inserted as new rows.
    try {
      const existingByKey = new Map<string, any>();
      const keys = dedupedRpcPayloads.map((p) => p.player_key);
      const pageSize = 1000;
      for (let s = 0; s < keys.length; s += pageSize) {
        const chunk = keys.slice(s, s + pageSize);
        const { data: existingRows, error: keyFetchErr } = await supabase
          .from("yahoo_players")
          .select(
            "player_key, player_id, player_name, draft_analysis, percent_ownership, editorial_player_key, editorial_team_abbreviation, editorial_team_full_name, eligible_positions, display_position, headshot_url, injury_note, full_name, position_type, status, status_full, last_updated, uniform_number"
          )
          .in("player_key", chunk as string[]);

        if (keyFetchErr) {
          console.warn(
            "Could not fetch existing yahoo_players for player_key check:",
            keyFetchErr.message || keyFetchErr
          );
          continue;
        }

        if (existingRows && existingRows.length) {
          existingRows.forEach((r: any) =>
            existingByKey.set(String(r.player_key), r)
          );
        }
      }

      // Merge non-null DB-provided values into payloads for the same player_key
      // (do NOT rewrite payload.player_key to a different value).
      dedupedRpcPayloads.forEach((p) => {
        if (existingByKey.has(p.player_key)) {
          const existing = existingByKey.get(p.player_key)!;
          Object.keys(existing).forEach((k) => {
            const pp: any = p;
            const ex: any = existing;
            if (pp[k] == null && ex[k] != null) {
              pp[k] = ex[k];
            }
          });
        }
      });
    } catch (e) {
      console.warn("Error during existing player_key reconciliation:", e);
      // non-fatal: continue and let RPC handle any remaining conflicts
    }

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

        // Call the new function 'upsert_yahoo_players_v3' which supports
        // per-season rows via player_key and accepts game_id/season in
        // each payload.
        const { error } = await supabase.rpc("upsert_yahoo_players_v3", {
          players_data: batch
        });

        if (error) {
          console.error(
            `RPC batch call failed for batch starting at record ${i + 1}:`,
            error
          );
          throw new Error(`RPC batch failed: ${error.message}`);
        } else {
          console.log(`RPC Batch ${i + 1} successful.`);
        }

        await new Promise((resolve) => setTimeout(resolve, 500)); // Keep delay between batches
      }

      console.log(
        `Successfully processed all ${allRpcPayloads.length} player payloads via RPC.`
      );
      return res.status(200).json({
        success: true,
        message: `Processed ${allRpcPayloads.length} players via RPC.`
      });
    }

    return res
      .status(200)
      .json({ success: true, message: "No player data retrieved to process." });
  } catch (err: any) {
    console.error("🚨 API error encountered:", err);
    // Ensure the error message is captured
    const errorMessage = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, message: errorMessage });
  }
}
