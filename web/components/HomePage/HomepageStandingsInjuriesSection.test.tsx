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

  it("renders published NewsFeed injury items in the injuries tab", () => {
    render(
      <HomepageStandingsInjuriesSection
        standings={[]}
        injuries={[]}
        recentInjuryNews={[
          {
            id: "news-1",
            headline: "Connor Bedard reported injury",
            blurb: "A lower-body injury has been reported.",
            category: "REPORTED INJURY",
            subcategory: "AWAITING OFFICIAL CONFIRMATION",
            team_abbreviation: "CHI",
            source_url: "https://x.com/OriginalReporter/status/1",
            published_at: "2026-07-14T12:00:00.000Z",
            created_at: "2026-07-14T12:00:00.000Z",
            players: [
              {
                player_id: 1,
                player_name: "Connor Bedard",
              },
            ],
          } as any,
        ]}
        snapshotGeneratedAt="2026-07-14T12:00:00.000Z"
        standingsError={null}
        injuriesError={null}
      />,
    );

    expect(screen.getByText("Connor Bedard")).toBeTruthy();
    expect(screen.getByText("Awaiting Official Confirmation")).toBeTruthy();
    expect(screen.getByText("A lower-body injury has been reported.")).toBeTruthy();
    expect(
      screen
        .getByRole("link", {
          name: "View original post for Connor Bedard",
        })
        .getAttribute("href"),
    ).toBe("https://x.com/OriginalReporter/status/1");
  });

  it("renders News Update items in the transactions tab", () => {
    render(
      <HomepageStandingsInjuriesSection
        standings={[]}
        injuries={[]}
        recentTransactions={[
          {
            id: "news-2",
            headline: "Mason McTavish extension update",
            blurb:
              "Mason McTavish and Anaheim are making progress on a contract extension.",
            category: "NEWS UPDATE",
            team_abbreviation: "ANA",
            published_at: "2026-07-15T01:00:00.000Z",
            source_url: "https://x.com/OriginalReporter/status/2",
            players: [{ player_name: "Mason McTavish" }],
          },
        ]}
        snapshotGeneratedAt="2026-07-14T12:00:00.000Z"
        standingsError={null}
        injuriesError={null}
      />,
    );

    expect(screen.getByText("Mason McTavish")).toBeTruthy();
    const transactionTable = screen.getByRole("table", {
      name: /recent nhl transactions/i,
    });
    expect(within(transactionTable).getByText("7/14/26")).toBeTruthy();
    expect(screen.getByText("NEWS UPDATE")).toBeTruthy();
    expect(
      screen.getByText(
        "Mason McTavish and Anaheim are making progress on a contract extension.",
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", {
          name: "View original post for Mason McTavish",
        })
        .getAttribute("href"),
    ).toBe("https://x.com/OriginalReporter/status/2");
  });
});
