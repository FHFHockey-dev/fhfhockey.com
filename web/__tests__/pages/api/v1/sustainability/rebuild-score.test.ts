import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler
}));

vi.mock("lib/cron/nhlOffSeason", () => ({
  withNhlOffSeasonSkip: (handler: any) => handler
}));

const {
  assertScorePrerequisitesMock,
  detectSourceAdvanceMock,
  loadPlayersForSnapshotMock,
  resolveSeasonIdMock,
  buildScoreMock,
  upsertScoresMock,
  supabaseFromMock,
  scoreUpsertMock,
  distributionUpsertMock,
  issue
} = vi.hoisted(() => ({
  assertScorePrerequisitesMock: vi.fn(),
  detectSourceAdvanceMock: vi.fn(),
  loadPlayersForSnapshotMock: vi.fn(),
  resolveSeasonIdMock: vi.fn(),
  buildScoreMock: vi.fn(),
  upsertScoresMock: vi.fn(),
  supabaseFromMock: vi.fn(),
  scoreUpsertMock: vi.fn(),
  distributionUpsertMock: vi.fn(),
  issue: {
    code: "missing_sustainability_window_z",
    message:
      "Missing sustainability_window_z rows required for sustainability score rebuild.",
    detail:
      "No sustainability_window_z rows were found for season 20252026 and snapshot 2026-03-21.",
    action:
      "Run /api/v1/sustainability/rebuild-window-z for the requested season and snapshot before rebuilding scores."
  } as const
}));

vi.mock("../../../../../lib/sustainability/incremental", () => ({
  detectSustainabilitySourceAdvance: detectSourceAdvanceMock
}));

vi.mock("../../../../../lib/sustainability/dependencyChecks", async () => {
  const actual =
    await vi.importActual<
      typeof import("../../../../../lib/sustainability/dependencyChecks")
    >("../../../../../lib/sustainability/dependencyChecks");
  return {
    ...actual,
    assertScorePrerequisites: assertScorePrerequisitesMock
  };
});

vi.mock("../../../../../lib/sustainability/windows", () => ({
  loadPlayersForSnapshot: loadPlayersForSnapshotMock
}));

vi.mock("../../../../../lib/sustainability/resolveSeasonId", () => ({
  resolveSeasonId: resolveSeasonIdMock
}));

vi.mock("lib/supabase/server", () => ({
  default: { from: supabaseFromMock }
}));

vi.mock("lib/sustainability/score", async () => {
  const actual = await vi.importActual<typeof import("lib/sustainability/score")>("lib/sustainability/score");
  upsertScoresMock.mockImplementation(actual.upsertScores);
  return {
    ...actual,
    fetchSkillLeagueRef: vi.fn().mockResolvedValue({}),
    buildScoreForPlayerWindow: buildScoreMock,
    upsertScores: upsertScoresMock
  };
});

vi.mock("lib/sustainability/config", () => ({
  loadActiveSustainabilityConfig: vi.fn().mockResolvedValue({
    configRevision: 7, modelVersion: "synthetic-v1", configHash: "synthetic-config", weights: {}
  })
}));

import handler from "../../../../../pages/api/v1/sustainability/rebuild-score";
import { rebuildScoreHandler } from "../../../../../pages/api/v1/sustainability/rebuild-score";
import { SustainabilityDependencyError } from "../../../../../lib/sustainability/dependencyChecks";

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

describe("/api/v1/sustainability/rebuild-score", () => {
  let restoreConsoleInfo = () => {};

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", () => { throw new Error("Unexpected network request"); });
    resolveSeasonIdMock.mockResolvedValue(20252026);
    const ids = Array.from({ length: 600 }, (_, index) => index + 1);
    loadPlayersForSnapshotMock.mockResolvedValue({
      ids,
      posMap: new Map(ids.map((id) => [id, "F"]))
    });
    detectSourceAdvanceMock.mockResolvedValue({
      shouldProcess: true,
      reason: "new_source_date"
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreConsoleInfo();
  });

  function prepareSuccessfulPopulation() {
    const ids = Array.from({ length: 1001 }, (_, index) => index + 1);
    loadPlayersForSnapshotMock.mockResolvedValue({ ids, posMap: new Map(ids.map(id => [id, "F"])) });
    assertScorePrerequisitesMock.mockResolvedValue(undefined);
    buildScoreMock.mockImplementation(async (season, playerId, snapshot, _position, window) => ({
      row: {
        player_id: playerId, season_id: season, snapshot_date: snapshot,
        window_code: window.code, s_raw: 0, s_100: (playerId - 1) / 10,
        model_version: "synthetic-v1", config_hash: "synthetic-config", components: {}
      }
    }));
    scoreUpsertMock.mockResolvedValue({ error: null });
    distributionUpsertMock.mockResolvedValue({ error: null });
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "sustainability_distribution_snapshots") return { upsert: distributionUpsertMock };
      if (table !== "sustainability_scores") throw new Error(`Unexpected table ${table}`);
      const query: Record<string, any> = { upsert: scoreUpsertMock };
      for (const method of ["select", "gte", "lte", "eq", "order"]) query[method] = () => query;
      query.range = vi.fn().mockResolvedValue({ data: [], error: null });
      return query;
    });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    restoreConsoleInfo = () => info.mockRestore();
    return ids;
  }

  function expectCompletePopulation(rows: Array<{ player_id: number; window_code: string; sustainability_quintile?: number | null }>, ids: number[]) {
    const windows = ["l3", "l5", "l10", "l20"];
    const expected = new Set(ids.flatMap(id => windows.map(window => `${id}:${window}`)));
    expect(rows).toHaveLength(4004);
    expect(new Set(rows.map(row => `${row.player_id}:${row.window_code}`))).toEqual(expected);
    for (const window of windows) {
      const population = rows.filter(row => row.window_code === window);
      expect([0, 1, 2, 3, 4].map(quintile => population.filter(row => row.sustainability_quintile === quintile).length)).toEqual([201, 200, 200, 200, 200]);
      expect(population.find(row => row.player_id === 1001)?.sustainability_quintile).toBe(4);
    }
  }

  it("returns a structured prerequisite failure when window-z rows are missing", async () => {
    assertScorePrerequisitesMock.mockRejectedValue(
      new SustainabilityDependencyError(issue)
    );

    const req: any = {
      method: "GET",
      query: { season: "current", snapshot_date: "2026-03-21" }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(424);
    expect(res.body.success).toBe(false);
    expect(res.body.prerequisite).toEqual(issue);
    expect(res.body.dependencyError.message).toBe(issue.message);
  });

  it("returns a no-op receipt when the latest source cutoff is already processed", async () => {
    detectSourceAdvanceMock.mockResolvedValue({
      shouldProcess: false,
      reason: "source_already_processed",
      latest_source_date: "2026-03-21",
      latest_processed_source_date: "2026-03-21"
    });
    const res = createMockRes();

    await handler(
      { method: "GET", query: { season: "current" } } as any,
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      skipped: true,
      reason: "source_already_processed"
    });
    expect(assertScorePrerequisitesMock).not.toHaveBeenCalled();
  });

  it("checks the requested offset batch and processes it when that batch is incomplete", async () => {
    detectSourceAdvanceMock.mockResolvedValue({
      shouldProcess: true,
      reason: "snapshot_batch_incomplete"
    });
    assertScorePrerequisitesMock.mockRejectedValue(
      new SustainabilityDependencyError(issue)
    );
    const res = createMockRes();

    await handler(
      {
        method: "GET",
        query: {
          season: "current",
          snapshot_date: "2026-10-17",
          limit: "250",
          offset: "250"
        }
      } as any,
      res
    );

    expect(detectSourceAdvanceMock).toHaveBeenCalledWith(expect.anything(), {
      snapshotDate: "2026-10-17",
      playerIds: Array.from({ length: 250 }, (_, index) => index + 251),
      windowCodes: ["l3", "l5", "l10", "l20"]
    });
    expect(res.body.skipped).toBeUndefined();
    expect(assertScorePrerequisitesMock).toHaveBeenCalledWith(
      20252026,
      "2026-10-17"
    );
  });

  it("does not consult the skip check when force=true", async () => {
    assertScorePrerequisitesMock.mockRejectedValue(
      new SustainabilityDependencyError(issue)
    );
    const res = createMockRes();

    await handler(
      { method: "GET", query: { season: "current", force: "true" } } as any,
      res
    );

    expect(detectSourceAdvanceMock).not.toHaveBeenCalled();
    expect(assertScorePrerequisitesMock).toHaveBeenCalled();
  });

  it("persists every player and window across all runAll batches with complete distribution receipts", async () => {
    const ids = prepareSuccessfulPopulation();
    const res = createMockRes();
    await rebuildScoreHandler({ query: { snapshot_date: "2026-10-19", runAll: "true", limit: "250", verify_sample: "0" } } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, run_all: true, dry: false, processed_players: 1001, batches_processed: 5, rows_built: 4004, rows_upserted: 4004, write_chunks: 11, distribution_snapshots_persisted: 4 });
    const persisted = scoreUpsertMock.mock.calls.flatMap(([rows]) => rows);
    expectCompletePopulation(persisted, ids);
    expect(scoreUpsertMock.mock.calls.map(([rows]) => rows.length)).toEqual([...Array(10).fill(400), 4]);
    for (const [, options] of scoreUpsertMock.mock.calls) expect(options.onConflict).toBe("player_id,snapshot_date,window_code");
    expect(distributionUpsertMock).toHaveBeenCalledOnce();
    const [distributions, options] = distributionUpsertMock.mock.calls[0];
    expect(options.onConflict).toBe("config_revision,season_id,snapshot_date,window_code");
    expect(distributions.map((row: any) => row.window_code)).toEqual(["l3", "l5", "l10", "l20"]);
    for (const row of distributions) {
      expect(row).toMatchObject({ config_revision: 7, model_version: "synthetic-v1", config_hash: "synthetic-config", snapshot_date: "2026-10-19", population_count: 1001, minimum: 0, maximum: 100, mean: 50, percentiles: { p20: 20, p50: 50, p80: 80 } });
      expect(res.body.distribution_snapshot[row.window_code]).toMatchObject({ count: 1001, minimum: 0, maximum: 100, mean: 50 });
    }
    expect(detectSourceAdvanceMock.mock.calls[0][1].playerIds).toEqual(ids);
  });

  it("builds the complete runAll population and quintiles in dry-run mode without database writes", async () => {
    const ids = prepareSuccessfulPopulation();
    const res = createMockRes();
    await rebuildScoreHandler({ query: { snapshot_date: "2026-10-19", runAll: "true", limit: "250", verify_sample: "0", dry: "true" } } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, dry: true, processed_players: 1001, batches_processed: 5, rows_built: 4004, rows_upserted: 0, write_chunks: 0, distribution_snapshots_persisted: 0, distribution_drift: null });
    expect(upsertScoresMock).toHaveBeenCalledOnce();
    const [prepared, dry] = upsertScoresMock.mock.calls[0];
    expect(dry).toBe(true);
    expectCompletePopulation(prepared, ids);
    expect(Object.values(res.body.distribution_snapshot)).toHaveLength(4);
    expect(Object.values(res.body.distribution_snapshot).every((distribution: any) => distribution.count === 1001 && distribution.mean === 50)).toBe(true);
    expect(supabaseFromMock).not.toHaveBeenCalled();
    expect(scoreUpsertMock).not.toHaveBeenCalled();
    expect(distributionUpsertMock).not.toHaveBeenCalled();
  });
});
