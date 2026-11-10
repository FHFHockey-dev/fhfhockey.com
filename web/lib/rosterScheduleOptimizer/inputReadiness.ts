import type { ManagerRuleOverrides, PlanningSnapshot } from "./planningTypes";
import { INFERRED_ACQUISITION_TIMING_KEY, INFERRED_ACQUISITION_TIMING_SOURCE } from "./providerRules";

export type PlanningInputIssue = {
  id: string;
  message: string;
  target: "roster" | "rules" | "acquisitions" | "timezone";
  confirmation?: { key: string; label: string };
};

/** Stable rule values, not refresh times or the changing candidate catalogue. */
export function manualLineupConfirmation(snapshot: Pick<PlanningSnapshot, "rules" | "context">) {
  return `rso-input:lineup:${JSON.stringify([snapshot.rules.lineupMode,
    Object.entries(snapshot.rules.rosterSlots).sort(([a], [b]) => a.localeCompare(b)), snapshot.context.timeZone])}`;
}

export function rememberInputConfirmation(overrides: ManagerRuleOverrides, key: string): ManagerRuleOverrides {
  const family = key.startsWith("rso-input:") ? key.split(":").slice(0, 2).join(":") + ":" : key;
  const retained = (overrides.confirmedRuleNotes ?? []).filter(note => note !== key && !note.startsWith(family));
  return { ...overrides, confirmedRuleNotes: [...retained.slice(-19), key] };
}

/** Input questions only. The planner still owns legality, budget and forecast admission. */
export function planningInputIssues(snapshot: PlanningSnapshot | null, overrides: ManagerRuleOverrides = {},
  options: { acquisitions?: boolean; retainedProvider?: boolean } = {}): PlanningInputIssue[] {
  if (!snapshot) return [{ id: "load", message: "Load planning data before selecting a plan.", target: "roster" }];
  if (!snapshot.roster.length) return [{ id: "roster", message: "Add roster players before selecting a plan.", target: "roster" }];
  if (options.retainedProvider) return [{ id: "provider", message: "Refresh provider inputs or continue manually before selecting a plan.", target: "roster" }];
  const { rules, context } = snapshot;
  const issues: PlanningInputIssue[] = [];
  const confirmed = (key: string) => overrides.confirmedRuleNotes?.includes(key) === true;
  const scoring = rules.scoring.mode === "points" ? Object.keys(rules.scoring.weights).length > 0
    && Object.entries(rules.scoring.weights).every(([key, value]) => key.trim() && Number.isFinite(value))
    : rules.scoring.categories.length > 0 && rules.scoring.categories.every(row => row.key.trim());
  if (!scoring) issues.push({ id: "scoring", message: "Enter league scoring before selecting a plan.", target: "rules" });
  if (context.provider === "manual") {
    const key = manualLineupConfirmation(snapshot);
    const slots = Object.entries(rules.rosterSlots).map(([slot, count]) => `${slot} × ${count}`).join(", ");
    if (rules.lineupMode === "unsupported") issues.push({ id: "lineup", target: "rules", message: "Choose a supported lineup mode before selecting a plan." });
    else if (!confirmed(key)) issues.push({ id: "lineup", target: "rules", message: `Check this manual league: ${rules.lineupMode} lineups; ${slots}; ${context.timeZone} day boundary.`,
      confirmation: { key, label: "Confirm manual lineup settings" } });
  } else if (context.provider === "yahoo" && overrides.timeZone !== context.timeZone) {
    issues.push({ id: "timezone", target: "timezone", message: `Yahoo does not report the league day boundary. Check ${context.timeZone}.`,
      confirmation: { key: context.timeZone, label: `Confirm ${context.timeZone} day boundary` } });
  }
  if (!options.acquisitions) return issues;
  if (rules.acquisitionTiming === "unknown") issues.push({ id: "timing", target: "acquisitions", message: "Enter when an acquisition takes effect before selecting an acquisition plan." });
  const inference = snapshot.evidence[INFERRED_ACQUISITION_TIMING_KEY];
  if (inference?.source === INFERRED_ACQUISITION_TIMING_SOURCE && rules.acquisitionTiming !== "unknown") {
    const key = `rso-input:add-timing:${rules.acquisitionTiming}`;
    // Existing exact-note confirmations remain valid for the same reported inference.
    if (!confirmed(key) && !inference.limitations.some(confirmed)) issues.push({ id: "inferred-timing", target: "acquisitions",
      message: `Yahoo add timing is inferred as ${rules.acquisitionTiming === "same_day" ? "same-day" : "next-day"}. Check it against your league.`,
      confirmation: { key, label: `Confirm ${rules.acquisitionTiming === "same_day" ? "same-day" : "next-day"} adds` } });
  }
  if (rules.acquisitionCost === null || !rules.periods.some(period => period.remaining !== null && period.source !== "unknown")) {
    issues.push({ id: "budget", target: "acquisitions", message: "Enter the acquisition cost and remaining allowance for the planning period." });
  }
  if (context.provider === "yahoo" && rules.periods.some(period => period.source === "provider" && period.id.startsWith("yahoo-week-"))) {
    const key = `rso-input:weekly-reset:${context.timeZone}`;
    if (!confirmed(key)) issues.push({ id: "weekly-reset", target: "acquisitions", message: `The weekly acquisition reset is assumed to be midnight in ${context.timeZone}. Check that boundary before selecting an acquisition plan.`,
      confirmation: { key, label: "Confirm weekly acquisition reset" } });
  }
  return issues;
}
