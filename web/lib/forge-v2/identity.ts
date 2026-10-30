import { CATEGORIES, Categories, CategoryMeans, Component, ScoringProfile, Target, available, unavailable } from "./contracts";

/** Canonical JSON rejects values which JSON would silently drop or change. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Nonfinite canonical number");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  throw new Error("Unsupported canonical value");
}

export function targetKey(target: Target): string {
  return `${target.playerId}:${target.gameId}:${target.seasonId}:${target.targetVersion}:${target.conditioning}`;
}

export function scoringProfile(weights: Categories<number>): ScoringProfile {
  if (Object.keys(weights).length !== CATEGORIES.length || CATEGORIES.some(c => !Object.hasOwn(weights, c) || !Number.isFinite(weights[c]))) throw new Error("Exactly seven finite scoring weights required");
  const normalized = Object.fromEntries(CATEGORIES.map(c => [c, Object.is(weights[c], -0) ? 0 : weights[c]])) as Categories<number>;
  return { id: `linear-seven-v1:${CATEGORIES.map(c => `${c}=${normalized[c]}`).join(";")}`, ruleVersion: "linear-seven-v1", weights: normalized };
}

export const DEFAULT_SCORING = scoringProfile({ G: 3, A: 2, PPP: 1, SOG: 0.2, HIT: 0.2, BLK: 0.25, PIM: 0 });

/** Arithmetic only. Serving must separately enforce qualification for contributing categories. */
export function scoreMeans(means: CategoryMeans, profile: ScoringProfile): Component<number> {
  const normalized = scoringProfile(profile.weights);
  if (profile.id !== normalized.id || profile.ruleVersion !== normalized.ruleVersion) return unavailable("scoring_identity_mismatch");
  let result = 0;
  for (const category of CATEGORIES) {
    const weight = profile.weights[category];
    if (weight === 0) continue;
    const mean = means[category];
    if (!mean || mean.state !== "available") return unavailable(`missing_contributing_category:${category}`);
    if (!Number.isFinite(mean.value) || mean.value < 0) return unavailable(`invalid_category:${category}`);
    result += weight * mean.value;
  }
  return Number.isFinite(result) ? available(result) : unavailable("nonfinite_score");
}
