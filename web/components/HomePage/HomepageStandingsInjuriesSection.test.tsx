import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import HomepageStandingsInjuriesSection, {
  buildHomepageTransactionTitle,
  buildHomepageInjuryUpdates,
} from "./HomepageStandingsInjuriesSection";
import styles from "styles/Home.module.scss";

vi.mock("components/common/OptimizedImage", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />
}));

describe("HomepageStandingsInjuriesSection", () => {
  it("keeps missing publication and original source unavailable in expanded updates", () => {
    render(<HomepageStandingsInjuriesSection standings={[]} injuries={[]} snapshotGeneratedAt={null} standingsError={null} injuriesError={null} recentTransactions={[{
      id: "synthetic-provenance", headline: "League update", blurb: "A source update.", category: "Source report", players: [], metadata: null,
      published_at: null, observed_at: "2026-07-14T18:19:20.000Z", created_at: "2026-07-24T20:30:49.000Z",
      source_account: "SOURCE_ACCOUNT", source_url: "not a URL", tweet_url: null,
    }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Expand update for Transaction source report" }));
    expect(screen.getByText("Published unavailable · Observed Jul 14, 2:19 PM · Source unavailable")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /View original post/ })).toBeNull();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("fits desktop pages to the standings height and keeps every update reachable", () => {
    let height = 986;
    let resize = () => {};
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { resize = callback; }
      observe() {}
      disconnect() {}
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return { top: 0, height: this.classList.contains(styles.standingsContainer) ? height : 0 } as DOMRect;
    });
    render(<HomepageStandingsInjuriesSection standings={[]} injuries={
      Array.from({ length: 45 }, (_, i) => ({ key: i, date: "2026-09-09", player: { displayName: `Update ${i + 1}` }, status: "Out" }))
    } snapshotGeneratedAt={null} standingsError={null} injuriesError={null} />);

    expect(screen.getByText("Update 20")).toBeTruthy();
    expect(screen.queryByText("Update 21")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Update 21")).toBeTruthy();
    expect(screen.getByText("Update 40")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Update 45")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(true);

    act(() => { height = 1466; resize(); });
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Update 30")).toBeTruthy();
    act(() => { height = 40; resize(); });
    expect(document.querySelector(`.${styles.injuriesContainer}`)?.getAttribute("style")).toContain("--updates-height: 74px");
    expect(screen.getByText("Update 1")).toBeTruthy();
    expect(screen.queryByText("Update 2")).toBeNull();
  });

  it("sorts standings by league rank and paginates injury rows", () => {
    const injuries = Array.from({ length: 33 }, (_, index) => ({
      date: "2026-04-09",
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

  it("opens on combined updates and keeps Transactions available", () => {
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
      screen.getByRole("tab", { name: "All updates" }).getAttribute(
        "aria-selected",
      ),
    ).toBe("true");
    expect(screen.getByText("Source report")).toBeTruthy();
    expect(screen.getByText("Source report").closest("tr")?.className).not.toContain(styles.injuredRow);
    expect(
      screen.getByRole("table", { name: /recent nhl transactions and injury updates/i }),
    ).toBeTruthy();
    expect(screen.getByText("Transaction source report")).toBeTruthy();
    const combinedRows = screen.getByRole("table", { name: /recent nhl transactions and injury updates/i }).querySelectorAll("tbody tr:not([hidden])");
    expect(combinedRows[0].textContent).toContain("Transaction source report");
    expect(combinedRows[0].className).toContain(styles.transactionRow);

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
    expect(screen.getByText("Returning").closest("tr")?.className).toContain(styles.returningRow);
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
            source_url: "https://x.com/Reporter/status/1",
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

    expect(screen.getByText("Source report")).toBeTruthy();
    expect(screen.getByText("Claim unavailable")).toBeTruthy();
    expect(
      screen.getAllByText("A lower-body injury has been reported."),
    ).toHaveLength(2);
    expect(
      screen
        .getByRole("link", {
          name: "View original post for Source report",
        })
        .getAttribute("href"),
    ).toBe("https://x.com/Reporter/status/1");
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
            category: "Source report",
            team_abbreviation: "ANA",
            published_at: "2026-07-15T01:00:00.000Z",
            source_url: "https://x.com/Reporter/status/2",
            players: [{ player_name: "Mason McTavish" }],
          },
        ]}
        snapshotGeneratedAt="2026-07-14T12:00:00.000Z"
        standingsError={null}
        injuriesError={null}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Transactions" }));

    expect(screen.getByText("Transaction source report")).toBeTruthy();
    const transactionTable = screen.getByRole("table", {
      name: /recent nhl transactions/i,
    });
    expect(within(transactionTable).getByText("7/14/26")).toBeTruthy();
    expect(screen.getByText("Source report")).toBeTruthy();
    expect(
      screen.getAllByText(
        "Mason McTavish and Anaheim are making progress on a contract extension.",
      ),
    ).toHaveLength(2);
    expect(
      screen
        .getByRole("link", {
          name: "View original post for Transaction source report",
        })
        .getAttribute("href"),
    ).toBe("https://x.com/Reporter/status/2");
  });

  it("does not bind the captured Barzal passage to its Kevin He injury join", () => {
    const rows = buildHomepageInjuryUpdates({ injuries: [], recentInjuryNews: [{
      id: "cac51da7-3f50-4109-b7b4-3ad80538f07f", headline: "Kevin He injury update", category: "INJURY",
      blurb: 'RT @AGrossNewsday: Mathew Barzal is with #Isles on trip, Pete DeBoer said he is attending all the meetings. Not on the ice yet but said to be "around the corner." So he won\'t play in the season opener tomorrow in Toronto.',
      metadata: null, players: [{ player_id: 8484864, player_name: "Kevin He" }], published_at: "2026-09-29T17:00:11.412Z",
    } as any] });
    expect(rows[0]).toMatchObject({ player: { id: null, displayName: "Source report" }, status: "Claim unavailable", statusState: "unknown" });
    expect(rows[0].description).toContain("Mathew Barzal");
  });

  it("keeps the captured cap-dependent Soucy signing neutral", () => {
    expect(buildHomepageTransactionTitle({ id: "4795b0c8-d119-4977-9b77-45e040224e25", headline: "Carson Soucy signing",
      category: "SIGNING", subcategory: "OFFICIAL SIGNING", players: [{ player_id: 8477369, player_name: "Carson Soucy" }],
      blurb: 'RT @mark_scheig: Don Waddell on Carson Soucy: "Our goal is to get him signed." DW said they need to determine where the cap space will come from. #CBJ',
    })).toBe("Transaction source report");
  });

  it("does not infer transaction completion or canonical subject from titles or joins", () => {
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
    ).toBe("Transaction source report");

    expect(
      buildHomepageTransactionTitle({
        headline:
          "The #SJSharks have signed Macklin Celebrini to a five-year contract extension.",
        blurb: "",
        category: "SIGNING",
        team_abbreviation: "SJS",
        players: [],
      }),
    ).toBe("Transaction source report");

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
    ).toBe("Transaction source report");
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
        index === 0 ? "https://x.com/Reporter/status/3" : null,
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
    expect(screen.getAllByText("Authoritative transaction detail 10.").length).toBeGreaterThan(0);
    expect(screen.queryByText("Authoritative transaction detail 11.")).toBeNull();
    expect(screen.getByAltText("NHL logo")).toBeTruthy();

    const sourceLink = screen.getByRole("link", {
      name: "View original post for Transaction source report",
    });
    fireEvent.click(sourceLink);
    expect(
      screen
        .getAllByRole("button", { name: "Expand update for Transaction source report" })[0]
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

    const firstExpand = within(screen.getAllByText("First transaction detail")[0].closest("tr")!).getByRole("button", { name: "Expand update for Transaction source report" });
    const secondExpand = within(screen.getAllByText("Second transaction detail")[0].closest("tr")!).getByRole("button", { name: "Expand update for Transaction source report" });
    expect(firstExpand.getAttribute("aria-expanded")).toBe("false");
    const firstDetailsId = firstExpand.getAttribute("aria-controls") ?? "";
    expect(document.getElementById(firstDetailsId)).toBeTruthy();
    expect(document.getElementById(firstDetailsId)?.hidden).toBe(true);

    fireEvent.click(firstExpand);
    expect(
      firstExpand.getAttribute("aria-expanded"),
    ).toBe("true");
    expect(document.getElementById(firstDetailsId)?.hidden).toBe(false);
    expect(
      within(document.getElementById(firstDetailsId) as HTMLElement).getByText(
        "First transaction detail",
      ),
    ).toBeTruthy();

    fireEvent.click(secondExpand);
    expect(
      firstExpand.getAttribute("aria-expanded"),
    ).toBe("false");
    expect(
      secondExpand.getAttribute("aria-expanded"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("tab", { name: "Injuries" }));
    fireEvent.click(screen.getByRole("tab", { name: "Transactions" }));
    expect(
      screen.getAllByRole("button", { name: "Expand update for Transaction source report" })[0].getAttribute("aria-expanded"),
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
