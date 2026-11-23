// The RSO target-use mechanism: binding and review types, the resolver and the per-row restriction. It sits inside the
// FORGE producer closure (planningContributions.ts and planningTypes.ts import it), so it never holds the review catalog.
// The catalog lives in rsoUsePolicy.ts, outside the closure, and callers outside it pass the policy in. Adding or editing a
// review therefore never changes the producer closure or its registration (TJ, 2026-11-21).
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

/** Native participation lineage is `<stable method>@<issued revision>` (Astra F3). A review approves the method, so the
 * next revision of the same method qualifies; each issued row must still carry its own revision, issued context and
 * unexpired issuance. Legacy lineages without `@` are compared whole; every issued method requires a revision. */
export const ISSUED_PARTICIPATION_METHOD = "forge-issued-participation-v1";
/** Detailed RSO's assumed-participation overlay (TJ, 2026-11-21) mints its own method, so a review of the issued method
 * never covers it. consumerRevisionAdmission.ts re-exports it. */
export const RSO_PARTICIPATION_OVERLAY_METHOD = "forge-rso-participation-overlay-v1";
/** Every method an issued row mints. A lineage naming one of them, bare or `:<kind>`, must carry `@<issued revision>`. */
export const ISSUED_PARTICIPATION_METHODS: readonly string[] = Object.freeze([ISSUED_PARTICIPATION_METHOD, RSO_PARTICIPATION_OVERLAY_METHOD]);
const issuedMethod = (method: string) => ISSUED_PARTICIPATION_METHODS.some(name => method === name || method.startsWith(`${name}:`));
export const issuedParticipationLineage = (sourceKind: string, revisionId: string) =>
  `${ISSUED_PARTICIPATION_METHOD}:${sourceKind}@${revisionId}`;
/** The stable producer identity a review binds (TJ D3 as amended 2026-11-21): the verified FORGE producer closure, a
 * 64-hex sha256. Rows identified by a deploy SHA (40-hex) or anything else are never reviewable. */
export const RSO_PRODUCER_CODE_VERSION = /^[a-f0-9]{64}$/;
function lineageParts(value: string | null): { method: string | null; issuance: string | null } {
  const at = value ? value.lastIndexOf("@") : -1;
  return at < 0 ? { method: value, issuance: null } : { method: value!.slice(0, at), issuance: value!.slice(at + 1) };
}

export const deniedRsoUses = (): ContributionAllowedUses => ({
  assignment: false, totals: false, comparison: false, conditionalTieBreak: false,
});

/** `policy` is a trusted code/loader dependency, never a field from saved or
 * provider inputs, and it is required: callers outside the producer closure pass the catalog. A missing policy denies.
 * A binding or a previous decision is not an approval. */
export function resolveRsoTargetUse(binding: RsoTargetUseBinding | undefined, now: string,
  policy: RsoUsePolicy | undefined): RsoTargetUseDecision {
  const denied = { policyRevision: policy?.revision ?? "", reviewId: null, allowedUses: deniedRsoUses() };
  if (!policy) return denied;
  const clock = Date.parse(now), cutoff = Date.parse(binding?.cutoffAt ?? "");
  if (policy.version !== RSO_USE_POLICY_VERSION || !policy.revision || !binding
    || !Number.isFinite(clock) || !Number.isFinite(cutoff) || cutoff > clock
    || !binding.component || !binding.modelMode || !RSO_PRODUCER_CODE_VERSION.test(binding.codeVersion ?? "") || !binding.targetKey
    || !binding.conditioning || !binding.participationLineage
    || !/^[a-f0-9]{64}$/.test(binding.configurationHash ?? "")
    || !/^[a-f0-9]{64}$/.test(binding.artifactHash ?? "")
    || !Number.isSafeInteger(binding.horizonGames) || binding.horizonGames < 1) return denied;
  const lineage = lineageParts(binding.participationLineage);
  if (!lineage.method || lineage.issuance === ""
    || issuedMethod(lineage.method) && lineage.issuance === null) return denied;
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
function issuanceIntact(forecast: GameForecast, source: ({ sourceId: string } | { revisionId: string }) & { issuedAt: string; expiresAt: string } | undefined,
  issuance: string, now: string): boolean {
  const clock = Date.parse(now), issuedAt = Date.parse(source?.issuedAt ?? forecast.issuedAt), expiresAt = Date.parse(source?.expiresAt ?? forecast.expiresAt ?? "");
  const matches = !source ? issuance === forecast.revisionId : "sourceId" in source ? issuance === source.sourceId
    : ["participation", "appearance", "start"].some(suffix => source.revisionId === `${issuance}:${suffix}`);
  return matches
    && forecast.issuedContext?.playerId === forecast.playerId && forecast.issuedContext.gameId === forecast.gameId
    && Number.isFinite(clock) && Number.isFinite(issuedAt) && issuedAt <= clock && Number.isFinite(expiresAt) && clock < expiresAt;
}

/** Recompute permissions from the current trusted catalog, including retained
 * resolver inputs. Serialized allowedUses/decision IDs cannot grant a review. The caller passes the catalog; without one
 * every target is denied. */
export function restrictRsoForecast(forecast: GameForecast, manifest: Pick<ForecastManifest, "rsoUsePolicy"> | undefined, now: string,
  policy: RsoUsePolicy | undefined): GameForecast {
  const current = manifest?.rsoUsePolicy;
  const compatible = !!policy && (!current || current.version === RSO_USE_POLICY_VERSION && current.revision === policy.revision);
  if (compatible && currentBridgeIsAuthorized(forecast, policy!.revision)) return forecast;
  const targets = new Set([...Object.keys(forecast.stats), ...Object.keys(forecast.conditionalStats ?? {}),
    ...Object.keys(forecast.contributions ?? {})]);
  const targetUses: Record<string, ContributionAllowedUses> = {};
  const contributions = forecast.contributions && { ...forecast.contributions };
  for (const target of targets) {
    const binding = forecast.rsoTargetBindings?.[target];
    const inputs = forecast.contributions?.[target]?.inputs;
    const source = inputs?.detailed;
    // A baseline-only row may still depend on reviewed issued participation.
    // Its aggregate revision and timestamps describe the rates, not the borrowed issuance.
    const participation = inputs?.participation && !inputs.participation.model ? inputs.participation : undefined;
    const issuance = lineageParts(binding?.participationLineage ?? null).issuance;
    // The binding names the row's stable producer identity (its model identity's closure codeVersion), never the deploy
    // SHA in modelVersion, so a review outlives the release that ships it. A row without one stays unbound.
    const bound = binding?.targetKey === target && typeof forecast.producerCodeVersion === "string"
      && binding.codeVersion === forecast.producerCodeVersion
      && binding.cutoffAt === (source?.cutoffAt ?? participation?.cutoffAt ?? forecast.cutoffAt)
      && (issuance === null || issuanceIntact(forecast, source ?? participation, issuance, now));
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
