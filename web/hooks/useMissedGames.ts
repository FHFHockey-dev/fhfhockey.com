import { useState, useEffect } from "react";
import supabase from "lib/supabase";

interface MissedGame {
  date: string;
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  isPlayoff: boolean;
  seasonId: number;
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
    if (
      !playerId ||
      !playerTeamId ||
      !seasonId ||
      (!playerGameLog.length && !playerPlayoffGameLog.length)
    ) {
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

        // Create sets of dates when player actually played (from both regular season and playoff logs)
        const playerGameDates = new Set<string>();

        // Add regular season game dates
        playerGameLog.forEach((game) => {
          if (game.games_played && game.games_played > 0) {
            playerGameDates.add(game.date);
          }
        });

        // Add playoff game dates
        playerPlayoffGameLog.forEach((game) => {
          if (game.games_played && game.games_played > 0) {
            playerGameDates.add(game.date);
          }
        });

        console.log(
          "[useMissedGames] Player played on dates:",
          Array.from(playerGameDates)
        );

        // For each team game, check if player has a corresponding game log entry
        const missed: MissedGame[] = [];

        for (const teamGame of teamGames) {
          const gameDate = teamGame.date;
          const isPlayoff = teamGame.type === 3;
          const isRegularSeason = teamGame.type === 2;

          // Only check regular season (type 2) and playoff (type 3) games
          if (!isRegularSeason && !isPlayoff) {
            continue;
          }

          // Check if player played on this date
          if (!playerGameDates.has(gameDate)) {
            // Player missed this game
            missed.push({
              date: gameDate,
              gameId: teamGame.id,
              homeTeamId: teamGame.homeTeamId,
              awayTeamId: teamGame.awayTeamId,
              isPlayoff: isPlayoff,
              seasonId: teamGame.seasonId
            });
          }
        }

        console.log("[useMissedGames] Missed games found:", missed.length);
        setMissedGames(missed);
      } catch (err) {
        console.error("[useMissedGames] Error:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMissedGames();
  }, [playerId, playerTeamId, seasonId, playerGameLog, playerPlayoffGameLog]);

  return {
    missedGames,
    isLoading,
    error
  };
}
