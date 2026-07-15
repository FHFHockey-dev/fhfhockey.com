export type ReboundHeadInput = {
  gameId: number;
  eventId: number;
  reboundCreationProbability: number;
  conditionalDangerProbability: number | null;
  goalieFreezeProbability: number | null;
  conditionalSecondChanceXg: number | null;
};

export type ReboundHeadOutput = {
  gameId: number;
  eventId: number;
  head: "rebound_creation" | "rebound_danger" | "goalie_freeze_control" | "second_chance_xg";
  value: number | null;
  status: "approved_model" | "candidate_contract" | "unavailable";
  version: "rebound_heads_v1";
  provenance: Record<string, unknown>;
};

function probability(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function optionalProbability(value: number | null): number | null {
  return value == null || !Number.isFinite(value) ? null : probability(value);
}

export function buildReboundHeadOutputs(rows: ReboundHeadInput[]): ReboundHeadOutput[] {
  return rows.flatMap((row) => {
    const creation = probability(row.reboundCreationProbability);
    const danger = optionalProbability(row.conditionalDangerProbability);
    const freeze = optionalProbability(row.goalieFreezeProbability);
    const secondChance = optionalProbability(row.conditionalSecondChanceXg);
    const base = { gameId: row.gameId, eventId: row.eventId, version: "rebound_heads_v1" as const };
    return [
      {
        ...base,
        head: "rebound_creation" as const,
        value: creation,
        status: "approved_model" as const,
        provenance: { source: "rebound_creation_model", conditional: false },
      },
      {
        ...base,
        head: "rebound_danger" as const,
        value: danger == null ? null : Number((creation * danger).toFixed(6)),
        status: danger == null ? "unavailable" as const : "candidate_contract" as const,
        provenance: { source: "creation_probability_x_conditional_danger", conditional: true },
      },
      {
        ...base,
        head: "goalie_freeze_control" as const,
        value: freeze,
        status: freeze == null ? "unavailable" as const : "candidate_contract" as const,
        provenance: { source: "goalie_freeze_probability", conditional: false },
      },
      {
        ...base,
        head: "second_chance_xg" as const,
        value: secondChance == null ? null : Number((creation * secondChance).toFixed(6)),
        status: secondChance == null ? "unavailable" as const : "candidate_contract" as const,
        provenance: { source: "creation_probability_x_conditional_second_chance_xg", conditional: true },
      },
    ];
  });
}

