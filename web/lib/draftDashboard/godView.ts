import { findNextActionablePick, resolvePickOwner } from "./pickTrades";
import { keeperUsesPick } from "./keepers";

export type GodViewPick = { pickNumber: number; round: number; pickInRound: number; teamId: string };

/** A window into known selectable picks; never projects future roster changes. */
export function selectGodViewQueue(input: Parameters<typeof findNextActionablePick>[0]): GodViewPick[] {
  const count = input.draftOrder.length;
  if (!count) return [];
  const completed = new Set(input.completedPickNumbers);
  input.keepers?.filter(keeperUsesPick).forEach((keeper) => completed.add(keeper.pickNumber));
  const context = { ...input, completedPickNumbers: completed };
  const queue: GodViewPick[] = [];
  let cursor = input.startPick;
  while (queue.length < count) {
    const pickNumber = findNextActionablePick({ ...context, startPick: cursor });
    if (pickNumber > input.maxPickNumber) break;
    const round = Math.ceil(pickNumber / count);
    const pickInRound = ((pickNumber - 1) % count) + 1;
    const { currentTeamId: teamId } = resolvePickOwner({ ...input, round, pickInRound });
    queue.push({ pickNumber, round, pickInRound, teamId });
    cursor = pickNumber + 1;
  }
  return queue;
}

/** Read assigned slots, not eligibility, so multi-position players count once. */
export function godViewRosterProgress(
  config: Readonly<Record<string, number>>,
  roster: { rosterSlots: Record<string, readonly unknown[]>; bench: readonly unknown[] } | undefined,
) {
  return Object.entries(config).flatMap(([position, capacity]) => {
    const key = position.toUpperCase();
    const filled = key === "BENCH" ? roster?.bench.length ?? 0 : roster?.rosterSlots[key]?.length ?? 0;
    if (capacity <= 0 && filled === 0) return [];
    return [{ position: key, label: key === "BENCH" ? "BN" : key === "UTILITY" ? "UTIL" : key,
      filled, capacity, open: Math.max(0, capacity - filled), over: Math.max(0, filled - capacity),
      fraction: capacity > 0 ? Math.min(1, filled / capacity) : filled > 0 ? 1 : 0 }];
  });
}
