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
  afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
  beforeEach(() => Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 }));
  it("moves the warning into the footer and removes it when coverage completes", () => {
    render(<div data-testid="warning-footer" />);
    const footer = screen.getByTestId("warning-footer");
    const calendar = { start: "2026-10-05", end: "2026-11-01", knownDays: 21, expectedDays: 28, error: null };
    const { container, rerender } = render(<FourWeekGrid teamDataArray={teams} calendar={calendar} warningTarget={footer} />);
    expect(footer.textContent).toBe("Schedule incomplete. Affected totals are unavailable; check back after schedule updates.");
    expect(footer.querySelector('[role="status"]')?.getAttribute("aria-atomic")).toBe("true");
    expect(container.querySelector('[role="status"]')).toBeNull();
    rerender(<FourWeekGrid teamDataArray={teams.map((team) => ({ ...team, totals: { ...team.totals, scheduleCoverage: { known: 28, expected: 28 } } }))} calendar={{ ...calendar, knownDays: 28 }} warningTarget={footer} />);
    expect(footer.childElementCount).toBe(0);
    rerender(<FourWeekGrid teamDataArray={teams} calendar={{ ...calendar, error: "fixture error" }} warningTarget={footer} />);
    expect(footer.textContent).toBe("Schedule unavailable. Reload to retry.");
  });
  it("starts compact, retains HQ links and exposes the heuristic in closed Info", () => {
    const { container } = render(<FourWeekGrid teamDataArray={teams} />);
    expect(screen.queryByRole("tab", { name: "Weekly Detail" })).toBeNull();
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Open Alpha Team HQ" }).getAttribute("href")).toBe("/stats/team/ALP");
    const info = container.querySelector("details")!;
    expect(info.hasAttribute("open")).toBe(false);
    expect(info.textContent).toContain("remaining team games + 0.25 × off-night games");
    expect(info.textContent).toContain("shared scale");
  });
  it("treats absent coverage and score as unavailable, and shows four weekly slots", () => {
    render(<FourWeekGrid teamDataArray={teams} />);
    fireEvent.click(screen.getByRole("button", { name: "Expand four-week columns" }));
    const alpha = screen.getByRole("link", { name: "Open Alpha Team HQ" }).closest("tr")!;
    expect(Array.from(alpha.cells).slice(1, 4).map((cell) => cell.textContent)).toEqual(["—", "—", "—"]);
    fireEvent.click(screen.getByRole("tab", { name: "Weekly Detail" }));
    expect(screen.getByRole("columnheader", { name: "W4" })).toBeTruthy();
    expect(screen.getAllByText("Schedule unavailable").length).toBeGreaterThan(0);
    expect(screen.getByText("BOS")).toBeTruthy();
    expect(screen.getByText("No remaining games")).toBeTruthy();
  });
  it("preserves sorting through expansion and collapse", () => {
    render(<FourWeekGrid teamDataArray={teams} />);
    fireEvent.click(screen.getByRole("button", { name: "Sort by Team" }));
    expect(screen.getAllByRole("link")[0].getAttribute("href")).toBe("/stats/team/BET");
    fireEvent.click(screen.getByRole("button", { name: "Expand four-week columns" }));
    fireEvent.click(screen.getByRole("tab", { name: "Weekly Detail" }));
    fireEvent.click(screen.getByRole("button", { name: "Collapse four-week columns" }));
    expect(screen.getAllByRole("link")[0].getAttribute("href")).toBe("/stats/team/BET");
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
  });
});
