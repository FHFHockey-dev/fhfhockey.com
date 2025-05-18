import React, { useRef, useEffect, useLayoutEffect, useState } from "react";
import {
  ShotData,
  EVENT_TYPES,
  GAME_TYPES,
  ShotDataFilters
} from "hooks/useShotData";
import styles from "styles/TeamStatsPage.module.scss";
import * as d3 from "d3";
import { hexbin as d3Hexbin, HexbinBin } from "d3-hexbin";

interface ShotVisualizationProps {
  shotData: ShotData[];
  opponentShotData?: ShotData[];
  isLoading: boolean;
  onFilterChange?: (filters: ShotDataFilters) => void;
  filters?: ShotDataFilters;
  teamAbbreviation?: string;
}

/**
 * Component that displays shot data visualization on a hockey rink
 * Avoids direct DOM manipulation by using a key to force re-render
 */
export function ShotVisualization({
  shotData,
  opponentShotData = [],
  isLoading,
  onFilterChange,
  filters = {
    eventTypes: ["goal", "shot-on-goal"],
    gameTypes: [GAME_TYPES.REGULAR_SEASON]
  },
  teamAbbreviation
}: ShotVisualizationProps) {
  // Use component key approach - whenever shotData changes, we'll remount the component
  // This avoids React DOM manipulation conflicts
  const [key, setKey] = useState(0);

  // Track selected event types and game types
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>(
    filters.eventTypes || ["goal", "shot-on-goal"]
  );
  const [selectedGameTypes, setSelectedGameTypes] = useState<string[]>(
    filters.gameTypes || [GAME_TYPES.REGULAR_SEASON]
  );

  // Event type display names for better UI
  const eventTypeLabels: Record<string, string> = {
    "blocked-shot": "Blocked Shots",
    "delayed-penalty": "Delayed Penalties",
    faceoff: "Faceoffs",
    "failed-shot-attempt": "Failed Shot Attempts",
    "game-end": "Game End",
    giveaway: "Giveaways",
    goal: "Goals",
    hit: "Hits",
    "missed-shot": "Missed Shots",
    penalty: "Penalties",
    "period-end": "Period End",
    "period-start": "Period Start",
    "shootout-complete": "Shootout Complete",
    "shot-on-goal": "Shots on Goal",
    stoppage: "Stoppages",
    takeaway: "Takeaways"
  };

  // Game type labels
  const gameTypeLabels: Record<string, string> = {
    [GAME_TYPES.PRESEASON]: "Preseason",
    [GAME_TYPES.REGULAR_SEASON]: "Regular Season",
    [GAME_TYPES.PLAYOFFS]: "Playoffs"
  };

  useEffect(() => {
    // Increment key when shotData changes to trigger complete re-render
    setKey((prevKey) => prevKey + 1);
  }, [shotData, isLoading]);

  // Handle event type selection changes
  const handleEventTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = e.target.selectedOptions;
    const values = Array.from(options).map((option) => option.value);
    setSelectedEventTypes(values);

    if (onFilterChange) {
      onFilterChange({
        ...filters,
        eventTypes: values
      });
    }
  };

  // Handle game type selection changes
  const handleGameTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = e.target.selectedOptions;
    const values = Array.from(options).map((option) => option.value);
    setSelectedGameTypes(values);

    if (onFilterChange) {
      onFilterChange({
        ...filters,
        gameTypes: values
      });
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          minHeight: "300px"
        }}
      >
        Loading shot data...
      </div>
    );
  }

  return (
    <div style={{ width: "100%", minHeight: "400px" }}>
      {/* Filter controls */}
      <div className={styles.filterControls}>
        <div className={styles.filterGroup}>
          <label htmlFor="eventTypeFilter">Event Types:</label>
          <select
            id="eventTypeFilter"
            multiple
            value={selectedEventTypes}
            onChange={handleEventTypeChange}
            className={styles.filterSelect}
          >
            {EVENT_TYPES.map((eventType) => (
              <option key={eventType} value={eventType}>
                {eventTypeLabels[eventType] || eventType}
              </option>
            ))}
          </select>
          <small>Hold Ctrl/Cmd to select multiple</small>
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="gameTypeFilter">Game Types:</label>
          <select
            id="gameTypeFilter"
            multiple
            value={selectedGameTypes}
            onChange={handleGameTypeChange}
            className={styles.filterSelect}
          >
            {Object.entries(GAME_TYPES).map(([key, value]) => (
              <option key={value} value={value}>
                {gameTypeLabels[value] || key}
              </option>
            ))}
          </select>
          <small>Hold Ctrl/Cmd to select multiple</small>
        </div>
      </div>

      {shotData.length === 0 ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
            minHeight: "300px"
          }}
        >
          No event data available for the selected filters
        </div>
      ) : (
        // Use the key to force a complete remount of the inner component
        <InnerShotVisualization
          key={key}
          shotData={shotData}
          opponentShotData={opponentShotData}
          teamAbbreviation={teamAbbreviation}
        />
      )}
    </div>
  );
}

/**
 * Inner component that handles the actual rendering of the hockey rink and shot data
 * This component gets remounted whenever the key changes in the parent
 */
function InnerShotVisualization({
  shotData,
  opponentShotData = [],
  teamAbbreviation
}: {
  shotData: ShotData[];
  opponentShotData?: ShotData[];
  teamAbbreviation?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState({
    eventCount: 0,
    goalCount: 0,
    shootingPct: "0.0"
  });

  // Create the visualization once on mount
  useLayoutEffect(() => {
    // Import here to avoid SSR issues
    const { drawHockeyRink } = require("lib/drawHockeyRink");

    if (!containerRef.current) return;

    // Draw the rink
    drawHockeyRink(containerRef.current);

    // Get SVG element
    const svg = containerRef.current.querySelector("svg");
    if (!svg) return;

    // Draw the team logo on the left side of the ice surface
    if (teamAbbreviation) {
      d3.select(svg)
        .append("image")
        .attr("href", `/teamLogos/${teamAbbreviation}.png`)
        .attr("x", 44)
        .attr("y", 28)
        .attr("width", 30)
        .attr("height", 30)
        .attr("opacity", 0.5);
    }

    // Get viewBox dimensions
    const viewBox = svg.getAttribute("viewBox")?.split(" ").map(Number) || [
      -2, -2, 204, 89
    ];
    const viewBoxWidth = viewBox[2];
    const viewBoxHeight = viewBox[3];

    // NHL Rink dimensions
    const rinkLength = 200;
    const rinkWidth = 85;

    // Calculate event statistics
    const goals = shotData.filter((d) => d.typedesckey === "goal");
    const shots = shotData.filter((d) => d.typedesckey === "shot-on-goal");

    const goalCount = goals.length;
    const shotCount = shots.length;
    const eventCount = shotData.length;

    // Calculate shooting percentage if we have both shots and goals
    const shootingPct =
      shotCount > 0 ? ((goalCount / shotCount) * 100).toFixed(1) : "0.0";

    setStats({ eventCount, goalCount, shootingPct });

    // Function to map NHL coordinates to SVG space (ice surface is 200x85 at (0,0)-(200,85))
    // Fold right half to left and invert y for those points
    const transformCoords = (x: number, y: number): [number, number] => {
      if (x > 0) {
        return [-x, -y];
      } else {
        return [x, y];
      }
    };
    const mapXToSvg = (x: number): number => x + 100;
    const mapYToSvg = (y: number): number => y + 42.5;

    // Prepare shot data points in [x, y] SVG space (team events, left)
    const points: [number, number][] = shotData
      .filter(
        (shot) =>
          shot.xcoord !== null &&
          shot.ycoord !== null &&
          typeof shot.xcoord === "number" &&
          typeof shot.ycoord === "number"
      )
      .map((shot) => {
        const [tx, ty] = transformCoords(shot.xcoord, shot.ycoord);
        return [mapXToSvg(tx), mapYToSvg(ty)];
      });

    // Prepare opponent shot data points in [x, y] SVG space (opponent events, right)
    const transformOpponentCoords = (
      x: number,
      y: number
    ): [number, number] => {
      if (x < 0) {
        return [-x, -y];
      } else {
        return [x, y];
      }
    };
    const opponentPoints: [number, number][] = opponentShotData
      .filter(
        (shot) =>
          shot.xcoord !== null &&
          shot.ycoord !== null &&
          typeof shot.xcoord === "number" &&
          typeof shot.ycoord === "number"
      )
      .map((shot) => {
        const [tx, ty] = transformOpponentCoords(shot.xcoord, shot.ycoord);
        return [mapXToSvg(tx), mapYToSvg(ty)];
      });

    // Create a hexbin generator with even smaller hexagons
    const hexbin = d3Hexbin<[number, number]>()
      .x((d) => d[0])
      .y((d) => d[1])
      .radius(1.5) // Even smaller hexagons
      .extent([
        [0, 0],
        [viewBoxWidth, viewBoxHeight]
      ]);

    // --- TEAM EVENTS (LEFT) ---
    const bins: HexbinBin<[number, number]>[] = hexbin(points);
    const binMap = new Map<string, number>();
    bins.forEach((bin) => {
      binMap.set(`${bin.x},${bin.y}`, bin.length);
    });
    const allCenters: [number, number][] = hexbin.centers();
    const maxBin =
      d3.max(bins, (d: HexbinBin<[number, number]>) => d.length) || 1;
    // Good color scale: purple (low) → blue (mid) → green (high)
    const teamColor = d3
      .scaleLinear<string>()
      .domain([0, Math.log1p(maxBin) / 2, Math.log1p(maxBin)])
      .range(["#7b2ff2", "#00c6fb", "#00ff87"]); // purple → blue → green
    d3.select(svg)
      .append("g")
      .attr("class", "hexbin-heatmap team")
      .attr("clip-path", "url(#rink-clip)")
      .selectAll<SVGPathElement, [number, number]>("path")
      .data(allCenters)
      .enter()
      .append("path")
      .attr("d", () => hexbin.hexagon())
      .attr("transform", (d: [number, number]) => `translate(${d[0]},${d[1]})`)
      .attr("fill", (d: [number, number]) => {
        const count = binMap.get(`${d[0]},${d[1]}`) || 0;
        if (count === 0) return "#b0b8c9";
        return teamColor(Math.log1p(count));
      })
      .attr("stroke", "#dcdcdc") //#d0d0d0
      // lines between hexagons
      .attr("stroke-width", 0.2)
      .attr("opacity", 0.7);

    // --- OPPONENT EVENTS (RIGHT) ---
    const oppBins: HexbinBin<[number, number]>[] = hexbin(opponentPoints);
    const oppBinMap = new Map<string, number>();
    oppBins.forEach((bin) => {
      oppBinMap.set(`${bin.x},${bin.y}`, bin.length);
    });
    const oppMaxBin =
      d3.max(oppBins, (d: HexbinBin<[number, number]>) => d.length) || 1;
    // Bad color scale: yellow (low) → orange (mid) → red (high)
    const oppColor = d3
      .scaleLinear<string>()
      .domain([0, Math.log1p(oppMaxBin) / 2, Math.log1p(oppMaxBin)])
      .range(["#fff700", "#ff9100", "#ff1744"]); // yellow → orange → red
    d3.select(svg)
      .append("g")
      .attr("class", "hexbin-heatmap opponent")
      .attr("clip-path", "url(#rink-clip)")
      .selectAll<SVGPathElement, [number, number]>("path")
      .data(allCenters)
      .enter()
      .append("path")
      .attr("d", () => hexbin.hexagon())
      .attr("transform", (d: [number, number]) => `translate(${d[0]},${d[1]})`)
      .attr("fill", (d: [number, number]) => {
        const count = oppBinMap.get(`${d[0]},${d[1]}`) || 0;
        if (count === 0) return "#e0e7d7";
        return oppColor(Math.log1p(count));
      })
      .attr("stroke", "#dcdcdc")
      .attr("stroke-width", 0.2)
      .attr("opacity", 0.4);

    // --- LEGENDS ---
    d3.select(containerRef.current).selectAll(".hexbin-legend").remove();
    const legendWidth = 200;
    const legendHeight = 16;
    const legendBins = 120;
    const minVal = 0;
    const maxVal = maxBin;
    const midVal = Math.round(maxVal / 2);
    const logMin = Math.log1p(minVal);
    const logMax = Math.log1p(maxVal);
    const logMid = Math.log1p(midVal);

    // Team legend
    const teamLegendSvg = d3
      .select(containerRef.current)
      .append("svg")
      .attr("width", legendWidth)
      .attr("height", legendHeight + 30)
      .attr("class", "hexbin-legend team-legend")
      .style("display", "block")
      .style("margin", "10px auto 0 auto");

    const teamDefs = teamLegendSvg.append("defs");
    const teamGradient = teamDefs
      .append("linearGradient")
      .attr("id", "hexbin-gradient-team")
      .attr("x1", "0%")
      .attr("x2", "100%")
      .attr("y1", "0%")
      .attr("y2", "0%");
    for (let i = 0; i <= legendBins; i++) {
      const t = i / legendBins;
      const logVal = logMin + t * (logMax - logMin);
      teamGradient
        .append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", teamColor(logVal));
    }

    teamLegendSvg
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#hexbin-gradient-team)");

    // Draw axis labels (min, mid, max) using the original (not log) values
    const teamAxisScale = d3
      .scaleLinear()
      .domain([logMin, logMax])
      .range([0, legendWidth]);
    const teamAxis = teamLegendSvg.append("g");
    const teamTickVals = [minVal, midVal, maxVal];
    teamAxis
      .selectAll("text")
      .data(teamTickVals)
      .enter()
      .append("text")
      .attr("x", (d) => teamAxisScale(Math.log1p(d)))
      .attr("y", legendHeight + 14)
      .attr("text-anchor", (d, i) =>
        i === 0 ? "start" : i === 2 ? "end" : "middle"
      )
      .attr("font-size", 12)
      .attr("fill", "#fff")
      .text((d) => d);
    teamLegendSvg
      .append("text")
      .attr("x", legendWidth / 2)
      .attr("y", legendHeight + 28)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", "#fff")
      .text("Your Team Event Frequency");

    // Opponent legend
    const oppLegendWidth = 200;
    const oppLegendHeight = 16;
    const oppLegendBins = 120;
    const oppMinVal = 0;
    const oppMaxVal = oppMaxBin;
    const oppMidVal = Math.round(oppMaxVal / 2);
    const oppLogMin = Math.log1p(oppMinVal);
    const oppLogMax = Math.log1p(oppMaxVal);
    const oppLogMid = Math.log1p(oppMidVal);

    const oppLegendSvg = d3
      .select(containerRef.current)
      .append("svg")
      .attr("width", oppLegendWidth)
      .attr("height", oppLegendHeight + 30)
      .attr("class", "hexbin-legend opponent-legend")
      .style("display", "block")
      .style("margin", "10px auto 0 auto");

    const oppDefs = oppLegendSvg.append("defs");
    const oppGradient = oppDefs
      .append("linearGradient")
      .attr("id", "hexbin-gradient-opponent")
      .attr("x1", "0%")
      .attr("x2", "100%")
      .attr("y1", "0%")
      .attr("y2", "0%");
    for (let i = 0; i <= oppLegendBins; i++) {
      const t = i / oppLegendBins;
      const logVal = oppLogMin + t * (oppLogMax - oppLogMin);
      oppGradient
        .append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", oppColor(logVal));
    }

    oppLegendSvg
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", oppLegendWidth)
      .attr("height", oppLegendHeight)
      .style("fill", "url(#hexbin-gradient-opponent)");

    // Draw axis labels (min, mid, max) using the original (not log) values
    const oppAxisScale = d3
      .scaleLinear()
      .domain([oppLogMin, oppLogMax])
      .range([0, oppLegendWidth]);
    const oppAxis = oppLegendSvg.append("g");
    const oppTickVals = [oppMinVal, oppMidVal, oppMaxVal];
    oppAxis
      .selectAll("text")
      .data(oppTickVals)
      .enter()
      .append("text")
      .attr("x", (d) => oppAxisScale(Math.log1p(d)))
      .attr("y", oppLegendHeight + 14)
      .attr("text-anchor", (d, i) =>
        i === 0 ? "start" : i === 2 ? "end" : "middle"
      )
      .attr("font-size", 12)
      .attr("fill", "#fff")
      .text((d) => d);
    oppLegendSvg
      .append("text")
      .attr("x", oppLegendWidth / 2)
      .attr("y", oppLegendHeight + 28)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", "#fff")
      .text("Opponent Event Frequency");

    console.log("Opponent shot data count:", opponentShotData.length);
    console.log("Sample opponent shot:", opponentShotData[0]);
    console.log("Total opponent shots collected:", opponentShotData.length);

    // We don't need to clean up anything since this component will be unmounted and recreated
    // completely when data changes
  }, [shotData, opponentShotData, teamAbbreviation]);

  return (
    <div style={{ width: "100%", minHeight: "400px" }}>
      {/* Container for hockey rink and shots */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          minHeight: "300px",
          position: "relative"
        }}
      ></div>

      {/* Statistics display outside of the SVG */}
      <div
        style={{
          margin: "10px 0",
          padding: "10px",
          borderRadius: "4px"
        }}
      >
        <p style={{ margin: "5px 0", fontWeight: "bold" }}>
          Total Events: {stats.eventCount}
        </p>
        {stats.goalCount > 0 && (
          <>
            <p style={{ margin: "5px 0", fontWeight: "bold" }}>
              Goals: {stats.goalCount}
            </p>
            <p style={{ margin: "5px 0", fontWeight: "bold" }}>
              Shooting %: {stats.shootingPct}%
            </p>
          </>
        )}
      </div>
    </div>
  );
}
