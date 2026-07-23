// pages/api/v1/db/manual-refresh-token.ts
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  loadYahooGlobalCredentials,
  persistYahooGlobalTokens
} from "lib/integrations/yahoo/globalCredentials";
import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import YahooFantasy from "yahoo-fantasy";
import adminOnly from "utils/adminOnlyMiddleware";
import { withYahooRetry } from "lib/integrations/yahoo/ingestionLifecycle";

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

  let yahooCredentials;
  try {
    yahooCredentials = await loadYahooGlobalCredentials(supabase);
  } catch {
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
      await persistYahooGlobalTokens(supabase, yahooCredentials.id, {
        access_token,
        refresh_token
      });
    }
  );

  yf.setUserToken(yahooCredentials.access_token);
  yf.setRefreshToken(yahooCredentials.refresh_token);

  let retries = 0;
  let rateLimitEvents = 0;
  try {
    await withYahooRetry(() => yf.games.user(), {
      maxAttempts: 3,
      onRetry: ({ rateLimited }) => {
        retries += 1;
        if (rateLimited) rateLimitEvents += 1;
      }
    }); // trivial call to trigger refresh
    return res.status(200).json({
      success: true,
      refreshed: true,
      refreshedAt: new Date().toISOString(),
      retries,
      rateLimitEvents
    });
  } catch {
    return res.status(500).json({
      success: false,
      retries,
      rateLimitEvents,
      error: "Yahoo token refresh failed"
    });
  }
}

export default withCronJobAudit(adminOnly(handler as any));
