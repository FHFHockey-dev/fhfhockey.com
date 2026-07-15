import type { NextApiRequest, NextApiResponse } from "next";
import moment from "moment-timezone";

import { fetchHomepagePulse } from "lib/homepagePulse";
import supabase from "lib/supabase/server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const points = await fetchHomepagePulse({
      supabase,
      currentDate: moment().tz("America/New_York").format("YYYY-MM-DD"),
    });
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600",
    );
    return res.status(200).json({ points });
  } catch (error) {
    console.error("Error building homepage pulse:", error);
    return res.status(500).json({ error: "Pulse unavailable" });
  }
}
