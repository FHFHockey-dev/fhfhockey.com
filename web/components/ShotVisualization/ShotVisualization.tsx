import React, { useRef, useEffect, useLayoutEffect, useState } from "react";
import {
  ShotData,
  EVENT_TYPES,
  GAME_TYPES,
  ShotDataFilters
} from "hooks/useShotData";
import styles from "styles/TeamStatsPage.module.scss";

interface ShotVisualizationProps {
  shotData: ShotData[];
  isLoading: boolean;
  onFilterChange?: (filters: ShotDataFilters) => void;
  filters?: ShotDataFilters;
}

/**
 * Component that displays shot data visualization on a hockey rink
 * Avoids direct DOM manipulation by using a key to force re-render
 */
export function ShotVisualization({
  shotData,
  isLoading,
  onFilterChange,
  filters = {
    eventTypes: ["goal", "shot-on-goal"],
    gameTypes: [GAME_TYPES.REGULAR_SEASON]
  }
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
        <InnerShotVisualization key={key} shotData={shotData} />
      )}
    </div>
  );
}

/**
 * Inner component that handles the actual rendering of the hockey rink and shot data
 * This component gets remounted whenever the key changes in the parent
 */
function InnerShotVisualization({ shotData }: { shotData: ShotData[] }) {
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

    // Create a container for shot markers
    const d3 = require("d3");
    const d3svg = d3.select(svg);

    // Function to map NHL coordinates to SVG space
    const mapXToSvg = (x: number): number => {
      return 2 + ((x + 100) / 200) * (viewBoxWidth - 4);
    };

    const mapYToSvg = (y: number): number => {
      return 2 + ((y + 42.5) / 85) * (viewBoxHeight - 4);
    };

    // Create color mapping for different event types
    const eventColorMap: Record<string, string> = {
      goal: "#FF0000", // Red
      "shot-on-goal": "#0066CC", // Blue
      "missed-shot": "#FFA500", // Orange
      "blocked-shot": "#800080", // Purple
      faceoff: "#008000", // Green
      hit: "#FFD700", // Gold
      takeaway: "#00FFFF", // Cyan
      giveaway: "#FF69B4", // Hot Pink
      penalty: "#8B0000" // Dark Red
    };

    // Add shots group
    const eventsGroup = d3svg.append("g").attr("class", "event-markers");

    // Add events
    shotData.forEach((event) => {
      // Determine color based on event type
      const color = eventColorMap[event.typedesckey] || "#999999"; // Gray default

      eventsGroup
        .append("circle")
        .attr("cx", mapXToSvg(event.xcoord))
        .attr("cy", mapYToSvg(event.ycoord))
        .attr("r", event.typedesckey === "goal" ? 4 : 3) // Make goals slightly larger
        .attr("fill", color)
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("opacity", event.typedesckey === "goal" ? 1 : 0.7);
    });

    // Add legend with dynamically determined event types
    const legend = d3svg
      .append("g")
      .attr("class", "event-legend")
      .attr("transform", `translate(${viewBoxWidth - 50}, 20)`);

    // Get unique event types in the data
    const uniqueEventTypes = Array.from(
      new Set(shotData.map((d) => d.typedesckey))
    );

    // Limit to top 5 event types to avoid cluttering
    const legendEventTypes = uniqueEventTypes.slice(0, 5);

    // Add legend items
    legendEventTypes.forEach((eventType, i) => {
      const color = eventColorMap[eventType] || "#999999";
      const displayName =
        eventType.charAt(0).toUpperCase() +
        eventType.slice(1).replace(/-/g, " ");

      legend
        .append("circle")
        .attr("cx", 0)
        .attr("cy", i * 20)
        .attr("r", 3)
        .attr("fill", color)
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("opacity", eventType === "goal" ? 1 : 0.7);

      legend
        .append("text")
        .attr("x", 10)
        .attr("y", i * 20 + 4)
        .attr("font-size", 10)
        .attr("fill", "black")
        .text(displayName);
    });

    // We don't need to clean up anything since this component will be unmounted and recreated
    // completely when data changes
  }, [shotData]);

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
