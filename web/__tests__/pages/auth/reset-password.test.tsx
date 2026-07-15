import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pageState = vi.hoisted(() => ({
  isReady: true,
  replace: vi.fn(),
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
    isReady: pageState.isReady,
    query: { next: "/account" },
    replace: pageState.replace
  })
}));

vi.mock("lib/supabase/client", () => ({
  default: {
    auth: {
      getSession: pageState.getSession,
      exchangeCodeForSession: pageState.exchangeCodeForSession,
      verifyOtp: pageState.verifyOtp,
      setSession: pageState.setSession,
      onAuthStateChange: pageState.onAuthStateChange
    }
  }
}));

import ResetPasswordPage from "pages/auth/reset-password";

describe("Reset password page", () => {
  beforeEach(() => {
    pageState.isReady = true;
    pageState.replace.mockReset();
    pageState.getSession.mockReset();
    pageState.exchangeCodeForSession.mockReset();
    pageState.verifyOtp.mockReset();
    pageState.setSession.mockReset();
    pageState.onAuthStateChange.mockReset();
    pageState.unsubscribe.mockReset();
    document.title = "";
    window.history.replaceState({}, "", "http://localhost:3000/auth/reset-password");
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue("{}")
      })
    );

    pageState.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-1" },
          access_token: "recovery-access-token"
        }
      },
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
    vi.unstubAllGlobals();
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the reset form when a recovery session is available", async () => {
    render(<ResetPasswordPage />);

    expect(await screen.findByText("Choose a new password for your account.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Update Password" })).toBeTruthy();
  });

  it("exchanges recovery codes delivered directly to the reset page", async () => {
    pageState.exchangeCodeForSession.mockImplementation(async () => {
      expect(window.location.href).toBe("http://localhost:3000/auth/reset-password");
      expect(document.title).toBe("Reset Password | FHFHockey");
      return { error: null };
    });
    const callbackUrl = "/auth/reset-password?code=recovery-code&type=recovery";
    window.history.replaceState({ __N: true, url: callbackUrl, as: callbackUrl }, "", callbackUrl);

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(pageState.exchangeCodeForSession).toHaveBeenCalledWith("recovery-code");
    });
    expect(await screen.findByText("Choose a new password for your account.")).toBeTruthy();
    expect(JSON.stringify(window.history.state)).not.toContain("recovery-code");
  });

  it("consumes hash recovery credentials after scrubbing visible and Next state", async () => {
    pageState.isReady = false;
    pageState.setSession.mockImplementation(async () => {
      expect(window.location.href).toBe("http://localhost:3000/auth/reset-password");
      expect(document.title).toBe("Reset Password | FHFHockey");
      expect(JSON.stringify(window.history.state)).not.toContain("fake-access");
      return { error: null };
    });
    const callbackUrl =
      "/auth/reset-password#access_token=fake-access&refresh_token=fake-refresh&type=recovery&next=%2Faccount";
    window.history.replaceState({ __N: true, url: callbackUrl, as: callbackUrl }, "", callbackUrl);

    render(
      <StrictMode>
        <ResetPasswordPage />
      </StrictMode>
    );

    await waitFor(() => {
      expect(pageState.setSession).toHaveBeenCalledWith({
        access_token: "fake-access",
        refresh_token: "fake-refresh"
      });
    });
    expect(pageState.setSession).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("fake-access");
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
  });

  it("does not render recovery-client errors that contain credential material", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    pageState.setSession.mockRejectedValue(new Error("fake-access should never render or log"));
    window.history.replaceState(
      {},
      "",
      "/auth/reset-password#access_token=fake-access&refresh_token=fake-refresh&type=recovery"
    );

    render(<ResetPasswordPage />);

    expect(
      await screen.findByText(
        "This recovery response could not be verified. Request a new password reset email and try again."
      )
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain("fake-access");
    expect(window.location.hash).toBe("");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("fake-access");
  });

  it("fails closed without calling auth APIs when synchronous scrubbing fails", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/reset-password#access_token=fake-access&refresh_token=fake-refresh&type=recovery"
    );
    vi.spyOn(window.history, "replaceState").mockImplementation(() => {
      throw new Error("history unavailable");
    });

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(pageState.replace).toHaveBeenCalledWith("/auth");
    });
    expect(pageState.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(pageState.verifyOtp).not.toHaveBeenCalled();
    expect(pageState.setSession).not.toHaveBeenCalled();
    expect(pageState.getSession).not.toHaveBeenCalled();
  });

  it("updates the password and shows the success state", async () => {
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
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/v1/user"),
        expect.objectContaining({
          method: "PUT",
          headers: expect.objectContaining({
            Authorization: "Bearer recovery-access-token"
          }),
          body: JSON.stringify({
            password: "supersecret1"
          })
        })
      );
    });
    expect(
      await screen.findByText(
        "Your password has been updated successfully. You can continue into your account now."
      )
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Continue to Site" }).getAttribute("href")).toBe(
      "/account"
    );
  });

  it("shows a direct error when the password update request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            msg: "New password should be different from the old password."
          })
        )
      })
    );

    render(<ResetPasswordPage />);

    await screen.findByText("Choose a new password for your account.");
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "supersecret1" }
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "supersecret1" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(
      await screen.findByText("New password should be different from the old password.")
    ).toBeTruthy();
  });
});
