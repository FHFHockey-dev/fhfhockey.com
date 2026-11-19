// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { lineTestDatabase } from "lib/lines/testDatabase";
import { createLineSourceRosterContext } from "./lineSourceRosterContext";
import { buildLinesCccSourceFromIftttEvent, type LinesCccIftttEventInput } from "./linesCccIngestion";
import { buildTeamDirectory, type TeamDirectoryEntry } from "./lineupSourceIngestion";
import type { TweetInterpretation } from "./tweetInterpretation";

const teams = [
  { id: 4, abbreviation: "PHI", name: "Philadelphia Flyers", logo: "", slug: "philadelphia-flyers", hashtags: [], location: "Philadelphia", shortName: "Flyers" },
  { id: 21, abbreviation: "COL", name: "Colorado Avalanche", logo: "", slug: "colorado-avalanche", hashtags: [], location: "Colorado", shortName: "Avalanche" },
] satisfies TeamDirectoryEntry[];
const seasonId = 20262027;
const trade = "2026-11-18T17:00:00.000001Z";
const before = "2026-11-18T17:00:00.000000Z";
const players = { fullName: "Jean-Luc Foudy", lastName: "Foudy", position: "C" };
const roster = (teamId: number, playerId: number, created_at: string, ended_at: string | null = null) =>
  ({ teamId, playerId, seasonId, players, created_at, ended_at, is_current: !ended_at });
const event = (when: string | null, author = "amandacstein"): LinesCccIftttEventInput => ({
  id: "queue-1", source: "ifttt", source_account: author, username: author, text: "JLF is skating.",
  link_to_tweet: "https://x.com/amandacstein/status/12345", tweet_id: "12345", tweet_created_at: when, created_at_label: null,
  received_at: "2026-11-19T15:00:00Z", raw_payload: {},
});

afterEach(() => vi.unstubAllEnvs());

describe("line source publication-time context", () => {
  it("uses half-open membership intervals at Postgres precision on the original, with historical aliases and one season read", async () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const db = lineTestDatabase({
      rosters: [roster(4, 100, "2026-07-01T04:00:00Z", trade), roster(21, 100, trade),
        roster(4, 101, before), roster(21, 101, before),
        { ...roster(4, 102, before), is_current: false }, roster(4, 103, "2026-11-20T04:00:00Z")],
      tweet_player_memberships: ["camp", "roster", "organization"].map((kind, index) => ({
        team_id: 21, player_id: 200 + index, season_id: seasonId, membership_kind: kind, verified_at: before, expires_at: trade, players,
      })),
      lineup_player_name_aliases: [
        { team_id: null, player_id: 100, alias: "After", updated_at: trade },
        { team_id: null, player_id: 100, alias: "Before", updated_at: before },
      ],
    });
    const exactFrom = db.from;
    const supabase = { from: (table: string) => {
      const q = exactFrom(table);
      if (table === "lineup_player_name_aliases") q.or = () => q;
      return q;
    } };
    const loader = createLineSourceRosterContext(supabase, teams, "2026-11-19");
    const current = event(trade);
    const first = await loader.forReport(current);
    expect(first.inferencePublishedAt).toBe(trade);
    expect(first.rosterByTeam.get(21)?.map((p) => p.playerId)).toEqual([100]);
    expect(first.inferenceRosterByTeam?.get(21)?.find((p) => p.playerId === 100)?.aliases).toEqual(["After", "Before"]);
    const quoted = await loader.forReport(current, {
      snapshotDate: "2026-11-18", nhlFilterStatus: "rejected_ambiguous", primaryTextSource: "quoted_oembed", quotedTweetId: "56789", quotedAuthorHandle: "bellefraser1",
      metadata: { quotedRetrievalStatus: "x_api_success", quotedPostedAt: before },
    });
    expect(quoted.inferencePublishedAt).toBe(before);
    expect(quoted.rosterByTeam.get(4)?.map((p) => p.playerId)).toEqual([100]);
    expect(quoted.rosterByTeam.get(21)?.map((p) => p.playerId)).toEqual([200, 201, 202]);
    expect(quoted.inferenceRosterByTeam?.get(21)?.map((p) => p.playerId)).toEqual([101, 201]);
    expect(quoted.inferenceRosterByTeam?.get(4)?.find((p) => p.playerId === 100)?.aliases).toEqual(["Before"]);
    expect(quoted.inferenceRosterByTeam?.get(4)?.some((p) => p.playerId === 101)).toBe(true);
    expect(exactFrom.mock.calls.filter(([table]) => table === "rosters")).toHaveLength(1);

    const wrapperOnly = { ...current, text: "RT @Reporter: JLF is skating." };
    const wrapper = await loader.forReport(wrapperOnly);
    expect(wrapper.inferenceRosterByTeam).toBeUndefined();
    expect(wrapper.inferencePublishedAt).toBeUndefined();
    const crossLinkedQuote = await loader.forReport(current, {
      snapshotDate: "2026-11-18", nhlFilterStatus: "rejected_ambiguous", primaryTextSource: "quoted_oembed",
      quotedTweetId: "2049560345441206272", quotedTweetUrl: "https://x.com/reporter/status/2108958735309865096",
    });
    expect(crossLinkedQuote.inferencePublishedAt).toBeUndefined();
  });

  it("withholds future manual, role and registry names from ordinary injury events and initials", async () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const clubs = buildTeamDirectory([{ id: 17, name: "Detroit Red Wings", abbreviation: "DET", logo: "" }]);
    const db = lineTestDatabase({
      rosters: ["Michael Brandsegg-Nygård", "Dylan Larkin", "Lucas Raymond"].map((name, index) => ({
        ...roster(17, index + 1, "2026-07-01T04:00:00Z"), players: { fullName: name, lastName: name.split(" ").at(-1), position: "C" },
      })),
      lineup_player_name_aliases: [
        { player_id: 2, team_id: 17, alias: "MBN", updated_at: trade },
        { player_id: 2, team_id: 17, alias: "RoleLater", position_group: "F", updated_at: trade },
        { player_id: 2, team_id: 17, alias: "RoleNow", position_group: "F", updated_at: before },
      ],
      fhfh_player_identities: [
        { id: 10, nhl_player_id: 2, canonical_name: "OldFull", verification_status: "verified", verified_at: before, updated_at: before },
        { id: 11, nhl_player_id: 3, canonical_name: "Unexpected", verification_status: "verified", verified_at: trade, updated_at: before },
      ],
      fhfh_player_identity_aliases: [
        { id: 71, fhfh_player_id: 10, alias: "Nugget", verification_status: "verified", updated_at: trade },
        { id: 72, fhfh_player_id: 10, alias: "Ghost", verification_status: "verified" },
        { id: 73, fhfh_player_id: 10, alias: "Larks", verification_status: "verified", updated_at: before },
        { id: 74, fhfh_player_id: 11, alias: "Wingspan", verification_status: "verified", updated_at: before },
      ],
    });
    const loader = createLineSourceRosterContext({ from: (table: string) => {
      const q = db.from(table);
      if (table === "lineup_player_name_aliases") q.or = () => q;
      return q;
    } }, clubs, "2026-11-18");
    const raw = event(before, "AnsarKhanMLive");
    const context = await loader.forReport(raw);
    for (const directory of [context.rosterByTeam, context.inferenceRosterByTeam!]) {
      expect(directory.get(17)?.find((p) => p.playerId === 2)).toMatchObject({
        aliases: ["OldFull", "Larks"], roleAliases: [{ alias: "RoleNow", role: "es_forward" }],
      });
      expect(directory.get(17)?.find((p) => p.playerId === 3)?.aliases).toEqual([]);
    }
    const eventsFor = async (name: string) => {
      const report = { ...raw, text: `Detroit Red Wings: ${name} will not play tonight due to injury.` };
      const source = buildLinesCccSourceFromIftttEvent({ event: report, teams: clubs, snapshotDate: "2026-11-18", ...context });
      const { candidate } = await loader.refresh(report, source, new Map());
      return (candidate.metadata?.interpretation as TweetInterpretation).events?.map((e) => e.playerId);
    };
    expect(await eventsFor("MBN")).toEqual([1]);
    expect(await eventsFor("Larks")).toEqual([2]);
    for (const name of ["Nugget", "Ghost", "Unexpected", "Wingspan"]) expect(await eventsFor(name)).toEqual([]);
    const after = await loader.forReport({ ...raw, tweet_created_at: trade });
    expect(after.rosterByTeam.get(17)?.find((p) => p.playerId === 2)?.aliases).toEqual(["OldFull", "Nugget", "Larks", "MBN"]);
  });

  it("uses prior distinct single-team originals only for an unreviewed byline and honours negative reviews", async () => {
    const previous = "2026-11-18T12:00:00Z";
    const sample = (id: string, author = "rinkreport", team = "COL") => ({
      status: "observed", nhl_filter_status: "accepted", classification: "lineup", snapshot_date: "2026-11-17",
      capture_key: id, provenance: { originalTweetId: id, originalAuthor: author }, labels: [team], team_abbreviation: team,
      observed_at: previous, updated_at: previous, tweet_posted_at: previous,
    });
    const db = lineTestDatabase({ rosters: [roster(21, 100, "2026-08-01T10:00:00Z")], line_source_snapshots: [
      sample("100"), sample("101"), sample("101"), sample("102", "differentauthor"), sample("12345"),
      { ...sample("104"), labels: ["PHI", "COL"] }, { ...sample("105"), observed_at: "2026-11-19T12:00:00Z" },
    ] });
    const supabase = { from: (table: string) => {
      const q = db.from(table);
      if (table === "line_source_snapshots") {
        q.or = () => q; // The fixture has projected JSON bylines; the reader rechecks them after the SQL filter.
        q.abortSignal = () => q;
      }
      return q;
    } };
    const get = async (author: string, loader = createLineSourceRosterContext(supabase, teams, "2026-11-19"),
      text = "JLF is skating.", when = before) => {
      const raw = { ...event(when, author), text };
      const base = buildLinesCccSourceFromIftttEvent({ event: raw, teams, snapshotDate: "2026-11-18", ...await loader.forReport(raw) });
      const { candidate } = await loader.refresh(raw, base, new Map());
      return candidate;
    };
    const reason = (source: Awaited<ReturnType<typeof get>>) =>
      (source.metadata?.name_inference_review as { reason: string }[])[0]?.reason;
    expect(reason(await get("rinkreport"))).toBe("team_unresolved");
    db.tables.line_source_snapshots!.push({ ...sample("106", "other"), primary_text_source: "quoted_oembed",
      quoted_tweet_id: "999", quoted_author_handle: "rinkreport" } as any);
    const loader = createLineSourceRosterContext(supabase, teams, "2026-11-19");
    const inferred = await get("rinkreport", loader);
    expect(reason(inferred)).toBe("beat_only");
    const reads = db.from.mock.calls.filter(([t]) => t === "line_source_snapshots").length;
    expect(reason(await get("rinkreport", loader, undefined, "2026-11-18T10:00:00Z"))).toBe("team_unresolved");
    await get("FHFHockey");
    await get("GameDayLines");
    const { BEAT_REPORTER_REVIEWS } = await import("lib/lines/beatReporters");
    await get(BEAT_REPORTER_REVIEWS.find((row) => row.verdict === "not_beat")!.handle);
    await get("rinkreport", loader, "#Avs lines: JLF is skating.");
    await get("rinkreport", loader, "Practice this morning.");
    expect(db.from.mock.calls.filter(([t]) => t === "line_source_snapshots")).toHaveLength(reads);
    const broken = { from: (table: string) => {
      if (table === "line_source_snapshots") throw Error("offline");
      return supabase.from(table);
    } };
    const failed = await get("rinkreport", createLineSourceRosterContext(broken, teams, "2026-11-19"));
    expect(reason(failed)).toBe("team_unresolved");
    expect(failed.metadata?.inferred_beat_history_status).toBe("unavailable");
    db.tables.line_source_snapshots!.push(sample("501", "leaguebeat", "COL"), sample("502", "leaguebeat", "PHI"), sample("503", "leaguebeat", "TOR"));
    expect(reason(await get("leaguebeat"))).toBe("team_unresolved");
    db.tables.rosters!.push(...[4, 21].map((team, i) => ({ ...roster(team, 300 + i, "2026-08-01T10:00:00Z"),
      players: { fullName: i ? "James Lee Smith" : "John Luke Smith", lastName: "Smith", position: "C" } })));
    const ambiguity = createLineSourceRosterContext(supabase, teams, "2026-11-19");
    for (const [token, expected] of [["Smith", "ambiguous_name"], ["JLS", "ambiguous_initials"]]) {
      const source = await get("rinkreport", ambiguity, `${token} will not play tonight due to injury.`);
      expect(source.metadata?.name_inference_review).toEqual(expect.arrayContaining([
        expect.objectContaining({ rawName: token, teamId: 21, reason: expected, candidatePlayerIds: [300, 301] }),
      ]));
      expect((source.metadata?.interpretation as TweetInterpretation | undefined)?.events ?? []).toEqual([]);
    }
    for (const author of ["reporta", "reportb", "reportc", "reportd"]) await get(author, loader);
    const overBudget = await get("reporte", loader);
    expect(overBudget.metadata?.inferred_beat_history_status).toBe("budget_reached");
  });
});
