import type { NextApiRequest, NextApiResponse } from "next";
import { getSchedule } from "lib/NHL/server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { startDate } = req.query;
  const data = await getSchedule(startDate as string);
  res.setHeader("Cache-Control", "max-age=600");
  res.status(200).json(data);
}
