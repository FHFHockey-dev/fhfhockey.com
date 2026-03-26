import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  mockUser: null as any,
  signOut: vi.fn()
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("contexts/AuthProviderContext", () => ({
  useUser: () => authState.mockUser
}));

vi.mock("lib/supabase/client", () => ({
  default: {
    auth: {
      signOut: authState.signOut
    }
  }
}));

import UserMenu from "components/auth/UserMenu";

describe("UserMenu", () => {
  beforeEach(() => {
    authState.mockUser = {
      id: "user-1",
      email: "tim@example.com",
      displayName: "Tim Tester",
      avatarUrl: null,
      name: "Tim Tester"
    };
    authState.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("opens the account menu and shows the expected actions", () => {
    render(<UserMenu />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open account menu" })
    );

    expect(screen.getByRole("menu", { name: "Account menu" })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Account Settings" })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "League Settings" })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Sign Out" })).toBeDefined();
  });

  it("closes the menu on escape", () => {
    render(<UserMenu />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open account menu" })
    );
    expect(screen.getByRole("menu", { name: "Account menu" })).toBeDefined();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu", { name: "Account menu" })).toBeNull();
  });

  it("signs out from the menu", async () => {
    render(<UserMenu />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open account menu" })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign Out" }));

    expect(authState.signOut).toHaveBeenCalledTimes(1);
  });
});
