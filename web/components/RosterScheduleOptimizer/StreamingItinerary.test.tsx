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
