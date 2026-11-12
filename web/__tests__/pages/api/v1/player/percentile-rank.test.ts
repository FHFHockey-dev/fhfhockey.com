import { beforeEach, describe, expect, it, vi } from "vitest";

const { rows, getPlayerMock } = vi.hoisted(() => ({
  rows: { data: [] as any[] },
  getPlayerMock: vi.fn()
}));

vi.mock("lib/NHL/server", () => ({ getPlayer: getPlayerMock }));
vi.mock("pages/api/toi", () => ({
  getInterval: vi.fn(async (_season: unknown, start: string, end: string) => [start, end])
}));
vi.mock("lib/supabase/public-client", () => {
  const query: any = {
    returns: () => query,
    throwOnError: () => Promise.resolve({ data: rows.data, error: null })
  };
  return { default: { rpc: () => query } };
});

import handler from "../../../../../pages/api/v1/player/[id]/percentile-rank";

const row = (id: number, avggoals: number) => ({
  id, avggoals, avgassists: 0.5, avgplusminus: 0, avgpim: 0.2, avghits: 1,
  avgblockedshots: 1, avgpowerplaypoints: 0.1, avgshots: 2, count: 10
});

async function call(id: number) {
  const res: any = {
    statusCode: 0, body: null,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; }
  };
  await handler({ query: { id: String(id) }, body: { Season: 20252026, StartTime: "2025-10-01", EndTime: "2026-04-01" } } as any, res);
  return res;
}

describe("/api/v1/player/[id]/percentile-rank", () => {
  beforeEach(() => {
    getPlayerMock.mockImplementation(async (id: number) => ({ id }));
  });

  it("returns unknown, not zero, for a player with no games in the window (rule 5)", async () => {
    rows.data = [row(1, 0.5), row(2, 0.3)];
    const res = await call(99);
    expect(res.statusCode).toBe(200);
    expect(Object.values(res.body.data).every((value) => value === null)).toBe(true);
  });

  it("ranks numerically with the shared mid-rank (decision 90)", async () => {
    // As text, 10 sorts before 9; the old code put the 10-goal player below the 9.
    rows.data = [row(1, 9), row(2, 10), row(3, 2), row(4, 10)];
    const res = await call(2);
    // Player 2: 2 below (2, 9), tied with player 4 → (2 + 0.5 × 2) / 4 = 75.
    expect(res.body.data.goals).toBe(75);
    const low = await call(3);
    expect(low.body.data.goals).toBe(12.5);
  });
});
