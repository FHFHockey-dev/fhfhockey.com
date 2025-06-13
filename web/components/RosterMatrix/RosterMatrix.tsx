import React, { useState, useEffect, useMemo } from "react";
import styles from "./RosterMatrix.module.scss";
import { formatStatValue, STAT_DISPLAY_NAMES } from "../PlayerStats/types";

interface RosterPlayer {
  id: number;
  nhl_player_name: string;
  mapped_position: string;
  eligible_positions?: string[] | string;
  age?: number;
  sweater_number?: number;
  height?: string;
  weight?: number;
  shoots_catches?: string;
  injury_status?: string;
  injury_note?: string;

  // Basic stats
  games_played?: number;
  goals?: number;
  assists?: number;
  points?: number;
  plus_minus?: number;
  pim?: number;
  shots?: number;
  shooting_percentage?: number;
  toi_per_game?: number;
  pp_toi_per_game?: number;

  // Advanced stats
  cf_pct?: number;
  xgf_pct?: number;
  hdcf_pct?: number;
  pdo?: number;
  total_points_per_60?: number;
  ixg_per_60?: number;

  // Goalie stats
  wins?: number;
  losses?: number;
  save_pct?: number;
  goals_against_avg?: number;
  shutouts?: number;

  // Advanced goalie stats
  gsaa?: number;
  hd_save_pct?: number;
  md_save_pct?: number;
  ld_save_pct?: number;
  xg_against?: number;
}

interface RosterMatrixProps {
  teamAbbreviation: string;
  players: RosterPlayer[];
  isLoading?: boolean;
  error?: string | null;
}

type SortField = keyof RosterPlayer;
type SortDirection = "asc" | "desc";

const SKATER_COLUMNS_BASIC = [
  { key: "sweater_number" as SortField, label: "#", width: "50px" },
  {
    key: "nhl_player_name" as SortField,
    label: "Player",
    width: "200px",
    sticky: true
  },
  { key: "mapped_position" as SortField, label: "Pos", width: "50px" },
  { key: "age" as SortField, label: "Age", width: "50px" },
  { key: "games_played" as SortField, label: "GP", width: "60px" },
  { key: "goals" as SortField, label: "G", width: "50px" },
  { key: "assists" as SortField, label: "A", width: "50px" },
  { key: "points" as SortField, label: "P", width: "50px" },
  { key: "plus_minus" as SortField, label: "+/-", width: "60px" },
  { key: "pim" as SortField, label: "PIM", width: "60px" },
  { key: "shots" as SortField, label: "SOG", width: "60px" },
  { key: "shooting_percentage" as SortField, label: "SH%", width: "60px" },
  { key: "toi_per_game" as SortField, label: "TOI", width: "80px" }
];

const SKATER_COLUMNS_ADVANCED = [
  { key: "sweater_number" as SortField, label: "#", width: "50px" },
  {
    key: "nhl_player_name" as SortField,
    label: "Player",
    width: "200px",
    sticky: true
  },
  { key: "mapped_position" as SortField, label: "Pos", width: "50px" },
  { key: "age" as SortField, label: "Age", width: "50px" },
  { key: "games_played" as SortField, label: "GP", width: "60px" },
  { key: "goals" as SortField, label: "G", width: "50px" },
  { key: "assists" as SortField, label: "A", width: "50px" },
  { key: "points" as SortField, label: "P", width: "50px" },
  { key: "cf_pct" as SortField, label: "CF%", width: "60px" },
  { key: "xgf_pct" as SortField, label: "xGF%", width: "70px" },
  { key: "hdcf_pct" as SortField, label: "HDCF%", width: "70px" },
  { key: "total_points_per_60" as SortField, label: "P/60", width: "70px" },
  { key: "ixg_per_60" as SortField, label: "ixG/60", width: "70px" },
  { key: "pdo" as SortField, label: "PDO", width: "60px" }
];

const GOALIE_COLUMNS_BASIC = [
  { key: "sweater_number" as SortField, label: "#", width: "50px" },
  {
    key: "nhl_player_name" as SortField,
    label: "Player",
    width: "200px",
    sticky: true
  },
  { key: "age" as SortField, label: "Age", width: "50px" },
  { key: "games_played" as SortField, label: "GP", width: "60px" },
  { key: "wins" as SortField, label: "W", width: "50px" },
  { key: "losses" as SortField, label: "L", width: "50px" },
  { key: "save_pct" as SortField, label: "SV%", width: "70px" },
  { key: "goals_against_avg" as SortField, label: "GAA", width: "70px" },
  { key: "shutouts" as SortField, label: "SO", width: "50px" }
];

const GOALIE_COLUMNS_ADVANCED = [
  { key: "sweater_number" as SortField, label: "#", width: "50px" },
  {
    key: "nhl_player_name" as SortField,
    label: "Player",
    width: "200px",
    sticky: true
  },
  { key: "age" as SortField, label: "Age", width: "50px" },
  { key: "games_played" as SortField, label: "GP", width: "60px" },
  { key: "wins" as SortField, label: "W", width: "50px" },
  { key: "losses" as SortField, label: "L", width: "50px" },
  { key: "save_pct" as SortField, label: "SV%", width: "70px" },
  { key: "goals_against_avg" as SortField, label: "GAA", width: "70px" },
  { key: "gsaa" as SortField, label: "GSAA", width: "70px" },
  { key: "hd_save_pct" as SortField, label: "HD SV%", width: "70px" },
  { key: "md_save_pct" as SortField, label: "MD SV%", width: "70px" },
  { key: "ld_save_pct" as SortField, label: "LD SV%", width: "70px" },
  { key: "xg_against" as SortField, label: "xGA", width: "70px" }
];

export function RosterMatrix({
  teamAbbreviation,
  players,
  isLoading,
  error
}: RosterMatrixProps) {
  const [sortField, setSortField] = useState<SortField>("points");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [injuryFilter, setInjuryFilter] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"basic" | "advanced">("basic");

  // Separate players by position
  const { skaters, goalies } = useMemo(() => {
    const skaters = players.filter((p) => p.mapped_position !== "G");
    const goalies = players.filter((p) => p.mapped_position === "G");

    return { skaters, goalies };
  }, [players]);

  // Filter and sort players
  const filteredPlayers = useMemo(() => {
    let filtered = [...players];

    // Position filter
    if (positionFilter !== "all") {
      if (positionFilter === "F") {
        filtered = filtered.filter((p) =>
          ["LW", "C", "RW"].includes(p.mapped_position)
        );
      } else {
        filtered = filtered.filter((p) => p.mapped_position === positionFilter);
      }
    }

    // Injury filter
    if (injuryFilter) {
      filtered = filtered.filter(
        (p) => p.injury_status && p.injury_status !== "Active"
      );
    }

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const numA = Number(aVal);
      const numB = Number(bVal);

      return sortDirection === "asc" ? numA - numB : numB - numA;
    });

    return filtered;
  }, [players, sortField, sortDirection, positionFilter, injuryFilter]);

  // Handle column sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Get unique positions for filter
  const positions = useMemo(() => {
    const uniquePositions = [...new Set(players.map((p) => p.mapped_position))];
    return uniquePositions.sort();
  }, [players]);

  // Get performance class for stat values
  const getPerformanceClass = (
    value: number | null | undefined,
    stat: string,
    position: string
  ): string => {
    if (!value) return "";

    // Define thresholds based on stat and position
    const thresholds: Record<
      string,
      { good: number; excellent: number; reverse?: boolean }
    > = {
      points: { good: 40, excellent: 70 },
      goals: { good: 15, excellent: 30 },
      assists: { good: 25, excellent: 50 },
      shooting_percentage: { good: 12, excellent: 18 },
      cf_pct: { good: 50, excellent: 55 },
      xgf_pct: { good: 50, excellent: 55 },
      pdo: { good: 99, excellent: 102 },
      save_pct: { good: 0.91, excellent: 0.92 },
      goals_against_avg: { good: 2.75, excellent: 2.25, reverse: true },
      plus_minus: { good: 5, excellent: 15 }
    };

    const threshold = thresholds[stat];
    if (!threshold) return "";

    if (threshold.reverse) {
      // Lower is better (like GAA)
      if (value <= threshold.excellent) return styles.excellent;
      if (value <= threshold.good) return styles.good;
      return styles.poor;
    } else {
      // Higher is better
      if (value >= threshold.excellent) return styles.excellent;
      if (value >= threshold.good) return styles.good;
      return styles.average;
    }
  };

  // Render table header
  const renderTableHeader = (columns: typeof SKATER_COLUMNS_BASIC) => (
    <thead>
      <tr>
        {columns.map((col) => (
          <th
            key={col.key}
            className={`${styles.columnHeader} ${col.sticky ? styles.stickyColumn : ""} ${
              sortField === col.key ? styles.sortActive : ""
            }`}
            style={{ width: col.width, minWidth: col.width }}
            onClick={() => handleSort(col.key)}
          >
            <div className={styles.headerContent}>
              <span>{col.label}</span>
              {sortField === col.key && (
                <span className={styles.sortIcon}>
                  {sortDirection === "asc" ? "↑" : "↓"}
                </span>
              )}
            </div>
          </th>
        ))}
      </tr>
    </thead>
  );

  // Render table row
  const renderTableRow = (
    player: RosterPlayer,
    columns: typeof SKATER_COLUMNS_BASIC
  ) => (
    <tr
      key={player.id}
      className={
        player.injury_status && player.injury_status !== "Active"
          ? styles.injuredPlayer
          : ""
      }
    >
      {columns.map((col) => {
        const value = player[col.key];
        const isNameColumn = col.key === "nhl_player_name";
        const isNumericStat = typeof value === "number" && !isNameColumn;

        return (
          <td
            key={col.key}
            className={`${col.sticky ? styles.stickyColumn : ""} ${
              isNumericStat
                ? getPerformanceClass(value, col.key, player.mapped_position)
                : ""
            }`}
            style={{ width: col.width, minWidth: col.width }}
          >
            {isNameColumn ? (
              <div className={styles.playerNameCell}>
                <div className={styles.playerName}>
                  {player.nhl_player_name}
                </div>
                {player.injury_status && player.injury_status !== "Active" && (
                  <div
                    className={styles.injuryIndicator}
                    title={player.injury_note}
                  >
                    🏥 {player.injury_status}
                  </div>
                )}
              </div>
            ) : col.key === "sweater_number" ? (
              value || "—"
            ) : col.key === "mapped_position" ? (
              value
            ) : col.key === "age" ? (
              value || "—"
            ) : col.key === "plus_minus" ? (
              value !== null &&
              value !== undefined &&
              typeof value === "number" ? (
                value > 0 ? (
                  `+${value}`
                ) : (
                  value.toString()
                )
              ) : (
                "—"
              )
            ) : (
              formatStatValue(value, col.key)
            )}
          </td>
        );
      })}
    </tr>
  );

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <span>Loading roster data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h3>Error Loading Roster</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Roster Matrix</h2>
        <p>Complete team roster with performance metrics</p>
      </div>

      {/* Filter Controls */}
      <div className={styles.controls}>
        <div className={styles.filterGroup}>
          <label>Position:</label>
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className={styles.select}
          >
            <option value="all">All Positions</option>
            <option value="F">Forwards</option>
            {positions.map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={injuryFilter}
              onChange={(e) => setInjuryFilter(e.target.checked)}
            />
            Show injured players only
          </label>
        </div>

        <div className={styles.filterGroup}>
          <label>View:</label>
          <select
            value={viewMode}
            onChange={(e) =>
              setViewMode(e.target.value as "basic" | "advanced")
            }
            className={styles.select}
          >
            <option value="basic">Basic Stats</option>
            <option value="advanced">Advanced Stats</option>
          </select>
        </div>
      </div>

      {/* Statistics Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={`${styles.legendColor} ${styles.excellent}`}></div>
          <span>Excellent</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendColor} ${styles.good}`}></div>
          <span>Good</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendColor} ${styles.average}`}></div>
          <span>Average</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendColor} ${styles.poor}`}></div>
          <span>Below Average</span>
        </div>
      </div>

      {/* Skaters Table */}
      {(positionFilter === "all" ||
        positionFilter === "F" ||
        ["LW", "C", "RW", "D"].includes(positionFilter)) && (
        <div className={styles.section}>
          <h3>Skaters ({skaters.length})</h3>
          <div className={styles.tableContainer}>
            <table className={styles.rosterTable}>
              {renderTableHeader(
                viewMode === "basic"
                  ? SKATER_COLUMNS_BASIC
                  : SKATER_COLUMNS_ADVANCED
              )}
              <tbody>
                {filteredPlayers
                  .filter((p) => p.mapped_position !== "G")
                  .map((player) =>
                    renderTableRow(
                      player,
                      viewMode === "basic"
                        ? SKATER_COLUMNS_BASIC
                        : SKATER_COLUMNS_ADVANCED
                    )
                  )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Goalies Table */}
      {(positionFilter === "all" || positionFilter === "G") && (
        <div className={styles.section}>
          <h3>Goalies ({goalies.length})</h3>
          <div className={styles.tableContainer}>
            <table className={styles.rosterTable}>
              {renderTableHeader(
                viewMode === "basic"
                  ? GOALIE_COLUMNS_BASIC
                  : GOALIE_COLUMNS_ADVANCED
              )}
              <tbody>
                {filteredPlayers
                  .filter((p) => p.mapped_position === "G")
                  .map((player) =>
                    renderTableRow(
                      player,
                      viewMode === "basic"
                        ? GOALIE_COLUMNS_BASIC
                        : GOALIE_COLUMNS_ADVANCED
                    )
                  )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredPlayers.length === 0 && (
        <div className={styles.noData}>
          <p>No players found matching the selected filters.</p>
        </div>
      )}
    </div>
  );
}
