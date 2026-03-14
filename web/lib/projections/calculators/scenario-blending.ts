import type {
  ReconciledSkaterVector,
  ReconciliationDistributionValidation,
  SkaterRoleScenario,
  SkaterScenarioHorizonBlendResult,
  SkaterScenarioMetadata,
  SkaterScenarioStatLine
} from "../types/run-forge-projections.types";
import {
  RECON_BLEND_TO_BASELINE,
  RECON_TOP_ES_SHARE_MAX,
  RECON_TOP_PP_SHARE_MAX,
  ROLE_SCENARIO_REVERSION_PER_GAME,
  ROLE_SCENARIO_VOLATILE_REVERSION_BONUS,
  SKATER_POOL_EMERGENCY_MAX_AVG_TOI_SECONDS,
  SKATER_POOL_EMERGENCY_MAX_SINGLE_TOI_SECONDS,
  SKATER_POOL_MIN_VALID_COUNT
} from "../constants/projection-weights";
import { clamp } from "../utils/number-utils";

export type RoleContinuitySummary = {
  windowGames: number;
  appearancesTracked: number;
  gamesInCurrentRole: number;
  continuityShare: number;
  roleChangeRate: number;
  volatilityIndex: number;
};

function parseRoleRank(role: string): {
  family: "L" | "D" | null;
  rank: number | null;
} {
  if (role.startsWith("L")) {
    const rank = Number(role.slice(1));
    return { family: "L", rank: Number.isFinite(rank) ? rank : null };
  }
  if (role.startsWith("D")) {
    const rank = Number(role.slice(1));
    return { family: "D", rank: Number.isFinite(rank) ? rank : null };
  }
  return { family: null, rank: null };
}

function scenarioRoleScoringMultiplier(
  currentRole: string | null,
  scenarioRole: string
): {
  goal: number;
  assist: number;
} {
  const current = currentRole
    ? parseRoleRank(currentRole)
    : { family: null, rank: null };
  const scenario = parseRoleRank(scenarioRole);
  if (
    current.family == null ||
    scenario.family == null ||
    current.rank == null ||
    scenario.rank == null ||
    current.family !== scenario.family
  ) {
    return { goal: 0.97, assist: 0.97 };
  }
  const delta = current.rank - scenario.rank;
  const goal = clamp(1 + delta * 0.07, 0.82, 1.2);
  const assist = clamp(1 + delta * 0.09, 0.8, 1.24);
  return { goal: Number(goal.toFixed(4)), assist: Number(assist.toFixed(4)) };
}

export function blendSkaterScenarioStatLines(args: {
  currentRole: string | null;
  scenarios: SkaterRoleScenario[];
  baseGoalsEs: number;
  baseGoalsPp: number;
  baseAssistsEs: number;
  baseAssistsPp: number;
}): {
  blended: {
    goalsEs: number;
    goalsPp: number;
    assistsEs: number;
    assistsPp: number;
  };
  scenarioLines: SkaterScenarioStatLine[];
} {
  if (args.scenarios.length === 0) {
    return {
      blended: {
        goalsEs: args.baseGoalsEs,
        goalsPp: args.baseGoalsPp,
        assistsEs: args.baseAssistsEs,
        assistsPp: args.baseAssistsPp
      },
      scenarioLines: []
    };
  }
  const scenarioLines: SkaterScenarioStatLine[] = [];
  let blendedGoalsEs = 0;
  let blendedGoalsPp = 0;
  let blendedAssistsEs = 0;
  let blendedAssistsPp = 0;
  for (const scenario of args.scenarios) {
    const p = clamp(scenario.probability, 0, 1);
    const mult = scenarioRoleScoringMultiplier(args.currentRole, scenario.role);
    const goalsEs = args.baseGoalsEs * mult.goal;
    const goalsPp = args.baseGoalsPp * mult.goal;
    const assistsEs = args.baseAssistsEs * mult.assist;
    const assistsPp = args.baseAssistsPp * mult.assist;
    blendedGoalsEs += p * goalsEs;
    blendedGoalsPp += p * goalsPp;
    blendedAssistsEs += p * assistsEs;
    blendedAssistsPp += p * assistsPp;
    scenarioLines.push({
      role: scenario.role,
      probability: Number(p.toFixed(4)),
      goalsEs: Number(goalsEs.toFixed(4)),
      goalsPp: Number(goalsPp.toFixed(4)),
      assistsEs: Number(assistsEs.toFixed(4)),
      assistsPp: Number(assistsPp.toFixed(4))
    });
  }
  return {
    blended: {
      goalsEs: Number(blendedGoalsEs.toFixed(4)),
      goalsPp: Number(blendedGoalsPp.toFixed(4)),
      assistsEs: Number(blendedAssistsEs.toFixed(4)),
      assistsPp: Number(blendedAssistsPp.toFixed(4))
    },
    scenarioLines
  };
}

export function blendSkaterScenarioStatLinesAcrossHorizon(args: {
  currentRole: string | null;
  scenarios: SkaterRoleScenario[];
  baseGoalsEs: number;
  baseGoalsPp: number;
  baseAssistsEs: number;
  baseAssistsPp: number;
  horizonScalars: number[];
  roleContinuity: RoleContinuitySummary | null;
}): SkaterScenarioHorizonBlendResult {
  const scalars = args.horizonScalars.length > 0 ? args.horizonScalars : [1];
  const scenarioSeed =
    args.scenarios.length > 0
      ? args.scenarios
      : [
          {
            role: args.currentRole ?? "L4",
            probability: 1,
            source: "current_role" as const
          }
        ];
  const baseNormDenom = scenarioSeed.reduce(
    (acc, s) => acc + Math.max(0, s.probability),
    0
  );
  const baseNorm = scenarioSeed.map((s) => ({
    ...s,
    probability:
      baseNormDenom > 0
        ? clamp(s.probability / baseNormDenom, 0, 1)
        : 1 / scenarioSeed.length
  }));
  const baseUniformProb = 1 / baseNorm.length;
  const volatility = args.roleContinuity?.volatilityIndex ?? 0.35;

  let blendedGoalsEs = 0;
  let blendedGoalsPp = 0;
  let blendedAssistsEs = 0;
  let blendedAssistsPp = 0;
  const scenarioLineByRole = new Map<string, SkaterScenarioStatLine>();
  const horizonScenarioSummaries: Array<{
    gameIndex: number;
    topRole: string;
    topProbability: number;
  }> = [];
  const scalarTotal = scalars.reduce((acc, s) => acc + Math.max(0, s), 0) || 1;

  for (let gameIndex = 0; gameIndex < scalars.length; gameIndex += 1) {
    const scalar = Math.max(0, scalars[gameIndex] ?? 0);
    const reversion = clamp(
      gameIndex * ROLE_SCENARIO_REVERSION_PER_GAME +
        volatility * ROLE_SCENARIO_VOLATILE_REVERSION_BONUS,
      0,
      0.75
    );
    const gameScenarios = baseNorm.map((s) => ({
      ...s,
      probability: clamp(
        (1 - reversion) * s.probability + reversion * baseUniformProb,
        0,
        1
      )
    }));
    const gameProbDenom =
      gameScenarios.reduce((acc, s) => acc + s.probability, 0) || 1;
    const normalizedGameScenarios = gameScenarios.map((s) => ({
      ...s,
      probability: s.probability / gameProbDenom
    }));
    const top = normalizedGameScenarios
      .slice()
      .sort((a, b) => b.probability - a.probability)[0];
    horizonScenarioSummaries.push({
      gameIndex,
      topRole: top?.role ?? args.currentRole ?? "L4",
      topProbability: Number((top?.probability ?? 1).toFixed(4))
    });

    for (const scenario of normalizedGameScenarios) {
      const p = clamp(scenario.probability, 0, 1);
      const mult = scenarioRoleScoringMultiplier(
        args.currentRole,
        scenario.role
      );
      const goalsEs = args.baseGoalsEs * mult.goal;
      const goalsPp = args.baseGoalsPp * mult.goal;
      const assistsEs = args.baseAssistsEs * mult.assist;
      const assistsPp = args.baseAssistsPp * mult.assist;
      const weightedScalar = scalar / scalarTotal;
      blendedGoalsEs += weightedScalar * p * goalsEs;
      blendedGoalsPp += weightedScalar * p * goalsPp;
      blendedAssistsEs += weightedScalar * p * assistsEs;
      blendedAssistsPp += weightedScalar * p * assistsPp;
      const existing = scenarioLineByRole.get(scenario.role);
      if (!existing) {
        scenarioLineByRole.set(scenario.role, {
          role: scenario.role,
          probability: weightedScalar * p,
          goalsEs: weightedScalar * goalsEs,
          goalsPp: weightedScalar * goalsPp,
          assistsEs: weightedScalar * assistsEs,
          assistsPp: weightedScalar * assistsPp
        });
      } else {
        existing.probability += weightedScalar * p;
        existing.goalsEs += weightedScalar * goalsEs;
        existing.goalsPp += weightedScalar * goalsPp;
        existing.assistsEs += weightedScalar * assistsEs;
        existing.assistsPp += weightedScalar * assistsPp;
        scenarioLineByRole.set(scenario.role, existing);
      }
    }
  }

  const scenarioLines = Array.from(scenarioLineByRole.values())
    .sort((a, b) => b.probability - a.probability)
    .map((s) => ({
      role: s.role,
      probability: Number(s.probability.toFixed(4)),
      goalsEs: Number(s.goalsEs.toFixed(4)),
      goalsPp: Number(s.goalsPp.toFixed(4)),
      assistsEs: Number(s.assistsEs.toFixed(4)),
      assistsPp: Number(s.assistsPp.toFixed(4))
    }));

  return {
    blended: {
      goalsEs: Number(blendedGoalsEs.toFixed(4)),
      goalsPp: Number(blendedGoalsPp.toFixed(4)),
      assistsEs: Number(blendedAssistsEs.toFixed(4)),
      assistsPp: Number(blendedAssistsPp.toFixed(4))
    },
    scenarioLines,
    horizonScenarioSummaries
  };
}

export function buildSkaterScenarioMetadata(args: {
  scenarios: SkaterRoleScenario[];
  modelVersion?: string;
  topK?: number;
}): SkaterScenarioMetadata {
  const topK = Number.isFinite(args.topK)
    ? Math.max(1, Math.floor(Number(args.topK)))
    : 3;
  const modelVersion = args.modelVersion ?? "skater-role-scenario-v1";
  const normalized = args.scenarios
    .slice()
    .sort((a, b) => b.probability - a.probability)
    .slice(0, topK)
    .map((s) => ({
      role: s.role,
      probability: Number(clamp(s.probability, 0, 1).toFixed(4)),
      source: s.source
    }));
  return {
    modelVersion,
    scenarioCount: args.scenarios.length,
    topScenarioDrivers: normalized
  };
}

export function validateReconciledPlayerDistribution(args: {
  baselinePlayers: ReconciledSkaterVector[];
  reconciledPlayers: ReconciledSkaterVector[];
  targets: {
    toiEsSeconds: number;
    toiPpSeconds: number;
    shotsEs: number;
    shotsPp: number;
  };
}): ReconciliationDistributionValidation {
  const byBaselineId = new Map<number, ReconciledSkaterVector>();
  for (const p of args.baselinePlayers) byBaselineId.set(p.playerId, p);
  const players = args.reconciledPlayers.map((p) => ({ ...p }));
  if (players.length === 0) {
    return {
      players,
      wasAdjusted: false,
      topEsShareAfter: 0,
      topPpShareAfter: 0
    };
  }

  const totalEs = players.reduce(
    (acc, p) => acc + Math.max(0, p.toiEsSeconds),
    0
  );
  const totalPp = players.reduce(
    (acc, p) => acc + Math.max(0, p.toiPpSeconds),
    0
  );
  const topEsShareAfter =
    totalEs > 0
      ? Math.max(...players.map((p) => Math.max(0, p.toiEsSeconds) / totalEs))
      : 0;
  const topPpShareAfter =
    totalPp > 0
      ? Math.max(...players.map((p) => Math.max(0, p.toiPpSeconds) / totalPp))
      : 0;
  const needsAdjustment =
    topEsShareAfter > RECON_TOP_ES_SHARE_MAX ||
    topPpShareAfter > RECON_TOP_PP_SHARE_MAX;
  if (!needsAdjustment) {
    return {
      players,
      wasAdjusted: false,
      topEsShareAfter: Number(topEsShareAfter.toFixed(4)),
      topPpShareAfter: Number(topPpShareAfter.toFixed(4))
    };
  }

  const blended = players.map((p) => {
    const baseline = byBaselineId.get(p.playerId) ?? p;
    return {
      ...p,
      toiEsSeconds: Number(
        (
          (1 - RECON_BLEND_TO_BASELINE) * p.toiEsSeconds +
          RECON_BLEND_TO_BASELINE * baseline.toiEsSeconds
        ).toFixed(3)
      ),
      toiPpSeconds: Number(
        (
          (1 - RECON_BLEND_TO_BASELINE) * p.toiPpSeconds +
          RECON_BLEND_TO_BASELINE * baseline.toiPpSeconds
        ).toFixed(3)
      ),
      shotsEs: Number(
        (
          (1 - RECON_BLEND_TO_BASELINE) * p.shotsEs +
          RECON_BLEND_TO_BASELINE * baseline.shotsEs
        ).toFixed(3)
      ),
      shotsPp: Number(
        (
          (1 - RECON_BLEND_TO_BASELINE) * p.shotsPp +
          RECON_BLEND_TO_BASELINE * baseline.shotsPp
        ).toFixed(3)
      )
    };
  });

  const renormalize = (
    key: "toiEsSeconds" | "toiPpSeconds" | "shotsEs" | "shotsPp",
    target: number
  ) => {
    const sum = blended.reduce((acc, p) => acc + Math.max(0, p[key]), 0);
    const scale = sum > 0 ? target / sum : 1;
    for (const p of blended) {
      p[key] = Number((Math.max(0, p[key]) * scale).toFixed(3));
    }
  };
  renormalize("toiEsSeconds", args.targets.toiEsSeconds);
  renormalize("toiPpSeconds", args.targets.toiPpSeconds);
  renormalize("shotsEs", args.targets.shotsEs);
  renormalize("shotsPp", args.targets.shotsPp);

  const adjustedTotalEs = blended.reduce(
    (acc, p) => acc + Math.max(0, p.toiEsSeconds),
    0
  );
  const adjustedTotalPp = blended.reduce(
    (acc, p) => acc + Math.max(0, p.toiPpSeconds),
    0
  );
  const adjustedTopEsShare =
    adjustedTotalEs > 0
      ? Math.max(
          ...blended.map((p) => Math.max(0, p.toiEsSeconds) / adjustedTotalEs)
        )
      : 0;
  const adjustedTopPpShare =
    adjustedTotalPp > 0
      ? Math.max(
          ...blended.map((p) => Math.max(0, p.toiPpSeconds) / adjustedTotalPp)
        )
      : 0;

  return {
    players: blended,
    wasAdjusted: true,
    topEsShareAfter: Number(adjustedTopEsShare.toFixed(4)),
    topPpShareAfter: Number(adjustedTopPpShare.toFixed(4))
  };
}

export function computeSkaterTeamToiTargetWithPoolGuard(args: {
  canonicalTargetSeconds: number;
  projectedSkaterCount: number;
  ppShare: number;
  minValidSkaterCount?: number;
  maxSingleSkaterToiSeconds?: number;
  maxAvgToiPerProjectedSkaterSeconds?: number;
}): {
  targetSeconds: number;
  wasCapped: boolean;
  capReason: "undersized_projected_pool" | null;
} {
  const canonicalTarget = Math.max(
    0,
    Math.floor(Number(args.canonicalTargetSeconds) || 0)
  );
  const projectedSkaterCount = Math.max(
    0,
    Math.floor(Number(args.projectedSkaterCount) || 0)
  );
  const minValidSkaterCount = Number.isFinite(args.minValidSkaterCount)
    ? Math.max(1, Math.floor(Number(args.minValidSkaterCount)))
    : SKATER_POOL_MIN_VALID_COUNT;
  if (projectedSkaterCount >= minValidSkaterCount || canonicalTarget <= 0) {
    return {
      targetSeconds: canonicalTarget,
      wasCapped: false,
      capReason: null
    };
  }

  const ppShare = clamp(args.ppShare, 0, 0.5);
  const maxSingleSkaterToiSeconds = Number.isFinite(args.maxSingleSkaterToiSeconds)
    ? Math.max(600, Math.floor(Number(args.maxSingleSkaterToiSeconds)))
    : SKATER_POOL_EMERGENCY_MAX_SINGLE_TOI_SECONDS;
  const maxAvgToiPerProjectedSkaterSeconds = Number.isFinite(
    args.maxAvgToiPerProjectedSkaterSeconds
  )
    ? Math.max(300, Math.floor(Number(args.maxAvgToiPerProjectedSkaterSeconds)))
    : SKATER_POOL_EMERGENCY_MAX_AVG_TOI_SECONDS;

  const blendedTopShare =
    RECON_TOP_ES_SHARE_MAX * (1 - ppShare) + RECON_TOP_PP_SHARE_MAX * ppShare;
  const capByTopShare =
    blendedTopShare > 0
      ? Math.floor(maxSingleSkaterToiSeconds / blendedTopShare)
      : canonicalTarget;
  const capByAvgToi =
    projectedSkaterCount > 0
      ? projectedSkaterCount * maxAvgToiPerProjectedSkaterSeconds
      : 0;
  const emergencyCap = Math.max(1800, Math.min(capByTopShare, capByAvgToi));
  const targetSeconds = Math.min(canonicalTarget, emergencyCap);

  return {
    targetSeconds,
    wasCapped: targetSeconds < canonicalTarget,
    capReason: targetSeconds < canonicalTarget ? "undersized_projected_pool" : null
  };
}
