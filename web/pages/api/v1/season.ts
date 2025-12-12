import type { NextApiRequest, NextApiResponse } from "next";
import { getCurrentSeason } from "lib/NHL/server";
import { Season } from "lib/NHL/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Season | { error: string }>
) {
  try {
    const data = await getCurrentSeason();
    res.setHeader("Cache-Control", "max-age=86400");
    res.status(200).json(data);
  } catch (e: any) {
    console.error("Error in /api/v1/season:", e);
    res.status(500).json({ error: e.message });
  }
}
