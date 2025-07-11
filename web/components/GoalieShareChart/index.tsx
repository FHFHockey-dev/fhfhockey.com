import React, { useEffect, useState, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from "chart.js";
import { teamsInfo } from "../../lib/teamsInfo";
import supabase from "../../lib/supabase";
import styles from "./GoalieShareChart.module.scss";

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, Title);

interface GoalieData {
  goalie_id: number;
  goalie_name: string;
  games_started: number;
  team_abbreviation: string;
  wins: number;
  losses: number;
  ot_losses: number;
  save_pct: number;
  goals_against_avg: number;
}

interface TeamGoalieStats {
  [teamAbbrev: string]: {
    goalies: GoalieData[];
    totalGames: number;
  };
}

type SpanType = "L10" | "L20" | "L30" | "Season";

const GoalieShareChart: React.FC = () => {
  const [selectedSpan, setSelectedSpan] = useState<SpanType>("Season");
  const [goalieStats, setGoalieStats] = useState<TeamGoalieStats>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTeam, setSelectedTeam] = useState<string>(() => {
    const sortedTeamAbbrevs = Object.keys(teamsInfo).sort();
    return sortedTeamAbbrevs[0];
  });
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [currentSeasonId, setCurrentSeasonId] = useState<number>(20242025);

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch current season from Supabase
  useEffect(() => {
    const fetchCurrentSeason = async () => {
      try {
        const { data, error } = await supabase
          .from("seasons")
          .select("id")
          .lte("startDate", new Date().toISOString())
          .order("startDate", { ascending: false })
          .limit(1)
          .single();

        if (error) {
          console.error("Error fetching current season:", error);
          return;
        }

        if (data) {
          setCurrentSeasonId(data.id);
          console.log("Current season ID:", data.id);
        }
      } catch (error) {
        console.error("Error in fetchCurrentSeason:", error);
      }
    };

    fetchCurrentSeason();
  }, []);

  // Calculate date range based on selected span
  const getDateRange = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    switch (selectedSpan) {
      case "L10":
        const l10Date = new Date(today);
        l10Date.setDate(today.getDate() - 10);
        return {
          startDate: l10Date.toISOString().split("T")[0],
          endDate: todayStr
        };
      case "L20":
        const l20Date = new Date(today);
        l20Date.setDate(today.getDate() - 20);
        return {
          startDate: l20Date.toISOString().split("T")[0],
          endDate: todayStr
        };
      case "L30":
        const l30Date = new Date(today);
        l30Date.setDate(today.getDate() - 30);
        return {
          startDate: l30Date.toISOString().split("T")[0],
          endDate: todayStr
        };
      case "Season":
      default:
        // For season, we'll filter by season_id in the query
        return null;
    }
  }, [selectedSpan]);

  useEffect(() => {
    if (currentSeasonId) {
      fetchAllGoalieData();
    }
  }, [selectedSpan, currentSeasonId]);

  const handleSpanButtonClick = (span: SpanType): void => {
    setSelectedSpan(span);
  };

  const fetchAllGoalieData = async (): Promise<void> => {
    setLoading(true);

    try {
      console.log(
        "Fetching goalie data for season:",
        currentSeasonId,
        "span:",
        selectedSpan
      );

      // Declare teamStats at function scope
      let teamStats: TeamGoalieStats = {};

      // Use different tables based on the selected span
      if (selectedSpan === "Season") {
        // Use wgo_goalie_stats_totals for season view - has correct team abbreviation
        let query = supabase
          .from("wgo_goalie_stats_totals")
          .select(
            `
            goalie_id,
            goalie_name,
            games_started,
            wins,
            losses,
            ot_losses,
            save_pct,
            goals_against_avg,
            current_team_abbreviation
          `
          )
          .eq("season_id", currentSeasonId)
          .gt("games_started", 0)
          .order("games_started", { ascending: false });

        const { data: goalieData, error } = await query;

        console.log("Season query result:", { data: goalieData, error });

        if (error) {
          console.error("Error fetching season goalie data:", error);
          setGoalieStats({});
          return;
        }

        if (!goalieData || goalieData.length === 0) {
          console.log("No season goalie data found");
          setGoalieStats({});
          return;
        }

        // Process season totals data
        goalieData.forEach((goalie: any) => {
          const teamAbbrev = goalie.current_team_abbreviation;

          console.log(
            `Processing season goalie: ${goalie.goalie_name}, Team: ${teamAbbrev}`
          );

          if (!teamAbbrev || !teamsInfo[teamAbbrev as keyof typeof teamsInfo]) {
            console.log(
              `Skipping goalie ${goalie.goalie_name} - invalid team: ${teamAbbrev}`
            );
            return;
          }

          if (!teamStats[teamAbbrev]) {
            teamStats[teamAbbrev] = {
              goalies: [],
              totalGames: 0
            };
          }

          teamStats[teamAbbrev].goalies.push({
            goalie_id: goalie.goalie_id,
            goalie_name: goalie.goalie_name,
            games_started: goalie.games_started || 0,
            team_abbreviation: teamAbbrev,
            wins: goalie.wins || 0,
            losses: goalie.losses || 0,
            ot_losses: goalie.ot_losses || 0,
            save_pct: goalie.save_pct || 0,
            goals_against_avg: goalie.goals_against_avg || 0
          });
        });

        // Calculate totals and sort for season data
        Object.keys(teamStats).forEach((teamAbbrev) => {
          const team = teamStats[teamAbbrev];
          team.totalGames = team.goalies.reduce(
            (sum, goalie) => sum + goalie.games_started,
            0
          );
          team.goalies.sort((a, b) => b.games_started - a.games_started);
          team.goalies = team.goalies.slice(0, 5);
        });

        setGoalieStats(teamStats);
      } else {
        // Use wgo_goalie_stats for L10/L20/L30 views with date filtering
        const dateRange = getDateRange;
        if (!dateRange) {
          console.log("No date range for recent span");
          setGoalieStats({});
          return;
        }

        let query = supabase
          .from("wgo_goalie_stats")
          .select(
            `
            goalie_id,
            goalie_name,
            games_started,
            wins,
            losses,
            ot_losses,
            save_pct,
            goals_against_avg,
            date,
            team_abbreviation
          `
          )
          .eq("season_id", currentSeasonId)
          .gt("games_started", 0)
          .gte("date", dateRange.startDate)
          .lte("date", dateRange.endDate)
          .order("date", { ascending: false });

        const { data: goalieData, error } = await query;

        console.log("Recent span query result:", { data: goalieData, error });

        if (error) {
          console.error("Error fetching recent goalie data:", error);
          setGoalieStats({});
          return;
        }

        if (!goalieData || goalieData.length === 0) {
          console.log("No recent goalie data found");
          setGoalieStats({});
          return;
        }

        // Get team mapping from wgo_goalie_stats_totals for recent data
        const { data: teamMappingData } = await supabase
          .from("wgo_goalie_stats_totals")
          .select("goalie_id, current_team_abbreviation")
          .eq("season_id", currentSeasonId);

        const teamMapping = new Map<number, string>();
        teamMappingData?.forEach((mapping: any) => {
          teamMapping.set(mapping.goalie_id, mapping.current_team_abbreviation);
        });

        // Process and aggregate recent data
        goalieData.forEach((goalie: any) => {
          // Use team mapping from totals table first, fallback to daily table
          const teamAbbrev =
            teamMapping.get(goalie.goalie_id) || goalie.team_abbreviation;

          console.log(
            `Processing recent goalie: ${goalie.goalie_name}, Team: ${teamAbbrev}`
          );

          if (!teamAbbrev || !teamsInfo[teamAbbrev as keyof typeof teamsInfo]) {
            console.log(
              `Skipping goalie ${goalie.goalie_name} - invalid team: ${teamAbbrev}`
            );
            return;
          }

          if (!teamStats[teamAbbrev]) {
            teamStats[teamAbbrev] = {
              goalies: [],
              totalGames: 0
            };
          }

          // Check if goalie already exists in team (aggregate multiple games)
          const existingGoalieIndex = teamStats[teamAbbrev].goalies.findIndex(
            (g) => g.goalie_id === goalie.goalie_id
          );

          if (existingGoalieIndex >= 0) {
            // Aggregate existing goalie stats
            const existing = teamStats[teamAbbrev].goalies[existingGoalieIndex];
            const prevGames = existing.games_started;
            const newGames = goalie.games_started || 0;
            const totalGames = prevGames + newGames;

            existing.games_started = totalGames;
            existing.wins += goalie.wins || 0;
            existing.losses += goalie.losses || 0;
            existing.ot_losses += goalie.ot_losses || 0;

            // Weighted averages for percentages
            if (totalGames > 0) {
              existing.save_pct =
                (existing.save_pct * prevGames +
                  (goalie.save_pct || 0) * newGames) /
                totalGames;
              existing.goals_against_avg =
                (existing.goals_against_avg * prevGames +
                  (goalie.goals_against_avg || 0) * newGames) /
                totalGames;
            }
          } else {
            // Add new goalie
            teamStats[teamAbbrev].goalies.push({
              goalie_id: goalie.goalie_id,
              goalie_name: goalie.goalie_name,
              games_started: goalie.games_started || 0,
              team_abbreviation: teamAbbrev,
              wins: goalie.wins || 0,
              losses: goalie.losses || 0,
              ot_losses: goalie.ot_losses || 0,
              save_pct: goalie.save_pct || 0,
              goals_against_avg: goalie.goals_against_avg || 0
            });
          }
        });

        // Calculate totals and sort for recent data
        Object.keys(teamStats).forEach((teamAbbrev) => {
          const team = teamStats[teamAbbrev];
          team.totalGames = team.goalies.reduce(
            (sum, goalie) => sum + goalie.games_started,
            0
          );
          team.goalies.sort((a, b) => b.games_started - a.games_started);
          team.goalies = team.goalies.slice(0, 5);
        });

        setGoalieStats(teamStats);
      }

      console.log("Final processed team stats:", teamStats);
    } catch (error) {
      console.error("Error in fetchAllGoalieData:", error);
      setGoalieStats({});
    } finally {
      setLoading(false);
    }
  };

  const generateChartData = (teamAbbrev: string) => {
    const teamStats = goalieStats[teamAbbrev];
    if (!teamStats || teamStats.goalies.length === 0) {
      return null;
    }

    const teamColors = teamsInfo[teamAbbrev as keyof typeof teamsInfo];
    const colors = teamColors
      ? [
          teamColors.primaryColor,
          teamColors.secondaryColor,
          teamColors.jersey,
          teamColors.accent,
          teamColors.alt
        ]
      : ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"];

    const goalies = teamStats.goalies;
    const totalGames = teamStats.totalGames;

    return {
      labels: goalies.map((goalie) => {
        const percentage =
          totalGames > 0
            ? ((goalie.games_started / totalGames) * 100).toFixed(1)
            : "0.0";
        const lastName = goalie.goalie_name
          ? goalie.goalie_name.split(" ").pop() || goalie.goalie_name
          : "Unknown";
        return `${lastName} (${percentage}%)`;
      }),
      datasets: [
        {
          data: goalies.map((goalie) => goalie.games_started),
          backgroundColor: goalies.map(
            (_, index) => colors[index % colors.length]
          ),
          borderColor: goalies.map((_, index) => colors[index % colors.length]),
          borderWidth: 2,
          hoverBorderWidth: 3
        }
      ]
    };
  };

  const generateChartOptions = (teamAbbrev: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "left" as const,
        labels: {
          boxWidth: 12,
          padding: 8,
          font: {
            size: 11,
            family: "'Roboto Condensed', sans-serif"
          },
          color: "#ffffff"
        }
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
        borderColor: "#ffffff",
        borderWidth: 1,
        callbacks: {
          label: function (context: any) {
            const teamStats = goalieStats[teamAbbrev];
            const goalie = teamStats?.goalies[context.dataIndex];
            if (goalie) {
              return [
                `${goalie.goalie_name}: ${context.parsed} starts`,
                `Save %: ${(goalie.save_pct * 100).toFixed(1)}%`,
                `GAA: ${goalie.goals_against_avg.toFixed(2)}`,
                `Record: ${goalie.wins}-${goalie.losses}-${goalie.ot_losses}`
              ];
            }
            return `${context.label}: ${context.parsed} starts`;
          }
        }
      }
    },
    cutout: "60%"
  });

  const renderTeamCharts = () => {
    const teams = Object.keys(goalieStats); // Show all teams with data

    return (
      <div className={styles.chartsGrid}>
        {teams.map((teamAbbrev) => {
          const chartData = generateChartData(teamAbbrev);
          if (!chartData) return null;

          return (
            <div key={teamAbbrev} className={styles.teamChartCard}>
              <h4 className={styles.teamName}>{teamAbbrev}</h4>
              <div className={styles.chartContainer}>
                <Doughnut
                  data={chartData}
                  options={generateChartOptions(teamAbbrev)}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={styles.goalieShareChart}>
      <div className={styles.buttonContainer}>
        <button
          className={`${styles.spanButton} ${selectedSpan === "L10" ? styles.active : ""}`}
          onClick={() => handleSpanButtonClick("L10")}
        >
          L10
        </button>
        <button
          className={`${styles.spanButton} ${selectedSpan === "L20" ? styles.active : ""}`}
          onClick={() => handleSpanButtonClick("L20")}
        >
          L20
        </button>
        <button
          className={`${styles.spanButton} ${selectedSpan === "L30" ? styles.active : ""}`}
          onClick={() => handleSpanButtonClick("L30")}
        >
          L30
        </button>
        <button
          className={`${styles.spanButton} ${selectedSpan === "Season" ? styles.active : ""}`}
          onClick={() => handleSpanButtonClick("Season")}
        >
          Season
        </button>
      </div>

      {loading ? (
        <div className={styles.loadingMessage}>Loading goalie data...</div>
      ) : (
        <>
          {Object.keys(goalieStats).length > 0 ? (
            renderTeamCharts()
          ) : (
            <div className={styles.noDataMessage}>
              No goalie data available for the selected timeframe.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GoalieShareChart;
