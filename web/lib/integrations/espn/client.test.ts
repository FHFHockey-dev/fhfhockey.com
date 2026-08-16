import { afterEach, describe, expect, it, vi } from "vitest";

import expiredFixture from "./__fixtures__/fhl-expired-session.json";
import malformedFixture from "./__fixtures__/fhl-malformed.json";
import pointsFixture from "./__fixtures__/fhl-points.json";
import { getEspnLeague, getEspnTransactions } from "./client";

const credentials = {
  swid: "{00000000-0000-0000-0000-000000000001}",
  espnS2: "redacted-session-secret",
};

function jsonResponse(payload: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("ESPN Fantasy Hockey client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests the FHL league-season endpoint with every full-sync view", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(pointsFixture));
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(
      getEspnLeague(
        { leagueId: "123456", season: 2026, credentials },
        { fetchImpl },
      ),
    ).resolves.toMatchObject({ id: 123456, seasonId: 2026 });

    const [requestUrl, init] = fetchImpl.mock.calls[0];
    const url = new URL(String(requestUrl));
    expect(url.pathname).toBe(
      "/apis/v3/games/fhl/seasons/2026/segments/0/leagues/123456",
    );
    expect(url.searchParams.getAll("view")).toEqual([
      "mSettings",
      "mTeam",
      "mRoster",
      "mStandings",
      "mMatchupScore",
      "mScoreboard",
      "mTransactions2",
      "mDraftDetail",
    ]);
    expect(new Headers(init?.headers).get("cookie")).toBe(
      `SWID=${credentials.swid}; espn_s2=${credentials.espnS2}`,
    );
  });

  it("retries throttling with Retry-After and never logs credentials or bodies", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ error: credentials.espnS2 }, 429, { "retry-after": "2" }),
      )
      .mockResolvedValueOnce(jsonResponse(pointsFixture));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await getEspnLeague(
      { leagueId: "123456", season: 2026, credentials },
      { fetchImpl, sleep },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2_000);
    const logs = [...info.mock.calls, ...warn.mock.calls].flat().join(" ");
    expect(logs).toContain("espn_fantasy_request");
    expect(logs).not.toContain(credentials.swid);
    expect(logs).not.toContain(credentials.espnS2);
    expect(logs).not.toContain("response");
  });

  it("marks an expired private session for reauthentication without retrying", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(expiredFixture, 403));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      getEspnLeague(
        { leagueId: "123456", season: 2026, credentials },
        { fetchImpl },
      ),
    ).rejects.toMatchObject({
      code: "ESPN_REAUTH_REQUIRED",
      statusCode: 409,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects malformed ESPN schemas and scopes transaction pagination", async () => {
    const malformedFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(malformedFixture));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      getEspnLeague(
        { leagueId: "123456", season: 2026, credentials },
        { fetchImpl: malformedFetch, maxAttempts: 1 },
      ),
    ).rejects.toMatchObject({ code: "ESPN_SCHEMA_MISMATCH" });

    const transactionFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ ...pointsFixture, transactions: [] }));
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await getEspnTransactions(
      {
        leagueId: "123456",
        season: 2026,
        credentials,
        scoringPeriodId: 7,
        transactionOffset: 100,
        transactionLimit: 100,
      },
      { fetchImpl: transactionFetch },
    );
    const [requestUrl, init] = transactionFetch.mock.calls[0];
    const url = new URL(String(requestUrl));
    expect(url.searchParams.getAll("view")).toEqual(["mTransactions2"]);
    expect(url.searchParams.get("scoringPeriodId")).toBe("7");
    expect(
      JSON.parse(
        String(new Headers(init?.headers).get("x-fantasy-filter")),
      ).transactions,
    ).toMatchObject({ limit: 100, offset: 100 });
  });
});
