import type {
  GoalieEvidence
} from "lib/projections/goalieModel";
import type {
  GoalieRestSplitProfile,
  GoalieWorkloadContext,
  StarterScenario,
  StarterScenarioProjection
} from "../types/run-forge-projections.types";

type DaysBetweenDatesFn = (a: string, b: string) => number;

type StarterContextLike = {
  previousGameDate: string | null;
  previousGameStarterGoalieId: number | null;
  totalGames: number;
  lastPlayedDateByGoalie: Map<number, string>;
  startsByGoalie: Map<number, number>;
};

type StarterPriorMaps = {
  projectedGsaaPer60ByGoalieId: Map<number, number>;
  seasonStartPctByGoalieId: Map<number, number>;
  seasonGamesPlayedByGoalieId: Map<number, number>;
  lineComboPriorByGoalieId: Map<number, number>;
};

export function buildSkaterUncertaintyWithModel<TUncertainty, TModel>(args: {
  uncertainty: TUncertainty;
  model: TModel;
}): TUncertainty & { model: TModel } {
  return {
    ...(args.uncertainty as object),
    model: args.model
  } as TUncertainty & { model: TModel };
}

export function buildStarterScenarioTop2(
  topStarterScenarios: StarterScenario[],
  extras?: {
    lastPlayedDateByGoalie?: Map<number, string>;
    startsByGoalie?: Map<number, number>;
    projectedGsaaPer60ByGoalieId?: Map<number, number>;
    seasonStartPctByGoalieId?: Map<number, number>;
    seasonGamesPlayedByGoalieId?: Map<number, number>;
    lineComboPriorByGoalieId?: Map<number, number>;
    asOfDate?: string;
    daysBetweenDates?: DaysBetweenDatesFn;
  }
) {
  return topStarterScenarios.map((s) => ({
    goalie_id: s.goalieId,
    rank: s.rank,
    raw_probability: Number(s.rawProbability.toFixed(4)),
    probability: Number(s.probability.toFixed(4)),
    ...(extras?.lastPlayedDateByGoalie
      ? {
          last_played_date: extras.lastPlayedDateByGoalie.get(s.goalieId) ?? null,
          days_since_last_played:
            extras.asOfDate && extras.daysBetweenDates
              ? (() => {
                  const d = extras.lastPlayedDateByGoalie?.get(s.goalieId);
                  if (!d) return null;
                  return Math.max(0, extras.daysBetweenDates(extras.asOfDate!, d));
                })()
              : null,
          l10_starts: extras.startsByGoalie?.get(s.goalieId) ?? 0,
          projected_gsaa_per_60:
            extras.projectedGsaaPer60ByGoalieId?.get(s.goalieId) ?? null,
          season_start_pct: extras.seasonStartPctByGoalieId?.get(s.goalieId) ?? null,
          season_games_played:
            extras.seasonGamesPlayedByGoalieId?.get(s.goalieId) ?? null,
          line_combinations_recency_prior:
            extras.lineComboPriorByGoalieId?.get(s.goalieId) ?? null
        }
      : {})
  }));
}

export function buildStarterOverrideMetadata(args: {
  selectedGoalieId: number | null;
  starterProb: number;
  topStarterScenarios: StarterScenario[];
}) {
  return {
    source: "operator_override",
    selected_goalie_id: args.selectedGoalieId,
    selected_goalie_probability: Number(args.starterProb.toFixed(4)),
    candidate_goalies: [
      {
        goalie_id: args.selectedGoalieId,
        probability: Number(args.starterProb.toFixed(4)),
        override: true
      }
    ],
    starter_scenarios_top2: buildStarterScenarioTop2(args.topStarterScenarios).map((s) => ({
      ...s,
      override: true
    })),
    top2_probability_mass: Number(args.starterProb.toFixed(4))
  };
}

export function buildStarterHeuristicMetadata(args: {
  asOfDate: string;
  selectedGoalieId: number | null;
  starterProb: number;
  rankedGoalies: Array<[number, number]>;
  topStarterScenarios: StarterScenario[];
  starterContext: StarterContextLike;
  priorMaps: StarterPriorMaps;
  daysBetweenDates: DaysBetweenDatesFn;
  isBackToBack: boolean;
  teamIsWeaker: boolean;
  opponentIsWeak: boolean;
  opponentProjectedShotsAgainst: number;
  teamSaAvg10: number | null;
  teamSaAvg5: number | null;
  trendAdj: number;
  teamStrengthContextAdjustment: {
    shotsAgainstPctAdjustment: number;
    sampleWeight: number;
    opponentGoalsForPctAdjustment: number;
  };
  teamFiveOnFiveContextAdjustment: {
    contextPctAdjustment: number;
    sampleWeight: number;
    leagueSavePctAdjustment: number;
  };
  nstOpponentDangerAdjustment: {
    contextPctAdjustment: number;
    sampleWeight: number;
  };
  baseShotsAgainst: number;
  shotsAgainst: number;
  opponentContext: {
    opponentIsHome: boolean;
    oppShots10: number | null;
    oppShots5: number | null;
    oppGoals10: number | null;
    oppGoals5: number | null;
    defendingRestDays: number | null;
    opponentRestDays: number | null;
  };
  defendingNstExpectedGoalsProfile: {
    xga: number | null;
    xgaPer60: number | null;
    source: string | null;
    sourceDate: string | null;
  } | null;
  opponentNstExpectedGoalsProfile: {
    xga: number | null;
    xgaPer60: number | null;
    source: string | null;
    sourceDate: string | null;
  } | null;
  defendingFiveOnFiveProfile: {
    savePct5v5: number | null;
    shootingPlusSavePct5v5: number | null;
  } | null;
  opponentFiveOnFiveProfile: {
    shootingPlusSavePct5v5: number | null;
  } | null;
  defendingStrengthPrior: {
    xga: number | null;
    xgaPerGame: number | null;
    xgfPerGame: number | null;
  } | null;
  opponentStrengthPrior: {
    xga: number | null;
    xgaPerGame: number | null;
    xgfPerGame: number | null;
  } | null;
  teamGoalsFor: number;
  adjustedTeamGoalsFor: number;
  opponentGoalsFor: number;
  contextPct: number;
  leagueSavePct: number;
}) {
  return {
    source: "heuristic_starter_model",
    selected_goalie_id: args.selectedGoalieId,
    selected_goalie_probability: Number(args.starterProb.toFixed(4)),
    model_context: {
      as_of_date: args.asOfDate,
      previous_game_date: args.starterContext.previousGameDate,
      previous_game_starter_goalie_id:
        args.starterContext.previousGameStarterGoalieId,
      is_back_to_back: args.isBackToBack,
      team_is_weaker: args.teamIsWeaker,
      opponent_is_weak: args.opponentIsWeak,
      l10_games_available: args.starterContext.totalGames
    },
    shots_against_context: {
      opponent_projected_shots_against: args.opponentProjectedShotsAgainst,
      team_avg_shots_against_last10: args.teamSaAvg10,
      team_avg_shots_against_last5: args.teamSaAvg5,
      trend_adjustment: Number(args.trendAdj.toFixed(3)),
      nhl_team_data_pct_adjustment: Number(
        args.teamStrengthContextAdjustment.shotsAgainstPctAdjustment.toFixed(4)
      ),
      wgo_team_stats_5v5_context_pct_adjustment: Number(
        args.teamFiveOnFiveContextAdjustment.contextPctAdjustment.toFixed(4)
      ),
      nst_opponent_danger_context_pct_adjustment: Number(
        args.nstOpponentDangerAdjustment.contextPctAdjustment.toFixed(4)
      ),
      pre_context_projected_shots_against: args.baseShotsAgainst,
      blended_projected_shots_against: args.shotsAgainst
    },
    opponent_offense_context: {
      opponent_is_home: args.opponentContext.opponentIsHome,
      opponent_avg_shots_for_last10: args.opponentContext.oppShots10,
      opponent_avg_shots_for_last5: args.opponentContext.oppShots5,
      opponent_avg_goals_for_last10: args.opponentContext.oppGoals10,
      opponent_avg_goals_for_last5: args.opponentContext.oppGoals5,
      defending_team_rest_days: args.opponentContext.defendingRestDays,
      opponent_rest_days: args.opponentContext.opponentRestDays,
      nhl_team_data_sample_weight: Number(
        args.teamStrengthContextAdjustment.sampleWeight.toFixed(4)
      ),
      wgo_5v5_sample_weight: Number(
        args.teamFiveOnFiveContextAdjustment.sampleWeight.toFixed(4)
      ),
      nst_opponent_danger_sample_weight: Number(
        args.nstOpponentDangerAdjustment.sampleWeight.toFixed(4)
      ),
      defending_team_nst_xga: args.defendingNstExpectedGoalsProfile?.xga ?? null,
      defending_team_nst_xga_per_60:
        args.defendingNstExpectedGoalsProfile?.xgaPer60 ?? null,
      defending_team_nst_source:
        args.defendingNstExpectedGoalsProfile?.source ?? null,
      defending_team_nst_source_date:
        args.defendingNstExpectedGoalsProfile?.sourceDate ?? null,
      opponent_team_nst_xga: args.opponentNstExpectedGoalsProfile?.xga ?? null,
      opponent_team_nst_xga_per_60:
        args.opponentNstExpectedGoalsProfile?.xgaPer60 ?? null,
      opponent_team_nst_source:
        args.opponentNstExpectedGoalsProfile?.source ?? null,
      opponent_team_nst_source_date:
        args.opponentNstExpectedGoalsProfile?.sourceDate ?? null,
      defending_team_save_pct_5v5:
        args.defendingFiveOnFiveProfile?.savePct5v5 ?? null,
      defending_team_shooting_plus_save_pct_5v5:
        args.defendingFiveOnFiveProfile?.shootingPlusSavePct5v5 ?? null,
      opponent_team_shooting_plus_save_pct_5v5:
        args.opponentFiveOnFiveProfile?.shootingPlusSavePct5v5 ?? null,
      wgo_team_stats_5v5_league_save_pct_adjustment: Number(
        args.teamFiveOnFiveContextAdjustment.leagueSavePctAdjustment.toFixed(4)
      ),
      defending_team_xga: args.defendingStrengthPrior?.xga ?? null,
      defending_team_xga_per_game: args.defendingStrengthPrior?.xgaPerGame ?? null,
      defending_team_xgf_per_game: args.defendingStrengthPrior?.xgfPerGame ?? null,
      opponent_team_xga: args.opponentStrengthPrior?.xga ?? null,
      opponent_team_xga_per_game: args.opponentStrengthPrior?.xgaPerGame ?? null,
      opponent_team_xgf_per_game: args.opponentStrengthPrior?.xgfPerGame ?? null,
      team_goals_for_pre_strength_adjustment: Number(args.teamGoalsFor.toFixed(3)),
      team_goals_for_post_strength_adjustment: Number(
        args.adjustedTeamGoalsFor.toFixed(3)
      ),
      opponent_goals_for_post_strength_adjustment: Number(
        args.opponentGoalsFor.toFixed(3)
      ),
      context_adjustment_pct: Number(args.contextPct.toFixed(4)),
      league_save_pct_used: Number(args.leagueSavePct.toFixed(4))
    },
    candidate_goalies: args.rankedGoalies.map(([goalieId, probability]) => ({
      goalie_id: goalieId,
      probability: Number(probability.toFixed(4)),
      last_played_date:
        args.starterContext.lastPlayedDateByGoalie.get(goalieId) ?? null,
      days_since_last_played: (() => {
        const d = args.starterContext.lastPlayedDateByGoalie.get(goalieId);
        if (!d) return null;
        return Math.max(0, args.daysBetweenDates(args.asOfDate, d));
      })(),
      l10_starts: args.starterContext.startsByGoalie.get(goalieId) ?? 0,
      projected_gsaa_per_60:
        args.priorMaps.projectedGsaaPer60ByGoalieId.get(goalieId) ?? null,
      season_start_pct:
        args.priorMaps.seasonStartPctByGoalieId.get(goalieId) ?? null,
      season_games_played:
        args.priorMaps.seasonGamesPlayedByGoalieId.get(goalieId) ?? null,
      line_combinations_recency_prior:
        args.priorMaps.lineComboPriorByGoalieId.get(goalieId) ?? null
    })),
    starter_scenarios_top2: buildStarterScenarioTop2(args.topStarterScenarios, {
      lastPlayedDateByGoalie: args.starterContext.lastPlayedDateByGoalie,
      startsByGoalie: args.starterContext.startsByGoalie,
      projectedGsaaPer60ByGoalieId: args.priorMaps.projectedGsaaPer60ByGoalieId,
      seasonStartPctByGoalieId: args.priorMaps.seasonStartPctByGoalieId,
      seasonGamesPlayedByGoalieId: args.priorMaps.seasonGamesPlayedByGoalieId,
      lineComboPriorByGoalieId: args.priorMaps.lineComboPriorByGoalieId,
      asOfDate: args.asOfDate,
      daysBetweenDates: args.daysBetweenDates
    }),
    top2_probability_mass: Number(
      args.topStarterScenarios
        .reduce((sum, s) => sum + s.rawProbability, 0)
        .toFixed(4)
    ),
    line_combinations_prior: args.rankedGoalies
      .filter(([goalieId]) => args.priorMaps.lineComboPriorByGoalieId.has(goalieId))
      .map(([goalieId]) => ({
        goalie_id: goalieId,
        prior: Number(
          (args.priorMaps.lineComboPriorByGoalieId.get(goalieId) ?? 0).toFixed(4)
        )
      })),
    projected_gsaa_per_60_prior: args.rankedGoalies
      .filter(([goalieId]) =>
        args.priorMaps.projectedGsaaPer60ByGoalieId.has(goalieId)
      )
      .map(([goalieId]) => ({
        goalie_id: goalieId,
        projected_gsaa_per_60: Number(
          (
            args.priorMaps.projectedGsaaPer60ByGoalieId.get(goalieId) ?? 0
          ).toFixed(4)
        )
      }))
  };
}

export function augmentStarterModelMetaWithScenarioProjections(args: {
  starterModelMeta: Record<string, unknown>;
  scenarioProjections: StarterScenarioProjection[];
  blendedProjection: {
    probability_mass: number;
    residual_probability_mass: number;
    proj_saves: number;
    proj_goals_allowed: number;
    proj_win_prob: number;
    proj_shutout_prob: number;
    modeled_save_pct: number;
  };
}) {
  return {
    ...args.starterModelMeta,
    scenario_projections_top2: args.scenarioProjections,
    scenario_projection_count: args.scenarioProjections.length,
    scenario_projection_blend: {
      probability_mass: args.blendedProjection.probability_mass,
      residual_probability_mass: args.blendedProjection.residual_probability_mass,
      proj_saves: Number(args.blendedProjection.proj_saves.toFixed(3)),
      proj_goals_allowed: Number(args.blendedProjection.proj_goals_allowed.toFixed(3)),
      proj_win_prob: Number(args.blendedProjection.proj_win_prob.toFixed(4)),
      proj_shutout_prob: Number(args.blendedProjection.proj_shutout_prob.toFixed(4)),
      modeled_save_pct: Number(args.blendedProjection.modeled_save_pct.toFixed(4))
    }
  };
}

export function buildGoalieUncertaintyWithModel(args: {
  baseGoalieUncertainty: Record<string, unknown>;
  blendedProjection: {
    modeled_save_pct: number;
    residual_probability_mass: number;
    proj_saves: number;
    proj_goals_allowed: number;
    proj_win_prob: number;
    proj_shutout_prob: number;
  };
  goalieModel: {
    volatilityIndex: number;
    blowupRisk: number;
    confidenceTier: string;
    qualityTier: string;
    reliabilityTier: string;
    recommendation: string;
  };
  evidence: GoalieEvidence;
  workload: GoalieWorkloadContext;
  workloadSavePctPenalty: number;
  restSplitBucket: string;
  restSplitBucketGames: number | null;
  restSplitBucketSavePct: number | null;
  restSplitSavePctAdjustment: number;
  restSplitProfile: GoalieRestSplitProfile | null;
  adjustedLeagueSavePct: number;
  horizonGames: number;
  goalieHorizonScalars: number[];
  selectedGoalieId: number;
  starterProb: number;
  scenarioProjections: StarterScenarioProjection[];
  goalieHorizonTotalScalar: number;
  shotsAgainst: number;
  starterModelMeta: Record<string, unknown>;
}) {
  return {
    ...args.baseGoalieUncertainty,
    model: {
      save_pct: Number(args.blendedProjection.modeled_save_pct.toFixed(4)),
      volatility_index: Number(args.goalieModel.volatilityIndex.toFixed(3)),
      blowup_risk: Number(args.goalieModel.blowupRisk.toFixed(4)),
      confidence_tier: args.goalieModel.confidenceTier,
      quality_tier: args.goalieModel.qualityTier,
      reliability_tier: args.goalieModel.reliabilityTier,
      recommendation: args.goalieModel.recommendation,
      evidence: {
        recent_starts: args.evidence.recentStarts,
        recent_shots: args.evidence.recentShotsAgainst,
        season_starts: args.evidence.seasonStarts,
        season_shots: args.evidence.seasonShotsAgainst,
        baseline_starts: args.evidence.baselineStarts,
        baseline_shots: args.evidence.baselineShotsAgainst,
        quality_starts: args.evidence.qualityStarts ?? null,
        quality_starts_pct: args.evidence.qualityStartsPct ?? null
      },
      workload_context: {
        starts_last_7_days: args.workload.startsLast7Days,
        starts_last_14_days: args.workload.startsLast14Days,
        days_since_last_start: args.workload.daysSinceLastStart,
        goalie_back_to_back: args.workload.isGoalieBackToBack,
        workload_save_pct_penalty: Number(args.workloadSavePctPenalty.toFixed(4)),
        rest_split_bucket: args.restSplitBucket,
        rest_split_games: Number.isFinite(args.restSplitBucketGames)
          ? Number(args.restSplitBucketGames)
          : null,
        rest_split_save_pct: Number.isFinite(args.restSplitBucketSavePct)
          ? Number(args.restSplitBucketSavePct)
          : null,
        rest_split_save_pct_adjustment: Number(
          args.restSplitSavePctAdjustment.toFixed(4)
        ),
        rest_split_source_date: args.restSplitProfile?.sourceDate ?? null,
        league_save_pct_used: Number(args.adjustedLeagueSavePct.toFixed(4))
      },
      scenario_metadata: {
        model_version: "starter-scenario-v1",
        horizon_games: args.horizonGames,
        horizon_scalars: args.goalieHorizonScalars,
        selected_goalie_id: args.selectedGoalieId,
        selected_goalie_starter_probability: Number(args.starterProb.toFixed(4)),
        top2_scenario_count: args.scenarioProjections.length,
        top2_probability_mass: Number(
          args.scenarioProjections
            .reduce((sum, s) => sum + s.starter_probability_raw, 0)
            .toFixed(4)
        ),
        residual_probability_mass: args.blendedProjection.residual_probability_mass,
        blended_projection: {
          proj_shots_against: Number(
            (args.shotsAgainst * args.goalieHorizonTotalScalar).toFixed(3)
          ),
          proj_saves: Number(
            (args.blendedProjection.proj_saves * args.goalieHorizonTotalScalar).toFixed(3)
          ),
          proj_goals_allowed: Number(
            (
              args.blendedProjection.proj_goals_allowed * args.goalieHorizonTotalScalar
            ).toFixed(3)
          ),
          proj_win_prob: Number(
            (args.blendedProjection.proj_win_prob * args.goalieHorizonTotalScalar).toFixed(4)
          ),
          proj_shutout_prob: Number(
            (
              args.blendedProjection.proj_shutout_prob * args.goalieHorizonTotalScalar
            ).toFixed(4)
          ),
          modeled_save_pct: Number(args.blendedProjection.modeled_save_pct.toFixed(4))
        }
      },
      starter_selection: args.starterModelMeta
    }
  };
}
