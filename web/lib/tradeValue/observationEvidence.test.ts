import { describe, expect, it } from "vitest";
import type { Observation, EventScope } from "./contracts";
import { selectObservationEvidence } from "./observationEvidence";

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
const changed = (patch: Partial<Observation>) => ({ ...structuredClone(row), ...patch });
describe("public trade observation evidence from trusted adapters", () => {
  it("all three sides, unresolved picks and unknown assets survive unchanged", () => {
    const result = selectObservationEvidence([row], options);
    expect(result.status).toBe("available");
    if (result.status === "available") { expect(result.value.records[0]).toEqual(row); expect(result.value.provenEvents).toBe(0); }
  });
  it("identical bundles are separate sightings without proven event identity", () => {
    const result = selectObservationEvidence([row, changed({ sightingId: "synthetic-sighting-2" })], options);
    expect(result.status).toBe("available");
    if (result.status === "available") { expect(result.value.sightings).toBe(2); expect(result.value.provenEvents).toBe(0); }
  });
  it("same event across captures retains two sightings and counts one proven event", () => {
    const event = { scope: eventScope, id: "event-1" };
    const result = selectObservationEvidence([changed({ event }), changed({ sightingId: "s2", captureId: "capture2", event })], options);
    expect(result.status).toBe("available");
    if (result.status === "available") { expect(result.value.sightings).toBe(2); expect(result.value.provenEvents).toBe(1); }
  });
  it("conflicting proven event is withheld", () => {
    const event = { scope: eventScope, id: "event-1" };
    expect(selectObservationEvidence([changed({ event }), changed({ sightingId: "s2", event, tradedAt: "2026-11-03T00:00:00Z" })], options)).toEqual({ status: "unavailable", reasons: ["conflicting_event"] });
  });
  it("same event ID across game, season and league scopes never collides", () => {
    const scopes: EventScope[] = [eventScope, { ...eventScope, gameKey: "478" }, { ...eventScope, seasonId: "2027" },
      { ...eventScope, leagueKey: "477.l.1" }, { ...eventScope, leagueKey: "477.l.2" }];
    const result = selectObservationEvidence(scopes.map((scope, index) => changed({ sightingId: `scope-${index}`, scope: { gameKey: scope.gameKey, seasonId: scope.seasonId },
      event: { scope, id: "same-id" }, tradedAt: `2026-10-0${index + 1}T00:00:00Z` })), options);
    if (result.status !== "available") expect.fail("Expected evidence");
    expect(result.value.provenEvents).toBe(5);
  });
  it("event source, game and season must match its observation", () => {
    const mismatches: EventScope[] = [{ ...eventScope, source: "yahoo_league_transactions", leagueKey: "477.l.1" },
      { ...eventScope, gameKey: "478" }, { ...eventScope, seasonId: "2027" }];
    for (const scope of mismatches) expect(selectObservationEvidence([changed({ event: { scope, id: "same-id" } })], options)).toEqual({ status: "unavailable", reasons: ["invalid_event_identity"] });
  });
  it("replayed sighting is idempotent", () => {
    const result = selectObservationEvidence([row, structuredClone(row)], options);
    if (result.status !== "available") expect.fail("Expected evidence");
    expect(result.value.sightings).toBe(1);
  });
  it("private league data never enters public evidence", () => expect(selectObservationEvidence([changed({ sourceUse: { ...row.sourceUse, display: "connected_league_only" } })], options).status).toBe("unavailable"));
  it("unapproved use is withheld", () => expect(selectObservationEvidence([changed({ sourceUse: { ...row.sourceUse, receipt: null } })], options).status).toBe("unavailable"));
  it("future capture and synthetic/observed mismatch are withheld", () => {
    expect(selectObservationEvidence([changed({ observedAt: "2026-11-05T00:00:00Z" })], options).status).toBe("unavailable");
    expect(selectObservationEvidence([row], { ...options, sample: "observed" }).status).toBe("unavailable");
  });
  it("empty input is unavailable, never a verified empty market", () => expect(selectObservationEvidence([], options)).toEqual({ status: "unavailable", reasons: ["no_sightings_not_verified_empty"] }));
  it("selection does not mutate source bundles", () => {
    const original = JSON.stringify(row); selectObservationEvidence([row], options); expect(JSON.stringify(row)).toBe(original);
  });
});
