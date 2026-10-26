import { currentBridgeIsAuthorized } from "../rosterScheduleOptimizer/currentPlanningRead";
import type { ContributionAllowedUses } from "./contributions";
import type { ForecastManifest, GameForecast } from "../rosterScheduleOptimizer/planningTypes";

export const RSO_USE_POLICY_VERSION = "rso-target-use-v1" as const;
export type RsoTargetUseBinding = {
  component: string;
  modelMode: string;
  codeVersion: string;
  configurationHash: string | null;
  artifactHash: string | null;
  targetKey: string;
  horizonGames: number;
  conditioning: string;
  participationLineage: string | null;
  cutoffAt: string;
};
export type RsoTargetUseReview = {
  id: string;
  binding: Omit<RsoTargetUseBinding, "cutoffAt">;
  reviewedAt: string;
  inputCutoffFrom: string;
  inputCutoffUntil: string;
  expiresAt: string;
  allowedUses: ContributionAllowedUses;
  /** The prospective evidence a review rests on (the predeclared scope hash and its final checker report), and the
   * owner's approval, as the native contribution store requires (TJ D5). A review missing either is not a review. */
  prospectiveEvidenceRef: string;
  ownerApprovalRef: string;
};
export type RsoUsePolicy = {
  version: typeof RSO_USE_POLICY_VERSION;
  revision: string;
  reviews: readonly RsoTargetUseReview[];
  revokedReviewIds: readonly string[];
};
export type RsoTargetUseDecision = {
  policyRevision: string;
  reviewId: string | null;
  allowedUses: ContributionAllowedUses;
};

/** TJ selected review-before-use, not a target approval. Add only independently
 * reviewed exact scopes here; serialized forecasts cannot add to this catalog. */
export const RSO_USE_POLICY: RsoUsePolicy = Object.freeze({
  version: RSO_USE_POLICY_VERSION,
  revision: "rso-review-before-use-2026-10-22-v1",
  reviews: Object.freeze([]),
  revokedReviewIds: Object.freeze([]),
});
export const currentRsoUsePolicy = (): RsoUsePolicy => RSO_USE_POLICY;

/** Native participation lineage is `<stable method>@<issued revision>` (Astra F3). A review approves the method, so the
 * next revision of the same method qualifies; each issued row must still carry its own revision, issued context and
 * unexpired issuance. A lineage without `@` is compared whole, as before. */
export const ISSUED_PARTICIPATION_METHOD = "forge-issued-participation-v1";
export const issuedParticipationLineage = (sourceKind: string, revisionId: string) =>
  `${ISSUED_PARTICIPATION_METHOD}:${sourceKind}@${revisionId}`;
function lineageParts(value: string | null): { method: string | null; issuance: string | null } {
  const at = value ? value.lastIndexOf("@") : -1;
  return at < 0 ? { method: value, issuance: null } : { method: value!.slice(0, at), issuance: value!.slice(at + 1) };
}

export const deniedRsoUses = (): ContributionAllowedUses => ({
  assignment: false, totals: false, comparison: false, conditionalTieBreak: false,
});

/** `policy` is a trusted code/loader dependency, never a field from saved or
 * provider inputs. A binding or a previous decision is not an approval. */
export function resolveRsoTargetUse(binding: RsoTargetUseBinding | undefined, now: string,
  policy: RsoUsePolicy = RSO_USE_POLICY): RsoTargetUseDecision {
  const denied = { policyRevision: policy.revision, reviewId: null, allowedUses: deniedRsoUses() };
  const clock = Date.parse(now), cutoff = Date.parse(binding?.cutoffAt ?? "");
  if (policy.version !== RSO_USE_POLICY_VERSION || !policy.revision || !binding
    || !Number.isFinite(clock) || !Number.isFinite(cutoff) || cutoff > clock
    || !binding.component || !binding.modelMode || !binding.codeVersion || !binding.targetKey
    || !binding.conditioning || !binding.participationLineage
    || !/^[a-f0-9]{64}$/.test(binding.configurationHash ?? "")
    || !/^[a-f0-9]{64}$/.test(binding.artifactHash ?? "")
    || !Number.isSafeInteger(binding.horizonGames) || binding.horizonGames < 1) return denied;
  const lineage = lineageParts(binding.participationLineage);
  if (!lineage.method || lineage.issuance === "") return denied;
  const { cutoffAt: _, ...bound } = binding, scope = { ...bound, participationLineage: lineage.method };
  const nonempty = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  const candidates = policy.reviews.filter(review => review.id && !policy.revokedReviewIds.includes(review.id)
    && nonempty(review.prospectiveEvidenceRef) && nonempty(review.ownerApprovalRef)
    && Object.keys(scope).every(key => scope[key as keyof typeof scope] === review.binding[key as keyof typeof scope])
    && Number.isFinite(Date.parse(review.reviewedAt)) && Date.parse(review.reviewedAt) <= clock
    && Number.isFinite(Date.parse(review.expiresAt)) && Date.parse(review.expiresAt) > clock
    && Number.isFinite(Date.parse(review.inputCutoffFrom)) && Date.parse(review.inputCutoffFrom) <= cutoff
    && Number.isFinite(Date.parse(review.inputCutoffUntil)) && cutoff < Date.parse(review.inputCutoffUntil));
  if (candidates.length !== 1) return denied;
  const review = candidates[0];
  return { policyRevision: policy.revision, reviewId: review.id, allowedUses: {
    assignment: review.allowedUses.assignment === true, totals: review.allowedUses.totals === true,
    comparison: review.allowedUses.comparison === true, conditionalTieBreak: review.allowedUses.conditionalTieBreak === true,
  } };
}

export function intersectRsoUses(left: ContributionAllowedUses | undefined,
  right: ContributionAllowedUses): ContributionAllowedUses {
  return { assignment: left?.assignment === true && right.assignment, totals: left?.totals === true && right.totals,
    comparison: left?.comparison === true && right.comparison, conditionalTieBreak: left?.conditionalTieBreak === true && right.conditionalTieBreak };
}

/** Shared data readers assign this only after selecting the separately approved
 * bridge. A detailed row's source label/revision prefix never selects a branch. */
export type RsoUsePolicyManifest = { version: typeof RSO_USE_POLICY_VERSION; revision: string;
  bridgeRevisionIds: string[] };

/** The per-issuance half of a method-bound lineage: this row's own revision, issued context and issuance window. */
function issuanceIntact(forecast: GameForecast, source: { sourceId: string; issuedAt: string; expiresAt: string } | undefined,
  issuance: string, now: string): boolean {
  const clock = Date.parse(now), issuedAt = Date.parse(source?.issuedAt ?? forecast.issuedAt), expiresAt = Date.parse(source?.expiresAt ?? forecast.expiresAt ?? "");
  return issuance === (source?.sourceId ?? forecast.revisionId)
    && forecast.issuedContext?.playerId === forecast.playerId && forecast.issuedContext.gameId === forecast.gameId
    && Number.isFinite(clock) && Number.isFinite(issuedAt) && issuedAt <= clock && Number.isFinite(expiresAt) && clock < expiresAt;
}

/** Recompute permissions from the current trusted catalog, including retained
 * resolver inputs. Serialized allowedUses/decision IDs cannot grant a review. */
export function restrictRsoForecast(forecast: GameForecast, manifest: Pick<ForecastManifest, "rsoUsePolicy"> | undefined, now: string,
  policy = currentRsoUsePolicy()): GameForecast {
  const current = manifest?.rsoUsePolicy;
  const compatible = !current || current.version === RSO_USE_POLICY_VERSION && current.revision === policy.revision;
  if (compatible && currentBridgeIsAuthorized(forecast, policy.revision)) return forecast;
  const targets = new Set([...Object.keys(forecast.stats), ...Object.keys(forecast.conditionalStats ?? {}),
    ...Object.keys(forecast.contributions ?? {})]);
  const targetUses: Record<string, ContributionAllowedUses> = {};
  const contributions = forecast.contributions && { ...forecast.contributions };
  for (const target of targets) {
    const binding = forecast.rsoTargetBindings?.[target];
    const inputs = forecast.contributions?.[target]?.inputs;
    const source = inputs?.detailed;
    // A baseline-only row may still depend on reviewed issued participation.
    // Its aggregate cutoff can be newer than that participation's own cutoff.
    const participation = inputs?.participation && !inputs.participation.model ? inputs.participation : undefined;
    const issuance = lineageParts(binding?.participationLineage ?? null).issuance;
    const bound = binding?.targetKey === target && binding.codeVersion === (source?.policyVersion ?? forecast.modelVersion)
      && binding.cutoffAt === (source?.cutoffAt ?? participation?.cutoffAt ?? forecast.cutoffAt)
      && (issuance === null || issuanceIntact(forecast, source, issuance, now));
    const decision = resolveRsoTargetUse(compatible && bound ? binding : undefined, now, policy);
    targetUses[target] = intersectRsoUses(forecast.targetAllowedUses?.[target] ?? forecast.allowedUses, decision.allowedUses);
    const row = contributions?.[target];
    if (!row) continue;
    // Qualified native rates and modeled participation keep their own admission.
    // A detailed participation receipt cannot borrow a rate's approval.
    const detailUsed = row.sourceKind === "detailed" || row.sourceKind === "blended";
    const detailedParticipation = row.inputs?.participation && !row.inputs.participation.model;
    const dependent = detailUsed || detailedParticipation;
    contributions![target] = { ...row,
      ...(row.inputs ? { inputs: { ...row.inputs,
        ...(row.inputs.detailed ? { detailed: { ...row.inputs.detailed,
          allowedUses: intersectRsoUses(row.inputs.detailed.allowedUses, decision.allowedUses) } } : {}),
        ...(detailedParticipation ? { participation: { ...row.inputs.participation!,
          allowedUses: intersectRsoUses(row.inputs.participation!.allowedUses, decision.allowedUses) } } : {}),
      } } : {}),
      ...(dependent ? { allowedUses: intersectRsoUses(row.allowedUses, decision.allowedUses),
        exclusionReasons: [...new Set([...row.exclusionReasons,
          ...(!decision.allowedUses.assignment || !decision.allowedUses.totals || !decision.allowedUses.comparison
            ? ["use_not_approved" as const] : [])])] } : {}),
    };
  }
  return { ...forecast, allowedUses: deniedRsoUses(), targetAllowedUses: targetUses,
    ...(contributions ? { contributions } : {}) };
}
