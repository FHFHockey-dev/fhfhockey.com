import { TimeOption } from "components/TimeOptions/TimeOptions";
import getTimes from "lib/getTimes";
import { useEffect, useState } from "react";
import useCurrentSeason from "./useCurrentSeason";

export default function useSustainabilityStats(
  playerId: number | undefined,
  timeOption: TimeOption
) {
  const season = useCurrentSeason();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState();

  useEffect(() => {
    let mount = true;
    if (!playerId) return;
    (async () => {
      setLoading(true);
      const { StartTime, EndTime } = getTimes(timeOption);
      const { success, message, data } = await fetch(
        `/api/SustainabilityStats/${playerId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            StartTime,
            EndTime,
            Season: season?.seasonId
          })
        }
      )
        .then((res) => res.json())
        .finally(() => {
          setLoading(false);
        });

      if (mount) {
        if (success) {
          setStats(data);
        } else {
          setStats(undefined);
          console.error(message);
        }
      }
    })();

    return () => {
      mount = false;
    };
  }, [playerId, timeOption, season]);

  return { loading, stats };
}
