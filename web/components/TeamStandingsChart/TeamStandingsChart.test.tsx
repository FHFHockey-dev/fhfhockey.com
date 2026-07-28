import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { teamsInfo } from "lib/teamsInfo";
import TeamStandingsChart from "./TeamStandingsChart";

const supabaseMock = vi.hoisted(() => ({
  rowsByTable: {} as Record<string, any[]>,
  ranges: [] as Array<{ table: string; start: number; end: number }>,
}));
const seasonMock = vi.hoisted(() => ({
  seasonId: 20252026,
  regularSeasonStartDate: "2025-10-01",
  regularSeasonEndDate: "2026-04-30",
}));

vi.mock("hooks/useCurrentSeason", () => ({
  default: () => seasonMock,
}));

vi.mock("hooks/useResizeObserver", () => ({
  default: () => ({ width: 430, height: 240 }),
}));

vi.mock("components/common/OptimizedImage", () => ({
  default: ({ alt, className }: any) => (
    <span role="img" aria-label={alt} className={className} />
  ),
}));

vi.mock("lib/supabase/public-client", () => ({
  default: {
    from: (table: string) => {
      const query: Record<string, any> = {};
      query.select = () => query;
      query.gte = () => query;
      query.lte = () => query;
      query.order = () => query;
      query.range = async (start: number, end: number) => {
        supabaseMock.ranges.push({ table, start, end });
        return {
          data: (supabaseMock.rowsByTable[table] ?? []).slice(start, end + 1),
          error: null,
        };
      };
      return query;
    },
  },
}));

const divisions: Record<string, string[]> = {
  Atlantic: ["BOS", "BUF", "DET", "FLA", "MTL", "OTT", "TBL", "TOR"],
  Metropolitan: ["CAR", "CBJ", "NJD", "NYI", "NYR", "PHI", "PIT", "WSH"],
  Central: ["CHI", "COL", "DAL", "MIN", "NSH", "STL", "UTA", "WPG"],
  Pacific: ["ANA", "CGY", "EDM", "LAK", "SEA", "SJS", "VAN", "VGK"],
};

function buildStandingsRows() {
  const rows: any[] = [];
  for (let gamesPlayed = 0; gamesPlayed <= 82; gamesPlayed += 1) {
    const date = new Date(Date.UTC(2025, 9, 1 + gamesPlayed))
      .toISOString()
      .slice(0, 10);
    for (const [division, teams] of Object.entries(divisions)) {
      for (const abbreviation of teams) {
        rows.push({
          date,
          team_name_default: teamsInfo[abbreviation].name,
          games_played: gamesPlayed,
          point_pctg: 0.5,
          points: gamesPlayed,
          goal_against: gamesPlayed * 3,
          goal_for: gamesPlayed * 3,
          conference_abbrev:
            division === "Atlantic" || division === "Metropolitan" ? "E" : "W",
          division_name: division,
        });
      }
    }
  }
  return rows;
}

describe("TeamStandingsChart compact controls", () => {
  beforeEach(() => {
    supabaseMock.rowsByTable = {
      nhl_standings_details: buildStandingsRows(),
      wgo_team_stats: [],
    };
    supabaseMock.ranges = [];
  });

  it("renders every division and team, supports bulk selection, and reaches game 82", async () => {
    const { container } = render(<TeamStandingsChart compact />);

    const teamControls = await screen.findAllByRole("checkbox");
    expect(teamControls).toHaveLength(32);
    expect(teamControls.every((control) => (control as HTMLInputElement).checked))
      .toBe(true);

    expect(
      Array.from(container.querySelectorAll("strong")).map((node) =>
        node.textContent?.trim(),
      ),
    ).toEqual(
      expect.arrayContaining(["Atlantic", "Metro", "Central", "Pacific"]),
    );
    expect(screen.getAllByRole("combobox")).toHaveLength(3);

    await waitFor(() => {
      expect(container.querySelector("svg")?.textContent).toContain("82");
      expect(container.querySelector("svg")?.textContent).toContain(
        "Games Played",
      );
    });
    expect(container.querySelector("svg")?.getAttribute("width")).toBe("430");
    expect(container.querySelector("svg")?.getAttribute("height")).toBe("240");

    fireEvent.click(screen.getByRole("button", { name: "Clear All" }));
    await waitFor(() => {
      expect(
        screen
          .getAllByRole("checkbox")
          .every((control) => !(control as HTMLInputElement).checked),
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: "Select All" }));
    await waitFor(() => {
      expect(
        screen
          .getAllByRole("checkbox")
        .every((control) => (control as HTMLInputElement).checked),
      ).toBe(true);
    });

    const chartPoint = await waitFor(() => {
      const point = container.querySelector("circle");
      expect(point).toBeTruthy();
      return point as SVGCircleElement;
    });
    fireEvent.mouseOver(chartPoint);
    await waitFor(() => {
      expect(container.textContent).toContain("GP:");
    });

    const conferenceSelect = screen.getByRole("combobox", {
      name: "Conference",
    }) as HTMLSelectElement;
    const divisionSelect = screen.getByRole("combobox", {
      name: "Division",
    }) as HTMLSelectElement;
    expect(
      Array.from(conferenceSelect.options).map((option) => option.textContent),
    ).toEqual(["All", "Eastern", "Western"]);
    expect(
      Array.from(divisionSelect.options).map((option) => option.textContent),
    ).toEqual(["All", "Atlantic", "Metropolitan", "Central", "Pacific"]);

    fireEvent.change(conferenceSelect, { target: { value: "E" } });
    await waitFor(() => {
      expect(screen.getAllByRole("checkbox")).toHaveLength(16);
    });

    fireEvent.change(divisionSelect, { target: { value: "Atlantic" } });
    await waitFor(() => {
      expect(screen.getAllByRole("checkbox")).toHaveLength(8);
    });

    expect(
      supabaseMock.ranges
        .filter(({ table }) => table === "nhl_standings_details")
        .map(({ start }) => start),
    ).toEqual([0, 1000, 2000]);
  });
});
