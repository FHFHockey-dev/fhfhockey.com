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
  const playerIdValue = normalizeQueryValue(req.query.playerId);
  const playerId =
    playerIdValue != null && playerIdValue.length > 0
      ? Number(playerIdValue)
      : null;

  if (!teamAbbreviation) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(400).json({
      error: "Missing team selection.",
      issues: ["team is required."],
    });
  }

  if (
    playerId != null &&
    (!Number.isFinite(playerId) || Math.trunc(playerId) <= 0)
  ) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(400).json({
      error: "Invalid player id.",
      issues: ["playerId must be a positive integer when provided."],
    });
  }

  try {
    const payload = await buildSplitsSurface({
      teamAbbreviation,
      opponentAbbreviation,
      playerId: playerId == null ? null : Math.trunc(playerId),
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
