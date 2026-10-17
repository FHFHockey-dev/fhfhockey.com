// @vitest-environment node
import { describe, expect, it } from "vitest";
import { extractTweetPlayerEvents } from "./tweetPlayerEvents";
import { extractDurableTweetClaims, legacyTweetClaimAliases, type TweetClaimGame } from "./tweetClaimExtraction";
import { reduceTweetSemanticEvents } from "./tweetSemanticEvents";
import { captureForwardTweetClaimSample, evaluateForwardTweetClaims, evaluateForwardTweetClaimExport } from "./tweetClaimEvaluation";

const publishedAt = "2026-10-17T15:00:00Z", asOf = "2026-10-17T15:02:00Z";
const game: TweetClaimGame = { id: 2026020099, date: "2026-10-17", startTime: "2026-10-17T23:00:00Z", homeTeamId: 6, awayTeamId: 10 };
function source(text = "BOS Hart starts tonight."): any {
  return { snapshotDate: game.date, team: { id: 6, name: "Boston Bruins", abbreviation: "BOS" }, gameId: game.id,
    tweetId: "100", sourceHandle: "BeatWriter", sourceUrl: "https://x.com/BeatWriter/status/100", rawText: text,
    tweetPostedAt: publishedAt, observedAt: "2026-10-17T15:01:00Z", nhlFilterStatus: "accepted", detectedLeague: "NHL",
    metadata: { interpretation: { version: "legacy-v1", units: [], unresolved: [], context: "game", certainty: "confirmed",
      identityContext: { basis: "current_membership", sourcePublishedAt: publishedAt, eventRosterRevision: "fixture" },
      events: extractTweetPlayerEvents({ text, players: [{ playerId: 100, fullName: "Carter Hart", lastName: "Hart", position: "G", teamId: 6 }], publishedAt, claimAware: true }) } } };
}
const extract = (input = source(), scheduled: TweetClaimGame | null = game) => extractDurableTweetClaims({ source: input, game: scheduled, interpretedAt: asOf });

describe("automated durable claim extraction", () => {
  it("qualifies an explicit source-time team, dated game and confirmed starter automatically", () => {
    const claims = extract();
    expect(claims[0]!.semantic).toMatchObject({ fact: { kind: "starter", playerId: 100 }, support: { status: "supported" }, effectiveAt: game.startTime });
    expect(reduceTweetSemanticEvents(claims.map(item => item.semantic), asOf).actions).toHaveLength(1);
    expect(claims[0]!.directoryEvidence.every(item => item.status === "observed_context")).toBe(true);
  });
  it.each(["BOS Hart is expected to start tonight.", "BOS Hart is first goalie off at morning skate.", "BOS Hart is fully healthy.", "BOS Hart took rushes, no decision."])("does not confirm selection from %s", text => {
    expect(reduceTweetSemanticEvents(extract(source(text)).map(item => item.semantic), asOf).actions).toEqual([]);
  });
  it("keeps health, game availability and practice absence distinct", () => {
    const injury = extract(source("BOS Hart out tonight."))[0]!;
    expect(injury.semantic.fact).toEqual({ kind: "availability", playerId: 100, status: "out" });
    const absent = extract(source("BOS morning skate without Hart on the ice."))[0]!;
    expect(absent.semantic.fact).toEqual({ kind: "observation", playerId: 100, activity: "practice", present: false });
    expect(absent.semantic.evidence.text).toContain("without Hart");
    expect(absent.semantic.support.status).toBe("pending");
    expect(absent.aliases.some(item => item.version === 1 && item.key.startsWith("event:"))).toBe(true);
  });
  it("retains source bytes and first stable identity across retry interpretation times", () => {
    const input = source(), before = JSON.stringify(input), first = extract(input)[0]!;
    const retry = extractDurableTweetClaims({ source: input, game, interpretedAt: "2026-10-17T16:00:00Z" })[0]!;
    expect(JSON.stringify(input)).toBe(before); expect(first.source).toEqual(input);
    expect(retry.semantic.id).toBe(first.semantic.id); expect(retry.lineageKey).toBe(first.lineageKey);
  });
  it("preserves legacy report/event identities when governing qualifiers move offsets", () => {
    const input = source("BOS morning skate without Hart on the ice.");
    const claims = extract(input), interpretation = input.metadata.interpretation;
    const legacy = legacyTweetClaimAliases(input, interpretation, "100");
    expect(claims[0]!.aliases).toEqual(expect.arrayContaining(legacy));
    expect(legacy.at(-1)!.key).toMatch(new RegExp(`:100:${input.rawText.indexOf("Hart")}$`));
  });
  it("keeps unknown original, missing team/game, old membership and mismatched schedule held", () => {
    expect(extract({ ...source(), sourceUrl: "https://x.com/GameDayGoalies/status/100" })[0]!.semantic.original.tweetId).toBeNull();
    for (const input of [source("Hart starts tonight."), { ...source(), observedAt: "2026-10-19T15:01:00Z" }]) {
      expect(reduceTweetSemanticEvents(extract(input).map(item => item.semantic), "2026-10-19T16:00:00Z").actions).toEqual([]);
    }
    expect(reduceTweetSemanticEvents(extract(source(), { ...game, homeTeamId: 1, awayTeamId: 2 }).map(item => item.semantic), asOf).actions).toEqual([]);
  });
  it("retains provisional and verified derivations under one receipt lineage for reconciliation", () => {
    const pending = extract({ ...source(), sourceUrl: "https://x.com/GameDayLines/status/100" })[0]!;
    const verified = extract({ ...source(), sourceUrl: "https://x.com/GameDayLines/status/100", primaryTextSource: "quoted_oembed",
      quotedRawText: source().rawText, quotedTweetUrl: "https://x.com/BeatWriter/status/99", quotedTweetId: "99", quotedAuthorHandle: "BeatWriter",
      metadata: { ...source().metadata, wrapperPostedAt: "2026-10-17T15:00:30Z" } })[0]!;
    expect(pending.lineageKey).toBe(verified.lineageKey); expect(pending.semantic.id).not.toBe(verified.semantic.id);
    const reduced = reduceTweetSemanticEvents([pending.semantic, verified.semantic], asOf);
    expect(reduced.actions).toHaveLength(1); expect(reduced.observations).toHaveLength(2);
  });
});

describe("future evaluation capture and offline metrics", () => {
  const claims = extract();
  const cohort = { id: "future-v1", startsAt: "2026-10-17T00:00:00Z", extractionVersion: claims[0]!.extractionVersion };
  it("excludes the discovery corpus and delayed relays of old originals", () => {
    expect(captureForwardTweetClaimSample(claims, { ...cohort, startsAt: "2026-10-18T00:00:00Z" }, asOf)).toBeNull();
    expect(captureForwardTweetClaimSample([{ ...claims[0]!, semantic: { ...claims[0]!.semantic, receivedAt: "2026-10-16T12:00:00Z" } }], cohort, asOf)).toBeNull();
  });
  it("counts each origin once and requires complete frozen-document labels for recall", () => {
    const sample = captureForwardTweetClaimSample(claims, cohort, asOf)!;
    const labels = [{ sampleId: sample.id, documentHash: sample.documentHash, extractionVersion: sample.extractionVersion,
      labeledAt: "2026-10-18T12:00:00Z", complete: true, expectedClaimKeys: [sample.predictions[0]!.key, "missed-claim"], evidence: "fixture adjudication" }];
    expect(evaluateForwardTweetClaims([sample, { ...sample, id: "relay-copy" }], labels)).toMatchObject({ retainedReceipts: 2,
      distinctOriginDocuments: 1, labeledDocuments: 1, truePositive: 1, falseNegative: 1, precision: 1, recall: 0.5 });
    expect(evaluateForwardTweetClaims([sample], [{ ...labels[0]!, complete: false }]).recall).toBeNull();
    expect(evaluateForwardTweetClaims([sample], [...labels, ...labels]).labeledDocuments).toBe(0);
  });
  it("refuses retrospective cohorts, old/altered documents and parser drift in an offline export", () => {
    const sample = captureForwardTweetClaimSample(claims, cohort, asOf)!;
    const data = { cohorts: [{ ...cohort, registeredAt: "2026-10-16T12:00:00Z" }], samples: [sample], labels: [] };
    expect(evaluateForwardTweetClaimExport(data, "2026-10-18T00:00:00Z")).toMatchObject({ labeledDocuments: 0, state: "export_evaluated" });
    expect(() => evaluateForwardTweetClaimExport({ ...data, cohorts: [{ ...data.cohorts[0]!, registeredAt: "2026-10-17T12:00:00Z" }] }, asOf)).toThrow("before its future start");
    expect(() => evaluateForwardTweetClaimExport({ ...data, samples: [{ ...sample, text: "changed after capture" }] }, asOf)).toThrow("frozen prospective");
    expect(() => evaluateForwardTweetClaimExport({ ...data, samples: [{ ...sample, extractionVersion: "later-parser" }] }, asOf)).toThrow("frozen prospective");
  });
});
