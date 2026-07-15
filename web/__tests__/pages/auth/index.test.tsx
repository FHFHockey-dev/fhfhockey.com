import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  user: null as any,
  signOut: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    query: {},
    replace: authState.replace,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("components/Layout/Container", () => ({
  default: ({ children }: any) => <main>{children}</main>,
}));

vi.mock("components/PageTitle", () => ({
  default: ({ children }: any) => <h1>{children}</h1>,
}));

vi.mock("components/ClientOnly", () => ({
  default: ({ children }: any) => <>{children}</>,
}));

vi.mock("components/auth/AuthForm", () => ({
  default: () => <div data-testid="auth-form" />,
}));

vi.mock("contexts/AuthProviderContext", () => ({
  useAuth: () => ({
    user: authState.user,
    signOut: authState.signOut,
  }),
}));

import AuthPage from "pages/auth";

describe("AuthPage stale-session recovery", () => {
  beforeEach(() => {
    authState.user = {
      id: "user-1",
      email: "tim@example.com",
      displayName: "Tim Tester",
      name: "Tim Tester",
    };
    authState.signOut.mockReset();
    authState.signOut.mockResolvedValue(undefined);
    authState.replace.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps targeted local auth reset reachable from the signed-in branch", () => {
    render(<AuthPage />);

    expect(screen.getByText("You are already signed in")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reset Local Auth" }));

    expect(authState.signOut).toHaveBeenCalledTimes(1);
  });
});
