import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pageState = vi.hoisted(() => ({
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
    isReady: true,
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
    pageState.replace.mockReset();
    pageState.exchangeCodeForSession.mockReset();
    pageState.verifyOtp.mockReset();
    pageState.setSession.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("exchanges OAuth codes and redirects to the requested next path", async () => {
    pageState.exchangeCodeForSession.mockResolvedValue({ error: null });
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/auth/callback?code=oauth-code&next=%2Faccount"
    );

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(pageState.exchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    });
    await waitFor(() => {
      expect(pageState.replace).toHaveBeenCalledWith("/account");
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
      expect(pageState.replace).toHaveBeenCalledWith(
        "/auth/reset-password?next=%2Fforge"
      );
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
      expect(pageState.replace).toHaveBeenCalledWith(
        "/auth/reset-password?next=%2Fforge"
      );
    });
  });

  it("shows provider errors without redirecting", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/auth/callback?error_description=Provider%20redirect%20failed"
    );

    render(<AuthCallbackPage />);

    expect(
      await screen.findByText("Provider redirect failed")
    ).toBeTruthy();
    expect(pageState.replace).not.toHaveBeenCalled();
  });

  it("routes hash-based recovery sessions to the reset-password page", async () => {
    pageState.setSession.mockResolvedValue({ error: null });
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/auth/callback#access_token=access123&refresh_token=refresh123&type=recovery&next=%2Fforge"
    );

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(pageState.setSession).toHaveBeenCalledWith({
        access_token: "access123",
        refresh_token: "refresh123"
      });
    });
    await waitFor(() => {
      expect(pageState.replace).toHaveBeenCalledWith(
        "/auth/reset-password?next=%2Fforge"
      );
    });
  });
});
