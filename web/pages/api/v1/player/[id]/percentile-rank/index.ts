import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  const playerId = req.query.id as string;
  const { Season, StartTime, EndTime } = req.body;
}
