import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GoalieUnderlyingStatsLandingRoute from "../../../../pages/underlying-stats/goalieStats/index";

const sharedLandingPageMock = vi.fn((_props?: { variant?: string }) => (
  <div>Shared player landing page</div>
));

const routerMock = {
  isReady: true,
  pathname: "/underlying-stats/goalieStats",
  query: {} as Record<string, string>,
  replace: vi.fn().mockResolvedValue(true),
};

vi.mock("next/router", () => ({
  useRouter: () => routerMock,
}));

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../../../../pages/underlying-stats/playerStats/index", () => ({
  default: (props: { variant?: string }) => sharedLandingPageMock(props)
}));

describe("GoalieUnderlyingStatsLandingRoute", () => {
  beforeEach(() => {
    routerMock.isReady = true;
    routerMock.pathname = "/underlying-stats/goalieStats";
    routerMock.query = {};
    routerMock.replace.mockClear();
    sharedLandingPageMock.mockClear();
  });

  it("canonicalizes the goalie landing route into goalie mode before rendering the shared landing page", async () => {
    render(<GoalieUnderlyingStatsLandingRoute />);

    expect(screen.getByText("Loading goalie underlying stats...")).toBeTruthy();

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith(
        {
          pathname: "/underlying-stats/goalieStats",
          query: expect.objectContaining({
            statMode: "goalies",
            displayMode: "counts",
            sortKey: "savePct",
            sortDirection: "desc",
            page: "1",
            pageSize: "100",
          }),
        },
        undefined,
        { shallow: true }
      );
    });

    expect(screen.queryByText("Shared player landing page")).toBeNull();
  });

  it("renders the shared landing page once the goalie query is already canonical", () => {
    routerMock.query = {
      fromSeasonId: "20252026",
      throughSeasonId: "20252026",
      seasonType: "regularSeason",
      strength: "fiveOnFive",
      scoreState: "allScores",
      statMode: "goalies",
      displayMode: "counts",
      venue: "all",
      tradeMode: "combine",
      scope: "none",
      sortKey: "savePct",
      sortDirection: "desc",
      page: "1",
      pageSize: "100",
    };

    render(<GoalieUnderlyingStatsLandingRoute />);

    expect(screen.getByText("Shared player landing page")).toBeTruthy();
    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(sharedLandingPageMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "goalie" })
    );
  });
});
