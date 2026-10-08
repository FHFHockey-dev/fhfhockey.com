import { expandActiveSlots } from "./slots";
import { localDate, nextLocalMidnight, zonedMidnight } from "./planningDates";
import type { PlanIntent, PlanStep, PlanningPlayer, PlanningSnapshot, RosterEntry } from "./planningTypes";

type Member = RosterEntry & { since: string };
export type Timeline = { at: (time: string) => Map<string, Member>; acquisitions: Record<string, number>; legal: boolean; budgetVerified: boolean; limitations: string[] };
const reserves = ["IR", "IR+", "NA"] as const;
const isReserve = (position: string) => reserves.some(value => value === position);
const time = (value: string) => Date.parse(value);
const finiteTime = (value: string) => Number.isFinite(time(value));

/** Earliest verified effective time; unknown acquisition/waiver timing stays unresolved. */
export function acquisitionEffectiveAt(snapshot: Pick<PlanningSnapshot, "context" | "rules">, player: PlanningPlayer, at: string): string | null {
  if (!finiteTime(at) || snapshot.rules.acquisitionTiming === "unknown") return null;
  let effectiveAt = snapshot.rules.acquisitionTiming === "next_day"
    ? nextLocalMidnight(localDate(at, snapshot.context.timeZone), snapshot.context.timeZone) : at;
  if (player.availability === "waivers") {
    if (!player.waiverClearsAt || !finiteTime(player.waiverClearsAt)) return null;
    if (time(player.waiverClearsAt) > time(effectiveAt)) effectiveAt = player.waiverClearsAt;
  }
  return effectiveAt;
}

/** Applies actions at their effective time while charging acquisition at action time. */
export function buildTimeline(snapshot: PlanningSnapshot, intent: PlanIntent, steps: PlanStep[]): Timeline {
  const issues = new Set<string>();
  const warnings = new Set<string>();
  const roster = new Map<string, Member>();
  for (const entry of snapshot.roster) {
    if (roster.has(entry.playerId)) issues.add(`Duplicate roster player ${entry.playerId}.`);
    const player = snapshot.players.find(candidate => candidate.id === entry.playerId);
    if (!player) issues.add(`Roster player ${entry.playerId} is unresolved.`);
    else if (isReserve(entry.position) && !player.reserveEligibility.includes(entry.position as typeof reserves[number])) issues.add(`Initial reserve placement for ${entry.playerId} is unverified.`);
    roster.set(entry.playerId, { ...entry, since: "0000-01-01T00:00:00Z" });
  }
  const capacity = () => {
    const expanded = expandActiveSlots(snapshot.rules.rosterSlots);
    for (const diagnostic of expanded.diagnostics) if (diagnostic.severity === "error") issues.add(diagnostic.message);
    if ([...roster.values()].filter(member => !isReserve(member.position)).length > expanded.activeSlots.length + expanded.benchCapacity) issues.add("Roster exceeds active and bench capacity.");
    for (const position of reserves) if ([...roster.values()].filter(member => member.position === position).length > (snapshot.rules.rosterSlots[position] ?? 0)) issues.add(`${position} capacity exceeded.`);
  };
  capacity();
  const applied = new Set<string>();
  let waiverSpent = 0, waiverBudgetVerified = true;
  const stepById = new Map(steps.map(step => [step.id, step]));
  if (stepById.size !== steps.length) issues.add("Duplicate plan step identifiers.");
  for (const step of steps) {
    if (!finiteTime(step.at) || !finiteTime(step.effectiveAt)) issues.add(`Invalid timestamp for ${step.id}.`);
    for (const id of step.dependsOn) if (!stepById.has(id)) issues.add(`Unknown dependency ${id} for ${step.id}.`);
  }
  const acquisitions: Record<string, number> = {};
  const pending = [...steps].sort((a, b) => time(a.effectiveAt) - time(b.effectiveAt) || time(a.at) - time(b.at) || a.id.localeCompare(b.id));
  const sorted: PlanStep[] = [];
  while (pending.length) {
    const firstEffectiveAt = time(pending[0].effectiveAt);
    const sameTime = Number.isFinite(firstEffectiveAt)
      ? pending.filter(step => time(step.effectiveAt) === firstEffectiveAt)
      : [pending[0]];
    const next = sameTime.find(step => step.dependsOn.every(id => !sameTime.some(candidate => candidate.id === id))) ?? sameTime[0];
    sorted.push(next);
    pending.splice(pending.indexOf(next), 1);
  }
  let index = 0;
  const lockedAt = (playerId: string, step: PlanStep) => snapshot.lockedAssignments.some(lock => {
    if (lock.playerId !== playerId) return false;
    const lockMidnight = time(zonedMidnight(lock.date, snapshot.context.timeZone));
    const period = snapshot.rules.lineupMode === "weekly" ? snapshot.rules.lineupPeriods?.find(item => time(item.start) <= lockMidnight && lockMidnight < time(item.end)) : null;
    if (period?.lockAt && time(step.effectiveAt) >= time(period.lockAt) && time(step.effectiveAt) < time(period.end)) return true;
    if (lock.date < localDate(step.effectiveAt, snapshot.context.timeZone)) return false;
    const player = snapshot.players.find(candidate => candidate.id === playerId);
    const game = snapshot.games.find(candidate => candidate.date === lock.date && candidate.teamAbbreviation === player?.teamAbbreviation);
    const cutoff = lock.slotId && game?.startsAt ? game.startsAt : nextLocalMidnight(lock.date, snapshot.context.timeZone);
    return lock.slotId && game?.startsAt ? time(step.effectiveAt) <= time(cutoff) : time(step.effectiveAt) < time(cutoff);
  });
  const apply = (step: PlanStep) => {
    const player = snapshot.players.find(candidate => candidate.id === step.playerId);
    if (!player) { issues.add(`Unknown player ${step.playerId}.`); return; }
    if (!finiteTime(step.at) || !finiteTime(step.effectiveAt) || time(step.at) < time(snapshot.context.asOf) || time(step.effectiveAt) < time(step.at)) { issues.add(`Invalid action time for ${step.id}.`); return; }
    if (step.dependsOn.some(id => !applied.has(id) || !stepById.has(id) || time(stepById.get(id)!.at) > time(step.at) || time(stepById.get(id)!.effectiveAt) > time(step.at))) { issues.add(`Unmet or mistimed dependency for ${step.id}.`); return; }
    if (step.type === "reserve") {
      if (!roster.has(player.id) || !step.reservePosition || !player.reserveEligibility.includes(step.reservePosition)) { issues.add(`Invalid reserve move for ${player.id}.`); return; }
      if (lockedAt(player.id, step)) { issues.add(`Reserve move conflicts with locked assignment for ${player.id}.`); return; }
      roster.set(player.id, { playerId: player.id, position: step.reservePosition, since: step.effectiveAt });
    } else if (step.type === "drop") {
      if (!roster.has(player.id) || player.canDrop !== true || intent.protectedPlayerIds.includes(player.id)) { issues.add(`Player ${player.id} cannot be dropped.`); return; }
      if (lockedAt(player.id, step)) { issues.add(`Drop conflicts with locked assignment for ${player.id}.`); return; }
      roster.delete(player.id);
    } else {
      if (roster.has(player.id) || intent.excludedPlayerIds.includes(player.id) || !["free_agent", "manager_available", "waivers"].includes(player.availability)) { issues.add(`Player ${player.id} is not verified available.`); return; }
      if (time(step.at) > time(snapshot.context.asOf)) {
        if (!step.conditional) { issues.add(`Future acquisition ${step.id} must be conditional on availability recheck.`); return; }
        warnings.add(`Future availability for ${player.id} must be rechecked before ${step.id}.`);
      }
      if (snapshot.rules.acquisitionTiming === "next_day" && localDate(step.effectiveAt, snapshot.context.timeZone) <= localDate(step.at, snapshot.context.timeZone)) { issues.add(`Next-day acquisition ${step.id} is effective too early.`); return; }
      if (snapshot.rules.acquisitionTiming === "unknown") { issues.add("Acquisition timing is unverified; legal use cannot be established."); return; }
      if (player.availability === "waivers") {
        if (!step.conditional || !player.waiverClearsAt || time(step.effectiveAt) < time(player.waiverClearsAt)) { issues.add(`Waiver claim ${step.id} lacks conditional clearance.`); return; }
        if (step.waiverSpend !== null && step.waiverSpend !== undefined && (!Number.isFinite(step.waiverSpend) || step.waiverSpend < 0)) { issues.add(`Invalid waiver spend for ${step.id}.`); return; }
        const waiverRules = snapshot.rules.waivers;
        if (!waiverRules || waiverRules.mode === "unknown") {
          waiverBudgetVerified = false;
          warnings.add(`Waiver policy for ${step.id} is unverified.`);
        } else if (waiverRules.mode === "budget") {
          if (step.waiverSpend === null || step.waiverSpend === undefined || waiverRules.remainingBudget === null) {
            waiverBudgetVerified = false;
            warnings.add(`Waiver spend or remaining budget for ${step.id} is unverified.`);
          } else {
            waiverSpent += step.waiverSpend;
            if (waiverSpent > waiverRules.remainingBudget) { issues.add("Waiver budget exceeded."); return; }
          }
        } else if (step.waiverSpend !== null && step.waiverSpend !== undefined && step.waiverSpend !== 0) {
          issues.add(`Priority waiver claim ${step.id} cannot carry budget spend.`); return;
        }
        warnings.add(`Waiver claim ${step.id} is conditional; a no-claim continuation requires the prior legal itinerary prefix.`);
      } else if (step.waiverSpend !== null && step.waiverSpend !== undefined) {
        issues.add(`Non-waiver acquisition ${step.id} cannot carry waiver spend.`); return;
      }
      if (step.dropPlayerId) {
        const dropped = snapshot.players.find(candidate => candidate.id === step.dropPlayerId);
        if (!dropped || !roster.has(dropped.id) || dropped.canDrop !== true || intent.protectedPlayerIds.includes(dropped.id)) { issues.add(`Invalid drop prerequisite for ${step.id}.`); return; }
        if (lockedAt(dropped.id, step)) { issues.add(`Drop conflicts with locked assignment for ${dropped.id}.`); return; }
        roster.delete(dropped.id);
      }
      roster.set(player.id, { playerId: player.id, position: "bench", since: step.effectiveAt });
      const period = snapshot.rules.periods.find(item => time(item.start) <= time(step.at) && time(step.at) < time(item.end));
      if (!period) { issues.add(`No acquisition period covers ${step.at}.`); return; }
      acquisitions[period.id] = (acquisitions[period.id] ?? 0) + (snapshot.rules.acquisitionCost ?? 1);
      if (period.remaining === null || period.source === "unknown" || snapshot.rules.acquisitionCost === null) warnings.add(`Acquisition allowance or counting cost for ${period.id} is unverified.`);
      else if (acquisitions[period.id] > period.remaining) issues.add(`Acquisition allowance exceeded for ${period.id}.`);
    }
    capacity();
    applied.add(step.id);
  };
  return {
    at(time) {
      while (index < sorted.length && Date.parse(sorted[index].effectiveAt) <= Date.parse(time)) apply(sorted[index++]);
      return new Map(roster);
    }, acquisitions,
    get legal() { return issues.size === 0; },
    get budgetVerified() { return waiverBudgetVerified && snapshot.rules.periods.every(period => !acquisitions[period.id] || (period.remaining !== null && period.source !== "unknown" && snapshot.rules.acquisitionCost !== null)); },
    get limitations() { return [...issues, ...warnings]; },
  };
}
