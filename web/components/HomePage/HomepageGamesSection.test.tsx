import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import HomepageGamesSection from "./HomepageGamesSection";

vi.mock("next/link", () => ({
  default: ({ href, className, children, ...props }: any) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ priority, fill: _fill, ...props }: any) =>
    createElement("img", {
      ...props,
      loading: props.loading ?? (priority ? "eager" : "lazy"),
    }),
}));

const makeGames = (count: number, states: string[] = []) =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    gameState: states[index] ?? "FUT",
    startTimeUTC: `2026-10-10T${String(20 + (index % 3)).padStart(2, "0")}:00:00Z`,
    homeTeam: { abbrev: "BOS", record: "45-20-5", score: 2 },
    awayTeam: { abbrev: "NYR", record: "43-22-6", score: 1 },
    tvBroadcasts: [{ network: "ESPN" }],
  }));

const makeMixedGames = (states: string[]) =>
  makeGames(states.length, states).map((game, index) => {
    const isScheduled = game.gameState === "FUT";
    const isLive = game.gameState === "LIVE";

    return {
      ...game,
      tvBroadcasts: [
        {
          network:
            index === states.length - 1
              ? "NATIONAL SPORTS NETWORK PLUS"
              : index % 2 === 0
                ? "ESPN+"
                : "TNT",
        },
      ],
      analytics: isScheduled
        ? {
            gameId: game.id,
            awayWinProbability: 0.43,
            homeWinProbability: 0.57,
            edgeTeamAbbreviation: "BOS",
            edgePercentagePoints: 5,
            awayProjectedGoals: 2.31,
            homeProjectedGoals: 2.79,
            awayStarter: { name: "Away Starter", confirmed: false },
            homeStarter: { name: "Home Starter", confirmed: true },
          }
        : {
            gameId: game.id,
            awayXg: 1.82,
            homeXg: 2.35,
            awayShotsOnGoal: 20,
            homeShotsOnGoal: 24,
            xgUpdatedAt: isLive ? new Date().toISOString() : undefined,
            shotsUpdatedAt: isLive ? new Date().toISOString() : undefined,
          },
    };
  });

const renderGames = (games: any[]) =>
  render(
    <HomepageGamesSection
      currentDate="2026-10-10"
      games={games}
      gamesHeaderText="Today's"
      onChangeDate={() => {}}
      loading={false}
      error={null}
      lastUpdatedAt="2026-10-10T12:00:00.000Z"
    />,
  );

describe("HomepageGamesSection", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows live period and time remaining instead of a scheduled start time", () => {
    const { container } = render(
      <HomepageGamesSection
        currentDate="2026-04-08"
        gamesHeaderText="Today's"
        onChangeDate={() => {}}
        loading={false}
        error={null}
        lastUpdatedAt="2026-04-08T12:00:00.000Z"
        heroMetrics={[
          { label: "Players", value: "3,555", caption: "indexed" },
          { label: "New", value: "92", caption: "updates" },
          { label: "Injuries", value: "54", caption: "current updates" },
        ]}
        games={[
          {
            id: 1,
            gameState: "LIVE",
            periodDescriptor: { number: 2, periodType: "REG" },
            clock: { timeRemaining: "12:34", inIntermission: false },
            homeTeam: { abbrev: "BOS", record: "45-20-5" },
            awayTeam: { abbrev: "NYR", record: "43-22-6" },
          },
        ]}
      />,
    );

    expect(screen.getByText("2nd Period")).toBeTruthy();
    expect(screen.getAllByText("12:34")).toHaveLength(2);
    const awayLogo = screen.getAllByRole("img", { name: "NYR logo" })[0];
    expect(awayLogo.getAttribute("src")).toBe(
      "https://assets.nhle.com/logos/nhl/svg/NYR_light.svg",
    );
    expect(awayLogo.getAttribute("width")).toBe("52");
    expect(awayLogo.getAttribute("height")).toBe("52");
    expect(awayLogo.getAttribute("loading")).toBe("lazy");

    fireEvent.error(awayLogo);
    expect(
      screen
        .getAllByRole("img", { name: "NYR logo" })[0]
        .getAttribute("src"),
    ).toBe("https://assets.nhle.com/logos/nhl/svg/NHL_light.svg");
    expect(screen.getByRole("heading", { name: "The Slate" })).toBeTruthy();
    const slateHeading = document.getElementById("slate-heading");
    const gamesHeading = document.getElementById("games-strip-heading");
    expect(
      Boolean(
        (slateHeading?.compareDocumentPosition(gamesHeading as Node) ?? 0) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      screen.getByText("Real-time analytics. Built for fantasy."),
    ).toBeTruthy();
    expect(screen.queryByText(/welcome to/i)).toBeNull();
    expect(screen.getByText("3,555")).toBeTruthy();
    expect(screen.getByText("92")).toBeTruthy();
    expect(screen.getByText("54")).toBeTruthy();
    expect(container.querySelectorAll('[data-slate-metric="true"]')).toHaveLength(3);
    expect(screen.queryByText(/data points/i)).toBeNull();

    const slateArtwork = container.querySelector('[data-slate-artwork="true"]');
    const slateShapes = Array.from(
      slateArtwork?.querySelectorAll("polygon") ?? [],
    ).map((shape) =>
      (shape.getAttribute("points") ?? "").split(" ").map((point) => {
        const [x, y] = point.split(",").map(Number);
        return { x, y };
      }),
    );
    expect(slateShapes).toHaveLength(4);

    const shapeWidths = slateShapes.map(
      ([bottomLeft, bottomRight]) => bottomRight.x - bottomLeft.x,
    );
    const shapeHeights = slateShapes.map(
      ([bottomLeft, , , topLeft]) => bottomLeft.y - topLeft.y,
    );
    const shapeGaps = slateShapes.slice(0, -1).map((shape, index) => {
      const nextShape = slateShapes[index + 1];
      return nextShape[0].x - shape[1].x;
    });
    const slantRatios = slateShapes.map(
      ([bottomLeft, , , topLeft]) =>
        (topLeft.x - bottomLeft.x) / (bottomLeft.y - topLeft.y),
    );

    expect(shapeWidths[0]).toBeCloseTo(shapeWidths[1], 2);
    expect(shapeWidths[0]).toBeCloseTo(shapeWidths[2], 2);
    expect(shapeWidths[3] / shapeWidths[0]).toBeCloseTo(1.62, 2);
    expect(shapeHeights[1] / shapeHeights[0]).toBeCloseTo(1, 2);
    expect(shapeHeights[2] / shapeHeights[0]).toBeCloseTo(1.1, 2);
    expect(shapeHeights[3] / shapeHeights[0]).toBeCloseTo(1.42, 2);
    shapeGaps.forEach((gap) =>
      expect(gap / shapeWidths[0]).toBeCloseTo(0.6, 2),
    );
    slantRatios.forEach((ratio) =>
      expect(ratio).toBeCloseTo(slantRatios[0], 2),
    );
    slateShapes.forEach(([bottomLeft, bottomRight, topRight, topLeft]) => {
      expect(topRight.x - topLeft.x).toBeCloseTo(
        bottomRight.x - bottomLeft.x,
        2,
      );
      expect(topRight.x - bottomRight.x).toBeCloseTo(
        topLeft.x - bottomLeft.x,
        2,
      );
      expect(bottomRight.y).toBeCloseTo(bottomLeft.y, 2);
      expect(topRight.y).toBeCloseTo(topLeft.y, 2);
    });
    expect(
      screen
        .getAllByRole("link", { name: /starter board/i })
        .some((link) => link.getAttribute("href") === "/start-chart"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: /game grid/i })
        .some(
          (link) => link.getAttribute("href") === "/game-grid/7-Day-Forecast",
        ),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: /trends/i })
        .some((link) => link.getAttribute("href") === "/trends"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: /underlying stats/i })
        .some((link) => link.getAttribute("href") === "/underlying-stats"),
    ).toBe(true);
  });

  it("shows a real-data opening night countdown when the offseason slate is empty", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T16:00:00.000Z"));

    render(
      <HomepageGamesSection
        currentDate="2026-07-15"
        games={[]}
        gamesHeaderText="Today's"
        onChangeDate={() => {}}
        loading={false}
        error={null}
        lastUpdatedAt="2026-07-15T16:00:00.000Z"
        openingNightDate="2026-09-29"
      />,
    );

    expect(
      screen.getByRole("heading", { name: /opening night countdown/i }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("region", { name: /today's games/i })
        .getAttribute("data-opening-night"),
    ).toBe("true");
    expect(screen.getByText("2026-27 season")).toBeTruthy();
    expect(screen.getByText(/The season opens on/i)).toBeTruthy();
    expect(screen.getByText(/Sep 29, 2026/)).toBeTruthy();
    expect(
      screen.queryByText(/No games scheduled for 07\/15\/2026/i),
    ).toBeNull();
    expect(
      screen.getByLabelText(/time remaining until nhl opening night/i),
    ).toBeTruthy();
    expect(screen.getByText("75")).toBeTruthy();
    expect(
      screen.getByText(/puck-drop time updates when the NHL schedule/i),
    ).toBeTruthy();
  });

  it("omits an incomplete upstream game without crashing the section", () => {
    expect(() =>
      render(
        <HomepageGamesSection
          currentDate="2026-04-08"
          gamesHeaderText="Today's"
          onChangeDate={() => {}}
          loading={false}
          error={null}
          lastUpdatedAt="2026-04-08T12:00:00.000Z"
          games={[
            {
              id: 2,
              gameState: "FUT",
              homeTeam: undefined,
              awayTeam: { abbrev: "NYR", record: "43-22-6" },
            },
          ]}
        />,
      ),
    ).not.toThrow();

    expect(screen.queryByRole("link", { name: /nyr logo/i })).toBeNull();
  });

  it("opens the date selector and navigates through the existing day-change callback", () => {
    const onChangeDate = vi.fn();

    render(
      <HomepageGamesSection
        currentDate="2026-07-15"
        games={[]}
        gamesHeaderText="Today's"
        onChangeDate={onChangeDate}
        loading={false}
        error={null}
        lastUpdatedAt="2026-07-15T16:00:00.000Z"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /choose game date, currently july 15, 2026/i,
      }),
    );

    expect(
      screen.getByRole("dialog", { name: /choose game date/i }),
    ).toBeTruthy();
    const selectedDate = screen.getByRole("gridcell", {
      name: "July 15, 2026",
    });
    expect(selectedDate.getAttribute("aria-selected")).toBe("true");

    selectedDate.focus();
    fireEvent.keyDown(selectedDate, { key: "ArrowRight" });
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "July 16, 2026",
    );

    fireEvent.click(
      screen.getByRole("gridcell", { name: "July 20, 2026" }),
    );

    expect(onChangeDate).toHaveBeenCalledWith(5);
    expect(
      screen.queryByRole("dialog", { name: /choose game date/i }),
    ).toBeNull();
  });

  it("portals the calendar and restores date-button focus after dismissal", async () => {
    render(
      <HomepageGamesSection
        currentDate="2026-07-15"
        games={[]}
        gamesHeaderText="Today's"
        onChangeDate={() => {}}
        loading={false}
        error={null}
        lastUpdatedAt="2026-07-15T16:00:00.000Z"
      />,
    );

    const dateButton = screen.getByRole("button", {
      name: /choose game date, currently july 15, 2026/i,
    });
    fireEvent.click(dateButton);
    expect(
      screen.getByRole("dialog", { name: /choose game date/i }).parentElement,
    ).toBe(document.body);
    fireEvent.click(screen.getByRole("button", { name: /next month/i }));

    expect(screen.getByText("August 2026")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: /choose game date/i }),
    ).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(dateButton));
  });

  it("closes the portaled calendar on outside click and restores focus", async () => {
    render(
      <HomepageGamesSection
        currentDate="2026-07-15"
        games={[]}
        gamesHeaderText="Today's"
        onChangeDate={() => {}}
        loading={false}
        error={null}
        lastUpdatedAt="2026-07-15T16:00:00.000Z"
      />,
    );

    const dateButton = screen.getByRole("button", {
      name: /choose game date, currently july 15, 2026/i,
    });
    fireEvent.click(dateButton);
    fireEvent.mouseDown(document.body);

    expect(
      screen.queryByRole("dialog", { name: /choose game date/i }),
    ).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(dateButton));
  });

  it("gives the playoff snapshot precedence over a future opening date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T16:00:00.000Z"));

    render(
      <HomepageGamesSection
        currentDate="2026-07-15"
        games={[]}
        gamesHeaderText="Today's"
        onChangeDate={() => {}}
        loading={false}
        error={null}
        lastUpdatedAt="2026-07-15T16:00:00.000Z"
        playoffsActive
        playoffSeasonYear={2026}
        openingNightDate="2026-09-29"
        playoffBracket={{
          series: [
            {
              seriesTitle: "Stanley Cup Final",
              seriesAbbrev: "SCF",
              seriesLetter: "O",
              playoffRound: 4,
              topSeedRank: 1,
              topSeedRankAbbrev: "W",
              topSeedWins: 4,
              bottomSeedRank: 1,
              bottomSeedRankAbbrev: "E",
              bottomSeedWins: 2,
              topSeedTeam: {
                id: 25,
                abbrev: "DAL",
                name: { default: "Dallas Stars" },
              },
              bottomSeedTeam: {
                id: 6,
                abbrev: "BOS",
                name: { default: "Boston Bruins" },
              },
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Postseason 2026")).toBeTruthy();
    expect(screen.getByText("Western Conference")).toBeTruthy();
    expect(screen.getByText("Eastern Conference")).toBeTruthy();
    expect(screen.getByText("Stanley Cup Champions")).toBeTruthy();
    expect(screen.queryByText(/opening night countdown/i)).toBeNull();
    expect(screen.queryByText(/No games scheduled/i)).toBeNull();
  });

  it("shows a compact zero-game state without substituting postseason content", () => {
    render(
      <HomepageGamesSection
        currentDate="2026-10-12"
        games={[]}
        gamesHeaderText="Upcoming"
        onChangeDate={() => {}}
        loading={false}
        error={null}
        lastUpdatedAt="2026-10-12T12:00:00.000Z"
      />,
    );

    expect(screen.getByText(/No games scheduled for 10\/12\/2026/i)).toBeTruthy();
    expect(screen.queryByText(/opening night countdown/i)).toBeNull();
    expect(screen.queryByText(/Western Conference/i)).toBeNull();
    expect(
      screen
        .getByRole("region", { name: /upcoming games/i })
        .hasAttribute("data-opening-night"),
    ).toBe(false);
  });

  it.each([
    [1, "light"],
    [5, "light"],
    [6, "medium"],
    [11, "medium"],
    [12, "heavy"],
    [16, "heavy"],
  ])("uses %i games for the %s desktop and mobile slate modes", (gameCount, mode) => {
    const { container } = render(
      <HomepageGamesSection
        currentDate="2026-10-10"
        games={makeGames(gameCount)}
        gamesHeaderText="Today's"
        onChangeDate={() => {}}
        loading={false}
        error={null}
        lastUpdatedAt="2026-10-10T12:00:00.000Z"
      />,
    );

    const slates = [
      container.querySelector("[data-desktop-slate='true']"),
      container.querySelector("[data-mobile-slate='true']"),
    ];

    slates.forEach((slate) => {
      expect(slate?.getAttribute("data-slate-mode")).toBe(mode);
      const slateQueries = within(slate as HTMLElement);
      expect(
        slateQueries
          .getByRole("link", { name: `View all ${gameCount} games` })
          .getAttribute("href"),
      ).toBe("/game-grid/7-Day-Forecast");
      const adaptiveGameLinks = Array.from(
        slate?.querySelectorAll('a[href^="/game/"]') ?? [],
      );
      expect(adaptiveGameLinks).toHaveLength(gameCount);
      expect(
        new Set(adaptiveGameLinks.map((link) => link.getAttribute("href"))).size,
      ).toBe(gameCount);
    });
  });

  it("preserves loading, error, and stale slate semantics", () => {
    const { rerender } = render(
      <HomepageGamesSection
        currentDate="2026-10-10"
        games={[]}
        gamesHeaderText="Today's"
        onChangeDate={() => {}}
        loading
        error={null}
        lastUpdatedAt={null}
      />,
    );

    expect(screen.getByText("Refreshing the slate...")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /view all/i })).toBeNull();

    rerender(
      <HomepageGamesSection
        currentDate="2026-10-10"
        games={[]}
        gamesHeaderText="Today's"
        onChangeDate={() => {}}
        loading={false}
        error="The schedule feed is unavailable."
        lastUpdatedAt={null}
      />,
    );

    expect(screen.getByText("The schedule feed is unavailable.")).toBeTruthy();
    expect(screen.queryByText(/No games scheduled/i)).toBeNull();

    rerender(
      <HomepageGamesSection
        currentDate="2026-10-10"
        games={makeGames(6)}
        gamesHeaderText="Today's"
        onChangeDate={() => {}}
        loading={false}
        error={null}
        lastUpdatedAt="2025-01-01T00:00:00.000Z"
      />,
    );

    expect(
      screen.getByText(
        "Slate data may be stale. Refresh before making lineup decisions.",
      ),
    ).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "View all 6 games" })).toHaveLength(2);
  });

  it("groups medium and heavy slates with live games first", () => {
    const { container } = render(
      <HomepageGamesSection
        currentDate="2026-10-10"
        games={makeGames(6, ["FUT", "FINAL", "LIVE", "FUT", "FUT", "FUT"])}
        gamesHeaderText="Today's"
        onChangeDate={() => {}}
        loading={false}
        error={null}
        lastUpdatedAt="2026-10-10T12:00:00.000Z"
      />,
    );

    const desktopSlate = container.querySelector("[data-desktop-slate='true']");
    const groupOrder = Array.from(
      desktopSlate?.querySelectorAll("[data-game-group]") ?? [],
    ).map((group) => group.getAttribute("data-game-group"));

    expect(groupOrder).toEqual(["live", "scheduled", "final"]);
    expect(
      desktopSlate
        ?.querySelector("a[data-game-state]")
        ?.getAttribute("data-game-state"),
    ).toBe("live");
  });

  it("uses prominent live cards and shared scheduled and final tables for Medium", () => {
    const { container } = renderGames(
      makeMixedGames([
        "LIVE",
        "LIVE",
        "FUT",
        "FUT",
        "FUT",
        "FUT",
        "FUT",
        "FINAL",
        "FINAL",
      ]),
    );
    const desktopSlate = container.querySelector(
      "[data-desktop-slate='true']",
    ) as HTMLElement;
    const desktopQueries = within(desktopSlate);

    expect(desktopSlate.getAttribute("data-slate-mode")).toBe("medium");
    expect(
      desktopSlate.querySelectorAll("[data-card-variant='medium-live']"),
    ).toHaveLength(2);
    expect(
      desktopSlate.querySelectorAll("[data-table-surface='scheduled']"),
    ).toHaveLength(1);
    expect(
      desktopSlate.querySelectorAll("[data-table-surface='final']"),
    ).toHaveLength(1);
    expect(
      desktopSlate.querySelector(
        "[data-table-columns='medium-scheduled']",
      )?.textContent,
    ).toContain("TimeMatchupEdgeProjNetwork");
    expect(
      desktopSlate.querySelector("[data-table-columns='medium-final']")
        ?.textContent,
    ).toContain("FinalMatchupxGFSOGNetwork");
    expect(
      desktopSlate.querySelectorAll("a[data-game-state='scheduled']"),
    ).toHaveLength(5);
    expect(
      desktopSlate.querySelectorAll(
        "a[data-game-state='scheduled'] [data-team-score]",
      ),
    ).toHaveLength(0);
    expect(
      desktopSlate.querySelector("[data-table-group='scheduled']")
        ?.textContent,
    ).toContain("BOS +5.0pp");
    expect(
      desktopSlate.querySelector("[data-table-group='scheduled']")
        ?.textContent,
    ).toContain("2.31–2.79");
    expect(
      desktopSlate.querySelector("[data-table-group='final']")?.textContent,
    ).toContain("1.82–2.35");
    expect(
      desktopSlate.querySelector("[data-table-group='final']")?.textContent,
    ).toContain("20–24");
    expect(desktopQueries.getAllByRole("link")).toHaveLength(10);
  });

  it("uses stacked live scoreboards and analytics-free two-column routine tables for Heavy", () => {
    const { container } = renderGames(
      makeMixedGames([
        "LIVE",
        "LIVE",
        "LIVE",
        "LIVE",
        "FUT",
        "FUT",
        "FUT",
        "FUT",
        "FUT",
        "FUT",
        "FUT",
        "FUT",
        "FINAL",
        "FINAL",
        "FINAL",
        "FINAL",
      ]),
    );
    const desktopSlate = container.querySelector(
      "[data-desktop-slate='true']",
    ) as HTMLElement;

    expect(desktopSlate.getAttribute("data-slate-mode")).toBe("heavy");
    expect(
      desktopSlate.querySelectorAll("[data-card-variant='heavy-live']"),
    ).toHaveLength(4);
    expect(
      desktopSlate.querySelectorAll("[data-scoreboard-team-row]"),
    ).toHaveLength(8);
    expect(
      desktopSlate.querySelectorAll("[data-table-surface='scheduled']"),
    ).toHaveLength(2);
    expect(
      desktopSlate.querySelectorAll("[data-table-surface='final']"),
    ).toHaveLength(2);
    expect(desktopSlate.querySelectorAll("[data-table-metric]")).toHaveLength(
      0,
    );
    expect(
      desktopSlate.querySelectorAll("a[data-game-state='scheduled']"),
    ).toHaveLength(8);
    expect(
      desktopSlate.querySelectorAll("a[data-game-state='final']"),
    ).toHaveLength(4);
    const gameLinks = Array.from(
      desktopSlate.querySelectorAll('a[href^="/game/"]'),
    );
    expect(gameLinks).toHaveLength(16);
    expect(
      new Set(gameLinks.map((link) => link.getAttribute("href"))).size,
    ).toBe(16);
  });

  it.each([
    [6, "medium", 1],
    [12, "heavy", 2],
  ])(
    "omits an empty live group in a %i-game %s slate",
    (gameCount, mode, tableCount) => {
      const { container } = renderGames(
        makeMixedGames(Array.from({ length: gameCount }, () => "FUT")),
      );
      const desktopSlate = container.querySelector(
        "[data-desktop-slate='true']",
      ) as HTMLElement;

      expect(desktopSlate.getAttribute("data-slate-mode")).toBe(mode);
      expect(
        desktopSlate.querySelector("[data-game-group='live']"),
      ).toBeNull();
      expect(
        desktopSlate.querySelectorAll("[data-table-surface='scheduled']"),
      ).toHaveLength(tableCount);
    },
  );

  it("closes Light card gaps cleanly when optional analytics are unavailable", () => {
    const { container } = renderGames(makeGames(1));
    const desktopCard = container.querySelector(
      "[data-desktop-slate='true'] [data-card-variant='light']",
    ) as HTMLElement;

    expect(desktopCard.querySelector("[data-light-analytics]")).toBeNull();
    expect(desktopCard.querySelectorAll("[data-team-score]")).toHaveLength(0);
    expect(desktopCard.textContent).toContain("Records");
    expect(desktopCard.textContent).not.toMatch(/\bN\/A\b/i);
  });

  it("shows team-associated pregame probabilities, Edge, projection, and starters", () => {
    const { container } = renderGames([
      {
        ...makeGames(1)[0],
        analytics: {
          gameId: 1,
          awayWinProbability: 0.39,
          homeWinProbability: 0.61,
          edgeTeamAbbreviation: "BOS",
          edgePercentagePoints: 6,
          awayProjectedGoals: 2.41,
          homeProjectedGoals: 3.08,
          awayStarter: { name: "Igor Shesterkin", confirmed: false },
          homeStarter: { name: "Jeremy Swayman", confirmed: true },
        },
      },
    ]);
    const mobileSlate = container.querySelector(
      "[data-mobile-slate='true']",
    ) as HTMLElement;
    const mobileQueries = within(mobileSlate);

    const awayProbability = screen.getByTitle(
      "NYR pregame win probability",
    );
    const homeProbability = screen.getByTitle(
      "BOS pregame win probability",
    );
    expect(awayProbability.textContent).toBe("39%");
    expect(awayProbability.getAttribute("data-probability-tone")).toBe(
      "underdog",
    );
    expect(awayProbability.className).toMatch(/probabilityUnderdog/i);
    expect(homeProbability.textContent).toBe("61%");
    expect(homeProbability.getAttribute("data-probability-tone")).toBe(
      "favored",
    );
    expect(homeProbability.className).toMatch(/probabilityFavored/i);
    expect(
      container.querySelector("[data-game-state]")?.textContent,
    ).toContain("BOS +6.0pp");
    expect(mobileQueries.getByText("2.41–3.08")).toBeTruthy();
    expect(mobileQueries.getByText(/Igor Shesterkin \(NYR\)/i)).toBeTruthy();
    expect(mobileQueries.getByText(/✓ Jeremy Swayman \(BOS\)/i)).toBeTruthy();
    expect(screen.queryByText(/\bN\/A\b/i)).toBeNull();
  });

  it("associates an away favorite correctly and treats exact 50/50 as neutral", () => {
    const { rerender } = renderGames([
      {
        ...makeGames(1)[0],
        analytics: {
          gameId: 1,
          awayWinProbability: 0.58,
          homeWinProbability: 0.42,
        },
      },
    ]);

    expect(
      screen
        .getByTitle("NYR pregame win probability")
        .getAttribute("data-probability-tone"),
    ).toBe("favored");
    expect(
      screen
        .getByTitle("BOS pregame win probability")
        .getAttribute("data-probability-tone"),
    ).toBe("underdog");

    rerender(
      <HomepageGamesSection
        currentDate="2026-10-10"
        games={[
          {
            ...makeGames(1)[0],
            analytics: {
              gameId: 1,
              awayWinProbability: 0.5,
              homeWinProbability: 0.5,
            },
          },
        ]}
        gamesHeaderText="Today's"
        onChangeDate={() => {}}
        loading={false}
        error={null}
        lastUpdatedAt="2026-10-10T12:00:00.000Z"
      />,
    );

    expect(
      screen
        .getByTitle("NYR pregame win probability")
        .getAttribute("data-probability-tone"),
    ).toBe("even");
    expect(
      screen.getByTitle("NYR pregame win probability").className,
    ).toMatch(/probabilityEven/i);
    expect(
      screen
        .getByTitle("BOS pregame win probability")
        .getAttribute("data-probability-tone"),
    ).toBe("even");
  });

  it.each([
    [6, "medium"],
    [12, "heavy"],
  ])(
    "keeps both probabilities attached to the matchup in %s-game %s mode",
    (gameCount, mode) => {
      const games = makeGames(gameCount);
      games[0] = {
        ...games[0],
        analytics: {
          gameId: games[0].id,
          awayWinProbability: 0.42,
          homeWinProbability: 0.58,
          awayProjectedGoals: 2.31,
          homeProjectedGoals: 1.79,
        },
      } as any;
      const { container } = renderGames(games);
      const probabilityRow = container.querySelector(
        `[data-mobile-slate="true"][data-slate-mode="${mode}"] [data-has-probabilities="true"]`,
      );

      expect(probabilityRow).toBeTruthy();
      expect(
        probabilityRow?.querySelector(
          '[title="NYR pregame win probability"]',
        )?.textContent,
      ).toBe("42%");
      expect(
        probabilityRow?.querySelector(
          '[title="BOS pregame win probability"]',
        )?.textContent,
      ).toBe("58%");
      expect(probabilityRow?.textContent).toContain("2.31–1.79");
    },
  );

  it("omits stale pregame probabilities and projected scores", () => {
    const { container } = renderGames([
      {
        ...makeGames(1)[0],
        analytics: {
          gameId: 1,
          awayWinProbability: 0.39,
          homeWinProbability: 0.61,
          predictionFreshness: "stale",
          awayProjectedGoals: 2.41,
          homeProjectedGoals: 3.08,
          projectedGoalsFreshness: "stale",
        },
      },
    ]);

    expect(
      screen.queryByTitle("NYR pregame win probability"),
    ).toBeNull();
    expect(
      container.querySelector("[data-game-state]")?.textContent,
    ).not.toContain("2.41–3.08");
  });

  it("shows live actual xG and SOG instead of the pregame projection", () => {
    const { container } = renderGames([
      {
        ...makeGames(1, ["LIVE"])[0],
        analytics: {
          gameId: 1,
          awayWinProbability: 0.39,
          homeWinProbability: 0.61,
          edgeTeamAbbreviation: "BOS",
          edgePercentagePoints: 6,
          awayProjectedGoals: 2.41,
          homeProjectedGoals: 3.08,
          awayXg: 1.82,
          homeXg: 2.35,
          awayShotsOnGoal: 20,
          homeShotsOnGoal: 24,
          xgUpdatedAt: new Date().toISOString(),
          shotsUpdatedAt: new Date().toISOString(),
        },
      },
    ]);
    const mobileQueries = within(
      container.querySelector("[data-mobile-slate='true']") as HTMLElement,
    );

    expect(mobileQueries.getByText("1.82–2.35")).toBeTruthy();
    expect(mobileQueries.getByText("20–24")).toBeTruthy();
    expect(mobileQueries.queryByText("2.41–3.08")).toBeNull();
    expect(
      screen.queryByTitle("NYR pregame win probability"),
    ).toBeNull();
  });

  it("omits stale live aggregates", () => {
    const { container } = renderGames([
      {
        ...makeGames(1, ["LIVE"])[0],
        analytics: {
          gameId: 1,
          awayXg: 1.82,
          homeXg: 2.35,
          awayShotsOnGoal: 20,
          homeShotsOnGoal: 24,
          xgUpdatedAt: "2020-01-01T00:00:00.000Z",
          shotsUpdatedAt: "2020-01-01T00:00:00.000Z",
        },
      },
    ]);

    const gameRow = container.querySelector("[data-game-state]");
    expect(gameRow?.textContent).not.toContain("1.82–2.35");
    expect(gameRow?.textContent).not.toContain("20–24");
  });

  it("omits unavailable analytics and removes starter context after a final", () => {
    const { container, rerender } = renderGames(makeGames(1));
    const gameRow = container.querySelector("[data-game-state]");

    expect(gameRow?.textContent).not.toMatch(/\bEdge\b/i);
    expect(gameRow?.textContent).not.toMatch(/\bProj\b/i);
    expect(gameRow?.textContent).not.toMatch(/\bSOG\b/i);
    expect(gameRow?.textContent).not.toMatch(/\bStarters\b/i);
    expect(
      screen.queryByTitle("NYR pregame win probability"),
    ).toBeNull();

    rerender(
      <HomepageGamesSection
        currentDate="2026-10-10"
        games={[
          {
            ...makeGames(1, ["FINAL"])[0],
            analytics: {
              gameId: 1,
              awayXg: 1.82,
              homeXg: 2.35,
              awayShotsOnGoal: 20,
              homeShotsOnGoal: 24,
              awayWinProbability: 0.39,
              homeWinProbability: 0.61,
              awayStarter: { name: "Away Starter", confirmed: true },
              homeStarter: { name: "Home Starter", confirmed: true },
            },
          },
        ]}
        gamesHeaderText="Today's"
        onChangeDate={() => {}}
        loading={false}
        error={null}
        lastUpdatedAt="2026-10-10T12:00:00.000Z"
      />,
    );

    const desktopQueries = within(
      container.querySelector("[data-desktop-slate='true']") as HTMLElement,
    );
    expect(desktopQueries.getByText("1.82–2.35")).toBeTruthy();
    expect(desktopQueries.getByText("20–24")).toBeTruthy();
    expect(screen.queryByText(/Away Starter/i)).toBeNull();
  });
});
