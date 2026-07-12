import { describe, expect, it } from "vitest";

import {
  fetchYahooPlayerRows,
  latestOwnershipTimelineDate,
  matchesPositionFilter
} from "../../../../../pages/api/v1/transactions/ownership-trends";

describe("ownership-trends data contract", () => {
  it("paginates beyond the 1000-row PostgREST cap with deterministic ranges", async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      player_id: String(index + 1),
      season: 2025
    }));
    const ranges: Array<[number, number]> = [];
    const seasons: number[] = [];
    const supabase = {
      from(table: string) {
        expect(table).toBe("yahoo_players");
        return {
          from: 0,
          to: 0,
          select() {
            return this;
          },
          order() {
            return this;
          },
          range(from: number, to: number) {
            this.from = from;
            this.to = to;
            ranges.push([from, to]);
            return this;
          },
          eq(column: string, value: number) {
            expect(column).toBe("season");
            seasons.push(value);
            return this;
          },
          then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
            return Promise.resolve(
              resolve({ data: rows.slice(this.from, this.to + 1), error: null })
            );
          }
        };
      }
    };

    const result = await fetchYahooPlayerRows({
      supabase,
      select: "player_id,season",
      season: 2025
    });

    expect(result).toHaveLength(1001);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999]
    ]);
    expect(seasons).toEqual([2025, 2025]);
  });

  it("treats Yahoo forward eligibility as C/LW/RW/F rather than exact F only", () => {
    expect(matchesPositionFilter("F", ["C", "LW"], [])).toBe(true);
    expect(matchesPositionFilter("F", null, ["RW"])).toBe(true);
    expect(matchesPositionFilter("F", ["D"], ["D"])).toBe(false);
    expect(matchesPositionFilter("D", ["D"], [])).toBe(true);
  });

  it("derives freshness from the latest source timeline date rather than request time", () => {
    expect(
      latestOwnershipTimelineDate([
        { ownership_timeline: [{ date: "2026-03-12" }, { date: "2026-03-10" }] },
        { ownership_timeline: [{ date: "2026-03-14" }] }
      ])
    ).toBe("2026-03-14");
  });
});
