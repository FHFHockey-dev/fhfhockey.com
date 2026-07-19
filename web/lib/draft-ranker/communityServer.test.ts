import { describe, expect, it, vi } from "vitest";

import {
  communityCadenceForDate,
  communityRefreshIsDue,
  persistDraftRankerCommunitySnapshot,
  type DraftRankerCommunitySnapshot,
} from "./communityServer";

function snapshot(): DraftRankerCommunitySnapshot {
  return {
    targetSeasonId: 20262027,
    snapshotAsOf: "2026-09-20T12:00:00.000Z",
    cadence: "daily",
    modelVersion: "regularized-bradley-terry-v1",
    sourceFingerprint: "a".repeat(64),
    operationPayloadHash: "b".repeat(64),
    sourceSummary: { candidateCount: 1 },
    exclusionSummary: {},
    acceptedComparisonCount: 0,
    excludedComparisonCount: 0,
    deduplicatedComparisonCount: 0,
    converged: true,
    iterations: 1,
    results: [],
  };
}

describe("Community snapshot scheduling and persistence", () => {
  it("uses daily snapshots during draft/preseason and weekly snapshots in quiet offseason", () => {
    expect(communityCadenceForDate("2026-07-15T12:00:00.000Z")).toBe("weekly");
    expect(communityCadenceForDate("2026-09-20T12:00:00.000Z")).toBe("daily");
    expect(communityCadenceForDate("2026-11-01T12:00:00.000Z")).toBe("weekly");
  });

  it("runs weekly cadence only on Sunday while manual/daily runs are always due", () => {
    expect(
      communityRefreshIsDue({
        asOf: "2026-07-19T12:00:00.000Z",
        cadence: "weekly",
      }),
    ).toBe(true);
    expect(
      communityRefreshIsDue({
        asOf: "2026-07-15T12:00:00.000Z",
        cadence: "weekly",
      }),
    ).toBe(false);
    expect(
      communityRefreshIsDue({
        asOf: "2026-07-15T12:00:00.000Z",
        cadence: "manual",
      }),
    ).toBe(true);
  });

  it("persists only through the atomic service RPC with pinned versioned payload", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { status: "completed", snapshotId: "snapshot-1" },
      error: null,
    });
    const result = await persistDraftRankerCommunitySnapshot({
      client: { rpc, from: vi.fn() },
      snapshot: snapshot(),
      operationId: "00000000-0000-4000-8000-000000000601",
    });
    expect(result.snapshotId).toBe("snapshot-1");
    expect(rpc).toHaveBeenCalledWith(
      "replace_draft_ranker_community_snapshot",
      expect.objectContaining({
        p_model_version: "regularized-bradley-terry-v1",
        p_target_season_id: 20262027,
        p_operation_id: "00000000-0000-4000-8000-000000000601",
        p_requested_by: null,
      }),
    );
  });

  it("fails closed on an RPC idempotency conflict", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { status: "conflict", message: "operation conflict" },
      error: null,
    });
    await expect(
      persistDraftRankerCommunitySnapshot({
        client: { rpc, from: vi.fn() },
        snapshot: snapshot(),
      }),
    ).rejects.toThrow("operation conflict");
  });
});
