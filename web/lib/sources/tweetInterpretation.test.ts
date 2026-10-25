// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { classifyGameDayTweet } from "./lineupSourceIngestion";
import { completeEvenStrengthUnits, interpretTweetUnits, requiresRelativeGameDateReview, segmentPlayerRow } from "./tweetInterpretation";
import { classifyInjuryEvent, extractInjuryTimeline, extractInjuryTimelines, extractTweetPlayerEvents, injuryAvailability } from "./tweetPlayerEvents";
import { assignmentsFor } from "../player-forecasts/sourceObservations";
import { buildLinesCccSourceFromIftttEvent } from "./linesCccIngestion";
import { reconcileAlias } from "./tweetAliasReconciliation";
import { edmontonSectionRoster, edmontonSectionText, explicit11F7DText, seattleSectionRoster, seattleSectionText } from "../../__tests__/fixtures/lineupSectionFixtures";
import claimContextCases from "./fixtures/claimContextCases.json";
import iftttComparison from "./fixtures/iftttComparisonObservations.json";

describe("reviewed critical corpus extraction gaps", () => {
  const fixture = (id: string) => claimContextCases.cases.find(item => item.id === id)!;
  const events = (id: string) => extractTweetPlayerEvents({ ...fixture(id), claimAware: true });
  it("retains the exact three source hashes as development regression evidence", () => {
    for (const item of claimContextCases.cases) expect(createHash("sha256").update(item.text).digest("hex")).toBe(item.text_sha256);
  });
  it("keeps legacy payload identities unchanged while the claim-aware rollout is off", () => {
    expect(extractTweetPlayerEvents({ ...fixture("G003095"), claimAware: false })).toEqual([]);
    expect(extractTweetPlayerEvents({ ...fixture("G003366"), claimAware: false })).toEqual([]);
    expect(extractTweetPlayerEvents({ ...fixture("G005040"), claimAware: false })).toMatchObject([{ evidence: { start: 73, end: 126 } }]);
    expect(extractTweetPlayerEvents({ ...fixture("G005040"), claimAware: false })[0]!).not.toHaveProperty("claimAnchor");
  });
  it("extracts G003095 as witnessed practice absence without inferring injury or game exclusion", () => {
    expect(events("G003095")).toMatchObject([{ playerId: 8481641, kind: "participation", state: "observed", modality: "negated", observation: "practice", availability: "unknown" }]);
    expect(events("G003095")[0]!.evidence.text).toContain("Don’t see Kiviranta");
  });
  it("preserves G003366's not-optimistic qualifier as uncertain availability, never OUT", () => {
    const extracted = events("G003366");
    expect(extracted.some(event => event.playerId === 8476923 && event.kind === "injury" && event.availability === "uncertain" && event.evidence.text.includes("not optimistic"))).toBe(true);
    expect(extracted.some(event => event.availability === "out" || event.availability === "available")).toBe(false);
  });
  it("keeps G005040 UNKNOWN and retains the reviewed governing-without evidence span", () => {
    expect(events("G005040")).toMatchObject([{ kind: "injury", state: "unknown", availability: "unknown", evidence: { start: 65, end: 126 } }]);
    expect(events("G005040")[0]!.evidence.text).toBe(fixture("G005040").text.slice(65, 126));
    const anchored = extractTweetPlayerEvents({ ...fixture("G005040"), includeClaimAnchors: true })[0]!;
    expect(anchored.claimAnchor).toEqual({ subjectSpan: { start: 73, end: 85, text: "Jordan Staal" }, predicateSpan: { start: 65, end: 72, text: "without" } });
  });
});

describe("source sections and positive role admission", () => {
  const checkSpans = (text: string, result: ReturnType<typeof interpretTweetUnits>) => {
    for (const unit of [...result.units, ...(result.excludedUnits ?? [])]) for (const span of unit.evidence) expect(text.slice(span.start, span.end)).toBe(span.text);
    for (const issue of result.unresolved) expect(text.slice(issue.start, issue.end)).toBe(issue.text);
  };
  it("parses the supplied slash rows and keeps explicit extras out of active units", () => {
    const result = interpretTweetUnits(seattleSectionText, seattleSectionRoster);
    expect(completeEvenStrengthUnits(result)).toHaveLength(7);
    expect(result.units.filter((unit) => unit.situation === "scratch").flatMap((unit) => unit.players.map((player) => player.playerId))).toEqual([2, 3]);
    expect(result.units.filter((unit) => unit.situation === "goalie")).toEqual([]);
    expect(result.relationships).toBeUndefined();
    checkSpans(seattleSectionText, result);
  });
  it("does not let short forward extras shift defense ordinals or a lone defenseman become a goalie", () => {
    const result = interpretTweetUnits(edmontonSectionText, edmontonSectionRoster);
    expect(result.context).toBe("practice");
    expect(completeEvenStrengthUnits(result)).toHaveLength(7);
    expect(result.units.filter((unit) => unit.situation === "es_defense").map((unit) => [unit.number, unit.players.map((player) => player.name)])).toEqual([
      [1, ["Fixture Ekholm", "Fixture Bouchard"]], [2, ["Fixture Shea", "Fixture Murphy"]], [3, ["Fixture Mukhamadullin", "Fixture Emberson"]],
    ]);
    expect(result.units.filter((unit) => unit.situation === "goalie").flatMap((unit) => unit.players.map((player) => player.name))).toEqual(["Fixture Levi", "Fixture Jarry"]);
    expect(result.excludedUnits?.map((unit) => unit.players.map((player) => player.name))).toEqual([["Fixture Jones", "Fixture Hyman"], ["Fixture Walman"]]);
    checkSpans(edmontonSectionText, result);
  });
  it("preserves the explicitly declared 11F-7D exception", () => {
    const result = interpretTweetUnits(explicit11F7DText, edmontonSectionRoster);
    expect(completeEvenStrengthUnits(result)).toHaveLength(8);
    expect(result.units.filter((unit) => unit.situation === "es_forward").map((unit) => unit.players.length)).toEqual([3, 3, 3, 2]);
    expect(result.units.filter((unit) => unit.situation === "es_defense").map((unit) => unit.players.length)).toEqual([2, 2, 2, 1]);
    checkSpans(explicit11F7DText, result);
  });
  it.each(["unknown position", "conflicting team"])("reserves an invalid full source row's ordinal: %s", (condition) => {
    const players = edmontonSectionRoster.map((player, index) => ({ ...player,
      position: condition === "unknown position" && index === 0 ? null : player.position,
      teamId: condition === "conflicting team" && index === 0 ? 30 : player.teamId }));
    const result = interpretTweetUnits(edmontonSectionText, players);
    expect(result.units.filter((unit) => unit.situation === "es_forward").map((unit) => [unit.number, unit.complete])).toEqual([[1, false], [2, true], [3, true], [4, true]]);
    expect(result.unresolved.find((issue) => issue.text === "Podkolzin-McDavid-Draisaitl")?.number).toBe(1);
    checkSpans(edmontonSectionText, result);
  });
  it.each(["Forwards:", "F1:"])("reserves a headed position contradiction's slot: %s", (heading) => {
    const text = `${heading}\nEkholm-McDavid-Draisaitl\nHallander-Dickinson-Kapanen`;
    const result = interpretTweetUnits(text, edmontonSectionRoster);
    expect(result.units.map((unit) => [unit.number, unit.complete])).toEqual([[1, false], [2, true]]);
    expect(result.unresolved[0]?.number).toBe(1);
    checkSpans(text, result);
  });
  it.each(["pp", "pk"] as const)("interrupts %s assembly at an invalid fragment", (situation) => {
    for (const position of [null, "G"]) {
      const players = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"].map((name, index) => ({
        playerId: index + 1, fullName: name, lastName: name, teamId: 22,
        position: index === 3 ? position : index < 3 ? "F" : "D" }));
      const text = `${situation.toUpperCase()}1:\n${situation === "pp" ? "Alpha-Beta-Gamma" : "Alpha-Beta"}\nDelta\nEpsilon-Zeta`;
      const result = interpretTweetUnits(text, players);
      expect(result.units.map((unit) => [unit.situation, unit.number, unit.complete, unit.players.map((player) => player.playerId)])).toEqual([
        [situation, 1, false, situation === "pp" ? [1, 2, 3] : [1, 2]],
        [situation, 1, false, [4]], [situation, 1, false, [5, 6]],
      ]);
      expect(result.unresolved).toMatchObject([{ text: "Delta", situation, number: 1, reason: "invalid_extraction" }]);
      checkSpans(text, result);
    }
  });
  it.each(["missing positions", "missing identities", "conflicting team"])("withholds role admission for %s", (condition) => {
    const players = condition === "missing identities" ? [] : edmontonSectionRoster.map((player, index) => ({ ...player, position: condition === "missing positions" ? null : player.position, teamId: condition === "conflicting team" && index === 0 ? 30 : player.teamId }));
    const result = interpretTweetUnits(edmontonSectionText, players);
    expect(completeEvenStrengthUnits(result)).toEqual([]);
    expect(result.unresolved.length).toBeGreaterThan(0);
    if (condition === "missing positions") expect(result.units.some((unit) => unit.complete)).toBe(false);
    checkSpans(edmontonSectionText, result);
  });
  it("keeps explicit section labels authoritative and incomplete contradictions reviewable", () => {
    const text = "Defense:\nJones-Hyman\n\nD1: Ekholm-Bouchard\nGoalies:\nWalman";
    const result = interpretTweetUnits(text, edmontonSectionRoster);
    expect(result.units.filter((unit) => unit.complete).map((unit) => unit.players.map((player) => player.name))).toEqual([["Fixture Ekholm", "Fixture Bouchard"]]);
    expect(result.unresolved.map((issue) => issue.text)).toEqual(["Jones-Hyman", "Walman"]);
    checkSpans(text, result);
  });
  it("retains a negated ice-absence observation without a game OUT or starter claim", () => {
    const result = extractTweetPlayerEvents({ text: seattleSectionText, players: seattleSectionRoster, publishedAt: null });
    expect(result).toMatchObject([{ playerId: 1, kind: "participation", state: "observed", availability: "unknown", modality: "negated", times: { observation: null, applicability: "unresolved" } }]);
    expect(result[0]?.observation).toBeUndefined();
    expect(result.some((event) => event.kind === "goalie" || event.availability === "out")).toBe(false);
    for (const event of result) expect(seattleSectionText.slice(event.evidence.start, event.evidence.end)).toBe(event.evidence.text);
  });
  it("keeps explicit practice absence observational while retaining an explicit game-OUT statement separately", () => {
    const result = extractTweetPlayerEvents({ text: "Joey Daccord is not on the ice at practice.", players: seattleSectionRoster, publishedAt: null });
    expect(result).toMatchObject([{ kind: "participation", observation: "practice", modality: "negated", availability: "unknown" }]);
    expect(extractTweetPlayerEvents({ text: "Joey Daccord will not play tonight.", players: seattleSectionRoster, publishedAt: null })).toMatchObject([{ kind: "injury", availability: "out" }]);
  });
});

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

const audited = JSON.parse(readFileSync(resolve(__dirname, "./fixtures/tweetClassificationSeeds.json"), "utf8"));
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
    const labels = JSON.parse(readFileSync(resolve(__dirname, "./fixtures/tweetClassificationLabels.json"), "utf8"));
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
  it("keeps the retained IFTTT replacement ordered as synthetic PP1 identities without a lineup update", () => {
    const source = iftttComparison.records.find((record) => record.id === "S06")!;
    const syntheticRoster = [
      { playerId: 990001, fullName: "Fixture Podkolzin", lastName: "Podkolzin" },
      { playerId: 990002, fullName: "Fixture Nugent-Hopkins", lastName: "Nugent-Hopkins", aliases: ["RNH"] },
    ];
    const result = interpretTweetUnits(source.text, syntheticRoster);
    expect(result.units).toEqual([]);
    expect(result.relationships).toMatchObject([{ kind: "substitution", playerIds: [990001, 990002], situation: "pp", number: 1, certainty: "reported", reviewReason: "incomplete_replacement" }]);
    expect(result.relationships?.[0]?.evidence.text).toContain("Podkolzin will take RNH’s spot on the first unit powerplay");
    expect(assignmentsFor({ metadata: { interpretation: result } } as any)).toEqual([]);
    expect(source.gameId).toBeNull();
    expect(source.effectiveAt).toBeNull();
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

// Exact retained public receipt bodies; identities are only those present in the
// receipt's retained roster context. No membership is invented for missing names.
const auditReceipts = {
  "2108961243746771167": {
    text: "RT @wmjsports: #Flyers lines & pairs in warmups @ Bruins 10/10: \n\nZegras-Dvorak-Foerster\nTippett-Couturier-Michkov\nBarkey-Cates-Martone\nWilson-Acciari-Bunting\n\nSanheim-Drysdale\nSeeler-Jiricek\nGrans-Benoit\n\nVladar in goal, Woll backs him up https://t.co/5HwH1dB0Av",
    publishedAt: "2026-10-10 16:41:00+00",
    players: [

    ],
    eventPlayers: [
      {"playerId": 8475253,"fullName": "Garrett Wilson","lastName": "Wilson","teamId": 4,"position": "L","aliases": ["Garrett Wilson"]},
      {"playerId": 8476372,"fullName": "Nick Seeler","lastName": "Seeler","teamId": 4,"position": "D","aliases": ["Nick Seeler"]},
      {"playerId": 8476461,"fullName": "Sean Couturier","lastName": "Couturier","teamId": 4,"position": "C","aliases": ["Sean Couturier"]},
      {"playerId": 8477948,"fullName": "Travis Sanheim","lastName": "Sanheim","teamId": 4,"position": "D","aliases": ["Travis Sanheim"]},
      {"playerId": 8477989,"fullName": "Christian Dvorak","lastName": "Dvorak","teamId": 4,"position": "C","aliases": ["Christian Dvorak"]},
      {"playerId": 8478435,"fullName": "Dan Vladar","lastName": "Vladar","teamId": 4,"position": "G","aliases": ["Dan Vladar"]},
      {"playerId": 8478569,"fullName": "Noel Acciari","lastName": "Acciari","teamId": 4,"position": "C","aliases": ["Noel Acciari"]},
      {"playerId": 8479361,"fullName": "Joseph Woll","lastName": "Woll","teamId": 4,"position": "G","aliases": ["Joseph Woll"]},
      {"playerId": 8480015,"fullName": "Owen Tippett","lastName": "Tippett","teamId": 4,"position": "R","aliases": ["Owen Tippett"]},
      {"playerId": 8480220,"fullName": "Noah Cates","lastName": "Cates","teamId": 4,"position": "L","aliases": ["Noah Cates"]},
      {"playerId": 8481122,"fullName": "Simon Benoit","lastName": "Benoit","teamId": 4,"position": "D","aliases": ["Simon Benoit"]},
      {"playerId": 8481533,"fullName": "Trevor Zegras","lastName": "Zegras","teamId": 4,"position": "C","aliases": ["Trevor Zegras"]},
      {"playerId": 8482142,"fullName": "Jamie Drysdale","lastName": "Drysdale","teamId": 4,"position": "D","aliases": ["Jamie Drysdale"]},
      {"playerId": 8482159,"fullName": "Tyson Foerster","lastName": "Foerster","teamId": 4,"position": "R","aliases": ["Tyson Foerster"]},
      {"playerId": 8482169,"fullName": "Helge Grans","lastName": "Grans","teamId": 4,"position": "D","aliases": ["Helge Grans"]},
      {"playerId": 8482728,"fullName": "Nate Benoit","lastName": "Benoit","teamId": 30,"position": "D","aliases": ["Nate Benoit"]},
      {"playerId": 8483460,"fullName": "David Jiricek","lastName": "Jiricek","teamId": 4,"position": "D","aliases": ["David Jiricek"]},
      {"playerId": 8484142,"fullName": "Denver Barkey","lastName": "Barkey","teamId": 4,"position": "C","aliases": ["Denver Barkey"]},
      {"playerId": 8484163,"fullName": "Jakub Dvorak","lastName": "Dvorak","teamId": 26,"position": "D","aliases": ["Jakub Dvorak"]},
      {"playerId": 8484387,"fullName": "Matvei Michkov","lastName": "Michkov","teamId": 4,"position": "R","aliases": ["Matvei Michkov"]},
      {"playerId": 8484790,"fullName": "Adam Jiricek","lastName": "Jiricek","teamId": 19,"position": "D","aliases": ["Adam Jiricek"]},
      {"playerId": 8485406,"fullName": "Porter Martone","lastName": "Martone","teamId": 4,"position": "R","aliases": ["Porter Martone"]}
    ],
  },
  "2108961062892568787": {
    text: "RT @NHLFlyers: Injury updates:\n\n• Travis Konecny (lower-body) and Cam York (upper-body) are day-to-day.\n• Rasmus Ristolainen has been placed on IR (upper-body) retroactive to Oct. 3.\n• Helge Grans has been activated from Injured, Non-Roster.\n• Nikita Grebenkin underwent successful back surgery and will be out a minimum of four months. https://t.co/mYCalD0677",
    publishedAt: "2026-10-10 16:41:00+00",
    players: [

    ],
    eventPlayers: [
      {"playerId": 8477499,"fullName": "Rasmus Ristolainen","lastName": "Ristolainen","teamId": 4,"position": "D","aliases": ["Rasmus Ristolainen"]},
      {"playerId": 8478439,"fullName": "Travis Konecny","lastName": "Konecny","teamId": 4,"position": "R","aliases": ["Travis Konecny"]},
      {"playerId": 8480840,"fullName": "Oskar Bäck","lastName": "Bäck","teamId": 25,"position": "C","aliases": ["Oskar Bäck"]},
      {"playerId": 8481546,"fullName": "Cam York","lastName": "York","teamId": 4,"position": "D","aliases": ["Cam York"]},
      {"playerId": 8482169,"fullName": "Helge Grans","lastName": "Grans","teamId": 4,"position": "D","aliases": ["Helge Grans"]},
      {"playerId": 8483733,"fullName": "Nikita Grebenkin","lastName": "Grebenkin","teamId": 4,"position": "R","aliases": ["Nikita Grebenkin"]},
      {"playerId": 8484455,"fullName": "Nathaniel Day","lastName": "Day","teamId": 22,"position": "G","aliases": ["Nathaniel Day"]}
    ],
  },
  "2108946348364153181": {
    text: "Flyers Starting Goalie: Dan Vladar\nVs\nBruins Starting Goalie: Jeremy Swayman\nPer @NHLFlyers & @JoeyMacHockey",
    publishedAt: "2026-10-10 15:42:00+00",
    players: [

    ],
    eventPlayers: [
      {"playerId": 8478435,"fullName": "Dan Vladar","lastName": "Vladar","teamId": 4,"position": "G","aliases": ["Dan Vladar"]},
      {"playerId": 8480280,"fullName": "Jeremy Swayman","lastName": "Swayman","teamId": 6,"position": "G","aliases": ["Jeremy Swayman"]}
    ],
  },
  "2108958735309865096": {
    text: "Confirmed Bruins Starting Goalie: Jeremy Swayman \nConfirmed Flyers Starting Goalie: Dan Vladar https://t.co/4hXg9xv9LV",
    publishedAt: "2026-10-10 16:31:00+00",
    players: [

    ],
    eventPlayers: [
      {"playerId": 8478435,"fullName": "Dan Vladar","lastName": "Vladar","teamId": 4,"position": "G","aliases": ["Dan Vladar"]},
      {"playerId": 8480280,"fullName": "Jeremy Swayman","lastName": "Swayman","teamId": 6,"position": "G","aliases": ["Jeremy Swayman"]}
    ],
  },
  "2108968319835603270": {
    text: "RT @mark_scheig: Good morning from St. Louis. First road game and first back-to-back for #CBJ this season.\n\nJet Greaves in net per Rick Bowness. \nThey have some gametime decisions and will skate all 22 skaters in warmups. https://t.co/ukvRZRu3pL",
    publishedAt: "2026-10-10 17:10:00+00",
    players: [

    ],
    eventPlayers: [
      {"playerId": 8480840,"fullName": "Oskar Bäck","lastName": "Bäck","teamId": 25,"position": "C","aliases": ["Oskar Bäck"]},
      {"playerId": 8482982,"fullName": "Jet Greaves","lastName": "Greaves","teamId": 29,"position": "G","aliases": ["Jet Greaves"]}
    ],
  },
  "2108974712621805603": {
    text: "RT @Real_Max_Miller: Celebrini will take warmups but still considered a GTD. #SJSharks\n\nSherwood will do the same. \n\nAskarov starts",
    publishedAt: "2026-10-10 17:35:00+00",
    players: [

    ],
    eventPlayers: [
      {"playerId": 8480748,"fullName": "Kiefer Sherwood","lastName": "Sherwood","teamId": 28,"position": "L","aliases": ["Kiefer Sherwood"]},
      {"playerId": 8480817,"fullName": "K'Andre Miller","lastName": "Miller","teamId": 12,"position": "D","aliases": ["K'Andre Miller"]},
      {"playerId": 8482137,"fullName": "Yaroslav Askarov","lastName": "Askarov","teamId": 28,"position": "G","aliases": ["Yaroslav Askarov"]},
      {"playerId": 8484388,"fullName": "Daniil But","lastName": "But","teamId": 68,"position": "L","aliases": ["Daniil But"]},
      {"playerId": 8484416,"fullName": "Quentin Miller","lastName": "Miller","teamId": 8,"position": "G","aliases": ["Quentin Miller"]},
      {"playerId": 8484449,"fullName": "Aiden Celebrini","lastName": "Celebrini","teamId": 23,"position": "D","aliases": ["Aiden Celebrini"]},
      {"playerId": 8484801,"fullName": "Macklin Celebrini","lastName": "Celebrini","teamId": 28,"position": "C","aliases": ["Macklin Celebrini"]},
      {"playerId": 8485608,"fullName": "Ryan Miller","lastName": "Miller","teamId": 5,"position": "C","aliases": ["Ryan Miller"]}
    ],
  },
  "2101333176509686110": {
    text: "RT @RyanHenkel_: Power play groupings \n\nPP1: Gostisbehere, Aho, Ehlers, Svechnikov, Blake\n\nPP2: Miller, Walker, Hall, Jankowski, Stankoven\n\n*Jarvis sitting with the powe play guys, just not participating in run throughs",
    publishedAt: "2026-09-19 15:30:00+00",
    players: [
      {"playerId": 8475791,"fullName": "Taylor Hall","lastName": "Hall","teamId": 12,"position": "L","aliases": ["Taylor Hall"]},
      {"playerId": 8476873,"fullName": "Mark Jankowski","lastName": "Jankowski","teamId": 12,"position": "L","aliases": ["Mark Jankowski"]},
      {"playerId": 8476906,"fullName": "Shayne Gostisbehere","lastName": "Gostisbehere","teamId": 12,"position": "D","aliases": ["Shayne Gostisbehere"]},
      {"playerId": 8477940,"fullName": "Nikolaj Ehlers","lastName": "Ehlers","teamId": 12,"position": "L","aliases": ["Nikolaj Ehlers"]},
      {"playerId": 8478427,"fullName": "Sebastian Aho","lastName": "Aho","teamId": 12,"position": "C","aliases": ["Sebastian Aho"]},
      {"playerId": 8480336,"fullName": "Sean Walker","lastName": "Walker","teamId": 12,"position": "D","aliases": ["Sean Walker"]},
      {"playerId": 8480817,"fullName": "K'Andre Miller","lastName": "Miller","teamId": 12,"position": "D","aliases": ["K'Andre Miller"]},
      {"playerId": 8480830,"fullName": "Andrei Svechnikov","lastName": "Svechnikov","teamId": 12,"position": "R","aliases": ["Andrei Svechnikov"]},
      {"playerId": 8482093,"fullName": "Seth Jarvis","lastName": "Jarvis","teamId": 12,"position": "R","aliases": ["Seth Jarvis"]},
      {"playerId": 8482702,"fullName": "Logan Stankoven","lastName": "Stankoven","teamId": 12,"position": "C","aliases": ["Logan Stankoven"]},
      {"playerId": 8482809,"fullName": "Jackson Blake","lastName": "Blake","teamId": 12,"position": "R","aliases": ["Jackson Blake"]}
    ],
    eventPlayers: [

    ],
  },
  "2106513524029821025": {
    text: "RT @Gabby_Shirley_: a look at the #Bolts lines and D pairings from warmups … they will be going with 11 forwards and 7 defensemen: \n\nGoncalves - Point - Kucherov\nHagel - Cirelli - Guentzel\nMikheyev - Girgensons - Holmberg\nViel - Geekie \n\nMoser - Carlson\nMcDonagh - Cernak\nHedman - Lilleberg \nD’Astous \n\n🥅 Vasilevskiy \nHildeby",
    publishedAt: "2026-10-03 22:35:00+00",
    players: [
      {"playerId": 8474151,"fullName": "Ryan McDonagh","lastName": "McDonagh","teamId": 14,"position": "D","aliases": ["Ryan McDonagh","McDonagh"]},
      {"playerId": 8474590,"fullName": "John Carlson","lastName": "Carlson","teamId": 14,"position": "D","aliases": ["John Carlson"]},
      {"playerId": 8475167,"fullName": "Victor Hedman","lastName": "Hedman","teamId": 14,"position": "D","aliases": ["Victor Hedman"]},
      {"playerId": 8476453,"fullName": "Nikita Kucherov","lastName": "Kucherov","teamId": 14,"position": "R","aliases": ["Nikita Kucherov","Kucherov"]},
      {"playerId": 8476878,"fullName": "Zemgus Girgensons","lastName": "Girgensons","teamId": 14,"position": "C","aliases": ["Zemgus Girgensons","Girgensons"]},
      {"playerId": 8476883,"fullName": "Andrei Vasilevskiy","lastName": "Vasilevskiy","teamId": 14,"position": "G","aliases": ["Andrei Vasilevskiy","Vasilevskiy"]},
      {"playerId": 8477404,"fullName": "Jake Guentzel","lastName": "Guentzel","teamId": 14,"position": "C","aliases": ["Jake Guentzel","Guentzel"]},
      {"playerId": 8478010,"fullName": "Brayden Point","lastName": "Point","teamId": 14,"position": "C","aliases": ["Brayden Point","Point"]},
      {"playerId": 8478416,"fullName": "Erik Cernak","lastName": "Cernak","teamId": 14,"position": "D","aliases": ["Erik Cernak","Cernak"]},
      {"playerId": 8478519,"fullName": "Anthony Cirelli","lastName": "Cirelli","teamId": 14,"position": "C","aliases": ["Anthony Cirelli","Cirelli"]},
      {"playerId": 8479542,"fullName": "Brandon Hagel","lastName": "Hagel","teamId": 14,"position": "L","aliases": ["Brandon Hagel","Hagel"]},
      {"playerId": 8479705,"fullName": "Jeffrey Viel","lastName": "Viel","teamId": 14,"position": "L","aliases": ["Jeffrey Viel"]},
      {"playerId": 8480426,"fullName": "Charle-Edouard D'Astous","lastName": "D'Astous","teamId": 14,"position": "D","aliases": ["Charle-Edouard D'Astous"]},
      {"playerId": 8480995,"fullName": "Pontus Holmberg","lastName": "Holmberg","teamId": 14,"position": "R","aliases": ["Pontus Holmberg"]},
      {"playerId": 8481624,"fullName": "Ilya Mikheyev","lastName": "Mikheyev","teamId": 14,"position": "R","aliases": ["Ilya Mikheyev"]},
      {"playerId": 8482201,"fullName": "Gage Goncalves","lastName": "Goncalves","teamId": 14,"position": "C","aliases": ["Gage Goncalves","Goncalves"]},
      {"playerId": 8482655,"fullName": "J.J. Moser","lastName": "Moser","teamId": 14,"position": "D","aliases": ["J.J. Moser","Moser"]},
      {"playerId": 8482929,"fullName": "Emil Lilleberg","lastName": "Lilleberg","teamId": 14,"position": "D","aliases": ["Emil Lilleberg","Lilleberg"]},
      {"playerId": 8483447,"fullName": "Conor Geekie","lastName": "Geekie","teamId": 14,"position": "C","aliases": ["Conor Geekie"]},
      {"playerId": 8483710,"fullName": "Dennis Hildeby","lastName": "Hildeby","teamId": 14,"position": "G","aliases": ["Dennis Hildeby"]}
    ],
    eventPlayers: [
      {"playerId": 8474151,"fullName": "Ryan McDonagh","lastName": "McDonagh","teamId": 14,"position": "D","aliases": ["Ryan McDonagh","McDonagh"]},
      {"playerId": 8474590,"fullName": "John Carlson","lastName": "Carlson","teamId": 14,"position": "D","aliases": ["John Carlson"]},
      {"playerId": 8475167,"fullName": "Victor Hedman","lastName": "Hedman","teamId": 14,"position": "D","aliases": ["Victor Hedman"]},
      {"playerId": 8476453,"fullName": "Nikita Kucherov","lastName": "Kucherov","teamId": 14,"position": "R","aliases": ["Nikita Kucherov","Kucherov"]},
      {"playerId": 8476878,"fullName": "Zemgus Girgensons","lastName": "Girgensons","teamId": 14,"position": "C","aliases": ["Zemgus Girgensons","Girgensons"]},
      {"playerId": 8476883,"fullName": "Andrei Vasilevskiy","lastName": "Vasilevskiy","teamId": 14,"position": "G","aliases": ["Andrei Vasilevskiy","Vasilevskiy"]},
      {"playerId": 8477404,"fullName": "Jake Guentzel","lastName": "Guentzel","teamId": 14,"position": "C","aliases": ["Jake Guentzel","Guentzel"]},
      {"playerId": 8478010,"fullName": "Brayden Point","lastName": "Point","teamId": 14,"position": "C","aliases": ["Brayden Point","Point"]},
      {"playerId": 8478416,"fullName": "Erik Cernak","lastName": "Cernak","teamId": 14,"position": "D","aliases": ["Erik Cernak","Cernak"]},
      {"playerId": 8478519,"fullName": "Anthony Cirelli","lastName": "Cirelli","teamId": 14,"position": "C","aliases": ["Anthony Cirelli","Cirelli"]},
      {"playerId": 8479542,"fullName": "Brandon Hagel","lastName": "Hagel","teamId": 14,"position": "L","aliases": ["Brandon Hagel","Hagel"]},
      {"playerId": 8479705,"fullName": "Jeffrey Viel","lastName": "Viel","teamId": 14,"position": "L","aliases": ["Jeffrey Viel"]},
      {"playerId": 8479987,"fullName": "Morgan Geekie","lastName": "Geekie","teamId": 6,"position": "C","aliases": ["Morgan Geekie"]},
      {"playerId": 8480426,"fullName": "Charle-Edouard D'Astous","lastName": "D'Astous","teamId": 14,"position": "D","aliases": ["Charle-Edouard D'Astous"]},
      {"playerId": 8480995,"fullName": "Pontus Holmberg","lastName": "Holmberg","teamId": 14,"position": "R","aliases": ["Pontus Holmberg"]},
      {"playerId": 8481624,"fullName": "Ilya Mikheyev","lastName": "Mikheyev","teamId": 14,"position": "R","aliases": ["Ilya Mikheyev"]},
      {"playerId": 8482201,"fullName": "Gage Goncalves","lastName": "Goncalves","teamId": 14,"position": "C","aliases": ["Gage Goncalves","Goncalves"]},
      {"playerId": 8482655,"fullName": "J.J. Moser","lastName": "Moser","teamId": 14,"position": "D","aliases": ["J.J. Moser","Moser"]},
      {"playerId": 8482929,"fullName": "Emil Lilleberg","lastName": "Lilleberg","teamId": 14,"position": "D","aliases": ["Emil Lilleberg","Lilleberg"]},
      {"playerId": 8483447,"fullName": "Conor Geekie","lastName": "Geekie","teamId": 14,"position": "C","aliases": ["Conor Geekie"]},
      {"playerId": 8483710,"fullName": "Dennis Hildeby","lastName": "Hildeby","teamId": 14,"position": "G","aliases": ["Dennis Hildeby"]}
    ],
  }
};

describe("retained audit claim regressions", () => {
  const events = (id: keyof typeof auditReceipts) => {
    const fixture = auditReceipts[id];
    return extractTweetPlayerEvents({ text: fixture.text, players: fixture.eventPlayers, publishedAt: fixture.publishedAt });
  };
  it("binds coordinated DTD and surgery to full subjects, preserving IR and minimum duration", () => {
    const claims = events("2108961062892568787");
    expect(claims.map((event) => event.playerId)).not.toContain(8480840);
    expect(claims).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerId: 8478439, availability: "uncertain" }),
      expect.objectContaining({ playerId: 8481546, availability: "uncertain" }),
      expect.objectContaining({ playerId: 8477499, availability: "out", effectiveDate: "2026-10-03" }),
      expect.objectContaining({ playerId: 8483733, availability: "out", timeline: expect.objectContaining({ minimum: 4, maximum: null, unit: "months" }) }),
    ]));
    expect(claims.find((event) => event.playerId === 8482169)?.availability).not.toBe("available");
    const text = auditReceipts["2108961062892568787"].text;
    for (const claim of claims) expect(text.slice(claim.evidence.start, claim.evidence.end)).toBe(claim.evidence.text);
  });
  it("keeps distinct parenthetical availability predicates with their own subjects", () => {
    const text = "Konecny (will play tonight) and Couturier (ruled out tonight)";
    const players = [auditReceipts["2108961062892568787"].eventPlayers.find((player) => player.playerId === 8478439)!,
      auditReceipts["2108961243746771167"].eventPlayers.find((player) => player.playerId === 8476461)!];
    const claims = extractTweetPlayerEvents({ text, players, publishedAt: null });
    expect(claims).toMatchObject([
      { playerId: 8478439, availability: "available" },
      { playerId: 8476461, availability: "out" },
    ]);
    expect(claims[0]!.evidence.text).not.toContain("Couturier");
    for (const claim of claims) expect(text.slice(claim.evidence.start, claim.evidence.end)).toBe(claim.evidence.text);
  });
  it("keeps distinct parenthetical starter and backup roles with their own subjects", () => {
    const text = "Vladar (confirmed starter) and Woll (backup)";
    const claims = extractTweetPlayerEvents({ text, players: auditReceipts["2108961243746771167"].eventPlayers, publishedAt: null });
    expect(claims).toMatchObject([
      { playerId: 8478435, kind: "goalie", state: "confirmed", goalieRole: "starter" },
      { playerId: 8479361, kind: "goalie", state: "confirmed", goalieRole: "backup" },
    ]);
    expect(claims[0]!.evidence.text).not.toContain("Woll");
    for (const claim of claims) expect(text.slice(claim.evidence.start, claim.evidence.end)).toBe(claim.evidence.text);
  });
  it("preserves explicit starter versus backup roles", () => {
    expect(events("2108961243746771167").filter((event) => event.kind === "goalie")).toMatchObject([
      { playerName: "Dan Vladar", state: "confirmed", goalieRole: "starter" },
      { playerName: "Joseph Woll", state: "confirmed", goalieRole: "backup" },
    ]);
  });
  it.each(["2108946348364153181", "2108958735309865096"] as const)("keeps both CCC starting-goalie subjects in %s", (id) => {
    const claims = events(id);
    expect(claims.filter((event) => event.kind === "goalie")).toHaveLength(2);
    expect(new Set(claims.map((event) => event.teamId))).toEqual(new Set([4, 6]));
    expect(claims.every((event) => event.state === "confirmed" && event.goalieRole === "starter")).toBe(true);
  });
  it.each(["2108968319835603270", "2108974712621805603"] as const)("confirms affirmative goalie prose in %s", (id) => {
    expect(events(id).filter((event) => event.kind === "goalie")).toMatchObject([{ state: "confirmed", goalieRole: "starter" }]);
  });
  it("does not derive a camp group from power play groupings", () => {
    const f = auditReceipts["2101333176509686110"];
    const parsed = interpretTweetUnits(f.text, f.players);
    expect(parsed.units).toHaveLength(2);
    expect(parsed.units.every((unit) => unit.group == null && unit.situation === "pp" && unit.complete)).toBe(true);
  });
  it("parses all eleven forwards, seven defensemen and ordered goalies in the declared Tampa formation", () => {
    const f = auditReceipts["2106513524029821025"];
    const parsed = interpretTweetUnits(f.text, f.players);
    expect(parsed.formation).toEqual({ forwards: 11, defense: 7 });
    expect(parsed.units.filter((unit) => unit.situation === "es_forward").map((unit) => unit.players.length)).toEqual([3, 3, 3, 2]);
    expect(parsed.units.filter((unit) => unit.situation === "es_defense").map((unit) => unit.players.length)).toEqual([2, 2, 2, 1]);
    expect(parsed.units.filter((unit) => unit.situation === "goalie").flatMap((unit) => unit.players.map((player) => player.name))).toEqual(["Andrei Vasilevskiy", "Dennis Hildeby"]);
    expect(completeEvenStrengthUnits(parsed)).toHaveLength(8);
    expect(assignmentsFor({ team_id: 14, metadata: { interpretation: parsed } } as any).filter((assignment) => ["forward_line", "defense_pair"].includes(assignment.unit_type))).toHaveLength(18);
    expect(completeEvenStrengthUnits({ ...parsed, formation: undefined })).toEqual([]);
    expect(completeEvenStrengthUnits({ ...parsed, units: parsed.units.slice(1) })).toEqual([]);
    for (const unit of parsed.units) for (const span of unit.evidence) expect(f.text.slice(span.start, span.end)).toBe(span.text);
  });
  it.each(["Hart is expected in goal", "The coach would expect Hart to start", "Coach did not confirm Hart will start", "Hart starts if healthy", "Hart is not the starter", "Hart is first goalie off", "Hart has made two starts this season.", "Hart is in the starter net at practice.", "Hart did not start yesterday."])("preserves uncertainty or negation in %s", (text) => {
    const claims = extractTweetPlayerEvents({ text, players: [{ playerId: 100, fullName: "Carter Hart", lastName: "Hart", position: "G" }], publishedAt: null });
    expect(claims).toHaveLength(1);
    expect(claims[0]!.state).not.toBe("confirmed");
  });
  it("keeps genuine full-name Bäck claims while abstaining on ordinary lower-case nouns", () => {
    const players = [{ playerId: 8480840, fullName: "Oskar Bäck", lastName: "Bäck", position: "C" }];
    expect(extractTweetPlayerEvents({ text: "Oskar Bäck suffered an injury", players, publishedAt: null })).toMatchObject([{ playerId: 8480840, kind: "injury" }]);
    expect(extractTweetPlayerEvents({ text: "successful back surgery with no named subject", players, publishedAt: null })).toEqual([]);
  });
  it("keeps game absence scoped to the game and does not infer season absence", () => {
    const text = "Josh Morrissey will not return to tonight’s game due to an upper body injury.";
    expect(extractTweetPlayerEvents({ text, players: [{ playerId: 8477504, fullName: "Josh Morrissey", lastName: "Morrissey", position: "D" }], publishedAt: null }))
      .toMatchObject([{ availability: "out", availabilityScope: "game" }]);
  });
  it("does not turn a skater pair or an undeclared short forward row into defense", () => {
    expect(interpretTweetUnits("Warmup lines:\nNorris-McLeod", roster).units.every((unit) => !unit.complete)).toBe(true);
    expect(interpretTweetUnits("Lines:\nNorris-McLeod-Hart", [...roster, { playerId: 100, fullName: "Carter Hart", lastName: "Hart", position: "G" }]).units.every((unit) => !unit.complete)).toBe(true);
  });
});


describe("Oct11 verified original regressions", () => {
  const fixture = JSON.parse(readFileSync(resolve(process.cwd(), "lib/sources/fixtures/october11TroublesomeTweets.json"), "utf8"));
  const original = (id: string) => fixture.records.find((record: any) => record.tweetId === id);
  const events = (id: string) => {
    const record = original(id);
    return extractTweetPlayerEvents({ text: record.text, players: record.players, publishedAt: record.publishedAt });
  };

  it("keeps Shesterkin's season-long absence explicit without applying an old starter claim", () => {
    expect(events("2108957630253113386")).toMatchObject([{ playerName: "Igor Shesterkin", kind: "injury", availability: "out", times: { applicability: "unresolved" } }]);
    expect(extractTweetPlayerEvents({ text: "Shesterkin might be out for the rest of the season.", players: original("2108957630253113386").players, publishedAt: null })).toMatchObject([{ availability: "uncertain" }]);
  });

  it("preserves Veleno's decimal absence range separately from Korpisalo's four weeks", () => {
    expect(events("2108958442983686184")).toMatchObject([
      { playerName: "Joonas Korpisalo", availability: "out", timeline: { minimum: 4, maximum: 4, unit: "weeks" } },
      { playerName: "Joe Veleno", availability: "out", timeline: { purpose: "absence", minimum: 3, maximum: 3.5, unit: "months", text: "3-3.5 months" }, timelines: [{ minimum: 3, maximum: 3.5 }] },
    ]);
  });

  it("retains Dubois's uncertain tomorrow appearance and Roy's DTD separately", () => {
    expect(events("2108961406007570942")).toMatchObject([
      { playerName: "Pierre-Luc Dubois", availability: "uncertain", timeline: { targetDate: "2026-10-11" }, times: { applicability: "unresolved" } },
      { playerName: "Matt Roy", state: "ongoing", availability: "uncertain" },
    ]);
  });

  it("binds Merilainen's explicit pronoun start to the sole preceding goalie", () => {
    const record = original("2108996072647573721");
    expect(events(record.tweetId)).toMatchObject([{ playerName: "Leevi Meriläinen", kind: "goalie", state: "confirmed", times: { observation: record.publishedAt, applicability: "unresolved" } }]);
    const ambiguous = `${record.text.split(". He")[0]}. Another goalie is ready. He’ll get the start.`;
    expect(extractTweetPlayerEvents({ text: ambiguous, players: record.players, publishedAt: record.publishedAt }).some(event => event.state === "confirmed")).toBe(false);
  });

  it("preserves a governing without qualifier and its previous evidence anchor", () => {
    const text = "Morning skate without Hart on the ice.";
    const events = extractTweetPlayerEvents({ text, players: [{ playerId: 100, fullName: "Carter Hart", lastName: "Hart", position: "G" }], publishedAt: null, claimAware: true });
    expect(events).toMatchObject([{ kind: "participation", modality: "negated", availability: "unknown", legacyEvidenceStart: text.indexOf("Hart") }]);
    expect(events[0]!.evidence.text).toContain("without Hart");
    expect(text.slice(events[0]!.evidence.start, events[0]!.evidence.end)).toBe(events[0]!.evidence.text);
    expect(events.some(event => event.kind === "goalie" && event.state === "confirmed")).toBe(false);
  });

  it("retains Lindgren's explicit injured reserve status without confirming a game appearance", () => {
    expect(events("2108233461026726263")).toMatchObject([{ playerName: "Ryan Lindgren", availability: "out", times: { applicability: "unresolved" } }]);
    expect(extractTweetPlayerEvents({ text: "Lindgren is no longer on injured reserve.", players: original("2108233461026726263").players, publishedAt: null }).some(event => event.availability === "out")).toBe(false);
  });

  it("keeps separate availability predicates after negated IR membership", () => {
    expect(injuryAvailability("Lindgren is no longer on injured reserve.")).toBe("unknown");
    expect(injuryAvailability("Lindgren is no longer on injured reserve and will play tonight.")).toBe("available");
    expect(injuryAvailability("Lindgren is not on IR and will play tonight.")).toBe("available");
    expect(injuryAvailability("Lindgren is no longer on injured reserve but will not play tonight.")).toBe("out");
    expect(injuryAvailability("Lindgren is no longer on injured reserve and might play tonight.")).toBe("uncertain");
    expect(injuryAvailability("Lindgren is not on IR and will play tonight?")).toBe("uncertain");
  });

  it("numbers Carolina's first implicit structured row before later rows", () => {
    const record = original("2109051291372777568");
    const result = interpretTweetUnits(record.text, record.players);
    expect(result.units.filter(unit => unit.situation === "es_forward").map(unit => unit.number)).toEqual([1, 2, 3, 4]);
    expect(completeEvenStrengthUnits(result)).toHaveLength(7);
    for (const unit of result.units) for (const span of unit.evidence) expect(record.text.slice(span.start, span.end)).toBe(span.text);
    expect(result.events?.some(event => event.kind === "goalie" && event.state === "confirmed") ?? false).toBe(false);
  });

  it("does not turn Seattle's verified image-only caption into automated lineup rows", () => {
    const record = original("2108693031641551200");
    expect(interpretTweetUnits(record.text, record.players).units).toEqual([]);
    expect(completeEvenStrengthUnits(interpretTweetUnits(record.text, record.players))).toEqual([]);
  });
});
