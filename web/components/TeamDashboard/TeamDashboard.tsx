import React, { useState, useEffect } from "react";
import supabase from "lib/supabase";
import { teamsInfo } from "lib/teamsInfo";
import useCurrentSeason from "hooks/useCurrentSeason";
import fetchWithCache from "lib/fetchWithCache";
import { GameByGameTimeline } from "./GameByGameTimeline";
import { AdvancedL10Metrics } from "./AdvancedL10Metrics";
import styles from "./TeamDashboard.module.scss";

interface TeamDashboardProps {
  teamId: string;
  teamAbbrev: string;
  seasonId?: string;
}

interface StandingsData {
  division_sequence: number;
  conference_sequence: number;
  league_sequence: number;
  points: number;
  wins: number;
  losses: number;
  ot_losses: number;
  streak_code: string;
  streak_count: number;
  l10_wins: number;
  l10_losses: number;
  l10_ot_losses: number;
  goal_for: number;
  goal_against: number;
  point_pctg: number;
  division_name: string;
  conference_name: string;
  games_played: number;
  regulation_wins: number;
}

interface TeamStats {
  cf_pct: number;
  xgf_pct: number;
  pdo: number;
  hdcf_pct: number;
  scf_pct: number;
  save_pct_5v5: number;
  shooting_pct_5v5: number;
  xgf: number; // Expected goals for
  xga: number; // Expected goals against
}

interface SpecialTeamsStats {
  power_play_pct: number;
  penalty_kill_pct: number;
  pp_opportunities_per_game: number;
  pp_goals_for: number;
  pp_goals_against: number;
  sh_goals_for: number;
  sh_goals_against: number;
}

interface GoaltendingStats {
  save_pct: number;
  gaa: number;
  wins: number;
  losses: number;
  shutouts: number;
  quality_starts: number;
  goals_saved_above_expected: number;
  goalies: IndividualGoalie[];
  totalGames: number;
}

interface IndividualGoalie {
  playerId: number;
  goalieFullName: string;
  lastName: string;
  gamesPlayed: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  otLosses: number;
  savePct: number;
  gaa: number;
  shutouts: number;
  workloadShare: number;
  qualityStarts?: number;
  qualityStartsPct?: number;
}

interface RecentPerformance {
  last_5_record: string;
  last_10_record: string;
  goals_for_l10: number;
  goals_against_l10: number;
  shots_for_l10: number;
  shots_against_l10: number;
  pp_pct_l10: number;
  pk_pct_l10: number;
}

interface LeagueRankings {
  goals_per_game_rank: number;
  goals_against_per_game_rank: number;
  shots_per_game_rank: number;
  shots_against_per_game_rank: number;
  power_play_rank: number;
  penalty_kill_rank: number;
  faceoff_win_rank: number;
  home_record_rank: number;
  road_record_rank: number;
  l10_rank: number;
  cf_pct_rank: number;
  xgf_pct_rank: number;
  pdo_rank: number;
  hdcf_pct_rank: number;
  save_pct_5v5_rank: number;
  shooting_pct_5v5_rank: number;
}

export function TeamDashboard({
  teamId,
  teamAbbrev,
  seasonId
}: TeamDashboardProps) {
  const currentSeason = useCurrentSeason();
  const effectiveSeasonId = seasonId || currentSeason?.seasonId?.toString();

  const [standingsData, setStandingsData] = useState<StandingsData | null>(
    null
  );
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [specialTeamsStats, setSpecialTeamsStats] =
    useState<SpecialTeamsStats | null>(null);
  const [goaltendingStats, setGoaltendingStats] =
    useState<GoaltendingStats | null>(null);
  const [recentPerformance, setRecentPerformance] =
    useState<RecentPerformance | null>(null);
  const [leagueRankings, setLeagueRankings] = useState<LeagueRankings | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameRecordsCount, setGameRecordsCount] = useState<number>(0);
  const [includePlayoffs, setIncludePlayoffs] = useState<boolean>(false);

  const teamInfo = teamsInfo[teamAbbrev];

  useEffect(() => {
    const fetchTeamData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Type guard to ensure we have a valid season ID
        if (!effectiveSeasonId) {
          throw new Error("No valid season ID available");
        }

        // Fetch standings data from team_summary_years for more accurate official stats
        const { data: summaryData, error: summaryError } = await supabase
          .from("team_summary_years")
          .select(
            `
            games_played,
            wins,
            losses,
            ot_losses,
            points,
            goals_for,
            goals_against,
            point_pct,
            regulation_and_ot_wins,
            faceoff_win_pct,
            penalty_kill_pct,
            power_play_pct
          `
          )
          .eq("team_id", parseInt(teamId))
          .eq("season_id", parseInt(effectiveSeasonId))
          .single();

        if (summaryError) throw summaryError;

        // Fetch current standings position from nhl_standings_details (for division rank, streak, etc.)
        const { data: standings, error: standingsError } = await supabase
          .from("nhl_standings_details")
          .select(
            `
            division_sequence,
            conference_sequence,
            league_sequence,
            streak_code,
            streak_count,
            l10_wins,
            l10_losses,
            l10_ot_losses,
            l10_goals_for,
            l10_goals_against,
            l10_goal_differential,
            division_name,
            conference_name
          `
          )
          .eq("team_abbrev", teamAbbrev)
          .eq("season_id", parseInt(effectiveSeasonId))
          .order("date", { ascending: false })
          .limit(1);

        if (standingsError) throw standingsError;

        // Fetch 5v5 advanced stats and calculate season averages weighted by games played
        // Use current season date ranges for filtering since nst_team_5v5 doesn't have season_id
        if (
          !currentSeason?.regularSeasonStartDate ||
          !currentSeason?.regularSeasonEndDate
        ) {
          throw new Error("Current season date information not available");
        }

        const startDate = currentSeason.regularSeasonStartDate.split("T")[0];
        const endDate = includePlayoffs
          ? currentSeason.seasonEndDate.split("T")[0]
          : currentSeason.regularSeasonEndDate.split("T")[0];

        const { data: stats5v5, error: stats5v5Error } = await supabase
          .from("nst_team_5v5")
          .select(
            `
            cf_pct,
            xgf_pct,
            pdo,
            hdcf_pct,
            scf_pct,
            sv_pct,
            sh_pct,
            gp,
            xgf,
            xga,
            date
          `
          )
          .eq("team_abbreviation", teamAbbrev)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: true }); // Get all records to calculate proper averages

        if (stats5v5Error) throw stats5v5Error;

        // Fetch special teams stats from wgo_team_stats (latest available)
        const { data: specialTeams, error: specialTeamsError } = await supabase
          .from("wgo_team_stats")
          .select(
            `
            power_play_pct, 
            penalty_kill_pct, 
            pp_opportunities_per_game,
            power_play_goals_for,
            pp_goals_against,
            sh_goals_for,
            sh_goals_against
          `
          )
          .eq("team_id", parseInt(teamId))
          .eq("season_id", parseInt(effectiveSeasonId))
          .order("date", { ascending: false })
          .limit(1);

        if (specialTeamsError) throw specialTeamsError;

        // Process standings data combining team_summary_years and nhl_standings_details
        if (summaryData) {
          const standingsRecord = standings?.[0];
          setStandingsData({
            division_sequence: standingsRecord?.division_sequence || 0,
            conference_sequence: standingsRecord?.conference_sequence || 0,
            league_sequence: standingsRecord?.league_sequence || 0,
            points: summaryData.points || 0,
            wins: summaryData.wins || 0,
            losses: summaryData.losses || 0,
            ot_losses: summaryData.ot_losses || 0,
            streak_code: standingsRecord?.streak_code || "",
            streak_count: standingsRecord?.streak_count || 0,
            l10_wins: standingsRecord?.l10_wins || 0,
            l10_losses: standingsRecord?.l10_losses || 0,
            l10_ot_losses: standingsRecord?.l10_ot_losses || 0,
            goal_for: summaryData.goals_for || 0,
            goal_against: summaryData.goals_against || 0,
            point_pctg: summaryData.point_pct || 0,
            division_name: standingsRecord?.division_name || "",
            conference_name: standingsRecord?.conference_name || "",
            games_played: summaryData.games_played || 0,
            regulation_wins: summaryData.regulation_and_ot_wins || 0
          });
        }

        // Calculate proper season averages for 5v5 stats weighted by games played
        if (stats5v5 && stats5v5.length > 0) {
          // Set the game records count for the tooltip
          setGameRecordsCount(stats5v5.length);

          let totalGamesWeighted = 0;
          let weightedCfPct = 0;
          let weightedXgfPct = 0;
          let weightedHdcfPct = 0;
          let weightedScfPct = 0;
          let weightedSvPct = 0;
          let weightedShPct = 0;
          let weightedPdo = 0;
          let weightedXgf = 0; // Change back to weighted average
          let weightedXga = 0; // Change back to weighted average

          // Filter out records with zero or null games played
          const validRecords = stats5v5.filter(
            (record) => record.gp && record.gp > 0
          );

          validRecords.forEach((record) => {
            const gamesPlayed = record.gp || 0;

            // Skip records with zero games played
            if (gamesPlayed === 0) return;

            totalGamesWeighted += gamesPlayed;

            // Handle percentage values - ensure they're in decimal form (0-1) not percentage form (0-100)
            const cfPct = record.cf_pct
              ? record.cf_pct > 1
                ? record.cf_pct / 100
                : record.cf_pct
              : 0;
            const xgfPct = record.xgf_pct
              ? record.xgf_pct > 1
                ? record.xgf_pct / 100
                : record.xgf_pct
              : 0;
            const hdcfPct = record.hdcf_pct
              ? record.hdcf_pct > 1
                ? record.hdcf_pct / 100
                : record.hdcf_pct
              : 0;
            const scfPct = record.scf_pct
              ? record.scf_pct > 1
                ? record.scf_pct / 100
                : record.scf_pct
              : 0;
            const svPct = record.sv_pct
              ? record.sv_pct > 1
                ? record.sv_pct / 100
                : record.sv_pct
              : 0;
            const shPct = record.sh_pct
              ? record.sh_pct > 1
                ? record.sh_pct / 100
                : record.sh_pct
              : 0;
            const pdo = record.pdo || 0;
            const xgf = record.xgf || 0;
            const xga = record.xga || 0;

            // Weight each stat by games played for proper averaging
            weightedCfPct += cfPct * gamesPlayed;
            weightedXgfPct += xgfPct * gamesPlayed;
            weightedHdcfPct += hdcfPct * gamesPlayed;
            weightedScfPct += scfPct * gamesPlayed;
            weightedSvPct += svPct * gamesPlayed;
            weightedShPct += shPct * gamesPlayed;
            weightedPdo += pdo * gamesPlayed;
            weightedXgf += xgf * gamesPlayed; // Weight by games played for proper average
            weightedXga += xga * gamesPlayed; // Weight by games played for proper average
          });

          // Calculate final weighted averages
          if (totalGamesWeighted > 0) {
            setTeamStats({
              cf_pct: weightedCfPct / totalGamesWeighted,
              xgf_pct: weightedXgfPct / totalGamesWeighted,
              pdo: weightedPdo / totalGamesWeighted,
              hdcf_pct: weightedHdcfPct / totalGamesWeighted,
              scf_pct: weightedScfPct / totalGamesWeighted,
              save_pct_5v5: weightedSvPct / totalGamesWeighted,
              shooting_pct_5v5: weightedShPct / totalGamesWeighted,
              xgf: weightedXgf / totalGamesWeighted, // Average expected goals for per game
              xga: weightedXga / totalGamesWeighted // Average expected goals against per game
            });
          }
        }

        // Set special teams data (use latest single record, not average)
        if (specialTeams && specialTeams.length > 0) {
          const latestSpecialTeams = specialTeams[0];
          setSpecialTeamsStats({
            power_play_pct: latestSpecialTeams.power_play_pct || 0,
            penalty_kill_pct: latestSpecialTeams.penalty_kill_pct || 0,
            pp_opportunities_per_game:
              latestSpecialTeams.pp_opportunities_per_game || 0,
            pp_goals_for: latestSpecialTeams.power_play_goals_for || 0,
            pp_goals_against: latestSpecialTeams.pp_goals_against || 0,
            sh_goals_for: latestSpecialTeams.sh_goals_for || 0,
            sh_goals_against: latestSpecialTeams.sh_goals_against || 0
          });
        }

        // Fetch goaltending data using NHL API and process team goalie statistics
        const franchiseId = teamInfo?.franchiseId;
        if (franchiseId) {
          try {
            // Calculate date range for current season
            const today = new Date().toISOString().split("T")[0];
            const seasonStart =
              currentSeason?.regularSeasonStartDate?.split("T")[0] ||
              "2024-10-04";

            // Fetch team schedule to get total games played
            const scheduleUrl = `https://api-web.nhle.com/v1/club-schedule-season/${teamAbbrev}/${effectiveSeasonId}`;
            const scheduleResponse = await fetchWithCache(scheduleUrl);
            const completedGames = scheduleResponse.games.filter(
              (game: any) =>
                game.gameType === 2 && game.gameDate.split("T")[0] <= today
            ).length;

            // Fetch goalie data from NHL API
            const goalieUrl = `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=true&isGame=true&start=0&limit=50&factCayenneExp=gamesPlayed>=1&cayenneExp=franchiseId=${franchiseId} and gameDate<='${today}' and gameDate>='${seasonStart}' and gameTypeId=2`;
            const goalieResponse = await fetchWithCache(goalieUrl);

            // Also fetch advanced goalie stats for quality starts
            const advancedGoalieUrl = `https://api.nhle.com/stats/rest/en/goalie/advanced?isAggregate=true&isGame=true&start=0&limit=50&factCayenneExp=gamesPlayed>=1&cayenneExp=franchiseId=${franchiseId} and gameDate<='${today}' and gameDate>='${seasonStart}' and gameTypeId=2`;
            const advancedGoalieResponse =
              await fetchWithCache(advancedGoalieUrl);

            if (goalieResponse.data && goalieResponse.data.length > 0) {
              const goalieData = goalieResponse.data;
              const advancedGoalieData = advancedGoalieResponse.data || [];

              // Create a map of advanced stats by player ID
              const advancedStatsMap = advancedGoalieData.reduce(
                (acc: any, goalie: any) => {
                  acc[goalie.playerId] = goalie;
                  return acc;
                },
                {}
              );

              // Process individual goalie stats
              const processedGoalies: IndividualGoalie[] = goalieData.map(
                (goalie: any) => {
                  const advancedStats = advancedStatsMap[goalie.playerId];
                  return {
                    playerId: goalie.playerId,
                    goalieFullName: goalie.goalieFullName,
                    lastName: goalie.lastName,
                    gamesPlayed: goalie.gamesPlayed,
                    gamesStarted: goalie.gamesStarted,
                    wins: goalie.wins,
                    losses: goalie.losses,
                    otLosses: goalie.otLosses,
                    savePct: goalie.savePct,
                    gaa: goalie.goalsAgainstAverage,
                    shutouts: goalie.shutouts,
                    workloadShare: (goalie.gamesStarted / completedGames) * 100,
                    qualityStarts: advancedStats?.qualityStart || 0,
                    qualityStartsPct: advancedStats?.qualityStartsPct || 0
                  };
                }
              );

              // Calculate team totals (including quality starts from advanced data)
              const teamTotals = goalieData.reduce(
                (acc: any, goalie: any) => {
                  const advancedStats = advancedStatsMap[goalie.playerId];
                  return {
                    gamesPlayed: acc.gamesPlayed + goalie.gamesPlayed,
                    wins: acc.wins + goalie.wins,
                    losses: acc.losses + goalie.losses,
                    otLosses: acc.otLosses + goalie.otLosses,
                    saves: acc.saves + goalie.saves,
                    shotsAgainst: acc.shotsAgainst + goalie.shotsAgainst,
                    goalsAgainst: acc.goalsAgainst + goalie.goalsAgainst,
                    shutouts: acc.shutouts + goalie.shutouts,
                    qualityStarts:
                      acc.qualityStarts + (advancedStats?.qualityStart || 0),
                    timeOnIce: acc.timeOnIce + goalie.timeOnIce
                  };
                },
                {
                  gamesPlayed: 0,
                  wins: 0,
                  losses: 0,
                  otLosses: 0,
                  saves: 0,
                  shotsAgainst: 0,
                  goalsAgainst: 0,
                  shutouts: 0,
                  qualityStarts: 0,
                  timeOnIce: 0
                }
              );

              // Calculate team averages
              const teamSavePct =
                teamTotals.shotsAgainst > 0
                  ? teamTotals.saves / teamTotals.shotsAgainst
                  : 0;
              const teamGAA =
                teamTotals.timeOnIce > 0
                  ? (teamTotals.goalsAgainst * 3600) / teamTotals.timeOnIce
                  : 0;

              setGoaltendingStats({
                save_pct: teamSavePct,
                gaa: teamGAA,
                wins: teamTotals.wins,
                losses: teamTotals.losses + teamTotals.otLosses,
                shutouts: teamTotals.shutouts,
                quality_starts: teamTotals.qualityStarts,
                goals_saved_above_expected: 0, // Would need advanced stats for this
                goalies: processedGoalies.sort(
                  (a, b) => b.gamesStarted - a.gamesStarted
                ),
                totalGames: completedGames
              });
            }
          } catch (error) {
            console.error("Error fetching goaltending data:", error);
            setGoaltendingStats(null);
          }
        }

        // Calculate recent performance metrics from standings data
        if (standings?.[0] && summaryData) {
          const standingsData = standings[0];
          const recent = {
            last_5_record: "N/A", // Would need L5 specific data
            last_10_record: `${standingsData.l10_wins || 0}-${standingsData.l10_losses || 0}-${standingsData.l10_ot_losses || 0}`,
            goals_for_l10: standingsData.l10_goals_for || 0, // Now using actual L10 goals for data
            goals_against_l10: standingsData.l10_goals_against || 0, // Now using actual L10 goals against data
            shots_for_l10: 0, // Would need to calculate from recent games
            shots_against_l10: 0,
            pp_pct_l10: specialTeams?.[0]?.power_play_pct || 0,
            pk_pct_l10: specialTeams?.[0]?.penalty_kill_pct || 0
          };
          setRecentPerformance(recent);
        }

        // Fetch league rankings data - Calculate from existing tables
        try {
          // Get all teams' basic stats for ranking calculations
          const { data: allTeamsSummary, error: allTeamsError } = await supabase
            .from("team_summary_years")
            .select(
              `
              team_id,
              goals_for,
              goals_against,
              games_played,
              shots_for_per_game,
              shots_against_per_game,
              power_play_pct,
              penalty_kill_pct,
              faceoff_win_pct,
              point_pct
            `
            )
            .eq("season_id", parseInt(effectiveSeasonId));

          if (allTeamsError) throw allTeamsError;

          // Get all teams' standings data for positional rankings
          const { data: allTeamsStandings, error: allStandingsError } =
            await supabase
              .from("nhl_standings_details")
              .select(
                `
              team_abbrev,
              league_sequence,
              conference_sequence,
              division_sequence,
              home_wins,
              home_losses,
              home_ot_losses,
              road_wins,
              road_losses,
              road_ot_losses,
              l10_wins,
              l10_losses,
              l10_ot_losses
            `
              )
              .eq("season_id", parseInt(effectiveSeasonId))
              .order("date", { ascending: false })
              .limit(32); // Get latest for each team

          if (allStandingsError) throw allStandingsError;

          // Get all teams' advanced stats
          const { data: allTeamsAdvanced, error: allAdvancedError } =
            await supabase
              .from("nst_team_5v5")
              .select(
                `
              team_abbreviation,
              cf_pct,
              xgf_pct,
              pdo,
              hdcf_pct,
              sv_pct,
              sh_pct,
              xga,
              xgf
            `
              )
              .order("date", { ascending: false })
              .limit(32); // Get latest for each team

          if (allAdvancedError) throw allAdvancedError;

          if (allTeamsSummary && summaryData) {
            // Calculate rankings
            const calculateRank = (
              value: number,
              allValues: number[],
              higherIsBetter: boolean = true
            ) => {
              const sortedValues = [...allValues].sort((a, b) =>
                higherIsBetter ? b - a : a - b
              );
              return sortedValues.indexOf(value) + 1;
            };

            // Extract current team's values
            const currentTeamData = allTeamsSummary.find(
              (team) => team.team_id === parseInt(teamId)
            );
            const currentTeamStandings = allTeamsStandings?.find(
              (team) => team.team_abbrev === teamAbbrev
            );
            const currentTeamAdvanced = allTeamsAdvanced?.find(
              (team) => team.team_abbreviation === teamAbbrev
            );

            if (currentTeamData) {
              // Calculate goals per game rankings with null safety
              const goalsForSafe = currentTeamData.goals_for || 0;
              const goalsAgainstSafe = currentTeamData.goals_against || 0;
              const gamesPlayedSafe = currentTeamData.games_played || 1; // Avoid division by zero

              const goalsPerGame = goalsForSafe / gamesPlayedSafe;
              const goalsAgainstPerGame = goalsAgainstSafe / gamesPlayedSafe;

              const allGoalsPerGame = allTeamsSummary
                .filter((team) => team.games_played && team.games_played > 0)
                .map(
                  (team) => (team.goals_for || 0) / (team.games_played || 1)
                );

              const allGoalsAgainstPerGame = allTeamsSummary
                .filter((team) => team.games_played && team.games_played > 0)
                .map(
                  (team) => (team.goals_against || 0) / (team.games_played || 1)
                );

              // Calculate special teams rankings with null safety
              const allPowerPlayPct = allTeamsSummary
                .map((team) => team.power_play_pct || 0)
                .filter((pct) => pct > 0);

              const allPenaltyKillPct = allTeamsSummary
                .map((team) => team.penalty_kill_pct || 0)
                .filter((pct) => pct > 0);

              const allFaceoffPct = allTeamsSummary
                .map((team) => team.faceoff_win_pct || 0)
                .filter((pct) => pct > 0);

              // Calculate shots rankings with null safety
              const allShotsPerGame = allTeamsSummary
                .map((team) => team.shots_for_per_game || 0)
                .filter((shots) => shots > 0);

              const allShotsAgainstPerGame = allTeamsSummary
                .map((team) => team.shots_against_per_game || 0)
                .filter((shots) => shots > 0);

              // Calculate home/road/L10 rankings
              let homeRecordRank = 0;
              let roadRecordRank = 0;
              let l10Rank = 0;

              if (currentTeamStandings && allTeamsStandings) {
                const homePoints =
                  (currentTeamStandings.home_wins || 0) * 2 +
                  (currentTeamStandings.home_ot_losses || 0);
                const roadPoints =
                  (currentTeamStandings.road_wins || 0) * 2 +
                  (currentTeamStandings.road_ot_losses || 0);
                const l10Points =
                  (currentTeamStandings.l10_wins || 0) * 2 +
                  (currentTeamStandings.l10_ot_losses || 0);

                const allHomePoints = allTeamsStandings.map(
                  (team) =>
                    (team.home_wins || 0) * 2 + (team.home_ot_losses || 0)
                );
                const allRoadPoints = allTeamsStandings.map(
                  (team) =>
                    (team.road_wins || 0) * 2 + (team.road_ot_losses || 0)
                );
                const allL10Points = allTeamsStandings.map(
                  (team) => (team.l10_wins || 0) * 2 + (team.l10_ot_losses || 0)
                );

                homeRecordRank = calculateRank(homePoints, allHomePoints, true);
                roadRecordRank = calculateRank(roadPoints, allRoadPoints, true);
                l10Rank = calculateRank(l10Points, allL10Points, true);
              }

              // Calculate advanced stats rankings with null safety
              let cfPctRank = 0;
              let xgfPctRank = 0;
              let pdoRank = 0;
              let hdcfPctRank = 0;
              let savePct5v5Rank = 0;
              let shootingPct5v5Rank = 0;

              if (currentTeamAdvanced && allTeamsAdvanced) {
                const allCfPct = allTeamsAdvanced
                  .map((team) => team.cf_pct || 0)
                  .filter((pct) => pct > 0);
                const allXgfPct = allTeamsAdvanced
                  .map((team) => team.xgf_pct || 0)
                  .filter((pct) => pct > 0);
                const allPdo = allTeamsAdvanced
                  .map((team) => team.pdo || 0)
                  .filter((pdo) => pdo > 0);
                const allHdcfPct = allTeamsAdvanced
                  .map((team) => team.hdcf_pct || 0)
                  .filter((pct) => pct > 0);
                const allSavePct = allTeamsAdvanced
                  .map((team) => team.sv_pct || 0)
                  .filter((pct) => pct > 0);
                const allShootingPct = allTeamsAdvanced
                  .map((team) => team.sh_pct || 0)
                  .filter((pct) => pct > 0);

                if (allCfPct.length > 0) {
                  cfPctRank = calculateRank(
                    currentTeamAdvanced.cf_pct || 0,
                    allCfPct,
                    true
                  );
                }
                if (allXgfPct.length > 0) {
                  xgfPctRank = calculateRank(
                    currentTeamAdvanced.xgf_pct || 0,
                    allXgfPct,
                    true
                  );
                }
                if (allPdo.length > 0) {
                  pdoRank = calculateRank(
                    currentTeamAdvanced.pdo || 0,
                    allPdo,
                    true
                  );
                }
                if (allHdcfPct.length > 0) {
                  hdcfPctRank = calculateRank(
                    currentTeamAdvanced.hdcf_pct || 0,
                    allHdcfPct,
                    true
                  );
                }
                if (allSavePct.length > 0) {
                  savePct5v5Rank = calculateRank(
                    currentTeamAdvanced.sv_pct || 0,
                    allSavePct,
                    true
                  );
                }
                if (allShootingPct.length > 0) {
                  shootingPct5v5Rank = calculateRank(
                    currentTeamAdvanced.sh_pct || 0,
                    allShootingPct,
                    true
                  );
                }
              }

              setLeagueRankings({
                goals_per_game_rank:
                  allGoalsPerGame.length > 0
                    ? calculateRank(goalsPerGame, allGoalsPerGame, true)
                    : 0,
                goals_against_per_game_rank:
                  allGoalsAgainstPerGame.length > 0
                    ? calculateRank(
                        goalsAgainstPerGame,
                        allGoalsAgainstPerGame,
                        false
                      )
                    : 0,
                shots_per_game_rank:
                  allShotsPerGame.length > 0
                    ? calculateRank(
                        currentTeamData.shots_for_per_game || 0,
                        allShotsPerGame,
                        true
                      )
                    : 0,
                shots_against_per_game_rank:
                  allShotsAgainstPerGame.length > 0
                    ? calculateRank(
                        currentTeamData.shots_against_per_game || 0,
                        allShotsAgainstPerGame,
                        false
                      )
                    : 0,
                power_play_rank:
                  allPowerPlayPct.length > 0
                    ? calculateRank(
                        currentTeamData.power_play_pct || 0,
                        allPowerPlayPct,
                        true
                      )
                    : 0,
                penalty_kill_rank:
                  allPenaltyKillPct.length > 0
                    ? calculateRank(
                        currentTeamData.penalty_kill_pct || 0,
                        allPenaltyKillPct,
                        true
                      )
                    : 0,
                faceoff_win_rank:
                  allFaceoffPct.length > 0
                    ? calculateRank(
                        currentTeamData.faceoff_win_pct || 0,
                        allFaceoffPct,
                        true
                      )
                    : 0,
                home_record_rank: homeRecordRank,
                road_record_rank: roadRecordRank,
                l10_rank: l10Rank,
                cf_pct_rank: cfPctRank,
                xgf_pct_rank: xgfPctRank,
                pdo_rank: pdoRank,
                hdcf_pct_rank: hdcfPctRank,
                save_pct_5v5_rank: savePct5v5Rank,
                shooting_pct_5v5_rank: shootingPct5v5Rank
              });
            }
          }
        } catch (rankingsError) {
          console.error("Error calculating league rankings:", rankingsError);
          setLeagueRankings(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        console.error("Error fetching team dashboard data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (teamId && teamAbbrev && effectiveSeasonId) {
      fetchTeamData();
    }
  }, [teamId, teamAbbrev, effectiveSeasonId, includePlayoffs, currentSeason]);

  const formatStreak = (code: string, count: number) => {
    const streakType = code === "W" ? "Win" : code === "L" ? "Loss" : "OT Loss";
    return `${count} Game ${streakType} Streak`;
  };

  const getStreakClass = (code: string) => {
    return code === "W" ? styles.winStreak : styles.lossStreak;
  };

  const formatPercentage = (value: number | null) => {
    if (value === null || value === undefined) return "N/A";
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatDecimal = (value: number | null, decimals: number = 1) => {
    if (value === null || value === undefined) return "N/A";
    return value.toFixed(decimals);
  };

  const getRankColor = (
    value: number,
    threshold: { good: number; poor: number },
    higher_is_better: boolean = true
  ) => {
    if (higher_is_better) {
      if (value >= threshold.good) return styles.excellent;
      if (value <= threshold.poor) return styles.poor;
      return styles.average;
    } else {
      if (value <= threshold.good) return styles.excellent;
      if (value >= threshold.poor) return styles.poor;
      return styles.average;
    }
  };

  const getRankingColor = (rank: number) => {
    if (rank <= 10) return styles.excellent;
    if (rank >= 23) return styles.poor;
    return styles.average;
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <span>Loading team dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h3>⚠️ Error Loading Dashboard</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.container}
      style={
        {
          "--team-primary-color": teamInfo?.primaryColor || "#1976d2",
          "--team-secondary-color": teamInfo?.secondaryColor || "#424242",
          "--team-accent-color": teamInfo?.accent || "#ff9800"
        } as React.CSSProperties
      }
    >
      {/* Team Stats Card */}
      <div className={styles.teamStatisticsCard}>
        <div className={styles.tsCardHeader}>
          <h3>Team Statistics</h3>
        </div>
        <div className={styles.tsCardContent}>
          {standingsData ? (
            <div className={styles.tsStatsGrid}>
              <div className={styles.tsStatItem}>
                <span className={styles.tsStatValue}>
                  {standingsData.points}
                </span>
                <span className={styles.tsStatLabel}>Points</span>
              </div>
              <div className={styles.tsStatItem}>
                <span className={styles.tsStatValue}>
                  {standingsData.wins}-{standingsData.losses}-
                  {standingsData.ot_losses}
                </span>
                <span className={styles.statLabel}>Record</span>
              </div>
              <div className={styles.tsStatItem}>
                <span className={styles.tsStatValue}>
                  {formatPercentage(standingsData.point_pctg)}
                </span>
                <span className={styles.statLabel}>Points %</span>
              </div>
              <div className={styles.tsStatItem}>
                <span className={styles.tsStatValue}>
                  {(
                    standingsData.goal_for / standingsData.games_played
                  ).toFixed(2)}
                </span>
                <span className={styles.statLabel}>Goals/Game</span>
              </div>
              <div className={styles.tsStatItem}>
                <span className={styles.tsStatValue}>
                  {(
                    standingsData.goal_against / standingsData.games_played
                  ).toFixed(2)}
                </span>
                <span className={styles.statLabel}>GA/Game</span>
              </div>
              <div className={styles.tsStatItem}>
                <span
                  className={`${styles.tsStatValue} ${standingsData.goal_for > standingsData.goal_against ? styles.positive : styles.negative}`}
                >
                  {standingsData.goal_for > standingsData.goal_against
                    ? "+"
                    : ""}
                  {standingsData.goal_for - standingsData.goal_against}
                </span>
                <span className={styles.statLabel}>Goal Diff</span>
              </div>
            </div>
          ) : (
            <div className={styles.noData}>No team stats available</div>
          )}
          {specialTeamsStats ? (
            <div className={styles.tsStatsGrid}>
              <div className={styles.tsStatItem}>
                <span
                  className={`${styles.tsStatValue} ${getRankColor(specialTeamsStats.power_play_pct * 100, { good: 22, poor: 18 })}`}
                >
                  {formatPercentage(specialTeamsStats.power_play_pct)}
                </span>
                <span className={styles.tsStatLabel}>Power Play %</span>
              </div>
              <div className={styles.tsStatItem}>
                <span
                  className={`${styles.tsStatValue} ${getRankColor(specialTeamsStats.penalty_kill_pct * 100, { good: 82, poor: 78 })}`}
                >
                  {formatPercentage(specialTeamsStats.penalty_kill_pct)}
                </span>
                <span className={styles.tsStatLabel}>Penalty Kill %</span>
              </div>
              <div className={styles.tsStatItem}>
                <span className={styles.tsStatValue}>
                  {formatDecimal(
                    specialTeamsStats.pp_opportunities_per_game,
                    1
                  )}
                </span>
                <span className={styles.tsStatLabel}>PP Opps/Game</span>
              </div>
              <div className={styles.tsStatItem}>
                <span className={styles.tsStatValue}>
                  {specialTeamsStats.pp_goals_for}
                </span>
                <span className={styles.tsStatLabel}>PP Goals For</span>
              </div>
              <div className={styles.tsStatItem}>
                <span className={styles.tsStatValue}>
                  {specialTeamsStats.pp_goals_against}
                </span>
                <span className={styles.tsStatLabel}>PP Goals Against</span>
              </div>
              <div className={styles.tsStatItem}>
                <span className={styles.tsStatValue}>
                  {specialTeamsStats.sh_goals_for}
                </span>
                <span className={styles.tsStatLabel}>SH Goals For</span>
              </div>
            </div>
          ) : (
            <div className={styles.noData}>No special teams data available</div>
          )}
        </div>
      </div>
      <div className={styles.cardsGrid}>
        {/* Advanced Stats Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>
              Advanced Analytics
              <span
                className={styles.infoIcon}
                title={`5v5 ${includePlayoffs ? "season + playoffs" : "regular season"} averages based on ${gameRecordsCount} game records. Data includes: Expected Goals For/Against, Corsi, HDCF, PDO, and shooting percentages at even strength.`}
              >
                &#9432;
              </span>
            </h3>
            <div className={styles.cardToggle}>
              <button
                className={`${styles.toggleButton} ${!includePlayoffs ? styles.active : ""}`}
                onClick={() => setIncludePlayoffs(false)}
              >
                Exhibition
              </button>
              <button
                className={`${styles.toggleButton} ${includePlayoffs ? styles.active : ""}`}
                onClick={() => setIncludePlayoffs(true)}
              >
                Playoffs
              </button>
            </div>
          </div>
          <div className={styles.cardContent}>
            {teamStats ? (
              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <span
                    className={`${styles.statValue} ${getRankColor(teamStats.cf_pct * 100, { good: 52, poor: 48 })}`}
                  >
                    {formatPercentage(teamStats.cf_pct)}
                  </span>
                  <span className={styles.statLabel}>Corsi For %</span>
                </div>
                <div className={styles.statItem}>
                  <span
                    className={`${styles.statValue} ${getRankColor(teamStats.xgf_pct * 100, { good: 52, poor: 48 })}`}
                  >
                    {formatPercentage(teamStats.xgf_pct)}
                  </span>
                  <span className={styles.statLabel}>xGoals For %</span>
                </div>
                <div className={styles.statItem}>
                  <span
                    className={`${styles.statValue} ${getRankColor(teamStats.hdcf_pct * 100, { good: 52, poor: 48 })}`}
                  >
                    {formatPercentage(teamStats.hdcf_pct)}
                  </span>
                  <span className={styles.statLabel}>HDCF %</span>
                </div>
                <div className={styles.statItem}>
                  <span
                    className={`${styles.statValue} ${getRankColor(teamStats.pdo, { good: 1.005, poor: 0.995 })}`}
                  >
                    {formatDecimal(teamStats.pdo, 3)}
                  </span>
                  <span className={styles.statLabel}>PDO</span>
                </div>
                <div className={styles.statItem}>
                  <span
                    className={`${styles.statValue} ${getRankColor(teamStats.save_pct_5v5 * 100, { good: 91.5, poor: 89.5 })}`}
                  >
                    {formatPercentage(teamStats.save_pct_5v5)}
                  </span>
                  <span className={styles.statLabel}>5v5 Save %</span>
                </div>
                <div className={styles.statItem}>
                  <span
                    className={`${styles.statValue} ${getRankColor(teamStats.shooting_pct_5v5 * 100, { good: 10, poor: 8 })}`}
                  >
                    {formatPercentage(teamStats.shooting_pct_5v5)}
                  </span>
                  <span className={styles.statLabel}>5v5 Shooting %</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>
                    {(teamStats.scf_pct * 100).toFixed(2) || 0}%
                  </span>
                  <span className={styles.statLabel}>SCF %</span>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.xgContainer}>
                    <div className={styles.xgStat}>
                      <span className={styles.statValue}>
                        {teamStats.xgf.toFixed(2)}
                      </span>
                      <span className={styles.statLabel}>AVG. xGF</span>
                    </div>
                    <div className={styles.xgStat}>
                      <span className={styles.statValue}>
                        {teamStats.xga.toFixed(2)}
                      </span>
                      <span className={styles.statLabel}>AVG. xGA</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.noData}>No advanced stats available</div>
            )}
          </div>
        </div>

        {/* Enhanced Goaltending Card */}
        <div className={`${styles.card} ${styles.goaltendingCard}`}>
          <div className={styles.cardHeader}>
            <h3>Goaltending</h3>
            <div className={styles.cardIcon}></div>
          </div>
          <div className={styles.cardContent}>
            {goaltendingStats ? (
              <>
                <div className={styles.goaltendingOverview}>
                  <div className={styles.goaltendingGrid}>
                    <div className={styles.goaltendingStat}>
                      <span
                        className={`${styles.statValue} ${getRankColor((goaltendingStats.save_pct || 0) * 100, { good: 91.5, poor: 89.5 })}`}
                      >
                        {formatPercentage(goaltendingStats.save_pct)}
                      </span>
                      <span className={styles.statLabel}>Team SV%</span>
                    </div>
                    <div className={styles.goaltendingStat}>
                      <span
                        className={`${styles.statValue} ${getRankColor(goaltendingStats.gaa || 0, { good: 2.75, poor: 3.25 }, false)}`}
                      >
                        {formatDecimal(goaltendingStats.gaa, 2)}
                      </span>
                      <span className={styles.statLabel}>Team GAA</span>
                    </div>
                    <div className={styles.goaltendingStat}>
                      <span className={styles.statValue}>
                        {goaltendingStats.wins}-{goaltendingStats.losses}
                      </span>
                      <span className={styles.statLabel}>W-L Record</span>
                    </div>
                    <div className={styles.goaltendingStat}>
                      <span className={styles.statValue}>
                        {goaltendingStats.shutouts}
                      </span>
                      <span className={styles.statLabel}>Shutouts</span>
                    </div>
                    <div className={styles.goaltendingStat}>
                      <span className={styles.statValue}>
                        {goaltendingStats.quality_starts}
                      </span>
                      <span className={styles.statLabel}>Quality Starts</span>
                    </div>
                    <div className={styles.goaltendingStat}>
                      <span className={styles.statValue}>
                        {goaltendingStats.goalies.length}
                      </span>
                      <span className={styles.statLabel}>Goalies Used</span>
                    </div>
                  </div>
                </div>

                {/* Individual Goalie Cards */}
                <div className={styles.individualGoalies}>
                  <h4 className={styles.sectionTitle}>
                    Individual Performance
                  </h4>
                  <div className={styles.goalieCardsGrid}>
                    {goaltendingStats.goalies
                      .slice(0, 4)
                      .map((goalie, index) => (
                        <div
                          key={goalie.playerId}
                          className={styles.goalieCard}
                        >
                          <div className={styles.goalieCardHeader}>
                            <span className={styles.goalieName}>
                              {goalie.goalieFullName}
                            </span>
                            <span
                              className={`${styles.goalieRole} ${index === 0 ? styles.starter : index === 1 ? styles.backup : styles.reserve}`}
                            >
                              {index === 0
                                ? "STARTER"
                                : index === 1
                                  ? "BACKUP"
                                  : index === 2
                                    ? "THIRD"
                                    : "R"}
                            </span>
                          </div>

                          {/* Workload Distribution Bar */}
                          <div className={styles.workloadSection}>
                            <div className={styles.workloadBar}>
                              <div
                                className={styles.workloadFill}
                                style={{
                                  width: `${Math.min(goalie.workloadShare, 100)}%`,
                                  backgroundColor: (() => {
                                    const goalieColors = [
                                      "var(--team-primary-color)",
                                      "var(--team-secondary-color)",
                                      "var(--team-accent-color)",
                                      "#6c757d",
                                      "#dc3545",
                                      "#28a745"
                                    ];
                                    return goalieColors[index] || "#6c757d";
                                  })()
                                }}
                              />
                            </div>
                            <div className={styles.workloadLabel}>
                              {formatDecimal(goalie.workloadShare, 1)}% of
                              starts
                            </div>
                          </div>

                          <div className={styles.goalieStatsGrid}>
                            <div className={styles.goalieStatItem}>
                              <span
                                className={`${styles.goalieStatValue} ${getRankColor((goalie.savePct || 0) * 100, { good: 91.5, poor: 89.5 })}`}
                              >
                                {formatPercentage(goalie.savePct)}
                              </span>
                              <span className={styles.goalieStatLabel}>
                                SV%
                              </span>
                            </div>
                            <div className={styles.goalieStatItem}>
                              <span
                                className={`${styles.goalieStatValue} ${getRankColor(goalie.gaa || 0, { good: 2.75, poor: 3.25 }, false)}`}
                              >
                                {formatDecimal(goalie.gaa, 2)}
                              </span>
                              <span className={styles.goalieStatLabel}>
                                GAA
                              </span>
                            </div>
                            <div className={styles.goalieStatItem}>
                              <span className={styles.goalieStatValue}>
                                {goalie.gamesPlayed}
                              </span>
                              <span className={styles.goalieStatLabel}>GP</span>
                            </div>
                            <div className={styles.goalieStatItem}>
                              <span className={styles.goalieStatValue}>
                                {goalie.gamesStarted}
                              </span>
                              <span className={styles.goalieStatLabel}>GS</span>
                            </div>
                            <div className={styles.goalieStatItem}>
                              <span className={styles.goalieStatValue}>
                                {goalie.qualityStarts || 0}
                              </span>
                              <span className={styles.goalieStatLabel}>QS</span>
                            </div>
                            <div className={styles.goalieStatItem}>
                              <span className={styles.goalieStatValue}>
                                {goalie.qualityStartsPct
                                  ? formatPercentage(goalie.qualityStartsPct)
                                  : "N/A"}
                              </span>
                              <span className={styles.goalieStatLabel}>
                                QS%
                              </span>
                            </div>
                            <div className={styles.goalieStatItem}>
                              <span className={styles.goalieStatValue}>
                                {goalie.wins}-{goalie.losses}
                              </span>
                              <span className={styles.goalieStatLabel}>
                                W-L
                              </span>
                            </div>
                            <div className={styles.goalieStatItem}>
                              <span className={styles.goalieStatValue}>
                                {goalie.shutouts}
                              </span>
                              <span className={styles.goalieStatLabel}>SO</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Team Workload Distribution */}
                <div className={styles.workloadDistribution}>
                  <h4 className={styles.sectionTitle}>
                    Workload Distribution ({goaltendingStats.totalGames} games)
                  </h4>
                  <div className={styles.workloadDistributionBar}>
                    {goaltendingStats.goalies.map((goalie, index) => {
                      const goalieColors = [
                        "var(--team-primary-color)",
                        "var(--team-secondary-color)",
                        "var(--team-accent-color)",
                        "#6c757d",
                        "#dc3545",
                        "#28a745"
                      ];

                      return (
                        <div
                          key={goalie.playerId}
                          className={styles.workloadSegment}
                          style={{
                            width: `${goalie.workloadShare}%`,
                            backgroundColor: goalieColors[index] || "#6c757d"
                          }}
                          title={`${goalie.goalieFullName}: ${formatDecimal(goalie.workloadShare, 1)}% (${goalie.gamesStarted} starts)`}
                        />
                      );
                    })}
                  </div>
                  <div className={styles.workloadLegend}>
                    {goaltendingStats.goalies.map((goalie, index) => {
                      const goalieColors = [
                        "var(--team-primary-color)",
                        "var(--team-secondary-color)",
                        "var(--team-accent-color)",
                        "#6c757d",
                        "#dc3545",
                        "#28a745"
                      ];

                      return (
                        <div
                          key={goalie.playerId}
                          className={styles.legendItem}
                        >
                          <div
                            className={styles.legendColor}
                            style={{
                              backgroundColor: goalieColors[index] || "#6c757d"
                            }}
                          />
                          <span className={styles.legendText}>
                            {goalie.lastName} (
                            {formatDecimal(goalie.workloadShare, 1)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.loadingState}>
                <div className={styles.loadingSpinner}></div>
                <span>Loading goaltending data...</span>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Standings Card with League Rankings */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Team Rankings</h3>
            <div className={styles.cardIcon}></div>
          </div>
          <div className={styles.cardContent}>
            {standingsData ? (
              <>
                {/* Team Identity & Position */}
                <div className={styles.teamIdentity}>
                  <div className={styles.positionSummary}>
                    <div className={styles.positionStat}>
                      <span className={styles.positionValue}>
                        {standingsData.league_sequence}
                        {standingsData.league_sequence === 1
                          ? "st"
                          : standingsData.league_sequence === 2
                            ? "nd"
                            : standingsData.league_sequence === 3
                              ? "rd"
                              : "th"}
                      </span>
                      <span className={styles.positionLabel}>NHL</span>
                    </div>
                    <div className={styles.positionStat}>
                      <span className={styles.positionValue}>
                        {standingsData.conference_sequence}
                        {standingsData.conference_sequence === 1
                          ? "st"
                          : standingsData.conference_sequence === 2
                            ? "nd"
                            : standingsData.conference_sequence === 3
                              ? "rd"
                              : "th"}
                      </span>
                      <span className={styles.positionLabel}>
                        {standingsData.conference_name}
                      </span>
                    </div>
                    <div className={styles.positionStat}>
                      <span className={styles.positionValue}>
                        {standingsData.division_sequence}
                        {standingsData.division_sequence === 1
                          ? "st"
                          : standingsData.division_sequence === 2
                            ? "nd"
                            : standingsData.division_sequence === 3
                              ? "rd"
                              : "th"}
                      </span>
                      <span className={styles.positionLabel}>
                        {standingsData.division_name}
                      </span>
                    </div>
                  </div>

                  {/* Quick Stats Summary */}
                  <div className={styles.quickStatsSummary}>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryValue}>
                        {standingsData.points}
                      </span>
                      <span className={styles.summaryLabel}>PTS</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryValue}>
                        {standingsData.wins}-{standingsData.losses}-
                        {standingsData.ot_losses}
                      </span>
                      <span className={styles.summaryLabel}>Record</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryValue}>
                        {formatPercentage(standingsData.point_pctg)}
                      </span>
                      <span className={styles.summaryLabel}>PT%</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span
                        className={`${styles.summaryValue} ${standingsData.goal_for > standingsData.goal_against ? styles.positive : styles.negative}`}
                      >
                        {standingsData.goal_for > standingsData.goal_against
                          ? "+"
                          : ""}
                        {standingsData.goal_for - standingsData.goal_against}
                      </span>
                      <span className={styles.summaryLabel}>DIFF</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryValue}>
                        {standingsData.regulation_wins}
                      </span>
                      <span className={styles.summaryLabel}>ROW</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryValue}>
                        {standingsData.games_played}
                      </span>
                      <span className={styles.summaryLabel}>GP</span>
                    </div>
                  </div>
                </div>

                {/* League Rankings Grid */}
                {leagueRankings ? (
                  <div className={styles.leagueRankings}>
                    <h4 className={styles.rankingsTitle}>League Rankings</h4>

                    <div className={styles.rankingsGrid}>
                      <div className={styles.rankingCategory}>
                        <div className={styles.rankingTitle}>
                          <h5 className={styles.categoryTitle}>OFFENSIVE</h5>
                        </div>
                        <div className={styles.rankingItemList}>
                          <div className={styles.rankingItem}>
                            <span className={styles.rankingLabel}>G/GP</span>
                            <span
                              className={`${styles.rankingValue} ${getRankingColor(leagueRankings.goals_per_game_rank)}`}
                            >
                              #{leagueRankings.goals_per_game_rank}
                            </span>
                          </div>
                          <div className={styles.rankingItem}>
                            <span className={styles.rankingLabel}>SOG/GP</span>
                            <span
                              className={`${styles.rankingValue} ${getRankingColor(leagueRankings.shots_per_game_rank)}`}
                            >
                              #{leagueRankings.shots_per_game_rank}
                            </span>
                          </div>
                          <div className={styles.rankingItem}>
                            <span className={styles.rankingLabel}>5v5 S%</span>
                            <span
                              className={`${styles.rankingValue} ${getRankingColor(leagueRankings.shooting_pct_5v5_rank)}`}
                            >
                              #{leagueRankings.shooting_pct_5v5_rank}
                            </span>
                          </div>
                          <div className={styles.rankingItem}>
                            <span className={styles.rankingLabel}>xG%</span>
                            <span
                              className={`${styles.rankingValue} ${getRankingColor(leagueRankings.xgf_pct_rank)}`}
                            >
                              #{leagueRankings.xgf_pct_rank}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.rankingCategory}>
                        <div className={styles.rankingTitle}>
                          <h5 className={styles.categoryTitle}>DEFENSIVE</h5>
                        </div>
                        <div className={styles.rankingItemList}>
                          <div className={styles.rankingItem}>
                            <span className={styles.rankingLabel}>GA/GP</span>
                            <span
                              className={`${styles.rankingValue} ${getRankingColor(leagueRankings.goals_against_per_game_rank)}`}
                            >
                              #{leagueRankings.goals_against_per_game_rank}
                            </span>
                          </div>
                          <div className={styles.rankingItem}>
                            <span className={styles.rankingLabel}>SA/GP</span>
                            <span
                              className={`${styles.rankingValue} ${getRankingColor(leagueRankings.shots_against_per_game_rank)}`}
                            >
                              #{leagueRankings.shots_against_per_game_rank}
                            </span>
                          </div>
                          <div className={styles.rankingItem}>
                            <span className={styles.rankingLabel}>5v5 SV%</span>
                            <span
                              className={`${styles.rankingValue} ${getRankingColor(leagueRankings.save_pct_5v5_rank)}`}
                            >
                              #{leagueRankings.save_pct_5v5_rank}
                            </span>
                          </div>
                          <div className={styles.rankingItem}>
                            <span className={styles.rankingLabel}>HDCF%</span>
                            <span
                              className={`${styles.rankingValue} ${getRankingColor(leagueRankings.hdcf_pct_rank)}`}
                            >
                              #{leagueRankings.hdcf_pct_rank}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.rankingCategory}>
                        <div className={styles.rankingTitle}>
                          <h5 className={styles.categoryTitle}>
                            SPECIAL TEAMS
                          </h5>
                        </div>
                        <div className={styles.rankingItemList}>
                          <div className={styles.rankingItem}>
                            <span className={styles.rankingLabel}>PP%</span>
                            <span
                              className={`${styles.rankingValue} ${getRankingColor(leagueRankings.power_play_rank)}`}
                            >
                              #{leagueRankings.power_play_rank}
                            </span>
                          </div>
                          <div className={styles.rankingItem}>
                            <span className={styles.rankingLabel}>PK%</span>
                            <span
                              className={`${styles.rankingValue} ${getRankingColor(leagueRankings.penalty_kill_rank)}`}
                            >
                              #{leagueRankings.penalty_kill_rank}
                            </span>
                          </div>
                          <div className={styles.rankingItem}>
                            <span className={styles.rankingLabel}>FO%</span>
                            <span
                              className={`${styles.rankingValue} ${getRankingColor(leagueRankings.faceoff_win_rank)}`}
                            >
                              #{leagueRankings.faceoff_win_rank}
                            </span>
                          </div>
                          <div className={styles.rankingItem}>
                            <span className={styles.rankingLabel}>CF%</span>
                            <span
                              className={`${styles.rankingValue} ${getRankingColor(leagueRankings.cf_pct_rank)}`}
                            >
                              #{leagueRankings.cf_pct_rank}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.rankingCategory}>
                        <div className={styles.rankingTitle}>
                          <h5 className={styles.categoryTitle}>SITUATIONAL</h5>
                        </div>
                        <div className={styles.rankingItemList}>
                          <div className={styles.rankingItem}>
                            <span className={styles.rankingLabel}>Home</span>
                            <span
                              className={`${styles.rankingValue} ${getRankingColor(leagueRankings.home_record_rank)}`}
                            >
                              #{leagueRankings.home_record_rank}
                            </span>
                          </div>
                          <div className={styles.rankingItem}>
                            <span className={styles.rankingLabel}>Road</span>
                            <span
                              className={`${styles.rankingValue} ${getRankingColor(leagueRankings.road_record_rank)}`}
                            >
                              #{leagueRankings.road_record_rank}
                            </span>
                          </div>
                          <div className={styles.rankingItem}>
                            <span className={styles.rankingLabel}>L10</span>
                            <span
                              className={`${styles.rankingValue} ${getRankingColor(leagueRankings.l10_rank)}`}
                            >
                              #{leagueRankings.l10_rank}
                            </span>
                          </div>
                          <div className={styles.rankingItem}>
                            <span className={styles.rankingLabel}>PDO</span>
                            <span
                              className={`${styles.rankingValue} ${getRankingColor(leagueRankings.pdo_rank)}`}
                            >
                              #{leagueRankings.pdo_rank}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.rankingsLoading}>
                    Loading league rankings...
                  </div>
                )}
              </>
            ) : (
              <div className={styles.noData}>No standings data available</div>
            )}
          </div>
        </div>

        {/* Enhanced Recent Form & Momentum Card with condensed layout */}
        <div className={`${styles.card} ${styles.enhancedMomentumCard}`}>
          <div className={styles.cardHeader}>
            <h3>Recent Form & Momentum</h3>
            <div className={styles.cardIcon}></div>
          </div>
          <div className={styles.cardContent}>
            {standingsData && recentPerformance && effectiveSeasonId ? (
              <>
                {/* Game-by-Game Timeline */}
                <div className={styles.timelineSection}>
                  <GameByGameTimeline
                    teamId={teamId}
                    teamAbbrev={teamAbbrev}
                    seasonId={effectiveSeasonId}
                    maxGames={10}
                  />
                </div>

                {/* Advanced L10 Metrics Dashboard */}
                <div className={styles.metricsSection}>
                  <AdvancedL10Metrics
                    teamId={teamId}
                    teamAbbrev={teamAbbrev}
                    seasonId={effectiveSeasonId}
                  />
                </div>
              </>
            ) : (
              <div className={styles.noData}>No momentum data available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
