// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fixtureSource } from "./fixtures";
import { contentHash } from "./hash.server";
import { normalizeSourceBatch, sourceInstant, type SourceBatch, type SourcePolicy, type SourceRecord } from "./data";
import { appendResearchCapture, captureUniverse, freezeResearchCapture, settleResearchCapture, type CaptureInput, type CaptureSettlement, type PinnedInput } from "./researchCapture";

type Payload = { SOG: number; PIM: number | null };
const cutoffAt = "2026-01-01T13:00:00.000Z";
const policy: SourcePolicy = { cutoffAt, maximumAgeMs: 2 * 3600000, maximumRecords: 20, maximumPages: 5,
  intendedUse: "local_fixture", approvals: [{ source: "fixture", evidenceId: "synthetic-approval", approvedAt: cutoffAt, intendedUse: "local_fixture" }] };
function row(): SourceRecord<Payload> {
  const payload = { SOG: 2, PIM: null };
  return { identity: { playerId: 9900001, gameId: 2099020010, seasonId: 20992000, teamId: 1, mappingRevision: "mapping-1", verified: true },
    source: fixtureSource({ sha256: contentHash(payload) }), payload };
}
const batch = (records = [row()]): SourceBatch<Payload> => ({ complete: true, expectedCount: records.length, pages: [{ index: 0, records }] });
const validate = (p: Payload) => Number.isSafeInteger(p.SOG) && p.SOG >= 0 && Object.hasOwn(p, "PIM") && (p.PIM === null || Number.isSafeInteger(p.PIM) && p.PIM >= 0);

describe("local immutable pregame research capture", () => {
  const pin = <T,>(id: string, value: T, receivedAt = cutoffAt): PinnedInput<T> => ({ value,
    source: fixtureSource({ id, sha256: contentHash(value), observedAt: receivedAt, firstReceivedAt: receivedAt, publishedAt: null }) });
  const input = (): CaptureInput => ({ id: "capture-1", predecessorId: null, seasonId: 20262027, mappingVersion: "nhl-id-fixture", categoryVersion: "official-counts-v1",
    cutoffAt, issuedAt: "2026-01-01T13:01:00Z", retainedAt: "2026-01-01T13:02:00Z", evidenceClass: "fixture", admission: policy,
    roster: pin("roster", { complete: true, members: [
      { playerId: 1, teamId: 1, kind: "skater", status: "injury_reserve", effectiveAt: cutoffAt },
      { playerId: 2, teamId: 1, kind: "goalie", status: "reserve", effectiveAt: cutoffAt },
      { playerId: 3, teamId: 1, kind: "skater", status: "roster", effectiveAt: cutoffAt },
    ] }),
    schedule: pin("schedule", { complete: true, version: "schedule-1", games: [{ gameId: 101, homeTeamId: 1, awayTeamId: 2, startsAt: "2026-01-02T20:00:00Z" }] }),
    inputs: [], forecasts: [{ playerId: 1, horizon: 1, gameIds: [101], modelVersion: "fixture", featureVersion: "fixture", codeVersion: "fixture", modelAvailableAt: cutoffAt,
      calibrationVersion: null, sourceIds: ["roster", "schedule"], means: { G: 0.1 } }] });
  const settlement = (): PinnedInput<CaptureSettlement> => pin("final-boxscore", { gameId: 101, played: true, finalAt: "2026-01-02T23:00:00Z",
    completeScopes: [], observations: [] }, "2026-01-03T00:00:00Z");

  it("keeps injured players, backups and rookies independently of forecast availability", () => {
    const universe = captureUniverse(freezeResearchCapture(input()));
    expect(universe.map(m => m.playerId)).toEqual([1, 2, 3]);
    expect(universe[2].windows[0]).toMatchObject({ complete: true, forecast: null, missingReason: "no_captured_forecast" });
    expect(universe[0].windows[2]).toMatchObject({ complete: false, gameIds: [101], forecast: null });
  });
  it("rejects altered bytes, future inputs/model versions and incomplete universes", () => {
    const value = input(); value.roster.value.members.pop();
    expect(() => freezeResearchCapture(value)).toThrow(/hash/);
    const future = input(); future.roster.source.firstReceivedAt = "2026-01-02T00:00:00Z";
    expect(() => freezeResearchCapture(future)).toThrow(/cutoff/);
    const model = input(); model.forecasts[0].modelAvailableAt = "2026-01-02T00:00:00Z";
    expect(() => freezeResearchCapture(model)).toThrow(/unproven/);
    const incomplete = input(); incomplete.roster = pin("roster", { ...incomplete.roster.value, complete: false });
    expect(() => freezeResearchCapture(incomplete)).toThrow(/incomplete/);
  });
  it("requires exact window IDs and never manufactures H10/H20 point forecasts", () => {
    const value = input(); value.forecasts[0].horizon = 10;
    expect(() => freezeResearchCapture(value)).toThrow(/window/);
    value.forecasts[0].horizon = 1; value.forecasts[0].gameIds = [102];
    expect(() => freezeResearchCapture(value)).toThrow(/window/);
  });
  it("rejects retention crossing an issuance-origin game, including absent or shifted forecasts", () => {
    for (const horizon of [1, 10, 20] as const) {
      const value = input();
      value.schedule = pin("schedule", { complete: true, version: "schedule-1", games: Array.from({ length: 21 }, (_, i) => ({
        gameId: 101 + i, homeTeamId: 1, awayTeamId: 2, startsAt: new Date(Date.UTC(2026, 0, 2 + i, 20)).toISOString(),
      })) });
      value.retainedAt = "2026-01-02T21:00:00Z";
      value.forecasts[0].horizon = horizon;
      value.forecasts[0].gameIds = value.schedule.value.games.slice(1, horizon + 1).map(g => g.gameId);
      expect(() => freezeResearchCapture(value)).toThrow(/late|window/);
      value.retainedAt = "2026-01-02T20:00:00Z";
      value.forecasts[0].gameIds = value.schedule.value.games.slice(0, horizon).map(g => g.gameId);
      expect(() => freezeResearchCapture(value)).toThrow(/late/);
      value.forecasts = [];
      expect(() => freezeResearchCapture(value)).toThrow(/late/);
    }
  });
  it("keeps issuance windows fixed during a pregame retention delay and preserves missing forecasts", () => {
    const value = input();
    value.schedule = pin("schedule", { complete: true, version: "schedule-1", games: [
      { gameId: 100, homeTeamId: 1, awayTeamId: 2, startsAt: "2026-01-01T13:00:30Z" },
      ...Array.from({ length: 20 }, (_, i) => ({ gameId: 101 + i, homeTeamId: 1, awayTeamId: 2,
        startsAt: new Date(Date.UTC(2026, 0, 2 + i, 20)).toISOString() })),
    ] });
    const original = captureUniverse(freezeResearchCapture(value));
    value.retainedAt = "2026-01-02T19:59:59Z";
    const delayed = captureUniverse(freezeResearchCapture(value));
    expect(delayed).toEqual(original);
    expect(delayed[0].windows.map(w => w.gameIds)).toEqual([1, 10, 20].map(h => Array.from({ length: h }, (_, i) => 101 + i)));
    expect(delayed[2].windows.every(w => w.forecast === null && w.complete)).toBe(true);
  });
  it("preserves old membership and schedule bytes across a trade/postponement correction", () => {
    const first = freezeResearchCapture(input()), next = input(); next.id = "capture-2"; next.predecessorId = first.payload.id; next.forecasts = [];
    next.roster.value.members[0].teamId = 3; next.roster = pin("roster", next.roster.value);
    next.schedule.value.games[0].startsAt = "2026-01-05T20:00:00Z"; next.schedule.value.version = "schedule-2"; next.schedule = pin("schedule", next.schedule.value);
    expect(() => appendResearchCapture([first], freezeResearchCapture(next))).toThrow(/source_revision/);
    next.roster.source.revision = "roster-2"; next.schedule.source.revision = "schedule-2";
    const history = appendResearchCapture([first], freezeResearchCapture(next));
    expect(history[0].payload.roster.value.members[0].teamId).toBe(1);
    expect(history[0].payload.schedule.value.games[0].startsAt).toBe("2026-01-02T20:00:00Z");
    expect(appendResearchCapture(history, first)).toHaveLength(2);
    next.id = first.payload.id;
    expect(() => appendResearchCapture(history, freezeResearchCapture(next))).toThrow(/immutable/);
  });
  it("requires final scoped completeness before declaring absence DNP; unused is distinct", () => {
    const capture = freezeResearchCapture(input()), receipt = settlement(), asOf = "2026-01-03T01:00:00Z";
    expect(settleResearchCapture(capture, receipt, asOf, policy).every(r => r.appearance === "unknown")).toBe(true);
    receipt.value.completeScopes = [{ teamId: 1, kind: "skater" }];
    receipt.value.observations = [{ playerId: 2, kind: "goalie", appearance: "dressed_unused", game: { gameId: 101, teamId: 1,
      startsAt: "2026-01-02T20:00:00Z", sharedShutout: false, counts: { SV: 0, SA: 0, GA: 0, W: 0, SO: 0, MIN: 0, GP: 0, GS: 0, RELIEF: 0 } } }];
    const pinned = pin(receipt.source.id, receipt.value, receipt.source.firstReceivedAt);
    const rows = settleResearchCapture(capture, pinned, asOf, policy);
    expect(rows.map(r => r.appearance)).toEqual(["nonappearance", "dressed_unused", "nonappearance"]);
    expect(rows[0]).toMatchObject({ knownZero: true, counts: null });
    expect(() => settleResearchCapture(capture, pinned, "2026-01-02T21:00:00Z", policy)).toThrow();
  });
  it("quarantines contradictory official goalie counts and permits relief wins", () => {
    const r = settlement(); r.value.observations = [{ playerId: 2, kind: "goalie", appearance: "official_appearance", game: { gameId: 101,
      teamId: 1, startsAt: "2026-01-02T20:00:00Z", sharedShutout: false, counts: { SV: 25, SA: 30, GA: 6, W: 0, SO: 0, MIN: 59.75, GP: 1, GS: 1, RELIEF: 0 } } }];
    const settle = () => settleResearchCapture(freezeResearchCapture(input()), pin(r.source.id, r.value, r.source.firstReceivedAt), "2026-01-03T01:00:00Z", policy);
    expect(settle).toThrow(/SA/);
    Object.assign(r.value.observations[0].game.counts, { SA: 31, GS: 0, RELIEF: 1, W: 1 });
    expect(settle()[1].appearance).toBe("official_appearance"); // Synthetic legal relief win, not a repair proposal.
  });
  it("preserves a cancelled game as not played, never a completed zero window", () => {
    const value = settlement().value; value.played = false; value.finalAt = "2026-01-02T15:00:00Z";
    value.completeScopes = [{ teamId: 1, kind: "skater" }];
    const receipt = pin("cancelled", value, "2026-01-02T16:00:00Z");
    const rows = settleResearchCapture(freezeResearchCapture(input()), receipt, "2026-01-02T17:00:00Z", policy);
    expect(rows.every(r => r.appearance === "game_not_played" && !r.knownZero && r.counts === null)).toBe(true);
  });
});
describe("supplied source normalization", () => {
  it("retains missing categories and pins verified canonical content without modifying inputs", () => {
    const input = batch(), result = normalizeSourceBatch(input, policy, validate);
    expect(result.state).toBe("available");
    if (result.state !== "available") return;
    expect(result.records[0].payload.PIM).toBeNull();
    expect(result.approvalEvidenceIds).toEqual(["synthetic-approval"]);
    expect(result.manifestHash).toBe(contentHash(result.records));
    result.records[0].payload.SOG = 6;
    expect(input.pages[0].records[0].payload.SOG).toBe(2);
  });
  it.each(["unknown receipt", "future receipt", "future publication", "stale", "identity", "rights", "hash", "missing field"])("rejects %s", failure => {
    const input = batch(), record = input.pages[0].records[0];
    if (failure === "unknown receipt") record.source.firstReceivedAt = "";
    if (failure === "future receipt") record.source.firstReceivedAt = "2026-01-01T14:00:00Z";
    if (failure === "future publication") record.source.publishedAt = "2026-01-01T14:00:00Z";
    if (failure === "stale") record.source.observedAt = "2025-12-01T12:00:00Z";
    if (failure === "identity") record.identity.verified = false;
    if (failure === "rights") record.source.use = "unknown";
    if (failure === "hash") record.payload.SOG = 9;
    if (failure === "missing field") { delete (record.payload as Partial<Payload>).PIM; record.source.sha256 = contentHash(record.payload); }
    expect(normalizeSourceBatch(input, policy, validate).state).toBe("unavailable");
  });
  it("requires intended-use approval and allows explicitly unknown provider publication with known receipt", () => {
    const input = batch(); input.pages[0].records[0].source.publishedAt = null;
    expect(normalizeSourceBatch(input, policy, validate).state).toBe("available");
    expect(normalizeSourceBatch(input, { ...policy, intendedUse: "public" }, validate).state).toBe("unavailable");
  });
  it.each(["count", "page", "complete", "duplicate"])("rejects incomplete/conflicting %s evidence", failure => {
    const input = batch();
    if (failure === "count") input.expectedCount = 2;
    if (failure === "page") input.pages[0].index = 1;
    if (failure === "complete") input.complete = false;
    if (failure === "duplicate") { input.pages[0].records.push(row()); input.expectedCount++; }
    expect(normalizeSourceBatch(input, policy, validate).state).toBe("unavailable");
  });
  it("selects the latest received revision deterministically and rejects tied conflicting revisions", () => {
    const old = row(), newer = row(); newer.source.revision = "r2"; newer.source.firstReceivedAt = "2026-01-01T12:30:00Z";
    const result = normalizeSourceBatch(batch([newer, old]), policy, validate);
    expect(result.state === "available" && result.records[0].source.revision).toBe("r2");
    newer.source.firstReceivedAt = old.source.firstReceivedAt;
    expect(normalizeSourceBatch(batch([newer, old]), policy, validate).state).toBe("unavailable");
  });
  it("requires UTC clocks and rejects invalid date rollover", () => {
    expect(sourceInstant("2026-02-30T12:00:00Z")).toBeNaN();
    expect(sourceInstant("2026-01-01T12:00:00")).toBeNaN();
    expect(sourceInstant("2026-01-01T12:00:00Z")).toBe(Date.parse("2026-01-01T12:00:00Z"));
  });
});
