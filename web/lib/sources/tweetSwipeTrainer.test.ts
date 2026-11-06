import { afterEach, describe, expect, it, vi } from "vitest";

import { buildTeamDirectory, type RosterNameEntry } from "./lineupSourceIngestion";
import {
  assignmentsFromExtraction,
  buildAnswerKeyRecord,
  compareExtraction,
  extractionFromParse,
  isImageOnlyTweet,
  parseTweetForTrainer,
  readAnswerKeyRecord,
  replayAnswerKey,
  summarizeRegression,
  type TrainerExtraction
} from "./tweetSwipeTrainer";

const teams = buildTeamDirectory([{ id: 22, name: "Edmonton Oilers", abbreviation: "EDM", logo: "" }]);
const player = (playerId: number, fullName: string, position: string): RosterNameEntry => ({
  playerId,
  fullName,
  lastName: fullName.split(" ").slice(1).join(" "),
  position,
  teamId: 22
});
const roster: RosterNameEntry[] = [
  player(1, "Zach Hyman", "L"),
  player(2, "Connor McDavid", "C"),
  player(3, "Leon Draisaitl", "C"),
  player(4, "Evan Bouchard", "D"),
  player(5, "Mattias Ekholm", "D"),
  player(6, "Stuart Skinner", "G"),
  player(7, "Corey Perry", "R"),
  player(8, "Ryan Nugent-Hopkins", "C"),
  player(9, "Darnell Nurse", "D"),
  player(10, "Brett Kulak", "D"),
  player(11, "Adam Henrique", "C"),
  player(12, "Viktor Arvidsson", "R")
];
const rosterByTeam = new Map([[22, roster]]);
const parse = (text: string, hasMedia = false) =>
  parseTweetForTrainer({ input: { text, handles: ["gamedaylines"], publishedAt: "2026-11-05T22:00:00Z", hasMedia }, teams, rosterByTeam });

const lineupText = [
  "#Oilers lines tonight",
  "Hyman - McDavid - Draisaitl",
  "Perry - Nugent-Hopkins - Zzyzx",
  "Nurse - Bouchard",
  "Ekholm - Kulak",
  "Skinner"
].join("\n");

describe("parseTweetForTrainer", () => {
  it("shows kept lines, dropped candidate lines and per-player match confidence for a line combination", () => {
    const result = parse(lineupText);
    expect(result.type).toBe("line_combination");
    expect(result.category).toBe("LINE COMBINATION");
    expect(result.teamAbbreviation).toBe("EDM");
    const kept = result.forwards.filter((line) => line.kept);
    expect(kept.map((line) => line.slots.map((slot) => slot.playerId))).toEqual([[1, 2, 3]]);
    // Surname-only tweet names are near matches, not certain ones.
    expect(kept[0]!.slots.map((slot) => slot.basis)).toEqual(["surname", "surname", "surname"]);
    expect(kept[0]!.slots[0]!.confidence).toBe(75);
    const dropped = result.forwards.find((line) => !line.kept);
    expect(dropped?.slots.map((slot) => slot.raw)).toEqual(["Perry", "Nugent-Hopkins", "Zzyzx"]);
    expect(dropped?.slots[2]).toMatchObject({ playerId: null, basis: "missing", confidence: 0 });
    expect(result.defensePairs.filter((line) => line.kept)).toHaveLength(2);
    // 100 minus named penalties: 3 of 7 units complete costs 23; surname-only names cost a few more.
    expect(result.confidence.version).toMatch(/^trainer-/);
    expect(result.confidence.signals.map((signal) => signal.label)).toContain("3 of 7 even-strength units complete");
    expect(result.confidence.signals.every((signal) => signal.points <= 0)).toBe(true);
    expect(result.confidence.score).toBe(100 + result.confidence.signals.reduce((sum, signal) => sum + signal.points, 0));
    expect(result.confidence.band).toBe("mid");
  });

  it("marks a player whose position contradicts the slot", () => {
    const result = parse("Oilers lines\nZach Hyman - Connor McDavid - Leon Draisaitl\nDarnell Nurse - Evan Bouchard\nMattias Ekholm - Brett Kulak\nStuart Skinner");
    expect(result.goalies[0]).toMatchObject({ playerId: 6, positionFits: true, confidence: 100 });
    const wrongSlot = parseTweetForTrainer({
      input: { text: "Oilers lines\nZach Hyman - Darnell Nurse - Leon Draisaitl", handles: [], publishedAt: null, hasMedia: false },
      teams,
      rosterByTeam
    });
    const nurse = wrongSlot.forwards.flatMap((line) => line.slots).find((slot) => slot.playerId === 9);
    expect(nurse).toMatchObject({ positionFits: false, confidence: 60 });
    expect(wrongSlot.confidence.signals.map((signal) => signal.label)).toContain("Publication time unknown");
  });

  it("docks a lineup for named players it didn't place (a missed backup goalie, extras)", () => {
    const placedAll = parse("Oilers lines\nZach Hyman - Connor McDavid - Leon Draisaitl\nDarnell Nurse - Evan Bouchard\nMattias Ekholm - Brett Kulak");
    expect(placedAll.confidence.signals.some((signal) => /not placed/.test(signal.label))).toBe(false);
    // Perry and Kulak are named but sit in no line, pair or goalie spot.
    const missing = parse("Oilers lines\nZach Hyman - Connor McDavid - Leon Draisaitl\nDarnell Nurse - Evan Bouchard\nMattias Ekholm\nExtras: Corey Perry, Brett Kulak");
    const signal = missing.confidence.signals.find((entry) => /not placed/.test(entry.label));
    expect(signal).toBeTruthy();
    expect(signal!.points).toBeLessThanOrEqual(-5);
    expect(signal!.points).toBeGreaterThanOrEqual(-25);
  });

  it("reads a power-play tweet as PP1 and PP2 units, not even-strength lines", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const result = parse(
      "#Oilers PP personnel: QB-LW-RW-B-N\nPP1: Bouchard-Hyman-Perry-McDavid-Draisaitl\nPP2: Ekholm-Henrique-Arvidsson-Nurse-Kulak"
    );
    vi.unstubAllEnvs();
    expect(result).toMatchObject({ type: "line_combination", subcategory: "POWER PLAY" });
    expect(result.powerPlay.map((unit) => unit.slots.map((slot) => slot.playerId))).toEqual([
      [4, 1, 7, 2, 3],
      [5, 11, 12, 9, 10]
    ]);
    const labels = result.confidence.signals.map((signal) => signal.label);
    // Scored on its two units, and its named players count as placed.
    expect(labels.some((label) => /even-strength/.test(label))).toBe(false);
    expect(labels.some((label) => /power-play units complete/.test(label))).toBe(false);
    expect(labels.some((label) => /not placed/.test(label))).toBe(false);
    const extraction = extractionFromParse(result);
    expect(extraction.powerPlay).toHaveLength(2);
    // Units are ordered; players within a unit compare as a set.
    expect(compareExtraction(extraction, { ...extraction, powerPlay: [...extraction.powerPlay].reverse() }).slotsMatch).toBe(false);
    expect(compareExtraction(extraction, { ...extraction, powerPlay: [extraction.powerPlay[0]!] }).correct).toBe(false);
  });

  it("rates full-name matches as certain", () => {
    const result = parse("Oilers lines\nZach Hyman - Connor McDavid - Leon Draisaitl\nDarnell Nurse - Evan Bouchard\nMattias Ekholm - Brett Kulak");
    const slots = result.forwards.filter((line) => line.kept).flatMap((line) => line.slots);
    expect(slots.map((slot) => slot.basis)).toEqual(["full_name", "full_name", "full_name"]);
    expect(slots.every((slot) => slot.confidence === 100)).toBe(true);
  });

  it("flags image-only tweets and caps their confidence", () => {
    expect(isImageOnlyTweet("Oilers lines https://t.co/abc123", false)).toBe(true);
    expect(isImageOnlyTweet("RT @x: #Oilers 👀", true)).toBe(true);
    expect(isImageOnlyTweet(lineupText, true)).toBe(false);
    const result = parse("Oilers lines https://t.co/abc123", true);
    expect(result.imageOnly).toBe(true);
    expect(result.confidence.score).toBeLessThanOrEqual(15);
  });

  it("types a goalie start", () => {
    const result = parse("Stuart Skinner will start in net tonight for the Oilers");
    expect(result.type).toBe("goalie");
    expect(result.category).toBe("GOALIE START");
    expect(result.players.map((match) => match.playerId)).toContain(6);
  });
});

describe("answer key", () => {
  it("stores the parser output as the expected answer when TJ swipes right", () => {
    const result = parse(lineupText);
    const record = buildAnswerKeyRecord({
      verdict: "correct",
      tweetId: "1",
      input: { text: lineupText, handles: ["gamedaylines"], publishedAt: null, hasMedia: false },
      parse: result,
      labeledAt: "2026-11-06T00:00:00Z"
    });
    expect(record.expected).toEqual(record.parsed);
    expect(record.parsedConfidence).toBe(result.confidence.score);
    expect(record.textSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(record.parserAtLabel).toMatchObject({ interpretation: false, confidence: result.confidence });
    expect(readAnswerKeyRecord({ answerKey: record })).toEqual(record);
    expect(readAnswerKeyRecord({})).toBeNull();
    const [assignment] = assignmentsFromExtraction(record.expected);
    expect(assignment).toMatchObject({ category: "LINE COMBINATION" });
    expect(assignment!.playerIds).toEqual(expect.arrayContaining([1, 2, 3, 4, 5, 9, 10]));
  });

  it("stores TJ's correction when the parser was wrong, and scores regressions against it", () => {
    const result = parse(lineupText);
    const parsed = extractionFromParse(result);
    const correction: TrainerExtraction = {
      ...parsed,
      forwards: [...parsed.forwards, [
        { playerId: 7, name: "Corey Perry" },
        { playerId: 8, name: "Ryan Nugent-Hopkins" },
        { playerId: null, name: "Zzyzx" }
      ]]
    };
    const record = buildAnswerKeyRecord({
      verdict: "wrong",
      tweetId: "1",
      input: { text: lineupText, handles: [], publishedAt: null, hasMedia: false },
      parse: result,
      correction
    });
    expect(record.expected).toBe(correction);
    expect(compareExtraction(record.expected, parsed)).toMatchObject({ correct: false, slotsMatch: false, categoryMatch: true });
    // Players within a line compare as a set; line order matters.
    const reordered = { ...correction, forwards: correction.forwards.map((line) => [...line].reverse()) };
    expect(compareExtraction(correction, reordered).correct).toBe(true);
    expect(compareExtraction(correction, { ...correction, forwards: [...correction.forwards].reverse() }).correct).toBe(false);
    // The team is scored when the answer names one, and skipped for records saved before teams were labelled.
    expect(compareExtraction({ ...correction, teamId: 10 }, { ...correction, teamId: 22 })).toMatchObject({ correct: false, teamMatch: false });
    expect(compareExtraction({ ...correction, teamId: undefined }, { ...correction, teamId: 22 }).teamMatch).toBe(true);
    expect(compareExtraction({ ...correction, teamId: null }, { ...correction, teamId: null }).teamMatch).toBe(true);
    // Extra skaters are scored like the other slot groups; old records without them read as none.
    const withExtra = { ...correction, extraForwards: [{ playerId: 7, name: "Corey Perry" }] };
    expect(compareExtraction(withExtra, correction)).toMatchObject({ correct: false, slotsMatch: false });
    const legacy = { ...record, expected: { ...record.expected, extraForwards: undefined as never, extraDefensemen: undefined as never, powerPlay: undefined as never } };
    expect(readAnswerKeyRecord({ answerKey: legacy })!.expected).toMatchObject({ extraForwards: [], extraDefensemen: [], powerPlay: [] });

    const summary = summarizeRegression([
      { id: "fixed", type: "line_combination", baselineCorrect: false, comparison: compareExtraction(correction, correction) },
      { id: "broken", type: "goalie", baselineCorrect: true, comparison: compareExtraction(correction, parsed) },
      { id: "steady", type: "goalie", baselineCorrect: true, comparison: compareExtraction(parsed, parsed) }
    ]);
    expect(summary).toMatchObject({ total: 3, correct: 2, newlyFixed: ["fixed"], newlyBroken: ["broken"] });
    expect(summary.byType).toEqual([
      { type: "line_combination", total: 1, correct: 1, accuracy: 100 },
      { type: "goalie", total: 2, correct: 1, accuracy: 50 }
    ]);
  });
});

describe("replayAnswerKey", () => {
  it("reports a case as newly fixed once an alias makes the parser match TJ's answer", async () => {
    const text = "Oilers lines\nHyman - McDavid - Drai\nNurse - Bouchard\nEkholm - Kulak";
    const input = { text, handles: ["gamedaylines"], publishedAt: "2026-11-05T22:00:00Z", hasMedia: false };
    const before = parseTweetForTrainer({ input, teams, rosterByTeam });
    const parsed = extractionFromParse(before);
    expect(parsed.forwards).toEqual([]);
    const expected: TrainerExtraction = {
      ...parsed,
      category: "LINE COMBINATION",
      subcategory: "FORWARD LINES",
      players: [1, 2, 3, 4, 5, 9, 10].map((playerId) => ({ playerId, name: String(playerId) })),
      forwards: [[{ playerId: 1, name: "Zach Hyman" }, { playerId: 2, name: "Connor McDavid" }, { playerId: 3, name: "Leon Draisaitl" }]]
    };
    const record = buildAnswerKeyRecord({ verdict: "wrong", tweetId: "9", input, parse: before, correction: expected });
    const withAlias = new Map([[22, roster.map((entry) => (entry.playerId === 3 ? { ...entry, aliases: ["Drai"] } : entry))]]);

    const stale = await replayAnswerKey({ entries: [{ id: "row-9", record }], contextFor: async () => ({ teams, rosterByTeam }) });
    expect(stale.summary).toMatchObject({ correct: 0, newlyFixed: [], newlyBroken: [] });

    const fixed = await replayAnswerKey({ entries: [{ id: "row-9", record }], contextFor: async () => ({ teams, rosterByTeam: withAlias }) });
    expect(fixed.results[0]!.comparison.slotsMatch).toBe(true);
    expect(fixed.summary.newlyFixed).toEqual(["row-9"]);

    // Against a baseline where it already passed, losing the alias shows up as newly broken.
    const broken = await replayAnswerKey({ entries: [{ id: "row-9", record }], baseline: { "row-9": true }, contextFor: async () => ({ teams, rosterByTeam }) });
    expect(broken.summary.newlyBroken).toEqual(["row-9"]);
  });
});

describe("interpretation path (production)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("replays the path production runs and counts its unresolved names", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const result = parse("Oilers lines\nZach Hyman - Connor McDavid - Leon Draisaitl\nCorey Perry - Ryan Nugent-Hopkins - Qqq Zzyzx\nDarnell Nurse - Evan Bouchard\nMattias Ekholm - Brett Kulak");
    expect(result.forwards.filter((line) => line.kept).map((line) => line.slots.map((slot) => slot.playerId))).toEqual([[1, 2, 3]]);
    expect(result.unresolvedCount).toBeGreaterThan(0);
    expect(result.players.some((player) => player.playerId == null && /Zzyzx/.test(player.raw))).toBe(true);
    const record = buildAnswerKeyRecord({
      verdict: "correct", tweetId: null, input: { text: "x", handles: [], publishedAt: null, hasMedia: false }, parse: result
    });
    expect(record.parserAtLabel.interpretation).toBe(true);
  });
});
