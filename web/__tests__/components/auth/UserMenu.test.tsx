import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  useAuth: () => ({
    user: authState.mockUser,
    signOut: authState.signOut
  })
}));

import UserMenu from "components/auth/UserMenu";

describe("UserMenu", () => {
  beforeEach(() => {
    authState.mockUser = {
      id: "user-1",
      email: "avery@example.test",
      displayName: "Avery Tester",
      avatarUrl: null,
      name: "Avery Tester"
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

    expect(screen.getByRole("button", { name: "Open account menu" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "Account Settings" })).toBeDefined();
    expect(screen.getByRole("link", { name: "League Settings" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeDefined();
  });

  it("closes the menu on escape", () => {
    render(<UserMenu />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open account menu" })
    );
    expect(screen.getByRole("button", { name: "Open account menu" }).getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByRole("button", { name: "Open account menu" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: "Account Settings" })).toBeNull();
  });

  it("signs out from the menu", async () => {
    render(<UserMenu />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open account menu" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));

    expect(authState.signOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Sign Out" })).toBeNull());
  });

  it("keeps a successfully loaded avatar visible", () => {
    authState.mockUser.avatarUrl = "https://example.test/avery.png";
    render(<UserMenu />);

    const image = screen.getByRole("img", { name: "Avery Tester" });
    fireEvent.load(image);

    expect(image.getAttribute("src")).toBe(authState.mockUser.avatarUrl);
    expect(screen.queryByText("AT")).toBeNull();
  });

  it("shows initials when the avatar URL is absent", () => {
    render(<UserMenu />);

    const trigger = screen.getByRole("button", { name: "Open account menu" });
    expect(within(trigger).getByText("AT")).toBeDefined();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows initials when the avatar image fails", () => {
    authState.mockUser.avatarUrl = "https://example.test/broken.png";
    render(<UserMenu />);

    fireEvent.error(screen.getByRole("img", { name: "Avery Tester" }));

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("AT")).toBeDefined();
  });

  it("retries the image when the URL changes after failure", () => {
    authState.mockUser.avatarUrl = "https://example.test/broken.png";
    const { rerender } = render(<UserMenu />);
    fireEvent.error(screen.getByRole("img"));

    authState.mockUser = { ...authState.mockUser, avatarUrl: "https://example.test/new.png" };
    rerender(<UserMenu />);

    const image = screen.getByRole("img", { name: "Avery Tester" });
    expect(image.getAttribute("src")).toBe("https://example.test/new.png");
    fireEvent.load(image);
    expect(screen.queryByText("AT")).toBeNull();
  });

  it("retries the same URL for a different user without retaining the old initials", () => {
    authState.mockUser.avatarUrl = "https://example.test/shared.png";
    const { rerender } = render(<UserMenu />);
    fireEvent.error(screen.getByRole("img"));

    authState.mockUser = { ...authState.mockUser, id: "user-2", displayName: "Morgan Example" };
    rerender(<UserMenu />);

    const image = screen.getByRole("img", { name: "Morgan Example" });
    expect(image.getAttribute("src")).toBe("https://example.test/shared.png");
    expect(screen.queryByText("AT")).toBeNull();
    fireEvent.error(image);
    expect(screen.getByText("ME")).toBeDefined();
  });

  it("retries after signing out and returning as the same user", () => {
    authState.mockUser.avatarUrl = "https://example.test/avery.png";
    const returningUser = authState.mockUser;
    const { rerender } = render(<UserMenu />);
    fireEvent.error(screen.getByRole("img"));

    authState.mockUser = null;
    rerender(<UserMenu />);
    expect(screen.queryByRole("button", { name: "Open account menu" })).toBeNull();

    authState.mockUser = returningUser;
    rerender(<UserMenu />);
    expect(screen.getByRole("img", { name: "Avery Tester" })).toBeDefined();
    expect(screen.queryByText("AT")).toBeNull();
  });
});
