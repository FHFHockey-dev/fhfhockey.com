import { restGet } from "lib/NHL/base";
import type { NextApiRequest, NextApiResponse } from "next";

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

function getTeamLogo(teamName: string) {
  return `/teamLogos/${teamName}.png`;
}

/**
 * Server only
 * @returns
 */
export async function getTeams(): Promise<Team[]> {
  const { data } = await restGet("/team");
  return data.map((item) => ({
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
  const data = await getTeams();
  res.status(200).json(data);
}
