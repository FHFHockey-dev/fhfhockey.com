import type { OpponentMetricAverages } from "./useOpponentMetricsData";

export type OpponentRole = "skater" | "goalie";
export type OpponentMetricKey = keyof OpponentMetricAverages;
export type Favorable = "asc" | "desc";

type CategoryEffect = {
  /** Descriptive association only: opponent values favorable for this category. */
  inputs: readonly { metric: OpponentMetricKey; favorable: Favorable }[];
  note: string;
};

const opponentVolume = [
  { metric: "avgXgf", favorable: "asc" },
  { metric: "avgGoalFor", favorable: "asc" },
  { metric: "avgSf", favorable: "asc" },
  { metric: "avgWinPct", favorable: "asc" }
] as const;
const leakyDefense = [
  { metric: "avgXga", favorable: "desc" },
  { metric: "avgGoalAgainst", favorable: "desc" }
] as const;

/**
 * Category-specific opponent environment, separated by role. Signs are not
 * universal: an opponent that shoots a lot helps skater BLK and goalie saves,
 * but hurts skater scoring time and goalie GA. Categories without a qualified
 * all-strength input stay empty rather than borrowing another category's sign.
 */
export const OPPONENT_CATEGORY_EFFECTS: Readonly<Record<OpponentRole, Readonly<Record<string, CategoryEffect>>>> = {
  skater: {
    G: { inputs: [...leakyDefense, ...opponentVolume], note: "Goals: opponent goals/xG allowed and possession pressure." },
    A: { inputs: [...leakyDefense, ...opponentVolume], note: "Assists share the goal environment but are a separate credit target." },
    SOG: { inputs: [{ metric: "avgSa", favorable: "desc" }, ...opponentVolume], note: "Shots on goal: opponent shots allowed and possession pressure." },
    BLK: { inputs: [{ metric: "avgSf", favorable: "desc" }], note: "Blocks need opponent shot volume: the opposite sign to scoring." },
    PPP: { inputs: [], note: "Needs opponent penalties and PK quality; all-strength rates cannot stand in." },
    HIT: { inputs: [], note: "No qualified opponent input; hit counts are arena- and role-specific." },
    PIM: { inputs: [], note: "No qualified opponent input." }
  },
  goalie: {
    W: { inputs: [...leakyDefense, { metric: "avgXgf", favorable: "asc" }, { metric: "avgGoalFor", favorable: "asc" }, { metric: "avgWinPct", favorable: "asc" }], note: "Wins: contest outcome, which the Week Score matchup term already uses." },
    GA: { inputs: [{ metric: "avgXgf", favorable: "asc" }, { metric: "avgGoalFor", favorable: "asc" }, { metric: "avgSf", favorable: "asc" }], note: "Goals against: opponent offense." },
    SV: { inputs: [{ metric: "avgSf", favorable: "desc" }], note: "Saves need opponent shots, which also raise GA risk." },
    "SV%": { inputs: [], note: "Needs opponent shot quality per shot; xGF alone is not a save-percentage input." }
  }
};

/** Colored table views. Saves are left out of the goalie view because their SF sign conflicts with GA. */
export const OPPONENT_VIEWS: Readonly<Record<OpponentRole, { label: string; categories: readonly string[] }>> = {
  skater: { label: "Skater scoring (G, A, SOG)", categories: ["G", "A", "SOG"] },
  goalie: { label: "Goalie (W, GA)", categories: ["W", "GA"] }
};

export const OPPONENT_VIEW_LEGEND: Readonly<Record<OpponentRole, string>> = {
  skater: "Skater scoring view: lower xGF, GF, SF and PTS% are favorable; higher xGA, GA and SA are favorable. Blocks favor the opposite SF sign; PPP, hits and PIM have no qualified opponent input here.",
  goalie: "Goalie view: lower xGF, GF, SF and PTS% are favorable; higher xGA and GA favor wins only. SA is not colored. Saves favor high SF, which also raises GA risk, so saves are not colored."
};

/** A metric is colored only when every category in the view that uses it agrees on the sign. */
export function getOpponentViewDirections(role: OpponentRole): Record<OpponentMetricKey, Favorable | null> {
  const signs = new Map<OpponentMetricKey, Set<Favorable>>();
  OPPONENT_VIEWS[role].categories.forEach((category) =>
    OPPONENT_CATEGORY_EFFECTS[role][category].inputs.forEach(({ metric, favorable }) =>
      signs.set(metric, (signs.get(metric) ?? new Set()).add(favorable))));
  const keys: OpponentMetricKey[] = ["avgXgf", "avgXga", "avgGoalFor", "avgGoalAgainst", "avgSf", "avgSa", "avgWinPct"];
  return Object.fromEntries(keys.map((key) => {
    const set = signs.get(key);
    return [key, set?.size === 1 ? [...set][0] : null];
  })) as Record<OpponentMetricKey, Favorable | null>;
}

/**
 * Existing Game Grid team-strength inputs. None is a qualified category factor,
 * so none may scale a category forecast.
 */
export const TRACED_TEAM_STRENGTH_INPUTS = {
  win_odds: "Week Score matchup term M (bounded ±0.5): contest outcome, not a category scoring environment.",
  standings_pts_pct: "Four-week OPP: centered opponent points percentage; a schedule heuristic.",
  nst_cumulative_rates: "Opponent table: current-season all-strength per-game observations with unknown as-of cutoff; descriptive only."
} as const;

export type OpponentEffectLayer = { layer: string; effects: readonly string[] };

/** Each effect (opponent, pace, venue, rest, goalie, market…) may be applied by exactly one layer. */
export function findDoubleCountedEffects(layers: readonly OpponentEffectLayer[]) {
  const owners = new Map<string, string[]>();
  layers.forEach(({ layer, effects }) => new Set(effects).forEach((effect) =>
    owners.set(effect, [...(owners.get(effect) ?? []), layer])));
  return [...owners].filter(([, by]) => by.length > 1).map(([effect, by]) => ({ effect, layers: by }));
}

/** A qualified category factor must name its own category and role; generic strength sources never qualify. */
export function assessOpponentFactor(factor: {
  role: OpponentRole; category: string; source: string; value: number | null;
}) {
  if (factor.source in TRACED_TEAM_STRENGTH_INPUTS) return { status: "rejected" as const, reason: `${factor.source} is not a category factor` };
  if (!(factor.category in OPPONENT_CATEGORY_EFFECTS[factor.role])) return { status: "rejected" as const, reason: `${factor.category} is not a ${factor.role} category` };
  if (factor.value == null || !Number.isFinite(factor.value) || factor.value <= 0) return { status: "unavailable" as const, reason: "missing or nonpositive factor" };
  return { status: "qualified" as const, reason: null };
}
