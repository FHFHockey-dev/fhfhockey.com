import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pageState = vi.hoisted(() => ({
  isReady: true,
  replace: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  setSession: vi.fn()
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    isReady: pageState.isReady,
    query: { next: "/account" },
    replace: pageState.replace
  })
}));

vi.mock("lib/supabase/client", () => ({
  default: {
    auth: {
      exchangeCodeForSession: pageState.exchangeCodeForSession,
      verifyOtp: pageState.verifyOtp,
      setSession: pageState.setSession
    }
  }
}));

import AuthCallbackPage from "pages/auth/callback";

describe("Auth callback page", () => {
  beforeEach(() => {
    pageState.isReady = true;
    pageState.replace.mockReset();
    pageState.exchangeCodeForSession.mockReset();
    pageState.verifyOtp.mockReset();
    pageState.setSession.mockReset();
    document.title = "";
    window.history.replaceState({}, "", "http://localhost:3000/auth/callback");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("exchanges OAuth codes and redirects to the requested next path", async () => {
    pageState.exchangeCodeForSession.mockImplementation(async () => {
      expect(window.location.href).toBe("http://localhost:3000/auth/callback");
      expect(document.title).toBe("Completing Authentication | FHFHockey");
      return { error: null };
    });
    const callbackUrl = "/auth/callback?code=oauth-code&next=%2Faccount";
    window.history.replaceState({ __N: true, url: callbackUrl, as: callbackUrl }, "", callbackUrl);

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(pageState.exchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    });
    await waitFor(() => {
      expect(pageState.replace).toHaveBeenCalledWith("/account");
    });
    expect(JSON.stringify(window.history.state)).not.toContain("oauth-code");
  });

  it("scrubs and processes credentials without waiting for router readiness", async () => {
    pageState.isReady = false;
    pageState.exchangeCodeForSession.mockImplementation(async () => {
      expect(window.location.href).toBe("http://localhost:3000/auth/callback");
      return { error: null };
    });
    window.history.replaceState({}, "", "/auth/callback?code=early-code&next=%2Faccount");

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(pageState.exchangeCodeForSession).toHaveBeenCalledWith("early-code");
    });
  });

  it("routes code-based recovery callbacks to the reset-password page", async () => {
    pageState.exchangeCodeForSession.mockResolvedValue({ error: null });
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/auth/callback?code=recovery-code&type=recovery&next=%2Fforge"
    );

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(pageState.exchangeCodeForSession).toHaveBeenCalledWith("recovery-code");
    });
    await waitFor(() => {
      expect(pageState.replace).toHaveBeenCalledWith("/auth/reset-password?next=%2Fforge");
    });
  });

  it("routes verified recovery links to the reset-password page", async () => {
    pageState.verifyOtp.mockResolvedValue({ error: null });
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/auth/callback?token_hash=hash123&type=recovery&next=%2Fforge"
    );

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(pageState.verifyOtp).toHaveBeenCalledWith({
        token_hash: "hash123",
        type: "recovery"
      });
    });
    await waitFor(() => {
      expect(pageState.replace).toHaveBeenCalledWith("/auth/reset-password?next=%2Fforge");
    });
  });

  it("shows provider errors without redirecting", async () => {
    const providerErrorSentinel = "Provider redirect failed fake-secret";
    window.history.replaceState(
      {},
      "",
      `/auth/callback?error_description=${encodeURIComponent(
        providerErrorSentinel
      )}&next=%2Faccount`
    );

    render(<AuthCallbackPage />);

    expect(
      await screen.findByText(
        "The authentication provider could not complete this request. Return to sign in and try again."
      )
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain(providerErrorSentinel);
    expect(window.location.href).not.toContain("error_description");
    expect(pageState.replace).not.toHaveBeenCalled();
  });

  it("routes hash-based recovery sessions to the reset-password page", async () => {
    pageState.setSession.mockImplementation(async () => {
      expect(window.location.href).toBe("http://localhost:3000/auth/callback");
      expect(document.title).toBe("Completing Authentication | FHFHockey");
      expect(JSON.stringify(window.history.state)).not.toContain("access123");
      return { error: null };
    });
    const callbackUrl =
      "/auth/callback#access_token=access123&refresh_token=refresh123&provider_token=provider123&type=recovery&next=%2Fforge";
    window.history.replaceState({ __N: true, url: callbackUrl, as: callbackUrl }, "", callbackUrl);

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(pageState.setSession).toHaveBeenCalledWith({
        access_token: "access123",
        refresh_token: "refresh123"
      });
    });
    await waitFor(() => {
      expect(pageState.replace).toHaveBeenCalledWith("/auth/reset-password?next=%2Fforge");
    });
    expect(pageState.setSession).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("access123");
    expect(document.body.textContent).not.toContain("provider123");
  });

  it("does not render client errors that may contain credential material", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    pageState.setSession.mockRejectedValue(
      new Error("fake-access-token should never render or log")
    );
    window.history.replaceState(
      {},
      "",
      "/auth/callback#access_token=fake-access-token&refresh_token=fake-refresh-token"
    );

    render(<AuthCallbackPage />);

    expect(
      await screen.findByText(
        "FHFH could not finish this authentication response. Return to sign in and try again."
      )
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain("fake-access-token");
    expect(window.location.hash).toBe("");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("fake-access-token");
  });

  it("fails closed without calling auth APIs when synchronous scrubbing fails", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/callback#access_token=fake-access&refresh_token=fake-refresh"
    );
    vi.spyOn(window.history, "replaceState").mockImplementation(() => {
      throw new Error("history unavailable");
    });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(pageState.replace).toHaveBeenCalledWith("/auth");
    });
    expect(pageState.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(pageState.verifyOtp).not.toHaveBeenCalled();
    expect(pageState.setSession).not.toHaveBeenCalled();
  });
});
