export type TopAddsMode = "tonight" | "week";

export type TopAddsCandidateInput = {
  playerId: number;
  name: string;
  team: string | null;
  teamAbbr: string | null;
  position: string | null;
  headshot: string | null;
  ownership: number;
  ownershipTimeline: Array<{ date: string; value: number }>;
  delta: number;
  projectionPts: number;
  ppp: number;
  sog: number;
  hit: number;
  blk: number;
  uncertainty: number | null;
  scheduleGamesRemaining: number | null;
  scheduleOffNightsRemaining: number | null;
  scheduleLabel: string | null;
};

export type TopAddsScoreBreakdown = {
  trendStrengthScore: number;
  ownershipBiasScore: number;
  projectionSupportScore: number;
  scheduleContextScore: number;
  riskPenaltyScore: number;
  total: number;
};

export type RankedTopAddsCandidate = TopAddsCandidateInput & {
  score: TopAddsScoreBreakdown;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function scoreTopAddsCandidate(
  candidate: TopAddsCandidateInput,
  mode: TopAddsMode
): TopAddsScoreBreakdown {
  const trendStrengthScore = candidate.delta * 5;
  const ownershipBiasScore = ((100 - candidate.ownership) / 100) * 8;
  const projectionSupportScore =
    candidate.projectionPts * 2.25 +
    candidate.ppp * 0.85 +
    candidate.sog * 0.35 +
    (candidate.hit + candidate.blk) * 0.12;
  const scheduleContextScore =
    mode === "week"
      ? (candidate.scheduleGamesRemaining ?? 0) * 1.5 +
        (candidate.scheduleOffNightsRemaining ?? 0) * 1.25
      : 0;
  const riskPenaltyScore = (candidate.uncertainty ?? 0) * 1.5;
  const total =
    trendStrengthScore +
    ownershipBiasScore +
    projectionSupportScore +
    scheduleContextScore -
    riskPenaltyScore;

  return {
    trendStrengthScore: round2(trendStrengthScore),
    ownershipBiasScore: round2(ownershipBiasScore),
    projectionSupportScore: round2(projectionSupportScore),
    scheduleContextScore: round2(scheduleContextScore),
    riskPenaltyScore: round2(riskPenaltyScore),
    total: round2(total)
  };
}

export function rankTopAddsCandidates(
  candidates: TopAddsCandidateInput[],
  mode: TopAddsMode
): RankedTopAddsCandidate[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreTopAddsCandidate(candidate, mode)
    }))
    .sort((a, b) => {
      if (b.score.total !== a.score.total) {
        return b.score.total - a.score.total;
      }
      if (b.delta !== a.delta) {
        return b.delta - a.delta;
      }
      if (a.ownership !== b.ownership) {
        return a.ownership - b.ownership;
      }
      return b.projectionPts - a.projectionPts;
    });
}
