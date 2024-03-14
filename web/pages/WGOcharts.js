// Whats Going On Charts Page
// Path: web/pages/WGOcharts.js

import React, { useState, useEffect } from "react";
import { teamsInfo } from "/lib/NHL/teamsInfo";
import Fetch from "/lib/cors-fetch";
import fetchWithCache from "/lib/fetchWithCache.ts";

const NHLAnalysisPage = () => {
  const [selectedTeam, setSelectedTeam] = useState("");
  const [teamData, setTeamData] = useState({});
  const [nhlSeasonInfo, setNhlSeasonInfo] = useState({});
  const [loading, setLoading] = useState(false);

  // Helper function to generate all dates in season
  const getDatesInRange = (startDate, endDate) => {
    const date = new Date(startDate);
    const dates = [];

    while (date <= new Date(endDate)) {
      dates.push(new Date(date).toISOString().split("T")[0]); // Format YYYY-MM-DD
      date.setDate(date.getDate() + 1);
    }

    return dates;
  };

  useEffect(() => {
    const fetchSeasonDates = async () => {
      setLoading(true);
      const seasonResponse = await fetchWithCache(
        "https://api-web.nhle.com/v1/schedule/now"
      );
      const { regularSeasonStartDate, regularSeasonEndDate } = seasonResponse;
      setNhlSeasonInfo({
        regularSeasonStartDate,
        regularSeasonEndDate,
      });

      let localTeamData = {}; // Initialize local structure for team data
      const dates = getDatesInRange(
        regularSeasonStartDate,
        new Date().toISOString().split("T")[0]
      );

      let combinedPromises = dates.map((currentDate) =>
        Promise.all([
          fetchWithCache(
            `https://api.nhle.com/stats/rest/en/team/summary?isAggregate=true&isGame=true&sort=[{"property":"points","direction":"DESC"},{"property":"wins","direction":"DESC"},{"property":"franchiseId","direction":"ASC"}]&start=0&limit=50&factCayenneExp=gamesPlayed>=1&cayenneExp=gameDate<="${currentDate} 23:59:59" and gameDate>="${currentDate}" and gameTypeId=2`
          ),
          fetchWithCache(
            `https://api.nhle.com/stats/rest/en/team/realtime?isAggregate=true&isGame=true&sort=[{"property":"hits","direction":"DESC"},{"property":"franchiseId","direction":"ASC"}]&start=0&limit=50&factCayenneExp=gamesPlayed>=1&cayenneExp=gameDate<="${currentDate} 23:59:59" and gameDate>="${currentDate}" and gameTypeId=2`
          ),
        ])
      );

      let combinedResults = await Promise.all(combinedPromises);
      combinedResults.forEach(([summaryResponse, realtimeResponse], index) => {
        const currentDate = dates[index];
        summaryResponse.data.forEach((teamStats) => {
          const teamKey = Object.keys(teamsInfo).find(
            (key) => teamsInfo[key].franchiseId === teamStats.franchiseId
          );
          if (teamKey) {
            localTeamData[teamKey] = localTeamData[teamKey] || {
              summary: {},
              dates: {},
            };
            localTeamData[teamKey].dates[currentDate] = { summary: teamStats };
          }
        });
        realtimeResponse.data.forEach((teamStats) => {
          const teamKey = Object.keys(teamsInfo).find(
            (key) => teamsInfo[key].franchiseId === teamStats.franchiseId
          );
          if (teamKey) {
            localTeamData[teamKey].dates[currentDate] =
              localTeamData[teamKey].dates[currentDate] || {};
            localTeamData[teamKey].dates[currentDate].realtimeStats = teamStats;
          }
        });
      });

      // Log the final complete data for each team
      Object.keys(localTeamData).forEach((teamKey) => {
        console.log(`Final data for ${teamKey}:`, localTeamData[teamKey]);
      });

      setTeamData(localTeamData); // Update state once after all updates are accumulated
      setLoading(false);
    };

    fetchSeasonDates().catch(console.error);
  }, []);

  // Generate sorted team options for dropdown based on abbreviations
  const teamOptions = Object.entries(teamsInfo)
    .sort((a, b) => a[0].localeCompare(b[0])) // Sort alphabetically based on team abbreviation
    .map(([key, value]) => ({
      key,
      value: key, // Using abbreviation
    }));

  return (
    <div>
      <h1>WGO Charts</h1>

      {/* Team Selection Dropdown */}
      <div className="wgoSelectors">
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
        >
          <option value="">Select a Team</option>
          {teamOptions.map((team) => (
            <option key={team.key} value={team.key}>
              {team.value}
            </option>
          ))}
        </select>
      </div>

      {/* Date Range Selection */}
      <div>
        <label>
          Start Date:
          <input
            type="date"
            value={nhlSeasonInfo.regularSeasonStartDate || ""}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label>
          End Date:
          <input
            type="date"
            value={nhlSeasonInfo.regularSeasonEndDate || ""}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
};

export default NHLAnalysisPage;
