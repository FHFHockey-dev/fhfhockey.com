// hooks/useTeamStats.ts
import { useEffect, useState, useCallback } from "react";
import supabase from "lib/supabase";

export interface TeamStats {
  id: number;
  team_id: number;
  franchise_name: string;
  date: string;
  games_played: number;
  wins: number;
  losses: number;
  ot_losses: number;
  points: number;
  goals_for: number;
  goals_against: number;
  season_id: number;
  game_id?: number; // Changed from bigint to number for consistency
  opponent_id?: number;
}

export interface TeamGameStats {
  gameId: number; // Changed from bigint to number for consistency
  teamId: number;
  score: number;
  sog: number;
  faceoffPctg: number;
  pim: number;
  powerPlayConversion: string;
  hits: number;
  blockedShots: number;
  giveaways: number;
  takeaways: number;
  powerPlay: string;
  powerPlayToi: string;
}

interface UseTeamStatsReturn {
  teamStats: TeamStats[];
  gameStats: { [gameId: string]: TeamGameStats[] };
  loading: boolean;
  error: string | null;
  fetchGameStats: (gameId: number) => Promise<TeamGameStats[]>; // Changed from bigint to number
  refetch: () => Promise<void>; // Added refetch function
}

export default function useTeamStats(
  teamId: number,
  seasonId?: number
): UseTeamStatsReturn {
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [gameStats, setGameStats] = useState<{
    [gameId: string]: TeamGameStats[];
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamStats = useCallback(async () => {
    if (!teamId) {
      setError("Team ID is required");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("wgo_team_stats")
        .select("*")
        .eq("team_id", teamId)
        .order("date", { ascending: true });

      if (seasonId) {
        query = query.eq("season_id", seasonId);
      }

      const { data, error: supabaseError } = await query;

      if (supabaseError) {
        throw new Error(`Failed to fetch team stats: ${supabaseError.message}`);
      }

      setTeamStats(data || []);
    } catch (err) {
      console.error("Error fetching team stats:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, [teamId, seasonId]);

  const fetchGameStats = useCallback(
    async (gameId: number): Promise<TeamGameStats[]> => { // Changed from bigint to number
      if (!gameId) {
        throw new Error("Game ID is required");
      }

      const gameIdStr = gameId.toString();

      // Return cached data if available
      if (gameStats[gameIdStr]) {
        return gameStats[gameIdStr];
      }

      try {
        const { data, error: supabaseError } = await supabase
          .from("teamGameStats")
          .select("*")
          .eq("gameId", gameId);

        if (supabaseError) {
          throw new Error(
            `Failed to fetch game stats: ${supabaseError.message}`
          );
        }

        const stats = data || [];

        // Cache the results
        setGameStats((prev) => ({
          ...prev,
          [gameIdStr]: stats
        }));

        return stats;
      } catch (err) {
        console.error("Error fetching game stats:", err);
        throw err;
      }
    },
    [gameStats]
  );

  const refetch = useCallback(async () => {
    await fetchTeamStats();
  }, [fetchTeamStats]);

  useEffect(() => {
    if (teamId) {
      fetchTeamStats();
    }
  }, [fetchTeamStats, teamId]);

  return {
    teamStats,
    gameStats,
    loading,
    error,
    fetchGameStats,
    refetch
  };
}
