import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  consumeAuthCallbackLocation,
  navigateToAuthFallback,
  sanitizeAuthReturnPath
} from "./auth-callback-location";

describe("consumeAuthCallbackLocation", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "http://localhost:3000/");
  });

  it("captures implicit-session credentials once and scrubs URL plus Next history state", () => {
    const callbackUrl =
      "/auth/callback#access_token=fake-access&refresh_token=fake-refresh&provider_token=fake-provider&type=recovery&next=%2Fforge";

    window.history.replaceState(
      { __N: true, key: "next-key", url: callbackUrl, as: callbackUrl },
      "",
      callbackUrl
    );

    const consumed = consumeAuthCallbackLocation();

    expect(consumed).toEqual({
      nextValue: "/forge",
      hasProviderError: false,
      code: null,
      tokenHash: null,
      verificationType: "recovery",
      accessToken: "fake-access",
      refreshToken: "fake-refresh"
    });
    expect(consumed).not.toHaveProperty("providerToken");
    expect(window.location.href).toBe("http://localhost:3000/auth/callback");
    expect(window.history.state).toEqual({
      __N: true,
      key: "next-key",
      url: "/auth/callback",
      as: "/auth/callback"
    });
  });

  it("scrubs one-time query credentials while retaining the safe return path", () => {
    const callbackUrl =
      "/auth/callback?code=fake-code&token_hash=fake-hash&type=email&error_description=fake-secret&next=%2Faccount";

    window.history.replaceState({ __N: true, url: callbackUrl, as: callbackUrl }, "", callbackUrl);

    const consumed = consumeAuthCallbackLocation();

    expect(consumed.code).toBe("fake-code");
    expect(consumed.tokenHash).toBe("fake-hash");
    expect(consumed.verificationType).toBe("email");
    expect(consumed.hasProviderError).toBe(true);
    expect(window.location.href).toBe("http://localhost:3000/auth/callback");
    expect(JSON.stringify(window.history.state)).not.toContain("fake-");
  });

  it("scrubs stale Next history state even when the visible URL is already clean", () => {
    window.history.replaceState(
      {
        __N: true,
        url: "/auth/callback#access_token=stale-access",
        as: "/auth/callback#refresh_token=stale-refresh"
      },
      "",
      "/auth/callback"
    );

    const consumed = consumeAuthCallbackLocation();

    expect(consumed.accessToken).toBeNull();
    expect(window.location.href).toBe("http://localhost:3000/auth/callback");
    expect(window.history.state).toEqual({
      __N: true,
      url: "/auth/callback",
      as: "/auth/callback"
    });
  });
});

describe("sanitizeAuthReturnPath", () => {
  it("preserves safe same-origin paths while removing fragments and auth keys", () => {
    expect(
      sanitizeAuthReturnPath(
        "/forge/dashboard?tab=skaters&code=fake-code&Access_Token=fake-access#refresh_token=fake-refresh"
      )
    ).toBe("/forge/dashboard?tab=skaters");
  });

  it.each([
    "https://attacker.example/path",
    "//attacker.example/path",
    "/\\attacker.example/path",
    "/auth/callback",
    "/auth/callback/",
    "/auth/reset-password?next=%2Faccount",
    "/%61uth/callback#access_token=fake-access"
  ])("rejects unsafe or recursive return path %s", (nextValue) => {
    expect(sanitizeAuthReturnPath(nextValue, "/account")).toBe("/account");
  });
});

describe("navigateToAuthFallback", () => {
  it("uses a full credential-free navigation if the client router declines", async () => {
    const replaceLocation = vi.fn();
    const currentWindow = {
      location: { replace: replaceLocation }
    } as unknown as Window;

    navigateToAuthFallback(() => Promise.resolve(false), currentWindow);
    await Promise.resolve();

    expect(replaceLocation).toHaveBeenCalledWith("/auth");
  });

  it("uses a full credential-free navigation if the client router throws", () => {
    const replaceLocation = vi.fn();
    const currentWindow = {
      location: { replace: replaceLocation }
    } as unknown as Window;

    navigateToAuthFallback(() => {
      throw new Error("router unavailable");
    }, currentWindow);

    expect(replaceLocation).toHaveBeenCalledWith("/auth");
  });
});
