import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import HomepageGamesSection from "./HomepageGamesSection";

vi.mock("next/link", () => ({
  default: ({ href, className, children }: any) => (
    <a href={href} className={className}>
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
    expect(screen.getByText("12:34")).toBeTruthy();
    const awayLogo = screen.getByRole("img", { name: "NYR logo" });
    expect(awayLogo.getAttribute("src")).toBe(
      "https://assets.nhle.com/logos/nhl/svg/NYR_light.svg",
    );
    expect(awayLogo.getAttribute("width")).toBe("52");
    expect(awayLogo.getAttribute("height")).toBe("52");
    expect(awayLogo.getAttribute("loading")).toBe("lazy");

    fireEvent.error(awayLogo);
    expect(
      screen.getByRole("img", { name: "NYR logo" }).getAttribute("src"),
    ).toBe("https://assets.nhle.com/logos/nhl/svg/NHL_light.svg");
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
});
