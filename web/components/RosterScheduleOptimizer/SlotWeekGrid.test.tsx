import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SlotWeekGrid from "./SlotWeekGrid";
import type { ActiveSlotInstance } from "lib/rosterScheduleOptimizer/types";
import type { GameForecast, PlanningAssignment, PlanningGame, PlanningPlayer, RosterEntry } from "lib/rosterScheduleOptimizer/planningTypes";

afterEach(cleanup);
const p = (id: string, name: string, team: string, playerClass: "skater" | "goalie" = "skater"): PlanningPlayer => ({ id, nhlId: null, name, teamAbbreviation: team,
  eligiblePositions: [playerClass === "goalie" ? "G" : "C"], playerClass, availability: "rostered", ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] });
const players = [p("a", "Sidney Crosby", "PIT"), p("b", "Nick Suzuki", "MTL"), p("c", "Jack Hughes", "NJD"), p("g", "Tristan Jarry", "PIT", "goalie"), p("i", "Hurt Guy", "PIT")];
const roster: RosterEntry[] = [{ playerId: "a", position: "active" }, { playerId: "b", position: "active" }, { playerId: "c", position: "bench" },
  { playerId: "g", position: "active" }, { playerId: "i", position: "IR" }];
const slots: ActiveSlotInstance[] = [{ id: "C1", type: "C", index: 0 }, { id: "C2", type: "C", index: 1 }, { id: "G1", type: "G", index: 0 }];
const dates = ["2026-10-19", "2026-10-20", "2026-10-21"];
const g = (id: string, date: string, team: string, opponent: string, home: boolean): PlanningGame => ({ id, date, startsAt: null, teamAbbreviation: team, opponent, home, status: "scheduled" });
const games = [g("1", "2026-10-19", "PIT", "PHI", false), g("2", "2026-10-19", "MTL", "TOR", true), g("3", "2026-10-19", "NJD", "BOS", true),
  g("4", "2026-10-20", "MTL", "MTL", true)];
const assignments: PlanningAssignment[] = [
  { date: "2026-10-19", playerId: "a", gameId: "1", slotId: "C1", locked: true },
  { date: "2026-10-19", playerId: "b", gameId: "2", slotId: "C2", locked: false },
  { date: "2026-10-19", playerId: "g", gameId: "1", slotId: "G1", locked: false },
  { date: "2026-10-20", playerId: "b", gameId: "4", slotId: "C1", locked: false }];
const forecasts = [{ playerId: "g", gameId: "1", confirmedStart: true, startProbability: 1 } as GameForecast];

describe("SlotWeekGrid", () => {
  it("renders the position-first week", () => {
    const onSelectPlayer = vi.fn();
    render(<SlotWeekGrid dates={dates} slots={slots} assignments={assignments} games={games} players={players} roster={roster}
      forecasts={forecasts} pointsFor={() => 2.34} onSelectPlayer={onSelectPlayer} />);
    expect(screen.getByRole("table", { name: "Lineup by position" })).toBeTruthy();
    expect(screen.getByText("C")).toBeTruthy();
    expect(screen.getByText("G")).toBeTruthy();
    expect(screen.getByText("Mon")).toBeTruthy();
    expect(screen.getByText("Oct 19")).toBeTruthy();
    expect(screen.getByText("3 NHL")).toBeTruthy();
    expect(screen.getByText("0 NHL")).toBeTruthy();
    expect(screen.getByText("Crosby")).toBeTruthy();
    expect(screen.getAllByText("@PHI")).toHaveLength(2);
    expect(screen.getAllByText("vsMTL")).toHaveLength(1);
    expect(screen.getAllByText("Empty")).toHaveLength(2);
    expect(screen.getAllByText("—")).toHaveLength(3);
    const benchRow = screen.getByText("BN").closest("tr")!;
    const cells = within(benchRow).getAllByRole("cell");
    expect(within(cells[0]).getByText("Hughes")).toBeTruthy();
    // Nobody plays for this roster on 10-20 except Suzuki (in the lineup): the idle trio folds into one chip.
    expect(cells[1].textContent).toBe("+3 off");
    expect(within(cells[0]).getByRole("button").getAttribute("data-bench")).toBe("playing");
    expect(screen.getByLabelText("Confirmed starter").textContent).toBe("✓");
    expect(screen.getAllByLabelText("Locked")).toHaveLength(1);
    expect(screen.getAllByText("2.3").length).toBeGreaterThan(0);
    expect(screen.getByText(/Guy \(IR\)/)).toBeTruthy();
    expect(screen.getByText("3/3")).toBeTruthy();
    expect(screen.getByText("1/3")).toBeTruthy();
    // Point values carry a high/mid/low tier for the lineup that week.
    expect(screen.getAllByText("2.3").every(node => ["high", "mid", "low"].includes(node.getAttribute("data-tier") ?? ""))).toBe(true);
    fireEvent.focus(screen.getByRole("button", { name: "About the lineup grid" }));
    expect(screen.getByText(/projected fantasy points for that game/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Sidney Crosby/ }));
    expect(onSelectPlayer).toHaveBeenCalledWith("a");
  });

  it("replays Optimize day by day: current lineup first, then the optimized one, pulsing each day", () => {
    vi.useFakeTimers();
    try {
      const props = { dates, slots, assignments, games, players, roster, today: "2026-10-19" };
      const view = render(<SlotWeekGrid {...props} animationToken={0} />);
      expect(screen.queryByText(/Optimizing/)).toBeNull();
      view.rerender(<SlotWeekGrid {...props} animationToken={1} />);
      expect(screen.getByText(/Optimizing Mon Oct 19/)).toBeTruthy();
      // Later days wait, dimmed, in the current lineup: Crosby (C) and Jarry (G) hold slots on a night PIT doesn't play,
      // and Hughes sits greyed on the bench with no game.
      expect(document.querySelector('td[data-date="2026-10-20"][data-pending]')).toBeTruthy();
      expect(screen.getAllByText("No game")).toHaveLength(3);
      expect(document.querySelector('td[data-date="2026-10-20"] [data-bench="idle"]')).toBeTruthy();
      act(() => { vi.advanceTimersByTime(280); });
      expect(document.querySelector('td[data-date="2026-10-19"][data-pulse]')).toBeTruthy();
      act(() => { vi.advanceTimersByTime(620); });
      expect(screen.getByText(/Optimizing Tue Oct 20/)).toBeTruthy();
      act(() => { vi.advanceTimersByTime(280); });
      // 10-20 settles: Suzuki takes the C slot and the idle chip is gone.
      expect(screen.queryByText("No game")).toBeNull();
      act(() => { vi.advanceTimersByTime(620); });
      expect(screen.queryByText(/Optimizing/)).toBeNull();
      expect(document.querySelector("[data-pending], [data-pulse]")).toBeNull();
    } finally { vi.useRealTimers(); }
  });

  it("shows each player's own opponent when both teams' rows share a game id", () => {
    // DET sorts before SEA, so a lookup by id alone returned SEA's row ("vsDET") for the Detroit player.
    const larkin = { ...p("d", "Dylan Larkin", "DET"), eligiblePositions: ["C"] };
    const sides = [g("149", "2026-10-19", "DET", "SEA", false), g("149", "2026-10-19", "SEA", "DET", true)];
    render(<SlotWeekGrid dates={["2026-10-19"]} slots={[slots[0]]} games={sides} players={[larkin]} roster={[{ playerId: "d", position: "active" }]}
      assignments={[{ date: "2026-10-19", playerId: "d", gameId: "149", slotId: "C1", locked: false }]} />);
    expect(screen.getByText("@SEA")).toBeTruthy();
    expect(screen.queryByText(/DET$/)).toBeNull();
  });

  it("flags injured players with the injury icon and a red chip", () => {
    const hurt = { ...players[0], injury: { status: "DTD", label: "Day-to-Day", note: "Lower Body" } };
    render(<SlotWeekGrid dates={dates} slots={slots} assignments={assignments} games={games} players={[hurt, ...players.slice(1)]} roster={roster} onSelectPlayer={vi.fn()} />);
    expect(screen.getAllByAltText("Day-to-Day · Lower Body").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Sidney Crosby, C, 2026-10-19/ }).hasAttribute("data-injured")).toBe(true);
    expect(screen.getByRole("button", { name: /Nick Suzuki, C, 2026-10-19/ }).hasAttribute("data-injured")).toBe(false);
  });
});
