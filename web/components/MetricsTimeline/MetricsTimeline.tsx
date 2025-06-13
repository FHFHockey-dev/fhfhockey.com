import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import supabase from "lib/supabase";
import { teamsInfo } from "lib/teamsInfo";
import styles from "./MetricsTimeline.module.scss";

interface MetricsTimelineProps {
  teamId: string;
  teamAbbrev: string;
  seasonId?: string;
}

interface TeamMetric {
  season_id: number;
  games_played: number | null;
  wins: number | null;
  losses: number | null;
  ot_losses: number | null;
  points: number | null;
  point_pct: number | null;
  goals_for: number | null;
  goals_against: number | null;
  goals_for_per_game: number | null;
  goals_against_per_game: number | null;
  power_play_pct: number | null;
  penalty_kill_pct: number | null;
  shots_for_per_game: number | null;
  shots_against_per_game: number | null;
  faceoff_win_pct: number | null;
}

const MetricsTimeline: React.FC<MetricsTimelineProps> = ({
  teamId,
  teamAbbrev,
  seasonId
}) => {
  const [metrics, setMetrics] = useState<TeamMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] =
    useState<keyof TeamMetric>("point_pct");

  const teamInfo = teamsInfo[teamAbbrev];

  useEffect(() => {
    if (!teamId) return;

    setLoading(true);
    setError(null);

    const fetchMetrics = async () => {
      try {
        let query = supabase
          .from("team_summary_years")
          .select("*")
          .eq("team_id", parseInt(teamId))
          .order("season_id", { ascending: true });

        // Only filter by season if seasonId is provided
        if (seasonId) {
          query = query.eq("season_id", parseInt(seasonId));
        }

        const { data, error: fetchError } = await query;

        if (fetchError) {
          setError(fetchError.message);
        } else if (data) {
          setMetrics(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [teamId, seasonId]);

  const metricOptions = [
    { key: "point_pct" as keyof TeamMetric, label: "Points %" },
    { key: "goals_for_per_game" as keyof TeamMetric, label: "Goals For/Game" },
    {
      key: "goals_against_per_game" as keyof TeamMetric,
      label: "Goals Against/Game"
    },
    { key: "power_play_pct" as keyof TeamMetric, label: "Power Play %" },
    { key: "penalty_kill_pct" as keyof TeamMetric, label: "Penalty Kill %" },
    { key: "shots_for_per_game" as keyof TeamMetric, label: "Shots For/Game" },
    {
      key: "shots_against_per_game" as keyof TeamMetric,
      label: "Shots Against/Game"
    },
    { key: "faceoff_win_pct" as keyof TeamMetric, label: "Faceoff Win %" }
  ];

  const formatValue = (value: number, metric: keyof TeamMetric): string => {
    if (metric.includes("pct")) {
      return `${(value * 100).toFixed(1)}%`;
    }
    return value.toFixed(2);
  };

  const formatSeason = (seasonId: number): string => {
    const startYear = Math.floor(seasonId / 10000);
    const endYear = startYear + 1;
    return `${startYear}-${endYear.toString().slice(-2)}`;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Loading performance timeline...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h3>Error Loading Timeline</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h3>No Data Available</h3>
          <p>No performance data found for this team.</p>
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
        <h2>Performance Timeline</h2>
        <p>Track {teamAbbrev} performance metrics over time</p>
      </div>

      <div className={styles.controls}>
        <label htmlFor="metric-select">Select Metric:</label>
        <select
          id="metric-select"
          value={selectedMetric}
          onChange={(e) =>
            setSelectedMetric(e.target.value as keyof TeamMetric)
          }
          className={styles.metricSelect}
        >
          {metricOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.timeline}>
        <div className={styles.timelineHeader}>
          <h3>{metricOptions.find((m) => m.key === selectedMetric)?.label}</h3>
        </div>

        <div className={styles.timelineData}>
          {metrics.map((metric, index) => (
            <div key={metric.season_id} className={styles.timelineItem}>
              <div className={styles.season}>
                {formatSeason(metric.season_id)}
              </div>
              <div className={styles.value}>
                {metric[selectedMetric] !== null
                  ? formatValue(
                      metric[selectedMetric] as number,
                      selectedMetric
                    )
                  : "N/A"}
              </div>
              <div className={styles.games}>{metric.games_played || 0} GP</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MetricsTimeline;
