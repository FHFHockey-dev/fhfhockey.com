import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("lib/supabase/server", () => ({
  default: { from: fromMock, rpc: rpcMock },
}));

import {
  issueDraftPairPrompt,
  loadDraftContributionPreference,
  setDraftContributionPreference,
  submitDraftPairComparison,
} from "./server";

describe("Draft Ranker pairwise server operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a private disabled default when no consent row exists", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle,
    };
    fromMock.mockReturnValue(builder);

    await expect(loadDraftContributionPreference("owner-1")).resolves.toEqual({
      contributionEnabled: false,
      privacyPolicyVersion: null,
      consentedAt: null,
      revokedAt: null,
      updateSource: null,
      updatedAt: null,
      currentPolicyVersion: "draft-ranker-community-v1",
    });
    expect(builder.eq).toHaveBeenCalledWith("user_id", "owner-1");
  });

  it("sets consent with a server-owned policy version and source", async () => {
    rpcMock.mockResolvedValue({ data: { status: "completed" }, error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        contribution_enabled: true,
        privacy_policy_version: "draft-ranker-community-v1",
        consented_at: "2026-07-15T00:00:00Z",
        revoked_at: null,
        update_source: "draft_ranker_onboarding",
        updated_at: "2026-07-15T00:00:00Z",
      },
      error: null,
    });
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle,
    };
    fromMock.mockReturnValue(builder);

    await setDraftContributionPreference("owner-1", {
      contributionEnabled: true,
      operationId: "11111111-1111-4111-8111-111111111111",
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "set_draft_ranker_contribution_preference",
      expect.objectContaining({
        p_user_id: "owner-1",
        p_privacy_policy_version: "draft-ranker-community-v1",
        p_update_source: "draft_ranker_onboarding",
      }),
    );
  });

  it("issues a canonical server-selected prompt through the service RPC", async () => {
    rpcMock.mockResolvedValue({
      data: { status: "completed", promptId: "prompt-1" },
      error: null,
    });
    await expect(
      issueDraftPairPrompt("owner-1", {
        rankingId: "11111111-1111-4111-8111-111111111111",
        playerAId: 20,
        playerBId: 10,
        queueMode: "personal_information",
        queueReason: "Unresolved ordering",
        algorithmVersion: "deterministic_v1",
        expectedVersion: 4,
        operationId: "22222222-2222-4222-8222-222222222222",
      }),
    ).resolves.toMatchObject({ promptId: "prompt-1" });
    expect(rpcMock).toHaveBeenCalledWith(
      "issue_draft_ranker_pair_prompt_guarded",
      expect.objectContaining({
        p_user_id: "owner-1",
        p_player_a_id: 20,
        p_rate_operation_payload_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        p_rate_config: expect.objectContaining({ queueHourlyLimit: 120 }),
      }),
    );
  });

  it("submits outcome-only comparison evidence", async () => {
    rpcMock.mockResolvedValue({
      data: { status: "completed", comparisonId: "comparison-1" },
      error: null,
    });
    const input = {
      promptId: "11111111-1111-4111-8111-111111111111",
      outcome: "high" as const,
      expectedVersion: 4,
      operationId: "22222222-2222-4222-8222-222222222222",
    };
    await submitDraftPairComparison("owner-1", input);
    expect(rpcMock).toHaveBeenCalledWith(
      "submit_draft_ranker_pair_comparison_guarded",
      expect.objectContaining({
        p_user_id: "owner-1",
        p_outcome: "high",
        p_expected_version: 4,
        p_community_collection_enabled: false,
        p_rate_config: expect.objectContaining({ samePairWeeklyLimit: 3 }),
      }),
    );
  });

  it("turns a distributed hard-limit decision into a stable API error", async () => {
    rpcMock.mockResolvedValue({
      data: {
        status: "rate_limited",
        code: "response_minute_limit",
        retryAfterSeconds: 60,
      },
      error: null,
    });

    await expect(
      submitDraftPairComparison("owner-1", {
        promptId: "11111111-1111-4111-8111-111111111111",
        outcome: "low",
        expectedVersion: 4,
        operationId: "22222222-2222-4222-8222-222222222222",
      }),
    ).rejects.toMatchObject({
      statusCode: 429,
      code: "rate_limited",
      details: {
        reason: "response_minute_limit",
        retryAfterSeconds: 60,
      },
    });
  });
});
