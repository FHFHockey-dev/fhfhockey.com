// @vitest-environment node
import { describe, expect, it } from "vitest";

import { reduceTweetSemanticEvents, type TweetSemanticFact, type TweetSemanticObservation, type TweetSemanticScope } from "./tweetSemanticEvents";

const AS_OF = "2026-10-15T18:00:00Z";
const EFFECTIVE = "2026-10-15T23:00:00Z";
const SOURCES = ["dfofantasy", "nhl_rosters", "cccmiddleton", "gamedaylines", "gamedaygoalies", "gamedaynewsnhl"];
const GAME: TweetSemanticScope = { kind: "game", teamId: 55, gameId: 2026020070, phase: "entry", group: null };
const PERIOD: TweetSemanticScope = { kind: "effective_period", teamId: 55, periodId: "bound-roster-period-1",
  startsAt: "2026-10-15T00:00:00Z", endsAt: "2026-11-01T00:00:00Z" };
const LINEUP: TweetSemanticFact = { kind: "lineup", situation: "es", units: [
  { slot: "forward:1", playerIds: [101, 102, 103] }, { slot: "forward:2", playerIds: [104, 105, 106] },
] };

// Synthetic already-bound observations exercise decisions, not parser or live-feed acceptance.
function report(id: string, changes: Partial<TweetSemanticObservation> = {}): TweetSemanticObservation {
  return {
    id, reportId: `report:${id}`, sourceKey: "dfofantasy",
    original: { tweetId: `original:${id}`, author: `author_${id}`, publishedAt: "2026-10-15T12:00:00Z" },
    wrapper: null, receivedAt: "2026-10-15T12:01:00Z", interpretedAt: changes.receivedAt ?? "2026-10-15T12:02:00Z",
    evidence: { start: 0, end: 17, text: "Starter confirmed" },
    scope: GAME, fact: { kind: "starter", playerId: 1 }, effectiveAt: EFFECTIVE,
    modality: "asserted", support: { status: "supported", basis: "Synthetic exact identity, scope and explicit claim gate", validUntil: "2026-10-16T02:00:00Z" },
    relation: null, ...changes,
  };
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

describe("all-source semantic equivalence and retained evidence", () => {
  it.each(SOURCES)("accepts one lineup action when %s arrives first", (firstSource) => {
    const events = [firstSource, ...SOURCES.filter((source) => source !== firstSource)]
      .map((source) => report(source, { sourceKey: source, fact: LINEUP }));
    const result = reduceTweetSemanticEvents(freeze(events), AS_OF);
    const reversed = reduceTweetSemanticEvents([...events].reverse(), AS_OF);
    expect(result.observations).toEqual(events);
    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0]!.status).toBe("accepted");
    expect(result.scenarios[0]!.revisions).toHaveLength(1);
    expect(result.associations.map((entry) => entry.disposition)).toEqual(["accepted", ...Array(5).fill("corroboration")]);
    expect(result.scenarios[0]!.revisions[0]!.observationIndexes).toEqual([0, 1, 2, 3, 4, 5]);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]!.key).toBe(reversed.actions[0]!.key);
    expect(result.scenarios[0]!.firstAcceptance?.observationIndex).toBe(0);
  });

  it("retains an identical observation replay without adding an action or support group", () => {
    const original = report("a");
    const retry = JSON.parse(JSON.stringify(original)) as TweetSemanticObservation;
    const result = reduceTweetSemanticEvents([original, retry], AS_OF);
    expect(result.observations).toEqual([original, retry]);
    expect(result.associations.map((entry) => entry.disposition)).toEqual(["accepted", "replay"]);
    expect(result.scenarios[0]!.revisions[0]!.supportedOrigins).toEqual([{ originalTweetId: "original:a", observationIndexes: [0] }]);
    expect(result.actions).toHaveLength(1);
  });

  it("groups relays of one original without counting them as independent support", () => {
    const original = report("a");
    const relay = report("b", { sourceKey: "gamedaygoalies", original: original.original,
      wrapper: { tweetId: "relay-b", publishedAt: "2026-10-15T13:00:00Z" }, receivedAt: "2026-10-15T13:02:00Z" });
    const result = reduceTweetSemanticEvents([original, relay], AS_OF);
    expect(result.scenarios[0]!.revisions[0]!.supportedOrigins).toEqual([{ originalTweetId: "original:a", observationIndexes: [0, 1] }]);
    expect(result.actions).toHaveLength(1);
    expect(result.observations[1]).toEqual(relay);
  });

  it("preserves original, wrapper, receipt, effective and validity times when an older report arrives later", () => {
    const first = report("first", {
      original: { tweetId: "original-first", author: "reporter", publishedAt: "2026-10-15T14:00:00Z" },
      wrapper: { tweetId: "wrapper-first", publishedAt: "2026-10-15T14:10:00Z" }, receivedAt: "2026-10-15T14:12:00Z",
    });
    const later = report("later", { receivedAt: "2026-10-15T16:00:00Z" });
    const events = freeze([first, later]);
    const originalBytes = JSON.stringify(events);
    const result = reduceTweetSemanticEvents(events, AS_OF);
    expect(JSON.stringify(events)).toBe(originalBytes);
    expect(result.observations).toEqual(events);
    expect(result.actions[0]!.observationIndex).toBe(0);
    expect(result.scenarios[0]!.firstAcceptance).toEqual({ revisionKey: result.actions[0]!.revisionKey, observationIndex: 0 });
    expect(result.associations[1]!.disposition).toBe("corroboration");
  });

  it("canonicalizes explicit lineup slots but preserves meaningful player order", () => {
    if (LINEUP.kind !== "lineup") throw new Error("fixture");
    const first = report("a", { fact: LINEUP });
    const reorderedSlots = report("b", { fact: { ...LINEUP, units: [...LINEUP.units].reverse() } });
    const equivalent = reduceTweetSemanticEvents([first, reorderedSlots], AS_OF);
    expect(equivalent.actions).toHaveLength(1);
    expect(equivalent.scenarios[0]!.revisions).toHaveLength(1);
    const changedOrder = report("c", { fact: { ...LINEUP, units: [{ slot: "forward:1", playerIds: [102, 101, 103] }, LINEUP.units[1]!] } });
    const changed = reduceTweetSemanticEvents([first, changedOrder], AS_OF);
    expect(changed.scenarios[0]!.revisions).toHaveLength(2);
    expect(changed.scenarios[0]!.status).toBe("unresolved");
    expect(changed.actions).toEqual([]);
  });

  it("retains a reused immutable ID as a collision instead of overwriting either event", () => {
    const first = report("a");
    const changed = report("a", { fact: { kind: "starter", playerId: 2 } });
    const result = reduceTweetSemanticEvents([first, changed], AS_OF);
    expect(result.observations).toEqual([first, changed]);
    expect(result.associations[1]).toMatchObject({ disposition: "identity_collision", reason: "immutable_observation_id_reused" });
    expect(result.scenarios[0]!.status).toBe("unresolved");
    expect(result.actions).toEqual([]);
  });

  it("keeps exact support separate from source handles and does not alias CCC/LinesLinesLines", () => {
    const events = [report("a", { sourceKey: "cccmiddleton" }), report("b", { sourceKey: "lineslineslines" })];
    const result = reduceTweetSemanticEvents(events, AS_OF);
    expect(result.observations.map((entry) => entry.sourceKey)).toEqual(["cccmiddleton", "lineslineslines"]);
    expect(result.actions).toHaveLength(1);
    expect(result.scenarios[0]!.revisions[0]!.supportedOrigins).toHaveLength(2);
  });
});

describe("uncertainty, applicability and cutoff gates", () => {
  it.each([false, true])("never confirms uncertain equivalents by repetition; supported report first=%s", (supportedFirst) => {
    const uncertain = report("uncertain", { modality: "uncertain", support: { status: "pending", reason: "Expected, not confirmed" } });
    const repeat = report("repeat", { ...uncertain, id: "repeat", reportId: "report:repeat", sourceKey: "nhl_rosters" });
    const pending = reduceTweetSemanticEvents([uncertain, repeat], AS_OF);
    expect(pending.actions).toEqual([]);
    expect(pending.scenarios[0]!.status).toBe("pending");
    expect(pending.scenarios[0]!.revisions[0]!.supportedOrigins).toEqual([]);
    const supported = report("supported");
    const events = supportedFirst ? [supported, uncertain, repeat] : [uncertain, repeat, supported];
    const result = reduceTweetSemanticEvents(events, AS_OF);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]!.observationIndex).toBe(supportedFirst ? 0 : 2);
    expect(result.associations.filter((entry) => entry.disposition === "pending")).toHaveLength(2);
    expect(result.observations).toEqual(events);
  });

  it.each(["uncertain", "projected", "observation"] as const)("does not promote %s starter participation even with a supported label", (modality) => {
    const result = reduceTweetSemanticEvents([report("a", { modality })], AS_OF);
    expect(result.actions).toEqual([]);
    expect(result.associations[0]!.reason).toBe("modality_not_actionable");
  });

  it("keeps first-off/practice observations distinct from starter and availability facts", () => {
    const events = [
      report("first-off", { fact: { kind: "observation", playerId: 1, activity: "first_off", present: true }, modality: "observation" }),
      report("starter", { modality: "projected" }),
      report("injury", { fact: { kind: "availability", playerId: 1, status: "out" }, modality: "uncertain" }),
    ];
    const result = reduceTweetSemanticEvents(events, AS_OF);
    expect(result.scenarios).toHaveLength(3);
    expect(result.actions).toHaveLength(1);
    expect(result.observations[result.actions[0]!.observationIndex]!.fact).toEqual(events[0]!.fact);
    expect(result.observations.map((entry) => entry.fact?.kind)).toEqual(["observation", "starter", "availability"]);
  });

  it.each([
    ["unknown game", { scope: null }, "scope_unresolved"],
    ["invalid game", { scope: { ...GAME, kind: "game", gameId: 0 } }, "scope_unresolved"],
    ["unknown effective time", { effectiveAt: null }, "effective_time_unresolved_or_outside_period"],
    ["unclassified report", { fact: null }, "fact_or_retraction_target_unresolved"],
    ["unresolved original", { original: { tweetId: null, author: null, publishedAt: null } }, "original_identity_unresolved"],
    ["missing publication", { original: { tweetId: "a", author: "reporter", publishedAt: null } }, "evidence_time_unresolved"],
    ["invalid span", { evidence: { start: 0, end: 900, text: "short" } }, "invalid_evidence_span"],
    ["invalid player", { fact: { kind: "starter", playerId: 0 } }, "fact_or_retraction_target_unresolved"],
    ["missing source gate", { support: { status: "pending", reason: "Identity unresolved" } }, "support_pending"],
  ] satisfies [string, Partial<TweetSemanticObservation>, string][])("retains %s evidence pending", (_label, changes, reason) => {
    const event = report("a", changes);
    const result = reduceTweetSemanticEvents([event], AS_OF);
    expect(result.observations).toEqual([event]);
    expect(result.actions).toEqual([]);
    expect(result.associations[0]!.reason).toBe(reason);
  });

  it("does not turn an unspecified injury or period into a game absence/transaction", () => {
    const events = [report("injury", { fact: { kind: "availability", playerId: 1, status: "out" }, scope: null }),
      report("recall", { fact: { kind: "transaction", playerId: 1, action: "recall" }, scope: null })];
    const result = reduceTweetSemanticEvents(events, AS_OF);
    expect(result.actions).toEqual([]);
    expect(result.scenarios).toEqual([]);
    expect(result.observations).toEqual(events);
  });

  it("does not retrofit a late relay or duplicate into an earlier cutoff", () => {
    const early = report("early");
    const late = report("late", { original: early.original,
      wrapper: { tweetId: "late-wrapper", publishedAt: "2026-10-15T19:00:00Z" }, receivedAt: "2026-10-15T19:01:00Z" });
    const result = reduceTweetSemanticEvents([early, late], AS_OF);
    expect(result.associations[1]!.reason).toBe("outside_cutoff");
    expect(result.scenarios[0]!.revisions[0]!.supportedOrigins[0]!.observationIndexes).toEqual([0]);
    expect(reduceTweetSemanticEvents([late], AS_OF).actions).toEqual([]);
  });

  it("does not let a future identity collision change an earlier decision", () => {
    const first = report("a");
    const collision = report("a", { receivedAt: "2026-10-15T19:00:00Z", fact: { kind: "starter", playerId: 2 } });
    const result = reduceTweetSemanticEvents([first, collision], AS_OF);
    expect(result.associations[1]!.reason).toBe("outside_cutoff");
    expect(result.scenarios[0]!.status).toBe("accepted");
    expect(result.actions).toHaveLength(1);
  });

  it("does not retrofit a later interpretation of an earlier raw report", () => {
    const event = report("late-interpretation", { interpretedAt: "2026-10-15T19:00:00Z" });
    const result = reduceTweetSemanticEvents([event], AS_OF);
    expect(result.associations[0]!.reason).toBe("outside_cutoff");
    expect(result.actions).toEqual([]);
    expect(result.observations[0]).toEqual(event);
    expect(reduceTweetSemanticEvents([event], "2026-10-15T19:01:00Z").actions).toHaveLength(1);
  });

  it.each(["2026-10-15T12:00:00", "2026-02-30T12:00:00Z", "not-a-time"])("keeps invalid publication %s unknown", (publishedAt) => {
    const result = reduceTweetSemanticEvents([report("a", { original: { tweetId: "a", author: "reporter", publishedAt } })], AS_OF);
    expect(result.actions).toEqual([]);
    expect(result.associations[0]!.reason).toBe("evidence_time_unresolved");
  });

  it("rejects inconsistent original/wrapper/receipt chronology without repairing timestamps", () => {
    const event = report("a", { wrapper: { tweetId: "wrapper", publishedAt: "2026-10-15T11:00:00Z" } });
    const result = reduceTweetSemanticEvents([event], AS_OF);
    expect(result.associations[0]!.reason).toBe("inconsistent_source_chronology");
    expect(result.observations[0]).toEqual(event);
    expect(result.actions).toEqual([]);
  });

  it("does not renew accepted validity with a later duplicate", () => {
    const first = report("a", { support: { status: "supported", basis: "Exact gate", validUntil: AS_OF } });
    const later = report("b", { receivedAt: "2026-10-15T17:00:00Z" });
    const result = reduceTweetSemanticEvents([first, later], AS_OF);
    expect(result.scenarios[0]!.status).toBe("expired");
    expect(result.scenarios[0]!.firstAcceptance?.observationIndex).toBe(0);
    expect(result.associations[1]!.disposition).toBe("corroboration");
    expect(result.actions).toEqual([]);
    expect(result.observations.map((entry) => entry.support)).toEqual([first.support, later.support]);
  });

  it("does not accept evidence already expired when received", () => {
    const event = report("a", { support: { status: "supported", basis: "Exact gate", validUntil: "2026-10-15T12:01:00Z" } });
    const result = reduceTweetSemanticEvents([event], AS_OF);
    expect(result.actions).toEqual([]);
    expect(result.associations[0]!.reason).toBe("validity_unresolved_or_expired_on_admission");
  });

  it("requires an explicit valid evaluation cutoff", () => {
    expect(() => reduceTweetSemanticEvents([], "2026-10-15")).toThrow("decision cutoff");
  });
});

describe("contradictions, corrections and retractions remain unresolved", () => {
  it.each([false, true])("does not make first arrival authoritative over a contradictory starter, reverse=%s", (reverse) => {
    const a = report("a");
    const b = report("b", { fact: { kind: "starter", playerId: 2 },
      original: { tweetId: "original-b", author: "reporter_b", publishedAt: "2026-10-15T15:00:00Z" }, receivedAt: "2026-10-15T15:01:00Z" });
    const events = reverse ? [b, a] : [a, b];
    const result = reduceTweetSemanticEvents(events, AS_OF);
    expect(result.scenarios[0]!.status).toBe("unresolved");
    expect(result.scenarios[0]!.revisions).toHaveLength(2);
    expect(result.scenarios[0]!.firstAcceptance?.observationIndex).toBe(0);
    expect(result.associations[1]!.disposition).toBe(reverse ? "stale_conflict" : "conflict");
    expect(result.actions).toEqual([]);
  });

  it("does not settle a conflict by source count, recency or duplicates of the initial report", () => {
    const events = [report("a"), report("b", { fact: { kind: "starter", playerId: 2 } }),
      ...SOURCES.map((source) => report(source, { sourceKey: source, receivedAt: "2026-10-15T17:00:00Z" }))];
    const result = reduceTweetSemanticEvents(events, AS_OF);
    expect(result.scenarios[0]!.status).toBe("unresolved");
    expect(result.associations.slice(2).every((entry) => entry.disposition === "corroboration")).toBe(true);
    expect(result.actions).toEqual([]);
  });

  it("retains explicit corrections as distinct revisions even when the proposed fact is equivalent", () => {
    const original = report("a");
    const correction = report("correction", { relation: { kind: "correction", targetObservationIds: [original.id] } });
    const duplicate = report("duplicate");
    const result = reduceTweetSemanticEvents([original, correction, duplicate], AS_OF);
    expect(result.scenarios[0]!.revisions).toHaveLength(2);
    expect(result.associations[1]!.reason).toBe("correction_authority_required");
    expect(result.associations[2]!.revisionKey).toBe(result.associations[0]!.revisionKey);
    expect(result.scenarios[0]!.firstAcceptance?.observationIndex).toBe(0);
    expect(result.scenarios[0]!.status).toBe("unresolved");
    expect(result.actions).toEqual([]);
    expect(result.observations).toEqual([original, correction, duplicate]);
  });

  it.each(["correction", "retraction"] as const)("keeps an uncertain %s pending without invalidating supported acceptance", (kind) => {
    const original = report("a");
    const tentative = report("tentative", { fact: kind === "retraction" ? null : { kind: "starter", playerId: 2 },
      relation: { kind, targetObservationIds: [original.id] }, modality: "uncertain" });
    for (const events of [[original, tentative], [tentative, original]]) {
      const result = reduceTweetSemanticEvents(events, AS_OF);
      expect(result.scenarios[0]!.status).toBe("accepted");
      expect(result.actions).toHaveLength(1);
      expect(result.associations.find((entry) => events[entry.observationIndex]!.id === tentative.id)!.reason).toBe("modality_not_actionable");
      expect(result.observations).toEqual(events);
    }
  });

  it.each([false, true])("preserves a retraction without replacement content, retraction first=%s", (retractionFirst) => {
    const original = report("a");
    const retraction = report("retract", { fact: null, relation: { kind: "retraction", targetObservationIds: [original.id] } });
    const events = retractionFirst ? [retraction, original] : [original, retraction];
    const result = reduceTweetSemanticEvents(events, AS_OF);
    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0]!.status).toBe("unresolved");
    expect(result.scenarios[0]!.revisions).toHaveLength(2);
    expect(result.associations[retractionFirst ? 0 : 1]!.reason).toBe("retraction_authority_required");
    expect(result.actions).toEqual([]);
    expect(result.observations).toEqual(events);
  });

  it("does not let retractions with missing or different-game targets change another game's acceptance", () => {
    const original = report("a");
    const missing = report("missing", { fact: null, relation: { kind: "retraction", targetObservationIds: ["unknown"] } });
    const otherGame = report("wrong-game", { fact: null, scope: { ...GAME, kind: "game", gameId: 2026020071 },
      relation: { kind: "retraction", targetObservationIds: [original.id] } });
    const result = reduceTweetSemanticEvents([original, missing, otherGame], AS_OF);
    expect(result.scenarios[0]!.status).toBe("accepted");
    expect(result.associations.slice(1).map((entry) => entry.reason)).toEqual(["fact_or_retraction_target_unresolved", "fact_or_retraction_target_unresolved"]);
    expect(result.actions).toHaveLength(1);
  });

  it("retains expected recall as pending and keeps completed recall/reassignment as distinct proposed actions", () => {
    const expected = report("expected", { scope: PERIOD, fact: { kind: "transaction", playerId: 1, action: "recall" }, modality: "uncertain" });
    const recall = report("recall", { scope: PERIOD, fact: expected.fact });
    const reassignment = report("reassignment", { scope: PERIOD, fact: { kind: "transaction", playerId: 1, action: "reassignment" },
      effectiveAt: "2026-10-16T00:00:00Z" });
    const accepted = reduceTweetSemanticEvents([expected, recall], AS_OF);
    expect(accepted.actions).toHaveLength(1);
    expect(accepted.actions[0]!.observationIndex).toBe(1);
    expect(accepted.observations[1]!.fact?.kind).toBe("transaction");
    const changed = reduceTweetSemanticEvents([expected, recall, reassignment], AS_OF);
    expect(changed.scenarios[0]!.revisions).toHaveLength(2);
    expect(changed.associations[2]!.reason).toBe("revision_resolution_required");
    expect(changed.actions).toEqual([]);
  });

  it("keeps IR and LTIR distinct despite a shared out availability label", () => {
    const ir = report("ir", { scope: PERIOD, fact: { kind: "transaction", playerId: 1, action: "ir" } });
    const ltir = report("ltir", { scope: PERIOD, fact: { kind: "transaction", playerId: 1, action: "ltir" },
      relation: { kind: "correction", targetObservationIds: [ir.id] } });
    const result = reduceTweetSemanticEvents([ir, ltir], AS_OF);
    expect(result.scenarios[0]!.revisions.map((revision) => revision.fact)).toEqual([ir.fact, ltir.fact]);
    expect(result.associations[1]!.revisionKey).not.toBe(result.associations[0]!.revisionKey);
    expect(result.scenarios[0]!.status).toBe("unresolved");
    expect(result.actions).toEqual([]);
  });
});

describe("exact scenario boundaries", () => {
  it.each([
    ["game", { ...GAME, kind: "game", gameId: 2026020071 }],
    ["team", { ...GAME, kind: "game", teamId: 54 }],
    ["game phase", { ...GAME, kind: "game", phase: "in_game" }],
    ["group", { ...GAME, kind: "game", group: "B" }],
  ] satisfies [string, TweetSemanticScope][])("separates the same fact across a different %s", (_label, scope) => {
    const result = reduceTweetSemanticEvents([report("a"), report("b", { scope })], AS_OF);
    expect(result.scenarios).toHaveLength(2);
    expect(result.actions).toHaveLength(2);
    expect(result.actions[0]!.key).not.toBe(result.actions[1]!.key);
  });

  it("separates practice sessions, game entry, and unknown game scope", () => {
    const practice: TweetSemanticScope = { kind: "session", teamId: 55, date: "2026-10-15", sessionId: "morning-skate-1", group: null };
    const events = [report("game", { fact: LINEUP }), report("practice", { fact: LINEUP, scope: practice }),
      report("practice-2", { fact: LINEUP, scope: { ...practice, sessionId: "afternoon-practice-1" } }),
      report("unknown", { fact: LINEUP, scope: null })];
    const result = reduceTweetSemanticEvents(events, AS_OF);
    expect(result.scenarios).toHaveLength(3);
    expect(result.actions).toHaveLength(3);
    expect(result.associations[3]!.scenarioKey).toBeNull();
    expect(reduceTweetSemanticEvents([report("starter-in-practice", { scope: practice })], AS_OF).actions).toEqual([]);
  });

  it("separates explicit lineup situations and player-specific transactions in one report", () => {
    if (LINEUP.kind !== "lineup") throw new Error("fixture");
    const events = [report("es", { fact: LINEUP }), report("pp", { fact: { ...LINEUP, situation: "pp" } }),
      report("p1", { reportId: "shared-report", scope: PERIOD, fact: { kind: "transaction", playerId: 1, action: "recall" } }),
      report("p2", { reportId: "shared-report", scope: PERIOD, fact: { kind: "transaction", playerId: 2, action: "assignment" } })];
    const result = reduceTweetSemanticEvents(events, AS_OF);
    expect(result.scenarios).toHaveLength(4);
    expect(result.actions).toHaveLength(4);
    expect(result.observations).toEqual(events);
  });

  it("requires explicit transaction periods and does not merge separate episodes", () => {
    const first = report("a", { scope: PERIOD, fact: { kind: "transaction", playerId: 1, action: "recall" } });
    const second = report("b", { fact: first.fact, scope: { ...PERIOD, kind: "effective_period", periodId: "bound-roster-period-2" } });
    const invalid = report("c", { fact: first.fact, scope: PERIOD, effectiveAt: PERIOD.kind === "effective_period" ? PERIOD.endsAt : null });
    const result = reduceTweetSemanticEvents([first, second, invalid], AS_OF);
    expect(result.scenarios).toHaveLength(2);
    expect(result.actions).toHaveLength(2);
    expect(result.associations[2]!.reason).toBe("effective_time_unresolved_or_outside_period");
  });
});
