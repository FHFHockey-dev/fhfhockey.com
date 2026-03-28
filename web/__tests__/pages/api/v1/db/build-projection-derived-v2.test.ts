import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  auditInsertMock,
  playerBuilderMock,
  teamBuilderMock,
  goalieBuilderMock
} = vi.hoisted(() => ({
  auditInsertMock: vi.fn().mockResolvedValue({ error: null }),
  playerBuilderMock: vi.fn(),
  teamBuilderMock: vi.fn(),
  goalieBuilderMock: vi.fn()
}));

vi.mock("lib/projections/derived/buildStrengthTablesV2", () => ({
  buildPlayerGameStrengthV2ForDateRange: playerBuilderMock,
  buildTeamGameStrengthV2ForDateRange: teamBuilderMock
}));

vi.mock("lib/projections/derived/buildGoalieGameV2", () => ({
  buildGoalieGameV2ForDateRange: goalieBuilderMock
}));

vi.mock("lib/supabase", () => ({
  default: {
    from: vi.fn(() => ({
      insert: auditInsertMock
    }))
  }
}));

import handler from "../../../../../pages/api/v1/db/build-projection-derived-v2";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as any,
    headersSent: false,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      this.headersSent = true;
      return this;
    }
  };
  return res;
}

describe("/api/v1/db/build-projection-derived-v2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playerBuilderMock.mockResolvedValue({ gamesProcessed: 1, rowsUpserted: 10 });
    teamBuilderMock.mockResolvedValue({ gamesProcessed: 1, rowsUpserted: 4 });
    goalieBuilderMock.mockResolvedValue({ gamesProcessed: 1, rowsUpserted: 2 });
  });

  it("bounds bare multi-day runs with a default maxDays cap", async () => {
    const req: any = {
      method: "POST",
      query: {
        startDate: "2026-03-18",
        endDate: "2026-03-22"
      },
      body: {}
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      startDate: "2026-03-18",
      endDate: "2026-03-20",
      maxDays: 3,
      nextStartDate: "2026-03-21",
      processedDates: ["2026-03-18", "2026-03-19", "2026-03-20"],
      dependencyContract: {
        version: "rolling-forge-operator-order-v1",
        currentStage: {
          id: "projection_derived_build",
          order: 6
        }
      }
    });
    expect(playerBuilderMock).toHaveBeenCalledTimes(3);
    expect(teamBuilderMock).toHaveBeenCalledTimes(3);
    expect(goalieBuilderMock).toHaveBeenCalledTimes(3);
  });

  it("returns the next unprocessed date when the deadline is exhausted mid-run", async () => {
    const realDateNow = Date.now;
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    playerBuilderMock.mockImplementation(async () => {
      now += 5;
      return { gamesProcessed: 1, rowsUpserted: 10 };
    });
    teamBuilderMock.mockImplementation(async () => {
      now += 5;
      return { gamesProcessed: 1, rowsUpserted: 4 };
    });
    goalieBuilderMock.mockImplementation(async () => {
      now += 20;
      return { gamesProcessed: 1, rowsUpserted: 2 };
    });

    const req: any = {
      method: "GET",
      query: {
        startDate: "2026-03-18",
        endDate: "2026-03-20",
        maxDurationMs: "25",
        maxDays: "3"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.timedOut).toBe(true);
    expect(res.body.processedDates).toEqual(["2026-03-18"]);
    expect(res.body.nextStartDate).toBe("2026-03-19");

    Date.now = realDateNow;
  });
});
