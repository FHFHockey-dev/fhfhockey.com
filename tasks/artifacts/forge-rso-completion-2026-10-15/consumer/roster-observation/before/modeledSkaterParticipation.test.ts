// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { buildSkaterParticipationReceipt, type SkaterParticipationInput, buildFrozenWindowSkaterParticipationReceipt, type FrozenWindowSkaterParticipationInput } from "./modeledSkaterParticipation";

import { loadFrozenWindowSkaterParticipation, FROZEN_WINDOW_SKATER_PARTICIPATION_DATASET, type FrozenWindowSkaterParticipationBundle } from "./modeledSkaterParticipationStore";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";

const cutoff = "2026-10-15T10:00:00Z";
const issuance = { issuedAt: "2026-10-15T11:00:00Z", expiresAt: "2026-10-15T18:00:00Z" };
function fixture(): SkaterParticipationInput {
  const evidence = { id: "synthetic-only", hash: "a".repeat(64), availableAt: "2026-10-15T09:00:00Z", capturedAt: "2026-10-15T09:00:00Z" };
  return { version: "skater-participation-input-v1", cutoffAt: cutoff,
    scope: { playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 1, gameId: 30,
      scheduledAt: "2026-10-15T23:00:00Z", scheduleRevision: "schedule-a", rosterRevision: "roster-a" },
    scheduleEvidence: evidence, rosterEvidence: evidence,
    history: { complete: true, windowStartAt: new Date(Date.parse(cutoff) - 60 * 86400000).toISOString(),
      scheduleEvidence: evidence, games: [10, 12, 14].map((day, index) => ({ gameId: 10 + index, teamId: 1,
        scheduledAt: `2026-10-${day}T00:00:00Z`, occurred: true, eligible: true,
        positiveMinutes: index !== 1, resolution: index === 1 ? "complete_official_nonappearance" : "positive_toi",
        eligibilityEvidence: evidence, outcomeEvidence: evidence })) } };
}

describe("finite modeled skater participation", () => {
  it.each(["one_microsecond", "available_only", "captured_only"])("rejects %s pregame historical outcome evidence", kind => {
    const input = fixture(), game = input.history.games[2];
    const before = "2026-10-13T23:59:59.999999Z";
    game.outcomeEvidence = { ...game.outcomeEvidence!, id: "synthetic-outcome-clock",
      availableAt: kind === "captured_only" ? game.scheduledAt : before,
      capturedAt: kind === "available_only" ? game.scheduledAt : before };
    expect(() => buildSkaterParticipationReceipt(input, issuance)).toThrow("Historical outcome evidence predates its game");
  });
  it("accepts timezone-equivalent outcome boundary clocks without asserting a final horn", () => {
    const input = fixture(); input.history.games[2].outcomeEvidence = { ...input.history.games[2].outcomeEvidence!,
      id: "synthetic-boundary-clock", availableAt: "2026-10-13T20:00:00-04:00", capturedAt: "2026-10-14T00:00:00.000000Z" };
    expect(buildSkaterParticipationReceipt(input, issuance).probability).toBe(2 / 3);
  });
  it("uses eligible opportunities including explicit nonappearances; endpoint frequency is still a model", () => {
    const input = fixture(), row = buildSkaterParticipationReceipt(input, issuance);
    expect(row).toMatchObject({ probability: 2 / 3, numerator: 2, denominator: 3,
      probabilityStatus: "uncalibrated_model", calibration: "unavailable", event: "positive_minutes", reasons: [] });
    input.history.games[1].positiveMinutes = true; input.history.games[1].resolution = "positive_toi";
    expect(buildSkaterParticipationReceipt(input, issuance)).toMatchObject({ probability: 1, probabilityStatus: "uncalibrated_model" });
    input.history.games.forEach(game => { game.positiveMinutes = false; game.resolution = "explicit_zero_toi"; });
    expect(buildSkaterParticipationReceipt(input, issuance).probability).toBe(0);
  });
  it.each(["frame", "eligibility", "occurrence", "label", "resolution", "source", "empty", "stale"])("retains unknown for %s missingness", kind => {
    const input = fixture(), game = input.history.games[2];
    if (kind === "frame") input.history.complete = false;
    if (kind === "eligibility") game.eligible = null;
    if (kind === "occurrence") game.occurred = null;
    if (kind === "label") game.positiveMinutes = null;
    if (kind === "resolution") game.resolution = null;
    if (kind === "source") game.outcomeEvidence = null;
    if (kind === "empty") input.history.games = [];
    if (kind === "stale") input.rosterEvidence = { ...input.rosterEvidence, capturedAt: "2026-10-01T00:00:00Z" };
    const row = buildSkaterParticipationReceipt(input, issuance);
    expect(row.probability).toBeNull(); expect(row.reasons.length).toBeGreaterThan(0);
  });
  it("excludes known ineligible/cancelled games but never converts their unknown labels to zeros", () => {
    const input = fixture(); input.history.games[1].eligible = false;
    input.history.games[1].positiveMinutes = null; input.history.games[1].outcomeEvidence = null;
    expect(buildSkaterParticipationReceipt(input, issuance)).toMatchObject({ probability: 1, denominator: 2 });
    input.history.games[1].occurred = false; input.history.games[1].eligible = null;
    expect(buildSkaterParticipationReceipt(input, issuance).probability).toBe(1);
  });
  it("uses the last20 eligible games in event order and reports cold/stale history as unknown", () => {
    const input = fixture(), template = input.history.games[0];
    input.history.games = Array.from({ length: 24 }, (_, index) => ({ ...template, gameId: 100 + index,
      scheduledAt: new Date(Date.parse(cutoff) - (index + 1) * 86400000).toISOString(),
      positiveMinutes: index > 0, resolution: index > 0 ? "positive_toi" : "explicit_zero_toi" }));
    const row = buildSkaterParticipationReceipt(input, issuance);
    expect(row.probability).toBe(19 / 20); expect(row.selectedGameIds).toEqual(Array.from({ length: 20 }, (_, i) => 100 + i));
    input.history.games = input.history.games.slice(15);
    expect(buildSkaterParticipationReceipt(input, issuance).reasons).toContain("stale_eligible_history");
  });
  it.each(["duplicate", "future", "wrong_team", "target_game", "future_source", "hash", "window"])("rejects %s history rather than silently changing the frame", kind => {
    const input = fixture(), game = input.history.games[0];
    if (kind === "duplicate") input.history.games.push({ ...game });
    if (kind === "future") game.scheduledAt = cutoff;
    if (kind === "wrong_team") game.teamId = 2;
    if (kind === "target_game") game.gameId = 30;
    if (kind === "future_source") input.scheduleEvidence = { ...input.scheduleEvidence, availableAt: issuance.issuedAt };
    if (kind === "hash") input.rosterEvidence = { ...input.rosterEvidence, hash: "not-a-hash" };
    if (kind === "window") input.history.windowStartAt = cutoff;
    expect(() => buildSkaterParticipationReceipt(input, issuance)).toThrow();
  });
  it.each(["after_start", "late_expiry", "long_expiry", "old_cutoff"])("rejects %s issuance", kind => {
    const input = fixture(), clocks = { ...issuance };
    if (kind === "after_start") clocks.issuedAt = input.scope.scheduledAt;
    if (kind === "late_expiry") clocks.expiresAt = "2026-10-16T00:00:00Z";
    if (kind === "long_expiry") { input.scope.scheduledAt = "2026-10-20T23:00:00Z"; clocks.expiresAt = "2026-10-17T00:00:00Z"; }
    if (kind === "old_cutoff") clocks.issuedAt = "2026-10-16T11:00:00Z";
    expect(() => buildSkaterParticipationReceipt(input, clocks)).toThrow();
  });
  it("binds each next-N game separately without mutating input or transferring confirmation", () => {
    const first = fixture(), before = structuredClone(first), second = structuredClone(first);
    second.scope.gameId = 31; second.scope.scheduledAt = "2026-10-17T23:00:00Z"; second.scope.scheduleRevision = "schedule-b";
    const a = buildSkaterParticipationReceipt(first, issuance), b = buildSkaterParticipationReceipt(second, issuance);
    expect(first).toEqual(before); expect(a.probability).toBe(b.probability);
    expect(a.inputHash).not.toBe(b.inputHash); expect(b.scope.gameId).toBe(31);
  });
});


function frozenFixture(): FrozenWindowSkaterParticipationInput {
  const old = fixture(), evidence = old.rosterEvidence;
  const eligibility = () => ({ playerId: old.scope.playerId, nhlPlayerId: old.scope.nhlPlayerId, teamId: old.scope.teamId,
    eligible: true, effectiveFrom: "2026-09-29T04:00:00Z", effectiveUntil: "2026-10-16T00:00:00Z", evidence });
  return { ...old, version: "skater-frozen-window-participation-input-v1", playerClass: "skater", targetEligibility: eligibility(),
    history: { ...old.history, windowStartAt: "2026-09-29T04:00:00Z", windowEndAt: "2026-10-13T04:00:00Z",
      games: old.history.games.map((game, index) => {
        const { eligible: _eligible, eligibilityEvidence: _evidence, ...rest } = game;
        return { ...rest, scheduledAt: `2026-10-${String(2 + index * 4).padStart(2, "0")}T00:00:00Z`, eligibility: eligibility() };
      }) } };
}
describe("explicit frozen 14-day skater opportunity frequency", () => {
  it("uses original current capture clocks after the frozen frame without observing omitted later games", () => {
    const input = frozenFixture(), before = structuredClone(input);
    const receipt = buildFrozenWindowSkaterParticipationReceipt(input, issuance);
    expect(receipt).toMatchObject({ probability: 2 / 3, numerator: 2, denominator: 3,
      methodVersion: "skater-frozen-window-appearance-frequency-v1", cutoffAt: cutoff,
      historyStartAt: input.history.windowStartAt, historyEndAt: input.history.windowEndAt,
      inputHash: playerForecastSourcePayloadHash(input), calibration: "unavailable" });
    expect(receipt.limitations.join(" ")).toContain("omitted later games are not observed negatives");
    expect(input).toEqual(before);
    expect(Date.parse(input.history.scheduleEvidence.capturedAt)).toBeGreaterThan(Date.parse(input.history.windowEndAt));
  });
  it("includes Oct12 New York games starting after UTC midnight and excludes the half-open end", () => {
    const input = frozenFixture();
    input.history.games[2].scheduledAt = "2026-10-13T00:00:00Z";
    expect(buildFrozenWindowSkaterParticipationReceipt(input, issuance).denominator).toBe(3);
    input.history.games[2].scheduledAt = "2026-10-13T04:00:00Z";
    expect(() => buildFrozenWindowSkaterParticipationReceipt(input, issuance)).toThrow("history opportunity");
  });
  it.each([0, 1])("retains endpoint %s as an uncalibrated model estimate", probability => {
    const input = frozenFixture();
    input.history.games.forEach(game => { game.positiveMinutes = !!probability; game.resolution = probability ? "positive_toi" : "explicit_zero_toi"; });
    const result = buildFrozenWindowSkaterParticipationReceipt(input, issuance);
    expect(result.probability).toBe(probability);
    expect(result.limitations.join(" ")).toContain("never confirmation");
  });
  it.each(["frame", "target", "target ineligible", "historical eligibility", "dated interval", "occurrence", "label", "stale target"])("withholds %s without inventing negatives", kind => {
    const input = frozenFixture();
    if (kind === "frame") input.history.complete = false;
    if (kind === "target") input.targetEligibility = null;
    if (kind === "target ineligible") input.targetEligibility!.eligible = false;
    if (kind === "historical eligibility") input.history.games[1].eligibility = null;
    if (kind === "dated interval") input.history.games[1].eligibility!.effectiveFrom = "2026-10-07T00:00:00Z";
    if (kind === "occurrence") input.history.games[1].occurred = null;
    if (kind === "label") input.history.games[1].outcomeEvidence = null;
    if (kind === "stale target") input.targetEligibility!.evidence = { ...input.rosterEvidence, id: "stale-target", capturedAt: "2026-10-13T04:00:00Z" };
    expect(buildFrozenWindowSkaterParticipationReceipt(input, issuance).probability).toBeNull();
  });
  it.each(["protected game", "wrong start", "wrong end", "stale frame", "future source", "wrong identity"])("rejects %s", kind => {
    const input = frozenFixture();
    if (kind === "protected game") input.history.games[1].scheduledAt = "2026-10-13T04:00:00Z";
    if (kind === "wrong start") input.history.windowStartAt = "2026-09-30T00:00:00Z";
    if (kind === "wrong end") input.history.windowEndAt = "2026-10-14T00:00:00Z";
    if (kind === "stale frame") input.cutoffAt = "2026-10-28T00:00:00Z";
    if (kind === "future source") input.targetEligibility!.evidence = { ...input.rosterEvidence, availableAt: issuance.issuedAt };
    if (kind === "wrong identity") input.history.games[0].eligibility!.nhlPlayerId++;
    expect(() => buildFrozenWindowSkaterParticipationReceipt(input, issuance)).toThrow();
  });
  it("uses a separate default-denied store and reproduces exact frozen payloads", async () => {
    const input = frozenFixture();
    const payload: FrozenWindowSkaterParticipationBundle = { version: FROZEN_WINDOW_SKATER_PARTICIPATION_DATASET,
      seasonId: input.scope.seasonId, ...issuance, released: true,
      allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
      ownerApprovalRef: "synthetic-owner", reviewRef: "synthetic-review", entries: [{ input, receipt: buildFrozenWindowSkaterParticipationReceipt(input, issuance) }] };
    const id = "11111111-1111-4111-8111-111111111111", row = { id, provider: "fhfh", dataset_key: payload.version,
      entity_kind: "participation_bundle", entity_key: String(payload.seasonId), available_at: issuance.issuedAt,
      payload_hash: playerForecastSourcePayloadHash(payload), payload };
    const chain: any = new Proxy({}, { get: (_, key) => key === "then" ? Promise.resolve({ data: [row], error: null }).then.bind(Promise.resolve({ data: [row], error: null })) : () => chain });
    const db = { from: vi.fn(() => chain) };
    expect((await loadFrozenWindowSkaterParticipation(db as never, payload.seasonId, new Date(issuance.issuedAt),
      { environment: { PLAYER_FORECAST_PARTICIPATION_RELEASES: `${id}:${row.payload_hash}` } })).sources).toEqual([]);
    expect(db.from).not.toHaveBeenCalled();
    const options = { environment: { PLAYER_FORECAST_FROZEN_WINDOW_SKATER_PARTICIPATION_RELEASES: `${id}:${row.payload_hash}` } };
    expect((await loadFrozenWindowSkaterParticipation(db as never, payload.seasonId, new Date(issuance.issuedAt), options)).sources[0])
      .toMatchObject({ basis: "appearance", probability: 2 / 3, model: { version: "skater-frozen-window-appearance-frequency-v1" } });
    row.payload.entries[0].receipt.probability = 0;
    expect((await loadFrozenWindowSkaterParticipation(db as never, payload.seasonId, new Date(issuance.issuedAt), options)).sources).toEqual([]);
  });
});
