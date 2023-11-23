import { NextApiRequest, NextApiResponse } from "next";
import { get } from "lib/NHL/base";

export type PlayerGameLog = {
  gameId: number;
  gameDate: string;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  powerPlayGoals: number;
  powerPlayPoints: number;
  shots: number;
  toi: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PlayerGameLog>
) {
  const { id, season, type } = req.query;
  const data =
    (await get(`/player/${id}/game-log/${season}/${type}`)).gameLog ?? [];

  res.status(200).json(data);
}
