import {
  buildWarSurface,
  parseWarSurfaceRequest,
} from "lib/rankings/war";
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  return res
    .status(200)
    .json(buildWarSurface(parseWarSurfaceRequest(req.query)));
}
