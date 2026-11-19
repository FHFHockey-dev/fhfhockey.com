import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import NewsCard, { formatNewsFanTime } from "./NewsCard";
import { teamsInfo } from "lib/teamsInfo";
import { getNewsItemTeamColors, getPublicNewsSourceAttribution, sanitizePublicNewsFeedItem } from "lib/newsFeed";
import receipt from "lib/sources/fixtures/homepageNewsReceipt.json";

const UNVERIFIED = "Player details not verified";

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

/** A validated public lineup: interpreter units bound to team 13 (and a game for game posts). */
const lineupMeta = (units: Array<[string, number | null, string[], boolean?]>, options: { context?: string; gameId?: number | null } = {}) => {
  const roster: string[] = [];
  let playerId = 0;
  const built = units.map(([situation, number, names, complete = true]) => ({ situation, number, complete,
    players: names.map((name) => { playerId++; roster.push(`${playerId}:${name}:${name}:13:C`); return { playerId, name }; }) }));
  return { newsLineup: { version: 1, binding: { teamId: 13, gameId: options.gameId ?? null, sourceTweetId: "1" },
    interpretation: { context: options.context ?? "practice", certainty: "reported", rosterRevision: roster.join("|"), units: built, unresolved: [] } } };
};

describe("NewsCard", () => {
  afterEach(cleanup);

  it.each(["GameDayLines", "GameDayGoalies", "GameDayNewsNHL", "CcCMiddleton", "DFOFantasy", "NHL_Rosters"])("does not leak ingest source %s through labels, links, titles or accessibility text", handle => {
    const { container } = render(<NewsCard item={makeItem({ source_label: handle, source_account: handle, source_url: `https://x.com/${handle}/status/123`,
      metadata: null })} sourceDisplayNameOverride={handle} />);
    expect(screen.getByText("Source link pending")).toBeTruthy();
    expect(container.innerHTML.toLowerCase()).not.toContain(handle.toLowerCase());
    expect(screen.queryByRole("link", { name: /original post/i })).toBeNull();
  });

  it("keeps observation and publication independent of creation time", () => {
    render(<NewsCard item={makeItem({ published_at: null, observed_at: "2026-07-14T18:19:20.000Z", source_label: null, source_account: "SOURCE_ACCOUNT", source_url: "not a URL", metadata: null })} />);
    // With no verified source clock, label the available observation.
    expect(screen.getByText("Observed Jul 14, 2:19 PM")).toBeTruthy();
    expect(screen.getByText("Published Unavailable · Observed Jul 14, 2:19 PM")).toBeTruthy();
    expect(screen.getByText("Source link pending")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /View original post/ })).toBeNull();
  });

  it("does not display malformed timestamps as dates", () => {
    render(<NewsCard item={makeItem({ published_at: "broken", observed_at: "broken" })} />);
    expect(screen.getByText("Observed Unavailable")).toBeTruthy();
    expect(screen.getByText("Published Unavailable · Observed Unavailable")).toBeTruthy();
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
      name: "View original post for Anaheim Ducks",
    });
    expect(sourceLink.getAttribute("href")).toBe(
      "https://x.com/FriedgeHNIC/status/2073877758803935434",
    );
    expect(sourceLink.getAttribute("target")).toBe("_blank");
    expect(screen.queryByText("Source")).toBeNull();
    expect(screen.getByText("Published Jul 14, 2:19 PM")).toBeTruthy();
    expect(screen.getByText(/^Published 7\/14\/2026, 2:19:20 PM · Observed/)).toBeTruthy();
    // No "Source report" chip; the post is the headline.
    expect(screen.queryByText(/source report/i)).toBeNull();
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
    expect(screen.getByRole("img", { name: "Chicago Blackhawks" })).toBeTruthy();

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.textContent).toContain("−");
    expect(screen.getByRole("img", { name: "Chicago Blackhawks" })).toBeTruthy();
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
        name: "View original post for Florida Panthers",
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

    expect(screen.getByRole("img", { name: "NHL" })).toBeTruthy();
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

    expect(screen.getByRole("img", { name: "ZZZ" }).querySelector("img")?.getAttribute("src")).toBe(
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
    // Unverified: the headline is the team, never the joined player.
    expect(screen.getByRole("heading", { name: "Florida Panthers" })).toBeTruthy();
    expect(screen.queryByText("Kevin He")).toBeNull();
    expect(screen.queryByText("Kevin He injury update")).toBeNull();
    expect(screen.getByText(/Mathew Barzal is with/)).toBeTruthy();
    // No interpretation was checked, so there is nothing to call unverified.
    expect(screen.queryByText(UNVERIFIED)).toBeNull();
    expect(screen.queryByText(/subject-to-claim/i)).toBeNull();
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
      screen.getByRole("heading", { name: "Florida Panthers" }),
    ).toBeTruthy();
  });
  // Retained sanitized receipt rows. Without an interpretation nothing was checked, so no unverified line shows; with
  // one that fails the check, the reader cannot say which part failed, so one plain line shows.
  const failingInterpretation = { version: "2026-10-13.1", events: [], unresolved: [{ reason: "ambiguous" }] };
  it.each(receipt.pageProps.recentInjuryNews.matches.flatMap(r => [[r.id, "no interpretation", 0, r], [r.id, "a failing interpretation", 1, r]] as const))("retained card %s with %s shows the unverified line %i time(s)", (_id, _variant, copies, row) => {
    const item = sanitizePublicNewsFeedItem({ ...row, blurb: row.blurb_prefix, source_label: null, source_account: null,
      metadata: { automation: { source: "tweet_news_phrase_dictionary", autoPublish: false, primaryRuleId: "manual-review" },
        ...(copies ? { interpretation: failingInterpretation } : {}) },
      players: row.players.map(p => ({ ...p, player_name: p.name })), card_status: "published" } as any);
    const { container } = render(<NewsCard item={item} />);
    expect(screen.getByRole("heading", { name: getNewsItemTeamColors(item.team_abbreviation).name })).toBeTruthy();
    expect(screen.queryAllByText(UNVERIFIED)).toHaveLength(copies);
    expect(container.textContent).not.toMatch(/subject-to-claim|claim evidence/i);
    expect(container.textContent).toContain(item.blurb.replace(/^RT @\w+:\s*/, "").slice(0, 20));
    for (const p of row.players) expect(screen.queryByText(new RegExp(`${p.name} ·`))).toBeNull();
    const url = getPublicNewsSourceAttribution({ item }).url;
    const link = screen.queryByRole("link", { name: /view original post/i });
    expect(link?.getAttribute("href") ?? null).toBe(url);
  });

  it("keeps a valid original-post link beside the unverified-details copy", () => {
    render(<NewsCard item={makeItem({ metadata: { interpretation: failingInterpretation } })} />);
    expect(screen.getByText(UNVERIFIED)).toBeTruthy();
    expect(screen.getByRole("link", { name: /view original post/i }).getAttribute("href")).toBe("https://x.com/FriedgeHNIC/status/2073877758803935434");
  });

  it("shows no unverified-details copy when the reader verifies a claim", () => {
    const text = "Victor Hedman will not play tonight.";
    render(<NewsCard item={makeItem({ category: "INJURY", subcategory: "OUT", headline: "ignored", blurb: text, metadata: { interpretation: {
      version: "2026-10-13.1", units: [], unresolved: [], events: [{ playerId: 8475167, playerName: "Victor Hedman", kind: "injury", state: "unknown",
        availability: "out", modality: "affirmative", evidence: { text, start: 0, end: text.length } }] } } })} />);
    expect(screen.getByText("Victor Hedman · Status unknown")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Victor Hedman" })).toBeTruthy();
    expect(screen.queryByText(UNVERIFIED)).toBeNull();
  });

  it("keeps lineup cards free of the unverified-details copy", () => {
    render(<NewsCard item={makeItem({ category: "LINE COMBINATION", subcategory: "PRACTICE LINES", team_id: 13,
      metadata: lineupMeta([["es_forward", 1, ["A", "B", "C"]]]) })} />);
    expect(screen.queryByText(UNVERIFIED)).toBeNull();
  });


  it.each(["NYR", "TOR", "ZZZ"])("uses %s's palette for the shared full and mini snapshot grids", (abbreviation) => {
    const item = makeItem({ team_abbreviation: abbreviation, category: "LINE COMBINATION", subcategory: "PRACTICE LINES", team_id: 13,
      metadata: lineupMeta([["es_forward", 1, ["Captured Player", "Second Player", "Third Player"]]]) });
    const { container } = render(<><NewsCard item={item} /><NewsCard item={item} compact rail /></>);
    const articles = container.querySelectorAll("article");
    for (const article of articles) {
      expect(article.style.getPropertyValue("--lineup-team-primary")).toBe(teamsInfo[abbreviation]?.primaryColor ?? "#56606c");
      expect(article.style.getPropertyValue("--lineup-team-secondary")).toBe(teamsInfo[abbreviation]?.jersey ?? "#88939e");
      expect(within(article).getByRole("group", { name: "Forwards" })).toBeTruthy();
      expect(within(article).getByText("Captured Player")).toBeTruthy();
      expect(within(article).queryByText("TBD")).toBeNull();
      expect(within(article).queryByText("Goalies")).toBeNull();
    }
    // Only the scrollable full grid is a named region (the rail's would
    // repeat one name per card).
    expect(within(articles[0] as HTMLElement).getByRole("region", { name: "Practice snapshot players" })).toBeTruthy();
    expect(within(articles[1] as HTMLElement).queryByRole("region")).toBeNull();
    expect(within(articles[0]).getAllByText("F1")).toHaveLength(3);
    expect(within(articles[1]).queryByText("F1")).toBeNull();
    expect(within(articles[1]).queryByText("Forwards")).toBeNull();
    expect(within(articles[1]).getByRole("group", { name: "F1: Captured Player" }).textContent).toBe("Captured Player");
    expect(within(articles[1]).getByText("Captured Player").getAttribute("title")).toBe("Captured Player");
  });

  it("says a warm-up card's lines are only reported, and hides the context line otherwise", () => {
    const warmup = lineupMeta([["es_forward", 1, ["A", "B", "C"]]], { context: "game", gameId: 2026020328 });
    (warmup.newsLineup.interpretation as Record<string, unknown>).lineContext = { context: "warmup", phase: "pregame", evidence: [] };
    const { rerender } = render(<NewsCard item={makeItem({ category: "LINE COMBINATION", subcategory: "FORWARD LINES", team_id: 13, metadata: warmup })} />);
    expect(screen.getByText("Warm-up snapshot · reported")).toBeTruthy();
    rerender(<NewsCard item={makeItem({ category: "LINE COMBINATION", subcategory: "PRACTICE LINES", team_id: 13,
      metadata: lineupMeta([["es_forward", 1, ["A", "B", "C"]]]) })} />);
    expect(screen.queryByText(/snapshot/)).toBeNull();
  });

  it("normalizes the supplied canonical team abbreviation without changing player identities", () => {
    const { container } = render(<NewsCard item={makeItem({ team_abbreviation: " nyr ", category: "LINE COMBINATION", team_id: 13,
      metadata: lineupMeta([["es_defense", 1, ["Historical Player", "Partner"]], ["es_forward", 1, ["Unverified"], false]]) })} compact rail />);
    expect(container.querySelector("article")?.style.getPropertyValue("--lineup-team-primary")).toBe(teamsInfo.NYR.primaryColor);
    expect(screen.getByText("Historical Player")).toBeTruthy();
    expect(screen.getByText(/Partial snapshot/)).toBeTruthy();
    expect(screen.queryByText("Unverified")).toBeNull();
  });

  it("shows all five supplied PP players and preserves source/time metadata", () => {
    render(<NewsCard compact rail item={makeItem({ category: "LINE COMBINATION", subcategory: "POWER PLAY",
      observed_at: "2026-07-14T18:19:20.000Z", team_id: 13,
      metadata: lineupMeta([["pp", 1, ["A", "B", "C", "D", "E"]]], { context: "game", gameId: 2026020001 }) })} />);
    expect(screen.getByRole("group", { name: "PP1" })).toBeTruthy();
    expect(screen.queryByText("PP1")).toBeNull();
    expect(screen.getByRole("group", { name: "PP1: E" }).textContent).toBe("E");
    expect(screen.queryByText("Forwards")).toBeNull();
    expect(screen.getByText("Observed Jul 14, 2:19 PM")).toBeTruthy();
    expect(screen.getByRole("link", { name: /original post/ })).toBeTruthy();
  });

  it("shows a missing PP snapshot honestly and leaves ordinary reports without a grid", () => {
    const { rerender } = render(<NewsCard compact rail item={makeItem({ category: "LINE COMBINATION", subcategory: "POWER PLAY",
      metadata: { lineupCard: { forwards: [["Do not relabel me"]] } } })} />);
    expect(screen.getByText("Structured lineup unavailable for this report. See the source report.")).toBeTruthy();
    expect(screen.queryByText("Do not relabel me")).toBeNull();
    rerender(<NewsCard compact rail item={makeItem()} />);
    expect(screen.queryByRole("region", { name: /snapshot players/ })).toBeNull();
    expect(screen.getByRole("heading")).toBeTruthy();
  });

  it("preserves review-only editing of missing goalie slots without creating public goalie placeholders", () => {
    const onLineupGoalieSlotClick = vi.fn();
    render(<NewsCard item={makeItem({ category: "LINE COMBINATION", metadata: {
      lineupCard: { forwards: [["Supplied Forward"]], goalies: [] },
    } })} onLineupGoalieSlotClick={onLineupGoalieSlotClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Set G2 goalie" }));
    expect(onLineupGoalieSlotClick).toHaveBeenCalledWith(1);
    expect(screen.queryByText("TBD")).toBeNull();
  });

  it("hides the pipeline published/observed pair in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    try {
      const { default: ProductionNewsCard } = await import("./NewsCard");
      render(<ProductionNewsCard item={makeItem({ observed_at: "2026-07-14T18:19:20.000Z" })} />);
      expect(screen.getByText("Observed Jul 14, 2:19 PM")).toBeTruthy();
      expect(screen.queryByText(/Published.*· Observed/)).toBeNull();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("titles lineup cards once, e.g. \"FLA practice lines\"", () => {
    render(<NewsCard compact rail item={makeItem({ category: "LINE COMBINATION", subcategory: "PRACTICE LINES",
      headline: "FLA line combination update", metadata: { lineupCard: { forwards: [["A", "B", "C"]] } } })} />);
    expect(screen.getByRole("heading", { name: "FLA practice lines" })).toBeTruthy();
    expect(screen.getAllByText(/FLA/)).toHaveLength(1);
    expect(screen.queryByText(/line combination/i)).toBeNull();
    expect(screen.queryByText("Practice snapshot")).toBeNull();
  });

  it("says how long ago today's posts were seen, and the date for older ones", () => {
    const now = Date.parse("2026-11-15T23:00:00.000Z"); // 6:00 PM New York
    expect(formatNewsFanTime("2026-11-15T22:42:00.000Z", now)).toBe("18m ago");
    expect(formatNewsFanTime("2026-11-15T19:30:00.000Z", now)).toBe("3h ago");
    expect(formatNewsFanTime("2026-11-15T22:59:40.000Z", now)).toBe("Just now");
    expect(formatNewsFanTime("2026-11-14T23:44:00.000Z", now)).toBe("Nov 14, 6:44 PM");
    expect(formatNewsFanTime("2026-11-15T22:42:00.000Z", null)).toBe("Nov 15, 5:42 PM");
  });
});

it("renders a roster-confirmed initials match from shared intake after the player has changed teams", async () => {
  vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
  try {
    const { buildLinesCccSourceFromIftttEvent, toLinesCccRow } = await import("lib/sources/linesCccIngestion");
    const { buildTeamDirectory } = await import("lib/sources/lineupSourceIngestion");
    const { buildTweetNewsAutomationCandidate } = await import("lib/sources/tweetNewsAutomation");
    const at = "2026-11-17T20:00:00.123001Z";
    const text = "Detroit Red Wings: MBN will not play tonight due to injury.";
    const player = { playerId: 101, fullName: "Michael Brandsegg-Nygård", lastName: "Brandsegg-Nygård", position: "RW", teamId: 17 };
    const rosterByTeam = new Map([[17, [player]]]);
    const source = buildLinesCccSourceFromIftttEvent({ teams: buildTeamDirectory([{ id: 17, abbreviation: "DET", name: "Detroit Red Wings", logo: "" }]),
      snapshotDate: "2026-11-17", rosterByTeam, inferenceRosterByTeam: rosterByTeam, inferencePublishedAt: at,
      event: { id: "example", source: "ifttt", source_account: "Reporter", username: "Reporter", text, tweet_id: "123",
        tweet_created_at: at, received_at: at, raw_payload: {}, created_at_label: null, link_to_tweet: "https://x.com/Reporter/status/123" } });
    const row = toLinesCccRow({ source, rosterEntries: [player] });
    expect(row.tweet_posted_at).toBe(at);
    const { syncTweetPatternReviewItems } = await import("pages/api/v1/db/tweet-pattern-review");
    const { lineTestDatabase } = await import("lib/lines/testDatabase");
    // The local PostgREST fixture accepts the two selected metadata projections as input columns.
    const db = lineTestDatabase({ lines_ccc: [{ ...row, interpretation: row.metadata.interpretation,
      intake_roster_evidence: row.metadata.intakeRosterEvidence }] });
    await syncTweetPatternReviewItems({ supabase: db, perSourceLimit: 1 });
    const review = db.tables.tweet_pattern_review_items?.[0];
    expect(review?.metadata.intakeRosterEvidence.publishedAt).toBe(at);
    const candidate = buildTweetNewsAutomationCandidate({ row: review, players: [
      { id: 101, fullName: player.fullName, lastName: player.lastName, position: "RW", team_id: 3 },
      { id: 102, fullName: "Other Player", position: "RW", team_id: 17, aliases: ["MBN"] },
    ] });
    expect(candidate?.playerAssignments).toEqual([{ playerId: 101, playerName: player.fullName, teamId: 17 }]);
    const players = candidate!.playerAssignments.map(p => ({ player_id: p.playerId, player_name: p.playerName, team_id: p.teamId }));
    const item = sanitizePublicNewsFeedItem(makeItem({ headline: candidate!.headline, blurb: candidate!.blurb,
      category: candidate!.category, subcategory: candidate!.subcategory, team_abbreviation: "DET", metadata: candidate!.metadata, players,
      published_at: at, source_url: row.source_url, source_account: "Reporter" }));
    const view = render(<NewsCard item={item} />);
    expect(view.container.textContent).toContain(text);
    expect(view.container.textContent).toMatch(/Michael Brandsegg-Nygård ·/);
    expect(view.container.textContent).not.toContain("Other Player");
    const noTeam = { ...item, players: players.map(p => ({ ...p, team_id: 3 })) } as typeof item;
    view.rerender(<NewsCard item={noTeam} />);
    expect(view.container.textContent).not.toMatch(/Michael Brandsegg-Nygård ·/);
  } finally {
    vi.unstubAllEnvs();
  }
});
