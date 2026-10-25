import type { NextApiRequest, NextApiResponse } from "next";
import serviceRoleClient from "lib/supabase/server";
import { isYahooLiveDraftEnabled } from "lib/integrations/yahoo/liveDraftApi";
import { getYahooLiveDraftSeasonConfig } from "lib/integrations/yahoo/config";
import { runYahooDraftPollCoordinator } from "lib/integrations/yahoo/pollCoordinator";
import { isYahooDraftBackgroundPollingSuspended, YAHOO_DRAFT_BACKGROUND_RESUMES_AT } from "lib/integrations/yahoo/pollPolicy";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";

// One audit row per admitted, enabled, unsuspended run. The coordinator owns
// its own errors, so persist only the fixed counters, never provider detail.
const auditedPoll = withCronJobAudit(async (_req: NextApiRequest, res: NextApiResponse) => {
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
}, { jobName: "/api/internal/yahoo-live-draft", recordRowMetrics: false,
  responsePreviewKeys: ["cycles", "attempted", "succeeded", "failed", "error"] });

// Disabled and off-season exits do no work, so most of them write no row. The
// invocation in one fixed UTC minute records a heartbeat instead: about one row
// a day showing the schedule still fires and which idle state it is in.
function idleState() {
  if (!isYahooLiveDraftEnabled()) return { disabled: true };
  if (isYahooDraftBackgroundPollingSuspended()) {
    return { suspended: true, resumesAt: YAHOO_DRAFT_BACKGROUND_RESUMES_AT };
  }
  return null;
}

const isIdleHeartbeatMinute = (now = new Date()) => now.getUTCHours() === 12 && now.getUTCMinutes() === 0;

const auditedIdle = withCronJobAudit(async (_req: NextApiRequest, res: NextApiResponse) =>
  res.status(200).json(idleState()), { jobName: "/api/internal/yahoo-live-draft", recordRowMetrics: false,
  responsePreviewKeys: ["disabled", "suspended", "resumesAt"] });

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
  const idle = idleState();
  if (idle) return isIdleHeartbeatMinute() ? auditedIdle(req, res) : res.status(200).json(idle);
  return auditedPoll(req, res);
}
