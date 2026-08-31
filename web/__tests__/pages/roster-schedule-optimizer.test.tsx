import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("components/RosterScheduleOptimizer", () => ({
  default: () => <div>Optimizer workspace</div>,
}));
vi.mock("components/ClientOnly", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import RosterScheduleOptimizerPage from "pages/roster-schedule-optimizer";

afterEach(() => {
  document.title = "";
});

describe("Roster Schedule Optimizer route", () => {
  it("renders the full-width client workspace with route metadata", async () => {
    render(<RosterScheduleOptimizerPage />);

    expect(screen.getByText("Optimizer workspace")).toBeTruthy();
    await waitFor(() => {
      expect(document.title).toBe("NHL Roster Schedule Optimizer | FHFH");
    });
  });
});
