/////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\lineCombinationHelper.ts

import { PlayerData, isForward, isDefense } from "./utilities";

export type LinePairResult = {
  lines: PlayerData[][];
  pairs: PlayerData[][];
};

function compareCanonicalPlayerOrder(a: PlayerData, b: PlayerData): number {
  return (b.comboPoints ?? 0) - (a.comboPoints ?? 0) || a.id - b.id;
}

export const calculateLinesAndPairs = (
  aggregatedData: PlayerData[],
  mode: "line-combination" | "full-roster",
): LinePairResult => {
  // comboPoints weights (line 1-4 = 4/3/2/1, pair 1-3 = 3/2/1) are an FHFH
  // presentation choice for ordering pivots, not a fitted usage measure
  // (W2-6 D8, M-LINE-003).
  const withComboPoints = (player: PlayerData): PlayerData => {
    const timesOnLine = player.timesOnLine || {};
    const timesOnPair = player.timesOnPair || {};
    return {
      ...player,
      comboPoints:
        (timesOnLine["1"] || 0) * 4 +
        (timesOnLine["2"] || 0) * 3 +
        (timesOnLine["3"] || 0) * 2 +
        (timesOnLine["4"] || 0) * 1 +
        (timesOnPair["1"] || 0) * 3 +
        (timesOnPair["2"] || 0) * 2 +
        (timesOnPair["3"] || 0) * 1,
    };
  };

  const sortedRoster = aggregatedData
    .map(withComboPoints)
    .sort(compareCanonicalPlayerOrder);

  const assignGroups = (
    players: PlayerData[],
    groupSize: number,
    assignedPlayers: Set<number>,
  ): PlayerData[] => {
    if (players.length === 0) return [];

    const pivotPlayer = players.find(
      (player) => !assignedPlayers.has(player.id),
    );
    if (!pivotPlayer) return [];

    assignedPlayers.add(pivotPlayer.id);

    const group: PlayerData[] = [pivotPlayer];
    const remainingPlayers = players.filter(
      (player) => !assignedPlayers.has(player.id),
    );

    // One unit per sort (M-LINE-003): shared seconds when the pivot carries
    // them (a missing partner shared no time), otherwise the pivot's own-TOI
    // percentage for every candidate. Never seconds for some and % for others.
    const sharedMeasure = pivotPlayer.mutualSharedToi
      ? pivotPlayer.mutualSharedToi
      : pivotPlayer.percentToiWith ?? {};
    remainingPlayers.sort((a, b) => {
      const mutualToiA = sharedMeasure[a.id] ?? 0;
      const mutualToiB = sharedMeasure[b.id] ?? 0;
      return mutualToiB - mutualToiA || compareCanonicalPlayerOrder(a, b);
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

  // Derive skater type if playerType is not provided by input
  const getSkaterType = (p: PlayerData): "F" | "D" | "G" | "U" => {
    const pos = (p.displayPosition || p.position || "").toUpperCase();
    if (isForward(pos)) return "F";
    if (isDefense(pos)) return "D";
    if (pos === "G") return "G";
    return "U";
  };

  const forwards = sortedRoster.filter(
    (player) => (player.playerType || getSkaterType(player)) === "F",
  );
  const defensemen = sortedRoster.filter(
    (player) => (player.playerType || getSkaterType(player)) === "D",
  );

  // Assign all forwards to lines
  while (forwards.length > 0) {
    const linePlayers = assignGroups(forwards, 3, assignedPlayers);
    if (linePlayers.length === 3) {
      linesArray.push(linePlayers);
      forwards.splice(
        0,
        forwards.length,
        ...forwards.filter((player) => !assignedPlayers.has(player.id)),
      );
    } else {
      break;
    }
  }

  // Assign all defensemen to pairs
  while (defensemen.length > 0) {
    const pairPlayers = assignGroups(defensemen, 2, assignedPlayers);
    if (pairPlayers.length === 2) {
      pairsArray.push(pairPlayers);
      defensemen.splice(
        0,
        defensemen.length,
        ...defensemen.filter((player) => !assignedPlayers.has(player.id)),
      );
    } else {
      break;
    }
  }

  // Apply limits only in "line-combination" mode
  if (mode === "line-combination") {
    linesArray.splice(4); // Limit to 4 lines (12 forwards)
    pairsArray.splice(3); // Limit to 3 pairs (6 defensemen)
  }

  // Return the calculated lines and pairs
  return { lines: linesArray, pairs: pairsArray };
};
