/**
 * One route runner job (admin only).
 * GET ?after=<eventId>: the job plus up to 500 events after that id.
 * POST { action: "cancel" | "run_now" }.
 */
import type { NextApiRequest, NextApiResponse } from "next";

import { ROUTE_RUNNER_ACTIVE_STATUSES } from "lib/routeRunner/core";
import { createSupabaseRouteRunnerStore } from "lib/routeRunner/store";
import adminOnly from "utils/adminOnlyMiddleware";

const EVENT_PAGE_SIZE = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function handler(req: NextApiRequest & { supabase?: any }, res: NextApiResponse) {
  const id = single(req.query.id);
  if (!id || !UUID.test(id)) {
    return res.status(400).json({ success: false, error: "Invalid job id." });
  }
  const store = createSupabaseRouteRunnerStore(req.supabase);
  try {
    if (req.method === "GET") {
      const rawAfter = single(req.query.after) ?? "0";
      if (!/^\d{1,15}$/.test(rawAfter)) {
        return res.status(400).json({ success: false, error: "after must be a non-negative event id." });
      }
      const job = await store.getJob(id);
      if (!job) return res.status(404).json({ success: false, error: "Job not found." });
      const events = await store.listEvents(id, Number(rawAfter), EVENT_PAGE_SIZE);
      return res.status(200).json({
        success: true,
        job,
        events,
        hasMore: events.length === EVENT_PAGE_SIZE,
        serverTime: new Date().toISOString()
      });
    }

    if (req.method === "POST") {
      const action = (req.body as { action?: unknown } | undefined)?.action;
      const nowIso = new Date().toISOString();
      if (action === "cancel") {
        // A step already in flight keeps its lease and finishes; the tick
        // records its result and runs nothing further.
        const job = await store.updateJobIfStatus(id, ROUTE_RUNNER_ACTIVE_STATUSES, {
          status: "cancelled",
          finished_at: nowIso,
          not_before: null,
          last_error: "Cancelled by an admin."
        });
        if (!job) return res.status(409).json({ success: false, error: "Only a queued, running or waiting job can be cancelled." });
        await store.insertEvents([{ job_id: id, level: "warn", message: "Cancelled by an admin." }]);
        return res.status(200).json({ success: true, job });
      }
      if (action === "run_now") {
        const job = await store.updateJobIfStatus(id, ["queued", "waiting"], { not_before: null });
        if (!job) return res.status(409).json({ success: false, error: "Only a queued or waiting job can be run now." });
        await store.insertEvents([
          { job_id: id, level: "info", message: "Run now: the wait is cleared; the next tick (within a minute) runs the next step." }
        ]);
        return res.status(200).json({ success: true, job });
      }
      return res.status(400).json({ success: false, error: 'action must be "cancel" or "run_now".' });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export default adminOnly(handler);
