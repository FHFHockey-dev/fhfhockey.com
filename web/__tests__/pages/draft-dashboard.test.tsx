import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import DraftDashboardPage from "../../pages/draft-dashboard";

vi.mock("components/DraftDashboard/DraftDashboard", () => ({
  default: () => <div>Draft dashboard tools</div>
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("Draft Dashboard route", () => {
  it("server-renders a non-dismissible season update notice", () => {
    vi.stubEnv("NODE_ENV", "production");
    const html = renderToString(<DraftDashboardPage />);

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Draft Dashboard");
    expect(html).toContain(
      "Actively being updated for the 2026-2027 season. Check back soon"
    );
    expect(html).not.toContain("Continue to Draft Dashboard");
  });

  it("allows developers to dismiss the notice and use the dashboard", () => {
    vi.stubEnv("NODE_ENV", "development");
    render(<DraftDashboardPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Continue to Draft Dashboard" })
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Draft dashboard tools")).toBeTruthy();
  });
});
