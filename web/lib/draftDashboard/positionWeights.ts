import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import { normalizePlayerEligibility } from "./forwardGrouping";

export const POSITION_WEIGHT_KEYS = ["C", "LW", "RW", "D", "G"] as const;
export type PositionWeights = Partial<Record<typeof POSITION_WEIGHT_KEYS[number], number>>;

export function isValidPositionWeights(value: unknown): value is PositionWeights {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.entries(value).every(([key, weight]) =>
      POSITION_WEIGHT_KEYS.includes(key as typeof POSITION_WEIGHT_KEYS[number]) &&
      typeof weight === "number" && Number.isFinite(weight) && weight >= 0 && weight <= 2,
    );
}

/** Browser preferences may outlive their schema; invalid entries are neutral. */
export function normalizePositionWeights(value: unknown): PositionWeights {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, weight]) =>
    POSITION_WEIGHT_KEYS.includes(key as typeof POSITION_WEIGHT_KEYS[number]) &&
    typeof weight === "number" && Number.isFinite(weight) && weight >= 0 && weight <= 2 && weight !== 1,
  ));
}

/** Resolve from source-selected eligibility, independently of roster grouping. */
export function buildPositionWeightMultipliers(
  players: readonly Pick<ProcessedPlayer, "playerId" | "displayPosition" | "eligiblePositions">[],
  weights: PositionWeights | undefined,
  enabled: boolean,
): ReadonlyMap<string, number> {
  const multipliers = new Map<string, number>();
  if (!enabled) return multipliers;
  const normalized = normalizePositionWeights(weights);
  if (!Object.keys(normalized).length) return multipliers;
  for (const player of players) {
    const positions = normalizePlayerEligibility(player.displayPosition, player.eligiblePositions);
    if (!positions.length) continue;
    const multiplier = Math.max(...positions.map(position => normalized[position as keyof PositionWeights] ?? 1));
    if (multiplier !== 1) multipliers.set(String(player.playerId), multiplier);
  }
  return multipliers;
}
