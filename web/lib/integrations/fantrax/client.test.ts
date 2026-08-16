import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getFantraxLeagueInfo,
  getFantraxLeagues,
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
