import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn()
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
      resetPasswordForEmail: authState.resetPasswordForEmail
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
    window.history.replaceState({}, "", "http://localhost:3000/forge/dashboard?tab=skaters");
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
      await screen.findByText(
        "That email/password combination did not match an active account."
      )
    ).toBeTruthy();
  });

  it("shows verification success state when sign-up returns a user without a session", async () => {
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
  });

  it("sends recovery emails to the reset-password callback path", async () => {
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
        redirectTo: expect.stringContaining("/auth/callback")
      })
    );
    expect(
      authState.resetPasswordForEmail.mock.calls[0][1].redirectTo
    ).toContain("next=%2Fauth%2Freset-password");
    expect(
      await screen.findByText(
        "Password reset email sent. Open the recovery link from your inbox to choose a new password."
      )
    ).toBeTruthy();
  });
});
