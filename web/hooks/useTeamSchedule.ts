import { useState, useEffect } from "react";
import useCurrentSeason from "hooks/useCurrentSeason";
import supabase from "lib/supabase";
import { getTeamAbbreviationById, getTeamInfoById } from "lib/teamsInfo";

export interface ScheduleGame {
  id: number;
  season: number;
  gameType: number;
  gameDate: string;
  venue: {
    default: string;
  };
  startTimeUTC: string;
  easternUTCOffset: string;
  venueUTCOffset: string;
  tvBroadcasts: any[];
  gameState: string;
  gameScheduleState: string;
  homeTeamScore?: number;
  awayTeamScore?: number;
  periodDescriptor?: {
    number: number;
    periodType: string;
  };
  clock?: {
    timeRemaining?: string;
    secondsRemaining?: number;
    running?: boolean;
    inIntermission?: boolean;
  };
  awayTeam: {
    id: number;
    placeName: {
      default: string;
    };
    abbrev: string;
    logo: string;
    darkLogo: string;
  };
  homeTeam: {
    id: number;
    placeName: {
      default: string;
    };
    abbrev: string;
    logo: string;
    darkLogo: string;
  };
}

export interface TeamRecord {
  wins: number;
  losses: number;
  otLosses: number;
  points: number;
  regulationWins?: number;
  overtimeWins?: number;
  shootoutWins?: number;
}

export const useTeamSchedule = (
  teamAbbr: string,
  seasonId?: string,
  teamId?: string
) => {
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<TeamRecord | null>(null);
  const currentSeason = useCurrentSeason();

  useEffect(() => {
    if (!teamId || !currentSeason) return;

    const fetchScheduleFromDb = async () => {
      try {
        setLoading(true);
        setError(null);

        const seasonToUse = seasonId || currentSeason.toString();

        console.log("🔍 Fetching schedule from database:", {
          teamId: Number(teamId),
          seasonId: Number(seasonToUse)
        });

        // Fetch games where the team is either home or away
        const { data: gamesData, error: gamesError } = await supabase
          .from("games")
          .select("*")
          .eq("seasonId", Number(seasonToUse))
          .or(`homeTeamId.eq.${Number(teamId)},awayTeamId.eq.${Number(teamId)}`)
          .order("date", { ascending: true });

        if (gamesError) {
          console.error("❌ Error fetching games:", gamesError);
          throw gamesError;
        }

        console.log("✅ Fetched games from DB:", gamesData?.length || 0);

        // Transform database games to match the expected interface
        const transformedGames: ScheduleGame[] = (gamesData || []).map(
          (game) => {
            const isHomeTeam = game.homeTeamId === Number(teamId);

            // Get proper team info using the teamsInfo functions
            const homeTeamInfo = getTeamInfoById(game.homeTeamId);
            const awayTeamInfo = getTeamInfoById(game.awayTeamId);
            const homeTeamAbbrev =
              getTeamAbbreviationById(game.homeTeamId) || `T${game.homeTeamId}`;
            const awayTeamAbbrev =
              getTeamAbbreviationById(game.awayTeamId) || `T${game.awayTeamId}`;

            return {
              id: Number(game.id),
              season: Number(game.seasonId),
              gameType: game.type || 2, // Regular season default
              gameDate: game.date,
              venue: {
                default: "TBD" // Would need venue lookup
              },
              startTimeUTC: game.startTime,
              easternUTCOffset: "-05:00",
              venueUTCOffset: "-05:00",
              tvBroadcasts: [],
              gameState: "UNKNOWN", // We'll determine this from date and scores
              gameScheduleState: "OK",
              homeTeam: {
                id: game.homeTeamId,
                placeName: {
                  default: homeTeamInfo?.name || `Team ${game.homeTeamId}`
                },
                abbrev: homeTeamAbbrev,
                logo: "",
                darkLogo: ""
              },
              awayTeam: {
                id: game.awayTeamId,
                placeName: {
                  default: awayTeamInfo?.name || `Team ${game.awayTeamId}`
                },
                abbrev: awayTeamAbbrev,
                logo: "",
                darkLogo: ""
              }
            };
          }
        );

        // Fetch game scores from teamGameStats
        const gameIds = transformedGames.map((g) => g.id);
        if (gameIds.length > 0) {
          const { data: gameStatsData, error: gameStatsError } = await supabase
            .from("teamGameStats")
            .select("*")
            .in("gameId", gameIds);

          if (gameStatsError) {
            console.warn("⚠️ Error fetching game stats:", gameStatsError);
          } else {
            // Add scores to games
            transformedGames.forEach((game) => {
              const homeStats = gameStatsData?.find(
                (stat) =>
                  stat.gameId === game.id && stat.teamId === game.homeTeam.id
              );
              const awayStats = gameStatsData?.find(
                (stat) =>
                  stat.gameId === game.id && stat.teamId === game.awayTeam.id
              );

              if (homeStats && awayStats) {
                game.homeTeamScore = homeStats.score;
                game.awayTeamScore = awayStats.score;
                game.gameState = "FINAL";
              } else {
                // Check if game is in the future
                const gameDate = new Date(game.gameDate);
                const today = new Date();
                game.gameState = gameDate > today ? "FUT" : "UNKNOWN";
              }
            });
          }
        }

        setGames(transformedGames);

        // Calculate record from team stats instead of game results
        // This will be more accurate as it comes from the database
        if (teamId && seasonToUse) {
          const { data: teamStatsData, error: teamStatsError } = await supabase
            .from("wgo_team_stats")
            .select("*")
            .eq("team_id", Number(teamId))
            .eq("season_id", Number(seasonToUse))
            .order("date", { ascending: false })
            .limit(1);

          if (teamStatsError) {
            console.warn(
              "⚠️ Error fetching team stats for record:",
              teamStatsError
            );
          } else if (teamStatsData && teamStatsData.length > 0) {
            const latestStats = teamStatsData[0];
            setRecord({
              wins: latestStats.wins || 0,
              losses: latestStats.losses || 0,
              otLosses: latestStats.ot_losses || 0,
              points: latestStats.points || 0,
              regulationWins: latestStats.wins_in_regulation || 0,
              overtimeWins:
                (latestStats.regulation_and_ot_wins || 0) -
                (latestStats.wins_in_regulation || 0),
              shootoutWins: latestStats.wins_in_shootout || 0
            });
          }
        }
      } catch (err) {
        console.error("❌ Error in fetchScheduleFromDb:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch schedule from database"
        );
        setGames([]);
        setRecord(null);
      } finally {
        setLoading(false);
      }
    };

    fetchScheduleFromDb();
  }, [teamAbbr, currentSeason, seasonId, teamId]);

  return { games, loading, error, record };
};
