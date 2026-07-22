import type { NextApiRequest, NextApiResponse } from "next";

import { loadSustainabilityHealth } from "lib/sustainability/health";
import adminOnly from "utils/adminOnlyMiddleware";

export async function sustainabilityHealthHandler(
  req: NextApiRequest & { supabase: any },
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    const report = await loadSustainabilityHealth(req.supabase);
    return res.status(200).json({ success: true, report });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export default adminOnly(sustainabilityHealthHandler as any);
