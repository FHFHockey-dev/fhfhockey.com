import type { NextApiRequest, NextApiResponse } from "next";
import { normalizeDependencyError } from "lib/cron/normalizeDependencyError";
import { Team } from "lib/NHL/types";
import { getTeams } from "lib/NHL/server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Team[]>
) {
  const { seasonId } = req.query;
  if (seasonId === undefined) {
    return (
      res
        .status(400)
        // @ts-expect-error
        .json({ success: false, message: "Season id is required" })
    );
  }

  try {
    const data = await getTeams(
      seasonId === "current" ? undefined : Number(seasonId)
    );

    res.setHeader("Cache-Control", "max-age=86400");
    return res.status(200).json(data);
  } catch (error: unknown) {
    const normalized = normalizeDependencyError(error);
    console.error("team route failed", {
      seasonId,
      message: normalized.message,
      detail: normalized.detail
    });
    return res.status(503).json([]);
  }
}
