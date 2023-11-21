import { useEffect, useState } from "react";
import { getCurrentSeason } from "lib/NHL/API";
import { Season } from "pages/api/v1/season";

export default function useCurrentSeason() {
  const [season, setSeason] = useState<Season>();

  useEffect(() => {
    getCurrentSeason().then((data) => setSeason(data));
  }, []);

  return season;
}
