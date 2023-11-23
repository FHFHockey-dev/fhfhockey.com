import type { NextApiRequest, NextApiResponse } from "next";
import { restGet } from "lib/NHL/base";
import { getCurrentSeason } from "./season";

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
  const { seasonId: currentSeasonId } = await getCurrentSeason();
  const data = await getTeams(currentSeasonId);

  res.setHeader("Cache-Control", "max-age=86400");
  res.status(200).json(data);
}
