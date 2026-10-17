// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { buildSkaterParticipationReceipt, type SkaterParticipationInput } from "./modeledSkaterParticipation";
import { loadModeledSkaterParticipation, PARTICIPATION_DATASET, SKATER_PARTICIPATION_RELEASE_LIMITS, type SkaterParticipationBundle } from "./modeledSkaterParticipationStore";
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
function bundle(count: number, start = 0, unknown = false) {
  const row = fixture();
  row.id = `${String(start + 1).padStart(8, "0")}-1111-4111-8111-111111111111`;
  row.payload.entries = Array.from({ length: count }, (_, i) => {
    const input = structuredClone(fixture().payload.entries[0].input);
    input.scope.gameId = 30 + start + i;
    if (unknown) input.history.complete = false;
    return { input, receipt: buildSkaterParticipationReceipt(input, { issuedAt: row.payload.issuedAt, expiresAt: row.payload.expiresAt }) };
  });
  row.payload_hash = playerForecastSourcePayloadHash(row.payload);
  return row;
}
const combinedEnvironment = (rows: ReturnType<typeof fixture>[]) => ({ PLAYER_FORECAST_PARTICIPATION_RELEASES:
  rows.map(row => `${row.id}:${row.payload_hash}`).join(",") });

describe("modeled participation release admission", () => {
  it("admits distinct combined bundles above500 entries while retaining unknown receipts in admission", async () => {
    const rows = [bundle(340), bundle(260, 340)], database = db(rows);
    const result = await loadModeledSkaterParticipation(database as never, 20262027, now, { environment: combinedEnvironment(rows) });
    expect(result.sources).toHaveLength(600);
    expect(result.checksum).not.toBeNull();
    expect(database.from).toHaveBeenCalledTimes(1);
    const unknown = bundle(100, 600, true), withUnknown = [...rows, unknown];
    const admitted = await loadModeledSkaterParticipation(db(withUnknown) as never, 20262027, now, { environment: combinedEnvironment(withUnknown) });
    expect(admitted.sources).toHaveLength(600);
    expect(admitted.checksum).not.toBe(result.checksum);
  });
  it("retains bundle entry limits and counts unknown entries against the aggregate limit", async () => {
    for (const rows of [[bundle(501)], [bundle(500, 0, true), bundle(500, 500, true), bundle(500, 1000, true), bundle(1, 1500, true)]]) {
      const result = await loadModeledSkaterParticipation(db(rows) as never, 20262027, now, { environment: combinedEnvironment(rows) });
      expect(result.sources).toEqual([]); expect(result.checksum).toBeNull();
      expect(result.limitations).toContain("invalid_participation_release");
    }
  });
  it("preserves the per-bundle byte cap and bounds aggregate bytes independently", async () => {
    const admittedRows = [bundle(1), bundle(1, 1)];
    for (const row of admittedRows) {
      row.payload.ownerApprovalRef = "x".repeat(5 * 1024 * 1024);
      row.payload_hash = playerForecastSourcePayloadHash(row.payload);
    }
    expect((await loadModeledSkaterParticipation(db(admittedRows) as never, 20262027, now,
      { environment: combinedEnvironment(admittedRows) })).sources).toHaveLength(2);
    for (const rows of [[bundle(1)], [bundle(1), bundle(1, 1), bundle(1, 2), bundle(1, 3)]]) {
      for (const row of rows) {
        row.payload.ownerApprovalRef = "x".repeat(rows.length === 1 ? SKATER_PARTICIPATION_RELEASE_LIMITS.bundleBytes : 7 * 1024 * 1024);
        row.payload_hash = playerForecastSourcePayloadHash(row.payload);
      }
      const result = await loadModeledSkaterParticipation(db(rows) as never, 20262027, now, { environment: combinedEnvironment(rows) });
      expect(result.sources).toEqual([]); expect(result.checksum).toBeNull();
      expect(result.limitations).toContain("invalid_participation_release");
    }
  });
  it("still rejects cross-bundle duplicate identities and more than eight release pins", async () => {
    const rows = [bundle(340), bundle(260, 340)];
    rows[1].payload.entries[0] = structuredClone(rows[0].payload.entries[0]);
    rows[1].payload_hash = playerForecastSourcePayloadHash(rows[1].payload);
    expect((await loadModeledSkaterParticipation(db(rows) as never, 20262027, now, { environment: combinedEnvironment(rows) })).limitations)
      .toContain("conflicting_participation_release");
    const tooMany = Array.from({ length: 9 }, (_, i) => bundle(1, i)), database = db(tooMany);
    expect((await loadModeledSkaterParticipation(database as never, 20262027, now, { environment: combinedEnvironment(tooMany) })).limitations)
      .toContain("invalid_participation_release_allowlist");
    expect(database.from).not.toHaveBeenCalled();
  });
  it("rejects rehashed pregame-outcome packets during replay, preserving valid equivalent-offset evidence", async () => {
    const row = fixture(), entry = row.payload.entries[0];
    entry.input.history.games[1].outcomeEvidence = { ...entry.input.history.games[1].outcomeEvidence!, id: "synthetic-before-start",
      availableAt: "2026-10-13T23:59:59.999999Z", capturedAt: "2026-10-13T23:59:59.999999Z" };
    entry.receipt.inputHash = playerForecastSourcePayloadHash(entry.input);
    row.payload_hash = playerForecastSourcePayloadHash(row.payload);
    expect((await loadModeledSkaterParticipation(db([row]) as never, 20262027, now, { environment: environment(row) })).sources).toEqual([]);
    entry.input.history.games[1].outcomeEvidence = { ...entry.input.history.games[1].outcomeEvidence!,
      availableAt: "2026-10-13T20:00:00-04:00", capturedAt: "2026-10-14T00:00:00Z" };
    entry.receipt = buildSkaterParticipationReceipt(entry.input, { issuedAt: row.payload.issuedAt, expiresAt: row.payload.expiresAt });
    row.payload_hash = playerForecastSourcePayloadHash(row.payload);
    expect((await loadModeledSkaterParticipation(db([row]) as never, 20262027, now, { environment: environment(row) })).sources[0].probability).toBe(0.5);
  });
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
