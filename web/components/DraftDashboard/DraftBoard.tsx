// components/DraftDashboard/DraftBoard.tsx

import React, { useMemo, useState, useEffect, useRef } from "react";
import { DraftSettings, DraftedPlayer, TeamDraftStats } from "./DraftDashboard";
import { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import styles from "./DraftBoard.module.scss";

interface DraftBoardProps {
  draftSettings: DraftSettings;
  draftedPlayers: DraftedPlayer[];
  currentTurn: {
    round: number;
    pickInRound: number;
    teamId: string;
    isMyTurn: boolean;
  };
  teamStats: TeamDraftStats[];
  isSnakeDraft: boolean;
  availablePlayers?: ProcessedPlayer[];
  allPlayers: ProcessedPlayer[]; // Add this prop for complete player data
  onUpdateTeamName: (teamId: string, newName: string) => void; // Add this prop
  // NEW: traded pick ownership overrides
  pickOwnerOverrides?: Record<string, string>;
  // NEW: keepers list
  keepers?: Array<{ round: number; pickInRound: number; teamId: string; playerId: string }>;
}

type SortField =
  | "projectedPoints"
  | "goals"
  | "assists"
  | "pp_points"
  | "shots_on_goal"
  | "hits"
  | "blocked_shots"
  | "teamVorp";

const DraftBoard: React.FC<DraftBoardProps> = ({
  draftSettings,
  draftedPlayers,
  currentTurn,
  teamStats,
  isSnakeDraft,
  availablePlayers = [],
  allPlayers,
  onUpdateTeamName,
  pickOwnerOverrides = {},
  keepers = []
}) => {
  const DEBUG = process.env.NODE_ENV !== "production";
  const [sortField, setSortField] = useState<SortField>("projectedPoints");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const contributionInputRef = useRef<HTMLInputElement>(null);
  const leaderboardInputRef = useRef<HTMLInputElement>(null);
  // NEW: manage blur timeout safely via ref instead of window-scoped var
  const blurTimeoutRef = useRef<number | null>(null);

  // Build a quick lookup for team names
  const teamNameById = useMemo(() => {
    const m = new Map<string, string>();
    draftSettings.draftOrder.forEach((id) => {
      const name = teamStats.find((t) => t.teamId === id)?.teamName || id;
      m.set(id, name);
    });
    return m;
  }, [draftSettings.draftOrder, teamStats]);

  // Debug: Track editing state changes
  useEffect(() => {
    if (DEBUG)
      console.log("Editing state changed:", { editingTeam, editingValue });
  }, [editingTeam, editingValue]);

  // Clear any pending blur timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
    };
  }, []);

  // Auto-focus the input when editing starts
  useEffect(() => {
    if (editingTeam) {
      if (DEBUG) console.log("Manually focusing input for team:", editingTeam);
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        // Try both refs - one will be rendered, the other won't
        if (contributionInputRef.current) {
          contributionInputRef.current.focus();
          contributionInputRef.current.select();
        } else if (leaderboardInputRef.current) {
          leaderboardInputRef.current.focus();
          leaderboardInputRef.current.select();
        }
      }, 10);
    }
  }, [editingTeam]);

  // Handle team name editing
  const handleTeamNameClick = (
    e: React.MouseEvent,
    teamId: string,
    currentName: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    // Clear any pending blur submit from previous edits
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    if (DEBUG) {
      console.log("=== CLICK EVENT START ===");
      console.log("Team name clicked:", { teamId, currentName });
      console.log("Current editing state before click:", {
        editingTeam,
        editingValue
      });
      console.log("Setting editing state...");
    }
    setEditingTeam(teamId);
    setEditingValue(currentName);
    if (DEBUG) console.log("=== CLICK EVENT END ===");
  };

  const handleTeamNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingValue(e.target.value);
  };

  const handleTeamNameSubmit = (teamId: string) => {
    if (DEBUG) console.log("Submitting team name:", { teamId, editingValue }); // Debug log
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    if (editingValue.trim() && editingValue !== "") {
      onUpdateTeamName(teamId, editingValue.trim());
    }
    setEditingTeam(null);
    setEditingValue("");
  };

  const handleTeamNameKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    teamId: string
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTeamNameSubmit(teamId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      setEditingTeam(null);
      setEditingValue("");
    }
  };

  const handleTeamNameBlur = (teamId: string) => {
    // Prevent immediate blur after click by checking if we just started editing
    if (DEBUG) {
      console.log("Blur event triggered for team:", teamId);
      console.log("Current editing team:", editingTeam);
    }

    // Only handle blur if we've been editing for more than 100ms
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    blurTimeoutRef.current = window.setTimeout(() => {
      if (DEBUG) console.log("Blur timeout executing for team:", teamId);
      // Double-check we're still editing this team
      if (editingTeam === teamId) {
        handleTeamNameSubmit(teamId);
      }
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
    }, 100);
  };

  // Calculate total roster spots dynamically from settings
  const totalRosterSize = Object.values(draftSettings.rosterConfig).reduce(
    (sum, count) => sum + count,
    0
  );

  // Use the actual roster size instead of hardcoded values
  const roundsToShow = totalRosterSize; // Show all roster spots as rounds

  // Get all drafted and available players for calculating heat map intensities
  const allPlayersData = useMemo(() => {
    // Use the full pool so drafted players remain colorized
    const playerDataMap = new Map<string, ProcessedPlayer>();
    allPlayers.forEach((player) => {
      playerDataMap.set(String(player.playerId), player);
    });
    return playerDataMap;
  }, [allPlayers]);

  // Calculate max fantasy points for heat map scaling
  const maxFantasyPoints = useMemo(() => {
    // Scale from the full pool to keep intensity stable across the board
    let max = 0;
    allPlayers.forEach((p) => {
      const fp = p?.fantasyPoints?.projected;
      if (typeof fp === "number" && Number.isFinite(fp)) {
        if (fp > max) max = fp;
      }
    });

    // Fallback: if no projections, try drafted players via lookup
    if (max <= 0) {
      draftedPlayers.forEach((drafted) => {
        const playerData = allPlayersData.get(drafted.playerId);
        const fp = playerData?.fantasyPoints?.projected;
        if (typeof fp === "number" && Number.isFinite(fp)) {
          if (fp > max) max = fp;
        }
      });
    }

    // Final fallback default
    return max > 0 ? max : 100;
  }, [allPlayers, draftedPlayers, allPlayersData]);

  // Get heat map intensity (0-4 levels like GitHub)
  const getHeatMapIntensity = (fantasyPoints: number | null): number => {
    if (!fantasyPoints || fantasyPoints <= 0) return 0;
    if (!maxFantasyPoints || maxFantasyPoints <= 0) return 0;
    const percentage = fantasyPoints / maxFantasyPoints;
    if (percentage <= 0.2) return 1;
    if (percentage <= 0.4) return 2;
    if (percentage <= 0.7) return 3;
    return 4;
  };

  // Generate GitHub-style contribution grid for draft board
  const renderContributionGrid = () => {
    const teams = draftSettings.draftOrder;
    const maxRounds = roundsToShow; // Use dynamic value instead of hardcoded 17
    const keeperKeySet = new Set(
      keepers.map((k) => `${k.round}-${k.pickInRound}`)
    );

    // Create grid with teams as rows and rounds as columns
    const grid = [];

    for (let teamIndex = 0; teamIndex < teams.length; teamIndex++) {
      const teamId = teams[teamIndex];
      const teamCells = [];

      for (let round = 1; round <= maxRounds; round++) {
        let pickInRound: number;

        // Calculate pick position in round based on snake draft
        if (isSnakeDraft && round % 2 === 0) {
          // Reverse order for even rounds in snake draft
          pickInRound = teams.length - teamIndex;
        } else {
          // Normal order for odd rounds or regular draft
          pickInRound = teamIndex + 1;
        }

        const overallPick = (round - 1) * draftSettings.teamCount + pickInRound;
        const key = `${round}-${pickInRound}`;
        const ownerTeamId = pickOwnerOverrides[key] || teamId;
        const draftedPlayer = draftedPlayers.find(
          (p) => p.pickNumber === overallPick
        );
        const isCurrentPick =
          currentTurn.round === round &&
          currentTurn.pickInRound === pickInRound;

        let intensity = 0;
        let playerData: ProcessedPlayer | undefined;
        let cellClass = styles.contributionCell;

        if (draftedPlayer) {
          playerData = allPlayersData.get(draftedPlayer.playerId);
          intensity = getHeatMapIntensity(
            playerData?.fantasyPoints.projected || null
          );
          cellClass += ` ${styles[`intensity${intensity}`]}`;
        } else if (isCurrentPick) {
          cellClass += ` ${styles.currentPick}`;
        } else {
          cellClass += ` ${styles.intensity0}`;
        }

        const playerName = playerData?.fullName || `Pick #${overallPick}`;
        const fantasyPoints =
          playerData?.fantasyPoints.projected?.toFixed(1) || "N/A";
        const ownerName = teamNameById.get(ownerTeamId) || ownerTeamId;
        const rowTeamName = teamNameById.get(teamId) || teamId;
        const traded = ownerTeamId !== teamId;
        const ownershipLine = traded ? `\nTraded: ${rowTeamName} → ${ownerName}` : "";
        const isKeeper = keeperKeySet.has(key);
        const tooltip = draftedPlayer
          ? `${playerName}\n${rowTeamName}${ownershipLine}\nRound ${round}, Pick ${pickInRound}\nProjected: ${fantasyPoints} pts`
          : isCurrentPick
            ? `Current Pick: ${ownerName}${ownershipLine}\nRound ${round}, Pick ${pickInRound}`
            : `Available Pick${ownershipLine}\nRound ${round}, Pick ${pickInRound}`;

        teamCells.push(
          <div
            key={`${teamId}-${round}`}
            className={`${cellClass} ${traded ? styles.tradedCell : ""} ${isKeeper ? styles.keeperCell : ""}`}
            title={tooltip}
            data-round={round}
            data-pick={pickInRound}
            data-team={teamId}
          >
            {isCurrentPick && (
              <div className={styles.currentPickIndicator}>●</div>
            )}
            {traded && (
              <span className={styles.tradeIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M7 7h9l-2.5-2.5L15 3l6 6-6 6-1.5-1.5L16 11H7V7zm10 10H8l2.5 2.5L9 21l-6-6 6-6 1.5 1.5L8 13h9v4z" />
                </svg>
              </span>
            )}
            {isKeeper && (
              <span className={styles.keeperBadge} aria-label="Keeper">K</span>
            )}
          </div>
        );
      }

      grid.push(
        <div key={teamId} className={styles.teamRow}>
          {editingTeam === teamId ? (
            <input
              type="text"
              value={editingValue}
              onChange={handleTeamNameChange}
              onKeyDown={(e) => handleTeamNameKeyDown(e, teamId)}
              onBlur={() => handleTeamNameBlur(teamId)}
              className={styles.teamLabelInput}
              ref={contributionInputRef}
            />
          ) : (
            <div
              className={styles.teamLabel}
              onClick={(e) =>
                handleTeamNameClick(
                  e,
                  teamId,
                  teamNameById.get(teamId) || teamId
                )
              }
            >
              {teamNameById.get(teamId) || `T${teamIndex + 1}`}
            </div>
          )}
          <div
            className={styles.teamRoundCells}
            style={{ gridTemplateColumns: `repeat(${roundsToShow}, 1fr)` }}
          >
            {teamCells}
          </div>
        </div>
      );
    }

    return grid;
  };

  // Calculate team category totals for the leaderboard table
  const teamStatsWithCategories = useMemo(() => {
    if (DEBUG)
      console.log("Debug - DraftBoard teamStatsWithCategories calculation:", {
        teamStatsLength: teamStats.length,
        draftedPlayersLength: draftedPlayers.length,
        availablePlayersLength: availablePlayers.length,
        sampleDraftedPlayer: draftedPlayers[0],
        sampleTeamStat: teamStats[0]
      });

    return teamStats.map((team) => {
      const teamPlayers = draftedPlayers.filter(
        (p) => p.teamId === team.teamId
      );

      if (DEBUG)
        console.log(`Debug - Team ${team.teamId}:`, {
          teamPlayersCount: teamPlayers.length,
          teamPlayers: teamPlayers.map((p) => p.playerId)
        });

      // Initialize category totals
      const categoryTotals = {
        goals: 0,
        assists: 0,
        pp_points: 0,
        shots_on_goal: 0,
        hits: 0,
        blocked_shots: 0
      };

      // Sum up category totals from all team players
      teamPlayers.forEach((draftedPlayer) => {
        // FIXED: Use allPlayers prop which contains ALL players (including drafted ones)
        const player = allPlayers.find(
          (p) => String(p.playerId) === draftedPlayer.playerId
        );

        if (DEBUG)
          console.log(`Debug - Player lookup for ${draftedPlayer.playerId}:`, {
            found: !!player,
            playerStats: player?.combinedStats
              ? Object.keys(player.combinedStats)
              : "no stats"
          });

        if (player) {
          // Access the projected values from the combinedStats structure
          const goals = player.combinedStats.GOALS?.projected || 0;
          const assists = player.combinedStats.ASSISTS?.projected || 0;
          const ppPoints = player.combinedStats.PP_POINTS?.projected || 0;
          const sog = player.combinedStats.SHOTS_ON_GOAL?.projected || 0;
          const hits = player.combinedStats.HITS?.projected || 0;
          const blocks = player.combinedStats.BLOCKED_SHOTS?.projected || 0;

          if (DEBUG)
            console.log(`Debug - Adding stats for ${player.fullName}:`, {
              goals,
              assists,
              ppPoints,
              sog,
              hits,
              blocks
            });

          categoryTotals.goals += goals;
          categoryTotals.assists += assists;
          categoryTotals.pp_points += ppPoints;
          categoryTotals.shots_on_goal += sog;
          categoryTotals.hits += hits;
          categoryTotals.blocked_shots += blocks;
        }
      });

      if (DEBUG)
        console.log(
          `Debug - Final categoryTotals for ${team.teamId}:`,
          categoryTotals
        );

      return {
        ...team,
        categoryTotals
      };
    });
  }, [teamStats, draftedPlayers, availablePlayers, allPlayers]);

  // Compute per-category min/max across teams for intra-team heat coloring
  const categoryExtents = useMemo(() => {
    const keys: Array<keyof TeamDraftStats["categoryTotals"]> = [
      "goals",
      "assists",
      "pp_points",
      "shots_on_goal",
      "hits",
      "blocked_shots"
    ];
    const extents: Record<string, { min: number; max: number }> = {};
    keys.forEach((k) => {
      const values = teamStatsWithCategories
        .slice(0, draftSettings.teamCount)
        .map((t) => (t.categoryTotals[k] || 0) as number);
      const min = values.length ? Math.min(...values) : 0;
      const max = values.length ? Math.max(...values) : 0;
      extents[k] = { min, max };
    });
    return extents;
  }, [teamStatsWithCategories, draftSettings.teamCount]);

  // Map a value within [min,max] to a green→yellow→red color (hsla) with 40% fill and solid border
  const getCategoryCellStyle = (
    key:
      | "goals"
      | "assists"
      | "pp_points"
      | "shots_on_goal"
      | "hits"
      | "blocked_shots",
    value: number | undefined
  ): React.CSSProperties => {
    const { min, max } = categoryExtents[key] || { min: 0, max: 0 };
    const v = typeof value === "number" ? value : 0;
    let t = 0.5; // neutral
    if (max > min) {
      t = (v - min) / (max - min);
      t = Math.max(0, Math.min(1, t));
    }
    const hue = Math.round(t * 120); // 0 = red, 120 = green
    const fill = `hsla(${hue}, 85%, 50%, 0.4)`;
    const stroke = `hsl(${hue}, 80%, 45%)`;
    return {
      backgroundColor: fill,
      border: `1px solid ${stroke}`
    };
  };

  // Sort teams based on selected field and direction
  const sortedTeams = useMemo(() => {
    return [...teamStatsWithCategories]
      .slice(0, draftSettings.teamCount)
      .sort((a, b) => {
        let aValue: number;
        let bValue: number;

        if (sortField === "projectedPoints") {
          aValue = a.projectedPoints;
          bValue = b.projectedPoints;
        } else if (sortField === "teamVorp") {
          aValue = a.teamVorp || 0;
          bValue = b.teamVorp || 0;
        } else {
          aValue = a.categoryTotals[sortField] || 0;
          bValue = b.categoryTotals[sortField] || 0;
        }

        return sortDirection === "desc" ? bValue - aValue : aValue - bValue;
      });
  }, [
    teamStatsWithCategories,
    draftSettings.teamCount,
    sortField,
    sortDirection
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc"); // Default to descending for new fields
    }
  };

  return (
    <div className={styles.draftBoardContainer}>
      {/* Subheader: Team Standings */}
      <div className={styles.githubHeader}>
        <h3 className={styles.sectionTitle}>
          Team <span className={styles.panelTitleAccent}>Standings</span>
        </h3>
        <div className={styles.contributionSummary}>
          {draftedPlayers.length} of {draftSettings.teamCount * roundsToShow}{" "}
          picks • {roundsToShow} rounds
        </div>
      </div>

      {/* Team Leaderboard Table */}
      <div className={styles.leaderboardSection}>
        <div className={styles.leaderboardTableContainer}>
          <table className={styles.leaderboardTable}>
            <thead>
              <tr>
                <th className={styles.rankHeader}>#</th>
                <th className={styles.teamHeader}>Team</th>
                <th
                  className={`${styles.sortableHeader} ${sortField === "goals" ? styles.activeSortHeader : ""}`}
                  onClick={() => handleSort("goals")}
                >
                  G{" "}
                  {sortField === "goals" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className={`${styles.sortableHeader} ${sortField === "assists" ? styles.activeSortHeader : ""}`}
                  onClick={() => handleSort("assists")}
                >
                  A{" "}
                  {sortField === "assists" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className={`${styles.sortableHeader} ${sortField === "pp_points" ? styles.activeSortHeader : ""}`}
                  onClick={() => handleSort("pp_points")}
                >
                  PPP{" "}
                  {sortField === "pp_points" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className={`${styles.sortableHeader} ${sortField === "shots_on_goal" ? styles.activeSortHeader : ""}`}
                  onClick={() => handleSort("shots_on_goal")}
                >
                  SOG{" "}
                  {sortField === "shots_on_goal" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className={`${styles.sortableHeader} ${sortField === "hits" ? styles.activeSortHeader : ""}`}
                  onClick={() => handleSort("hits")}
                >
                  HIT{" "}
                  {sortField === "hits" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className={`${styles.sortableHeader} ${sortField === "blocked_shots" ? styles.activeSortHeader : ""}`}
                  onClick={() => handleSort("blocked_shots")}
                >
                  BLK{" "}
                  {sortField === "blocked_shots" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className={`${styles.sortableHeader} ${sortField === "teamVorp" ? styles.activeSortHeader : ""}`}
                  onClick={() => handleSort("teamVorp")}
                  title="Sum of team VORP"
                >
                  Team VORP{" "}
                  {sortField === "teamVorp" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className={`${styles.sortableHeader} ${sortField === "projectedPoints" ? styles.activeSortHeader : ""}`}
                  onClick={() => handleSort("projectedPoints")}
                >
                  Proj Pts{" "}
                  {sortField === "projectedPoints" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team, index) => {
                const totalPicks =
                  Object.keys(team.rosterSlots).reduce(
                    (total, pos) => total + team.rosterSlots[pos].length,
                    0
                  ) + (team.bench?.length || 0); // include bench in bubble count

                const totalRosterSpots = totalRosterSize;

                return (
                  <tr
                    key={team.teamId}
                    className={`${styles.leaderboardRow} ${
                      team.teamId === currentTurn.teamId
                        ? styles.currentTeamRow
                        : ""
                    }`}
                  >
                    <td className={styles.rankCell}>
                      <div className={styles.teamRank}>#{index + 1}</div>
                    </td>
                    <td className={styles.teamCell}>
                      <div className={styles.teamInfo}>
                        <div className={styles.teamNameRow}>
                          {editingTeam === team.teamId ? (
                            <input
                              type="text"
                              value={editingValue}
                              onChange={handleTeamNameChange}
                              onKeyDown={(e) =>
                                handleTeamNameKeyDown(e, team.teamId)
                              }
                              onBlur={() => handleTeamNameBlur(team.teamId)}
                              className={styles.teamNameInput}
                              ref={leaderboardInputRef}
                            />
                          ) : (
                            <div
                              className={styles.teamName}
                              onClick={(e) =>
                                handleTeamNameClick(
                                  e,
                                  team.teamId,
                                  team.teamName
                                )
                              }
                            >
                              {team.teamName}
                            </div>
                          )}
                          <div className={styles.teamPlayerBubbles}>
                            {Array.from(
                              { length: totalRosterSpots },
                              (_, index) => (
                                <div
                                  key={index}
                                  className={`${styles.playerBubble} ${
                                    index < totalPicks
                                      ? styles.filledBubble
                                      : styles.emptyBubble
                                  }`}
                                />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td
                      className={styles.statCell}
                      style={getCategoryCellStyle(
                        "goals",
                        team.categoryTotals.goals
                      )}
                    >
                      {(team.categoryTotals.goals || 0).toFixed(0)}
                    </td>
                    <td
                      className={styles.statCell}
                      style={getCategoryCellStyle(
                        "assists",
                        team.categoryTotals.assists
                      )}
                    >
                      {(team.categoryTotals.assists || 0).toFixed(0)}
                    </td>
                    <td
                      className={styles.statCell}
                      style={getCategoryCellStyle(
                        "pp_points",
                        team.categoryTotals.pp_points
                      )}
                    >
                      {(team.categoryTotals.pp_points || 0).toFixed(0)}
                    </td>
                    <td
                      className={styles.statCell}
                      style={getCategoryCellStyle(
                        "shots_on_goal",
                        team.categoryTotals.shots_on_goal
                      )}
                    >
                      {(team.categoryTotals.shots_on_goal || 0).toFixed(0)}
                    </td>
                    <td
                      className={styles.statCell}
                      style={getCategoryCellStyle(
                        "hits",
                        team.categoryTotals.hits
                      )}
                    >
                      {(team.categoryTotals.hits || 0).toFixed(0)}
                    </td>
                    <td
                      className={styles.statCell}
                      style={getCategoryCellStyle(
                        "blocked_shots",
                        team.categoryTotals.blocked_shots
                      )}
                    >
                      {(team.categoryTotals.blocked_shots || 0).toFixed(0)}
                    </td>
                    <td className={styles.statCell}>
                      {(team.teamVorp || 0).toFixed(1)}
                    </td>
                    <td className={styles.projectedPointsCell}>
                      {team.projectedPoints.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subheader: Draft Graph */}
      <div className={styles.githubHeader}>
        <h3 className={styles.sectionTitle}>
          Draft <span className={styles.panelTitleAccent}>Graph</span>
        </h3>
        <div className={styles.contributionSummary}>
          {draftedPlayers.length} of {draftSettings.teamCount * roundsToShow}{" "}
          picks • {roundsToShow} rounds
        </div>
      </div>

      {/* Contribution graph */}
      <div className={styles.contributionGraphContainer}>
        <div className={styles.contributionGraph}>
          {/* Round labels (columns) */}
          <div className={styles.roundLabels}>
            <div className={styles.teamLabelSpacer}></div>
            <div
              className={styles.roundLabelsGrid}
              style={{ gridTemplateColumns: `repeat(${roundsToShow}, 1fr)` }}
            >
              {Array.from({ length: roundsToShow }, (_, i) => (
                <span key={i} className={styles.roundLabel}>
                  {i + 1}
                </span>
              ))}
            </div>
          </div>

          {/* Contribution grid with teams as rows */}
          <div className={styles.contributionGrid}>
            {renderContributionGrid()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DraftBoard;
