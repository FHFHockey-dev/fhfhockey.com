import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  actionMutateMock,
  mutateMock,
  resetMock,
  useDraftPlayerActionsMock,
  useDraftPlayerSearchMock,
  onPlacePlayerMock,
} = vi.hoisted(() => ({
  actionMutateMock: vi.fn(),
  mutateMock: vi.fn(),
  resetMock: vi.fn(),
  useDraftPlayerActionsMock: vi.fn(),
  useDraftPlayerSearchMock: vi.fn(),
  onPlacePlayerMock: vi.fn(),
}));

vi.mock("hooks/useDraftPlayerSearch", () => ({
  useDraftPlayerSearch: useDraftPlayerSearchMock,
}));
vi.mock("hooks/useDraftPlayerActions", () => ({
  useDraftPlayerActions: useDraftPlayerActionsMock,
}));

import DraftPlayerSearch from "./DraftPlayerSearch";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function configureSearch() {
  useDraftPlayerActionsMock.mockReturnValue({
    state: { data: { watchlist: [], preferences: [] } },
    action: { mutate: actionMutateMock, isPending: false, error: null },
  });
  useDraftPlayerSearchMock.mockReturnValue({
    debouncedQuery: "Elias Pettersson",
    search: {
      data: {
        results: [
          {
            playerId: 10,
            canonicalName: "Elias Pettersson",
            birthYear: 1998,
            position: "C",
            organizationName: "Vancouver Canucks",
            organizationType: "nhl",
            lifecycleStatus: "active_nhl",
            headshotUrl: null,
            yahooPlayerId: "6789",
            isRankable: true,
          },
          {
            playerId: 11,
            canonicalName: "Elias Pettersson",
            birthYear: 2004,
            position: "D",
            organizationName: "Vancouver Canucks",
            organizationType: "nhl",
            lifecycleStatus: "active_prospect",
            headshotUrl: null,
            yahooPlayerId: null,
            isRankable: true,
          },
        ],
      },
      isLoading: false,
      error: null,
    },
    requestAddition: {
      mutate: mutateMock,
      reset: resetMock,
      isPending: false,
      error: null,
      data: null,
    },
  });
}

describe("DraftPlayerSearch", () => {
  it("disambiguates duplicate names and identifies board membership", () => {
    configureSearch();
    render(
      <DraftPlayerSearch
        rankingId="ranking-1"
        rankedPlayerIds={[10]}
        onPlacePlayer={onPlacePlayerMock}
      />,
    );

    expect(screen.getAllByText("Elias Pettersson")).toHaveLength(2);
    expect(screen.getByText("1998 · C · Vancouver Canucks")).toBeTruthy();
    expect(screen.getByText("2004 · D · Vancouver Canucks")).toBeTruthy();
    expect(screen.getByText("On your board")).toBeTruthy();
    expect(screen.getByText("Prospect · No Yahoo ID")).toBeTruthy();
  });

  it("submits a review request without creating a free-form identity", () => {
    configureSearch();
    render(
      <DraftPlayerSearch
        rankingId="ranking-1"
        rankedPlayerIds={[]}
        onPlacePlayer={onPlacePlayerMock}
      />,
    );

    fireEvent.change(screen.getByLabelText("Player name or NHL/Yahoo ID"), {
      target: { value: "Elias Pettersson" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Can’t find the player? Request a review",
      }),
    );
    fireEvent.change(screen.getByLabelText("Current team or organization"), {
      target: { value: "Växjö Lakers" },
    });
    fireEvent.change(
      screen.getByLabelText("Why should this player be available?"),
      { target: { value: "Verified prospect" } },
    );
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Submit for editorial review" })
        .closest("form")!,
    );

    expect(mutateMock).toHaveBeenCalledWith({
      rawName: "Elias Pettersson",
      organization: "Växjö Lakers",
      position: undefined,
      notes: "Verified prospect",
      candidatePlayerIds: [10, 11],
    });
    expect(
      screen.getByText(/never creates an unverified player identity/i),
    ).toBeTruthy();
  });

  it("persists watch and discovery preferences with unique operations", () => {
    configureSearch();
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "11111111-1111-4111-8111-111111111111",
    );
    render(
      <DraftPlayerSearch
        rankingId="ranking-1"
        rankedPlayerIds={[]}
        onPlacePlayer={onPlacePlayerMock}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Watch" })[0]);
    expect(actionMutateMock).toHaveBeenCalledWith({
      playerId: 10,
      action: "watch",
      operationId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("keeps watched players visible outside the ordered ranking", () => {
    configureSearch();
    useDraftPlayerActionsMock.mockReturnValue({
      state: {
        data: {
          watchlist: [
            {
              playerId: 11,
              player: {
                canonical_name: "Elias Pettersson",
                canonical_position: "D",
                current_organization_name: "Vancouver Canucks",
              },
            },
          ],
          preferences: [],
        },
      },
      action: { mutate: actionMutateMock, isPending: false, error: null },
    });

    render(
      <DraftPlayerSearch
        rankingId="ranking-1"
        rankedPlayerIds={[]}
        onPlacePlayer={onPlacePlayerMock}
      />,
    );
    expect(screen.getByText("1 unplaced · 0 placed")).toBeTruthy();
    expect(screen.getByText("D · Vancouver Canucks")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
  });

  it("keeps watched ranked players visible as placed interests", () => {
    configureSearch();
    useDraftPlayerActionsMock.mockReturnValue({
      state: {
        data: {
          watchlist: [
            {
              playerId: 11,
              player: {
                canonical_name: "Elias Pettersson",
                canonical_position: "D",
                current_organization_name: "Vancouver Canucks",
              },
            },
          ],
          preferences: [],
        },
      },
      action: { mutate: actionMutateMock, isPending: false, error: null },
    });

    render(
      <DraftPlayerSearch
        rankingId="ranking-1"
        rankedPlayerIds={[11]}
        onPlacePlayer={onPlacePlayerMock}
      />,
    );

    expect(screen.getByText("0 unplaced · 1 placed")).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "Re-evaluate" }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("starts real assisted placement from canonical search results", () => {
    configureSearch();
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "11111111-1111-4111-8111-111111111111",
    );
    render(
      <DraftPlayerSearch
        rankingId="ranking-1"
        rankedPlayerIds={[]}
        onPlacePlayer={onPlacePlayerMock}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Place" })[0]);
    expect(actionMutateMock).toHaveBeenCalledWith({
      playerId: 10,
      action: "compare_now",
      operationId: "11111111-1111-4111-8111-111111111111",
    });
    expect(onPlacePlayerMock).toHaveBeenCalledWith({
      playerId: 10,
      canonicalName: "Elias Pettersson",
      position: "C",
      organizationName: "Vancouver Canucks",
      headshotUrl: null,
    });
  });
});
