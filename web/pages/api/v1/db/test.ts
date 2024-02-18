import type { NextApiRequest, NextApiResponse } from "next";
import adminOnly from "utils/adminOnlyMiddleware";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    return res.json({
      data: "dddd",
      message: "Successfully updated the players & rosters tables.",
      success: true,
    });
  } catch (e: any) {
    res.status(400).json({
      message: "Failed to update " + e.message,
      success: false,
    });

    console.table(e);
  }
}

export default adminOnly(handler);
