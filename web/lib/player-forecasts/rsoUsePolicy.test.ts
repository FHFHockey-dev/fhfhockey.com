import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { computeForgeProducerClosure } from "../../scripts/forge-producer-closure";
import { deniedRsoUses, ISSUED_PARTICIPATION_METHOD, issuedParticipationLineage, resolveRsoTargetUse, restrictRsoForecast, RSO_PARTICIPATION_OVERLAY_METHOD,
  RSO_USE_POLICY, type RsoTargetUseBinding, type RsoUsePolicy } from "./rsoUsePolicy";
import * as resolver from "./rsoUseResolver";
import type { GameForecast } from "../rosterScheduleOptimizer/planningTypes";

const now = "2026-10-22T12:00:00Z";
// A fictional verified producer closure (TJ D3 as amended 2026-11-21) and two deploy SHAs of the same producer.
const CLOSURE = "c1".repeat(32), DEPLOY_SHA = "1".repeat(40), LATER_DEPLOY_SHA = "2".repeat(40);
const binding: RsoTargetUseBinding = { component: "fictional-skater", modelMode: "baseline", codeVersion: CLOSURE,
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
    const changed = { ...binding, [key]: key === "horizonGames" ? 2 : key.endsWith("Hash") || key === "codeVersion" ? "c".repeat(64) : "different" };
    expect(resolveRsoTargetUse(changed, now, policy).allowedUses).toEqual(deniedRsoUses());
  });
  it("binds only a 64-hex producer closure: a deploy SHA or a label never matches, even a review naming it", () => {
    for (const codeVersion of [DEPLOY_SHA, "synthetic-code", CLOSURE.toUpperCase(), `${CLOSURE}0`]) {
      const named = { ...policy, reviews: [{ ...policy.reviews[0], binding: { ...scope, codeVersion } }] };
      expect(resolveRsoTargetUse({ ...binding, codeVersion }, now, named).allowedUses, codeVersion).toEqual(deniedRsoUses());
    }
  });
  it("denies everything when a closure caller passes no catalog", () => {
    expect(resolver.resolveRsoTargetUse(binding, now, policy).reviewId).toBe("fictional-review");
    expect(resolver.resolveRsoTargetUse(binding, now, undefined)).toEqual({ policyRevision: "", reviewId: null, allowedUses: deniedRsoUses() });
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
      revisionId, issuedAt: "2026-10-22T10:00:00Z", cutoffAt: binding.cutoffAt, expiresAt: "2026-10-22T23:00:00Z", modelVersion: DEPLOY_SHA,
      producerCodeVersion: CLOSURE,
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

  it("keeps admitting rows from a later deploy of the same producer closure (the release that ships the review)", () => {
    expect(uses(row("rev-3", { modelVersion: LATER_DEPLOY_SHA })))
      .toEqual({ assignment: false, totals: true, comparison: true, conditionalTieBreak: false });
  });

  it("requires an issuance for the RSO participation overlay method too", () => {
    const overlay = `${RSO_PARTICIPATION_OVERLAY_METHOD}:skater`;
    const overlayPolicy: RsoUsePolicy = { ...methodPolicy, reviews: [{ ...methodPolicy.reviews[0], binding: { ...scope, participationLineage: overlay } }] };
    expect(resolveRsoTargetUse({ ...binding, participationLineage: `${overlay}@rev-2` }, now, overlayPolicy).reviewId).toBe("fictional-review");
    expect(uses(row("rev-2", { rsoTargetBindings: { HITS: { ...binding, participationLineage: `${overlay}@rev-2` } } }), overlayPolicy))
      .toEqual({ assignment: false, totals: true, comparison: true, conditionalTieBreak: false });
    for (const lineage of [overlay, RSO_PARTICIPATION_OVERLAY_METHOD, `${overlay}@`]) {
      const bare = { ...overlayPolicy, reviews: [{ ...overlayPolicy.reviews[0], binding: { ...scope, participationLineage: lineage } }] };
      expect(resolveRsoTargetUse({ ...binding, participationLineage: lineage }, now, bare).allowedUses, lineage).toEqual(deniedRsoUses());
    }
    expect(resolveRsoTargetUse({ ...binding, participationLineage: `${overlay}@rev-2` }, now, methodPolicy).allowedUses).toEqual(deniedRsoUses());
  });

  it.each([
    ["another participation method", { ...binding, participationLineage: `${ISSUED_PARTICIPATION_METHOD}:goalie@rev-2` }],
    ["a newer method contract", { ...binding, participationLineage: "forge-issued-participation-v2:skater@rev-2" }],
    ["another model configuration", { ...issued("rev-2"), configurationHash: "c".repeat(64) }],
    ["an issued method without its revision", { ...binding, participationLineage: method }],
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
    ["another producer closure", row("rev-2", { producerCodeVersion: "d".repeat(64) })],
    ["a row issued before the stable identity (no producer closure)", row("rev-2", { producerCodeVersion: undefined })],
    ["no catalog from the caller", row("rev-2")],
    ["a missing revision suffix", row("rev-2", { rsoTargetBindings: { HITS: { ...binding, participationLineage: method } } })],
    ["a missing revision suffix and issued context", row("rev-2", { issuedContext: undefined,
      rsoTargetBindings: { HITS: { ...binding, participationLineage: method } } })],
  ] as const)("still denies %s on each issued row", (label, forecast) => {
    const catalog = label === "no catalog from the caller" ? undefined : methodPolicy;
    expect(resolver.restrictRsoForecast(forecast, undefined, now, catalog).targetAllowedUses?.HITS).toEqual(deniedRsoUses());
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

// TJ 2026-11-21: the review catalog sits outside the FORGE producer closure, so a review never changes the closure.
describe("the review catalog and the producer closure", () => {
  const web = resolve(__dirname, "../..");
  const CATALOG = "lib/player-forecasts/rsoUsePolicy.ts", MECHANISM = "lib/player-forecasts/rsoUseResolver.ts";

  it("keeps the catalog out of the closure (no closure module imports it, even for types) and the mechanism in", () => {
    const { scan } = computeForgeProducerClosure(web);
    expect(scan.findings).toEqual([]);
    expect(scan.modules).toContain(MECHANISM);
    expect(scan.modules).not.toContain(CATALOG);
  }, 60_000);

  it("leaves the closure hash unchanged when a review is added to the catalog, and changes it when the mechanism changes", () => {
    const { scan, closureSha256 } = computeForgeProducerClosure(web);
    const root = mkdtempSync(join(tmpdir(), "rso-catalog-closure-"));
    try {
      for (const file of [...scan.modules, CATALOG, "tsconfig.json"]) {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        copyFileSync(join(web, file), join(root, file));
      }
      expect(computeForgeProducerClosure(root).closureSha256).toBe(closureSha256);
      const catalog = readFileSync(join(root, CATALOG), "utf8");
      const review = JSON.stringify({ ...policy.reviews[0], id: "fictional-added-review" });
      const edited = catalog.replace("reviews: Object.freeze([]),", `reviews: Object.freeze([${review}]),`)
        .replace('revision: "rso-review-before-use-2026-10-22-v1"', 'revision: "fictional-review-added"');
      expect(edited).not.toBe(catalog);
      writeFileSync(join(root, CATALOG), edited);
      expect(computeForgeProducerClosure(root).closureSha256).toBe(closureSha256);
      writeFileSync(join(root, MECHANISM), `${readFileSync(join(root, MECHANISM), "utf8")}\nexport const changed = true;\n`);
      expect(computeForgeProducerClosure(root).closureSha256).not.toBe(closureSha256);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 120_000);
});
