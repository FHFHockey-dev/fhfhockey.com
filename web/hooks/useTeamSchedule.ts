import { useEffect, useState } from "react";
import { useCurrentSeasonQuery } from "hooks/useCurrentSeason";
import supabase from "lib/supabase";
import { isRealUtcDateOnly } from "lib/dashboard/forgeLinks";
import {
  resolveScheduleGameTeamIdentity,
  resolveScheduleTeamSelection,
} from "lib/NHL/seasonAwareScheduleTeam";
import { teamsInfo } from "lib/teamsInfo";

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

export interface TeamStandingsDetails {
  season_id: number;
  date: string;
  team_abbrev: string;
  home_wins: number;
  home_losses: number;
  home_ot_losses: number;
  home_games_played: number;
  road_wins: number;
  road_losses: number;
  road_ot_losses: number;
  road_games_played: number;
  wins: number;
  losses: number;
  ot_losses: number;
  points: number;
  games_played: number;
  goal_differential: number;
  goal_for: number;
  goal_against: number;
  streak_code: string | null;
  streak_count: number | null;
  l10_wins: number | null;
  l10_losses: number | null;
  l10_ot_losses: number | null;
  l10_games_played: number | null;
  l10_points: number | null;
  l10_goal_differential: number | null;
  home_goals_for: number | null;
  home_goals_against: number | null;
  road_goals_for: number | null;
  road_goals_against: number | null;
  league_sequence: number | null;
}

type ScheduleState = {
  identity: string | null;
  games: ScheduleGame[];
  loading: boolean;
  error: string | null;
  record: TeamRecord | null;
  standingsDetails: TeamStandingsDetails | null;
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
      teamAbbreviation: string;
      seasonId: number;
      recordAsOfDate: string | null;
      recordAsOfDateIsValid: boolean;
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
  recordAsOfDate,
}: {
  teamAbbr: string;
  teamId: string | undefined;
  seasonId: string | undefined;
  currentSeasonId: number | undefined;
  seasonLookupIsPending: boolean;
  seasonLookupIsError: boolean;
  recordAsOfDate: string | undefined;
}): ScheduleResolution {
  const recordDateIdentity =
    recordAsOfDate === undefined ? "latest" : recordAsOfDate;
  const parsedTeamId = parsePositiveInteger(teamId);
  const teamInfo = Object.prototype.hasOwnProperty.call(teamsInfo, teamAbbr)
    ? teamsInfo[teamAbbr]
    : undefined;

  if (parsedTeamId === null || teamInfo?.id !== parsedTeamId) {
    return {
      kind: "terminal",
      identity: JSON.stringify([
        "invalid-team",
        teamAbbr,
        teamId ?? "",
        recordDateIdentity,
      ]),
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
        identity: JSON.stringify([
          "pending-season",
          teamAbbr,
          parsedTeamId,
          recordDateIdentity,
        ]),
        error: null,
      };
    }

    if (seasonLookupIsError) {
      return {
        kind: "terminal",
        identity: JSON.stringify([
          "season-error",
          teamAbbr,
          parsedTeamId,
          recordDateIdentity,
        ]),
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
        recordDateIdentity,
      ]),
      error: SEASON_SELECTION_ERROR,
    };
  }

  const teamSelection = resolveScheduleTeamSelection(
    teamAbbr,
    parsedTeamId,
    parsedSeasonId,
  );
  if (!teamSelection) {
    return {
      kind: "terminal",
      identity: JSON.stringify([
        "invalid-team-season",
        teamAbbr,
        parsedTeamId,
        parsedSeasonId,
        recordDateIdentity,
      ]),
      error: TEAM_SELECTION_ERROR,
    };
  }

  const recordAsOfDateIsValid =
    recordAsOfDate === undefined || isRealUtcDateOnly(recordAsOfDate);

  return {
    kind: "ready",
    identity: JSON.stringify([
      teamAbbr,
      teamSelection.source.id,
      teamSelection.source.abbreviation,
      parsedSeasonId,
      recordDateIdentity,
    ]),
    error: null,
    teamId: teamSelection.source.id,
    teamAbbreviation: teamSelection.source.abbreviation,
    seasonId: parsedSeasonId,
    recordAsOfDate:
      recordAsOfDateIsValid && recordAsOfDate !== undefined
        ? recordAsOfDate
        : null,
    recordAsOfDateIsValid,
  };
}

export const useTeamSchedule = (
  teamAbbr: string,
  seasonId?: string,
  teamId?: string,
  recordAsOfDate?: string,
) => {
  const [state, setState] = useState<ScheduleState>({
    identity: null,
    games: [],
    loading: true,
    error: null,
    record: null,
    standingsDetails: null,
  });
  const currentSeasonQuery = useCurrentSeasonQuery();
  const resolution = buildScheduleResolution({
    teamAbbr,
    teamId,
    seasonId,
    currentSeasonId: currentSeasonQuery.data?.seasonId,
    seasonLookupIsPending: currentSeasonQuery.isPending,
    seasonLookupIsError: currentSeasonQuery.isError,
    recordAsOfDate,
  });
  const resolutionKind = resolution.kind;
  const requestIdentity = resolution.identity;
  const terminalError = resolution.error;
  const validatedTeamId =
    resolution.kind === "ready" ? resolution.teamId : null;
  const validatedTeamAbbreviation =
    resolution.kind === "ready" ? resolution.teamAbbreviation : null;
  const validatedSeasonId =
    resolution.kind === "ready" ? resolution.seasonId : null;
  const validatedRecordAsOfDate =
    resolution.kind === "ready" ? resolution.recordAsOfDate : null;
  const recordAsOfDateIsValid =
    resolution.kind === "ready" && resolution.recordAsOfDateIsValid;

  useEffect(() => {
    let ownsRequest = true;

    if (
      resolutionKind !== "ready" ||
      validatedTeamId === null ||
      validatedTeamAbbreviation === null ||
      validatedSeasonId === null
    ) {
      setState({
        identity: requestIdentity,
        games: [],
        loading: resolutionKind === "pending",
        error: terminalError,
        record: null,
        standingsDetails: null,
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
          standingsDetails: null,
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
            const gameSeasonId = Number(game.seasonId);
            const homeTeamInfo = resolveScheduleGameTeamIdentity(
              game.homeTeamId,
              gameSeasonId,
            );
            const awayTeamInfo = resolveScheduleGameTeamIdentity(
              game.awayTeamId,
              gameSeasonId,
            );

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
                abbrev:
                  homeTeamInfo?.abbreviation || `T${game.homeTeamId}`,
                logo: "",
                darkLogo: "",
              },
              awayTeam: {
                id: game.awayTeamId,
                placeName: {
                  default: awayTeamInfo?.name || `Team ${game.awayTeamId}`,
                },
                abbrev:
                  awayTeamInfo?.abbreviation || `T${game.awayTeamId}`,
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
                  stat.gameId === game.id &&
                  stat.teamId === game.homeTeam.id,
              );
              const awayStats = gameStatsData?.find(
                (stat) =>
                  stat.gameId === game.id &&
                  stat.teamId === game.awayTeam.id,
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

        let nextRecord: TeamRecord | null = null;
        let nextStandingsDetails: TeamStandingsDetails | null = null;
        if (recordAsOfDateIsValid) {
          let standingsQuery = supabase
            .from("nhl_standings_details")
            .select(
              "season_id,date,team_abbrev,home_wins,home_losses,home_ot_losses,home_games_played,road_wins,road_losses,road_ot_losses,road_games_played,wins,losses,ot_losses,points,games_played,goal_differential,goal_for,goal_against,streak_code,streak_count,l10_wins,l10_losses,l10_ot_losses,l10_games_played,l10_points,l10_goal_differential,home_goals_for,home_goals_against,road_goals_for,road_goals_against,league_sequence,regulation_wins,regulation_plus_ot_wins,shootout_wins",
            )
            .eq("season_id", validatedSeasonId)
            .eq("team_abbrev", validatedTeamAbbreviation);

          if (validatedRecordAsOfDate !== null) {
            standingsQuery = standingsQuery.lte(
              "date",
              validatedRecordAsOfDate,
            );
          }

          const { data: standingsData, error: standingsError } =
            await standingsQuery.order("date", { ascending: false }).limit(1);

          if (!ownsRequest) return;
          if (standingsError) {
            console.warn(
              "⚠️ Error fetching standings for record:",
              standingsError,
            );
          } else if (standingsData && standingsData.length > 0) {
            const latestStandings = standingsData[0];
            nextStandingsDetails = latestStandings as TeamStandingsDetails;
            nextRecord = {
              wins: latestStandings.wins ?? 0,
              losses: latestStandings.losses ?? 0,
              otLosses: latestStandings.ot_losses ?? 0,
              points: latestStandings.points ?? 0,
              regulationWins: latestStandings.regulation_wins ?? 0,
              overtimeWins:
                (latestStandings.regulation_plus_ot_wins ?? 0) -
                (latestStandings.regulation_wins ?? 0),
              shootoutWins: latestStandings.shootout_wins ?? 0,
            };
          }
        }

        if (!ownsRequest) return;
        setState({
          identity: requestIdentity,
          games: transformedGames,
          loading: false,
          error: null,
          record: nextRecord,
          standingsDetails: nextStandingsDetails,
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
          standingsDetails: null,
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
    validatedTeamAbbreviation,
    validatedRecordAsOfDate,
    recordAsOfDateIsValid,
  ]);

  const ownsCurrentIdentity = state.identity === requestIdentity;
  const scheduleTeam =
    resolutionKind === "ready" &&
    validatedTeamId !== null &&
    validatedTeamAbbreviation !== null
      ? {
          id: validatedTeamId,
          abbreviation: validatedTeamAbbreviation,
        }
      : null;

  if (resolutionKind === "pending") {
    return {
      games: [],
      loading: true,
      error: null,
      record: null,
      scheduleTeam: null,
    };
  }

  if (resolutionKind === "terminal") {
    return {
      games: [],
      loading: false,
      error: terminalError,
      record: null,
      scheduleTeam: null,
    };
  }

  return ownsCurrentIdentity
    ? {
        games: state.games,
        loading: state.loading,
        error: state.error,
        record: state.record,
        standingsDetails: state.standingsDetails,
        scheduleTeam,
      }
    : {
        games: [],
        loading: true,
        error: null,
        record: null,
        scheduleTeam,
      };
};
