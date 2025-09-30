import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "pages/api/v1/db/sustainability/rebuild-baselines";

// create mock request/response objects similar to Next.js
function mockReq(method = "POST") {
  return {
    method,
    headers: {},
    body: {}
  } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.setHeader = vi.fn();
  return res;
}

// mock supabase client with chainable calls and queued responses
const upsertMock = vi.fn();
vi.mock("lib/supabase/server", () => {
  // we'll replace the behavior per-test by manipulating `__mockResponses` if needed
  let callIndex = 0;
  let responses: any[] = [];

  function setResponses(r: any[]) {
    responses = r;
    callIndex = 0;
  }

  function from(table: string) {
    // upsert path
    if (table === "player_baselines") {
      return { upsert: upsertMock };
    }

    const chain: any = {
      select: () => chain,
      gte: () => chain,
      neq: () => chain,
      in: () => chain,
      order: () => chain,
      then: (resolve: any) =>
        resolve(responses[callIndex++] || { data: null, error: null })
    };
    return chain;
  }

  return {
    default: { from, __setMockResponses: setResponses }
  };
});

describe("rebuild-baselines API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 405 for non-POST", async () => {
    const req = mockReq("GET");
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Method Not Allowed"
    });
  });

  it("processes players and upserts baselines on POST", async () => {
    // setup select sequences: first call returns players, then gameRows, then totalsRows
    const players = [
      { player_id: "1", player_name: "Alice", position_code: "C" }
    ];
    const gameRows = [
      { player_id: "1", date: "2025-01-01", nst_ixg: 1, nst_toi: 600 }
    ];
    const totalsRows = [
      {
        player_id: "1",
        season_id: 2025,
        nst_ixg: 10,
        nst_toi: 3600,
        games_played: 40
      }
    ];

    // queue responses: players, gameRows, totalsRows
    const supabase = await import("lib/supabase/server");
    (supabase as any).__setMockResponses([
      { data: players, error: null },
      { data: gameRows, error: null },
      { data: totalsRows, error: null }
    ]);
    // intercept upsert via (supabase as any).from(...).upsert
    (supabase as any).from = vi.fn(() => ({ upsert: upsertMock }));
    upsertMock.mockResolvedValueOnce({ error: null });

    const req = mockReq("POST");
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
    expect(upsertMock).toHaveBeenCalled();
  });
});
