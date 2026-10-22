/**
 * Route runner worker. pg_cron calls it every minute while a job is runnable
 * and no step is in flight (draft SQL: tasks/artifacts/route-runner/
 * route_runner_tables.sql). Each call claims at most one job, runs one step
 * of its route in-process within the 240 s function limit, and records it.
 * Admin bearer or the exact cron bearer (adminOnly), audited as
 * "route-runner-tick" with a small row; the inner routes audit themselves.
 */
import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { RouteRunnerPath } from "lib/routeRunner/registry";
import { createSupabaseRouteRunnerStore } from "lib/routeRunner/store";
import { runRouteRunnerTick, type RouteHandler } from "lib/routeRunner/tick";
import adminOnly from "utils/adminOnlyMiddleware";

import updateNstCurrentSeasonHandler from "./update-nst-current-season";
import updateNstGamelogHandler from "./update-nst-gamelog";
import updateNstGoaliesHandler from "./update-nst-goalies";
import updateNstTeamDailyHandler from "./update-nst-team-daily";
import updateRollingPlayerAveragesHandler from "./update-rolling-player-averages";
import updateWgoGoaliesHandler from "./update-wgo-goalies";
import updateWgoSkatersHandler from "./update-wgo-skaters";
import updateWgoTotalsHandler from "./update-wgo-totals";

// Static imports only: one handler per allowlisted path (lib/routeRunner/registry.ts).
const ROUTE_RUNNER_HANDLERS = {
  "/api/v1/db/update-nst-gamelog": updateNstGamelogHandler,
  "/api/v1/db/update-rolling-player-averages": updateRollingPlayerAveragesHandler,
  "/api/v1/db/update-nst-team-daily": updateNstTeamDailyHandler,
  "/api/v1/db/update-nst-goalies": updateNstGoaliesHandler,
  "/api/v1/db/update-nst-current-season": updateNstCurrentSeasonHandler,
  "/api/v1/db/update-wgo-skaters": updateWgoSkatersHandler,
  "/api/v1/db/update-wgo-goalies": updateWgoGoaliesHandler,
  "/api/v1/db/update-wgo-totals": updateWgoTotalsHandler
} satisfies Record<RouteRunnerPath, RouteHandler>;

async function handler(req: NextApiRequest & { supabase?: any }, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }
  // Inner routes are called with the cron bearer; without it every step
  // would fail with 401, so no job is claimed.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret?.trim()) {
    return res.status(500).json({ success: false, error: "CRON_SECRET is not configured." });
  }
  try {
    const summary = await runRouteRunnerTick({
      store: createSupabaseRouteRunnerStore(req.supabase),
      handlers: ROUTE_RUNNER_HANDLERS,
      cronSecret
    });
    return res.status(200).json(summary);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// adminOnly is outermost so a rejected request never reaches the audit insert.
export default adminOnly(
  withCronJobAudit(handler, {
    jobName: "route-runner-tick",
    recordRowMetrics: false
  })
);
