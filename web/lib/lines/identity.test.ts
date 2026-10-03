import { describe, expect, it } from "vitest";
import { resolveEventUnit, type EventMembership } from "./identity";
import { fixtureUnit } from "./testFixtures";

const players = [{ playerId: 1, fullName: "Nikita Kucherov", lastName: "Kucherov" }];
const membership: EventMembership = { playerId: 1, teamId: 14, from: "2025-01-01T00:00:00Z", until: "2026-10-02T00:00:00Z", evidenceId: "historical_roster" };
const options = { teamId: 14, effectiveAt: "2026-10-01T22:34:00Z", players, memberships: [membership], aliases: [] };
describe("event-date player identities", () => {
  it("preserves a screenshot typo and requires an approved alias", () => {
    const unit = fixtureUnit(["Kucherv"]);
    expect(resolveEventUnit(unit, options).reasons).toEqual(["identity:Kucherv:missing_player"]);
    const result = resolveEventUnit(unit, { ...options, aliases: [{ raw: "Kucherv", playerId: 1, approvedAt: "2026-10-02T01:00:00Z", evidenceId: "approved_alias:1" }] });
    expect(result.reasons).toHaveLength(0); expect(result.unit.players[0]!.name).toBe("Nikita Kucherov");
    expect(result.unit.evidence[0]!.text).toBe("Kucherv"); expect(result.evidence).toContain("approved_alias:1");
  });
  it("historical membership wins over today's team and fails after the interval ends", () => {
    const unit = fixtureUnit(["Kucherov"]);
    expect(resolveEventUnit(unit, { ...options, players: [{ ...players[0]!, teamId: 99 }] }).reasons).toHaveLength(0);
    expect(resolveEventUnit(unit, { ...options, effectiveAt: "2026-10-02T01:00:00Z" }).reasons).toContain("identity:Kucherov:conflicting_membership");
  });
  it("conflicting memberships and ambiguous surnames cannot be promoted", () => {
    const unit = fixtureUnit(["Kucherov"]);
    expect(resolveEventUnit(unit, { ...options, memberships: [membership, { ...membership, teamId: 99 }] }).reasons).toHaveLength(1);
    expect(resolveEventUnit(unit, { ...options, players: [...players, { playerId: 2, fullName: "Other Kucherov", lastName: "Kucherov" }], memberships: [membership, { ...membership, playerId: 2 }] }).reasons).toContain("identity:Kucherov:ambiguous");
  });
  it("normalizes accent/apostrophe/hyphen spelling but never invents a typo mapping", () => {
    const unit = fixtureUnit(["D’Astous"]);
    expect(resolveEventUnit(unit, { ...options, players: [{ playerId: 1, fullName: "Charle-Édouard D'Astous", lastName: "D'Astous" }] }).reasons).toHaveLength(0);
  });
});
