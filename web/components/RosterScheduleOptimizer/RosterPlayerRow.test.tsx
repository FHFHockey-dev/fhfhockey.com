import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RosterPlayerRow from "./RosterPlayerRow";
import type { PlanningPlayer } from "lib/rosterScheduleOptimizer/planningTypes";

afterEach(cleanup);
const player = (ownership: number | null): PlanningPlayer => ({ id: "p", nhlId: null, name: "Depth Center", teamAbbreviation: "CAR",
  eligiblePositions: ["C"], playerClass: "skater", availability: "rostered", ownership, canDrop: true, holdValue: null, reserveEligibility: [] });
const row = (ownership: number | null, dropCandidate = true, unprojected = false) => render(<RosterPlayerRow player={player(ownership)} entry={{ playerId: "p", position: "bench" }}
  nameOf={id => id} protectedPlayer={false} manual={false} select={vi.fn()} protect={vi.fn()} position={vi.fn()} remove={vi.fn()} dropCandidate={dropCandidate} unprojected={unprojected} />);

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
  it("flags an unprojected player instead of suggesting him as the drop", () => {
    row(95, false, true);
    expect(screen.getByText("no projection")).toBeTruthy();
    expect(screen.queryByText("DROP")).toBeNull();
    expect(screen.queryByText(/Widely rostered/)).toBeNull();
  });
  it("shows no caution on rows that are not the suggested drop", () => {
    row(95, false);
    expect(screen.queryByText(/Widely rostered/)).toBeNull();
  });
});

describe("injured players (TJ, 2026-11-16)", () => {
  const injured = (status: string, label: string, injuredWeek?: { games: number; points: number | null; basis: "line" | "if_dresses" | "none" | "mixed" } | null) =>
    render(<RosterPlayerRow player={{ ...player(null), injury: { status, label, note: null } }} entry={{ playerId: "p", position: "active" }}
      nameOf={id => id} protectedPlayer={false} manual={false} select={vi.fn()} protect={vi.fn()} position={vi.fn()} remove={vi.fn()} injuredWeek={injuredWeek} />);

  it("tags an Out player and shows his week's projection greyed, not counted", () => {
    const { container } = injured("IR-LT", "Injured Reserve - Long Term", { games: 4, points: 11.6, basis: "line" });
    expect(container.firstElementChild!.getAttribute("data-injury")).toBe("out");
    expect(screen.getByText("OUT")).toBeTruthy();
    const points = screen.getByLabelText("Active points: Injured · not counted while he's listed Injured Reserve - Long Term: 11.6 projected points this week. It counts again once he's cleared.");
    expect(points.querySelector("strong")!.textContent).toBe("11.6");
    expect(points.querySelector("strong")!.hasAttribute("data-excluded")).toBe(true);
  });

  it("says when an Out player has no projection, and stays generic without the display read", () => {
    injured("O", "Out", { games: 3, points: null, basis: "none" });
    expect(screen.getByLabelText("Active points: Injured · not counted while he's listed Out. No projection for this week.")).toBeTruthy();
    cleanup();
    injured("O", "Out", undefined);
    expect(screen.getByTitle("Injured · not counted while he's listed Out.")).toBeTruthy();
    expect(screen.queryByText(/projected points/)).toBeNull();
  });

  it("keeps a day-to-day player counted, with a caution tag", () => {
    const { container } = injured("DTD", "Day-to-Day", null);
    expect(container.firstElementChild!.getAttribute("data-injury")).toBe("caution");
    expect(screen.getByText("DTD").getAttribute("title")).toBe("Day-to-Day: still counted. Check his status before games.");
    expect(screen.queryByText("OUT")).toBeNull();
    expect(container.querySelector("[data-excluded]")).toBeNull();
  });
});
