import type { NextApiRequest, NextApiResponse } from "next";
import { getCurrentSeason } from "lib/NHL/server";
import { Season } from "lib/NHL/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Season>
) {
  const data = await getCurrentSeason();
  res.setHeader("Cache-Control", "max-age=86400");
  res.status(200).json(data);
}
