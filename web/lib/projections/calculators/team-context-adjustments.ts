import type {
  TeamFiveOnFiveProfile,
  TeamNstExpectedGoalsProfile,
  TeamStrengthPrior
} from "../types/run-forge-projections.types";
import {
  TEAM_5V5_MAX_CONTEXT_PCT_ADJ,
  TEAM_5V5_MAX_LEAGUE_SAVE_PCT_ADJ,
  TEAM_5V5_MIN_SAMPLE_GAMES,
  TEAM_5V5_PDO_BASELINE,
  TEAM_5V5_SAVE_PCT_BASELINE,
  TEAM_NST_MAX_CONTEXT_PCT_ADJ,
  TEAM_NST_XGA_PER60_BASELINE,
  TEAM_XG_BASELINE_PER_GAME,
  TEAM_XG_SHOTS_AGAINST_MAX_PCT,
  TEAM_XG_WIN_CONTEXT_MAX_PCT
} from "../constants/projection-weights";
import { clamp } from "../utils/number-utils";

function normalizeRateOrPercent(
  value: number | null | undefined
): number | null {
  if (!Number.isFinite(value)) return null;
  const raw = Number(value);
  if (raw < 0) return null;
  if (raw > 2 && raw <= 200) return raw / 100;
  return raw;
}

export function computeTeamStrengthContextAdjustment(args: {
  defendingTeamPrior: TeamStrengthPrior | null;
  opponentTeamPrior: TeamStrengthPrior | null;
}): {
  shotsAgainstPctAdjustment: number;
  teamGoalsForPctAdjustment: number;
  opponentGoalsForPctAdjustment: number;
  sampleWeight: number;
} {
  const defending = args.defendingTeamPrior;
  const opponent = args.opponentTeamPrior;
  if (!defending && !opponent) {
    return {
      shotsAgainstPctAdjustment: 0,
      teamGoalsForPctAdjustment: 0,
      opponentGoalsForPctAdjustment: 0,
      sampleWeight: 0
    };
  }

  const defendingXgaPerGame = defending?.xgaPerGame ?? TEAM_XG_BASELINE_PER_GAME;
  const defendingXgfPerGame = defending?.xgfPerGame ?? TEAM_XG_BASELINE_PER_GAME;
  const opponentXgaPerGame = opponent?.xgaPerGame ?? TEAM_XG_BASELINE_PER_GAME;
  const opponentXgfPerGame = opponent?.xgfPerGame ?? TEAM_XG_BASELINE_PER_GAME;
  const defendingXgaRaw = Math.max(0, defending?.xga ?? 0);
  const opponentXgaRaw = Math.max(0, opponent?.xga ?? 0);
  const sampleWeight = clamp((defendingXgaRaw + opponentXgaRaw) / 280, 0, 1);

  const defenseLiabilityEdge = clamp(
    (defendingXgaPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,
    -0.2,
    0.2
  );
  const opponentOffenseEdge = clamp(
    (opponentXgfPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,
    -0.2,
    0.2
  );
  const teamOffenseEdge = clamp(
    (defendingXgfPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,
    -0.2,
    0.2
  );
  const opponentDefenseEdge = clamp(
    (opponentXgaPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,
    -0.2,
    0.2
  );

  const shotsAgainstPctAdjustment = clamp(
    (defenseLiabilityEdge * 0.32 + opponentOffenseEdge * 0.36) * sampleWeight,
    -TEAM_XG_SHOTS_AGAINST_MAX_PCT,
    TEAM_XG_SHOTS_AGAINST_MAX_PCT
  );
  const teamGoalsForPctAdjustment = clamp(
    (teamOffenseEdge * 0.3 - opponentDefenseEdge * 0.24) * sampleWeight,
    -TEAM_XG_WIN_CONTEXT_MAX_PCT,
    TEAM_XG_WIN_CONTEXT_MAX_PCT
  );
  const opponentGoalsForPctAdjustment = clamp(
    (opponentOffenseEdge * 0.28 + defenseLiabilityEdge * 0.22) * sampleWeight,
    -TEAM_XG_WIN_CONTEXT_MAX_PCT,
    TEAM_XG_WIN_CONTEXT_MAX_PCT
  );

  return {
    shotsAgainstPctAdjustment,
    teamGoalsForPctAdjustment,
    opponentGoalsForPctAdjustment,
    sampleWeight
  };
}

export function computeTeamFiveOnFiveContextAdjustment(args: {
  defendingTeamProfile: TeamFiveOnFiveProfile | null;
  opponentTeamProfile: TeamFiveOnFiveProfile | null;
}): {
  sampleWeight: number;
  leagueSavePctAdjustment: number;
  contextPctAdjustment: number;
} {
  const defending = args.defendingTeamProfile;
  const opponent = args.opponentTeamProfile;
  if (!defending && !opponent) {
    return {
      sampleWeight: 0,
      leagueSavePctAdjustment: 0,
      contextPctAdjustment: 0
    };
  }

  const defendingSavePct =
    normalizeRateOrPercent(defending?.savePct5v5) ?? TEAM_5V5_SAVE_PCT_BASELINE;
  const defendingSpsv =
    normalizeRateOrPercent(defending?.shootingPlusSavePct5v5) ?? TEAM_5V5_PDO_BASELINE;
  const opponentSpsv =
    normalizeRateOrPercent(opponent?.shootingPlusSavePct5v5) ?? TEAM_5V5_PDO_BASELINE;
  const defendingGames = Math.max(0, defending?.gamesPlayed ?? 0);
  const opponentGames = Math.max(0, opponent?.gamesPlayed ?? 0);
  const sampleWeight = clamp(
    (defendingGames + opponentGames) /
      (defendingGames + opponentGames + TEAM_5V5_MIN_SAMPLE_GAMES),
    0,
    1
  );

  const saveEdge = clamp(
    defendingSavePct - TEAM_5V5_SAVE_PCT_BASELINE,
    -0.03,
    0.03
  );
  const defendingPdoEdge = clamp(
    defendingSpsv - TEAM_5V5_PDO_BASELINE,
    -0.08,
    0.08
  );
  const opponentPdoEdge = clamp(
    opponentSpsv - TEAM_5V5_PDO_BASELINE,
    -0.08,
    0.08
  );

  const leagueSavePctAdjustment = clamp(
    (saveEdge * 0.75 + defendingPdoEdge * 0.2) * sampleWeight,
    -TEAM_5V5_MAX_LEAGUE_SAVE_PCT_ADJ,
    TEAM_5V5_MAX_LEAGUE_SAVE_PCT_ADJ
  );
  const contextPctAdjustment = clamp(
    (-saveEdge * 0.45 + opponentPdoEdge * 0.2) * sampleWeight,
    -TEAM_5V5_MAX_CONTEXT_PCT_ADJ,
    TEAM_5V5_MAX_CONTEXT_PCT_ADJ
  );

  return {
    sampleWeight,
    leagueSavePctAdjustment,
    contextPctAdjustment
  };
}

export function computeNstOpponentDangerAdjustment(args: {
  defendingTeamProfile: TeamNstExpectedGoalsProfile | null;
  opponentTeamProfile: TeamNstExpectedGoalsProfile | null;
}): { sampleWeight: number; contextPctAdjustment: number } {
  const defending = args.defendingTeamProfile;
  const opponent = args.opponentTeamProfile;
  if (!defending && !opponent) {
    return { sampleWeight: 0, contextPctAdjustment: 0 };
  }

  const defendingXgaPer60 =
    defending?.xgaPer60 ?? TEAM_NST_XGA_PER60_BASELINE;
  const opponentXgaPer60 = opponent?.xgaPer60 ?? TEAM_NST_XGA_PER60_BASELINE;
  const defendingGames = Math.max(0, defending?.gamesPlayed ?? 0);
  const opponentGames = Math.max(0, opponent?.gamesPlayed ?? 0);
  const sampleWeight = clamp(
    (defendingGames + opponentGames) / (defendingGames + opponentGames + 30),
    0,
    1
  );

  const defendingDangerEdge = clamp(
    (defendingXgaPer60 - TEAM_NST_XGA_PER60_BASELINE) /
      TEAM_NST_XGA_PER60_BASELINE,
    -0.25,
    0.25
  );
  const paceProxyEdge = clamp(
    (opponentXgaPer60 - TEAM_NST_XGA_PER60_BASELINE) /
      TEAM_NST_XGA_PER60_BASELINE,
    -0.2,
    0.2
  );

  const contextPctAdjustment = clamp(
    (defendingDangerEdge * 0.32 + paceProxyEdge * 0.12) * sampleWeight,
    -TEAM_NST_MAX_CONTEXT_PCT_ADJ,
    TEAM_NST_MAX_CONTEXT_PCT_ADJ
  );

  return {
    sampleWeight,
    contextPctAdjustment
  };
}
