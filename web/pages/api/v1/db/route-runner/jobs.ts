/**
 * Route runner jobs (admin only).
 * GET: the latest 50 jobs. POST { path }: queue an allowlisted route run.
 */
import type { NextApiRequest, NextApiResponse } from "next";

import { parseRunnerInput } from "lib/routeRunner/core";
import { createSupabaseRouteRunnerStore } from "lib/routeRunner/store";
import { createClientWithToken } from "lib/supabase";
import adminOnly, { invokedByCron } from "utils/adminOnlyMiddleware";

const MAX_PATH_LENGTH = 2_000;

/** The signed-in admin's id; null for the cron bearer or an unreadable token. */
async function requesterUserId(req: NextApiRequest): Promise<string | null> {
  const header = req.headers.authorization ?? "";
  if (invokedByCron(header)) return null;
  const token = header.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!token) return null;
  try {
    const { data } = await createClientWithToken(token).auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function handler(req: NextApiRequest & { supabase?: any }, res: NextApiResponse) {
  const store = createSupabaseRouteRunnerStore(req.supabase);
  try {
    if (req.method === "GET") {
      const jobs = await store.listJobs(50);
      return res.status(200).json({ success: true, jobs, serverTime: new Date().toISOString() });
    }
    if (req.method === "POST") {
      const path = (req.body as { path?: unknown } | undefined)?.path;
      if (typeof path !== "string" || !path.trim() || path.length > MAX_PATH_LENGTH) {
        return res.status(400).json({ success: false, error: "Send { path } with the route URL to run." });
      }
      const parsed = parseRunnerInput(path);
      if (!parsed.ok) {
        return res.status(400).json({ success: false, error: parsed.error });
      }
      const job = await store.createJob({
        route_path: parsed.routePath,
        initial_query: parsed.query,
        next_query: parsed.query,
        contract: parsed.contract,
        created_by: await requesterUserId(req)
      });
      await store.insertEvents([
        {
          job_id: job.id,
          level: "info",
          message: `Queued ${parsed.routePath} (${parsed.contract}).${
            parsed.ignoredParams.length
              ? ` Ignored ${parsed.ignoredParams.join(", ")}: the runner sets ${parsed.ignoredParams.length === 1 ? "it" : "them"} each step.`
              : ""
          }`
        }
      ]);
      return res.status(201).json({ success: true, job, ignoredParams: parsed.ignoredParams });
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
