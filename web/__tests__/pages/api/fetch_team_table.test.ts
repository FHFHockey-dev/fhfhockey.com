import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchNstTextByUrlMock, getUserMock, roleMock, serviceFromMock } = vi.hoisted(() => ({
  fetchNstTextByUrlMock: vi.fn(),
  getUserMock: vi.fn(),
  roleMock: vi.fn(),
  serviceFromMock: vi.fn(),
}));

vi.mock("lib/nst/client", () => ({
  fetchNstTextByUrl: fetchNstTextByUrlMock
}));

vi.mock("lib/supabase/server", () => ({ default: { from: serviceFromMock } }));
vi.mock("lib/supabase", () => ({
  createClientWithToken: vi.fn(() => ({
    auth: { getUser: getUserMock },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: roleMock }) }) }),
  })),
}));

import handler from "../../../pages/api/fetch_team_table";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, unknown>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: unknown) {
      this.headers[name] = value;
      return this;
    }
  } as any;
}

describe("/api/fetch_team_table", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CRON_SECRET", "synthetic-cron-secret");
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in operator test"); }));
    getUserMock.mockResolvedValue({ data: { user: { id: "synthetic-admin" } }, error: null });
    roleMock.mockResolvedValue({ data: { role: "admin" } });
    serviceFromMock.mockImplementation(() => { throw new Error("Unexpected privileged database operation"); });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each(["Bearer synthetic-cron-secret", "Bearer admin-token"])("preserves representative NST teamtable row parsing for %s", async (authorization) => {
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
      headers: { authorization },
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

  it.each([
    { authorization: undefined, status: 401 },
    { authorization: "Bearer invalid-token", status: 401 },
    { authorization: "Bearer member-token", status: 403 },
  ])("denies $authorization before provider/database work", async ({ authorization, status }) => {
    if (status === 401) getUserMock.mockResolvedValue({ data: { user: null }, error: new Error("invalid token") });
    else roleMock.mockResolvedValue({ data: { role: "member" } });
    const res = createMockRes();
    await handler({ method: "GET", headers: { authorization }, query: {} } as any, res);
    expect(res.statusCode).toBe(status);
    expect(res.body).toEqual({ success: false, message: status === 401 ? "Unauthorized." : "You are not an Admin." });
    expect(fetchNstTextByUrlMock).not.toHaveBeenCalled();
    expect(serviceFromMock).not.toHaveBeenCalled();
  });

  it("keeps admitted GET-only method behavior without fetching", async () => {
    const res = createMockRes();
    await handler({ method: "POST", headers: { authorization: "Bearer synthetic-cron-secret" }, query: {} } as any, res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET");
    expect(res.body).toEqual({ error: "Method not allowed" });
    expect(fetchNstTextByUrlMock).not.toHaveBeenCalled();
    expect(serviceFromMock).not.toHaveBeenCalled();
  });

});
