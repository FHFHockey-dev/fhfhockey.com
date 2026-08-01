import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import HomepageStandingsInjuriesSection, {
  buildHomepageTransactionTitle,
} from "./HomepageStandingsInjuriesSection";

vi.mock("components/common/OptimizedImage", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />
}));

describe("HomepageStandingsInjuriesSection", () => {
  afterEach(() => {
    cleanup();
  });

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
    expect(screen.getByText("Player 10")).toBeTruthy();
    expect(screen.queryByText("Player 11")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByText("Player 11")).toBeTruthy();
    expect(screen.queryByText("Player 1")).toBeNull();
  });

  it("opens on Injuries and keeps Transactions available", () => {
    render(
      <HomepageStandingsInjuriesSection
        standings={[]}
        injuries={[
          {
            key: "injury-default",
            date: "2026-07-14",
            team: "CHI",
            player: { displayName: "Connor Bedard" },
            status: "Out",
            description: "Injury detail",
          },
        ]}
        recentTransactions={[
          {
            id: "transaction-default",
            headline: "Boston signing",
            blurb: "Boston completed a signing.",
            category: "SIGNING",
            team_abbreviation: "BOS",
            published_at: "2026-07-14T12:00:00.000Z",
            players: [{ player_name: "Player One" }],
          },
        ]}
        snapshotGeneratedAt="2026-07-14T12:00:00.000Z"
        standingsError={null}
        injuriesError={null}
      />,
    );

    expect(
      screen.getByRole("tab", { name: "Injuries" }).getAttribute(
        "aria-selected",
      ),
    ).toBe("true");
    expect(screen.getByText("Connor Bedard")).toBeTruthy();
    expect(
      screen.queryByRole("table", { name: /recent nhl transactions/i }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Transactions" }));
    expect(
      screen.getByRole("tab", { name: "Transactions" }).getAttribute(
        "aria-selected",
      ),
    ).toBe("true");
    expect(
      screen.getByRole("table", { name: /recent nhl transactions/i }),
    ).toBeTruthy();
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
    expect(
      screen.getAllByText("No longer listed on the injury report."),
    ).toHaveLength(2);
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
    expect(
      screen.getAllByText("A lower-body injury has been reported."),
    ).toHaveLength(2);
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

    fireEvent.click(screen.getByRole("tab", { name: "Transactions" }));

    expect(screen.getByText("M. McTavish extension")).toBeTruthy();
    const transactionTable = screen.getByRole("table", {
      name: /recent nhl transactions/i,
    });
    expect(within(transactionTable).getByText("7/14/26")).toBeTruthy();
    expect(screen.getByText("NEWS UPDATE")).toBeTruthy();
    expect(
      screen.getAllByText(
        "Mason McTavish and Anaheim are making progress on a contract extension.",
      ),
    ).toHaveLength(2);
    expect(
      screen
        .getByRole("link", {
          name: "View original post for M. McTavish extension",
        })
        .getAttribute("href"),
    ).toBe("https://x.com/OriginalReporter/status/2");
  });

  it("derives concise player actions and preserves authoritative fallbacks", () => {
    expect(
      buildHomepageTransactionTitle({
        headline: "SJS signing",
        blurb:
          "Macklin Celebrini signed a five-year contract extension with San Jose.",
        category: "SIGNING",
        subcategory: null,
        team_abbreviation: "SJS",
        metadata: null,
        players: [{ player_name: "Macklin Celebrini" }],
      }),
    ).toBe("M. Celebrini extension");

    expect(
      buildHomepageTransactionTitle({
        headline:
          "The #SJSharks have signed Macklin Celebrini to a five-year contract extension.",
        blurb: "",
        category: "SIGNING",
        team_abbreviation: "SJS",
        players: [],
      }),
    ).toBe("M. Celebrini extension");

    expect(
      buildHomepageTransactionTitle({
        headline: "Official roster announcement",
        blurb: "",
        category: "ROSTER MOVE",
        subcategory: null,
        team_abbreviation: "NHL",
        metadata: null,
        players: [],
      }),
    ).toBe("Official roster announcement");
  });

  it("limits the homepage feed and keeps source actions independent", () => {
    const recentTransactions = Array.from({ length: 12 }, (_, index) => ({
      id: `transaction-${index + 1}`,
      headline: `Transaction ${index + 1}`,
      blurb: `Authoritative transaction detail ${index + 1}.`,
      category: "SIGNING",
      team_abbreviation: index === 0 ? null : "BOS",
      published_at: "2026-07-14T12:00:00.000Z",
      source_url:
        index === 0 ? "https://x.com/OriginalReporter/status/3" : null,
      players: [{ player_name: `Player ${index + 1}` }],
    }));

    render(
      <HomepageStandingsInjuriesSection
        standings={[]}
        injuries={[]}
        recentTransactions={recentTransactions}
        snapshotGeneratedAt="2026-07-14T12:00:00.000Z"
        standingsError={null}
        injuriesError={null}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Transactions" }));

    const disclosureButtons = screen
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("aria-expanded"));
    expect(disclosureButtons).toHaveLength(10);
    disclosureButtons.forEach((button) => {
      expect(button.getAttribute("aria-expanded")).toBe("false");
      expect(button.textContent).toContain("+");
    });
    expect(screen.getByText("P. 10 signing")).toBeTruthy();
    expect(screen.queryByText("P. 11 signing")).toBeNull();
    expect(screen.getByAltText("NHL logo")).toBeTruthy();

    const sourceLink = screen.getByRole("link", {
      name: "View original post for P. 1 signing",
    });
    fireEvent.click(sourceLink);
    expect(
      screen
        .getByRole("button", { name: "Expand update for P. 1 signing" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(
      screen.getAllByRole("link", { name: /view original post/i }),
    ).toHaveLength(1);
  });

  it("expands one mobile update at a time and resets expansion on tab changes", () => {
    render(
      <HomepageStandingsInjuriesSection
        standings={[]}
        injuries={[
          {
            key: "injury-1",
            date: "2026-07-14",
            team: "CHI",
            player: { displayName: "Connor Bedard" },
            status: "Out",
            description: "Injury detail",
          },
        ]}
        recentTransactions={[
          {
            id: "transaction-1",
            headline: "First transaction",
            blurb: "First transaction detail",
            category: "SIGNING",
            team_abbreviation: "BOS",
            published_at: "2026-07-14T12:00:00.000Z",
            players: [{ player_name: "Player One" }],
          },
          {
            id: "transaction-2",
            headline: "Second transaction",
            blurb: "Second transaction detail",
            category: "TRADE",
            team_abbreviation: "NYR",
            published_at: "2026-07-14T13:00:00.000Z",
            players: [{ player_name: "Player Two" }],
          },
        ]}
        snapshotGeneratedAt="2026-07-14T12:00:00.000Z"
        standingsError={null}
        injuriesError={null}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Transactions" }));

    const firstExpand = screen.getByRole("button", {
      name: "Expand update for P. One signing",
    });
    const secondExpand = screen.getByRole("button", {
      name: "Expand update for P. Two trade",
    });
    expect(firstExpand.getAttribute("aria-expanded")).toBe("false");
    const firstDetailsId = firstExpand.getAttribute("aria-controls") ?? "";
    expect(document.getElementById(firstDetailsId)).toBeTruthy();
    expect(document.getElementById(firstDetailsId)?.hidden).toBe(true);

    fireEvent.click(firstExpand);
    expect(
      screen.getByRole("button", {
        name: "Collapse update for P. One signing",
      }).getAttribute("aria-expanded"),
    ).toBe("true");
    expect(document.getElementById(firstDetailsId)?.hidden).toBe(false);
    expect(
      within(document.getElementById(firstDetailsId) as HTMLElement).getByText(
        "First transaction detail",
      ),
    ).toBeTruthy();

    fireEvent.click(secondExpand);
    expect(
      screen.getByRole("button", {
        name: "Expand update for P. One signing",
      }).getAttribute("aria-expanded"),
    ).toBe("false");
    expect(
      screen.getByRole("button", {
        name: "Collapse update for P. Two trade",
      }).getAttribute("aria-expanded"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("tab", { name: "Injuries" }));
    fireEvent.click(screen.getByRole("tab", { name: "Transactions" }));
    expect(
      screen.getByRole("button", {
        name: "Expand update for P. Two trade",
      }).getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("renders all 32 standings rows with the complete mobile column set", () => {
    const standings = Array.from({ length: 32 }, (_, index) => ({
      leagueSequence: index + 1,
      teamName: `Team ${index + 1}`,
      teamAbbreviation: `T${index + 1}`,
      gamesPlayed: 82,
      wins: 40,
      losses: 30,
      otLosses: 12,
      points: 92,
      pointPercentage: 0.561,
      streak: "W2",
      teamLogo: `/logos/${index + 1}.svg`,
    }));

    render(
      <HomepageStandingsInjuriesSection
        standings={standings}
        injuries={[]}
        snapshotGeneratedAt="2026-07-14T12:00:00.000Z"
        standingsError={null}
        injuriesError={null}
      />,
    );

    const table = screen.getByRole("table", {
      name: /nhl league standings/i,
    });
    expect(within(table).getAllByRole("row")).toHaveLength(33);
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["#", "Team", "GP", "W", "L", "OTL", "PTS", "P%", "STRK"]);
  });
});
