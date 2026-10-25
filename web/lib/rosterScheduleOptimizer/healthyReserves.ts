import { evaluatePlan } from "./planning";
import { localDate } from "./planningDates";
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
  activation: Activation | null;
};
type Activation = { swapPlayerId: string | null; projectedPoints: number | null; activeGames: number | null };
type Reserved = RosterEntry & { position: "IR" | "IR+" };

const RESERVE_POSITIONS = new Set(["IR", "IR+", "NA"]);
const descending = (left: number | null, right: number | null) => left === right ? 0 : left === null ? 1 : right === null ? -1 : right - left;

/** The healthy rule: a live, complete Yahoo roster read returned him with no injury designation (`injury` null;
 * absent means never read, so unknown). Yahoo's IR+ also holds DTD and O players: still injured and legally placed,
 * so not flagged. NA spots are for non-injury statuses and are out of scope. */
export function isHealthyReserve(snapshot: PlanningSnapshot, entry: RosterEntry, player: PlanningPlayer | undefined): entry is RosterEntry & { position: "IR" | "IR+" } {
  return (entry.position === "IR" || entry.position === "IR+") && player?.injury === null
    && snapshot.context.provider === "yahoo" && snapshot.evidence.roster?.completeness === "complete";
}

/** TJ 2026-10-25: DTD players in IR+ whose team has a game still to start today, from a live, complete Yahoo read. They
 * may play, so the alert adds a soft note (never a warning); no note on days his team doesn't play. */
export function dtdReserves(snapshot: PlanningSnapshot): string[] {
  if (snapshot.context.provider !== "yahoo" || snapshot.evidence.roster?.completeness !== "complete") return [];
  const today = localDate(snapshot.context.asOf, snapshot.context.timeZone);
  const playing = new Set(snapshot.games.filter(game => game.date === today && game.status === "scheduled").map(game => game.teamAbbreviation));
  const players = new Map(snapshot.players.map(player => [player.id, player]));
  return snapshot.roster.filter(entry => {
    const player = players.get(entry.playerId);
    return entry.position === "IR+" && player?.injury?.status === "DTD" && !!player.teamAbbreviation && playing.has(player.teamAbbreviation);
  }).map(entry => entry.playerId);
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
  const byGain = (a: Activation, b: Activation) => descending(a.projectedPoints, b.projectedPoints) || descending(a.activeGames, b.activeGames);
  const activate = (entry: Reserved, swapPlayerId: string | null): Activation => {
    const roster = [...base.map(row => row.playerId === swapPlayerId ? { ...row, position: entry.position } : row),
      { playerId: entry.playerId, position: "bench" as const }];
    return { swapPlayerId, ...gain(run(roster)) };
  };
  const swaps = new Map<string, Activation[]>();
  const bestSwap = (entry: Reserved, taken: Set<string>) => {
    if (!swaps.has(entry.playerId)) swaps.set(entry.playerId, base.filter(row => !RESERVE_POSITIONS.has(row.position)
      && players.get(row.playerId)?.reserveEligibility.includes(entry.position)).map(row => row.playerId).sort()
      .map(id => activate(entry, id)).sort(byGain));
    return swaps.get(entry.playerId)!.find(option => !taken.has(option.swapPlayerId!)) ?? null;
  };
  // TJ 2026-10-25: flagged players compete for the open spots and swap partners, best projected gain first
  // (unknown gains last); each spot or partner activates one player, the rest need a drop.
  const ranked = healthy.map(entry => ({ entry, best: openSpots > 0 ? activate(entry, null) : bestSwap(entry, new Set()) }))
    .sort((a, b) => !a.best || !b.best ? Number(!a.best) - Number(!b.best) : byGain(a.best, b.best));
  let spots = openSpots;
  const taken = new Set<string>();
  return ranked.map(({ entry, best }) => {
    const activation = spots-- > 0 ? best : bestSwap(entry, taken);
    if (activation?.swapPlayerId) taken.add(activation.swapPlayerId);
    return { playerId: entry.playerId, position: entry.position,
      slotEligible: players.get(entry.playerId)!.reserveEligibility.includes(entry.position), activation };
  });
}
