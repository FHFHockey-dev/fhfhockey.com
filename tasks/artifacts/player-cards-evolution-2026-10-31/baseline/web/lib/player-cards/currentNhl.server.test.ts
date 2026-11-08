// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { loadCurrentNhlCard, readCurrentNhlJson, CURRENT_NHL_LIMITS } from "./currentNhl.server";
import handler from "../../pages/api/v1/player-cards";
import type { NextApiRequest, NextApiResponse } from "next";
const identity = { playerId: 8476453, firstName: { default: "Test" }, lastName: { default: "Skater" }, currentTeamAbbrev: "TBL", position: "R", seasonTotals: [{ season: 20262027, gameTypeId: 2, leagueAbbrev: "NHL", gamesPlayed: 0 }] };
afterEach(() => vi.unstubAllGlobals());
it("makes exactly three fixed sequential reads, no retries or database calls", async () => {
  const paths: string[] = [], signals: AbortSignal[] = [];
  const read = vi.fn(async (path: string, signal: AbortSignal) => { paths.push(path); signals.push(signal); return paths.length === 1 ? identity : paths.length === 2 ? { seasonId: 20262027, gameTypeId: 2, gameLog: [] } : { games: [] }; });
  const card = await loadCurrentNhlCard({ playerId: 8476453, season: 20262027, count: 10 }, read, () => new Date("2026-10-26T00:00:00Z"));
  expect(paths).toEqual(["/player/8476453/landing", "/player/8476453/game-log/20262027/2", "/club-schedule-season/TBL/20262027"]); expect(signals.every(signal => signal instanceof AbortSignal)).toBe(true); expect(card.state).toBe("unavailable"); expect(card.windows?.map(view => view.request.count)).toEqual([5, 10, 20]); expect(new Set(card.windows?.map(view => view.observedAt)).size).toBe(1);
});
it("stops on failure and rejects malformed input before the first source read", async () => {
  const read = vi.fn(async () => { throw new Error("offline"); });
  await expect(loadCurrentNhlCard({ playerId: 8476453, season: 20262027, count: 5 }, read)).rejects.toThrow("offline"); expect(read).toHaveBeenCalledTimes(1);
  read.mockClear(); await expect(loadCurrentNhlCard({ playerId: -1, season: 20262027, count: 5 }, read)).rejects.toThrow(); expect(read).not.toHaveBeenCalled();
});
it("bounds bytes and refuses redirects/credentials/unsupported source paths", async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } })); vi.stubGlobal("fetch", fetchMock);
  expect(await readCurrentNhlJson("/player/8476453/landing", AbortSignal.timeout(5000))).toEqual({ ok: true });
  expect(fetchMock.mock.calls[0]).toEqual(["https://api-web.nhle.com/v1/player/8476453/landing", expect.objectContaining({ redirect: "error", credentials: "omit", cache: "no-store" })]);
  await expect(readCurrentNhlJson("//other.example/private", AbortSignal.timeout(5000))).rejects.toThrow("Unsupported"); expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockImplementation(async () => new Response("x".repeat(CURRENT_NHL_LIMITS.bytesPerResponse + 1), { headers: { "content-type": "application/json" } }));
  await expect(readCurrentNhlJson("/player/8476453/landing", AbortSignal.timeout(5000))).rejects.toThrow("byte limit"); expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("the API rejects mutations and bad queries before reads, and returns unavailable rather than invented zeros", async () => {
  const responses = [identity, { seasonId: 20262027, gameTypeId: 2, gameLog: [] }, { games: [] }]; let call = 0;
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(responses[call++]), { headers: { "content-type": "application/json" } })); vi.stubGlobal("fetch", fetchMock);
  const response = () => { const result = { code: 0, body: null as unknown, setHeader: vi.fn(), status(code: number) { this.code = code; return this; }, json(body: unknown) { this.body = body; return this; } }; return result; };
  const query = { playerId: "8476453", season: "20262027", count: "10" };
  for (const [method, fields, code] of [["POST", query, 405], ["GET", { ...query, count: "100" }, 400]] as const) {
    const res = response(); await handler({ method, query: fields } as unknown as NextApiRequest, res as unknown as NextApiResponse); expect(res.code).toBe(code); expect(fetchMock).not.toHaveBeenCalled();
  }
  const res = response(); await handler({ method: "GET", query } as unknown as NextApiRequest, res as unknown as NextApiResponse);
  expect(res.code).toBe(200); expect(res.body).toMatchObject({ state: "unavailable", sample: { gp: null, toiSeconds: null }, values: { goals: null } }); expect(fetchMock).toHaveBeenCalledTimes(3);
});
