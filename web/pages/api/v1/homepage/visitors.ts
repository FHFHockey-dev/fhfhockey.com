import type { NextApiRequest, NextApiResponse } from "next";

import { fetchDailyVisitorPoints } from "lib/homepageVisitors";

const CACHE_CONTROL =
  "public, s-maxage=21600, stale-while-revalidate=86400";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  const projectId = process.env.VERCEL_ANALYTICS_PROJECT_ID;
  const teamId = process.env.VERCEL_ANALYTICS_TEAM_ID;

  res.setHeader("Cache-Control", CACHE_CONTROL);

  if (!token || !projectId || !teamId) {
    console.warn("Homepage visitor pulse is not configured");
    return res.status(200).json({ points: [] });
  }

  try {
    const points = await fetchDailyVisitorPoints({
      token,
      projectId,
      teamId,
    });
    return res.status(200).json({ points });
  } catch (error) {
    console.error("Error fetching homepage visitor pulse:", error);
    return res.status(502).json({ error: "Visitor pulse unavailable" });
  }
}
