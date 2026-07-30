import { buildGoalieUncertainty } from "../uncertainty";
import {
  computeGoalieProjectionModel,
  type GoalieEvidence,
} from "../goalieModel";
import {
  augmentStarterModelMetaWithScenarioProjections,
  buildGoalieUncertaintyWithModel,
  buildStarterHeuristicMetadata,
  buildStarterOverrideMetadata,
} from "../utils/projection-metadata-builders";
import { clamp } from "../utils/number-utils";
import { daysBetweenDates } from "../utils/date-utils";
import {
  ANALYTICS_MODEL_NAME,
  ANALYTICS_MODEL_VERSION,
  buildModelMarketFlagRow,
  getConsensusLineValue,
  getProjectionValueForPropMarket,
  PLAYER_MARKET_EDGE_THRESHOLDS,
} from "../utils/market-output-builders";
import {
  DEFENSE_B2B_FATIGUE_BOOST,
  OPPONENT_AWAY_PENALTY,
  OPPONENT_B2B_PENALTY,
  OPPONENT_HOME_BOOST,
  OPPONENT_RESTED_BOOST,
  TEAM_STRENGTH_WEAKER_GAP,
  WEAK_OPPONENT_GF_THRESHOLD,
} from "../constants/projection-weights";
import {
  computeGoalieRestSplitSavePctAdjustment,
  computeWorkloadSavePctPenalty,
  toGoalieRestSplitBucket,
} from "../calculators/goalie-save-pct-context";
import {
  blendTopStarterScenarioOutputs,
  buildTopStarterScenarios,
  computeStarterProbabilities,
} from "../calculators/goalie-starter";
import {
  computeNstOpponentDangerAdjustment,
  computeTeamFiveOnFiveContextAdjustment,
  computeTeamStrengthContextAdjustment,
} from "../calculators/team-context-adjustments";
import {
  fetchGoalieEvidence,
  fetchGoalieRestSplitProfile,
  fetchGoalieWorkloadContext,
  fetchTeamGoalieStarterContext,
} from "../queries/goalie-queries";
import {
  fetchTeamDefensiveEnvironment,
  fetchTeamFiveOnFiveProfile,
  fetchTeamNstExpectedGoalsProfile,
  fetchTeamOffenseEnvironment,
  fetchTeamRestDays,
  fetchTeamStrengthPrior,
} from "../queries/team-context-queries";
import type { MarketTypeSummary } from "../queries/market-queries";
import { persistForgeGoalieProjection } from "./persistence-stage";
import type {
  GameRow,
  GoalieRestSplitProfile,
  GoalieWorkloadContext,
  StarterScenario,
  StarterScenarioProjection,
  TeamDefensiveEnvironment,
  TeamFiveOnFiveProfile,
  TeamGoalieStarterContext,
  TeamNstExpectedGoalsProfile,
  TeamOffenseEnvironment,
  TeamStrengthPrior,
} from "../types/run-forge-projections.types";

export type GoalieStageCandidate = {
  teamId: number;
  opponentTeamId: number;
  candidateGoalieIds: number[];
  priorStartProbByGoalieId: Map<number, number>;
  confirmedStarterByGoalieId: Map<number, boolean>;
  lineComboPriorByGoalieId: Map<number, number>;
  projectedGsaaPer60ByGoalieId: Map<number, number>;
  seasonStartPctByGoalieId: Map<number, number>;
  seasonGamesPlayedByGoalieId: Map<number, number>;
  override: { goalieId: number; starterProb: number } | null;
};

export type SelectedGoalieProjection = {
  goalieId: number;
  starterProbability: number;
  confirmedStatus: boolean;
  saves: number;
};

export async function runPerGameGoalieStage(args: {
  asOfDate: string;
  runId: string;
  horizonGames: number;
  game: GameRow;
  deadlineMs: number;
  goalieCandidates: GoalieStageCandidate[];
  teamShotsByTeamId: Map<number, { shotsEs: number; shotsPp: number }>;
  teamGoalsByTeamId: Map<number, number>;
  teamAbbreviationById: Map<number, string>;
  teamStrengthPriorCache: Map<string, TeamStrengthPrior | null>;
  teamFiveOnFiveProfileCache: Map<string, TeamFiveOnFiveProfile | null>;
  teamNstExpectedGoalsCache: Map<string, TeamNstExpectedGoalsProfile | null>;
  teamDefensiveEnvironmentCache: Map<string, TeamDefensiveEnvironment>;
  teamOffenseEnvironmentCache: Map<string, TeamOffenseEnvironment>;
  teamRestDaysCache: Map<string, number | null>;
  teamGoalieStarterContextCache: Map<string, TeamGoalieStarterContext>;
  goalieEvidenceCache: Map<string, GoalieEvidence>;
  goalieWorkloadContextCache: Map<string, GoalieWorkloadContext>;
  goalieRestSplitProfileCache: Map<string, GoalieRestSplitProfile | null>;
  teamHorizonScalarsCache: Map<string, number[]>;
  playerPropContextByGamePlayerKey: Map<
    string,
    Record<string, MarketTypeSummary>
  >;
  selectedGoalieByTeamId: Map<number, SelectedGoalieProjection>;
  playerPredictionOutputRows: Array<Record<string, unknown>>;
  modelMarketFlagRows: Array<Record<string, unknown>>;
  metrics: { warnings: string[] };
}): Promise<{ timedOut: boolean; goalieRowsUpserted: number }> {
  const {
    asOfDate,
    runId,
    horizonGames,
    game,
    deadlineMs,
    goalieCandidates,
    teamShotsByTeamId,
    teamGoalsByTeamId,
    teamAbbreviationById,
    teamStrengthPriorCache,
    teamFiveOnFiveProfileCache,
    teamNstExpectedGoalsCache,
    teamDefensiveEnvironmentCache,
    teamOffenseEnvironmentCache,
    teamRestDaysCache,
    teamGoalieStarterContextCache,
    goalieEvidenceCache,
    goalieWorkloadContextCache,
    goalieRestSplitProfileCache,
    teamHorizonScalarsCache,
    playerPropContextByGamePlayerKey,
    selectedGoalieByTeamId,
    playerPredictionOutputRows,
    modelMarketFlagRows,
    metrics,
  } = args;
  const teamDateKey = (teamId: number) => `${teamId}:${asOfDate}`;
  const playerDateKey = (playerId: number) => `${playerId}:${asOfDate}`;
  let goalieRowsUpserted = 0;
  for (const c of goalieCandidates) {
    if (Date.now() > deadlineMs) {
      return { timedOut: true, goalieRowsUpserted };
    }
    const oppShots = teamShotsByTeamId.get(c.opponentTeamId);
    if (!oppShots) {
      metrics.warnings.push(
        `missing opponent shots for game=${game.id} team=${c.teamId}`,
      );
      continue;
    }
    const opponentProjectedShotsAgainst = Number(
      (oppShots.shotsEs + oppShots.shotsPp).toFixed(3),
    );
    const defendingTeamAbbrev = teamAbbreviationById.get(c.teamId) ?? null;
    const opponentTeamAbbrev =
      teamAbbreviationById.get(c.opponentTeamId) ?? null;
    if (!teamStrengthPriorCache.has(teamDateKey(c.teamId))) {
      teamStrengthPriorCache.set(
        teamDateKey(c.teamId),
        defendingTeamAbbrev
          ? await fetchTeamStrengthPrior(
              defendingTeamAbbrev,
              asOfDate,
              c.teamId,
            )
          : null,
      );
    }
    if (!teamStrengthPriorCache.has(teamDateKey(c.opponentTeamId))) {
      teamStrengthPriorCache.set(
        teamDateKey(c.opponentTeamId),
        opponentTeamAbbrev
          ? await fetchTeamStrengthPrior(
              opponentTeamAbbrev,
              asOfDate,
              c.opponentTeamId,
            )
          : null,
      );
    }
    const defendingStrengthPrior =
      teamStrengthPriorCache.get(teamDateKey(c.teamId)) ?? null;
    const opponentStrengthPrior =
      teamStrengthPriorCache.get(teamDateKey(c.opponentTeamId)) ?? null;
    const teamStrengthContextAdjustment = computeTeamStrengthContextAdjustment({
      defendingTeamPrior: defendingStrengthPrior,
      opponentTeamPrior: opponentStrengthPrior,
    });
    if (!teamFiveOnFiveProfileCache.has(teamDateKey(c.teamId))) {
      teamFiveOnFiveProfileCache.set(
        teamDateKey(c.teamId),
        await fetchTeamFiveOnFiveProfile(c.teamId, asOfDate),
      );
    }
    if (!teamFiveOnFiveProfileCache.has(teamDateKey(c.opponentTeamId))) {
      teamFiveOnFiveProfileCache.set(
        teamDateKey(c.opponentTeamId),
        await fetchTeamFiveOnFiveProfile(c.opponentTeamId, asOfDate),
      );
    }
    const defendingFiveOnFiveProfile =
      teamFiveOnFiveProfileCache.get(teamDateKey(c.teamId)) ?? null;
    const opponentFiveOnFiveProfile =
      teamFiveOnFiveProfileCache.get(teamDateKey(c.opponentTeamId)) ?? null;
    const teamFiveOnFiveContextAdjustment =
      computeTeamFiveOnFiveContextAdjustment({
        defendingTeamProfile: defendingFiveOnFiveProfile,
        opponentTeamProfile: opponentFiveOnFiveProfile,
      });
    if (!teamNstExpectedGoalsCache.has(teamDateKey(c.teamId))) {
      teamNstExpectedGoalsCache.set(
        teamDateKey(c.teamId),
        defendingTeamAbbrev
          ? await fetchTeamNstExpectedGoalsProfile(
              defendingTeamAbbrev,
              asOfDate,
            )
          : null,
      );
    }
    if (!teamNstExpectedGoalsCache.has(teamDateKey(c.opponentTeamId))) {
      teamNstExpectedGoalsCache.set(
        teamDateKey(c.opponentTeamId),
        opponentTeamAbbrev
          ? await fetchTeamNstExpectedGoalsProfile(opponentTeamAbbrev, asOfDate)
          : null,
      );
    }
    const defendingNstExpectedGoalsProfile =
      teamNstExpectedGoalsCache.get(teamDateKey(c.teamId)) ?? null;
    const opponentNstExpectedGoalsProfile =
      teamNstExpectedGoalsCache.get(teamDateKey(c.opponentTeamId)) ?? null;
    const nstOpponentDangerAdjustment = computeNstOpponentDangerAdjustment({
      defendingTeamProfile: defendingNstExpectedGoalsProfile,
      opponentTeamProfile: opponentNstExpectedGoalsProfile,
    });
    if (!teamDefensiveEnvironmentCache.has(teamDateKey(c.teamId))) {
      teamDefensiveEnvironmentCache.set(
        teamDateKey(c.teamId),
        await fetchTeamDefensiveEnvironment(c.teamId, asOfDate),
      );
    }
    const defensiveEnv = teamDefensiveEnvironmentCache.get(
      teamDateKey(c.teamId),
    ) as TeamDefensiveEnvironment;
    const teamSaAvg10 = defensiveEnv.avgShotsAgainstLast10;
    const teamSaAvg5 = defensiveEnv.avgShotsAgainstLast5;
    const trendAdj =
      teamSaAvg10 != null && teamSaAvg5 != null
        ? clamp((teamSaAvg5 - teamSaAvg10) * 0.25, -3, 3)
        : 0;
    const blendedShotsAgainst =
      teamSaAvg10 != null
        ? 0.65 * opponentProjectedShotsAgainst + 0.35 * teamSaAvg10 + trendAdj
        : opponentProjectedShotsAgainst;
    const adjustedBaseShotsAgainst =
      blendedShotsAgainst *
      (1 + teamStrengthContextAdjustment.shotsAgainstPctAdjustment);
    const baseShotsAgainst = Number(
      Math.max(0, adjustedBaseShotsAgainst).toFixed(3),
    );
    const teamGoalsFor = teamGoalsByTeamId.get(c.teamId) ?? 0;
    if (!teamOffenseEnvironmentCache.has(teamDateKey(c.opponentTeamId))) {
      teamOffenseEnvironmentCache.set(
        teamDateKey(c.opponentTeamId),
        await fetchTeamOffenseEnvironment(c.opponentTeamId, asOfDate),
      );
    }
    if (!teamRestDaysCache.has(teamDateKey(c.teamId))) {
      teamRestDaysCache.set(
        teamDateKey(c.teamId),
        await fetchTeamRestDays(c.teamId, asOfDate),
      );
    }
    if (!teamRestDaysCache.has(teamDateKey(c.opponentTeamId))) {
      teamRestDaysCache.set(
        teamDateKey(c.opponentTeamId),
        await fetchTeamRestDays(c.opponentTeamId, asOfDate),
      );
    }
    const opponentOffense = teamOffenseEnvironmentCache.get(
      teamDateKey(c.opponentTeamId),
    ) as TeamOffenseEnvironment;
    const defendingRestDays =
      teamRestDaysCache.get(teamDateKey(c.teamId)) ?? null;
    const opponentRestDays =
      teamRestDaysCache.get(teamDateKey(c.opponentTeamId)) ?? null;
    const opponentIsHome = c.opponentTeamId === game.homeTeamId;

    const oppShots10 = opponentOffense.avgShotsForLast10;
    const oppShots5 = opponentOffense.avgShotsForLast5;
    const oppGoals10 = opponentOffense.avgGoalsForLast10;
    const oppGoals5 = opponentOffense.avgGoalsForLast5;
    const shotsTrendPct =
      baseShotsAgainst > 0 && oppShots5 != null
        ? clamp((oppShots5 - baseShotsAgainst) / baseShotsAgainst, -0.12, 0.18)
        : 0;
    const goalsTrendPct =
      oppGoals10 != null && oppGoals5 != null && oppGoals10 > 0
        ? clamp((oppGoals5 - oppGoals10) / oppGoals10, -0.1, 0.15)
        : 0;

    let contextPct = 0;
    contextPct += shotsTrendPct * 0.45;
    contextPct += goalsTrendPct * 0.35;
    if (opponentRestDays != null && opponentRestDays >= 2)
      contextPct += OPPONENT_RESTED_BOOST;
    if (opponentRestDays === 1) contextPct -= OPPONENT_B2B_PENALTY;
    if (defendingRestDays === 1) contextPct += DEFENSE_B2B_FATIGUE_BOOST;
    contextPct += opponentIsHome ? OPPONENT_HOME_BOOST : -OPPONENT_AWAY_PENALTY;
    contextPct += teamFiveOnFiveContextAdjustment.contextPctAdjustment;
    contextPct += nstOpponentDangerAdjustment.contextPctAdjustment;
    contextPct = clamp(contextPct, -0.15, 0.2);

    const shotsAgainst = Number(
      Math.max(0, baseShotsAgainst * (1 + contextPct)).toFixed(3),
    );
    const leagueSavePct = clamp(
      0.9 -
        contextPct * 0.04 +
        teamFiveOnFiveContextAdjustment.leagueSavePctAdjustment,
      0.88,
      0.92,
    );
    const adjustedTeamGoalsFor = Number(
      Math.max(
        0,
        teamGoalsFor *
          (1 + teamStrengthContextAdjustment.teamGoalsForPctAdjustment),
      ).toFixed(3),
    );

    let selectedGoalieId: number | null = null;
    let starterProb = 0.5;
    let starterModelMeta: Record<string, unknown> = {};
    let topStarterScenarios: StarterScenario[] = [];
    if (c.override) {
      selectedGoalieId = c.override.goalieId;
      starterProb = c.override.starterProb;
      topStarterScenarios = [
        {
          goalieId: selectedGoalieId,
          rank: 1,
          rawProbability: starterProb,
          probability: 1,
        },
      ];
      starterModelMeta = buildStarterOverrideMetadata({
        selectedGoalieId,
        starterProb,
        topStarterScenarios,
      });
    } else {
      const starterContext =
        teamGoalieStarterContextCache.get(teamDateKey(c.teamId)) ??
        (await fetchTeamGoalieStarterContext(c.teamId, asOfDate));
      teamGoalieStarterContextCache.set(teamDateKey(c.teamId), starterContext);
      const opponentGoalsForRaw = teamGoalsByTeamId.get(c.opponentTeamId) ?? 0;
      const opponentGoalsFor = Number(
        Math.max(
          0,
          opponentGoalsForRaw *
            (1 + teamStrengthContextAdjustment.opponentGoalsForPctAdjustment),
        ).toFixed(3),
      );
      const teamIsWeaker =
        adjustedTeamGoalsFor + TEAM_STRENGTH_WEAKER_GAP < opponentGoalsFor;
      const opponentIsWeak = opponentGoalsFor <= WEAK_OPPONENT_GF_THRESHOLD;
      const isB2B =
        starterContext.previousGameDate != null &&
        daysBetweenDates(asOfDate, starterContext.previousGameDate) === 1;
      const probs = computeStarterProbabilities({
        asOfDate,
        candidateGoalieIds: c.candidateGoalieIds,
        starterContext,
        priorStartProbByGoalieId: c.priorStartProbByGoalieId,
        lineComboPriorByGoalieId: c.lineComboPriorByGoalieId,
        projectedGsaaPer60ByGoalieId: c.projectedGsaaPer60ByGoalieId,
        seasonStartPctByGoalieId: c.seasonStartPctByGoalieId,
        seasonGamesPlayedByGoalieId: c.seasonGamesPlayedByGoalieId,
        teamGoalsFor: adjustedTeamGoalsFor,
        opponentGoalsFor,
      });
      const ranked = Array.from(probs.entries()).sort((a, b) => b[1] - a[1]);
      topStarterScenarios = buildTopStarterScenarios({
        probabilitiesByGoalieId: probs,
        maxScenarios: 2,
      });
      if (ranked.length > 0) {
        selectedGoalieId = ranked[0][0];
        starterProb = ranked[0][1];
      }
      starterModelMeta = buildStarterHeuristicMetadata({
        asOfDate,
        selectedGoalieId,
        starterProb,
        rankedGoalies: ranked,
        topStarterScenarios,
        starterContext,
        priorMaps: {
          projectedGsaaPer60ByGoalieId: c.projectedGsaaPer60ByGoalieId,
          seasonStartPctByGoalieId: c.seasonStartPctByGoalieId,
          seasonGamesPlayedByGoalieId: c.seasonGamesPlayedByGoalieId,
          lineComboPriorByGoalieId: c.lineComboPriorByGoalieId,
        },
        daysBetweenDates,
        isBackToBack: isB2B,
        teamIsWeaker,
        opponentIsWeak,
        opponentProjectedShotsAgainst,
        teamSaAvg10,
        teamSaAvg5,
        trendAdj,
        teamStrengthContextAdjustment,
        teamFiveOnFiveContextAdjustment,
        nstOpponentDangerAdjustment,
        baseShotsAgainst,
        shotsAgainst,
        opponentContext: {
          opponentIsHome,
          oppShots10,
          oppShots5,
          oppGoals10,
          oppGoals5,
          defendingRestDays,
          opponentRestDays,
        },
        defendingNstExpectedGoalsProfile,
        opponentNstExpectedGoalsProfile,
        defendingFiveOnFiveProfile,
        opponentFiveOnFiveProfile,
        defendingStrengthPrior,
        opponentStrengthPrior,
        teamGoalsFor,
        adjustedTeamGoalsFor,
        opponentGoalsFor,
        contextPct,
        leagueSavePct,
      });
    }

    if (selectedGoalieId == null) continue;
    if (!goalieEvidenceCache.has(playerDateKey(selectedGoalieId))) {
      goalieEvidenceCache.set(
        playerDateKey(selectedGoalieId),
        await fetchGoalieEvidence(selectedGoalieId, asOfDate),
      );
    }
    if (!goalieWorkloadContextCache.has(playerDateKey(selectedGoalieId))) {
      goalieWorkloadContextCache.set(
        playerDateKey(selectedGoalieId),
        await fetchGoalieWorkloadContext(selectedGoalieId, asOfDate),
      );
    }
    if (!goalieRestSplitProfileCache.has(playerDateKey(selectedGoalieId))) {
      goalieRestSplitProfileCache.set(
        playerDateKey(selectedGoalieId),
        await fetchGoalieRestSplitProfile(selectedGoalieId, asOfDate),
      );
    }
    const evidence = goalieEvidenceCache.get(
      playerDateKey(selectedGoalieId),
    ) as GoalieEvidence;
    const workload = goalieWorkloadContextCache.get(
      playerDateKey(selectedGoalieId),
    ) as GoalieWorkloadContext;
    const restSplitProfile =
      goalieRestSplitProfileCache.get(playerDateKey(selectedGoalieId)) ?? null;
    const workloadSavePctPenalty = computeWorkloadSavePctPenalty(workload);
    const restSplitSavePctAdjustment = computeGoalieRestSplitSavePctAdjustment({
      profile: restSplitProfile,
      daysSinceLastStart: workload.daysSinceLastStart,
    });
    const adjustedLeagueSavePct = clamp(
      leagueSavePct - workloadSavePctPenalty + restSplitSavePctAdjustment,
      0.86,
      0.92,
    );
    const goalieModel = computeGoalieProjectionModel({
      projectedShotsAgainst: shotsAgainst,
      starterProbability: starterProb,
      projectedGoalsFor: adjustedTeamGoalsFor,
      evidence,
      leagueSavePct: adjustedLeagueSavePct,
    });
    const selectedGoalieFullStartModel = computeGoalieProjectionModel({
      projectedShotsAgainst: shotsAgainst,
      starterProbability: 1,
      projectedGoalsFor: adjustedTeamGoalsFor,
      evidence,
      leagueSavePct: adjustedLeagueSavePct,
    });

    const scenarioProjections: StarterScenarioProjection[] = [];
    for (const scenario of topStarterScenarios) {
      if (!goalieEvidenceCache.has(playerDateKey(scenario.goalieId))) {
        goalieEvidenceCache.set(
          playerDateKey(scenario.goalieId),
          await fetchGoalieEvidence(scenario.goalieId, asOfDate),
        );
      }
      if (!goalieWorkloadContextCache.has(playerDateKey(scenario.goalieId))) {
        goalieWorkloadContextCache.set(
          playerDateKey(scenario.goalieId),
          await fetchGoalieWorkloadContext(scenario.goalieId, asOfDate),
        );
      }
      if (!goalieRestSplitProfileCache.has(playerDateKey(scenario.goalieId))) {
        goalieRestSplitProfileCache.set(
          playerDateKey(scenario.goalieId),
          await fetchGoalieRestSplitProfile(scenario.goalieId, asOfDate),
        );
      }
      const scenarioEvidence = goalieEvidenceCache.get(
        playerDateKey(scenario.goalieId),
      ) as GoalieEvidence;
      const scenarioWorkload = goalieWorkloadContextCache.get(
        playerDateKey(scenario.goalieId),
      ) as GoalieWorkloadContext;
      const scenarioRestSplitProfile =
        goalieRestSplitProfileCache.get(playerDateKey(scenario.goalieId)) ??
        null;
      const scenarioWorkloadPenalty =
        computeWorkloadSavePctPenalty(scenarioWorkload);
      const scenarioRestSplitAdjustment =
        computeGoalieRestSplitSavePctAdjustment({
          profile: scenarioRestSplitProfile,
          daysSinceLastStart: scenarioWorkload.daysSinceLastStart,
        });
      const scenarioLeagueSavePct = clamp(
        leagueSavePct - scenarioWorkloadPenalty + scenarioRestSplitAdjustment,
        0.86,
        0.92,
      );
      const scenarioModel = computeGoalieProjectionModel({
        projectedShotsAgainst: shotsAgainst,
        starterProbability: 1,
        projectedGoalsFor: adjustedTeamGoalsFor,
        evidence: scenarioEvidence,
        leagueSavePct: scenarioLeagueSavePct,
      });
      scenarioProjections.push({
        goalie_id: scenario.goalieId,
        rank: scenario.rank,
        starter_probability_raw: Number(scenario.rawProbability.toFixed(4)),
        starter_probability_top2_normalized: Number(
          scenario.probability.toFixed(4),
        ),
        proj_shots_against: shotsAgainst,
        proj_saves: Number(scenarioModel.projectedSaves.toFixed(3)),
        proj_goals_allowed: Number(
          scenarioModel.projectedGoalsAllowed.toFixed(3),
        ),
        proj_win_prob: Number(scenarioModel.winProbability.toFixed(4)),
        proj_shutout_prob: Number(scenarioModel.shutoutProbability.toFixed(4)),
        modeled_save_pct: Number(scenarioModel.modeledSavePct.toFixed(4)),
        workload_save_pct_penalty: Number(scenarioWorkloadPenalty.toFixed(4)),
        rest_split_save_pct_adjustment: Number(
          scenarioRestSplitAdjustment.toFixed(4),
        ),
      });
    }
    const blendedProjection = blendTopStarterScenarioOutputs({
      scenarioProjections,
      fallbackProjection: {
        proj_shots_against: shotsAgainst,
        proj_saves: Number(
          selectedGoalieFullStartModel.projectedSaves.toFixed(3),
        ),
        proj_goals_allowed: Number(
          selectedGoalieFullStartModel.projectedGoalsAllowed.toFixed(3),
        ),
        proj_win_prob: Number(
          selectedGoalieFullStartModel.winProbability.toFixed(4),
        ),
        proj_shutout_prob: Number(
          selectedGoalieFullStartModel.shutoutProbability.toFixed(4),
        ),
        modeled_save_pct: Number(
          selectedGoalieFullStartModel.modeledSavePct.toFixed(4),
        ),
        workload_save_pct_penalty: Number(workloadSavePctPenalty.toFixed(4)),
        rest_split_save_pct_adjustment: Number(
          restSplitSavePctAdjustment.toFixed(4),
        ),
      },
    });

    const goalsAllowed = blendedProjection.proj_goals_allowed;
    const saves = blendedProjection.proj_saves;
    const winProb = blendedProjection.proj_win_prob;
    const shutoutProb = blendedProjection.proj_shutout_prob;
    const uncertaintyScenarioMixture = [
      ...scenarioProjections.map((s) => ({
        weight: s.starter_probability_raw,
        shotsAgainst: s.proj_shots_against,
        goalsAllowed: s.proj_goals_allowed,
        saves: s.proj_saves,
      })),
      ...(blendedProjection.residual_probability_mass > 0
        ? [
            {
              weight: blendedProjection.residual_probability_mass,
              shotsAgainst,
              goalsAllowed: Number(
                selectedGoalieFullStartModel.projectedGoalsAllowed.toFixed(3),
              ),
              saves: Number(
                selectedGoalieFullStartModel.projectedSaves.toFixed(3),
              ),
            },
          ]
        : []),
    ];
    starterModelMeta = augmentStarterModelMetaWithScenarioProjections({
      starterModelMeta,
      scenarioProjections,
      blendedProjection,
    });
    const defendingTeamScalars = teamHorizonScalarsCache.get(
      teamDateKey(c.teamId),
    ) ?? [1];
    const opponentTeamScalars = teamHorizonScalarsCache.get(
      teamDateKey(c.opponentTeamId),
    ) ?? [1];
    const goalieHorizonScalars = Array.from(
      { length: horizonGames },
      (_, idx) => {
        const d = defendingTeamScalars[idx] ?? 1;
        const o = opponentTeamScalars[idx] ?? 1;
        return Number(((d + o) / 2).toFixed(4));
      },
    );
    const goalieHorizonTotalScalar = goalieHorizonScalars.reduce(
      (sum, v) => sum + v,
      0,
    );
    const restSplitBucket = toGoalieRestSplitBucket(
      workload.daysSinceLastStart,
    );
    const restSplitBucketGames =
      restSplitProfile?.gamesByBucket?.[restSplitBucket] ?? null;
    const restSplitBucketSavePct =
      restSplitProfile?.savePctByBucket?.[restSplitBucket] ?? null;
    const goalieUncertainty = buildGoalieUncertaintyWithModel({
      baseGoalieUncertainty: buildGoalieUncertainty(
        {
          shotsAgainst,
          goalsAllowed,
          saves,
        },
        horizonGames,
        goalieHorizonScalars,
        uncertaintyScenarioMixture,
      ),
      blendedProjection,
      goalieModel,
      evidence,
      workload,
      workloadSavePctPenalty,
      restSplitBucket,
      restSplitBucketGames,
      restSplitBucketSavePct,
      restSplitSavePctAdjustment,
      restSplitProfile,
      adjustedLeagueSavePct,
      horizonGames,
      goalieHorizonScalars,
      selectedGoalieId,
      starterProb,
      scenarioProjections,
      goalieHorizonTotalScalar,
      shotsAgainst,
      starterModelMeta,
    });

    const goalieUpsert = {
      run_id: runId,
      as_of_date: asOfDate,
      horizon_games: horizonGames,
      game_id: game.id,
      goalie_id: selectedGoalieId,
      team_id: c.teamId,
      opponent_team_id: c.opponentTeamId,
      starter_probability: Number(starterProb.toFixed(4)),
      proj_shots_against: Number(
        (shotsAgainst * goalieHorizonTotalScalar).toFixed(3),
      ),
      proj_goals_allowed: Number(
        (goalsAllowed * goalieHorizonTotalScalar).toFixed(3),
      ),
      proj_saves: Number((saves * goalieHorizonTotalScalar).toFixed(3)),
      proj_win_prob: Number((winProb * goalieHorizonTotalScalar).toFixed(4)),
      proj_shutout_prob: Number(
        (shutoutProb * goalieHorizonTotalScalar).toFixed(4),
      ),
      uncertainty: goalieUncertainty as any,
      updated_at: new Date().toISOString(),
    };

    goalieRowsUpserted += await persistForgeGoalieProjection(goalieUpsert);

    selectedGoalieByTeamId.set(c.teamId, {
      goalieId: selectedGoalieId,
      starterProbability: Number(starterProb.toFixed(4)),
      confirmedStatus:
        c.override != null ||
        c.confirmedStarterByGoalieId.get(selectedGoalieId) === true,
      saves: Number((saves * goalieHorizonTotalScalar).toFixed(3)),
    });

    const goalieMarketSummaryByType =
      playerPropContextByGamePlayerKey.get(`${game.id}:${selectedGoalieId}`) ??
      null;
    if (goalieMarketSummaryByType) {
      for (const [marketType, marketSummary] of Object.entries(
        goalieMarketSummaryByType,
      )) {
        const expectedValue = getProjectionValueForPropMarket({
          marketType,
          projection: {
            shots: 0,
            goals: 0,
            assists: 0,
            powerPlayPoints: 0,
            blockedShots: 0,
            saves: Number((saves * goalieHorizonTotalScalar).toFixed(3)),
          },
        });
        if (expectedValue == null) continue;

        playerPredictionOutputRows.push({
          snapshot_date: asOfDate,
          game_id: game.id,
          player_id: selectedGoalieId,
          team_id: c.teamId,
          opponent_team_id: c.opponentTeamId,
          model_name: ANALYTICS_MODEL_NAME,
          model_version: ANALYTICS_MODEL_VERSION,
          prediction_scope: "pregame",
          metric_key: marketType,
          expected_value: expectedValue,
          floor_value: null,
          ceiling_value: null,
          probability_over: null,
          line_value: getConsensusLineValue(marketSummary),
          components: {
            market_inputs: marketSummary,
            projection_inputs: {
              starter_probability: Number(starterProb.toFixed(4)),
              confirmed_status:
                c.override != null ||
                c.confirmedStarterByGoalieId.get(selectedGoalieId) === true,
            },
          },
          provenance: {
            provider: marketSummary.sourceNames[0] ?? null,
            input_family: "forge-goalie-projection",
          },
          metadata: {
            horizon_games: horizonGames,
            run_id: runId,
          },
        });

        const consensusLineValue = getConsensusLineValue(marketSummary);
        const edgeThreshold = PLAYER_MARKET_EDGE_THRESHOLDS[marketType] ?? 0.25;
        if (consensusLineValue != null) {
          const edgeValue = expectedValue - consensusLineValue;
          if (Math.abs(edgeValue) >= edgeThreshold) {
            modelMarketFlagRows.push(
              buildModelMarketFlagRow({
                asOfDate,
                entityType: "player",
                entityId: selectedGoalieId,
                gameId: game.id,
                marketType,
                flagType: edgeValue > 0 ? "model_over" : "model_under",
                edgeValue,
                reasons: [
                  {
                    expected_value: expectedValue,
                    line_value: consensusLineValue,
                    sportsbook_count: marketSummary.sportsbookKeys.length,
                  },
                ],
                provider: marketSummary.sourceNames[0] ?? null,
                metadata: {
                  horizon_games: horizonGames,
                  run_id: runId,
                },
              }),
            );
          }
        }
      }
    }
  }
  return { timedOut: false, goalieRowsUpserted };
}
