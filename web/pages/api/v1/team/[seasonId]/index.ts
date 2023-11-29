import type { NextApiRequest, NextApiResponse } from "next";
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

  const data = await getTeams(
    seasonId === "current" ? undefined : Number(seasonId)
  );

  res.setHeader("Cache-Control", "max-age=86400");
  res.status(200).json(data);
}
