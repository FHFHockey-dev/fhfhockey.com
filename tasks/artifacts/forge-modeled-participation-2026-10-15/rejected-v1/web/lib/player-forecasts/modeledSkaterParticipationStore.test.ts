// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { buildSkaterParticipationReceipt, type SkaterParticipationInput } from "./modeledSkaterParticipation";
import { loadModeledSkaterParticipation, PARTICIPATION_DATASET, type SkaterParticipationBundle } from "./modeledSkaterParticipationStore";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";

const id = "11111111-1111-4111-8111-111111111111", now = new Date("2026-10-15T12:00:00Z");
function fixture() {
  const evidence = { id: "synthetic-only", hash: "a".repeat(64), availableAt: "2026-10-15T09:00:00Z", capturedAt: "2026-10-15T09:00:00Z" };
  const input: SkaterParticipationInput = { version: "skater-participation-input-v1", cutoffAt: "2026-10-15T10:00:00Z",
    scope: { playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 1, gameId: 30,
      scheduledAt: "2026-10-15T23:00:00Z", scheduleRevision: "schedule-a", rosterRevision: "roster-a" },
    scheduleEvidence: evidence, rosterEvidence: evidence,
    history: { complete: true, windowStartAt: "2026-08-16T10:00:00.000Z", scheduleEvidence: evidence,
      games: [true, false].map((positiveMinutes, i) => ({ gameId: 10 + i, teamId: 1,
        scheduledAt: `2026-10-${13 + i}T00:00:00Z`, occurred: true, eligible: true, positiveMinutes,
        resolution: positiveMinutes ? "positive_toi" : "complete_official_nonappearance",
        eligibilityEvidence: evidence, outcomeEvidence: evidence })) } };
  const clocks = { issuedAt: "2026-10-15T11:00:00Z", expiresAt: "2026-10-15T18:00:00Z" };
  const payload: SkaterParticipationBundle = { version: PARTICIPATION_DATASET, seasonId: 20262027, ...clocks,
    released: true, allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
    ownerApprovalRef: "synthetic-owner-ref", reviewRef: "synthetic-review-ref",
    entries: [{ input, receipt: buildSkaterParticipationReceipt(input, clocks) }] };
  return { id, provider: "fhfh", dataset_key: PARTICIPATION_DATASET, entity_kind: "participation_bundle",
    entity_key: "20262027", available_at: clocks.issuedAt, payload_hash: playerForecastSourcePayloadHash(payload), payload };
}
function db(rows: unknown[], error: unknown = null) {
  const chain: any = new Proxy({}, { get: (_, key) => key === "then"
    ? Promise.resolve({ data: rows, error }).then.bind(Promise.resolve({ data: rows, error })) : () => chain });
  return { from: vi.fn(() => chain) };
}
const environment = (row: ReturnType<typeof fixture>) => ({ PLAYER_FORECAST_PARTICIPATION_RELEASES: `${row.id}:${row.payload_hash}` });

describe("modeled participation release admission", () => {
  it("is disabled without an explicit ID+hash release and makes no read", async () => {
    const database = db([]);
    expect((await loadModeledSkaterParticipation(database as never, 20262027, now, { environment: {} })).sources).toEqual([]);
    expect(database.from).not.toHaveBeenCalled();
    await loadModeledSkaterParticipation(database as never, 20262027, now, { environment: { PLAYER_FORECAST_PARTICIPATION_RELEASES: id } });
    expect(database.from).not.toHaveBeenCalled();
  });
  it("reproduces the exact receipt, preserves original clocks and emits only sanitized model context", async () => {
    const row = fixture(), database = db([row]);
    const result = await loadModeledSkaterParticipation(database as never, 20262027, now, { environment: environment(row) });
    expect(database.from).toHaveBeenCalledTimes(1);
    expect(result.sources[0]).toMatchObject({ probability: 0.5, issuedAt: row.payload.issuedAt,
      cutoffAt: row.payload.entries[0].input.cutoffAt,
      model: { numerator: 1, denominator: 2, calibration: "unavailable", probabilityStatus: "uncalibrated_model" } });
    expect(JSON.stringify(result.sources)).not.toContain("synthetic-owner-ref");
    expect(JSON.stringify(result.sources)).not.toContain("eligibilityEvidence");
  });
  it.each(["unreleased", "expired", "future", "scope", "receipt", "permission", "missing_review", "unknown_frame", "hash"])("withholds %s releases", async kind => {
    const row = fixture();
    if (kind === "unreleased") row.payload.released = false;
    if (kind === "expired") row.payload.expiresAt = now.toISOString();
    if (kind === "future") row.payload.issuedAt = "2026-10-15T13:00:00Z";
    if (kind === "scope") row.payload.entries[0].input.scope.teamId = 2;
    if (kind === "receipt") row.payload.entries[0].receipt.probability = 0.9;
    if (kind === "permission") row.payload.allowedUses = {} as never;
    if (kind === "missing_review") row.payload.reviewRef = "";
    if (kind === "unknown_frame") row.payload.entries[0].input.history.complete = false;
    row.payload_hash = playerForecastSourcePayloadHash(row.payload);
    const env = environment(row);
    if (kind === "hash") row.payload.entries[0].input.cutoffAt = "2026-10-15T09:59:00Z";
    const result = await loadModeledSkaterParticipation(db([row]) as never, 20262027, now, { environment: env });
    expect(result.sources).toEqual([]);
  });
  it("fails closed on duplicate player-game releases, missing rows, query errors and altered row clocks", async () => {
    const row = fixture(); row.payload.entries.push(structuredClone(row.payload.entries[0])); row.payload_hash = playerForecastSourcePayloadHash(row.payload);
    expect((await loadModeledSkaterParticipation(db([row]) as never, 20262027, now, { environment: environment(row) })).limitations)
      .toContain("conflicting_participation_release");
    for (const database of [db([]), db([fixture()], { message: "private" })]) {
      expect((await loadModeledSkaterParticipation(database as never, 20262027, now, { environment: environment(fixture()) })).sources).toEqual([]);
    }
    const wrongClock = fixture(); wrongClock.available_at = "2026-10-15T11:01:00Z";
    expect((await loadModeledSkaterParticipation(db([wrongClock]) as never, 20262027, now, { environment: environment(wrongClock) })).sources).toEqual([]);
  });
});
