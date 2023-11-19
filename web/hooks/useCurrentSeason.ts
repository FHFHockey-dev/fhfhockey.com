import { useEffect, useState } from "react";
import { Season, getCurrentSeason } from "lib/NHL/API";

export default function useCurrentSeason() {
  const [season, setSeason] = useState<Season>();

  useEffect(() => {
    getCurrentSeason().then((data) => setSeason(data));
  }, []);

  return season;
}
