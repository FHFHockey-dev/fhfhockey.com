import { lineupPeriodAtDate, nextLocalMidnight, zonedMidnight } from "./planningDates";
import type { LeagueRules, LockedAssignment, ManagerRuleOverrides, PlanningSnapshot } from "./planningTypes";

const missing = (value: unknown) => value === null || value === undefined || value === "unknown" || value === "unsupported" || (Array.isArray(value) && value.length === 0) || (typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0);

/** Evidence entry the Yahoo adapter attaches when acquisition timing is inferred from the league's weekly deadline
 * rather than reported. Only an inferred timing yields to a manager override (TJ D6); reported facts keep precedence. */
export const INFERRED_ACQUISITION_TIMING_KEY = "acquisitionTiming";
export const INFERRED_ACQUISITION_TIMING_SOURCE = "Inferred from Yahoo weekly deadline";

const missingWeeklyWindows = "Supply verified weekly lineup windows; the roster response alone does not establish their exact locks.";
function completeWeeklyWindows(context: PlanningSnapshot["context"], periods: LeagueRules["lineupPeriods"]): boolean {
  if (!periods?.length || periods.length > 100) return false;
  const windows = periods.map(period => ({ id: period.id, start: Date.parse(period.start), end: Date.parse(period.end),
    lock: Date.parse(period.lockAt ?? "") })).sort((a, b) => a.start - b.start);
  if (new Set(windows.map(window => window.id)).size !== windows.length || windows.some((window, index) =>
    !window.id.trim() || ![window.start, window.end, window.lock].every(Number.isFinite)
    || window.start >= window.end || window.lock > window.end || index > 0 && windows[index - 1].end > window.start)) return false;
  const start = Date.parse(`${context.startDate}T12:00:00Z`), end = Date.parse(`${context.endDate}T12:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 366 * 86400000) return false;
  try {
    for (let day = start; day <= end; day += 86400000) {
      const date = new Date(day).toISOString().slice(0, 10);
      const midnight = Date.parse(zonedMidnight(date, context.timeZone));
      const until = Date.parse(nextLocalMidnight(date, context.timeZone));
      const window = windows.find(window => window.start <= midnight && midnight < window.end);
      if (!window || window.end < until) return false;
    }
    return true;
  } catch { return false; }
}

/** Preserve authoritative inputs; manager rules fill gaps and manager locks constrain the simulation. */
export function supplementProviderRules(snapshot: PlanningSnapshot, overrides: ManagerRuleOverrides, managerLocks: readonly LockedAssignment[] = []): { snapshot: PlanningSnapshot; conflicts: string[] } {
  const rules: LeagueRules = structuredClone(snapshot.rules);
  const conflicts: string[] = [];
  const apply = (label: string, provider: unknown, manager: unknown, write: () => void) => {
    if (manager === undefined) return;
    if (missing(provider)) write();
    else if (JSON.stringify(provider) !== JSON.stringify(manager)) conflicts.push(`${label} differs from the manager input; provider setting retained.`);
  };
  apply("Lineup mode", rules.lineupMode, overrides.lineupMode, () => { rules.lineupMode = overrides.lineupMode!; });
  const inferredTiming = snapshot.evidence?.[INFERRED_ACQUISITION_TIMING_KEY]?.source === INFERRED_ACQUISITION_TIMING_SOURCE;
  const timingOverridden = inferredTiming && overrides.acquisitionTiming !== undefined;
  apply("Acquisition timing", timingOverridden ? null : rules.acquisitionTiming, overrides.acquisitionTiming, () => { rules.acquisitionTiming = overrides.acquisitionTiming!; });
  apply("Acquisition cost", rules.acquisitionCost, overrides.acquisitionCost, () => { rules.acquisitionCost = overrides.acquisitionCost!; });
  apply("Acquisition periods", rules.periods, overrides.periods, () => { rules.periods = overrides.periods!; });
  let managerWindowsApplied = false;
  apply("Lineup periods", rules.lineupPeriods, overrides.lineupPeriods, () => { rules.lineupPeriods = overrides.lineupPeriods!; managerWindowsApplied = true; });
  if (managerWindowsApplied && rules.lineupMode === "weekly" && completeWeeklyWindows(snapshot.context, rules.lineupPeriods)) {
    rules.unsupported = rules.unsupported.filter(reason => reason !== missingWeeklyWindows);
  }
  if (overrides.waivers) {
    if (!rules.waivers || rules.waivers.mode === "unknown") rules.waivers = overrides.waivers;
    else {
      apply("Waiver mode", rules.waivers.mode, overrides.waivers.mode, () => { rules.waivers!.mode = overrides.waivers!.mode; });
      apply("Waiver budget", rules.waivers.remainingBudget, overrides.waivers.remainingBudget, () => { rules.waivers!.remainingBudget = overrides.waivers!.remainingBudget; });
    }
  }
  for (const [slot, count] of Object.entries(overrides.rosterSlots ?? {})) apply(`${slot} roster slots`, rules.rosterSlots[slot], count, () => { rules.rosterSlots[slot] = count; });
  if (overrides.scoring) {
    apply("Scoring mode", rules.scoring.mode, overrides.scoring.mode, () => { rules.scoring.mode = overrides.scoring!.mode!; });
    for (const [stat, weight] of Object.entries(overrides.scoring.weights ?? {})) apply(`${stat} weight`, rules.scoring.weights[stat], weight, () => { rules.scoring.weights[stat] = weight; });
    apply("Scoring categories", rules.scoring.categories, overrides.scoring.categories, () => { rules.scoring.categories = overrides.scoring!.categories!; });
  }
  if (overrides.goalieMinimum) {
    const goalie = overrides.goalieMinimum;
    for (const key of ["required", "credited", "counts", "penalty", "periodStart", "periodEnd"] as const) {
      if (goalie[key] === undefined) continue;
      apply(`Goalie ${key}`, rules.goalieMinimum[key], goalie[key], () => { (rules.goalieMinimum as unknown as Record<string, unknown>)[key] = goalie[key]; });
    }
  }
  // Saved simulation rows must never become provider authority when a cached snapshot is reopened.
  const providerLocks = snapshot.lockedAssignments.filter(lock => lock.source !== "manager");
  const lockedAssignments = [...providerLocks];
  const windows = new Map<string, string>();
  const windowAt = (date: string) => {
    if (!windows.has(date)) windows.set(date, rules.lineupMode === "weekly"
      ? lineupPeriodAtDate(date, rules.lineupPeriods, snapshot.context.timeZone)?.id ?? date : date);
    return windows.get(date)!;
  };
  let blocked = 0;
  for (const lock of managerLocks) {
    const conflict = providerLocks.find(provider => windowAt(provider.date) === windowAt(lock.date)
      && ((provider.playerId === lock.playerId && provider.slotId !== lock.slotId)
        || (lock.slotId !== null && provider.slotId === lock.slotId && provider.playerId !== lock.playerId)));
    if (conflict) {
      blocked++;
      const nameOf = (id: string) => snapshot.players.find(player => player.id === id)?.name ?? id;
      conflicts.push(`Manager lock for ${nameOf(lock.playerId)} on ${lock.date} conflicts with the provider lock for ${nameOf(conflict.playerId)}; provider lock retained and manager choice kept for review.`);
      continue;
    }
    if (!lockedAssignments.some(row => row.date === lock.date && row.playerId === lock.playerId && row.slotId === lock.slotId)) {
      lockedAssignments.push({ ...lock, source: "manager" });
    }
  }
  const evidence = { ...snapshot.evidence };
  // The manager's timing replaced the inference, so the inferred label no longer describes the rule in use.
  if (timingOverridden) delete evidence[INFERRED_ACQUISITION_TIMING_KEY];
  if (JSON.stringify(rules) !== JSON.stringify(snapshot.rules)) evidence.managerRules = { source: "manager-supplied", asOf: snapshot.context.asOf, completeness: "partial", seasonId: snapshot.context.seasonId, limitations: ["Manager-entered rules fill missing provider settings; verify before acting."] };
  if (managerLocks.length) evidence["Manager-selected lineup locks"] = {
    source: "manager-simulation", asOf: null, completeness: "partial", seasonId: snapshot.context.seasonId,
    limitations: ["Manager-selected locks constrain this simulation; they are not provider-confirmed assignments.",
      ...(blocked ? [`${blocked} manager lock(s) conflict with provider authority and were not applied. Stored choices remain available for review.`] : [])],
  };
  else delete evidence["Manager-selected lineup locks"];
  const usedManager = JSON.stringify(rules) !== JSON.stringify(snapshot.rules)
    || JSON.stringify(lockedAssignments) !== JSON.stringify(snapshot.lockedAssignments)
    || JSON.stringify(evidence) !== JSON.stringify(snapshot.evidence);
  let revision = 0;
  if (usedManager) for (const char of JSON.stringify({ rules, lockedAssignments, evidence })) revision = (Math.imul(revision, 31) + char.charCodeAt(0)) | 0;
  return {
    snapshot: usedManager ? { ...snapshot, id: `${snapshot.id.slice(0, 185)}:${(revision >>> 0).toString(36)}`, rules, lockedAssignments, evidence } : snapshot,
    conflicts,
  };
}
