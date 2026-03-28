import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  isLoading: false,
  mockUser: null as any,
  signOut: vi.fn()
}));

vi.mock("next/image", () => ({
  default: ({ priority: _priority, placeholder: _placeholder, ...props }: any) => (
    <img {...props} />
  )
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
    pathname: "/",
    query: {},
  })
}));

vi.mock("hooks/useHideableNavbar", () => ({
  default: () => ({
    navbarRef: { current: null },
    isNavbarVisible: true
  })
}));

vi.mock("components/Layout/MobileMenu", () => ({
  default: ({
    showAuthButton,
    onAuthClick,
    showAccountControls,
    accountUser,
    onSignOut
  }: any) => (
    <div data-testid="mobile-menu">
      {showAuthButton ? (
        <button
          type="button"
          data-testid="mobile-auth-cta"
          onClick={onAuthClick}
        >
          Mobile Sign-in / Sign-up
        </button>
      ) : null}
      {showAccountControls ? (
        <>
          <div data-testid="mobile-account-name">
            {accountUser?.displayName || accountUser?.email || accountUser?.name}
          </div>
          <button
            type="button"
            data-testid="mobile-sign-out"
            onClick={onSignOut}
          >
            Mobile Sign Out
          </button>
        </>
      ) : null}
    </div>
  )
}));

vi.mock("lib/supabase/client", () => ({
  default: {
    auth: {
      signOut: authState.signOut
    }
  }
}));

vi.mock("components/Layout/NavbarItems", () => ({
  default: () => <div data-testid="navbar-items" />
}));

vi.mock("components/ClientOnly", () => ({
  default: ({ children }: any) => <>{children}</>
}));

vi.mock("components/SocialMedias", () => ({
  default: () => <div data-testid="social-medias" />
}));

vi.mock("contexts/AuthProviderContext", () => ({
  useAuth: () => ({
    isLoading: authState.isLoading,
    user: authState.mockUser
  })
}));

vi.mock("components/auth/UserMenu", () => ({
  default: () => <div data-testid="user-menu">User Menu</div>
}));

import Header from "components/Layout/Header/Header";

describe("Header auth entry", () => {
  beforeEach(() => {
    authState.isLoading = false;
    authState.mockUser = null;
    authState.signOut.mockReset();
    authState.signOut.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the logged-out CTA and opens the auth modal", () => {
    render(<Header />);

    const authButton = screen.getByRole("button", {
      name: "Sign-in / Sign-up"
    });
    expect(authButton).toBeDefined();

    fireEvent.click(authButton);

    expect(
      screen.getByRole("dialog", { name: "Authentication" })
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: "Sign in to your account" })
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Continue to Sign In" })
    ).toBeDefined();
  });

  it("opens the auth modal from the mobile menu CTA for signed-out users", () => {
    render(<Header />);

    fireEvent.click(screen.getByTestId("mobile-auth-cta"));

    expect(
      screen.getByRole("dialog", { name: "Authentication" })
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: "Sign in to your account" })
    ).toBeDefined();
  });

  it("renders the logged-in user menu instead of the logged-out CTA", () => {
    authState.mockUser = {
      id: "user-1",
      email: "tim@example.com",
      displayName: "Tim Tester",
      avatarUrl: null
    };

    render(<Header />);

    expect(screen.queryByRole("button", { name: "Sign-in / Sign-up" })).toBeNull();
    expect(screen.queryByTestId("mobile-auth-cta")).toBeNull();
    expect(screen.getByTestId("mobile-account-name").textContent).toBe("Tim Tester");
    expect(screen.getByTestId("user-menu")).toBeDefined();
  });

  it("signs out from the mobile menu for logged-in users", () => {
    authState.mockUser = {
      id: "user-1",
      email: "tim@example.com",
      displayName: "Tim Tester",
      avatarUrl: null
    };

    render(<Header />);

    fireEvent.click(screen.getByTestId("mobile-sign-out"));

    expect(authState.signOut).toHaveBeenCalledTimes(1);
  });

  it("does not show the logged-out CTA while auth is still resolving", () => {
    authState.isLoading = true;

    render(<Header />);

    expect(screen.queryByRole("button", { name: "Sign-in / Sign-up" })).toBeNull();
    expect(screen.queryByTestId("mobile-auth-cta")).toBeNull();
    expect(screen.queryByTestId("user-menu")).toBeNull();
  });
});
