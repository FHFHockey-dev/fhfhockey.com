import { describe, expect, it } from "vitest";
import { deniedRsoUses, ISSUED_PARTICIPATION_METHOD, issuedParticipationLineage, resolveRsoTargetUse, restrictRsoForecast, RSO_USE_POLICY, type RsoTargetUseBinding, type RsoUsePolicy } from "./rsoUsePolicy";
import type { GameForecast } from "../rosterScheduleOptimizer/planningTypes";

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

// Astra F3: a review approves a stable participation method; each issued row keeps its own lineage checks.
describe("stable method approval with per-issuance lineage", () => {
  const method = `${ISSUED_PARTICIPATION_METHOD}:skater`;
  const methodPolicy: RsoUsePolicy = { ...policy, reviews: [{ ...policy.reviews[0], binding: { ...scope, participationLineage: method },
    allowedUses: { assignment: false, totals: true, comparison: true, conditionalTieBreak: false } }] };
  const issued = (revisionId: string) => ({ ...binding, participationLineage: issuedParticipationLineage("skater", revisionId) });
  function row(revisionId: string, extra: Partial<GameForecast> = {}, lineageRevision = revisionId): GameForecast {
    return { playerId: "p1", gameId: "g1", stats: { HITS: 2 }, conditioning: "unconditional", startProbability: null, confirmedStart: false,
      revisionId, issuedAt: "2026-10-22T10:00:00Z", cutoffAt: binding.cutoffAt, expiresAt: "2026-10-22T23:00:00Z", modelVersion: binding.codeVersion,
      limitations: [], allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true },
      issuedContext: { version: "forge-issued-context-v1", playerId: "p1", gameId: "g1", nhlPlayerId: 1, seasonId: 20262027, teamId: 1,
        scheduledAt: "2026-10-22T23:00:00Z", scheduleRevision: "s", rosterRevision: "r", observedAt: "2026-10-22T10:00:00Z",
        scheduleSourceUpdatedAt: null, scheduleFetchedAt: null, identityUpdatedAt: null, membershipCreatedAt: [] },
      rsoTargetBindings: { HITS: issued(lineageRevision) }, ...extra };
  }
  const uses = (forecast: GameForecast, policyInUse = methodPolicy) => restrictRsoForecast(forecast, undefined, now, policyInUse).targetAllowedUses?.HITS;

  it("admits every new revision issued under the reviewed method", () => {
    for (const revision of ["rev-1", "rev-2"]) {
      expect(resolveRsoTargetUse(issued(revision), now, methodPolicy)).toMatchObject({ reviewId: "fictional-review", allowedUses: { totals: true, comparison: true, assignment: false } });
      expect(uses(row(revision))).toEqual({ assignment: false, totals: true, comparison: true, conditionalTieBreak: false });
    }
  });

  it.each([
    ["another participation method", { ...binding, participationLineage: `${ISSUED_PARTICIPATION_METHOD}:goalie@rev-2` }],
    ["a newer method contract", { ...binding, participationLineage: "forge-issued-participation-v2:skater@rev-2" }],
    ["another model configuration", { ...issued("rev-2"), configurationHash: "c".repeat(64) }],
    ["an empty issuance", { ...binding, participationLineage: `${method}@` }],
  ])("denies %s", (_label, changed) => {
    expect(resolveRsoTargetUse(changed, now, methodPolicy).allowedUses).toEqual(deniedRsoUses());
  });

  it.each([
    ["a binding from an earlier issuance", row("rev-2", {}, "rev-1")],
    ["a foreign issued context", row("rev-2", { issuedContext: { ...row("rev-2").issuedContext!, playerId: "p2" } })],
    ["no issued context", row("rev-2", { issuedContext: undefined })],
    ["an expired issuance", row("rev-2", { expiresAt: now })],
    ["an issuance from the future", row("rev-2", { issuedAt: "2026-10-22T13:00:00Z" })],
    ["another producer's code version", row("rev-2", { modelVersion: "other-code" })],
  ] as const)("still denies %s on each issued row", (_label, forecast) => {
    expect(uses(forecast)).toEqual(deniedRsoUses());
  });

  it("still honours revocation and the empty production catalog", () => {
    expect(uses(row("rev-2"), { ...methodPolicy, revokedReviewIds: ["fictional-review"] })).toEqual(deniedRsoUses());
    expect(uses(row("rev-2"), RSO_USE_POLICY)).toEqual(deniedRsoUses());
  });

  it("keeps a whole-string lineage revision-bound (audit reproduction of the old format)", () => {
    const old = { ...policy, reviews: [{ ...policy.reviews[0], binding: { ...scope, participationLineage: "revision-one:participation" } }] };
    expect(resolveRsoTargetUse({ ...binding, participationLineage: "revision-one:participation" }, now, old).reviewId).toBe("fictional-review");
    expect(resolveRsoTargetUse({ ...binding, participationLineage: "revision-two:participation" }, now, old).allowedUses).toEqual(deniedRsoUses());
  });
});
