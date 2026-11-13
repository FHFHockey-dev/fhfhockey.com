import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import { MatrixScopeError, readDeploymentMatrix } from "lib/drm/readMatrix";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  const scalar = (key: string) => typeof req.query[key] === "string" ? req.query[key] as string : undefined;
  try {
    if (Object.values(req.query).some(value => Array.isArray(value))) throw new MatrixScopeError("Repeated query parameters are not supported.");
    const result = await readDeploymentMatrix(supabase, {
      teamId: Number(scalar("teamId")), seasonId: Number(scalar("seasonId")),
      startDate: scalar("startDate") ?? "", endDate: scalar("endDate") ?? "",
      seasonType: scalar("seasonType") as "regularSeason" | "playoffs",
      homeOrAway: (scalar("homeOrAway") ?? "") as "" | "home" | "away", opponentTeamAbbreviation: scalar("opponent") ?? "",
    });
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60");
    return res.json(result);
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    if (error instanceof MatrixScopeError) return res.status(400).json({ error: error.message });
    return res.status(503).json({ error: "Qualified matrix data is temporarily unavailable." });
  }
}
