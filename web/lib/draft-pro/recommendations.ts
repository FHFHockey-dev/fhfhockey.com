import {
  calculateCategoryScores,
  isGoalieCategory,
  type CategoryScorePlayer,
} from "lib/scoring/categoryScores";

export type RecommendationLeagueType = "points" | "categories";

export type RecommendationCandidate = {
  id: string;
  name: string;
  role: "skater" | "goalie";
  eligiblePositions: string[];
  /** Global league value. This is displayed, never personalized or mutated. */
  globalVorp: number;
  /** The existing draft rank value (normally VBD). */
  rankValue: number;
  baselineScore?: number;
  tieBreaker?: number;
  categoryValues?: Record<string, number | null | undefined>;
  adp?: number | null;
};

export type RecommendationOptions = {
  leagueType: RecommendationLeagueType;
  positionNeeds?: Record<string, number>;
  categoryNeeds?: Record<string, number>;
  categoryWeights?: Record<string, number>;
  needAlpha?: number;
  currentPick?: number;
  teamCount?: number;
  limit?: number;
};

export type RecommendationResult = {
  candidate: RecommendationCandidate;
  rankScore: number;
  recommendationScore: number;
  globalVorp: number;
  availabilityEstimate: number | null;
  reasons: string[];
  missingCategories: string[];
};

export type RecommendationPreferences = {
  prioritizeRosterNeeds: boolean;
  personalizeReplacement: boolean;
};

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * The one availability model used by personalized recommendations. It is an
 * ADP-based estimate only; it intentionally does not claim to predict a live
 * room's behavior.
 */
export function estimateAvailability(
  adp: number | null | undefined,
  currentPick: number | undefined,
  teamCount: number | undefined,
) {
  if (!finite(adp) || adp <= 0 || !finite(currentPick) || !finite(teamCount) || teamCount <= 0) {
    return null;
  }
  const nextPick = currentPick + teamCount;
  const logistic = 1 / (1 + Math.exp(-(adp - nextPick) / 12));
  return Math.min(0.99, Math.max(0.01, logistic));
}

export function enabledCategoryWeights(weights: Record<string, number> = {}) {
  return Object.fromEntries(
    Object.entries(weights).filter(([, weight]) => finite(weight) && weight !== 0),
  );
}

/** Keeps pre-Pro dashboard toggles usable when a saved draft adds Pro preferences. */
export function normalizeRecommendationPreferences(value: unknown): RecommendationPreferences {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    prioritizeRosterNeeds: typeof record.prioritizeRosterNeeds === "boolean" ? record.prioritizeRosterNeeds : record.needWeightEnabled === true,
    personalizeReplacement: record.personalizeReplacement === true,
  };
}

function categoryValuesFor(candidate: RecommendationCandidate) {
  const values = { ...(candidate.categoryValues ?? {}) };
  if (!finite(values.SHOTS_AGAINST_GOALIE)) {
    const saves = values.SAVES_GOALIE;
    const goalsAgainst = values.GOALS_AGAINST_GOALIE;
    if (finite(saves) && finite(goalsAgainst)) values.SHOTS_AGAINST_GOALIE = saves + goalsAgainst;
  }
  const shotsAgainst = values.SHOTS_AGAINST_GOALIE;
  if (!finite(values.SAVES_GOALIE) || !finite(shotsAgainst) || shotsAgainst <= 0) delete values.SAVE_PERCENTAGE;
  if (!finite(values.SAVE_PERCENTAGE)) {
    const saves = values.SAVES_GOALIE;
    const shotsAgainst = values.SHOTS_AGAINST_GOALIE;
    if (finite(saves) && finite(shotsAgainst) && shotsAgainst > 0) {
      values.SAVE_PERCENTAGE = saves / shotsAgainst;
    }
  }
  const goalieStarts = values.GAMES_STARTED;
  const toiPerGame = values.TIME_ON_ICE_PER_GAME;
  if (!finite(values.GOALS_AGAINST_GOALIE) || !finite(goalieStarts) || goalieStarts <= 0 || !finite(toiPerGame) || toiPerGame <= 0) {
    delete values.GOALS_AGAINST_AVERAGE;
  } else {
    values.GOALS_AGAINST_AVERAGE = values.GOALS_AGAINST_GOALIE * 3600 / (goalieStarts * toiPerGame);
  }
  return values;
}

function fitForPosition(candidate: RecommendationCandidate, needs: Record<string, number>) {
  const values = candidate.eligiblePositions
    .map((position) => needs[position])
    .filter(finite)
    .map(clamp01);
  return values.length ? Math.max(...values) : 0;
}

function categoryFit(
  candidate: RecommendationCandidate,
  categoryScoresByKey: Record<string, Map<string, number>>,
  categoryNeeds: Record<string, number>,
  weights: Record<string, number>,
) {
  const enabled = Object.keys(weights);
  const values = categoryValuesFor(candidate);
  const missing = enabled.filter((key) =>
    (candidate.role === "goalie" ? isGoalieCategory(key) : !isGoalieCategory(key)) && !finite(values[key]),
  );
  if (!enabled.length) return { fit: 0, missing };
  const totalNeed = enabled.reduce((sum, key) => {
    const need = categoryNeeds[key];
    return sum + (finite(need) ? Math.abs(need) * Math.abs(weights[key]) : 0);
  }, 0);
  if (totalNeed === 0) return { fit: 0, missing };

  // categoryScores already applies lower-is-better direction. Callers provide
  // normalized pressure where a positive value always means "help this team";
  // missing categories contribute no fit.
  const directionalNeed = enabled.reduce((sum, key) => {
    const need = categoryNeeds[key];
    if (!finite(need) || missing.includes(key)) return sum;
    return sum + (categoryScoresByKey[key]?.get(candidate.id) ?? 0) * need;
  }, 0) / totalNeed;
  return { fit: directionalNeed, missing };
}

/**
 * Builds suggestion-only personalized ranks. `globalVorp` and `rankScore`
 * remain the league-wide values so tables can continue to present raw VORP.
 */
export function buildPersonalizedRecommendations(
  candidates: RecommendationCandidate[],
  options: RecommendationOptions,
): RecommendationResult[] {
  const alpha = clamp01(options.needAlpha ?? 0.5);
  const categoryWeights = enabledCategoryWeights(options.categoryWeights);
  const categoryPlayers: CategoryScorePlayer[] = candidates.map((candidate) => ({
    id: candidate.id,
    role: candidate.role,
    values: categoryValuesFor(candidate),
  }));
  const categoryScoresByKey = options.leagueType === "categories"
    ? Object.fromEntries(Object.keys(categoryWeights).map((key) => [
      key,
      calculateCategoryScores(categoryPlayers, { [key]: categoryWeights[key] }),
    ]))
    : {};
  const rawFits = candidates.map((candidate) => options.leagueType === "categories"
    ? (() => { const category = categoryFit(candidate, categoryScoresByKey, options.categoryNeeds ?? {}, categoryWeights); return { ...category, fit: category.fit + fitForPosition(candidate, options.positionNeeds ?? {}) }; })()
    : { fit: fitForPosition(candidate, options.positionNeeds ?? {}), missing: [] as string[] });
  const maxFit = Math.max(1, ...rawFits.map(({ fit }) => Math.abs(fit)));
  const adjustmentScale = Math.max(1, ...candidates.map((candidate) => Math.abs(candidate.baselineScore ?? candidate.rankValue)));

  return candidates.map((candidate, index) => {
    const { fit, missing } = rawFits[index];
    const normalizedFit = clamp01(fit / maxFit);
    const rankScore = finite(candidate.baselineScore) ? candidate.baselineScore : (finite(candidate.rankValue) ? candidate.rankValue : 0);
    const recommendationScore = rankScore + alpha * normalizedFit * adjustmentScale;
    const reasons = [alpha > 0 ? "Personalized recommendation" : "Standard recommendation", `Rank ${rankScore.toFixed(1)}`];
    if (normalizedFit > 0) reasons.push(`${options.leagueType === "categories" ? "Category" : "Roster"} need ${Math.round(normalizedFit * 100)}%`);
    if (missing.length) reasons.push(`Missing analysis: ${missing.join(", ")}`);
    const availabilityEstimate = estimateAvailability(candidate.adp, options.currentPick, options.teamCount);
    if (availabilityEstimate !== null) reasons.push("Availability is an ADP estimate");
    return { candidate, rankScore, recommendationScore, globalVorp: candidate.globalVorp, availabilityEstimate, reasons, missingCategories: missing };
  }).sort((left, right) => right.recommendationScore - left.recommendationScore || right.rankScore - left.rankScore || (right.candidate.tieBreaker ?? 0) - (left.candidate.tieBreaker ?? 0) || left.candidate.name.localeCompare(right.candidate.name))
    .slice(0, Math.max(1, Math.min(200, Math.floor(options.limit ?? 10))));
}
