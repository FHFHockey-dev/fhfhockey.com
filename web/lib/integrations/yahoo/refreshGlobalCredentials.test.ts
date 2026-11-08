import { afterEach, describe, expect, it, vi } from "vitest";

import {
  refreshYahooGlobalCredentials,
  YahooGlobalRefreshError,
} from "./refreshGlobalCredentials";

const credentials = {
  id: 7,
  consumer_key: "synthetic-consumer",
  consumer_secret: "synthetic-secret",
  access_token: "synthetic-old-access",
  refresh_token: "synthetic-old-refresh",
};

function setup(payload: unknown = { access_token: "synthetic-new-access" }, status = 200) {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  const client = { from } as any;
  const json = vi.fn().mockResolvedValue(payload);
  const fetchImpl = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300, status, json,
  });
  return { client, from, update, eq, json, fetchImpl };
}

afterEach(() => vi.useRealTimers());

describe("single-attempt global Yahoo refresh", () => {
  it("awaits one validated refresh and persistence, without a secondary games call", async () => {
    const test = setup({
      access_token: "synthetic-new-access", refresh_token: "synthetic-new-refresh",
    });
    await expect(refreshYahooGlobalCredentials(test.client, credentials, test.fetchImpl))
      .resolves.toBeUndefined();
    expect(test.fetchImpl).toHaveBeenCalledTimes(1);
    const [url, request] = test.fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.login.yahoo.com/oauth2/get_token");
    expect(request).toMatchObject({ method: "POST", cache: "no-store", redirect: "error" });
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(request.headers.Authorization).toBe(
      `Basic ${Buffer.from("synthetic-consumer:synthetic-secret").toString("base64")}`,
    );
    expect(Object.fromEntries(request.body)).toEqual({
      grant_type: "refresh_token", refresh_token: "synthetic-old-refresh",
    });
    expect(test.update).toHaveBeenCalledWith({
      access_token: "synthetic-new-access", refresh_token: "synthetic-new-refresh",
      updated_at: expect.any(String),
    });
    expect(test.eq).toHaveBeenCalledWith("id", 7);
  });

  it("retains the previous refresh token only when a successful response omits it", async () => {
    const test = setup();
    await refreshYahooGlobalCredentials(test.client, credentials, test.fetchImpl);
    expect(test.update).toHaveBeenCalledWith(expect.objectContaining({
      access_token: "synthetic-new-access", refresh_token: "synthetic-old-refresh",
    }));
  });

  it.each([
    null, [], {}, { access_token: " " }, { access_token: 12 },
    { access_token: "synthetic-new-access", refresh_token: null },
    { access_token: "synthetic-new-access", refresh_token: "" },
    { access_token: "synthetic-new-access", refresh_token: 123 },
  ])("does not persist a malformed successful response: %j", async (payload) => {
    const test = setup(payload);
    await expect(refreshYahooGlobalCredentials(test.client, credentials, test.fetchImpl))
      .rejects.toMatchObject({ code: "yahoo_refresh_invalid_response", refreshOutcome: "unknown" });
    expect(test.from).not.toHaveBeenCalled();
    expect(test.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    [400, "invalid_grant", "yahoo_reauth_required", 409, "not_refreshed"],
    [401, "invalid_client", "yahoo_refresh_rejected", 502, "not_refreshed"],
    [429, "rate_limit", "yahoo_refresh_rate_limited", 429, "not_refreshed"],
    [503, "unavailable", "yahoo_refresh_rejected", 502, "unknown"],
    [200, "invalid_grant", "yahoo_refresh_rejected", 502, "unknown"],
  ])("rejects HTTP/OAuth failures without retries or secret leakage (%s/%s)", async (
    status, error, code, statusCode, refreshOutcome,
  ) => {
    const test = setup({
      error, error_description: "sensitive-fragment",
      access_token: "must-not-persist", refresh_token: "must-not-persist",
    }, Number(status));
    const promise = refreshYahooGlobalCredentials(test.client, credentials, test.fetchImpl);
    await expect(promise).rejects.toMatchObject({ code, statusCode, refreshOutcome });
    await expect(promise).rejects.toThrow("Yahoo token refresh failed");
    await expect(promise).rejects.not.toThrow(/sensitive-fragment/);
    expect(test.from).not.toHaveBeenCalled();
    expect(test.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("redacts transport errors and leaves rotation outcome uncertain", async () => {
    const test = setup();
    test.fetchImpl.mockRejectedValue(new Error("sensitive-fragment"));
    await expect(refreshYahooGlobalCredentials(test.client, credentials, test.fetchImpl))
      .rejects.toEqual(new YahooGlobalRefreshError("yahoo_refresh_transport_failed", 502, "unknown"));
    expect(test.from).not.toHaveBeenCalled();
    expect(test.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid JSON without updating tokens or losing control of the promise", async () => {
    const test = setup();
    test.json.mockRejectedValue(new Error("sensitive-fragment"));
    await expect(refreshYahooGlobalCredentials(test.client, credentials, test.fetchImpl))
      .rejects.toMatchObject({ code: "yahoo_refresh_invalid_response", refreshOutcome: "unknown" });
    expect(test.from).not.toHaveBeenCalled();
  });

  it.each(["returned", "thrown"])("awaits and redacts %s storage errors without refreshing again", async (kind) => {
    const test = setup();
    if (kind === "returned") test.eq.mockResolvedValue({ error: { message: "sensitive-fragment" } });
    else test.eq.mockRejectedValue(new Error("sensitive-fragment"));
    await expect(refreshYahooGlobalCredentials(test.client, credentials, test.fetchImpl))
      .rejects.toEqual(new YahooGlobalRefreshError("yahoo_refresh_store_failed", 503, "unknown"));
    expect(test.fetchImpl).toHaveBeenCalledTimes(1);
    expect(test.update).toHaveBeenCalledTimes(1);
  });

  it.each(["fetch", "body"])("bounds a hung %s and prevents late persistence", async (stage) => {
    vi.useFakeTimers();
    const test = setup();
    let resolve!: (value: any) => void;
    const hung = new Promise((done) => { resolve = done; });
    if (stage === "fetch") test.fetchImpl.mockReturnValue(hung);
    else test.json.mockReturnValue(hung);
    const promise = refreshYahooGlobalCredentials(test.client, credentials, test.fetchImpl);
    const assertion = expect(promise).rejects.toMatchObject({
      code: "yahoo_refresh_timeout", statusCode: 504, refreshOutcome: "unknown",
    });
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(test.fetchImpl.mock.calls[0][1].signal.aborted).toBe(true);
    resolve(stage === "fetch"
      ? { ok: true, status: 200, json: async () => ({ access_token: "late-access" }) }
      : { access_token: "late-access" });
    await vi.advanceTimersByTimeAsync(0);
    expect(test.from).not.toHaveBeenCalled();
    expect(test.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("bounds a hung store, reports uncertainty, and never retries the refresh or write", async () => {
    vi.useFakeTimers();
    const test = setup();
    test.eq.mockReturnValue(new Promise(() => {}));
    const promise = refreshYahooGlobalCredentials(test.client, credentials, test.fetchImpl);
    const assertion = expect(promise).rejects.toMatchObject({
      code: "yahoo_refresh_timeout", refreshOutcome: "unknown",
    });
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(test.fetchImpl).toHaveBeenCalledTimes(1);
    expect(test.update).toHaveBeenCalledTimes(1);
  });
});
