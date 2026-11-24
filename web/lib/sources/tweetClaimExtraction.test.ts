// @vitest-environment node
import { describe, expect, it } from "vitest";
import { bilingualGameEvents } from "./bilingualGameReport";
import { interpretTweetUnits } from "./tweetInterpretation";
import { extractTweetPlayerEvents } from "./tweetPlayerEvents";
import { extractDurableTweetClaims, legacyTweetClaimAliases, type TweetClaimGame } from "./tweetClaimExtraction";
import { goalieDateRevision, readGoalieStartDay } from "./tweetGoalieStartDate";
import { compareInterpretationVersions } from "./interpretationVersion";
import { reviewTweetApplicability } from "./lineSourceProcessing";
import { projectionReportFromSource } from "./tweetProjectionStorage";
import { publicProjectionReport } from "./projectedLineups";
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
  it("retains two source dates through temporal selection and never assigns tomorrow's goalie to tonight", () => {
    // Retained original wording; the schedule ID and store below are isolated fixtures.
    const text = "No Foligno brothers tonight against the Sharks, chance for them to play tomorrow vs. TB, per John Hynes. \n\nWallstedt starts tonight, Pickard gets the nod tomorrow. #mnwild";
    const clock = "2026-11-06T16:33:32Z", report = source(text);
    Object.assign(report, { tweetPostedAt: clock, observedAt: clock, snapshotDate: "2026-11-06",
      team: { id: 30, abbreviation: "MIN", name: "Minnesota Wild" },
      tweetId: "2118743595977163244", sourceUrl: "https://x.com/WildJoeRadio/status/2118743595977163244" });
    const reading = report.metadata.interpretation;
    reading.identityContext = { basis: "publication_roster", sourcePublishedAt: clock, eventRosterRevision: "test" };
    const players = [{ playerId: 8482661, fullName: "Jesper Wallstedt", lastName: "Wallstedt", position: "G", teamId: 30 },
      { playerId: 8475717, fullName: "Calvin Pickard", lastName: "Pickard", position: "G", teamId: 30 }];
    reading.events = extractTweetPlayerEvents({ text, players, publishedAt: clock, claimAware: true });
    const today = { ...game, homeTeamId: 30, date: report.snapshotDate, startTime: "2026-11-07T01:00:00Z" };
    const read = () => extractDurableTweetClaims({ source: report, game: today, interpretedAt: clock });
    const initial = read();
    expect(initial.map(c => [c.semantic.fact?.kind, c.semantic.scope?.kind, c.semantic.reportedDay?.date]))
      .toEqual([["starter", "game", "2026-11-06"], ["starter", undefined, "2026-11-07"]]);
    reviewTweetApplicability([report], report.snapshotDate);
    expect(report.metadata.interpretation.events.map((e: { playerId: number }) => e.playerId)).toEqual([8482661]);
    const claims = read();
    expect(claims.map(c => [c.semantic.fact?.kind, c.semantic.scope?.kind, c.semantic.reportedDay?.date]))
      .toEqual([["starter", "game", "2026-11-06"], ["starter", undefined, "2026-11-07"]]);
    expect(claims[1]!.semantic).toMatchObject({ effectiveAt: null, support: { status: "pending" } });
    const projection = publicProjectionReport(JSON.parse(JSON.stringify(projectionReportFromSource(report))));
    expect(projection.interpretation.reportedGoalieDates?.map(v => [v.playerId, v.day.date]))
      .toEqual([[8482661, "2026-11-06"], [8475717, "2026-11-07"]]);
    expect(compareInterpretationVersions(report.metadata.interpretation.version.replace("legacy-v1", "2026-11-19.1"), "2026-11-19.1-line-date.2026-11-18.1")).toBeGreaterThan(0);
    const stored = projectionReportFromSource(report)!;
    expect(publicProjectionReport({ ...stored, originalPublishedAt: "2026-11-07T16:33:32Z" }).interpretation.reportedGoalieDates).toEqual([]);
    expect(publicProjectionReport({ ...stored, reviewReason: "conflicting_claims" }).interpretation.reportedGoalieDates).toEqual([]);
    const malformed = JSON.parse(JSON.stringify(stored));
    malformed.interpretation.reportedGoalieDates[0].playerName = 8482661;
    expect(publicProjectionReport(malformed).interpretation.reportedGoalieDates?.map(v => v.playerId)).toEqual([8475717]);
    const first = claims.map(c => c.semantic.id);
    reviewTweetApplicability([report], report.snapshotDate);
    expect(read().map(c => c.semantic.id)).toEqual(first);
  });
  it("resolves the dated roster team's local day across midnight and leaves a missing team unresolved", () => {
    const newer = "2026-11-19.1-line-date.2026-11-23.1";
    expect(goalieDateRevision(newer)).toBe(newer);
    const text = "Pickard starts tomorrow.", subject = { start: 0, end: 7, text: "Pickard" }, clause = { start: 0, end: text.length, text };
    expect(readGoalieStartDay(text, subject, clause, "2026-11-07T05:30:00Z", 30)).toMatchObject({
      relative: "tomorrow", date: "2026-11-07", timezone: "America/Chicago", evidence: { start: 15, end: 23, text: "tomorrow" },
    });
    expect(readGoalieStartDay(text, subject, clause, "2026-11-07T05:30:00Z", null)).toMatchObject({ relative: "tomorrow", date: null, timezone: null });
    expect(readGoalieStartDay(text, subject, clause, null, 30)?.date).toBeNull();
  });
  it.each(["Pickard tomorrow", "Pickard starts tonight or tomorrow", "Pickard starts tonight, unless Wallstedt is healthy",
    "Pickard starts tonight?", "Pickard was expected to start tomorrow", "Pickard backs him up tomorrow"])("withholds unsupported date qualification in %s", text => {
    const subject = { start: 0, end: 7, text: "Pickard" };
    expect(readGoalieStartDay(text, subject, { start: 0, end: text.length, text }, publishedAt, 30)).toBeNull();
    if (text.includes("unless")) {
      const end = text.indexOf(",");
      expect(readGoalieStartDay(text, subject, { start: 0, end, text: text.slice(0,end) }, publishedAt, 30)).toBeNull();
    }
  });
  it("qualifies an explicit source-time team, dated game and confirmed starter automatically", () => {
    const claims = extract();
    expect(claims[0]!.semantic).toMatchObject({ fact: { kind: "starter", playerId: 100 }, support: { status: "supported" }, effectiveAt: game.startTime });
    expect(reduceTweetSemanticEvents(claims.map(item => item.semantic), asOf).actions).toHaveLength(1);
    expect(claims[0]!.directoryEvidence.every(item => item.status === "observed_context")).toBe(true);
  });
  it.each(["BOS Hart is expected to start tonight.", "BOS Hart is first goalie off at morning skate.", "BOS Hart is fully healthy.", "BOS Hart took rushes, no decision."])("does not confirm selection from %s", text => {
    expect(reduceTweetSemanticEvents(extract(source(text)).map(item => item.semantic), asOf).actions).toEqual([]);
  });
  it("keeps a reported starter pending when either the opponent or puck-drop cutoff is unsupported", () => {
    const text = "#NHLBruins Jim Montgomery confirms Carter Hart will get the start tonight vs. the Maple Leafs.";
    const input = source(text), identity = input.metadata.interpretation.identityContext;
    identity.basis = "publication_roster";
    input.metadata.interpretation.events = extractTweetPlayerEvents({ text, publishedAt, includeClaimAnchors: true,
      players: [{ playerId: 100, fullName: "Carter Hart", lastName: "Hart", position: "G", teamId: 6 }], gameTeamIds: [6, 10] });
    const accepted = extract(input)[0]!;
    expect(accepted).toMatchObject({ extractionVersion: "2026-11-23.14", semantic: { fact: { kind: "starter", playerId: 100 },
      evidence: { text }, support: { status: "supported" } } });
    for (const result of [extract(input, null), extract(input, { ...game, awayTeamId: 8 }),
      extract({ ...input, observedAt: "2026-10-17T16:02:00Z" }, { ...game, startTime: "2026-10-17T16:00:00Z" })]) {
      expect(result[0]!.semantic.support).toMatchObject({ status: "pending", reason: "credited_start_game_unverified" });
    }
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

it("binds a lone absence to the club named immediately before the player and holds other handles", () => {
  const posted = "2026-11-12T22:00:00Z", observed = "2026-11-12T22:02:00Z";
  const scheduled = { ...game, date: "2026-11-12", homeTeamId: 68, awayTeamId: 19, startTime: "2026-11-13T02:00:00Z" };
  const player = { playerId: 8477951, fullName: "Nick Schmaltz", lastName: "Schmaltz", teamId: 68, position: "C" };
  const text = "INJURY UPDATE\n\n@utahmammoth forward Nick Schmaltz will not play tonight and is listed as day to day (lower-body)";
  const run = (value: string) => {
    const input = source(value);
    Object.assign(input, { team: { id: 68, abbreviation: "UTA", name: "Utah Mammoth" }, tweetPostedAt: posted, observedAt: observed });
    const i = input.metadata.interpretation;
    i.identityContext = { basis: "publication_roster", sourcePublishedAt: posted };
    i.events = extractTweetPlayerEvents({ text: value, players: [player], publishedAt: posted, gameTeamIds: [68, 19] });
    return extractDurableTweetClaims({ source: input, game: scheduled, interpretedAt: observed }).map(c => c.semantic);
  };
  expect(run(text)).toMatchObject([{ scope: { teamId: 68, gameId: game.id }, fact: { playerId: 8477951, status: "out" }, support: { status: "supported" } }]);
  for (const value of [text.replace("@utahmammoth", "@MapleLeafs"), text.replace("@utahmammoth forward ", ""), text.replace("forward", "opponent")]) {
    expect(run(value).some(c => c.support.status === "supported")).toBe(false);
  }
});

it("separates the tagged PP subject club from a tentative schedule link", () => {
  const first = "1-0 #NJDevils. The Devils scored on the power play.";
  const penalty = "Cole Hutson was called for holding against Rodrigues.";
  const text = [first, penalty, "PP1: Hughes, Bratt, Brown, Hischier & Meier"].join("\n\n");
  const names = ["Luke Hughes", "Jesper Bratt", "Connor Brown", "Nico Hischier", "Timo Meier"];
  const roster = names.map((fullName, i) => ({ playerId: i + 1, fullName, lastName: fullName.split(" ")[1]!, position: "F", teamId: 1 }));
  const read = (body: string) => {
    const row = source(body);
    row.team = { id: 1, name: "New Jersey Devils", abbreviation: "NJD" };
    row.metadata.interpretation = { ...interpretTweetUnits(body, roster),
      identityContext: { basis: "publication_roster", sourcePublishedAt: publishedAt, eventRosterRevision: "test" } };
    return extractDurableTweetClaims({ source: row, game: { ...game, homeTeamId: 1 }, interpretedAt: asOf })[0]!.semantic;
  };
  expect(read(text)).toMatchObject({ scope: null, effectiveAt: null, support: { status: "pending", reason: "reported_pp_game_unverified" },
    fact: { kind: "lineup", situation: "pp", units: [{ slot: "pp:1", playerIds: [1, 2, 3, 4, 5] }] } });
  expect(read(text.replace("#NJDevils", "#NJD"))).toMatchObject({ scope: null, effectiveAt: null, support: { status: "pending" } });
  expect(read(text.replace("#NJDevils", "#GoBolts")).support).toMatchObject({ status: "pending", reason: "source_time_team_not_explicit" });
});

it("only qualifies translated predicates after intake and before puck drop, with the original roster clock", () => {
  const text = "Owen Beck sera en uniforme ce soir face aux Leafs, tandis que Carter Hart sera le gardien partant.\n\nOwen Beck draws back into the lineup tonight against the Leafs, while Carter Hart will get the start in net.";
  const input = source(text), interpretation = input.metadata.interpretation;
  input.observedAt = "2026-10-17T15:01:00.000002Z";
  interpretation.identityContext.basis = "publication_roster";
  interpretation.events = bilingualGameEvents(text, [{ playerId: 100, fullName: "Carter Hart", lastName: "Hart", position: "G", teamId: 6 }],
    new Map([[6,game.id],[10,game.id]]), publishedAt, game.date, "BeatWriter", [])!.events;
  const check = (clock = asOf, scheduled = game) => extractDurableTweetClaims({ source: input, game: scheduled, interpretedAt: clock })[0]!.semantic.support.status;
  expect(check()).toBe("supported");
  expect(check("2026-10-17T15:01:00.000001Z")).toBe("pending");
  expect(check(asOf, { ...game, startTime: "2026-10-17T15:01:00.000001Z" })).toBe("pending");
  expect(check(asOf, { ...game, awayTeamId: 30 })).toBe("pending");
  interpretation.identityContext.sourcePublishedAt = asOf;
  expect(check()).toBe("pending");
  interpretation.identityContext.sourcePublishedAt = publishedAt;
  interpretation.events[0].state = "ruled_out";
  expect(check()).toBe("pending");
});
