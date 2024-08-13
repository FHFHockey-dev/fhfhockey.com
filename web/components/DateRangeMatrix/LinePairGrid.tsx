/////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:/Users/timbr/OneDrive/Desktop/fhfhockey.com-3/web/components/DateRangeMatrix/LinePairGrid.tsx

import React, { useEffect, useState } from "react";
import styles from "../../styles/LinePairGrid.module.scss";
import { teamsInfo } from "lib/NHL/teamsInfo";
import { fetchAggregatedData } from "web/components/DateRangeMatrix/fetchAggregatedData";
import { calculateLinesAndPairs } from "web/components/DateRangeMatrix/lineCombinationHelper";
import {
  PlayerData,
  formatTime,
  parseTime,
} from "web/components/DateRangeMatrix/utilities";
import PlayerCard from "web/components/DateRangeMatrix/PlayerCardDRM";

type LinePairGridProps = {
  selectedTeam: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  onLinesAndPairsCalculated: (
    lines: PlayerData[][],
    pairs: PlayerData[][]
  ) => void;
  seasonType: "regularSeason" | "playoffs";
};

const LinePairGrid: React.FC<LinePairGridProps> = ({
  selectedTeam,
  startDate,
  endDate,
  onLinesAndPairsCalculated,
  seasonType,
}) => {
  const [aggregatedData, setAggregatedData] = useState<PlayerData[]>([]);
  const [lines, setLines] = useState<PlayerData[][]>([]);
  const [pairs, setPairs] = useState<PlayerData[][]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (aggregatedData.length > 0) {
      const result = calculateLinesAndPairs(aggregatedData, "line-combination");
      setLines(result.lines);
      setPairs(result.pairs);

      console.log("Lines in LinePairGrid.tsx:", result.lines);
      console.log("Pairs in LinePairGrid.tsx:", result.pairs);

      // Invoke the callback with the calculated lines and pairs
      onLinesAndPairsCalculated(result.lines, result.pairs);
    }
  }, [aggregatedData]);

  useEffect(() => {
    const fetchData = async () => {
      if (selectedTeam && startDate && endDate) {
        setLoading(true);

        const { regularSeasonPlayersData, playoffPlayersData } =
          await fetchAggregatedData(
            selectedTeam,
            startDate.toISOString().split("T")[0],
            endDate.toISOString().split("T")[0],
            seasonType
          );

        const allPlayersData =
          seasonType === "regularSeason"
            ? Object.values(regularSeasonPlayersData)
            : Object.values(playoffPlayersData);

        const aggregatedPlayersData: Record<number, PlayerData> = {};

        allPlayersData.forEach((playerData) => {
          const player = playerData as {
            playerId: number;
            teamId: number;
            primaryPosition: string;
            playerName: string;
            playerAbbrevName: string;
            lastName: string;
            displayPosition: string;
            playerType: string;
            regularSeasonData: any;
            playoffData: any;
          };

          const playerId = player.playerId;

          if (!aggregatedPlayersData[playerId]) {
            aggregatedPlayersData[playerId] = {
              id: player.playerId,
              teamId: player.teamId,
              position: player.primaryPosition,
              name: player.playerName,
              playerAbbrevName: player.playerAbbrevName,
              lastName: player.lastName,
              totalTOI: 0,
              timesOnLine: {},
              timesOnPair: {},
              percentToiWith: {},
              percentToiWithMixed: {},
              timeSpentWith: {},
              timeSpentWithMixed: {},
              GP: 0,
              timesPlayedWith: {},
              ATOI: "00:00",
              percentOfSeason: {},
              displayPosition: player.displayPosition,
              comboPoints: 0,
              mutualSharedToi: {},
              playerType: player.playerType,
            };
          }

          const aggregatedPlayer = aggregatedPlayersData[playerId];

          // Use the correct season type data
          const seasonData =
            seasonType === "regularSeason"
              ? player.regularSeasonData
              : player.playoffData;

          if (seasonData) {
            aggregatedPlayer.GP += seasonData.GP;
            aggregatedPlayer.totalTOI += parseTime(seasonData.totalTOI);

            aggregatedPlayer.timesOnLine = {
              ...aggregatedPlayer.timesOnLine,
              ...seasonData.timesOnLine,
            };
            aggregatedPlayer.timesOnPair = {
              ...aggregatedPlayer.timesOnPair,
              ...seasonData.timesOnPair,
            };
            aggregatedPlayer.percentToiWith = {
              ...aggregatedPlayer.percentToiWith,
              ...seasonData.percentToiWith,
            };
            aggregatedPlayer.percentToiWithMixed = {
              ...aggregatedPlayer.percentToiWithMixed,
              ...seasonData.percentToiWithMixed,
            };
            aggregatedPlayer.timeSpentWith = {
              ...aggregatedPlayer.timeSpentWith,
              ...seasonData.timeSpentWith,
            };
            aggregatedPlayer.timeSpentWithMixed = {
              ...aggregatedPlayer.timeSpentWithMixed,
              ...seasonData.timeSpentWithMixed,
            };
            aggregatedPlayer.timesPlayedWith = {
              ...aggregatedPlayer.timesPlayedWith,
              ...seasonData.timesPlayedWith,
            };
            aggregatedPlayer.percentOfSeason = {
              ...aggregatedPlayer.percentOfSeason,
              ...seasonData.percentOfSeason,
            };
          }
        });

        Object.values(aggregatedPlayersData).forEach((player) => {
          if (player.GP > 0) {
            const atoInSeconds = player.totalTOI / player.GP;
            player.ATOI = formatTime(atoInSeconds);
          } else {
            player.ATOI = "00:00"; // Default to "00:00" if no games were played
          }
        });

        const updatedRoster = Object.values(aggregatedPlayersData).map(
          (player) => {
            const mutualSharedToi: Record<number, number> = {};
            for (const teammateId in player.percentToiWith) {
              const teammate = aggregatedPlayersData[parseInt(teammateId)];
              if (teammate) {
                const avgToi =
                  (player.percentToiWith[teammate.id] +
                    teammate.percentToiWith[player.id]) /
                  2;
                mutualSharedToi[teammate.id] = avgToi;
              }
            }
            player.mutualSharedToi = mutualSharedToi;
            return player;
          }
        );

        setAggregatedData(updatedRoster);
        console.log("Aggregated Data in LinePairGrid.tsx:", updatedRoster);
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedTeam, startDate, endDate, seasonType]);

  const arrangePlayersByDeductiveLogic = (line: PlayerData[]) => {
    const positions = ["LW", "C", "RW"];
    const assignedPositions: { [key: string]: PlayerData | null } = {
      LW: null,
      C: null,
      RW: null,
    };
    const remainingPlayers: PlayerData[] = [...line];

    // Step 1: Assign unique positions
    positions.forEach((position) => {
      const playersWithPosition = remainingPlayers.filter(
        (player) =>
          player.displayPosition &&
          player.displayPosition.split(",").includes(position)
      );

      if (playersWithPosition.length === 1) {
        assignedPositions[position] = playersWithPosition[0];
        remainingPlayers.splice(
          remainingPlayers.indexOf(playersWithPosition[0]),
          1
        );
      }
    });

    // Step 2: Deduction through exclusionary comparison
    while (remainingPlayers.length > 0) {
      const player1 = remainingPlayers[0];
      const player2 = remainingPlayers[1];

      // Ensure both players are defined before proceeding
      if (!player1 || !player2) break;

      let uniquePos1: string | null = null;
      let uniquePos2: string | null = null;

      // Compare positions
      positions.forEach((position) => {
        const player1Has =
          player1.displayPosition &&
          player1.displayPosition.split(",").includes(position);
        const player2Has =
          player2.displayPosition &&
          player2.displayPosition.split(",").includes(position);

        if (player1Has && !player2Has) {
          uniquePos1 = position;
        } else if (!player1Has && player2Has) {
          uniquePos2 = position;
        }
      });

      // Assign positions based on unique identifiers
      if (uniquePos1 && !assignedPositions[uniquePos1]) {
        assignedPositions[uniquePos1] = player1;
        remainingPlayers.splice(remainingPlayers.indexOf(player1), 1);
      }

      if (uniquePos2 && !assignedPositions[uniquePos2]) {
        assignedPositions[uniquePos2] = player2;
        remainingPlayers.splice(remainingPlayers.indexOf(player2), 1);
      }
    }

    // Step 3: Fill remaining positions with ATOI if conflicts remain
    remainingPlayers.forEach((player) => {
      const unassignedPosition = positions.find(
        (position) => !assignedPositions[position]
      );

      if (unassignedPosition) {
        assignedPositions[unassignedPosition] = player;
      }
    });

    return [
      assignedPositions.LW,
      assignedPositions.C,
      assignedPositions.RW,
    ].filter(Boolean);
  };

  return (
    <div className={styles.gridContainer}>
      <div className={styles.sectionLabel}>Forward Lines</div>
      <div className={`${styles.sectionLabel} ${styles.defenseLabel}`}>
        Defense Pairs
      </div>

      {lines.slice(0, 4).map((line, index) => (
        <React.Fragment key={`line-${index}`}>
          {arrangePlayersByDeductiveLogic(line)
            .filter((player): player is PlayerData => player !== null) // Filter out null values

            .map((player, playerIndex) => (
              <PlayerCard
                key={`${player.id}-${index}-${playerIndex}`}
                name={player.name}
                firstName={player.name.split(" ")[0]}
                lastName={player.name.split(" ")[1]}
                teamId={player.teamId}
              />
            ))}
          {pairs[index] &&
            pairs[index].map((player, playerIndex) => (
              <PlayerCard
                key={`${player.id}-${index}-${playerIndex}`}
                name={player.name}
                firstName={player.name.split(" ")[0]}
                lastName={player.name.split(" ")[1]}
                teamId={player.teamId}
              />
            ))}
        </React.Fragment>
      ))}

      {/* Divider */}
      <div className={styles.divider}></div>

      <div className={styles.goalieContainer}>
        <div className={styles.goalieLabel}>Goaltenders</div>
        <div className={styles.goalieCards}>
          <PlayerCard
            name="GOALIE"
            firstName="GOALIE"
            lastName="GOALIE"
            teamId={0}
          />
          <PlayerCard
            name="GOALIE"
            firstName="GOALIE"
            lastName="GOALIE"
            teamId={0}
          />
        </div>
      </div>
    </div>
  );
};

export default LinePairGrid;
