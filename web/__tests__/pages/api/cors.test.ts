// @vitest-environment node
import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../../pages/api/cors";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("node-fetch", () => ({ default: fetchMock }));

const GAME_URL = "https://api-web.nhle.com/v1/gamecenter/2026010054/boxscore";

function response() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    setHeader: vi.fn(),
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; }
  };
}

async function request(query: NextApiRequest["query"], method = "GET") {
  const res = response();
  await handler({ method, query } as NextApiRequest, res as unknown as NextApiResponse);
  return res;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => { throw new Error("Unexpected transport"); });
});
afterEach(() => vi.restoreAllMocks());

describe("NHL proxy boundary", () => {
  it("rejects the unauthenticated arbitrary-method loopback reproduction before transport", async () => {
    const res = await request({ url: "http://127.0.0.1:7777/synthetic", method: "DELETE" });
    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["POST", "DELETE", "PUT", "PATCH", "HEAD", "OPTIONS"])("denies HTTP %s", async (method) => {
    const res = await request({ url: GAME_URL }, method);
    expect(res.statusCode).toBe(405);
    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    {}, { url: "" }, { url: [GAME_URL, GAME_URL] },
    { url: GAME_URL, method: "DELETE" }, { url: GAME_URL, method: ["GET"] },
    { url: "https://169.254.169.254/latest/meta-data" },
    { url: "https://10.1.2.3/v1/schedule/now" },
    { url: "https://[::1]/v1/schedule/now" },
    { url: "https://2130706433/v1/schedule/now" },
    { url: "https://0x7f000001/v1/schedule/now" },
    { url: GAME_URL.replace("https:", "http:") },
    { url: GAME_URL.replace("https:", "file:") },
    { url: GAME_URL.replace("api-web.nhle.com", "api-web.nhle.com.attacker.invalid") },
    { url: GAME_URL.replace("api-web.nhle.com", "api-web.nhle.com@127.0.0.1") },
    { url: GAME_URL.replace("api-web.nhle.com", "user:pass@api-web.nhle.com") },
    { url: GAME_URL.replace("api-web.nhle.com", "api-web.nhle.com:8443") },
    { url: GAME_URL.replace("api-web.nhle.com", "api-web.nhle.com:443") },
    { url: GAME_URL.replace("api-web.nhle.com", "api-web.nhle.com.") },
    { url: GAME_URL.replace("api-web.nhle.com", "%61pi-web.nhle.com") },
    { url: GAME_URL.replace("/v1/", "\\v1/") },
    { url: `${GAME_URL}#fragment` }, { url: `${GAME_URL}#` },
    { url: `${GAME_URL}\n` }, { url: ` ${GAME_URL}` },
    { url: GAME_URL.replace("/v1/", "/unapproved/../v1/") },
    { url: GAME_URL.replace("/v1/", "/unapproved/%2e%2e/v1/") },
    { url: GAME_URL.replace("/v1/", "/%76%31/") },
    { url: "https://api-web.nhle.com/v1/arbitrary-path" },
    { url: `${GAME_URL}?url=http://127.0.0.1` },
    { url: "https://api.nhle.com/stats/rest/en/skater/unapproved" },
    { url: "https://api.nhle.com/stats/rest/en/season?redirect=https://attacker.invalid" },
    { url: "https://api.nhle.com/stats/rest/en/season?limit=1&limit=2" },
    { url: "https://api.nhle.com/stats/rest/en/season?limit=-1" },
    { url: "https://api.nhle.com/stats/rest/en/season?limit=101" },
    { url: "https://api.nhle.com/stats/rest/en/season?start=-1" },
    { url: "https://api.nhle.com/stats/rest/en/season?isGame=1" },
    { url: "https://api.nhle.com/stats/rest/en/season?sort=%00" },
    { url: "https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=1 or 1=1" },
    { url: "https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=2026010054&limit=100" },
    { url: `https://api.nhle.com/stats/rest/en/season?sort=${"a".repeat(2049)}` },
    { url: `${GAME_URL}?${"a".repeat(8192)}` }
  ])("rejects unsupported URL/query before transport: %j", async (query) => {
    const res = await request(query);
    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    GAME_URL,
    GAME_URL.replace("boxscore", "landing"),
    GAME_URL.replace("boxscore", "play-by-play"),
    "https://api-web.nhle.com/v1/schedule/2026-10-15",
    "https://api-web.nhle.com/v1/standings/2026-10-15",
    "https://api-web.nhle.com/v1/standings/now",
    "https://api-web.nhle.com/v1/score/2026-10-15",
    "https://api-web.nhle.com/v1/club-schedule-season/FLA/20262027",
    'https://api.nhle.com/stats/rest/en/season?sort=[{"property":"id","direction":"DESC"}]',
    "https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=2026010054",
    "https://api.nhle.com/stats/rest/en/team/summary?isAggregate=false&isGame=false&start=0&limit=50&factCayenneExp=gamesPlayed>=1&cayenneExp=franchiseId=1 and gameTypeId=2 and seasonId<=20262027 and seasonId>=20262027",
    "https://api.nhle.com/stats/rest/en/team/powerplay?isAggregate=false&isGame=false&start=0&limit=50&cayenneExp=teamId=1 and gameTypeId=2",
    "https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=false&isGame=true&start=100&limit=100&cayenneExp=gameDate%3C=%222026-10-15%2023:59:59%22%20and%20gameTypeId=2",
    "https://api.nhle.com/stats/rest/en/goalie/advanced?isAggregate=true&isGame=true&start=0&limit=50&factCayenneExp=gamesPlayed>=1&cayenneExp=franchiseId=1 and gameDate<='2026-10-15' and gameDate>='2026-10-01' and gameTypeId=2"
  ])("relays supported NHL caller resource: %s", async (url) => {
    const payload = { data: [{ id: 2026010054 }] };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload)));
    const res = await request({ url });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(new URL(url), expect.objectContaining({
      method: "GET", redirect: "manual", size: 4 * 1024 * 1024,
      headers: { Accept: "application/json", "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)" }
    }));
  });

  it("accepts the explicit GET compatibility parameter", async () => {
    fetchMock.mockResolvedValue(new Response("{}"));
    expect((await request({ url: GAME_URL, method: "GET" })).statusCode).toBe(200);
  });

  it("keeps upstream HTML diagnostics bounded", async () => {
    fetchMock.mockResolvedValue(new Response('<html><title>NHL | 503: Unavailable</title>' + "x".repeat(500), {
      status: 503, headers: { "content-type": "text/html" }
    }));
    const res = await request({ url: GAME_URL });
    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({ upstreamStatus: 503, message: expect.stringContaining("Code 503.") });
    expect((res.body as { detail: string }).detail.length).toBe(240);
  });

  it("rejects successful non-JSON bodies", async () => {
    fetchMock.mockResolvedValue(new Response("not json", { headers: { "content-type": "text/plain" } }));
    const res = await request({ url: GAME_URL });
    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({ message: "Expected JSON but received text/plain." });
  });

  it("does not expose raw network failure details", async () => {
    fetchMock.mockRejectedValue(new Error("synthetic private DNS detail"));
    const res = await request({ url: GAME_URL });
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ success: false, message: "Unable to retrieve NHL data." });
  });

  it("relays a now resource through one approved dated redirect", async () => {
    const dated = "https://api-web.nhle.com/v1/standings/2026-10-17";
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 307, headers: { location: dated } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ standings: [] })));
    const res = await request({ url: "https://api-web.nhle.com/v1/standings/now" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ standings: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(new URL(dated), expect.objectContaining({ redirect: "manual" }));
  });

  it("hides a redirect to an unapproved destination behind the fixed transport error", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://127.0.0.1:7777/synthetic" } }));
    const res = await request({ url: GAME_URL });
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ success: false, message: "Unable to retrieve NHL data." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
