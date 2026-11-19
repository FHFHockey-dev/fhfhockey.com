// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from "next";
import type { ReactNode } from "react";
import ProjectedLineups from "components/LineCombinations/ProjectedLineups";
import { lineTestDatabase } from "lib/lines/testDatabase";
import { interpretTweetUnits } from "lib/sources/tweetInterpretation";
import projected from "pages/api/v1/lines/projected";
import NewsPage, { getServerSideProps as readNewsPage } from "pages/news";
import { buildNewsLineupSnapshot } from "lib/newsLineupPresentation";

const db = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("lib/supabase/server", () => ({ default: db }));
vi.mock("next/script", () => ({ default: () => null }));
vi.mock("components/Layout/Container", () => ({ default: ({ children }: { children: ReactNode }) => children }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

function openTeam(teamId: number, date: string, rows: Record<string, unknown>[]) {
  vi.stubEnv("LINES_ENTRY_SERVING_ENABLED", "false");
  vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
  vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "true");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(date + "T21:00:00Z"));
  const store = lineTestDatabase({ tweet_projection_reports: rows });
  db.from.mockImplementation(store.from);
  let payload: any;
  vi.stubGlobal("fetch", async (url: string) => {
    const parsed = new URL(url, "http://localhost");
    expect(parsed.pathname).toBe("/api/v1/lines/projected");
    await projected({ method: "GET", query: Object.fromEntries(parsed.searchParams) } as NextApiRequest,
      { setHeader() {}, json(value: unknown) { payload = value; } } as unknown as NextApiResponse);
    return { ok: true, json: async () => payload };
  });
  render(<ProjectedLineups teamId={teamId} />);
  return { payload: () => payload, store };
}

it("renders the retained VGK report once with its original text, source and publication clock", async () => {
  // The archive is a bounded extract. Its stored interpretation has no events field.
  const rows = JSON.parse(readFileSync(resolve(process.cwd(), "../tasks/artifacts/drm-ddatv-2026-11-12/archive-public-sample.json"), "utf8"));
  const view = openTeam(54, "2026-11-08", rows);
  const link = await screen.findByRole("link", { name: "View original post" });
  expect(link.getAttribute("href")).toBe("https://x.com/ByMHarrington/status/2119520323309617358");
  expect(screen.getByText(/Colten Ellis vs Adin Hill in goal/)).toBeTruthy();
  const [report] = view.payload().reports;
  expect(view.payload().reports).toHaveLength(1);
  expect(report).toMatchObject({ teamId: 54, gameId: 2026020278, interpretation: { version: "2026-11-06.1" } });
  expect(link.closest("article")?.querySelector("time")?.dateTime).toBe(report.publishedAt);
  expect(view.payload().sets).toEqual([]);
  expect(view.store.writes).toEqual([]);
});

it("opens News with the released Anaheim units, game and clocks while the Islanders and practice cards stay source-only", async () => {
  // Reconstruct the local store from the retained correction receipt. The roster IDs and local row clocks are fixtures.
  const receipt = readFileSync(resolve(process.cwd(), "../tasks/artifacts/news-lineup-repair-2026-11-16/DRY-RUN.json"), "utf8");
  const [flames, islanders] = JSON.parse(receipt.replace(/\nDry run: no writes\.\s*$/, ""));
  const units: string[][] = flames.tiles.map(([, names]: [string, string]) => names.replace(" (D listed at F)", "").split("-"));
  const roster = units.flatMap((line, row) => line.map((fullName, index) => ({
    fullName, lastName: fullName.split(" ").pop()!, teamId: 24, playerId: 100 + row * 3 + index,
    position: row >= 4 || fullName === "Ian Moore" ? "D" : "F",
  })));
  // The retained FxTwitter body and old skater-only snapshot are documented in tweetNewsAutomation.test and the receipt.
  const sourceRows = units.map(line => line.map(name => name.split(" ").pop()).join("-"));
  const skaters = ["RT @ZachCav: Anaheim Ducks warm-up line rushes 11/15 vs. #Flames:", sourceRows.slice(0, 4).join("\n"),
    sourceRows.slice(4).join("\n")].join("\n\n");
  const text = skaters + "\n\nHusso | Dostál\n\nScratches: Colangelo, Vatrano, Mitchell";
  const snapshot = buildNewsLineupSnapshot({ interpretation: interpretTweetUnits(skaters, roster),
    teamId: 24, gameId: flames.gameId, sourceTweetId: flames.originalTweetId });
  const row = { team_id: 24, team_abbreviation: "ANA", source_account: "@ZachCav", source_label: "ZachCav",
    category: "LINE COMBINATION", subcategory: "FORWARD LINES", headline: "ANA forward lines", blurb: text,
    card_status: "published", published_at: "2026-11-16T00:40:00Z", observed_at: "2026-11-16T00:40:00Z" };
  const newsRows = [flames, islanders].map((card, index) => ({ ...row, id: card.itemId,
    source_url: `https://x.com/ZachCav/status/${card.originalTweetId}`, source_tweet_id: card.originalTweetId,
    source_review_item_id: index ? null : "ana-review",
    blurb: index ? "Ducks warmup lines vs. #Isles" : text.replace(/\s+/g, " ").slice(0, 277) + "...", metadata: index ? {} : { newsLineup: snapshot } }));
  const practice = { ...row, id: "930622e1", subcategory: "PRACTICE LINES", blurb: "Ducks practice lines", metadata: {} };
  const store = lineTestDatabase({ news_feed_items: [...newsRows, practice], tweet_pattern_review_items: [{ id: "ana-review", enriched_text: text }], games: [
    { id: flames.gameId, homeTeamId: 24, awayTeamId: 20, date: "2026-11-15" },
  ] });
  db.from.mockImplementation(store.from);
  const result = await readNewsPage({} as GetServerSidePropsContext);
  if (!("props" in result)) throw new Error("Expected News page props");
  const { container } = render(<NewsPage {...await result.props} />);
  expect(container.querySelectorAll('[data-line] > [data-role="forward"]')).toHaveLength(4);
  expect(container.querySelectorAll('[data-line] > [data-role="defense"]')).toHaveLength(3);
  expect(screen.getByText("D listed at F")).toBeTruthy();
  expect(screen.getByText("Noah Warren")).toBeTruthy();
  expect(container.querySelector("[data-starter]")).toBeNull();
  const article = screen.getByRole("heading", { name: /ANA forward lines vs. Calgary Flames · Game 2026020328/i }).closest("article")!;
  expect(within(article).getByText("Source posted Nov 15, 7:37 PM").getAttribute("datetime")).toBe("2026-11-16T00:37:13.259Z");
  expect(within(article).getByText("Observed Nov 15, 7:40 PM").getAttribute("datetime")).toBe("2026-11-16T00:40:00Z");
  for (const blurb of [newsRows[1]!.blurb, practice.blurb]) {
    const sourceOnly = screen.getByText(blurb).closest("article")!;
    expect(within(sourceOnly).getByText(/Structured lineup unavailable/)).toBeTruthy();
    expect(sourceOnly.querySelector("[data-role], [data-starter]")).toBeNull();
  }
  expect(store.writes).toEqual([]);
  expect(container.querySelector(`a[href="${newsRows[0]!.source_url}"]`)).toBeTruthy();
});

it.each([
  { mixed: false, sourceDate: "2026-11-17", showCurrent: false, flagged: false },
  { mixed: true, sourceDate: "2026-11-17", showCurrent: true, flagged: false },
  { mixed: true, sourceDate: "2026-11-17", showCurrent: false, flagged: true },
  { mixed: true, sourceDate: "2026-11-16", showCurrent: false, flagged: false },
])("opens Tampa News with mixed=$mixed, original date $sourceDate, flagged=$flagged, current visible=$showCurrent", async ({ mixed, sourceDate, showCurrent, flagged }) => {
  const text = "Tonight's matchup: Washington at Tampa Bay\nLines from Saturday's game (subject to change)\nForwards\nHagel-Guentzel-Kucherov\nGoaltenders\nVasilevskiy"
    + (mixed ? "\nTonight's lines\nForwards\nPaul-Point-Geekie" : "");
  const players = ["Hagel", "Guentzel", "Kucherov", "Vasilevskiy", "Paul", "Point", "Geekie"].map((name, index) => ({
    playerId: index + 1, fullName: name, lastName: name, teamId: 14, position: index === 3 ? "G" : "F",
  }));
  const interpretation = interpretTweetUnits(text, players);
  expect(interpretation.units.some(unit => unit.players.some(player => player.name === "Hagel"))).toBe(true);
  const posted = sourceDate + "T15:00:00Z";
  const sourceTweetId = ((BigInt(Date.parse(posted)) - BigInt("1288834974657")) << BigInt(22)).toString();
  const sourceUrl = `https://x.com/fixtureauthor/status/${sourceTweetId}`;
  const newsLineup = buildNewsLineupSnapshot({ interpretation, teamId: 14, gameId: 2026020334, sourceTweetId });
  if (flagged) newsLineup!.interpretation.unresolved = [{ situation: "es_forward", reason: "ambiguous" }];
  const item = { id: "tampa", source_review_item_id: "review", team_id: 14, team_abbreviation: "TBL", category: "LINE COMBINATION",
    subcategory: "FORWARD LINES", headline: "Tampa lines", source_account: "@fixtureauthor", source_url: sourceUrl,
    source_tweet_id: sourceTweetId, blurb: text.replace(/\s+/g, " "), metadata: { newsLineup }, card_status: "published",
    observed_at: "2026-11-17T15:02:00Z", published_at: "2026-11-17T18:00:00Z" };
  const store = lineTestDatabase({ news_feed_items: [item], tweet_pattern_review_items: [{ id: "review", enriched_text: text }],
    games: [{ id: 2026020334, date: "2026-11-17", homeTeamId: 14, awayTeamId: 15 }] });
  db.from.mockImplementation(store.from);
  const result = await readNewsPage({} as GetServerSidePropsContext);
  if (!("props" in result)) throw new Error("Expected News page props");
  const { container } = render(<NewsPage {...await result.props} />);
  const tiles = [...container.querySelectorAll("[data-line] > [data-role]")].map(tile => tile.textContent);
  expect(tiles.length).toBe(showCurrent ? 1 : 0);
  expect(tiles.join(" ")).not.toMatch(/Hagel|Guentzel|Kucherov|Vasilevskiy/);
  expect(container.querySelector("[data-starter]")).toBeNull();
  if (showCurrent) {
    for (const name of ["Paul", "Point", "Geekie"]) expect(screen.getByText(name)).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Washington Capitals · Game 2026020334/ })).toBeTruthy();
  } else {
    expect(screen.getByText(/Structured lineup unavailable/)).toBeTruthy();
    expect(screen.getByText(/Lines from Saturday/)).toBeTruthy();
  }
  expect(screen.getByRole("link", { name: /View original post/ }).getAttribute("href")).toBe(sourceUrl);
  expect(store.tables.news_feed_items).toEqual([item]);
  expect(store.writes).toEqual([]);
});

it("keeps an older stored Saturday lineup source visible without returning Tuesday tiles or a starter", async () => {
  const text = "Tonight's matchup: Washington at Tampa Bay\nLines from Saturday's game (subject to change)\nForwards\nHagel-Guentzel-Kucherov\nGoaltenders\nVasilevskiy";
  const players = ["Hagel", "Guentzel", "Kucherov", "Vasilevskiy"].map((name, index) => ({
    playerId: index + 1, fullName: name, lastName: name, teamId: 14, position: index === 3 ? "G" : "F",
  }));
  const interpretation = interpretTweetUnits(text, players);
  expect(interpretation.units.length).toBeGreaterThan(0);
  const report = { key: "legacy", date: "2026-11-17", teamId: 14, teamAbbreviation: "TBL", gameId: 2026020334,
    text, publishedAt: "2026-11-17T15:00:00Z", receivedAt: "2026-11-17T15:01:00Z", originalUrl: "https://x.com/fixtureauthor/status/123", interpretation };
  const view = openTeam(14, report.date, [{ report_key: report.key, report_date: report.date, team_id: 14, payload: report }]);
  await screen.findByText(/Lines from Saturday/);
  expect(screen.getByRole("link", { name: "View original post" }).getAttribute("href")).toBe(report.originalUrl);
  expect(view.payload().reports[0]).toMatchObject({ gameId: null, interpretation: { version: interpretation.version, units: [], events: [] } });
  expect(view.payload().sets).toEqual([]);
  expect(screen.queryByRole("list")).toBeNull();
  expect(view.store.tables.tweet_projection_reports![0]!.payload).toEqual(report);
});
