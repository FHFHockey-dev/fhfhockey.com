import { beforeEach, describe, expect, it, vi } from "vitest";

const { assertBaselinesPrerequisitesMock, issue } = vi.hoisted(() => ({
  assertBaselinesPrerequisitesMock: vi.fn(),
  issue: {
    code: "missing_player_stats_unified",
    message:
      "Missing prerequisite data in player_stats_unified for baseline rebuild.",
    detail: "No player_stats_unified rows were found on or after 2025-03-21.",
    action:
      "Refresh player_stats_unified before rebuilding sustainability baselines."
  } as const
}));

vi.mock("../../../../../../lib/sustainability/dependencyChecks", async () => {
  const actual =
    await vi.importActual<
      typeof import("../../../../../../lib/sustainability/dependencyChecks")
    >("../../../../../../lib/sustainability/dependencyChecks");
  return {
    ...actual,
    assertBaselinesPrerequisites: assertBaselinesPrerequisitesMock
  };
});

import handler from "../../../../../../pages/api/v1/db/sustainability/rebuild-baselines";
import { SustainabilityDependencyError } from "../../../../../../lib/sustainability/dependencyChecks";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  } as any;
}

describe("/api/v1/db/sustainability/rebuild-baselines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a structured prerequisite failure when unified stats are missing", async () => {
    assertBaselinesPrerequisitesMock.mockRejectedValue(
      new SustainabilityDependencyError(issue)
    );

    const req: any = {
      method: "GET",
      query: { snapshot_date: "2026-03-21" }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(424);
    expect(res.body.success).toBe(false);
    expect(res.body.prerequisite).toEqual(issue);
    expect(res.body.dependencyError.message).toBe(issue.message);
  });
});
