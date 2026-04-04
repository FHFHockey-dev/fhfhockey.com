import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  auditInsertMock,
  fetchPbpGameMock,
  upsertPbpGameAndPlaysMock,
  upsertShiftTotalsForGameMock,
  upsertShiftTotalsForGameFromPbpMock,
  gamesOrderMock,
  gamesLteMock,
  gamesGteMock,
  pbpMaybeSingleMock,
  shiftEqMock,
  shiftSelectMock
} = vi.hoisted(() => ({
  auditInsertMock: vi.fn().mockResolvedValue({ error: null }),
  fetchPbpGameMock: vi.fn(),
  upsertPbpGameAndPlaysMock: vi.fn(),
  upsertShiftTotalsForGameMock: vi.fn(),
  upsertShiftTotalsForGameFromPbpMock: vi.fn(),
  gamesOrderMock: vi.fn(),
  gamesLteMock: vi.fn(),
  gamesGteMock: vi.fn(),
  pbpMaybeSingleMock: vi.fn(),
  shiftEqMock: vi.fn(),
  shiftSelectMock: vi.fn()
}));

vi.mock("lib/projections/ingest/pbp", () => ({
  fetchPbpGame: fetchPbpGameMock,
  upsertPbpGameAndPlays: upsertPbpGameAndPlaysMock
}));

vi.mock("lib/projections/ingest/shifts", () => ({
  upsertShiftTotalsForGame: upsertShiftTotalsForGameMock,
  upsertShiftTotalsForGameFromPbp: upsertShiftTotalsForGameFromPbpMock
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: vi.fn((table: string) => {
      if (table === "games") {
        gamesOrderMock.mockResolvedValue({
          data: [
            { id: 101, date: "2026-03-20" },
            { id: 102, date: "2026-03-20" },
            { id: 103, date: "2026-03-20" },
            { id: 104, date: "2026-03-20" },
            { id: 105, date: "2026-03-20" },
            { id: 106, date: "2026-03-20" },
            { id: 107, date: "2026-03-20" }
          ],
          error: null
        });
        gamesLteMock.mockReturnValue({ order: gamesOrderMock });
        gamesGteMock.mockReturnValue({ lte: gamesLteMock });
        return {
          select: vi.fn(() => ({
            gte: gamesGteMock
          }))
        };
      }

      if (table === "pbp_games") {
        pbpMaybeSingleMock.mockResolvedValue({ data: null, error: null });
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: pbpMaybeSingleMock
            }))
          }))
        };
      }

      if (table === "shift_charts") {
        shiftEqMock.mockResolvedValue({ count: 0, error: null });
        shiftSelectMock.mockReturnValue({
          eq: shiftEqMock
        });
        return {
          select: shiftSelectMock
        };
      }

      return {
        insert: auditInsertMock
      };
    })
  }
}));

import handler from "../../../../../pages/api/v1/db/ingest-projection-inputs";

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

describe("/api/v1/db/ingest-projection-inputs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchPbpGameMock.mockResolvedValue({ id: 101, plays: [] });
    upsertPbpGameAndPlaysMock.mockResolvedValue({ playsUpserted: 10 });
    upsertShiftTotalsForGameMock.mockResolvedValue({ rowsUpserted: 4 });
    upsertShiftTotalsForGameFromPbpMock.mockResolvedValue({ rowsUpserted: 4 });
  });

  it("caps bare runs to a small default game count and exposes resume pointers", async () => {
    const req: any = {
      method: "POST",
      query: {
        startDate: "2026-03-20",
        endDate: "2026-03-20"
      },
      body: {}
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      maxGames: 6,
      gamesTotal: 7,
      nextGameId: 107,
      dependencyContract: {
        version: "rolling-forge-operator-order-v1",
        currentStage: {
          id: "projection_input_ingest",
          order: 5
        }
      }
    });
    expect(fetchPbpGameMock).toHaveBeenCalledTimes(6);
  });

  it("reuses a shared pbp fetch when both pbp and shifts are missing", async () => {
    const req: any = {
      method: "POST",
      query: {
        startDate: "2026-03-20",
        endDate: "2026-03-20",
        maxGames: "1"
      },
      body: {}
    };
    const res = createMockRes();

    const pbpPayload = { id: 101, plays: [] };
    fetchPbpGameMock.mockResolvedValueOnce(pbpPayload);

    await handler(req, res);

    expect(fetchPbpGameMock).toHaveBeenCalledTimes(1);
    expect(upsertPbpGameAndPlaysMock).toHaveBeenCalledWith(pbpPayload);
    expect(upsertShiftTotalsForGameFromPbpMock).toHaveBeenCalledWith(101, pbpPayload);
    expect(upsertShiftTotalsForGameMock).not.toHaveBeenCalled();
  });

  it("records the failing stage in the error payload", async () => {
    const req: any = {
      method: "POST",
      query: {
        startDate: "2026-03-20",
        endDate: "2026-03-20",
        maxGames: "1"
      },
      body: {}
    };
    const res = createMockRes();

    fetchPbpGameMock.mockRejectedValueOnce(new Error("upstream fetch failed"));

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.errors[0]).toMatchObject({
      gameId: 101,
      date: "2026-03-20",
      stage: "fetch_pbp",
      message: "upstream fetch failed"
    });
    expect(res.body.nextGameId).toBe(102);
  });
});
