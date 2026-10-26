import { describe, expect, it } from "vitest";
import { deniedRsoUses, resolveRsoTargetUse, RSO_USE_POLICY, type RsoTargetUseBinding, type RsoUsePolicy } from "./rsoUsePolicy";

const now = "2026-10-22T12:00:00Z";
const binding: RsoTargetUseBinding = { component: "fictional-skater", modelMode: "baseline", codeVersion: "synthetic-code",
  configurationHash: "a".repeat(64), artifactHash: "b".repeat(64), targetKey: "HITS", horizonGames: 1,
  conditioning: "conditional_playing", participationLineage: "fictional-confirmed-appearance-v1", cutoffAt: "2026-10-22T10:00:00Z" };
const { cutoffAt: _, ...scope } = binding;
const policy: RsoUsePolicy = { version: "rso-target-use-v1", revision: "synthetic-review-only", revokedReviewIds: [], reviews: [{
  id: "fictional-review", binding: scope, reviewedAt: "2026-10-21T00:00:00Z", expiresAt: "2026-10-23T00:00:00Z",
  inputCutoffFrom: "2026-10-22T00:00:00Z", inputCutoffUntil: "2026-10-23T00:00:00Z",
  allowedUses: { assignment: true, totals: false, comparison: false, conditionalTieBreak: false },
  prospectiveEvidenceRef: "fictional-scope-and-checker-report", ownerApprovalRef: "fictional-owner-approval",
}] };

describe("RSO target/use reviews", () => {
  it("does not invent production approvals from valid-looking inputs", () => {
    expect(resolveRsoTargetUse(binding, now).allowedUses).toEqual(deniedRsoUses());
    expect(resolveRsoTargetUse(undefined, now, policy).allowedUses).toEqual(deniedRsoUses());
  });
  it("keeps assignment, totals, comparison and tie-breaking independent", () => {
    for (const use of ["assignment", "totals", "comparison", "conditionalTieBreak"] as const) {
      const allowedUses = { ...deniedRsoUses(), [use]: true };
      expect(resolveRsoTargetUse(binding, now, { ...policy, reviews: [{ ...policy.reviews[0], allowedUses }] }))
        .toEqual({ policyRevision: policy.revision, reviewId: "fictional-review", allowedUses });
    }
  });
  it.each(["component", "modelMode", "codeVersion", "configurationHash", "artifactHash", "targetKey", "horizonGames", "conditioning", "participationLineage"] as const)
  ("rejects a different %s without broadening the reviewed scope", key => {
    const changed = { ...binding, [key]: key === "horizonGames" ? 2 : key.endsWith("Hash") ? "c".repeat(64) : "different" };
    expect(resolveRsoTargetUse(changed, now, policy).allowedUses).toEqual(deniedRsoUses());
  });
  it("keeps the production catalog empty, so a binding with valid identity hashes is still denied", () => {
    expect(RSO_USE_POLICY.reviews).toEqual([]);
    expect(resolveRsoTargetUse(binding, now, RSO_USE_POLICY)).toEqual({ policyRevision: RSO_USE_POLICY.revision, reviewId: null, allowedUses: deniedRsoUses() });
  });
  it.each([["prospectiveEvidenceRef", ""], ["prospectiveEvidenceRef", "   "], ["prospectiveEvidenceRef", undefined],
    ["ownerApprovalRef", ""], ["ownerApprovalRef", "   "], ["ownerApprovalRef", undefined]] as const)
  ("counts a review only with both evidence references (%s = %j)", (field, value) => {
    expect(resolveRsoTargetUse(binding, now, policy).reviewId).toBe("fictional-review");
    const candidate = structuredClone(policy) as RsoUsePolicy & { reviews: Array<Record<string, unknown>> };
    if (value === undefined) delete candidate.reviews[0][field]; else candidate.reviews[0][field] = value;
    expect(resolveRsoTargetUse(binding, now, candidate).allowedUses).toEqual(deniedRsoUses());
  });
  it.each(["revoked", "expired", "future_review", "old_cutoff", "late_cutoff", "duplicate"])
  ("denies %s review evidence", kind => {
    const candidate = structuredClone(policy), review = candidate.reviews[0];
    if (kind === "revoked") candidate.revokedReviewIds = [review.id];
    if (kind === "expired") review.expiresAt = now;
    if (kind === "future_review") review.reviewedAt = "2026-10-23T00:00:00Z";
    if (kind === "old_cutoff") review.inputCutoffFrom = now;
    if (kind === "late_cutoff") review.inputCutoffUntil = binding.cutoffAt;
    if (kind === "duplicate") candidate.reviews = [review, { ...review, id: "another-review" }];
    expect(resolveRsoTargetUse(binding, now, candidate).allowedUses).toEqual(deniedRsoUses());
  });
});
