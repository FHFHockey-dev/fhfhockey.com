import React, { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import { format, isAfter } from "date-fns";
import useCurrentSeason from "hooks/useCurrentSeason";
import useResizeObserver from "hooks/useResizeObserver";
import { teamsInfo, teamNameToAbbreviationMap } from "lib/teamsInfo";
import supabase from "lib/supabase";
import styles from "./TeamStandingsChart.module.scss";
import Fetch from "lib/cors-fetch";

// -------------------------------
// TYPE DEFINITIONS
// -------------------------------
// Note: we now include raw cumulative totals: goalFor and goalAgainst.
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
  conference: string;
  division: string;
  // Raw cumulative totals (from the API)
  goalFor: number;
  goalAgainst: number;
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
  // For PK%, PP%, and pointPct, multiply by 100.
  if (
    metric === "pointPct" ||
    metric === "penaltyKillPct" ||
    metric === "powerPlayPct"
  ) {
    return raw * 100;
  }
  return raw;
}

/** Accumulate daily data for each team. */
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

/**
 * Compute a rolling average series from the raw cumulative values.
 * For example, for goals for per game, for a given window size W, the value at index i is:
 *    (data[i].goalFor - data[i - W].goalFor) / W.
 * (Only data from game W onward is included.)
 */
function computeRollingForGoals(
  data: TeamData[],
  windowSize: number,
  type: "goalsFor" | "goalsAgainst"
): TeamData[] {
  if (data.length <= windowSize) return [];
  return data.slice(windowSize).map((d, i) => {
    const current = data[windowSize + i];
    const previous = data[i];
    const avg =
      type === "goalsFor"
        ? (current.goalFor - previous.goalFor) / windowSize
        : (current.goalAgainst - previous.goalAgainst) / windowSize;
    // Return a new object with the appropriate per game value replaced.
    return type === "goalsFor"
      ? { ...current, goalsForPerGame: avg }
      : { ...current, goalsAgainstPerGame: avg };
  });
}

/**
 * Compute a rolling average series for metrics that are already computed on a per-game basis.
 * This is used for PK%, PP%, etc.
 */
function computeRollingAverageFiltered(
  data: TeamData[],
  windowSize: number,
  metric: NumericMetric
): TeamData[] {
  if (data.length < windowSize) return [];
  return data.slice(windowSize - 1).map((_, i) => {
    const windowData = data.slice(i, i + windowSize);
    const avg = d3.mean(windowData, (dd) => dd[metric] as number) ?? 0;
    return { ...data[i + windowSize - 1], [metric]: avg };
  });
}

// -------------------------------
// MAIN COMPONENT
// -------------------------------
const TeamStandingsChart: React.FC = () => {
  const season = useCurrentSeason();
  const [data, setData] = useState<Map<string, TeamData[]>>(new Map());
  const [metric, setMetric] = useState<NumericMetric>("points");

  // Filter states.
  const [selectedConference, setSelectedConference] = useState("All");
  const [selectedDivision, setSelectedDivision] = useState("All");

  // Rolling toggles (for PK/PP as well as GF/GA).
  // For these metrics, default to 5GM rolling average.
  const [rolling5, setRolling5] = useState(false);
  const [rolling10, setRolling10] = useState(false);

  // Team toggles: array of team abbreviations selected for display.
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  // Refs for SVG container, tooltip, and measuring container.
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { width, height } = useResizeObserver(containerRef);

  // -------------------------------
  // FETCH & MERGE DATA
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
            division_name
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

      // Build a lookup from team stats.
      const teamStatsMap = new Map<string, any>();
      teamStatsRows.forEach((row) => {
        const key = `${row.date}_${row.franchise_name}`;
        teamStatsMap.set(key, row);
      });

      // Merge data; note we now include raw cumulative totals (goal_for and goal_against).
      const dailyData = standingsRows.map((row) => {
        const gp = row.games_played || 0;
        const key = `${row.date}_${row.team_name_default}`;
        const stats = teamStatsMap.get(key);
        return {
          franchiseName: row.team_name_default,
          gamesPlayed: gp,
          pointPct: gp > 0 ? row.point_pctg || 0 : 0.5,
          points: row.points || 0,
          goalsAgainstPerGame: gp > 0 ? (row.goal_against ?? 0) / gp : 0,
          goalsForPerGame: gp > 0 ? (row.goal_for ?? 0) / gp : 0,
          penaltyKillPct: stats ? stats.penalty_kill_pct : 0,
          powerPlayPct: stats ? stats.power_play_pct : 0,
          shotsAgainstPerGame: 0,
          shotsForPerGame: 0,
          conference: row.conference_abbrev || "N/A",
          division: row.division_name || "N/A",
          // Include the raw cumulative values:
          goalFor: row.goal_for || 0,
          goalAgainst: row.goal_against || 0
        } as TeamData;
      });

      const accumulatedData = processDailyData(new Map(), dailyData);
      setData(accumulatedData);
    };

    fetchData();
  }, [season]);

  // -------------------------------
  // Reset Team Toggles & Rolling Options on Filter Changes
  // -------------------------------
  useEffect(() => {
    const teams: string[] = [];
    data.forEach((teamData, teamName) => {
      if (teamData.length > 0) {
        const firstRecord = teamData[0];
        if (
          (selectedConference === "All" ||
            firstRecord.conference === selectedConference) &&
          (selectedDivision === "All" ||
            firstRecord.division === selectedDivision)
        ) {
          const abbr = teamNameToAbbreviationMap[teamName];
          if (abbr) teams.push(abbr);
        }
      }
    });
    teams.sort();
    setSelectedTeams(teams);

    if (metric === "penaltyKillPct" || metric === "powerPlayPct") {
      setRolling5(true);
      setRolling10(false);
    } else {
      setRolling5(false);
      setRolling10(false);
    }
  }, [data, selectedConference, selectedDivision, metric]);

  // -------------------------------
  // Draw Chart with D3 (Responsive, Dynamic Y Axis, 1‑sec Hover Delay)
  // -------------------------------
  useEffect(() => {
    if (data.size === 0 || !width || !height) return;
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const innerWidth = Math.max(0, width - margin.left - margin.right);
    const innerHeight = Math.max(0, height - margin.top - margin.bottom);

    let maxGames = 0;
    data.forEach((teamData) => {
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
    if (maxGames === 0) maxGames = 1;

    const xScale = d3
      .scaleLinear()
      .domain([0, maxGames])
      .range([0, innerWidth]);

    let yScale: d3.ScaleLinear<number, number>;
    if (metric === "penaltyKillPct" || metric === "powerPlayPct") {
      const allValues: number[] = [];
      const useRolling = rolling5 || rolling10;
      data.forEach((teamData, teamName) => {
        const abbr = teamNameToAbbreviationMap[teamName];
        if (!abbr || !selectedTeams.includes(abbr)) return;
        if (
          (selectedConference !== "All" &&
            teamData[0].conference !== selectedConference) ||
          (selectedDivision !== "All" &&
            teamData[0].division !== selectedDivision)
        ) {
          return;
        }
        const sortedData = [...teamData].sort(
          (a, b) => a.gamesPlayed - b.gamesPlayed
        );
        if (useRolling) {
          if (rolling5) {
            const s = computeRollingAverageFiltered(sortedData, 5, metric);
            s.forEach((d) => allValues.push(getMetricValue(d, metric)));
          }
          if (rolling10) {
            const s = computeRollingAverageFiltered(sortedData, 10, metric);
            s.forEach((d) => allValues.push(getMetricValue(d, metric)));
          }
        } else {
          sortedData.forEach((d) => allValues.push(getMetricValue(d, metric)));
        }
      });
      const minVal = d3.min(allValues) ?? 0;
      const maxVal = d3.max(allValues) ?? 100;
      yScale = d3
        .scaleLinear()
        .domain([minVal, maxVal])
        .range([innerHeight, 0])
        .nice();
    } else if (metric === "pointPct") {
      yScale = d3
        .scaleLinear()
        .domain([-50, 50])
        .range([innerHeight, 0])
        .nice();
    } else if (metric === "points") {
      const diffValues: number[] = [];
      data.forEach((teamData) => {
        if (teamData.length > 0) {
          const firstRecord = teamData[0];
          if (
            (selectedConference === "All" ||
              firstRecord.conference === selectedConference) &&
            (selectedDivision === "All" ||
              firstRecord.division === selectedDivision)
          ) {
            teamData.forEach((d) => diffValues.push(d.points - d.gamesPlayed));
          }
        }
      });
      const minDiff = d3.min(diffValues) ?? 0;
      const maxDiff = d3.max(diffValues) ?? 0;
      yScale = d3
        .scaleLinear()
        .domain([minDiff, maxDiff])
        .range([innerHeight, 0])
        .nice();
    } else if (
      metric === "goalsForPerGame" ||
      metric === "goalsAgainstPerGame"
    ) {
      // For GF/GA, if rolling toggles are on, we compute the rolling averages from the raw cumulative totals.
      const allValues: number[] = [];
      const useRolling = rolling5 || rolling10;
      data.forEach((teamData, teamName) => {
        const abbr = teamNameToAbbreviationMap[teamName];
        if (!abbr || !selectedTeams.includes(abbr)) return;
        if (
          (selectedConference !== "All" &&
            teamData[0].conference !== selectedConference) ||
          (selectedDivision !== "All" &&
            teamData[0].division !== selectedDivision)
        ) {
          return;
        }
        const sortedData = [...teamData].sort(
          (a, b) => a.gamesPlayed - b.gamesPlayed
        );
        if (useRolling) {
          if (rolling5) {
            const s = computeRollingForGoals(
              sortedData,
              5,
              metric === "goalsForPerGame" ? "goalsFor" : "goalsAgainst"
            );
            s.forEach((d) => allValues.push(getMetricValue(d, metric)));
          }
          if (rolling10) {
            const s = computeRollingForGoals(
              sortedData,
              10,
              metric === "goalsForPerGame" ? "goalsFor" : "goalsAgainst"
            );
            s.forEach((d) => allValues.push(getMetricValue(d, metric)));
          }
        } else {
          sortedData.forEach((d) => allValues.push(getMetricValue(d, metric)));
        }
      });
      const minVal = d3.min(allValues) ?? 0;
      const maxVal = d3.max(allValues) ?? 10;
      yScale = d3
        .scaleLinear()
        .domain([minVal, maxVal])
        .range([innerHeight, 0])
        .nice();
    } else {
      yScale = d3
        .scaleLinear()
        .domain([0, getYDomainMax(metric)])
        .range([innerHeight, 0])
        .nice();
    }

    const yAxis = d3.axisLeft(yScale).ticks(5);

    const lineGenerator = d3
      .line<TeamData>()
      .x((d) => xScale(d.gamesPlayed))
      .y((d) => {
        if (metric === "pointPct") {
          return yScale(getMetricValue(d, metric) - 50);
        } else if (metric === "points") {
          return yScale(d.points - d.gamesPlayed);
        } else {
          return yScale(getMetricValue(d, metric));
        }
      })
      .curve(d3.curveLinear);

    const mainG = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Draw data for each team
    data.forEach((teamData, teamName) => {
      const abbr = teamNameToAbbreviationMap[teamName];
      if (!selectedTeams.includes(abbr)) return;
      if (teamData.length === 0) return;
      if (
        (selectedConference !== "All" &&
          teamData[0].conference !== selectedConference) ||
        (selectedDivision !== "All" &&
          teamData[0].division !== selectedDivision)
      ) {
        return;
      }
      const sortedData = [...teamData].sort(
        (a, b) => a.gamesPlayed - b.gamesPlayed
      );
      const color = teamsInfo[abbr]?.lightColor || "#999";
      const teamG = mainG
        .append("g")
        .attr("class", `team-group team-${abbr}`)
        .property("hoverTimer", null)
        .property("hoverActive", false);

      // For PK%, PP%, GF/GA – if rolling toggle(s) are on, compute and draw only the rolling series.
      let useRolling = false;
      if (metric === "penaltyKillPct" || metric === "powerPlayPct") {
        useRolling = rolling5 || rolling10;
      }
      if (metric === "goalsForPerGame" || metric === "goalsAgainstPerGame") {
        useRolling = rolling5 || rolling10;
      }

      if (useRolling) {
        const seriesList: { data: TeamData[]; strokeDash?: string }[] = [];
        if (rolling5) {
          if (metric === "penaltyKillPct" || metric === "powerPlayPct") {
            seriesList.push({
              data: computeRollingAverageFiltered(sortedData, 5, metric),
              strokeDash: "4,2"
            });
          } else if (
            metric === "goalsForPerGame" ||
            metric === "goalsAgainstPerGame"
          ) {
            seriesList.push({
              data: computeRollingForGoals(
                sortedData,
                5,
                metric === "goalsForPerGame" ? "goalsFor" : "goalsAgainst"
              ),
              strokeDash: "4,2"
            });
          }
        }
        if (rolling10) {
          if (metric === "penaltyKillPct" || metric === "powerPlayPct") {
            seriesList.push({
              data: computeRollingAverageFiltered(sortedData, 10, metric),
              strokeDash: "2,2"
            });
          } else if (
            metric === "goalsForPerGame" ||
            metric === "goalsAgainstPerGame"
          ) {
            seriesList.push({
              data: computeRollingForGoals(
                sortedData,
                10,
                metric === "goalsForPerGame" ? "goalsFor" : "goalsAgainst"
              ),
              strokeDash: "2,2"
            });
          }
        }
        seriesList.forEach((s) => {
          if (s.data.length > 0) {
            teamG
              .append("path")
              .datum(s.data)
              .attr("fill", "none")
              .attr("stroke", color)
              .attr("stroke-width", 1.5)
              .attr("opacity", 0.8)
              .attr("stroke-dasharray", s.strokeDash || null)
              .attr("class", "team-line")
              .attr("d", lineGenerator);
            const lastPoint = s.data[s.data.length - 1];
            teamG
              .append("svg:image")
              .attr("xlink:href", `/teamLogos/${abbr || "default"}.png`)
              .attr("x", xScale(lastPoint.gamesPlayed) + 5)
              .attr("y", yScale(getMetricValue(lastPoint, metric)) - 10)
              .attr("width", 20)
              .attr("height", 20);
          }
        });
      } else {
        // Draw the daily series normally.
        teamG
          .append("path")
          .datum(sortedData)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", 1.5)
          .attr("opacity", 0.8)
          .attr("class", "team-line")
          .attr("d", lineGenerator);
        teamG
          .selectAll(`circle.dot-${abbr}`)
          .data(sortedData)
          .enter()
          .append("circle")
          .attr("class", `dot-${abbr}`)
          .attr("cx", (d) => xScale(d.gamesPlayed))
          .attr("cy", (d) =>
            metric === "pointPct"
              ? yScale(getMetricValue(d, metric) - 50)
              : metric === "points"
                ? yScale(d.points - d.gamesPlayed)
                : yScale(getMetricValue(d, metric))
          )
          .attr("r", 3)
          .attr("fill", color)
          .attr("opacity", 0.8)
          .on("mouseover", function (event, d) {
            d3.select(this).transition().duration(200).attr("r", 5);
            d3.select(tooltipRef.current).style("display", "block").html(`
                ${abbr}<br/>
                GP: ${d.gamesPlayed}<br/>
                Value: ${
                  metric === "pointPct"
                    ? (getMetricValue(d, metric) - 50).toFixed(2)
                    : metric === "points"
                      ? (d.points - d.gamesPlayed).toFixed(2)
                      : getMetricValue(d, metric).toFixed(2)
                }
              `);
          })
          .on("mousemove", (event) => {
            const containerRect = svgEl.getBoundingClientRect();
            const xPos = event.clientX - containerRect.left;
            const yPos = event.clientY - containerRect.top;
            d3.select(tooltipRef.current)
              .style("left", `${xPos + 15}px`)
              .style("top", `${yPos - 28}px`);
          })
          .on("mouseout", function () {
            d3.select(this).transition().duration(200).attr("r", 3);
            d3.select(tooltipRef.current).style("display", "none");
          });
        const lastPoint = sortedData[sortedData.length - 1];
        teamG
          .append("svg:image")
          .attr("xlink:href", `/teamLogos/${abbr || "default"}.png`)
          .attr("x", xScale(lastPoint.gamesPlayed) + 5)
          .attr("y", () =>
            metric === "pointPct"
              ? yScale(getMetricValue(lastPoint, metric) - 50) - 10
              : metric === "points"
                ? yScale(lastPoint.points - lastPoint.gamesPlayed) - 10
                : yScale(getMetricValue(lastPoint, metric)) - 10
          )
          .attr("width", 20)
          .attr("height", 20);
      }

      // Group hover (with a 1‑sec delay)
      teamG
        .on("mouseover", function () {
          const teamGroup = d3.select(this);
          const timer = setTimeout(() => {
            teamGroup
              .select("path.team-line")
              .transition()
              .duration(200)
              .attr("stroke-width", 3)
              .attr("filter", "url(#whiteDropShadow)");
            teamGroup
              .selectAll("circle")
              .transition()
              .duration(200)
              .attr("r", 5)
              .attr("opacity", 1);
            teamGroup
              .selectAll("svg\\:image, image")
              .transition()
              .duration(200)
              .attr("width", 40)
              .attr("height", 40);
            mainG
              .selectAll("g.team-group")
              .filter(function () {
                return this !== teamGroup.node();
              })
              .transition()
              .duration(200)
              .attr("opacity", 0.2);
            teamGroup.property("hoverActive", true);
          }, 1000);
          teamGroup.property("hoverTimer", timer);
        })
        .on("mouseout", function () {
          const teamGroup = d3.select(this);
          const timer = teamGroup.property("hoverTimer");
          if (timer) {
            clearTimeout(timer);
            teamGroup.property("hoverTimer", null);
          }
          if (teamGroup.property("hoverActive")) {
            teamGroup
              .select("path.team-line")
              .transition()
              .duration(200)
              .attr("stroke-width", 1.5)
              .attr("filter", null);
            teamGroup
              .selectAll("circle")
              .transition()
              .duration(200)
              .attr("r", 3)
              .attr("opacity", 0.8);
            teamGroup
              .selectAll("svg\\:image, image")
              .transition()
              .duration(200)
              .attr("width", 20)
              .attr("height", 20);
            mainG
              .selectAll("g.team-group")
              .transition()
              .duration(200)
              .attr("opacity", 1);
            teamGroup.property("hoverActive", false);
          }
        });
    });

    // Draw X axis
    const xAxis = d3.axisBottom(xScale).ticks(10);
    mainG
      .append("g")
      .attr("transform", `translate(0, ${innerHeight})`)
      .call(xAxis);
    // Draw Y axis
    mainG.append("g").call(yAxis);

    // Baseline at 0 for pointPct or points
    if (metric === "pointPct" || metric === "points") {
      mainG
        .append("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", yScale(0))
        .attr("y2", yScale(0))
        .attr("stroke", "#fff")
        .attr("stroke-dasharray", "6,2")
        .attr("opacity", 0.5);

      mainG
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -margin.left + 15)
        .attr("fill", "#fff")
        .attr("text-anchor", "middle")
        .text(metric === "pointPct" ? "% above .500" : "Points Above .500");
    }

    // Append drop shadow filter
    svg
      .append("defs")
      .append("filter")
      .attr("id", "whiteDropShadow")
      .append("feDropShadow")
      .attr("dx", 0)
      .attr("dy", 0)
      .attr("stdDeviation", 2)
      .attr("flood-color", "white")
      .attr("flood-opacity", 0.5);
  }, [
    data,
    metric,
    selectedConference,
    selectedDivision,
    rolling5,
    rolling10,
    selectedTeams,
    width,
    height
  ]);

  // -------------------------------
  // TEAM TOGGLE PANEL – Sorted by Division in 2 Columns
  // -------------------------------
  const teamsByDivision = useMemo(() => {
    const divisions: { [key: string]: string[] } = {};
    data.forEach((teamData, teamName) => {
      if (teamData.length === 0) return;
      const firstRecord = teamData[0];
      if (
        (selectedConference === "All" ||
          firstRecord.conference === selectedConference) &&
        (selectedDivision === "All" ||
          firstRecord.division === selectedDivision)
      ) {
        const abbr = teamNameToAbbreviationMap[teamName];
        if (!abbr) return;
        if (!divisions[firstRecord.division]) {
          divisions[firstRecord.division] = [];
        }
        divisions[firstRecord.division].push(abbr);
      }
    });
    Object.keys(divisions).forEach((div) => divisions[div].sort());
    return divisions;
  }, [data, selectedConference, selectedDivision]);

  // Define the two columns for team toggles.
  const leftDivisions = ["Atlantic", "Central"];
  const rightDivisions = ["Metropolitan", "Pacific"];

  const selectAllTeams = () => {
    const allTeams: string[] = [];
    Object.values(teamsByDivision).forEach((arr) => allTeams.push(...arr));
    setSelectedTeams(allTeams);
  };

  const clearAllTeams = () => setSelectedTeams([]);

  return (
    <div className={styles.teamStandingsChart}>
      <div className={styles.chartAndToggles}>
        <div className={styles.leftColumn}>
          {/* Filters */}
          <div className={styles.filters}>
            <label>Conference: </label>
            <select
              value={selectedConference}
              onChange={(e) => setSelectedConference(e.target.value)}
            >
              <option value="All">All</option>
              {/* You can populate dynamic options here */}
            </select>
            <label>Division: </label>
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
            >
              <option value="All">All</option>
              {/* You can populate dynamic options here */}
            </select>
            <label>Metric: </label>
            <select
              value={metric}
              onChange={(e) => {
                setMetric(e.target.value as NumericMetric);
                if (
                  e.target.value === "penaltyKillPct" ||
                  e.target.value === "powerPlayPct" ||
                  e.target.value === "goalsForPerGame" ||
                  e.target.value === "goalsAgainstPerGame"
                ) {
                  setRolling5(true);
                  setRolling10(false);
                } else {
                  setRolling5(false);
                  setRolling10(false);
                }
                // Reset team selection to all visible teams.
                const allTeams: string[] = [];
                Object.values(teamsByDivision).forEach((arr) => {
                  allTeams.push(...arr);
                });
                setSelectedTeams(allTeams);
              }}
            >
              <option value="points">Points</option>
              <option value="pointPct">Point Percentage</option>
              <option value="goalsAgainstPerGame">Goals Against/Game</option>
              <option value="goalsForPerGame">Goals For/Game</option>
              <option value="penaltyKillPct">PK%</option>
              <option value="powerPlayPct">PP%</option>
              {/* <option value="shotsAgainstPerGame">Shots Against/Game</option>
              <option value="shotsForPerGame">Shots For/Game</option> */}
            </select>
            {(metric === "penaltyKillPct" ||
              metric === "powerPlayPct" ||
              metric === "goalsAgainstPerGame" ||
              metric === "goalsForPerGame") && (
              <div className={styles.rollingToggles}>
                <label>
                  <input
                    type="checkbox"
                    checked={rolling5}
                    onChange={(e) => setRolling5(e.target.checked)}
                  />
                  5GM Rolling Avg
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={rolling10}
                    onChange={(e) => setRolling10(e.target.checked)}
                  />
                  10GM Rolling Avg
                </label>
              </div>
            )}
          </div>

          {/* Chart container (responsive via useResizeObserver) */}
          <div ref={containerRef} className={styles.chartContainer}>
            <svg ref={svgRef} className={styles.chartSvg} />
          </div>
        </div>

        {/* Team Toggle Panel */}
        <div className={styles.teamToggles}>
          <div className={styles.toggleButtons}>
            <button onClick={selectAllTeams}>Select All</button>
            <button onClick={clearAllTeams}>Clear All</button>
          </div>
          <div className={styles.toggleList}>
            <div className={styles.toggleColumn}>
              {leftDivisions.map((div) => (
                <div key={div}>
                  <strong>{div}</strong>
                  {teamsByDivision[div]?.map((abbr) => (
                    <label key={abbr} className={styles.teamToggle}>
                      <input
                        type="checkbox"
                        checked={selectedTeams.includes(abbr)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTeams((prev) => [...prev, abbr]);
                          } else {
                            setSelectedTeams((prev) =>
                              prev.filter((t) => t !== abbr)
                            );
                          }
                        }}
                      />
                      <img
                        src={`/teamLogos/${abbr ?? "default"}.png`}
                        alt={abbr}
                        className={styles.toggleLogo}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <div className={styles.toggleColumn}>
              {rightDivisions.map((div) => (
                <div key={div}>
                  <strong>{div === "Metropolitan" ? "Metro" : div}</strong>
                  {teamsByDivision[div]?.map((abbr) => (
                    <label key={abbr} className={styles.teamToggle}>
                      <input
                        type="checkbox"
                        checked={selectedTeams.includes(abbr)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTeams((prev) => [...prev, abbr]);
                          } else {
                            setSelectedTeams((prev) =>
                              prev.filter((t) => t !== abbr)
                            );
                          }
                        }}
                      />
                      <img
                        src={`/teamLogos/${abbr ?? "default"}.png`}
                        alt={abbr}
                        className={styles.toggleLogo}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      <div ref={tooltipRef} className={styles.tooltip} />
    </div>
  );
};

export default TeamStandingsChart;
