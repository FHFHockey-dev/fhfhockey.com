// @vitest-environment node
import { describe, expect, it } from "vitest";
import { crossCheckTweetSourceCoverage, tweetClaimAttribution, type TweetSourceCoverage } from "./tweetSourceDirectory";

const source: any = { tweetId: "20", sourceUrl: "https://x.com/GameDayLines/status/20", rawText: "Wrapper @SomeoneElse",
  primaryTextSource: "quoted_oembed", quotedTweetId: "10", quotedTweetUrl: "https://x.com/BeatWriter/status/10",
  quotedAuthorHandle: "BeatWriter", quotedRawText: "BOS practice", tweetPostedAt: "2026-10-16T12:00:00Z" };
const entry: TweetSourceCoverage = { id: "e1", account: { accountKey: "x:id:123", accountId: "123", handle: "beatwriter" },
  handleValidFrom: "2025-01-01T00:00:00Z", handleValidUntil: null, effectiveFrom: "2026-01-01T00:00:00Z", effectiveUntil: null,
  knownAt: "2026-01-01T00:00:00Z", teamIds: [6], leagues: ["NHL"], scope: "team", status: "verified", confidence: 1,
  evidence: { url: "https://example.test/author-bio", excerpt: "Synthetic verified Boston assignment", basis: "fixture only" } };
const check = (entries: TweetSourceCoverage[], teamIds = [6], publishedAt = source.tweetPostedAt) => crossCheckTweetSourceCoverage({
  entries, attribution: tweetClaimAttribution(source), publishedAt, asOf: "2026-10-16T13:00:00Z", teamIds, league: "NHL" });

describe("dated original source directory", () => {
  it("credits a native Fx repost only while its original body, account, ID and clock agree", () => {
    const id = "2120699807933345894", name = "UtahMammoth_PR", body = "Forward Logan Cooley will not play tonight.";
    const url = `https://x.com/${name}/status/${id}`, stored = `https://twitter.com/i/web/status/${id}`;
    const at = "2026-11-12T02:06:49Z", relay = "GameDayNewsNHL";
    const fx = { id, author: { screen_name: name }, reposted_by: { screen_name: relay },
      raw_text: { text: body }, created_timestamp: Date.parse(at) / 1000 };
    const native: any = { primaryTextSource: "ifttt_text", sourceUrl: stored, tweetUrl: stored, tweetId: id, tweetPostedAt: at,
      sourceHandle: relay, rawText: `RT @${name}: ${body}`, metadata: { providerPostUrl: url }, rawPayload: { provider: "fxtwitter", fx } };
    expect(tweetClaimAttribution(native)).toMatchObject({ relationship: "retweet", originalTweetId: id,
      original: { handle: name.toLowerCase() }, relay: { handle: relay.toLowerCase() }, originalPublishedAt: at });
    for (const changed of [{ id: "99" }, { raw_text: { text: body + " Later correction." } }, { author: { screen_name: relay } },
      { created_timestamp: fx.created_timestamp + 1 }, { reposted_by: { screen_name: "Other" } }])
      expect(tweetClaimAttribution({ ...native, rawPayload: { provider: "fxtwitter", fx: { ...fx, ...changed } } }).status).toBe("pending");
    expect(tweetClaimAttribution({ ...native, rawPayload: { ...native.rawPayload, data: { id: "99" } } }).status).toBe("pending");
  });
  it("distinguishes quoting relay, quoted author and actual selected claim origin", () => {
    expect(tweetClaimAttribution(source)).toMatchObject({ relay: { handle: "gamedaylines" }, original: { handle: "beatwriter" },
      quoted: { handle: "beatwriter" }, originalTweetId: "10", relationship: "quote", quoteEndorsement: "not_asserted" });
    expect(tweetClaimAttribution({ ...source, primaryTextSource: "wrapper_oembed" }).original).toBeNull();
    expect(tweetClaimAttribution({ ...source, sourceUrl: "https://x.com/Reporter/status/20", primaryTextSource: "wrapper_oembed" }))
      .toMatchObject({ original: { handle: "reporter" }, quoted: { handle: "beatwriter" }, relationship: "direct" });
  });
  it.each(["GameDayGoalies", "GameDayNewsNHL", "CcCMiddleton"])("holds an original statement by relay %s", handle => {
    expect(tweetClaimAttribution({ ...source, sourceUrl: `https://x.com/${handle}/status/20`, primaryTextSource: "ifttt_text" }).status).toBe("pending");
  });
  it("refuses inconsistent quote author or post identity and unresolved RT text", () => {
    expect(tweetClaimAttribution({ ...source, quotedAuthorHandle: "Other" }).original).toBeNull();
    expect(tweetClaimAttribution({ ...source, quotedTweetId: "99" }).original).toBeNull();
    expect(tweetClaimAttribution({ ...source, sourceUrl: "https://x.com/Reporter/status/20", primaryTextSource: "ifttt_text", rawText: "RT @BeatWriter: BOS practice" }).status).toBe("pending");
  });
  it("keeps all relays of one quoted post in one origin group", () => {
    const identities = ["GameDayLines", "GameDayGoalies", "CcCMiddleton"].map(handle => tweetClaimAttribution({ ...source, sourceUrl: `https://x.com/${handle}/status/20` }));
    expect(new Set(identities.map(item => item.originalTweetId)).size).toBe(1);
  });
  it("uses dated verified coverage as a prior and surfaces a conflicting team", () => {
    expect(check([entry])).toMatchObject({ status: "consistent_prior", teamIds: [6], bindingAuthority: false });
    expect(check([entry], [10]).status).toBe("conflict");
    expect(check([{ ...entry, status: "candidate" }]).status).toBe("unresolved");
  });
  it("supports national writers, multi-team stories and one-to-many league coverage", () => {
    expect(check([{ ...entry, teamIds: [6, 10], scope: "multi_team" }], [6, 10]).status).toBe("consistent_prior");
    expect(check([{ ...entry, teamIds: [], scope: "national", leagues: ["NHL", "AHL"] }], [6, 10]).status).toBe("consistent_prior");
  });
  it("uses historical coverage and handle intervals, never today's assignment for old text", () => {
    const old = { ...entry, effectiveUntil: "2026-09-01T00:00:00Z" };
    const moved = { ...entry, id: "e2", effectiveFrom: "2026-09-01T00:00:00Z", teamIds: [10] };
    expect(check([old, moved], [6], "2026-08-01T12:00:00Z").status).toBe("consistent_prior");
    expect(check([old, moved], [6]).status).toBe("conflict");
    expect(check([{ ...entry, handleValidUntil: "2026-09-01T00:00:00Z" }]).status).toBe("unresolved");
    expect(check([{ ...entry, knownAt: "2026-10-17T00:00:00Z" }]).status).toBe("unresolved");
  });
  it("treats reassigned handles with conflicting account identities as unresolved conflict", () => {
    expect(check([entry, { ...entry, id: "e2", account: { ...entry.account, accountKey: "x:id:999", accountId: "999" } }]).status).toBe("conflict");
  });
});

it("credits a native FxTwitter repost only after its exact one-pass delivery normalization", async () => {
  const { verifiedFxSnapshotUrl } = await import("./tweetSourceDirectory");
  const id = "2119590903828430888", url = "https://x.com/InStilettos_NHL/status/" + id;
  const raw = "PP2: Hamilton, Evangelista, Gritsyuk, Meier &amp; Rodrigues";
  const row = { tweetId: id, sourceUrl: "https://twitter.com/i/web/status/" + id, sourceHandle: "GameDayLines",
    primaryTextSource: "ifttt_text" as const, rawText: "RT @InStilettos_NHL: " + raw.replace("&amp;", "&"),
    tweetPostedAt: "2026-11-09T00:40:26Z", metadata: { providerPostUrl: url }, rawPayload: { provider: "fxtwitter",
      fx: { id, author: {screen_name: "InStilettos_NHL"}, reposted_by: {screen_name: "GameDayLines"},
        raw_text: {text:raw}, created_timestamp:1794184826 } } };
  expect(verifiedFxSnapshotUrl(row)?.toLowerCase()).toBe(url.toLowerCase());
  expect(verifiedFxSnapshotUrl({...row, rawText:row.rawText.replace("Meier", "Hughes")})).toBeNull();
  expect(verifiedFxSnapshotUrl({...row, rawText:row.rawText.replace("RT @InStilettos_NHL", "RT @Other")})).toBeNull();
  expect(verifiedFxSnapshotUrl({...row, rawPayload:{...row.rawPayload,fx:{...row.rawPayload.fx,
    raw_text:{text:raw.replace("&amp;", "&amp;amp;")}}}})).toBeNull();
});
