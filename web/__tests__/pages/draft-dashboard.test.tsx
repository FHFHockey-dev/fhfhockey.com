import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import DraftDashboardPage from "../../pages/draft-dashboard";
import Layout from "components/Layout";

const router = vi.hoisted(() => ({ pathname: "/draft-dashboard" }));

vi.mock("next/router", () => ({ useRouter: () => router }));

vi.mock("components/Layout/Header", () => ({
  default: () => <header>Site navigation</header>
}));

vi.mock("components/SocialMedias", () => ({ default: () => null }));

vi.mock("components/DraftDashboard/DraftDashboard", () => ({
  default: () => <div>Draft dashboard tools</div>
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  router.pathname = "/draft-dashboard";
});

describe("Draft Dashboard route", () => {
  it("server-renders the dashboard without a maintenance notice", () => {
    vi.stubEnv("NODE_ENV", "production");
    const html = renderToString(<DraftDashboardPage />);

    expect(html).toContain("Draft dashboard tools");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("Actively being updated");
  });

  it("renders the dashboard without the site footer", () => {
    vi.stubEnv("NODE_ENV", "development");
    render(
      <Layout>
        <DraftDashboardPage />
      </Layout>
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Draft dashboard tools")).toBeTruthy();
    expect(screen.getByRole("banner")).toBeTruthy();
    fireEvent.wheel(window, { deltaY: 100 });
    expect(screen.queryByRole("contentinfo", { hidden: true })).toBeNull();
  });

  it("keeps footers on other pages when navigating to and from the dashboard", () => {
    router.pathname = "/";
    const { rerender } = render(<Layout>Page content</Layout>);
    expect(screen.getByRole("contentinfo")).toBeTruthy();

    router.pathname = "/underlying-stats";
    rerender(<Layout>Page content</Layout>);
    fireEvent.wheel(window, { deltaY: 100 });
    expect(screen.getByRole("contentinfo")).toBeTruthy();

    router.pathname = "/draft-dashboard";
    rerender(<Layout>Page content</Layout>);
    expect(screen.queryByRole("contentinfo", { hidden: true })).toBeNull();

    router.pathname = "/game-grid";
    rerender(<Layout>Page content</Layout>);
    fireEvent.wheel(window, { deltaY: -100 });
    expect(
      screen.getByRole("contentinfo", { hidden: true }).getAttribute("aria-hidden")
    ).toBe("true");
    fireEvent.wheel(window, { deltaY: 100 });
    expect(screen.getByRole("contentinfo")).toBeTruthy();
  });
});
