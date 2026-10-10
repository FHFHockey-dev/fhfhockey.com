// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { classifyGameDayTweet } from "./lineupSourceIngestion";
import { interpretTweetUnits, requiresRelativeGameDateReview, segmentPlayerRow } from "./tweetInterpretation";
import { classifyInjuryEvent, extractInjuryTimeline, extractInjuryTimelines, extractTweetPlayerEvents } from "./tweetPlayerEvents";
import { assignmentsFor } from "../player-forecasts/sourceObservations";
import { buildLinesCccSourceFromIftttEvent } from "./linesCccIngestion";
import { reconcileAlias } from "./tweetAliasReconciliation";

describe("BOS standard lineup identity regression", () => {
  afterEach(() => vi.unstubAllEnvs());
  // Identities/positions retained with the Oct. 8 source; the bare alias caused the error.
  const bruins = [
    [8479987, "Morgan Geekie", "Geekie", "C"], [8478401, "Pavel Zacha", "Zacha", "C"],
    [8477956, "David Pastrnak", "Pastrnak", "R"], [8482177, "Marat Khusnutdinov", "Khusnutdinov", "C"],
    [8483489, "Fraser Minten", "Minten", "C"], [8482175, "JJ Peterka", "Peterka", "R"],
    [8485395, "James Hagens", "Hagens", "C"], [8477496, "Elias Lindholm", "Lindholm", "C"],
    [8479999, "Casey Mittelstadt", "Mittelstadt", "C"], [8479661, "Tanner Jeannot", "Jeannot", "L"],
    [8483505, "Matthew Poitras", "Poitras", "C"], [8480355, "Mark Kastelic", "Kastelic", "C"],
    [8476374, "Sean Kuraly", "Kuraly", "C"], [8476867, "Brendan Gaunce", "Gaunce", "C"],
    [8479591, "Michael Eyssimont", "Eyssimont", "C"], [8476854, "Hampus Lindholm", "Lindholm", "D"],
    [8478840, "Will Borgen", "Borgen", "D"], [8477507, "Nikita Zadorov", "Zadorov", "D"],
    [8477365, "Connor Clifton", "Clifton", "D"], [8483017, "Frederic Brunet", "Brunet", "D"],
    [8482511, "Mason Lohrei", "Lohrei", "D"], [8481219, "Jonathan Aspirot", "Aspirot", "D"],
    [8479325, "Charlie McAvoy", "McAvoy", "D"], [8480280, "Jeremy Swayman", "Swayman", "G"],
    [8480022, "Michael DiPietro", "DiPietro", "G"],
  ].map(([playerId, fullName, lastName, position]) => ({
    playerId: Number(playerId), fullName: String(fullName), lastName: String(lastName),
    position: String(position), teamId: 6,
    aliases: playerId === 8476854 ? ["Hampus Lindholm", "HLindholm", "Lindholm"] : [],
  }));
  const priorText = "RT @smclaughlin9: Bruins lines in warmups:\n\nGeekie-Zacha-Pastrnak\nKhusnutdinov-Minten-Peterka\nMittelstadt-Lindholm-Hagens\nJeannot-Poitras-Kastelic\n\nLindholm-Borgen\nZadorov-Clifton\nBrunet-Lohrei\n\nSwayman";
  const practiceText = "Bruins practice lines:\nGeekie-Zacha-Pastrnak\nKhusnutdinov-Minten-Peterka\nHagens-E. Lindholm-Mittelstadt\nJeannot-Poitras-Kastelic\nKuraly\n\nH. Lindholm-Borgen\nZadorov-Clifton\nBrunet-Lohrei\nAspirot-McAvoy\n\nSwayman\nDiPietro";
  const spansMatch = (text: string, units: ReturnType<typeof interpretTweetUnits>["units"]) => {
    for (const unit of units) for (const span of unit.evidence) expect(text.slice(span.start, span.end)).toBe(span.text);
  };

  it("resolves the actual Oct. 8 forward Lindholm as Elias, retaining the raw source identity", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const tweetId = "2108326534352429473";
    const source = buildLinesCccSourceFromIftttEvent({
      event: { id: "fd3e6f2d-a469-4a60-94a9-b37f89ac28ea", source: "ifttt",
        source_account: "GameDayLines", username: "GameDayLines", text: priorText,
        link_to_tweet: `https://x.com/GameDayLines/status/${tweetId}`, tweet_id: tweetId,
        tweet_created_at: "2026-10-08T22:39:00Z", created_at_label: null,
        raw_payload: { text: priorText }, received_at: "2026-10-08T22:45:45.080289Z" },
      snapshotDate: "2026-10-08",
      teams: [{ id: 6, abbreviation: "BOS", name: "Boston Bruins", shortName: "Bruins",
        location: "Boston", slug: "boston-bruins", logo: "/teamLogos/BOS.png", hashtags: ["NHLBruins"] }],
      rosterByTeam: new Map([[6, bruins]]), gameIdByTeamId: new Map([[6, 2026020056]]),
    });
    expect(source.forwards![2]).toEqual(["Casey Mittelstadt", "Elias Lindholm", "James Hagens"]);
    expect(source.defensePairs![0]).toEqual(["Hampus Lindholm", "Will Borgen"]);
    expect(source).toMatchObject({ tweetId, rawText: priorText, team: { id: 6 }, gameId: 2026020056 });
    expect(source).toMatchObject({ rawPayload: { text: priorText }, observedAt: "2026-10-08T22:45:45.080289Z", tweetPostedAt: "2026-10-08T22:39:00.000Z" });
    const interpretation = source.metadata!.interpretation as ReturnType<typeof interpretTweetUnits>;
    spansMatch(priorText, interpretation.units);
  });

  it("keeps four forward triplets, three defense pairs and ordered goalies while preserving excluded evidence", () => {
    const result = interpretTweetUnits(practiceText, bruins);
    expect(result.context).toBe("practice");
    expect(result.units.filter((u) => u.situation === "es_forward")).toHaveLength(4);
    expect(result.units.filter((u) => u.situation === "es_defense")).toHaveLength(3);
    expect(result.units.filter((u) => u.situation === "goalie").flatMap((u) => u.players.map((p) => p.playerId))).toEqual([8480280, 8480022]);
    expect(result.units.flatMap((u) => u.players.map((p) => p.playerId)).filter((id) => [8476374, 8481219, 8479325].includes(id))).toEqual([]);
    expect(result.excludedUnits).toMatchObject([{ situation: "es_defense", number: 4,
      players: [{ playerId: 8481219 }, { playerId: 8479325 }] }]);
    spansMatch(practiceText, [...result.units, ...(result.excludedUnits ?? [])]);
  });

  it("excludes a fifth standard forward triplet without renumbering or discarding its spans", () => {
    const text = practiceText.replace("\nKuraly\n", "\nKuraly-Gaunce-Eyssimont\n");
    const result = interpretTweetUnits(text, bruins);
    expect(result.units.filter((u) => u.situation === "es_forward").map((u) => u.number)).toEqual([1, 2, 3, 4]);
    expect(result.excludedUnits).toEqual(expect.arrayContaining([expect.objectContaining({ situation: "es_forward", number: 5 })]));
    spansMatch(text, [...result.units, ...(result.excludedUnits ?? [])]);
  });

  it.each(["11F/7D", "11 forwards and 7 defensemen", "Defense rotation", "Correction to the lines", "Contradictory lineup reports"])(
    "retains explicit %s evidence instead of silently capping it", (note) => {
      const result = interpretTweetUnits(`${note}\n${practiceText}`, bruins);
      expect(result.units.filter((u) => u.situation === "es_defense")).toHaveLength(4);
      expect(result.excludedUnits).toBeUndefined();
    });

  it("keeps scratches separate from the active standard lineup and leaves camp groups uncapped", () => {
    const text = `${practiceText}\nScratches: Kuraly`;
    const result = interpretTweetUnits(text, bruins);
    expect(result.units.filter((u) => u.situation === "scratch")).toMatchObject([{ players: [{ playerId: 8476374 }] }]);
    expect(result.units.filter((u) => u.situation === "es_defense")).toHaveLength(3);
    expect(interpretTweetUnits(`Camp group A\n${practiceText}`, bruins).units.filter((u) => u.situation === "es_defense")).toHaveLength(4);
  });

  it.each(["unknown positions", "unknown team", "conflicting teams", "two forwards"])(
    "preserves surname ambiguity with %s", (missing) => {
      const players = bruins.map((p) => p.lastName !== "Lindholm" ? p : {
        ...p, position: missing === "unknown positions" ? null : missing === "two forwards" ? "C" : p.position,
        teamId: missing === "unknown team" ? null : missing === "conflicting teams" && p.playerId === 8476854 ? 8 : p.teamId,
      });
      const result = interpretTweetUnits(priorText, players);
      expect(result.units.filter((u) => u.situation === "es_forward").some((u) => u.players.some((p) => p.playerId === 8476854 || p.playerId === 8477496))).toBe(false);
      expect(result.unresolved).toEqual(expect.arrayContaining([expect.objectContaining({ text: "Lindholm", reason: "ambiguous", candidates: expect.arrayContaining([8476854, 8477496]) })]));
    });
  it("retains conflicting scratch and duplicate-player rows instead of applying the standard cap", () => {
    for (const text of [`${practiceText}\nScratches: McAvoy`, `${practiceText}\nLindholm-Borgen`]) {
      const result = interpretTweetUnits(text, bruins);
      expect(result.units.filter((u) => u.situation === "es_defense").length).toBeGreaterThan(3);
      expect(result.excludedUnits).toBeUndefined();
      spansMatch(text, result.units);
    }
  });
  it("preserves an explicitly named player instead of replacing him using row position", () => {
    const result = interpretTweetUnits("Bruins lines:\nMittelstadt-Hampus Lindholm-Hagens", bruins);
    expect(result.units[0]?.players.map((p) => p.playerId)).toEqual([8479999, 8476854, 8485395]);
  });
});

const names = ["Ryan McLeod", "Josh Norris", "Konsta Helenius", "Zach Aston-Reese", "Pierre Olivier-Joseph", "Noah Dower Nilsson", "Dylan Guenther", "Logan Cooley", "Nick Schmaltz", "Clayton Keller", "Mikhail Sergachev", "Anders Lee", "Vincent Trocheck", "Kailer Yamamoto", "Barrett Hayton", "John Marino"];
const roster = names.map((fullName, index) => ({ playerId: index + 1, fullName, lastName: fullName.slice(fullName.indexOf(" ") + 1), position: "C" }));

const audited = JSON.parse(readFileSync(resolve(process.cwd(), "../tasks/TASKS/lines-gdl-ingestion/audit/2026-10-01-classification-seeds.json"), "utf8"));
const seed = (id: string): string => audited.events.find((event: any) => event.tweet_id === id).text;
const seedRoster = (id: string) => {
  const revision = audited.snapshots.find((snapshot: any) => snapshot.tweet_id === id).metadata.interpretation?.rosterRevision ?? "";
  return revision.split("|").filter(Boolean).map((entry: string) => {
    const [playerId, fullName, lastName, teamId, position, ...aliases] = entry.split(":");
    return { playerId: Number(playerId), fullName, lastName, teamId: Number(teamId), position, aliases };
  });
};

describe("structured tweet interpretation", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("checks frozen source hashes and reports bounded semantic holdout classifications", () => {
    const labels = JSON.parse(readFileSync(resolve(process.cwd(), "../tasks/TASKS/lines-gdl-ingestion/audit/2026-10-01-classification-labels.json"), "utf8"));
    const counts: Record<string, { truePositive: number; predicted: number; labeled: number }> = {};
    let matched = 0, denominator = 0;
    for (const label of labels.records) {
      const source = audited.events.find((event: any) => event.tweet_id === label.tweetId)?.text ?? audited.holdoutCandidates.find((event: any) => event.tweet_id === label.tweetId)?.raw_text;
      expect(createHash("sha256").update(source).digest("hex")).toBe(label.sourceSha256);
      for (const claim of label.claims ?? []) expect(source.slice(claim.start, claim.end)).toBe(claim.text);
      if (label.split !== "semantic_holdout_candidate") continue;
      const predicted = classifyGameDayTweet(source), expected = label.expectedClassification;
      counts[predicted] ??= { truePositive: 0, predicted: 0, labeled: 0 };
      counts[expected] ??= { truePositive: 0, predicted: 0, labeled: 0 };
      counts[predicted]!.predicted++; counts[expected]!.labeled++;
      if (predicted === expected) { matched++; counts[predicted]!.truePositive++; }
      denominator++;
    }
    expect(denominator).toBe(19);
    console.info("Frozen semantic evaluation (not blind/identity/full-route accuracy)", JSON.stringify({ matched, denominator, counts }));
  });
  it("withholds false availability in the exact warmup and hopeful return seeds", () => {
    for (const id of ["2105434836500680857", "2105370362964004937"]) {
      const text = seed(id);
      const events = extractTweetPlayerEvents({ text, players: seedRoster(id), publishedAt: null });
      expect(events.some((event) => event.availability === "available" || event.availability === "out")).toBe(false);
      for (const event of events) expect(text.slice(event.evidence.start, event.evidence.end)).toBe(event.evidence.text);
      if (id === "2105434836500680857") {
        expect(events).toMatchObject([{ kind: "goalie", observation: "warmup", state: "projected" }]);
        expect(events[0]!.evidence.text).not.toContain("Stolarz");
      } else {
        expect(events.find((event) => event.playerName.includes("Sanderson"))).toMatchObject({ state: "possible_return", availability: "uncertain" });
        expect(events.find((event) => event.playerName.includes("Burakovsky"))).toMatchObject({ modality: "negated" });
        expect(events.find((event) => event.playerName.includes("Foegele"))).toMatchObject({ kind: "participation", availability: "uncertain" });
      }
    }
  });
  it.each(["2105378254983205114", "2105375596687843639", "2105366758089695718"])("retains two PP units and original offsets for %s", (id) => {
    const text = seed(id), result = interpretTweetUnits(text, seedRoster(id));
    expect(result.units.map((unit) => [unit.situation, unit.number, unit.players.length, unit.complete])).toEqual([["pp", 1, 5, true], ["pp", 2, 5, true]]);
    for (const unit of result.units) for (const span of unit.evidence) expect(text.slice(span.start, span.end)).toBe(span.text);
  });
  it("preserves CBJ row ordinals and slash uncertainty without combining identities", () => {
    const result = interpretTweetUnits(seed("2105336355915985057"), seedRoster("2105336355915985057"));
    expect(result.units.filter((unit) => unit.situation === "es_forward").map((unit) => unit.number)).toEqual([2]);
    expect(result.unresolved).toEqual(expect.arrayContaining([expect.objectContaining({ text: "Sillinger-Coyle-Olivier" })]));
    expect(result.relationships).toMatchObject([{ kind: "alternatives", number: 4, reviewReason: "ambiguous_identity" }]);
    expect(result.relationships![0]!.subjects?.map((subject) => subject.text)).toEqual(["Lomberg", "Heinen", "LDBB", "Voronkov"]);
    expect(result.units.some((unit) => unit.players.some((player) => player.name.includes("Lomberg-Heinen")))).toBe(false);
  });
  it("stores partial relations without inventing complete units or canonical identities", () => {
    for (const [id, kind] of [["2104977788142850499", "substitution"], ["2105466270070264224", "swap"]]) {
      const result = interpretTweetUnits(seed(id!), []);
      expect(result.units).toEqual([]);
      expect(result.relationships).toMatchObject([{ kind, playerIds: [], reviewReason: "ambiguous_identity" }]);
      expect(assignmentsFor({ metadata: { interpretation: result } } as any)).toEqual([]);
    }
  });
  it("retains resolved subjects of partial changes without assigning unsupported slots", () => {
    const players = [{ playerId: 1, fullName: "Matias Maccelli", lastName: "Maccelli" }, { playerId: 2, fullName: "Anthony Duclair", lastName: "Duclair" }];
    expect(interpretTweetUnits(seed("2105466270070264224"), players)).toMatchObject({ units: [], relationships: [{ kind: "swap", playerIds: [1, 2], certainty: "projected", reviewReason: "unresolved_reference" }] });
    const ppPlayers = [{ playerId: 3, fullName: "Vasily Podkolzin", lastName: "Podkolzin" }, { playerId: 4, fullName: "Ryan Nugent-Hopkins", lastName: "Nugent-Hopkins", aliases: ["RNH"] }];
    expect(interpretTweetUnits(seed("2104977788142850499"), ppPlayers)).toMatchObject({ units: [], relationships: [{ kind: "substitution", playerIds: [3, 4], number: 1, reviewReason: "incomplete_replacement" }] });
  });
  it("recognizes DTD and first-goaltender-off without confirming absence or a start", () => {
    const dtd = seed("2104668922113052956"), firstOff = seed("2105000410809512101");
    expect(classifyGameDayTweet(dtd)).toBe("injury");
    expect(classifyGameDayTweet(firstOff)).toBe("goalie_start");
    expect(classifyGameDayTweet(seed("2104672980634886326"))).not.toBe("injury");
    expect(extractTweetPlayerEvents({ text: dtd, players: [{ playerId: 1, fullName: "Joel Edmundson", lastName: "Edmundson" }], publishedAt: null })).toMatchObject([{ state: "ongoing", availability: "uncertain" }]);
    expect(extractTweetPlayerEvents({ text: firstOff, players: [{ playerId: 2, fullName: "Carter Hart", lastName: "Hart", position: "G" }], publishedAt: null })).toMatchObject([{ kind: "goalie", state: "projected", observation: "first_off" }]);
  });
  it("retains questions without promoting their subjects to confirmed availability or starts", () => {
    expect(extractTweetPlayerEvents({ text: "Norris will play tonight? McLeod will play tonight.", players: roster, publishedAt: null })).toMatchObject([{ playerId: 2, state: "unknown", availability: "uncertain" }, { playerId: 1, state: "confirmed_return", availability: "available" }]);
    expect(extractTweetPlayerEvents({ text: "Hart will start tonight?", players: [{ playerId: 100, fullName: "Carter Hart", lastName: "Hart", position: "G" }], publishedAt: null })).toMatchObject([{ playerId: 100, state: "projected" }]);
    expect(extractTweetPlayerEvents({ text: "The org is hopeful Hart will start tonight.", players: [{ playerId: 100, fullName: "Carter Hart", lastName: "Hart", position: "G" }], publishedAt: null })).toMatchObject([{ playerId: 100, state: "projected" }]);
    expect(classifyInjuryEvent("Norris will play tonight https://example.com/?source=tweet")).toBe("confirmed_return");
    expect(classifyInjuryEvent("Norris will return tonight if healthy.")).toBe("possible_return");
    expect(extractTweetPlayerEvents({ text: 'Speculation: "Hart will start tonight."', players: [{ playerId: 100, fullName: "Carter Hart", lastName: "Hart", position: "G" }], publishedAt: null })).toMatchObject([{ playerId: 100, state: "projected", evidence: { text: 'Speculation: "Hart will start tonight."' } }]);
    expect(extractTweetPlayerEvents({ text: 'Speculation: "Norris will play tonight."', players: roster, publishedAt: null })).toMatchObject([{ playerId: 2, state: "possible_return", availability: "uncertain" }]);
  });
  it("distinguishes historical comparison from historical or future applicability", () => {
    expect(requiresRelativeGameDateReview(seed("2105366758089695718"))).toBe(false);
    expect(requiresRelativeGameDateReview("Yesterday's PP1: Keller Cooley Schmaltz")).toBe(true);
    expect(requiresRelativeGameDateReview("Lines tomorrow: Keller Cooley Schmaltz")).toBe(true);
  });
  it("retains opposing same-post claims for review without publishing either availability", () => {
    const text = "Norris will play tonight. Correction: Norris will not play tonight.";
    const events = extractTweetPlayerEvents({ text, players: roster, publishedAt: null });
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.state === "unknown" && event.availability === "uncertain" && event.reviewReason === "conflicting_claims")).toBe(true);
    for (const event of events) expect(text.slice(event.evidence.start, event.evidence.end)).toBe(event.evidence.text);
  });
  it("keeps opponent events out of the primary team's forecast assignments", () => {
    const events = extractTweetPlayerEvents({ text: "Sorokin will start tonight. Stolarz will start tonight.", players: [
      { playerId: 1, fullName: "Ilya Sorokin", lastName: "Sorokin", position: "G", teamId: 2 },
      { playerId: 2, fullName: "Anthony Stolarz", lastName: "Stolarz", position: "G", teamId: 10 },
    ], publishedAt: null });
    const result = assignmentsFor({ team_id: 2, metadata: { interpretation: { units: [], events, unresolved: [], context: "game" } } } as any);
    expect(events).toHaveLength(2);
    expect(result.map((entry) => entry.player_id)).toEqual([1]);
  });
  it("retains modality before the named subject and abstains on a separate pronoun sentence", () => {
    const events = extractTweetPlayerEvents({ text: "The org is hopeful Norris will play tonight.", players: roster, publishedAt: null });
    expect(events).toMatchObject([{ state: "possible_return", availability: "uncertain", evidence: { text: "The org is hopeful Norris will play tonight." } }]);
    expect(extractTweetPlayerEvents({ text: "Norris remains out. He will return tonight.", players: roster, publishedAt: null })).toMatchObject([{ state: "ongoing", availability: "out" }]);
  });
  it("binds a shared predicate to coordinated subjects without borrowing distinct predicates", () => {
    const text = "Norris and McLeod still day to day.";
    const events = extractTweetPlayerEvents({ text, players: roster, publishedAt: null });
    expect(events).toHaveLength(2);
    expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ playerId: 2, state: "ongoing", availability: "uncertain" }), expect.objectContaining({ playerId: 1, state: "ongoing", availability: "uncertain" })]));
    for (const event of events) expect(text.slice(event.evidence.start, event.evidence.end)).toBe(text);
    expect(extractTweetPlayerEvents({ text: "Norris remains out and McLeod will play tonight.", players: roster, publishedAt: null })).toMatchObject([{ playerId: 2, availability: "out" }, { playerId: 1, availability: "available" }]);
    expect(extractTweetPlayerEvents({ text: "Norris\nMcLeod will play tonight.", players: roster, publishedAt: null })).toMatchObject([{ playerId: 1, availability: "available" }]);
  });
  it("does not borrow an unresolved subject's return or resolve unsupported pronouns", () => {
    expect(extractTweetPlayerEvents({ text: "Norris remains out. Unknown Player will play tonight. He returns tomorrow.", players: roster, publishedAt: null })).toMatchObject([{ playerId: 2, state: "ongoing", availability: "out" }]);
    expect(extractTweetPlayerEvents({ text: "He will play tonight.", players: roster, publishedAt: null })).toEqual([]);
    for (const text of ["Norris remains out and Unknown Player will play tonight.", "Norris remains out but he will return tonight.", "Norris remains out; Unknown Player will play tonight.", "Norris remains out, unknown player will play tonight.", "Norris remains out — Unknown Player will play tonight.", "Norris remains out AND Unknown Player will play tonight."]) {
      expect(extractTweetPlayerEvents({ text, players: roster, publishedAt: null })).toMatchObject([{ playerId: 2, state: "ongoing", availability: "out" }]);
    }
    expect(extractTweetPlayerEvents({ text: "Norris and Unknown Player will play tonight.", players: roster, publishedAt: null })).toEqual([]);
    const ambiguousRoster = [...roster, { playerId: 100, fullName: "Cole Sillinger", lastName: "Sillinger" }, { playerId: 101, fullName: "Owen Sillinger", lastName: "Sillinger" }];
    expect(extractTweetPlayerEvents({ text: "Norris remains out, Sillinger will play tonight.", players: ambiguousRoster, publishedAt: null })).toMatchObject([{ playerId: 2, state: "ongoing", availability: "out" }]);
    expect(extractTweetPlayerEvents({ text: "Cole Sillinger will play tonight.", players: ambiguousRoster, publishedAt: null })).toMatchObject([{ playerId: 100, availability: "available" }]);
    expect(extractTweetPlayerEvents({ text: "Norris could return and McLeod will play tonight.", players: roster, publishedAt: null })).toMatchObject([{ playerId: 2, availability: "uncertain" }, { playerId: 1, availability: "available" }]);
    expect(extractTweetPlayerEvents({ text: "Norris remains out and unknown player will play tonight.", players: roster, publishedAt: null })).toMatchObject([{ playerId: 2, availability: "out" }]);
    expect(extractTweetPlayerEvents({ text: "Norris will play tonight, org is hopeful.", players: roster, publishedAt: null })).toMatchObject([{ playerId: 2, availability: "uncertain" }]);
  });
  it("retains explicit absence durations without inventing a new injury from healthy scratches", () => {
    expect(classifyGameDayTweet("Norris is out for two weeks")).toBe("injury");
    expect(extractTweetPlayerEvents({ text: "Norris is out for two weeks", players: roster, publishedAt: null })).toMatchObject([{ availability: "out" }]);
    expect(classifyInjuryEvent("Norris out tonight as a healthy scratch", "healthy")).toBe("unknown");
  });
  it("keeps injury certainty, history and timeframes separate", () => {
    expect(classifyInjuryEvent("will not return to the lineup tonight", "injured")).toBe("ongoing");
    expect(classifyInjuryEvent("could return in 4–6 weeks")).toBe("possible_return");
    expect(extractInjuryTimeline("could return in 4–6 weeks", null)).toMatchObject({ purpose: "return", minimum: 4, maximum: 6, unit: "weeks" });
    expect(extractInjuryTimeline("will be re-evaluated in two weeks", null)).toMatchObject({ purpose: "reassessment", minimum: 2 });
    expect(extractInjuryTimeline("will play tomorrow", "2026-09-19T02:00:00Z")?.targetDate).toBe("2026-09-19");
    expect(extractInjuryTimelines("Out for 4–6 weeks and reassessed in two weeks", null)).toMatchObject([{ purpose: "absence", minimum: 4, maximum: 6 }, { purpose: "reassessment", minimum: 2 }]);
    expect(extractInjuryTimeline("could return Monday", "2026-09-18T15:00:00Z")?.targetDate).toBe("2026-09-21");
    expect(classifyInjuryEvent("is not injured")).toBe("unknown");
  });
  it("does not apply one player's return to another player's injury", () => {
    expect(extractTweetPlayerEvents({ text: "McLeod will play tonight. Norris remains out.", players: roster, publishedAt: null }))
      .toMatchObject([{ playerId: 1, state: "confirmed_return" }, { playerId: 2, state: "ongoing" }]);
  });
  it("preserves source spans for accents and repeated surname mentions", () => {
    const text = "Emile O’Connor suffered an injury. Norris remains out. O'Connor will be re-evaluated Monday.";
    const events = extractTweetPlayerEvents({ text, players: [...roster, { playerId: 100, fullName: "Émile O'Connor", lastName: "O'Connor", position: "C" }], publishedAt: "2026-09-18T15:00:00Z" });
    expect(events.map((event) => event.playerId)).toEqual([100, 2, 100]);
    for (const event of events) expect(text.slice(event.evidence.start, event.evidence.end)).toBe(event.evidence.text);
    expect(events[2]?.timeline).toMatchObject({ purpose: "reassessment", targetDate: "2026-09-21" });
  });
  it("segments whitespace names and preserves compound surnames", () => {
    expect(segmentPlayerRow("McLeod Norris Helenius", roster)?.map((hit) => hit.player.fullName)).toEqual(names.slice(0, 3));
    for (const name of names.slice(3, 6)) expect(segmentPlayerRow(name, roster)).toHaveLength(1);
  });
  it("rejects prose, headings and skaters masquerading as goalies", () => {
    for (const text of ["IT'S SO NOT O-VER, BABES!!", "Montreal", "News", "GM", "President", "Utah", "McLeod", "Edmonton", "Colorado", "Los Angeles", "Star", "All", "Vegas", "Toronto", "Islanders", "Nashville"]) {
      expect(interpretTweetUnits(text, roster).units).toEqual([]);
    }
  });
  it("parses the Utah 3+2 power-play example without creating ES pairs", () => {
    const text = "Utah power play units\nGuenther - Cooley - Schmaltz\nKeller - Sergachev\n\nLee - Trocheck - Yamamoto\nHayton - Marino";
    const result = interpretTweetUnits(text, roster);
    expect(result.units.map((unit) => [unit.situation, unit.number, unit.players.length, unit.complete])).toEqual([["pp", 1, 5, true], ["pp", 2, 5, true]]);
    for (const unit of result.units) for (const span of unit.evidence) expect(text.slice(span.start, span.end)).toBe(span.text);
  });
  it("supports explicit PP units and PK pairs, keeping camp groups separate", () => {
    const result = interpretTweetUnits("Camp group A\nPP1: Guenther-Cooley-Schmaltz-Keller-Sergachev\nGroup B\nPK1: McLeod-Norris\nHayton-Marino", roster);
    expect(result.units).toMatchObject([{ situation: "pp", number: 1, explicitNumber: true, group: "a", complete: true }, { situation: "pk", number: 1, group: "b", complete: true }]);
  });
  it("supports 1+3+1 PP layouts and separates scratches from active units", () => {
    const result = interpretTweetUnits("PP1\nKeller\nGuenther Cooley Schmaltz\nSergachev\nScratches: McLeod Norris", roster);
    expect(result.units).toMatchObject([{ situation: "pp", number: 1, complete: true }, { situation: "scratch", players: [{ playerId: 1 }, { playerId: 2 }] }]);
  });
  it("does not apply a later PP heading to earlier even-strength rows", () => {
    const result = interpretTweetUnits("Today's lines\nMcLeod Norris Helenius\nPP1\nGuenther Cooley Schmaltz\nKeller Sergachev", roster);
    expect(result.units).toMatchObject([{ situation: "es_forward", players: [{ playerId: 1 }, { playerId: 2 }, { playerId: 3 }] }, { situation: "pp", number: 1, complete: true }]);
  });
  it("does not confirm conditional starts or assign a skater goalie status", () => {
    const players = [...roster, { playerId: 100, fullName: "Jake Oettinger", lastName: "Oettinger", position: "G" }];
    expect(extractTweetPlayerEvents({ text: "Oettinger will start if healthy. McLeod will start at center.", players, publishedAt: null })).toMatchObject([{ playerId: 100, state: "projected" }]);
  });
  it("keeps partial ES reports and camp groups out of forecast assignments", () => {
    const partial = interpretTweetUnits("Tonight\nMcLeod Norris Helenius", roster);
    expect(assignmentsFor({ metadata: { interpretation: partial } } as any)).toEqual([]);
    const camp = interpretTweetUnits("Camp group A\nPP1: Guenther Cooley Schmaltz Keller Sergachev\nPP2: Lee Trocheck Yamamoto Hayton Marino", roster);
    expect(assignmentsFor({ metadata: { interpretation: camp } } as any)).toEqual([]);
  });
  it("reconciles bad tokenization separately from missing membership", () => {
    const row = { id: "1", raw_name: "McLeod Norris Helenius", context_text: "McLeod Norris Helenius" } as any;
    expect(reconcileAlias(row, roster, roster)).toMatchObject({ disposition: "invalid_extraction", playerIds: [1, 2, 3] });
    expect(reconcileAlias({ ...row, raw_name: "Trocheck" }, roster, [])).toMatchObject({ disposition: "review", reason: "missing_membership", candidates: [13] });
    expect(reconcileAlias({ ...row, raw_name: "Dower Nilsson" }, roster, roster)).toMatchObject({ disposition: "resolved", playerId: 6 });
  });
  it("uses the new parser through the receiver's shared source builder", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const source = buildLinesCccSourceFromIftttEvent({
      event: { id: "test", source: "ifttt", source_account: "gamedaylines", username: "gamedaylines", text: "Utah power play units\nGuenther-Cooley-Schmaltz\nKeller-Sergachev\n\nLee-Trocheck-Yamamoto\nHayton-Marino", link_to_tweet: null, tweet_id: "123", tweet_created_at: "2026-09-18T15:00:00Z", created_at_label: null, raw_payload: {}, received_at: "2026-09-18T15:01:00Z" },
      snapshotDate: "2026-09-18", teams: [{ id: 59, abbreviation: "UTA", name: "Utah Mammoth", shortName: "Mammoth", location: "Utah", slug: "utah-mammoth", hashtags: ["TusksUp"] }],
      rosterByTeam: new Map([[59, roster]]), gameIdByTeamId: new Map(),
    } as any);
    expect(source.metadata?.interpretation).toMatchObject({ units: [{ situation: "pp", complete: true }, { situation: "pp", complete: true }] });
    expect(source.defensePairs).toEqual([]);
    expect(source.goalies).toEqual([]);
  });
});
