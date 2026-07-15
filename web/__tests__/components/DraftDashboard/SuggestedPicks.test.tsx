import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SuggestedPicks from "../../../components/DraftDashboard/SuggestedPicks";

function player(playerId: number, name: string, position: string, points: number) {
  return {
    playerId,
    fullName: name,
    displayTeam: "TST",
    displayPosition: position,
    eligiblePositions: position.split(","),
    combinedStats: {},
    fantasyPoints: {
      projected: points,
      actual: null,
      diffPercentage: null,
      projectedPerGame: null,
      actualPerGame: null
    },
    yahooAvgPick: playerId
  } as any;
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("SuggestedPicks grouped-forward presentation", () => {
  it("replaces stale split filters with FWD and filters cards by that contract", async () => {
    window.localStorage.setItem(
      "suggested.posFilterMulti",
      JSON.stringify(["C"])
    );
    const players = [
      player(1, "Multi Forward", "C,LW", 100),
      player(2, "Defense Player", "D", 80)
    ];

    render(
      <SuggestedPicks
        players={players}
        currentPick={1}
        teamCount={1}
        forwardGrouping="fwd"
        rosterProgress={[
          { pos: "FWD", filled: 0, total: 3 },
          { pos: "D", filled: 0, total: 1 }
        ]}
      />
    );

    const positionSelect = screen.getByRole("combobox", {
      name: "Filter by position"
    }) as HTMLSelectElement;
    const options = Array.from(positionSelect.options).map((option) => option.value);
    expect(options).toContain("FWD");
    expect(options).not.toContain("C");
    expect(options).not.toContain("LW");
    expect(screen.getAllByText("FWD").length).toBeGreaterThan(0);

    await waitFor(() =>
      expect(window.localStorage.getItem("suggested.posFilterMulti")).toBe("[]")
    );

    fireEvent.click(screen.getByRole("button", { name: "FWD 0 of 3" }));
    expect(screen.getByText("Multi Forward")).toBeTruthy();
    expect(screen.queryByText("Defense Player")).toBeNull();
  });

  it("defaults to canonical risk-aware rank and exposes working draft/compare actions", () => {
    const players = [
      { ...player(1, "Urgent Player", "C", 100), yahooAvgPick: 2 },
      { ...player(2, "Later Player", "D", 90), yahooAvgPick: 100 }
    ];
    const metrics = new Map([
      ["1", { vbd: 10, vorp: 10, vona: 0 } as any],
      ["2", { vbd: 11, vorp: 11, vona: 0 } as any]
    ]);
    const onDraftPlayer = vi.fn();
    const onComparePlayer = vi.fn();
    render(
      <SuggestedPicks
        players={players}
        vorpMetrics={metrics}
        currentPick={1}
        nextPickNumber={10}
        teamCount={1}
        onDraftPlayer={onDraftPlayer}
        onComparePlayer={onComparePlayer}
      />
    );

    expect(
      (screen.getByRole("combobox", { name: "Sort suggested picks" }) as HTMLSelectElement)
        .value
    ).toBe("rank");
    expect(screen.getAllByRole("listitem")[0].textContent).toContain(
      "Urgent Player"
    );
    expect(screen.getAllByText(/Gone by next pick/)[0].textContent).toContain(
      "%"
    );

    fireEvent.click(screen.getByRole("button", { name: "Draft Urgent Player" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Add Urgent Player to comparison"
      })
    );
    expect(onDraftPlayer).toHaveBeenCalledWith("1");
    expect(onComparePlayer).toHaveBeenCalledWith("1");
  });

  it("renders an honest empty state when no available players remain", () => {
    render(<SuggestedPicks players={[]} currentPick={1} teamCount={1} />);
    expect(screen.getByText("No matching players")).toBeTruthy();
  });
});
