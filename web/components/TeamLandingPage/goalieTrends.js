// goalieTrends.js
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-1\web\pages\goalieTrends.js

import React, { useEffect, useState } from "react";
import { teamsInfo } from "lib/NHL/teamsInfo";
import Fetch from "lib/cors-fetch";
import styles from "styles/GoalieTrends.module.scss";
import fetchWithCache from "lib/fetchWithCache"; // Adjust the path as necessary
import DoughnutChart from "./DoughnutChart";

const GoalieTrends = () => {
  const [currentSeasonInfo, setCurrentSeasonInfo] = useState({});
  const [teamGameDates, setTeamGameDates] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedGameSpan, setSelectedGameSpan] = useState("SZN");
  const [goalieStats, setGoalieStats] = useState({});
  const [showNewChart, setShowNewChart] = useState(false); // state for toggle

  // state for selected team in mobile view
  const [selectedTeam, setSelectedTeam] = useState(() => {
    const sortedTeamAbbrevs = Object.keys(teamsInfo).sort();
    return sortedTeamAbbrevs[0]; // This will ensure  first team alphabetically is the default
  });

  const fetchCurrentSeasonInfo = async () => {
    const url = `https://api.nhle.com/stats/rest/en/season?sort=[{"property":"id","direction":"DESC"}]`;
    try {
      const response = await Fetch(url).then((res) => res.json());
      setCurrentSeasonInfo(response.data[0]);
    } catch (error) {
      console.error("Failed to fetch current NHL season info:", error);
    }
  };

  const fetchGameDatesForAllTeams = async () => {
    let gameDates = {};
    const fetchPromises = Object.keys(teamsInfo).map(async (teamAbbrev) => {
      const url = `https://api-web.nhle.com/v1/club-schedule-season/${teamAbbrev}/${currentSeasonInfo.id}`;
      try {
        const response = await fetchWithCache(url);
        // Filter out games that are not regular season (gameType != 2)
        gameDates[teamAbbrev] = response.games
          .filter((game) => game.gameType === 2)
          .map((game) => game.gameDate.split("T")[0]);
      } catch (error) {
        console.error(`Failed to fetch games for ${teamAbbrev}:`, error);
      }
    });

    await Promise.all(fetchPromises);
    setTeamGameDates(gameDates);
    console.log("Filtered Team Game Dates:", gameDates); // Log filtered dates for debugging
  };

  const calculateStartDate = (teamAbbrev, span) => {
    // Ensure dates are sorted from oldest to newest
    const dates = teamGameDates[teamAbbrev]
      ? teamGameDates[teamAbbrev].sort((a, b) => new Date(b) - new Date(a))
      : [];

    const today = new Date();
    const mostRecentGameIndex = dates.findIndex(
      (date) => new Date(date) < today
    );

    // If no games have been played yet, or teamAbbrev is not correct
    if (mostRecentGameIndex === -1) return null;

    let startDateIndex;
    switch (span) {
      case "L10":
        startDateIndex = Math.min(mostRecentGameIndex + 9, dates.length - 1);
        break;
      case "L20":
        startDateIndex = Math.min(mostRecentGameIndex + 19, dates.length - 1);
        break;
      case "L30":
        startDateIndex = Math.min(mostRecentGameIndex + 29, dates.length - 1);
        break;
      case "SZN":
        startDateIndex = dates.length - 1; // Start from the beginning of the season
        break;
      default:
        startDateIndex = mostRecentGameIndex;
    }

    return dates[startDateIndex];
  };

  const fetchGoalieStatsForSelectedSpan = async () => {
    const endDate = new Date().toISOString().split("T")[0]; // End date as today
    const goalieStatsPromises = Object.entries(teamsInfo).map(
      async ([teamAbbrev, { franchiseId }]) => {
        const startDate = calculateStartDate(teamAbbrev, selectedGameSpan);
        const validDates =
          teamGameDates[teamAbbrev]?.filter(
            (date) => date >= startDate && date <= endDate
          ) || [];
        const totalGames = validDates.length;
        const url = `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=true&isGame=true&start=0&limit=50&factCayenneExp=gamesPlayed>=1&cayenneExp=franchiseId=${franchiseId} and gameDate<='${endDate}' and gameDate>='${startDate}' and gameTypeId=2`;

        try {
          const response = await fetchWithCache(url);
          return {
            teamAbbrev,
            data: processGoalieData(response.data, totalGames),
          };
        } catch (error) {
          // console.error(
          //   `Failed to fetch goalie stats for team ${teamAbbrev}:`,
          //   error
          // );
          return { teamAbbrev, data: { totalGames, goalies: [] } };
        }
      }
    );

    try {
      const results = await Promise.all(goalieStatsPromises);
      let goalieStatsUpdates = {};
      results.forEach(({ teamAbbrev, data }) => {
        // Sort goalies by games played in descending order
        data.goalies = (data.goalies || []).sort(
          (a, b) => b.gamesPlayed - a.gamesPlayed
        );
        goalieStatsUpdates[teamAbbrev] = data;
      });
      setGoalieStats(goalieStatsUpdates);
    } catch (error) {
      console.error(
        "An error occurred while fetching all goalie stats:",
        error
      );
    }
  };

  const handleGameSpanChange = (event) => {
    setSelectedGameSpan(event.target.value);
    // Fetch goalie stats based on the newly selected game span
    fetchGoalieStatsForSelectedSpan();
  };

  const processGoalieData = (goalieData, totalGames) => {
    let processedData = {};
    // console.log("Goalie Data:", goalieData); // Log the goalie data for debugging
    for (const goalie of goalieData) {
      const goalieId = goalie.playerId;
      const goalieFullName = goalie.goalieFullName;
      const lastName = goalie.lastName;
      const gamesPlayed = goalie.gamesStarted;
      const wins = goalie.wins;
      const losses = goalie.losses;
      const otLosses = goalie.otLosses;
      const shotsAgainst = goalie.shotsAgainst;
      const goalsAgainst = goalie.goalsAgainst;
      const savePercentage = goalie.savePct;
      const shutouts = goalie.shutouts;
      const goalsAgainstAverage = goalie.goalsAgainstAverage;
      const percentage = (gamesPlayed / totalGames) * 100; // Calculate percentage of games played
      processedData[goalieId] = {
        goalieId,
        goalieFullName,
        lastName,
        gamesPlayed,
        wins,
        losses,
        otLosses,
        shotsAgainst,
        goalsAgainst,
        savePercentage,
        shutouts,
        goalsAgainstAverage,
        percentage,
      };
    }
    console.log("Processed Goalie Stats:", processedData);

    return {
      totalGames,
      goalies: Object.values(processedData),
    };
  };

  const logTeamGamesAndGoalieStarts = () => {
    const today = new Date().toISOString().split("T")[0]; // Get today's date in ISO format

    Object.entries(goalieStats).forEach(([teamAbbrev, data]) => {
      // Filter the games to count only those that happened today or earlier
      const totalTeamGames =
        teamGameDates[teamAbbrev]?.filter((date) => date <= today).length || 0;

      const totalGoalieStarts = data.goalies.reduce(
        (acc, goalie) => acc + goalie.gamesPlayed,
        0
      );
      // console.log(
      //   `${teamAbbrev} - Total Team GP: ${totalTeamGames}, Total Goalie Starts: ${totalGoalieStarts}`
      // );

      // Check for discrepancy
      if (totalTeamGames !== totalGoalieStarts) {
        console.log(
          `Discrepancy found in ${teamAbbrev} - Team GP: ${totalTeamGames} != Goalie Starts: ${totalGoalieStarts}`
        );
      }
    });
  };

  // Handle change for the selected team in the dropdown
  const handleTeamChange = (event) => {
    setSelectedTeam(event.target.value);
  };

  // Call this function after your goalieStats state is updated
  useEffect(() => {
    if (!loading && Object.keys(goalieStats).length > 0) {
      logTeamGamesAndGoalieStarts();
    }
  }, [goalieStats, loading]);

  useEffect(() => {
    fetchCurrentSeasonInfo();
  }, []);

  useEffect(() => {
    if (currentSeasonInfo.startDate) {
      setLoading(true);
      fetchGameDatesForAllTeams().finally(() => setLoading(false));
    }
  }, [currentSeasonInfo.startDate]);

  useEffect(() => {
    if (!loading && Object.keys(teamGameDates).length > 0) {
      fetchGoalieStatsForSelectedSpan();
    }
  }, [loading, selectedGameSpan, teamGameDates]);

  if (loading) return <div>Loading...</div>;

  const isMobile = window.innerWidth < 768; // Adjust breakpoint as needed

  // Prepare data for dropdown and table layout
  const sortedTeams = Object.entries(teamsInfo).sort(([aAbbrev], [bAbbrev]) =>
    aAbbrev.localeCompare(bAbbrev)
  );

  let rows = [];

  // For desktop, create rows with 3 teams each for the 11x3 grid
  if (!isMobile) {
    for (let i = 0; i < sortedTeams.length; i += 3) {
      rows.push(sortedTeams.slice(i, i + 3));
    }
  } else {
    // For mobile, only include the selected team in rows
    const selectedTeamEntry = sortedTeams.find(
      ([teamAbbrev]) => teamAbbrev === selectedTeam
    );
    if (selectedTeamEntry) {
      rows.push([selectedTeamEntry]);
    }
  }

  return (
    <div className={styles.container}>
      <div
        className={styles.selectors}
        style={{ flexDirection: isMobile ? "column" : "row" }}
      >
        <div className={styles.titleContainer}>
          <h1 style={{ marginTop: "0", marginBottom: "0", textAlign: "left" }}>
            Goalie Net Share <span className="spanColorBlue">Trends</span>
          </h1>
          <div className={styles.toggleSwitch}>
            {/* Game Span Selectors */}
            {/* Dropdown for team selection on mobile */}
            <div className={styles.teamSelector}>
              <select value={selectedTeam} onChange={handleTeamChange}>
                {sortedTeams.map(([teamAbbrev, teamInfo]) => (
                  <option key={teamAbbrev} value={teamAbbrev}>
                    {teamAbbrev}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className={styles.controlsContainer}>
          <div className={styles.gameSpanSelectors}>
            <input
              type="radio"
              id="l10"
              name="gameSpan"
              value="L10"
              checked={selectedGameSpan === "L10"}
              onChange={handleGameSpanChange}
            />
            <label htmlFor="l10">L10 GP</label>
            <input
              type="radio"
              id="l20"
              name="gameSpan"
              value="L20"
              checked={selectedGameSpan === "L20"}
              onChange={handleGameSpanChange}
            />
            <label htmlFor="l20">L20 GP</label>
            <input
              type="radio"
              id="l30"
              name="gameSpan"
              value="L30"
              checked={selectedGameSpan === "L30"}
              onChange={handleGameSpanChange}
            />
            <label htmlFor="l30">L30 GP</label>
            <input
              type="radio"
              id="szn"
              name="gameSpan"
              value="SZN"
              checked={selectedGameSpan === "SZN"}
              onChange={handleGameSpanChange}
            />
            <label htmlFor="szn">Season</label>
          </div>
        </div>
      </div>

      {/* Conditional Rendering */}
      <table className={styles.goalieShareTable}>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map(([teamAbbrev, _], cellIndex) => {
                const goalieData = goalieStats[teamAbbrev]?.goalies || [];
                const teamColors = teamsInfo[teamAbbrev]
                  ? [
                      teamsInfo[teamAbbrev].primaryColor,
                      teamsInfo[teamAbbrev].secondaryColor,
                      teamsInfo[teamAbbrev].jersey,
                      teamsInfo[teamAbbrev].accent,
                      teamsInfo[teamAbbrev].alt,
                    ]
                  : ["#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF"]; // Default colors if teamInfo is missing

                const chartData = {
                  labels: goalieData.map((goalie) => goalie.lastName),
                  datasets: [
                    {
                      data: goalieData.map((goalie) => goalie.percentage),
                      backgroundColor: goalieData.map(
                        (_, index) => teamColors[index % teamColors.length]
                      ), // Cycle through team colors
                    },
                  ],
                };

                return (
                  <React.Fragment key={`${teamAbbrev}-${cellIndex}`}>
                    <td
                      className={styles.teamGroup}
                      style={{
                        "--primary-color": teamsInfo[teamAbbrev].primaryColor,
                        "--secondary-color":
                          teamsInfo[teamAbbrev].secondaryColor,
                        "--jersey-color": teamsInfo[teamAbbrev].jersey,
                        "--accent-color": teamsInfo[teamAbbrev].accent,
                        "--alt-color": teamsInfo[teamAbbrev].alt,
                      }}
                    >
                      <div
                        style={{ textAlign: "center" }}
                        className={styles.teamGroupCell}
                      >
                        <div className={styles.teamHeaderChart}>
                          <div className={styles.logoAndAbbrev}>
                            <img
                              className={styles.teamLogoChart}
                              src={`https://assets.nhle.com/logos/nhl/svg/${teamAbbrev}_light.svg`}
                              alt={`${teamAbbrev} logo`}
                            />
                            <span className={styles.teamNameChart}>
                              {teamsInfo[teamAbbrev].shortName}
                            </span>
                            <span className={styles.teamGPStats}>
                              <span className={styles.teamGPStatsLabel}>
                                GP: &nbsp;
                              </span>
                              <span className={styles.teamGoalieStatsValue}>
                                {goalieData.reduce(
                                  (acc, goalie) => acc + goalie.gamesPlayed,
                                  0
                                )}
                              </span>
                            </span>
                          </div>
                        </div>
                        <div className={styles.goalieChart}>
                          {goalieData.length > 0 && (
                            <DoughnutChart
                              data={chartData}
                              mobileView={isMobile}
                            />
                          )}
                        </div>
                      </div>
                    </td>
                  </React.Fragment>
                );
              })}
              {!isMobile &&
                [...Array(3 - row.length)].map((_, index) => (
                  <td key={`empty-${index}`}>&nbsp;</td> // Fill in empty cells if row has less than 3 teams
                ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default GoalieTrends;
