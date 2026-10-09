import { describe, expect, it, vi } from "vitest";

import type { ContributionSource } from "./contributions";
import {
  contributionBundleChecksum,
  contributionBundleCandidateInputHash,
  loadApprovedContributionBundle,
  persistContributionBundle,
  type ContributionBundleManifest,
  type ContributionEvaluationPolicy,
  type ContributionValidationReview,
} from "./contributionStore";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";

const snapshotId = "11111111-1111-4111-8111-111111111111";
const policyId = "22222222-2222-4222-8222-222222222222";
const reviewId = "33333333-3333-4333-8333-333333333333";
const source: ContributionSource = {
  kind: "baseline", sourceId: "rate-v1", policyVersion: "baseline-v1", released: true,
  playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 10,
  targetKey: "shots", unit: "count", basis: "per_appearance", mean: 2,
  participationIntegrated: false, cutoffAt: "2026-09-27T00:00:00Z",
  issuedAt: "2026-09-28T00:00:00Z", expiresAt: "2026-10-01T00:00:00Z",
  sourceWatermark: "projection-v1", scheduleRevision: "schedule-v1",
  rosterRevision: "roster-v1", limitations: ["provisional"],
};
const manifestWithoutChecksum = {
  seasonId: 20262027, policyVersion: "baseline-v1",
  inputCutoff: "2026-09-27T00:00:00Z", issuedAt: "2026-09-28T00:00:00Z",
  expiresAt: "2026-10-01T00:00:00Z", sourceCount: 1,
  sourceWatermarks: ["projection-v1"], rosterRevisions: ["roster-v1"],
  evaluationPolicyId: policyId, reviewId, released: true,
};
const manifest: ContributionBundleManifest = {
  ...manifestWithoutChecksum,
  checksum: contributionBundleChecksum({ manifest: manifestWithoutChecksum, sources: [source] }),
};

describe("contribution bundle store", () => {
  it("defaults persistence to dry run and rejects partial or unreviewed releases", async () => {
    const from = vi.fn();
    const db = { from } as any;
    const result = await persistContributionBundle(db, { manifest, sources: [source] });
    expect(result).toMatchObject({ dryRun: true, snapshotId: null });
    expect(from).not.toHaveBeenCalled();
    await expect(persistContributionBundle(db, { manifest: { ...manifest, reviewId: null }, sources: [source] }))
      .rejects.toThrow("Invalid or incomplete");
    await expect(persistContributionBundle(db, { manifest, sources: [{ ...source, mean: 3 }] }))
      .rejects.toThrow("Invalid or incomplete");
  });

  it("allows signed plus-minus rates while rejecting negative counting rates", async () => {
    const signed = [{ ...source, targetKey: "PLUS_MINUS", mean: -0.2 }];
    const signedManifest = { ...manifestWithoutChecksum,
      checksum: contributionBundleChecksum({ manifest: manifestWithoutChecksum, sources: signed }) };
    await expect(persistContributionBundle({} as any, { manifest: signedManifest, sources: signed }))
      .resolves.toMatchObject({ dryRun: true });
    const negativeShots = [{ ...source, mean: -0.2 }];
    const invalidManifest = { ...manifestWithoutChecksum,
      checksum: contributionBundleChecksum({ manifest: manifestWithoutChecksum, sources: negativeShots }) };
    await expect(persistContributionBundle({} as any, { manifest: invalidManifest, sources: negativeShots }))
      .rejects.toThrow("Invalid or incomplete");
  });

  it("writes one immutable observation when explicitly enabled", async () => {
    const single = vi.fn(async () => ({ data: { id: snapshotId }, error: null }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const db = { from: vi.fn(() => ({ insert })) } as any;
    const result = await persistContributionBundle(db, { manifest, sources: [source], dryRun: false });
    expect(result).toMatchObject({ dryRun: false, snapshotId });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ provider: "fhfh",
      dataset_key: "contribution-bundle-v1", entity_key: "20262027", payload_hash: result.payloadHash }));
  });

  it("reuses an exact immutable bundle on an idempotent retry", async () => {
    const existing: any = { eq: vi.fn(() => existing), maybeSingle: vi.fn(async () => ({ data: { id: snapshotId }, error: null })) };
    const db = { from: vi.fn(() => ({
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { code: "23505" } }) }) }),
      select: () => existing,
    })) } as any;
    const receipt = await persistContributionBundle(db, { manifest, sources: [source], dryRun: false });
    expect(receipt.snapshotId).toBe(snapshotId);
    expect(existing.eq).toHaveBeenCalledWith("payload_hash", receipt.payloadHash);
  });

  it("requires an exact immutable evaluation policy and owner review for an allowlisted snapshot", async () => {
    const payload = { manifest, sources: [source] };
    const bundleRow = { id: snapshotId, provider: "fhfh", dataset_key: "contribution-bundle-v1",
      entity_kind: "seasonal_rate_bundle", entity_key: "20262027",
      available_at: manifest.issuedAt, payload_hash: playerForecastSourcePayloadHash(payload), payload };
    const candidateInputHash = contributionBundleCandidateInputHash(payload);
    const policy: ContributionEvaluationPolicy = { version: "baseline-evaluation-policy-v1",
      seasonId: 20262027, policyVersion: "baseline-v1", candidateInputHash,
      status: "owner_approved", allowedPublicUses: ["assignment", "totals", "comparison"],
      prospectiveEvidenceRef: "prospective-evidence-1", ownerApprovalRef: "owner-approval-1",
      approvedAt: manifest.issuedAt };
    const policyRow = { id: policyId, provider: "fhfh", dataset_key: "baseline-evaluation-policy-v1",
      entity_kind: "baseline_evaluation_policy", entity_key: "20262027",
      available_at: policy.approvedAt, payload_hash: playerForecastSourcePayloadHash(policy), payload: policy };
    const review: ContributionValidationReview = { version: "baseline-validation-review-v1",
      seasonId: 20262027, policyVersion: "baseline-v1", candidateInputHash,
      policyHash: policyRow.payload_hash, bundleChecksum: manifest.checksum,
      status: "owner_approved", eligible: true, prospectiveEvidenceRef: "prospective-evidence-1",
      ownerApprovalRef: "owner-approval-2", reviewedAt: "2026-09-28T12:00:00Z" };
    const reviewRow = { id: reviewId, provider: "fhfh", dataset_key: "baseline-validation-review-v1",
      entity_kind: "baseline_validation_review", entity_key: "20262027",
      available_at: review.reviewedAt, payload_hash: playerForecastSourcePayloadHash(review), payload: review };
    const load = async (receipts: unknown[], bundle = bundleRow, extraBundles: typeof bundleRow[] = []) => {
      let calls = 0;
      const db = { from: vi.fn(() => ({ select: () => {
        const data = calls++ === 0 ? [bundle, ...extraBundles] : receipts;
        const query: any = { in: () => query, eq: () => query };
        query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
        return query;
      } })) } as any;
      return loadApprovedContributionBundle(db, 20262027, new Date("2026-09-29T00:00:00Z"),
        { environment: { PLAYER_FORECAST_BASELINE_RELEASE_IDS: [bundle.id, ...extraBundles.map(row => row.id)].join(",") } });
    };
    const disabledDb = { from: vi.fn() } as any;
    expect(await loadApprovedContributionBundle(disabledDb, 20262027, new Date("2026-09-29T00:00:00Z"),
      { environment: {} })).toMatchObject({ sources: [], limitations: ["baseline_serving_disabled"] });
    expect(disabledDb.from).not.toHaveBeenCalled();
    expect(await load([])).toMatchObject({ sources: [], limitations: ["baseline_review_unverified"] });
    const wrongCandidatePolicy = { ...policy, candidateInputHash: "different-candidate" };
    expect(await load([{ ...policyRow, payload: wrongCandidatePolicy,
      payload_hash: playerForecastSourcePayloadHash(wrongCandidatePolicy) }, reviewRow]))
      .toMatchObject({ sources: [], limitations: ["baseline_review_unverified"] });
    expect(await load([policyRow, { ...reviewRow, payload: { ...review, policyHash: "forged" } }]))
      .toMatchObject({ sources: [], limitations: ["baseline_review_unverified"] });
    const mismatchedReview = { ...review, bundleChecksum: "another-bundle" };
    expect(await load([policyRow, { ...reviewRow, payload: mismatchedReview,
      payload_hash: playerForecastSourcePayloadHash(mismatchedReview) }]))
      .toMatchObject({ sources: [], limitations: ["baseline_review_unverified"] });
    const approved = await load([policyRow, reviewRow]);
    expect(approved.sources).toEqual([{ ...source, allowedUses: { assignment: true,
      totals: true, comparison: true, conditionalTieBreak: false } }]);
    expect(approved.checksum).toBe(manifest.checksum);
    expect(approved.manifests).toEqual([manifest]);
    const scopedPolicy = { ...policy, allowedPublicUses: ["assignment", "conditionalTieBreak"] as ContributionEvaluationPolicy["allowedPublicUses"] };
    const scopedPolicyRow = { ...policyRow, payload: scopedPolicy,
      payload_hash: playerForecastSourcePayloadHash(scopedPolicy) };
    const scopedReview = { ...review, policyHash: scopedPolicyRow.payload_hash };
    const scopedReviewRow = { ...reviewRow, payload: scopedReview,
      payload_hash: playerForecastSourcePayloadHash(scopedReview) };
    expect((await load([scopedPolicyRow, scopedReviewRow])).sources[0].allowedUses)
      .toEqual({ assignment: true, totals: false, comparison: false, conditionalTieBreak: true });
    const secondBundle = (overrides: Partial<ContributionSource>) => {
      const nextSource = { ...source, sourceId: "goalie-rate", policyVersion: "goalie-baseline-v1",
        playerId: 8, nhlPlayerId: 88, targetKey: "SAVES_GOALIE", ...overrides };
      const nextManifest = { ...manifestWithoutChecksum, policyVersion: nextSource.policyVersion,
        evaluationPolicyId: "55555555-5555-4555-8555-555555555555",
        reviewId: "66666666-6666-4666-8666-666666666666" };
      const payload = { manifest: { ...nextManifest,
        checksum: contributionBundleChecksum({ manifest: nextManifest, sources: [nextSource] }) }, sources: [nextSource] };
      const candidateInputHash = contributionBundleCandidateInputHash(payload);
      const nextPolicy = { ...policy, policyVersion: nextSource.policyVersion, candidateInputHash };
      const nextPolicyRow = { ...policyRow, id: nextManifest.evaluationPolicyId, payload: nextPolicy,
        payload_hash: playerForecastSourcePayloadHash(nextPolicy) };
      const nextReview = { ...review, policyVersion: nextSource.policyVersion, candidateInputHash,
        policyHash: nextPolicyRow.payload_hash, bundleChecksum: payload.manifest.checksum };
      return { row: { ...bundleRow, id: "44444444-4444-4444-8444-444444444444", payload,
        payload_hash: playerForecastSourcePayloadHash(payload) }, receipts: [nextPolicyRow,
        { ...reviewRow, id: nextManifest.reviewId, payload: nextReview, payload_hash: playerForecastSourcePayloadHash(nextReview) }] };
    };
    const goalie = secondBundle({});
    const combined = await load([policyRow, reviewRow, ...goalie.receipts], bundleRow, [goalie.row]);
    expect(combined.sources.map(row => row.targetKey)).toEqual(["shots", "SAVES_GOALIE"]);
    expect(combined.manifests).toHaveLength(2);
    expect(combined.checksum).not.toBe(manifest.checksum);
    const reversed = await load([policyRow, reviewRow, ...goalie.receipts], goalie.row, [bundleRow]);
    expect(reversed).toEqual(combined);
    const conflict = secondBundle({ playerId: source.playerId, nhlPlayerId: source.nhlPlayerId, targetKey: source.targetKey });
    expect(await load([policyRow, reviewRow, ...conflict.receipts], bundleRow, [conflict.row]))
      .toMatchObject({ sources: [], limitations: ["conflicting_release_policies"] });
    const extraPayload = { manifest, sources: [{ ...source, privateNotes: "do not expose" }] };
    expect(await load([policyRow, reviewRow], { ...bundleRow, payload: extraPayload,
      payload_hash: playerForecastSourcePayloadHash(extraPayload) } as typeof bundleRow))
      .toMatchObject({ sources: [], limitations: ["release_snapshot_invalid_or_stale"] });
  });
});
