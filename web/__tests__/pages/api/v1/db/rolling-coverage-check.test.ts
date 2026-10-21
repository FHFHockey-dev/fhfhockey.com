import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { tables, fromMock, writeMock } = vi.hoisted(() => ({
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  fromMock: vi.fn(),
  writeMock: vi.fn()
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler
}));
vi.mock("lib/cron/nhlOffSeason", () => ({
  withNhlOffSeasonSkip: (handler: any) => handler
}));
vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler
}));
vi.mock("lib/supabase/server", () => ({
  default: {
    from: (table: string) => {
      fromMock(table);
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      const query: any = {
        select: () => query,
        gte: (column: string, value: string) => {
          filters.push((row) => String(row[column]) >= value);
          return query;
        },
        lte: (column: string, value: string) => {
          filters.push((row) => String(row[column]) <= value);
          return query;
        },
        order: () => query,
        range: async (from: number, to: number) => ({
          data: (tables[table] ?? [])
            .filter((row) => filters.every((filter) => filter(row)))
            .slice(from, to + 1),
          error: null
        }),
        insert: writeMock,
        update: writeMock,
        upsert: writeMock,
        delete: writeMock
      };
      return query;
    }
  }
}));

import handler from "pages/api/v1/db/rolling-coverage-check";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    setHeader: vi.fn(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

const STRENGTHS = ["all", "ev", "pp", "pk", "5v5"];

function rollingRows(date: string, ids: number[]) {
  return STRENGTHS.flatMap((strength_state) =>
    ids.map((player_id) => ({ game_date: date, strength_state, player_id }))
  );
}

const run = async (query: Record<string, string>) => {
  const res = createMockRes();
  await handler({ method: "GET", query } as any, res);
  return res;
};

describe("rolling-coverage-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T16:00:00.000Z"));
    tables.wgo_skater_stats = [
      { date: "2026-10-15", player_id: 1 },
      { date: "2026-10-15", player_id: 2 },
      { date: "2026-10-15", player_id: 3 },
      { date: "2026-10-19", player_id: 10 },
      { date: "2026-10-19", player_id: 20 },
      { date: "2026-10-19", player_id: 30 }
    ];
    tables.rolling_player_game_metrics = [
      ...rollingRows("2026-10-15", [1, 2, 3]),
      ...rollingRows("2026-10-19", [10])
    ];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports a shortfall date with its missing ids and bounded repair URL", async () => {
    const res = await run({ startDate: "2026-10-15", endDate: "2026-10-19" });

    expect(res.statusCode).toBe(200);
    expect(res.body.startDate).toBe("2026-10-15");
    expect(res.body.endDate).toBe("2026-10-19");
    expect(res.body.shortfallDates).toBe(1);
    expect(res.body.dates).toEqual([
      {
        date: "2026-10-15",
        expected: 3,
        byStrength: { all: 3, ev: 3, pp: 3, pk: 3, "5v5": 3 },
        missing: { all: [] },
        shortfall: false,
        repairUrl: null
      },
      {
        date: "2026-10-19",
        expected: 3,
        byStrength: { all: 1, ev: 1, pp: 1, pk: 1, "5v5": 1 },
        missing: { all: [20, 30] },
        shortfall: true,
        repairUrl:
          "/api/v1/db/update-rolling-player-averages?startDate=2026-10-19&endDate=2026-10-19&fastMode=true&executionProfile=daily_incremental&bypassFreshnessBlockers=true&resumeFrom=19"
      }
    ]);
    expect(writeMock).not.toHaveBeenCalled();
  });

  it("omits resumeFrom when the missing ids are not the expected upper tail", async () => {
    tables.rolling_player_game_metrics = rollingRows("2026-10-19", [10, 30]);

    const res = await run({ startDate: "2026-10-19", endDate: "2026-10-19" });

    expect(res.body.dates[0].missing.all).toEqual([20]);
    expect(res.body.dates[0].repairUrl).toBe(
      "/api/v1/db/update-rolling-player-averages?startDate=2026-10-19&endDate=2026-10-19&fastMode=true&executionProfile=daily_incremental&bypassFreshnessBlockers=true"
    );
  });

  it("defaults to the 14 completed days ending yesterday ET", async () => {
    const res = await run({});

    expect(res.statusCode).toBe(200);
    expect(res.body.startDate).toBe("2026-10-07");
    expect(res.body.endDate).toBe("2026-10-20");
  });

  it.each([
    { startDate: "2026-10-1", endDate: "2026-10-19" },
    { startDate: "2026-10-15", endDate: "2026-13-01" },
    { startDate: "2026-10-19", endDate: "2026-10-15" }
  ])("rejects malformed window %o with 400", async (query) => {
    const res = await run(query);

    expect(res.statusCode).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects a span longer than 31 days", async () => {
    expect(
      (await run({ startDate: "2026-09-01", endDate: "2026-10-01" })).statusCode
    ).toBe(200);

    const res = await run({ startDate: "2026-09-01", endDate: "2026-10-02" });

    expect(res.statusCode).toBe(400);
  });
});
