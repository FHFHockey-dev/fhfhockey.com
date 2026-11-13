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
  it("does not suggest another layout when every game was excluded", () => {
    render(<DateRangeMatrixView {...baseProps} roster={[]} status="partial" source="aggregated"
      coverage={{ inputRows: 0, rosterRows: 0, skippedRows: 0 }} />);
    expect(screen.getByRole("status").textContent).toContain("No games in this range have full shift data yet");
    expect(screen.getByRole("status").textContent).toContain("check back after tonight's update");
    expect(screen.queryByTestId("matrix-renderer")).toBeNull();
    expect(screen.queryByText(/Partial data/)).toBeNull();
  });

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

  it("hides the skipped-row diagnostic in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    try {
      const { default: ProductionView } = await import("./DateRangeMatrixView");
      render(
        <ProductionView
          {...baseProps}
          status="partial"
          source="aggregated"
          coverage={{ inputRows: 2, rosterRows: 1, skippedRows: 1 }}
        />,
      );
      expect(screen.getByRole("status").textContent).toBe("Partial data: some games in this range aren't included yet.");
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
