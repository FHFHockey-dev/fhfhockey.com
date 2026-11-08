// pages/api/v1/db/manual-refresh-token.ts
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  loadYahooGlobalCredentials
} from "lib/integrations/yahoo/globalCredentials";
import {
  refreshYahooGlobalCredentials,
  YahooGlobalRefreshError
} from "lib/integrations/yahoo/refreshGlobalCredentials";
import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import adminOnly from "utils/adminOnlyMiddleware";

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

  try {
    await refreshYahooGlobalCredentials(supabase, yahooCredentials);
    return res.status(200).json({
      success: true,
      refreshed: true,
      refreshedAt: new Date().toISOString(),
      retries: 0,
      rateLimitEvents: 0
    });
  } catch (error) {
    const failure = error instanceof YahooGlobalRefreshError ? error : null;
    return res.status(failure?.statusCode ?? 500).json({
      success: false,
      retries: 0,
      rateLimitEvents: failure?.code === "yahoo_refresh_rate_limited" ? 1 : 0,
      code: failure?.code ?? "yahoo_refresh_failed",
      refreshOutcome: failure?.refreshOutcome ?? "unknown",
      error: "Yahoo token refresh failed"
    });
  }
}

export default withCronJobAudit(adminOnly(handler as any));
