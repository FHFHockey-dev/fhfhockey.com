import { NextApiRequest, NextApiResponse } from "next";
import { PlayerGameLog } from "lib/NHL/types";
import { getPlayerGameLog } from "lib/NHL/server";
import { Response } from "pages/api/_types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Response<PlayerGameLog[]>>
) {
  const { id, season, type } = req.query;
  if (!id || !season || !type) {
    return res.status(400).json({
      success: false,
      message: "Invalid input.",
      data: null,
    });
  }

  const data = await getPlayerGameLog(
    id as string,
    season as string,
    type as string
  );

  res.status(200).json({ success: true, message: "success", data });
}
