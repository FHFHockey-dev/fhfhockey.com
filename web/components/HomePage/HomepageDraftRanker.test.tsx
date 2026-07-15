import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, rankingMock, pairwiseMock, respondMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  rankingMock: vi.fn(),
  pairwiseMock: vi.fn(),
  respondMock: vi.fn(),
}));

vi.mock("contexts/AuthProviderContext", () => ({ useAuth: authMock }));
vi.mock("hooks/useDraftRanking", () => ({ useDraftRanking: rankingMock }));
vi.mock("hooks/useDraftPairwise", () => ({ useDraftPairwise: pairwiseMock }));

import HomepageDraftRanker from "./HomepageDraftRanker";

const entries = Array.from({ length: 20 }, (_, index) => ({
  playerId: index + 1,
  rank: index + 1,
  orderKey: (index + 1) * 1024,
  seedSource: "yahoo_adp",
  seedAdp: index + 1.2,
  seedRank: index + 1,
  tier: null,
  notes: null,
  updatedAt: "2026-07-15T00:00:00Z",
  player: {
    canonical_name: `Player ${index + 1}`,
    canonical_position: index % 4 === 0 ? "D" : "C",
    current_organization_name: "NHL",
    headshot_url: null,
    lifecycle_status: "active_nhl",
  },
}));

function configureSignedIn() {
  authMock.mockReturnValue({ user: { id: "owner-1" }, isLoading: false });
  rankingMock.mockReturnValue({
    bootstrap: { isLoading: false, data: { initialized: true } },
    entries: {
      isLoading: false,
      error: null,
      data: {
        ranking: { id: "ranking-1", lockVersion: 4 },
        entries,
      },
    },
  });
  pairwiseMock.mockReturnValue({
    answers: 1,
    queue: {
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      data: {
        reviewedThroughRank: 12,
        prompt: {
          promptId: "prompt-1",
          rankingVersion: 4,
          category: "personal",
          reason: "Adjacent ranks have no explicit comparison.",
          players: [
            {
              playerId: 10,
              rank: 10,
              name: "Player 10",
              position: "C",
              organization: "NHL",
              headshotUrl: null,
              lifecycleStatus: "active_nhl",
              evidence: { yahooAdp: 10.4, previouslyUndrafted: false },
            },
            {
              playerId: 11,
              rank: 11,
              name: "Player 11",
              position: "G",
              organization: "NHL",
              headshotUrl: null,
              lifecycleStatus: "active_nhl",
              evidence: { yahooAdp: null, previouslyUndrafted: true },
            },
          ],
        },
      },
    },
    respond: {
      mutate: respondMock,
      isPending: false,
      error: null,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("HomepageDraftRanker", () => {
  it("does not create anonymous records and offers real account links", () => {
    authMock.mockReturnValue({ user: null, isLoading: false });
    render(<HomepageDraftRanker />);
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe(
      "/auth?mode=sign-in",
    );
    expect(screen.getByRole("link", { name: "Create account" })).toBeTruthy();
    expect(rankingMock).not.toHaveBeenCalled();
    expect(pairwiseMock).not.toHaveBeenCalled();
  });

  it("renders one blind matchup and a real ten-player preview", () => {
    configureSignedIn();
    render(<HomepageDraftRanker />);
    expect(screen.getByRole("heading", { name: "Who should be drafted first?" })).toBeTruthy();
    expect(screen.getByLabelText("Live ten-player ranking preview").children[1].children).toHaveLength(10);
    expect(screen.getAllByText("View evidence")[0].parentElement?.hasAttribute("open")).toBe(false);
    expect(screen.getByText("Reviewed")).toBeTruthy();
  });

  it("maps explicit player, too-close, and skip actions to bounded outcomes", () => {
    configureSignedIn();
    render(<HomepageDraftRanker />);
    fireEvent.click(screen.getByRole("button", { name: "Draft Player 10 first" }));
    fireEvent.click(screen.getByRole("button", { name: "Draft Player 11 first" }));
    fireEvent.click(screen.getByRole("button", { name: "Too close" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(respondMock.mock.calls.map(([outcome]) => outcome)).toEqual([
      "low",
      "high",
      "too_close",
      "skip",
    ]);
  });

  it("changes modes by remounting a fresh bounded session", () => {
    configureSignedIn();
    render(<HomepageDraftRanker />);
    fireEvent.change(screen.getByLabelText("Session mode"), {
      target: { value: "quick_five" },
    });
    expect(pairwiseMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: "quick_five" }),
    );
  });
});
