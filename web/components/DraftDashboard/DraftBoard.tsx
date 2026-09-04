// components/DraftDashboard/DraftBoard.tsx

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DraftSettings, DraftedPlayer, TeamDraftStats } from "./DraftDashboard";
import { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import type { PlayerVorpMetrics } from "hooks/useVORPCalculations";
import {
  keeperUsesPick,
  type KeeperEntry,
} from "lib/draftDashboard/keepers";
import {
  draftOrderPatternFromSnake,
  isRoundReversed,
  pickInRoundForTeamIndex,
  type DraftOrderPattern,
} from "lib/draftDashboard/draftOrder";
import {
  resolvePickOwner,
  type PickTradeEntry
} from "lib/draftDashboard/pickTrades";
import styles from "./DraftBoard.module.scss";

interface DraftBoardProps {
  myTeamId?: string;
  draftSettings: DraftSettings;
  draftedPlayers: DraftedPlayer[];
  currentTurn: {
    round: number;
    pickInRound: number;
    teamId: string;
    isMyTurn: boolean;
  };
  teamStats: TeamDraftStats[];
  draftOrderPattern?: DraftOrderPattern;
  isSnakeDraft?: boolean;
  allPlayers: ProcessedPlayer[]; // Add this prop for complete player data
  onUpdateTeamName: (teamId: string, newName: string) => void; // Add this prop
  canEditTeamNames?: boolean;
  pickTrades?: PickTradeEntry[];
  // NEW: keepers list
  keepers?: KeeperEntry[];
  // NEW: per-player VORP/value metrics (value used as Score in categories)
  vorpMetrics?: Map<string, PlayerVorpMetrics>;
}

const DraftBoard: React.FC<DraftBoardProps> = ({
  myTeamId,
  draftSettings,
  draftedPlayers,
  currentTurn,
  teamStats,
  draftOrderPattern,
  isSnakeDraft = true,
  allPlayers,
  onUpdateTeamName,
  canEditTeamNames = true,
  pickTrades = [],
  keepers = [],
  vorpMetrics
}) => {
  const activeDraftOrderPattern =
    draftOrderPattern ?? draftOrderPatternFromSnake(isSnakeDraft);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const contributionInputRef = useRef<HTMLInputElement>(null);
  // NEW: manage blur timeout safely via ref instead of window-scoped var
  const blurTimeoutRef = useRef<number | null>(null);

  const augmentedAllPlayers = useMemo(() => {
    const allPlayersMap = new Map<string, ProcessedPlayer>();
    allPlayers.forEach((p) => allPlayersMap.set(String(p.playerId), p));

    draftedPlayers.forEach((p) => {
      if (!allPlayersMap.has(p.playerId)) {
        const placeholder: ProcessedPlayer = {
          playerId: Number(p.playerId),
          fullName:
            p.espnDisplayName ||
            p.yahooDisplayName ||
            (p.yahooPlayerId
              ? `Unresolved Yahoo player #${p.yahooPlayerId}`
              : `Player #${p.playerId}`),
          displayTeam: null,
          displayPosition: null,
          eligiblePositions: [],
          combinedStats: {},
          fantasyPoints: {
            projected: null,
            actual: null,
            diffPercentage: null,
            projectedPerGame: null,
            actualPerGame: null
          },
          yahooPlayerId: undefined,
          yahooAvgPick: null,
          yahooAvgRound: null,
          yahooPctDrafted: null,
          projectedRank: null,
          actualRank: null
        };
        allPlayersMap.set(p.playerId, placeholder);
      }
    });

    return Array.from(allPlayersMap.values());
  }, [allPlayers, draftedPlayers]);

  // Build a quick lookup for team names
  const teamNameById = useMemo(() => {
    const m = new Map<string, string>();
    draftSettings.draftOrder.forEach((id) => {
      const name = teamStats.find((t) => t.teamId === id)?.teamName || id;
      m.set(id, name);
    });
    return m;
  }, [draftSettings.draftOrder, teamStats]);

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
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        // Try both refs - one will be rendered, the other won't
        if (contributionInputRef.current) {
          contributionInputRef.current.focus();
          contributionInputRef.current.select();

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
    if (!canEditTeamNames) return;
    e.preventDefault();
    e.stopPropagation();
    // Clear any pending blur submit from previous edits
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setEditingTeam(teamId);
    setEditingValue(currentName);
  };

  const handleTeamNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingValue(e.target.value);
  };

  const handleTeamNameSubmit = (teamId: string) => {
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
    // Only handle blur if we've been editing for more than 100ms
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    blurTimeoutRef.current = window.setTimeout(() => {
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
  const currentOverallPick =
    (currentTurn.round - 1) * draftSettings.teamCount +
    currentTurn.pickInRound;
  const teamRosterCountById = useMemo(
    () =>
      Object.fromEntries(
        teamStats.map((team) => [
          team.teamId,
          Object.values(team.rosterSlots).reduce(
            (sum, players) => sum + players.length,
            team.bench.length,
          ),
        ]),
      ),
    [teamStats],
  );
  const skippedPickNumbers = useMemo(() => {
    const skipped = new Set<number>();
    const completed = new Set(
      draftedPlayers.map((player) => player.pickNumber),
    );
    const totalPicks = draftSettings.teamCount * roundsToShow;
    for (let pickNumber = 1; pickNumber <= totalPicks; pickNumber += 1) {
      if (pickNumber >= currentOverallPick || completed.has(pickNumber)) {
        continue;
      }
      const round = Math.ceil(pickNumber / draftSettings.teamCount);
      const pickInRound = ((pickNumber - 1) % draftSettings.teamCount) + 1;
      const owner = resolvePickOwner({
        round,
        pickInRound,
        draftOrder: draftSettings.draftOrder,
        orderPattern: activeDraftOrderPattern,
        trades: pickTrades,
        keepers,
      }).currentTeamId;
      if ((teamRosterCountById[owner] ?? 0) >= totalRosterSize) {
        skipped.add(pickNumber);
      }
    }
    return skipped;
  }, [
    activeDraftOrderPattern,
    currentOverallPick,
    draftSettings.draftOrder,
    draftSettings.teamCount,
    draftedPlayers,
    keepers,
    pickTrades,
    roundsToShow,
    teamRosterCountById,
    totalRosterSize,
  ]);
  const noPickKeepers = keepers.filter((keeper) => !keeperUsesPick(keeper));

  // Get all drafted and available players for calculating heat map intensities
  const allPlayersData = useMemo(() => {
    // Use the full pool so drafted players remain colorized
    const playerDataMap = new Map<string, ProcessedPlayer>();
    augmentedAllPlayers.forEach((player) => {
      playerDataMap.set(String(player.playerId), player);
    });
    return playerDataMap;
  }, [augmentedAllPlayers]);

  const draftedPlayerByPick = useMemo(
    () =>
      new Map(
        draftedPlayers.map((player) => [player.pickNumber, player] as const),
      ),
    [draftedPlayers],
  );

  // Calculate max fantasy points for heat map scaling
  const maxFantasyPoints = useMemo(() => {
    // Scale from the full pool to keep intensity stable across the board
    let max = 0;
    augmentedAllPlayers.forEach((p) => {
      const fp = p?.fantasyPoints?.projected;
      if (typeof fp === "number" && Number.isFinite(fp)) {
        if (fp > max) max = fp;
      }
    });

    // Final fallback default
    return max > 0 ? max : 100;
  }, [augmentedAllPlayers]);

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
    const keeperByKey = new Map(
      keepers.filter(keeperUsesPick).map((keeper) => [
        `${keeper.round}-${keeper.pickInRound}`,
        keeper
      ])
    );

    // Create grid with teams as rows and rounds as columns
    const grid = [];

    for (let teamIndex = 0; teamIndex < teams.length; teamIndex++) {
      const teamId = teams[teamIndex];
      const teamCells = [];

      for (let round = 1; round <= maxRounds; round++) {
        const pickInRound = pickInRoundForTeamIndex({
          teamIndex,
          teamCount: teams.length,
          round,
          pattern: activeDraftOrderPattern,
        });

        const overallPick = (round - 1) * draftSettings.teamCount + pickInRound;
        const key = `${round}-${pickInRound}`;
        const keeper = keeperByKey.get(key);
        const ownership = resolvePickOwner({
          round,
          pickInRound,
          draftOrder: draftSettings.draftOrder,
          orderPattern: activeDraftOrderPattern,
          trades: pickTrades,
          keepers
        });
        const ownerTeamId = ownership.currentTeamId;
        const draftedPlayer = draftedPlayerByPick.get(overallPick);
        const isRosterFullSkip = skippedPickNumbers.has(overallPick);
        const isCurrentPick =
          !keeper &&
          !isRosterFullSkip &&
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
        const traded = ownership.source === "trade";
        const ownershipLine = traded
          ? `\nTraded: ${rowTeamName} → ${ownerName}`
          : "";
        const isKeeper = Boolean(keeper);
        const tooltip = draftedPlayer
          ? isKeeper
            ? `${playerName}\nKeeper: ${ownerName}\nForfeited round ${round}, pick ${pickInRound}\nProjected: ${fantasyPoints} pts`
            : `${playerName}\n${rowTeamName}${ownershipLine}\nRound ${round}, Pick ${pickInRound}\nProjected: ${fantasyPoints} pts`
          : isRosterFullSkip
            ? `Roster full: ${ownerName}\nRound ${round}, Pick ${pickInRound} skipped`
            : isCurrentPick
            ? `Current Pick: ${ownerName}${ownershipLine}\nRound ${round}, Pick ${pickInRound}`
            : `Available Pick${ownershipLine}\nRound ${round}, Pick ${pickInRound}`;

        teamCells.push(
          <div
            key={`${teamId}-${round}`}
            className={`${cellClass} ${traded ? styles.tradedCell : ""} ${isKeeper ? styles.keeperCell : ""} ${isRosterFullSkip ? styles.rosterFullSkip : ""} ${activeDraftOrderPattern.mode === "custom" && isRoundReversed(activeDraftOrderPattern, round) ? styles.customReversedCell : ""}`}
            title={tooltip}
            data-round={round}
            data-pick={pickInRound}
            data-team={teamId}
            data-owner={ownerTeamId}
            data-overall-pick={overallPick}
            data-intensity={draftedPlayer ? intensity : undefined}
            role="img"
            aria-label={tooltip}
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
              <span className={styles.keeperBadge} aria-label="Keeper">
                K
              </span>
            )}
            {isRosterFullSkip && (
              <span className={styles.skipBadge} aria-label="Roster full skip">
                Full
              </span>
            )}
          </div>
        );
      }

      grid.push(
        <div key={teamId} className={styles.teamRow} data-my-team={teamId === myTeamId}>
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
            <button
              type="button"
              className={styles.teamLabel}
              onClick={
                canEditTeamNames
                  ? (e) =>
                      handleTeamNameClick(
                        e,
                        teamId,
                        teamNameById.get(teamId) || teamId,
                      )
                  : undefined
              }
              aria-disabled={!canEditTeamNames || undefined}
              title={
                canEditTeamNames
                  ? "Click to edit team name"
                  : "Yahoo live sync controls team names"
              }
            >
              {teamNameById.get(teamId) || `T${teamIndex + 1}`}{teamId === myTeamId ? " (You)" : ""}
            </button>
          )}
          <div
            className={styles.teamRoundCells}
            style={{ gridTemplateColumns: `repeat(${roundsToShow}, minmax(0, 1fr))` }}
          >
            {teamCells}
          </div>
        </div>
      );
    }

    return grid;
  };

  return (
    <div className={styles.draftBoardContainer} aria-label="Draft Graph" style={{ "--team-count": draftSettings.teamCount, "--team-rows": Math.ceil(draftSettings.teamCount / 2), "--round-count": roundsToShow } as React.CSSProperties}>
      <div className={styles.contributionGraphContainer}>
        <div className={styles.contributionGraph}>
          {/* Round labels (columns) */}
          <div className={styles.roundLabelsRow}>
          {[0, 1].map((copy) => <div key={copy} className={styles.roundLabels} aria-hidden={copy === 1 ? true : undefined}>
            <div className={styles.teamLabelSpacer}></div>
            <div
              className={styles.roundLabelsGrid}
              style={{ gridTemplateColumns: `repeat(${roundsToShow}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: roundsToShow }, (_, i) => {
                const round = i + 1;
                const isCustomReversed =
                  activeDraftOrderPattern.mode === "custom" &&
                  isRoundReversed(activeDraftOrderPattern, round);
                return (
                  <span
                    key={round}
                    className={`${styles.roundLabel} ${isCustomReversed ? styles.customReversedRound : ""}`}
                    aria-label={copy === 0 ? `Round ${round}${isCustomReversed ? ", custom reversed order" : ""}` : undefined}
                    title={
                      isCustomReversed
                        ? `Round ${round}: custom reversed order`
                        : undefined
                    }
                  >
                    {round}
                    {isCustomReversed && (
                      <span className={styles.reverseMarker} aria-hidden="true">
                        ↶
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>)}
          </div>

          {/* Contribution grid with teams as rows */}
          <div className={styles.contributionGrid}>
            {renderContributionGrid()}
          </div>
        </div>
      </div>
      <div className={styles.legend} aria-label="Draft Graph legend">
        <span className={styles.contributionSummary}>{draftedPlayers.length} selected · {skippedPickNumbers.size} skipped</span>
        <span><i className={styles.intensity3} /> Completed</span>
        <span><i className={styles.currentPick} /> Current pick</span>
        <span><i className={styles.myTeamLegend} /> Your team</span>
        <span><i className={styles.keeperLegend} /> Keeper</span>
        <span><i className={styles.tradeLegend} /> Traded</span>
        {noPickKeepers.length > 0 && <details className={styles.noPickKeepers}><summary><span>No-Pick Keepers</span> ({noPickKeepers.length})</summary><ul>{noPickKeepers.map((keeper) => <li key={keeper.playerId}><strong>{allPlayersData.get(keeper.playerId)?.fullName || `Player #${keeper.playerId}`}</strong> · {teamNameById.get(keeper.teamId) || keeper.teamId}</li>)}</ul></details>}
      </div>
    </div>
  );
};

export default DraftBoard;
