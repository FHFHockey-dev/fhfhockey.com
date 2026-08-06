import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { canonicalHandlerMock, legacyMainMock, previousUtcDateMock } =
  vi.hoisted(() => ({
    canonicalHandlerMock: vi.fn(),
    legacyMainMock: vi.fn(),
    previousUtcDateMock: vi.fn(),
  }));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler,
}));

vi.mock("../../../../../pages/api/v1/db/ingest-projection-inputs", () => ({
  ingestProjectionInputsHandler: canonicalHandlerMock,
  previousUtcDate: previousUtcDateMock,
}));

vi.mock("lib/supabase/Upserts/fetchPbP", () => ({
  main: legacyMainMock,
}));

import handler from "../../../../../pages/api/v1/db/update-PbP";

function createMockRes() {
  return {
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
    },
  } as any;
}

function createGameLookup(result: {
  data: { id: number; date: string } | null;
  error: unknown | null;
}) {
  const query: any = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => result);
  return {
    client: { from: vi.fn(() => query) },
    query,
  };
}

describe("/api/v1/db/update-PbP compatibility adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T08:30:00.000Z"));
    previousUtcDateMock.mockReturnValue("2026-07-20");
    canonicalHandlerMock.mockImplementation(async (req: any, res: any) => {
      return res.status(200).json({
        success: true,
        delegatedQuery: req.query,
        delegatedBody: req.body,
      });
    });
    legacyMainMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delegates the active recent schedule to one bounded canonical UTC day", async () => {
    const req: any = {
      method: "GET",
      query: { gameId: "recent" },
      body: { startDate: "1900-01-01" },
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(previousUtcDateMock).toHaveBeenCalledTimes(1);
    expect(canonicalHandlerMock).toHaveBeenCalledTimes(1);
    const [canonicalReq, canonicalRes] = canonicalHandlerMock.mock.calls[0];
    expect(canonicalReq).not.toBe(req);
    expect(canonicalReq.query).toEqual({
      startDate: "2026-07-20",
      endDate: "2026-07-20",
    });
    expect(canonicalReq.body).toEqual({});
    expect(canonicalRes).toBe(res);
    expect(legacyMainMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("resolves a numeric ID then selects only that exact same-date game", async () => {
    const lookup = createGameLookup({
      data: { id: 2023020418, date: "2026-03-20T00:00:00.000Z" },
      error: null,
    });
    const req: any = {
      method: "POST",
      query: { gameId: "2023020418" },
      body: {},
      headers: {},
      supabase: lookup.client,
    };
    const res = createMockRes();

    await handler(req, res);

    expect(lookup.client.from).toHaveBeenCalledWith("games");
    expect(lookup.query.select).toHaveBeenCalledWith("id,date");
    expect(lookup.query.eq).toHaveBeenCalledWith("id", 2023020418);
    expect(canonicalHandlerMock).toHaveBeenCalledTimes(1);
    expect(canonicalHandlerMock.mock.calls[0]?.[0].query).toEqual({
      startDate: "2026-03-20",
      endDate: "2026-03-20",
      resumeFromGameId: "2023020418",
      maxGames: "1",
    });
    expect(legacyMainMock).not.toHaveBeenCalled();
  });

  it("delegates an explicit range and retains the historical start-only bound", async () => {
    const explicitReq: any = {
      method: "GET",
      query: { startDate: "2026-07-01", endDate: "2026-07-03" },
      body: {},
      headers: {},
    };
    const explicitRes = createMockRes();

    await handler(explicitReq, explicitRes);

    expect(canonicalHandlerMock.mock.calls[0]?.[0].query).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-03",
    });

    canonicalHandlerMock.mockClear();
    const startOnlyReq: any = {
      method: "GET",
      query: { startDate: "2026-07-19" },
      body: {},
      headers: {},
    };
    await handler(startOnlyReq, createMockRes());

    expect(canonicalHandlerMock.mock.calls[0]?.[0].query).toEqual({
      startDate: "2026-07-19",
      endDate: "2026-07-21",
    });
  });

  it("keeps the no-parameter legacy default bounded to the current UTC day", async () => {
    const req: any = {
      method: "GET",
      query: {},
      body: {},
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(canonicalHandlerMock.mock.calls[0]?.[0].query).toEqual({
      startDate: "2026-07-21",
      endDate: "2026-07-21",
    });
  });

  it("keeps games=all on the authenticated legacy compatibility path", async () => {
    const req: any = {
      method: "POST",
      query: {
        games: "all",
        startDate: "2020-01-01",
        endDate: "2020-01-31",
      },
      body: {},
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(legacyMainMock).toHaveBeenCalledWith(
      true,
      undefined,
      "2020-01-01",
      "2020-01-31",
    );
    expect(canonicalHandlerMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      mode: "legacy-games-all",
      message: "Play-by-play full-history compatibility run completed",
    });
  });

  it.each(["games", "gameId", "startDate", "endDate"])(
    "rejects repeated %s controls before either writer can run",
    async (key) => {
      const res = createMockRes();
      await handler(
        {
          method: "GET",
          query: { [key]: ["first", "second"] },
          body: {},
          headers: {},
        } as any,
        res,
      );

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        message: `${key} must be supplied at most once`,
      });
      expect(canonicalHandlerMock).not.toHaveBeenCalled();
      expect(legacyMainMock).not.toHaveBeenCalled();
    },
  );

  it("rejects malformed and missing exact-game requests before ingestion", async () => {
    const malformedRes = createMockRes();
    await handler(
      {
        method: "GET",
        query: { gameId: "not-a-game" },
        body: {},
        headers: {},
      } as any,
      malformedRes,
    );

    expect(malformedRes.statusCode).toBe(400);
    expect(canonicalHandlerMock).not.toHaveBeenCalled();
    expect(legacyMainMock).not.toHaveBeenCalled();

    const lookup = createGameLookup({ data: null, error: null });
    const missingRes = createMockRes();
    await handler(
      {
        method: "GET",
        query: { gameId: "2023020418" },
        body: {},
        headers: {},
        supabase: lookup.client,
      } as any,
      missingRes,
    );

    expect(missingRes.statusCode).toBe(404);
    expect(canonicalHandlerMock).not.toHaveBeenCalled();
  });

  it("fails closed when exact-game lookup errors", async () => {
    const lookup = createGameLookup({
      data: null,
      error: new Error("bounded lookup failure"),
    });
    const res = createMockRes();

    await handler(
      {
        method: "GET",
        query: { gameId: "2023020418" },
        body: {},
        headers: {},
        supabase: lookup.client,
      } as any,
      res,
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      message: "Unable to resolve the requested game",
    });
    expect(canonicalHandlerMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported methods without invoking either writer", async () => {
    const res = createMockRes();

    await handler(
      {
        method: "DELETE",
        query: { games: "all" },
        body: {},
        headers: {},
      } as any,
      res,
    );

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toEqual(["GET", "POST"]);
    expect(canonicalHandlerMock).not.toHaveBeenCalled();
    expect(legacyMainMock).not.toHaveBeenCalled();
  });
});
