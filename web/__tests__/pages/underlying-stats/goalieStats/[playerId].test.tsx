import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GoalieUnderlyingStatsDetailRoute from "../../../../pages/underlying-stats/goalieStats/[playerId]";

const sharedDetailPageMock = vi.fn(() => <div>Shared player detail page</div>);

const routerMock = {
  isReady: true,
  pathname: "/underlying-stats/goalieStats/[playerId]",
  query: {} as Record<string, string>,
  replace: vi.fn().mockResolvedValue(true),
};

vi.mock("next/router", () => ({
  useRouter: () => routerMock,
}));

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../../../../pages/underlying-stats/playerStats/[playerId]", () => ({
  default: (props: { variant?: string }) => sharedDetailPageMock(props),
}));

describe("GoalieUnderlyingStatsDetailRoute", () => {
  beforeEach(() => {
    routerMock.isReady = true;
    routerMock.pathname = "/underlying-stats/goalieStats/[playerId]";
    routerMock.query = {
      playerId: "8475883",
    };
    routerMock.replace.mockClear();
    sharedDetailPageMock.mockClear();
  });

  it("canonicalizes the goalie detail route into goalie mode while preserving playerId", async () => {
    render(<GoalieUnderlyingStatsDetailRoute />);

    expect(screen.getByText("Loading goalie detail query...")).toBeTruthy();

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith(
        {
          pathname: "/underlying-stats/goalieStats/[playerId]",
          query: expect.objectContaining({
            playerId: "8475883",
            statMode: "goalies",
      sharedDetailPageMock.mockClear();
      sharedDetailPageMock.mockClear();
            sortKey: "savePct",
            sortDirection: "desc",
          }),
        },
        undefined,
        { shallow: true }
      );
    });

    expect(screen.queryByText("Shared player detail page")).toBeNull();
  });

  it("renders the shared detail page once the goalie detail query is already canonical", () => {
    routerMock.query = {
      playerId: "8475883",
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
      expect(sharedDetailPageMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "goalie" })
      );
      pageSize: "50",
    };

    render(<GoalieUnderlyingStatsDetailRoute />);

    expect(screen.getByText("Shared player detail page")).toBeTruthy();
    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(sharedDetailPageMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "goalie" })
    );
  });
});
