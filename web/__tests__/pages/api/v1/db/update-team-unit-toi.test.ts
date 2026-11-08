import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
}));
vi.mock("../../../../../lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler,
}));

const { buildRowsMock, upsertRowsMock, loadPlanMock } = vi.hoisted(() => ({
  buildRowsMock: vi.fn(),
  upsertRowsMock: vi.fn(),
  loadPlanMock: vi.fn(),
}));

vi.mock("../../../../../lib/rankings/teamUnitToiWriter", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  buildTeamUnitToiSnapshotRows: buildRowsMock,
  upsertTeamUnitToiRows: upsertRowsMock,
}));
vi.mock("../../../../../lib/rankings/teamUnitToiNightly", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  loadTeamUnitToiNightlyPlan: loadPlanMock,
}));

import handler from "../../../../../pages/api/v1/db/update-team-unit-toi";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null as any,
    setHeader() {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

const unit = (gameId: number, teamId: number, unitType: string) => ({
  game_id: gameId, team_id: teamId, unit_type: unitType, unit_number: 1,
});

describe("update-team-unit-toi mode=nightly", () => {
  beforeEach(() => {
    buildRowsMock.mockReset();
    upsertRowsMock.mockReset();
    loadPlanMock.mockReset();
  });

  it("writes only complete games into the reused snapshot and reports skipped ones", async () => {
    loadPlanMock.mockResolvedValue({ status: "ready", snapshotDate: "2026-11-08", gameIds: [1, 2], pendingGames: 2 });
    const rows = [
      unit(1, 10, "forward_line"), unit(1, 10, "defense_pair"), unit(1, 20, "forward_line"), unit(1, 20, "defense_pair"),
      unit(2, 10, "power_play"), // game 2 has no usable ES shifts yet
    ];
    buildRowsMock.mockResolvedValue({ rows, coverage: {}, sourceCounts: {} });
    upsertRowsMock.mockResolvedValue(4);
    const res = createMockRes();

    await (handler as any)(
      { method: "GET", query: { season: "20262027", mode: "nightly", dryRun: "false", asOf: "2026-11-08" }, supabase: {} },
      res,
    );

    expect(loadPlanMock).toHaveBeenCalledWith({}, { season: 20262027, today: "2026-11-08", maxGames: undefined });
    expect(buildRowsMock.mock.calls[0][1]).toMatchObject({ snapshotDate: "2026-11-08", gameIds: [1, 2] });
    expect(upsertRowsMock.mock.calls[0][1].map((row: any) => row.game_id)).toEqual([1, 1, 1, 1]);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ snapshotDate: "2026-11-08", writtenGames: [1], skippedGames: [2], rowsUpserted: 4 });
  });

  it("does not write on a dry run", async () => {
    loadPlanMock.mockResolvedValue({ status: "ready", snapshotDate: "2026-11-08", gameIds: [1], pendingGames: 1 });
    buildRowsMock.mockResolvedValue({ rows: [], coverage: {}, sourceCounts: {} });
    const res = createMockRes();

    await (handler as any)({ method: "GET", query: { season: "20262027", mode: "nightly" }, supabase: {} }, res);

    expect(upsertRowsMock).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ dryRun: true, rowsUpserted: 0, skippedGames: [1] });
  });

  it("is a no-op when nothing is pending, and refuses a season without a snapshot", async () => {
    loadPlanMock.mockResolvedValueOnce({ status: "nothing_to_do", snapshotDate: "2026-11-08", gameIds: [], pendingGames: 0 });
    const idle = createMockRes();
    await (handler as any)({ method: "GET", query: { season: "20262027", mode: "nightly", dryRun: "false" }, supabase: {} }, idle);
    expect(idle.statusCode).toBe(200);
    expect(idle.body).toMatchObject({ plannedGames: 0, rowsUpserted: 0 });

    loadPlanMock.mockResolvedValueOnce({ status: "no_snapshot", snapshotDate: null, gameIds: [], pendingGames: 12 });
    const missing = createMockRes();
    await (handler as any)({ method: "GET", query: { season: "20272028", mode: "nightly", dryRun: "false" }, supabase: {} }, missing);
    expect(missing.statusCode).toBe(409);

    expect(buildRowsMock).not.toHaveBeenCalled();
    expect(upsertRowsMock).not.toHaveBeenCalled();
  });
});
