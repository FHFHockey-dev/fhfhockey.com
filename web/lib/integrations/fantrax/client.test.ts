import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getFantraxAdp,
  getFantraxDraftResults,
  getFantraxLeagueInfo,
  getFantraxLeagues,
  getFantraxPlayerIds,
} from "./client";

function jsonResponse(payload: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("Fantrax FXEA client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the officially documented numbered draft results with GET", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      draftState: "completed", draftType: "snake", draftOrder: ["team"], draftPicks: [],
    }));
    await getFantraxDraftResults("league-1", { fetchImpl, maxAttempts: 1 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe("https://www.fantrax.com/fxea/general/getDraftResults?leagueId=league-1");
    expect(init?.method).toBe("GET");
    expect(String(url)).not.toContain("userSecretId");
  });

  it("reads the official NHL player ID catalog without a user credential", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      "fx-1": { name: "Dobson, Noah", fantraxId: "fx-1", team: "MTL", position: "D" },
    }));
    await expect(getFantraxPlayerIds({ fetchImpl, maxAttempts: 1 })).resolves.toHaveProperty("fx-1.name", "Dobson, Noah");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe("https://www.fantrax.com/fxea/general/getPlayerIds?sport=NHL");
    expect(init?.method).toBe("GET");
  });

  it("reads the official NHL ADP feed and rejects changed response shapes", async () => {
    const player = { id: "fx-1", name: "MacKinnon, Nathan", pos: "C" };
    const ranked = { ...player, ADP: 1.51 };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([ranked]));
    await expect(getFantraxAdp({ fetchImpl, maxAttempts: 1 })).resolves.toHaveLength(1);
    expect(String(fetchImpl.mock.calls[0][0])).toBe("https://www.fantrax.com/fxea/general/getAdp?sport=NHL&limit=1000");
    expect(fetchImpl.mock.calls[0][1]?.method).toBe("GET");
    fetchImpl.mockResolvedValueOnce(jsonResponse([ranked, { ...player, ADP: "unknown" }]));
    await expect(getFantraxAdp({ fetchImpl, maxAttempts: 1 })).rejects.toMatchObject({ code: "FANTRAX_SCHEMA_MISMATCH" });
    fetchImpl.mockResolvedValueOnce(jsonResponse([ranked, player]));
    await expect(getFantraxAdp({ fetchImpl, maxAttempts: 1 })).rejects.toMatchObject({ code: "FANTRAX_SCHEMA_MISMATCH" });
  });

  it("preserves explicit null and provider ordering for ADP rows", async () => {
    const a = { id: "fx-a", name: "Alpha, Avery", pos: "C" };
    const b = { id: "fx-b", name: "Beta, Blake", pos: "D" };
    const rows = [
      { ...a, ADP: 12.5 }, { ...a, ADP: null },
      { ...b, ADP: null }, { ...b, ADP: 42 },
      { id: "fx-c", name: "Gamma, Casey", pos: "LW", ADP: 70 },
      { id: "fx-zero", name: "Zero, Drew", pos: "G", ADP: 0 },
    ];
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(rows));

    await expect(getFantraxAdp({ fetchImpl, maxAttempts: 1 })).resolves.toEqual(rows);
  });

  it("retries 429 responses, respects Retry-After, and never logs credentials", async () => {
    const secretId = "fixture-secret-never-log";
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ error: `response ${secretId}` }, 429, {
          "retry-after": "2",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ league: { name: "NHL", sport: "NHL" } }),
      );
    const sleep = vi.fn().mockResolvedValue(undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      getFantraxLeagues(secretId, { fetchImpl, sleep }),
    ).resolves.toEqual({ league: { name: "NHL", sport: "NHL" } });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls[0][0]).toBeGreaterThanOrEqual(2_000);
    expect(sleep.mock.calls[0][0]).toBeLessThan(2_200);
    const logs = [...info.mock.calls, ...warn.mock.calls].flat().join(" ");
    expect(logs).toContain("FANTRAX_RATE_LIMITED");
    expect(logs).not.toContain(secretId);
    expect(logs).not.toContain("userSecretId");
    expect(logs).not.toContain("response");
  });

  it("rejects league-info responses when required settings structures disappear", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ leagueName: "Broken League" }));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      getFantraxLeagueInfo("league-1", { fetchImpl, maxAttempts: 1 }),
    ).rejects.toMatchObject({
      code: "FANTRAX_SCHEMA_MISMATCH",
      statusCode: 502,
    });
  });

  it("accepts additive fields and present-but-empty optional collections", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({
          leagueName: "Valid League",
          additiveLeagueField: true,
          rosterInfo: {
            positionConstraints: {},
            additiveRosterField: "kept",
          },
          scoringSystem: {
            type: "HEAD_TO_HEAD_POINTS",
            scoringCategorySettings: [],
            additiveScoringField: 1,
          },
          teamInfo: {},
        }),
      );
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(
      getFantraxLeagueInfo("league-1", { fetchImpl, maxAttempts: 1 }),
    ).resolves.toMatchObject({
      additiveLeagueField: true,
      rosterInfo: { additiveRosterField: "kept" },
      scoringSystem: { additiveScoringField: 1 },
    });
  });

  it("retries network failures at most three times", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("network unavailable"));
    const sleep = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      getFantraxLeagues("secret", { fetchImpl, sleep }),
    ).rejects.toMatchObject({
      code: "FANTRAX_NETWORK_ERROR",
      statusCode: 502,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("surfaces a long Retry-After without retrying before it expires", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({}, 429, { "retry-after": "120" }),
      );
    const sleep = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      getFantraxLeagues("secret", { fetchImpl, sleep }),
    ).rejects.toMatchObject({
      code: "FANTRAX_RATE_LIMITED",
      statusCode: 429,
      retryAfterSeconds: 120,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
