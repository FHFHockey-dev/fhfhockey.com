import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HealthyReserveAlert from "./HealthyReserveAlert";

afterEach(cleanup);
const names: Record<string, string> = { d: "Back Healthy", e: "Hurt Wing", f: "Fresh Legs", g: "Third Man" };
const nameOf = (id: string) => names[id] ?? id;

describe("Healthy reserve alert", () => {
  it("names the healthy IR player, says the lineup is illegal and shows the gain from activating him", () => {
    const onSelect = vi.fn();
    render(<HealthyReserveAlert nameOf={nameOf} onSelect={onSelect} reserves={[{ playerId: "d", position: "IR", slotEligible: false,
      activation: { swapPlayerId: null, projectedPoints: 6.25, activeGames: 2 } }]} />);
    const alert = screen.getByRole("alert", { name: "Healthy players in IR" });
    expect(alert.textContent).toContain("Healthy player in IR");
    expect(alert.textContent).toContain("Back Healthy is in your IR spot, but Yahoo lists no injury.");
    expect(alert.textContent).toContain("Yahoo no longer lists him for IR, so the lineup is illegal until he moves.");
    expect(alert.textContent).toContain("Move him to an open bench or active spot.");
    expect(screen.getByText("+6.3 projected pts · +2 active games this week").dataset.known).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Back Healthy" }));
    expect(onSelect).toHaveBeenCalledWith("d");
  });

  it("suggests the swap, or a drop when no spot opens, and never invents a gain", () => {
    const { rerender } = render(<HealthyReserveAlert nameOf={nameOf} reserves={[{ playerId: "d", position: "IR+", slotEligible: true,
      activation: { swapPlayerId: "e", projectedPoints: null, activeGames: null } }]} />);
    expect(screen.getByRole("alert").textContent).toContain("Swap him with Hurt Wing (Yahoo lists Hurt Wing for IR+).");
    expect(screen.getByRole("alert").textContent).not.toContain("illegal");
    expect(screen.getByText("Gain unknown until the lineup passes the rule check").dataset.known).toBe("false");
    rerender(<HealthyReserveAlert nameOf={nameOf} reserves={[{ playerId: "d", position: "IR", slotEligible: false,
      activation: { swapPlayerId: null, projectedPoints: null, activeGames: 0 } }]} />);
    expect(screen.getByText("No added active games this week").dataset.known).toBe("false");
    expect(screen.queryByText(/No projected gain/)).toBeNull();
    rerender(<HealthyReserveAlert nameOf={nameOf} reserves={[{ playerId: "d", position: "IR", slotEligible: false, activation: null }]} />);
    expect(screen.getByRole("alert").textContent).toContain("No roster spot is open: drop a player or move an injured one to IR to activate him.");
    expect(screen.queryByText(/projected pts|Gain unknown|active games/)).toBeNull();
    rerender(<HealthyReserveAlert nameOf={nameOf} reserves={[]} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // TJ 2026-10-25: rank competing healthy reserves by projected gain and say how many fit.
  it("says only the best can be activated when spots run out, and keeps unknown gains' own wording", () => {
    const f = { playerId: "f", position: "IR+" as const, slotEligible: false, activation: { swapPlayerId: null, projectedPoints: 10, activeGames: 2 } };
    const d = { playerId: "d", position: "IR" as const, slotEligible: false, activation: null };
    const { rerender } = render(<HealthyReserveAlert nameOf={nameOf} reserves={[f, d]} />);
    expect(screen.getByText("Only one can be activated: best is Fresh Legs (+10 pts).")).toBeTruthy();
    const g = { playerId: "g", position: "IR" as const, slotEligible: true, activation: { swapPlayerId: "e", projectedPoints: null, activeGames: null } };
    rerender(<HealthyReserveAlert nameOf={nameOf} reserves={[f, g, d]} />);
    expect(screen.getByText("Only 2 can be activated: best are Fresh Legs (+10 pts) and Third Man.")).toBeTruthy();
    expect(screen.getByText("Gain unknown until the lineup passes the rule check")).toBeTruthy();
    rerender(<HealthyReserveAlert nameOf={nameOf} reserves={[f, g]} />);
    expect(screen.queryByText(/can be activated/)).toBeNull();
    rerender(<HealthyReserveAlert nameOf={nameOf} reserves={[d]} />);
    expect(screen.queryByText(/can be activated/)).toBeNull();
  });

  it("adds a soft note, never a warning, for a DTD player in IR+ whose team plays today", () => {
    const { rerender } = render(<HealthyReserveAlert nameOf={nameOf} reserves={[]} dtd={["e"]} />);
    expect(screen.getByRole("note").textContent).toBe("Hurt Wing: DTD in IR+ — may play; consider activating if you have a spot.");
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(<HealthyReserveAlert nameOf={nameOf} reserves={[{ playerId: "d", position: "IR", slotEligible: false, activation: null }]} dtd={["e"]} />);
    expect(screen.getByRole("alert").textContent).not.toContain("DTD");
    expect(screen.getByRole("note")).toBeTruthy();
    rerender(<HealthyReserveAlert nameOf={nameOf} reserves={[]} dtd={[]} />);
    expect(screen.queryByRole("note")).toBeNull();
  });
});
