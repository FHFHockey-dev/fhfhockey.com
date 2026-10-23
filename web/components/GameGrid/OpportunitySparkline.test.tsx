import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import OpportunitySparkline from "./OpportunitySparkline";
import type { OpportunityWeek, SkaterMatchup, TeamOpportunity } from "./utils/scheduleOpportunity";

const week = (weekNumber: number, start: string, gamesPlayed: number | null, offNights: number | null, skaterMatchup: SkaterMatchup): OpportunityWeek => ({
  weekNumber, start, end: start, gamesPlayed, offNights, skaterMatchup,
  opportunity: gamesPlayed == null ? null : gamesPlayed + 0.25 * (offNights ?? 0),
  observedGP: gamesPlayed ?? 0, observedON: offNights ?? 0, excluded: 0, unknown: 0,
  coverage: { known: gamesPlayed == null ? 0 : 7, expected: 7 }, opponents: [], xgf: null, xga: null,
});

const opportunity = (weeks: OpportunityWeek[]) => ({
  calculatedAt: "2026-10-22T00:00:00Z",
  weeks,
  opportunity: weeks.every((w) => w.opportunity != null) ? weeks.reduce((sum, w) => sum + w.opportunity!, 0) : null,
}) as TeamOpportunity;

afterEach(cleanup);

describe("OpportunitySparkline", () => {
  it("colors each week by matchup and shows a short card on keyboard focus", () => {
    const value = opportunity([
      week(1, "2026-10-19", 1, 0, "easier"), week(2, "2026-10-26", 3, 1, "average"),
      week(3, "2026-11-02", 3, 2, "harder"), week(4, "2026-11-09", 4, 0, "average"),
    ]);
    const { container } = render(<OpportunitySparkline value={value} scale={5} team="BOS" />);
    const trigger = screen.getByRole("button", { name: /^BOS 4-week value 11\.8, rising; weekly games 1, 3, 3, 4$/ });
    expect([...container.querySelectorAll("stop")].map((stop) => stop.getAttribute("data-matchup"))).toEqual(["easier", "average", "harder", "average"]);
    expect(container.querySelector("svg")?.getAttribute("data-shared-scale")).toBe("5");

    act(() => trigger.focus());
    const card = screen.getByRole("tooltip");
    expect(trigger.getAttribute("aria-describedby")).toBe(card.id);
    expect(card.textContent).toContain("Oct 26");
    expect(card.textContent).toContain("3 GP · 2 OFF");
    expect(card.textContent).toContain("Hard");
    expect(card.textContent).not.toMatch(/UTC|coverage|xG/);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("never bridges an unknown week and marks it pending", () => {
    const value = opportunity([
      week(1, "2026-10-19", 2, 0, "average"), week(2, "2026-10-26", null, null, "unknown"),
      week(3, "2026-11-02", 3, 1, "easier"), week(4, "2026-11-09", 2, 0, "harder"),
    ]);
    const { container } = render(<OpportunitySparkline value={value} scale={5} team="F1" />);
    const trigger = screen.getByRole("button", { name: /^F1 4-week value —/ });
    const line = container.querySelector("path[stroke]:not([filter])")!.getAttribute("d")!;
    expect(line.match(/M/g)).toHaveLength(2);
    expect(container.querySelectorAll("circle")).toHaveLength(3);

    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip").textContent).toContain("Schedule pending");
    fireEvent.click(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
