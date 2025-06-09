import { useState, useEffect } from "react";
import useCurrentSeason from "hooks/useCurrentSeason";
import Fetch from "lib/cors-fetch";

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

export interface TeamScheduleResponse {
  games: ScheduleGame[];
  clubTimezone: string;
  clubUTCOffset: string;
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
    if (!teamAbbr || !currentSeason) return;

    const fetchSchedule = async () => {
      try {
        setLoading(true);
        setError(null);

        const seasonToUse = seasonId || currentSeason.toString();
        const response = await Fetch(
          `https://api-web.nhle.com/v1/club-schedule-season/${teamAbbr}/${seasonToUse}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch schedule: ${response.statusText}`);
        }

        const data: TeamScheduleResponse = await response.json();
        const scheduleGames = data.games || [];
        setGames(scheduleGames);

        // Calculate team record from completed games
        if (scheduleGames.length > 0 && teamId) {
          const completedGames = scheduleGames.filter(
            (game) =>
              game.gameState === "OFF" ||
              game.gameState === "FINAL" ||
              (game.homeTeamScore !== undefined &&
                game.awayTeamScore !== undefined)
          );

          let wins = 0;
          let losses = 0;
          let otLosses = 0;

          completedGames.forEach((game) => {
            const isHomeTeam = game.homeTeam.id.toString() === teamId;
            const teamScore = isHomeTeam
              ? game.homeTeamScore
              : game.awayTeamScore;
            const opponentScore = isHomeTeam
              ? game.awayTeamScore
              : game.homeTeamScore;

            if (teamScore !== undefined && opponentScore !== undefined) {
              if (teamScore > opponentScore) {
                wins++;
              } else {
                // For now, treat all losses the same - would need additional data to detect OT/SO losses
                losses++;
              }
            }
          });

          const points = wins * 2 + otLosses;

          setRecord({
            wins,
            losses,
            otLosses,
            points
          });
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch schedule"
        );
        setGames([]);
        setRecord(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [teamAbbr, currentSeason, seasonId, teamId]);

  return { games, loading, error, record };
};
