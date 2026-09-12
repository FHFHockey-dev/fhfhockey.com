import { findNextActionablePick, resolvePickOwner } from "./pickTrades";
import { keeperUsesPick } from "./keepers";

export type GodViewPick = { pickNumber: number; round: number; pickInRound: number; teamId: string; status: "upcoming" | "completed" | "keeper" | "skipped"; playerId?: string };
type TimelineInput = Parameters<typeof findNextActionablePick>[0] & {
  draftedPlayers?: readonly { pickNumber: number; playerId: string; teamId: string; isKeeper?: boolean }[];
};

/** Every scheduled pick, retaining history and the existing ownership rules. */
export function selectGodViewQueue(input: TimelineInput): GodViewPick[] {
  const count = input.draftOrder.length;
  if (!count) return [];
  const drafted = new Map(input.draftedPlayers?.map(pick => [pick.pickNumber, pick]));
  const completed = new Set(input.completedPickNumbers);
  const keepers = new Map(input.keepers?.filter(keeperUsesPick).map(keeper => [keeper.pickNumber, keeper]));
  return Array.from({ length: Math.max(0, input.maxPickNumber) }, (_, index) => {
    const pickNumber = index + 1;
    const round = Math.ceil(pickNumber / count);
    const pickInRound = index % count + 1;
    const selection = drafted.get(pickNumber);
    const keeper = keepers.get(pickNumber);
    const teamId = selection?.teamId ?? resolvePickOwner({ ...input, round, pickInRound }).currentTeamId;
    const status: GodViewPick["status"] = keeper || selection?.isKeeper ? "keeper"
      : selection || completed.has(pickNumber) ? "completed"
      : pickNumber < input.startPick ? "skipped" : "upcoming";
    return { pickNumber, round, pickInRound, teamId, status, playerId: selection?.playerId ?? keeper?.playerId };
  });
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

/** A vacancy summary: required lineup slots precede utility and bench slots. */
export function godViewRosterNeeds(progress: ReturnType<typeof godViewRosterProgress>) {
  const optional = new Set(["BENCH", "BN", "UTILITY", "UTIL"]);
  return progress.filter((slot) => slot.open > 0)
    .sort((a, b) => Number(optional.has(a.position)) - Number(optional.has(b.position)) || b.open - a.open)
    .slice(0, 3);
}

export type PickWindow = { offset: number; pickNumber: number; round: number; pickInRound: number };
/** Offsets count selectable picks only, using current ownership without simulating selections. */
export function selectMyPickWindows(input: TimelineInput, myTeamId: string): PickWindow[] {
  if (!input.draftOrder.length) return [];
  const completed = new Set(input.completedPickNumbers);
  input.keepers?.filter(keeperUsesPick).forEach(keeper => completed.add(keeper.pickNumber));
  const windows: PickWindow[] = [];
  let offset = 0;
  for (let start = input.startPick; start <= input.maxPickNumber;) {
    const pickNumber = findNextActionablePick({ ...input, startPick: start, completedPickNumbers: completed });
    if (pickNumber > input.maxPickNumber) break;
    const round = Math.ceil(pickNumber / input.draftOrder.length);
    const pickInRound = (pickNumber - 1) % input.draftOrder.length + 1;
    if (resolvePickOwner({ ...input, round, pickInRound }).currentTeamId === myTeamId) {
      windows.push({ offset, pickNumber, round, pickInRound });
    }
    offset++;
    start = pickNumber + 1;
  }
  return windows;
}
