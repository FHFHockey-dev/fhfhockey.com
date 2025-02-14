import React, { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import useCurrentSeason from "hooks/useCurrentSeason";
import { format, isAfter } from "date-fns";
import { teamsInfo, teamNameToAbbreviationMap } from "lib/teamsInfo";
import supabase from "lib/supabase/client";

// -------------------------------
// TYPE DEFINITIONS
// -------------------------------
type NumericMetric =
  | "pointPct"
  | "points"
  | "goalsAgainstPerGame"
  | "goalsForPerGame"
  | "penaltyKillPct"
  | "powerPlayPct"
  | "shotsAgainstPerGame"
  | "shotsForPerGame";

interface TeamData {
  franchiseName: string;
  gamesPlayed: number;
  pointPct: number;
  points: number;
  goalsAgainstPerGame: number;
  goalsForPerGame: number;
  penaltyKillPct: number;
  powerPlayPct: number;
  shotsAgainstPerGame: number;
  shotsForPerGame: number;
  conference: string; // added field for filtering
  division: string; // added field for filtering
}

// -------------------------------
// HELPER FUNCTIONS
// -------------------------------
function getYDomainMax(metric: NumericMetric): number {
  if (
    metric === "pointPct" ||
    metric === "penaltyKillPct" ||
    metric === "powerPlayPct"
  ) {
    return 100;
  }
  if (metric === "goalsAgainstPerGame" || metric === "goalsForPerGame") {
    return 10;
  }
  if (metric === "shotsAgainstPerGame" || metric === "shotsForPerGame") {
    return 50;
  }
  return 100;
}

function getMetricValue(d: TeamData, metric: NumericMetric): number {
  const raw = d[metric];
  // For percentage values, multiply by 100
  if (
    metric === "pointPct" ||
    metric === "penaltyKillPct" ||
    metric === "powerPlayPct"
  ) {
    return raw * 100;
  }
  return raw;
}

/**
 * Process the daily data by accumulating each record for each team.
 */
function processDailyData(
  currentData: Map<string, TeamData[]>,
  dailyData: TeamData[]
): Map<string, TeamData[]> {
  const newData = new Map(currentData);
  dailyData.forEach((entry) => {
    const teamName = entry.franchiseName;
    const existingData = newData.get(teamName) || [];
    const lastEntry = existingData[existingData.length - 1];
    if (!lastEntry || entry.gamesPlayed > lastEntry.gamesPlayed) {
      newData.set(teamName, [...existingData, entry]);
    }
  });
  return newData;
}

// -------------------------------
// MAIN COMPONENT
// -------------------------------
const TeamStandingsChart: React.FC = () => {
  const season = useCurrentSeason();
  const [data, setData] = useState<Map<string, TeamData[]>>(new Map());
  const [metric, setMetric] = useState<NumericMetric>("pointPct");

  // New state for filters; default is "All"
  const [selectedConference, setSelectedConference] = useState<string>("All");
  const [selectedDivision, setSelectedDivision] = useState<string>("All");

  const chartRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // -------------------------------
  // Fetch Data with Pagination & Include Conference/Division/PK/PP
  // -------------------------------
  // -------------------------------
  // Fetch Data with Pagination from Both Tables & Merge Them
  // -------------------------------
  useEffect(() => {
    if (!season) return;

    const startDate = new Date(season.regularSeasonStartDate);
    const today = new Date();
    const seasonEnd = new Date(season.regularSeasonEndDate);
    const endDate = new Date(Math.min(today.getTime(), seasonEnd.getTime()));
    if (isAfter(startDate, endDate)) return;

    const seasonStartStr = format(startDate, "yyyy-MM-dd");
    const endDateStr = format(endDate, "yyyy-MM-dd");

    const fetchData = async () => {
      const limit = 1000;
      let offset = 0;
      let standingsRows: any[] = [];

      // --- Fetch standings data from nhl_standings_details (without PK and PP) ---
      while (true) {
        const { data, error } = await supabase
          // @ts-ignore
          .from("nhl_standings_details")
          .select(
            `
            date,
            team_name_default,
            games_played,
            point_pctg,
            points,
            goal_against,
            goal_for,
            conference_abbrev,
            division_abbrev
          `
          )
          .gte("date", seasonStartStr)
          .lte("date", endDateStr)
          .order("date", { ascending: true })
          .order("team_name_default", { ascending: true })
          .range(offset, offset + limit - 1);

        if (error) {
          console.error("Error fetching standings:", error);
          break;
        }
        if (!data || data.length === 0) break;
        standingsRows.push(...data);
        if (data.length < limit) break;
        offset += limit;
      }

      // --- Fetch team stats data (for PK and PP) from wgo_team_stats ---
      offset = 0;
      let teamStatsRows: any[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("wgo_team_stats")
          .select(
            `
            date,
            franchise_name,
            games_played,
            penalty_kill_pct,
            power_play_pct
          `
          )
          .gte("date", seasonStartStr)
          .lte("date", endDateStr)
          .order("date", { ascending: true })
          .order("franchise_name", { ascending: true })
          .range(offset, offset + limit - 1);

        if (error) {
          console.error("Error fetching team stats:", error);
          break;
        }
        if (!data || data.length === 0) break;
        teamStatsRows.push(...data);
        if (data.length < limit) break;
        offset += limit;
      }

      // --- Create a lookup map from team stats ---
      // The key is built from date and team name.
      const teamStatsMap = new Map<string, any>();
      teamStatsRows.forEach((row) => {
        // Adjust this key if needed – we assume that the team names match between the two tables.
        const key = `${row.date}_${row.franchise_name}`;
        teamStatsMap.set(key, row);
      });

      // --- Merge the standings data with team stats ---
      const dailyData = standingsRows.map((row) => {
        const gp = row.games_played || 0;
        // Build the key using the standings table’s team name.
        const key = `${row.date}_${row.team_name_default}`;
        const stats = teamStatsMap.get(key);
        return {
          franchiseName: row.team_name_default,
          gamesPlayed: gp,
          pointPct: row.point_pctg || 0,
          points: row.points || 0,
          goalsAgainstPerGame: gp > 0 ? (row.goal_against ?? 0) / gp : 0,
          goalsForPerGame: gp > 0 ? (row.goal_for ?? 0) / gp : 0,
          // Use penalty kill and power play values from team stats if available
          penaltyKillPct: stats ? stats.penalty_kill_pct : 0,
          powerPlayPct: stats ? stats.power_play_pct : 0,
          shotsAgainstPerGame: 0,
          shotsForPerGame: 0,
          conference: row.conference_abbrev || "N/A",
          division: row.division_abbrev || "N/A",
        } as TeamData;
      });

      // Process and accumulate the data as before
      const accumulatedData = processDailyData(new Map(), dailyData);
      setData(accumulatedData);
    };

    fetchData();
  }, [season]);

  // -------------------------------
  // Compute unique conference and division values for filters
  // -------------------------------
  const uniqueConferences = useMemo(() => {
    const confSet = new Set<string>();
    data.forEach((teamData) => {
      if (teamData.length > 0 && teamData[0].conference) {
        confSet.add(teamData[0].conference);
      }
    });
    return Array.from(confSet);
  }, [data]);

  const uniqueDivisions = useMemo(() => {
    const divSet = new Set<string>();
    data.forEach((teamData) => {
      if (teamData.length > 0 && teamData[0].division) {
        divSet.add(teamData[0].division);
      }
    });
    return Array.from(divSet);
  }, [data]);

  // -------------------------------
  // Draw Chart with D3
  // -------------------------------
  useEffect(() => {
    if (data.size === 0) return;

    const svg = d3.select(chartRef.current);
    const tooltip = d3.select(tooltipRef.current);
    svg.selectAll("*").remove();

    const width = chartRef.current?.clientWidth || 800;
    const height = chartRef.current?.clientHeight || 600;
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Determine the maximum gamesPlayed from the filtered data
    let maxGames = 0;
    data.forEach((teamData) => {
      // Only include teams that pass the filter
      if (teamData.length > 0) {
        const firstRecord = teamData[0];
        if (
          (selectedConference === "All" ||
            firstRecord.conference === selectedConference) &&
          (selectedDivision === "All" ||
            firstRecord.division === selectedDivision)
        ) {
          const teamMax = d3.max(teamData, (d) => d.gamesPlayed) || 0;
          if (teamMax > maxGames) maxGames = teamMax;
        }
      }
    });
    if (maxGames === 0) maxGames = 1; // fallback

    const xScale = d3
      .scaleLinear()
      .domain([0, maxGames]) // now starting at 0 so the first data point is truly at the border
      .range([0, innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([0, getYDomainMax(metric)])
      .range([innerHeight, 0])
      .nice();

    const lineGenerator = d3
      .line<TeamData>()
      .x((d) => xScale(d.gamesPlayed))
      .y((d) => yScale(getMetricValue(d, metric)))
      .curve(d3.curveLinear);

    const mainG = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Draw the data – only for teams that match the filter
    data.forEach((teamData, teamName) => {
      if (teamData.length === 0) return;
      const firstRecord = teamData[0];
      if (
        (selectedConference !== "All" &&
          firstRecord.conference !== selectedConference) ||
        (selectedDivision !== "All" &&
          firstRecord.division !== selectedDivision)
      ) {
        return;
      }
      const sortedData = [...teamData].sort(
        (a, b) => a.gamesPlayed - b.gamesPlayed
      );
      const abbreviation = teamNameToAbbreviationMap[teamName];
      const color = teamsInfo[abbreviation]?.primaryColor || "#999";

      // Draw the line for this team
      mainG
        .append("path")
        .datum(sortedData)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.7)
        .attr("class", "team-line")
        .attr("d", lineGenerator);

      // Draw circles for each data point
      mainG
        .selectAll(`.dot-${abbreviation}`)
        .data(sortedData)
        .enter()
        .append("circle")
        .attr("class", `dot-${abbreviation}`)
        .attr("cx", (d) => xScale(d.gamesPlayed))
        .attr("cy", (d) => yScale(getMetricValue(d, metric)))
        .attr("r", 3)
        .attr("fill", color)
        .attr("opacity", 0.8)
        .on("mouseover", function (event, d) {
          d3.select(this).attr("r", 5).attr("opacity", 1);
          tooltip.style("display", "block").html(`
              ${abbreviation}<br/>
              GP: ${d.gamesPlayed}<br/>
              Value: ${getMetricValue(d, metric).toFixed(2)}
            `);
        })
        .on("mousemove", (event) => {
          tooltip
            .style("left", `${event.pageX + 15}px`)
            .style("top", `${event.pageY - 28}px`);
        })
        .on("mouseout", function () {
          d3.select(this).attr("r", 3).attr("opacity", 0.8);
          tooltip.style("display", "none");
        });
    });

    // Draw X axis
    const xAxis = d3.axisBottom(xScale).ticks(10);
    mainG
      .append("g")
      .attr("transform", `translate(0, ${innerHeight})`)
      .call(xAxis);

    // Draw Y axis
    const yAxis = d3.axisLeft(yScale).ticks(6);
    mainG.append("g").call(yAxis);
  }, [data, metric, selectedConference, selectedDivision]);

  // -------------------------------
  // Render UI: Filters + Chart
  // -------------------------------
  return (
    <div style={{ position: "relative", width: "100%", margin: "2rem 0" }}>
      <div
        style={{
          marginBottom: "1rem",
          display: "flex",
          gap: "1rem",
          alignItems: "center",
        }}
      >
        <label>Conference: </label>
        <select
          value={selectedConference}
          onChange={(e) => setSelectedConference(e.target.value)}
          style={{ padding: "5px", fontSize: "16px" }}
        >
          <option value="All">All</option>
          {uniqueConferences.map((conf) => (
            <option key={conf} value={conf}>
              {conf}
            </option>
          ))}
        </select>

        <label>Division: </label>
        <select
          value={selectedDivision}
          onChange={(e) => setSelectedDivision(e.target.value)}
          style={{ padding: "5px", fontSize: "16px" }}
        >
          <option value="All">All</option>
          {uniqueDivisions.map((div) => (
            <option key={div} value={div}>
              {div}
            </option>
          ))}
        </select>

        <label>Metric: </label>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value as NumericMetric)}
          style={{ padding: "5px", fontSize: "16px" }}
        >
          <option value="pointPct">Point Percentage</option>
          <option value="points">Points</option>
          <option value="goalsAgainstPerGame">Goals Against/Game</option>
          <option value="goalsForPerGame">Goals For/Game</option>
          <option value="penaltyKillPct">PK%</option>
          <option value="powerPlayPct">PP%</option>
          <option value="shotsAgainstPerGame">Shots Against/Game</option>
          <option value="shotsForPerGame">Shots For/Game</option>
        </select>
      </div>

      <svg ref={chartRef} style={{ width: "100%", height: "600px" }} />

      <div
        ref={tooltipRef}
        style={{
          position: "absolute",
          padding: "8px",
          background: "rgba(0,0,0,0.85)",
          color: "white",
          border: "1px solid #333",
          borderRadius: "4px",
          pointerEvents: "none",
          display: "none",
          fontSize: "14px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
        }}
      />
    </div>
  );
};

export default TeamStandingsChart;
