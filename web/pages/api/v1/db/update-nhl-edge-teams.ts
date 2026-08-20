import type { NextApiRequest, NextApiResponse } from "next";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method ?? "UNKNOWN"} Not Allowed`,
    });
  }

  return res.status(410).json({
    success: false,
    route: "/api/v1/db/update-nhl-edge-teams",
    status: "retired",
    replacementRoute: "/api/v1/db/update-nhl-edge-stats",
    message: "This legacy alias performs no work. Use the authenticated canonical route.",
  });
}

export default handler;
