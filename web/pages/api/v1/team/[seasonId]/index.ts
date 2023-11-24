import type { NextApiRequest, NextApiResponse } from "next";
import { restGet } from "lib/NHL/base";
import { getCurrentSeason } from "../../season";

export type Team = {
  /**
   * e.g., 13
   */
  id: number;
  /**
   * e.g., "Florida Panthers"
   */
  name: string;
  /**
   * e.g., FLA
   */
  abbreviation: string;
  logo: string;
};

export function getTeamLogo(teamName: string) {
  return `/teamLogos/${teamName}.png`;
}

/**
 * Server only
 * @returns
 */
export async function getTeams(seasonId?: number): Promise<Team[]> {
  if (seasonId === undefined) {
    seasonId = (await getCurrentSeason()).seasonId;
  }
  const { data: allTeams } = await restGet("/team");
  const { data: currentSeasonTeams } = await restGet(
    `/team/summary?cayenneExp=seasonId=${seasonId}`
  );
  const currentSeasonTeamIds = new Set(
    currentSeasonTeams.map((team) => team.teamId)
  );

  return allTeams
    .filter((team) => currentSeasonTeamIds.has(team.id))
    .map((item) => ({
      id: item.id,
      name: item.fullName,
      abbreviation: item.triCode,
      logo: getTeamLogo(item.fullName),
    }));
}

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
