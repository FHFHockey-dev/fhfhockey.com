import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signOut: vi.fn()
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("lib/supabase/client", () => ({
  default: {
    auth: {
      signInWithOAuth: authState.signInWithOAuth,
      signInWithPassword: authState.signInWithPassword,
      signUp: authState.signUp,
      resetPasswordForEmail: authState.resetPasswordForEmail,
      signOut: authState.signOut
    }
  }
}));

import AuthForm from "components/auth/AuthForm";

describe("AuthForm", () => {
  beforeEach(() => {
    authState.signInWithOAuth.mockReset();
    authState.signInWithPassword.mockReset();
    authState.signUp.mockReset();
    authState.resetPasswordForEmail.mockReset();
    authState.signOut.mockReset();
    authState.signOut.mockResolvedValue({ error: null });
    window.history.replaceState({}, "", "http://localhost:3000/forge/dashboard?tab=skaters");
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("maps invalid sign-in credentials to a clearer message", async () => {
    authState.signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" }
    });

    render(<AuthForm mode="sign-in" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "tim@example.com" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(
      await screen.findByText("That email/password combination did not match an active account.")
    ).toBeTruthy();
    expect(authState.signOut).toHaveBeenCalled();
  });

  it("shows verification success state when sign-up returns a user without a session", async () => {
    window.history.replaceState(
      {},
      "",
      "/forge/dashboard?tab=skaters&code=fake-code#access_token=fake-access"
    );
    authState.signUp.mockResolvedValue({
      data: {
        user: { id: "user-1" },
        session: null
      },
      error: null
    });

    render(<AuthForm mode="sign-up" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "tim@example.com" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "supersecret1" }
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "supersecret1" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(
      await screen.findByText(
        "Check your email to verify your account before using protected settings."
      )
    ).toBeTruthy();
    const signUpRedirect = new URL(authState.signUp.mock.calls[0][0].options.emailRedirectTo);
    expect(signUpRedirect.searchParams.get("next")).toBe("/forge/dashboard?tab=skaters");
    expect(signUpRedirect.toString()).not.toContain("fake-");
  });

  it("sends recovery emails directly to the reset-password page", async () => {
    window.history.replaceState(
      {},
      "",
      "/forge/dashboard?tab=skaters&token_hash=fake-hash#refresh_token=fake-refresh"
    );
    authState.resetPasswordForEmail.mockResolvedValue({
      error: null
    });

    render(<AuthForm mode="forgot-password" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "tim@example.com" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset Flow Coming Next" }));

    await waitFor(() => {
      expect(authState.resetPasswordForEmail).toHaveBeenCalledTimes(1);
    });

    expect(authState.resetPasswordForEmail).toHaveBeenCalledWith(
      "tim@example.com",
      expect.objectContaining({
        redirectTo: expect.stringContaining("/auth/reset-password")
      })
    );
    expect(
      await screen.findByText(
        "Password reset email sent. Open the recovery link from your inbox to choose a new password."
      )
    ).toBeTruthy();
    expect(window.localStorage.getItem("fhfh:post-password-reset-next")).toBe(
      "/forge/dashboard?tab=skaters"
    );
  });

  it("never nests current credential material into OAuth return paths", async () => {
    authState.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
    window.history.replaceState(
      {},
      "",
      "/account?section=profile&id_token=fake-id#provider_token=fake-provider"
    );

    render(<AuthForm mode="sign-in" />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(authState.signInWithOAuth).toHaveBeenCalledTimes(1);
    });
    const oauthRedirect = new URL(authState.signInWithOAuth.mock.calls[0][0].options.redirectTo);
    expect(oauthRedirect.searchParams.get("next")).toBe("/account?section=profile");
    expect(oauthRedirect.toString()).not.toContain("fake-");
  });

  it("offers a targeted local auth reset without clearing full browser history", async () => {
    authState.signOut.mockResolvedValueOnce({
      error: { message: "Invalid or expired session" }
    });
    window.localStorage.setItem("sb-test-auth-token", "value");
    window.sessionStorage.setItem("sb-test-code-verifier", "value");
    window.localStorage.setItem("unrelated-app-session", "preserve-me");

    render(<AuthForm mode="sign-in" />);

    fireEvent.click(screen.getByRole("button", { name: "Reset Local Auth" }));

    expect(
      await screen.findByText(
        "Local FHFH auth storage was reset. Try signing in again without clearing your full browser history."
      )
    ).toBeTruthy();
    expect(window.localStorage.getItem("sb-test-auth-token")).toBeNull();
    expect(window.sessionStorage.getItem("sb-test-code-verifier")).toBeNull();
    expect(window.localStorage.getItem("unrelated-app-session")).toBe("preserve-me");
    expect(authState.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
