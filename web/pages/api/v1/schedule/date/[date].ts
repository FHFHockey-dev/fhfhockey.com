import { NextApiRequest, NextApiResponse } from "next";
import { getScheduleDaily } from "lib/NHL/server/scheduleDaily";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Missing date" });
    const data = await getScheduleDaily(date as string);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}
