import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  get: vi.fn(),
  getCurrentSeason: vi.fn(),
  getTeams: vi.fn(),
  rpc: vi.fn(),
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
    handler({ ...req, supabase: { from: mocks.from, rpc: mocks.rpc } }, res),
}));

import handler from "pages/api/v1/db/update-players";
import { fetchNhlRosterPreview } from "lib/sources/nhlRosterPreview";

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
    vi.stubEnv("CURRENT_CANONICAL_ROSTER_SYNC_ENABLED", "false");
    mocks.rpc.mockResolvedValue({ error: null });
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
  afterEach(() => vi.unstubAllEnvs());

  it("targets an explicit preseason roster without writing during dry-run", async () => {
    mocks.getTeams.mockResolvedValue([{ id: 59, abbreviation: "UTA" }]);
    mocks.get.mockResolvedValue({ forwards: [{ id: 8476389, firstName: { default: "Vincent" }, lastName: { default: "Trocheck" }, positionCode: "C", birthDate: "1993-07-11" }], defensemen: [], goalies: [] });
    const response = createResponse();
    await handler({ method: "POST", query: { seasonId: "20262027" } } as never, response as never);
    expect(mocks.getTeams).toHaveBeenCalledWith(20262027, { mode: "current-canonical" });
    expect(mocks.get).toHaveBeenCalledWith("/roster/UTA/current");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({ success: true, dryRun: true, seasonId: 20262027, players: [{ id: 8476389, teamId: 59 }] });
  });
  it("fails an empty refresh before any database writes", async () => {
    const response = createResponse();
    await handler({ method: "POST", query: { seasonId: "20262027" } } as never, response as never);
    expect(response.statusCode).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("compares current roster membership without rediscovering a different season", async () => {
    mocks.getTeams.mockResolvedValue([{ id: 5, abbreviation: "PIT" }]);
    mocks.get.mockResolvedValue({ forwards: [{ id: 8471675, firstName: { default: "Sidney" }, lastName: { default: "Crosby" }, positionCode: "C", birthDate: "1987-08-07" }], defensemen: [], goalies: [] });
    expect(await fetchNhlRosterPreview(20262027, { rosterView: "current" })).toMatchObject([{ id: 8471675, teamId: 5, sweaterNumber: 0 }]);
    expect(mocks.getTeams).toHaveBeenCalledWith(20262027, { mode: "current-canonical" });
    expect(mocks.get).toHaveBeenCalledWith("/roster/PIT/current");
    expect(mocks.getCurrentSeason).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  const onePlayer = () => {
    mocks.getTeams.mockResolvedValue([{ id: 16, name: "Chicago Blackhawks", abbreviation: "CHI" }]);
    mocks.get.mockResolvedValue({ forwards: [{ id: 8474141, firstName: { default: "Patrick" }, lastName: { default: "Kane" }, positionCode: "R", birthDate: "1988-11-19" }], defensemen: [], goalies: [] });
  };
  it("keeps canonical activation off until rollout and never invokes it during dry-run", async () => {
    onePlayer();
    const response = createResponse();
    await handler({ method: "POST", query: { dryRun: "false" } } as never, response as never);
    expect(response.body).toMatchObject({ success: true, canonicalSync: { enabled: false } });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0][0]).toBe("upsert_current_roster_membership");
    mocks.rpc.mockClear();
    vi.stubEnv("CURRENT_CANONICAL_ROSTER_SYNC_ENABLED", "true");
    await handler({ method: "POST", query: {} } as never, createResponse() as never);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("syncs canonical binding only after every membership write succeeds", async () => {
    onePlayer(); vi.stubEnv("CURRENT_CANONICAL_ROSTER_SYNC_ENABLED", "true");
    mocks.rpc.mockImplementation(async (name, args) => name === "sync_current_canonical_organizations"
      ? { data: { receiptHash: args.p_receipt_hash, changedIds: [9005], skipped: [] }, error: null } : { error: null });
    const response = createResponse();
    await handler({ method: "POST", query: { dryRun: "false" } } as never, response as never);
    expect(mocks.rpc.mock.calls.map(call => call[0])).toEqual(["upsert_current_roster_membership", "sync_current_canonical_organizations"]);
    expect(response.body).toMatchObject({ success: true, canonicalSync: { changedIds: [9005] } });
    const receipt = JSON.parse(mocks.rpc.mock.calls[1][1].p_receipt_text);
    expect(receipt.players).toEqual([{ nhlPlayerId: 8474141, teamId: 16, organizationName: "Chicago Blackhawks", sourceUrl: "https://api-web.nhle.com/v1/roster/CHI/current" }]);
  });
  it("retains canonical data on a partial membership failure", async () => {
    onePlayer(); vi.stubEnv("CURRENT_CANONICAL_ROSTER_SYNC_ENABLED", "true");
    mocks.rpc.mockResolvedValue({ error: new Error("partial membership failure") });
    const response = createResponse();
    await handler({ method: "POST", query: { dryRun: "false" } } as never, response as never);
    expect(response.statusCode).toBe(400);
    expect(mocks.rpc.mock.calls.map(call => call[0])).toEqual(["upsert_current_roster_membership"]);
  });
  it("rejects partial source refresh before writes and historical writes before acquisition", async () => {
    onePlayer(); vi.stubEnv("CURRENT_CANONICAL_ROSTER_SYNC_ENABLED", "true");
    mocks.getTeams.mockResolvedValue([{ id: 16, abbreviation: "CHI" }, { id: 14, abbreviation: "TBL" }]);
    mocks.get.mockRejectedValueOnce(new Error("source failed"));
    const response = createResponse();
    await handler({ method: "POST", query: { dryRun: "false" } } as never, response as never);
    expect(response.statusCode).toBe(400); expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.get.mockClear();
    await handler({ method: "POST", query: { dryRun: "false", seasonId: "20252026" } } as never, createResponse() as never);
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
