import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CommunityRankingsPage from "./CommunityRankingsPage";

const authState = vi.hoisted(() => ({ user: null as null | { id: string } }));
const queryState = vi.hoisted(() => ({
  data: null as any,
  error: null as unknown,
  isLoading: false,
  refetch: vi.fn(),
}));

vi.mock("contexts/AuthProviderContext", () => ({ useAuth: () => authState }));
vi.mock("hooks/useCommunityDraftRankings", () => ({
  useCommunityDraftRankings: () => queryState,
}));

function row(overrides: Record<string, unknown> = {}) {
  return {
    playerId: 10,
    communityRank: 1,
    estimatedRank: 1,
    previousYahooAdp: 1.3,
    previouslyUndrafted: false,
    evidenceState: "market_seeded",
    confidenceLabel: "market prior",
    independentUsers: 0,
    comparisonCount: 0,
    distinctOpponents: 0,
    cutoffCoverage: { inside: 0, outside: 0 },
    stabilityBufferRanks: 75,
    conservativeRank: 76,
    admissionBasis: "market_prior",
    previousCommunityRank: null,
    rankChange: null,
    lastEvidenceAt: null,
    personalRank: null,
    personalDelta: null,
    player: {
      canonicalName: "Connor McDavid",
      position: "C",
      organizationName: "Edmonton Oilers",
      organizationType: "nhl",
      lifecycleStatus: "active_nhl",
      headshotUrl: null,
    },
    ...overrides,
  };
}

describe("CommunityRankingsPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    authState.user = null;
    queryState.error = null;
    queryState.isLoading = false;
    queryState.refetch.mockReset();
    queryState.data = {
      status: "market_seeded",
      message:
        "This first snapshot is seeded from verified 2025 Yahoo draft ADP. It is not presented as community consensus.",
      snapshot: {
        snapshotAsOf: "2026-07-15T06:33:03.033Z",
        acceptedComparisonCount: 0,
        modelVersion: "regularized-bradley-terry-v1",
      },
      rows: [row()],
      emerging: [],
      pagination: { page: 1, limit: 50, total: 250 },
    };
  });

  it("labels the cold start as market-seeded instead of claiming consensus", () => {
    render(<CommunityRankingsPage />);
    expect(screen.getByText("Market-seeded cold start")).toBeTruthy();
    expect(screen.getAllByText("Market seeded").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/not presented as community consensus/i),
    ).toBeTruthy();
    expect(screen.getByText("Awaiting opted-in comparisons")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Build my board" }).getAttribute("href"),
    ).toBe("/draft-rankings");
  });

  it("shows personal delta only when owner-scoped context is returned", () => {
    authState.user = { id: "owner-1" };
    queryState.data.rows = [row({ personalRank: 4, personalDelta: 3 })];
    render(<CommunityRankingsPage />);
    expect(screen.getByText("#4")).toBeTruthy();
    expect(screen.getByText("You: 3 later")).toBeTruthy();
  });

  it("renders real emerging candidates with previously-undrafted state", () => {
    queryState.data.emerging = [
      row({
        playerId: 99,
        communityRank: null,
        estimatedRank: 228,
        previousYahooAdp: null,
        previouslyUndrafted: true,
        evidenceState: "emerging",
        confidenceLabel: "limited",
        independentUsers: 8,
        comparisonCount: 14,
        distinctOpponents: 6,
        player: {
          canonicalName: "Verified Prospect",
          position: "C",
          organizationName: "Boston University",
          organizationType: "ncaa",
          lifecycleStatus: "active_prospect",
          headshotUrl: null,
        },
      }),
    ];
    render(<CommunityRankingsPage />);
    expect(
      screen.getByRole("heading", { name: "Emerging candidates" }),
    ).toBeTruthy();
    expect(screen.getByText("Verified Prospect")).toBeTruthy();
    expect(screen.getByText("Previously undrafted")).toBeTruthy();
  });

  it("pages without inventing client-side rows", () => {
    render(<CommunityRankingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Next 50" }));
    expect(screen.getByText("Page 2 of 5")).toBeTruthy();
  });
});
