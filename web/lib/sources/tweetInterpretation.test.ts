// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { interpretTweetUnits, segmentPlayerRow } from "./tweetInterpretation";
import { classifyInjuryEvent, extractInjuryTimeline, extractInjuryTimelines, extractTweetPlayerEvents } from "./tweetPlayerEvents";
import { assignmentsFor } from "../player-forecasts/sourceObservations";
import { buildLinesCccSourceFromIftttEvent } from "./linesCccIngestion";
import { reconcileAlias } from "./tweetAliasReconciliation";

const names = ["Ryan McLeod", "Josh Norris", "Konsta Helenius", "Zach Aston-Reese", "Pierre Olivier-Joseph", "Noah Dower Nilsson", "Dylan Guenther", "Logan Cooley", "Nick Schmaltz", "Clayton Keller", "Mikhail Sergachev", "Anders Lee", "Vincent Trocheck", "Kailer Yamamoto", "Barrett Hayton", "John Marino"];
const roster = names.map((fullName, index) => ({ playerId: index + 1, fullName, lastName: fullName.slice(fullName.indexOf(" ") + 1), position: "C" }));

describe("structured tweet interpretation", () => {
  afterEach(() => vi.unstubAllEnvs());
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
