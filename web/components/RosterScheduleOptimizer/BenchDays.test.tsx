import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContributionDay, PlayerContribution } from "lib/rosterScheduleOptimizer/contributionLedger";
import type { PlanningPlayer, RosterEntry } from "lib/rosterScheduleOptimizer/planningTypes";
import BenchDays from "./BenchDays";

afterEach(cleanup);
const player = (id: string, name: string): PlanningPlayer => ({ id, nhlId: null, name, teamAbbreviation: "TOR", eligiblePositions: ["C"],
  playerClass: "skater", availability: "rostered", ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] });
const contribution = (playerId: string, states: Array<ContributionDay["state"]>): PlayerContribution => ({ playerId,
  scheduledGames: null, knownScheduledGames: 0, activeGames: null, knownActiveGames: 0, benchGames: null, knownBenchGames: 0, projectedPoints: null,
  days: states.map((state, index) => ({ date: `2026-10-${String(18 + index).padStart(2, "0")}`, gameId: null, state, competingPlayerIds: [] })) });

describe("Bench days", () => {
  it("ranks lineup players by days that don't count (off + sat) from today on, leaving IR out", () => {
    const players = [player("a", "Busy Center"), player("b", "Idle Wing"), player("c", "Hurt Guy")];
    const roster: RosterEntry[] = [{ playerId: "a", position: "active" }, { playerId: "b", position: "bench" }, { playerId: "c", position: "IR" }];
    // 10-18 is before today and doesn't count, whatever its state.
    const contributions = new Map([
      ["a", contribution("a", ["no_game", "active", "active", "no_game", "active"])],
      ["b", contribution("b", ["active", "bench", "no_game", "elapsed", "no_game"])],
      ["c", contribution("c", ["reserve", "reserve", "reserve", "reserve", "reserve"])],
    ]);
    const onSelect = vi.fn();
    render(<BenchDays roster={roster} players={players} contributions={contributions} today="2026-10-19" onSelect={onSelect} />);
    const rows = within(screen.getByRole("region", { name: "Bench days" })).getAllByRole("listitem");
    expect(rows.map(row => row.querySelector("button")!.textContent)).toEqual(["Idle Wing", "Busy Center"]);
    // 10-18 (before today) and the elapsed 10-21 are dropped: bench, no game, no game remain.
    expect(rows[0].textContent).toContain("2 off · 1 sat");
    expect(rows[0].querySelector("strong")!.textContent).toBe("3/3");
    expect(rows[1].textContent).toContain("1 off · 0 sat");
    expect(screen.queryByText("Hurt Guy")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Bench days: Busy Center" }));
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("shows the top rows and toggles the rest from a button at the end", () => {
    const players = Array.from({ length: 7 }, (_, index) => player(`p${index}`, `Player ${index}`));
    const roster: RosterEntry[] = players.map(row => ({ playerId: row.id, position: "bench" }));
    const contributions = new Map(players.map(row => [row.id, contribution(row.id, ["no_game", "active"])]));
    render(<BenchDays roster={roster} players={players} contributions={contributions} today="2026-10-18" />);
    const list = () => within(screen.getByRole("region", { name: "Bench days" })).getAllByRole("listitem");
    expect(list()).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Show all (7)" }));
    expect(list()).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(list()).toHaveLength(5);
  });
});
