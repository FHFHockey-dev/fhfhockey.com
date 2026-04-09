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

  it("rejects missing team selection before calling the server helper", async () => {
    const req: any = {
      method: "GET",
      query: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      error: "Missing team selection.",
    });
    expect(buildSplitsSurfaceMock).not.toHaveBeenCalled();
  });

  it("returns the splits payload for a valid request", async () => {
    buildSplitsSurfaceMock.mockResolvedValue({
      generatedAt: "2026-04-08T12:00:00.000Z",
      seasonId: 20252026,
      selection: {
        teamAbbreviation: "EDM",
        opponentAbbreviation: "VAN",
        playerId: 97,
      },
      playerOptions: [],
      matchupCards: [],
      teamLeaders: [],
      ppShotShare: [],
      playerVsTeam: null,
    });

    const req: any = {
      method: "GET",
      query: {
        team: "EDM",
        opponent: "VAN",
        playerId: "97",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(buildSplitsSurfaceMock).toHaveBeenCalledWith({
      teamAbbreviation: "EDM",
      opponentAbbreviation: "VAN",
      playerId: 97,
    });
    expect(res.body).toMatchObject({
      seasonId: 20252026,
      selection: {
        teamAbbreviation: "EDM",
      },
    });
  });
});
