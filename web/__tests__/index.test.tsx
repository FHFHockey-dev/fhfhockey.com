import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Home from "../pages/index";

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-seo", () => ({
  NextSeo: () => null,
}));

vi.mock("components/Layout/Container", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("components/ClientOnly", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("components/HomePage/HomepageGamesSection", () => ({
  default: () => <div />,
}));

vi.mock("components/HomePage/HomepageStandingsInjuriesSection", () => ({
  default: () => <div />,
}));

vi.mock("components/HomePage/useHomepageGames", () => ({
  useHomepageGames: () => ({
    currentDate: "2026-07-26",
    games: [],
    gamesHeaderText: "Today's Games",
    changeDate: vi.fn(),
    loading: false,
    error: null,
    lastUpdatedAt: null,
  }),
}));

vi.mock("next/legacy/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

vi.mock("components/TeamStandingsChart/TeamStandingsChart", () => ({
  default: () => <div />,
}));

vi.mock("components/TransactionTrends/TransactionTrends", () => ({
  default: () => <div />,
}));

vi.mock("components/HomePage/HomepageDraftRanker", () => ({
  default: () => <div />,
}));

vi.mock("lib/supabase/server", () => ({
  default: {},
}));

const baseProps = {
  initialGames: [],
  initialInjuries: [],
  initialStandings: [],
  nextGameDate: "2026-07-26",
  playoffsActive: false,
  playoffBracket: null,
  playoffWeekGames: [],
  homepageSnapshotGeneratedAt: null,
  standingsLoadError: null,
  injuriesLoadError: null,
  recentTransactions: [],
  recentInjuryNews: [],
  homepagePlayerCount: 0,
  homepagePulsePoints: [],
  openingNightDate: null,
  openingNightStartTime: null,
  draftRankerHomepageEnabled: false,
};

const makeHomepageNewsItem = (index: number) => ({
  id: `news-${index}`,
  headline: `Story ${index}`,
  blurb: `Complete authoritative story ${index}.`,
  category: "NEWS UPDATE",
  subcategory: null,
  team_abbreviation: "NHL",
  source_label: "NHL",
  source_account: "@NHL",
  source_url: `https://example.com/news/${index}`,
  tweet_url: null,
  published_at: "2026-07-26T12:00:00.000Z",
  created_at: "2026-07-26T12:00:00.000Z",
  card_status: "published",
  metadata: null,
  players: [],
});

describe("homepage Latest News", () => {
  afterEach(cleanup);

  it("renders no more than five authoritative stories", () => {
    const latestNews = Array.from({ length: 7 }, (_, index) =>
      makeHomepageNewsItem(index + 1),
    );

    render(<Home {...(baseProps as any)} latestNews={latestNews} />);

    expect(screen.getAllByRole("article")).toHaveLength(5);
    expect(
      screen.getByRole("heading", {
        name: "Complete authoritative story 5.",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", {
        name: "Complete authoritative story 6.",
      }),
    ).toBeNull();
    const disclosureButtons = screen
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("aria-expanded"));
    expect(disclosureButtons).toHaveLength(5);
    disclosureButtons.forEach((button) => {
      expect(button.getAttribute("aria-expanded")).toBe("false");
      expect(button.textContent).toContain("+");
    });
  });

  it("does not fabricate rows when fewer than five stories exist", () => {
    render(
      <Home
        {...(baseProps as any)}
        latestNews={[
          makeHomepageNewsItem(1),
          makeHomepageNewsItem(2),
        ]}
      />,
    );

    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(
      screen
        .getAllByRole("button")
        .filter((button) => button.hasAttribute("aria-expanded")),
    ).toHaveLength(2);
  });
});
