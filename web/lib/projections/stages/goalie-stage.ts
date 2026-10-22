import { starterBoardFlags } from "../starterBoardFlags";
import { goalieConfirmationFromEvidence } from "../starterBoardScoring";
import type { DailyBoardEvidence } from "../dailyBoardEvidence";
import { bootstrapGoalieLine, loadSeasonBootstrap, type SeasonBootstrap } from "../seasonBootstrap";
import { buildGoalieUncertainty } from "../uncertainty";
import {
  computeGoalieProjectionModel,
  computeModeledSavePct,
  type GoalieEvidence,
} from "../goalieModel";
import {
  GOALIE_CONTEXT_SAVE_PCT_PASS_THROUGH,
  goalieConditionalWinProbability,
  goalieRestSavePctAdjustment,
  goalieWinPopulations,
  marketTeamWinProbability,
  STARTER_DECISION_SHARE,
  teamWinProbability,
} from "../goalie/goalieOutcomes";
import { getSeasonLeagueSavePct, type SeasonLeagueSavePctCache } from "../goalie/leagueSavePct";
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
  buildModelMarketProbabilityFlagRow,
  compareModelWithMarket,
  forgePropOverProbability,
  getConsensusLineValue,
  getProjectionValueForPropMarket,
  quotesFromMarketSummary,
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
  seasonBootstrap?: boolean;
  dailyBoardEvidence?: DailyBoardEvidence;
  evidenceCutoffAt?: string | null;
  asOfDate: string;
  runId: string;
  horizonGames: number;
  game: GameRow;
  deadlineMs: number;
  goalieCandidates: GoalieStageCandidate[];
  /** This game's market summaries (h2h moneyline -> de-vigged team win probability when present). */
  gameMarketSummary?: Record<string, MarketTypeSummary>;
  /** The run's league save % cache (one per run, so each run records its own read). */
  leagueSavePctCache: SeasonLeagueSavePctCache;
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
  const seasonYear = Math.floor(game.id / 1_000_000);
  const bootstrap = args.seasonBootstrap ? await loadSeasonBootstrap(
    [...new Set(goalieCandidates.flatMap((candidate) => candidate.candidateGoalieIds))],
    seasonYear * 10000 + seasonYear + 1, asOfDate, "goalie", false) : new Map<number, SeasonBootstrap>();
  const seasonLeague = await getSeasonLeagueSavePct(asOfDate, args.leagueSavePctCache);
  if (seasonLeague.warning) metrics.warnings.push(seasonLeague.warning);
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
    const teamGoalsFor = teamGoalsByTeamId.get(c.teamId) ?? null;
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
    // Beta prior mean = season-current league save %; the legacy game-context shift (formerly
    // folded into a 0.9 "league" mean) is applied additively at its legacy effective weight.
    const leagueSavePct = seasonLeague.savePct;
    const contextSavePctShift = clamp(
      -contextPct * 0.04 + teamFiveOnFiveContextAdjustment.leagueSavePctAdjustment,
      -0.02,
      0.02,
    );
    // Paired per game: both teams read the same two expected-goal values (or the same de-vigged
    // moneyline), so P(home wins) + P(away wins) = 1.
    const lambdaFor = teamGoalsByTeamId.get(c.teamId) ?? null;
    const lambdaAgainst = teamGoalsByTeamId.get(c.opponentTeamId) ?? null;
    const lambdasAvailable = lambdaFor !== null && lambdaAgainst !== null;
    const marketTeamWinProb = marketTeamWinProbability(
      args.gameMarketSummary?.h2h, defendingTeamAbbrev, opponentTeamAbbrev,
    );
    const teamWinProb = marketTeamWinProb ?? (lambdasAvailable ? teamWinProbability(lambdaFor, lambdaAgainst) : null);
    const teamWinSource = marketTeamWinProb !== null ? "moneyline_devig_proportional"
      : teamWinProb !== null ? "poisson_race" : null;
    const adjustedTeamGoalsFor = teamGoalsFor === null ? null : Number(
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
    let boardStarterProbabilities = new Map<number, number>();
    if (c.override) {
      boardStarterProbabilities = new Map(c.candidateGoalieIds.map((id) => [id, id === c.override!.goalieId ? c.override!.starterProb : 0]));
      boardStarterProbabilities.set(c.override.goalieId, c.override.starterProb);
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
      const opponentGoalsForRaw = teamGoalsByTeamId.get(c.opponentTeamId) ?? null;
      const opponentGoalsFor = opponentGoalsForRaw === null ? null : Number(
        Math.max(
          0,
          opponentGoalsForRaw *
            (1 + teamStrengthContextAdjustment.opponentGoalsForPctAdjustment),
        ).toFixed(3),
      );
      const teamIsWeaker = adjustedTeamGoalsFor === null || opponentGoalsFor === null ? null
        : adjustedTeamGoalsFor + TEAM_STRENGTH_WEAKER_GAP < opponentGoalsFor;
      const opponentIsWeak = opponentGoalsFor === null ? null : opponentGoalsFor <= WEAK_OPPONENT_GF_THRESHOLD;
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
      boardStarterProbabilities = probs;
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
    // A probability or legacy boolean is not a source assertion. Reuse the consumer's exact scope/time validator.
    const confirmationFor = (playerId: number) => horizonGames === 1
      ? goalieConfirmationFromEvidence(args.dailyBoardEvidence, {
          gameId: game.id, teamId: c.teamId, playerId, cutoffAt: args.evidenceCutoffAt ?? null,
        }) : [];
    const selectedConfirmation = confirmationFor(selectedGoalieId);
    const confirmedStatus = selectedConfirmation.length > 0;
    // One candidate's evidence (cached) and save % inputs: fitted additive B2B/workload terms, with
    // the rest-split and game-context shifts at their legacy effective weight.
    const loadGoalieInputs = async (goalieId: number) => {
      const key = playerDateKey(goalieId);
      if (!goalieEvidenceCache.has(key)) {
        goalieEvidenceCache.set(key, await fetchGoalieEvidence(goalieId, asOfDate));
      }
      if (!goalieWorkloadContextCache.has(key)) {
        goalieWorkloadContextCache.set(key, await fetchGoalieWorkloadContext(goalieId, asOfDate));
      }
      if (!goalieRestSplitProfileCache.has(key)) {
        goalieRestSplitProfileCache.set(key, await fetchGoalieRestSplitProfile(goalieId, asOfDate));
      }
      const goalieEvidence = goalieEvidenceCache.get(key) as GoalieEvidence;
      const goalieWorkload = goalieWorkloadContextCache.get(key) as GoalieWorkloadContext;
      const goalieRestSplitProfile = goalieRestSplitProfileCache.get(key) ?? null;
      const restAdjustment = goalieRestSavePctAdjustment(goalieWorkload);
      const restSplitAdjustment = computeGoalieRestSplitSavePctAdjustment({
        profile: goalieRestSplitProfile,
        daysSinceLastStart: goalieWorkload.daysSinceLastStart,
      });
      const savePctAdjustment = restAdjustment +
        GOALIE_CONTEXT_SAVE_PCT_PASS_THROUGH * (contextSavePctShift + restSplitAdjustment);
      return {
        evidence: goalieEvidence,
        workload: goalieWorkload,
        restSplitProfile: goalieRestSplitProfile,
        workloadPenalty: -restAdjustment,
        restSplitAdjustment,
        savePctAdjustment,
        modeledSavePct: computeModeledSavePct({ evidence: goalieEvidence, leagueSavePct, savePctAdjustment }),
      };
    };
    const selectedInputs = await loadGoalieInputs(selectedGoalieId);
    const { evidence, workload, restSplitProfile } = selectedInputs;
    const workloadSavePctPenalty = selectedInputs.workloadPenalty;
    const restSplitSavePctAdjustment = selectedInputs.restSplitAdjustment;
    const adjustedLeagueSavePct = leagueSavePct;

    const scenarioProjections: StarterScenarioProjection[] = [];
    const dailyBoardCandidates: Array<Record<string, unknown>> = [];
    const computationScenarios = starterBoardFlags().compute
      ? [...boardStarterProbabilities.entries()].map(([goalieId, probability], index) => ({ goalieId, probability, rawProbability: probability, rank: index + 1 }))
      : topStarterScenarios;
    const scenarioInputs = new Map<number, Awaited<ReturnType<typeof loadGoalieInputs>>>();
    for (const scenario of computationScenarios) {
      scenarioInputs.set(scenario.goalieId, await loadGoalieInputs(scenario.goalieId));
    }
    // The team's start-weighted goals per shot is the reference for each goalie's win adjustment.
    let startWeight = 0;
    let weightedGoalsPerShot = 0;
    for (const scenario of computationScenarios) {
      const weight = Math.max(0, scenario.probability);
      startWeight += weight;
      weightedGoalsPerShot += weight * (1 - (scenarioInputs.get(scenario.goalieId)?.modeledSavePct ?? 0));
    }
    const teamGoalsPerShot = startWeight > 0
      ? weightedGoalsPerShot / startWeight
      : 1 - selectedInputs.modeledSavePct;
    const winIfStarts = (modeledSavePct: number) => {
      if (teamWinProb === null) return null;
      if (lambdaFor === null || lambdaAgainst === null || teamGoalsPerShot <= 0) return teamWinProb;
      return goalieConditionalWinProbability({
        teamWinProbability: teamWinProb,
        lambdaFor,
        lambdaAgainst,
        goalsAgainstRatio: (1 - modeledSavePct) / teamGoalsPerShot,
      });
    };
    const goalieModel = computeGoalieProjectionModel({
      projectedShotsAgainst: shotsAgainst,
      starterProbability: starterProb,
      projectedGoalsFor: adjustedTeamGoalsFor,
      evidence,
      leagueSavePct,
      savePctAdjustment: selectedInputs.savePctAdjustment,
      teamWinProbabilityIfStarts: winIfStarts(selectedInputs.modeledSavePct),
    });
    const selectedGoalieFullStartModel = computeGoalieProjectionModel({
      projectedShotsAgainst: shotsAgainst,
      starterProbability: 1,
      projectedGoalsFor: adjustedTeamGoalsFor,
      evidence,
      leagueSavePct,
      savePctAdjustment: selectedInputs.savePctAdjustment,
      teamWinProbabilityIfStarts: winIfStarts(selectedInputs.modeledSavePct),
    });

    for (const scenario of computationScenarios) {
      const inputs = scenarioInputs.get(scenario.goalieId)!;
      const scenarioWorkloadPenalty = inputs.workloadPenalty;
      const scenarioRestSplitAdjustment = inputs.restSplitAdjustment;
      const scenarioModel = computeGoalieProjectionModel({
        projectedShotsAgainst: shotsAgainst,
        starterProbability: 1,
        projectedGoalsFor: adjustedTeamGoalsFor,
        evidence: inputs.evidence,
        leagueSavePct,
        savePctAdjustment: inputs.savePctAdjustment,
        teamWinProbabilityIfStarts: winIfStarts(inputs.modeledSavePct),
      });
      const organicConditional = { SHOTS_AGAINST_GOALIE: shotsAgainst, SAVES_GOALIE: scenarioModel.projectedSaves,
        GOALS_AGAINST_GOALIE: scenarioModel.projectedGoalsAllowed,
        WINS_GOALIE: scenarioModel.winProbability, SHUTOUTS_GOALIE: scenarioModel.shutoutProbability };
      const seasonPrior = bootstrap.get(scenario.goalieId);
      const seasonForecast = seasonPrior ? bootstrapGoalieLine(organicConditional, seasonPrior) : null;
      if (starterBoardFlags().compute) {
        const confirmation = confirmationFor(scenario.goalieId);
        dailyBoardCandidates.push({
          gameId: game.id, teamId: c.teamId, horizonGames,
          playerId: scenario.goalieId, startingProbability: scenario.rawProbability,
          probabilityStatus: confirmation.length ? "confirmed_evidence" : "uncalibrated_model",
          evidenceCutoffAt: args.evidenceCutoffAt ?? null,
          confirmationEvidenceIds: confirmation.map(item => item.evidenceId).sort(),
          nonStartAssumption: "zero_relief_minutes",
          conditional: { ...(seasonForecast?.stats ?? organicConditional),
            ...(scenarioModel.winProbability === null ? { WINS_GOALIE: null } : {}) },
          seasonBootstrap: seasonForecast?.disclosure ?? null,
        });
      }
      const legacyScenario = topStarterScenarios.find((item) => item.goalieId === scenario.goalieId);
      if (legacyScenario) scenarioProjections.push({
        goalie_id: scenario.goalieId,
        rank: scenario.rank,
        starter_probability_raw: Number(scenario.rawProbability.toFixed(4)),
        starter_probability_top2_normalized: Number(
          legacyScenario.probability.toFixed(4),
        ),
        proj_shots_against: shotsAgainst,
        proj_saves: Number(scenarioModel.projectedSaves.toFixed(3)),
        proj_goals_allowed: Number(
          scenarioModel.projectedGoalsAllowed.toFixed(3),
        ),
        proj_win_prob: scenarioModel.winProbability === null ? null : Number(scenarioModel.winProbability.toFixed(4)),
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
        proj_win_prob: selectedGoalieFullStartModel.winProbability === null ? null : Number(
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
        { negativeBinomial: true, position: "G" },
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

    // Keep the two win populations apart (Codex review 7.2). proj_win_prob is unchanged: it is the
    // team's goalie slot, sum over starters of P(start) x P(team wins | starts) x decision share.
    const winPopulations = teamWinProb === null ? null : goalieWinPopulations(
      [...boardStarterProbabilities.entries()].map(([goalieId, startProbability]) => {
        const inputs = scenarioInputs.get(goalieId);
        return { goalieId, startProbability, teamWinIfStarts: inputs ? winIfStarts(inputs.modeledSavePct)! : teamWinProb };
      }),
    );
    const winPopulationsMeta = {
      team: {
        population: "team_game",
        denominator: "games",
        win_probability: teamWinProb === null ? null : Number(teamWinProb.toFixed(4)),
        source: teamWinSource,
        paired_with_opponent: "sums_to_1",
      },
      goalies: (winPopulations?.goalies ?? []).map((g) => ({
        goalie_id: g.goalieId,
        start_probability: Number(g.startProbability.toFixed(4)),
        team_win_if_starts: Number(g.teamWinIfStarts.toFixed(4)),
        credited_win_if_starts: Number(g.creditedWinIfStarts.toFixed(4)),
        starter_win: Number(g.starterWin.toFixed(4)),
        relief_win: Number(g.reliefWin.toFixed(4)),
        unconditional_win: Number(g.unconditionalWin.toFixed(4)),
      })),
      goalie_population: "candidate_goalie_game",
      goalie_denominators: { credited_win_if_starts: "starts", unconditional_win: "candidate_games" },
      decision_share: STARTER_DECISION_SHARE,
      start_probability_mass: winPopulations ? Number(winPopulations.startProbabilityMass.toFixed(4)) : null,
      values_per: "single_game",
      proj_win_prob_population: "team_goalie_slot_credited_starter_win",
    };

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
      proj_win_prob: winProb === null ? null : Number((winProb * goalieHorizonTotalScalar).toFixed(4)),
      proj_shutout_prob: Number(
        (shutoutProb * goalieHorizonTotalScalar).toFixed(4),
      ),
      uncertainty: { ...goalieUncertainty, daily_board_candidates: dailyBoardCandidates, win_populations: winPopulationsMeta } as any,
      updated_at: new Date().toISOString(),
    };

    goalieRowsUpserted += await persistForgeGoalieProjection(goalieUpsert);

    selectedGoalieByTeamId.set(c.teamId, {
      goalieId: selectedGoalieId,
      starterProbability: Number(starterProb.toFixed(4)),
      confirmedStatus,
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
              confirmed_status: confirmedStatus,
              confirmation_evidence_ids: selectedConfirmation.map(item => item.evidenceId).sort(),
              confirmation_evidence_cutoff_at: args.evidenceCutoffAt ?? null,
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

        const comparison = compareModelWithMarket({
          marketType,
          expectedValue,
          quotes: quotesFromMarketSummary(marketSummary),
          overProbability: forgePropOverProbability("G"),
        });
        if (comparison) {
          const outputRow = playerPredictionOutputRows[playerPredictionOutputRows.length - 1];
          outputRow.probability_over = Number(comparison.model.over.toFixed(4));
          const flagRow = buildModelMarketProbabilityFlagRow({
            asOfDate,
            entityType: "player",
            entityId: selectedGoalieId,
            gameId: game.id,
            comparison,
            provider: marketSummary.sourceNames[0] ?? null,
            metadata: { horizon_games: horizonGames, run_id: runId },
          });
          if (flagRow) modelMarketFlagRows.push(flagRow);
        }
      }
    }
  }
  return { timedOut: false, goalieRowsUpserted };
}
