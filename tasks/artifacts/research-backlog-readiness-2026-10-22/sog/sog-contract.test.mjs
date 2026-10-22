import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fixtures, packet, row } from "./fixtures.mjs";
import { describeSyntheticSog as describe } from "./reference-arithmetic.mjs";

const counts = result => result.thresholdRows.map(value => value.hits);
const rates = result => result.thresholdRows.map(value => value.frequency);
const bins = result => result.distribution.map(value => value.count);
const close = (left, right) => assert.ok(Math.abs(left - right) < 1e-12, `${left} != ${right}`);

test("same mean can hide different historical threshold frequencies", () => {
  const steady = describe(fixtures.steady), alternating = describe(fixtures.alternating);
  assert.equal(steady.meanObservedSog, 3);
  assert.equal(alternating.meanObservedSog, 3);
  assert.deepEqual(counts(steady), [2, 2, 0]);
  assert.deepEqual(rates(steady), [1, 1, 0]);
  assert.deepEqual(counts(alternating), [1, 1, 1]);
  assert.deepEqual(rates(alternating), [0.5, 0.5, 0.5]);
});

test("thresholds are inclusive; mutually exclusive distribution bins conserve the sample", () => {
  const result = describe(fixtures.boundaries);
  assert.equal(result.confirmedAppearances, 6);
  assert.equal(result.observedSogAppearances, 6);
  assert.equal(result.totalObservedSog, 16);
  close(result.meanObservedSog, 16 / 6);
  assert.deepEqual(counts(result), [4, 3, 2]);
  assert.deepEqual(bins(result), [1, 1, 1, 1, 2]);
  assert.equal(result.distribution.reduce((sum, value) => sum + value.count, 0), 6);
});

test("valid zero appearances are observations; a zero-shot history gives genuine zero frequencies", () => {
  const result = describe(fixtures.allZero);
  assert.equal(result.state, "complete");
  assert.equal(result.meanObservedSog, 0);
  assert.equal(result.totalObservedSog, 0);
  assert.deepEqual(rates(result), [0, 0, 0]);
  assert.deepEqual(bins(result), [2, 0, 0, 0, 0]);
});

test("missing SOG stays out of the frequency denominator and remains visible in coverage", () => {
  const result = describe(fixtures.partialSog);
  assert.equal(result.state, "partial");
  assert.equal(result.confirmedAppearances, 3);
  assert.equal(result.missingSogAppearances, 1);
  assert.equal(result.observedSogAppearances, 2);
  assert.equal(result.meanObservedSog, 2);
  assert.deepEqual(rates(result), [0.5, 0.5, 0.5]);
});

test("confirmed nonappearances and unconfirmed appearances never become zero-shot appearances", () => {
  const result = describe(fixtures.appearances);
  assert.equal(result.selectedLogGames, 6);
  assert.equal(result.confirmedAppearances, 2);
  assert.equal(result.nonAppearances, 2);
  assert.equal(result.unknownAppearanceGames, 2);
  assert.equal(result.unconfirmedScheduleGames, 1);
  assert.equal(result.observedSogAppearances, 2);
  assert.deepEqual(rates(result), [0.5, 0.5, 0]);
  assert.equal(result.state, "partial");
});

test("empty, no-appearance and no-observed-SOG states are not numerical zero rates", () => {
  for (const name of ["emptyComplete", "emptyUnknown", "noAppearances", "noObservedSog"]) {
    const result = describe(fixtures[name]);
    assert.equal(result.meanObservedSog, null);
    assert.equal(result.totalObservedSog, null);
    assert.deepEqual(rates(result), [null, null, null]);
    assert.ok(result.thresholdRows.every(value => value.hits === 0 && value.denominator === 0));
    assert.ok(result.distribution.every(value => value.count === 0 && value.frequency === null));
  }
  assert.equal(describe(fixtures.emptyComplete).state, "no_appearances");
  assert.equal(describe(fixtures.noAppearances).state, "no_appearances");
  assert.equal(describe(fixtures.emptyUnknown).state, "unavailable");
  assert.equal(describe(fixtures.noObservedSog).state, "unavailable");
  assert.equal(describe(fixtures.noObservedSog).missingSogAppearances, 2);
});

test("complete observed rows do not certify a partial or unknown source population", () => {
  for (const name of ["partialPopulation", "unknownPopulation"]) {
    const result = describe(fixtures[name]);
    assert.equal(result.state, "partial");
    assert.equal(result.populationCoverage, fixtures[name].populationCoverage);
    assert.equal(result.observedSogAppearances, 1);
  }
  assert.equal(describe(packet([row(1, 3)], { unconfirmedScheduleGames: 1 })).state, "partial");
});

test("the selected last-10 log window is fixed before missing SOG is excluded", () => {
  const result = describe(fixtures.missingAtWindowEdge);
  assert.equal(result.selectedLogGames, 10);
  assert.equal(result.requestedLogGames, 10);
  assert.equal(result.windowFill, "filled");
  assert.equal(result.confirmedAppearances, 10);
  assert.equal(result.observedSogAppearances, 9);
  assert.equal(result.missingSogAppearances, 1);
  assert.equal(result.totalObservedSog, 24);
  assert.equal(result.selectedGameIds.includes("synthetic-game-1"), false);
  assert.equal(result.selectedGameIds.includes("synthetic-game-11"), true);
  assert.deepEqual(counts(result), [8, 8, 0]);
  assert.deepEqual(rates(result), [8 / 9, 8 / 9, 0]);
});

test("short-window and complete-source states are independent; never fabricate ten observations", () => {
  const result = describe(fixtures.steady);
  assert.equal(result.requestedLogGames, 10);
  assert.equal(result.selectedLogGames, 2);
  assert.equal(result.windowFill, "short");
  assert.equal(result.state, "complete");
  assert.deepEqual(result.thresholdRows.map(value => value.denominator), [2, 2, 2]);
});

test("season/phase/date/finality filters exclude future, in-progress and other-scope rows", () => {
  const result = describe(fixtures.excludedScope);
  assert.deepEqual(result.selectedGameIds, ["synthetic-game-1"]);
  assert.deepEqual(result.exclusions, { otherSeason: 1, otherPhase: 1, outsideSeasonDates: 0, currentOrFuture: 2, notFinal: 1, outsideCustom: 0, olderThanWindow: 0 });
});

test("date bounds apply even to a provider row carrying the selected season ID", () => {
  const result = describe(packet([row(1, 3), row(2, 9, { date: "2025-10-02" })]));
  assert.equal(result.exclusions.outsideSeasonDates, 1);
  assert.equal(result.totalObservedSog, 3);
});

test("custom dates are inclusive; season mode keeps all scoped historical log games", () => {
  const custom = describe(fixtures.custom);
  assert.deepEqual(custom.selectedGameIds, ["synthetic-game-2", "synthetic-game-3"]);
  assert.deepEqual(rates(custom), [0.5, 0.5, 0]);
  const season = describe(packet(fixtures.missingAtWindowEdge.rows, { window: { kind: "season" } }));
  assert.equal(season.selectedLogGames, 11);
  assert.equal(season.requestedLogGames, null);
  assert.equal(season.windowFill, "not_applicable");
  assert.equal(season.totalObservedSog, 33);
});

test("20/30 options retain the existing count-window sizes", () => {
  const rows = Array.from({ length: 21 }, (_, i) => row(i + 1, 1));
  assert.equal(describe(packet(rows, { window: { kind: "last20" } })).selectedLogGames, 20);
  const thirty = describe(packet(rows, { window: { kind: "last30" } }));
  assert.equal(thirty.selectedLogGames, 21);
  assert.equal(thirty.requestedLogGames, 30);
  assert.equal(thirty.windowFill, "short");
});

test("exact duplicate identities collapse before window selection", () => {
  const result = describe(fixtures.duplicates);
  assert.equal(result.collapsedDuplicates, 1);
  assert.equal(result.selectedLogGames, 2);
  assert.equal(result.meanObservedSog, 1.5);
  assert.deepEqual(rates(result), [0.5, 0.5, 0]);
});

test("conflicting duplicates reject the packet; no arbitrary revision or team wins", () => {
  for (const change of [{ shots: 4 }, { shots: null }, { games_played: 0, shots: 0 },
    { teamId: "synthetic-team-b" }, { date: "2026-10-02" }, { phase: "playoff" },
    { seasonId: 20252026 }, { final: false }]) {
    assert.throws(() => describe(packet([row(1, 3), row(1, 3, change)])), /Conflicting duplicate/);
  }
});

test("trades retain all player-season appearances and disclose mixed team context", () => {
  const result = describe(fixtures.traded);
  assert.equal(result.confirmedAppearances, 4);
  assert.equal(result.meanObservedSog, 3);
  assert.deepEqual(counts(result), [3, 2, 2]);
  assert.deepEqual(result.teams, ["synthetic-team-a", "synthetic-team-b"]);
  assert.equal(result.mixedTeamContext, true);
});

test("ordering and repeated exact rows cannot change metric values", () => {
  for (const fixture of Object.values(fixtures)) {
    const base = describe(fixture);
    assert.deepEqual(describe({ ...fixture, rows: [...fixture.rows].reverse() }), base);
    const duplicated = describe({ ...fixture, rows: fixture.rows.flatMap(value => [value, { ...value }]) });
    const { collapsedDuplicates: a, ...left } = base;
    const { collapsedDuplicates: b, ...right } = duplicated;
    assert.deepEqual(left, right);
    assert.equal(b, a + fixture.rows.length);
  }
});

test("unknown appearance flags do not permit SOG to infer participation", () => {
  const result = describe(packet([row(1, 6, { games_played: null })]));
  assert.equal(result.unknownAppearanceGames, 1);
  assert.equal(result.confirmedAppearances, 0);
  assert.equal(result.observedSogAppearances, 0);
  assert.equal(result.state, "unavailable");
});

test("normalized numeric domain rejects coercion, negative/fractional counts and contradictions", () => {
  for (const value of ["", "0", "3", " ", undefined, false, -1, 1.5, Infinity, NaN]) {
    assert.throws(() => describe(packet([row(1, value)])), /Unnormalized SOG/);
  }
  for (const games_played of ["1", "0", undefined, false, -1, 0.5, 2]) {
    assert.throws(() => describe(packet([row(1, 0, { games_played })])), /Unnormalized appearance/);
  }
  assert.throws(() => describe(packet([row(1, 1, { games_played: 0 })])), /Nonappearance/);
});

test("invalid identity, dates and packet scopes fail explicitly", () => {
  assert.throws(() => describe(packet([row(1, 0, { playerId: "synthetic-other" })])), /identity/);
  assert.throws(() => describe(packet([row(1, 0, { gameId: "" })])), /identity/);
  assert.throws(() => describe(packet([row(1, 0, { date: "2026-02-30" })])), /row scope/);
  assert.throws(() => describe(packet([], { asOfDate: "2026-02-30" })), /scope dates/);
  assert.throws(() => describe(packet([], { seasonId: 20262028 })), /season ID/);
  assert.throws(() => describe(packet([], { window: { kind: "last5" } })), /window/);
  assert.throws(() => describe(packet([], { window: { kind: "custom", start: "2026-10-10", end: "2026-10-01" } })), /custom dates/);
});

test("all populated fixtures conserve denominators and monotone inclusive thresholds", () => {
  for (const fixture of Object.values(fixtures)) {
    const result = describe(fixture), n = result.observedSogAppearances;
    assert.equal(result.confirmedAppearances, n + result.missingSogAppearances);
    assert.equal(result.selectedLogGames, result.confirmedAppearances + result.nonAppearances + result.unknownAppearanceGames);
    assert.equal(result.distribution.reduce((sum, value) => sum + value.count, 0), n);
    const [two, three, four] = counts(result);
    assert.ok(n >= two && two >= three && three >= four && four >= 0);
    assert.equal(four, result.distribution[4].count);
    assert.equal(three, result.distribution[3].count + result.distribution[4].count);
    assert.equal(two, result.distribution.slice(2).reduce((sum, value) => sum + value.count, 0));
    if (n) close(result.distribution.reduce((sum, value) => sum + value.frequency, 0), 1);
  }
});

test("fixture IDs are synthetic and input packets are never mutated", () => {
  for (const fixture of Object.values(fixtures)) {
    assert.ok(fixture.playerId.startsWith("synthetic-"));
    assert.ok(fixture.rows.every(value => value.gameId.startsWith("synthetic-") && value.teamId.startsWith("synthetic-")));
    const before = structuredClone(fixture);
    describe(fixture);
    assert.deepEqual(fixture, before);
  }
});

test("canonical source references match their recorded inspection hashes", () => {
  const receipt = JSON.parse(readFileSync(new URL("./SOURCE-REFERENCES.json", import.meta.url), "utf8"));
  const root = new URL("../../../../", import.meta.url);
  for (const source of receipt.files) {
    const bytes = readFileSync(new URL(source.path, root));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), source.sha256, `Source drift: ${source.path}; review compatibility before updating the receipt`);
  }
});
