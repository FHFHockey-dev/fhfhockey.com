import type { NextApiRequest, NextApiResponse } from "next";

import { buildSplitsSurface } from "lib/splits/splitsServer";
import type { SplitsApiError, SplitsApiResponse } from "lib/splits/splitsSurface";

function normalizeQueryValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0].trim();
  }

  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SplitsApiResponse | SplitsApiError>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Method not allowed.",
    });
  }

  const teamAbbreviation = normalizeQueryValue(req.query.team);
  const opponentAbbreviation = normalizeQueryValue(req.query.opponent);
  const mode = normalizeQueryValue(req.query.mode);

  try {
    const payload = await buildSplitsSurface({
      teamAbbreviation,
      opponentAbbreviation,
      includeLanding: mode !== "roster",
    });

    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
    return res.status(200).json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to build splits surface.";

    res.setHeader("Cache-Control", "no-store");
    return res.status(400).json({
      error: "Unable to build splits surface.",
      issues: [message],
    });
  }
}
