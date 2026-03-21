import { beforeEach, describe, expect, it, vi } from "vitest";

const { assertTrendBandPrerequisitesMock, issue } = vi.hoisted(() => ({
  assertTrendBandPrerequisitesMock: vi.fn(),
  issue: {
    code: "missing_player_totals_unified",
    message:
      "Missing prerequisite data in player_totals_unified for trend-band rebuild.",
    detail: "No player_totals_unified rows were found for any player.",
    action:
      "Refresh player_totals_unified before rebuilding sustainability trend bands."
  } as const
}));

vi.mock("../../../../../lib/sustainability/dependencyChecks", async () => {
  const actual =
    await vi.importActual<
      typeof import("../../../../../lib/sustainability/dependencyChecks")
    >("../../../../../lib/sustainability/dependencyChecks");
  return {
    ...actual,
    assertTrendBandPrerequisites: assertTrendBandPrerequisitesMock
  };
});

import handler from "../../../../../pages/api/v1/sustainability/rebuild-trend-bands";
import { SustainabilityDependencyError } from "../../../../../lib/sustainability/dependencyChecks";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    setHeader() {
      return this;
    },
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

describe("/api/v1/sustainability/rebuild-trend-bands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a structured prerequisite failure when unified totals are missing", async () => {
    assertTrendBandPrerequisitesMock.mockRejectedValue(
      new SustainabilityDependencyError(issue)
    );

    const req: any = { method: "GET", query: { offset: "0", limit: "250" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(424);
    expect(res.body.success).toBe(false);
    expect(res.body.prerequisite).toEqual(issue);
    expect(res.body.dependencyError.message).toBe(issue.message);
  });
});
