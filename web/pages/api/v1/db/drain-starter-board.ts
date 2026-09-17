import adminOnly from "utils/adminOnlyMiddleware";
import { computeStarterBoardJob, drainStarterBoardQueue } from "lib/projections/starterBoardQueue";

export const config = { maxDuration: 240 };
export default adminOnly(async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  try {
    if (req.body?.job || req.body?.owner) {
      const { job, owner } = req.body;
      if (typeof owner !== "string" || !/^[0-9a-f-]{36}$/i.test(owner) || !Number.isSafeInteger(job?.game_id)
        || !Number.isSafeInteger(job?.claimed_version) || job.claimed_version < 1 || !Number.isFinite(Date.parse(job?.first_accepted_at))) {
        return res.status(400).json({ success: false, message: "Invalid leased game" });
      }
      const result = await computeStarterBoardJob(req.supabase, job, owner);
      return res.status(result.error ? 503 : 200).json({ success: !result.error, ...result });
    }
    const result = await drainStarterBoardQueue(req.supabase);
    return res.status(result.failed ? 207 : 200).json({ success: result.failed === 0, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : String(error) });
  }
});
