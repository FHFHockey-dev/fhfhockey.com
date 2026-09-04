import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { eqMock, maybeSingleMock, publicSupabaseMock } = vi.hoisted(() => {
  const maybeSingleMock = vi.fn();
  const builder: Record<string, unknown> = {};
  const chain = vi.fn(() => builder);
  builder.select = chain;
  builder.eq = chain;
  builder.lte = chain;
  builder.gte = chain;
  builder.order = chain;
  builder.limit = chain;
  builder.maybeSingle = maybeSingleMock;
  return {
    eqMock: chain,
    maybeSingleMock,
    publicSupabaseMock: { from: vi.fn(() => builder) },
  };
});

vi.mock("lib/supabase/public-client", () => ({
  default: publicSupabaseMock,
}));

import useYahooCurrentMatchupWeek from "./useYahooCurrentMatchupWeek";

describe("useYahooCurrentMatchupWeek", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingleMock.mockResolvedValue({
      data: {
        week: 3,
        start_date: "2026-10-19",
        end_date: "2026-10-25",
      },
      error: null,
    });
  });

  it("scopes the calendar lookup to the selected Yahoo game key", async () => {
    const { result } = renderHook(() =>
      useYahooCurrentMatchupWeek("2026", "2026-10-21", "999"),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(publicSupabaseMock.from).toHaveBeenCalledWith(
      "yahoo_matchup_weeks",
    );
    expect(eqMock).toHaveBeenCalledWith("game_key", "999");
    expect(eqMock).toHaveBeenCalledWith("season", "2026");
    expect(result.current).toMatchObject({
      weekNumber: 3,
      dateRange: { start: "2026-10-19", end: "2026-10-25" },
      error: null,
    });
  });
});
