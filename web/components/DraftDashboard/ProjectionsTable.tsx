// components/DraftDashboard/ProjectionsTable.tsx

import React, { useState, useMemo } from "react";
import { DraftedPlayer } from "./DraftDashboard";
// Import ProcessedPlayer from the correct location
import { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import { PlayerVorpMetrics } from "hooks/useVORPCalculations";
import styles from "./ProjectionsTable.module.scss";

interface ProjectionsTableProps {
  players: ProcessedPlayer[];
  draftedPlayers: DraftedPlayer[];
  isLoading: boolean;
  error: string | null;
  onDraftPlayer: (playerId: string) => void;
  canDraft: boolean;
  // NEW: VORP metrics map
  vorpMetrics?: Map<string, PlayerVorpMetrics>;
}

type SortableField = keyof ProcessedPlayer | "fantasyPoints" | "vorp";

const ProjectionsTable: React.FC<ProjectionsTableProps> = ({
  players,
  draftedPlayers,
  isLoading,
  error,
  onDraftPlayer,
  canDraft,
  vorpMetrics
}) => {
  const [sortField, setSortField] = useState<SortableField>("yahooAvgPick");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [positionFilter, setPositionFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Precompute VORP for quick lookup
  const vorpMap = useMemo(() => {
    const m = new Map<string, { vorp: number; bestPos?: string }>();
    if (vorpMetrics) {
      vorpMetrics.forEach((metrics, id) => {
        m.set(id, { vorp: metrics.vorp, bestPos: metrics.bestPos });
      });
    }
    return m;
  }, [vorpMetrics]);

  // Filter and sort players
  const filteredAndSortedPlayers = useMemo(() => {
    let filtered = [...players];

    // Apply position filter
    if (positionFilter !== "ALL") {
      filtered = filtered.filter((player) =>
        player.displayPosition?.includes(positionFilter)
      );
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (player) =>
          player.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          player.displayTeam?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort players
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortField === "fantasyPoints") {
        aValue = a.fantasyPoints.projected;
        bValue = a.fantasyPoints.projected;
      } else if (sortField === "vorp") {
        aValue = vorpMap.get(String(a.playerId))?.vorp ?? 0;
        bValue = vorpMap.get(String(b.playerId))?.vorp ?? 0;
      } else {
        aValue = (a as any)[sortField];
        bValue = (a as any)[sortField];
      }

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === "asc" ? 1 : -1;
      if (bValue == null) return sortDirection === "asc" ? -1 : 1;

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return filtered;
  }, [players, positionFilter, searchTerm, sortField, sortDirection, vorpMap]);

  const handleSort = (field: SortableField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(
        field === "vorp" || field === "fantasyPoints" ? "desc" : "asc"
      );
    }
  };

  const handleDraftClick = (playerId: number) => {
    if (canDraft) {
      onDraftPlayer(String(playerId));
    }
  };

  // Get unique positions for filter
  const availablePositions = useMemo(() => {
    const positions = new Set<string>();
    players.forEach((player) => {
      if (player.displayPosition) {
        player.displayPosition.split(",").forEach((pos) => {
          positions.add(pos.trim());
        });
      }
    });
    return Array.from(positions).sort();
  }, [players]);

  if (isLoading) {
    return (
      <div className={styles.projectionsContainer}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>
            Available <span className={styles.panelTitleAccent}>Players</span>
          </h2>
        </div>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading player projections...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.projectionsContainer}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>
            Available <span className={styles.panelTitleAccent}>Players</span>
          </h2>
        </div>
        <div className={styles.errorState}>
          <p>Error loading projections:</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.projectionsContainer}>
      {/* Header */}
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>
          Available <span className={styles.panelTitleAccent}>Players</span>
        </h2>
        <div className={styles.playerCount}>
          {filteredAndSortedPlayers.length} players
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersSection}>
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <div className={styles.positionFilter}>
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className={styles.positionSelect}
          >
            <option value="ALL">All Positions</option>
            {availablePositions.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Players Table */}
      <div className={styles.tableContainer}>
        <table className={styles.playersTable}>
          <thead>
            <tr>
              <th
                onClick={() => handleSort("fullName")}
                className={styles.sortableHeader}
              >
                Player{" "}
                {sortField === "fullName" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                onClick={() => handleSort("displayPosition")}
                className={styles.sortableHeader}
              >
                Pos{" "}
                {sortField === "displayPosition" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                onClick={() => handleSort("displayTeam")}
                className={styles.sortableHeader}
              >
                Team{" "}
                {sortField === "displayTeam" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                onClick={() => handleSort("fantasyPoints")}
                className={styles.sortableHeader}
              >
                Proj FP{" "}
                {sortField === "fantasyPoints" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                onClick={() => handleSort("vorp")}
                className={styles.sortableHeader}
                title="Value Over Replacement Player"
              >
                VORP{" "}
                {sortField === "vorp" && (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                onClick={() => handleSort("yahooAvgPick")}
                className={styles.sortableHeader}
              >
                ADP{" "}
                {sortField === "yahooAvgPick" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedPlayers.map((player) => {
              const key = String(player.playerId);
              const m = vorpMap.get(key);
              const vorp = m?.vorp ?? 0;
              const bestPos = m?.bestPos;
              return (
                <tr key={player.playerId} className={styles.playerRow}>
                  <td className={styles.playerName}>
                    <div className={styles.nameContainer}>
                      <span className={styles.fullName}>{player.fullName}</span>
                    </div>
                  </td>
                  <td className={styles.position}>
                    {player.displayPosition || "-"}
                  </td>
                  <td className={styles.team}>{player.displayTeam || "-"}</td>
                  <td className={styles.fantasyPoints}>
                    {player.fantasyPoints.projected?.toFixed(1) || "-"}
                  </td>
                  <td
                    className={styles.vorp}
                    title={bestPos ? `Best Pos: ${bestPos}` : undefined}
                  >
                    {vorp ? vorp.toFixed(1) : "-"}
                  </td>
                  <td className={styles.adp}>
                    {player.yahooAvgPick?.toFixed(1) || "-"}
                  </td>
                  <td className={styles.actionCell}>
                    <button
                      onClick={() => handleDraftClick(player.playerId)}
                      disabled={!canDraft}
                      className={styles.draftButton}
                    >
                      {canDraft ? "Draft" : "Wait"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredAndSortedPlayers.length === 0 && (
          <div className={styles.emptyState}>
            <p>No players found matching your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectionsTable;
