import { describe, expect, it, vi } from "vitest";
import { fetchDistinctUnderlyingStatsSnapshotDates } from "./availableSnapshotDates";

type SnapshotDateRow = {
  date: string | null;
};

const createSupabaseClient = (pages: SnapshotDateRow[][]) => {
  const rangeMock = vi.fn((from: number, to: number) => {
    const pageIndex = Math.floor(from / 128);
    expect(to - from + 1).toBe(128);
    return Promise.resolve({
      data: pages[pageIndex] ?? [],
      error: null
    });
  });

  const orderMock = vi.fn(() => ({
    range: rangeMock
  }));

  const selectMock = vi.fn(() => ({
    order: orderMock
  }));

  return {
    from: vi.fn((table: string) => {
      expect(table).toBe("team_power_ratings_daily");
      return {
        select: selectMock
      };
    }),
    rangeMock
  };
};

describe("fetchDistinctUnderlyingStatsSnapshotDates", () => {
  it("keeps paging until it has enough unique snapshot dates", async () => {
    const firstPage = Array.from({ length: 128 }, (_, index) => ({
      date: index < 64 ? "2026-04-05" : "2026-04-04"
    }));
    const secondPage = Array.from({ length: 128 }, (_, index) => ({
      date: index < 64 ? "2026-04-03" : "2026-04-02"
    }));
    const thirdPage = [{ date: "2026-04-01" }];
    const supabase = createSupabaseClient([firstPage, secondPage, thirdPage]);

    const result = await fetchDistinctUnderlyingStatsSnapshotDates(5, supabase as any);

    expect(result).toEqual([
      "2026-04-05",
      "2026-04-04",
      "2026-04-03",
      "2026-04-02",
      "2026-04-01"
    ]);
    expect(supabase.rangeMock).toHaveBeenCalledTimes(3);
  });

  it("returns all available dates when the source exhausts early", async () => {
    const supabase = createSupabaseClient([
      [
        { date: "2026-04-05" },
        { date: "2026-04-05" },
        { date: "2026-04-04" },
        { date: null }
      ]
    ]);

    const result = await fetchDistinctUnderlyingStatsSnapshotDates(10, supabase as any);

    expect(result).toEqual(["2026-04-05", "2026-04-04"]);
    expect(supabase.rangeMock).toHaveBeenCalledTimes(1);
  });
});
