import { useEffect, useState } from "react";

import { PercentileRank } from "pages/api/PercentileRank/[playerId]";
import { TimeOption } from "components/TimeOptions/TimeOptions";
import getTimes from "lib/getTimes";
import useCurrentSeason from "./useCurrentSeason";

/**
 * Calculate the percentile rankings of a player for the current season
 * @param playerId player id.
 */
export default function usePercentileRank(
  playerId: number | undefined,
  timeOption: TimeOption
) {
  const season = useCurrentSeason();
  const [data, setData] = useState<PercentileRank>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mount = true;
    if (!playerId) return;
    (async () => {
      setLoading(true);
      const { StartTime, EndTime } = getTimes(timeOption);

      const { success, message, data } = await fetch(
        `/api/PercentileRank/${playerId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            StartTime,
            EndTime,
            Season: season ? season.seasonId : "",
          }),
        }
      )
        .then((res) => res.json())
        .finally(() => {
          setLoading(false);
        });

      if (mount) {
        if (success) {
          setData(data);
        } else {
          setData(undefined);
          console.error(message);
        }
      }
    })();

    return () => {
      mount = false;
    };
  }, [playerId, timeOption, season]);

  return { loading, data };
}
