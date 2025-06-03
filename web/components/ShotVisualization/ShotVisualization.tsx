import React, {
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback
} from "react";
import {
  ShotData,
  EVENT_TYPES,
  GAME_TYPES,
  ShotDataFilters
} from "hooks/useShotData";
import styles from "styles/TeamStatsPage.module.scss";
import * as d3 from "d3";
import { hexbin as d3Hexbin, HexbinBin } from "d3-hexbin";
import { teamsInfo } from "lib/teamsInfo";

interface ShotVisualizationProps {
  shotData: ShotData[];
  opponentShotData?: ShotData[];
  isLoading: boolean;
  onFilterChange?: (filters: ShotDataFilters) => void;
  filters?: ShotDataFilters;
  teamAbbreviation?: string;
  alwaysShowOpponentLegend?: boolean;
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
  teamAbbreviation,
  alwaysShowOpponentLegend = false
}: ShotVisualizationProps) {
  // Use component key approach - whenever shotData changes, we'll remount the component
  // This avoids React DOM manipulation conflicts
  const [key, setKey] = useState(0);
  const [teamScaleValues, setTeamScaleValues] = useState({
    min: 0,
    mid: 0,
    max: 0
  });
  const [opponentScaleValues, setOpponentScaleValues] = useState({
    min: 0,
    mid: 0,
    max: 0
  });
  const [legendsReady, setLegendsReady] = useState(false);

  // Track selected event types and game types
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>(
    filters.eventTypes || ["goal", "shot-on-goal"]
  );
  const [selectedGameTypes, setSelectedGameTypes] = useState<string[]>(
    filters.gameTypes || [GAME_TYPES.REGULAR_SEASON]
  );

  // Reset legends state when key changes
  useEffect(() => {
    setLegendsReady(false);
  }, [key]);

  // Separate handlers for team and opponent scale values
  const handleTeamScaleValuesChange = useCallback(
    (values: { min: number; mid: number; max: number }) => {
      setTeamScaleValues(values);
      setLegendsReady(true);
    },
    []
  );
  const handleOpponentScaleValuesChange = useCallback(
    (values: { min: number; mid: number; max: number }) => {
      setOpponentScaleValues(values);
      setLegendsReady(true);
    },
    []
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
    <div className={styles.shotVisualizationContainer}>
      {shotData.length === 0 ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
            width: "100%",
            minHeight: "300px"
          }}
        >
          No event data available for the selected filters
        </div>
      ) : (
        <>
          {/* Left side: Control panel */}
          <div className={styles.controlPanel}>
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

            {/* InnerShotVisualizationControls will receive and render the legends and stats */}
            <InnerShotVisualizationControls
              key={`controls-${key}`}
              shotData={shotData}
              opponentShotData={opponentShotData}
              scaleValues={{
                team: teamScaleValues,
                opponent: { min: 0, mid: 0, max: 0 }
              }}
              legendsReady={legendsReady}
              alwaysShowLegend={alwaysShowOpponentLegend}
            />
          </div>

          {/* Right side: Rink visualization */}
          <div className={styles.rinksSideBySide}>
            {/* My Team Half Rink */}
            <div className={styles.halfRinkContainer}>
              <div className={styles.rinkLabel}>
                {teamAbbreviation
                  ? teamsInfo[teamAbbreviation]?.name || teamAbbreviation
                  : "Your Team"}
              </div>
              <InnerShotVisualization
                key={`rink-myteam-${key}`}
                shotData={shotData}
                teamAbbreviation={teamAbbreviation}
                onScaleValuesChange={handleTeamScaleValuesChange}
                halfRink={true}
                side="team"
              />
            </div>
            {/* Opponent Half Rink */}
            <div className={styles.halfRinkContainer}>
              <div className={styles.rinkLabel}>Opponent</div>
              <InnerShotVisualization
                key={`rink-opponent-${key}`}
                shotData={opponentShotData}
                teamAbbreviation={teamAbbreviation}
                onScaleValuesChange={handleOpponentScaleValuesChange}
                halfRink={true}
                side="opponent"
              />
            </div>
          </div>
        </>
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
  teamAbbreviation,
  onScaleValuesChange,
  halfRink,
  side
}: {
  shotData: ShotData[];
  teamAbbreviation?: string;
  onScaleValuesChange: (values: {
    min: number;
    mid: number;
    max: number;
  }) => void;
  halfRink: boolean;
  side: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState({
    eventCount: 0,
    goalCount: 0,
    shootingPct: "0.0"
  });

  // Store bin maps and max values for sharing with control panel
  const [binMap, setBinMap] = useState<Map<string, number>>(new Map());
  const [maxBin, setMaxBin] = useState(0);

  // Create the visualization once on mount
  useLayoutEffect(() => {
    // Import here to avoid SSR issues
    const { drawHockeyRink } = require("lib/drawHockeyRink");

    if (!containerRef.current) return;

    // Draw the half rink with vertical orientation
    drawHockeyRink(containerRef.current, { vertical: true, halfRink: true });

    // Get SVG element
    const svg = containerRef.current.querySelector("svg");
    if (!svg) return;

    // Draw the team logo on the ice surface (adjusted for vertical orientation)
    if (teamAbbreviation) {
      d3.select(svg)
        .append("image")
        .attr("href", `/teamLogos/${teamAbbreviation}.png`)
        .attr("x", 28)
        .attr("y", 44)
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

    // For vertical orientation, we swap x and y coordinates and transform accordingly
    // For half-rink, we want all shots attacking toward the bottom (offensive zone at the bottom)
    // For both team and opponent, mirror as needed so that offensive zone is always at the bottom
    const transformCoords = (x: number, y: number): [number, number] => {
      if (side === "team") {
        // Team shots: always show as attacking down
        if (x > 0) {
          return [-y, -x];
        } else {
          return [-y, x];
        }
      } else {
        // Opponent shots: mirror so their offensive zone is at the TOP
        let tx, ty;
        if (x < 0) {
          tx = -y;
          ty = -x;
        } else {
          tx = -y;
          ty = x;
        }
        // Flip horizontally (mirror x axis)
        tx = -tx;
        // Flip vertically (mirror y axis for top half)
        ty = -ty;
        return [tx, ty];
      }
    };

    // Functions to map coordinates to SVG space
    const mapXToSvg = (x: number): number => x + 42.5;
    const mapYToSvg = (y: number): number => y + 100;

    // Prepare shot data points in [x, y] SVG space
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

    // Create a hexbin generator with even smaller hexagons
    const hexbin = d3Hexbin<[number, number]>()
      .x((d) => d[0])
      .y((d) => d[1])
      .radius(1.5)
      .extent([
        [0, 0],
        [viewBoxWidth, viewBoxHeight]
      ]);

    // --- EVENTS (Half Rink) ---
    const bins: HexbinBin<[number, number]>[] = hexbin(points);
    const newBinMap = new Map<string, number>();
    bins.forEach((bin) => {
      newBinMap.set(`${bin.x},${bin.y}`, bin.length);
    });

    const allCenters: [number, number][] = hexbin.centers();
    const newMaxBin =
      d3.max(bins, (d: HexbinBin<[number, number]>) => d.length) || 1;

    if (side === "opponent") {
      console.log(
        "[Opponent Half] bins:",
        bins.map((b) => b.length)
      );
      console.log("[Opponent Half] newMaxBin:", newMaxBin);
    }

    // Color scale: use team color for team, opponent color for opponent
    const colorScale = d3
      .scaleLinear<string>()
      .domain([0, Math.log1p(newMaxBin) / 2, Math.log1p(newMaxBin)])
      .range(
        side === "team"
          ? ["#7b2ff2", "#00c6fb", "#00ff87"]
          : ["#fff700", "#ff9100", "#ff1744"]
      );
    d3.select(svg)
      .append("g")
      .attr("class", `hexbin-heatmap ${side}`)
      .attr("clip-path", "url(#rink-clip)")
      .selectAll<SVGPathElement, [number, number]>("path")
      .data(allCenters)
      .enter()
      .append("path")
      .attr("d", () => hexbin.hexagon())
      .attr("transform", (d: [number, number]) => `translate(${d[0]},${d[1]})`)
      .attr("fill", (d: [number, number]) => {
        const count = newBinMap.get(`${d[0]},${d[1]}`) || 0;
        if (count === 0) return side === "team" ? "#b0b8c9" : "#e0e7d7";
        return colorScale(Math.log1p(count));
      })
      .attr("stroke", "#dcdcdc")
      .attr("stroke-width", 0.2)
      .attr("opacity", side === "team" ? 0.5 : 0.4);

    // Call this only once per render with all the calculated values
    onScaleValuesChange({
      min: 0,
      mid: Math.round(newMaxBin / 2),
      max: newMaxBin
    });

    setBinMap(newBinMap);
    setMaxBin(newMaxBin);
  }, [shotData, teamAbbreviation, halfRink, side, onScaleValuesChange]);

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

/**
 * Component that handles displaying statistics and legends in the control panel
 */
function InnerShotVisualizationControls({
  shotData,
  opponentShotData = [],
  scaleValues,
  legendsReady,
  alwaysShowLegend = false
}: {
  shotData: ShotData[];
  opponentShotData?: ShotData[];
  scaleValues: {
    team: { min: number; mid: number; max: number };
    opponent: { min: number; mid: number; max: number };
  };
  legendsReady: boolean;
  alwaysShowLegend?: boolean;
}) {
  const [stats, setStats] = useState({
    eventCount: 0,
    goalCount: 0,
    shotCount: 0,
    shootingPct: "0.0"
  });

  // Container refs for the legends
  const teamLegendRef = useRef<HTMLDivElement>(null);
  const oppLegendRef = useRef<HTMLDivElement>(null);

  // Calculate statistics once on mount
  useEffect(() => {
    const goals = shotData.filter((d) => d.typedesckey === "goal");
    const shots = shotData.filter((d) => d.typedesckey === "shot-on-goal");

    const goalCount = goals.length;
    const shotCount = shots.length;
    const eventCount = shotData.length;
    const shootingPct =
      shotCount > 0 ? ((goalCount / shotCount) * 100).toFixed(1) : "0.0";

    setStats({
      eventCount,
      goalCount,
      shotCount,
      shootingPct
    });
  }, [shotData]);

  // Create team legend using the scale values from the rink visualization
  useEffect(() => {
    if (!teamLegendRef.current || !scaleValues.team.max) return;

    // Clear previous content
    teamLegendRef.current.innerHTML = "";

    // Use the same scale values as the main visualization
    const minVal = 0;
    const maxVal = scaleValues.team.max;
    const midVal = scaleValues.team.mid;

    // Apply logarithmic scale exactly as in the main viz
    const logMin = Math.log1p(minVal);
    const logMax = Math.log1p(maxVal);
    const logMid = Math.log1p(midVal);

    const legendWidth = teamLegendRef.current.clientWidth;
    const legendHeight = 16;
    const legendBins = 120;

    // Create SVG element
    const svg = d3
      .select(teamLegendRef.current)
      .append("svg")
      .attr("width", legendWidth)
      .attr("height", legendHeight + 30);

    // Create gradient
    const defs = svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", "team-legend-gradient")
      .attr("x1", "0%")
      .attr("x2", "100%")
      .attr("y1", "0%")
      .attr("y2", "0%");

    // Use the same color scale as in the rink visualization
    const teamColor = d3
      .scaleLinear<string>()
      .domain([0, Math.log1p(maxVal) / 2, Math.log1p(maxVal)])
      .range(["#7b2ff2", "#00c6fb", "#00ff87"]);

    // Add gradient stops with logarithmic scale
    for (let i = 0; i <= legendBins; i++) {
      const t = i / legendBins;
      const logVal = logMin + t * (logMax - logMin);
      gradient
        .append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", teamColor(logVal));
    }

    // Create rectangle with gradient
    svg
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#team-legend-gradient)");

    // Draw axis labels with the same values as in the rink
    const teamAxisScale = d3
      .scaleLinear()
      .domain([logMin, logMax])
      .range([0, legendWidth]);

    const teamTickVals = [minVal, midVal, maxVal];

    svg
      .selectAll("text.tick")
      .data(teamTickVals)
      .enter()
      .append("text")
      .attr("x", (d) => teamAxisScale(Math.log1p(d)))
      .attr("y", legendHeight + 14)
      .attr("text-anchor", (d, i) =>
        i === 0 ? "start" : i === teamTickVals.length - 1 ? "end" : "middle"
      )
      .attr("font-size", 12)
      .attr("fill", "#fff")
      .text((d) => d);

    // Add title
    svg
      .append("text")
      .attr("x", legendWidth / 2)
      .attr("y", legendHeight + 28)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", "#fff")
      .text("Your Team Event Frequency");
  }, [shotData, teamLegendRef, scaleValues.team]);

  // Create opponent legend with the same scale values as the rink visualization
  useEffect(() => {
    if (
      !oppLegendRef.current ||
      (!alwaysShowLegend && opponentShotData.length === 0)
    )
      return;

    // Clear previous content
    oppLegendRef.current.innerHTML = "";

    // Use the same scale values as the main visualization, or fallback to team max if no opponent data
    const minVal = 0;
    const fallbackMax = scaleValues.team.max > 0 ? scaleValues.team.max : 1;
    const maxVal =
      scaleValues.opponent.max > 0 ? scaleValues.opponent.max : fallbackMax;
    const midVal =
      scaleValues.opponent.max > 0
        ? scaleValues.opponent.mid
        : Math.round(fallbackMax / 2);

    // Apply logarithmic scale exactly as in the main viz
    const logMin = Math.log1p(minVal);
    const logMax = Math.log1p(maxVal);
    const logMid = Math.log1p(midVal);

    const legendWidth = oppLegendRef.current.clientWidth;
    const legendHeight = 16;
    const oppLegendBins = 120;

    // Create SVG element
    const svg = d3
      .select(oppLegendRef.current)
      .append("svg")
      .attr("width", legendWidth)
      .attr("height", legendHeight + 30);

    // Create gradient
    const defs = svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", "opponent-legend-gradient")
      .attr("x1", "0%")
      .attr("x2", "100%")
      .attr("y1", "0%")
      .attr("y2", "0%");

    // Use the same color scale as in the rink visualization
    const oppColor = d3
      .scaleLinear<string>()
      .domain([0, Math.log1p(maxVal) / 2, Math.log1p(maxVal)])
      .range(["#fff700", "#ff9100", "#ff1744"]);

    // Add gradient stops with logarithmic scale
    for (let i = 0; i <= oppLegendBins; i++) {
      const t = i / oppLegendBins;
      const logVal = logMin + t * (logMax - logMin);
      gradient
        .append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", oppColor(logVal));
    }

    // Create rectangle with gradient
    svg
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#opponent-legend-gradient)");

    // Draw axis labels (min, mid, max) using the original (not log) values
    const oppAxisScale = d3
      .scaleLinear()
      .domain([logMin, logMax])
      .range([0, legendWidth]);

    const oppTickVals = [minVal, midVal, maxVal];

    svg
      .selectAll("text.tick")
      .data(oppTickVals)
      .enter()
      .append("text")
      .attr("x", (d) => oppAxisScale(Math.log1p(d)))
      .attr("y", legendHeight + 14)
      .attr("text-anchor", (d, i) =>
        i === 0 ? "start" : i === oppTickVals.length - 1 ? "end" : "middle"
      )
      .attr("font-size", 12)
      .attr("fill", "#fff")
      .text((d) => d);

    // Add title
    svg
      .append("text")
      .attr("x", legendWidth / 2)
      .attr("y", legendHeight + 28)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", "#fff")
      .text("Opponent Event Frequency");
  }, [opponentShotData, oppLegendRef, scaleValues.opponent, alwaysShowLegend]);

  if (!legendsReady) {
    return null; // or a loading spinner/component
  }

  return (
    <>
      {/* Statistics panel */}
      <div className={styles.statsPanel}>
        <p>Total Events: {stats.eventCount}</p>
        <p>Shots on Goal: {stats.shotCount}</p>
        {stats.goalCount > 0 && (
          <>
            <p>Goals: {stats.goalCount}</p>
            <p>Shooting %: {stats.shootingPct}%</p>
          </>
        )}
      </div>

      {/* Team legend */}
      <div className={styles.legendContainer}>
        <div ref={teamLegendRef} style={{ width: "100%" }}></div>
      </div>

      {/* Opponent legend (always show if alwaysShowLegend, or if there's opponent data) */}
      {(alwaysShowLegend || opponentShotData.length > 0) && (
        <div className={styles.legendContainer}>
          <div ref={oppLegendRef} style={{ width: "100%" }}></div>
        </div>
      )}
    </>
  );
}
