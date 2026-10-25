import { evaluatePlan } from "./planning";
import { lineupPeriodAtDate, localDate } from "./planningDates";
import { expandActiveSlots } from "./slots";
import type { LockedAssignment, PlanEvaluation, PlanIntent, PlanningPlayer, PlanningSnapshot, RosterEntry } from "./planningTypes";

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
/** `nextWindow`: the current weekly lineup has locked, so the gain counts only from the next weekly window. */
type Activation = { swapPlayerId: string | null; projectedPoints: number | null; activeGames: number | null; nextWindow?: true };
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
  const run = (roster: RosterEntry[], locks: LockedAssignment[] = []) => evaluatePlan({ ...snapshot, roster,
    lockedAssignments: [...snapshot.lockedAssignments, ...locks] }, { ...intent, steps: [] }, points ? "outcome" : "agp", [], false);
  // TJ 2026-10-25 (policy 3, option A): the planner's weekly rule seats only players rostered outside reserve at the
  // window's lock, so once the current weekly window has locked an activated player sits on the bench until the next
  // window. Weekly leagues only; the same `asOf > lockAt` test the planner uses for a locked window.
  const zone = snapshot.context.timeZone, today = localDate(snapshot.context.asOf, zone);
  const window = snapshot.rules.lineupMode === "weekly" ? lineupPeriodAtDate(today, snapshot.rules.lineupPeriods, zone) : undefined;
  const lockedDates = window?.lockAt && Date.parse(snapshot.context.asOf) > Date.parse(window.lockAt)
    ? [...new Set(snapshot.games.map(game => game.date))].filter(date => date >= today
      && lineupPeriodAtDate(date, snapshot.rules.lineupPeriods, zone)?.id === window.id).sort() : [];
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
    if (!lockedDates.length) return { swapPlayerId, ...gain(run(roster)) };
    return { swapPlayerId, ...gain(run(roster, lockedDates.map(date => ({ date, playerId: entry.playerId, slotId: null })))), nextWindow: true };
  };
  // Each player's options: an open spot (when any), then each swap partner Yahoo lists for his slot, best gain first.
  const options = healthy.map(entry => [...(openSpots > 0 ? [activate(entry, null)] : []),
    ...base.filter(row => !RESERVE_POSITIONS.has(row.position) && players.get(row.playerId)?.reserveEligibility.includes(entry.position))
      .map(row => row.playerId).sort().map(id => activate(entry, id)).sort(byGain)]);
  // TJ 2026-10-25 (C7 H1): each open spot or swap partner activates one flagged player. Choose the assignment that
  // activates the most players, then the most projected points, then active games (unknown gains count as 0). Brute
  // force: only a handful of reserve slots. Ties keep the first assignment found, so earlier roster players win.
  const better = (left: number[], right: number[]) => {
    const at = left.findIndex((value, index) => value !== right[index]);
    return at >= 0 && left[at] > right[at];
  };
  let best: { score: number[]; pick: Array<Activation | null> } = { score: [-1, 0, 0], pick: [] };
  const search = (index: number, spots: number, taken: Set<string>, score: number[], pick: Array<Activation | null>) => {
    if (index === healthy.length) {
      if (better(score, best.score)) best = { score, pick };
      return;
    }
    for (const option of options[index]) {
      if (option.swapPlayerId === null ? spots === 0 : taken.has(option.swapPlayerId)) continue;
      search(index + 1, option.swapPlayerId === null ? spots - 1 : spots, option.swapPlayerId === null ? taken : new Set([...taken, option.swapPlayerId]),
        [score[0] + 1, score[1] + (option.projectedPoints ?? 0), score[2] + (option.activeGames ?? 0)], [...pick, option]);
    }
    search(index + 1, spots, taken, score, [...pick, null]);
  };
  search(0, openSpots, new Set(), [0, 0, 0], []);
  // Listed best gain first (unknown gains, then players left without an activation, last); ties keep roster order.
  return healthy.map((entry, index) => ({ playerId: entry.playerId, position: entry.position,
    slotEligible: players.get(entry.playerId)!.reserveEligibility.includes(entry.position), activation: best.pick[index] }))
    .sort((a, b) => !a.activation || !b.activation ? Number(!a.activation) - Number(!b.activation) : byGain(a.activation, b.activation));
}
