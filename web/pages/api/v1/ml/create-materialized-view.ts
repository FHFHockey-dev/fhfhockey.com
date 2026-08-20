import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method ?? "UNKNOWN"} Not Allowed`,
    });
  }

  return res.status(410).json({
    success: false,
    route: "/api/v1/ml/create-materialized-view",
    status: "retired",
    message:
      "This stale DDL compatibility endpoint is retired and performs no database work.",
    canonicalObject: "public.player_stats_unified",
    canonicalObjectType: "view",
  });
}
