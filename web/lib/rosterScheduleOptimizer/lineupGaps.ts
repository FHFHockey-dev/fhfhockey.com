import { candidatePlanForSort, type CandidateComparison, type CandidatePlan } from "./candidatePlanMetrics";
import { contributionLedger } from "./contributionLedger";
import { canEligibilityOccupySlot, normalizeEligibility } from "./eligibility";
import { expandActiveSlots } from "./slots";
import type { PlanEvaluation, PlanIntent, PlanningSnapshot } from "./planningTypes";
import type { ActiveSlotType } from "./types";

export type LineupGap = { date: string; slot: ActiveSlotType; open: number };
export type GapAdd = { playerId: string; plan: CandidatePlan; fills: Array<{ date: string; slot: ActiveSlotType }>; dropsBest: boolean };
export type LineupGapReport = {
  /** Active slots the no-move lineup leaves empty on dates with games still to play. */
  gaps: LineupGap[];
  openSlots: number;
  bestDrop: { playerId: string; projectedPoints: number | null; activeGames: number | null; frees: LineupGap[] } | null;
  adds: GapAdd[];
};

const RESERVE = new Set(["IR", "IR+", "NA"]);
const nullsLast = (left: number | null, right: number | null) => left === right ? 0 : left === null ? 1 : right === null ? -1 : left - right;
const descending = (left: number | null, right: number | null) => left === right ? 0 : left === null ? 1 : right === null ? -1 : right - left;
function group(entries: Array<{ date: string; slot: ActiveSlotType }>): LineupGap[] {
  const counts = new Map<string, LineupGap>();
  for (const { date, slot } of entries) {
    const key = `${date}|${slot}`;
    counts.set(key, { date, slot, open: (counts.get(key)?.open ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot));
}

/** Readback of the no-move lineup and the existing candidate comparisons: open slots, the weakest
 * droppable player, and the adds that fill those gaps. It runs no search of its own. */
export function lineupGapReport(snapshot: PlanningSnapshot, intent: PlanIntent, baseline: PlanEvaluation,
  candidates: CandidateComparison[] = [], limit = 5): LineupGapReport {
  const slots = expandActiveSlots(snapshot.rules.rosterSlots).activeSlots;
  const slotType = new Map(slots.map(slot => [slot.id, slot.type]));
  const asOf = Date.parse(snapshot.context.asOf);
  const playable = new Set(snapshot.games.filter(game => game.status === "scheduled" && game.date >= snapshot.context.startDate
    && game.date <= snapshot.context.endDate && (!game.startsAt || Date.parse(game.startsAt) >= asOf)).map(game => game.date));
  const open: Array<{ date: string; slot: ActiveSlotType }> = [];
  for (const date of [...playable].sort()) {
    const filled = new Set(baseline.assignments.filter(row => row.date === date).map(row => row.slotId));
    for (const slot of slots) if (!filled.has(slot.id)) open.push({ date, slot: slot.type });
  }
  const gaps = group(open);
  const points = snapshot.rules.scoring.mode === "points";
  const ledger = contributionLedger(snapshot, baseline, { ...intent, steps: [] });
  const players = new Map(snapshot.players.map(player => [player.id, player]));
  const drop = snapshot.roster.filter(row => !RESERVE.has(row.position)).map(row => players.get(row.playerId))
    .filter(player => player?.canDrop === true && !intent.protectedPlayerIds.includes(player.id))
    .map(player => ({ player: player!, contribution: ledger.get(player!.id) }))
    .sort((a, b) => nullsLast(points ? a.contribution?.projectedPoints ?? null : a.contribution?.activeGames ?? null,
      points ? b.contribution?.projectedPoints ?? null : b.contribution?.activeGames ?? null)
      || nullsLast(a.player.holdValue, b.player.holdValue) || a.player.id.localeCompare(b.player.id))[0];
  const bestDrop = drop ? { playerId: drop.player.id, projectedPoints: drop.contribution?.projectedPoints ?? null,
    activeGames: drop.contribution?.activeGames ?? null,
    frees: group(baseline.assignments.filter(row => row.playerId === drop.player.id && playable.has(row.date) && slotType.has(row.slotId))
      .map(row => ({ date: row.date, slot: slotType.get(row.slotId)! }))) } : null;
  const adds: GapAdd[] = [];
  for (const comparison of candidates) {
    const anyPoints = comparison.plans.some(plan => plan.netPoints !== null);
    const plan = candidatePlanForSort(comparison.plans, points && anyPoints ? "points" : "schedule");
    const player = players.get(comparison.playerId);
    if (!plan || !player || !((plan.netPoints ?? 0) > 0 || (plan.netAGP ?? 0) > 0)) continue;
    const dropsBest = !!bestDrop && plan.steps.some(step => step.dropPlayerId === bestDrop.playerId);
    const effective = plan.steps.find(step => step.type === "add" && step.playerId === player.id)?.effectiveAt;
    const eligibility = normalizeEligibility(player.eligiblePositions);
    const remaining = new Map([...gaps, ...(dropsBest ? bestDrop!.frees : [])].map(gap => [`${gap.date}|${gap.slot}`, gap]));
    const fills: GapAdd["fills"] = [];
    for (const game of snapshot.games.filter(row => row.teamAbbreviation === player.teamAbbreviation && playable.has(row.date)
      && (!effective || !row.startsAt || Date.parse(row.startsAt) >= Date.parse(effective))).sort((a, b) => a.date.localeCompare(b.date))) {
      const gap = [...remaining.values()].find(row => row.date === game.date && canEligibilityOccupySlot(eligibility, row.slot));
      if (gap && !fills.some(fill => fill.date === game.date)) fills.push({ date: game.date, slot: gap.slot });
    }
    adds.push({ playerId: player.id, plan, fills, dropsBest });
  }
  adds.sort((a, b) => (points ? descending(a.plan.netPoints, b.plan.netPoints) : 0) || descending(a.plan.netAGP, b.plan.netAGP)
    || descending(a.plan.netPoints, b.plan.netPoints) || b.fills.length - a.fills.length || a.playerId.localeCompare(b.playerId));
  return { gaps, openSlots: open.length, bestDrop, adds: adds.slice(0, limit) };
}
