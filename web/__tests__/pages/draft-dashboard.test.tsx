import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import DraftDashboardPage from "../../pages/draft-dashboard";
import Layout from "components/Layout";
import DraftStatus from "components/DraftDashboard/DraftStatus";
import type { MockFlags } from "lib/mockDraft/flags";

const router = vi.hoisted(() => ({ pathname: "/draft-dashboard" }));

vi.mock("next/router", () => ({ useRouter: () => router }));

vi.mock("components/Layout/Header", () => ({
  default: () => <header>Site navigation</header>
}));

vi.mock("components/SocialMedias", () => ({ default: () => null }));

vi.mock("components/DraftDashboard/DraftDashboard", () => ({
  default: ({ mockFlags }: { mockFlags?: MockFlags }) =>
    <div data-collection={mockFlags?.collection}>Draft dashboard tools</div>
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  router.pathname = "/draft-dashboard";
});

describe("Draft Dashboard route", () => {
  it("server-renders a hydration-safe loading state without a maintenance notice", () => {
    vi.stubEnv("NODE_ENV", "production");
    const html = renderToString(<DraftDashboardPage />);

    expect(html).toContain("Loading draft dashboard");
    expect(html).not.toContain("Draft dashboard tools");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("Actively being updated");
  });

  it("hydrates the loading shell and mounts the dashboard with the supplied flags", async () => {
    const flags = { enabled: true, collection: true, board: false };
    const container = document.createElement("div");
    container.innerHTML = renderToString(<DraftDashboardPage flags={flags} />);
    document.body.appendChild(container);
    const onRecoverableError = vi.fn();
    let root: Root | undefined;
    try {
      expect(within(container).getByRole("status").textContent).toContain("Loading draft dashboard");
      await act(async () => {
        root = hydrateRoot(container, <DraftDashboardPage flags={flags} />, { onRecoverableError });
      });
      expect(within(container).getByText("Draft dashboard tools").getAttribute("data-collection")).toBe("true");
      expect(within(container).queryByRole("status")).toBeNull();
      expect(onRecoverableError).not.toHaveBeenCalled();
    } finally {
      await act(async () => { root?.unmount(); });
      container.remove();
    }
  });

  it("keeps the phone summary compact without changing the full Draft Status", () => {
    const status = { round: 2, rounds: 10, currentPick: 15, totalPicks: 120, teamName: "Team 3", nextPick: 20, picksUntilNext: 5 };
    const view = render(<DraftStatus {...status} compact />);
    const compact = within(screen.getByRole("region", { name: "Draft Status summary" }));
    expect(compact.getByText("Pick")).toBeTruthy();
    expect(compact.getByText("Team 3")).toBeTruthy();
    expect(compact.getByText("20")).toBeTruthy();
    expect(compact.queryByText("Round")).toBeNull();
    expect(compact.queryByText("Until turn")).toBeNull();

    view.rerender(<DraftStatus {...status} />);
    const full = within(screen.getByRole("region", { name: "Draft Status" }));
    expect(full.getByText("Round")).toBeTruthy();
    expect(full.getByText("Until turn")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Draft Status summary" })).toBeNull();
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
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    fireEvent.wheel(window, { deltaY: 100 });
    expect(screen.getByRole("contentinfo")).toBeTruthy();
  });
});
