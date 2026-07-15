import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DraftPlacementSession } from "hooks/useDraftPlacement";
import { DraftRankerClientError } from "lib/draft-ranker/client";

import AssistedPlacementPanel from "./AssistedPlacementPanel";

afterEach(cleanup);

const candidate = {
  playerId: 99,
  canonicalName: "Real Prospect",
  position: "C",
  organizationName: "Boston College",
  headshotUrl: null,
};

function activeSession(ready = false): DraftPlacementSession {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    rankingId: "22222222-2222-4222-8222-222222222222",
    playerId: 99,
    status: "active",
    rankingVersion: 4,
    expiresAt: "2026-07-16T00:00:00Z",
    engineVersion: "deterministic_v1",
    createdAt: "2026-07-15T00:00:00Z",
    updatedAt: "2026-07-15T00:01:00Z",
    completedAt: null,
    player: {
      canonical_name: "Real Prospect",
      canonical_position: "C",
      current_organization_name: "Boston College",
      headshot_url: null,
      lifecycle_status: "active_prospect",
    },
    state: {
      roughRange: "top_50",
      intervalLow: ready ? 12 : 1,
      intervalHigh: ready ? 12 : 50,
      plausibleLow: ready ? 12 : null,
      plausibleHigh: ready ? 12 : null,
      questionCount: ready ? 5 : 0,
      contradictionCount: 0,
      issuedAnchors: ready
        ? []
        : [
            {
              sequence: 1,
              playerId: 10,
              rank: 25,
              mode: "narrow",
              intervalLow: 1,
              intervalHigh: 50,
            },
          ],
      answers: [],
      suggestedRank: ready ? 12 : null,
      ready,
      confidence: ready ? "strong" : "developing",
      completionReason: ready ? "validated_interval" : null,
    },
    currentAnchor: ready
      ? null
      : {
          sequence: 1,
          playerId: 10,
          rank: 25,
          mode: "narrow",
          intervalLow: 1,
          intervalHigh: 50,
        },
    anchorPlayer: ready
      ? null
      : {
          id: 10,
          canonical_name: "Anchor Player",
          canonical_position: "D",
          current_organization_name: "NHL Club",
          headshot_url: null,
          lifecycle_status: "active_nhl",
        },
    neighbors: ready
      ? {
          above: {
            playerId: 8,
            rank: 11,
            player: {
              canonical_name: "Above Player",
              canonical_position: "LW",
              current_organization_name: "Club A",
              headshot_url: null,
              lifecycle_status: "active_nhl",
            },
          },
          below: {
            playerId: 9,
            rank: 12,
            player: {
              canonical_name: "Below Player",
              canonical_position: "RW",
              current_organization_name: "Club B",
              headshot_url: null,
              lifecycle_status: "active_nhl",
            },
          },
        }
      : null,
  };
}

function mutation(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({ session: activeSession() }),
    reset: vi.fn(),
    isPending: false,
    error: null,
    data: undefined,
    ...overrides,
  } as any;
}

describe("AssistedPlacementPanel", () => {
  it("starts from an optional rough range using the current board version", async () => {
    const placementMutation = mutation();
    render(
      <AssistedPlacementPanel
        candidate={candidate}
        rankingId="22222222-2222-4222-8222-222222222222"
        currentVersion={7}
        session={null}
        mutation={placementMutation}
        onFinished={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /top 50/i }));
    await waitFor(() =>
      expect(placementMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "start",
          playerId: 99,
          expectedVersion: 7,
          roughRange: "top_50",
        }),
      ),
    );
  });

  it("resumes a persisted session and records only a matchup outcome", () => {
    const placementMutation = mutation();
    render(
      <AssistedPlacementPanel
        candidate={null}
        rankingId="22222222-2222-4222-8222-222222222222"
        currentVersion={4}
        session={activeSession()}
        mutation={placementMutation}
        onFinished={vi.fn()}
      />,
    );
    expect(screen.getByText("Comparison 1 of at most 12")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /draft first real prospect/i }),
    );
    expect(placementMutation.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "answer",
        outcome: "target_over_anchor",
      }),
    );
    expect(placementMutation.mutate.mock.calls[0][0]).not.toHaveProperty(
      "intervalLow",
    );
  });

  it("shows transparent neighbors before confirmation", async () => {
    const onFinished = vi.fn();
    const placementMutation = mutation({
      mutateAsync: vi.fn().mockResolvedValue({
        session: { ...activeSession(true), status: "confirmed" },
      }),
    });
    render(
      <AssistedPlacementPanel
        candidate={null}
        rankingId="22222222-2222-4222-8222-222222222222"
        currentVersion={4}
        session={activeSession(true)}
        mutation={placementMutation}
        onFinished={onFinished}
      />,
    );
    expect(screen.getByText("Above Player")).toBeTruthy();
    expect(screen.getByText("Below Player")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirm rank #12" }));
    await waitFor(() => expect(onFinished).toHaveBeenCalled());
  });

  it("restarts stale placement against the refreshed board version", async () => {
    const placementMutation = mutation({
      error: new DraftRankerClientError(409, {
        code: "stale_ranking_version",
        message: "The ranking changed.",
      }),
      mutateAsync: vi
        .fn()
        .mockResolvedValueOnce({
          session: { ...activeSession(), status: "cancelled" },
        })
        .mockResolvedValueOnce({ session: activeSession() }),
    });
    render(
      <AssistedPlacementPanel
        candidate={null}
        rankingId="22222222-2222-4222-8222-222222222222"
        currentVersion={9}
        session={activeSession()}
        mutation={placementMutation}
        onFinished={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Revalidate placement" }),
    );
    await waitFor(() =>
      expect(placementMutation.mutateAsync).toHaveBeenCalledTimes(2),
    );
    expect(placementMutation.mutateAsync.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        action: "start",
        expectedVersion: 9,
        playerId: 99,
        roughRange: "top_50",
      }),
    );
  });
});
