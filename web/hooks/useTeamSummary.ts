// hooks/useTeamSummary.ts

import { useEffect, useState } from "react";
import { TeamSummary } from "lib/NHL/types";
import Fetch from "lib/cors-fetch";

interface UseTeamSummaryReturn {
  teamSummaries: TeamSummary[];
  loading: boolean;
  error: string | null;
}

export default function useTeamSummary(
  seasonId: number | null
): UseTeamSummaryReturn {
  const [teamSummaries, setTeamSummaries] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!seasonId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchTeamSummaries = async () => {
      setLoading(true);
      setError(null);
      try {
        const encodedCayenneExp = encodeURIComponent(
          `gameTypeId=2 and seasonId<=${seasonId} and seasonId>=${seasonId}`
        );
        const url = `https://api.nhle.com/stats/rest/en/team/summary?isAggregate=false&isGame=false&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22teamId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&cayenneExp=${encodedCayenneExp}`;

        const response = await Fetch(url);
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        const data = await response.json();
        if (isMounted) {
          setTeamSummaries(data.data);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to fetch team summaries.");
          setLoading(false);
        }
      }
    };

    fetchTeamSummaries();

    return () => {
      isMounted = false;
    };
  }, [seasonId]);

  return { teamSummaries, loading, error };
}
