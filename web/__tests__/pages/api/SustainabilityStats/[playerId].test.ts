import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withNstJobDispatch } from "lib/nst/jobLifecycle.server";

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

import handler from "../../../../pages/api/SustainabilityStats/[playerId]";

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
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("holds the whole parallel read when one source fails while the other is still active", async () => {
    vi.stubEnv("NST_JOB_LIFECYCLE_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://offline.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture");
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      const name = String(url).split("/").at(-1)!; calls.push(name);
      return new Response(JSON.stringify({ status: name.includes("begin") ? "started" : "held", token: JSON.parse(init!.body as string).p_token }));
    }));
    getPlayerMock.mockResolvedValue({ fullName: "Fixture", teamName: "Toronto Maple Leafs", teamId: 10 });
    let release!: () => void; let attempts = 0;
    fetchNstTextWithCacheByUrlMock.mockImplementation(() => withNstJobDispatch(async () => {
      if (++attempts === 1) throw new Error("fixture source failed");
      await new Promise<void>(resolve => { release = resolve; });
      return { text: "<body></body>" };
    }));
    const res = createMockRes();
    await handler({ query: { playerId: "fixture" }, body: { Season: "20262027" } } as any, res);
    expect(attempts).toBe(2);
    expect(res.statusCode).toBe(503);
    expect(calls).toEqual(["nst_job_begin_v1", "nst_job_hold_v1"]);
    release();
    await Promise.resolve();
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
            <tr><th>Season</th><th>Player</th><th>SH%</th><th>ixG</th><th>iFF</th><th>Shots</th><th>IPP</th><th>Second Assists</th><th>Total Assists</th><th>TOI</th><th>iHDCF</th><th>iSCF</th><th>Goals</th></tr>
            <tr><td>20242025</td><td>John Doe</td><td>10.0</td><td>12</td><td>150</td><td>100</td><td>70.0</td><td>5</td><td>20</td><td>100.0</td><td>14</td><td>25</td><td>10</td></tr>
            <tr><td>20242025</td><td>Other Skater</td><td>8.0</td><td>10</td><td>120</td><td>80</td><td>60.0</td><td>4</td><td>10</td><td>90.0</td><td>10</td><td>20</td><td>8</td></tr>
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
        "xS%": 0.08,
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
  it("keeps unknown TOI and zero assists unknown instead of 0 (L3 parseTime ticket)", async () => {
    getPlayerMock.mockResolvedValue({
      fullName: "John Doe",
      teamName: "Toronto Maple Leafs",
      teamId: 10
    });
    const individual = (toi: string) => ({
      text: `
        <table id="indreg">
          <tr><th>Season</th><th>Player</th><th>SH%</th><th>ixG</th><th>iFF</th><th>Shots</th><th>IPP</th><th>Second Assists</th><th>Total Assists</th><th>TOI</th><th>iHDCF</th><th>iSCF</th><th>Goals</th></tr>
          <tr><td>20262027</td><td>John Doe</td><td>-</td><td>1.5</td><td>-</td><td>10</td><td>-</td><td>0</td><td>0</td><td>${toi}</td><td>3</td><td>5</td><td>0</td></tr>
          <tr><td>20262027</td><td>Other Skater</td><td>8.0</td><td>10</td><td>120</td><td>80</td><td>60.0</td><td>4</td><td>10</td><td>90.0</td><td>10</td><td>20</td><td>8</td></tr>
        </table>`
    });
    const onIce = {
      text: `
        <table id="players">
          <tr><th>Season</th><th>Player</th><th>On-Ice SH%</th><th>Off. Zone Start %</th></tr>
          <tr><td>20262027</td><td>John Doe</td><td>-</td><td>55.0</td></tr>
          <tr><td>20262027</td><td>Other Skater</td><td>8.0</td><td>50.0</td></tr>
        </table>`
    };
    const run = async (toi: string) => {
      fetchNstTextWithCacheByUrlMock
        .mockResolvedValueOnce(individual(toi))
        .mockResolvedValueOnce(onIce);
      const res = createMockRes();
      await handler(
        { query: { playerId: "8478402" }, body: { Season: "20262027", StartTime: null, EndTime: null } } as any,
        res
      );
      return res.body.data;
    };

    // "20" is 20 minutes: 10 shots in 20 minutes = 30 SOG/60.
    expect((await run("20"))["SOG/60"]).toBeCloseTo(30, 10);
    for (const toi of ["-", ""]) {
      expect(await run(toi)).toMatchObject({
        "SOG/60": null,
        "secA%": null,
        "S%": null,
        "xS%": null,
        IPP: null,
        "oiSH%": null,
        iHDCF: 3
      });
    }
  });
});
