/**
 * League-aware replacement reference (owner decisions 76, 77, 113; audit W2-5
 * D3/D4).
 *
 * Slots are filled by one global assignment: every rostered slot holds one
 * player and every player holds at most one slot. Players are taken in value
 * order and kept whenever some reassignment of the already-kept players can
 * fit them (an augmenting path). Because the kept sets form a transversal
 * matroid, this greedy order maximises total slot value; a greedy
 * "fill C, then LW, …" pass does not.
 *
 * UTIL accepts any non-goalie (decision 113). Bench slots accept any player;
 * the Draft Dashboard counts the league's bench (TJ, 2026-11-11).
 */

export const UTIL_SLOT = "UTIL";
export const BENCH_SLOT = "BENCH";
export const REPLACEMENT_REFERENCE_VERSION = "frozen-global-assignment-v1";

export type SlotPlayer = { id: string; value: number; eligible: readonly string[] };

export type SlotAssignment = {
  /** player id → slot name */
  assigned: Map<string, string>;
  /** ids left unassigned, in value order */
  unassigned: string[];
};

export function slotAccepts(slot: string, eligible: readonly string[]) {
  if (slot === BENCH_SLOT) return eligible.length > 0;
  if (slot === UTIL_SLOT) return eligible.some((position) => position !== "G");
  return eligible.includes(slot);
}

const byValue = (a: SlotPlayer, b: SlotPlayer) =>
  b.value - a.value || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Optimal one-player/one-slot assignment. `fixed` players (already drafted)
 * keep a slot first, in value order, before `candidates` are considered.
 */
export function assignSlotsGlobally(
  candidates: readonly SlotPlayer[],
  capacities: Readonly<Record<string, number>>,
  fixed: readonly SlotPlayer[] = [],
): SlotAssignment {
  const slots = Object.keys(capacities).filter((slot) => capacities[slot] > 0);
  const occupants: Record<string, SlotPlayer[]> = Object.fromEntries(
    slots.map((slot) => [slot, []]),
  );
  const assigned = new Map<string, string>();
  const unassigned: string[] = [];

  const place = (player: SlotPlayer, visited: Set<string>): boolean => {
    for (const slot of slots) {
      if (visited.has(slot) || !slotAccepts(slot, player.eligible)) continue;
      visited.add(slot);
      if (occupants[slot].length < Math.floor(capacities[slot])) {
        occupants[slot].push(player);
        assigned.set(player.id, slot);
        return true;
      }
      for (const occupant of occupants[slot]) {
        if (place(occupant, visited)) {
          occupants[slot] = occupants[slot].filter((item) => item !== occupant);
          occupants[slot].push(player);
          assigned.set(player.id, slot);
          return true;
        }
      }
    }
    return false;
  };

  for (const player of [...fixed].sort(byValue)) place(player, new Set());
  for (const player of [...candidates].sort(byValue)) {
    if (!place(player, new Set())) unassigned.push(player.id);
  }
  return { assigned, unassigned };
}

export type ReplacementReference = {
  version: string;
  /** Best unassigned value eligible at each position (null if none). */
  replacementByPos: Record<string, number | null>;
  /** Lowest value holding each position's own slot (null if none). */
  lastStarterByPos: Record<string, number | null>;
  capacities: Record<string, number>;
  /** Players in the reference whose value was known. */
  pooledCount: number;
};

export function buildReplacementReference({
  players,
  positions,
  capacities,
  fixed = [],
}: {
  players: readonly SlotPlayer[];
  positions: readonly string[];
  capacities: Readonly<Record<string, number>>;
  fixed?: readonly SlotPlayer[];
}): ReplacementReference {
  const { assigned, unassigned } = assignSlotsGlobally(players, capacities, fixed);
  const byId = new Map(players.map((player) => [player.id, player]));
  const replacementByPos: Record<string, number | null> = {};
  const lastStarterByPos: Record<string, number | null> = {};
  for (const position of positions) {
    const free = unassigned
      .map((id) => byId.get(id)!)
      .filter((player) => player.eligible.includes(position));
    replacementByPos[position] = free.length
      ? Math.max(...free.map((player) => player.value))
      : null;
    const holders = [...fixed, ...players].filter(
      (player) => assigned.get(player.id) === position,
    );
    lastStarterByPos[position] = holders.length
      ? Math.min(...holders.map((player) => player.value))
      : null;
  }
  return {
    version: REPLACEMENT_REFERENCE_VERSION,
    replacementByPos,
    lastStarterByPos,
    capacities: { ...capacities },
    pooledCount: players.length + fixed.length,
  };
}

/** League slot capacities: teams × starters per position, UTIL, optional bench. */
export function leagueSlotCapacities({
  teamCount,
  starters,
  positions,
  includeBench = false,
}: {
  teamCount: number;
  starters: Readonly<Record<string, number>>;
  positions: readonly string[];
  includeBench?: boolean;
}) {
  const teams = Math.max(0, Math.floor(teamCount));
  const capacities: Record<string, number> = {};
  for (const position of positions) {
    capacities[position] = teams * Math.max(0, Math.floor(Number(starters[position]) || 0));
  }
  capacities[UTIL_SLOT] = teams * Math.max(0, Math.floor(Number(starters.utility) || 0));
  if (includeBench) {
    capacities[BENCH_SLOT] = teams * Math.max(0, Math.floor(Number(starters.bench) || 0));
  }
  return capacities;
}
