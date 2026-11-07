import { describe, expect, it } from "vitest";

import { assetsFromText, previewOffer, rosterFromText, type OfferInput, type OfferTeam, type TeamId } from "./offer";
import { emptySlots, slotFeasibility, type SlotEntry } from "./slotFeasibility";

const team = (id: TeamId, roster: string, capacity: number): OfferTeam => ({ id, name: `Team ${id}`, roster: rosterFromText(id, roster),
  rosterReviewed: true, totalCapacity: capacity, capacityReviewed: true, givePlayerIds: [], dropPlayerIds: [], otherAssets: [] });
const slots = (counts: Partial<Record<keyof SlotEntry["slots"], number>>): SlotEntry =>
  ({ slots: { ...emptySlots(), ...Object.fromEntries(Object.keys(emptySlots()).map(key => [key, String(counts[key as keyof SlotEntry["slots"]] ?? 0)])) }, slotsReviewed: true });
const standard = slots({ C: 1, LW: 1, RW: 1, D: 2, G: 1 });
const give = (side: OfferTeam, ...names: string[]) => { side.givePlayerIds = side.roster.filter(player => names.includes(player.name)).map(player => player.id); };
const run = (offer: OfferInput, entries: [SlotEntry, SlotEntry] = [standard, standard]) => slotFeasibility(offer, previewOffer(offer), entries);
const value = (result: ReturnType<typeof run>, index: number) => {
  const coverage = result.teams[index].coverage;
  if (coverage.status !== "available") throw new Error(coverage.reasons.join(" "));
  return coverage.value;
};
const row = (result: ReturnType<typeof run>, index: number, position: string) => value(result, index).positions.find(item => item.position === position);

function swap(): OfferInput {
  const a = team("a", "AC | C | active\nALW | LW | active\nARW | RW | active\nAD1 | D | active\nAD2 | D | bench\nAG | G | active", 6);
  const b = team("b", "BC1 | C | active\nBC2 | C | bench\nBLW | LW | active\nBRW | RW | active\nBD | D | active\nBG | G | active", 6);
  give(a, "AD2"); give(b, "BC2");
  return { effectiveDate: "2026-11-10", teams: [a, b] };
}

describe("entered-offer starting-slot coverage", () => {
  it("compares both teams before and after a one-for-one C-for-D swap", () => {
    const result = run(swap());
    expect(result.issues).toEqual([]);
    expect(value(result, 0)).toMatchObject({ before: { totalSlots: 6, filled: 6, unfilled: 0 }, after: { filled: 5, unfilled: 1 }, unfilledChange: 1 });
    expect(row(result, 0, "D")).toEqual({ position: "D", dedicatedSlots: 2, filledBefore: 2, filledAfter: 1, eligibleBefore: 2, eligibleAfter: 1 });
    expect(row(result, 0, "C")).toMatchObject({ eligibleBefore: 1, eligibleAfter: 2, filledAfter: 1 });
    expect(value(result, 1)).toMatchObject({ before: { unfilled: 1 }, after: { unfilled: 0 }, unfilledChange: -1 });
    expect(row(result, 1, "D")).toMatchObject({ filledBefore: 1, filledAfter: 2 });
  });

  it("uses a dual-position player at most once and keeps flex slots non-additive", () => {
    const a = team("a", "Dual | C/LW | active\nAD | D | active", 2);
    const b = team("b", "BD | D | active\nBC | C | active", 2);
    give(a, "AD"); give(b, "BD");
    const entry = slots({ C: 1, LW: 1, F: 1, D: 1 });
    const result = run({ effectiveDate: "2026-11-10", teams: [a, b] }, [entry, entry]);
    const before = value(result, 0).before;
    expect(before).toMatchObject({ totalSlots: 4, filled: 2, unfilled: 2 });
    expect(before.assignments.filter(item => item.playerName === "Dual")).toHaveLength(1);
    const forwardSlots = before.assignments.filter(item => ["C", "LW", "F"].includes(item.slotType));
    expect(forwardSlots).toHaveLength(1);
    expect(value(result, 1).after).toMatchObject({ filled: 2, unfilled: 2 });
  });

  it("evaluates the post-drop roster for an uneven exchange and shows a lost goalie slot", () => {
    const offer = swap();
    give(offer.teams[1], "BC2", "BRW");
    offer.teams[0].dropPlayerIds = offer.teams[0].roster.filter(player => player.name === "AG").map(player => player.id);
    const result = run(offer);
    expect(row(result, 0, "G")).toMatchObject({ dedicatedSlots: 1, filledBefore: 1, filledAfter: 0, eligibleAfter: 0 });
    expect(row(result, 0, "D")).toMatchObject({ filledAfter: 1 });
    expect(value(result, 0).after).toMatchObject({ filled: 4, unfilled: 2 });
    expect(value(result, 0).unfilledChange).toBe(2);
    expect(value(result, 1).after).toMatchObject({ filled: 5, unfilled: 1 });
    expect(row(result, 1, "RW")).toMatchObject({ filledBefore: 1, filledAfter: 0 });
  });

  it("keeps an incoming reserve player out of active coverage and labels carried status", () => {
    const offer = swap();
    offer.teams[1].roster.push(...rosterFromText("b", "Hurt | D | IR").map(player => ({ ...player, id: "manual:b:hurt" })));
    give(offer.teams[1], "Hurt");
    const result = run(offer);
    expect(result.teams[0].incoming).toEqual([{ name: "Hurt", status: "IR" }]);
    expect(value(result, 0).after).toMatchObject({ excludedReserves: 1, unfilled: 1 });
    expect(row(result, 0, "D")).toMatchObject({ eligibleAfter: 1 });
  });

  it("withholds only the affected team when a status or position is unknown", () => {
    const offer = swap();
    offer.teams[1].roster[1] = { ...offer.teams[1].roster[1], status: "starter" };
    let result = run(offer);
    expect(result.teams[0].coverage).toEqual({ status: "unavailable", reasons: ["Team a after: status must be active, bench, IR, IR+ or NA for BC2."] });
    expect(result.teams[1].coverage.status).toBe("unavailable");
    offer.teams[1].roster[1] = { ...offer.teams[1].roster[1], status: "bench" };
    offer.teams[0].roster[3] = { ...offer.teams[0].roster[3], positions: "" };
    result = run(offer);
    expect(result.teams[0].coverage).toMatchObject({ status: "unavailable", reasons: [expect.stringContaining("league positions are unknown for AD1"), expect.stringContaining("after")] });
    expect(result.teams[1].coverage.status).toBe("available");
  });

  it("never treats missing or unreviewed starting slots as covered", () => {
    const blank: SlotEntry = { slots: emptySlots(), slotsReviewed: true };
    const unreviewed = { ...standard, slotsReviewed: false };
    const result = run(swap(), [blank, unreviewed]);
    expect(result.teams.map(item => item.coverage.status)).toEqual(["unavailable", "unavailable"]);
    expect(result.issues.map(issue => issue.code)).toEqual(["slots_missing", "slots_review"]);
    expect(result.teams[0].coverage).toMatchObject({ reasons: [expect.stringContaining("No starting slots are assumed")] });
  });

  it("withholds a recipient whose incoming players come from an unreviewed sender, but not an independent side", () => {
    const offer = swap();
    offer.teams[1].rosterReviewed = false;
    let result = run(offer);
    expect(result.teams[0].coverage).toEqual({ status: "unavailable", reasons: ["Team a after: incoming players come from Team b's unreviewed roster. Review that roster before comparing coverage."] });
    expect(result.teams[1].coverage).toMatchObject({ status: "unavailable", reasons: [expect.stringContaining("confirm the complete before-roster")] });
    offer.teams[1].givePlayerIds = [];
    offer.teams[1].otherAssets = assetsFromText("pick: 2027 round 2");
    result = run(offer);
    expect(result.teams[0].incoming).toEqual([]);
    expect(value(result, 0)).toMatchObject({ before: { filled: 6 }, after: { filled: 5, unfilled: 1 }, unfilledChange: 1 });
  });

  it.each(["__proto__", "constructor"])("rejects the inherited-property status %s instead of counting a reserve", status => {
    const offer = swap();
    offer.teams[0].roster[3] = { ...offer.teams[0].roster[3], status };
    const result = run(offer);
    expect(result.teams[0].coverage).toEqual({ status: "unavailable", reasons: [
      "Team a before: status must be active, bench, IR, IR+ or NA for AD1.", "Team a after: status must be active, bench, IR, IR+ or NA for AD1."] });
    expect(result.teams[1].coverage.status).toBe("available");
  });

  it("treats a confirmed empty after-roster as zero filled slots without valuing the pick", () => {
    const a = team("a", "AC | C | active", 1), b = team("b", "BD | D | active", 2);
    give(a, "AC"); b.otherAssets = assetsFromText("pick: 2027 round 2, original owner unknown");
    let offer: OfferInput = { effectiveDate: "2026-11-10", teams: [a, b] };
    let result = run(offer, [slots({ C: 1 }), slots({ C: 1, D: 1 })]);
    expect(value(result, 0)).toEqual({ before: { totalSlots: 1, filled: 1, unfilled: 0, excludedReserves: 0, assignments: [{ playerName: "AC", slotType: "C" }] },
      after: { totalSlots: 1, filled: 0, unfilled: 1, excludedReserves: 0, assignments: [] },
      positions: expect.arrayContaining([{ position: "C", dedicatedSlots: 1, filledBefore: 1, filledAfter: 0, eligibleBefore: 1, eligibleAfter: 0 }]), unfilledChange: 1 });
    expect(value(result, 1)).toMatchObject({ before: { filled: 1 }, after: { filled: 2, unfilled: 0 }, unfilledChange: -1 });
    expect(previewOffer(offer).valuation.status).toBe("unavailable");

    const c = team("a", "AC | C | active\nAL | LW | bench", 2), d = team("b", "BD | D | active", 3);
    give(c, "AC"); d.otherAssets = assetsFromText("pick: 2028 round 1");
    c.dropPlayerIds = [c.roster[1].id];
    offer = { effectiveDate: "2026-11-10", teams: [c, d] };
    result = run(offer, [slots({ C: 1, LW: 1 }), slots({ C: 1, LW: 1 })]);
    expect(value(result, 0)).toMatchObject({ before: { filled: 2, unfilled: 0 }, after: { totalSlots: 2, filled: 0, unfilled: 2 }, unfilledChange: 2 });
  });

  it("withholds both teams when identity or ownership blocks the exchange, and flags a slot mismatch", () => {
    const offer = swap();
    offer.teams[1].roster[0] = { ...offer.teams[1].roster[0], name: "AC" };
    const result = run(offer, [standard, slots({ C: 2, LW: 1, RW: 1, D: 2, G: 1 })]);
    expect(result.teams.map(item => item.coverage.status)).toEqual(["unavailable", "unavailable"]);
    expect(result.issues.map(issue => issue.code)).toEqual(["slots_mismatch"]);
  });
});
