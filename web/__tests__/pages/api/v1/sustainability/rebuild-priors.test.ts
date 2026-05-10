import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  assertPriorsPrerequisitesMock,
  resolveSeasonIdMock,
  ensureTablesMock,
  upsertLeaguePriorsMock,
  upsertPlayerPosteriorsMock,
  issue
} = vi.hoisted(() => ({
  assertPriorsPrerequisitesMock: vi.fn(),
  resolveSeasonIdMock: vi.fn(),
  ensureTablesMock: vi.fn(),
  upsertLeaguePriorsMock: vi.fn(),
  upsertPlayerPosteriorsMock: vi.fn(),
  issue: {
    code: "missing_player_totals_unified",
    message:
      "Missing prerequisite data in player_totals_unified for priors rebuild.",
    detail: "No player_totals_unified rows were found for season 20252026.",
    action:
      "Refresh player_totals_unified for the requested season before rebuilding priors."
  } as const
}));

vi.mock("../../../../../lib/sustainability/dependencyChecks", async () => {
  const actual =
    await vi.importActual<
      typeof import("../../../../../lib/sustainability/dependencyChecks")
    >("../../../../../lib/sustainability/dependencyChecks");
  return {
    ...actual,
    assertPriorsPrerequisites: assertPriorsPrerequisitesMock
  };
});

vi.mock("../../../../../lib/sustainability/resolveSeasonId", () => ({
  resolveSeasonId: resolveSeasonIdMock
}));

vi.mock("../../../../../lib/sustainability/priors", async () => {
  const actual =
    await vi.importActual<typeof import("../../../../../lib/sustainability/priors")>(
      "../../../../../lib/sustainability/priors"
    );
  return {
    ...actual,
    ensureTables: ensureTablesMock,
    upsertLeaguePriors: upsertLeaguePriorsMock,
    upsertPlayerPosteriors: upsertPlayerPosteriorsMock
  };
});

import handler from "../../../../../pages/api/v1/sustainability/rebuild-priors";
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

describe("/api/v1/sustainability/rebuild-priors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveSeasonIdMock.mockResolvedValue(20252026);
    assertPriorsPrerequisitesMock.mockResolvedValue(undefined);
    ensureTablesMock.mockResolvedValue(undefined);
    upsertLeaguePriorsMock.mockResolvedValue([]);
    upsertPlayerPosteriorsMock.mockResolvedValue({ inserted: 0, sample: [] });
  });

  it("returns a structured prerequisite failure when unified totals are missing", async () => {
    assertPriorsPrerequisitesMock.mockRejectedValue(
      new SustainabilityDependencyError(issue)
    );

    const req: any = { method: "GET", query: { season: "current" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(424);
    expect(res.body.success).toBe(false);
    expect(res.body.prerequisite).toEqual(issue);
    expect(res.body.dependencyError.message).toBe(issue.message);
  });

  it("passes bounded offset and limit controls to player posterior rebuild", async () => {
    const req: any = {
      method: "GET",
      query: { season: "current", dry: "true", offset: "250", limit: "125" }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(upsertPlayerPosteriorsMock).toHaveBeenCalledWith(
      20252026,
      { shp: 200, oishp: 800, ipp: 60 },
      true,
      expect.any(Map),
      { offset: 250, limit: 125 }
    );
    expect(res.body).toMatchObject({
      success: true,
      offset: 250,
      limit: 125
    });
  });
});
