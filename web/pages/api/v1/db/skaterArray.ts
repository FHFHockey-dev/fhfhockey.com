import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method ?? "UNKNOWN"} Not Allowed`,
    });
  }

  return res.status(410).json({
    success: false,
    route: "/api/v1/db/skaterArray",
    status: "retired",
    message:
      "This unowned legacy read surface is retained as an inert compatibility endpoint.",
  });
}
