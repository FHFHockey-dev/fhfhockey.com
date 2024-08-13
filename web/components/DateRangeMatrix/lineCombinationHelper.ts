/////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\lineCombinationHelper.ts

import { PlayerData } from "./utilities";

export type LinePairResult = {
  lines: PlayerData[][];
  pairs: PlayerData[][];
};

export const calculateLinesAndPairs = (
  aggregatedData: PlayerData[],
  mode: "line-combination" | "full-roster"
): LinePairResult => {
  const calculateComboPoints = (player: PlayerData) => {
    const timesOnLine = player.timesOnLine || {};
    const timesOnPair = player.timesOnPair || {};
    player.comboPoints =
      (timesOnLine["1"] || 0) * 4 +
      (timesOnLine["2"] || 0) * 3 +
      (timesOnLine["3"] || 0) * 2 +
      (timesOnLine["4"] || 0) * 1 +
      (timesOnPair["1"] || 0) * 3 +
      (timesOnPair["2"] || 0) * 2 +
      (timesOnPair["3"] || 0) * 1;
    return player;
  };

  console.log("Aggregated Data:", aggregatedData);

  const sortedRoster = aggregatedData
    .map(calculateComboPoints)
    .sort((a, b) => (b.comboPoints ?? 0) - (a.comboPoints ?? 0));

  const assignGroups = (
    players: PlayerData[],
    groupSize: number,
    assignedPlayers: Set<number>
  ): PlayerData[] => {
    if (players.length === 0) return [];

    const pivotPlayer = players.find(
      (player) => !assignedPlayers.has(player.id)
    );
    if (!pivotPlayer) return [];

    assignedPlayers.add(pivotPlayer.id);

    const group: PlayerData[] = [pivotPlayer];
    const remainingPlayers = players.filter(
      (player) => !assignedPlayers.has(player.id)
    );

    remainingPlayers.sort((a, b) => {
      const mutualToiA = pivotPlayer.mutualSharedToi?.[a.id] || 0;
      const mutualToiB = pivotPlayer.mutualSharedToi?.[b.id] || 0;
      return mutualToiB - mutualToiA;
    });

    for (let i = 0; i < groupSize - 1; i++) {
      if (remainingPlayers[i]) {
        group.push(remainingPlayers[i]);
        assignedPlayers.add(remainingPlayers[i].id);
      }
    }

    return group;
  };

  const assignedPlayers = new Set<number>();
  const linesArray: PlayerData[][] = [];
  const pairsArray: PlayerData[][] = [];

  const forwards = sortedRoster.filter((player) => player.playerType === "F");
  const defensemen = sortedRoster.filter((player) => player.playerType === "D");

  while (forwards.length > 0) {
    const linePlayers = assignGroups(forwards, 3, assignedPlayers);
    if (linePlayers.length === 3) {
      linesArray.push(linePlayers);
      forwards.splice(
        0,
        forwards.length,
        ...forwards.filter((player) => !assignedPlayers.has(player.id))
      );
    } else {
      break;
    }
  }

  while (defensemen.length > 0) {
    const pairPlayers = assignGroups(defensemen, 2, assignedPlayers);
    if (pairPlayers.length === 2) {
      pairsArray.push(pairPlayers);
      defensemen.splice(
        0,
        defensemen.length,
        ...defensemen.filter((player) => !assignedPlayers.has(player.id))
      );
    } else {
      break;
    }
  }

  // Apply limits for line-combination mode
  if (mode === "line-combination") {
    linesArray.splice(4); // Limit to 4 lines
    pairsArray.splice(3); // Limit to 3 pairs
  }

  console.log("Calculated Lines:", linesArray);
  console.log("Calculated Pairs:", pairsArray);

  return { lines: linesArray, pairs: pairsArray };
};
