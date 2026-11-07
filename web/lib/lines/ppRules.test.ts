import { describe, expect, it } from "vitest";
import { activeLineClaims, contextRank, reconcilePP } from "./reconcile";
import { fixtureClaim, fixtureGame, fixtureNext, fixtureNow, fixturePP, fixtureUnit } from "./testFixtures";
import type { LineClaim, LineGame } from "./types";

const at = (id: number, date: string, phase: LineGame["phase"] = "final"): LineGame => ({ ...fixtureNext, id, date, phase, scheduledStart: `${date}T23:00:00Z`, scheduleIdentity: `fixture:game:${id}` });
const g1 = at(1, "2026-09-20"), g2 = at(2, "2026-09-22"), g3 = at(3, "2026-09-24"), g4 = at(4, "2026-09-26"), next = at(5, "2026-10-03", "scheduled");
const on = (game: LineGame) => ({ gameId: game.id, binding: { ...fixtureClaim().binding, scheduleIdentity: game.scheduleIdentity } });
const stamp = (claim: LineClaim, iso: string) => ({ ...claim, time: { ...claim.time, originalPublishedAt: iso, effectiveAt: iso, ingestedAt: iso, interpretedAt: iso } });
const carriedPP2 = () => stamp(fixturePP(2, on(g1)), "2026-09-20T23:40:00Z");
const run = (claims: LineClaim[], games: LineGame[], extra: Partial<Parameters<typeof reconcilePP>[0]> = {}) =>
  reconcilePP({ game: next, games: [...games, next], teamId: 14, claims, now: fixtureNow, carryForward: true, ...extra })[1]!;
const swap = (game: LineGame, overrides: Partial<LineClaim> = {}) => stamp(fixtureClaim("sabres-swap", { ...on(game), kind: "pp", phase: "pregame", context: "practice", specificity: "practice", unit: null,
  relationship: { kind: "substitution", playerIds: [], evidence: { start: 0, end: 6, text: "Kuluch" } },
  ppSwap: { unitNumber: 2, playersIn: [101, 102], playersOut: [2, 3], source: "trainer:r1", names: { "101": "Jiri Kulich", "102": "Josh Krebs" } }, ...overrides }), "2026-10-02T00:30:00Z");

describe("PP carry expiry", () => {
  it("carries an in-game PP2 with no expiry reason while it is fresh", () => {
    const decision = run([carriedPP2()], [g1]);
    expect(decision.selection?.designation).toBe("carried"); expect(decision.endReason).toBeNull();
  });
  it("ends by supersession when a newer report for that unit arrives at a later game", () => {
    const newer = stamp(fixturePP(2, { ...on(g2), id: "newer", originalIdentity: "newer", phase: "pregame", unit: { ...fixturePP(2).unit!, players: fixturePP(2).unit!.players.map((player, index) => index ? player : { playerId: 77, name: "New" }) } }), "2026-09-22T22:00:00Z");
    const decision = run([carriedPP2(), newer], [g1, g2]);
    expect(decision.selection).toBeNull(); expect(decision.endReason).toMatchObject({ kind: "superseded", claimIds: ["newer"] });
  });
  it("a same-players report at a later game reaffirms instead of ending", () => {
    const same = stamp(fixturePP(2, { ...on(g2), id: "same", originalIdentity: "same", phase: "pregame" }), "2026-09-22T22:00:00Z");
    expect(run([carriedPP2(), same], [g1, g2, g3, g4]).selection?.designation).toBe("carried");
  });
  it("ends when a carried player is scratched", () => {
    const scratch = stamp(fixtureClaim("scratch", { ...on(g2), unit: fixtureUnit(["Geekie"], "scratch", null) }), "2026-09-22T22:00:00Z");
    scratch.unit!.players = [{ playerId: 2, name: "Geekie" }];
    const decision = run([carriedPP2(), scratch], [g1, g2]);
    expect(decision.selection).toBeNull(); expect(decision.endReason).toMatchObject({ kind: "player_unavailable", playerIds: [2] });
  });
  it("ends when a carried player is off the roster at the game", () => {
    const memberships = [{ playerId: 2, teamId: 14, from: "2025-01-01T00:00:00Z", until: "2026-09-30T00:00:00Z", evidenceId: "roster:2:14" }, { playerId: 2, teamId: 3, from: "2026-09-30T00:00:00Z", until: null, evidenceId: "roster:2:3" }];
    expect(run([carriedPP2()], [g1], { memberships }).endReason).toMatchObject({ kind: "player_unavailable", playerIds: [2], evidence: ["roster:2:14", "roster:2:3"] });
  });
  it("ends as stale after three team games without reaffirmation", () => {
    const decision = run([carriedPP2()], [g1, g2, g3, g4]);
    expect(decision.selection).toBeNull(); expect(decision.endReason).toMatchObject({ kind: "stale", gamesElapsed: 3 });
    expect(run([carriedPP2()], [g1, g2, g3]).selection?.designation).toBe("carried");
  });
  it("never carries even-strength IGAs", () => {
    const iga = stamp(fixtureClaim("es", { ...on(g1), kind: "iga", phase: "in_game" }), "2026-09-20T23:40:00Z");
    expect(reconcilePP({ game: next, games: [g1, next], teamId: 14, claims: [iga], now: fixtureNow, carryForward: true }).every((decision) => decision.selection == null)).toBe(true);
  });
});

describe("PP swap derivation (Sabres PP2)", () => {
  it("applies the practice swap to an accepted carried base, citing both", () => {
    const decision = run([carriedPP2(), swap(next)], [g1]);
    expect(decision.selection?.designation).toBe("projected");
    expect(decision.selection!.unit.players.map((player) => player.playerId)).toEqual([1, 101, 102, 4, 5]);
    expect(decision.selection!.unit.players[1]!.name).toBe("Jiri Kulich");
    expect(decision.derivation).toEqual({ baseClaimIds: [carriedPP2().id], swapClaimIds: ["sabres-swap"], playersIn: [101, 102], playersOut: [2, 3] });
  });
  it("stays an observation only without a base unit", () => {
    const decision = run([swap(next)], []);
    expect(decision.selection).toBeNull(); expect(decision.derivation).toBeNull(); expect(decision.reason).toMatch(/no accepted base unit/);
  });
  it("does not apply a swap whose outgoing players are not on the base", () => {
    const decision = run([carriedPP2(), swap(next, { ppSwap: { unitNumber: 2, playersIn: [101, 102], playersOut: [90, 91], source: "x" } })], [g1]);
    expect(decision.selection?.designation).toBe("carried"); expect(decision.derivation).toBeNull();
  });
  it("is never an IGA: a practice swap never appears as in-game", () => {
    const claim = swap(next);
    expect(claim.kind).not.toBe("iga"); expect(claim.phase).not.toBe("in_game");
  });
});

describe("context ranking and relay dedup", () => {
  it("ranks warmup > game > practice > projected, with legacy claims by specificity", () => {
    const ranks = (["warmup", "game", "practice", "projected"] as const).map((context) => contextRank(fixtureClaim(context, { context })));
    expect(ranks).toEqual([3, 2, 1, 0]);
    expect(contextRank(fixtureClaim("legacy", { specificity: "practice" }))).toBe(1);
  });
  it("a game-context PP outranks a practice-context PP for the same unit", () => {
    const game = stamp(fixturePP(2, { ...on(next), id: "game", originalIdentity: "game", phase: "pregame", context: "game" }), "2026-10-02T00:20:00Z");
    const practice = stamp(fixturePP(2, { ...on(next), id: "practice", originalIdentity: "practice", phase: "pregame", context: "practice", unit: { ...fixturePP(2).unit!, players: fixturePP(2).unit!.players.map((player, index) => index ? player : { playerId: 77, name: "Other" }) } }), "2026-10-02T00:40:00Z");
    const decision = run([game, practice], []);
    expect(decision.conflict).toBeNull(); expect(decision.selection!.claims.map((claim) => claim.id)).toEqual(["game"]);
  });
  it("an IFTTT wrapper and the FxTwitter original dedupe to one capture and add no confirmation", () => {
    const ifttt = fixturePP(1, { ...on(fixtureGame), id: "ifttt", captureId: "c1", originalIdentity: "https://x.com/GameDayLines/status/555", provenance: { relayTweetId: "555", originalTweetId: null, attributionStatus: "pending" } });
    const fx = fixturePP(1, { ...on(fixtureGame), id: "fx", captureId: "c2", originalIdentity: "900", provenance: { relayTweetId: "555", originalTweetId: "900", attributionStatus: "resolved" } });
    fx.time.interpretedAt = "2026-10-01T23:36:00Z";
    expect(activeLineClaims([ifttt, fx]).map((claim) => claim.id)).toEqual(["fx"]);
    const decision = reconcilePP({ game: fixtureGame, games: [fixtureGame], teamId: 14, claims: [ifttt, fx], now: fixtureNow, carryForward: false })[0]!;
    expect(decision.selection!.claims).toHaveLength(1);
  });
});
