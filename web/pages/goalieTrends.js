// goalieTrends.js
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-1\web\pages\goalieTrends.js

import React, { useEffect, useState } from "react";
import { teamsInfo } from "lib/NHL/teamsInfo";
import Fetch from "lib/cors-fetch";
import styles from "./GoalieTrends.module.scss";
import fetchWithCache from "lib/fetchWithCache"; // Adjust the path as necessary

// Function to mix two colors
function mix(color1, color2 = "#FFFFFF", percentage) {
  const hex = (color) => parseInt(color.substring(1), 16);
  const r = Math.round(
    (hex(color2) >> 16) * percentage + (hex(color1) >> 16) * (1 - percentage)
  );
  const g = Math.round(
    ((hex(color2) >> 8) & 0xff) * percentage +
      ((hex(color1) >> 8) & 0xff) * (1 - percentage)
  );
  const b = Math.round(
    (hex(color2) & 0xff) * percentage + (hex(color1) & 0xff) * (1 - percentage)
  );
  return `#${(0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

const GoalieTrends = () => {
  const [currentSeasonInfo, setCurrentSeasonInfo] = useState({});
  const [teamGameDates, setTeamGameDates] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedGameSpan, setSelectedGameSpan] = useState("SZN");
  const [goalieStats, setGoalieStats] = useState({});

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
          console.error(
            `Failed to fetch goalie stats for team ${teamAbbrev}:`,
            error
          );
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
    console.log("Goalie Data:", goalieData); // Log the goalie data for debugging
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
      console.log(
        `${teamAbbrev} - Total Team GP: ${totalTeamGames}, Total Goalie Starts: ${totalGoalieStarts}`
      );

      // Check for discrepancy
      if (totalTeamGames !== totalGoalieStarts) {
        console.log(
          `Discrepancy found in ${teamAbbrev} - Team GP: ${totalTeamGames} != Goalie Starts: ${totalGoalieStarts}`
        );
      }
    });
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

  const sortedTeams = Object.entries(teamsInfo).sort(([aAbbrev], [bAbbrev]) =>
    aAbbrev.localeCompare(bAbbrev)
  );

  return (
    <div className={styles.container}>
      {/* Game Span Selectors */}
      <div className={styles.selectors}>
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

      {/* Table for Displaying Teams and Goalie Stats */}
      <table className={styles.goalieTrendsTable}>
        <thead>
          <tr>
            <th>Team</th>
            <th>Goalies & Comparison Bar</th>
            <th>Stats</th>
          </tr>
        </thead>
        <tbody>
          {sortedTeams.map(([teamAbbrev, teamInfo]) => {
            const teamStats = goalieStats[teamAbbrev] || {}; // Ensure teamStats is an object, even if it's empty
            const goalies = teamStats.goalies || []; // Ensure goalies is an array, even if it's empty
            return (
              <tr key={teamAbbrev}>
                <td className={styles.teamLogoCell}>
                  <img
                    src={`https://assets.nhle.com/logos/nhl/svg/${teamAbbrev}_dark.svg`}
                    alt={`${teamInfo.name} Logo`}
                    className={styles.teamLogo}
                  />
                  <div>GP: {teamStats.totalGames}</div>
                </td>
                <td className={styles.goalieComparisonCell}>
                  <div
                    className={styles.comparisonBarContainer}
                    style={{
                      border: `2px solid ${teamInfo.secondaryColor}`,
                    }}
                  >
                    {goalies.map((goalie, index) => {
                      //                      console.log("Goalie:", goalie);

                      return (
                        <div
                          key={goalie.goalieId}
                          className={styles.barSegment}
                          style={{
                            width: `${goalie.percentage}%`,
                            backgroundColor:
                              index % 2 === 0
                                ? teamInfo.primaryColor
                                : mix(teamInfo.primaryColor, "#FFFFFF", 0.1),
                          }}
                        >
                          <span
                            className={styles.goalieName} // Use the new class for styling
                            style={{
                              color: teamInfo.jersey,
                            }}
                          >
                            {goalie.lastName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </td>
                <td className={styles.teamStatsCell}>
                  {goalies.map((goalie) => (
                    <div key={goalie.goalieId} className={styles.goalieStats}>
                      <span>
                        {goalie.lastName}: ({goalie.percentage.toFixed(1)}
                        %)
                      </span>
                      <span>GP: {goalie.gamesPlayed}</span>
                      <span>SV%: {goalie.savePercentage.toFixed(3)}</span>
                      <span>GAA: {goalie.goalsAgainstAverage.toFixed(2)}</span>
                    </div>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default GoalieTrends;
