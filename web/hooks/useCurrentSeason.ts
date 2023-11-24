import { useEffect, useState } from "react";
import { getCurrentSeason } from "lib/NHL/API";
import { Season } from "lib/NHL/types";

export default function useCurrentSeason() {
  const [season, setSeason] = useState<Season>();

  useEffect(() => {
    getCurrentSeason().then((data) => setSeason(data));
  }, []);

  return season;
}
