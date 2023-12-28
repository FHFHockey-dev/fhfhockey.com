import { NextApiRequest, NextApiResponse } from "next";
import { getAllPlayers } from "lib/NHL/server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  const season =
    typeof req.query.season === "string" ? Number(req.query.season) : undefined;

  const players = await getAllPlayers(season);
  // cache for 7 days
  res.setHeader("Cache-Control", "max-age=604800");
  res.status(200).json(players);
}
