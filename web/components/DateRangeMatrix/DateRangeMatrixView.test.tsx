import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DateRangeMatrixView from "./DateRangeMatrixView";
import type { PlayerData } from "./utilities";

vi.mock("./index", () => ({
  DateRangeMatrixInternal: () => <div data-testid="matrix-renderer" />,
}));

afterEach(() => cleanup());

const player: PlayerData = {
  id: 1,
  teamId: 22,
  franchiseId: 25,
  position: "C",
  name: "Test Player",
  playerAbbrevName: "T. Player",
  lastName: "Player",
  totalTOI: 600,
  timesOnLine: {},
  timesOnPair: {},
  percentToiWith: {},
  percentToiWithMixed: {},
  timeSpentWith: {},
  timeSpentWithMixed: {},
  GP: 1,
  timesPlayedWith: {},
  ATOI: "10:00",
  percentOfSeason: {},
  displayPosition: "C",
  comboPoints: 0,
};

const baseProps = {
  teamId: 22,
  teamName: "Edmonton Oilers",
  roster: [player],
  toiData: [],
  mode: "total-toi" as const,
  playerATOI: { 1: "10:00" },
  loading: false,
  lines: [],
  pairs: [],
};

describe("DateRangeMatrixView result states", () => {
  it("renders explicit loading, empty, and error messages", () => {
    const { rerender } = render(
      <DateRangeMatrixView {...baseProps} loading status="loading" />,
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Loading matrix data",
    );

    rerender(<DateRangeMatrixView {...baseProps} roster={[]} status="empty" />);
    expect(screen.getByRole("status").textContent).toContain(
      "No matrix data is available",
    );

    rerender(
      <DateRangeMatrixView
        {...baseProps}
        roster={[]}
        status="error"
        error="provider details stay hidden"
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Unable to load matrix data",
    );
    expect(screen.queryByText("provider details stay hidden")).toBeNull();
  });

  it("renders partial coverage alongside the matrix", () => {
    render(
      <DateRangeMatrixView
        {...baseProps}
        status="partial"
        source="aggregated"
        coverage={{ inputRows: 2, rosterRows: 1, skippedRows: 1 }}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain(
      "1 row was skipped",
    );
    expect(screen.getByTestId("matrix-renderer")).not.toBeNull();
  });
});
