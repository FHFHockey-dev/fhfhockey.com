import { analyzeRoster, parseSlotCounts, type ManualWorkspace } from "./manual";
import { normalizeEligibility } from "lib/rosterScheduleOptimizer/eligibility";

export type DiagnosisAction = { id: string; label: string; reason: string; target: "roster" | "slots" | "coverage" };
type Finding = { id: string; text: string };

/** Structural findings only: no player-quality, scoring or transaction inference. */
export function diagnoseRoster(workspace: ManualWorkspace, result: ReturnType<typeof analyzeRoster>) {
  const strengths: Finding[] = [];
  const weaknesses: Finding[] = [];
  const actions: DiagnosisAction[] = [];
  const counts = parseSlotCounts(workspace.slots);

  if (!workspace.players.length) {
    actions.push({ id: "add-roster", label: "Add roster players", reason: "Enter players and their league positions before checking coverage.", target: "roster" });
  } else if (!workspace.rosterReviewed || workspace.unresolved.length > 0 || result?.incomplete
    || workspace.players.some(player => (player.status === "active" || player.status === "bench") && !normalizeEligibility(player.eligibility).valid)) {
    actions.push({ id: "review-roster", label: "Review roster positions", reason: "Resolve unknown positions and outstanding items, then confirm the roster. Unknown inputs are not empty slots.", target: "roster" });
  }
  if (!counts) {
    actions.push({ id: "enter-slots", label: "Enter starting slots", reason: "Enter valid active-slot counts for your league before assessing gaps.", target: "slots" });
  } else if (!workspace.slotsReviewed) {
    actions.push({ id: "review-slots", label: "Review starting slots", reason: "Confirm these are your league’s active starting slots.", target: "slots" });
  }

  // The manual result withholds definitive conclusions until all relevant inputs are reviewed.
  if (!result || result.incomplete) return { strengths, weaknesses, actions, reserves: result?.excludedReserves ?? 0 };

  for (const row of result.positions) {
    if (row.dedicatedSlots === 0) continue;
    const filled = result.assignments.filter(assignment => assignment.slotType === row.position).length;
    if (filled === row.dedicatedSlots) {
      strengths.push({ id: row.position, text: `${row.position}: ${filled} / ${row.dedicatedSlots} dedicated slots filled in the simultaneous assignment.` });
    }
    if (row.state === "short") {
      const gap = row.dedicatedSlots - row.eligible.length;
      weaknesses.push({ id: row.position, text: `${row.position}: ${gap} fewer eligible players than dedicated slots (${row.eligible.length} for ${row.dedicatedSlots}).` });
      actions.push({ id: `gap-${row.position}`, label: `Address ${row.position} coverage`, reason: "Review eligible active and bench players for this confirmed position gap.", target: "roster" });
    }
  }

  const unfilled = result.totalSlots - result.assignments.length;
  if (unfilled > 0) {
    weaknesses.push({ id: "simultaneous", text: `${unfilled} of ${result.totalSlots} starting slots remain unfilled when each player is used once.` });
    actions.push({ id: "simultaneous", label: "Review simultaneous coverage", reason: "Inspect the whole assignment and overlapping eligibility. Flex and position counts cannot be added together.", target: "coverage" });
  } else {
    strengths.unshift({ id: "simultaneous", text: `All ${result.totalSlots} starting slots can be filled simultaneously with reviewed eligibility.` });
  }
  return { strengths, weaknesses, actions, reserves: result.excludedReserves };
}
