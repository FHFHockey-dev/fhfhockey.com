import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SurfaceWorkflowLinks from "./SurfaceWorkflowLinks";

describe("SurfaceWorkflowLinks", () => {
  it("renders link cards for the supplied workflow destinations", () => {
    render(
      <SurfaceWorkflowLinks
        title="Next Stops"
        description="Move between related decision surfaces."
        links={[
          {
            href: "/trends",
            label: "Trends Dashboard",
            description: "Scan recent form first."
          },
          {
            href: "/start-chart",
            label: "Starter Board",
            description: "Check matchup context next."
          }
        ]}
      />
    );

    expect(screen.getByText("Next Stops")).toBeTruthy();
    expect(screen.getByText("Move between related decision surfaces.")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /trends dashboard/i }).getAttribute("href")
    ).toBe("/trends");
    expect(
      screen.getByRole("link", { name: /starter board/i }).getAttribute("href")
    ).toBe("/start-chart");
  });
});
