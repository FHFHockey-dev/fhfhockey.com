import React, { useState, useEffect } from "react";
import supabase from "lib/supabase";
import { seasonDateWindow } from "components/PlayerStats/playerStatsContract";
import {
  aggregateNstTeamCounts,
  aggregateWgoTeamGames,
  formatFractionPercent,
  type WgoTeamGameRow
} from "lib/stats/percentUnits";
import styles from "./AdvancedL10Metrics.module.scss";

// All shares and percentages below are fractions (0-1), built as ratios of
// summed counts from one-game-per-date rows; null means unavailable.
interface L10Metrics {
  record: string;
  points: number;
  pointsPct: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifferential: number;
  shotsFor: number | null;
  shotsAgainst: number | null;
  shotDifferential: number | null;
  powerPlayPct: number | null;
  penaltyKillPct: number | null;
  faceoffWinPct: number | null;
  corsiFor: number | null;
  expectedGoalsFor: number | null;
  highDangerChancesFor: number | null;
  shootingPct: number | null;
  savePct: number | null;
  pdo: number | null;
  homeRecord: string;
  roadRecord: string;
  teamGames: number | null;
  teamThroughDate: string | null;
  advancedGames: number | null;
  advancedThroughDate: string | null;
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
  regularSeasonStartDate?: string | null;
  regularSeasonEndDate?: string | null;
}

const compareTrend = (
  metric: string,
  current: number | null,
  previous: number | null,
  scale: number
): TrendData | null => {
  if (current === null || previous === null) return null;
  return {
    metric,
    current: current * scale,
    previous: previous * scale,
    trend: current > previous ? "up" : current < previous ? "down" : "stable",
    isGood: true
  };
};

export function AdvancedL10Metrics({
  teamId,
  teamAbbrev,
  seasonId,
  regularSeasonStartDate,
  regularSeasonEndDate
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

        // Regular-season dates when known; otherwise the season id's window.
        const window = seasonDateWindow(
          seasonId,
          regularSeasonStartDate && regularSeasonEndDate
            ? { startDate: regularSeasonStartDate, endDate: regularSeasonEndDate }
            : null
        );
        if (!window) throw new Error(`Invalid season id: ${seasonId}`);

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

        // Last ten WGO team game rows (one game date per row)
        const { data: wgoData, error: wgoError } = await supabase
          .from("wgo_team_stats")
          .select(
            `
            date,
            games_played,
            shots_for_per_game,
            shots_against_per_game,
            power_play_goals_for,
            pp_opportunities,
            pp_goals_against,
            times_shorthanded,
            faceoffs_won,
            faceoffs_lost
          `
          )
          .eq("team_id", parseInt(teamId))
          .eq("season_id", parseInt(seasonId))
          .gte("date", window.start)
          .lte("date", window.end)
          .or("games_played.neq.0,games_played.is.null")
          .order("date", { ascending: false })
          .limit(10);

        if (wgoError) throw wgoError;

        // Last ten NST 5v5 rows (regular season, one date per row, counts)
        const { data: advancedData, error: advancedError } = await supabase
          .from("nst_team_5v5")
          .select(
            `
            date,
            gp,
            cf,
            ca,
            xgf,
            xga,
            hdcf,
            hdca,
            gf,
            ga,
            sf,
            sa
          `
          )
          .eq("team_abbreviation", teamAbbrev)
          .gte("date", window.start)
          .lte("date", window.end)
          .or("gp.neq.0,gp.is.null")
          .order("date", { ascending: false })
          .limit(10);

        if (advancedError) throw advancedError;

        if (standingsData?.[0]) {
          const standings = standingsData[0];
          const teamGames = (wgoData ?? []) as WgoTeamGameRow[];
          const advancedGames = advancedData ?? [];
          const l10Team = aggregateWgoTeamGames(teamGames);
          const l10Advanced = aggregateNstTeamCounts(advancedGames);

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
            shotsFor: l10Team.shotsFor,
            shotsAgainst: l10Team.shotsAgainst,
            shotDifferential: l10Team.shotDifferential,
            powerPlayPct: l10Team.powerPlayPct,
            penaltyKillPct: l10Team.penaltyKillPct,
            faceoffWinPct: l10Team.faceoffWinPct,
            corsiFor: l10Advanced.cfPct,
            expectedGoalsFor: l10Advanced.xgfPct,
            highDangerChancesFor: l10Advanced.hdcfPct,
            shootingPct: l10Advanced.shootingPct,
            savePct: l10Advanced.savePct,
            pdo: l10Advanced.pdo,
            homeRecord: `${standings.home_wins || 0}-${standings.home_losses || 0}-${standings.home_ot_losses || 0}`,
            roadRecord: `${standings.road_wins || 0}-${standings.road_losses || 0}-${standings.road_ot_losses || 0}`,
            teamGames: l10Team.games,
            teamThroughDate: teamGames[0]?.date ?? null,
            advancedGames: l10Advanced.games,
            advancedThroughDate: advancedGames[0]?.date ?? null
          };

          setL10Metrics(metrics);

          // L5 vs L10, from the same rows and the same ratio-of-sums contract
          const l5Team = aggregateWgoTeamGames(teamGames.slice(0, 5));
          const l5Advanced = aggregateNstTeamCounts(advancedGames.slice(0, 5));
          const trends = [
            l5Team.games !== null && l5Team.games >= 5
              ? compareTrend("Shots For/Game", l5Team.shotsFor, l10Team.shotsFor, 1)
              : null,
            l5Team.games !== null && l5Team.games >= 5
              ? compareTrend("Power Play %", l5Team.powerPlayPct, l10Team.powerPlayPct, 100)
              : null,
            l5Team.games !== null && l5Team.games >= 5
              ? compareTrend("Penalty Kill %", l5Team.penaltyKillPct, l10Team.penaltyKillPct, 100)
              : null,
            l5Advanced.games !== null && l5Advanced.games >= 5
              ? compareTrend("Corsi For %", l5Advanced.cfPct, l10Advanced.cfPct, 100)
              : null
          ].filter((trend): trend is TrendData => trend !== null);

          setTrendData(trends);
        } else {
          setL10Metrics(null);
          setTrendData([]);
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
  }, [teamId, teamAbbrev, seasonId, regularSeasonStartDate, regularSeasonEndDate]);

  const formatPercentage = (value: number | null) =>
    formatFractionPercent(value);

  const formatDecimal = (value: number | null, decimals: number = 1) =>
    value === null ? "—" : value.toFixed(decimals);

  const formatSigned = (value: number | null, decimals: number = 1) =>
    value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}`;

  // Thresholds use the same fraction unit as the displayed value.
  const getValueClass = (
    value: number | null,
    thresholds: { good: number; poor: number },
    higherIsBetter: boolean = true
  ) => {
    if (value === null) return "";
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

  const sampleNote = (games: number | null, throughDate: string | null) =>
    games === null
      ? "Incomplete game sample"
      : games > 0
      ? `Last ${games} game${games === 1 ? "" : "s"} through ${throughDate}`
      : "No games in sample";

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
            <p className={styles.sampleNote}>
              {sampleNote(l10Metrics.teamGames, l10Metrics.teamThroughDate)}
            </p>
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
                  className={`${styles.metricValue} ${l10Metrics.shotDifferential === null ? "" : l10Metrics.shotDifferential >= 0 ? styles.positive : styles.negative}`}
                >
                  {formatSigned(l10Metrics.shotDifferential)}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.metricGroup}>
            <h5>Special Teams</h5>
            <p className={styles.sampleNote}>
              {sampleNote(l10Metrics.teamGames, l10Metrics.teamThroughDate)}
            </p>
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
            <p className={styles.sampleNote}>
              5v5 ·{" "}
              {sampleNote(l10Metrics.advancedGames, l10Metrics.advancedThroughDate)}
            </p>
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
