import React, { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import useCurrentSeason from "hooks/useCurrentSeason";
import { format, isAfter } from "date-fns";
import { teamsInfo, teamNameToAbbreviationMap } from "lib/teamsInfo";
import supabase from "lib/supabase/client";
import styles from "./TeamStandingsChart.module.scss";

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
  conference: string;
  division: string;
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
  // For percentage metrics, multiply by 100.
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

/**
 * Compute a rolling average series that excludes data points before the window is full.
 * That is, if windowSize=5, only points from game 5 onward are included.
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
    // Use the last record in the window as the basis (for gamesPlayed and other fields)
    return { ...data[i + windowSize - 1], [metric]: avg };
  });
}

// -------------------------------
// MAIN COMPONENT
// -------------------------------
const TeamStandingsChart: React.FC = () => {
  const season = useCurrentSeason();
  const [data, setData] = useState<Map<string, TeamData[]>>(new Map());
  const [metric, setMetric] = useState<NumericMetric>("pointPct");

  // Filter states.
  const [selectedConference, setSelectedConference] = useState<string>("All");
  const [selectedDivision, setSelectedDivision] = useState<string>("All");

  // Rolling average toggles (only relevant for PK% and PP%).
  // For these metrics, default to 5GM rolling avg (daily data hidden).
  const [rolling5, setRolling5] = useState<boolean>(false);
  const [rolling10, setRolling10] = useState<boolean>(false);

  // Team toggle state: array of team abbreviations selected for display.
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  const chartRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

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

      const teamStatsMap = new Map<string, any>();
      teamStatsRows.forEach((row) => {
        const key = `${row.date}_${row.franchise_name}`;
        teamStatsMap.set(key, row);
      });

      const dailyData = standingsRows.map((row) => {
        const gp = row.games_played || 0;
        const key = `${row.date}_${row.team_name_default}`;
        const stats = teamStatsMap.get(key);
        return {
          franchiseName: row.team_name_default,
          gamesPlayed: gp,
          // For PK%/PP%, if no games then default to 0.5 (i.e. 50%)
          pointPct: gp > 0 ? row.point_pctg || 0 : 0.5,
          points: row.points || 0,
          goalsAgainstPerGame: gp > 0 ? (row.goal_against ?? 0) / gp : 0,
          goalsForPerGame: gp > 0 ? (row.goal_for ?? 0) / gp : 0,
          penaltyKillPct: stats ? stats.penalty_kill_pct : 0,
          powerPlayPct: stats ? stats.power_play_pct : 0,
          shotsAgainstPerGame: 0,
          shotsForPerGame: 0,
          conference: row.conference_abbrev || "N/A",
          division: row.division_name || "N/A"
        } as TeamData;
      });

      const accumulatedData = processDailyData(new Map(), dailyData);
      setData(accumulatedData);
    };

    fetchData();
  }, [season]);

  // -------------------------------
  // RESET TEAM TOGGLES & ROLLING OPTIONS WHEN FILTERS CHANGE
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
          teams.push(abbr);
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
  // DRAW CHART WITH D3 (Grouped Hover Effects with 1‑sec Delay)
  // -------------------------------
  useEffect(() => {
    if (data.size === 0) return;
    const svg = d3.select(chartRef.current);
    const tooltip = d3.select(tooltipRef.current);
    svg.selectAll("*").remove();

    // Adjust inner width to leave space on the right for team toggles.
    const fullWidth = chartRef.current?.clientWidth || 800;
    const togglePanelWidth = 150;
    const width = fullWidth - togglePanelWidth;
    const height = chartRef.current?.clientHeight || 800;
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

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
    let yAxis: d3.Axis<number | { valueOf(): number }>;
    if (metric === "pointPct") {
      yScale = d3
        .scaleLinear()
        .domain([-50, 50])
        .range([innerHeight, 0])
        .nice();
      yAxis = d3
        .axisLeft(yScale)
        .ticks(5)
        .tickFormat((d: any) => (d > 0 ? `+${d}` : d.toString()));
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
      yAxis = d3
        .axisLeft(yScale)
        .ticks(5)
        .tickFormat((d: any) => (d > 0 ? `+${d}` : d.toString()));
    } else {
      yScale = d3
        .scaleLinear()
        .domain([0, getYDomainMax(metric)])
        .range([innerHeight, 0])
        .nice();
      yAxis = d3.axisLeft(yScale).ticks(6);
    }

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

    // Determine if we should use rolling averages (for PK% or PP%)
    const useRolling =
      (metric === "penaltyKillPct" || metric === "powerPlayPct") &&
      (rolling5 || rolling10);

    // For each team (only those toggled on)
    data.forEach((teamData, teamName) => {
      const abbr = teamNameToAbbreviationMap[teamName];
      if (teamData.length === 0 || !selectedTeams.includes(abbr)) return;
      if (
        (selectedConference !== "All" &&
          teamData[0].conference !== selectedConference) ||
        (selectedDivision !== "All" &&
          teamData[0].division !== selectedDivision)
      ) {
        return;
      }
      // Sort by gamesPlayed.
      const sortedData = [...teamData].sort(
        (a, b) => a.gamesPlayed - b.gamesPlayed
      );
      const color = teamsInfo[abbr]?.lightColor || "#999";

      // Create a group for this team and set up properties for delayed hover.
      const teamG = mainG
        .append("g")
        .attr("class", `team-group team-${abbr}`)
        .attr("data-team", abbr)
        .property("hoverTimer", null)
        .property("hoverActive", false);

      if (useRolling) {
        // Build rolling series – note: we filter out data before the window is complete.
        const seriesList: {
          data: TeamData[];
          label: string;
          strokeDash?: string;
        }[] = [];
        if (rolling5) {
          seriesList.push({
            data: computeRollingAverageFiltered(sortedData, 5, metric),
            label: "5GM Rolling",
            strokeDash: "4,2"
          });
        }
        if (rolling10) {
          seriesList.push({
            data: computeRollingAverageFiltered(sortedData, 10, metric),
            label: "10GM Rolling",
            strokeDash: "2,2"
          });
        }
        // For each rolling series, draw a path and place a logo at its final point.
        seriesList.forEach((s) => {
          // Only draw if there is data in the series.
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
            // (Optional) You could add circles here if desired.
            // Place the team logo at the last point of this rolling series.
            const lastPoint = s.data[s.data.length - 1];
            teamG
              .append("svg:image")
              .attr("xlink:href", `/teamLogos/${abbr}.png`)
              .attr("x", xScale(lastPoint.gamesPlayed) + 5)
              .attr("y", () => {
                const m = metric as NumericMetric;
                return m === "pointPct"
                  ? yScale(getMetricValue(lastPoint, m) - 50) - 10
                  : m === "points"
                  ? yScale(lastPoint.points - lastPoint.gamesPlayed) - 10
                  : yScale(getMetricValue(lastPoint, m)) - 10;
              })
              .attr("width", 20)
              .attr("height", 20);
          }
        });
      } else {
        // Draw daily series.
        teamG
          .append("path")
          .datum(sortedData)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", 1.5)
          .attr("opacity", 0.8)
          .attr("class", "team-line")
          .attr("d", lineGenerator);
        // Draw circles for daily data.
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
            tooltip.style("display", "block").html(`
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
          .on("mousemove", function (event) {
            const containerRect = chartRef.current?.getBoundingClientRect();
            if (!containerRect) return;
            const xPos = event.clientX - containerRect.left;
            const yPos = event.clientY - containerRect.top;
            tooltip
              .style("left", `${xPos + 15}px`)
              .style("top", `${yPos - 28}px`);
          })
          .on("mouseout", function () {
            d3.select(this).transition().duration(200).attr("r", 3);
            tooltip.style("display", "none");
          });
        // Append team logo at the last daily data point.
        const lastPoint = sortedData[sortedData.length - 1];
        teamG
          .append("svg:image")
          .attr("xlink:href", `/teamLogos/${abbr}.png`)
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

      // Attach hover handlers on the entire team group with a 1‑second delay.
      teamG
        .on("mouseover", function (event) {
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
            // Fade all other teams.
            mainG
              .selectAll("g.team-group")
              .filter(function () {
                return this !== teamGroup.node();
              })
              .transition()
              .duration(200)
              .attr("opacity", 0.5);
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

    // Draw X axis.
    const xAxis = d3.axisBottom(xScale).ticks(10);
    mainG
      .append("g")
      .attr("transform", `translate(0, ${innerHeight})`)
      .call(xAxis);
    // Draw Y axis.
    mainG.append("g").call(yAxis);
    // Draw horizontal dotted baseline at y=0 if applicable.
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
  }, [
    data,
    metric,
    selectedConference,
    selectedDivision,
    rolling5,
    rolling10,
    selectedTeams
  ]);

  // -------------------------------
  // TEAM TOGGLE PANEL (Right Side)
  // -------------------------------
  const visibleTeams = useMemo(() => {
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
          teams.push(abbr);
        }
      }
    });
    return teams.sort();
  }, [data, selectedConference, selectedDivision]);

  const uniqueConferences = useMemo(() => {
    const conferences = new Set<string>();
    data.forEach((teamData) => {
      if (teamData.length > 0) {
        conferences.add(teamData[0].conference);
      }
    });
    return Array.from(conferences).sort();
  }, [data]);

  const uniqueDivisions = useMemo(() => {
    const divisions = new Set<string>();
    data.forEach((teamData) => {
      if (teamData.length > 0) {
        divisions.add(teamData[0].division);
      }
    });
    return Array.from(divisions).sort();
  }, [data]);

  const selectAllTeams = () => setSelectedTeams(visibleTeams);
  const clearAllTeams = () => setSelectedTeams([]);

  // -------------------------------
  // RENDER UI: Filters, Chart & Team Toggle Panel
  // -------------------------------
  return (
    <div className={styles.teamStandingsChart}>
      <div className={styles.chartAndToggles}>
        <div className={styles.leftColumn}>
          <div className={styles.filters}>
            <label>Conference: </label>
            <select
              value={selectedConference}
              onChange={(e) => setSelectedConference(e.target.value)}
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
              onChange={(e) => {
                setMetric(e.target.value as NumericMetric);
                if (
                  e.target.value === "penaltyKillPct" ||
                  e.target.value === "powerPlayPct"
                ) {
                  setRolling5(true);
                  setRolling10(false);
                } else {
                  setRolling5(false);
                  setRolling10(false);
                }
                setSelectedTeams(visibleTeams);
              }}
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
            {(metric === "penaltyKillPct" || metric === "powerPlayPct") && (
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
          <svg ref={chartRef} className={styles.chartSvg} />
        </div>
        <div className={styles.teamToggles}>
          <div className={styles.toggleButtons}>
            <button onClick={selectAllTeams}>Select All</button>
            <button onClick={clearAllTeams}>Clear All</button>
          </div>
          <div className={styles.toggleList}>
            {visibleTeams.map((abbr) => (
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
                  src={`/teamLogos/${abbr}.png`}
                  alt={abbr}
                  className={styles.toggleLogo}
                />
              </label>
            ))}
          </div>
        </div>
      </div>
      <div ref={tooltipRef} className={styles.tooltip} />
    </div>
  );
};

export default TeamStandingsChart;
