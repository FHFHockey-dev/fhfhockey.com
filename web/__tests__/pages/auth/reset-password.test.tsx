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

  it.each([
    {
      password: "short",
      confirmation: "short",
      message: "Use a password with at least 8 characters.",
      invalidField: "New Password"
    },
    {
      password: "supersecret1",
      confirmation: "different-password",
      message: "Your password confirmation does not match.",
      invalidField: "Confirm Password"
    }
  ])("keeps the form editable after $message", async ({ password, confirmation, message, invalidField }) => {
    render(<ResetPasswordPage />);

    await screen.findByText("Choose a new password for your account.");
    const passwordInput = screen.getByLabelText<HTMLInputElement>("New Password");
    const confirmationInput = screen.getByLabelText<HTMLInputElement>("Confirm Password");
    fireEvent.change(passwordInput, { target: { value: password } });
    fireEvent.change(confirmationInput, { target: { value: confirmation } });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByLabelText("New Password")).toBe(passwordInput);
    expect(screen.getByLabelText("Confirm Password")).toBe(confirmationInput);
    expect(passwordInput.value).toBe(password);
    expect(confirmationInput.value).toBe(confirmation);
    expect(passwordInput.disabled).toBe(false);
    expect(confirmationInput.disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Update Password" }).disabled).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    const errorMessage = screen.getByRole("alert");
    const invalidInput = screen.getByLabelText(invalidField);
    expect(invalidInput.getAttribute("aria-invalid")).toBe("true");
    expect(invalidInput.getAttribute("aria-describedby")).toBe(errorMessage.id);

    fireEvent.change(passwordInput, { target: { value: "corrected-password" } });
    fireEvent.change(confirmationInput, { target: { value: "corrected-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(await screen.findByRole("link", { name: "Continue to Site" })).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][1]?.body).toBe(
      JSON.stringify({ password: "corrected-password" })
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByLabelText("New Password")).toBeNull();
  });

  it("does not show the form without a recovery session", async () => {
    pageState.getSession.mockResolvedValue({ data: { session: null }, error: null });

    render(<ResetPasswordPage />);

    expect(
      await screen.findByText(
        "Your recovery session is missing or expired. Request a new password reset email from the auth modal."
      )
    ).toBeTruthy();
    expect(screen.queryByLabelText("New Password")).toBeNull();
    expect(screen.queryByLabelText("Confirm Password")).toBeNull();
    expect(screen.queryByRole("button", { name: "Update Password" })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
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

  it("keeps the form mounted and disabled while the password update is pending", async () => {
    let resolveUpdate!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>((resolve) => {
      resolveUpdate = resolve;
    }));

    render(<ResetPasswordPage />);

    await screen.findByText("Choose a new password for your account.");
    const passwordInput = screen.getByLabelText<HTMLInputElement>("New Password");
    const confirmationInput = screen.getByLabelText<HTMLInputElement>("Confirm Password");
    fireEvent.change(passwordInput, { target: { value: "supersecret1" } });
    fireEvent.change(confirmationInput, { target: { value: "supersecret1" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("New Password")).toBe(passwordInput);
    expect(screen.getByLabelText("Confirm Password")).toBe(confirmationInput);
    expect(passwordInput.disabled).toBe(true);
    expect(confirmationInput.disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Updating..." }).disabled).toBe(true);
    fireEvent.submit(passwordInput.form!);
    expect(fetch).toHaveBeenCalledTimes(1);

    resolveUpdate({ ok: true, text: async () => "{}" } as Response);
    expect(await screen.findByRole("link", { name: "Continue to Site" })).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("preserves the fields and allows a successful retry after an update error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            msg: "New password should be different from the old password."
          })
        )
      }).mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue("{}")
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
    const passwordInput = screen.getByLabelText<HTMLInputElement>("New Password");
    const confirmationInput = screen.getByLabelText<HTMLInputElement>("Confirm Password");
    expect(passwordInput.value).toBe("supersecret1");
    expect(confirmationInput.value).toBe("supersecret1");
    expect(passwordInput.disabled).toBe(false);
    expect(confirmationInput.disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Update Password" }).disabled).toBe(false);
    expect(passwordInput.form?.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);

    fireEvent.change(passwordInput, { target: { value: "different-password" } });
    fireEvent.change(confirmationInput, { target: { value: "different-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(await screen.findByRole("link", { name: "Continue to Site" })).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls[1][1]?.body).toBe(
      JSON.stringify({ password: "different-password" })
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
