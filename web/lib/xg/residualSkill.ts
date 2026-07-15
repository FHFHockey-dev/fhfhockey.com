export type ResidualSkillEvent = {
  gameId: number;
  eventId: number;
  gameDate: string;
  shooterId: number | null;
  goalieId: number | null;
  baselineXg: number;
  label: 0 | 1;
};

export type ResidualSkillLayer = ResidualSkillEvent & {
  sourceAsOf: string;
  shooterPriorSamples: number;
  goaliePriorSamples: number;
  shooterFinishingEffect: number | null;
  goalieSaveEffect: number | null;
  adjustedProbability: number;
  version: "lagged_residual_skill_v1";
};

type ResidualState = { count: number; sum: number };

function effect(state: ResidualState | undefined, minimumSamples: number, priorStrength: number) {
  if (!state || state.count < minimumSamples) return null;
  return (state.sum / state.count) * (state.count / (state.count + priorStrength));
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

export function buildLaggedResidualSkillLayers(
  rows: ResidualSkillEvent[],
  options: { minimumSamples?: number; priorStrength?: number } = {},
): ResidualSkillLayer[] {
  const minimumSamples = Math.max(1, options.minimumSamples ?? 50);
  const priorStrength = Math.max(0, options.priorStrength ?? 200);
  const shooters = new Map<number, ResidualState>();
  const goalies = new Map<number, ResidualState>();
  const ordered = [...rows].sort((left, right) =>
    `${left.gameDate}:${left.gameId}:${left.eventId}`.localeCompare(
      `${right.gameDate}:${right.gameId}:${right.eventId}`,
    ),
  );

  return ordered.map((row) => {
    const shooterState = row.shooterId == null ? undefined : shooters.get(row.shooterId);
    const goalieState = row.goalieId == null ? undefined : goalies.get(row.goalieId);
    const shooterFinishingEffect = effect(shooterState, minimumSamples, priorStrength);
    const goalieSaveEffect = effect(goalieState, minimumSamples, priorStrength);
    const adjustedProbability = Math.min(
      1,
      Math.max(0, row.baselineXg + (shooterFinishingEffect ?? 0) - (goalieSaveEffect ?? 0)),
    );
    const result: ResidualSkillLayer = {
      ...row,
      sourceAsOf: row.gameDate,
      shooterPriorSamples: shooterState?.count ?? 0,
      goaliePriorSamples: goalieState?.count ?? 0,
      shooterFinishingEffect: shooterFinishingEffect == null ? null : round(shooterFinishingEffect),
      goalieSaveEffect: goalieSaveEffect == null ? null : round(goalieSaveEffect),
      adjustedProbability: round(adjustedProbability),
      version: "lagged_residual_skill_v1",
    };
    const scoringResidual = row.label - row.baselineXg;
    if (row.shooterId != null) {
      const state = shooters.get(row.shooterId) ?? { count: 0, sum: 0 };
      shooters.set(row.shooterId, { count: state.count + 1, sum: state.sum + scoringResidual });
    }
    if (row.goalieId != null) {
      const state = goalies.get(row.goalieId) ?? { count: 0, sum: 0 };
      goalies.set(row.goalieId, { count: state.count + 1, sum: state.sum - scoringResidual });
    }
    return result;
  });
}

