import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler
}));

const {
  assertScorePrerequisitesMock,
  detectSourceAdvanceMock,
  loadPlayersForSnapshotMock,
  resolveSeasonIdMock,
  issue
} = vi.hoisted(() => ({
  assertScorePrerequisitesMock: vi.fn(),
  detectSourceAdvanceMock: vi.fn(),
  loadPlayersForSnapshotMock: vi.fn(),
  resolveSeasonIdMock: vi.fn(),
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

import handler from "../../../../../pages/api/v1/sustainability/rebuild-score";
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
  beforeEach(() => {
    vi.clearAllMocks();
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
});
