import { act, renderHook, waitFor } from "@testing-library/react";
import moment from "moment";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useHomepageGames } from "./useHomepageGames";

vi.mock("lib/cors-fetch", () => ({ default: vi.fn() }));

describe("useHomepageGames", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("preserves selected-date navigation and exposes schedule errors", async () => {
    const today = moment().format("YYYY-MM-DD");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: "Schedule temporarily unavailable." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useHomepageGames({
        initialGames: [{ id: 1 }],
        nextGameDate: today,
      }),
    );

    expect(result.current.currentDate).toBe(today);
    expect(result.current.gamesHeaderText).toBe("Today's");

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe("Schedule temporarily unavailable.");
    });

    expect(fetchMock).toHaveBeenCalledWith(`/api/v1/games?date=${today}`);

    act(() => result.current.changeDate(1));

    expect(result.current.currentDate).toBe(
      moment(today).add(1, "day").format("YYYY-MM-DD"),
    );
    expect(result.current.gamesHeaderText).toBe("Tomorrow's");
  });
});
