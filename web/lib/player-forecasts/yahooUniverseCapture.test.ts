import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ token: vi.fn() }));
vi.mock("../integrations/yahoo/tokenManager", () => ({ getYahooAccessToken: mocks.token, markYahooReauthenticationRequired: vi.fn() }));
vi.mock("../integrations/yahoo/gameContext", async (original) => ({ ...await original<typeof import("../integrations/yahoo/gameContext")>(),
  resolveYahooGameContext: async () => ({ gameCode: "nhl", gameKey: "477", season: "2026", targetSeasonId: 20262027 }) }));

import { captureYahooUniverseOriginals, validateYahooUniverseAllocation } from "./yahooUniverseCapture";
import { buildYahooUniverse, yahooUniverseRequestUrls } from "./yahooUniverse";
import { syntheticDate, syntheticIdentityRow, syntheticPageBody, syntheticRosterBody, syntheticScope } from "./yahooUniverse.fixtures";

const TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";
const allocation = validateYahooUniverseAllocation({ version: "forge-daily-yahoo-universe-allocation-v1", ...syntheticScope,
  userId: "00000000-0000-4000-8000-000000000001", externalTeamId: "00000000-0000-4000-8000-000000000002" });
const urls = yahooUniverseRequestUrls(allocation, syntheticDate);
const bodies = [syntheticRosterBody([{ key: "477.p.1" }]), syntheticPageBody([{ key: "477.p.2" }]), syntheticPageBody([])];
const clock = () => new Date("2026-10-20T10:30:00.000Z");

function database(teamMetadata: Record<string, unknown> = { is_owned: true }) {
  const rows: Record<string, unknown> = {
    external_teams: { id: allocation.externalTeamId, external_team_key: allocation.teamKey, external_league_id: "league-row", connected_account_id: "account-row", team_metadata: teamMetadata },
    external_leagues: { id: "league-row", external_league_key: allocation.leagueKey, connected_account_id: "account-row" } };
  return { from: (table: string) => { const query: any = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: rows[table] ?? null, error: null }) }; return query; } } as any;
}
function network(status = (_url: string) => 200) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === TOKEN_URL) return new Response(JSON.stringify({ access_token: "synthetic-token-body" }), { status: 200 });
    const index = urls.indexOf(url);
    if (index < 0) throw new Error(`unexpected ${url}`);
    return new Response(status(url) === 200 ? bodies[index] : "{}", { status: status(url), headers: { date: clock().toUTCString() } });
  });
}

describe("Yahoo universe capture", () => {
  beforeEach(() => {
    // The token manager refreshes through the same fetch; that traffic must pass through unrecorded.
    mocks.token.mockReset().mockImplementation(async (_account: string, _user: string, options: { fetchImpl: typeof fetch }) => {
      await options.fetchImpl(TOKEN_URL, { method: "POST" });
      return { accessToken: "synthetic-access", refreshAttempted: true, refreshOutcome: "refreshed" };
    });
  });

  it("retains exactly the three planned original bodies through the existing provider client", async () => {
    const events: Array<[string, Record<string, unknown>]> = [], fetchImpl = network();
    const result = await captureYahooUniverseOriginals({ db: database(), allocation, date: syntheticDate, network: fetchImpl,
      wait: async () => undefined, now: clock, event: (action, fields) => events.push([action, fields]) });
    expect(result).toMatchObject({ failures: [], attempted: 3 });
    expect(result.receipts.map(receipt => [receipt.url, receipt.rawBody, receipt.responseDate])).toEqual(urls.map((url, index) => [url, bodies[index], "2026-10-20T10:30:00.000Z"]));
    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([TOKEN_URL, urls[0], TOKEN_URL, urls[1], TOKEN_URL, urls[2]]);
    expect(events.map(([action]) => action)).toEqual(["request_intent", "response_completed", "request_intent", "response_completed", "request_intent", "response_completed"]);
    expect(JSON.stringify(events)).not.toMatch(/synthetic-(?:access|token-body)|Bearer/);
    const universe = buildYahooUniverse({ receipts: result.receipts, scope: allocation, date: syntheticDate,
      identityRows: [syntheticIdentityRow("477.p.1", 101, 8470001), syntheticIdentityRow("477.p.2", 102, 8470002)] });
    expect(universe).toMatchObject({ status: "complete", counts: { ownedResolved: 1, candidatesResolved: 1 } });
  });

  it("stops at the first provider failure without further requests", async () => {
    const events: string[] = [], fetchImpl = network(url => url === urls[1] ? 429 : 200);
    const result = await captureYahooUniverseOriginals({ db: database(), allocation, date: syntheticDate, network: fetchImpl,
      wait: async () => undefined, now: clock, event: action => events.push(action) });
    expect(result).toMatchObject({ attempted: 2, failures: [{ url: urls[1], reason: "yahoo_rate_limited" }] });
    expect(result.receipts).toHaveLength(1);
    expect(fetchImpl.mock.calls.map(([url]) => String(url))).not.toContain(urls[2]);
    expect(events.at(-1)).toBe("request_failed");
  });

  it("checks owned-team scope before any provider request", async () => {
    const fetchImpl = network();
    await expect(captureYahooUniverseOriginals({ db: database({ is_owned: false }), allocation, date: syntheticDate, network: fetchImpl,
      wait: async () => undefined, now: clock, event: () => undefined })).rejects.toThrow("owned_team_unverified");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(mocks.token).not.toHaveBeenCalled();
    expect(() => validateYahooUniverseAllocation({ ...allocation, userId: "not-a-uuid" })).toThrow("invalid_allocation");
    expect(() => validateYahooUniverseAllocation({ ...allocation, teamKey: "477.l.901.t.3" })).toThrow("invalid_yahoo_universe_scope");
  });
});
