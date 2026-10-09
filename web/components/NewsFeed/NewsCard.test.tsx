import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import NewsCard from "./NewsCard";
import { teamsInfo } from "lib/teamsInfo";

vi.mock("next/legacy/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

const makeItem = (overrides: Record<string, unknown> = {}) =>
  ({
    headline: "FLA signing",
    blurb:
      "Florida and Akira Schmid reached agreement to avoid arbitration on a two-year, $2 million contract.",
    category: "SIGNING",
    subcategory: "OFFICIAL SIGNING",
    team_abbreviation: "FLA",
    source_label: "Elliotte Friedman",
    source_account: "@FriedgeHNIC",
    source_url: "https://x.com/FriedgeHNIC/status/2073877758803935434",
    published_at: "2026-07-24T20:30:49.000Z",
    created_at: "2026-07-24T20:30:49.000Z",
    card_status: "published",
    metadata: {
      automation: {
        summary: "Florida and Akira Schmid avoid arbitration; 2 x $2M.",
      },
    },
    players: [],
    ...overrides,
  }) as any;

describe("NewsCard", () => {
  afterEach(cleanup);

  it("keeps observation and publication independent of creation time", () => {
    render(<NewsCard item={makeItem({ published_at: null, observed_at: "2026-07-14T18:19:20.000Z", source_label: null, source_account: "SOURCE_ACCOUNT", source_url: "not a URL", metadata: null })} />);
    expect(screen.getAllByText("Published Unavailable")).toHaveLength(2);
    expect(screen.getByText("Observed Jul 14, 2:19 PM")).toBeTruthy();
    expect(screen.getByText("Source unavailable")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /View original post/ })).toBeNull();
  });

  it("does not display malformed timestamps as dates", () => {
    render(<NewsCard item={makeItem({ published_at: "broken", observed_at: "broken" })} />);
    expect(screen.getAllByText("Published Unavailable")).toHaveLength(2);
    expect(screen.getByText("Observed Unavailable")).toBeTruthy();
  });

  it("shows useful details and an accessible original-post icon in rail mode", () => {
    render(
      <NewsCard
        compact
        rail
        item={makeItem({
          headline: "Pavel Mintyukov news update",
          blurb:
            "RT @FriedgeHNIC: Hearing Pavel Mintyukov and Anaheim are getting an extension done.",
          category: "NEWS UPDATE",
          subcategory: "CONTRACT NEGOTIATION",
          team_abbreviation: "ANA",
          published_at: "2026-07-14T18:19:20.000Z",
          created_at: "2026-07-14T18:19:20.000Z",
          metadata: null,
          players: [{ player_name: "Pavel Mintyukov" }],
        })}
      />,
    );

    expect(
      screen.getAllByText(
        "Hearing Pavel Mintyukov and Anaheim are getting an extension done.",
      ).length,
    ).toBeGreaterThan(0);
    const sourceLink = screen.getByRole("link", {
      name: "View original post for Source report",
    });
    expect(sourceLink.getAttribute("href")).toBe(
      "https://x.com/FriedgeHNIC/status/2073877758803935434",
    );
    expect(sourceLink.getAttribute("target")).toBe("_blank");
    expect(screen.queryByText("Source")).toBeNull();
    expect(screen.getByText("Published 7/14/2026, 2:19:20 PM")).toBeTruthy();
  });

  it("renders team and category once while promoting authoritative detail", () => {
    const { container } = render(
      <NewsCard compact rail item={makeItem()} />,
    );

    const article = container.querySelector("article");
    expect(article).toBeTruthy();
    expect(article?.style.getPropertyValue("--news-team-primary")).toBe(
      teamsInfo.FLA.primaryColor,
    );
    expect(article?.style.getPropertyValue("--news-team-secondary")).toBe(
      teamsInfo.FLA.secondaryColor,
    );
    expect(article?.style.getPropertyValue("--news-team-stripe")).toBe(
      teamsInfo.FLA.jersey,
    );
    expect(article?.style.getPropertyValue("--news-team-surface")).toBe(
      teamsInfo.FLA.primaryColor,
    );
    expect(within(article as HTMLElement).getAllByText("FLA")).toHaveLength(1);
    expect(within(article as HTMLElement).queryByText("Official Signing")).toBeNull();
    expect(
      screen.getByRole("heading", {
        name: "Florida and Akira Schmid reached agreement to avoid arbitration on a two-year, $2 million contract.",
      }),
    ).toBeTruthy();
  });

  it("expands a single-field story without duplicating its full copy", () => {
    const repeated =
      "Patrick Kane signs a two-year deal with the Chicago Blackhawks.";

    function SingleFieldHarness() {
      const [expanded, setExpanded] = useState(false);
      return (
        <NewsCard
          compact
          rail
          item={makeItem({
            headline: repeated,
            blurb: repeated,
            team_abbreviation: "CHI",
            metadata: null,
          })}
          expanded={expanded}
          onExpandedChange={setExpanded}
        />
      );
    }

    const { container } = render(<SingleFieldHarness />);
    const button = screen.getByRole("button", {
      name: /expand chi news/i,
    });
    const compactTimestamp = container.querySelector(
      '[class*="mobileTimestamp"]',
    );
    const initialTimestamp = compactTimestamp?.textContent;
    const controlledRegion = document.getElementById(
      button.getAttribute("aria-controls") ?? "",
    );

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(controlledRegion).toBeTruthy();
    expect(
      controlledRegion?.querySelector('[class*="railDetails"]'),
    ).toBeNull();
    expect(screen.getByAltText("CHI logo")).toBeTruthy();

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.textContent).toContain("−");
    expect(screen.getByAltText("CHI logo")).toBeTruthy();
    expect(compactTimestamp?.textContent).toBe(initialTimestamp);
    expect(
      controlledRegion?.querySelector('[class*="expandedTimestamp"]'),
    ).toBeNull();

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.textContent).toContain("+");
  });

  it("supports one controlled expanded story at a time", () => {
    function NewsHarness() {
      const [expanded, setExpanded] = useState<string | null>(null);
      return (
        <>
          <NewsCard
            compact
            rail
            item={makeItem()}
            expanded={expanded === "FLA"}
            onExpandedChange={(open) => setExpanded(open ? "FLA" : null)}
          />
          <NewsCard
            compact
            rail
            item={makeItem({
              headline: "CBJ signing",
              blurb:
                "Columbus and Cole Sillinger reached a three-year settlement worth $4.625 million annually.",
              team_abbreviation: "CBJ",
              metadata: {
                automation: {
                  summary: "Columbus and Cole Sillinger avoid arbitration.",
                },
              },
            })}
            expanded={expanded === "CBJ"}
            onExpandedChange={(open) => setExpanded(open ? "CBJ" : null)}
          />
        </>
      );
    }

    render(<NewsHarness />);
    const flaButton = screen.getByRole("button", {
      name: /expand fla news/i,
    });
    const cbjButton = screen.getByRole("button", {
      name: /expand cbj news/i,
    });
    const flaDetailsId = flaButton.getAttribute("aria-controls");

    expect(flaButton.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(flaDetailsId ?? "")).toBeTruthy();
    expect(document.getElementById(flaDetailsId ?? "")?.querySelector('[class*="railDetails"]')).toBeNull();

    fireEvent.click(flaButton);
    expect(flaButton.getAttribute("aria-expanded")).toBe("true");
    expect(flaButton.textContent).toContain("−");


    fireEvent.click(cbjButton);
    expect(flaButton.getAttribute("aria-expanded")).toBe("false");
    expect(cbjButton.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen
        .getAllByRole("button")
        .filter((button) => button.getAttribute("aria-expanded") === "true"),
    ).toHaveLength(1);
  });

  it("keeps the external source link independent from disclosure", () => {
    const onExpandedChange = vi.fn();
    render(
      <NewsCard
        compact
        rail
        item={makeItem()}
        onExpandedChange={onExpandedChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("link", {
        name: "View original post for Source report",
      }),
    );

    expect(onExpandedChange).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole("button", { name: /expand fla news/i })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("uses the league fallback without fabricating a team association", () => {
    render(
      <NewsCard
        compact
        rail
        item={makeItem({
          headline: "League news update",
          blurb: "The NHL issued a league-wide roster update.",
          category: "NEWS UPDATE",
          subcategory: null,
          team_abbreviation: null,
          metadata: null,
        })}
      />,
    );

    expect(screen.getByAltText("NHL logo")).toBeTruthy();
    expect(screen.getAllByText("NHL")).toHaveLength(1);
  });

  it("uses the neutral NHL logo when a team logo is unavailable", () => {
    const { container } = render(
      <NewsCard
        compact
        rail
        item={makeItem({
          team_abbreviation: "ZZZ",
        })}
      />,
    );

    expect(screen.getByAltText("ZZZ logo").getAttribute("src")).toBe(
      "https://assets.nhle.com/logos/nhl/svg/NHL_light.svg",
    );
    const article = container.querySelector("article");
    expect(article?.style.getPropertyValue("--news-team-primary")).toBe(
      "#14a2d2",
    );
    expect(article?.style.getPropertyValue("--news-team-surface")).toBe(
      "#0b1821",
    );
  });

  it("does not render a dead external-link action", () => {
    render(
      <NewsCard
        compact
        rail
        item={makeItem({
          source_url: null,
          tweet_url: null,
        })}
      />,
    );

    expect(
      screen.queryByRole("link", { name: /view original post/i }),
    ).toBeNull();
  });

  it("renders the captured Barzal passage without promoting its Kevin He join", () => {
    const passage = 'RT @AGrossNewsday: Mathew Barzal is with #Isles on trip, Pete DeBoer said he is attending all the meetings. Not on the ice yet but said to be "around the corner." So he won\'t play in the season opener tomorrow in Toronto.';
    render(<NewsCard item={makeItem({ id: "cac51da7-3f50-4109-b7b4-3ad80538f07f", headline: "Kevin He injury update",
      blurb: passage, category: "INJURY", metadata: null, players: [{ player_id: 8484864, player_name: "Kevin He" }] })} />);
    expect(screen.getByRole("heading", { name: "Source report" })).toBeTruthy();
    expect(screen.queryByText("Kevin He")).toBeNull();
    expect(screen.queryByText("Kevin He injury update")).toBeNull();
    expect(screen.getByText(/Mathew Barzal is with/)).toBeTruthy();
    expect(screen.getByText("Subject-to-claim evidence unavailable")).toBeTruthy();
  });

  it("does not add disclosure controls to unrelated NewsCard variants", () => {
    render(
      <NewsCard
        item={makeItem()}
        onExpandedChange={() => {}}
      />,
    );

    expect(screen.queryByRole("button", { name: /expand/i })).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Source report" }),
    ).toBeTruthy();
  });
});
