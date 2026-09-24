import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  getFantraxConnections: vi.fn(),
  getFantraxAdp: vi.fn(),
  getFantraxPlayerIds: vi.fn(),
  getFantraxLeagueInfo: vi.fn(),
}));
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: mocks.requireApiUser }));
vi.mock("lib/integrations/fantrax/server", () => ({ getFantraxConnections: mocks.getFantraxConnections }));
vi.mock("lib/integrations/fantrax/client", () => ({
  getFantraxAdp: mocks.getFantraxAdp,
  getFantraxPlayerIds: mocks.getFantraxPlayerIds,
  getFantraxLeagueInfo: mocks.getFantraxLeagueInfo,
}));

import handler from "./player-data";

function response() {
  const res = {
    setHeader: vi.fn(), status: vi.fn(), json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe("Fantrax dashboard player data access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "user-1" });
    mocks.getFantraxConnections.mockResolvedValue({ accounts: [{ leagues: [{ id: "linked-league", externalLeagueKey: "fantrax-key" }] }] });
  });

  it("rejects a league outside the signed-in user's links without contacting Fantrax", async () => {
    const res = response();
    await handler({ method: "GET", query: { externalLeagueId: "another-league" } } as unknown as NextApiRequest, res as unknown as NextApiResponse);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.getFantraxPlayerIds).not.toHaveBeenCalled();
  });

  it("returns Fantrax ADP and league eligibility for a linked league", async () => {
    mocks.getFantraxPlayerIds.mockResolvedValue({ "fx-1": { fantraxId: "fx-1", name: "Stützle, Tim", team: "OTT", position: "C" } });
    mocks.getFantraxAdp.mockResolvedValue([{ id: "fx-1", ADP: 15.2 }]);
    mocks.getFantraxLeagueInfo.mockResolvedValue({ playerInfo: { "fx-1": { eligiblePos: "C,LW,Skt" } } });
    const res = response();
    await handler({ method: "GET", query: { externalLeagueId: "linked-league" } } as unknown as NextApiRequest, res as unknown as NextApiResponse);
    expect(mocks.getFantraxLeagueInfo).toHaveBeenCalledWith("fantrax-key");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      eligibilityLoaded: true,
      players: [{ name: "Tim Stützle", team: "OTT", position: "C", eligiblePositions: ["C", "LW"], adp: 15.2 }],
    });
  });
});
