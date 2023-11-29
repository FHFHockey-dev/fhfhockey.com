import { NextApiRequest, NextApiResponse } from "next";
import { getPlayer } from "lib/NHL/server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  const { id } = req.query;
  try {
    const player = await getPlayer(Number(id));
    res.setHeader("Cache-Control", "max-age=86400");
    res.status(200).json(player);
  } catch (e: any) {
    res.status(404).json({
      success: false,
      message: "Unable to find the player with id: " + id,
    });
  }
}
