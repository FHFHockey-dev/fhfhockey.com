import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchNstTextWithCacheByUrlMock, getPlayerMock } = vi.hoisted(() => ({
  fetchNstTextWithCacheByUrlMock: vi.fn(),
  getPlayerMock: vi.fn()
}));

vi.mock("lib/nst/client", () => ({
  fetchNstTextWithCacheByUrl: fetchNstTextWithCacheByUrlMock
}));

vi.mock("lib/NHL/server", () => ({
  getPlayer: getPlayerMock
}));

import handler from "./[playerId]";

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

describe("/api/SustainabilityStats/[playerId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves representative playerteams skater metrics through the migrated NST client", async () => {
    getPlayerMock.mockResolvedValue({
      fullName: "John Doe",
      teamName: "Toronto Maple Leafs",
      teamId: 10
    });

    fetchNstTextWithCacheByUrlMock
      .mockResolvedValueOnce({
        text: `
          <table id="indreg">
            <tr><th>Season</th><th>Player</th><th>SH%</th><th>ixG</th><th>Shots</th><th>IPP</th><th>Second Assists</th><th>Total Assists</th><th>TOI</th><th>iHDCF</th><th>iSCF</th><th>Goals</th></tr>
            <tr><td>20242025</td><td>John Doe</td><td>10.0</td><td>12</td><td>100</td><td>70.0</td><td>5</td><td>20</td><td>100.0</td><td>14</td><td>25</td><td>10</td></tr>
            <tr><td>20242025</td><td>Other Skater</td><td>8.0</td><td>10</td><td>80</td><td>60.0</td><td>4</td><td>10</td><td>90.0</td><td>10</td><td>20</td><td>8</td></tr>
          </table>
        `
      })
      .mockResolvedValueOnce({
        text: `
          <table id="players">
            <tr><th>Season</th><th>Player</th><th>On-Ice SH%</th><th>Off. Zone Start %</th></tr>
            <tr><td>20242025</td><td>John Doe</td><td>9.0</td><td>55.0</td></tr>
            <tr><td>20242025</td><td>Other Skater</td><td>8.0</td><td>50.0</td></tr>
          </table>
        `
      });

    const req: any = {
      query: { playerId: "8478402" },
      body: { Season: "20242025", StartTime: null, EndTime: null }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(fetchNstTextWithCacheByUrlMock).toHaveBeenNthCalledWith(
      1,
      "https://data.naturalstattrick.com/playerteams.php?stype=2&sit=all&score=all&rate=n&pos=S&loc=B&toi=0&gpfilt=gpdate&tgp=410&lines=single&draftteam=ALL&fromseason=20242025&thruseason=20242025&team=TOR&stdoi=std"
    );
    expect(fetchNstTextWithCacheByUrlMock).toHaveBeenNthCalledWith(
      2,
      "https://data.naturalstattrick.com/playerteams.php?stype=2&sit=all&score=all&rate=n&pos=S&loc=B&toi=0&gpfilt=gpdate&tgp=410&lines=single&draftteam=ALL&fromseason=20242025&thruseason=20242025&team=TOR&stdoi=oi"
    );
    expect(res.body).toMatchObject({
      success: true,
      data: {
        "S%": 0.1,
        "xS%": 0.12,
        IPP: 0.7,
        "oiSH%": 0.09,
        "secA%": 0.25,
        "SOG/60": 60,
        "oZS%": 0.55,
        iHDCF: 14,
        iSCF: 25,
        ixG: 12,
        goals: 10
      }
    });
  });
});
