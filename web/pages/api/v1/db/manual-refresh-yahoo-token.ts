// pages/api/v1/db/manual-refresh-token.ts
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import YahooFantasy from "yahoo-fantasy";
import adminOnly from "utils/adminOnlyMiddleware";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!["GET", "POST"].includes(req.method || "")) {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: yahooCredentials, error } = await supabase
    .from("yahoo_api_credentials")
    .select("*")
    .single();

  if (error || !yahooCredentials) {
    return res.status(500).json({ error: "Failed to fetch Yahoo credentials" });
  }

  const yf = new YahooFantasy(
    yahooCredentials.consumer_key,
    yahooCredentials.consumer_secret,
    async ({
      access_token,
      refresh_token
    }: {
      access_token: string;
      refresh_token: string;
    }) => {
      await supabase
        .from("yahoo_api_credentials")
        .update({
          access_token,
          refresh_token,
          updated_at: new Date().toISOString()
        })
        .eq("id", yahooCredentials.id);
    }
  );

  yf.setUserToken(yahooCredentials.access_token);
  yf.setRefreshToken(yahooCredentials.refresh_token);

  try {
    await yf.games.user(); // trivial call to trigger refresh
    return res.status(200).json({
      success: true,
      refreshed: true,
      refreshedAt: new Date().toISOString()
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: "Yahoo token refresh failed"
    });
  }
}

export default withCronJobAudit(adminOnly(handler as any));
