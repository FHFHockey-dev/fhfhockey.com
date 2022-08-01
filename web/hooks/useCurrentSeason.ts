import { fetchNHL } from "lib/NHL/NHL_API";
import { useEffect, useState } from "react";

type Season = {
  seasonId: string;
  regularSeasonStartDate: string;
  regularSeasonEndDate: string;
  seasonEndDate: string;
  numberOfGames: number;
};

export default function useCurrentSeason() {
  const [season, setSeason] = useState<Season>();

  useEffect(() => {
    fetchNHL("/seasons/current").then((data) => {
      setSeason(data.seasons[0]);
    });
  }, []);

  return season;
}
