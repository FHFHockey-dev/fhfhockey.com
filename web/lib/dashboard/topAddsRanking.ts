import { DEFAULT_SKATER_FANTASY_POINTS } from "lib/projectionsConfig/fantasyPointsConfig";

export type TopAddsMode = "tonight" | "week";

export type TopAddsCandidateInput = {
  playerId: number;
  name: string;
  team: string | null;
  teamAbbr: string | null;
  position: string | null;
  headshot: string | null;
  /** Yahoo ownership %; null when unknown (never 0%). */
  ownership: number | null;
  ownershipTimeline: Array<{ date: string; value: number }>;
  delta: number;
  /** One-game (per-game) projection heads; null when withheld or missing. */
  goals: number | null;
  assists: number | null;
  projectionPts: number | null;
  ppp: number | null;
  sog: number | null;
  hit: number | null;
  blk: number | null;
  uncertainty: number | null;
  degradedProjectionContext?: {
    usedLineComboFallback: boolean;
    lineComboFallbackReason: "missing" | "hard_stale" | "empty" | null;
    lineComboRecencyClass:
      | "FRESH"
      | "SOFT_STALE"
      | "HARD_STALE"
      | "MISSING"
      | null;
    lineComboDaysStale: number | null;
    skaterPoolRecoveryPath: string | null;
    isDegraded: boolean;
    summary: string | null;
  } | null;
  confidenceDrivers?: {
    role: { evenStrength: string | null; unitTier: string | null };
    powerPlay: { allocatedShare: number | null };
    matchup: {
      opponentGoalieGoalRateMultiplier: number | null;
      opponentStarterCertainty: number | null;
    };
    rest: { teamRestDays: number | null; opponentRestDays: number | null };
  } | null;
  scheduleGamesRemaining: number | null;
  scheduleOffNightsRemaining: number | null;
  scheduleLabel: string | null;
};

/** FHFH default skater scoring (decision 54 label), per projected game. */
const TOP_ADDS_SCORING = {
  goals: DEFAULT_SKATER_FANTASY_POINTS.GOALS ?? 0,
  assists: DEFAULT_SKATER_FANTASY_POINTS.ASSISTS ?? 0,
  ppp: DEFAULT_SKATER_FANTASY_POINTS.PP_POINTS ?? 0,
  sog: DEFAULT_SKATER_FANTASY_POINTS.SHOTS_ON_GOAL ?? 0,
  hit: DEFAULT_SKATER_FANTASY_POINTS.HITS ?? 0,
  blk: DEFAULT_SKATER_FANTASY_POINTS.BLOCKED_SHOTS ?? 0,
} as const;

export const TOP_ADDS_SCORING_LABEL = "FHFH default points";

export type TopAddsScoreBreakdown = {
  /** Incomplete rows lack a projection head or the week's games left. */
  status: "complete" | "incomplete";
  missing: string[];
  /** Expected FHFH points per projected game. */
  perGamePoints: number | null;
  /** Games counted: 1 tonight; games actually left this week in week mode. */
  games: number | null;
  /** Expected FHFH points over those games (decision 118); null if incomplete. */
  total: number | null;
};

export type RankedTopAddsCandidate = TopAddsCandidateInput & {
  score: TopAddsScoreBreakdown;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The volatility index FORGE publishes in `uncertainty.model.skater_selection
 * .role_continuity`, or a plain number. Objects never reach arithmetic (the
 * NaN defect, W3-2 D3).
 */
export function extractTopAddsUncertainty(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value || typeof value !== "object") return null;
  const model = (value as Record<string, unknown>).model;
  if (!model || typeof model !== "object") return null;
  const selection = (model as Record<string, unknown>).skater_selection;
  if (!selection || typeof selection !== "object") return null;
  const continuity = (selection as Record<string, unknown>).role_continuity;
  if (!continuity || typeof continuity !== "object") return null;
  const volatility = (continuity as Record<string, unknown>).volatility_index;
  return typeof volatility === "number" && Number.isFinite(volatility)
    ? volatility
    : null;
}

const finiteOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * Typed adapter from a `/api/v1/forge/players` row to the scorer's projection
 * fields. Missing heads stay null all the way to the score (W3-2 D3).
 */
export function toTopAddsProjection(row: {
  g?: unknown;
  a?: unknown;
  pts?: unknown;
  ppp?: unknown;
  sog?: unknown;
  hit?: unknown;
  blk?: unknown;
  uncertainty?: unknown;
}): Pick<
  TopAddsCandidateInput,
  "goals" | "assists" | "projectionPts" | "ppp" | "sog" | "hit" | "blk" | "uncertainty"
> {
  return {
    goals: finiteOrNull(row.g),
    assists: finiteOrNull(row.a),
    projectionPts: finiteOrNull(row.pts),
    ppp: finiteOrNull(row.ppp),
    sog: finiteOrNull(row.sog),
    hit: finiteOrNull(row.hit),
    blk: finiteOrNull(row.blk),
    uncertainty: extractTopAddsUncertainty(row.uncertainty),
  };
}

/**
 * Decision 118: expected FHFH points over the games actually left (one game
 * tonight; the schedule's games left this week). Demand (ownership change),
 * ownership and uncertainty are shown as their own columns, not mixed in. A
 * missing head or unknown schedule gives a typed incomplete score.
 */
export function scoreTopAddsCandidate(
  candidate: TopAddsCandidateInput,
  mode: TopAddsMode,
): TopAddsScoreBreakdown {
  const heads = {
    goals: candidate.goals,
    assists: candidate.assists,
    ppp: candidate.ppp,
    sog: candidate.sog,
    hit: candidate.hit,
    blk: candidate.blk,
  };
  const missing = (Object.keys(heads) as Array<keyof typeof heads>).filter(
    (key) => heads[key] == null || !Number.isFinite(heads[key] as number),
  ) as string[];
  const perGamePoints = missing.length
    ? null
    : (Object.keys(heads) as Array<keyof typeof heads>).reduce(
        (sum, key) => sum + (heads[key] as number) * TOP_ADDS_SCORING[key],
        0,
      );
  const games =
    mode === "tonight"
      ? 1
      : finiteOrNull(candidate.scheduleGamesRemaining);
  if (games == null) missing.push("schedule");
  const total =
    perGamePoints == null || games == null ? null : perGamePoints * games;

  return {
    status: total == null ? "incomplete" : "complete",
    missing,
    perGamePoints: perGamePoints == null ? null : round2(perGamePoints),
    games,
    total: total == null ? null : round2(total),
  };
}

/**
 * Complete rows first by expected points, then demand, lower known ownership
 * and player id; incomplete rows follow, never ranked above a complete one.
 * The order does not depend on input order (rule 20).
 */
export function rankTopAddsCandidates(
  candidates: TopAddsCandidateInput[],
  mode: TopAddsMode,
): RankedTopAddsCandidate[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreTopAddsCandidate(candidate, mode),
    }))
    .sort((a, b) => {
      const aComplete = a.score.total != null;
      const bComplete = b.score.total != null;
      if (aComplete !== bComplete) return aComplete ? -1 : 1;
      if (aComplete && bComplete && b.score.total !== a.score.total) {
        return (b.score.total as number) - (a.score.total as number);
      }
      if (b.delta !== a.delta) return b.delta - a.delta;
      if (a.ownership !== b.ownership) {
        if (a.ownership == null) return 1;
        if (b.ownership == null) return -1;
        return a.ownership - b.ownership;
      }
      return a.playerId - b.playerId;
    });
}
