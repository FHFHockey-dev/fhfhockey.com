import { NextApiRequest, NextApiResponse } from "next";
import { getRightRail } from "lib/NHL/server/rightRail";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing id" });
    const data = await getRightRail(id as string);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}
