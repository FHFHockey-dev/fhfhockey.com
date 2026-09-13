import type { NextApiRequest, NextApiResponse } from "next";
import serviceRoleClient from "lib/supabase/server";
import { isYahooLiveDraftEnabled } from "lib/integrations/yahoo/liveDraftApi";
import { getYahooLiveDraftSeasonConfig } from "lib/integrations/yahoo/config";
import { runYahooDraftPollCoordinator } from "lib/integrations/yahoo/pollCoordinator";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const secret = process.env.CRON_SECRET;
  if (!secret?.trim()) return res.status(503).json({ error: "Scheduler not configured" });
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!isYahooLiveDraftEnabled()) return res.status(200).json({ disabled: true });

  try {
    getYahooLiveDraftSeasonConfig();
    const { data, error } = await serviceRoleClient.from("yahoo_draft_sessions")
      .select("id").in("status", ["predraft", "active"]).limit(1);
    if (error) throw error;
    if (!data?.length) return res.status(200).json({ cycles: 0, attempted: 0, succeeded: 0, failed: 0 });

    // Vercel starts a fresh invocation every minute. Brief overlap preserves
    // sub-minute provider cadence; existing database leases serialize polls.
    // Keep batches small and leave headroom inside the 240-second function limit.
    const deadline = Date.now() + 65_000;
    const totals = { cycles: 0, attempted: 0, succeeded: 0, failed: 0 };
    do {
      const result = await runYahooDraftPollCoordinator({ limit: 4, concurrency: 4 });
      totals.cycles += 1;
      totals.attempted += result.attempted;
      totals.succeeded += result.succeeded;
      totals.failed += result.failed;
      if (Date.now() >= deadline) break;
      await new Promise(resolve => setTimeout(resolve, Math.min(1_000, deadline - Date.now())));
    } while (Date.now() < deadline);
    console.info("yahoo_live_draft_scheduled_cycle", totals);
    return res.status(totals.failed ? 503 : 200).json(totals);
  } catch {
    return res.status(503).json({ error: "Yahoo polling coordinator unavailable" });
  }
}
