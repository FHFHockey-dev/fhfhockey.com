import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    render(
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
          { label: "Injuries", value: "54", caption: "current updates" }
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
    expect(
      screen.getByText("Real-time analytics. Built for fantasy."),
    ).toBeTruthy();
    expect(screen.queryByText(/welcome to/i)).toBeNull();
    expect(screen.getByText("3,555")).toBeTruthy();
    expect(screen.getByText("92")).toBeTruthy();
    expect(screen.getByText("54")).toBeTruthy();
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

  it("supports month navigation and Escape dismissal in the date selector", () => {
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
    fireEvent.click(screen.getByRole("button", { name: /next month/i }));

    expect(screen.getByText("August 2026")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: /choose game date/i }),
    ).toBeNull();
  });

  it.each([
    [1, "light"],
    [5, "light"],
    [6, "medium"],
    [11, "medium"],
    [12, "heavy"],
    [16, "heavy"],
  ])("uses %i games for the %s mobile slate mode", (gameCount, mode) => {
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

    expect(
      container
        .querySelector("[data-slate-mode]")
        ?.getAttribute("data-slate-mode"),
    ).toBe(mode);
    expect(
      screen
        .getByRole("link", { name: `View all ${gameCount} games` })
        .getAttribute("href"),
    ).toBe("/game-grid/7-Day-Forecast");
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

    const mobileSlate = container.querySelector("[data-slate-mode='medium']");
    const groupOrder = Array.from(
      mobileSlate?.querySelectorAll("[data-game-group]") ?? [],
    ).map((group) => group.getAttribute("data-game-group"));

    expect(groupOrder).toEqual(["live", "scheduled", "final"]);
    expect(
      mobileSlate
        ?.querySelector("a[data-game-state]")
        ?.getAttribute("data-game-state"),
    ).toBe("live");
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
    expect(screen.getByText("2.41–3.08")).toBeTruthy();
    expect(screen.getByText(/Igor Shesterkin \(NYR\)/i)).toBeTruthy();
    expect(screen.getByText(/✓ Jeremy Swayman \(BOS\)/i)).toBeTruthy();
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
        `[data-slate-mode="${mode}"] [data-has-probabilities="true"]`,
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
    renderGames([
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

    expect(screen.getByText("1.82–2.35")).toBeTruthy();
    expect(screen.getByText("20–24")).toBeTruthy();
    expect(screen.queryByText("2.41–3.08")).toBeNull();
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

    expect(screen.getByText("1.82–2.35")).toBeTruthy();
    expect(screen.getByText("20–24")).toBeTruthy();
    expect(screen.queryByText(/Away Starter/i)).toBeNull();
  });
});
