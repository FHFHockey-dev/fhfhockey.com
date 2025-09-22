import type { NextApiRequest, NextApiResponse } from "next";
import { buildMockPlayerSeries } from "../../../../lib/trends/mockData";
import type { PlayerSeries } from "../../../../lib/trends/types";

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<PlayerSeries>
) {
  const { playerId } = req.query;
  if (!playerId || Array.isArray(playerId)) {
    res.status(400).end();
    return;
  }

  const seasonParam = req.query.season;
  const season = !seasonParam || Array.isArray(seasonParam)
    ? "2024-25"
    : seasonParam;

  const data = buildMockPlayerSeries(playerId, season);
  res.status(200).json(data);
}
