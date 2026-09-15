import type { DraftedPlayer } from "components/DraftDashboard/DraftDashboard";
import type { DraftOrderPattern } from "./draftOrder";
import { keeperUsesPick, type KeeperEntry } from "./keepers";
import { resolvePickOwner, type PickTradeEntry } from "./pickTrades";

export interface RoundRankSnapshot {
  round: number;
  ranks: Record<string, number | null>;
  picks: DraftedPlayer[];
}

/** Reconstruct completed rounds from current picks, so undo/corrections cannot leave stale history. */
export function buildRoundRankHistory(args: {
  teamIds: string[];
  picks: DraftedPlayer[];
  keepers: KeeperEntry[];
  trades: PickTradeEntry[];
  pattern: DraftOrderPattern;
  rosterCapacity: number;
  currentPick: number;
  values: ReadonlyMap<string, number>;
  leagueType: "points" | "categories";
}): RoundRankSnapshot[] {
  const { teamIds, picks, keepers, values, rosterCapacity } = args;
  if (!teamIds.length || rosterCapacity < 1) return [];
  const rosters = new Map(teamIds.map((id) => [id, new Set<string>()]));
  // Keepers are already owned before the draft, including those costing a later pick.
  for (const keeper of keepers) rosters.get(keeper.teamId)?.add(keeper.playerId);
  for (const pick of picks.filter((pick) => pick.isKeeper)) rosters.get(pick.teamId)?.add(pick.playerId);
  const snapshot = (round: number, roundPicks: DraftedPlayer[]): RoundRankSnapshot => {
    let missing = false;
    const totals = teamIds.map((id) => {
      const ids = [...rosters.get(id)!];
      const scores = ids.map((playerId) => values.get(playerId));
      if (scores.some((score) => score == null || !Number.isFinite(score))) missing = true;
      const total = scores.reduce<number>((sum, score) => sum + (score ?? 0), 0);
      return { id, value: args.leagueType === "categories" && ids.length ? total / ids.length : total };
    });
    return { round, picks: roundPicks, ranks: Object.fromEntries(totals.map((team) => [team.id,
      missing ? null : 1 + totals.filter((other) => other.value > team.value + 1e-9).length,
    ])) };
  };
  const history = [snapshot(0, [])];
  const byPick = new Map(picks.map((pick) => [pick.pickNumber, pick]));
  const reserved = new Set(keepers.filter(keeperUsesPick).map((keeper) => keeper.pickNumber));
  let roundPicks: DraftedPlayer[] = [];
  for (let number = 1; number <= teamIds.length * rosterCapacity; number++) {
    const round = Math.ceil(number / teamIds.length);
    const pickInRound = (number - 1) % teamIds.length + 1;
    const pick = byPick.get(number);
    if (pick) {
      rosters.get(pick.teamId)?.add(pick.playerId);
      roundPicks.push(pick);
    } else if (!reserved.has(number)) {
      const owner = resolvePickOwner({ round, pickInRound, draftOrder: teamIds, orderPattern: args.pattern, trades: args.trades, keepers }).currentTeamId;
      // Only accept a skipped slot after the authoritative cursor has passed it.
      if (number >= args.currentPick || (rosters.get(owner)?.size ?? 0) < rosterCapacity) break;
    }
    if (pickInRound === teamIds.length) {
      history.push(snapshot(round, roundPicks));
      roundPicks = [];
    }
  }
  return history;
}

export function roundRankMovement(history: RoundRankSnapshot[], round: number, teamId: string) {
  const before = history[round - 1]?.ranks[teamId];
  const after = history[round]?.ranks[teamId];
  return before == null || after == null ? null : { before, after, delta: before - after };
}

export function rankMovementLabel(movement: NonNullable<ReturnType<typeof roundRankMovement>>) {
  return `Round movement: Rank ${movement.before} ${movement.delta > 0 ? "↑" : movement.delta < 0 ? "↓" : "→"} Rank ${movement.after}`;
}
