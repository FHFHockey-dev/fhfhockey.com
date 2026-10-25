import { buildRollingWindowGoalieParticipationReceipt, buildRollingWindowGoalieStartReceipt,
  type RollingWindowGoalieStartInput } from "../../player-forecasts/rollingWindowParticipation";

/** Offline FORGE integration seam. Never adapt the chart's appearance rows into
 * starter evidence: the canonical kernels require independently complete team
 * opportunities, dated eligibility, official starter labels and source clocks.
 * No production reader or probability calculator selects this diagnostic. */
export function buildGoalieWorkloadEvidence(input: RollingWindowGoalieStartInput,
  issuance: { issuedAt: string; expiresAt: string }) {
  const appearance = buildRollingWindowGoalieParticipationReceipt({ ...input,
    version: "goalie-rolling-14d-participation-input-v1" }, issuance);
  const start = buildRollingWindowGoalieStartReceipt(input, issuance);
  const describe = (receipt: typeof appearance | typeof start) => ({
    event: receipt.event, methodVersion: receipt.methodVersion,
    observedCount: receipt.reasons.length ? null : receipt.numerator,
    eligibleTeamGames: receipt.denominator,
    observedShare: receipt.reasons.length ? null : receipt.probability,
    selectedGameIds: [...receipt.selectedGameIds], reasons: [...receipt.reasons],
    inputHash: receipt.inputHash, evidenceHashes: [...receipt.evidenceHashes]
  });
  return {
    version: "forge-goalie-workload-evidence-v1" as const,
    status: "descriptive_only" as const,
    scope: { ...start.scope }, cutoffAt: start.cutoffAt,
    window: { startAt: start.historyStartAt, endAt: start.historyEndAt },
    denominator: "eligible_team_games" as const,
    starts: describe(start), appearances: describe(appearance),
    forecast: { startProbability: null, appearanceProbability: null,
      confirmation: "unconfirmed" as const, calibration: "unavailable" as const, activation: "dormant" as const },
    limitations: [...new Set([...start.limitations, ...appearance.limitations]),
      "Historical eligible-opportunity share is distinct from the chart's share of all recorded appearances.",
      "No shrinkage, rest/back-to-back adjustment, narrative adjustment or future probability is added here; conditional stopping rates are untouched.",
      "Historical frequencies, including sparse zero/one endpoints, require time-ordered held-out calibration before predictive use."]
  };
}
