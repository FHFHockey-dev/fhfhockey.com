import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  isLoading: false,
  user: null as any
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
    query: {},
    replace: vi.fn()
  })
}));

vi.mock("contexts/AuthProviderContext", () => ({
  useAuth: () => authState
}));

import AccountPage from "pages/account";

describe("Account page", () => {
  beforeEach(() => {
    authState.isLoading = false;
    authState.user = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the sign-in prompt for unauthenticated users", () => {
    render(<AccountPage />);

    expect(
      screen.getByText("You need to sign in before accessing account settings.")
    ).toBeTruthy();
    expect(
      screen.getByText("Protected settings are only available to authenticated accounts.")
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Sign In" }).getAttribute("href")).toBe(
      "/auth?mode=sign-in"
    );
    expect(screen.getByRole("link", { name: "Create Account" }).getAttribute("href")).toBe(
      "/auth?mode=sign-up"
    );
  });

  it("shows a loading state while auth is still resolving", () => {
    authState.isLoading = true;

    render(<AccountPage />);

    expect(screen.getByText("Loading account settings...")).toBeTruthy();
  });

  it("renders the account shell for authenticated users", () => {
    authState.user = {
      id: "user-1",
      email: "tim@example.com",
      displayName: "Tim Tester",
      name: "Tim Tester",
      isEmailVerified: true
    };

    render(<AccountPage />);

    expect(screen.getByText("Profile Overview")).toBeTruthy();
    expect(screen.getAllByText("Tim Tester").length).toBeGreaterThan(0);
    expect(screen.queryByText("Signed-in account")).toBeNull();
  });
});
