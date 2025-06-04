import { useState, useEffect } from "react";
import supabase from "lib/supabase";

interface PlayerStatsHookResult {
  gameLog: any[];
  seasonTotals: any[];
  playerInfo: {
    id: number;
    fullName: string;
    position: string;
    team: string;
  } | null;
  isGoalie: boolean;
  isLoading: boolean;
  error: string | null;
}

export function usePlayerStats(
  playerId: string | undefined,
  seasonId?: string
): PlayerStatsHookResult {
  const [gameLog, setGameLog] = useState<any[]>([]);
  const [seasonTotals, setSeasonTotals] = useState<any[]>([]);
  const [playerInfo, setPlayerInfo] = useState<any>(null);
  const [isGoalie, setIsGoalie] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) {
      setIsLoading(false);
      return;
    }

    const fetchPlayerData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // First, try to fetch from skater stats to determine player type
        const { data: skaterCheck } = await supabase
          .from("wgo_skater_stats")
          .select(
            "player_id, player_name, position_code, current_team_abbreviation"
          )
          .eq("player_id", parseInt(playerId))
          .limit(1);

        let isPlayerGoalie = false;
        let playerData = null;

        if (skaterCheck && skaterCheck.length > 0) {
          // Player is a skater
          playerData = skaterCheck[0];
          isPlayerGoalie = false;
        } else {
          // Check if player is a goalie
          const { data: goalieCheck } = await supabase
            .from("wgo_goalie_stats")
            .select("goalie_id, goalie_name, position_code")
            .eq("goalie_id", parseInt(playerId))
            .limit(1);

          if (goalieCheck && goalieCheck.length > 0) {
            playerData = {
              player_id: goalieCheck[0].goalie_id,
              player_name: goalieCheck[0].goalie_name,
              position_code: goalieCheck[0].position_code,
              current_team_abbreviation: null
            };
            isPlayerGoalie = true;
          }
        }

        if (!playerData) {
          setError("Player not found");
          setIsLoading(false);
          return;
        }

        setIsGoalie(isPlayerGoalie);
        setPlayerInfo({
          id: playerData.player_id,
          fullName: playerData.player_name,
          position: playerData.position_code || "G",
          team: playerData.current_team_abbreviation || "N/A"
        });

        // Fetch game log data
        let gameLogQuery;
        if (isPlayerGoalie) {
          gameLogQuery = supabase
            .from("wgo_goalie_stats")
            .select("*")
            .eq("goalie_id", parseInt(playerId))
            .order("date", { ascending: true });
        } else {
          gameLogQuery = supabase
            .from("wgo_skater_stats")
            .select("*")
            .eq("player_id", parseInt(playerId))
            .order("date", { ascending: true });
        }

        // Add season filter if provided
        if (seasonId) {
          gameLogQuery = gameLogQuery.eq("season_id", parseInt(seasonId));
        }

        const { data: gameLogData, error: gameLogError } = await gameLogQuery;

        if (gameLogError) {
          setError(gameLogError.message);
          setIsLoading(false);
          return;
        }

        setGameLog(gameLogData || []);

        // Fetch season totals if the table exists (for future implementation)
        if (!isPlayerGoalie) {
          const { data: seasonTotalsData } = await supabase
            .from("wgo_skater_stats_totals")
            .select("*")
            .eq("player_id", parseInt(playerId))
            .order("season_id", { ascending: false });

          setSeasonTotals(seasonTotalsData || []);
        } else {
          // For goalies, we could aggregate from game log or use a totals table if it exists
          setSeasonTotals([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayerData();
  }, [playerId, seasonId]);

  return {
    gameLog,
    seasonTotals,
    playerInfo,
    isGoalie,
    isLoading,
    error
  };
}
