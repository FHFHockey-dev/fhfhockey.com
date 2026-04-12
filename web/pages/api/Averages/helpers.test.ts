import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchNstTextWithCacheByUrlMock } = vi.hoisted(() => ({
  fetchNstTextWithCacheByUrlMock: vi.fn()
}));

vi.mock("lib/nst/client", () => ({
  buildNstUrlString: (path: string, query?: Record<string, string | number>) =>
    new URL(
      `${path.startsWith("/") ? path.slice(1) : path}`,
      "https://data.naturalstattrick.com/"
    ).toString() +
    (query
      ? `?${new URLSearchParams(
          Object.entries(query).map(([key, value]) => [key, String(value)])
        ).toString()}`
      : ""),
  fetchNstTextWithCacheByUrl: fetchNstTextWithCacheByUrlMock
}));

import { fetchPlayerData } from "./helpers";

describe("fetchPlayerData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves parsed individual and on-ice row shapes from the migrated NST client", async () => {
    fetchNstTextWithCacheByUrlMock.mockResolvedValue({
      text: `
        <html>
          <body>
            <table id="indreg">
              <tr><th>Season</th><th>Team</th><th>IPP</th><th>Shots</th></tr>
              <tr><td>20242025</td><td>TOR</td><td>75.0</td><td>200</td></tr>
              <tr><td>20232024</td><td>TOR</td><td>70.0</td><td>180</td></tr>
            </table>
            <table id="reg">
              <tr><th>Season</th><th>Team</th><th>On-Ice SH%</th><th>CF%</th></tr>
              <tr><td>20242025</td><td>TOR</td><td>8.5</td><td>53.2</td></tr>
              <tr><td>20232024</td><td>TOR</td><td>8.1</td><td>52.7</td></tr>
            </table>
          </body>
        </html>
      `,
      redactedUrl:
        "https://data.naturalstattrick.com/playerreport.php?stype=2&sit=all&stdoi=std&rate=n&v=p&playerid=8478402"
    });

    const result = await fetchPlayerData("8478402", "n");

    expect(fetchNstTextWithCacheByUrlMock).toHaveBeenCalledWith(
      "https://data.naturalstattrick.com/playerreport.php?stype=2&sit=all&stdoi=std&rate=n&v=p&playerid=8478402"
    );
    expect(result.individualRows).toEqual([
      {
        Season: "20242025",
        Team: "TOR",
        IPP: "75.0",
        Shots: "200"
      },
      {
        Season: "20232024",
        Team: "TOR",
        IPP: "70.0",
        Shots: "180"
      }
    ]);
    expect(result.onIceRows).toEqual([
      {
        Season: "20242025",
        Team: "TOR",
        "On-Ice SH%": "8.5",
        "CF%": "53.2"
      },
      {
        Season: "20232024",
        Team: "TOR",
        "On-Ice SH%": "8.1",
        "CF%": "52.7"
      }
    ]);
  });
});
