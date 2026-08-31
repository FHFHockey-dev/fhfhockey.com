import { describe, expect, it, vi } from "vitest";

import {
  parseRosterScheduleReadFilter,
  readRosterSchedule,
  type ScheduleReadClient,
} from "./query";

function createQuery(data: unknown[]) {
  const calls: Array<[string, unknown, unknown?]> = [];
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
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve({ data, error: null }).then(resolve);
    },
  };
  const client = {
    from: vi.fn(() => ({ select: vi.fn(() => builder) })),
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

  it("loads the matrix in one bounded query and excludes non-countable rows", async () => {
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
      ]),
    );
  });
});

