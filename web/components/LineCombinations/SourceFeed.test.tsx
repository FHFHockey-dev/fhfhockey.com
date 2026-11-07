import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SourceFeed from "./SourceFeed";
import { GENERIC_REVIEW_COPY, formatTime, originalPostUrl, reviewReasonCopy, reviewReasonsCopy, shortDate, sourceAuthor } from "./reviewReasonCopy";
import { fixtureGame, fixtureNext } from "lib/lines/testFixtures";
import type { SourceFeedItem } from "lib/lines/types";

afterEach(cleanup);

function item(id: string, overrides: Partial<SourceFeedItem> = {}): SourceFeedItem {
  return { id, originalIdentity: `original:${id}`, originalAuthor: "BoltsBeat", authorityTier: "beat", relays: [],
    text: `Lightning lines ${id}:\nMikheyev-Point-Kucherov`, publishedAt: "2026-10-01T22:34:00Z", ingestedAt: "2026-10-01T22:36:00Z",
    binding: { status: "bound", gameId: fixtureGame.id, evidence: ["explicit matchup"] }, context: "warmup", claimIds: [], sourceUrl: null, ...overrides };
}

describe("source feed", () => {
  it("shows text, both times, original author and authority tier without embeds", () => {
    const view = render(<SourceFeed items={[item("a", { originalIdentity: "77", sourceUrl: "https://x.com/CcCMiddleton/status/1" })]} games={[fixtureGame, fixtureNext]} teamAbbreviation="TBL" />);
    const row = within(screen.getByRole("list", { name: "TBL source posts" })).getAllByRole("listitem")[0]!;
    expect(within(row).getByText("@BoltsBeat")).toBeTruthy();
    expect(within(row).getByText("Beat reporter")).toBeTruthy();
    expect(within(row).getByText(/Mikheyev-Point-Kucherov/)).toBeTruthy();
    expect(Array.from(row.querySelectorAll("time")).map((time) => time.getAttribute("datetime"))).toEqual(["2026-10-01T22:34:00Z", "2026-10-01T22:36:00Z"]);
    expect(within(row).getByText(formatTime("2026-10-01T22:34:00Z"))).toBeTruthy();
    expect(within(row).getByText("Linked to Oct 1 · TBL at NYR · Warmup")).toBeTruthy();
    expect(within(row).getByRole("link", { name: /Open original post/ }).getAttribute("href")).toBe("https://x.com/BoltsBeat/status/77");
    expect(view.container.querySelector("iframe, blockquote.twitter-tweet")).toBeNull();
  });
  it("folds relays into the original without naming them and never calls a relay a confirmation", () => {
    render(<SourceFeed items={[item("a", { relays: [
      { account: "GameDayLines", relayTweetId: "9", relayPublishedAt: "2026-10-01T22:40:00Z", ingestedAt: "2026-10-01T22:41:00Z" },
      { account: "DFOFantasy", relayTweetId: null, relayPublishedAt: null, ingestedAt: "2026-10-01T22:42:00Z" },
    ] })]} games={[fixtureGame]} teamAbbreviation="TBL" />);
    expect(within(screen.getByRole("list", { name: "TBL source posts" })).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText(/GameDayLines|DFOFantasy/)).toBeNull();
    expect(screen.queryByRole("list", { name: "Reposted by" })).toBeNull();
    expect(screen.queryByText(/confirmed/i)).toBeNull();
    expect(screen.getByText(/never count as a second source/)).toBeTruthy();
  });
  it("states binding in plain words, handles missing times and authors, and sorts newest first", () => {
    render(<SourceFeed items={[
      item("old", { publishedAt: "2026-10-01T20:00:00Z", binding: { status: "unresolved", gameId: null, evidence: [] } }),
      item("new", { publishedAt: null, ingestedAt: "2026-10-01T23:00:00Z", originalAuthor: null, authorityTier: "unknown", context: null, binding: { status: "ambiguous", gameId: null, evidence: [] } }),
    ]} games={[fixtureGame]} teamAbbreviation="TBL" />);
    const rows = within(screen.getByRole("list", { name: "TBL source posts" })).getAllByRole("listitem");
    expect(rows[0]!.textContent).toContain("Original source not identified");
    expect(rows[0]!.textContent).toContain("Post time unknown");
    expect(rows[0]!.textContent).toContain("Could match more than one game");
    expect(rows[0]!.textContent).not.toContain("Unranked source");
    expect(rows[1]!.textContent).toContain("Not linked to a game yet");
  });
  it("never shows a relay account as the original author or links to a relay's post", () => {
    render(<SourceFeed items={[item("relay-only", { originalAuthor: "GameDayLines", authorityTier: "aggregator", originalIdentity: null, sourceUrl: "https://x.com/GameDayLines/status/3" })]} games={[fixtureGame]} teamAbbreviation="TBL" />);
    const row = within(screen.getByRole("list", { name: "TBL source posts" })).getAllByRole("listitem")[0]!;
    expect(row.textContent).toContain("Original source not identified");
    expect(row.textContent).not.toContain("@GameDayLines");
    expect(row.textContent).not.toContain("Lineup aggregator");
    expect(within(row).queryByRole("link")).toBeNull();
  });
  it("has a plain empty state", () => {
    render(<SourceFeed items={[]} games={[]} teamAbbreviation="TBL" />);
    expect(screen.getByText("No source posts yet.")).toBeTruthy();
  });
});

describe("review reason copy", () => {
  it("maps known codes to plain language", () => {
    expect(reviewReasonCopy("binding_decision_unverified")).toBe("We couldn't confirm which game this report is about.");
    expect(reviewReasonCopy("claim_phase_unresolved")).toBe("We couldn't tell whether this is from before or during the game.");
    expect(reviewReasonCopy("identity:Kuluch:missing_player")).toBe("\"Kuluch\" isn't matched to a player yet.");
    expect(reviewReasonCopy("identity:Kucherov:conflicting_membership")).toBe("\"Kucherov\" doesn't match the team's game roster.");
    expect(reviewReasonCopy("extraction:missing_player:Kuluch")).toBe("The report has a name we couldn't match to a player: \"Kuluch\".");
    expect(reviewReasonCopy("relation_target_unresolved:abc")).toBe("This correction points at a report we can't find.");
  });
  it("falls back to a generic line for unknown codes and unmapped engine sentences", () => {
    expect(reviewReasonCopy("brand_new_code")).toBe(GENERIC_REVIEW_COPY);
    expect(reviewReasonCopy("identity:Someone:new_status")).toBe("\"Someone\" needs a player match.");
    expect(reviewReasonCopy("Some internal flag sentence")).toBe(GENERIC_REVIEW_COPY);
    expect(reviewReasonsCopy(["x_unknown", "y_unknown"])).toEqual([GENERIC_REVIEW_COPY]);
  });
  it("hides the six relay handles as sources, case-insensitively, and keeps FHFHockey", () => {
    for (const handle of ["DFOFantasy", "DFO_Fantasy", "nhl_rosters", "@CcCMiddleton", "GameDayLines", "GameDayNewsNHL", "GameDayGoalies"]) expect(sourceAuthor(handle)).toBeNull();
    expect(sourceAuthor("@TBLightning")).toBe("TBLightning");
    expect(sourceAuthor("FHFHockey")).toBe("FHFHockey");
    expect(originalPostUrl("FHFHockey", null, "https://x.com/FHFHockey/status/8")).toBe("https://x.com/FHFHockey/status/8");
  });
  it("uses the site's short date style for game days without a time-zone shift", () => {
    expect(shortDate("2026-11-06")).toBe("Nov 6");
    expect(shortDate("2026-01-01")).toBe("Jan 1");
  });
});
