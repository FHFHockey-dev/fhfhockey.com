import { describe, expect, it, vi } from "vitest";

import {
  parseRosterScheduleReadFilter,
  readRosterSchedule,
  type ScheduleReadClient,
} from "./query";

function createQuery(data: unknown[]) {
  const calls: Array<[string, unknown, unknown?]> = [];
  const client = {
    from: vi.fn(() => ({
      select: vi.fn(() => {
        let rangeStart = 0;
        let rangeEnd = data.length - 1;
        const builder = {
          eq: vi.fn((column: string, value: unknown) => {
            calls.push(["eq", column, value]);
            return builder;
          }),
          gte: vi.fn((column: string, value: unknown) => {
            calls.push(["gte", column, value]);
            return builder;
          }),
          lte: vi.fn((column: string, value: unknown) => {
            calls.push(["lte", column, value]);
            return builder;
          }),
          order: vi.fn((column: string, value: unknown) => {
            calls.push(["order", column, value]);
            return builder;
          }),
          range: vi.fn((from: number, to: number) => {
            calls.push(["range", from, to]);
            rangeStart = from;
            rangeEnd = to;
            return builder;
          }),
          then(resolve: (value: unknown) => unknown) {
            return Promise.resolve({
              data: data.slice(rangeStart, rangeEnd + 1),
              error: null,
            }).then(resolve);
          },
        };
        return builder;
      }),
    })),
  } as unknown as ScheduleReadClient;
  return { calls, client };
}

describe("roster schedule query", () => {
  it("centralizes the default game key and matchup-week range", () => {
    expect(parseRosterScheduleReadFilter({})).toEqual({
      gameKey: "477",
      startWeek: 1,
      endWeek: 30,
    });
    expect(() =>
      parseRosterScheduleReadFilter({ startWeek: "20", endWeek: "2" }),
    ).toThrow("endWeek");
  });

  it("loads the matrix and excludes non-countable rows", async () => {
    const { calls, client } = createQuery([{ id: 1 }]);
    await expect(
      readRosterSchedule(client, {
        gameKey: "477",
        startWeek: 3,
        endWeek: 6,
      }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(client.from).toHaveBeenCalledOnce();
    expect(calls).toEqual(
      expect.arrayContaining([
        ["eq", "game_key", "477"],
        ["gte", "week", 3],
        ["lte", "week", 6],
        ["eq", "mapping_status", "mapped"],
        ["eq", "is_countable", true],
        ["range", 0, 999],
      ]),
    );
  });

  it("loads every page when the matrix exceeds the Data API row limit", async () => {
    const rows = Array.from({ length: 1_001 }, (_, id) => ({ id }));
    const { calls, client } = createQuery(rows);

    await expect(
      readRosterSchedule(client, {
        gameKey: "477",
        startWeek: 1,
        endWeek: 30,
      }),
    ).resolves.toEqual(rows);

    expect(client.from).toHaveBeenCalledTimes(2);
    expect(calls.filter(([method]) => method === "range")).toEqual([
      ["range", 0, 999],
      ["range", 1_000, 1_999],
    ]);
  });
});
