import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  assertWindowZPrerequisitesMock,
  resolveSeasonIdMock,
  issue
} = vi.hoisted(() => ({
  assertWindowZPrerequisitesMock: vi.fn(),
  resolveSeasonIdMock: vi.fn(),
  issue: {
    code: "missing_sustainability_priors",
    message:
      "Missing sustainability_priors required for sustainability window-z rebuild.",
    detail: "No sustainability_priors rows were found for season 20252026.",
    action:
      "Run /api/v1/sustainability/rebuild-priors for the requested season before rebuilding window-z."
  } as const
}));

vi.mock("../../../../../lib/sustainability/dependencyChecks", async () => {
  const actual =
    await vi.importActual<
      typeof import("../../../../../lib/sustainability/dependencyChecks")
    >("../../../../../lib/sustainability/dependencyChecks");
  return {
    ...actual,
    assertWindowZPrerequisites: assertWindowZPrerequisitesMock
  };
});

vi.mock("../../../../../lib/sustainability/resolveSeasonId", () => ({
  resolveSeasonId: resolveSeasonIdMock
}));

import handler from "../../../../../pages/api/v1/sustainability/rebuild-window-z";
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

describe("/api/v1/sustainability/rebuild-window-z", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveSeasonIdMock.mockResolvedValue(20252026);
  });

  it("returns a structured prerequisite failure when priors are missing", async () => {
    assertWindowZPrerequisitesMock.mockRejectedValue(
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
