import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  mockUser: null as any
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
  default: () => <div data-testid="mobile-menu" />
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
  useUser: () => authState.mockUser
}));

vi.mock("components/auth/UserMenu", () => ({
  default: () => <div data-testid="user-menu">User Menu</div>
}));

import Header from "components/Layout/Header/Header";

describe("Header auth entry", () => {
  beforeEach(() => {
    authState.mockUser = null;
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

  it("renders the logged-in user menu instead of the logged-out CTA", () => {
    authState.mockUser = {
      id: "user-1",
      email: "tim@example.com",
      displayName: "Tim Tester"
    };

    render(<Header />);

    expect(screen.queryByRole("button", { name: "Sign-in / Sign-up" })).toBeNull();
    expect(screen.getByTestId("user-menu")).toBeDefined();
  });
});
