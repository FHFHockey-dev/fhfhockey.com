import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildNstRequestUrl,
  buildNstUrl,
  fetchNstText,
  fetchNstTextWithCache,
  getNstHeaders,
  isNstConfigError,
  NstConfigError,
  NST_BASE_URL,
  NST_HEADER_NAME,
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

  it("maps non-config failures to sanitized operator messages", () => {
    expect(toNstOperatorMessage(new Error("The operation was aborted"))).toBe(
      "NST request timed out"
    );
    expect(toNstOperatorMessage(new Error("socket hang up"))).toBe(
      "NST request failed"
    );
  });
});
