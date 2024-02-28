import React, { useEffect, useState } from "react";
import Chart from "chart.js";
import { teamsInfo } from "/lib/NHL/teamsInfo";
import fetchWithCache from "/lib/fetchWithCache"; // Adjust the path as necessary

const GoalieShareChart = () => {
  const [seasonData, setSeasonData] = useState(null);
  const [teamGameDates, setTeamGameDates] = useState({});
  const [teamGameData, setTeamGameData] = useState({});
  const [selectedSpan, setSelectedSpan] = useState("Season");

  useEffect(() => {
    const fetchSeasonData = async () => {
      try {
        const response = await fetch(
          'https://api.nhle.com/stats/rest/en/season?sort=[{"property":"id","direction":"DESC"}]'
        );
        const data = await response.json();
        const firstSeason = data.data[0];
        const seasonId = firstSeason.id;
        const startDate = firstSeason.startDate.split("T")[0]; // Extracting date part only
        // Fetch game dates for all teams
        fetchGameDatesForAllTeams(seasonId);
        setSeasonData({ seasonId, startDate });
      } catch (error) {
        console.error("Error fetching season data:", error);
      }
    };

    fetchSeasonData();
  }, []);

  const fetchGameDatesForAllTeams = async (seasonId) => {
    let gameData = {};
    const fetchPromises = Object.keys(teamsInfo).map(async (teamAbbrev) => {
      const url = `https://api-web.nhle.com/v1/club-schedule-season/${teamAbbrev}/${seasonId}`;
      try {
        const response = await fetchWithCache(url);
        // Filter out games that are not regular season (gameType != 1)
        gameData[teamAbbrev] = response.games
          .filter((game) => game.gameType === 2)
          .map((game) => ({
            gameId: game.id,
            gameDate: game.gameDate.split("T")[0],
          }));
      } catch (error) {
        console.error(`Failed to fetch games for ${teamAbbrev}:`, error);
      }
    });

    await Promise.all(fetchPromises);
    setTeamGameData(gameData);
    console.log("Game Data:", gameData); // Log game data for debugging

    // Fetch goalie data for each team based on the selected span
    Object.keys(gameData).forEach((teamAbbrev) => {
      const teamGames = gameData[teamAbbrev];
      const { startDate, endDate } = calculateGameSpan(teamGames);
      const franchiseId = teamsInfo[teamAbbrev].franchiseId;
      fetchGoalieData(franchiseId, startDate, endDate);
    });
  };

  // Function to calculate game span based on selected span and today's date
  const calculateGameSpan = (teamGames) => {
    const today = new Date().toISOString().split("T")[0];
    const gameCount = teamGames.length;
    let startDate, endDate;

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
        startDate = teamGames[0].gameDate;
        break;
    }

    // Find the index of the most recent completed game
    let endIndex = gameCount - 1;
    while (endIndex >= 0) {
      if (teamGames[endIndex].gameDate <= today) {
        break;
      }
      endIndex--;
    }

    // Ensure that endIndex is within bounds
    endIndex = Math.min(endIndex, gameCount - 1);

    endDate = teamGames[endIndex].gameDate;
    return { startDate, endDate };
  };

  // Function to handle span button click
  const handleSpanButtonClick = (span) => {
    setSelectedSpan(span);
  };

  // Function to fetch goalie data
  const fetchGoalieData = async (franchiseId, startDate, endDate) => {
    const url = `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=true&isGame=true&start=0&limit=50&factCayenneExp=gamesPlayed>=1&cayenneExp=franchiseId=${franchiseId} and gameDate<='${endDate}' and gameDate>='${startDate}' and gameTypeId=2`;

    console.log("Fetching Goalie Data URL:", url); // Log URL for debugging, similar to the old function

    try {
      const response = await fetchWithCache(url);

      if (!response.ok) {
        console.error(
          `HTTP error fetching goalie data for franchiseId ${franchiseId}: Status: ${response.status}`
        );
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json(); // Parse the JSON data from the response

      console.log(`Goalie Data for franchiseId ${franchiseId}:`, data); // Log the goalie data for debugging
    } catch (error) {
      console.error(
        `Error fetching goalie data for franchiseId ${franchiseId}:`,
        error
      );
    }
  };

  // Render table rows
  const renderTableRows = (teamAbbrev) => {
    const teamGames = teamGameData[teamAbbrev];
    const { startDate, endDate } = calculateGameSpan(teamGames);

    // Format start date and end date
    const formattedStartDate = startDate
      ? new Date(startDate).toLocaleDateString()
      : "";
    const formattedEndDate = endDate
      ? new Date(endDate).toLocaleDateString()
      : "";

    return (
      <tr key={teamAbbrev}>
        <td>{teamAbbrev}</td>
        <td>{formattedStartDate}</td>
        <td>{formattedEndDate}</td>
      </tr>
    );
  };

  return (
    <div className="goalie-share-chart">
      <div>
        <button onClick={() => handleSpanButtonClick("L10")}>L10</button>
        <button onClick={() => handleSpanButtonClick("L20")}>L20</button>
        <button onClick={() => handleSpanButtonClick("L30")}>L30</button>
        <button onClick={() => handleSpanButtonClick("Season")}>Season</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Team</th>
            <th>Start Date</th>
            <th>End Date</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(teamGameData).map((teamAbbrev) =>
            renderTableRows(teamAbbrev)
          )}
        </tbody>
      </table>
    </div>
  );
};

export default GoalieShareChart;
