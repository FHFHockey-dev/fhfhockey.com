/////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:/Users/timbr/OneDrive/Desktop/fhfhockey.com-3/web/components/DateRangeMatrix/LinePairGrid.tsx

import React, { useEffect, useState } from "react";
import styles from "../../styles/LinePairGrid.module.scss";
import { fetchAggregatedData } from "components/DateRangeMatrix/fetchAggregatedData";
import { calculateLinesAndPairs } from "components/DateRangeMatrix/lineCombinationHelper";
import {
  PlayerData,
  formatTime,
  parseTime,
  getFranchiseIdByTeamAbbreviation,
} from "components/DateRangeMatrix/utilities";
import PlayerCard from "components/DateRangeMatrix/PlayerCardDRM";
import GoalieCard from "components/DateRangeMatrix/GoalieCardDRM";

type LinePairGridProps = {
  selectedTeam: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  onLinesAndPairsCalculated: (
    lines: PlayerData[][],
    pairs: PlayerData[][]
  ) => void;
  seasonType: "regularSeason" | "playoffs";
  timeFrame: "L7" | "L14" | "L30" | "Totals";
  dateRange: { start: Date; end: Date };

  homeOrAway?: "home" | "away" | undefined;
  opponentTeamAbbreviation?: string;
  regularSeasonPlayersData: any[];
  playoffPlayersData: any[];
};

const LinePairGrid: React.FC<LinePairGridProps> = ({
  selectedTeam,
  startDate,
  endDate,
  onLinesAndPairsCalculated,
  seasonType,
  timeFrame,
  dateRange,
  homeOrAway = "",
  opponentTeamAbbreviation = "",
  regularSeasonPlayersData,
  playoffPlayersData,
}) => {
  const [aggregatedData, setAggregatedData] = useState<PlayerData[]>([]);
  const [lines, setLines] = useState<PlayerData[][]>([]);
  const [pairs, setPairs] = useState<PlayerData[][]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (selectedTeam && startDate && endDate) {
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
            const franchiseId = getFranchiseIdByTeamAbbreviation(selectedTeam);

            aggregatedPlayersData[playerId] = {
              id: player.playerId,
              teamId: player.teamId,
              franchiseId: franchiseId || 0,
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

        if (updatedRoster.length > 0) {
          const result = calculateLinesAndPairs(
            updatedRoster,
            "line-combination"
          );
          setLines(result.lines);
          setPairs(result.pairs);
          onLinesAndPairsCalculated(result.lines, result.pairs);
        }
      }
    };

    fetchData();
  }, [
    selectedTeam,
    startDate,
    endDate,
    seasonType,
    timeFrame,
    regularSeasonPlayersData,
    playoffPlayersData,
    onLinesAndPairsCalculated,
  ]);

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
      (player) => player !== LW && player !== C && player !== RW
    );

    // Parse ATOI into seconds for comparison
    const parseAToiToSeconds = (atoi: string): number => {
      const [minutes, seconds] = atoi.split(":").map(Number);
      return minutes * 60 + seconds;
    };

    unassignedPlayers.sort(
      (a, b) => parseAToiToSeconds(b.ATOI) - parseAToiToSeconds(a.ATOI)
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
    <div className={styles.gridContainer}>
      <div className={styles.sectionLabel}>Forward Lines</div>
      <div className={`${styles.sectionLabel} ${styles.defenseLabel}`}>
        Defense Pairs
      </div>

      {reorderedLines.slice(0, 4).map((line, index) => (
        <React.Fragment key={`line-${index}`}>
          {line.map((player, playerIndex) => (
            <PlayerCard
              key={`${player.id}-${index}-${playerIndex}`}
              name={player.name}
              firstName={player.name.split(" ")[0]}
              lastName={player.name.split(" ")[1]}
              teamId={player.teamId}
              playerId={player.id.toString()}
              timeFrame={timeFrame}
              dateRange={dateRange} // Pass dateRange to PlayerCard
              displayPosition={player.displayPosition} // Pass displayPosition
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
                playerId={player.id.toString()}
                timeFrame={timeFrame}
                dateRange={dateRange} // Pass dateRange to PlayerCard
                displayPosition={player.displayPosition} // Pass displayPosition
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
          {aggregatedData
            .filter((player) => player.playerType === "G")
            .sort((a, b) => b.GP - a.GP) // Sort by games played, descending
            .slice(0, 2) // Limit to top 2 goalies
            .map((goalie) => (
              <GoalieCard
                key={goalie.id}
                name={goalie.name}
                firstName={goalie.name.split(" ")[0]}
                lastName={goalie.name.split(" ")[1]}
                teamId={goalie.teamId}
                playerId={goalie.id.toString()}
                timeFrame={timeFrame} // Pass timeFrame to GoalieCard
                startDate={startDate?.toISOString().split("T")[0]} // Pass startDate
                endDate={endDate?.toISOString().split("T")[0]} // Pass endDate
              />
            ))}
        </div>
      </div>
    </div>
  );
};

export default LinePairGrid;
