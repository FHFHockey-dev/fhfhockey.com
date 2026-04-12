import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchNstTextByUrlMock } = vi.hoisted(() => ({
  fetchNstTextByUrlMock: vi.fn()
}));

vi.mock("lib/nst/client", () => ({
  fetchNstTextByUrl: fetchNstTextByUrlMock
}));

import handler from "./fetch_team_table";

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
    },
    setHeader() {
      return this;
    }
  } as any;
}

describe("/api/fetch_team_table", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves representative NST teamtable row parsing through the migrated client", async () => {
    fetchNstTextByUrlMock.mockResolvedValue({
      text: `
        <html>
          <body>
            <table id="teams">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>GP</th>
                  <th>TOI</th>
                  <th>CF%</th>
                  <th>FF%</th>
                  <th>SF%</th>
                  <th>GF%</th>
                  <th>PDO</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Toronto Maple Leafs</td>
                  <td>1</td>
                  <td>60</td>
                  <td>52.4</td>
                  <td>51.0</td>
                  <td>54.5</td>
                  <td>100.0</td>
                  <td>101.2</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `,
      response: new Response("", { status: 200, statusText: "OK" })
    });

    const req: any = {
      method: "GET",
      query: {
        from_season: "20242025",
        thru_season: "20242025",
        sit: "pk",
        rate: "n",
        fd: "2025-01-15",
        td: "2025-01-15"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(fetchNstTextByUrlMock).toHaveBeenCalledWith(
      "https://data.naturalstattrick.com/teamtable.php?fromseason=20242025&thruseason=20242025&stype=2&sit=pk&score=all&rate=n&team=all&loc=B&gpf=410&fd=2025-01-15&td=2025-01-15",
      { timeoutMs: 10000 }
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([
      {
        date: "2025-01-15",
        situation: "pk",
        Team: "Toronto Maple Leafs",
        GP: "1",
        TOI: "60",
        CFPct: 52.4,
        FFPct: 51,
        SFPct: 54.5,
        GFPct: 100,
        PDO: "101.2"
      }
    ]);
  });
});
