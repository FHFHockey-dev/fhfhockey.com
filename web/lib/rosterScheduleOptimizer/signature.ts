import { normalizeEligibility } from "./eligibility";
import type { OptimizerCacheSignatureInput } from "./types";

export function createOptimizerCacheSignature(
  input: OptimizerCacheSignatureInput,
): string {
  const roster = input.roster
    .map((player) => {
      const eligibility = normalizeEligibility(player.eligiblePositions);
      return {
        id: player.id,
        team: player.teamAbbreviation?.trim().toUpperCase() ?? null,
        eligibility: eligibility.valid
          ? eligibility.positions
          : eligibility.sourceLabels,
        value: Number.isFinite(player.value) ? player.value : null,
        status: player.status ?? "active",
      };
    })
    .sort((left, right) =>
      left.id.localeCompare(right.id) ||
      String(left.team).localeCompare(String(right.team)) ||
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
  const rosterSlots = Object.entries(input.rosterSlots)
    .map(([slot, count]) => [slot.trim().toUpperCase(), count] as const)
    .sort(([left], [right]) => left.localeCompare(right));

  return JSON.stringify({
    version: 1,
    gameKey: input.gameKey,
    scheduleVersion: input.scheduleVersion,
    selectedWeeks: [...new Set(input.selectedWeeks)].sort((a, b) => a - b),
    lineupMode: input.lineupMode ?? "daily",
    rosterSlots,
    roster,
  });
}
