import { candidatePlanForSort, type CandidateComparison, type CandidatePlan } from "./candidatePlanMetrics";
import { contributionLedger } from "./contributionLedger";
import { dropContribution, dropEligible, reservedPlayerIds, retentionCaution, suggestedDrop, type RetentionCaution } from "./retention";
import { canEligibilityOccupySlot, normalizeEligibility } from "./eligibility";
import { expandActiveSlots } from "./slots";
import type { PlanEvaluation, PlanIntent, PlanningPlayer, PlanningSnapshot } from "./planningTypes";
import type { ActiveSlotType } from "./types";

export type LineupGap = { date: string; slot: ActiveSlotType; open: number };
/** Why the no-move lineup's projected points are unknown: the responsible player (null for a lineup-wide cause) and a plain reason. */
export type ProjectionBlocker = { playerId: string | null; reason: string };
export type GapAdd = { playerId: string; plan: CandidatePlan; fills: Array<{ date: string; slot: ActiveSlotType }>; dropsBest: boolean };
export type LineupGapReport = {
  /** Active slots the no-move lineup leaves empty on dates with games still to play. */
  gaps: LineupGap[];
  openSlots: number;
  /** The lowest known contributor among droppable players; null when none has a known contribution. */
  bestDrop: { playerId: string; projectedPoints: number | null; activeGames: number | null; frees: LineupGap[]; caution: RetentionCaution } | null;
  /** Droppable players with no projection of their own (in points leagues, those missing a forecast or named as a
   * blocker; else every unknown contribution): flagged, never suggested. */
  unprojectedDrops: string[];
  /** Why contributions are unknown: an illegal no-move lineup (any mode), or in points leagues the players and games
   * leaving projected points unknown; `playerId` is null for a lineup-wide cause. */
  projectionBlockers: ProjectionBlocker[];
  adds: GapAdd[];
};

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
  // The shared retention policy (same eligibility and order as the planner and Best Fit swaps).
  const reserved = reservedPlayerIds(snapshot.roster);
  const eligible = snapshot.roster.map(row => players.get(row.playerId))
    .filter((player): player is PlanningPlayer => !!player && dropEligible(player, intent, reserved));
  const { player: drop, unprojected: unknown } = suggestedDrop(eligible, player => dropContribution(snapshot.rules.scoring.mode, ledger.get(player.id)));
  // In points leagues one unresolved game (any roster member's, droppable or not) makes the whole lineup's value
  // unknown, so every contribution reads unknown. Name the players and games actually responsible, with the reason;
  // a droppable player with complete forecasts is not "unprojected" just because someone else's game is unknown.
  const lacksForecast = (player: PlanningPlayer) => snapshot.games.some(game => game.teamAbbreviation === player.teamAbbreviation
    && playable.has(game.date) && !snapshot.forecasts.some(forecast => forecast.playerId === player.id && forecast.gameId === game.id));
  // Per player: each kind of gap with the dates it covers, e.g. "no FORGE projection issued for 2026-10-22, 2026-10-24".
  const blocking = new Map<string, Map<string, Set<string>>>();
  if (points && baseline.projectedValue === null) for (const issue of baseline.recommendation?.unresolved ?? []) {
    const player = players.get(issue.playerId);
    const why = (issue.reasons ?? []).filter(reason => reason !== "no_issued_revision").map(reason => reason.replaceAll("_", " "));
    const kind = player?.eligibilityVerified !== true ? "league positions not verified"
      : !snapshot.forecasts.some(forecast => forecast.playerId === issue.playerId && forecast.gameId === issue.gameId)
        ? issue.reasons?.includes("no_issued_revision") || !why.length ? "no FORGE projection issued" : `no projection (${why.join(", ")})`
        : `no usable ${issue.missingTargets.length ? issue.missingTargets.join(", ") : "projection"}${why.length ? ` (${why.join(", ")})` : ""}`;
    const kinds = blocking.get(issue.playerId) ?? new Map<string, Set<string>>();
    blocking.set(issue.playerId, kinds.set(kind, (kinds.get(kind) ?? new Set()).add(issue.date)));
  }
  const projectionBlockers: ProjectionBlocker[] = [...blocking].map(([playerId, kinds]) => ({ playerId,
    reason: `has unknown projected points: ${[...kinds].map(([kind, dates]) => kind === "league positions not verified" ? kind
      : `${kind} for ${[...dates].sort().join(", ")}`).join("; ")}` }));
  // An illegal no-move lineup leaves every contribution unknown in any scoring mode; otherwise an unknown total with
  // no responsible game (schedule, team membership, approved totals) is lineup-wide. Say which, never "unprojected".
  // The usual illegal case: a reserve spot held by a player without verified eligibility for it (e.g. a healthy IR player).
  const reserveIssues = snapshot.roster.filter(entry => ["IR", "IR+", "NA"].includes(entry.position)
    && !(players.get(entry.playerId)?.reserveEligibility ?? []).some(value => value === entry.position));
  if (!baseline.legal) projectionBlockers.splice(0, projectionBlockers.length, ...(reserveIssues.length
    ? reserveIssues.map(entry => ({ playerId: entry.playerId, reason: `in ${entry.position} without verified ${entry.position} eligibility, so the lineup fails a rule check; move him to an active or bench spot, or refresh league data` }))
    : [{ playerId: null, reason: `the no-move lineup fails a rule check${baseline.limitations.length ? ` (${baseline.limitations.slice(0, 3).join(" ")})` : ""}` }]));
  else if (points && baseline.projectedValue === null && !projectionBlockers.length) projectionBlockers.push({ playerId: null,
    reason: `projected points are unknown${baseline.limitations.length ? ` (${baseline.limitations.slice(0, 3).join(" ")})` : ""}` });
  const unprojected = points ? unknown.filter(player => lacksForecast(player) || blocking.has(player.id)) : unknown;
  const dropRow = drop ? ledger.get(drop.id) : undefined;
  const bestDrop = drop ? { playerId: drop.id, projectedPoints: dropRow?.projectedPoints ?? null,
    activeGames: dropRow?.activeGames ?? null,
    frees: group(baseline.assignments.filter(row => row.playerId === drop.id && playable.has(row.date) && slotType.has(row.slotId))
      .map(row => ({ date: row.date, slot: slotType.get(row.slotId)! }))), caution: retentionCaution(drop) } : null;
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
  return { gaps, openSlots: open.length, bestDrop, unprojectedDrops: unprojected.map(player => player.id), projectionBlockers, adds: adds.slice(0, limit) };
}
