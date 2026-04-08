import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildNstRequestUrl,
  buildNstUrl,
  fetchNstText,
  fetchNstTextByUrl,
  fetchNstTextWithCache,
  fetchNstTextWithCacheByUrl,
  getNstHeaders,
  isNstAuthError,
  isNstConfigError,
  isNstRateLimitError,
  isNstResponseError,
  NstConfigError,
  NST_BASE_URL,
  NST_HEADER_NAME,
  NstResponseError,
  redactNstMessage,
  redactNstUrl,
  toNstOperatorMessage
} from "./client";

describe("nst client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("builds NST urls on the data subdomain", () => {
    const url = buildNstUrl("playerreport.php", {
      stype: 2,
      sit: "all",
      playerid: 8478402
    });

    expect(url.toString()).toBe(
      `${NST_BASE_URL}/playerreport.php?stype=2&sit=all&playerid=8478402`
    );
  });

  it("redacts query-string auth tokens", () => {
    const redacted = redactNstUrl(
      `${NST_BASE_URL}/teamtable.php?sit=pk&key=super-secret`
    );

    expect(redacted).toContain("key=%5BREDACTED%5D");
    expect(redacted).not.toContain("super-secret");
  });

  it("redacts NST query-string tokens embedded inside messages", () => {
    const message = `NST failed at ${NST_BASE_URL}/teamtable.php?sit=pk&key=super-secret&rate=n`;

    const redacted = redactNstMessage(message);

    expect(redacted).toContain("key=[REDACTED]");
    expect(redacted).not.toContain("super-secret");
  });

  it("requires NST_KEY for header generation", () => {
    vi.stubEnv("NST_KEY", "");

    expect(() => getNstHeaders()).toThrowError(NstConfigError);
    expect(() => getNstHeaders()).toThrowError("NST_KEY missing");
  });

  it("classifies missing NST key as a config error with an operator-safe message", () => {
    const error = new NstConfigError("NST_KEY missing");

    expect(isNstConfigError(error)).toBe(true);
    expect(toNstOperatorMessage(error)).toBe("NST_KEY missing");
  });

  it("uses header-first auth by default", () => {
    vi.stubEnv("NST_KEY", "test-nst-key");

    const headers = getNstHeaders();

    expect(headers[NST_HEADER_NAME]).toBe("test-nst-key");
    expect(headers.Accept).toContain("text/html");
  });

  it("loads and trims NST_KEY from the environment before injecting the header", () => {
    vi.stubEnv("NST_KEY", "  trimmed-key  ");

    const headers = getNstHeaders();

    expect(headers[NST_HEADER_NAME]).toBe("trimmed-key");
  });

  it("supports explicit query-string auth fallback while still redacting logs", () => {
    vi.stubEnv("NST_KEY", "fallback-key");

    const url = buildNstRequestUrl(
      "teamtable.php",
      { sit: "pk", rate: "n" },
      true
    );

    expect(url.searchParams.get("key")).toBe("fallback-key");
    expect(redactNstUrl(url)).not.toContain("fallback-key");
  });

  it("rewrites full legacy NST urls onto the shared data-subdomain contract", async () => {
    vi.stubEnv("NST_KEY", "legacy-url-key");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response("<html>legacy</html>", { status: 200, statusText: "OK" })
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchNstTextByUrl(
      "https://naturalstattrick.com/playerreport.php?stype=2&sit=all&playerid=8478402"
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${NST_BASE_URL}/playerreport.php?stype=2&sit=all&playerid=8478402`
    );
    expect(result.text).toBe("<html>legacy</html>");
    expect(result.redactedUrl).toBe(
      `${NST_BASE_URL}/playerreport.php?stype=2&sit=all&playerid=8478402`
    );
  });

  it("fetches text with retries and returns a redacted url", async () => {
    vi.stubEnv("NST_KEY", "retry-key");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("upstream-error", { status: 500, statusText: "Server Error" })
      )
      .mockResolvedValueOnce(
        new Response("<html>ok</html>", { status: 200, statusText: "OK" })
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchNstText({
      path: "playerreport.php",
      query: { playerid: 8478402 },
      allowQueryKeyFallback: true,
      retries: 1
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.text).toBe("<html>ok</html>");
    expect(result.response.status).toBe(200);
    expect(result.redactedUrl).toContain("key=%5BREDACTED%5D");
    expect(result.redactedUrl).not.toContain("retry-key");
  });

  it("redacts query-string auth tokens from surfaced response text", async () => {
    vi.stubEnv("NST_KEY", "fallback-key");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        `blocked ${NST_BASE_URL}/playerreport.php?playerid=1&key=fallback-key`,
        { status: 200, statusText: "OK" }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchNstText({
      path: "playerreport.php",
      query: { playerid: 1 },
      allowQueryKeyFallback: true,
      retries: 0
    });

    expect(result.text).toContain("key=[REDACTED]");
    expect(result.text).not.toContain("fallback-key");
  });

  it("supports cached NST text fetches without using the raw key as the cache identity", async () => {
    vi.stubEnv("NST_KEY", "cache-key");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response("<html>cached</html>", { status: 200, statusText: "OK" })
    );

    vi.stubGlobal("fetch", fetchMock);

    const first = await fetchNstTextWithCache({
      path: "playerreport.php",
      query: { playerid: 99 },
      allowQueryKeyFallback: true
    });
    const second = await fetchNstTextWithCache({
      path: "playerreport.php",
      query: { playerid: 99 },
      allowQueryKeyFallback: true
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.text).toBe("<html>cached</html>");
    expect(second.text).toBe("<html>cached</html>");
    expect(first.redactedUrl).toContain("key=%5BREDACTED%5D");
    expect(first.redactedUrl).not.toContain("cache-key");
  });

  it("supports cached full-url NST fetches while preserving redacted cache identity", async () => {
    vi.stubEnv("NST_KEY", "legacy-cache-key");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response("<html>cached by url</html>", {
        status: 200,
        statusText: "OK"
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const first = await fetchNstTextWithCacheByUrl(
      "https://www.naturalstattrick.com/playerteams.php?sit=all&playerid=99"
    );
    const second = await fetchNstTextWithCacheByUrl(
      "https://www.naturalstattrick.com/playerteams.php?sit=all&playerid=99"
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.text).toBe("<html>cached by url</html>");
    expect(second.text).toBe("<html>cached by url</html>");
    expect(first.redactedUrl).toBe(
      `${NST_BASE_URL}/playerteams.php?sit=all&playerid=99`
    );
  });

  it("maps non-config failures to sanitized operator messages", () => {
    expect(
      toNstOperatorMessage(
        new NstResponseError({
          status: 403,
          redactedUrl: `${NST_BASE_URL}/playerreport.php?playerid=1`
        })
      )
    ).toBe("NST authentication failed");
    expect(
      toNstOperatorMessage(
        new NstResponseError({
          status: 429,
          redactedUrl: `${NST_BASE_URL}/playerreport.php?playerid=1`
        })
      )
    ).toBe("NST token budget exhausted");
    expect(
      toNstOperatorMessage(
        new NstResponseError({
          status: 503,
          redactedUrl: `${NST_BASE_URL}/playerreport.php?playerid=1`
        })
      )
    ).toBe("NST upstream failed");
    expect(toNstOperatorMessage(new Error("The operation was aborted"))).toBe(
      "NST request timed out"
    );
    expect(toNstOperatorMessage(new Error("socket hang up"))).toBe(
      "NST request failed"
    );
  });

  it("fails fast on NST auth errors instead of treating them as empty data", async () => {
    vi.stubEnv("NST_KEY", "auth-key");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response("forbidden", { status: 403, statusText: "Forbidden" })
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchNstTextByUrl(`${NST_BASE_URL}/playerreport.php?playerid=1`, {
        retries: 2
      })
    ).rejects.toMatchObject({
      name: "NstResponseError",
      status: 403
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails fast on NST token-budget exhaustion instead of retrying immediately", async () => {
    vi.stubEnv("NST_KEY", "rate-key");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response("too many requests", {
        status: 429,
        statusText: "Too Many Requests"
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchNstTextByUrl(`${NST_BASE_URL}/playerreport.php?playerid=1`, {
        retries: 2
      })
    ).rejects.toMatchObject({
      name: "NstResponseError",
      status: 429
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("classifies NST response errors by auth and token-budget semantics", () => {
    const authError = new NstResponseError({
      status: 401,
      redactedUrl: `${NST_BASE_URL}/playerreport.php?playerid=1`
    });
    const rateLimitError = new NstResponseError({
      status: 429,
      redactedUrl: `${NST_BASE_URL}/playerreport.php?playerid=1`
    });

    expect(isNstResponseError(authError)).toBe(true);
    expect(isNstAuthError(authError)).toBe(true);
    expect(isNstRateLimitError(authError)).toBe(false);
    expect(isNstRateLimitError(rateLimitError)).toBe(true);
  });
});
