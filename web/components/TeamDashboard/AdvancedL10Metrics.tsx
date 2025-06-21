import React, { useState, useEffect } from "react";
import supabase from "lib/supabase";
import styles from "./AdvancedL10Metrics.module.scss";

interface L10Metrics {
  record: string;
  points: number;
  pointsPct: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifferential: number;
  shotsFor: number;
  shotsAgainst: number;
  shotDifferential: number;
  powerPlayPct: number;
  penaltyKillPct: number;
  faceoffWinPct: number;
  corsiFor: number;
  expectedGoalsFor: number;
  highDangerChancesFor: number;
  shootingPct: number;
  savePct: number;
  pdo: number;
  homeRecord: string;
  roadRecord: string;
}

interface TrendData {
  metric: string;
  current: number;
  previous: number;
  trend: "up" | "down" | "stable";
  isGood: boolean;
}

interface AdvancedL10MetricsProps {
  teamId: string;
  teamAbbrev: string;
  seasonId: string;
}

export function AdvancedL10Metrics({
  teamId,
  teamAbbrev,
  seasonId
}: AdvancedL10MetricsProps) {
  const [l10Metrics, setL10Metrics] = useState<L10Metrics | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<
    "overview" | "trends" | "comparison"
  >("overview");

  useEffect(() => {
    const fetchL10Metrics = async () => {
      try {
        setLoading(true);

        // Fetch standings details for L10 record
        const { data: standingsData, error: standingsError } = await supabase
          .from("nhl_standings_details")
          .select(
            `
            l10_wins,
            l10_losses,
            l10_ot_losses,
            l10_goals_for,
            l10_goals_against,
            l10_goal_differential,
            home_wins,
            home_losses,
            home_ot_losses,
            road_wins,
            road_losses,
            road_ot_losses
          `
          )
          .eq("team_abbrev", teamAbbrev)
          .eq("season_id", parseInt(seasonId))
          .order("date", { ascending: false })
          .limit(1);

        if (standingsError) throw standingsError;

        // Fetch recent WGO team stats for detailed metrics
        const { data: wgoData, error: wgoError } = await supabase
          .from("wgo_team_stats")
          .select(
            `
            date,
            shots_for_per_game,
            shots_against_per_game,
            power_play_pct,
            penalty_kill_pct,
            faceoff_win_pct,
            games_played
          `
          )
          .eq("team_id", parseInt(teamId))
          .eq("season_id", parseInt(seasonId))
          .order("date", { ascending: false })
          .limit(15); // Get extra for trend calculation

        if (wgoError) throw wgoError;

        // Fetch recent advanced stats
        const { data: advancedData, error: advancedError } = await supabase
          .from("nst_team_5v5")
          .select(
            `
            date,
            cf_pct,
            xgf_pct,
            hdcf_pct,
            sh_pct,
            sv_pct,
            pdo,
            gp
          `
          )
          .eq("team_abbreviation", teamAbbrev)
          .order("date", { ascending: false })
          .limit(15);

        if (advancedError) throw advancedError;

        if (standingsData?.[0] && wgoData && advancedData) {
          const standings = standingsData[0];

          // Calculate L10 averages from recent games
          const l10Games = wgoData.slice(0, 10);
          const l5Games = wgoData.slice(0, 5);

          let totalShotsFor = 0;
          let totalShotsAgainst = 0;
          let totalPowerPlay = 0;
          let totalPenaltyKill = 0;
          let totalFaceoff = 0;
          let validGames = 0;

          l10Games.forEach((game) => {
            if (game.games_played && game.games_played > 0) {
              totalShotsFor += game.shots_for_per_game || 0;
              totalShotsAgainst += game.shots_against_per_game || 0;
              totalPowerPlay += game.power_play_pct || 0;
              totalPenaltyKill += game.penalty_kill_pct || 0;
              totalFaceoff += game.faceoff_win_pct || 0;
              validGames++;
            }
          });

          // Calculate advanced metrics averages
          const l10Advanced = advancedData.slice(0, 10);
          let totalCorsi = 0;
          let totalXG = 0;
          let totalHDCF = 0;
          let totalShPct = 0;
          let totalSvPct = 0;
          let totalPDO = 0;
          let validAdvanced = 0;

          l10Advanced.forEach((game) => {
            if (game.gp && game.gp > 0) {
              totalCorsi += game.cf_pct || 0;
              totalXG += game.xgf_pct || 0;
              totalHDCF += game.hdcf_pct || 0;
              totalShPct += game.sh_pct || 0;
              totalSvPct += game.sv_pct || 0;
              totalPDO += game.pdo || 0;
              validAdvanced++;
            }
          });

          const l10Points =
            (standings.l10_wins || 0) * 2 + (standings.l10_ot_losses || 0);
          const l10GamesPlayed =
            (standings.l10_wins || 0) +
            (standings.l10_losses || 0) +
            (standings.l10_ot_losses || 0);

          const metrics: L10Metrics = {
            record: `${standings.l10_wins || 0}-${standings.l10_losses || 0}-${standings.l10_ot_losses || 0}`,
            points: l10Points,
            pointsPct:
              l10GamesPlayed > 0 ? l10Points / (l10GamesPlayed * 2) : 0,
            goalsFor: standings.l10_goals_for || 0,
            goalsAgainst: standings.l10_goals_against || 0,
            goalDifferential: standings.l10_goal_differential || 0,
            shotsFor: validGames > 0 ? totalShotsFor / validGames : 0,
            shotsAgainst: validGames > 0 ? totalShotsAgainst / validGames : 0,
            shotDifferential:
              validGames > 0
                ? (totalShotsFor - totalShotsAgainst) / validGames
                : 0,
            powerPlayPct: validGames > 0 ? totalPowerPlay / validGames : 0,
            penaltyKillPct: validGames > 0 ? totalPenaltyKill / validGames : 0,
            faceoffWinPct: validGames > 0 ? totalFaceoff / validGames : 0,
            corsiFor: validAdvanced > 0 ? totalCorsi / validAdvanced : 0,
            expectedGoalsFor: validAdvanced > 0 ? totalXG / validAdvanced : 0,
            highDangerChancesFor:
              validAdvanced > 0 ? totalHDCF / validAdvanced : 0,
            shootingPct: validAdvanced > 0 ? totalShPct / validAdvanced : 0,
            savePct: validAdvanced > 0 ? totalSvPct / validAdvanced : 0,
            pdo: validAdvanced > 0 ? totalPDO / validAdvanced : 0,
            homeRecord: `${standings.home_wins || 0}-${standings.home_losses || 0}-${standings.home_ot_losses || 0}`,
            roadRecord: `${standings.road_wins || 0}-${standings.road_losses || 0}-${standings.road_ot_losses || 0}`
          };

          setL10Metrics(metrics);

          // Calculate trend data (L5 vs L10)
          if (l5Games.length >= 5) {
            let l5ShotsFor = 0,
              l5PowerPlay = 0,
              l5PenaltyKill = 0,
              l5Faceoff = 0;
            let l5Advanced = advancedData.slice(0, 5);
            let l5Corsi = 0,
              l5XG = 0,
              l5ShPct = 0,
              l5SvPct = 0;

            l5Games.forEach((game) => {
              if (game.games_played && game.games_played > 0) {
                l5ShotsFor += game.shots_for_per_game || 0;
                l5PowerPlay += game.power_play_pct || 0;
                l5PenaltyKill += game.penalty_kill_pct || 0;
                l5Faceoff += game.faceoff_win_pct || 0;
              }
            });

            l5Advanced.forEach((game) => {
              if (game.gp && game.gp > 0) {
                l5Corsi += game.cf_pct || 0;
                l5XG += game.xgf_pct || 0;
                l5ShPct += game.sh_pct || 0;
                l5SvPct += game.sv_pct || 0;
              }
            });

            const trends: TrendData[] = [
              {
                metric: "Shots For/Game",
                current: l5ShotsFor / 5,
                previous: metrics.shotsFor,
                trend:
                  l5ShotsFor / 5 > metrics.shotsFor
                    ? "up"
                    : l5ShotsFor / 5 < metrics.shotsFor
                      ? "down"
                      : "stable",
                isGood: true
              },
              {
                metric: "Power Play %",
                current: (l5PowerPlay / 5) * 100,
                previous: metrics.powerPlayPct * 100,
                trend:
                  l5PowerPlay / 5 > metrics.powerPlayPct
                    ? "up"
                    : l5PowerPlay / 5 < metrics.powerPlayPct
                      ? "down"
                      : "stable",
                isGood: true
              },
              {
                metric: "Penalty Kill %",
                current: (l5PenaltyKill / 5) * 100,
                previous: metrics.penaltyKillPct * 100,
                trend:
                  l5PenaltyKill / 5 > metrics.penaltyKillPct
                    ? "up"
                    : l5PenaltyKill / 5 < metrics.penaltyKillPct
                      ? "down"
                      : "stable",
                isGood: true
              },
              {
                metric: "Corsi For %",
                current: (l5Corsi / 5) * 100,
                previous: metrics.corsiFor * 100,
                trend:
                  l5Corsi / 5 > metrics.corsiFor
                    ? "up"
                    : l5Corsi / 5 < metrics.corsiFor
                      ? "down"
                      : "stable",
                isGood: true
              }
            ];

            setTrendData(trends);
          }
        }
      } catch (error) {
        console.error("Error fetching L10 metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    if (teamId && teamAbbrev && seasonId) {
      fetchL10Metrics();
    }
  }, [teamId, teamAbbrev, seasonId]);

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatDecimal = (value: number, decimals: number = 1) => {
    return value.toFixed(decimals);
  };

  const getValueClass = (
    value: number,
    thresholds: { good: number; poor: number },
    higherIsBetter: boolean = true
  ) => {
    if (higherIsBetter) {
      if (value >= thresholds.good) return styles.excellent;
      if (value <= thresholds.poor) return styles.poor;
      return styles.average;
    } else {
      if (value <= thresholds.good) return styles.excellent;
      if (value >= thresholds.poor) return styles.poor;
      return styles.average;
    }
  };

  const getTrendIcon = (trend: "up" | "down" | "stable", isGood: boolean) => {
    if (trend === "stable") return "→";
    if (trend === "up") return isGood ? "↗️" : "↘️";
    return isGood ? "↘️" : "↗️";
  };

  const getTrendClass = (trend: "up" | "down" | "stable", isGood: boolean) => {
    if (trend === "stable") return styles.stable;
    if ((trend === "up" && isGood) || (trend === "down" && !isGood))
      return styles.positive;
    return styles.negative;
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <span>Loading L10 metrics...</span>
      </div>
    );
  }

  if (!l10Metrics) {
    return <div className={styles.noData}>No L10 metrics available</div>;
  }

  return (
    <div className={styles.metrics}>
      {selectedView === "overview" && (
        <div className={styles.overviewGrid}>
          <div className={styles.metricGroup}>
            <h5>Record & Points</h5>
            <div className={styles.metricData}>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Record</span>
                <span className={styles.metricValue}>{l10Metrics.record}</span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Points</span>
                <span className={styles.metricValue}>
                  {l10Metrics.points}/20
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Point %</span>
                <span
                  className={`${styles.metricValue} ${getValueClass(l10Metrics.pointsPct, { good: 0.6, poor: 0.4 })}`}
                >
                  {formatPercentage(l10Metrics.pointsPct)}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.metricGroup}>
            <h5>Goal Scoring</h5>
            <div className={styles.metricData}>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Goals For</span>
                <span className={styles.metricValue}>
                  {l10Metrics.goalsFor}
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Goals Against</span>
                <span className={styles.metricValue}>
                  {l10Metrics.goalsAgainst}
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Goal Diff</span>
                <span
                  className={`${styles.metricValue} ${l10Metrics.goalDifferential >= 0 ? styles.positive : styles.negative}`}
                >
                  {l10Metrics.goalDifferential >= 0 ? "+" : ""}
                  {l10Metrics.goalDifferential}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.metricGroup}>
            <h5>Shot Metrics</h5>
            <div className={styles.metricData}>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Shots For/GP</span>
                <span className={styles.metricValue}>
                  {formatDecimal(l10Metrics.shotsFor)}
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Shots Against/GP</span>
                <span className={styles.metricValue}>
                  {formatDecimal(l10Metrics.shotsAgainst)}
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Shot Diff/GP</span>
                <span
                  className={`${styles.metricValue} ${l10Metrics.shotDifferential >= 0 ? styles.positive : styles.negative}`}
                >
                  {l10Metrics.shotDifferential >= 0 ? "+" : ""}
                  {formatDecimal(l10Metrics.shotDifferential)}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.metricGroup}>
            <h5>Special Teams</h5>
            <div className={styles.metricData}>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Power Play</span>
                <span
                  className={`${styles.metricValue} ${getValueClass(l10Metrics.powerPlayPct, { good: 0.22, poor: 0.18 })}`}
                >
                  {formatPercentage(l10Metrics.powerPlayPct)}
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Penalty Kill</span>
                <span
                  className={`${styles.metricValue} ${getValueClass(l10Metrics.penaltyKillPct, { good: 0.82, poor: 0.78 })}`}
                >
                  {formatPercentage(l10Metrics.penaltyKillPct)}
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Faceoffs</span>
                <span
                  className={`${styles.metricValue} ${getValueClass(l10Metrics.faceoffWinPct, { good: 0.52, poor: 0.48 })}`}
                >
                  {formatPercentage(l10Metrics.faceoffWinPct)}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.metricGroup}>
            <h5>Advanced Stats</h5>
            <div className={styles.metricData}>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Corsi For %</span>
                <span
                  className={`${styles.metricValue} ${getValueClass(l10Metrics.corsiFor, { good: 0.52, poor: 0.48 })}`}
                >
                  {formatPercentage(l10Metrics.corsiFor)}
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>xG For %</span>
                <span
                  className={`${styles.metricValue} ${getValueClass(l10Metrics.expectedGoalsFor, { good: 0.52, poor: 0.48 })}`}
                >
                  {formatPercentage(l10Metrics.expectedGoalsFor)}
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>PDO</span>
                <span
                  className={`${styles.metricValue} ${getValueClass(l10Metrics.pdo, { good: 1.01, poor: 0.99 })}`}
                >
                  {formatDecimal(l10Metrics.pdo, 3)}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.metricGroup}>
            <h5>Home vs Road</h5>
            <div className={styles.metricData}>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Home Record</span>
                <span className={styles.metricValue}>
                  {l10Metrics.homeRecord}
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Road Record</span>
                <span className={styles.metricValue}>
                  {l10Metrics.roadRecord}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedView === "trends" && (
        <div className={styles.trendsGrid}>
          <div className={styles.trendsHeader}>
            <h5>Recent Trends (L5 vs L10)</h5>
            <span className={styles.trendsSubtitle}>
              L5 compared to L10 average
            </span>
          </div>

          {trendData.map((trend, index) => (
            <div key={index} className={styles.trendItem}>
              <div className={styles.trendMetric}>
                <span className={styles.trendLabel}>{trend.metric}</span>
                <span
                  className={`${styles.trendIcon} ${getTrendClass(trend.trend, trend.isGood)}`}
                >
                  {getTrendIcon(trend.trend, trend.isGood)}
                </span>
              </div>
              <div className={styles.trendValues}>
                <div className={styles.trendValue}>
                  <span className={styles.trendPeriod}>L5:</span>
                  <span className={styles.trendNumber}>
                    {trend.metric.includes("%")
                      ? formatDecimal(trend.current, 1) + "%"
                      : formatDecimal(trend.current, 1)}
                  </span>
                </div>
                <div className={styles.trendValue}>
                  <span className={styles.trendPeriod}>L10:</span>
                  <span className={styles.trendNumber}>
                    {trend.metric.includes("%")
                      ? formatDecimal(trend.previous, 1) + "%"
                      : formatDecimal(trend.previous, 1)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
