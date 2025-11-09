import type { NextApiRequest, NextApiResponse } from "next";
import {
  fetchTeamRatings,
  isValidIsoDate
} from "../../lib/teamRatingsService";

const CACHE_CONTROL_HEADER = "public, max-age=60";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { date, teamAbbr } = req.query;

  if (typeof date !== "string" || !isValidIsoDate(date)) {
    res
      .status(400)
      .json({ error: 'Query parameter "date" must be YYYY-MM-DD.' });
    return;
  }

  try {
    const teamAbbrParam = typeof teamAbbr === "string" ? teamAbbr : undefined;
    const payload = await fetchTeamRatings(date, teamAbbrParam);
    res.setHeader("Cache-Control", CACHE_CONTROL_HEADER);
    res.status(200).json(payload);
  } catch (error) {
    console.error("Failed to load team ratings", error);
    res.status(500).json({ error: "Failed to load team ratings" });
  }
}
