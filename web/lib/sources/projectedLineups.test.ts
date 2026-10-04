// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { publicProjectionReport, selectProjectedUnitSets, verifiedOriginalTweetUrl, type ProjectionReport } from "./projectedLineups";
import type { TweetUnit } from "./tweetInterpretation";
import { enrichTweetInjuryHistory, fetchTweetProjectionReports, persistTweetProjectionReports, projectedSetsToForecastRows, projectionReportFromSource } from "./tweetProjectionStorage";
import { extractTweetPlayerEvents } from "./tweetPlayerEvents";
import { interpretTweetUnits } from "./tweetInterpretation";
import { verifiedRetweetFromPayload } from "./tweetAttribution";
import { assignmentsFor } from "../player-forecasts/sourceObservations";
import { fetchLineCombinationSourceRowsForDate } from "./lineSourceLineCombinations";

function liveProjectionFixture(kind: "goalie" | "injury" | "pp", number = 1) {
  const publishedAt = `2026-10-04T15:0${number}:00Z`;
  const text = kind === "pp" ? `PP${number} tonight` : kind === "goalie" ? "Norris starts tonight" : "Norris out tonight";
  const interpretation = { ...report(`report-${number}`, number).interpretation, context: "game" as const,
    units: kind === "pp" ? [unit(number)] : [],
    events: kind === "pp" ? [] : extractTweetPlayerEvents({ text, players: [{ playerId: 2, fullName: "Josh Norris", lastName: "Norris", position: kind === "goalie" ? "G" : "C" }], publishedAt }),
  };
  const source: any = { snapshotDate: "2026-10-04", team: { id: 59, abbreviation: "UTA", name: "Utah Mammoth" },
    gameId: 2026020040, tweetId: `${number}`, sourceUrl: `https://x.com/reporter/status/${number}`,
    tweetPostedAt: publishedAt, observedAt: "2026-10-04T15:05:00Z", nhlFilterStatus: "accepted", rawText: text,
    sourceHandle: "RelayReporter", authorName: "Relay Reporter", metadata: { interpretation } };
  const snapshot: any = { capture_key: `raw:${number}`, source: "gamedaylines", source_group: "gdl_suite",
    source_key: "gamedaylines", source_account: "gamedaylines", snapshot_date: source.snapshotDate,
    tweet_id: source.tweetId, source_url: source.sourceUrl, tweet_url: source.sourceUrl,
    game_id: source.gameId, team_id: 59, team_abbreviation: "UTA", team_name: source.team.name,
    status: "observed", nhl_filter_status: "accepted", raw_text: text, metadata: source.metadata,
    observed_at: source.observedAt, tweet_posted_at: source.tweetPostedAt, updated_at: source.observedAt };
  return { source, snapshot };
}

function quotedProjectionFixture() {
  const fixture = liveProjectionFixture("goalie");
  Object.assign(fixture.source, { primaryTextSource: "quoted_oembed", quotedRawText: fixture.source.rawText,
    quotedTweetId: "99", quotedTweetUrl: "https://x.com/OrigReporter/status/99", quotedAuthorHandle: "OrigReporter", rawText: "Relay wrapper" });
  Object.assign(fixture.snapshot, { primary_text_source: "quoted_oembed", quoted_raw_text: fixture.source.quotedRawText,
    quoted_tweet_id: "99", quoted_tweet_url: fixture.source.quotedTweetUrl,
    quoted_author_handle: fixture.source.quotedAuthorHandle, raw_text: fixture.source.rawText });
  return fixture;
}

function projectionDatabase(fixtures: ReturnType<typeof liveProjectionFixture>[], sourceTable = "line_source_snapshots") {
  const tables = new Map<string, Map<string, any>>([[sourceTable, new Map(fixtures.map(({ snapshot }) => [snapshot.capture_key, structuredClone(snapshot)]))]]);
  const calls: string[] = [];
  const children = new Map<string, any>();
  const failures = { parent: false, acknowledgement: false, queue: false, readback: false };
  const db: any = {
    from: (table: string) => ({
      upsert: async (rows: any[], options: any) => {
        calls.push(`write:${table}`);
        if (table === "line_source_snapshots" && failures.parent) throw new Error("parent write failed");
        const stored = tables.get(table) ?? new Map();
        for (const row of rows) {
          if (table === "line_source_snapshots") {
            expect(row.source_account).toBeTruthy();
            expect(row.team_name).toBeTruthy();
            expect(row.team_abbreviation).toBeTruthy();
          }
          if (!options.ignoreDuplicates || !stored.has(row[options.onConflict])) stored.set(row[options.onConflict], structuredClone(row));
        }
        tables.set(table, stored);
        if (table === "line_source_snapshots" && failures.acknowledgement) { failures.acknowledgement = false; throw new Error("uncertain parent acknowledgement"); }
        return { error: null };
      },
      select: () => {
        const predicates: Array<(row: any) => boolean> = [];
        const result = () => { const data = [...(tables.get(table)?.values() ?? [])].filter((row) => predicates.every((filter) => filter(row))); return { data, count: data.length, error: null }; };
        const query: any = { eq: (key: string, value: any) => { predicates.push((row) => row[key] === value); return query; },
          in: (key: string, values: any[]) => { predicates.push((row) => values.includes(row[key])); return query; },
          gte: () => query, or: () => query, abortSignal: () => query,
          order: () => query, range: () => query, then: (resolve: any, reject: any) => {
            calls.push(`read:${table}`);
            if (table === "line_source_snapshots" && failures.readback) return Promise.reject(new Error("parent readback failed")).then(resolve, reject);
            return Promise.resolve(result()).then(resolve, reject);
          } };
        return query;
      },
    }),
    rpc: async (name: string, args: any) => {
      calls.push(`rpc:${name}`);
      if (name === "enqueue_player_forecast_job") {
        if (failures.queue) { failures.queue = false; return { error: new Error("queue failed") }; }
        return { error: null };
      }
      const observations = name === "capture_starter_board_lineup" ? [args.p_snapshot] : args.p_observations;
      for (const observation of observations) {
        if (!tables.get("line_source_snapshots")?.has(observation.source_capture_key)) throw new Error("23503 source capture FK");
        const key = `${name}:${observation.source_capture_key}:${observation.player_id ?? "lineup"}`;
        if (!children.has(key)) children.set(key, structuredClone(observation));
      }
      return { data: { insertedSnapshot: true, insertedAssignments: args.p_assignments?.length ?? 0, insertedObservations: observations.length, insertedConflicts: 0 }, error: null };
    },
  };
  return { db, tables, calls, children, failures };
}

function unit(number: number, overrides: Partial<TweetUnit> = {}): TweetUnit {
  return { situation: "pp", number, explicitNumber: true, complete: true, group: null, evidence: [],
    players: Array.from({ length: 5 }, (_, index) => ({ playerId: number * 10 + index, name: `Player ${number * 10 + index}` })), ...overrides };
}
function report(key: string, number: number, overrides: Partial<ProjectionReport> = {}): ProjectionReport {
  return { key, teamId: 59, teamAbbreviation: "UTA", gameId: null, session: "morning practice", date: "2026-09-18",
    publishedAt: "2026-09-18T15:00:00Z", originalPublishedAt: overrides.publishedAt === undefined ? "2026-09-18T15:00:00Z" : overrides.publishedAt, receivedAt: "2026-09-18T15:01:00Z", originalUrl: `https://x.com/reporter${number}/status/${number}`, text: "", interpretation: { version: "test", units: [unit(number)], unresolved: [], context: "practice", certainty: "reported" }, ...overrides };
}

describe("projected unit publishing", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
  function enableLivePublishing() {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-04T16:00:00Z"));
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true"); vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "true");
  }
  it.each(["goalie", "injury", "pp"] as const)("retains truthful %s derivation and reads parent before children", async (kind) => {
    enableLivePublishing();
    const fixtures = kind === "pp" ? [liveProjectionFixture(kind), liveProjectionFixture(kind, 2)] : [liveProjectionFixture(kind)];
    const database = projectionDatabase(fixtures);
    await persistTweetProjectionReports(database.db, fixtures.map(({ source }) => source));
    const parent = [...database.tables.get("line_source_snapshots")!.values()].find((row) => row.metadata.derived);
    expect(parent).toBeDefined(); expect(parent.source).toBe("tweet_projection");
    expect(parent.tweet_id).toBeNull(); expect(parent.quoted_tweet_id).toBeNull();
    expect(parent.source_handle).toBeNull(); expect(parent.author_name).toBeNull();
    expect(parent.metadata.sourceAccountKind).toBe("internal_derivation");
    expect(parent.raw_payload.sources.map((entry: any) => entry.snapshot).sort((a: any, b: any) => a.capture_key.localeCompare(b.capture_key)))
      .toEqual(fixtures.map(({ snapshot }) => snapshot));
    expect(new Set(parent.raw_payload.reports.map((row: any) => row.key))).toEqual(new Set(database.tables.get("tweet_projection_reports")!.keys()));
    expect(database.children.size).toBe(1);
    expect([...database.children.values()][0].source_account).toBeNull();
    expect(database.calls.indexOf("write:line_source_snapshots")).toBeLessThan(database.calls.lastIndexOf("read:line_source_snapshots"));
    expect(database.calls.lastIndexOf("read:line_source_snapshots")).toBeLessThan(database.calls.findIndex((call) => call.startsWith("rpc:capture_")));
    const downstream = await fetchLineCombinationSourceRowsForDate({ supabase: database.db, date: "2026-10-04" });
    expect(downstream.some((row) => row.capture_key === parent.capture_key)).toBe(false);
  });
  it.each(["direct","quoted"])("independent: rejects mismatched retained %s original identity", async (kind) => {
    enableLivePublishing();const fixture=liveProjectionFixture("goalie");
    if(kind==="quoted") {
      Object.assign(fixture.source,{primaryTextSource:"quoted_oembed",quotedRawText:fixture.source.rawText,
        quotedTweetUrl:"https://x.com/OrigReporter/status/99",quotedAuthorHandle:"OrigReporter",rawText:"Relay wrapper"});
      Object.assign(fixture.snapshot,{primary_text_source:"quoted_oembed",quoted_raw_text:fixture.source.quotedRawText,
        quoted_tweet_url:"https://x.com/DifferentReporter/status/88",quoted_author_handle:"DifferentReporter",raw_text:"Relay wrapper"});
    } else fixture.snapshot.source_url="https://x.com/DifferentReporter/status/88";
    const database=projectionDatabase([fixture]);
    await expect(persistTweetProjectionReports(database.db,[fixture.source])).rejects.toThrow(/lineage|identity|version/);
    expect(database.calls).not.toContain("write:line_source_snapshots");
    expect(database.children.size).toBe(0);
  });
  it.each(["quote_author", "quote_id", "quote_mode", "direct_missing_url", "direct_self_quote", "relay_url"])("rejects retained %s contradiction before publication", async (fault) => {
    enableLivePublishing(); const fixture = fault.startsWith("quote_") ? quotedProjectionFixture() : liveProjectionFixture("goalie");
    if (fault === "quote_author") fixture.snapshot.quoted_author_handle = "OtherAuthor";
    if (fault === "quote_id") fixture.snapshot.quoted_tweet_id = "88";
    if (fault === "quote_mode") { fixture.snapshot.primary_text_source = "ifttt_text"; fixture.snapshot.raw_text = fixture.source.quotedRawText; }
    if (fault === "direct_missing_url") fixture.snapshot.source_url = null;
    if (fault === "direct_self_quote") Object.assign(fixture.snapshot, { primary_text_source: "quoted_oembed",
      quoted_raw_text: fixture.source.rawText, quoted_tweet_url: fixture.source.sourceUrl, quoted_author_handle: "reporter" });
    if (fault === "relay_url") fixture.snapshot.tweet_url = "https://x.com/reporter/status/88";
    const database = projectionDatabase([fixture]);
    await expect(persistTweetProjectionReports(database.db, [fixture.source])).rejects.toThrow("lineage");
    expect(database.calls).not.toContain("write:line_source_snapshots"); expect(database.children.size).toBe(0);
  });
  it("uses validated retained quoted attribution instead of an incoming author label", async () => {
    enableLivePublishing(); const fixture = quotedProjectionFixture();
    fixture.source.quotedAuthorHandle = "WrongIncoming";
    const database = projectionDatabase([fixture]);
    await persistTweetProjectionReports(database.db, [fixture.source]);
    expect([...database.children.values()][0]).toMatchObject({ source_account: "origreporter",
      source_url: "https://x.com/OrigReporter/status/99", metadata: { originalAuthorKnown: true } });
  });
  it.each(["direct", "quoted"])("keeps %s pending attribution unresolved without inventing an original", async (mode) => {
    enableLivePublishing(); const fixture = mode === "quoted" ? quotedProjectionFixture() : liveProjectionFixture("goalie");
    if (mode === "quoted") {
      fixture.source.quotedTweetUrl = fixture.snapshot.quoted_tweet_url = "https://x.com/GameDayGoalies/status/99";
      fixture.source.quotedAuthorHandle = fixture.snapshot.quoted_author_handle = "GameDayGoalies";
    } else fixture.source.sourceUrl = fixture.snapshot.source_url = fixture.snapshot.tweet_url = "https://x.com/GameDayGoalies/status/1";
    const database = projectionDatabase([fixture]);
    await persistTweetProjectionReports(database.db, [fixture.source]);
    const child = [...database.children.values()][0];
    expect(child.source_account).toBeNull(); expect(child.source_url).toBeNull();
    if (mode === "quoted") expect(child.metadata.originalAuthorKnown).toBe(false);
    const parent = [...database.tables.get("line_source_snapshots")!.values()].find((row) => row.metadata.derived);
    expect(parent.raw_payload.reports[0]).toMatchObject({ originalUrl: null,
      provenance: { originalTweetId: null, attributionStatus: "pending" } });
  });
  it("retains CCC originals without claiming the derivation is an original source", async () => {
    enableLivePublishing(); const fixture = liveProjectionFixture("goalie");
    const database = projectionDatabase([fixture], "lines_ccc");
    await persistTweetProjectionReports(database.db, [fixture.source]);
    const parent = [...database.tables.get("line_source_snapshots")!.values()][0];
    expect(parent.raw_payload.sources).toEqual([{ table: "lines_ccc", snapshot: fixture.snapshot }]);
    expect(database.children.size).toBe(1);
  });
  it("preserves verified quoted goalie author attribution only on the child", async () => {
    enableLivePublishing(); const fixture = liveProjectionFixture("goalie");
    Object.assign(fixture.source, { primaryTextSource: "quoted_oembed", quotedRawText: fixture.source.rawText,
      quotedTweetUrl: "https://x.com/OrigReporter/status/99", quotedAuthorHandle: "OrigReporter", rawText: "Relay wrapper" });
    Object.assign(fixture.snapshot, { primary_text_source: "quoted_oembed", quoted_raw_text: fixture.source.quotedRawText,
      quoted_tweet_url: fixture.source.quotedTweetUrl, quoted_author_handle: fixture.source.quotedAuthorHandle, raw_text: fixture.source.rawText });
    const database = projectionDatabase([fixture]);
    await persistTweetProjectionReports(database.db, [fixture.source]);
    const parent = [...database.tables.get("line_source_snapshots")!.values()].find((row) => row.metadata.derived);
    expect(parent.quoted_author_handle).toBeNull(); expect(parent.primary_text_source).toBeNull();
    expect([...database.children.values()][0]).toMatchObject({ source_account: "origreporter",
      source_url: fixture.source.quotedTweetUrl, metadata: { originalAuthorKnown: true } });
  });
  it.each(["parent", "acknowledgement", "readback", "queue"] as const)("recovers %s partial failure without replacing immutable evidence", async (stage) => {
    enableLivePublishing(); const fixture = liveProjectionFixture("goalie"); const database = projectionDatabase([fixture]);
    database.failures[stage] = true;
    await expect(persistTweetProjectionReports(database.db, [fixture.source])).rejects.toThrow();
    if (stage !== "queue") expect(database.children.size).toBe(0);
    database.failures[stage] = false;
    const parentBefore = structuredClone([...database.tables.get("line_source_snapshots")!.values()].find((row) => row.metadata.derived));
    database.tables.get("line_source_snapshots")!.get(fixture.snapshot.capture_key).updated_at = "2026-10-04T16:01:00Z";
    await persistTweetProjectionReports(database.db, [{ ...fixture.source, observedAt: "2026-10-04T16:01:00Z" }]);
    expect(database.children.size).toBe(1);
    const parentAfter = [...database.tables.get("line_source_snapshots")!.values()].find((row) => row.metadata.derived);
    if (parentBefore) expect(parentAfter).toEqual(parentBefore);
    expect(Date.parse([...database.children.values()][0].available_at)).toBe(Date.parse(fixture.source.observedAt));
  });
  it.each(["missing", "ambiguous", "scope", "version", "text", "timing"])("rejects %s original lineage before parent/child publication", async (fault) => {
    enableLivePublishing(); const fixture = liveProjectionFixture("goalie"); const database = projectionDatabase([fixture]);
    const originals = database.tables.get("line_source_snapshots")!;
    if (fault === "missing") originals.clear();
    if (fault === "ambiguous") originals.set("second", { ...fixture.snapshot, capture_key: "second" });
    if (fault === "scope") originals.get(fixture.snapshot.capture_key).game_id++;
    if (fault === "version") originals.get(fixture.snapshot.capture_key).metadata.interpretation.version = "other";
    if (fault === "text") originals.get(fixture.snapshot.capture_key).raw_text = "different source text";
    if (fault === "timing") originals.get(fixture.snapshot.capture_key).observed_at = "2026-10-04T16:00:00Z";
    await expect(persistTweetProjectionReports(database.db, [fixture.source])).rejects.toThrow("lineage");
    expect(database.calls).not.toContain("write:line_source_snapshots"); expect(database.children.size).toBe(0);
  });
  it.each(["payload", "hash", "scope", "interpretation"])("rejects same-key different %s and preserves parent", async (fault) => {
    enableLivePublishing(); const fixture = liveProjectionFixture("goalie"); const database = projectionDatabase([fixture]);
    await persistTweetProjectionReports(database.db, [fixture.source]);
    const parent = [...database.tables.get("line_source_snapshots")!.values()].find((row) => row.metadata.derived);
    if (fault === "payload") parent.raw_payload.reports[0].text = "different evidence";
    if (fault === "hash") parent.metadata.provenanceHash = "different hash";
    if (fault === "scope") parent.team_id = 1;
    if (fault === "interpretation") parent.metadata.interpretation.version = "other";
    const before = structuredClone(parent); const rpcCount = database.calls.filter((call) => call.startsWith("rpc:")).length;
    await expect(persistTweetProjectionReports(database.db, [fixture.source])).rejects.toThrow("version conflict");
    expect(parent).toEqual(before); expect(database.calls.filter((call) => call.startsWith("rpc:"))).toHaveLength(rpcCount);
  });
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
