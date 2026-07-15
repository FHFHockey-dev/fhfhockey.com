import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DraftDiscovery from "./DraftDiscovery";

const discoveryState = vi.hoisted(() => ({
  data: null as any,
  error: null as unknown,
  isLoading: false,
  refetch: vi.fn(),
}));
const action = vi.hoisted(() => ({
  error: null as unknown,
  isPending: false,
  mutate: vi.fn(),
}));

vi.mock("hooks/useDraftDiscovery", () => ({
  useDraftDiscovery: () => discoveryState,
}));
vi.mock("hooks/useDraftPlayerActions", () => ({
  useDraftPlayerActions: () => ({ action }),
}));

describe("DraftDiscovery", () => {
  beforeEach(() => {
    action.error = null;
    action.isPending = false;
    action.mutate.mockReset();
    discoveryState.error = null;
    discoveryState.isLoading = false;
    discoveryState.refetch.mockReset();
  });

  it("explains a valid empty state instead of inventing recommendations", () => {
    discoveryState.data = {
      status: "empty",
      message:
        "New 2026–27 projection sources have not landed yet. FHFH is withholding projection-based suggestions.",
      refresh: {
        completedAt: "2026-07-15T05:56:00.000Z",
      },
      sourceHealth: [
        { health_state: "available" },
        { health_state: "season_mismatch" },
      ],
      cards: [],
    };
    render(
      <DraftDiscovery rankingId="ranking-1" enabled onCompare={vi.fn()} />,
    );
    expect(
      screen.getByText("No recommendations are being forced."),
    ).toBeTruthy();
    expect(
      screen.getByText(/withholding projection-based suggestions/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/1 verified sources ready · 1 waiting/i),
    ).toBeTruthy();
  });

  it("persists discovery-origin actions and starts assisted placement", () => {
    const onCompare = vi.fn();
    action.mutate.mockImplementation((_input, options) =>
      options?.onSuccess?.(),
    );
    discoveryState.data = {
      status: "available",
      message: null,
      refresh: { completedAt: "2026-09-01T12:00:00.000Z" },
      sourceHealth: [{ health_state: "available" }],
      cards: [
        {
          playerId: 10,
          type: "cutoff_challenger",
          score: 35,
          reasonCode: "candidate_bench_projection_challenger",
          reason:
            "Currently #260 on your board, with a consensus projection 35 places higher.",
          sources: ["projection:source-a", "projection:source-b"],
          sourceDate: "2026-09-01",
          sourceObservedAt: "2026-09-01T08:00:00.000Z",
          expiresAt: "2026-09-03T08:00:00.000Z",
          evidence: {},
          personalRank: 260,
          onBoard: true,
          watched: false,
          player: {
            canonicalName: "Verified Player",
            position: "C",
            organizationName: "Example Club",
            headshotUrl: null,
            lifecycleStatus: "active_nhl",
          },
        },
      ],
    };
    render(
      <DraftDiscovery rankingId="ranking-1" enabled onCompare={onCompare} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Watch" }));
    expect(action.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: 10,
        action: "watch",
        sourceContext: "discovery",
      }),
      undefined,
    );

    fireEvent.click(screen.getByRole("button", { name: "Compare now" }));
    expect(action.mutate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        playerId: 10,
        action: "compare_now",
        sourceContext: "discovery",
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(onCompare).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: 10,
        canonicalName: "Verified Player",
      }),
    );
  });
});
