import React, { useEffect, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from "chart.js";
import { teamsInfo } from "../../lib/teamsInfo";
import fetchWithCache from "../../lib/fetchWithCache";
import Fetch from "../../lib/cors-fetch";
import styles from "./GoalieShareChart.module.scss";

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, Title);

interface GameData {
  gameId: number;
  gameDate: string;
}

interface TeamGameData {
  [teamAbbrev: string]: GameData[];
}

interface SeasonData {
  seasonId: number;
  startDate: string;
}

interface GoalieData {
  playerId: number;
  goalieFullName: string;
  gamesPlayed: number;
  timeOnIce: number;
  wins: number;
  losses: number;
  otLosses: number;
  savePct: number;
  goalsAgainstAverage: number;
}

interface TeamGoalieStats {
  [teamAbbrev: string]: {
    goalies: GoalieData[];
    totalGames: number;
  };
}

type SpanType = "L10" | "L20" | "L30" | "Season";

const GoalieShareChart: React.FC = () => {
  const [seasonData, setSeasonData] = useState<SeasonData | null>(null);
  const [teamGameData, setTeamGameData] = useState<TeamGameData>({});
  const [selectedSpan, setSelectedSpan] = useState<SpanType>("Season");
  const [goalieStats, setGoalieStats] = useState<TeamGoalieStats>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTeam, setSelectedTeam] = useState<string>(() => {
    // Default to first team alphabetically
    const sortedTeamAbbrevs = Object.keys(teamsInfo).sort();
    return sortedTeamAbbrevs[0];
  });
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const fetchSeasonData = async () => {
      try {
        const response = await Fetch(
          'https://api.nhle.com/stats/rest/en/season?sort=[{"property":"id","direction":"DESC"}]'
        ).then((res) => res.json());

        const firstSeason = response.data[0];
        const seasonId = firstSeason.id;
        const startDate = firstSeason.startDate.split("T")[0];

        await fetchGameDatesForAllTeams(seasonId);
        setSeasonData({ seasonId, startDate });
      } catch (error) {
        console.error("Error fetching season data:", error);
      }
    };

    fetchSeasonData();
  }, []);

  useEffect(() => {
    if (Object.keys(teamGameData).length > 0) {
      fetchAllGoalieData();
    }
  }, [selectedSpan, teamGameData]);

  const fetchGameDatesForAllTeams = async (seasonId: number): Promise<void> => {
    const gameData: TeamGameData = {};
    const fetchPromises = Object.keys(teamsInfo).map(async (teamAbbrev) => {
      const url = `https://api-web.nhle.com/v1/club-schedule-season/${teamAbbrev}/${seasonId}`;
      try {
        const response = await Fetch(url).then((res) => res.json());
        gameData[teamAbbrev] = response.games
          .filter((game: any) => game.gameType === 2)
          .map((game: any) => ({
            gameId: game.id,
            gameDate: game.gameDate.split("T")[0]
          }));
      } catch (error) {
        console.error(`Failed to fetch games for ${teamAbbrev}:`, error);
      }
    });

    await Promise.all(fetchPromises);
    setTeamGameData(gameData);
  };

  const calculateGameSpan = (
    teamGames: GameData[]
  ): { startDate: string; endDate: string } => {
    const today = new Date().toISOString().split("T")[0];
    const gameCount = teamGames.length;
    let startDate: string;
    let endDate: string;

    switch (selectedSpan) {
      case "L10":
        startDate = teamGames[Math.max(gameCount - 10, 0)].gameDate;
        break;
      case "L20":
        startDate = teamGames[Math.max(gameCount - 20, 0)].gameDate;
        break;
      case "L30":
        startDate = teamGames[Math.max(gameCount - 30, 0)].gameDate;
        break;
      case "Season":
      default:
        startDate = teamGames[0]?.gameDate || "";
        break;
    }

    let endIndex = gameCount - 1;
    while (endIndex >= 0) {
      if (teamGames[endIndex].gameDate <= today) {
        break;
      }
      endIndex--;
    }

    endIndex = Math.min(endIndex, gameCount - 1);
    endDate = teamGames[endIndex]?.gameDate || "";
    return { startDate, endDate };
  };

  const handleSpanButtonClick = (span: SpanType): void => {
    setSelectedSpan(span);
  };

  const fetchAllGoalieData = async (): Promise<void> => {
    setLoading(true);
    const allGoalieStats: TeamGoalieStats = {};

    const fetchPromises = Object.keys(teamGameData).map(async (teamAbbrev) => {
      const teamGames = teamGameData[teamAbbrev];
      const { startDate, endDate } = calculateGameSpan(teamGames);
      const franchiseId =
        teamsInfo[teamAbbrev as keyof typeof teamsInfo]?.franchiseId;

      if (franchiseId) {
        try {
          const goalieData = await fetchGoalieData(
            franchiseId,
            startDate,
            endDate
          );
          if (goalieData && goalieData.length > 0) {
            const totalGames = goalieData.reduce(
              (sum, goalie) => sum + goalie.gamesPlayed,
              0
            );
            allGoalieStats[teamAbbrev] = {
              goalies: goalieData,
              totalGames
            };
          }
        } catch (error) {
          console.error(`Error fetching goalie data for ${teamAbbrev}:`, error);
        }
      }
    });

    await Promise.all(fetchPromises);
    setGoalieStats(allGoalieStats);
    setLoading(false);
  };

  const fetchGoalieData = async (
    franchiseId: number,
    startDate: string,
    endDate: string
  ): Promise<GoalieData[]> => {
    const url = `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=true&isGame=true&start=0&limit=50&factCayenneExp=gamesPlayed>=1&cayenneExp=franchiseId=${franchiseId} and gameDate<='${endDate}' and gameDate>='${startDate}' and gameTypeId=2`;

    try {
      const response = await Fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error(
        `Error fetching goalie data for franchiseId ${franchiseId}:`,
        error
      );
      return [];
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

    const goalies = teamStats.goalies.slice(0, 5); // Limit to top 5 goalies
    const totalGames = teamStats.totalGames;

    return {
      labels: goalies.map((goalie) => {
        const percentage =
          totalGames > 0
            ? ((goalie.gamesPlayed / totalGames) * 100).toFixed(1)
            : "0.0";
        // Safe handling of goalie names
        const lastName = goalie.goalieFullName
          ? goalie.goalieFullName.split(" ").pop() || goalie.goalieFullName
          : "Unknown";
        return `${lastName} (${percentage}%)`;
      }),
      datasets: [
        {
          data: goalies.map((goalie) => goalie.gamesPlayed),
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
            size: 14,
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
              const goalieDisplayName =
                goalie.goalieFullName || "Unknown Goalie";
              return [
                `${goalieDisplayName}: ${context.parsed} games`,
                `Save %: ${(goalie.savePct * 100).toFixed(1)}%`,
                `GAA: ${goalie.goalsAgainstAverage.toFixed(2)}`
              ];
            }
            return `${context.label}: ${context.parsed} games`;
          }
        }
      }
    },
    cutout: "60%"
  });

  const renderTeamCharts = () => {
    const teams = Object.keys(goalieStats);

    // For mobile, show only selected team
    if (isMobile) {
      const teamsToShow = teams.filter((team) => team === selectedTeam);
      if (teamsToShow.length === 0) return null;

      return (
        <div className={styles.chartsGrid}>
          <table className={styles.chartsTable}>
            <tbody>
              <tr>
                {teamsToShow.map((teamAbbrev) => {
                  const chartData = generateChartData(teamAbbrev);
                  if (!chartData) return <td key={teamAbbrev}></td>;

                  const teamInfo =
                    teamsInfo[teamAbbrev as keyof typeof teamsInfo];
                  const teamStats = goalieStats[teamAbbrev];
                  const totalGames = teamStats?.totalGames || 0;

                  return (
                    <td key={teamAbbrev}>
                      <div
                        className={styles.teamChartCard}
                        style={
                          {
                            "--team-primary":
                              teamInfo?.primaryColor || "#14a2d2",
                            "--team-secondary":
                              teamInfo?.secondaryColor || "#07aae2",
                            "--team-jersey": teamInfo?.jersey || "#ffcc00",
                            "--team-accent": teamInfo?.accent || "#ff6384",
                            "--team-alt": teamInfo?.alt || "#4bc0c0"
                          } as React.CSSProperties
                        }
                      >
                        <div className={styles.teamHeader}>
                          <div className={styles.logoAndInfo}>
                            <img
                              className={styles.teamLogo}
                              src={`/teamLogos/${teamAbbrev}.png`}
                              alt={`${teamAbbrev} logo`}
                            />
                            <h4 className={styles.teamName}>
                              {teamInfo?.shortName || teamAbbrev}
                            </h4>
                            <div className={styles.teamStats}>
                              <span className={styles.statsLabel}>GP:</span>
                              <span className={styles.statsValue}>
                                {totalGames}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className={styles.chartContainer}>
                          <Doughnut
                            data={chartData}
                            options={generateChartOptions(teamAbbrev)}
                          />
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    // Desktop view - show all teams in 4-column grid
    const teamsPerRow = 4;
    const rows = [];

    for (let i = 0; i < teams.length; i += teamsPerRow) {
      rows.push(teams.slice(i, i + teamsPerRow));
    }

    return (
      <div className={styles.chartsGrid}>
        <table className={styles.chartsTable}>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((teamAbbrev) => {
                  const chartData = generateChartData(teamAbbrev);
                  if (!chartData) return <td key={teamAbbrev}></td>;

                  const teamInfo =
                    teamsInfo[teamAbbrev as keyof typeof teamsInfo];
                  const teamStats = goalieStats[teamAbbrev];
                  const totalGames = teamStats?.totalGames || 0;

                  return (
                    <td key={teamAbbrev}>
                      <div
                        className={styles.teamChartCard}
                        style={
                          {
                            "--team-primary":
                              teamInfo?.primaryColor || "#14a2d2",
                            "--team-secondary":
                              teamInfo?.secondaryColor || "#07aae2",
                            "--team-jersey": teamInfo?.jersey || "#ffcc00",
                            "--team-accent": teamInfo?.accent || "#ff6384",
                            "--team-alt": teamInfo?.alt || "#4bc0c0"
                          } as React.CSSProperties
                        }
                      >
                        <div className={styles.teamHeader}>
                          <div className={styles.logoAndInfo}>
                            <img
                              className={styles.teamLogo}
                              src={`/teamLogos/${teamAbbrev}.png`}
                              alt={`${teamAbbrev} logo`}
                            />
                            <h4 className={styles.teamName}>
                              {teamInfo?.shortName || teamAbbrev}
                            </h4>
                            <div className={styles.teamStats}>
                              <span className={styles.statsLabel}>GP:</span>
                              <span className={styles.statsValue}>
                                {totalGames}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className={styles.chartContainer}>
                          <Doughnut
                            data={chartData}
                            options={generateChartOptions(teamAbbrev)}
                          />
                        </div>
                      </div>
                    </td>
                  );
                })}
                {/* Fill empty cells for incomplete rows */}
                {[...Array(teamsPerRow - row.length)].map((_, index) => (
                  <td key={`empty-${index}`}></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Handle team dropdown change
  const handleTeamChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTeam(event.target.value);
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

      {/* Team selector dropdown for mobile view */}
      {isMobile && (
        <div className={styles.teamSelectorContainer}>
          <select
            value={selectedTeam}
            onChange={handleTeamChange}
            className={styles.teamSelector}
          >
            {Object.keys(goalieStats).map((teamAbbrev) => (
              <option key={teamAbbrev} value={teamAbbrev}>
                {teamsInfo[teamAbbrev as keyof typeof teamsInfo]?.shortName ||
                  teamAbbrev}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className={styles.loadingMessage}>Loading goalie data...</div>
      ) : (
        <>
          {Object.keys(goalieStats).length > 0 ? (
            isMobile ? (
              // Render single chart for selected team in mobile view
              <div className={styles.mobileChartContainer}>
                {renderTeamCharts()}
              </div>
            ) : (
              renderTeamCharts()
            )
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
