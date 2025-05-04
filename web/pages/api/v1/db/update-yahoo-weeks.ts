// web/pages/api/v1/db/update-yahoo-weeks.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import YahooFantasy from "yahoo-fantasy";
import { parseISO } from "date-fns";

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

  try {
    // 1. Get creds & init YahooFantasy
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
        // Persist refreshed tokens
        await supabase
          .from("yahoo_api_credentials")
          .update({
            access_token,
            refresh_token,
            updated_at: new Date().toISOString()
          })
          .eq("id", creds.id);
      }
    );
    yf.setUserToken(creds.access_token);
    yf.setRefreshToken(creds.refresh_token);

    // 2. Read game_key (e.g. "nhl") from query
    const { game_key } = req.query as { game_key?: string };
    if (!game_key) {
      return res
        .status(400)
        .json({ success: false, message: "Missing game_key parameter" });
    }

    // 3. Fetch weeks from Yahoo API
    const response = await yf.game.game_weeks(game_key);
    const {
      game_key: key,
      game_id,
      name,
      code,
      type,
      url,
      season,
      weeks
    } = response;

    // 4. Build payload
    const payload = weeks.map((w: any) => ({
      game_key: key,
      game_id,
      name,
      code,
      type,
      url,
      season,
      week:
        typeof w.week === "string" ? parseInt(w.week, 10) : (w.week as number),
      start_date: parseISO(w.start),
      end_date: parseISO(w.end)
    }));

    // 5. Upsert — only new (game_key,season,week) rows will be inserted
    const { error } = await supabase
      .from("yahoo_matchup_weeks")
      .upsert(payload, {
        onConflict: "game_key,season,week"
      });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: `Upserted ${payload.length} week(s) for game_key=${key}`
    });
  } catch (err: any) {
    console.error("Error updating yahoo matchup weeks:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || String(err) });
  }
}
