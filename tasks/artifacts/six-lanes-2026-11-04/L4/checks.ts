import { strict as assert } from "node:assert";
import { selectObservationEvidence, type Observation, type EventScope } from "./contracts";

const row: Observation = {
  version: "trade-observation-v1", sightingId: "synthetic-sighting-1", captureId: "synthetic-capture", parserVersion: "synthetic-v1",
  source: "yahoo_trade_market", sourceUrl: "https://hockey.fantasysports.yahoo.com/hockey/playertrades?pid=1&type=player",
  scope: { gameKey: "477", seasonId: "2026" },
  sourceUse: { receipt: "synthetic-use-receipt-not-authority", display: "public", attribution: "Synthetic Yahoo contract example", yahooLogoRequired: true },
  observedAt: "2026-11-04T12:00:00Z", tradedAt: null, rawDateText: "Yesterday", event: null, sample: "synthetic",
  sides: [
    { label: "A", assets: [{ kind: "player", rawText: "Unresolved synthetic player", yahooKey: "477.p.1", identity: { status: "unavailable", reasons: ["unmapped"] } }] },
    { label: "B", assets: [{ kind: "pick", rawText: "Conditional future pick", season: null, round: null, originalOwnerText: null, conditionText: "condition unresolved" }, { kind: "unknown", rawText: "Unparsed asset" }] },
    { label: "C", assets: [{ kind: "unknown", rawText: "Third side retained" }] },
  ], context: { scoring: null, roster: null, leagueSize: null, keeper: null },
};
const options = { asOf: "2026-11-04T13:00:00Z", sample: "synthetic" } as const;
const eventScope: EventScope = { source: "yahoo_trade_market", gameKey: "477", seasonId: "2026", leagueKey: null };
let checks = 0;
function check(name: string, run: () => void) { run(); checks++; console.log(`PASS ${name}`); }
const changed = (patch: Partial<Observation>) => ({ ...structuredClone(row), ...patch });
check("all three sides, unresolved picks and unknown assets survive unchanged", () => {
  const result = selectObservationEvidence([row], options);
  assert.equal(result.status, "available");
  if (result.status === "available") { assert.deepEqual(result.value.records[0], row); assert.equal(result.value.provenEvents, 0); }
});
check("identical bundles are separate sightings without proven event identity", () => {
  const result = selectObservationEvidence([row, changed({ sightingId: "synthetic-sighting-2" })], options);
  assert.equal(result.status, "available");
  if (result.status === "available") { assert.equal(result.value.sightings, 2); assert.equal(result.value.provenEvents, 0); }
});
check("same event across captures retains two sightings and counts one proven event", () => {
  const event = { scope: eventScope, id: "event-1" };
  const result = selectObservationEvidence([changed({ event }), changed({ sightingId: "s2", captureId: "capture2", event })], options);
  assert.equal(result.status, "available");
  if (result.status === "available") { assert.equal(result.value.sightings, 2); assert.equal(result.value.provenEvents, 1); }
});
check("conflicting proven event is withheld", () => {
  const event = { scope: eventScope, id: "event-1" };
  assert.deepEqual(selectObservationEvidence([changed({ event }), changed({ sightingId: "s2", event, tradedAt: "2026-11-03T00:00:00Z" })], options), { status: "unavailable", reasons: ["conflicting_event"] });
});
check("same event ID across game, season and league scopes never collides", () => {
  const scopes: EventScope[] = [eventScope, { ...eventScope, gameKey: "478" }, { ...eventScope, seasonId: "2027" },
    { ...eventScope, leagueKey: "477.l.1" }, { ...eventScope, leagueKey: "477.l.2" }];
  const result = selectObservationEvidence(scopes.map((scope, index) => changed({ sightingId: `scope-${index}`, scope: { gameKey: scope.gameKey, seasonId: scope.seasonId },
    event: { scope, id: "same-id" }, tradedAt: `2026-10-0${index + 1}T00:00:00Z` })), options);
  if (result.status !== "available") assert.fail("Expected evidence");
  assert.equal(result.value.provenEvents, 5);
});
check("event source, game and season must match its observation", () => {
  const mismatches: EventScope[] = [{ ...eventScope, source: "yahoo_league_transactions", leagueKey: "477.l.1" },
    { ...eventScope, gameKey: "478" }, { ...eventScope, seasonId: "2027" }];
  for (const scope of mismatches) assert.deepEqual(selectObservationEvidence([changed({ event: { scope, id: "same-id" } })], options),
    { status: "unavailable", reasons: ["invalid_event_identity"] });
});
check("replayed sighting is idempotent", () => {
  const result = selectObservationEvidence([row, structuredClone(row)], options);
  if (result.status !== "available") assert.fail("Expected evidence");
  assert.equal(result.value.sightings, 1);
});
check("private league data never enters public evidence", () => assert.equal(selectObservationEvidence([changed({ sourceUse: { ...row.sourceUse, display: "connected_league_only" } })], options).status, "unavailable"));
check("unapproved use is withheld", () => assert.equal(selectObservationEvidence([changed({ sourceUse: { ...row.sourceUse, receipt: null } })], options).status, "unavailable"));
check("future capture and synthetic/observed mismatch are withheld", () => {
  assert.equal(selectObservationEvidence([changed({ observedAt: "2026-11-05T00:00:00Z" })], options).status, "unavailable");
  assert.equal(selectObservationEvidence([row], { ...options, sample: "observed" }).status, "unavailable");
});
check("empty input is unavailable, never a verified empty market", () => assert.deepEqual(selectObservationEvidence([], options), { status: "unavailable", reasons: ["no_sightings_not_verified_empty"] }));
check("selection does not mutate source bundles", () => {
  const original = JSON.stringify(row); selectObservationEvidence([row], options); assert.equal(JSON.stringify(row), original);
});
console.log(`${checks} focused synthetic checks passed; no production/source access.`);
