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
  it("does not turn a zero-strength denominator into a zero-percent share", () => {
    const { connor, leon } = matrixPlayers();
    renderMatrix([{ ...connor, totalTOI: 0, ATOI: "00:00", percentToiWith: {} }, leon]);
    const cell = screen.getByRole("gridcell", { name: "Leon Draisaitl with Connor McDavid" });
    expect(document.getElementById(cell.getAttribute("aria-describedby")!)?.textContent)
      .toBe("Connor McDavid has no ice time in these games (all-strength).");
    expect(screen.getByRole("gridcell", { name: "Connor McDavid average time on ice" })).toBeTruthy();
  });

  it("orders Total TOI by cumulative seconds, with stable ties, rather than average time", () => {
    const regular = { ...player({ id: 1, name: "Regular Skater", totalTOI: 3600, ATOI: "12:00", percentToiWith: {} }), GP: 5 };
    const substitute = { ...player({ id: 2, name: "Substitute Skater", totalTOI: 1200, ATOI: "20:00", percentToiWith: {} }), GP: 1 };
    const tied = { ...regular, id: 3, name: "Tied Skater", playerAbbrevName: "Tied Skater" };
    const { rerender } = renderMatrix([substitute, tied, regular]);
    const headers = () => screen.getAllByRole("columnheader").map((header) => header.getAttribute("aria-label") ?? header.textContent);
    expect(headers()).toEqual(["Players", "Regular Skater", "Tied Skater", "Substitute Skater"]);
    rerender(matrixElement([tied, regular, substitute]));
    expect(headers()).toEqual(["Players", "Regular Skater", "Tied Skater", "Substitute Skater"]);
  });

  it("exposes a named grid with player headers, named cells, and equivalent value text", () => {
    const { connor, leon } = matrixPlayers();
    renderMatrix([leon, connor]);

    const grid = screen.getByRole("grid", {
      name: "Edmonton Oilers shared ice time matrix",
    });
    expect(grid.getAttribute("aria-rowcount")).toBe("3");
    expect(grid.getAttribute("aria-colcount")).toBe("3");
    expect(grid.style.gridTemplateRows).toContain(
      "minmax(var(--matrix-cell-min), 1fr)",
    );
    expect(grid.style.gridTemplateColumns).toContain(
      "minmax(var(--matrix-cell-min), 1fr)",
    );
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
    ).toBe("Connor McDavid: 20:15 average ice time per game (all-strength)");
    expect(
      document.getElementById(sharedCell.getAttribute("aria-describedby") || "")
        ?.textContent,
    ).toBe(
      "Connor McDavid shared 42.50% of Leon Draisaitl's ice time (all-strength)",
    );

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
        { ...connor, totalTOI: 1800, ATOI: "15:00" },
        { ...leon, totalTOI: 3000, ATOI: "25:00" },
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
      ).toBe(`${name}: average ice time per game not available (all-strength)`);
    }
  });

  it("scales cell shade to the largest shown share instead of saturating at 66.7% (W2-6 D8)", () => {
    const a = player({ id: 1, name: "Alpha One", totalTOI: 2_000, ATOI: "20:00", percentToiWith: { 2: 90, 3: 70 } });
    const b = player({ id: 2, name: "Beta Two", totalTOI: 2_000, ATOI: "20:00", percentToiWith: { 1: 90 } });
    const c = player({ id: 3, name: "Gamma Three", totalTOI: 2_000, ATOI: "20:00", percentToiWith: { 1: 70 } });
    renderMatrix([a, b, c]);
    const shade = (name: string) =>
      (screen.getByRole("gridcell", { name }).querySelector("[aria-hidden='true']") as HTMLElement)
        .style.opacity;
    // Column player Alpha: 90% with Beta, 70% with Gamma.
    expect(Number(shade("Beta Two with Alpha One"))).toBeCloseTo(1, 6);
    expect(Number(shade("Gamma Three with Alpha One"))).toBeCloseTo(70 / 90, 6);
  });
});
