import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ExperimentalToolkitPanel from "./ExperimentalToolkitPanel";

describe("ExperimentalToolkitPanel", () => {
  it("labels the live foundation and keeps experimental channels explicitly planned", () => {
    render(<ExperimentalToolkitPanel />);

    expect(screen.getByText("Player Evaluation Toolkit roadmap")).toBeTruthy();
    expect(screen.getByText("Live foundation")).toBeTruthy();
    expect(screen.getAllByText("Planned experiment")).toHaveLength(2);
    expect(screen.getByText("SOG/60")).toBeTruthy();
    expect(screen.getByText("iHDCF/60")).toBeTruthy();
    expect(
      screen.getByText(/never treat missing ADP as zero cost/i),
    ).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
