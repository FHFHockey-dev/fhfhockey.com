import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SustainabilityBadge from "./SustainabilityBadge";
import SustainabilitySparkline from "./SustainabilitySparkline";
import SustainabilityTooltip from "./SustainabilityTooltip";
import {
  buildSustainabilityThresholds,
  formatSustainabilityScore
} from "./formatting";

describe("Sustainability UI", () => {
  it("uses dynamic tiers and announces provisional scores", () => {
    const thresholds = buildSustainabilityThresholds([20, 40, 60, 80]);
    render(<SustainabilityBadge score={80} thresholds={thresholds} status="provisional" />);
    expect(screen.getByLabelText(/Sustainability Durable.*provisional/)).toBeTruthy();
    expect(formatSustainabilityScore(null)).toBe("—");
  });

  it("renders an accessible trend and a truthful insufficient-data fallback", () => {
    const { rerender } = render(<SustainabilitySparkline points={[]} />);
    expect(screen.getByRole("status").textContent).toContain("Trend pending");
    rerender(<SustainabilitySparkline points={[
      { snapshot_date: "2026-03-20", s_100: 40 },
      { snapshot_date: "2026-03-21", s_100: 60 }
    ]} />);
    expect(screen.getByRole("img", { name: /40.0 to 60.0/ })).toBeTruthy();
  });

  it("sorts tooltip components by absolute contribution with accessible headers", () => {
    render(<SustainabilityTooltip components={[
      { metric: "small", contrib: 0.2, z_raw: 1, z_soft: 1, r: null, n: null },
      { metric: "large", contrib: -2, z_raw: -2, z_soft: -2, r: 0.5, n: 10 }
    ]} />);
    expect(screen.getByText("Sustainability component contributions")).toBeTruthy();
    expect(screen.getAllByRole("row")[1].textContent).toContain("large");
  });
});
