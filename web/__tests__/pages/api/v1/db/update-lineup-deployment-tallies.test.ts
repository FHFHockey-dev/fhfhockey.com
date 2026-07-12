import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn()
}));

vi.mock("../../../../../lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler
}));

vi.mock("../../../../../utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => async (req: any, res: any) =>
    handler({ ...req, supabase: { rpc: rpcMock } }, res)
}));

vi.mock("../../../../../lib/NHL/server", () => ({
  getCurrentSeason: vi.fn(async () => ({ seasonId: 20252026 }))
}));

import handler from "../../../../../pages/api/v1/db/update-lineup-deployment-tallies";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  } as any;
}

describe("/api/v1/db/update-lineup-deployment-tallies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({
      data: [{ deleted_rows: 4, inserted_rows: 18 }],
      error: null
    });
  });

  it("refreshes current-season tallies by default", async () => {
    const req: any = { method: "GET", query: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(rpcMock).toHaveBeenCalledWith(
      "refresh_player_lineup_deployment_tallies",
      {
        p_season_id: 20252026,
        p_player_id: null
      }
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      deletedRows: 4,
      insertedRows: 18
    });
  });

  it("passes explicit all-scope filters to the refresh rpc", async () => {
    const req: any = {
      method: "GET",
      query: { action: "all", seasonId: "20242025", playerId: "8478402" }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(rpcMock).toHaveBeenCalledWith(
      "refresh_player_lineup_deployment_tallies",
      {
        p_season_id: 20242025,
        p_player_id: 8478402
      }
    );
    expect(res.statusCode).toBe(200);
  });
});
