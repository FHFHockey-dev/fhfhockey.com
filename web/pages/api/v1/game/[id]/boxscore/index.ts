import { NextApiRequest, NextApiResponse } from "next";
import { Boxscore } from "lib/NHL/types";
import { Response } from "pages/api/_types";
import { getBoxscore } from "lib/NHL/server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Response<Boxscore>>
) {
  const { id } = req.query;
  try {
    const boxscore = await getBoxscore(Number(id));
    res.json({
      success: true,
      message: "Successfully fetched the boxscore for game " + id,
      data: boxscore,
    });
  } catch (e: any) {
    res.json({
      success: false,
      message: "Cannot get the boxscore data",
      data: null,
    });
  }
}
