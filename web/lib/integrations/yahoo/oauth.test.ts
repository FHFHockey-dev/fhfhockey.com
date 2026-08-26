import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  consumeYahooOAuthTransaction,
  createYahooAuthorizationRequest,
  exchangeYahooAuthorizationCode,
  sanitizeYahooNextPath,
} from "./oauth";

describe("Yahoo OAuth transaction security", () => {
  beforeEach(() => {
    vi.stubEnv("YAHOO_CONSUMER_KEY", "client-id");
    vi.stubEnv("YAHOO_CONSUMER_SECRET", "client-secret");
    vi.stubEnv(
      "YAHOO_REDIRECT_URI",
      "https://fhfhockey.com/api/v1/account/yahoo/callback",
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stores hashed opaque state and binds an S256 PKCE challenge", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const result = await createYahooAuthorizationRequest({
      client: { rpc } as any,
      next: "//attacker.example/redirect",
      now: new Date("2026-08-24T12:00:00.000Z"),
      userId: "11111111-1111-4111-8111-111111111111",
    });
    const url = new URL(result.authorizationUrl);
    const state = url.searchParams.get("state") ?? "";
    const stored = rpc.mock.calls[0][1];
    const expectedChallenge = createHash("sha256")
      .update(stored.p_pkce_code_verifier)
      .digest("base64url");

    expect(state.length).toBeGreaterThanOrEqual(32);
    expect(stored.p_state_hash).toBe(
      createHash("sha256").update(state).digest("hex"),
    );
    expect(stored.p_state_hash).not.toContain(state);
    expect(stored.p_safe_next_path).toBe("/account?section=connected-accounts");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(expectedChallenge);
    expect(result.browserCookie).toContain("HttpOnly");
    expect(result.browserCookie).toContain("SameSite=Lax");
    expect(result.browserCookie).toContain("Secure");
  });

  it("surfaces mismatch, expiry, and replay as the same invalid transaction", async () => {
    const transaction = {
      pkceCodeVerifier: "v".repeat(64),
      redirectUri: "https://fhfhockey.com/api/v1/account/yahoo/callback",
      safeNextPath: "/draft-dashboard",
      userId: "11111111-1111-4111-8111-111111111111",
    };
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: transaction, error: null })
      .mockResolvedValue({ data: null, error: { message: "invalid" } });
    const client = { rpc } as any;

    await expect(
      consumeYahooOAuthTransaction({
        browserBinding: "browser-binding",
        client,
        state: "opaque-state",
      }),
    ).resolves.toEqual(transaction);
    await expect(
      consumeYahooOAuthTransaction({
        browserBinding: "browser-binding",
        client,
        state: "opaque-state",
      }),
    ).rejects.toThrow("missing, expired, or already used");
    await expect(
      consumeYahooOAuthTransaction({
        browserBinding: "wrong-browser",
        client,
        state: "opaque-state",
      }),
    ).rejects.toThrow("missing, expired, or already used");
    expect(rpc.mock.calls[0][1]).toEqual({
      p_browser_binding_hash: createHash("sha256")
        .update("browser-binding")
        .digest("hex"),
      p_state_hash: createHash("sha256").update("opaque-state").digest("hex"),
    });
  });

  it("sends the transaction verifier and configured redirect during exchange", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "access", refresh_token: "refresh" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    await exchangeYahooAuthorizationCode({
      code: "authorization-code",
      codeVerifier: "v".repeat(64),
      fetchImpl: fetchImpl as any,
      redirectUri: "https://fhfhockey.com/api/v1/account/yahoo/callback",
    });
    const request = fetchImpl.mock.calls[0][1];
    const body = request.body as URLSearchParams;
    expect(body.get("code_verifier")).toBe("v".repeat(64));
    expect(body.get("redirect_uri")).toBe(
      "https://fhfhockey.com/api/v1/account/yahoo/callback",
    );
    expect(sanitizeYahooNextPath("https://attacker.example")).toBe(
      "/account?section=connected-accounts",
    );
  });
});
