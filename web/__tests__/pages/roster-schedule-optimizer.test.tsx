import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("components/RosterScheduleOptimizer", () => ({
  default: () => <div>Optimizer workspace</div>,
}));
vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import RosterScheduleOptimizerPage from "pages/roster-schedule-optimizer";

afterEach(() => {
  cleanup();
  document.title = "";
});

describe("Roster Schedule Optimizer route", () => {
  it("renders a loading workspace in the initial HTML instead of an empty client-only page", () => {
    expect(renderToString(<RosterScheduleOptimizerPage />)).toContain("Loading your planning workspace…");
  });

  it("renders the full-width client workspace with route metadata", async () => {
    const view = render(<RosterScheduleOptimizerPage />);

    expect(await screen.findByText("Optimizer workspace")).toBeTruthy();
    expect(view.container.querySelector("title")?.textContent).toBe("NHL Roster Schedule Optimizer | FHFH");
  });
});
