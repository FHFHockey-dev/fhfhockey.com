import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StreamingItinerary from "./StreamingItinerary";

const plan = {
  chains: [],
  alternatives: [],
  limitations: ["Streaming chains need acquisition timing and cost. Review League rules and scoring."]
} as any;

const props = {
  plan,
  dates: ["2026-11-09"],
  today: "2026-11-09",
  nameOf: (id: string) => id,
  teamOf: () => null,
  selectDisabled: null,
  onSelect: () => {}
};

describe("StreamingItinerary empty state", () => {
  afterEach(cleanup);

  it("turns the rules-review prompt into a button that opens League rules", () => {
    const onReviewRules = vi.fn();
    render(<StreamingItinerary {...props} onReviewRules={onReviewRules} />);

    expect(screen.getByText(/Streaming chains need acquisition timing and cost\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Review league rules and scoring" }));
    expect(onReviewRules).toHaveBeenCalledTimes(1);
  });

  it("keeps the plain sentence when no handler is given", () => {
    render(<StreamingItinerary {...props} />);
    expect(screen.getByText(plan.limitations[0])).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Review league rules/ })).toBeNull();
  });
});

describe("StreamingItinerary drop safety (TJ 2026-11-23)", () => {
  afterEach(cleanup);
  const step = { id: "s1", type: "add", playerId: "fa", dropPlayerId: "drop", at: "2026-11-09T12:00:00Z", effectiveAt: "2026-11-09T12:00:00Z", conditional: false, dependsOn: [] };
  const leg = { spot: 0, step, actionDate: "2026-11-09", startDate: "2026-11-09", endDate: "2026-11-09", playerId: "fa", dropPlayerId: "drop",
    games: 1, gameDates: ["2026-11-09"], points: 3, options: [] };
  const chainPlan = { chains: [{ spots: 1, legs: [leg], steps: [step], evaluation: { goalie: { risk: false } }, netGames: 1, netPoints: 3, addsUsed: 1, addsAvailable: 2 }],
    alternatives: [], limitations: [], recommended: 1 } as any;

  it("states each drop's ownership, points and AGP left, and that chains rank on projections only", () => {
    render(<StreamingItinerary {...props} plan={chainPlan} dropFacts={id => `${id === "drop" ? "Ownership 23%" : "?"} · 6.2 pts left · 2 AGP left`} />);
    expect(screen.getByText("Drop drop: Ownership 23% · 6.2 pts left · 2 AGP left")).toBeTruthy();
    expect(screen.getByText(/Ranked for each goal on projections only/)).toBeTruthy();
    expect(screen.queryByText(/average of projected fantasy points/)).toBeNull();
  });
});
