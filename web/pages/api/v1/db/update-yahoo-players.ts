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

async function getPlayerKeys(supabase: SupabaseClient): Promise<string[]> {
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
        // Last page reached (less than 1000 results)
        fetching = false;
      } else {
        // Move to the next page
        start += pageSize;
      }
    } else {
      // No data means end of data
      fetching = false;
    }
  }

  console.log(`Total player keys fetched: ${allPlayerKeys.length}`);
  return allPlayerKeys;
}

// MODIFIED: Prepare payload for the RPC function
function prepareRpcPayload(player: any, currentDate: string) {
  // Extract the current ownership value
  const currentOwnershipValue = parseFloat(
    player.percent_owned?.[1]?.value || "0"
  );

  return {
    // Include all fields needed by the INSERT/UPDATE part of the function
    player_key: player.player_key,
    player_id: player.player_id,
    player_name: player.name?.full || null,
    draft_analysis: player.draft_analysis || {}, // Pass as JSON
    average_draft_pick: parseFloat(player.draft_analysis?.average_pick || "0"),
    average_draft_round: parseFloat(
      player.draft_analysis?.average_round || "0"
    ),
    average_draft_cost: parseFloat(player.draft_analysis?.average_cost || "0"),
    percent_drafted: parseFloat(player.draft_analysis?.percent_drafted || "0"),
    editorial_player_key: player.editorial_player_key || null,
    editorial_team_abbreviation: player.editorial_team_abbr || null,
    editorial_team_full_name: player.editorial_team_full_name || null,
    eligible_positions: player.eligible_positions || [], // Pass as JSON array
    display_position: player.display_position || null,
    headshot_url: player.headshot?.url || null,
    injury_note: player.injury_note || null,
    full_name: player.name?.full || null,
    // percent_ownership: currentOwnershipValue, // Keep if you still want the old column updated
    position_type: player.position_type || null,
    status: player.status || null,
    status_full: player.status_full || null,
    last_updated: new Date().toISOString(),
    uniform_number: player.uniform_number
      ? parseInt(player.uniform_number)
      : null,

    // --- Add the special fields needed for the append logic ---
    current_ownership_value: currentOwnershipValue,
    current_date: currentDate // Pass today's date (YYYY-MM-DD)
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

    const playerKeys = await getPlayerKeys(supabase);
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
            allRpcPayloads.push(prepareRpcPayload(playerData, currentDate)); // Pass current date
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

      await new Promise((r) => setTimeout(r, 500)); // Slightly increased delay
    }

    const RPC_BATCH_SIZE = 500; // Adjust as needed for performance/limits

    if (allRpcPayloads.length) {
      console.log(
        `Upserting ${allRpcPayloads.length} players to Supabase in batches.`
      );

      for (let i = 0; i < allRpcPayloads.length; i += RPC_BATCH_SIZE) {
        const batch = allRpcPayloads.slice(i, i + RPC_BATCH_SIZE);
        console.log(
          `Upserting batch ${i + 1}-${Math.min(
            i + RPC_BATCH_SIZE,
            allRpcPayloads.length
          )}`
        );

        // *** FIX HERE ***
        // Call the NEW function name 'upsert_players_batch'
        // Pass the batch array as the value for the 'players_data' argument
        const { error } = await supabase.rpc(
          "upsert_players_batch", // <<< Changed function name
          { players_data: batch } // <<< Pass the array under the key matching the function argument
        );
        // *** END FIX ***

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
