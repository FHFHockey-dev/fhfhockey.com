// The RSO review catalog (TJ D5). It sits outside the FORGE producer closure: no closure module may import this file,
// not even for types, so adding, editing or revoking a review never changes the closure or needs a new registration.
// The mechanism lives in rsoUseResolver.ts (inside the closure). Callers outside the closure pass this catalog in.
import {
  resolveRsoTargetUse as resolveWithPolicy, restrictRsoForecast as restrictWithPolicy, RSO_USE_POLICY_VERSION,
  type RsoTargetUseBinding, type RsoTargetUseDecision, type RsoUsePolicy,
} from "./rsoUseResolver";
import type { ForecastManifest, GameForecast } from "../rosterScheduleOptimizer/planningTypes";

export {
  deniedRsoUses, intersectRsoUses, ISSUED_PARTICIPATION_METHOD, ISSUED_PARTICIPATION_METHODS, issuedParticipationLineage,
  RSO_PARTICIPATION_OVERLAY_METHOD, RSO_PRODUCER_CODE_VERSION, RSO_USE_POLICY_VERSION,
} from "./rsoUseResolver";
export type {
  RsoTargetUseBinding, RsoTargetUseDecision, RsoTargetUseReview, RsoUsePolicy, RsoUsePolicyManifest,
} from "./rsoUseResolver";

/** TJ selected review-before-use, not a target approval. Add only independently
 * reviewed exact scopes here; serialized forecasts cannot add to this catalog. A review's `codeVersion` is the verified
 * producer closure (64-hex) of the qualified identity, never a deploy SHA (TJ D3 as amended 2026-11-21). */
export const RSO_USE_POLICY: RsoUsePolicy = Object.freeze({
  version: RSO_USE_POLICY_VERSION,
  revision: "rso-review-before-use-2026-10-22-v1",
  reviews: Object.freeze([]),
  revokedReviewIds: Object.freeze([]),
});
export const currentRsoUsePolicy = (): RsoUsePolicy => RSO_USE_POLICY;

/** The resolver under this catalog unless a trusted caller passes another. */
export const resolveRsoTargetUse = (binding: RsoTargetUseBinding | undefined, now: string,
  policy: RsoUsePolicy = RSO_USE_POLICY): RsoTargetUseDecision => resolveWithPolicy(binding, now, policy);

/** The per-row restriction under the current catalog unless a trusted caller passes another. */
export const restrictRsoForecast = (forecast: GameForecast, manifest: Pick<ForecastManifest, "rsoUsePolicy"> | undefined,
  now: string, policy: RsoUsePolicy = currentRsoUsePolicy()): GameForecast => restrictWithPolicy(forecast, manifest, now, policy);
