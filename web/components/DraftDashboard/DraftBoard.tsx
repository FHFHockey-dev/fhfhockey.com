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
  onUpdateTeamName
}) => {
  const [sortField, setSortField] = useState<SortField>("projectedPoints");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const contributionInputRef = useRef<HTMLInputElement>(null);
  const leaderboardInputRef = useRef<HTMLInputElement>(null);

  // Debug: Track editing state changes
  useEffect(() => {
    console.log("Editing state changed:", { editingTeam, editingValue });
  }, [editingTeam, editingValue]);

  // Auto-focus the input when editing starts
  useEffect(() => {
    if (editingTeam) {
      console.log("Manually focusing input for team:", editingTeam);
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
    console.log("=== CLICK EVENT START ===");
    console.log("Team name clicked:", { teamId, currentName });
    console.log("Current editing state before click:", {
      editingTeam,
      editingValue
    });
    console.log("Setting editing state...");
    setEditingTeam(teamId);
    setEditingValue(currentName);
    console.log("=== CLICK EVENT END ===");
  };

  const handleTeamNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingValue(e.target.value);
  };

  const handleTeamNameSubmit = (teamId: string) => {
    console.log("Submitting team name:", { teamId, editingValue }); // Debug log
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
      setEditingTeam(null);
      setEditingValue("");
    }
  };

  const handleTeamNameBlur = (teamId: string) => {
    // Prevent immediate blur after click by checking if we just started editing
    console.log("Blur event triggered for team:", teamId);
    console.log("Current editing team:", editingTeam);

    // Only handle blur if we've been editing for more than 100ms
    const blurTimeout = setTimeout(() => {
      console.log("Blur timeout executing for team:", teamId);
      // Double-check we're still editing this team
      if (editingTeam === teamId) {
        handleTeamNameSubmit(teamId);
      }
    }, 100); // Reduced back to 100ms but with better logic

    // Store timeout to potentially cancel it
    (window as any).blurTimeout = blurTimeout;
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
    const playerDataMap = new Map<string, ProcessedPlayer>();
    availablePlayers.forEach((player) => {
      playerDataMap.set(String(player.playerId), player);
    });
    return playerDataMap;
  }, [availablePlayers]);

  // Calculate max fantasy points for heat map scaling
  const maxFantasyPoints = useMemo(() => {
    let max = 0;
    draftedPlayers.forEach((drafted) => {
      const playerData = allPlayersData.get(drafted.playerId);
      if (playerData?.fantasyPoints.projected) {
        max = Math.max(max, playerData.fantasyPoints.projected);
      }
    });
    return max || 100; // Default to 100 if no data
  }, [draftedPlayers, allPlayersData]);

  // Get heat map intensity (0-4 levels like GitHub)
  const getHeatMapIntensity = (fantasyPoints: number | null): number => {
    if (!fantasyPoints || fantasyPoints <= 0) return 0;
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
        const tooltip = draftedPlayer
          ? `${playerName}\n${teamId}\nRound ${round}, Pick ${pickInRound}\nProjected: ${fantasyPoints} pts`
          : isCurrentPick
            ? `Current Pick: ${teamId}\nRound ${round}, Pick ${pickInRound}`
            : `Available Pick\n${teamId}\nRound ${round}, Pick ${pickInRound}`;

        teamCells.push(
          <div
            key={`${teamId}-${round}`}
            className={cellClass}
            title={tooltip}
            data-round={round}
            data-pick={pickInRound}
            data-team={teamId}
          >
            {isCurrentPick && (
              <div className={styles.currentPickIndicator}>●</div>
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
                  teamStats.find((t) => t.teamId === teamId)?.teamName || teamId
                )
              }
            >
              {teamStats.find((t) => t.teamId === teamId)?.teamName ||
                `T${teamIndex + 1}`}
            </div>
          )}
          <div className={styles.teamRoundCells}>{teamCells}</div>
        </div>
      );
    }

    return grid;
  };

  // Calculate team category totals for the leaderboard table
  const teamStatsWithCategories = useMemo(() => {
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
      {/* GitHub-style header */}
      <div className={styles.githubHeader}>
        <h3 className={styles.sectionTitle}>
          Draft <span className={styles.panelTitleAccent}> Graph</span>
        </h3>
        <div className={styles.contributionSummary}>
          {draftedPlayers.length} picks in {currentTurn.round} rounds
        </div>
      </div>

      {/* GitHub-style contribution graph */}
      <div className={styles.contributionGraphContainer}>
        <div className={styles.contributionGraph}>
          {/* Round labels (columns) */}
          <div className={styles.roundLabels}>
            <div className={styles.teamLabelSpacer}></div>
            {Array.from({ length: roundsToShow }, (_, i) => (
              <span key={i} className={styles.roundLabel}>
                {i + 1}
              </span>
            ))}
          </div>

          {/* Contribution grid with teams as rows */}
          <div className={styles.contributionGrid}>
            {renderContributionGrid()}
          </div>
        </div>
      </div>

      {/* Team Leaderboard Table */}
      <div className={styles.leaderboardSection}>
        <h3 className={styles.sectionTitle}>
          Team <span className={styles.panelTitleAccent}>Standings</span>
        </h3>
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
                    <td className={styles.statCell}>
                      {(team.categoryTotals.goals || 0).toFixed(0)}
                    </td>
                    <td className={styles.statCell}>
                      {(team.categoryTotals.assists || 0).toFixed(0)}
                    </td>
                    <td className={styles.statCell}>
                      {(team.categoryTotals.pp_points || 0).toFixed(0)}
                    </td>
                    <td className={styles.statCell}>
                      {(team.categoryTotals.shots_on_goal || 0).toFixed(0)}
                    </td>
                    <td className={styles.statCell}>
                      {(team.categoryTotals.hits || 0).toFixed(0)}
                    </td>
                    <td className={styles.statCell}>
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
    </div>
  );
};

export default DraftBoard;
