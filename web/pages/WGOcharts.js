// Whats Going On Charts Page
// WGOcharts.js

// Path: web/pages/WGOcharts.js

import React, { useState, useEffect } from "react";
import { teamsInfo } from "/lib/NHL/teamsInfo";

const NHLAnalysisPage = () => {
  // State for selected team, date range, and teams list
  const [selectedTeam, setSelectedTeam] = useState("");
  const [startDate, setStartDate] = useState(""); // Will be updated with actual season start date
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  ); // Today's date in YYYY-MM-DD format
  const [teamOptions, setTeamOptions] = useState([]);

  useEffect(() => {
    // Fetch the initial schedule data (also determining season start)
    const fetchInitialSchedule = async () => {
      try {
        // Assuming no startDate passed fetches data from season start
        const response = await fetch("/api/schedule");
        const { data } = await response.json();
        if (data && data.length > 0) {
          // Assuming the structure includes a date field in each schedule item
          // Update this logic based on the actual structure of your schedule data
          const seasonStartDate = data[0].date;
          setStartDate(seasonStartDate);
          console.log("Initial Schedule Data:", data);
          console.log("Season Start Date:", seasonStartDate);
        }
      } catch (error) {
        console.error("Failed to fetch initial schedule:", error);
      }
    };

    // Simulate fetching and setting team options sorted by abbreviation
    const sortedTeams = Object.entries(teamsInfo)
      .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
      .map(([key, value]) => ({
        key,
        value: value.shortName, // or `name` based on your preference
      }));

    setTeamOptions(sortedTeams);
    fetchInitialSchedule();
  }, []);

  return (
    <div>
      <h1>NHL Team Performance Analysis</h1>

      {/* Team Selection Dropdown */}
      <select
        value={selectedTeam}
        onChange={(e) => setSelectedTeam(e.target.value)}
      >
        <option value="">Select a Team</option>
        {teamOptions.map((team) => (
          <option key={team.key} value={team.key}>
            {team.key} - {team.value}
          </option>
        ))}
      </select>

      {/* Date Range Selection */}
      <div>
        <label>
          Start Date:
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label>
          End Date:
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
};

export default NHLAnalysisPage;
