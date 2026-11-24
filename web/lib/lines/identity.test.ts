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
  it("uses the event's roster season and preserves same-season and undated conflicts", () => {
    const unit = fixtureUnit(["Carlson"]);
    const skaters = [{ playerId: 1, fullName: "John Carlson", lastName: "Carlson" }];
    const carolina = { ...membership, teamId: 12, seasonId: 20252026, from: "2026-06-28T02:00:03Z", until: null, evidenceId: "prior_club" };
    const tampa = { ...membership, seasonId: 20262027, from: "2026-09-19T00:57:25Z", until: null, evidenceId: "report_season" };
    const at = { ...options, effectiveAt: "2026-11-20T00:51:18Z", players: skaters };
    expect(resolveEventUnit(unit, { ...at, memberships: [carolina, tampa] })).toMatchObject({ reasons: [], evidence: ["report_season"] });
    for (const seasonId of [tampa.seasonId, null]) {
      expect(resolveEventUnit(unit, { ...at, memberships: [{ ...carolina, seasonId }, tampa] }).reasons).toContain("identity:Carlson:conflicting_membership");
    }
    const prior = { ...at, teamId: 12, effectiveAt: "2026-07-01T01:00:00Z", memberships: [carolina, tampa] };
    expect(resolveEventUnit(unit, prior).evidence).toEqual(["prior_club"]);
    expect(resolveEventUnit(unit, { ...prior, effectiveAt: "2026-07-01T04:00:00Z" }).reasons).toContain("identity:Carlson:conflicting_membership");
  });
  it("historical membership wins over today's team and fails after the interval ends", () => {
    const unit = fixtureUnit(["Kucherov"]);
    expect(resolveEventUnit(unit, { ...options, players: [{ ...players[0]!, teamId: 99 }] }).reasons).toHaveLength(0);
    expect(resolveEventUnit(unit, { ...options, effectiveAt: "2026-10-02T01:00:00Z" }).reasons).toContain("identity:Kucherov:conflicting_membership");
  });
  it("accepts generated initials only at their recorded source span with valid membership at the event", () => {
    const unit = fixtureUnit(["TVR"]);
    const dated = { ...options, players: [{ playerId: 1, fullName: "Trevor van Riemsdyk", lastName: "van Riemsdyk" }],
      uniqueInitials: [{ ...unit.evidence[0]!, playerId: 1, teamId: 14 }] };
    const resolved = resolveEventUnit(unit, dated);
    expect(resolved.reasons).toEqual([]);
    expect(resolved.evidence).toEqual(["tweet_initials:14:1:0-3", "historical_roster"]);
    expect(resolved.unit.players[0]?.name).toBe("Trevor van Riemsdyk");
    expect(resolveEventUnit(unit, { ...dated, uniqueInitials: [] }).reasons).toHaveLength(1);
    expect(resolveEventUnit(unit, { ...dated, uniqueInitials: [{ ...dated.uniqueInitials[0]!, start: 5 }] }).reasons).toHaveLength(1);
    expect(resolveEventUnit(unit, { ...dated, effectiveAt: membership.until }).reasons).toHaveLength(1);
    const corrected = { ...dated, sourcePublishedAt: options.effectiveAt,
      players: [...dated.players, { playerId: 2, fullName: "Other Player", lastName: "Player" }],
      memberships: [membership, { ...membership, playerId: 2 }],
      aliases: [{ raw: "TVR", playerId: 2, approvedAt: membership.from, revisedAt: "2026-10-01T22:34:00.000001Z", evidenceId: "later_alias" }] };
    expect(resolveEventUnit(unit, corrected).unit.players[0]?.name).toBe("Trevor van Riemsdyk");
    expect(resolveEventUnit(unit, { ...corrected, sourcePublishedAt: corrected.aliases[0]!.revisedAt }).reasons)
      .toContain("identity:TVR:interpretation_mismatch");
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
