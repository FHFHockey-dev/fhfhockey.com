import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";
import supabase from "lib/supabase";
import { teamsInfo } from "lib/teamsInfo";
import styles from "./GameStateAnalysis.module.scss";

interface GameStateAnalysisProps {
  teamId: string;
  teamAbbrev: string;
  seasonId: string;
}

interface GameStateData {
  situation: string;
  corsi_for: number;
  corsi_against: number;
  corsi_pct: number;
  expected_goals_for: number;
  expected_goals_against: number;
  xgf_pct: number;
  goals_for: number;
  goals_against: number;
  shooting_pct: number;
  save_pct: number;
  pdo: number;
  time_on_ice_seconds: number;
  faceoff_win_pct?: number;
}

interface SituationalBreakdown {
  even_strength: GameStateData;
  power_play: GameStateData;
  penalty_kill: GameStateData;
  leading: GameStateData;
  trailing: GameStateData;
  tied: GameStateData;
  close_games: GameStateData;
  blowouts: GameStateData;
}

interface TimeSeriesData {
  date: string;
  cf_pct_5v5: number;
  xgf_pct_5v5: number;
  cf_pct_pp: number;
  cf_pct_pk: number;
  score_effects_adjusted: number;
}

export function GameStateAnalysis({
  teamId,
  teamAbbrev,
  seasonId
}: GameStateAnalysisProps) {
  const [scoreStateData, setScoreStateData] = useState<any>(null);
  const [powerPlayData, setPowerPlayData] = useState<any>(null);
  const [penaltyKillData, setPenaltyKillData] = useState<any>(null);
  const [situationalData, setSituationalData] =
    useState<SituationalBreakdown | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<
    "overview" | "trends" | "comparisons"
  >("overview");

  const teamInfo = teamsInfo[teamAbbrev];

  useEffect(() => {
    fetchGameStateData();
  }, [teamId, teamAbbrev, seasonId]);

  const fetchGameStateData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch the most recent game state data from wgo_team_stats
      const { data: gameStateData, error: gameStateError } = await supabase
        .from("wgo_team_stats")
        .select(
          `
          sat_pct_ahead, sat_pct_tied, sat_pct_behind, sat_pct_close,
          usat_pct_ahead, usat_pct_tied, usat_pct_behind, usat_pct_close,
          shooting_pct_5v5, save_pct_5v5,
          goals_for_percentage, date
        `
        )
        .eq("team_id", parseInt(teamId))
        .eq("season_id", parseInt(seasonId))
        .order("date", { ascending: false })
        .limit(1);

      if (gameStateError) throw gameStateError;

      // Fetch 5v5 data for even strength baseline
      const { data: evenStrengthData, error: evenStrengthError } =
        await supabase
          .from("nst_team_5v5")
          .select(
            `
          cf_pct, xgf_pct, gf, ga,
          sh_pct, sv_pct, cf, ca,
          xgf, xga, toi
        `
          )
          .eq("team_abbreviation", teamAbbrev)
          .order("date", { ascending: false })
          .limit(1);

      if (evenStrengthError) throw evenStrengthError;

      // Fetch power play data
      const { data: powerPlayData, error: powerPlayError } = await supabase
        .from("nst_team_pp")
        .select(
          `
          cf_pct, xgf_pct, gf, ga,
          sh_pct, sv_pct, cf, ca,
          xgf, xga, toi
        `
        )
        .eq("team_abbreviation", teamAbbrev)
        .order("date", { ascending: false })
        .limit(1);

      if (powerPlayError) throw powerPlayError;

      // Fetch penalty kill data
      const { data: penaltyKillData, error: penaltyKillError } = await supabase
        .from("nst_team_pk")
        .select(
          `
          cf_pct, xgf_pct, gf, ga,
          sh_pct, sv_pct, cf, ca,
          xgf, xga, toi
        `
        )
        .eq("team_abbreviation", teamAbbrev)
        .order("date", { ascending: false })
        .limit(1);

      if (penaltyKillError) throw penaltyKillError;

      // Process and set all the data
      if (gameStateData && gameStateData.length > 0) {
        const data = gameStateData[0];
        setScoreStateData({
          leading: {
            sat_pct: data.sat_pct_ahead,
            usat_pct: data.usat_pct_ahead,
            shooting_pct: data.shooting_pct_5v5,
            save_pct: data.save_pct_5v5
          },
          tied: {
            sat_pct: data.sat_pct_tied,
            usat_pct: data.usat_pct_tied,
            shooting_pct: data.shooting_pct_5v5,
            save_pct: data.save_pct_5v5
          },
          trailing: {
            sat_pct: data.sat_pct_behind,
            usat_pct: data.usat_pct_behind,
            shooting_pct: data.shooting_pct_5v5,
            save_pct: data.save_pct_5v5
          },
          close: {
            sat_pct: data.sat_pct_close,
            usat_pct: data.usat_pct_close,
            shooting_pct: data.shooting_pct_5v5,
            save_pct: data.save_pct_5v5
          }
        });

        // Build situational breakdown for the charts
        const situational: SituationalBreakdown = {
          even_strength: processSituationData(
            evenStrengthData?.[0],
            "Even Strength"
          ),
          power_play: processSituationData(powerPlayData?.[0], "Power Play"),
          penalty_kill: processSituationData(
            penaltyKillData?.[0],
            "Penalty Kill"
          ),
          leading: {
            situation: "Leading",
            corsi_for: 0,
            corsi_against: 0,
            corsi_pct: (data.sat_pct_ahead || 0) * 100,
            expected_goals_for: 0,
            expected_goals_against: 0,
            xgf_pct: (data.usat_pct_ahead || 0) * 100,
            goals_for: 0,
            goals_against: 0,
            shooting_pct: (data.shooting_pct_5v5 || 0) * 100,
            save_pct: (data.save_pct_5v5 || 0) * 100,
            pdo: (data.shooting_pct_5v5 || 0) + (data.save_pct_5v5 || 0),
            time_on_ice_seconds: 0
          },
          trailing: {
            situation: "Trailing",
            corsi_for: 0,
            corsi_against: 0,
            corsi_pct: (data.sat_pct_behind || 0) * 100,
            expected_goals_for: 0,
            expected_goals_against: 0,
            xgf_pct: (data.usat_pct_behind || 0) * 100,
            goals_for: 0,
            goals_against: 0,
            shooting_pct: (data.shooting_pct_5v5 || 0) * 100,
            save_pct: (data.save_pct_5v5 || 0) * 100,
            pdo: (data.shooting_pct_5v5 || 0) + (data.save_pct_5v5 || 0),
            time_on_ice_seconds: 0
          },
          tied: {
            situation: "Tied",
            corsi_for: 0,
            corsi_against: 0,
            corsi_pct: (data.sat_pct_tied || 0) * 100,
            expected_goals_for: 0,
            expected_goals_against: 0,
            xgf_pct: (data.usat_pct_tied || 0) * 100,
            goals_for: 0,
            goals_against: 0,
            shooting_pct: (data.shooting_pct_5v5 || 0) * 100,
            save_pct: (data.save_pct_5v5 || 0) * 100,
            pdo: (data.shooting_pct_5v5 || 0) + (data.save_pct_5v5 || 0),
            time_on_ice_seconds: 0
          },
          close_games: {
            situation: "Close Games",
            corsi_for: 0,
            corsi_against: 0,
            corsi_pct: (data.sat_pct_close || 0) * 100,
            expected_goals_for: 0,
            expected_goals_against: 0,
            xgf_pct: (data.usat_pct_close || 0) * 100,
            goals_for: 0,
            goals_against: 0,
            shooting_pct: (data.shooting_pct_5v5 || 0) * 100,
            save_pct: (data.save_pct_5v5 || 0) * 100,
            pdo: (data.shooting_pct_5v5 || 0) + (data.save_pct_5v5 || 0),
            time_on_ice_seconds: 0
          },
          blowouts: {
            situation: "Blowouts",
            corsi_for: 0,
            corsi_against: 0,
            corsi_pct: 50, // Default for now
            expected_goals_for: 0,
            expected_goals_against: 0,
            xgf_pct: 50, // Default for now
            goals_for: 0,
            goals_against: 0,
            shooting_pct: (data.shooting_pct_5v5 || 0) * 100,
            save_pct: (data.save_pct_5v5 || 0) * 100,
            pdo: (data.shooting_pct_5v5 || 0) + (data.save_pct_5v5 || 0),
            time_on_ice_seconds: 0
          }
        };

        setSituationalData(situational);
      }

      setPowerPlayData(powerPlayData?.[0] || null);
      setPenaltyKillData(penaltyKillData?.[0] || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching game state data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const processSituationData = (
    rawData: any,
    situation: string
  ): GameStateData => {
    if (!rawData) {
      return {
        situation,
        corsi_for: 0,
        corsi_against: 0,
        corsi_pct: 0,
        expected_goals_for: 0,
        expected_goals_against: 0,
        xgf_pct: 0,
        goals_for: 0,
        goals_against: 0,
        shooting_pct: 0,
        save_pct: 0,
        pdo: 0,
        time_on_ice_seconds: 0
      };
    }

    return {
      situation,
      corsi_for: rawData.corsi_for || 0,
      corsi_against: rawData.corsi_against || 0,
      corsi_pct: rawData.cf_pct || 0, // Already stored as percentage (52.0 for 52%)
      expected_goals_for: rawData.xgf || 0,
      expected_goals_against: rawData.xga || 0,
      xgf_pct: rawData.xgf_pct || 0, // Already stored as percentage (52.0 for 52%)
      goals_for: rawData.goals_for || 0,
      goals_against: rawData.goals_against || 0,
      shooting_pct:
        (rawData.shooting_pct_5v5 || rawData.shooting_pct || 0) * 100,
      save_pct: (rawData.save_pct_5v5 || rawData.save_pct || 0) * 100,
      pdo: rawData.pdo || 0,
      time_on_ice_seconds: rawData.toi_seconds || 0,
      faceoff_win_pct: rawData.faceoff_win_pct
        ? rawData.faceoff_win_pct * 100
        : undefined
    };
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getPerformanceColor = (
    value: number,
    threshold: { good: number; poor: number }
  ) => {
    if (value >= threshold.good) return styles.excellent;
    if (value <= threshold.poor) return styles.poor;
    return styles.average;
  };

  const renderOverviewTab = () => {
    if (!situationalData) return null;

    const chartData = [
      {
        name: "5v5",
        cf_pct: situationalData.even_strength.corsi_pct,
        xgf_pct: situationalData.even_strength.xgf_pct
      },
      {
        name: "PP",
        cf_pct: situationalData.power_play.corsi_pct,
        xgf_pct: situationalData.power_play.xgf_pct
      },
      {
        name: "PK",
        cf_pct: situationalData.penalty_kill.corsi_pct,
        xgf_pct: situationalData.penalty_kill.xgf_pct
      }
    ];

    const scoreStateData = [
      {
        name: "Leading",
        cf_pct: situationalData.leading.corsi_pct,
        xgf_pct: situationalData.leading.xgf_pct
      },
      {
        name: "Tied",
        cf_pct: situationalData.tied.corsi_pct,
        xgf_pct: situationalData.tied.xgf_pct
      },
      {
        name: "Trailing",
        cf_pct: situationalData.trailing.corsi_pct,
        xgf_pct: situationalData.trailing.xgf_pct
      }
    ];

    return (
      <div className={styles.overviewContent}>
        <div className={styles.chartsGrid}>
          <div className={styles.chartCard}>
            <h4>Special Teams Performance</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="name" tick={{ fill: "#ccc" }} />
                <YAxis domain={[30, 70]} tick={{ fill: "#ccc" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "8px"
                  }}
                />
                <Legend />
                <Bar dataKey="cf_pct" fill="#07aae2" name="CF%" />
                <Bar dataKey="xgf_pct" fill="#00ff87" name="xGF%" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className={styles.chartCard}>
            <h4>Score State Performance</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scoreStateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="name" tick={{ fill: "#ccc" }} />
                <YAxis domain={[30, 70]} tick={{ fill: "#ccc" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "8px"
                  }}
                />
                <Legend />
                <Bar dataKey="cf_pct" fill="#07aae2" name="CF%" />
                <Bar dataKey="xgf_pct" fill="#00ff87" name="xGF%" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.situationCards}>
          {Object.entries(situationalData).map(([key, data]) => (
            <div key={key} className={styles.situationCard}>
              <div className={styles.situationHeader}>
                <h4>{data.situation}</h4>
                <span className={styles.toiDisplay}>
                  {formatTime(data.time_on_ice_seconds)}
                </span>
              </div>
              <div className={styles.situationStats}>
                <div className={styles.situationStat}>
                  <span
                    className={`${styles.statValue} ${getPerformanceColor(data.corsi_pct, { good: 52, poor: 48 })}`}
                  >
                    {data.corsi_pct.toFixed(1)}%
                  </span>
                  <span className={styles.statLabel}>CF%</span>
                </div>
                <div className={styles.situationStat}>
                  <span
                    className={`${styles.statValue} ${getPerformanceColor(data.xgf_pct, { good: 52, poor: 48 })}`}
                  >
                    {data.xgf_pct.toFixed(1)}%
                  </span>
                  <span className={styles.statLabel}>xGF%</span>
                </div>
                <div className={styles.situationStat}>
                  <span className={styles.statValue}>
                    {data.goals_for}-{data.goals_against}
                  </span>
                  <span className={styles.statLabel}>Goals</span>
                </div>
                <div className={styles.situationStat}>
                  <span className={styles.statValue}>
                    {data.pdo.toFixed(3)}
                  </span>
                  <span className={styles.statLabel}>PDO</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTrendsTab = () => {
    return (
      <div className={styles.trendsContent}>
        <div className={styles.chartCard}>
          <h4>Performance Trends Over Time</h4>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#ccc", fontSize: 12 }}
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric"
                  })
                }
              />
              <YAxis domain={[35, 65]} tick={{ fill: "#ccc" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: "8px"
                }}
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="cf_pct_5v5"
                stroke="#07aae2"
                name="5v5 CF%"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="xgf_pct_5v5"
                stroke="#00ff87"
                name="5v5 xGF%"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="cf_pct_pp"
                stroke="#ff9100"
                name="PP CF%"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="cf_pct_pk"
                stroke="#ff6b6b"
                name="PK CF%"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <span>Loading game state analysis...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h3>⚠️ Error Loading Analysis</h3>
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
        <h2>Game State Analysis</h2>
        <p>
          Comprehensive breakdown of team performance across different game
          situations
        </p>
      </div>

      <div className={styles.tabNavigation}>
        <button
          className={`${styles.tabButton} ${selectedView === "overview" ? styles.active : ""}`}
          onClick={() => setSelectedView("overview")}
        >
          Overview
        </button>
        <button
          className={`${styles.tabButton} ${selectedView === "trends" ? styles.active : ""}`}
          onClick={() => setSelectedView("trends")}
        >
          Trends
        </button>
        <button
          className={`${styles.tabButton} ${selectedView === "comparisons" ? styles.active : ""}`}
          onClick={() => setSelectedView("comparisons")}
        >
          League Comparison
        </button>
      </div>

      <div className={styles.tabContent}>
        {selectedView === "overview" && renderOverviewTab()}
        {selectedView === "trends" && renderTrendsTab()}
        {selectedView === "comparisons" && (
          <div className={styles.comingSoon}>
            <h4>League Comparisons Coming Soon</h4>
            <p>
              Compare team performance against league averages across different
              game states
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
