// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { buildGoalieParticipationReceipt, type GoalieParticipationInput, buildFrozenWindowGoalieParticipationReceipt, type FrozenWindowGoalieParticipationInput, buildFrozenWindowGoalieStartReceipt, type FrozenWindowGoalieStartInput, goalieParticipationFromReceipt, buildRosterObservationGoalieParticipationReceipt, buildRosterObservationGoalieStartReceipt,
  type RosterObservationGoalieParticipationInput, type RosterObservationGoalieStartInput } from "./modeledGoalieParticipation";
import { loadModeledGoalieParticipation, GOALIE_PARTICIPATION_DATASET, type GoalieParticipationBundle, loadFrozenWindowGoalieParticipation, FROZEN_WINDOW_GOALIE_PARTICIPATION_DATASET, type FrozenWindowGoalieParticipationBundle, loadFrozenWindowGoalieStarts, FROZEN_WINDOW_GOALIE_START_DATASET, type FrozenWindowGoalieStartBundle, loadRosterObservationGoalieParticipation, loadRosterObservationGoalieStarts,
  ROSTER_OBSERVATION_GOALIE_PARTICIPATION_DATASET, ROSTER_OBSERVATION_GOALIE_START_DATASET,
  type RosterObservationGoalieParticipationBundle, type RosterObservationGoalieStartBundle } from "./modeledGoalieParticipationStore";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";

import { ROSTER_CONTINUATION_ASSUMPTION } from "./targetRosterObservation";

const id = "11111111-1111-4111-8111-111111111111", now = new Date("2026-10-15T12:00:00Z");
function fixture() {
  const evidence = { id: "synthetic-only", hash: "a".repeat(64), availableAt: "2026-10-15T09:00:00Z", capturedAt: "2026-10-15T09:00:00Z" };
  function eligibility() { return { playerId: 7, nhlPlayerId: 77, teamId: 1, eligible: true,
    effectiveFrom: "2026-10-01T00:00:00Z", effectiveUntil: "2026-10-16T00:00:00Z", evidence }; }
  const input: GoalieParticipationInput = { version: "goalie-participation-input-v1", playerClass: "goalie", targetEligibility: eligibility(), cutoffAt: "2026-10-15T10:00:00Z",
    scope: { playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 1, gameId: 30,
      scheduledAt: "2026-10-15T23:00:00Z", scheduleRevision: "schedule-a", rosterRevision: "roster-a" },
    scheduleEvidence: evidence, rosterEvidence: evidence,
    history: { complete: true, windowStartAt: "2026-08-16T10:00:00.000Z", scheduleEvidence: evidence,
      games: [true, false].map((positiveMinutes, i) => ({ gameId: 10 + i, teamId: 1,
        scheduledAt: `2026-10-${13 + i}T00:00:00Z`, occurred: true, eligibility: eligibility(), positiveMinutes,
        resolution: positiveMinutes ? "positive_toi" : "complete_official_nonappearance",
        outcomeEvidence: evidence })) } };
  const clocks = { issuedAt: "2026-10-15T11:00:00Z", expiresAt: "2026-10-15T18:00:00Z" };
  const payload: GoalieParticipationBundle = { version: GOALIE_PARTICIPATION_DATASET, seasonId: 20262027, ...clocks,
    released: true, allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
    ownerApprovalRef: "synthetic-owner-ref", reviewRef: "synthetic-review-ref",
    entries: [{ input, receipt: buildGoalieParticipationReceipt(input, clocks) }] };
  return { id, provider: "fhfh", dataset_key: GOALIE_PARTICIPATION_DATASET, entity_kind: "participation_bundle",
    entity_key: "20262027", available_at: clocks.issuedAt, payload_hash: playerForecastSourcePayloadHash(payload), payload };
}
function db(rows: unknown[], error: unknown = null) {
  const chain: any = new Proxy({}, { get: (_, key) => key === "then"
    ? Promise.resolve({ data: rows, error }).then.bind(Promise.resolve({ data: rows, error })) : () => chain });
  return { from: vi.fn(() => chain) };
}
const environment = (row: ReturnType<typeof fixture>) => ({ PLAYER_FORECAST_GOALIE_PARTICIPATION_RELEASES: `${row.id}:${row.payload_hash}` });

describe("goalie appearance release admission", () => {
  it("rejects rehashed pregame-outcome packets during replay, preserving valid equivalent-offset evidence", async () => {
    const row = fixture(), entry = row.payload.entries[0];
    entry.input.history.games[1].outcomeEvidence = { ...entry.input.history.games[1].outcomeEvidence!, id: "synthetic-before-start",
      availableAt: "2026-10-13T23:59:59.999999Z", capturedAt: "2026-10-13T23:59:59.999999Z" };
    entry.receipt.inputHash = playerForecastSourcePayloadHash(entry.input);
    row.payload_hash = playerForecastSourcePayloadHash(row.payload);
    expect((await loadModeledGoalieParticipation(db([row]) as never, 20262027, now, { environment: environment(row) })).sources).toEqual([]);
    entry.input.history.games[1].outcomeEvidence = { ...entry.input.history.games[1].outcomeEvidence!,
      availableAt: "2026-10-13T20:00:00-04:00", capturedAt: "2026-10-14T00:00:00Z" };
    entry.receipt = buildGoalieParticipationReceipt(entry.input, { issuedAt: row.payload.issuedAt, expiresAt: row.payload.expiresAt });
    row.payload_hash = playerForecastSourcePayloadHash(row.payload);
    expect((await loadModeledGoalieParticipation(db([row]) as never, 20262027, now, { environment: environment(row) })).sources[0].probability).toBe(0.5);
  });
  it("is disabled without an explicit ID+hash release and makes no read", async () => {
    const database = db([]);
    expect((await loadModeledGoalieParticipation(database as never, 20262027, now, { environment: {} })).sources).toEqual([]);
    expect(database.from).not.toHaveBeenCalled();
    await loadModeledGoalieParticipation(database as never, 20262027, now, { environment: { PLAYER_FORECAST_GOALIE_PARTICIPATION_RELEASES: id } });
    expect(database.from).not.toHaveBeenCalled();
  });
  it("reproduces the exact receipt, preserves original clocks and emits only sanitized model context", async () => {
    const row = fixture(), database = db([row]);
    const result = await loadModeledGoalieParticipation(database as never, 20262027, now, { environment: environment(row) });
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
    const result = await loadModeledGoalieParticipation(db([row]) as never, 20262027, now, { environment: env });
    expect(result.sources).toEqual([]);
  });
  it("fails closed on duplicate player-game releases, missing rows, query errors and altered row clocks", async () => {
    const row = fixture(); row.payload.entries.push(structuredClone(row.payload.entries[0])); row.payload_hash = playerForecastSourcePayloadHash(row.payload);
    expect((await loadModeledGoalieParticipation(db([row]) as never, 20262027, now, { environment: environment(row) })).limitations)
      .toContain("conflicting_participation_release");
    for (const database of [db([]), db([fixture()], { message: "private" })]) {
      expect((await loadModeledGoalieParticipation(database as never, 20262027, now, { environment: environment(fixture()) })).sources).toEqual([]);
    }
    const wrongClock = fixture(); wrongClock.available_at = "2026-10-15T11:01:00Z";
    expect((await loadModeledGoalieParticipation(db([wrongClock]) as never, 20262027, now, { environment: environment(wrongClock) })).sources).toEqual([]);
  });
});

// The source fixtures are synthetic; these checks establish arithmetic and gates only.
describe("goalie positive-minute opportunity frequency", () => {
  it("counts relief positive minutes alongside starters and explicit nonappearances", () => {
    const { input, receipt } = fixture().payload.entries[0];
    expect(receipt).toMatchObject({ probability: 0.5, numerator: 1, denominator: 2,
      methodVersion: "goalie-appearance-frequency-v1", event: "positive_minutes", calibration: "unavailable" });
    // No start label is accepted or needed by this appearance event.
    expect(input.history.games[0].resolution).toBe("positive_toi");
    expect(receipt.limitations.join(" ")).toContain("relief");
  });
  it("models a future game from current eligibility without extending the observed interval", () => {
    const row = fixture(), { input } = row.payload.entries[0];
    input.targetEligibility!.effectiveUntil = "2026-10-15T10:00:01Z";
    const before = structuredClone(input.targetEligibility);
    expect(buildGoalieParticipationReceipt(input, row.payload).probability).toBe(0.5);
    expect(input.targetEligibility).toEqual(before);
    input.targetEligibility!.eligible = false;
    expect(buildGoalieParticipationReceipt(input, row.payload).probability).toBeNull();
    input.targetEligibility!.eligible = null;
    expect(buildGoalieParticipationReceipt(input, row.payload).probability).toBeNull();
  });
  it.each(["frame", "target", "unknown", "uncovered", "stale", "label"])("keeps %s unknown", kind => {
    const row = fixture(), { input } = row.payload.entries[0];
    if (kind === "frame") input.history.complete = false;
    if (kind === "target") input.targetEligibility = null;
    if (kind === "unknown") input.history.games[1].eligibility!.eligible = null;
    if (kind === "uncovered") input.history.games[1].eligibility!.effectiveUntil = "2026-10-14T00:00:00Z";
    if (kind === "stale") input.targetEligibility!.evidence = { ...input.targetEligibility!.evidence, capturedAt: "2026-10-01T00:00:00Z" };
    if (kind === "label") input.history.games[1].positiveMinutes = null;
    expect(buildGoalieParticipationReceipt(input, row.payload).probability).toBeNull();
  });
  it.each(["player", "nhl", "team", "dates"])("rejects wrong eligibility %s", kind => {
    const row = fixture(), { input } = row.payload.entries[0], eligibility = input.history.games[0].eligibility!;
    if (kind === "player") eligibility.playerId++;
    if (kind === "nhl") eligibility.nhlPlayerId++;
    if (kind === "team") eligibility.teamId++;
    if (kind === "dates") eligibility.effectiveUntil = eligibility.effectiveFrom;
    expect(() => buildGoalieParticipationReceipt(input, row.payload)).toThrow("eligibility identity or dates");
  });
});


function frozenGoalieFixture(): FrozenWindowGoalieParticipationInput {
  const input = fixture().payload.entries[0].input;
  return { ...input, version: "goalie-frozen-window-participation-input-v1",
    history: { ...input.history, windowStartAt: "2026-09-29T04:00:00Z", windowEndAt: "2026-10-13T04:00:00Z",
      games: input.history.games.map((game, index) => ({ ...game, scheduledAt: `2026-10-${10 + index}T00:00:00Z` })) } };
}
describe("frozen goalie appearance frequency", () => {
  it("counts relief and explicit nonappearance over eligible opportunities without inferring starts", () => {
    const input = frozenGoalieFixture(), clocks = fixture().payload;
    const receipt = buildFrozenWindowGoalieParticipationReceipt(input, clocks);
    expect(receipt).toMatchObject({ probability: 0.5, numerator: 1, denominator: 2,
      methodVersion: "goalie-frozen-window-appearance-frequency-v1", inputHash: playerForecastSourcePayloadHash(input) });
    expect(receipt.limitations.join(" ")).toContain("eligible nonstarter remains an opportunity");
    input.history.games[1].positiveMinutes = null; input.history.games[1].resolution = null;
    expect(buildFrozenWindowGoalieParticipationReceipt(input, clocks).probability).toBeNull();
  });
  it("preserves missing eligibility and current ineligibility as unknown, never injury-driven zero", () => {
    const input = frozenGoalieFixture(), clocks = fixture().payload;
    input.targetEligibility!.eligible = false;
    expect(buildFrozenWindowGoalieParticipationReceipt(input, clocks).probability).toBeNull();
    input.targetEligibility!.eligible = true;
    input.history.games[0].eligibility = null;
    expect(buildFrozenWindowGoalieParticipationReceipt(input, clocks).probability).toBeNull();
  });
  it("separately admits exact frozen releases and rejects wrong-role or changed receipts", async () => {
    const input = frozenGoalieFixture(), old = fixture(), clocks = { issuedAt: old.payload.issuedAt, expiresAt: old.payload.expiresAt };
    const payload: FrozenWindowGoalieParticipationBundle = { ...old.payload, version: FROZEN_WINDOW_GOALIE_PARTICIPATION_DATASET,
      entries: [{ input, receipt: buildFrozenWindowGoalieParticipationReceipt(input, clocks) }] };
    const row = { ...old, dataset_key: payload.version, payload, payload_hash: playerForecastSourcePayloadHash(payload) };
    const database = db([row]);
    expect((await loadFrozenWindowGoalieParticipation(database as never, 20262027, now, { environment: environment(old) })).sources).toEqual([]);
    expect(database.from).not.toHaveBeenCalled();
    const options = { environment: { PLAYER_FORECAST_FROZEN_WINDOW_GOALIE_PARTICIPATION_RELEASES: `${row.id}:${row.payload_hash}` } };
    expect((await loadFrozenWindowGoalieParticipation(database as never, 20262027, now, options)).sources[0])
      .toMatchObject({ probability: 0.5, basis: "appearance", model: { version: "goalie-frozen-window-appearance-frequency-v1" } });
    expect(() => buildFrozenWindowGoalieParticipationReceipt({ ...input, playerClass: "skater" } as never, clocks)).toThrow();
    row.payload.entries[0].receipt.denominator = 3;
    row.payload_hash = playerForecastSourcePayloadHash(row.payload);
    expect((await loadFrozenWindowGoalieParticipation(db([row]) as never, 20262027, now,
      { environment: { PLAYER_FORECAST_FROZEN_WINDOW_GOALIE_PARTICIPATION_RELEASES: `${row.id}:${row.payload_hash}` } })).sources).toEqual([]);
  });
});


function frozenStartFixture(): FrozenWindowGoalieStartInput {
  const input = frozenGoalieFixture();
  return { ...input, version: "goalie-frozen-window-start-input-v1", history: { ...input.history,
    games: input.history.games.map((game, index) => ({ ...game, officialStarter: index === 0,
      starterEvidence: { ...game.outcomeEvidence!, id: `explicit-starter-${game.gameId}`, hash: String(index + 1).repeat(64) } })) } };
}
describe("separate frozen official starter frequency", () => {
  it("uses explicit starter labels without converting a relief appearance into zero TOI", () => {
    const input = frozenStartFixture(), clocks = fixture().payload;
    input.history.games[1].positiveMinutes = true; input.history.games[1].resolution = "positive_toi";
    const before = structuredClone(input), receipt = buildFrozenWindowGoalieStartReceipt(input, clocks);
    expect(receipt).toMatchObject({ probability: 0.5, numerator: 1, denominator: 2, event: "official_starter",
      methodVersion: "goalie-frozen-window-start-frequency-v1", inputHash: playerForecastSourcePayloadHash(input) });
    expect(buildFrozenWindowGoalieParticipationReceipt({ ...input, version: "goalie-frozen-window-participation-input-v1" }, clocks).probability).toBe(1);
    const uses = { assignment: true, totals: true, comparison: true, conditionalTieBreak: false };
    expect(goalieParticipationFromReceipt(receipt, uses)).toMatchObject({ basis: "start", model: { event: "official_starter" } });
    expect(input).toEqual(before);
  });
  it.each([0, 1])("labels endpoint %s as an uncalibrated estimate", value => {
    const input = frozenStartFixture(); input.history.games.forEach(game => { game.officialStarter = !!value; });
    const receipt = buildFrozenWindowGoalieStartReceipt(input, fixture().payload);
    expect(receipt.probability).toBe(value);
    expect(receipt.limitations.join(" ")).toContain("not confirmed starts");
  });
  it.each(["starter flag", "starter evidence", "appearance label", "target ineligible", "frame"])("withholds %s without shrinking the denominator", kind => {
    const input = frozenStartFixture();
    if (kind === "starter flag") input.history.games[1].officialStarter = null;
    if (kind === "starter evidence") input.history.games[1].starterEvidence = null;
    if (kind === "appearance label") input.history.games[1].positiveMinutes = null;
    if (kind === "target ineligible") input.targetEligibility!.eligible = false;
    if (kind === "frame") input.history.complete = false;
    expect(buildFrozenWindowGoalieStartReceipt(input, fixture().payload)).toMatchObject({ probability: null, denominator: 2 });
  });
  it.each(["future", "pregame", "conflicting identity"])("rejects %s starter evidence", kind => {
    const input = frozenStartFixture(), evidence = input.history.games[1].starterEvidence!;
    if (kind === "future") evidence.availableAt = "2026-10-15T10:00:00.000001Z";
    if (kind === "pregame") evidence.capturedAt = "2026-10-10T23:59:59.999999Z";
    if (kind === "conflicting identity") evidence.id = input.rosterEvidence.id;
    expect(() => buildFrozenWindowGoalieStartReceipt(input, fixture().payload)).toThrow();
  });
  it("requires a separate exact start allowlist and preserves event-specific uses and original expiry", async () => {
    const old = fixture(), input = frozenStartFixture();
    const payload: FrozenWindowGoalieStartBundle = { ...old.payload, version: FROZEN_WINDOW_GOALIE_START_DATASET,
      entries: [{ input, receipt: buildFrozenWindowGoalieStartReceipt(input, old.payload) }] };
    const row = { ...old, dataset_key: payload.version, payload, payload_hash: playerForecastSourcePayloadHash(payload) };
    const database = db([row]);
    expect((await loadFrozenWindowGoalieStarts(database as never, 20262027, now,
      { environment: { PLAYER_FORECAST_FROZEN_WINDOW_GOALIE_PARTICIPATION_RELEASES: `${row.id}:${row.payload_hash}` } })).sources).toEqual([]);
    expect(database.from).not.toHaveBeenCalled();
    const options = { environment: { PLAYER_FORECAST_FROZEN_WINDOW_GOALIE_START_RELEASES: `${row.id}:${row.payload_hash}` } };
    expect((await loadFrozenWindowGoalieStarts(database as never, 20262027, now, options)).sources[0])
      .toMatchObject({ probability: 0.5, basis: "start", expiresAt: row.payload.expiresAt, model: { event: "official_starter" } });
    row.payload.entries[0].receipt.numerator = 2;
    row.payload_hash = playerForecastSourcePayloadHash(row.payload);
    expect((await loadFrozenWindowGoalieStarts(db([row]) as never, 20262027, now,
      { environment: { PLAYER_FORECAST_FROZEN_WINDOW_GOALIE_START_RELEASES: `${row.id}:${row.payload_hash}` } })).sources).toEqual([]);
  });
});


function goalieObservationFixture(): RosterObservationGoalieStartInput {
  const { targetEligibility: _target, ...input } = frozenStartFixture();
  return { ...input, version: "goalie-roster-observation-start-input-v1", targetRosterObservation: {
    playerId: 7, nhlPlayerId: 77, teamId: 1, seasonId: 20262027, listed: true,
    sourceKind: "official_season_roster", knownConflict: null, continuationAssumptionVersion: ROSTER_CONTINUATION_ASSUMPTION,
    evidence: { id: "synthetic-official-roster", hash: "c".repeat(64), availableAt: "2026-10-15T09:00:00Z", capturedAt: "2026-10-15T09:00:00Z" } } };
}
describe("goalie roster-observation continuation methods", () => {
  it("keeps appearance and starter events separate under the new explicit target proxy", () => {
    const input = goalieObservationFixture(), clocks = { issuedAt: "2026-10-15T11:00:00Z", expiresAt: "2026-10-15T18:00:00Z" };
    input.history.games[1].positiveMinutes = true; input.history.games[1].resolution = "positive_toi";
    const appearance: RosterObservationGoalieParticipationInput = { ...input, version: "goalie-roster-observation-participation-input-v1" };
    expect(buildRosterObservationGoalieParticipationReceipt(appearance, clocks)).toMatchObject({ probability: 1, event: "positive_minutes",
      methodVersion: "goalie-roster-observation-appearance-frequency-v1" });
    expect(buildRosterObservationGoalieStartReceipt(input, clocks)).toMatchObject({ probability: 0.5, event: "official_starter",
      methodVersion: "goalie-roster-observation-start-frequency-v1" });
    input.targetRosterObservation!.knownConflict = true;
    expect(buildRosterObservationGoalieParticipationReceipt({ ...input, version: appearance.version }, clocks).probability).toBeNull();
    expect(buildRosterObservationGoalieStartReceipt(input, clocks).probability).toBeNull();
  });
  it("does not fill missing historical eligibility from a fresh current roster", () => {
    const input = goalieObservationFixture(); input.history.games[0].eligibility = null;
    expect(buildRosterObservationGoalieStartReceipt(input, fixture().payload).probability).toBeNull();
    expect(buildRosterObservationGoalieParticipationReceipt({ ...input, version: "goalie-roster-observation-participation-input-v1" }, fixture().payload).probability).toBeNull();
  });
  it.each(["appearance", "start"] as const)("uses a separate exact-hash %s release and does not inherit frozen approval", async mode => {
    const old = fixture(), input = goalieObservationFixture(), clocks = { issuedAt: old.payload.issuedAt, expiresAt: old.payload.expiresAt };
    const appearance: RosterObservationGoalieParticipationInput = { ...input, version: "goalie-roster-observation-participation-input-v1" };
    const payload: RosterObservationGoalieStartBundle | RosterObservationGoalieParticipationBundle = mode === "start"
      ? { ...old.payload, version: ROSTER_OBSERVATION_GOALIE_START_DATASET, entries: [{ input, receipt: buildRosterObservationGoalieStartReceipt(input, clocks) }] }
      : { ...old.payload, version: ROSTER_OBSERVATION_GOALIE_PARTICIPATION_DATASET, entries: [{ input: appearance, receipt: buildRosterObservationGoalieParticipationReceipt(appearance, clocks) }] };
    const row = { ...old, dataset_key: payload.version, payload, payload_hash: playerForecastSourcePayloadHash(payload) };
    const load = mode === "start" ? loadRosterObservationGoalieStarts : loadRosterObservationGoalieParticipation;
    const database = db([row]);
    expect((await load(database as never, 20262027, now, { environment: { PLAYER_FORECAST_FROZEN_WINDOW_GOALIE_START_RELEASES: `${row.id}:${row.payload_hash}` } })).sources).toEqual([]);
    expect(database.from).not.toHaveBeenCalled();
    const key = mode === "start" ? "PLAYER_FORECAST_ROSTER_OBSERVATION_GOALIE_START_RELEASES" : "PLAYER_FORECAST_ROSTER_OBSERVATION_GOALIE_PARTICIPATION_RELEASES";
    expect((await load(database as never, 20262027, now, { environment: { [key]: `${row.id}:${row.payload_hash}` } })).sources[0])
      .toMatchObject({ probability: 0.5, basis: mode === "start" ? "start" : "appearance" });
  });
});
