import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  seasonQuery: {
    data: undefined as { seasonId: number } | null | undefined,
    isPending: true,
    isError: false,
  },
  weekRequests: [] as Promise<{
    data: Array<{
      season: string;
      week: number;
      start_date: string;
      end_date: string;
    }>;
    error: null;
  }>[],
  from: vi.fn(),
  fetchAllPages: vi.fn(),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function createBuilder(table: string) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "gte", "lte"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.order = vi.fn(() => {
    if (table !== "yahoo_matchup_weeks") return builder;
    const request = mocks.weekRequests.shift();
    if (!request) throw new Error("Missing matchup-week test response");
    return request;
  });
  builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  return builder;
}

vi.mock("hooks/useCurrentSeason", () => ({
  useCurrentSeasonQuery: () => mocks.seasonQuery,
}));

vi.mock("lib/supabase", () => ({
  default: {
    from: mocks.from,
  },
}));

vi.mock("utils/fetchAllPages", () => ({
  fetchAllPages: mocks.fetchAllPages,
}));

vi.mock("components/GoaliePage/GoalieLeaderboard", () => ({
  default: () => <div data-testid="goalie-leaderboard" />,
}));

vi.mock("components/GoaliePage/GoalieList", () => ({
  default: () => <div data-testid="goalie-list" />,
}));

vi.mock("components/GoaliePage/goalieCalculations", () => ({
  calculateGoalieRankings: () => [],
}));

import TrueGoalieValuePage from "pages/trueGoalieValue";

describe("trueGoalieValue request state", () => {
  beforeEach(() => {
    mocks.seasonQuery.data = undefined;
    mocks.seasonQuery.isPending = true;
    mocks.seasonQuery.isError = false;
    mocks.weekRequests.length = 0;
    mocks.from.mockReset();
    mocks.from.mockImplementation((table: string) => createBuilder(table));
    mocks.fetchAllPages.mockReset();
    mocks.fetchAllPages.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a terminal season error instead of an infinite loading state", async () => {
    mocks.seasonQuery.isPending = false;
    mocks.seasonQuery.isError = true;

    render(<TrueGoalieValuePage />);

    expect(
      await screen.findByText("Error: Unable to load the current season."),
    ).toBeTruthy();
    expect(screen.queryByText("Loading current season...")).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("renders an explicit unavailable state for a successful null season", async () => {
    mocks.seasonQuery.data = null;
    mocks.seasonQuery.isPending = false;

    render(<TrueGoalieValuePage />);

    expect(
      await screen.findByText("Error: No current season is available."),
    ).toBeTruthy();
    expect(screen.queryByText("Loading current season...")).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("ignores a stale matchup-week response after the season changes", async () => {
    const oldSeasonRequest = createDeferred<{
      data: Array<{
        season: string;
        week: number;
        start_date: string;
        end_date: string;
      }>;
      error: null;
    }>();
    const currentSeasonRequest = createDeferred<{
      data: Array<{
        season: string;
        week: number;
        start_date: string;
        end_date: string;
      }>;
      error: null;
    }>();
    mocks.weekRequests.push(
      oldSeasonRequest.promise,
      currentSeasonRequest.promise,
    );
    mocks.seasonQuery.data = { seasonId: 20242025 };
    mocks.seasonQuery.isPending = false;

    const { rerender } = render(<TrueGoalieValuePage />);
    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(1));

    mocks.seasonQuery.data = { seasonId: 20252026 };
    rerender(<TrueGoalieValuePage />);
    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(2));

    await act(async () => {
      currentSeasonRequest.resolve({
        data: [
          {
            season: "2025",
            week: 2,
            start_date: "2025-10-13",
            end_date: "2025-10-19",
          },
        ],
        error: null,
      });
    });

    expect(
      await screen.findAllByRole("option", { name: /Week 2/ }),
    ).toHaveLength(2);

    await act(async () => {
      oldSeasonRequest.resolve({
        data: [
          {
            season: "2024",
            week: 1,
            start_date: "2024-10-07",
            end_date: "2024-10-13",
          },
        ],
        error: null,
      });
    });

    expect(screen.queryByRole("option", { name: /Week 1/ })).toBeNull();
    expect(screen.getAllByRole("option", { name: /Week 2/ })).toHaveLength(2);
  });
});
