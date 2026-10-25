import type { GameForecast } from "../rosterScheduleOptimizer/planningTypes";
import type { RsoTargetUseBinding, RsoUsePolicy } from "./rsoUsePolicy";

// Explicit fictional reviews for planner algorithm fixtures. The production catalog
// stays empty: a fixture row without these bindings, or under RSO_USE_POLICY, is denied.
const scope = { component: "fictional-fixture", modelMode: "synthetic", configurationHash: "a".repeat(64),
  artifactHash: "b".repeat(64), horizonGames: 1, conditioning: "synthetic-unconditional", participationLineage: "synthetic-only" };

/** Binds each target to one fictional reviewed scope at the row's own code version and cutoff. */
export function fixtureRsoBindings(codeVersion: string, cutoffAt: string, targets: readonly string[]): Record<string, RsoTargetUseBinding> {
  return Object.fromEntries(targets.map(targetKey => [targetKey, { ...scope, codeVersion, targetKey, cutoffAt }]));
}

/** Binds every target a row carries, at its own model version and cutoff. */
export function bindFixtureForecast(row: GameForecast): GameForecast {
  const targets = [...new Set([...Object.keys(row.stats), ...Object.keys(row.conditionalStats ?? {})])];
  return { ...row, rsoTargetBindings: fixtureRsoBindings(row.modelVersion!, row.cutoffAt!, targets) };
}

/** Reviews exactly those scopes for every use; the window spans any fixture clock. */
export function fixtureRsoPolicy(codeVersions: readonly string[], targets: readonly string[]): RsoUsePolicy {
  return { version: "rso-target-use-v1", revision: "fictional-fixture-reviews", revokedReviewIds: [],
    reviews: codeVersions.flatMap(codeVersion => targets.map(targetKey => ({ id: `fictional-${codeVersion}-${targetKey}`,
      binding: { ...scope, codeVersion, targetKey }, reviewedAt: "2026-01-01T00:00:00Z", expiresAt: "2100-01-01T00:00:00Z",
      inputCutoffFrom: "2026-01-01T00:00:00Z", inputCutoffUntil: "2100-01-01T00:00:00Z",
      allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true } }))) };
}
