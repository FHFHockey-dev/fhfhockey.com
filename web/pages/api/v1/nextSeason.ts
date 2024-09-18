// pages/api/v1/season/next.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { getNextSeason } from "lib/NHL/server";
import { Season } from "lib/NHL/types";

type ErrorResponse = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Season | ErrorResponse>
) {
  try {
    const data = await getNextSeason();
    res.setHeader("Cache-Control", "max-age=86400");
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch next season data." });
  }
}
