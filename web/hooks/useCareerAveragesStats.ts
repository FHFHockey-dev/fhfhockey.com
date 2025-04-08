import { useEffect, useState } from "react";
import { Data } from "pages/api/CareerAverages/[playerId]";

export default function useCareerAveragesStats(playerId: number | undefined) {
  const [stats, setStats] = useState<Data | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!playerId) return;
    (async () => {
      setLoading(true);
      const { success, message, data } = await fetch(
        `/api/CareerAverages/${playerId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        }
      )
        .then((res) => res.json())
        .finally(() => {
          setLoading(false);
        });

      if (success) {
        setStats(data);
      } else {
        setStats(undefined);
        console.error(message);
      }
    })();
  }, [playerId]);

  return { stats, loading };
}
