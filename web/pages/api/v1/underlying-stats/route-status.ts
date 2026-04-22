import type { NextApiRequest, NextApiResponse } from "next";

import { fetchUlsRouteStatus, type UlsRouteStatus } from "lib/underlying-stats/ulsRouteStatus";

type RouteStatusResponse =
  | { success: true; status: UlsRouteStatus; generatedAt: string }
  | { success: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RouteStatusResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      success: false,
      error: "Method not allowed.",
    });
  }

  try {
    const status = await fetchUlsRouteStatus();
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
    return res.status(200).json({
      success: true,
      status,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load ULS route status.",
    });
  }
}
