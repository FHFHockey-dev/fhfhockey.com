// pages\api\v1\schedule\[startDate].ts

import type { NextApiRequest, NextApiResponse } from "next";
import { getSchedule } from "lib/NHL/server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { startDate } = req.query;
  const includeOddsParam =
    typeof req.query.includeOdds === "string"
      ? req.query.includeOdds
      : Array.isArray(req.query.includeOdds)
        ? req.query.includeOdds[0]
        : undefined;
  const includeOdds =
    includeOddsParam === undefined
      ? true
      : includeOddsParam === "1" ||
        includeOddsParam === "true" ||
        includeOddsParam === "yes";
  const data = await getSchedule(startDate as string, { includeOdds });
  res.setHeader("Cache-Control", "max-age=600");
  res.status(200).json(data);
}
