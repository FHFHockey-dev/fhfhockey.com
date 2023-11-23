import { restGet } from "lib/NHL/base";
import type { NextApiRequest, NextApiResponse } from "next";

export type Season = {
  seasonId: number;
  regularSeasonStartDate: string;
  regularSeasonEndDate: string;
  seasonEndDate: string;
  numberOfGames: number;
};

async function getCurrentSeason(): Promise<Season> {
  const data = (
    await restGet(
      `/season?sort=${encodeURIComponent(
        '[{"property": "id", "direction":"DESC"}]'
      )}&limit=1`
    )
  ).data[0];

  return {
    seasonId: data.id,
    regularSeasonStartDate: data.startDate,
    regularSeasonEndDate: data.regularSeasonEndDate,
    seasonEndDate: data.endDate,
    numberOfGames: data.numberOfGames,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Season>
) {
  const data = await getCurrentSeason();
  res.status(200).json(data);
}
