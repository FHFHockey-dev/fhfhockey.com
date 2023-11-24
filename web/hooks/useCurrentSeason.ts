import { useEffect, useState } from "react";
import { Season } from "lib/NHL/types";
import { getCurrentSeason } from "lib/NHL/client";

export default function useCurrentSeason() {
  const [season, setSeason] = useState<Season>();

  useEffect(() => {
    getCurrentSeason().then((data) => setSeason(data));
  }, []);

  return season;
}
