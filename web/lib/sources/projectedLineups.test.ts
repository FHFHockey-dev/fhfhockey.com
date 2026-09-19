// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { selectProjectedUnitSets, verifiedOriginalTweetUrl, type ProjectionReport } from "./projectedLineups";
import type { TweetUnit } from "./tweetInterpretation";
import { persistTweetProjectionReports, projectedSetsToForecastRows, projectionReportFromSource } from "./tweetProjectionStorage";
import { verifiedRetweetFromPayload } from "./tweetAttribution";
import { assignmentsFor } from "../player-forecasts/sourceObservations";

function unit(number: number, overrides: Partial<TweetUnit> = {}): TweetUnit {
  return { situation: "pp", number, explicitNumber: true, complete: true, group: null, evidence: [],
    players: Array.from({ length: 5 }, (_, index) => ({ playerId: number * 10 + index, name: `Player ${number * 10 + index}` })), ...overrides };
}
function report(key: string, number: number, overrides: Partial<ProjectionReport> = {}): ProjectionReport {
  return { key, teamId: 59, teamAbbreviation: "UTA", gameId: null, session: "morning practice", date: "2026-09-18",
    publishedAt: "2026-09-18T15:00:00Z", originalPublishedAt: overrides.publishedAt === undefined ? "2026-09-18T15:00:00Z" : overrides.publishedAt, receivedAt: "2026-09-18T15:01:00Z", originalUrl: `https://x.com/reporter${number}/status/${number}`, text: "", interpretation: { version: "test", units: [unit(number)], unresolved: [], context: "practice", certainty: "reported" }, ...overrides };
}

describe("projected unit publishing", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("pairs cross-reporter complementary units atomically", () => {
    const sets = selectProjectedUnitSets([report("a", 1), report("b", 2, { publishedAt: "2026-09-18T16:00:00Z" })]);
    expect(sets).toHaveLength(1);
    expect(sets[0]?.units.map((entry) => entry.number)).toEqual([1, 2]);
    expect(sets[0]?.reports).toHaveLength(2);
  });
  it.each([
    { date: "2026-09-17", publishedAt: "2026-09-17T15:00:00Z" },
    { session: "afternoon practice" },
    { publishedAt: "2026-09-18T16:31:00Z" },
    { publishedAt: null },
    { originalPublishedAt: null },
    { gameId: 10 },
  ])("does not join unrelated occasions: %j", (other) => {
    expect(selectProjectedUnitSets([report("a", 1), report("b", 2, other)])).toEqual([]);
  });
  it("requires explicit session and unit labels; keeps camp groups separate", () => {
    expect(selectProjectedUnitSets([report("a", 1, { session: null }), report("b", 2, { session: null })])).toEqual([]);
    const second = report("b", 2); second.interpretation.units[0]!.group = "b";
    expect(selectProjectedUnitSets([report("a", 1), second])).toEqual([]);
    second.interpretation.units[0]!.group = null; second.interpretation.units[0]!.explicitNumber = false;
    expect(selectProjectedUnitSets([report("a", 1), second])).toEqual([]);
  });
  it("leaves contradictory units in review instead of choosing a convenient pair", () => {
    const conflicting = report("c", 1);
    conflicting.interpretation.units[0]!.players[0]!.playerId = 500;
    expect(selectProjectedUnitSets([report("a", 1), report("b", 2), conflicting])).toEqual([]);
  });
  it("chooses newest complete report, not latest receipt or incomplete first report", () => {
    const older = report("old", 1); older.interpretation.units.push(unit(2));
    const newer = report("new", 1, { publishedAt: "2026-09-18T17:00:00Z" }); newer.interpretation.units.push(unit(2));
    expect(selectProjectedUnitSets([report("partial", 1), newer, older])[0]?.reports[0]?.key).toBe("new");
  });
  it("never passes relay URLs or guesses an original author from a generic URL", () => {
    expect(verifiedOriginalTweetUrl("https://x.com/GameDayLines/status/123")).toBeNull();
    expect(verifiedOriginalTweetUrl("https://twitter.com/i/web/status/123")).toBeNull();
    expect(verifiedOriginalTweetUrl("https://twitter.com/i/web/status/123", "reporter")).toBe("https://x.com/reporter/status/123");
  });
  it("adapts a complete cross-reporter pair to game forecasts and excludes camp", () => {
    const game = { gameId: 2026010001, session: null };
    const first = report("a", 1, game), second = report("b", 2, game);
    first.interpretation.context = second.interpretation.context = "game";
    const rows = projectedSetsToForecastRows(selectProjectedUnitSets([first, second]));
    expect(rows).toHaveLength(1);
    expect(assignmentsFor(rows[0]!).map((assignment) => assignment.unit_number)).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 2, 2]);
    first.interpretation.context = second.interpretation.context = "camp";
    expect(projectedSetsToForecastRows(selectProjectedUnitSets([first, second]))).toEqual([]);
  });
  it("preserves history without performing forecast writes on historical replay", async () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "true");
    const calls: string[] = [];
    const database = { from: (table: string) => { calls.push(table); return { upsert: async () => ({ error: null }) }; } };
    await persistTweetProjectionReports(database, [{ snapshotDate: "2020-01-01", tweetPostedAt: "2020-01-01T15:00:00Z", team: { id: 59, abbreviation: "UTA" }, gameId: 2020010001,
      nhlFilterStatus: "accepted", rawText: "PP1 report", metadata: { interpretation: report("a", 1).interpretation } } as any]);
    expect(calls).toEqual(["tweet_projection_reports"]);
    vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "false");
    await persistTweetProjectionReports(database, []);
    expect(calls).toHaveLength(1);
  });
  it("keeps deterministic ingestion keys and known source times separate from receipt", () => {
    const source = { snapshotDate: "2026-09-18", tweetPostedAt: "2026-09-18T15:00:00Z", team: { id: 59, abbreviation: "UTA" },
      nhlFilterStatus: "accepted", rawText: "PP1 report", sourceUrl: "https://x.com/GameDayLines/status/123", metadata: { interpretation: report("a", 1).interpretation } } as any;
    const first = projectionReportFromSource(source)!;
    const replay = projectionReportFromSource({ ...source, observedAt: "2026-09-18T20:00:00Z" })!;
    expect(first.key).toBe(replay.key);
    expect(first.originalUrl).toBeNull();
    expect(first.originalPublishedAt).toBeNull();
    expect(replay.publishedAt).toBe(first.publishedAt);
  });
  it("accepts verified retweet references only when the original text matches", () => {
    const candidate = { ...report("a", 1), text: "RT @reporter: Utah PP1 report", provenance: { relayTweetId: "123", originalTweetId: null, attributionStatus: "pending" as const } };
    const payload = { data: { id: "123", referenced_tweets: [{ id: "456", type: "retweeted" }] }, includes: { tweets: [{ id: "456", author_id: "7", text: "Utah PP1 report", created_at: "2026-09-18T14:00:00Z" }], users: [{ id: "7", username: "reporter" }] } };
    expect(verifiedRetweetFromPayload(payload, candidate)).toMatchObject({ url: "https://x.com/reporter/status/456", publishedAt: "2026-09-18T14:00:00Z" });
    payload.data.referenced_tweets[0]!.type = "quoted";
    expect(verifiedRetweetFromPayload(payload, candidate)).toBeNull();
  });
});
