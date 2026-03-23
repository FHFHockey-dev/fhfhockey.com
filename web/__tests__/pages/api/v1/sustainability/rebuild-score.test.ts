import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  assertScorePrerequisitesMock,
  resolveSeasonIdMock,
  issue
} = vi.hoisted(() => ({
  assertScorePrerequisitesMock: vi.fn(),
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
});
