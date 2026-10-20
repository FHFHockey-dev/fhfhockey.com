import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RosterPlayerRow from "./RosterPlayerRow";
import type { PlanningPlayer } from "lib/rosterScheduleOptimizer/planningTypes";

afterEach(cleanup);
const player = (ownership: number | null): PlanningPlayer => ({ id: "p", nhlId: null, name: "Depth Center", teamAbbreviation: "CAR",
  eligiblePositions: ["C"], playerClass: "skater", availability: "rostered", ownership, canDrop: true, holdValue: null, reserveEligibility: [] });
const row = (ownership: number | null, dropCandidate = true) => render(<RosterPlayerRow player={player(ownership)} entry={{ playerId: "p", position: "bench" }}
  nameOf={id => id} protectedPlayer={false} manual={false} select={vi.fn()} protect={vi.fn()} position={vi.fn()} remove={vi.fn()} dropCandidate={dropCandidate} />);

describe("roster DROP chip retention caution (R7)", () => {
  it("cautions on a widely rostered suggested drop, even at exactly 50%", () => {
    row(50);
    expect(screen.getByText("DROP")).toBeTruthy();
    expect(screen.getByText("Widely rostered: 50% of Yahoo leagues. Others may claim him quickly if dropped.")).toBeTruthy();
  });
  it("says demand is unchecked when ownership is unknown, and stays quiet for a known low share (0% included)", () => {
    row(null);
    expect(screen.getByText("Ownership unknown. Demand from other managers isn't checked.")).toBeTruthy();
    cleanup();
    row(0);
    expect(screen.queryByText(/Widely rostered|Ownership unknown/)).toBeNull();
  });
  it("shows no caution on rows that are not the suggested drop", () => {
    row(95, false);
    expect(screen.queryByText(/Widely rostered/)).toBeNull();
  });
});
