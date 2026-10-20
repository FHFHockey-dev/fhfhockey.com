import type { PlanIntent, PlanningPlayer } from "./planningTypes";

/** One retention policy for every RSO drop surface (R7): the DROP chip, Best Fit swaps and the planner search.
 * Ownership is platform-wide demand, never league availability or a claim probability, and never changes objective values. */

/** Fresh Yahoo ownership at or above this share earns a high-demand caution on any drop (TJ, 2026-10-20). */
export const HIGH_DEMAND_OWNERSHIP_PCT = 50;
/** Provider injury designations that mean the player won't play (day-to-day still might). */
const OUT_INJURY_STATUSES = new Set(["IR", "IR-LT", "IR-NR", "O"]);
const RESERVE_POSITIONS = new Set(["IR", "IR+", "NA"]);

/** Out per the provider: never valued in a lineup and never an automatic drop. */
export const providerListsOut = (player: Pick<PlanningPlayer, "injury">) => !!player.injury && OUT_INJURY_STATUSES.has(player.injury.status.toUpperCase());

/** The loader sets `ownership` only for a fresh (≤3-day) 0–100 observation, so a number is known and fresh; 0 is a real 0%.
 * Anything else (null, absent, invalid) is unknown: neither low nor high demand. */
export function knownOwnership(player: Pick<PlanningPlayer, "ownership"> | undefined): number | null {
  const value = player?.ownership;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

export type RetentionCaution = { level: "high_demand" | "none" | "stale" | "unknown"; ownership: number | null };
/** A last-known reading older than the fresh window (W2): display only, never a caution or tie-break input. */
const staleOwnership = (player: Pick<PlanningPlayer, "ownershipEvidence"> | undefined) => {
  const evidence = player?.ownershipEvidence;
  return evidence?.status === "stale" && typeof evidence.value === "number" && Number.isFinite(evidence.value) && evidence.observedOn ? evidence : null;
};
/** Caution is shown beside a drop, whatever the player's remaining games; it never ranks or filters on its own. */
export function retentionCaution(player: Pick<PlanningPlayer, "ownership" | "ownershipEvidence"> | undefined): RetentionCaution {
  const ownership = knownOwnership(player);
  return { level: ownership === null ? staleOwnership(player) ? "stale" : "unknown" : ownership >= HIGH_DEMAND_OWNERSHIP_PCT ? "high_demand" : "none", ownership };
}

/** Players held in a reserve slot, now or by a prior reserve step, free no active or bench spot. */
export function reservedPlayerIds(roster: Array<{ playerId: string; position: string }>, prior: Array<{ type: string; playerId: string }> = []) {
  return new Set([...roster.filter(entry => RESERVE_POSITIONS.has(entry.position)).map(entry => entry.playerId),
    ...prior.filter(step => step.type === "reserve").map(step => step.playerId)]);
}

/** Who may be offered as an automatic drop. Explicit manual choices are not gated here. */
export function dropEligible(player: PlanningPlayer, intent: Pick<PlanIntent, "protectedPlayerIds">, reserved: ReadonlySet<string>) {
  return player.canDrop === true && !intent.protectedPlayerIds.includes(player.id) && !reserved.has(player.id) && !providerListsOut(player);
}

/** The contribution the drop order ranks on: projected points in points leagues, active games otherwise. */
export const dropContribution = (mode: string, row: { projectedPoints: number | null; activeGames: number | null } | undefined) =>
  mode === "points" ? row?.projectedPoints ?? null : row?.activeGames ?? null;

const nullsLast = (left: number | null, right: number | null) => left === right ? 0 : left === null ? 1 : right === null ? -1 : left - right;

/** Lowest contribution first. Ownership breaks only exact contribution ties, and only when every tied player's ownership is
 * known: one unknown member sends the whole group to holdValue/id order. Deciding per group, never per pair, keeps the
 * order transitive (a pairwise "ownership when both known, else holdValue" rule can cycle). */
export function orderDropCandidates<T extends PlanningPlayer>(players: T[], contribution: (player: T) => number | null): T[] {
  const groups = new Map<number | null, T[]>();
  for (const player of players) {
    const value = contribution(player);
    const key = typeof value === "number" && Number.isFinite(value) ? value : null;
    groups.set(key, [...groups.get(key) ?? [], player]);
  }
  return [...groups.entries()].sort(([left], [right]) => nullsLast(left, right)).flatMap(([, group]) => {
    const byOwnership = group.every(player => knownOwnership(player) !== null);
    return [...group].sort((a, b) => (byOwnership ? knownOwnership(a)! - knownOwnership(b)! : 0)
      || nullsLast(a.holdValue, b.holdValue) || a.id.localeCompare(b.id));
  });
}

/** Highest known ownership among a plan's dropped players; null when it drops nobody or any drop's ownership is unknown. */
export function droppedOwnership(steps: Array<{ type: string; playerId: string; dropPlayerId?: string }>, players: ReadonlyMap<string, PlanningPlayer>) {
  const ids = steps.flatMap(step => step.type === "drop" ? [step.playerId] : step.dropPlayerId ? [step.dropPlayerId] : []);
  if (!ids.length) return null;
  const values = ids.map(id => knownOwnership(players.get(id)));
  return values.every((value): value is number => value !== null) ? Math.max(...values) : null;
}

const percent = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);
/** W1/W2/W3: a reported 0 reads "0%"; a stale reading is labelled last known; anything missing reads "unknown", never "—%". */
export const ownershipLabel = (player: Pick<PlanningPlayer, "ownership" | "ownershipEvidence"> | undefined) => {
  const ownership = knownOwnership(player), stale = staleOwnership(player);
  return ownership !== null ? `Ownership ${percent(ownership)}%`
    : stale ? `Ownership ${percent(stale.value!)}% · last known ${stale.observedOn}` : "Ownership unknown";
};
/** W4/W5: shown beside a suggested drop; no text when demand is known and below the threshold, or only last known. */
export function retentionCautionText(caution: RetentionCaution): string | null {
  if (caution.level === "high_demand") return `Widely rostered: ${percent(caution.ownership!)}% of Yahoo leagues. Others may claim him quickly if dropped.`;
  return caution.level === "unknown" ? "Ownership unknown. Demand from other managers isn't checked." : null;
}
/** W6: shown when ownership alone chose this plan over an exactly equivalent one. */
export const OWNERSHIP_TIE_NOTE = "Same projected result as other options. This one drops the less-rostered player.";
