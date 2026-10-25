import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import EditorialPlayerCard, { EDITORIAL_METRICS } from "./EditorialPlayerCard";
import { formatMetric } from "./PlayerCard";
import { adaptLocalSnapshot } from "../../lib/player-cards/adapter";
import { buildInteractionFixture, type FixtureScenario } from "../../lib/player-cards/interactionFixtures";
import { displaySnapshot, flowSettings, INITIAL_FLOW, type FlowState } from "../../lib/player-cards/interactionSnapshot";

afterEach(cleanup);
function fixture(changes: Partial<FlowState> = {}, scenario: FixtureScenario = "complete") {
  const state = { ...INITIAL_FLOW, ...changes };
  const result = adaptLocalSnapshot(buildInteractionFixture(flowSettings(state), scenario, state.playerId), state.playerId);
  if (result.state === "rejected") throw new Error(result.reason);
  return displaySnapshot(result);
}

describe("one editorial synthetic card checkpoint", () => {
  it("preserves actual values, raw rank/N, tied rank and same-pool percentile for all nine displayed metrics", () => {
    const snapshot = fixture(), before = JSON.stringify(snapshot);
    const { container } = render(<EditorialPlayerCard snapshot={snapshot} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("data-snapshot-id")).toBe(snapshot.id);
    expect(svg.getAttribute("viewBox")).toBe("0 0 1200 900");
    for (const id of EDITORIAL_METRICS) {
      const row = container.querySelector(`[data-metric-id="${id}"]`)!, value = snapshot.readings.find(reading => reading.id === id)!;
      expect(row.querySelector("[data-actual-value]")!.textContent).toBe(formatMetric(id, value.value));
      expect(row.querySelector("[data-raw-rank]")!.textContent).toContain(`${value.rank!.tied ? "T-" : ""}${value.rank!.ordinal}/${value.rank!.population}`);
      expect(row.querySelector("[data-percentile]")!.textContent).toContain(value.rank!.percentile.toFixed(1));
      const bar = row.querySelector("[data-percentile-bar]");
      if (bar) expect(Number(bar.getAttribute("width"))).toBeCloseTo(274 * value.rank!.percentile / 100);
    }
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(svg.textContent).toContain("ACTUAL PERCENTAGES");
    expect(svg.textContent).toContain("SYNTHETIC FIXTURE");
    expect(svg.textContent).toContain("no GP, TOI or position filter");
    expect(svg.textContent).toContain("Updated 2026-10-24 02:00 UTC");
    expect(svg.querySelector("button,input,select")).toBeNull();
  });
  it("exports a missing-source explanation without losing the short-sample context", () => {
    const { container } = render(<EditorialPlayerCard snapshot={fixture({ playerId: 1004 }, "metric-gap")} />);
    const row = container.querySelector('[data-metric-id="ixg60"]')!;
    expect(row.querySelector("[data-actual-value]")!.textContent).toBe("—");
    expect(row.textContent).toContain("Missing source");
    expect(row.textContent).toContain("incomplete inputs");
    expect(row.querySelector("[data-percentile-bar]")).toBeNull();
    expect(container.querySelector("svg")!.textContent).toContain("Known short season · proposed policy · Missing source");
  });
  it("keeps known undefined zero-exposure metrics distinct from missing source and retains numerical zero/GP", () => {
    const snapshot = fixture({ mode: "calendar", start: "2026-10-01", end: "2026-10-01", strength: "pp" });
    const { container } = render(<EditorialPlayerCard snapshot={snapshot} />);
    const svg = container.querySelector("svg")!;
    expect(container.querySelector('[data-metric-id="atoi"] [data-actual-value]')!.textContent).toBe("0:00");
    expect(svg.textContent).toContain("Undefined");
    expect(svg.textContent).toContain("zero denominator");
    expect(svg.textContent).not.toContain("Missing source");
    expect(svg.textContent).toContain("1 GP · 0.0 min TOI");
    const visibleText = [...svg.querySelectorAll("text")].map(node => node.textContent).join(" ");
    expect(visibleText).toContain("2026-10-01 →2026-10-01 · UTC");
    expect(svg.getAttribute("aria-label")).toContain("1 actual appearances");
  });
  it("announces GP unverified without inventing a count and retains missing-history explanations", () => {
    const { container } = render(<EditorialPlayerCard snapshot={fixture({}, "history-gap")} />);
    const svg = container.querySelector("svg")!;
    expect(svg.textContent).toContain("GP unverified");
    expect(svg.textContent).toContain("TOI unavailable");
    expect(svg.getAttribute("aria-label")).toContain("GP unverified");
    expect(svg.getAttribute("aria-label")).not.toContain("null actual appearances");
    expect(container.querySelectorAll("[data-percentile-bar]").length).toBe(0);
  });
  it("retains valid actuals when incomplete cohort proof blocks all rankings", () => {
    const { container } = render(<EditorialPlayerCard snapshot={fixture({}, "unknown-pool")} />);
    expect(container.querySelectorAll("[data-raw-rank]").length).toBe(0);
    expect(container.querySelectorAll("[data-unavailable]").length).toBe(9);
    expect(container.querySelector('[data-metric-id="xgPct"] [data-actual-value]')!.textContent).toContain("%");
    expect(container.querySelector("svg")!.textContent).toContain("Rank unavailable");
    expect(container.querySelector("svg")!.textContent).toContain("incomplete pool");
  });
});
