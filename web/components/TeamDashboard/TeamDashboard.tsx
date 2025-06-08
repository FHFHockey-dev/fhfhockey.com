import React, { useState, useEffect } from "react";
import supabase from "lib/supabase";
import { teamsInfo } from "lib/teamsInfo";
import useCurrentSeason from "hooks/useCurrentSeason";
import styles from "./TeamDashboard.module.scss";

interface TeamDashboardProps {
  teamId: string;
  teamAbbrev: string;
  seasonId?: string;
}

interface StandingsData {
  division_sequence: number;
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
}

interface InjuryReport {
  player_name: string;
  injury_type: string;
  status: string;
  estimated_return: string | null;
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
  const [injuries, setInjuries] = useState<InjuryReport[]>([]);
  const [recentPerformance, setRecentPerformance] =
    useState<RecentPerformance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            streak_code,
            streak_count,
            l10_wins,
            l10_losses,
            l10_ot_losses,
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
            gp
          `
          )
          .eq("team_abbreviation", teamAbbrev)
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
          let totalGamesWeighted = 0;
          let weightedCfPct = 0;
          let weightedXgfPct = 0;
          let weightedHdcfPct = 0;
          let weightedScfPct = 0;
          let weightedSvPct = 0;
          let weightedShPct = 0;
          let weightedPdo = 0;

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

            // Weight each stat by games played for proper averaging
            weightedCfPct += cfPct * gamesPlayed;
            weightedXgfPct += xgfPct * gamesPlayed;
            weightedHdcfPct += hdcfPct * gamesPlayed;
            weightedScfPct += scfPct * gamesPlayed;
            weightedSvPct += svPct * gamesPlayed;
            weightedShPct += shPct * gamesPlayed;
            weightedPdo += pdo * gamesPlayed;
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
              shooting_pct_5v5: weightedShPct / totalGamesWeighted
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

        // Remove goaltending stats aggregation since we don't have wgo_goalie_stats table
        setGoaltendingStats(null);

        // Remove injury reports since the table doesn't exist
        setInjuries([]);

        // Calculate recent performance metrics from standings data
        if (standings?.[0] && summaryData) {
          const standingsData = standings[0];
          const recent = {
            last_5_record: "N/A", // Would need L5 specific data
            last_10_record: `${standingsData.l10_wins || 0}-${standingsData.l10_losses || 0}-${standingsData.l10_ot_losses || 0}`,
            goals_for_l10: summaryData.goals_for || 0, // Using total goals as proxy
            goals_against_l10: summaryData.goals_against || 0, // Using total goals as proxy
            shots_for_l10: 0, // Would need to calculate from recent games
            shots_against_l10: 0,
            pp_pct_l10: specialTeams?.[0]?.power_play_pct || 0,
            pk_pct_l10: specialTeams?.[0]?.penalty_kill_pct || 0
          };
          setRecentPerformance(recent);
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
  }, [teamId, teamAbbrev, effectiveSeasonId]);

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
      <div className={styles.header}>
        <div className={styles.teamInfo}>
          {teamInfo && (
            <img
              src={`/teamLogos/${teamAbbrev}.png`}
              alt={`${teamInfo.name} logo`}
              className={styles.teamLogo}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          <div className={styles.teamDetails}>
            <h1 className={styles.teamName}>{teamInfo?.name || teamAbbrev}</h1>
            <p className={styles.seasonInfo}>
              2024-25 Season • Last Updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>

        {standingsData && (
          <div className={styles.quickStats}>
            <div className={styles.quickStat}>
              <span className={styles.quickStatValue}>
                {standingsData.points}
              </span>
              <span className={styles.quickStatLabel}>Points</span>
            </div>
            <div className={styles.quickStat}>
              <span className={styles.quickStatValue}>
                {standingsData.wins}-{standingsData.losses}-
                {standingsData.ot_losses}
              </span>
              <span className={styles.quickStatLabel}>Record</span>
            </div>
            <div className={styles.quickStat}>
              <span className={styles.quickStatValue}>
                {standingsData.division_sequence}
                {standingsData.division_sequence === 1
                  ? "st"
                  : standingsData.division_sequence === 2
                    ? "nd"
                    : standingsData.division_sequence === 3
                      ? "rd"
                      : "th"}
              </span>
              <span className={styles.quickStatLabel}>
                {standingsData.division_name}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className={styles.cardsGrid}>
        {/* Enhanced Standings Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Current Standing</h3>
            <div className={styles.cardIcon}></div>
          </div>
          <div className={styles.cardContent}>
            {standingsData ? (
              <>
                <div className={styles.primaryStat}>
                  <span className={styles.statValue}>
                    {standingsData.division_sequence}
                    {standingsData.division_sequence === 1
                      ? "st"
                      : standingsData.division_sequence === 2
                        ? "nd"
                        : standingsData.division_sequence === 3
                          ? "rd"
                          : "th"}
                  </span>
                  <span className={styles.statLabel}>
                    in {standingsData.division_name}
                  </span>
                </div>
                <div className={styles.statsGrid}>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>
                      {standingsData.points}
                    </span>
                    <span className={styles.statLabel}>Points</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>
                      {standingsData.wins}-{standingsData.losses}-
                      {standingsData.ot_losses}
                    </span>
                    <span className={styles.statLabel}>Record</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>
                      {formatPercentage(standingsData.point_pctg)}
                    </span>
                    <span className={styles.statLabel}>Point %</span>
                  </div>
                  <div className={styles.stat}>
                    <span
                      className={`${styles.statValue} ${standingsData.goal_for > standingsData.goal_against ? styles.positive : styles.negative}`}
                    >
                      {standingsData.goal_for > standingsData.goal_against
                        ? "+"
                        : ""}
                      {standingsData.goal_for - standingsData.goal_against}
                    </span>
                    <span className={styles.statLabel}>Goal Diff</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>
                      {standingsData.regulation_wins || "N/A"}
                    </span>
                    <span className={styles.statLabel}>ROW</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>
                      {standingsData.games_played}
                    </span>
                    <span className={styles.statLabel}>GP</span>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.noData}>No standings data available</div>
            )}
          </div>
        </div>

        {/* Enhanced Momentum Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Recent Form & Momentum</h3>
            <div className={styles.cardIcon}></div>
          </div>
          <div className={styles.cardContent}>
            {standingsData && recentPerformance ? (
              <>
                <div className={styles.primaryStat}>
                  <span
                    className={`${styles.statValue} ${getStreakClass(standingsData.streak_code)}`}
                  >
                    {standingsData.streak_code}
                    {standingsData.streak_count}
                  </span>
                  <span className={styles.statLabel}>
                    {formatStreak(
                      standingsData.streak_code,
                      standingsData.streak_count
                    )}
                  </span>
                </div>
                <div className={styles.recentRecords}>
                  <div className={styles.recordSection}>
                    <h4>Last 10 Games</h4>
                    <div className={styles.recordDisplay}>
                      <span className={styles.recordValue}>
                        {standingsData.l10_wins}-{standingsData.l10_losses}-
                        {standingsData.l10_ot_losses}
                      </span>
                      <span className={styles.recordPoints}>
                        (
                        {standingsData.l10_wins * 2 +
                          standingsData.l10_ot_losses}{" "}
                        pts)
                      </span>
                    </div>
                  </div>
                  <div className={styles.trendIndicators}>
                    <div className={styles.trendStat}>
                      <span className={styles.trendValue}>
                        {recentPerformance.goals_for_l10}
                      </span>
                      <span className={styles.trendLabel}>GF L10</span>
                    </div>
                    <div className={styles.trendStat}>
                      <span className={styles.trendValue}>
                        {recentPerformance.goals_against_l10}
                      </span>
                      <span className={styles.trendLabel}>GA L10</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.noData}>No momentum data available</div>
            )}
          </div>
        </div>

        {/* Enhanced Advanced Analytics Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Advanced Analytics</h3>
            <div className={styles.cardIcon}></div>
          </div>
          <div className={styles.cardContent}>
            {teamStats ? (
              <>
                <div className={styles.analyticsGrid}>
                  <div className={styles.analyticsStat}>
                    <span
                      className={`${styles.statValue} ${getRankColor((teamStats.cf_pct || 0) * 100, { good: 52, poor: 48 })}`}
                    >
                      {formatPercentage(teamStats.cf_pct)}
                    </span>
                    <span className={styles.statLabel}>Corsi For %</span>
                    <div
                      className={`${styles.statIndicator} ${
                        (teamStats.cf_pct || 0) > 0.5
                          ? styles.positive
                          : styles.negative
                      }`}
                    />
                  </div>
                  <div className={styles.analyticsStat}>
                    <span
                      className={`${styles.statValue} ${getRankColor((teamStats.xgf_pct || 0) * 100, { good: 52, poor: 48 })}`}
                    >
                      {formatPercentage(teamStats.xgf_pct)}
                    </span>
                    <span className={styles.statLabel}>Expected Goals %</span>
                    <div
                      className={`${styles.statIndicator} ${
                        (teamStats.xgf_pct || 0) > 0.5
                          ? styles.positive
                          : styles.negative
                      }`}
                    />
                  </div>
                  <div className={styles.analyticsStat}>
                    <span
                      className={`${styles.statValue} ${getRankColor(teamStats.pdo || 0, { good: 1.01, poor: 0.99 })}`}
                    >
                      {formatDecimal(teamStats.pdo, 3)}
                    </span>
                    <span className={styles.statLabel}>PDO</span>
                    <div
                      className={`${styles.statIndicator} ${
                        (teamStats.pdo || 0) > 1.0
                          ? styles.positive
                          : styles.negative
                      }`}
                    />
                  </div>
                  <div className={styles.analyticsStat}>
                    <span className={styles.statValue}>
                      {formatPercentage(teamStats.hdcf_pct)}
                    </span>
                    <span className={styles.statLabel}>HDCF%</span>
                    <div
                      className={`${styles.statIndicator} ${
                        (teamStats.hdcf_pct || 0) > 0.5
                          ? styles.positive
                          : styles.negative
                      }`}
                    />
                  </div>
                  <div className={styles.analyticsStat}>
                    <span className={styles.statValue}>
                      {formatPercentage(teamStats.scf_pct)}
                    </span>
                    <span className={styles.statLabel}>SCF%</span>
                    <div
                      className={`${styles.statIndicator} ${
                        (teamStats.scf_pct || 0) > 0.5
                          ? styles.positive
                          : styles.negative
                      }`}
                    />
                  </div>
                  <div className={styles.analyticsStat}>
                    <span className={styles.statValue}>
                      {formatPercentage(teamStats.save_pct_5v5)}
                    </span>
                    <span className={styles.statLabel}>5v5 SV%</span>
                    <div
                      className={`${styles.statIndicator} ${
                        (teamStats.save_pct_5v5 || 0) > 0.915
                          ? styles.positive
                          : styles.negative
                      }`}
                    />
                  </div>
                </div>
                <div className={styles.analyticsNote}>
                  <small>5v5 situation • Season totals</small>
                </div>
              </>
            ) : (
              <div className={styles.noData}>No analytics data available</div>
            )}
          </div>
        </div>

        {/* Enhanced Special Teams Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Special Teams Performance</h3>
            <div className={styles.cardIcon}></div>
          </div>
          <div className={styles.cardContent}>
            {specialTeamsStats ? (
              <>
                <div className={styles.specialTeamsGrid}>
                  <div className={styles.specialTeamsStat}>
                    <div className={styles.powerPlayHeader}>
                      <span className={styles.specialTeamsIcon}></span>
                      <span className={styles.specialTeamsLabel}>
                        Power Play
                      </span>
                    </div>
                    <span
                      className={`${styles.statValue} ${getRankColor((specialTeamsStats.power_play_pct || 0) * 100, { good: 22, poor: 18 })}`}
                    >
                      {formatPercentage(specialTeamsStats.power_play_pct)}
                    </span>
                    <div className={styles.subStats}>
                      <span className={styles.subStat}>
                        {formatDecimal(
                          specialTeamsStats.pp_opportunities_per_game
                        )}{" "}
                        OPP/GP
                      </span>
                      <span className={styles.subStat}>
                        {specialTeamsStats.pp_goals_for}GF •{" "}
                        {specialTeamsStats.sh_goals_against}GA
                      </span>
                    </div>
                    <div
                      className={`${styles.statIndicator} ${
                        (specialTeamsStats.power_play_pct || 0) > 0.2
                          ? styles.positive
                          : styles.negative
                      }`}
                    />
                  </div>
                  <div className={styles.specialTeamsStat}>
                    <div className={styles.penaltyKillHeader}>
                      <span className={styles.specialTeamsIcon}></span>
                      <span className={styles.specialTeamsLabel}>
                        Penalty Kill
                      </span>
                    </div>
                    <span
                      className={`${styles.statValue} ${getRankColor((specialTeamsStats.penalty_kill_pct || 0) * 100, { good: 82, poor: 78 })}`}
                    >
                      {formatPercentage(specialTeamsStats.penalty_kill_pct)}
                    </span>
                    <div className={styles.subStats}>
                      <span className={styles.subStat}>
                        {specialTeamsStats.sh_goals_for}GF •{" "}
                        {specialTeamsStats.pp_goals_against}GA
                      </span>
                    </div>
                    <div
                      className={`${styles.statIndicator} ${
                        (specialTeamsStats.penalty_kill_pct || 0) > 0.8
                          ? styles.positive
                          : styles.negative
                      }`}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.noData}>
                No special teams data available
              </div>
            )}
          </div>
        </div>

        {/* New Goaltending Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Goaltending</h3>
            <div className={styles.cardIcon}></div>
          </div>
          <div className={styles.cardContent}>
            {goaltendingStats ? (
              <>
                <div className={styles.goaltendingGrid}>
                  <div className={styles.goaltendingStat}>
                    <span
                      className={`${styles.statValue} ${getRankColor((goaltendingStats.save_pct || 0) * 100, { good: 91.5, poor: 89.5 })}`}
                    >
                      {formatPercentage(goaltendingStats.save_pct)}
                    </span>
                    <span className={styles.statLabel}>Save %</span>
                  </div>
                  <div className={styles.goaltendingStat}>
                    <span
                      className={`${styles.statValue} ${getRankColor(goaltendingStats.gaa || 0, { good: 2.75, poor: 3.25 }, false)}`}
                    >
                      {formatDecimal(goaltendingStats.gaa, 2)}
                    </span>
                    <span className={styles.statLabel}>GAA</span>
                  </div>
                  <div className={styles.goaltendingStat}>
                    <span className={styles.statValue}>
                      {goaltendingStats.wins}-{goaltendingStats.losses}
                    </span>
                    <span className={styles.statLabel}>W-L</span>
                  </div>
                  <div className={styles.goaltendingStat}>
                    <span className={styles.statValue}>
                      {goaltendingStats.shutouts}
                    </span>
                    <span className={styles.statLabel}>SO</span>
                  </div>
                  <div className={styles.goaltendingStat}>
                    <span className={styles.statValue}>
                      {goaltendingStats.quality_starts}
                    </span>
                    <span className={styles.statLabel}>QS</span>
                  </div>
                  <div className={styles.goaltendingStat}>
                    <span
                      className={`${styles.statValue} ${
                        (goaltendingStats.goals_saved_above_expected || 0) > 0
                          ? styles.positive
                          : styles.negative
                      }`}
                    >
                      {formatDecimal(
                        goaltendingStats.goals_saved_above_expected,
                        1
                      )}
                    </span>
                    <span className={styles.statLabel}>GSAx</span>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.noData}>No goaltending data available</div>
            )}
          </div>
        </div>

        {/* Injury Report Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Injury Report</h3>
            <div className={styles.cardIcon}></div>
          </div>
          <div className={styles.cardContent}>
            {injuries.length > 0 ? (
              <div className={styles.injuryList}>
                {injuries.slice(0, 5).map((injury, index) => (
                  <div key={index} className={styles.injuryItem}>
                    <div className={styles.injuryPlayer}>
                      {injury.player_name}
                    </div>
                    <div className={styles.injuryDetails}>
                      <span className={styles.injuryType}>
                        {injury.injury_type}
                      </span>
                      <span className={styles.injuryStatus}>
                        {injury.status}
                      </span>
                      {injury.estimated_return && (
                        <span className={styles.injuryReturn}>
                          Est. Return: {injury.estimated_return}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {injuries.length > 5 && (
                  <div className={styles.injuryMore}>
                    +{injuries.length - 5} more injuries
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.noInjuries}>
                <span className={styles.healthyIcon}>✅</span>
                <span>Team is healthy!</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
