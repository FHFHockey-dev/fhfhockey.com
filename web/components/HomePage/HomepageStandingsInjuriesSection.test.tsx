import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HomepageStandingsInjuriesSection from "./HomepageStandingsInjuriesSection";

vi.mock("components/common/OptimizedImage", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />
}));

describe("HomepageStandingsInjuriesSection", () => {
  it("sorts standings by league rank and paginates injury rows", () => {
    const injuries = Array.from({ length: 33 }, (_, index) => ({
      date: `2026-04-${String((index % 9) + 1).padStart(2, "0")}`,
      team: "BOS",
      player: { displayName: `Player ${index + 1}` },
      status: "Out",
      description: "Lower body"
    }));

    render(
      <HomepageStandingsInjuriesSection
        standings={[
          {
            leagueSequence: 2,
            teamName: "Team B",
            wins: 40,
            losses: 20,
            otLosses: 5,
            points: 85,
            teamLogo: "/logos/b.svg"
          },
          {
            leagueSequence: 1,
            teamName: "Team A",
            wins: 42,
            losses: 18,
            otLosses: 4,
            points: 88,
            teamLogo: "/logos/a.svg"
          }
        ]}
        injuries={injuries}
        snapshotGeneratedAt="2026-04-08T12:00:00.000Z"
        standingsError={null}
        injuriesError={null}
      />
    );

    const standingsTable = screen.getByRole("table", { name: /nhl league standings/i });
    const standingsRows = within(standingsTable).getAllByRole("row");
    expect(within(standingsRows[1]).getByText("1")).toBeTruthy();
    expect(within(standingsRows[1]).getByText("Team A")).toBeTruthy();

    expect(screen.getByText("Player 1")).toBeTruthy();
    expect(screen.queryByText("Player 33")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByText("Player 33")).toBeTruthy();
    expect(screen.queryByText("Player 1")).toBeNull();
  });

  it("shows structured status messaging when upstream standings data fails", () => {
    render(
      <HomepageStandingsInjuriesSection
        standings={[]}
        injuries={[]}
        snapshotGeneratedAt="2026-04-08T12:00:00.000Z"
        standingsError="Standings are unavailable right now."
        injuriesError={null}
      />
    );

    expect(screen.getByText("Standings are unavailable right now.")).toBeTruthy();
  });

  it("renders returning player statuses distinctly", () => {
    render(
      <HomepageStandingsInjuriesSection
        standings={[]}
        injuries={[
          {
            date: "2026-04-22",
            team: "TBL",
            player: { id: 7, displayName: "Andrei Vasilevskiy" },
            status: "Returning",
            description: "No longer listed on the injury report.",
            statusState: "returning"
          }
        ]}
        snapshotGeneratedAt="2026-04-22T12:00:00.000Z"
        standingsError={null}
        injuriesError={null}
      />
    );

    expect(screen.getByText("Returning")).toBeTruthy();
    expect(screen.getByText("No longer listed on the injury report.")).toBeTruthy();
  });
});
