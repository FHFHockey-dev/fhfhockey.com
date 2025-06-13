import { useState, useEffect } from "react";
import supabase from "lib/supabase";

interface MissedGame {
  date: string;
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  isPlayoff: boolean;
  seasonId: number;
  isFuture: boolean; // Add flag to distinguish between missed and future games
}

interface UseMissedGamesResult {
  missedGames: MissedGame[];
  isLoading: boolean;
  error: string | null;
}

export function useMissedGames(
  playerId: string | number | undefined,
  playerTeamId: number | undefined,
  seasonId: string | number | null | undefined,
  playerGameLog: any[] = [],
  playerPlayoffGameLog: any[] = []
): UseMissedGamesResult {
  const [missedGames, setMissedGames] = useState<MissedGame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId || !playerTeamId || !seasonId) {
      setMissedGames([]);
      return;
    }

    const fetchMissedGames = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Convert to numbers for consistency
        const numericPlayerId = Number(playerId);
        const numericTeamId = Number(playerTeamId);
        const numericSeasonId = Number(seasonId);

        console.log("[useMissedGames] Fetching missed games for:", {
          playerId: numericPlayerId,
          teamId: numericTeamId,
          seasonId: numericSeasonId
        });

        // Extract playoff year from season ID (e.g., 20242025 -> 2025)
        const playoffYear = Math.floor(numericSeasonId % 10000);

        // Fetch all team games for the season
        const { data: teamGames, error: teamGamesError } = await supabase
          .from("games")
          .select("id, date, seasonId, type, homeTeamId, awayTeamId")
          .eq("seasonId", numericSeasonId)
          .or(`homeTeamId.eq.${numericTeamId},awayTeamId.eq.${numericTeamId}`)
          .order("date", { ascending: true });

        if (teamGamesError) {
          setError(`Error fetching team games: ${teamGamesError.message}`);
          return;
        }

        if (!teamGames || teamGames.length === 0) {
          console.log("[useMissedGames] No team games found");
          setMissedGames([]);
          return;
        }

        console.log("[useMissedGames] Found team games:", teamGames.length);

        // Fetch player's actual games from database tables
        const playerGameDates = new Set<string>();

        // Fetch regular season games from wgo_skater_stats
        const { data: regularSeasonGames, error: regularError } = await supabase
          .from("wgo_skater_stats")
          .select("date, games_played")
          .eq("player_id", numericPlayerId)
          .eq("season_id", numericSeasonId)
          .gt("games_played", 0);

        if (regularError) {
          console.warn(
            "[useMissedGames] Error fetching regular season games:",
            regularError.message
          );
        } else if (regularSeasonGames) {
          regularSeasonGames.forEach((game) => {
            playerGameDates.add(game.date);
          });
          console.log(
            "[useMissedGames] Regular season games played:",
            regularSeasonGames.length
          );
        }

        // Fetch playoff games from wgo_skater_stats_playoffs (filter by year)
        const { data: playoffGames, error: playoffError } = await supabase
          .from("wgo_skater_stats_playoffs")
          .select("date, games_played")
          .eq("player_id", numericPlayerId)
          .gte("date", `${playoffYear}-01-01`)
          .lt("date", `${playoffYear + 1}-01-01`)
          .gt("games_played", 0);

        if (playoffError) {
          console.warn(
            "[useMissedGames] Error fetching playoff games:",
            playoffError.message
          );
        } else if (playoffGames) {
          playoffGames.forEach((game) => {
            playerGameDates.add(game.date);
          });
          console.log(
            "[useMissedGames] Playoff games played:",
            playoffGames.length
          );
        }

        console.log(
          "[useMissedGames] Total unique dates player played:",
          playerGameDates.size
        );

        // For each team game, check if player has a corresponding game log entry
        const missed: MissedGame[] = [];
        const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format

        for (const teamGame of teamGames) {
          const gameDate = teamGame.date;
          const isPlayoff = teamGame.type === 3;
          const isRegularSeason = teamGame.type === 2;
          const isFutureGame = gameDate > today;

          // Only check regular season (type 2) and playoff (type 3) games
          if (!isRegularSeason && !isPlayoff) {
            continue;
          }

          // Check if player played on this date
          if (!playerGameDates.has(gameDate)) {
            // Player missed this game OR it's a future scheduled game
            missed.push({
              date: gameDate,
              gameId: teamGame.id,
              homeTeamId: teamGame.homeTeamId,
              awayTeamId: teamGame.awayTeamId,
              isPlayoff: isPlayoff,
              seasonId: teamGame.seasonId,
              isFuture: isFutureGame
            });
          }
        }

        console.log("[useMissedGames] Missed games found:", missed.length);
        console.log("[useMissedGames] Missed games breakdown:", {
          regular: missed.filter((g) => !g.isPlayoff && !g.isFuture).length,
          playoff: missed.filter((g) => g.isPlayoff && !g.isFuture).length,
          futureRegular: missed.filter((g) => !g.isPlayoff && g.isFuture)
            .length,
          futurePlayoff: missed.filter((g) => g.isPlayoff && g.isFuture).length
        });

        setMissedGames(missed);
      } catch (err) {
        console.error("[useMissedGames] Error:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMissedGames();
  }, [playerId, playerTeamId, seasonId]);

  return {
    missedGames,
    isLoading,
    error
  };
}
