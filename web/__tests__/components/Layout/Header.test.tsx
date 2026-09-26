import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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

vi.mock("@react-spring/web", () => ({
  animated: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  useTransition:
    (visible: boolean) =>
    (render: (style: Record<string, never>, item: boolean) => React.ReactNode) =>
      render({}, visible),
}));

vi.mock("lib/supabase/public-client", () => ({
  default: {
    from: vi.fn(),
  },
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
    onSignOut,
    entryPoint,
    visible,
  }: any) => (
    <div
      data-testid="mobile-menu"
      data-entry-point={entryPoint}
      data-visible={String(visible)}
    >
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
    user: authState.mockUser,
    signOut: authState.signOut
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

  it("preserves the donation destination", () => {
    render(<Header />);
    expect(screen.getByRole("link", { name: "Support FHFH" }).getAttribute("href")).toBe("https://www.buymeacoffee.com/tjsusername");
  });

  it("renders the logged-out CTA and opens the auth modal", () => {
    render(<Header />);

    const authButton = screen.getByRole("button", {
      name: "Sign In / Sign Up"
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

  it("opens the shared mobile menu at the requested entry point", () => {
    render(<Header />);

    fireEvent.click(screen.getAllByRole("button", { name: "Search players" })[0]);
    expect(screen.getByTestId("mobile-menu").dataset.entryPoint).toBe("search");
    expect(screen.getByTestId("mobile-menu").dataset.visible).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Tools" }));
    expect(screen.getByTestId("mobile-menu").dataset.entryPoint).toBe("tools");

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByTestId("mobile-menu").dataset.entryPoint).toBe("default");

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByTestId("mobile-menu").dataset.entryPoint).toBe("default");
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

describe("desktop NavbarItems disclosure", () => {
  afterEach(cleanup);

  async function renderDesktopNavigation() {
    const [{ default: NavbarItems }, { default: items }] = await Promise.all([
      vi.importActual<
        typeof import("components/Layout/NavbarItems/NavbarItems")
      >("components/Layout/NavbarItems/NavbarItems"),
      import("components/Layout/NavbarItems/NavbarItemsData"),
    ]);

    return render(
      <NavbarItems
        items={items}
        onItemClick={vi.fn()}
      />,
    );
  }

  function activateNativeButton(button: HTMLElement, key: "Enter" | " ") {
    button.focus();
    fireEvent.keyDown(button, { key });
    fireEvent.click(button);
    fireEvent.keyUp(button, { key });
  }

  it("keeps category triggers in tab order with stable disclosure semantics", async () => {
    const { container } = await renderDesktopNavigation();
    const triggers = ["Analytics", "Tools", "Community"].map((name) =>
      screen.getByRole("button", { name }),
    );
    const focusableElements = Array.from(
      container.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    );

    expect(
      focusableElements.filter((element) => element.tagName === "BUTTON"),
    ).toEqual(triggers);
    for (const trigger of triggers) {
      expect(trigger.tabIndex).toBe(0);
      trigger.focus();
      expect(document.activeElement).toBe(trigger);
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      const submenu = document.getElementById(
        trigger.getAttribute("aria-controls") ?? "",
      );
      expect(submenu).toBeTruthy();
      expect(submenu?.hidden).toBe(true);
    }
  });

  it("supports native activation, submenu focus, Escape, and outside focus", async () => {
    await renderDesktopNavigation();
    const tools = screen.getByRole("button", { name: "Tools" });

    activateNativeButton(tools, "Enter");
    expect(tools.getAttribute("aria-expanded")).toBe("true");
    const toolsMenu = document.getElementById(
      tools.getAttribute("aria-controls") ?? "",
    )!;
    expect(toolsMenu.hidden).toBe(false);
    expect(
      within(toolsMenu)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual([
      "/start-chart", "/roster-schedule-optimizer", "/lines", "/drm",
      "/wigoCharts", "/shiftChart", "/draft-dashboard", "/nhl-predictions",
    ]);

    const statsLink = within(toolsMenu).getByRole("link", { name: /Start Chart/ });
    statsLink.focus();
    fireEvent.keyDown(statsLink, { key: "Escape" });
    expect(tools.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(tools);

    const charts = screen.getByRole("button", { name: "Analytics" });
    activateNativeButton(charts, " ");
    expect(charts.getAttribute("aria-expanded")).toBe("true");
    const blogLink = screen.getByRole("link", { name: "Blog" });
    fireEvent.blur(charts, { relatedTarget: blogLink });
    blogLink.focus();
    expect(charts.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps pointer hover and aria-expanded in sync", async () => {
    await renderDesktopNavigation();
    const variance = screen.getByRole("button", { name: "Community" });
    const category = variance.closest("li")!;

    fireEvent.mouseEnter(category);
    expect(variance.getAttribute("aria-expanded")).toBe("true");
    fireEvent.mouseLeave(category);
    expect(variance.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("cross-viewport navigation membership", () => {
  afterEach(cleanup);

  it("keeps all 18 destinations and promotes the required desktop links without duplicates", async () => {
    const data = await import("components/Layout/NavbarItems/NavbarItemsData");
    const desktopLinks = data.default.flatMap((item) => item.type === "link" ? [item] : item.groups.flatMap((group) => group.items));
    const mobileLinks = [data.NAVIGATION_LINKS.home, ...data.MOBILE_NAVIGATION_GROUPS.flatMap((category) => category.groups.flatMap((group) => group.items))];
    expect(new Set(desktopLinks.map((item) => item.href)).size).toBe(18);
    expect(desktopLinks).toHaveLength(18);
    expect(mobileLinks.map((item) => item.href).sort()).toEqual(desktopLinks.map((item) => item.href).sort());
    expect(data.default.filter((item) => item.type === "link").map((item) => item.label)).toEqual(["Home", "Game Grid", "Underlying Stats", "Blog"]);
  });

  it("matches nested routes without matching unrelated prefixes", async () => {
    const { isNavigationLinkActive: active } = await import("components/Layout/NavbarItems/NavbarItemsData");
    expect(active("/stats/player/1", "/stats")).toBe(true);
    expect(active("/stats-extra", "/stats")).toBe(false);
    expect(active("/stats", "/")).toBe(false);
  });
});

describe("account navigation", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("keeps mobile account actions collapsed and reports sign-out failures", async () => {
    const { default: MobileMenu } = await vi.importActual<typeof import("components/Layout/MobileMenu/MobileMenu")>("components/Layout/MobileMenu/MobileMenu");
    // jsdom lacks native dialog behavior; real focus/scroll behavior is covered by Playwright.
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
    const signOut = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    const close = vi.fn();
    const { container } = render(<MobileMenu visible onItemClick={close} accountUser={{ displayName: "Tim Tester" }} showAccountControls onSignOut={signOut} />);
    const account = container.querySelector("details")!;
    expect(account.open).toBe(false);
    fireEvent.click(account.querySelector("summary")!);
    expect(account.open).toBe(true);
    expect(screen.getByRole("link", { name: "League Settings" }).getAttribute("href")).toBe("/account?section=league-settings");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sign Out" })); });
    expect(screen.getByRole("alert").textContent).toContain("Unable to sign out");
    expect(close).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sign Out" })); });
    expect(close).toHaveBeenCalledOnce();
  });

  it("restores desktop account trigger focus on Escape", async () => {
    authState.mockUser = { displayName: "Tim Tester", email: "tim@example.com" };
    const { default: UserMenu } = await vi.importActual<typeof import("components/auth/UserMenu")>("components/auth/UserMenu");
    render(<UserMenu />);
    const trigger = screen.getByRole("button", { name: "Open account menu" });
    fireEvent.click(trigger);
    screen.getByRole("link", { name: "Account Settings" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });
});
