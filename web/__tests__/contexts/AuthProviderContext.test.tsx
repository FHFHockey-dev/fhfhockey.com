import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  maybeSingle: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("lib/supabase/client", () => ({
  default: {
    auth: {
      getSession: authState.getSession,
      onAuthStateChange: authState.onAuthStateChange,
      signOut: authState.signOut,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: authState.maybeSingle,
        }),
      }),
    }),
  },
}));

vi.mock("lib/user-settings/ensureUserRecords", () => ({
  ensureUserRecords: vi.fn().mockResolvedValue(undefined),
}));

import AuthProvider, { useAuth } from "contexts/AuthProviderContext";

function AuthProbe() {
  const { user, isLoading, signOut } = useAuth();

  return (
    <div>
      <div>{isLoading ? "loading" : user?.email || "signed-out"}</div>
      <button type="button" onClick={() => void signOut()}>
        Sign Out
      </button>
    </div>
  );
}

describe("AuthProviderContext", () => {
  beforeEach(() => {
    authState.getSession.mockReset();
    authState.onAuthStateChange.mockReset();
    authState.signOut.mockReset();
    authState.maybeSingle.mockReset();
    authState.unsubscribe.mockReset();

    authState.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-1",
            email: "tim@example.com",
            email_confirmed_at: "2026-07-14T00:00:00.000Z",
            user_metadata: { full_name: "Tim Tester" },
            app_metadata: { providers: ["google"] },
          },
        },
      },
    });
    authState.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: authState.unsubscribe } },
    });
    authState.maybeSingle.mockResolvedValue({ data: null, error: null });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("fails closed to signed out and clears only targeted auth state when local sign-out rejects", async () => {
    authState.signOut.mockRejectedValue(
      new Error("Invalid or expired session"),
    );
    window.localStorage.setItem("sb-fhfh-auth-token", "stale");
    window.sessionStorage.setItem("sb-fhfh-code-verifier", "stale");
    window.localStorage.setItem("unrelated-app-session", "preserve-me");

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("tim@example.com")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));

    await waitFor(() => {
      expect(screen.getByText("signed-out")).toBeTruthy();
    });
    expect(authState.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(window.localStorage.getItem("sb-fhfh-auth-token")).toBeNull();
    expect(window.sessionStorage.getItem("sb-fhfh-code-verifier")).toBeNull();
    expect(window.localStorage.getItem("unrelated-app-session")).toBe(
      "preserve-me",
    );
  });
});
