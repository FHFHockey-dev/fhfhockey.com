/////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:/Users/timbr/OneDrive/Desktop/fhfhockey.com-3/web/components/DateRangeMatrix/LinePairGrid.tsx

import React, { useMemo } from "react";
import styles from "../../styles/LinePairGrid.module.scss";
import { calculateLinesAndPairs } from "components/DateRangeMatrix/lineCombinationHelper";
import type { PlayerData } from "components/DateRangeMatrix/utilities";
import type { DRMDataStatus } from "./useDateRangeMatrixData";
import type { ScopedCardStats } from "./fetchAggregatedData";
import PlayerCard from "components/DateRangeMatrix/PlayerCardDRM";
import GoalieCard from "components/DateRangeMatrix/GoalieCardDRM";

type LinePairGridProps = {
  scopeKey: string;
  status: DRMDataStatus;
  roster: PlayerData[];
  scopeGameCount: number;
  cardStats: ScopedCardStats;
};

const LinePairGrid: React.FC<LinePairGridProps> = ({
  scopeKey,
  status,
  roster,
  scopeGameCount,
  cardStats,
}) => {
  const resultIsVisible =
    (status === "success" || status === "partial") &&
    roster.length > 0 &&
    scopeGameCount > 0;
  const { lines, pairs } = useMemo(
    () =>
      resultIsVisible
        ? calculateLinesAndPairs(roster, "line-combination")
        : { lines: [], pairs: [] },
    [resultIsVisible, roster],
  );
  const goalies = useMemo(
    () =>
      resultIsVisible
        ? roster
            .filter((player) => player.playerType === "G")
            .sort((left, right) => right.GP - left.GP)
            .slice(0, 2)
        : [],
    [resultIsVisible, roster],
  );

  if (!resultIsVisible) return null;

  const reorderLine = (line: PlayerData[]): PlayerData[] => {
    // Initialize positions
    let LW: PlayerData | null = null;
    let C: PlayerData | null = null;
    let RW: PlayerData | null = null;

    // First, assign players with only one displayPosition
    line.forEach((player) => {
      if (player.displayPosition === "LW" && !LW) {
        LW = player;
      } else if (player.displayPosition === "C" && !C) {
        C = player;
      } else if (player.displayPosition === "RW" && !RW) {
        RW = player;
      }
    });

    // Next, handle players with multiple display positions
    line.forEach((player) => {
      if (!LW && player.displayPosition.includes("LW")) {
        LW = player;
      } else if (!C && player.displayPosition.includes("C")) {
        C = player;
      } else if (!RW && player.displayPosition.includes("RW")) {
        RW = player;
      }
    });

    // If positions are still unfilled, fill them based on remaining players and ATOI
    const unassignedPlayers = line.filter(
      (player) => player !== LW && player !== C && player !== RW,
    );

    // Parse ATOI into seconds for comparison
    const parseAToiToSeconds = (atoi: string): number => {
      const [minutes, seconds] = atoi.split(":").map(Number);
      return minutes * 60 + seconds;
    };

    unassignedPlayers.sort(
      (a, b) => parseAToiToSeconds(b.ATOI) - parseAToiToSeconds(a.ATOI),
    ); // Sort by ATOI descending

    if (!LW && unassignedPlayers.length > 0) LW = unassignedPlayers.shift()!;
    if (!C && unassignedPlayers.length > 0) C = unassignedPlayers.shift()!;
    if (!RW && unassignedPlayers.length > 0) RW = unassignedPlayers.shift()!;

    // Return the reordered line
    return [LW, C, RW].filter((player) => player !== null) as PlayerData[];
  };

  // Apply the reorder function to each line before rendering
  const reorderedLines = lines.map((line) => reorderLine(line));

  return (
    <div className={styles.gridContainer} data-scope-key={scopeKey}>
      <div className={styles.sectionLabel}>Forward Lines</div>
      <div className={`${styles.sectionLabel} ${styles.defenseLabel}`}>
        Defense Pairs
      </div>

      {reorderedLines.slice(0, 4).map((line, index) => (
        <React.Fragment key={`line-${index}`}>
          {line.map((player, playerIndex) => (
            <PlayerCard
              key={`${player.id}-${index}-${playerIndex}`}
              player={player}
              stats={cardStats.skatersByPlayerId[player.id]}
              scopeGameCount={scopeGameCount}
            />
          ))}
          {pairs[index] &&
            pairs[index].map((player, playerIndex) => (
              <PlayerCard
                key={`${player.id}-${index}-${playerIndex}`}
                player={player}
                stats={cardStats.skatersByPlayerId[player.id]}
                scopeGameCount={scopeGameCount}
              />
            ))}
        </React.Fragment>
      ))}

      {/* Divider */}
      <div className={styles.divider}></div>

      {/* Goalie Container */}
      <div className={styles.goalieContainer}>
        <div className={styles.goalieLabel}>Goaltenders</div>
        <div className={styles.goalieCards}>
          {goalies.map((goalie) => (
            <GoalieCard
              key={goalie.id}
              player={goalie}
              stats={cardStats.goaliesByPlayerId[goalie.id]}
              scopeGameCount={scopeGameCount}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LinePairGrid;
