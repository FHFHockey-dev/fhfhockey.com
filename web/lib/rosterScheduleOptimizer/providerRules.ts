import type { LeagueRules, ManagerRuleOverrides, PlanningSnapshot } from "./planningTypes";

const missing = (value: unknown) => value === null || value === undefined || value === "unknown" || value === "unsupported" || (Array.isArray(value) && value.length === 0) || (typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0);

/** Preserve authoritative rules and apply explicit manager inputs only to gaps. */
export function supplementProviderRules(snapshot: PlanningSnapshot, overrides: ManagerRuleOverrides): { snapshot: PlanningSnapshot; conflicts: string[] } {
  const rules: LeagueRules = structuredClone(snapshot.rules);
  const conflicts: string[] = [];
  const apply = (label: string, provider: unknown, manager: unknown, write: () => void) => {
    if (manager === undefined) return;
    if (missing(provider)) write();
    else if (JSON.stringify(provider) !== JSON.stringify(manager)) conflicts.push(`${label} differs from the manager input; provider setting retained.`);
  };
  apply("Lineup mode", rules.lineupMode, overrides.lineupMode, () => { rules.lineupMode = overrides.lineupMode!; });
  apply("Acquisition timing", rules.acquisitionTiming, overrides.acquisitionTiming, () => { rules.acquisitionTiming = overrides.acquisitionTiming!; });
  apply("Acquisition cost", rules.acquisitionCost, overrides.acquisitionCost, () => { rules.acquisitionCost = overrides.acquisitionCost!; });
  apply("Acquisition periods", rules.periods, overrides.periods, () => { rules.periods = overrides.periods!; });
  apply("Lineup periods", rules.lineupPeriods, overrides.lineupPeriods, () => { rules.lineupPeriods = overrides.lineupPeriods!; });
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
  const usedManager = JSON.stringify(rules) !== JSON.stringify(snapshot.rules);
  let revision = 0;
  if (usedManager) for (const char of JSON.stringify(rules)) revision = (Math.imul(revision, 31) + char.charCodeAt(0)) | 0;
  return {
    snapshot: usedManager ? { ...snapshot, id: `${snapshot.id.slice(0, 185)}:${(revision >>> 0).toString(36)}`, rules, evidence: { ...snapshot.evidence, managerRules: { source: "manager-supplied", asOf: snapshot.context.asOf, completeness: "partial", seasonId: snapshot.context.seasonId, limitations: ["Manager-entered rules fill missing provider settings; verify before acting."] } } } : snapshot,
    conflicts,
  };
}
