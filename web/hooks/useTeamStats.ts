// hooks/useTeamStats.ts
import { useEffect, useState, useCallback } from "react";
import supabase from "lib/supabase";

export interface TeamStats {
  id: number;
  team_id: number | null;
  franchise_name: string;
  date: string;
  games_played: number | null;
  wins: number | null;
  losses: number | null;
  ot_losses: number | null;
  points: number | null;
  goals_for: number | null;
  goals_against: number | null;
  goals_for_per_game: number | null;
  goals_against_per_game: number | null;
  point_pct: number | null;
  regulation_and_ot_wins: number | null;
  wins_in_regulation: number | null;
  wins_in_shootout: number | null;
  faceoff_win_pct: number | null;
  power_play_pct: number | null;
  penalty_kill_pct: number | null;
  shots_for_per_game: number | null;
  shots_against_per_game: number | null;
  season_id: number | null;
  game_id: number | null; // Changed from bigint to number for consistency
  opponent_id: number | null;
}

export interface TeamGameStats {
  gameId: number;
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
  fetchGameStats: (gameId: number) => Promise<TeamGameStats[]>;
  refetch: () => Promise<void>;
}

export default function useTeamStats(
  teamId: number | string, // Allow string input
  seasonId?: number | string // Allow string input
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
        .eq("team_id", Number(teamId)) // Convert to number
        .order("date", { ascending: true });

      if (seasonId) {
        query = query.eq("season_id", Number(seasonId)); // Convert to number
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
    async (gameId: number): Promise<TeamGameStats[]> => {
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
