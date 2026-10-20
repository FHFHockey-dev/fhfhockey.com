import { describe, expect, it } from "vitest";
import { dropEligible, droppedOwnership, knownOwnership, orderDropCandidates, ownershipLabel, retentionCaution, retentionCautionText } from "./retention";
import type { PlanningPlayer } from "./planningTypes";

const player = (id: string, ownership: number | null, holdValue: number | null = null, extra: Partial<PlanningPlayer> = {}): PlanningPlayer => ({
  id, nhlId: null, name: id, teamAbbreviation: "AAA", eligiblePositions: ["C"], playerClass: "skater", availability: "rostered",
  ownership, canDrop: true, holdValue, reserveEligibility: [], ...extra });
const permutations = <T,>(items: T[]): T[][] => items.length <= 1 ? [items]
  : items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map(rest => [item, ...rest]));
const ids = (players: PlanningPlayer[]) => players.map(row => row.id);

describe("retention policy", () => {
  it("treats a reported 0% as known and missing or invalid values as unknown", () => {
    expect(knownOwnership(player("zero", 0))).toBe(0);
    expect(knownOwnership(player("some", 12.5))).toBe(12.5);
    for (const value of [null, undefined, Number.NaN, -1, 101] as const) expect(knownOwnership({ ownership: value as number | null })).toBeNull();
  });

  it("cautions on fresh high demand at the 50% boundary, never on unknown", () => {
    expect(retentionCaution(player("p", 50))).toEqual({ level: "high_demand", ownership: 50 });
    expect(retentionCaution(player("p", 49.9))).toEqual({ level: "none", ownership: 49.9 });
    expect(retentionCaution(player("p", 0))).toEqual({ level: "none", ownership: 0 });
    expect(retentionCaution(player("p", null))).toEqual({ level: "unknown", ownership: null });
  });

  it("drops the less-rostered of two equal contributors whatever the id order", () => {
    for (const order of permutations([player("a", 95), player("z", 5)])) expect(ids(orderDropCandidates(order, () => 1))).toEqual(["z", "a"]);
  });

  it("lets contribution dominate ownership", () => {
    expect(ids(orderDropCandidates([player("low", 95), player("high", 5)], row => row.id === "low" ? 0 : 3))).toEqual(["low", "high"]);
    // Unknown contribution sorts after every known contribution.
    expect(ids(orderDropCandidates([player("unknown", 1), player("known", 99)], row => row.id === "known" ? 5 : null))).toEqual(["known", "unknown"]);
  });

  it("ignores ownership for a tied group with any unknown member, staying transitive", () => {
    // Pairwise "ownership when both known, else holdValue" would cycle here: A<C, C<B, B<A.
    const group = [player("A", 5, 9), player("B", null, 5), player("C", 95, 1)];
    for (const order of permutations(group)) expect(ids(orderDropCandidates(order, () => 0))).toEqual(["C", "B", "A"]);
  });

  it("never offers protected, out or reserve-held players", () => {
    const intent = { protectedPlayerIds: ["kept"] };
    expect(dropEligible(player("ok", 5), intent, new Set())).toBe(true);
    expect(dropEligible(player("kept", 5), intent, new Set())).toBe(false);
    expect(dropEligible(player("ir", 5), intent, new Set(["ir"]))).toBe(false);
    expect(dropEligible(player("out", 5, null, { injury: { status: "IR-LT", label: "IR", note: null } }), intent, new Set())).toBe(false);
    expect(dropEligible(player("dtd", 5, null, { injury: { status: "DTD", label: "Day-to-Day", note: null } }), intent, new Set())).toBe(true);
    expect(dropEligible(player("locked", 5, null, { canDrop: null }), intent, new Set())).toBe(false);
  });

  it("reports a plan's highest dropped ownership only when every drop is known", () => {
    const players = new Map([player("a", 95), player("b", 5), player("u", null)].map(row => [row.id, row]));
    const add = (dropPlayerId?: string) => ({ type: "add", playerId: "x", dropPlayerId });
    expect(droppedOwnership([add("b")], players)).toBe(5);
    expect(droppedOwnership([add("b"), { type: "drop", playerId: "a" }], players)).toBe(95);
    expect(droppedOwnership([add("u")], players)).toBeNull();
    expect(droppedOwnership([add()], players)).toBeNull();
  });

  it("labels ownership for display: a reported 0 is 0%, missing is unknown (W1, W3)", () => {
    expect(ownershipLabel(player("p", 0))).toBe("Ownership 0%");
    expect(ownershipLabel(player("p", 12.5))).toBe("Ownership 12.5%");
    expect(ownershipLabel(player("p", null))).toBe("Ownership unknown");
    expect(ownershipLabel(undefined)).toBe("Ownership unknown");
    expect(retentionCautionText({ level: "none", ownership: 10 })).toBeNull();
  });

  it("labels a stale reading as last known, with no caution and no tie-break weight (W2)", () => {
    const stale = player("p", null, null, { ownershipEvidence: { value: 40, observedOn: "2026-10-07", provider: "yahoo", status: "stale" } });
    expect(ownershipLabel(stale)).toBe("Ownership 40% · last known 2026-10-07");
    expect(retentionCaution(stale)).toEqual({ level: "stale", ownership: null });
    expect(retentionCautionText(retentionCaution(stale))).toBeNull();
    expect(knownOwnership(stale)).toBeNull();
    // A tied group with a stale member keeps holdValue/id order.
    expect(ids(orderDropCandidates([player("b", 5, 9), { ...stale, id: "a", holdValue: 1 }], () => 0))).toEqual(["a", "b"]);
  });
});
