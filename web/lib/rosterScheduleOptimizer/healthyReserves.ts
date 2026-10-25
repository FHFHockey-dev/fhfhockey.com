import { evaluatePlan } from "./planning";
import { expandActiveSlots } from "./slots";
import type { PlanEvaluation, PlanIntent, PlanningPlayer, PlanningSnapshot, RosterEntry } from "./planningTypes";

/** A rostered player Yahoo lists with no injury who still sits in an IR or IR+ slot. */
export type HealthyReserve = {
  playerId: string;
  position: "IR" | "IR+";
  /** False when Yahoo no longer lists him for that slot: the no-move lineup is illegal until he moves. */
  slotEligible: boolean;
  /** The no-other-move activation: onto an open bench spot, or swapped with a rostered player Yahoo lists for his
   * reserve slot. Null when neither exists (a drop must make room). Gains compare against him staying out of the
   * lineup; null when the planner can't price both lineups (points gain is points leagues only). */
  activation: { swapPlayerId: string | null; projectedPoints: number | null; activeGames: number | null } | null;
};

const RESERVE_POSITIONS = new Set(["IR", "IR+", "NA"]);
const descending = (left: number | null, right: number | null) => left === right ? 0 : left === null ? 1 : right === null ? -1 : right - left;

/** The healthy rule: a live, complete Yahoo roster read returned him with no injury designation (`injury` null;
 * absent means never read, so unknown). Yahoo's IR+ also holds DTD and O players: still injured and legally placed,
 * so not flagged. NA spots are for non-injury statuses and are out of scope. */
export function isHealthyReserve(snapshot: PlanningSnapshot, entry: RosterEntry, player: PlanningPlayer | undefined): entry is RosterEntry & { position: "IR" | "IR+" } {
  return (entry.position === "IR" || entry.position === "IR+") && player?.injury === null
    && snapshot.context.provider === "yahoo" && snapshot.evidence.roster?.completeness === "complete";
}

/** Lineup-gap blockers minus those naming a flagged healthy reserve: his alert already says the lineup is illegal and
 * how to move him. Injured-ineligible and lineup-wide blockers stay. */
export function withoutHealthyReserves<T extends { playerId: string | null }>(blockers: T[], reserves: HealthyReserve[]): T[] {
  const flagged = new Set(reserves.map(reserve => reserve.playerId));
  return blockers.filter(blocker => blocker.playerId === null || !flagged.has(blocker.playerId));
}

/** Flags healthy reserve players and prices activating each one with the no-move lineup. Runs inside the current
 * planning read (forecast authority), at most one evaluation per option. */
export function healthyReserves(snapshot: PlanningSnapshot, intent: PlanIntent): HealthyReserve[] {
  const players = new Map(snapshot.players.map(player => [player.id, player]));
  const healthy = snapshot.roster.filter(entry => isHealthyReserve(snapshot, entry, players.get(entry.playerId)));
  if (!healthy.length) return [];
  const flagged = new Set(healthy.map(entry => entry.playerId));
  // Counterfactual: no flagged player plays, as if each were still legally reserved.
  const base = snapshot.roster.filter(entry => !flagged.has(entry.playerId));
  const points = snapshot.rules.scoring.mode === "points";
  const run = (roster: RosterEntry[]) => evaluatePlan({ ...snapshot, roster }, { ...intent, steps: [] }, points ? "outcome" : "agp", [], false);
  const expanded = expandActiveSlots(snapshot.rules.rosterSlots);
  const openSpots = expanded.activeSlots.length + expanded.benchCapacity - base.filter(entry => !RESERVE_POSITIONS.has(entry.position)).length;
  let without: PlanEvaluation | undefined;
  const gain = (activated: PlanEvaluation) => {
    without ??= run(base);
    const priced = activated.legal && without.legal;
    return { projectedPoints: priced && points && activated.projectedValue !== null && without.projectedValue !== null
      ? activated.projectedValue - without.projectedValue : null, activeGames: priced ? activated.activeGames - without.activeGames : null };
  };
  return healthy.map((entry, index) => {
    const activate = (swapPlayerId: string | null) => {
      const roster = [...base.map(row => row.playerId === swapPlayerId ? { ...row, position: entry.position } : row),
        { playerId: entry.playerId, position: "bench" as const }];
      return { swapPlayerId, ...gain(run(roster)) };
    };
    const reserve = { playerId: entry.playerId, position: entry.position,
      slotEligible: players.get(entry.playerId)!.reserveEligibility.includes(entry.position) };
    // Each open spot activates one flagged player directly; the rest need a swap or a drop.
    if (index < openSpots) return { ...reserve, activation: activate(null) };
    const swaps = base.filter(row => !RESERVE_POSITIONS.has(row.position) && players.get(row.playerId)?.reserveEligibility.includes(entry.position))
      .map(row => row.playerId).sort();
    const best = swaps.map(activate).sort((a, b) => descending(a.projectedPoints, b.projectedPoints) || descending(a.activeGames, b.activeGames))[0];
    return { ...reserve, activation: best ?? null };
  });
}
