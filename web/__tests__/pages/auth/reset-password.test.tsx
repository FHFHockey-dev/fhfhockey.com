import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pageState = vi.hoisted(() => ({
  updateUser: vi.fn(),
  getSession: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  setSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn()
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
    query: { next: "/account" }
  })
}));

vi.mock("lib/supabase/client", () => ({
  default: {
    auth: {
      getSession: pageState.getSession,
      exchangeCodeForSession: pageState.exchangeCodeForSession,
      verifyOtp: pageState.verifyOtp,
      setSession: pageState.setSession,
      updateUser: pageState.updateUser,
      onAuthStateChange: pageState.onAuthStateChange
    }
  }
}));

import ResetPasswordPage from "pages/auth/reset-password";

describe("Reset password page", () => {
  beforeEach(() => {
    pageState.updateUser.mockReset();
    pageState.getSession.mockReset();
    pageState.exchangeCodeForSession.mockReset();
    pageState.verifyOtp.mockReset();
    pageState.setSession.mockReset();
    pageState.onAuthStateChange.mockReset();
    pageState.unsubscribe.mockReset();
    window.history.replaceState({}, "", "http://localhost:3000/auth/reset-password");
    window.localStorage.clear();

    pageState.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
      error: null
    });
    pageState.onAuthStateChange.mockImplementation((callback: any) => {
      callback("SIGNED_IN");
      return {
        data: {
          subscription: {
            unsubscribe: pageState.unsubscribe
          }
        }
      };
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the reset form when a recovery session is available", async () => {
    render(<ResetPasswordPage />);

    expect(await screen.findByText("Choose a new password for your account.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Update Password" })).toBeTruthy();
  });

  it("exchanges recovery codes delivered directly to the reset page", async () => {
    pageState.exchangeCodeForSession.mockResolvedValue({ error: null });
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/auth/reset-password?code=recovery-code&type=recovery"
    );

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(pageState.exchangeCodeForSession).toHaveBeenCalledWith("recovery-code");
    });
    expect(await screen.findByText("Choose a new password for your account.")).toBeTruthy();
  });

  it("updates the password and shows the success state", async () => {
    pageState.updateUser.mockResolvedValue({ error: null });

    render(<ResetPasswordPage />);

    await screen.findByText("Choose a new password for your account.");
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "supersecret1" }
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "supersecret1" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() => {
      expect(pageState.updateUser).toHaveBeenCalledWith({
        password: "supersecret1"
      });
    });
    expect(
      await screen.findByText(
        "Your password has been updated successfully. You can continue into your account now."
      )
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Continue to Site" }).getAttribute("href")
    ).toBe("/account");
  });
});
