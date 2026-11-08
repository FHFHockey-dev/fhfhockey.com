import { describe, expect, it } from "vitest";
import { FHFH_STANDARD_SCORING } from "lib/buyLowSellHigh/trade";
import { FIXTURE_BLSH_EVIDENCE } from "./fixtureEvidence";
import { retrospectiveComparison, retrospectivePlayer } from "./retrospective";

const perGame = (id: string) => {
  const profile = FIXTURE_BLSH_EVIDENCE[id], fp = profile.tracks.find(track => track.track === "fantasy_points")!;
  return fp.observed / profile.evidence.window.games;
};

describe("retrospective trade fallback", () => {
  it.each([
    { name: "empty give side", give: [], receive: ["fx-f3"], reason: /at least one player to each side/ },
    { name: "empty receive side", give: ["fx-f5"], receive: [], reason: /at least one player to each side/ },
    { name: "both sides empty", give: [], receive: [], reason: /at least one player to each side/ },
    { name: "repeated give player", give: ["fx-f5", "fx-f5"], receive: ["fx-f3"], reason: /more than once on the give side/ },
    { name: "repeated receive player", give: ["fx-f5"], receive: ["fx-f3", "fx-f3"], reason: /more than once on the receive side/ },
    { name: "player on both sides", give: ["fx-f5"], receive: ["fx-f3", "fx-f5"], reason: /both sides of the trade/ },
    { name: "repeated unknown player", give: ["unknown", "unknown"], receive: ["fx-f3"], reason: /more than once on the give side/ },
    { name: "unknown player on both sides", give: ["unknown"], receive: ["fx-f3", "unknown"], reason: /both sides of the trade/ },
  ])("withholds both totals and net for $name without repairing the offer", ({ give, receive, reason }) => {
    const before = { give: [...give], receive: [...receive], evidence: structuredClone(FIXTURE_BLSH_EVIDENCE) };
    Object.freeze(give);
    Object.freeze(receive);
    const result = retrospectiveComparison(give, receive, FHFH_STANDARD_SCORING, FIXTURE_BLSH_EVIDENCE);
    expect(result).toMatchObject({ available: false, give: { value: null }, receive: { value: null }, net: null });
    expect(result.reason).toMatch(reason);
    expect(result.players.map(player => player.playerId)).toEqual([...before.give, ...before.receive]);
    expect({ give, receive, evidence: FIXTURE_BLSH_EVIDENCE }).toEqual(before);
  });

  it("sums recorded FHFH Standard points per game from the BLSH FP track", () => {
    const result = retrospectiveComparison(["fx-f5"], ["fx-f3", "fx-f6"], FHFH_STANDARD_SCORING, FIXTURE_BLSH_EVIDENCE);
    expect(result.available).toBe(true);
    expect(result.give.value).toBeCloseTo(perGame("fx-f5"), 12);
    expect(result.receive.value).toBeCloseTo(perGame("fx-f3") + perGame("fx-f6"), 12);
    expect(result.net).toBeCloseTo(perGame("fx-f3") + perGame("fx-f6") - perGame("fx-f5"), 12);
  });

  it.each(["unknown", "constructor", "toString", "__proto__"].flatMap(id =>
    (["give", "receive"] as const).map(missingSide => ({ id, missingSide }))))("retains unknown $id on a valid $missingSide side and withholds only that side", ({ id, missingSide }) => {
    const give = missingSide === "give" ? ["fx-f5", id] : ["fx-f5"];
    const receive = missingSide === "receive" ? ["fx-f3", id] : ["fx-f3"];
    const before = structuredClone(FIXTURE_BLSH_EVIDENCE);
    const result = retrospectiveComparison(give, receive, FHFH_STANDARD_SCORING, FIXTURE_BLSH_EVIDENCE);
    expect(result).toMatchObject({ available: false, net: null });
    expect(result[missingSide]).toEqual({ value: null, missingPlayerIds: [id] });
    expect(result[missingSide === "give" ? "receive" : "give"].value).toBeCloseTo(perGame(missingSide === "give" ? "fx-f3" : "fx-f5"), 12);
    expect(result.players.map(player => player.playerId)).toEqual([...give, ...receive]);
    expect(result.reason).toMatch(/no recorded BLSH track/);
    expect(FIXTURE_BLSH_EVIDENCE).toEqual(before);
    expect(Object.getPrototypeOf(FIXTURE_BLSH_EVIDENCE)).toBe(Object.prototype);
  });

  it.each(["constructor", "toString", "__proto__"])("uses an own evidence entry for %s instead of rejecting its ID", id => {
    const evidence = { ...FIXTURE_BLSH_EVIDENCE, [id]: FIXTURE_BLSH_EVIDENCE["fx-f5"] };
    const result = retrospectiveComparison([id], ["fx-f3"], FHFH_STANDARD_SCORING, evidence);
    expect(result.available).toBe(true);
    expect(result.give.value).toBeCloseTo(perGame("fx-f5"), 12);
    expect(result.net).toBeCloseTo(perGame("fx-f3") - perGame("fx-f5"), 12);
    expect(Object.getPrototypeOf(evidence)).toBe(Object.prototype);
  });

  it("withholds a side with a missing or scoreless player instead of counting zero", () => {
    const result = retrospectiveComparison(["fx-f5"], ["fx-f3", "fx-g1", "fx-d2"], FHFH_STANDARD_SCORING, FIXTURE_BLSH_EVIDENCE);
    expect(result).toMatchObject({ available: false, net: null, receive: { value: null, missingPlayerIds: ["fx-g1", "fx-d2"] } });
    expect(retrospectivePlayer("fx-d2", FIXTURE_BLSH_EVIDENCE["fx-d2"]).reason).toBe("Fewer than five current games recorded");
    expect(retrospectivePlayer("fx-g1", undefined).reason).toMatch(/No BLSH evidence/);
    const noHeadline = { ...FIXTURE_BLSH_EVIDENCE["fx-f5"], score: { ...FIXTURE_BLSH_EVIDENCE["fx-f5"].score, headline: null, reasonText: null } };
    expect(retrospectivePlayer("fx-f5", noHeadline)).toMatchObject({ recordedPerGame: null, reason: "The FHFH Standard points track is unavailable" });
  });

  it("is unavailable under any scoring other than FHFH Standard", () => {
    const custom = retrospectiveComparison(["fx-f5"], ["fx-f3"], { mode: "points", scoringBasis: "points:custom", weights: { GOALS: 1 } }, FIXTURE_BLSH_EVIDENCE);
    expect(custom).toMatchObject({ available: false, net: null });
    expect(custom.reason).toMatch(/FHFH Standard points only/);
  });
});
