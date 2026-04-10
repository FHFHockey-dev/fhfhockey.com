import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildSplitsSurfaceMock } = vi.hoisted(() => ({
  buildSplitsSurfaceMock: vi.fn(),
}));

vi.mock("../../../../../lib/splits/splitsServer", () => ({
  buildSplitsSurface: buildSplitsSurfaceMock,
}));

import handler from "../../../../../pages/api/v1/splits/index";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as unknown,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("/api/v1/splits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the landing payload without a team selection", async () => {
    buildSplitsSurfaceMock.mockResolvedValue({
      generatedAt: "2026-04-10T12:00:00.000Z",
      seasonId: 20252026,
      teamOptions: [],
      selection: {
        teamAbbreviation: null,
        opponentAbbreviation: null,
        effectiveOpponentAbbreviation: null,
      },
      landing: {
        topSkaters: [],
        topGoalies: [],
      },
      ppShotShare: [],
      roster: null,
    });

    const req: any = {
      method: "GET",
      query: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(buildSplitsSurfaceMock).toHaveBeenCalledWith({
      teamAbbreviation: null,
      opponentAbbreviation: null,
      includeLanding: true,
    });
  });

  it("passes team and opponent through for a valid request", async () => {
    buildSplitsSurfaceMock.mockResolvedValue({
      generatedAt: "2026-04-10T12:00:00.000Z",
      seasonId: 20252026,
      teamOptions: [],
      selection: {
        teamAbbreviation: "EDM",
        opponentAbbreviation: "ANA",
        effectiveOpponentAbbreviation: "ANA",
      },
      landing: {
        topSkaters: [],
        topGoalies: [],
      },
      ppShotShare: [],
      roster: {
        skaters: [],
        goalies: [],
      },
    });

    const req: any = {
      method: "GET",
      query: {
        team: "EDM",
        opponent: "ANA",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(buildSplitsSurfaceMock).toHaveBeenCalledWith({
      teamAbbreviation: "EDM",
      opponentAbbreviation: "ANA",
      includeLanding: true,
    });
  });

  it("skips landing payload construction for roster-only requests", async () => {
    buildSplitsSurfaceMock.mockResolvedValue({
      generatedAt: "2026-04-10T12:00:00.000Z",
      seasonId: 20252026,
      teamOptions: [],
      selection: {
        teamAbbreviation: "CAR",
        opponentAbbreviation: null,
        effectiveOpponentAbbreviation: "ANA",
      },
      landing: {
        topSkaters: [],
        topGoalies: [],
      },
      ppShotShare: [],
      roster: {
        skaters: [],
        goalies: [],
      },
    });

    const req: any = {
      method: "GET",
      query: {
        team: "CAR",
        mode: "roster",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(buildSplitsSurfaceMock).toHaveBeenCalledWith({
      teamAbbreviation: "CAR",
      opponentAbbreviation: null,
      includeLanding: false,
    });
  });
});
