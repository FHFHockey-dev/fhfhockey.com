import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import { starterBoardFlags } from "lib/projections/starterBoardFlags";
import { dispatchStarterBoardJobs } from "lib/projections/starterBoardQueue";
import { retryPendingLineSourceEvents } from "lib/sources/lineSourceIftttReceiver";

export const config = { maxDuration: 240 };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  const secret = process.env.CRON_SECRET;
  if (!secret?.trim()) return res.status(503).json({ error: "Scheduler not configured" });
  if (req.headers.authorization !== `Bearer ${secret}`) return res.status(401).end();
  const flags = starterBoardFlags();
  if (!flags.scheduler) return res.status(200).json({ disabled: true });
  // Never derive a credential-bearing destination from an incoming Host header.
  const origin = process.env.STARTER_BOARD_WORKER_ORIGIN;
  if (!origin) return res.status(503).json({ error: "Worker origin not configured" });
  try {
    // Cover yesterday as well as today so midnight cannot strand a final freeze.
    const dates = [new Date(), new Date(Date.now() - 86_400_000)].map((date) => new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(date));
    // Source delays must not hold up already accepted game work. Capture can run
    // on its own before computation/public serving is activated.
    const [capture, dispatch] = await Promise.allSettled([
      flags.capture ? retryPendingLineSourceEvents() : Promise.resolve({ attempted: 0, failed: 0 }),
      (async () => {
        if (!flags.compute) return { dispatched: 0, failed: 0, results: [] };
        for (const date of dates) {
          const { error } = await (supabase as any).rpc("freeze_starter_board_pregame", { p_date: date });
          if (error) throw error;
        }
        return dispatchStarterBoardJobs(supabase, origin, secret);
      })(),
    ]);
    if (capture.status === "rejected" || dispatch.status === "rejected") throw new Error("Scheduled work failed");
    return res.status(capture.value.failed || dispatch.value.failed ? 503 : 200).json({
      mode: flags.compute ? "compute" : flags.capture ? "capture-only" : "idle",
      ...dispatch.value,
      capture: capture.value,
    });
  } catch { return res.status(503).json({ error: "Starter Board dispatch unavailable" }); }
}
