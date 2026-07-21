/////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:/Users/timbr/OneDrive/Desktop/fhfhockey.com-3/web/components/DateRangeMatrix/LinePairGrid.tsx

import React, { useMemo } from "react";
import styles from "../../styles/LinePairGrid.module.scss";
import type { PlayerData } from "components/DateRangeMatrix/utilities";
import type { DRMDataStatus } from "./useDateRangeMatrixData";
import type { ScopedCardStats } from "./fetchAggregatedData";
import PlayerCard from "components/DateRangeMatrix/PlayerCardDRM";
import GoalieCard from "components/DateRangeMatrix/GoalieCardDRM";

type LinePairGridProps = {
  scopeKey: string;
  status: DRMDataStatus;
  roster: PlayerData[];
  lines: readonly (readonly PlayerData[])[];
  pairs: readonly (readonly PlayerData[])[];
  scopeGameCount: number;
  cardStats: ScopedCardStats;
};

function orderForwardLineForPresentation(
  line: readonly PlayerData[],
): PlayerData[] {
  let leftWing: PlayerData | undefined;
  let center: PlayerData | undefined;
  let rightWing: PlayerData | undefined;

  line.forEach((player) => {
    if (player.displayPosition === "LW" && !leftWing) {
      leftWing = player;
    } else if (player.displayPosition === "C" && !center) {
      center = player;
    } else if (player.displayPosition === "RW" && !rightWing) {
      rightWing = player;
    }
  });

  line.forEach((player) => {
    if (!leftWing && player.displayPosition.includes("LW")) {
      leftWing = player;
    } else if (!center && player.displayPosition.includes("C")) {
      center = player;
    } else if (!rightWing && player.displayPosition.includes("RW")) {
      rightWing = player;
    }
  });

  const assignedPlayers = new Set(
    [leftWing, center, rightWing]
      .filter((player): player is PlayerData => player != null)
      .map((player) => player.id),
  );
  const remainingPlayers = line
    .filter((player) => !assignedPlayers.has(player.id))
    .slice()
    .sort((left, right) => {
      const parseAToiToSeconds = (atoi: string): number => {
        const [minutes, seconds] = atoi.split(":").map(Number);
        return minutes * 60 + seconds;
      };
      return parseAToiToSeconds(right.ATOI) - parseAToiToSeconds(left.ATOI);
    });

  if (!leftWing) leftWing = remainingPlayers.shift();
  if (!center) center = remainingPlayers.shift();
  if (!rightWing) rightWing = remainingPlayers.shift();

  return [leftWing, center, rightWing].filter(
    (player): player is PlayerData => player != null,
  );
}

function groupKey(prefix: "line" | "pair", group: readonly PlayerData[]) {
  const playerIds = group.map((player) => player.id).sort((a, b) => a - b);
  return `${prefix}-${playerIds.join("-")}`;
}

const LinePairGrid: React.FC<LinePairGridProps> = ({
  scopeKey,
  status,
  roster,
  lines,
  pairs,
  scopeGameCount,
  cardStats,
}) => {
  const scopeIsVisible =
    (status === "success" || status === "partial") && scopeGameCount > 0;
  const visibleLines = useMemo(
    () =>
      scopeIsVisible
        ? lines.slice(0, 4).map(orderForwardLineForPresentation)
        : [],
    [lines, scopeIsVisible],
  );
  const visiblePairs = useMemo(
    () => (scopeIsVisible ? pairs.slice(0, 3) : []),
    [pairs, scopeIsVisible],
  );
  const goalies = useMemo(
    () =>
      scopeIsVisible
        ? roster
            .filter((player) => player.playerType === "G")
            .sort((left, right) => right.GP - left.GP)
            .slice(0, 2)
        : [],
    [roster, scopeIsVisible],
  );

  if (
    !scopeIsVisible ||
    (visibleLines.length === 0 &&
      visiblePairs.length === 0 &&
      goalies.length === 0)
  ) {
    return null;
  }

  return (
    <div className={styles.gridContainer} data-scope-key={scopeKey}>
      <div className={styles.forwardColumn}>
        <div className={styles.sectionLabel}>Forward Lines</div>
        <div className={styles.forwardLines} data-testid="forward-lines">
          {visibleLines.map((line) => (
            <div
              className={styles.forwardLine}
              data-testid="forward-line"
              key={groupKey("line", line)}
            >
              {line.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  stats={cardStats.skatersByPlayerId[player.id]}
                  scopeGameCount={scopeGameCount}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.divider}></div>

      <div className={styles.defenseColumn}>
        <div className={styles.sectionLabel}>Defense Pairs</div>
        <div className={styles.defensePairs} data-testid="defense-pairs">
          {visiblePairs.map((pair) => (
            <div
              className={styles.defensePair}
              data-testid="defense-pair"
              key={groupKey("pair", pair)}
            >
              {pair.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  stats={cardStats.skatersByPlayerId[player.id]}
                  scopeGameCount={scopeGameCount}
                />
              ))}
            </div>
          ))}
        </div>

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
    </div>
  );
};

export default LinePairGrid;
