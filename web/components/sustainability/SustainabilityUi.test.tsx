import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import SustainabilityBadge from "./SustainabilityBadge";
import SustainabilitySparkline from "./SustainabilitySparkline";
import SustainabilityTooltip from "./SustainabilityTooltip";
import {
  buildSustainabilityThresholds,
  formatSustainabilityScore
} from "./formatting";

describe("Sustainability UI", () => {
  afterEach(cleanup);

  it("uses dynamic tiers and announces provisional scores", () => {
    const thresholds = buildSustainabilityThresholds([20, 40, 60, 80]);
    render(<SustainabilityBadge score={80} thresholds={thresholds} status="provisional" />);
    expect(screen.getByLabelText("Sustainability High index, score 80.0, provisional")).toBeTruthy();
    expect(screen.getByText("provisional")).toBeTruthy();
    expect(formatSustainabilityScore(null)).toBe("—");
  });

  it.each([
    [80, "High index", "durable"],
    [60, "High index", "durable"],
    [50, "Mid index", "balanced"],
    [40, "Low index", "volatile"],
    [20, "Low index", "volatile"],
  ] as const)("describes finite score %s using index tiers and the existing style token", (score, label, styleToken) => {
    const thresholds = buildSustainabilityThresholds([20, 40, 60, 80]);
    render(<SustainabilityBadge score={score} thresholds={thresholds} />);
    const badge = screen.getByLabelText(`Sustainability ${label}, score ${score.toFixed(1)}`);
    expect(badge.textContent).toBe(`${label} ${score.toFixed(1)}`);
    expect(badge.className).toContain(styleToken);
    expect(badge.title).toContain("Descriptive process support index");
    expect(badge.textContent).not.toMatch(/Durable|Volatile|Balanced/);
  });

  it.each([null, undefined, NaN, Infinity, -Infinity])("keeps missing/nonfinite score %s unavailable", (score) => {
    render(<SustainabilityBadge score={score} thresholds={{ lower: 40, upper: 60 }} />);
    const badge = screen.getByLabelText("Sustainability Index unavailable");
    expect(badge.textContent).toBe("Index unavailable");
    expect(badge.className).not.toMatch(/durable|volatile|balanced/);
    expect(badge.title).toContain("missing or nonfinite");
  });

  it("retains the provisional marker when the score is omitted", () => {
    render(<SustainabilityBadge thresholds={{ lower: 40, upper: 60 }} status="provisional" />);
    const badge = screen.getByLabelText("Sustainability Index unavailable, provisional");
    expect(badge.textContent).toBe("Index unavailable provisional");
    expect(badge.className).toContain("provisional");
    expect(badge.textContent).not.toContain("Mid index");
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
