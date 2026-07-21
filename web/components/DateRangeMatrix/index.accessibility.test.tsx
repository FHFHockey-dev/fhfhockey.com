import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DateRangeMatrixInternal } from "./index";
import type { PlayerData } from "./utilities";

afterEach(() => cleanup());

function player({
  id,
  name,
  totalTOI,
  ATOI,
  percentToiWith,
}: {
  id: number;
  name: string;
  totalTOI: number;
  ATOI: string;
  percentToiWith: Record<number, number>;
}): PlayerData {
  return {
    id,
    teamId: 22,
    franchiseId: 25,
    position: "C",
    name,
    playerAbbrevName: name,
    lastName: name.split(" ").slice(1).join(" "),
    totalTOI,
    timesOnLine: {},
    timesOnPair: {},
    percentToiWith,
    percentToiWithMixed: {},
    timeSpentWith: {},
    timeSpentWithMixed: {},
    GP: 2,
    timesPlayedWith: {},
    ATOI,
    percentOfSeason: {},
    displayPosition: "C",
    comboPoints: 0,
    mutualSharedToi: {},
    playerType: "F",
  };
}

function matrixPlayers() {
  const connor = player({
    id: 1,
    name: "Connor McDavid",
    totalTOI: 2_400,
    ATOI: "20:15",
    percentToiWith: { 2: 42.5 },
  });
  const leon = player({
    id: 2,
    name: "Leon Draisaitl",
    totalTOI: 2_200,
    ATOI: "18:45",
    percentToiWith: { 1: 42.5 },
  });
  return { connor, leon };
}

function matrixElement(roster: PlayerData[]) {
  return (
    <DateRangeMatrixInternal
      teamId={22}
      teamName="Edmonton Oilers"
      roster={roster}
      toiData={[]}
      mode="total-toi"
      homeAwayInfo={[]}
      playerATOI={Object.fromEntries(
        roster.map((candidate) => [candidate.id, candidate.ATOI]),
      )}
      loading={false}
      lines={[]}
      pairs={[]}
    />
  );
}

function renderMatrix(roster: PlayerData[]) {
  return render(matrixElement(roster));
}

describe("DateRangeMatrixInternal accessibility", () => {
  it("exposes a named grid with player headers, named cells, and equivalent value text", () => {
    const { connor, leon } = matrixPlayers();
    renderMatrix([leon, connor]);

    const grid = screen.getByRole("grid", {
      name: "Edmonton Oilers shared ice time matrix",
    });
    expect(grid.getAttribute("aria-rowcount")).toBe("3");
    expect(grid.getAttribute("aria-colcount")).toBe("3");
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(
      screen.getByRole("columnheader", { name: "Connor McDavid" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("rowheader", { name: "Leon Draisaitl" }),
    ).not.toBeNull();

    const selfCell = screen.getByRole("gridcell", {
      name: "Connor McDavid average time on ice",
    });
    const sharedCell = screen.getByRole("gridcell", {
      name: "Connor McDavid with Leon Draisaitl",
    });
    expect(screen.getAllByRole("gridcell")).toHaveLength(4);
    expect(
      document.getElementById(selfCell.getAttribute("aria-describedby") || "")
        ?.textContent,
    ).toBe("20:15 ATOI");
    expect(
      document.getElementById(sharedCell.getAttribute("aria-describedby") || "")
        ?.textContent,
    ).toBe("42.50% Shared Ice Time");

    fireEvent.pointerEnter(sharedCell);
    expect(
      screen.getByRole("columnheader", { name: "Leon Draisaitl" }).className,
    ).toContain("active");
    expect(
      screen.getByRole("rowheader", { name: "Connor McDavid" }).className,
    ).toContain("active");
    fireEvent.pointerLeave(sharedCell);
    expect(
      screen.getByRole("columnheader", { name: "Leon Draisaitl" }).className,
    ).not.toContain("active");
  });

  it("uses one roving tab stop and supports every arrow plus Home and End", () => {
    const { connor, leon } = matrixPlayers();
    renderMatrix([leon, connor]);

    const connorSelf = screen.getByRole("gridcell", {
      name: "Connor McDavid average time on ice",
    });
    const connorWithLeon = screen.getByRole("gridcell", {
      name: "Connor McDavid with Leon Draisaitl",
    });
    const leonWithConnor = screen.getByRole("gridcell", {
      name: "Leon Draisaitl with Connor McDavid",
    });
    const leonSelf = screen.getByRole("gridcell", {
      name: "Leon Draisaitl average time on ice",
    });

    expect(connorSelf.tabIndex).toBe(0);
    expect(
      screen.getAllByRole("gridcell").filter((cell) => cell.tabIndex === 0),
    ).toHaveLength(1);

    act(() => connorSelf.focus());
    expect(document.activeElement).toBe(connorSelf);
    expect(
      screen.getByRole("columnheader", { name: "Connor McDavid" }).className,
    ).toContain("active");
    expect(
      screen.getByRole("rowheader", { name: "Connor McDavid" }).className,
    ).toContain("active");

    fireEvent.keyDown(connorSelf, { key: "ArrowRight" });
    expect(document.activeElement).toBe(connorWithLeon);
    expect(connorWithLeon.tabIndex).toBe(0);
    expect(
      screen.getByRole("columnheader", { name: "Leon Draisaitl" }).className,
    ).toContain("active");
    expect(
      screen.getByRole("rowheader", { name: "Connor McDavid" }).className,
    ).toContain("active");

    fireEvent.keyDown(connorWithLeon, { key: "ArrowDown" });
    expect(document.activeElement).toBe(leonSelf);
    fireEvent.keyDown(leonSelf, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(leonWithConnor);
    fireEvent.keyDown(leonWithConnor, { key: "ArrowUp" });
    expect(document.activeElement).toBe(connorSelf);
    fireEvent.keyDown(connorSelf, { key: "End" });
    expect(document.activeElement).toBe(connorWithLeon);
    fireEvent.keyDown(connorWithLeon, { key: "Home" });
    expect(document.activeElement).toBe(connorSelf);
  });

  it("sorts total-TOI presentation without mutating caller roster order", () => {
    const { connor, leon } = matrixPlayers();
    const roster = [leon, connor];
    const originalOrder = roster.map(({ id }) => id);

    renderMatrix(roster);

    expect(roster.map(({ id }) => id)).toEqual(originalOrder);
    expect(screen.getAllByRole("rowheader")[0].getAttribute("aria-label")).toBe(
      "Connor McDavid",
    );
  });

  it("preserves the logical roving tab stop and keyboard focus across a TOI reorder", () => {
    const { connor, leon } = matrixPlayers();
    const { rerender } = renderMatrix([connor, leon]);
    const logicalCell = screen.getByRole("gridcell", {
      name: "Connor McDavid with Leon Draisaitl",
    });

    act(() => logicalCell.focus());
    expect(logicalCell.tabIndex).toBe(0);

    rerender(
      matrixElement([
        { ...connor, ATOI: "15:00" },
        { ...leon, ATOI: "25:00" },
      ]),
    );

    const reorderedLogicalCell = screen.getByRole("gridcell", {
      name: "Connor McDavid with Leon Draisaitl",
    });
    expect(document.activeElement).toBe(reorderedLogicalCell);
    expect(reorderedLogicalCell.tabIndex).toBe(0);
    expect(
      screen.getAllByRole("gridcell").filter((cell) => cell.tabIndex === 0),
    ).toHaveLength(1);

    fireEvent.keyDown(reorderedLogicalCell, { key: "ArrowRight" });
    expect(document.activeElement).toBe(
      screen.getByRole("gridcell", {
        name: "Connor McDavid average time on ice",
      }),
    );
  });

  it("announces unavailable self-cell ATOI without fabricating clock precision", () => {
    const { connor, leon } = matrixPlayers();
    connor.ATOI = "";
    leon.ATOI = "20:99";

    renderMatrix([connor, leon]);

    for (const name of ["Connor McDavid", "Leon Draisaitl"]) {
      const cell = screen.getByRole("gridcell", {
        name: `${name} average time on ice`,
      });
      expect(
        document.getElementById(cell.getAttribute("aria-describedby") || "")
          ?.textContent,
      ).toBe("N/A ATOI");
    }
  });
});
