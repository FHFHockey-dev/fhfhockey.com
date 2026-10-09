import type { NextApiRequest, NextApiResponse } from "next";

import supabase from "lib/supabase/server";
import { inspectCalendarForgeCoverage, seedCalendarForgeJobs } from "lib/player-forecasts/orchestration";
import { inspectCalendarConsumerCoverage, parseCalendarCoverageProfile } from "lib/player-forecasts/calendarCoverage";
import { ForecastScheduleError } from "lib/player-forecasts/scopeReads";

export const config = { maxDuration: 60 };

/** Daily scope discovery only; the existing leased FORGE worker issues each game. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return res.status(503).json({ error: "Scheduler not configured" });
  if (req.headers.authorization !== `Bearer ${secret}`) return res.status(401).end();
  if (process.env.STARTER_BOARD_CALENDAR_SCHEDULER_ENABLED !== "true" && req.query.preview !== "true") {
    return res.status(200).json({ disabled: true });
  }
  const configuredDays = req.query.days ?? process.env.STARTER_BOARD_CALENDAR_HORIZON_DAYS ?? "14";
  const days = typeof configuredDays === "string" ? Number(configuredDays) : NaN;
  if (!Number.isInteger(days) || days < 1 || days > 21 ||
      (req.query.dryRun != null && req.query.dryRun !== "true" && req.query.dryRun !== "false")) {
    return res.status(400).json({ error: "Invalid calendar scope" });
  }
  const dryRun = req.query.preview === "true" || req.query.dryRun === "true" ||
    (req.query.dryRun !== "false" && process.env.STARTER_BOARD_CALENDAR_DRY_RUN !== "false");
  let profile;
  try { profile = parseCalendarCoverageProfile(req.query); }
  catch { return res.status(400).json({ error: "Invalid coverage target profile" }); }
  let result: Awaited<ReturnType<typeof seedCalendarForgeJobs>> | undefined;
  try {
    const now = new Date();
    result = await seedCalendarForgeJobs({ supabase, now, days, dryRun });
    const { scopeReceipts, ...coverage } = await inspectCalendarForgeCoverage(supabase, result.gameIds);
    const consumerCoverage = profile ? await inspectCalendarConsumerCoverage(supabase, result.scopes, profile, now, days, scopeReceipts)
      : coverage.consumerCoverage;
    return res.status(200).json({ calendarDays: result.calendarDays, calendarPolicy: result.calendarPolicy, dryRun: result.dryRun,
      gameIds: result.gameIds, excludedByCanary: result.excludedByCanary, inserted: result.inserted,
      workload: result.workload, scheduleCoverage: result.scheduleCoverage, coverage: { ...coverage, consumerCoverage } });
  } catch (error) {
    return res.status(503).json({ error: "Forecast calendar orchestration unavailable",
      ...(error instanceof ForecastScheduleError && !result ? { dryRun, inserted: 0,
        scheduleCoverage: error.receipt, consumerCoverage: { status: "not_evaluated",
          requiredPlayerGameTargets: null, eligiblePlayerGameTargets: null } } : {}),
      ...(result ? { coverageUnavailable: true, queueReceipt: { dryRun: result.dryRun,
        inserted: result.inserted, gameIds: result.gameIds, excludedByCanary: result.excludedByCanary } } : {}) });
  }
}
