import { useEffect, useState } from "react";
import { useCurrentSeasonQuery } from "hooks/useCurrentSeason";
import supabase from "lib/supabase";
import {
  getTeamAbbreviationById,
  getTeamInfoById,
  teamsInfo,
} from "lib/teamsInfo";

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

type ScheduleState = {
  identity: string | null;
  games: ScheduleGame[];
  loading: boolean;
  error: string | null;
  record: TeamRecord | null;
};

type ScheduleResolution =
  | {
      kind: "pending";
      identity: string;
      error: null;
    }
  | {
      kind: "terminal";
      identity: string;
      error: string;
    }
  | {
      kind: "ready";
      identity: string;
      error: null;
      teamId: number;
      seasonId: number;
    };

const TEAM_SELECTION_ERROR = "A valid team selection is required.";
const CURRENT_SEASON_ERROR = "Unable to determine the current NHL season.";
const SEASON_SELECTION_ERROR = "A valid NHL season is required.";

function parsePositiveInteger(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseSeasonId(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d{7}$/.test(value)) return null;
  const parsed = Number(value);
  const startYear = Number(value.slice(0, 4));
  const endYear = Number(value.slice(4));
  return Number.isSafeInteger(parsed) && endYear === startYear + 1
    ? parsed
    : null;
}

function buildScheduleResolution({
  teamAbbr,
  teamId,
  seasonId,
  currentSeasonId,
  seasonLookupIsPending,
  seasonLookupIsError,
}: {
  teamAbbr: string;
  teamId: string | undefined;
  seasonId: string | undefined;
  currentSeasonId: number | undefined;
  seasonLookupIsPending: boolean;
  seasonLookupIsError: boolean;
}): ScheduleResolution {
  const parsedTeamId = parsePositiveInteger(teamId);
  const teamInfo = Object.prototype.hasOwnProperty.call(teamsInfo, teamAbbr)
    ? teamsInfo[teamAbbr]
    : undefined;

  if (parsedTeamId === null || teamInfo?.id !== parsedTeamId) {
    return {
      kind: "terminal",
      identity: JSON.stringify(["invalid-team", teamAbbr, teamId ?? ""]),
      error: TEAM_SELECTION_ERROR,
    };
  }

  const hasExplicitSeasonId = seasonId !== undefined && seasonId !== "";
  const cachedSeasonId = currentSeasonId?.toString();
  const parsedCachedSeasonId = parseSeasonId(cachedSeasonId);
  if (!hasExplicitSeasonId && parsedCachedSeasonId === null) {
    if (seasonLookupIsPending) {
      return {
        kind: "pending",
        identity: JSON.stringify(["pending-season", teamAbbr, parsedTeamId]),
        error: null,
      };
    }

    if (seasonLookupIsError) {
      return {
        kind: "terminal",
        identity: JSON.stringify(["season-error", teamAbbr, parsedTeamId]),
        error: CURRENT_SEASON_ERROR,
      };
    }
  }

  const seasonToUse = hasExplicitSeasonId ? seasonId : cachedSeasonId;
  const parsedSeasonId = parseSeasonId(seasonToUse);

  if (parsedSeasonId === null) {
    return {
      kind: "terminal",
      identity: JSON.stringify([
        "invalid-season",
        teamAbbr,
        parsedTeamId,
        seasonToUse ?? "",
      ]),
      error: SEASON_SELECTION_ERROR,
    };
  }

  return {
    kind: "ready",
    identity: JSON.stringify([teamAbbr, parsedTeamId, parsedSeasonId]),
    error: null,
    teamId: parsedTeamId,
    seasonId: parsedSeasonId,
  };
}

export const useTeamSchedule = (
  teamAbbr: string,
  seasonId?: string,
  teamId?: string,
) => {
  const [state, setState] = useState<ScheduleState>({
    identity: null,
    games: [],
    loading: true,
    error: null,
    record: null,
  });
  const currentSeasonQuery = useCurrentSeasonQuery();
  const resolution = buildScheduleResolution({
    teamAbbr,
    teamId,
    seasonId,
    currentSeasonId: currentSeasonQuery.data?.seasonId,
    seasonLookupIsPending: currentSeasonQuery.isPending,
    seasonLookupIsError: currentSeasonQuery.isError,
  });
  const resolutionKind = resolution.kind;
  const requestIdentity = resolution.identity;
  const terminalError = resolution.error;
  const validatedTeamId =
    resolution.kind === "ready" ? resolution.teamId : null;
  const validatedSeasonId =
    resolution.kind === "ready" ? resolution.seasonId : null;

  useEffect(() => {
    let ownsRequest = true;

    if (
      resolutionKind !== "ready" ||
      validatedTeamId === null ||
      validatedSeasonId === null
    ) {
      setState({
        identity: requestIdentity,
        games: [],
        loading: resolutionKind === "pending",
        error: terminalError,
        record: null,
      });

      return () => {
        ownsRequest = false;
      };
    }

    const fetchScheduleFromDb = async () => {
      try {
        setState({
          identity: requestIdentity,
          games: [],
          loading: true,
          error: null,
          record: null,
        });

        console.log("🔍 Fetching schedule from database:", {
          teamId: validatedTeamId,
          seasonId: validatedSeasonId,
        });

        // Fetch games where the team is either home or away
        const { data: gamesData, error: gamesError } = await supabase
          .from("games")
          .select("*")
          .eq("seasonId", validatedSeasonId)
          .or(
            `homeTeamId.eq.${validatedTeamId},awayTeamId.eq.${validatedTeamId}`,
          )
          .order("date", { ascending: true });

        if (!ownsRequest) return;
        if (gamesError) {
          console.error("❌ Error fetching games:", gamesError);
          throw gamesError;
        }

        console.log("✅ Fetched games from DB:", gamesData?.length || 0);

        // Transform database games to match the expected interface
        const transformedGames: ScheduleGame[] = (gamesData || []).map(
          (game) => {
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
                default: "TBD", // Would need venue lookup
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
                  default: homeTeamInfo?.name || `Team ${game.homeTeamId}`,
                },
                abbrev: homeTeamAbbrev,
                logo: "",
                darkLogo: "",
              },
              awayTeam: {
                id: game.awayTeamId,
                placeName: {
                  default: awayTeamInfo?.name || `Team ${game.awayTeamId}`,
                },
                abbrev: awayTeamAbbrev,
                logo: "",
                darkLogo: "",
              },
            };
          },
        );

        // Fetch game scores from teamGameStats
        const gameIds = transformedGames.map((g) => g.id);
        if (gameIds.length > 0) {
          const { data: gameStatsData, error: gameStatsError } = await supabase
            .from("teamGameStats")
            .select("*")
            .in("gameId", gameIds);

          if (!ownsRequest) return;
          if (gameStatsError) {
            console.warn("⚠️ Error fetching game stats:", gameStatsError);
          } else {
            // Add scores to games
            transformedGames.forEach((game) => {
              const homeStats = gameStatsData?.find(
                (stat) =>
                  stat.gameId === game.id && stat.teamId === game.homeTeam.id,
              );
              const awayStats = gameStatsData?.find(
                (stat) =>
                  stat.gameId === game.id && stat.teamId === game.awayTeam.id,
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

        // Calculate record from team stats instead of game results
        // This will be more accurate as it comes from the database
        let nextRecord: TeamRecord | null = null;
        const { data: teamStatsData, error: teamStatsError } = await supabase
          .from("wgo_team_stats")
          .select("*")
          .eq("team_id", validatedTeamId)
          .eq("season_id", validatedSeasonId)
          .order("date", { ascending: false })
          .limit(1);

        if (!ownsRequest) return;
        if (teamStatsError) {
          console.warn(
            "⚠️ Error fetching team stats for record:",
            teamStatsError,
          );
        } else if (teamStatsData && teamStatsData.length > 0) {
          const latestStats = teamStatsData[0];
          nextRecord = {
            wins: latestStats.wins || 0,
            losses: latestStats.losses || 0,
            otLosses: latestStats.ot_losses || 0,
            points: latestStats.points || 0,
            regulationWins: latestStats.wins_in_regulation || 0,
            overtimeWins:
              (latestStats.regulation_and_ot_wins || 0) -
              (latestStats.wins_in_regulation || 0),
            shootoutWins: latestStats.wins_in_shootout || 0,
          };
        }

        if (!ownsRequest) return;
        setState({
          identity: requestIdentity,
          games: transformedGames,
          loading: false,
          error: null,
          record: nextRecord,
        });
      } catch (err) {
        if (!ownsRequest) return;
        console.error("❌ Error in fetchScheduleFromDb:", err);
        setState({
          identity: requestIdentity,
          games: [],
          loading: false,
          error:
            err instanceof Error
              ? err.message
              : "Failed to fetch schedule from database",
          record: null,
        });
      } finally {
        if (!ownsRequest) return;
        setState((currentState) =>
          currentState.identity === requestIdentity && currentState.loading
            ? { ...currentState, loading: false }
            : currentState,
        );
      }
    };

    fetchScheduleFromDb();

    return () => {
      ownsRequest = false;
    };
  }, [
    requestIdentity,
    resolutionKind,
    terminalError,
    validatedSeasonId,
    validatedTeamId,
  ]);

  const ownsCurrentIdentity = state.identity === requestIdentity;

  if (resolutionKind === "pending") {
    return { games: [], loading: true, error: null, record: null };
  }

  if (resolutionKind === "terminal") {
    return {
      games: [],
      loading: false,
      error: terminalError,
      record: null,
    };
  }

  return ownsCurrentIdentity
    ? {
        games: state.games,
        loading: state.loading,
        error: state.error,
        record: state.record,
      }
    : { games: [], loading: true, error: null, record: null };
};
