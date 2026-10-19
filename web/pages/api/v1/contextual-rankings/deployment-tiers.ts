import {
  buildDeploymentTiersSurface,
  parseDeploymentTiersRequest,
} from "lib/rankings/deploymentTiers";
import { sendContextualRankingsError } from "lib/rankings/apiErrorResponse";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const request = parseDeploymentTiersRequest(req.query);
    const payload = await buildDeploymentTiersSurface(request);
    return res.status(200).json(payload);
  } catch (error) {
    return sendContextualRankingsError(
      res,
      error,
      "Failed to build deployment tier summaries",
    );
  }
}
