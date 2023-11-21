import { restGet } from "lib/NHL/base";
import { NextApiRequest, NextApiResponse } from "next";

export type Player = {
  id: number;
  currentTeamId: number;
  firstName: string;
  fullName: string;
  lastName: string;
  positionCode: string;
  sweaterNumber: number;
};

async function getPlayer(id: number): Promise<Player> {
  const { data } = await restGet(
    `/players?cayenneExp=${encodeURIComponent(`id=${id}`)}`
  );
  return data.at(0);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  const { id } = req.query;
  const player = await getPlayer(Number(id));
  res.status(200).json(player);
}
