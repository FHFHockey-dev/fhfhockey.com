import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  get: vi.fn(),
  getCurrentSeason: vi.fn(),
  getTeams: vi.fn(),
}));

vi.mock("lib/NHL/server", () => ({
  isValidNhlSeasonId: (id: number) => id === 20262027 || id === 20252026,
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

  it("targets an explicit preseason roster without writing during dry-run", async () => {
    mocks.getTeams.mockResolvedValue([{ id: 59, abbreviation: "UTA" }]);
    mocks.get.mockResolvedValue({ forwards: [{ id: 8476389, firstName: { default: "Vincent" }, lastName: { default: "Trocheck" }, positionCode: "C", birthDate: "1993-07-11" }], defensemen: [], goalies: [] });
    const response = createResponse();
    await handler({ method: "POST", query: { seasonId: "20262027" } } as never, response as never);
    expect(mocks.getTeams).toHaveBeenCalledWith(20262027, { mode: "current-canonical" });
    expect(mocks.get).toHaveBeenCalledWith("/roster/UTA/20262027");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({ success: true, dryRun: true, seasonId: 20262027, players: [{ id: 8476389, teamId: 59 }] });
  });
  it("fails an empty refresh before any database writes", async () => {
    const response = createResponse();
    await handler({ method: "POST", query: { seasonId: "20262027" } } as never, response as never);
    expect(response.statusCode).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
