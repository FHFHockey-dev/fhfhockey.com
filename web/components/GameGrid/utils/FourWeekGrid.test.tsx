import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TeamDataWithTotals } from "lib/NHL/types";
import FourWeekGrid from "./FourWeekGrid";

vi.mock("hooks/useTeams", () => ({
  useTeamsMap: () => ({
    1: { id: 1, name: "Alpha", abbreviation: "ALP", logo: "/alpha.png" },
    2: { id: 2, name: "Beta", abbreviation: "BET", logo: "/beta.png" },
  }),
}));

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

const teams: TeamDataWithTotals[] = [
  {
    teamId: 1,
    teamAbbreviation: "ALP",
    weeks: [
      {
        weekNumber: 1,
        gamesPlayed: 3,
        offNights: 2,
        opponents: [{ abbreviation: "BOS", teamId: 6 }],
      },
      {
        weekNumber: 2,
        gamesPlayed: 4,
        offNights: 1,
        opponents: [{ abbreviation: "NYR", teamId: 3 }],
      },
    ],
    totals: {
      gamesPlayed: 7,
      offNights: 3,
      opponents: [
        { abbreviation: "BOS", teamId: 6 },
        { abbreviation: "NYR", teamId: 3 },
      ],
    },
    avgOpponentPointPct: 0.55,
  },
  {
    teamId: 2,
    teamAbbreviation: "BET",
    weeks: [
      {
        weekNumber: 1,
        gamesPlayed: 2,
        offNights: 0,
        opponents: [{ abbreviation: "TOR", teamId: 10 }],
      },
      { weekNumber: 2, gamesPlayed: 0, offNights: 0, opponents: [], scheduleCoverage: { known: 7, expected: 7 } },
    ],
    totals: {
      gamesPlayed: 2,
      offNights: 0,
      opponents: [{ abbreviation: "TOR", teamId: 10 }],
    },
    avgOpponentPointPct: 0.48,
  },
];

describe("FourWeekGrid", () => {
  it("keeps scope and color definitions in a closed native info disclosure, with concise partial-data warnings", () => {
    const partial = { ...teams[0], totals: { ...teams[0].totals, scheduleCoverage: { known: 21, expected: 28 } } };
    const { container } = render(<FourWeekGrid teamDataArray={[partial]} calendar={{ start: "2026-10-05", end: "2026-11-01", knownDays: 21, expectedDays: 28, error: null }} />);
    const info = container.querySelector("details")!;
    expect(info).toBeTruthy();
    expect(info.hasAttribute("open")).toBe(false);
    expect(info.querySelector("summary")?.getAttribute("aria-label")).toBe("Info about four-week forecast");
    expect(info.textContent).toContain("2026-10-05–2026-11-01");
    expect(info.textContent).toContain("Lower OPP% is favorable");
    expect(screen.getByRole("status").textContent).toContain("Schedule incomplete");
    expect(Array.from(container.querySelectorAll("p")).filter((p) => !p.closest("details"))).toHaveLength(0);
    expect(container.textContent).not.toMatch(/\d+\s*\/\s*\d+\s+days/);
  });
  it("keeps production summary cells on one line with no diagnostic counters", () => {
    vi.stubEnv("NODE_ENV", "production");
    const data = teams.map((team) => ({ ...team, opponentCoverage: { known: 1, expected: 2 } }));
    const { container } = render(<FourWeekGrid teamDataArray={data} />);
    expect(container.querySelectorAll("tbody small")).toHaveLength(0);
    const alpha = screen.getByRole("link", { name: "Open Alpha Team HQ" }).closest("tr")!;
    const beta = screen.getByRole("link", { name: "Open Beta Team HQ" }).closest("tr")!;
    expect(alpha.cells[1].getAttribute("data-favorability")).toBe("high");
    expect(beta.cells[3].getAttribute("data-favorability")).toBe("high");
    fireEvent.click(screen.getByRole("button", { name: /Sort by Games Played descending/ }));
    expect(alpha.cells[1].getAttribute("data-favorability")).toBe("high");
  });
  it("keeps summary totals and the AVG score unavailable for incomplete calendars", () => {
    const partial = {
      ...teams[0],
      totals: { ...teams[0].totals, scheduleCoverage: { known: 21, expected: 28 } },
      avgOpponentPointPct: null,
    };
    render(<FourWeekGrid teamDataArray={[partial]} />);
    const averages = screen.getByText("AVG:").closest("tr")!;
    expect(Array.from(averages.cells).slice(1).map((cell) => cell.textContent)).toEqual(["-", "-", "-", "-"]);
    const row = screen.getByRole("link", { name: "Open Alpha Team HQ" }).closest("tr")!;
    expect(Array.from(row.cells).slice(1).map((cell) => cell.textContent)).toEqual(["-", "-", "-", "-"]);
  });

  it("shows uncovered weeks as unavailable and gives unknown standings no favorable score credit", () => {
    const known = { ...teams[0], avgOpponentPointPct: 0.5 };
    const unknown = {
      ...teams[1], totals: known.totals, avgOpponentPointPct: null,
      weeks: [
        { weekNumber: 1, gamesPlayed: 0, offNights: 0, opponents: [], scheduleCoverage: { known: 0, expected: 7 } },
        { weekNumber: 2, gamesPlayed: 1, offNights: 0, opponents: [{ abbreviation: "TOR", teamId: 10 }], scheduleCoverage: { known: 3, expected: 7 } },
      ]
    };
    render(<FourWeekGrid teamDataArray={[known, unknown]} />);
    const row = screen.getByRole("link", { name: "Open Beta Team HQ" }).closest("tr")!;
    expect(row.cells[3].textContent).toBe("-");
    expect(row.cells[4].textContent).toBe("0.00");
    fireEvent.click(screen.getByRole("tab", { name: "Weekly Detail" }));
    expect(screen.getAllByText("Schedule unavailable").length).toBeGreaterThan(0);
    expect(screen.getByText("Schedule partial")).toBeTruthy();
    expect(screen.queryByText(/\d+\s*\/\s*\d+\s+days/)).toBeNull();
    expect(screen.getByText("TOR")).toBeTruthy();
    expect(screen.queryByText("No games")).toBeNull();
  });

  afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1200,
    });
  });

  it("keeps the familiar summary as default and reveals weekly volume/opponents", () => {
    render(<FourWeekGrid teamDataArray={teams} />);

    expect(
      screen
        .getByRole("tab", { name: "4W Summary" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: /Sort by Games Played/ }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Open Alpha Team HQ" })
        .getAttribute("href"),
    ).toBe("/stats/team/ALP");

    fireEvent.click(screen.getByRole("tab", { name: "Weekly Detail" }));

    expect(
      screen
        .getByRole("tab", { name: "Weekly Detail" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByRole("columnheader", { name: "W1" })).toBeTruthy();
    expect(screen.getByText("BOS")).toBeTruthy();
    expect(screen.getByText("No games")).toBeTruthy();
  });

  it("preserves summary sorting when users inspect the alternate tab", () => {
    render(<FourWeekGrid teamDataArray={teams} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Sort by Games Played descending/ }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Weekly Detail" }));
    fireEvent.click(screen.getByRole("tab", { name: "4W Summary" }));

    expect(
      screen.getByRole("button", { name: /Sort by Games Played ascending/ }),
    ).toBeTruthy();
  });
});
