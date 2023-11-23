import { NextApiRequest, NextApiResponse } from "next";
import { differenceInYears } from "date-fns";
import { get } from "lib/NHL/base";

export type Player = {
  id: number;
  firstName: string;
  fullName: string;
  lastName: string;
  positionCode: string;
  sweaterNumber: number;
  age: number;
  weight: number;
  height: number;
  image: string;
  // Team info
  teamId: number;
  teamName: string;
  teamAbbreviation: string;
  teamLogo: string;
};

async function getPlayer(id: number): Promise<Player> {
  const data = await get(`/player/${id}/landing`);
  return {
    id: data.playerId,
    firstName: data.firstName.default,
    lastName: data.lastName.default,
    fullName: `${data.firstName.default} ${data.lastName.default}`,
    sweaterNumber: data.sweaterNumber,
    positionCode: data.position,
    image: data.headshot,
    age: differenceInYears(new Date(), new Date(data.birthDate)),
    height: data.heightInCentimeters,
    weight: data.weightInKilograms,
    teamId: data.currentTeamId,
    teamAbbreviation: data.currentTeamAbbrev,
    teamLogo: data.teamLogo,
    teamName: data.fullTeamName.default,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  const { id } = req.query;
  try {
    const player = await getPlayer(Number(id));
    res.setHeader("Cache-Control", "max-age=86400");
    res.status(200).json(player);
  } catch (e: any) {
    res
      .status(404)
      .json({
        success: false,
        message: "Unable to find the player with id: " + id,
      });
  }
}
