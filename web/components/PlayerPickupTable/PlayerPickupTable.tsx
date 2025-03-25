// components/PlayerPickupTable/PlayerPickupTable.tsx

import React, { useState, useEffect, useMemo } from "react";
import supabase from "lib/supabase";
import styles from "./PlayerPickupTable.module.scss";
import Image from "next/image";

// ---------------------------
// Type Definitions
// ---------------------------
export type UnifiedPlayerData = {
  nhl_player_id: string;
  nhl_player_name: string;
  // Official NHL team abbreviation from wgo_skater_stats_totals
  nhl_team_abbreviation: string | null;
  yahoo_player_id: string | null;
  yahoo_player_name: string | null;
  yahoo_team: string | null;
  percent_ownership: number | null;
  eligible_positions: string[] | null;
  off_nights: number | null;
  // Skater metrics
  points: number | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  pp_points: number | null;
  blocked_shots: number | null;
  hits: number | null;
  total_fow: number | null;
  penalty_minutes: number | null;
  sh_points: number | null;
  // Goalie metrics
  wins: number | null;
  saves: number | null;
  shots_against: number | null;
  shutouts: number | null;
  quality_start: number | null;
  goals_against_avg: number | null;
  save_pct: number | null;
  // Player type: "skater" or "goalie"
  player_type: "skater" | "goalie";
  // Current team abbreviation from wgo_skater_stats_totals
  current_team_abbreviation: string | null;
  percent_games: number | null;
  status: string | null;
  injury_note: string | null;
};

export interface PlayerWithPercentiles extends UnifiedPlayerData {
  percentiles: Record<MetricKey, number>;
  composite: number;
}

export type MetricKey =
  | "points"
  | "goals"
  | "assists"
  | "shots"
  | "pp_points"
  | "blocked_shots"
  | "hits"
  | "total_fow"
  | "penalty_minutes"
  | "sh_points"
  | "wins"
  | "saves"
  | "shots_against"
  | "shutouts"
  | "quality_start"
  | "goals_against_avg"
  | "save_pct"
  | "percent_games";

export interface MetricDefinition {
  key: MetricKey;
  label: string;
}

const skaterMetrics: MetricDefinition[] = [
  { key: "points", label: "PTS" },
  { key: "goals", label: "G" },
  { key: "assists", label: "A" },
  { key: "shots", label: "SOG" },
  { key: "pp_points", label: "PPP" },
  { key: "blocked_shots", label: "BLK" },
  { key: "hits", label: "HIT" },
  { key: "total_fow", label: "FOW" },
  { key: "penalty_minutes", label: "PIM" },
  { key: "sh_points", label: "SHP" },
  { key: "percent_games", label: "GP%" }
];

const goalieMetrics: MetricDefinition[] = [
  { key: "wins", label: "W" },
  { key: "saves", label: "SV" },
  { key: "shots_against", label: "SA" },
  { key: "shutouts", label: "SO" },
  { key: "quality_start", label: "QS" },
  { key: "goals_against_avg", label: "GAA" },
  { key: "save_pct", label: "SV%" },
  { key: "percent_games", label: "GP%" }
];

// ---------------------------
// Default Filter Settings
// ---------------------------
const defaultOwnershipThreshold = 50;
const defaultTeamFilter = "ALL";
const defaultPositions: Record<string, boolean> = {
  C: true,
  LW: true,
  RW: true,
  D: true,
  G: true
};

export type TeamWeekData = {
  teamAbbreviation: string;
  gamesPlayed: number;
  offNights: number;
  avgOpponentPointPct: number;
};

export type PlayerPickupTableProps = {
  teamWeekData?: TeamWeekData[];
};

// ---------------------------
// Main Component
// ---------------------------
const PlayerPickupTable: React.FC<PlayerPickupTableProps> = ({
  teamWeekData
}) => {
  // Utility: Normalize team abbreviation.
  const normalizeTeamAbbreviation = (team: string | null): string | null => {
    if (!team) return null;
    const mapping: Record<string, string> = {
      TB: "TBL",
      SJ: "SJS",
      NJ: "NJD",
      LA: "LAK"
    };
    return mapping[team] || team;
  };

  // Place getOffNightsForPlayer here so it is defined before it's used.
  const getOffNightsForPlayer = (
    player: UnifiedPlayerData
  ): number | string => {
    if (!teamWeekData || teamWeekData.length === 0) {
      return player.off_nights !== null ? player.off_nights : "N/A";
    }
    const teamAbbr = normalizeTeamAbbreviation(
      player.current_team_abbreviation || player.yahoo_team
    );
    const teamData = teamWeekData.find(
      (team) => team.teamAbbreviation === teamAbbr
    );
    return teamData
      ? teamData.offNights
      : player.off_nights !== null
      ? player.off_nights
      : "N/A";
  };

  const normalizePlayerName = (name: string | null): string | null =>
    name ? playerNameMapping[name] || name : null;

  /**
   * Returns an inline style with a dynamic background color
   * based on the percentile.
   * The color interpolates from red (worst: 0%) to green (best: 100%).
   */
  function getRankColorStyle(percentile: number): React.CSSProperties {
    // Simple linear interpolation:
    // At 0%, weight = 0 → red = 255, green = 0 (red)
    // At 100%, weight = 1 → red = 0, green = 255 (green)
    const weight = percentile / 100;
    const r = Math.round(255 * (1 - weight));
    const g = Math.round(255 * weight);
    return { backgroundColor: `rgba(${r}, ${g}, 0, 0.45)` };
  }

  // At the top of your file (after your imports)
  const playerNameMapping: Record<string, string> = {
    "Alex Wennberg": "Alexander Wennberg"
  };

  // Filter states
  const [ownershipThreshold, setOwnershipThreshold] = useState<number>(
    defaultOwnershipThreshold
  );
  const [teamFilter, setTeamFilter] = useState<string>(defaultTeamFilter);
  const [selectedPositions, setSelectedPositions] =
    useState<Record<string, boolean>>(defaultPositions);

  // Data states
  const [playersData, setPlayersData] = useState<UnifiedPlayerData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // ---------------------------
  // Pagination states
  // ---------------------------
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20; // Show 20 players per page

  // ---------------------------
  // 1) Fetch All Data (from materialized view)
  // ---------------------------
  const fetchAllData = async (): Promise<UnifiedPlayerData[]> => {
    let allData: UnifiedPlayerData[] = [];
    let from = 0;
    const supabasePageSize = 1000; // for fetching from Supabase
    while (true) {
      const { data, error } = await supabase
        .from("yahoo_nhl_player_map_mat")
        .select("*")
        .range(from, from + supabasePageSize - 1);
      if (error) {
        console.error("Error fetching unified player map:", error);
        break;
      }
      if (!data) break;
      allData = allData.concat(data);
      if (data.length < supabasePageSize) break;
      from += supabasePageSize;
    }
    return allData;
  };

  // ---------------------------
  // 2) Load Data on Mount
  // ---------------------------
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const allData = await fetchAllData();
      console.log("Fetched unified player map (all pages):", allData);
      setPlayersData(allData);
      setLoading(false);
    };
    loadData();
  }, []);

  // ---------------------------
  // 3) Filter the Data
  // ---------------------------
  const filteredPlayers = useMemo(() => {
    return playersData.filter((player) => {
      const ownershipValue = player.percent_ownership;
      const positionsValue = player.eligible_positions;
      const offNightsValue = getOffNightsForPlayer(player);

      console.log("DEBUG:", {
        name: player.nhl_player_name,
        ownershipValue,
        positionsValue,
        offNightsValue
      });

      const ownershipMissing = ownershipValue === null || ownershipValue === 0;
      const positionsMissing = !positionsValue || positionsValue.length === 0;
      const offNightsEmpty =
        offNightsValue === undefined ||
        offNightsValue === "N/A" ||
        offNightsValue === "";

      if (ownershipMissing && positionsMissing && offNightsEmpty) {
        console.log(
          "Hiding player due to missing data:",
          player.nhl_player_name
        );
        return false;
      }

      // Existing filters:
      if (
        player.percent_ownership !== null &&
        player.percent_ownership >= ownershipThreshold
      ) {
        return false;
      }
      const teamAbbr = normalizeTeamAbbreviation(
        player.current_team_abbreviation || player.yahoo_team
      );
      if (teamFilter !== "ALL" && teamFilter !== teamAbbr) {
        return false;
      }
      if (player.eligible_positions && player.eligible_positions.length > 0) {
        const matches = player.eligible_positions.some(
          (pos) => selectedPositions[pos]
        );
        if (!matches) return false;
      } else if (player.player_type === "goalie" && !selectedPositions["G"]) {
        return false;
      }
      return true;
    });
  }, [
    playersData,
    ownershipThreshold,
    teamFilter,
    selectedPositions,
    teamWeekData
  ]);

  // ---------------------------
  // 4) Compute Percentiles & Composite
  // ---------------------------
  const playersWithPercentiles: PlayerWithPercentiles[] = useMemo(() => {
    if (filteredPlayers.length === 0) {
      return filteredPlayers.map((p) => ({
        ...p,
        percentiles: {} as Record<MetricKey, number>,
        composite: 0
      }));
    }
    const skaters = filteredPlayers.filter((p) => p.player_type === "skater");
    const goalies = filteredPlayers.filter((p) => p.player_type === "goalie");

    function computePercentile(values: number[], value: number): number {
      const count = values.length;
      const numBelow = values.filter((v) => v < value).length;
      const numEqual = values.filter((v) => v === value).length;
      return ((numBelow + 0.5 * numEqual) / count) * 100;
    }

    function assignPercentiles(
      group: UnifiedPlayerData[],
      metrics: MetricDefinition[]
    ): PlayerWithPercentiles[] {
      const metricValues: Record<MetricKey, number[]> = {} as Record<
        MetricKey,
        number[]
      >;
      for (const { key } of metrics) {
        metricValues[key] = group.map(
          (p) => (p[key as keyof UnifiedPlayerData] as number) || 0
        );
        metricValues[key].sort((a, b) => a - b);
      }
      return group.map((player) => {
        const percentiles: Record<MetricKey, number> = {} as Record<
          MetricKey,
          number
        >;
        let sum = 0;
        let count = 0;
        for (const { key } of metrics) {
          const rawVal = player[key as keyof UnifiedPlayerData] as
            | number
            | null;
          if (rawVal !== null) {
            const pct = computePercentile(metricValues[key], rawVal);
            percentiles[key] = pct;
            sum += pct;
            count++;
          } else {
            percentiles[key] = 0;
          }
        }
        const composite = count > 0 ? sum / count : 0;
        return { ...player, percentiles, composite };
      });
    }

    const skatersWithPct = assignPercentiles(skaters, skaterMetrics);
    const goaliesWithPct = assignPercentiles(goalies, goalieMetrics);
    return [...skatersWithPct, ...goaliesWithPct];
  }, [filteredPlayers]);

  // ---------------------------
  // 5) Sorting Setup
  // ---------------------------
  type SortKey = keyof (UnifiedPlayerData & { composite: number });
  const [sortKey, setSortKey] = useState<SortKey>("composite");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleSort = (column: SortKey) => {
    if (sortKey === column) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortKey(column);
      setSortOrder("desc");
    }
  };

  const sortedPlayers = useMemo(() => {
    const sorted = [...playersWithPercentiles];
    sorted.sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortOrder === "desc" ? bValue - aValue : aValue - bValue;
      }
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      if (aStr < bStr) return sortOrder === "desc" ? 1 : -1;
      if (aStr > bStr) return sortOrder === "desc" ? -1 : 1;
      return 0;
    });
    return sorted;
  }, [playersWithPercentiles, sortKey, sortOrder]);

  // ---------------------------
  // 6) Build Team Options
  // ---------------------------
  const teamOptions = useMemo(() => {
    const teamsSet = new Set<string>();
    playersData.forEach((p) => {
      const teamAbbr = normalizeTeamAbbreviation(
        p.current_team_abbreviation || p.yahoo_team
      );
      if (teamAbbr) teamsSet.add(teamAbbr);
    });
    return ["ALL", ...Array.from(teamsSet).sort()];
  }, [playersData]);

  // ---------------------------
  // 7) Reset Filters
  // ---------------------------
  const resetFilters = () => {
    setOwnershipThreshold(defaultOwnershipThreshold);
    setTeamFilter(defaultTeamFilter);
    setSelectedPositions(defaultPositions);
  };

  // ---------------------------
  // 9) Pagination: Calculate current page of players
  // ---------------------------
  const totalPages = Math.ceil(sortedPlayers.length / pageSize);
  const paginatedPlayers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedPlayers.slice(startIndex, startIndex + pageSize);
  }, [sortedPlayers, currentPage, pageSize]);

  // ---------------------------
  // 10) Render Component
  // ---------------------------
  return (
    <div className={styles.container}>
      {/* Filter Controls */}
      <div className={styles.filters}>
        <div className={styles.filterRow}>
          <label className={styles.label}>
            Ownership Threshold: {ownershipThreshold}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={ownershipThreshold}
            onChange={(e) => setOwnershipThreshold(Number(e.target.value))}
            className={styles.slider}
          />
        </div>
        <div className={styles.filterRow}>
          <label className={styles.label}>Team Filter:</label>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className={styles.select}
          >
            {teamOptions.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterRow}>
          <span className={styles.label}>Positions:</span>
          {Object.keys(defaultPositions).map((pos) => (
            <label key={pos} style={{ marginRight: "10px" }}>
              <input
                type="checkbox"
                checked={selectedPositions[pos]}
                onChange={() =>
                  setSelectedPositions((prev) => ({
                    ...prev,
                    [pos]: !prev[pos]
                  }))
                }
              />
              {pos}
            </label>
          ))}
        </div>
        <button className={styles.buttonReset} onClick={resetFilters}>
          Reset Filters
        </button>
      </div>

      {/* Main Table */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {/* Sortable Header Cells */}
                  <th onClick={() => handleSort("nhl_player_name")}>
                    Name{" "}
                    {sortKey === "nhl_player_name"
                      ? sortOrder === "desc"
                        ? "▼"
                        : "▲"
                      : ""}
                  </th>
                  <th onClick={() => handleSort("nhl_team_abbreviation")}>
                    Team{" "}
                    {sortKey === "nhl_team_abbreviation"
                      ? sortOrder === "desc"
                        ? "▼"
                        : "▲"
                      : ""}
                  </th>
                  <th onClick={() => handleSort("percent_ownership")}>
                    Ownership{" "}
                    {sortKey === "percent_ownership"
                      ? sortOrder === "desc"
                        ? "▼"
                        : "▲"
                      : ""}
                  </th>
                  <th>Positions</th>
                  <th onClick={() => handleSort("off_nights")}>
                    Off-Nights{" "}
                    {sortKey === "off_nights"
                      ? sortOrder === "desc"
                        ? "▼"
                        : "▲"
                      : ""}
                  </th>
                  <th onClick={() => handleSort("percent_games")}>
                    Percent Games
                  </th>

                  <th>Percentile Ranks</th>
                  <th onClick={() => handleSort("composite")}>
                    Composite{" "}
                    {sortKey === "composite"
                      ? sortOrder === "desc"
                        ? "▼"
                        : "▲"
                      : ""}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedPlayers.map((player) => {
                  const relevantMetrics =
                    player.player_type === "skater"
                      ? skaterMetrics
                      : goalieMetrics;
                  return (
                    <tr key={player.nhl_player_id}>
                      <td>
                        <div className={styles.nameAndInjuryWrapper}>
                          {/* LEFT HALF: Name */}
                          <div className={styles.leftNamePart}>
                            <span className={styles.playerName}>
                              {normalizePlayerName(player.yahoo_player_name) ||
                                player.nhl_player_name}
                            </span>
                          </div>

                          {/* RIGHT HALF: Injury/Status Info */}
                          {player.status &&
                          ["IR-LT", "IR", "O", "DTD", "IR-NR"].includes(
                            player.status
                          ) ? (
                            <div className={styles.rightInjuryPart}>
                              {/* IMAGE 35% */}
                              <div className={styles.imageContainer}>
                                <Image
                                  src="/pictures/injured.png"
                                  alt="Injured"
                                  width={20}
                                  height={20}
                                />
                              </div>

                              {/* TEXT 65% */}
                              <div className={styles.statusContainer}>
                                <span className={styles.statusText}>
                                  {player.status}
                                </span>
                                {player.injury_note && (
                                  <div className={styles.injuryNote}>
                                    {player.injury_note}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : player.injury_note ? (
                            // If no "status" but there's an "injury_note", you can still display it if desired:
                            <div className={styles.rightInjuryPart}>
                              {/* Could omit the image if you prefer */}
                              <div className={styles.imageContainer}>
                                <Image
                                  src="/pictures/injured.png"
                                  alt="Injured"
                                  width={15}
                                  height={15}
                                />
                              </div>
                              <div className={styles.statusContainer}>
                                <div className={styles.injuryNote}>
                                  {player.injury_note}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        {player.nhl_team_abbreviation ||
                          player.yahoo_team ||
                          "N/A"}
                      </td>
                      <td>
                        {player.percent_ownership !== null
                          ? player.percent_ownership + "%"
                          : "N/A"}
                      </td>
                      <td>
                        {player.eligible_positions &&
                        player.eligible_positions.length > 0
                          ? player.eligible_positions.join(", ")
                          : player.player_type === "goalie"
                          ? "G"
                          : "N/A"}
                      </td>
                      <td>{getOffNightsForPlayer(player)}</td>
                      <td>
                        {player.percent_games !== null ? (
                          <div className={styles.percentileContainer}>
                            <div className={styles.percentileLabel}>PG</div>
                            <div
                              className={styles.percentileBox}
                              style={getRankColorStyle(
                                player.percentiles.percent_games !== undefined
                                  ? player.percentiles.percent_games
                                  : 0
                              )}
                            >
                              {(
                                Math.min(player.percent_games, 1) * 100
                              ).toFixed(0) + "%"}
                            </div>
                          </div>
                        ) : (
                          "N/A"
                        )}
                      </td>
                      <td>
                        {relevantMetrics.map(({ key, label }) => {
                          const pctVal = player.percentiles[key];
                          const displayVal =
                            pctVal !== undefined
                              ? pctVal.toFixed(0) + "%"
                              : "0%";
                          return (
                            <div
                              key={key}
                              className={styles.percentileContainer}
                            >
                              <div className={styles.percentileLabel}>
                                {label}
                              </div>
                              <div
                                className={styles.percentileBox}
                                style={getRankColorStyle(
                                  pctVal !== undefined ? pctVal : 0
                                )}
                              >
                                {displayVal}
                              </div>
                            </div>
                          );
                        })}
                      </td>
                      <td>{player.composite.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls */}
          <div className={styles.pagination}>
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default PlayerPickupTable;
