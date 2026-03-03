import {
  B2B_ALTERNATE_GOALIE_BOOST,
  B2B_REPEAT_STARTER_PENALTY,
  GOALIE_GSAA_PRIOR_MAX_ABS,
  GOALIE_GSAA_PRIOR_WEIGHT,
  GOALIE_SEASON_GAMES_PLAYED_WEIGHT,
  GOALIE_SEASON_START_PCT_BASELINE,
  GOALIE_SEASON_START_PCT_WEIGHT,
  GOALIE_STALE_HARD_DAYS,
  GOALIE_STALE_SOFT_DAYS,
  LINE_COMBO_PRIOR_LOGIT_WEIGHT,
  TEAM_STRENGTH_WEAKER_GAP,
  WEAK_OPPONENT_BACKUP_BOOST,
  WEAK_OPPONENT_GF_THRESHOLD,
  WEAK_OPPONENT_PRIMARY_REST_PENALTY,
  WEAKER_TEAM_B2B_BACKUP_BOOST,
  WEAKER_TEAM_B2B_PRIMARY_PENALTY
} from "../constants/projection-weights";
import type {
  StarterScenario,
  StarterScenarioProjection,
  TeamGoalieStarterContext
} from "../types/run-forge-projections.types";
import { daysBetweenDates } from "../utils/date-utils";
import { clamp, sigmoid } from "../utils/number-utils";

export function blendTopStarterScenarioOutputs(opts: {
  scenarioProjections: StarterScenarioProjection[];
  fallbackProjection: Omit<
    StarterScenarioProjection,
    "goalie_id" | "rank" | "starter_probability_raw" | "starter_probability_top2_normalized"
  >;
}) {
  const weighted = {
    proj_shots_against: 0,
    proj_saves: 0,
    proj_goals_allowed: 0,
    proj_win_prob: 0,
    proj_shutout_prob: 0,
    modeled_save_pct: 0
  };
  let probabilityMass = 0;
  for (const s of opts.scenarioProjections) {
    const w = clamp(s.starter_probability_raw, 0, 1);
    probabilityMass += w;
    weighted.proj_shots_against += w * s.proj_shots_against;
    weighted.proj_saves += w * s.proj_saves;
    weighted.proj_goals_allowed += w * s.proj_goals_allowed;
    weighted.proj_win_prob += w * s.proj_win_prob;
    weighted.proj_shutout_prob += w * s.proj_shutout_prob;
    weighted.modeled_save_pct += w * s.modeled_save_pct;
  }

  const clampedMass = clamp(probabilityMass, 0, 1);
  const residualMass = 1 - clampedMass;
  const fallback = opts.fallbackProjection;
  return {
    probability_mass: Number(clampedMass.toFixed(4)),
    residual_probability_mass: Number(residualMass.toFixed(4)),
    proj_shots_against:
      weighted.proj_shots_against + residualMass * fallback.proj_shots_against,
    proj_saves: weighted.proj_saves + residualMass * fallback.proj_saves,
    proj_goals_allowed:
      weighted.proj_goals_allowed + residualMass * fallback.proj_goals_allowed,
    proj_win_prob: weighted.proj_win_prob + residualMass * fallback.proj_win_prob,
    proj_shutout_prob:
      weighted.proj_shutout_prob + residualMass * fallback.proj_shutout_prob,
    modeled_save_pct:
      weighted.modeled_save_pct + residualMass * fallback.modeled_save_pct
  };
}

export function selectStarterCandidateGoalieIds(opts: {
  asOfDate: string;
  rawCandidateGoalieIds: number[];
  currentTeamGoalieIds: Set<number>;
  context: TeamGoalieStarterContext;
  goalieOverrideGoalieId?: number | null;
  limit?: number;
  priorStartProbByGoalieId?: Map<number, number>;
  confirmedStarterByGoalieId?: Map<number, boolean>;
}): number[] {
  const priorStartProbByGoalieId = opts.priorStartProbByGoalieId ?? new Map();
  const confirmedStarterByGoalieId = opts.confirmedStarterByGoalieId ?? new Map();
  const goalieOverrideGoalieId = opts.goalieOverrideGoalieId ?? null;
  const limit = Number.isFinite(opts.limit) ? Math.max(1, Number(opts.limit)) : 3;

  return Array.from(new Set(opts.rawCandidateGoalieIds))
    .filter((goalieId) => {
      if (!Number.isFinite(goalieId)) return false;
      if (goalieOverrideGoalieId === goalieId) return true;
      if (opts.currentTeamGoalieIds.size > 0 && !opts.currentTeamGoalieIds.has(goalieId)) {
        return false;
      }
      const lastPlayed = opts.context.lastPlayedDateByGoalie.get(goalieId);
      if (!lastPlayed) return true;
      const daysSinceLastPlayed = Math.max(0, daysBetweenDates(opts.asOfDate, lastPlayed));
      return daysSinceLastPlayed <= GOALIE_STALE_HARD_DAYS;
    })
    .sort((a, b) => {
      const score = (goalieId: number) => {
        const starts = opts.context.startsByGoalie.get(goalieId) ?? 0;
        const priorProb = priorStartProbByGoalieId.get(goalieId) ?? 0.5;
        const isConfirmed = confirmedStarterByGoalieId.get(goalieId) ?? false;
        const lastPlayed = opts.context.lastPlayedDateByGoalie.get(goalieId);
        const daysSinceLastPlayed =
          lastPlayed != null ? Math.max(0, daysBetweenDates(opts.asOfDate, lastPlayed)) : 999;
        const isOverride = goalieOverrideGoalieId === goalieId;

        let s = 0;
        if (isOverride) s += 100;
        if (isConfirmed) s += 25;
        s += priorProb * 10;
        s += starts * 1.5;
        s -= Math.min(daysSinceLastPlayed, 120) / 30;
        return s;
      };
      return score(b) - score(a);
    })
    .slice(0, limit);
}

export function computeStarterProbabilities(opts: {
  asOfDate: string;
  candidateGoalieIds: number[];
  starterContext: TeamGoalieStarterContext;
  priorStartProbByGoalieId: Map<number, number>;
  lineComboPriorByGoalieId?: Map<number, number>;
  projectedGsaaPer60ByGoalieId?: Map<number, number>;
  seasonStartPctByGoalieId?: Map<number, number>;
  seasonGamesPlayedByGoalieId?: Map<number, number>;
  teamGoalsFor: number;
  opponentGoalsFor: number;
}): Map<number, number> {
  const probs = new Map<number, number>();
  const candidates = Array.from(new Set(opts.candidateGoalieIds)).filter((id) =>
    Number.isFinite(id)
  );
  if (candidates.length === 0) return probs;
  if (candidates.length === 1) {
    probs.set(candidates[0], 1);
    return probs;
  }

  const starts = opts.starterContext.startsByGoalie;
  const lineComboPriorByGoalieId = opts.lineComboPriorByGoalieId ?? new Map();
  const projectedGsaaPer60ByGoalieId =
    opts.projectedGsaaPer60ByGoalieId ?? new Map();
  const seasonStartPctByGoalieId = opts.seasonStartPctByGoalieId ?? new Map();
  const seasonGamesPlayedByGoalieId =
    opts.seasonGamesPlayedByGoalieId ?? new Map();
  const totalGames = Math.max(1, opts.starterContext.totalGames);
  const teamIsWeaker =
    opts.teamGoalsFor + TEAM_STRENGTH_WEAKER_GAP < opts.opponentGoalsFor;
  const opponentIsWeak = opts.opponentGoalsFor <= WEAK_OPPONENT_GF_THRESHOLD;
  const previousGameDate = opts.starterContext.previousGameDate;
  const isB2B =
    previousGameDate != null &&
    daysBetweenDates(opts.asOfDate, previousGameDate) === 1;
  const previousStarter = opts.starterContext.previousGameStarterGoalieId;
  const lastPlayedMap = opts.starterContext.lastPlayedDateByGoalie;

  const scores = candidates.map((goalieId) => {
    const l10Starts = starts.get(goalieId) ?? 0;
    const l10Share = l10Starts / totalGames;
    const priorProb = clamp(opts.priorStartProbByGoalieId.get(goalieId) ?? 0.5, 0.01, 0.99);
    const lineComboPrior = clamp(lineComboPriorByGoalieId.get(goalieId) ?? 0.5, 0.05, 0.95);
    const projectedGsaaPer60 = clamp(
      projectedGsaaPer60ByGoalieId.get(goalieId) ?? 0,
      -GOALIE_GSAA_PRIOR_MAX_ABS,
      GOALIE_GSAA_PRIOR_MAX_ABS
    );
    const seasonStartPct = clamp(
      seasonStartPctByGoalieId.get(goalieId) ?? GOALIE_SEASON_START_PCT_BASELINE,
      0,
      1
    );
    const seasonGamesPlayed = Math.max(0, seasonGamesPlayedByGoalieId.get(goalieId) ?? 0);
    const seasonGamesWeight = clamp(seasonGamesPlayed / (seasonGamesPlayed + 10), 0, 1);
    const isPrimary = l10Share >= 0.6;
    const playedYesterday = isB2B && previousStarter === goalieId;
    const lastPlayed = lastPlayedMap.get(goalieId) ?? null;
    const daysSinceLastPlayed =
      lastPlayed != null ? Math.max(0, daysBetweenDates(opts.asOfDate, lastPlayed)) : 999;

    let score = 0;
    score += 2.4 * (l10Share - 0.5);
    score += 0.7 * Math.log(priorProb / (1 - priorProb));
    score += LINE_COMBO_PRIOR_LOGIT_WEIGHT * Math.log(lineComboPrior / (1 - lineComboPrior));
    score += GOALIE_GSAA_PRIOR_WEIGHT * projectedGsaaPer60;
    score +=
      GOALIE_SEASON_START_PCT_WEIGHT *
      (seasonStartPct - GOALIE_SEASON_START_PCT_BASELINE) *
      seasonGamesWeight;
    score += GOALIE_SEASON_GAMES_PLAYED_WEIGHT * seasonGamesWeight;

    if (playedYesterday) {
      score -= B2B_REPEAT_STARTER_PENALTY;
    } else if (isB2B && previousStarter != null) {
      score += B2B_ALTERNATE_GOALIE_BOOST;
    }

    if (isB2B && teamIsWeaker && isPrimary) {
      score -= WEAKER_TEAM_B2B_PRIMARY_PENALTY;
    }
    if (isB2B && teamIsWeaker && !isPrimary) {
      score += WEAKER_TEAM_B2B_BACKUP_BOOST;
    }

    if (opponentIsWeak && isPrimary) {
      score -= WEAK_OPPONENT_PRIMARY_REST_PENALTY;
    }
    if (opponentIsWeak && !isPrimary) {
      score += WEAK_OPPONENT_BACKUP_BOOST;
    }

    if (daysSinceLastPlayed > GOALIE_STALE_HARD_DAYS) score -= 6;
    else if (daysSinceLastPlayed > GOALIE_STALE_SOFT_DAYS) score -= 3;
    else if (daysSinceLastPlayed > 14) score -= 0.8;
    if (daysSinceLastPlayed <= 7) score += 0.2;

    return { goalieId, score };
  });

  if (scores.length === 2) {
    const [a, b] = scores;
    const pA = clamp(sigmoid(a.score - b.score), 0.02, 0.98);
    probs.set(a.goalieId, pA);
    probs.set(b.goalieId, 1 - pA);
    return probs;
  }

  const maxScore = Math.max(...scores.map((s) => s.score));
  const exps = scores.map((s) => Math.exp(s.score - maxScore));
  const denom = exps.reduce((acc, v) => acc + v, 0) || 1;
  scores.forEach((s, i) => {
    probs.set(s.goalieId, clamp(exps[i] / denom, 0.01, 0.98));
  });
  return probs;
}

export function buildTopStarterScenarios(opts: {
  probabilitiesByGoalieId: Map<number, number>;
  maxScenarios?: number;
}): StarterScenario[] {
  const maxScenarios = Number.isFinite(opts.maxScenarios)
    ? Math.max(1, Number(opts.maxScenarios))
    : 2;
  const ranked = Array.from(opts.probabilitiesByGoalieId.entries())
    .filter(([goalieId, probability]) => Number.isFinite(goalieId) && Number.isFinite(probability))
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxScenarios);
  if (ranked.length === 0) return [];

  const rawMass = ranked.reduce((sum, [, probability]) => sum + Math.max(0, probability), 0);
  const denom = rawMass > 0 ? rawMass : ranked.length;
  return ranked.map(([goalieId, rawProbability], idx) => ({
    goalieId,
    rawProbability,
    probability: clamp(Math.max(0, rawProbability) / denom, 0, 1),
    rank: idx + 1
  }));
}
