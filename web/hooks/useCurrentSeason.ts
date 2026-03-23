// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\hooks\useCurrentSeason.ts

import { useEffect, useState } from "react";
import { Season } from "lib/NHL/types";
import { getCurrentSeason } from "lib/NHL/client";

export default function useCurrentSeason() {
  const [season, setSeason] = useState<Season>();

  useEffect(() => {
    getCurrentSeason()
      .then((data) => {
        if (data && typeof data.seasonId === "number") {
          setSeason(data);
          return;
        }
        console.warn(
          "useCurrentSeason received an invalid season payload; leaving season unset.",
          data
        );
      })
      .catch((error) => {
        console.error("useCurrentSeason failed to load season", error);
      });
  }, []);

  return season;
}
