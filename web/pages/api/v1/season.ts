import type { NextApiRequest, NextApiResponse } from "next";
import { getCurrentSeason } from "lib/NHL/server";
import { Season } from "lib/NHL/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Season>
) {
  const data = await getCurrentSeason();
  res.status(200).json(data);
}
