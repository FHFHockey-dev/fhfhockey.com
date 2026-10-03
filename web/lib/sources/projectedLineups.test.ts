// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { publicProjectionReport, selectProjectedUnitSets, verifiedOriginalTweetUrl, type ProjectionReport } from "./projectedLineups";
import type { TweetUnit } from "./tweetInterpretation";
import { enrichTweetInjuryHistory, fetchTweetProjectionReports, persistTweetProjectionReports, projectedSetsToForecastRows, projectionReportFromSource } from "./tweetProjectionStorage";
import { extractTweetPlayerEvents } from "./tweetPlayerEvents";
import { interpretTweetUnits } from "./tweetInterpretation";
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
    const reordered = report("reordered", 1, { publishedAt: "2026-09-18T15:30:00Z" });
    reordered.interpretation.units[0]!.players.reverse();
    expect(selectProjectedUnitSets([report("a", 1), report("b", 2), reordered])).toEqual([]);
    expect(selectProjectedUnitSets([reordered, report("b", 2), report("a", 1)])).toEqual([]);
  });
  it("chooses newest complete report, not latest receipt or incomplete first report", () => {
    const older = report("old", 1); older.interpretation.units.push(unit(2));
    const newer = report("new", 1, { publishedAt: "2026-09-18T17:00:00Z" }); newer.interpretation.units.push(unit(2));
    expect(selectProjectedUnitSets([report("partial", 1), newer, older])[0]?.reports[0]?.key).toBe("new");
  });
  it("withholds contradictory complete reports tied at the same publication time", () => {
    const first = report("first", 1, { gameId: 10 }); first.interpretation.units.push(unit(2));
    const second = report("second", 1, { gameId: 10 }); second.interpretation.units.push(unit(2));
    second.interpretation.units[0]!.players[0]!.playerId = 500;
    expect(selectProjectedUnitSets([first, second])).toEqual([]);
    expect(selectProjectedUnitSets([second, first])).toEqual([]);
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
  it("retains immutable versions, dedupes retries and withholds tentative availability under mocked storage", async () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "true");
    const tables = new Map<string, Map<string, any>>();
    const database = { from: (table: string) => ({
      upsert: async (rows: any[], options: any) => {
        expect(options.ignoreDuplicates).toBe(true);
        const stored = tables.get(table) ?? new Map();
        for (const row of rows) if (!stored.has(row[options.onConflict])) stored.set(row[options.onConflict], structuredClone(row));
        tables.set(table, stored); return { error: null };
      },
      select: () => {
        const query: any = { eq: () => query, order: () => query, range: async () => ({ data: [...(tables.get(table)?.values() ?? [])], error: null }) };
        return query;
      },
    }) };
    const text = "Org is hopeful Norris will play this weekend.";
    const interpretation = interpretTweetUnits(text, [{ playerId: 2, fullName: "Josh Norris", lastName: "Norris" }]);
    interpretation.events = extractTweetPlayerEvents({ text, players: [{ playerId: 2, fullName: "Josh Norris", lastName: "Norris" }], publishedAt: "2020-01-01T15:00:00Z" });
    const source = { snapshotDate: "2020-01-01", tweetPostedAt: "2020-01-01T15:00:00Z", team: { id: 9, abbreviation: "OTT" },
      nhlFilterStatus: "accepted", rawText: text, sourceUrl: "https://x.com/reporter/status/123", metadata: { interpretation } } as any;
    await persistTweetProjectionReports(database, [source, source]);
    const first = structuredClone([...tables.get("tweet_projection_reports")!.values()][0]);
    await persistTweetProjectionReports(database, [{ ...source, observedAt: "2020-01-01T18:00:00Z" }]);
    expect(tables.get("tweet_projection_reports")!.size).toBe(1);
    expect(tables.get("tweet_player_events")!.size).toBe(1);
    await persistTweetProjectionReports(database, [{ ...source, metadata: { interpretation: { ...interpretation, version: "replay-version" } } }]);
    expect(tables.get("tweet_projection_reports")!.size).toBe(2);
    expect([...tables.get("tweet_projection_reports")!.values()][0]).toEqual(first);
    expect([...tables.get("tweet_player_events")!.values()].every((row) => row.availability === "uncertain")).toBe(true);
    const selected = await fetchTweetProjectionReports(database, { date: "2020-01-01", internal: true });
    expect(selected).toHaveLength(1);
    expect(selectProjectedUnitSets(selected)).toEqual([]);
  });
  it("abstains on tied conflicting history instead of choosing health by query order", async () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const queriedTables: string[] = [];
    const database = { from: (table: string) => {
      queriedTables.push(table);
      const query: any = { select: () => query, eq: () => query, lt: () => query, in: () => query, order: () => query,
        limit: async () => ({ data: [{ availability: "available", published_at: "2020-01-01T12:00:00Z" }, { availability: "out", published_at: "2020-01-01T12:00:00Z" }], error: null }) };
      return query;
    } };
    const interpretation = interpretTweetUnits("Norris injured", []);
    interpretation.events = extractTweetPlayerEvents({ text: "Norris injured", players: [{ playerId: 2, fullName: "Josh Norris", lastName: "Norris" }], publishedAt: "2020-01-01T15:00:00Z" });
    await enrichTweetInjuryHistory(database, [{ tweetPostedAt: "2020-01-01T15:00:00Z", nhlFilterStatus: "accepted", metadata: { interpretation } } as any]);
    expect(interpretation.events).toMatchObject([{ state: "unknown", reviewReason: "conflicting_history" }]);
    expect(queriedTables).toEqual(["tweet_player_events"]);
  });
  it("marks public evidence offsets as belonging to the unsanitized source", () => {
    const source = report("a", 1);
    source.interpretation.events = extractTweetPlayerEvents({ text: "RT @reporter: Norris will play tonight.", players: [{ playerId: 2, fullName: "Josh Norris", lastName: "Norris" }], publishedAt: null });
    expect(publicProjectionReport(source).interpretation.events![0]!.evidence.offsetBasis).toBe("unsanitized_source");
  });
  it("does not let a warmup or hopeful return clear prior injury history", async () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const lessThan = vi.fn();
    const database = { from: () => { const query: any = { select: () => query, eq: () => query, lt: (...args: any[]) => { lessThan(...args); return query; },
      in: () => query, order: () => query, limit: async () => ({ data: [{ availability: "out" }], error: null }) }; return query; } };
    const text = "Norris remains out. Org is hopeful he will play this weekend.";
    const interpretation = interpretTweetUnits(text, []);
    interpretation.events = extractTweetPlayerEvents({ text, players: [{ playerId: 2, fullName: "Josh Norris", lastName: "Norris" }], publishedAt: "2020-01-01T15:00:00Z" });
    const source = { tweetPostedAt: "2020-01-01T15:00:00Z", nhlFilterStatus: "accepted", metadata: { interpretation } } as any;
    await enrichTweetInjuryHistory(database, [source]);
    expect(lessThan).toHaveBeenCalledWith("published_at", source.tweetPostedAt);
    expect(interpretation.events[0]!.availability).not.toBe("available");
    expect(interpretation.events[0]!.state).not.toBe("confirmed_return");
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
