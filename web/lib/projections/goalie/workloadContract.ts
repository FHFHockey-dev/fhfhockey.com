import { resolveGoalieMembershipLineage, membershipWorkloadFields, type GoalieMembershipLineageInput } from "./membershipLineage";
import { buildGoalieStintWorkload, type GoalieStintWorkloadInput } from "./stintWorkload";

export type HistoricalGoalieAvailability = {
  gameId: number;
  team: string;
  goalieId: number;
  status: "injured" | "scratched" | "available" | "unknown";
  evidenceIds: string[];
};
export type GoalieWorkloadContractInput = Omit<GoalieStintWorkloadInput, "stints" | "membershipComplete" | "membershipEvidenceIds"> & {
  membership: Pick<GoalieMembershipLineageInput, "coverage" | "events" | "stints">;
  availability?: HistoricalGoalieAvailability[];
};

/** Pure consumer boundary: lineage admission and one existing arithmetic implementation. */
export function buildGoalieWorkloadContract(input: GoalieWorkloadContractInput) {
  const membership = resolveGoalieMembershipLineage({
    ...input.membership, goalieId: input.goalieId, scope: input.scope, observedAt: input.observedAt
  });
  const history = buildGoalieStintWorkload({ ...input, ...membershipWorkloadFields(membership) });
  const availability = (input.availability ?? []).map(row => {
    if (row.goalieId !== input.goalieId || !input.games.some(game => game.gameId === row.gameId && game.team === row.team
      && game.seasonId === input.scope.seasonId && game.gameType === input.scope.gameType
      && Date.parse(game.startsAt) >= Date.parse(input.scope.fromAt) && Date.parse(game.startsAt) < Date.parse(input.scope.throughAt))) {
      throw new Error("Availability must match the goalie and scoped team-game identity.");
    }
    const evidenceIds = [...new Set(row.evidenceIds.filter(id => id.trim().length > 0))].sort();
    return { ...row, status: evidenceIds.length ? row.status : "unknown" as const, evidenceIds };
  }).sort((a, b) => a.gameId - b.gameId || a.team.localeCompare(b.team) || a.status.localeCompare(b.status));
  if (new Set(availability.map(row => `${row.team}:${row.gameId}`)).size !== availability.length) {
    throw new Error("Conflicting or duplicate historical availability.");
  }
  return {
    contract: "goalie-workload-consumer-v1" as const,
    membership, history,
    // Injury/scratch is contextual evidence, not a reason to erase club-membership opportunities.
    availability,
    future: {
      sourceContract: "forge_goalie_candidates_v1" as const,
      startProbability: null,
      status: "not_provided_by_historical_workload" as const
    }
  };
}
