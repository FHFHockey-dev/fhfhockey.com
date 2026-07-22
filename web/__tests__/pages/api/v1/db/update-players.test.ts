import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  get: vi.fn(),
  getCurrentSeason: vi.fn(),
  getTeams: vi.fn(),
}));

vi.mock("lib/NHL/server", () => ({
  getCurrentSeason: mocks.getCurrentSeason,
  getTeams: mocks.getTeams,
}));

vi.mock("lib/NHL/base", () => ({
  get: mocks.get,
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler,
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => (req: any, res: any) =>
    handler({ ...req, supabase: { from: mocks.from, rpc: vi.fn() } }, res),
}));

import handler from "pages/api/v1/db/update-players";

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status: vi.fn((statusCode: number) => {
      response.statusCode = statusCode;
      return response;
    }),
    json: vi.fn((body: unknown) => {
      response.body = body;
      return response;
    }),
  };
  return response;
}

describe("/api/v1/db/update-players", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSeason.mockResolvedValue({ seasonId: 20252026 });
    mocks.getTeams.mockResolvedValue([]);

    const playersTable = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };
    mocks.from.mockImplementation((table: string) => {
      if (table !== "players") throw new Error(`Unexpected table: ${table}`);
      return playersTable;
    });
  });

  it("uses the current-canonical team catalog for the current roster writer", async () => {
    const response = createResponse();

    await handler({ method: "POST", query: {} } as never, response as never);

    expect(mocks.getTeams).toHaveBeenCalledWith(20252026, {
      mode: "current-canonical",
    });
    expect(mocks.get).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: "Successfully updated the players & rosters tables.",
      success: true,
    });
  });
});
