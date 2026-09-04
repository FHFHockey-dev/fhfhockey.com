import { canEligibilityOccupySlot, normalizeEligibility } from "./eligibility";
import type {
  ActiveSlotInstance,
  DailyMatchResult,
  OptimizerDiagnostic,
  OptimizerPlayer,
  PlayerAssignment,
} from "./types";

type Edge = {
  to: number;
  reverse: number;
  capacity: number;
  cost: number;
  playerId?: string;
  slotId?: string;
};

type ValidPlayer = {
  player: OptimizerPlayer;
  value: number;
  eligibleSlotIndexes: readonly number[];
};

const EPSILON = 1e-10;

function addEdge(
  graph: Edge[][],
  from: number,
  to: number,
  capacity: number,
  cost: number,
  metadata: Pick<Edge, "playerId" | "slotId"> = {},
): void {
  const forward: Edge = {
    to,
    reverse: graph[to].length,
    capacity,
    cost,
    ...metadata,
  };
  const reverse: Edge = {
    to: from,
    reverse: graph[from].length,
    capacity: 0,
    cost: -cost,
  };
  graph[from].push(forward);
  graph[to].push(reverse);
}

function normalizePlayers(
  players: readonly OptimizerPlayer[],
  slots: readonly ActiveSlotInstance[],
): { valid: readonly ValidPlayer[]; diagnostics: OptimizerDiagnostic[]; unresolvedIds: string[] } {
  const valid: ValidPlayer[] = [];
  const diagnostics: OptimizerDiagnostic[] = [];
  const unresolvedIds: string[] = [];

  for (const player of [...players].sort((left, right) => left.id.localeCompare(right.id))) {
    const eligibility = normalizeEligibility(player.eligiblePositions);
    if (!eligibility.valid) {
      const code =
        eligibility.sourceLabels.length === 0
          ? "EMPTY_ELIGIBILITY"
          : eligibility.unknownLabels.length > 0
            ? "UNKNOWN_ELIGIBILITY"
            : "MIXED_PLAYER_CLASS";
      const detail = eligibility.unknownLabels.length
        ? ` Unknown: ${eligibility.unknownLabels.join(", ")}.`
        : "";
      diagnostics.push({
        code,
        severity: "error",
        playerId: player.id,
        playerName: player.name,
        position: eligibility.unknownLabels.join(", ") || undefined,
        message: `Player ${player.name ?? player.id} has unusable eligibility.${detail}`,
      });
      unresolvedIds.push(player.id);
      continue;
    }
    const value = Number.isFinite(player.value) ? player.value : 0;
    if (!Number.isFinite(player.value)) {
      diagnostics.push({
        code: "INVALID_PLAYER_VALUE",
        severity: "warning",
        playerId: player.id,
        playerName: player.name,
        message: `Player ${player.name ?? player.id} has a non-finite value; 0 was used for attribution.`,
      });
    }
    valid.push({
      player,
      value,
      eligibleSlotIndexes: slots
        .map((slot, index) => ({ slot, index }))
        .filter(({ slot }) => canEligibilityOccupySlot(eligibility, slot.type))
        .map(({ index }) => index),
    });
  }
  return { valid, diagnostics, unresolvedIds };
}

export function assignPlayersToActiveSlots(
  players: readonly OptimizerPlayer[],
  slots: readonly ActiveSlotInstance[],
  date = "",
  yahooWeek: number | null = null,
): DailyMatchResult {
  const sortedSlots = [...slots].sort((left, right) => left.id.localeCompare(right.id));
  const duplicateDiagnostics: OptimizerDiagnostic[] = [];
  const seenPlayerIds = new Set<string>();
  const uniquePlayers = [...players]
    .sort((left, right) => left.id.localeCompare(right.id))
    .filter((player) => {
      if (!seenPlayerIds.has(player.id)) {
        seenPlayerIds.add(player.id);
        return true;
      }
      duplicateDiagnostics.push({
        code: "DUPLICATE_PLAYER_ID",
        severity: "error",
        playerId: player.id,
        playerName: player.name,
        date: date || undefined,
        message: `Duplicate player ${player.name ?? player.id} was ignored for daily assignment.`,
      });
      return false;
    });
  const { valid, diagnostics: eligibilityDiagnostics, unresolvedIds } = normalizePlayers(
    uniquePlayers,
    sortedSlots,
  );
  const diagnostics = [...duplicateDiagnostics, ...eligibilityDiagnostics];
  const source = 0;
  const playerOffset = 1;
  const slotOffset = playerOffset + valid.length;
  const sink = slotOffset + sortedSlots.length;
  const graph: Edge[][] = Array.from({ length: sink + 1 }, () => []);

  valid.forEach(({ player, value, eligibleSlotIndexes }, playerIndex) => {
    const playerNode = playerOffset + playerIndex;
    addEdge(graph, source, playerNode, 1, 0);
    eligibleSlotIndexes.forEach((slotIndex) => {
      const slot = sortedSlots[slotIndex];
      addEdge(graph, playerNode, slotOffset + slotIndex, 1, -value, {
        playerId: player.id,
        slotId: slot.id,
      });
    });
  });
  sortedSlots.forEach((_, slotIndex) =>
    addEdge(graph, slotOffset + slotIndex, sink, 1, 0),
  );

  while (true) {
    const distance = Array<number>(graph.length).fill(Number.POSITIVE_INFINITY);
    const previousNode = Array<number>(graph.length).fill(-1);
    const previousEdge = Array<number>(graph.length).fill(-1);
    distance[source] = 0;

    for (let pass = 0; pass < graph.length - 1; pass += 1) {
      let changed = false;
      for (let node = 0; node < graph.length; node += 1) {
        if (!Number.isFinite(distance[node])) continue;
        for (let edgeIndex = 0; edgeIndex < graph[node].length; edgeIndex += 1) {
          const edge = graph[node][edgeIndex];
          if (edge.capacity === 0) continue;
          const nextDistance = distance[node] + edge.cost;
          if (nextDistance < distance[edge.to] - EPSILON) {
            distance[edge.to] = nextDistance;
            previousNode[edge.to] = node;
            previousEdge[edge.to] = edgeIndex;
            changed = true;
          }
        }
      }
      if (!changed) break;
    }

    if (previousNode[sink] === -1) break;
    for (let node = sink; node !== source; node = previousNode[node]) {
      const from = previousNode[node];
      const edgeIndex = previousEdge[node];
      const edge = graph[from][edgeIndex];
      edge.capacity -= 1;
      graph[node][edge.reverse].capacity += 1;
    }
  }

  const assignments: PlayerAssignment[] = [];
  valid.forEach(({ player, value }, playerIndex) => {
    const playerNode = playerOffset + playerIndex;
    for (const edge of graph[playerNode]) {
      if (!edge.slotId || edge.capacity !== 0) continue;
      const slot = sortedSlots.find((candidate) => candidate.id === edge.slotId);
      if (!slot) continue;
      assignments.push({
        playerId: player.id,
        playerName: player.name,
        slotId: slot.id,
        slotType: slot.type,
        value,
      });
    }
  });
  assignments.sort((left, right) => left.slotId.localeCompare(right.slotId));

  const startedIds = new Set(assignments.map((assignment) => assignment.playerId));
  const benchedPlayerIds = valid
    .map(({ player }) => player.id)
    .filter((playerId) => !startedIds.has(playerId))
    .sort();
  const scheduledPlayerIds = uniquePlayers.map((player) => player.id).sort();
  const unresolvedPlayers = uniquePlayers
    .filter((player) => unresolvedIds.includes(player.id))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((player) => ({
      playerId: player.id,
      playerName: player.name,
      reason: "invalid_eligibility" as const,
    }));

  return {
    assignment: {
      date,
      yahooWeek,
      scheduledPlayerIds,
      assignments,
      benchedPlayerIds,
      unresolvedPlayers,
      scheduledGames: uniquePlayers.length,
      startableGames: assignments.length,
      benchGames: benchedPlayerIds.length,
      unresolvedGames: unresolvedPlayers.length,
    },
    diagnostics: diagnostics.map((diagnostic) => ({ ...diagnostic, date: date || undefined })),
  };
}
