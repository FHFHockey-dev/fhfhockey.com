import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  compute: vi.fn(),
  upsert: vi.fn()
}));

vi.mock("lib/supabase/server", () => ({ default: {} }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: any) => handler }));
vi.mock("lib/sustainability/entityProducerData", () => ({
  computeEntitySustainability: mocks.compute
}));
vi.mock("lib/sustainability/entityProducerWrite", () => ({
  upsertEntitySustainabilityRows: mocks.upsert
}));

import handler from "../../../../../pages/api/v1/sustainability/rebuild-entity-sustainability";

function response() {
  return {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, unknown>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: unknown) {
      this.headers[name] = value;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    }
  };
}

function run(dates: number) {
  return {
    seasonId: 20262027,
    readyThrough: "2026-11-22",
    dates: Array.from({ length: dates }, (_, i) => `d${i}`),
    scores: [{ id: "s" }],
    bands: [{ id: "b" }],
    skips: [{ reason: "no_game_yet_this_season" }],
    unmappedAbbrevs: []
  };
}

const query = { season_id: "20262027", end_date: "2026-11-22" };

describe("rebuild-entity-sustainability", () => {
  beforeEach(() => {
    mocks.compute.mockReset();
    mocks.upsert.mockReset();
    mocks.upsert.mockResolvedValue({ scores: { inserted: 1 }, bands: { inserted: 1 } });
  });

  it("is a dry run unless dryRun=false is passed", async () => {
    mocks.compute.mockResolvedValue(run(55));
    const res = response();
    await handler({ method: "GET", query } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ dryRun: true, scoreRows: 1, bandRows: 1, written: null });
    expect(res.body.skipReasons).toEqual({ no_game_yet_this_season: 1 });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("writes only with an explicit dryRun=false", async () => {
    mocks.compute.mockResolvedValue(run(5));
    const res = response();
    await handler({ method: "GET", query: { ...query, dryRun: "false" } } as any, res as any);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(res.body.dryRun).toBe(false);
  });

  it("refuses a call that covers too many dates, before any write", async () => {
    mocks.compute.mockResolvedValue(run(63));
    const res = response();
    await handler({ method: "GET", query: { ...query, dryRun: "false" } } as any, res as any);
    expect(res.statusCode).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("requires a season and an end date", async () => {
    const res = response();
    await handler({ method: "GET", query: { end_date: "2026-11-22" } } as any, res as any);
    expect(res.statusCode).toBe(400);
    const res2 = response();
    await handler({ method: "GET", query: { season_id: "20262027" } } as any, res2 as any);
    expect(res2.statusCode).toBe(400);
    expect(mocks.compute).not.toHaveBeenCalled();
  });
});
