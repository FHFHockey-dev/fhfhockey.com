import { describe, expect, it } from "vitest";
import { activeLineClaims, eligibleClaim, reconcileEntry, reconcilePP } from "./reconcile";
import { fixtureClaim, fixtureGame, fixtureNext, fixtureNow, fixturePP, fixtureUnit } from "./testFixtures";

const entry = (claims = [fixtureClaim()], previous: ReturnType<typeof reconcileEntry> | null = null, game = fixtureGame) => reconcileEntry({ game, teamId: 14, claims, previous, now: fixtureNow });
const pp = (claims = [fixturePP(1)], game = fixtureNext, carryForward = true) => reconcilePP({ game, games: [fixtureGame, fixtureNext], teamId: 14, claims, now: fixtureNow, carryForward });
describe("entry snapshot reconciliation", () => {
  it("correcting one frozen conflict side preserves the opposing source and excludes ordinary late claims", () => {
    const a = fixtureClaim("a"), b = fixtureClaim("b", { unit: { ...fixtureUnit(), players: [{ playerId: 9, name: "B" }] } });
    const frozen = entry([a, b]);
    const correction = fixtureClaim("c", { kind: "entry_correction", supersedes: ["a"], relationAuthority: "original_author", specificity: "game", authority: 10,
      unit: { ...fixtureUnit(), players: [{ playerId: 10, name: "C" }] } });
    correction.time.interpretedAt = fixtureNow;
    const late = fixtureClaim("ordinary-late", { unit: { ...fixtureUnit(), players: [{ playerId: 11, name: "Late" }] } });
    late.time.interpretedAt = fixtureNow;
    const revised = entry([a, b, correction, late], frozen);
    expect(revised.units).toHaveLength(0); expect(revised.conflicts[0]!.claimIds).toEqual(["b", "c"]);
    expect(revised.evidenceClaims!.some((claim) => claim.id === late.id)).toBe(false);
  });
  it("retracting one corroborating frozen source preserves its remaining support", () => {
    const a = fixtureClaim("a"), b = fixtureClaim("b"); const frozen = entry([a, b]);
    const retract = fixtureClaim("retract", { kind: "retraction", unit: null, retracts: ["a"], relationAuthority: "original_author" });
    const revised = entry([a, b, retract], frozen);
    expect(revised.units).toHaveLength(1); expect(revised.units[0]!.claims.map((claim) => claim.id)).toEqual(["b"]);
    expect(revised.revision).toBe(2); expect(entry([a, b, retract], revised)).toBe(revised);
  });
  it("retracting one frozen conflict side selects the remaining source, including legacy snapshots", () => {
    const a = fixtureClaim("a"), b = fixtureClaim("b", { unit: { ...fixtureUnit(), players: [{ playerId: 9, name: "B" }] } });
    const frozen = entry([a, b]); delete frozen.evidenceClaims;
    const retract = fixtureClaim("retract", { kind: "retraction", unit: null, retracts: ["a"], relationAuthority: "original_author" });
    const revised = entry([a, b, retract], frozen);
    expect(revised.conflicts).toHaveLength(0); expect(revised.units[0]!.claims.map((claim) => claim.id)).toEqual(["b"]);
    expect(revised.status).toBe("corrected"); expect(revised.previousId).toBe(frozen.id);
  });
  it("replays a multi-step correction/retraction chain without admitting late entry evidence", () => {
    const a = fixtureClaim("a"), b = fixtureClaim("b"); const frozen = entry([a, b]);
    const correction = fixtureClaim("c", { kind: "entry_correction", supersedes: ["a"], relationAuthority: "original_author", unit: { ...fixtureUnit(), players: [{ playerId: 9, name: "C" }] } });
    const conflict = entry([a, b, correction], frozen);
    const retraction = fixtureClaim("retract", { kind: "retraction", unit: null, retracts: ["b"], relationAuthority: "original_author" });
    const result = entry([retraction, correction, b, a], conflict);
    expect(result.conflicts).toHaveLength(0); expect(result.units[0]!.claims.map((claim) => claim.id)).toEqual(["c"]);
    expect(result.evidenceClaims!.map((claim) => claim.id)).toEqual(["a", "b", "c", "retract"]);
    expect(entry([a, b, correction, retraction], conflict)).toEqual(result);
  });
  it("freezes at actual start and ignores ordinary in-game adjustments on refresh", () => {
    const frozen = entry();
    expect(frozen).toMatchObject({ status: "frozen", cutoff: fixtureGame.actualStart, revision: 1 });
    const iga = fixtureClaim("iga", { kind: "iga", phase: "in_game", unit: fixtureUnit(["Hagel", "Cirelli", "Kucherov"]) });
    expect(entry([fixtureClaim(), iga], frozen)).toBe(frozen);
  });
  it("records first observed live cutoff when puck-drop time is unavailable", () => {
    const result = entry(undefined, null, { ...fixtureGame, actualStart: null });
    expect(result.cutoff).toBe(fixtureGame.observedAt);
    expect(result.reason).toContain("first observed live transition");
  });
  it("does not infer live state from scheduled time or stale state", () => {
    expect(entry(undefined, null, { ...fixtureGame, phase: "scheduled" }).status).toBe("expected");
    expect(entry(undefined, null, { ...fixtureGame, observedAt: "2026-10-01T23:00:00Z" }).status).toBe("expected");
    expect(entry(undefined, null, { ...fixtureGame, phase: "postponed" }).status).toBe("expected");
  });
  it.each(["ingestedAt", "interpretedAt"] as const)("excludes evidence unavailable at cutoff due to delayed %s", (field) => {
    const claim = fixtureClaim(); claim.time[field] = fixtureNow;
    expect(entry([claim]).units).toHaveLength(0);
  });
  it("retains partial and unusual formations without inventing remaining units", () => {
    const claim = fixtureClaim("unusual", { unit: { ...fixtureUnit(["A", "B", "C", "D"]), complete: false, number: null } });
    const result = entry([claim]);
    expect(result.units).toHaveLength(1); expect(result.units[0]!.unit.players).toHaveLength(4);
    expect(result.units[0]!.unit.number).toBeNull();
  });
  it("warmup evidence outranks lower-specificity candidates and preserves per-unit sources", () => {
    const practice = fixtureClaim("practice", { specificity: "practice", unit: fixtureUnit(["A", "B", "C"]) });
    const defense = fixtureClaim("defense", { unit: fixtureUnit(["Moser", "Carlson"], "es_defense"), author: "other" });
    const result = entry([practice, defense, fixtureClaim()]);
    expect(result.units).toHaveLength(2);
    expect(result.units.flatMap((unit) => unit.claims).map((claim) => claim.id).sort()).toEqual(["defense", "warmup"]);
  });
  it("conflicting applicable reports remain unresolved instead of latest-wins", () => {
    const different = fixtureClaim("conflict", { unit: { ...fixtureUnit(), players: [{ playerId: 9, name: "Other" }] } });
    const result = entry([fixtureClaim(), different]);
    expect(result.units).toHaveLength(0); expect(result.conflicts).toHaveLength(1);
  });
  it("appends explicit authorized correction and retains previous entry", () => {
    const previous = entry();
    const corrected = fixtureClaim("correction", { kind: "entry_correction", supersedes: ["warmup"], relationAuthority: "original_author", unit: fixtureUnit(["Holmberg", "Point", "Kucherov"]) });
    const result = entry([fixtureClaim(), corrected], previous);
    expect(result).toMatchObject({ status: "corrected", previousId: previous.id, revision: 2 });
    expect(result.units[0]!.unit.players[0]!.name).toBe("Holmberg");
    expect(previous.units[0]!.unit.players[0]!.name).toBe("Mikheyev");
    expect(entry([fixtureClaim(), corrected], result)).toBe(result);
  });
  it("a relay cannot correct the original author's claim", () => {
    const previous = entry();
    const correction = fixtureClaim("relay", { kind: "entry_correction", author: "relay", supersedes: ["warmup"], relationAuthority: "original_author" });
    expect(entry([fixtureClaim(), correction], previous)).toBe(previous);
  });
  it("an authorized correction can resolve conflicting late entry corrections", () => {
    const previous = entry();
    const first = fixtureClaim("first", { kind: "entry_correction", supersedes: ["warmup"], relationAuthority: "original_author" });
    const second = fixtureClaim("second", { kind: "entry_correction", supersedes: ["warmup"], relationAuthority: "original_author", unit: { ...fixtureUnit(), players: [{ playerId: 9, name: "Other" }] } });
    const conflicted = entry([fixtureClaim(), first, second], previous);
    expect(conflicted.conflicts).toHaveLength(1); expect(conflicted.units).toHaveLength(0);
    const resolution = fixtureClaim("resolved", { kind: "entry_correction", supersedes: ["first", "second"], relationAuthority: "original_author" });
    const resolved = entry([fixtureClaim(), first, second, resolution], conflicted);
    expect(resolved.conflicts).toHaveLength(0); expect(resolved.units).toHaveLength(1); expect(resolved.revision).toBe(3);
  });
  it("retractions remove active evidence and append a visible entry revision", () => {
    const previous = entry();
    const retraction = fixtureClaim("retract", { kind: "retraction", unit: null, retracts: ["warmup"], relationAuthority: "original_author" });
    const result = entry([fixtureClaim(), retraction], previous);
    expect(result.status).toBe("corrected"); expect(result.units).toHaveLength(0); expect(result.previousId).toBe(previous.id);
  });
  it("reschedule identity prevents stale entry evidence reuse", () => {
    expect(entry(undefined, null, { ...fixtureGame, scheduleIdentity: "rescheduled" }).units).toHaveLength(0);
  });
  it("replays deterministically regardless of input ordering", () => {
    const claims = [fixtureClaim(), fixturePP(1), fixturePP(2)];
    expect(entry(claims)).toEqual(entry([...claims].reverse()));
  });
});
describe("independent PP defaults", () => {
  it("explicit expiry constrains current and carried PP decisions", () => {
    const claim = fixturePP(1); claim.time.effectiveUntil = "2026-10-02T00:00:00Z";
    expect(pp([claim])[0]!.selection).toBeNull(); expect(pp([claim], fixtureGame)[0]!.selection).toBeNull();
    claim.time.effectiveUntil = fixtureNow;
    expect(pp([claim])[0]!.selection).toBeNull();
  });
  it("future ingestion cannot select PP or apply a retraction before it is available", () => {
    const claim = fixturePP(1); claim.time.ingestedAt = "2026-10-03T00:00:00Z";
    expect(pp([claim])[0]!.selection).toBeNull();
    const valid = fixturePP(1);
    const retract = fixturePP(1, { id: "future-retract", originalIdentity: "future-retract", kind: "retraction", unit: null, retracts: [valid.id], relationAuthority: "original_author" });
    retract.time.ingestedAt = "2026-10-03T00:00:00Z";
    expect(pp([valid, retract])[0]!.selection).not.toBeNull();
  });
  it("carries an accepted PP1 without hiding it for missing PP2", () => {
    const result = pp();
    expect(result[0]!.selection).toMatchObject({ designation: "carried", originGameId: fixtureGame.id });
    expect(result[1]!.selection).toBeNull();
  });
  it("replaces only the applicable upcoming unit and keeps the other carried unit", () => {
    const next = fixturePP(1, { id: "next", originalIdentity: "next", gameId: fixtureNext.id, phase: "pregame", certainty: "projected", binding: { ...fixtureClaim().binding, scheduleIdentity: fixtureNext.scheduleIdentity } });
    const result = pp([fixturePP(1), fixturePP(2), next]);
    expect(result[0]!.selection?.designation).toBe("projected"); expect(result[1]!.selection?.designation).toBe("carried");
  });
  it("an explicitly projected future effective time can replace the next game's default now", () => {
    const next = fixturePP(1, { id: "future", originalIdentity: "future", gameId: fixtureNext.id, phase: "pregame", certainty: "projected", binding: { ...fixtureClaim().binding, scheduleIdentity: fixtureNext.scheduleIdentity } });
    next.time.effectiveAt = fixtureNext.scheduledStart;
    expect(pp([fixturePP(1), next])[0]!.selection?.designation).toBe("projected");
  });
  it("restoring a prior PP selection creates a new revision instead of reusing an old decision ID", () => {
    const claims = [fixturePP(1)]; const initial = pp(claims);
    const removed = reconcilePP({ game: fixtureNext, games: [fixtureGame, fixtureNext], teamId: 14, claims: [], previous: initial, now: fixtureNow, carryForward: true });
    const restored = reconcilePP({ game: fixtureNext, games: [fixtureGame, fixtureNext], teamId: 14, claims, previous: removed, now: fixtureNow, carryForward: true });
    expect(restored[0]!.id).not.toBe(initial[0]!.id); expect(restored[0]!.revision).toBe(3);
    expect(restored[0]!.selection).toEqual(initial[0]!.selection);
  });
  it("preserves cross-unit and ES overlap, and separate authors", () => {
    const result = pp([fixturePP(1), fixturePP(2, { author: "other" })]);
    expect(result.every((decision) => decision.selection)).toBe(true);
    expect(result[1]!.selection!.claims[0]!.author).toBe("other");
  });
  it("does not promote blanket confirmation without evidence", () => {
    expect(pp([fixturePP(1, { certainty: "confirmed" })], fixtureGame)[0]!.selection?.designation).toBe("reported");
    expect(pp([fixturePP(1, { certainty: "confirmed", confirmationEvidence: ["Explicitly confirmed PP1"] })], fixtureGame)[0]!.selection?.designation).toBe("confirmed");
  });
  it("conflicts do not fall back to a convenient older unit", () => {
    const conflict = fixturePP(1, { id: "conflict", originalIdentity: "conflict", unit: { ...fixturePP(1).unit!, players: fixturePP(1).unit!.players.map((player) => ({ ...player, playerId: player.playerId + 10 })) } });
    const result = pp([fixturePP(1), conflict]);
    expect(result[0]!.selection).toBeNull(); expect(result[0]!.conflict).not.toBeNull();
  });
  it("retracts and rebuilds PP defaults without increasing confidence for relay circulation", () => {
    const claim = fixturePP(1);
    const relay = { ...claim, id: "relay", captureId: "relay", time: { ...claim.time, interpretedAt: "2026-10-02T00:10:00Z" } };
    expect(activeLineClaims([claim, relay])).toHaveLength(1);
    const retraction = fixturePP(1, { id: "retract", originalIdentity: "retract", kind: "retraction", unit: null, retracts: [claim.id], relationAuthority: "original_author" });
    expect(pp([claim, relay, retraction])[0]!.selection).toBeNull();
  });
  it("attribution enrichment links pending relay history to the resolved original", () => {
    const pending = fixturePP(1, { originalIdentity: null, provenance: { relayTweetId: "relay-id", originalTweetId: null, attributionStatus: "pending" } });
    const resolved = fixturePP(1, { id: "resolved", captureId: "resolved-capture", originalIdentity: "original-id", provenance: { relayTweetId: "relay-id", originalTweetId: "original-id", attributionStatus: "resolved" } });
    resolved.time.interpretedAt = "2026-10-02T00:00:00Z";
    expect(activeLineClaims([pending, resolved])).toHaveLength(1);
    expect(pp([pending, resolved])[0]!.selection!.claims).toHaveLength(1);
  });
  it("excludes ES IGAs, pregame carry-forward, unresolved phase and disabled carry-forward", () => {
    expect(pp([fixtureClaim("iga", { kind: "iga", phase: "in_game" })])[0]!.selection).toBeNull();
    expect(pp([fixturePP(1, { phase: "pregame" })])[0]!.selection).toBeNull();
    expect(pp([fixturePP(1, { phase: "unknown" })])[0]!.selection).toBeNull();
    expect(pp(undefined, fixtureNext, false)[0]!.selection).toBeNull();
  });
  it.each([fixturePP(1, { identityStatus: "unresolved" }), fixturePP(1, { accepted: false }), fixturePP(1, { reviewReasons: ["ambiguous_game"] })])("ineligible evidence cannot acquire PP authority", (claim) => {
    expect(eligibleClaim(claim)).toBe(false); expect(pp([claim])[0]!.selection).toBeNull();
  });
});
