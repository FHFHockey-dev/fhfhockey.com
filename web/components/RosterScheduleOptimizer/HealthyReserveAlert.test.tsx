import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HealthyReserveAlert from "./HealthyReserveAlert";

afterEach(cleanup);
const names: Record<string, string> = { d: "Back Healthy", e: "Hurt Wing" };
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
});
