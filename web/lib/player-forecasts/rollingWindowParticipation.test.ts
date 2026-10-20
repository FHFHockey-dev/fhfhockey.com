// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { buildRosterObservationSkaterParticipationReceipt, type RosterObservationSkaterParticipationInput } from "./modeledSkaterParticipation";
import { buildRosterObservationGoalieParticipationReceipt, buildRosterObservationGoalieStartReceipt,
  type RosterObservationGoalieStartInput } from "./modeledGoalieParticipation";
import { buildRollingWindowGoalieParticipationReceipt, buildRollingWindowGoalieStartReceipt, buildRollingWindowSkaterParticipationReceipt,
  rollingParticipationWindow, type RollingWindowGoalieStartInput, type RollingWindowSkaterParticipationInput } from "./rollingWindowParticipation";
import { ROSTER_CONTINUATION_ASSUMPTION } from "./targetRosterObservation";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { loadRollingWindowSkaterParticipation, ROLLING_WINDOW_SKATER_PARTICIPATION_DATASET } from "./modeledSkaterParticipationStore";
import { loadRollingWindowGoalieParticipation, loadRollingWindowGoalieStarts, ROLLING_WINDOW_GOALIE_PARTICIPATION_DATASET,
  ROLLING_WINDOW_GOALIE_START_DATASET } from "./modeledGoalieParticipationStore";

const HOUR = 3600000;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const at = (base: string, hours: number) => new Date(Date.parse(base) + hours * HOUR).toISOString();
const evidence = (id: string, clock: string) => ({ id, hash: digest(id), availableAt: clock, capturedAt: clock });
const clocks = (cutoffAt: string) => ({ issuedAt: at(cutoffAt, 1), expiresAt: at(cutoffAt, 7) });
type Game = RollingWindowGoalieStartInput["history"]["games"][number];

/** Direct synthetic input: listed game-instant eligibility, explicit TOI labels and starter flags. */
function input(cutoffAt = "2026-10-13T11:00:00Z", starts = ["2026-09-29T23:00:00Z", "2026-10-03T23:00:00Z", "2026-10-08T23:00:00Z"],
  labels: Array<{ toi: number; starter: boolean }> = [{ toi: 1, starter: true }, { toi: 0, starter: false }, { toi: 1, starter: false }]): RollingWindowGoalieStartInput {
  const window = rollingParticipationWindow(cutoffAt), fresh = at(cutoffAt, -1);
  const roster = evidence("synthetic-official-roster", fresh);
  const games: Game[] = starts.map((scheduledAt, index) => {
    const box = evidence(`synthetic-boxscore-${index}`, at(scheduledAt, 4));
    return { gameId: 100 + index, teamId: 1, scheduledAt, occurred: true,
      eligibility: { playerId: 7, nhlPlayerId: 77, teamId: 1, eligible: true, effectiveFrom: scheduledAt,
        effectiveUntil: new Date(Date.parse(scheduledAt) + 1).toISOString(), evidence: box },
      positiveMinutes: labels[index].toi > 0, resolution: labels[index].toi > 0 ? "positive_toi" : "explicit_zero_toi",
      outcomeEvidence: box, officialStarter: labels[index].starter, starterEvidence: box };
  });
  return { version: "goalie-rolling-14d-start-input-v1", playerClass: "goalie", cutoffAt,
    scope: { playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 1, gameId: 999, scheduledAt: at(cutoffAt, 48),
      scheduleRevision: "schedule-a", rosterRevision: "roster-a" },
    scheduleEvidence: evidence("synthetic-future-schedule", fresh), rosterEvidence: roster,
    targetRosterObservation: { playerId: 7, nhlPlayerId: 77, teamId: 1, seasonId: 20262027, listed: true, sourceKind: "official_season_roster",
      knownConflict: null, continuationAssumptionVersion: ROSTER_CONTINUATION_ASSUMPTION, evidence: roster },
    history: { complete: true, windowStartAt: window.startAt, windowEndAt: window.endAt,
      scheduleEvidence: evidence("synthetic-history-manifest", fresh), games } };
}
function skater(value: RollingWindowGoalieStartInput): RollingWindowSkaterParticipationInput {
  return { ...value, version: "skater-rolling-14d-participation-input-v1", playerClass: "skater",
    history: { ...value.history, games: value.history.games.map(({ officialStarter: _s, starterEvidence: _e, ...game }) => game) } };
}
const outcome = (receipt: { probability: number | null; reasons: string[]; numerator: number; denominator: number;
  selectedGameIds: number[]; evidenceHashes: string[]; event: string }) => ({ probability: receipt.probability, reasons: receipt.reasons,
  numerator: receipt.numerator, denominator: receipt.denominator, selectedGameIds: receipt.selectedGameIds,
  evidenceHashes: receipt.evidenceHashes, event: receipt.event });

describe("rolling 14-day America/New_York participation window", () => {
  it.each([
    ["2026-10-13T11:00:00Z", "2026-09-29T04:00:00.000Z", "2026-10-13T04:00:00.000Z", 336],
    ["2026-10-13T04:00:00Z", "2026-09-29T04:00:00.000Z", "2026-10-13T04:00:00.000Z", 336],
    ["2026-10-13T03:59:59.999999Z", "2026-09-28T04:00:00.000Z", "2026-10-12T04:00:00.000Z", 336],
    ["2026-11-01T12:00:00Z", "2026-10-18T04:00:00.000Z", "2026-11-01T04:00:00.000Z", 336],
    ["2026-11-08T12:00:00Z", "2026-10-25T04:00:00.000Z", "2026-11-08T05:00:00.000Z", 337],
    ["2027-03-15T11:00:00Z", "2027-03-01T05:00:00.000Z", "2027-03-15T04:00:00.000Z", 335],
  ])("cutoff %s covers [%s, %s): %i hours of 14 local days", (cutoffAt, startAt, endAt, hours) => {
    const window = rollingParticipationWindow(cutoffAt);
    expect(window).toMatchObject({ startAt, endAt, timeZone: "America/New_York" });
    expect(window.dates).toHaveLength(14);
    expect((Date.parse(window.endAt) - Date.parse(window.startAt)) / HOUR).toBe(hours);
  });
  it("rejects an invalid cutoff", () => {
    expect(() => rollingParticipationWindow("2026-10-13")).toThrow("cutoff");
  });
});

describe("equivalence with the frozen-window roster-observation methods", () => {
  const mutations: Array<[string, (value: RollingWindowGoalieStartInput) => void]> = [
    ["baseline", () => undefined],
    ["missing target", value => { value.targetRosterObservation = null; }],
    ["not listed", value => { value.targetRosterObservation!.listed = false; }],
    ["unknown listing", value => { value.targetRosterObservation!.listed = null; }],
    ["known conflict", value => { value.targetRosterObservation!.knownConflict = true; }],
    ["stale target", value => { value.targetRosterObservation!.evidence = evidence("stale-roster", at(value.cutoffAt, -30)); }],
    ["stale scope", value => { value.history.scheduleEvidence = evidence("stale-manifest", at(value.cutoffAt, -25)); }],
    ["incomplete frame", value => { value.history.complete = false; }],
    ["historical unknown eligibility", value => { value.history.games[1].eligibility = null; }],
    ["unknown occurrence", value => { value.history.games[2].occurred = null; }],
    ["unresolved label", value => { value.history.games[0].resolution = null; }],
    ["unknown starter", value => { value.history.games[0].officialStarter = null; }],
    ["no history", value => { value.history.games = []; }],
    ["all zero", value => value.history.games.forEach(game => { game.positiveMinutes = false; game.resolution = "explicit_zero_toi"; })],
  ];
  // Every New York time on Oct 13 has the frozen Sep29–Oct13 frame as its rolling window.
  describe.each(["2026-10-13T04:00:00Z", "2026-10-13T11:00:00Z", "2026-10-14T03:59:59.999999Z"])("cutoff %s", cutoffAt => {
    it.each(mutations)("skater %s: identical probability, reasons, selection and evidence", (_kind, mutate) => {
      const rolling = skater(input(cutoffAt)); mutate(rolling as unknown as RollingWindowGoalieStartInput);
      const frozen: RosterObservationSkaterParticipationInput = { ...rolling, version: "skater-roster-observation-participation-input-v1" };
      const expected = buildRosterObservationSkaterParticipationReceipt(frozen, clocks(cutoffAt));
      const actual = buildRollingWindowSkaterParticipationReceipt(rolling, clocks(cutoffAt));
      expect(outcome(actual)).toEqual(outcome(expected));
      expect(actual).toMatchObject({ methodVersion: "skater-rolling-14d-appearance-frequency-v1", historyStartAt: expected.historyStartAt,
        historyEndAt: expected.historyEndAt, continuationAssumptionVersion: ROSTER_CONTINUATION_ASSUMPTION,
        inputHash: playerForecastSourcePayloadHash(rolling) });
    });
    it.each(mutations)("goalie %s: identical appearance and start outcomes", (_kind, mutate) => {
      const start = input(cutoffAt); mutate(start);
      const frozenStart: RosterObservationGoalieStartInput = { ...start, version: "goalie-roster-observation-start-input-v1" };
      expect(outcome(buildRollingWindowGoalieParticipationReceipt({ ...start, version: "goalie-rolling-14d-participation-input-v1" }, clocks(cutoffAt))))
        .toEqual(outcome(buildRosterObservationGoalieParticipationReceipt({ ...start, version: "goalie-roster-observation-participation-input-v1" }, clocks(cutoffAt))));
      expect(outcome(buildRollingWindowGoalieStartReceipt(start, clocks(cutoffAt))))
        .toEqual(outcome(buildRosterObservationGoalieStartReceipt(frozenStart, clocks(cutoffAt))));
    });
  });
  it("leaves existing method versions unchanged and states the rolling window honestly", () => {
    const value = input();
    const frozen = buildRosterObservationGoalieStartReceipt({ ...value, version: "goalie-roster-observation-start-input-v1" }, clocks(value.cutoffAt));
    const rolling = buildRollingWindowGoalieStartReceipt(value, clocks(value.cutoffAt));
    expect(frozen.methodVersion).toBe("goalie-roster-observation-start-frequency-v1");
    expect(rolling.methodVersion).toBe("goalie-rolling-14d-start-frequency-v1");
    expect(frozen.limitations.join(" ")).toContain("frozen Sep29–Oct12");
    expect(rolling.limitations.join(" ")).not.toContain("Sep29");
    expect(rolling.limitations.join(" ")).toContain("14 America/New_York calendar days before the cutoff's local date");
  });
});

describe("rolling window boundaries", () => {
  it("rejects the frozen frame once the cutoff's own window has moved", () => {
    const value = skater(input("2026-10-13T11:00:00Z"));
    value.cutoffAt = "2026-10-15T11:00:00Z"; value.scope.scheduledAt = at(value.cutoffAt, 48);
    expect(() => buildRollingWindowSkaterParticipationReceipt(value, clocks(value.cutoffAt))).toThrow("rolling 14-day participation window");
  });
  it("includes the first local instant and excludes the half-open end", () => {
    const value = skater(input("2026-10-13T11:00:00Z", ["2026-09-29T04:00:00.000Z", "2026-10-03T23:00:00Z", "2026-10-12T23:00:00Z"]));
    expect(buildRollingWindowSkaterParticipationReceipt(value, clocks(value.cutoffAt)).denominator).toBe(3);
    value.history.games[2].scheduledAt = "2026-10-13T04:00:00.000Z";
    expect(() => buildRollingWindowSkaterParticipationReceipt(value, clocks(value.cutoffAt))).toThrow("history opportunity");
    value.history.games[2].scheduledAt = "2026-09-29T03:59:59.999999Z";
    expect(() => buildRollingWindowSkaterParticipationReceipt(value, clocks(value.cutoffAt))).toThrow("history opportunity");
  });
  it("keeps the extra fall-back hour inside the window", () => {
    const cutoffAt = "2026-11-08T12:00:00Z";
    const value = skater(input(cutoffAt, ["2026-10-25T04:00:00Z", "2026-11-01T23:00:00Z", "2026-11-08T04:30:00Z"]));
    expect(buildRollingWindowSkaterParticipationReceipt(value, clocks(cutoffAt))).toMatchObject({ denominator: 3, probability: 2 / 3,
      historyStartAt: "2026-10-25T04:00:00.000Z", historyEndAt: "2026-11-08T05:00:00.000Z" });
    value.history.games[2].scheduledAt = "2026-11-08T05:00:00Z";
    value.history.games[2].eligibility!.effectiveFrom = "2026-11-08T05:00:00Z";
    value.history.games[2].eligibility!.effectiveUntil = "2026-11-08T05:00:00.001Z";
    expect(() => buildRollingWindowSkaterParticipationReceipt(value, clocks(cutoffAt))).toThrow("history opportunity");
  });
  it("drops the spring-forward hour from the window start", () => {
    const cutoffAt = "2027-03-15T11:00:00Z";
    const value = skater(input(cutoffAt, ["2027-03-01T05:00:00Z", "2027-03-07T23:00:00Z", "2027-03-14T22:00:00Z"]));
    expect(buildRollingWindowSkaterParticipationReceipt(value, clocks(cutoffAt)).denominator).toBe(3);
    value.history.games[0].scheduledAt = "2027-03-01T04:30:00Z";
    expect(() => buildRollingWindowSkaterParticipationReceipt(value, clocks(cutoffAt))).toThrow("history opportunity");
  });
  it.each(["version", "class"])("rejects a wrong %s", kind => {
    const value: any = skater(input());
    if (kind === "version") value.version = "skater-roster-observation-participation-input-v1";
    if (kind === "class") value.playerClass = "goalie";
    expect(() => buildRollingWindowSkaterParticipationReceipt(value, clocks(value.cutoffAt))).toThrow("rolling-window skater");
  });
  it.each(["identity", "interval"])("rejects historical eligibility with a wrong %s", kind => {
    const value = skater(input()), row = value.history.games[0].eligibility!;
    if (kind === "identity") row.nhlPlayerId++;
    if (kind === "interval") row.effectiveUntil = row.effectiveFrom;
    expect(() => buildRollingWindowSkaterParticipationReceipt(value, clocks(value.cutoffAt))).toThrow("eligibility identity or interval");
  });
  it("rejects a target observation whose evidence identity conflicts with frame evidence", () => {
    const value = skater(input());
    value.targetRosterObservation!.evidence = { ...value.targetRosterObservation!.evidence, id: value.history.games[0].outcomeEvidence!.id };
    expect(() => buildRollingWindowSkaterParticipationReceipt(value, clocks(value.cutoffAt))).toThrow("Conflicting participation evidence identity");
  });
});

describe("rolling staleness and unknowns", () => {
  it.each([
    ["stale_scope_evidence", (value: RollingWindowSkaterParticipationInput) => { value.history.scheduleEvidence = evidence("old-manifest", at(value.cutoffAt, -25)); }],
    ["stale_target_roster_observation", (value: RollingWindowSkaterParticipationInput) => {
      value.targetRosterObservation!.evidence = evidence("old-roster", at(value.cutoffAt, -25)); }],
    ["unknown_eligibility_or_occurrence", (value: RollingWindowSkaterParticipationInput) => { value.history.games[1].eligibility = null; }],
    ["incomplete_opportunity_frame", (value: RollingWindowSkaterParticipationInput) => { value.history.complete = false; }],
  ])("withholds with %s", (reason, mutate) => {
    const value = skater(input()); mutate(value);
    expect(buildRollingWindowSkaterParticipationReceipt(value, clocks(value.cutoffAt))).toMatchObject({ probability: null,
      reasons: expect.arrayContaining([reason]) });
  });
  it("withholds when the only eligible game is more than 14 days before a late-day cutoff", () => {
    const cutoffAt = "2026-10-27T23:30:00Z", value = skater(input(cutoffAt, ["2026-10-13T05:00:00Z"], [{ toi: 1, starter: true }]));
    expect(buildRollingWindowSkaterParticipationReceipt(value, clocks(cutoffAt))).toMatchObject({ probability: null, denominator: 1,
      reasons: ["stale_eligible_history"] });
    const earlier = skater(input("2026-10-27T04:30:00Z", ["2026-10-13T05:00:00Z"], [{ toi: 1, starter: true }]));
    expect(buildRollingWindowSkaterParticipationReceipt(earlier, clocks(earlier.cutoffAt))).toMatchObject({ probability: 1, reasons: [] });
  });
  it("rejects future frame evidence", () => {
    const value = skater(input()); value.history.scheduleEvidence = evidence("future-manifest", at(value.cutoffAt, 0.5));
    expect(() => buildRollingWindowSkaterParticipationReceipt(value, clocks(value.cutoffAt))).toThrow("future participation evidence");
  });
});

describe("rolling goalie relief versus start", () => {
  it("counts relief as an appearance and a nonstart, and zero-minute backup as neither", () => {
    const value = input();
    const appearance = buildRollingWindowGoalieParticipationReceipt({ ...value, version: "goalie-rolling-14d-participation-input-v1" }, clocks(value.cutoffAt));
    const start = buildRollingWindowGoalieStartReceipt(value, clocks(value.cutoffAt));
    expect(appearance).toMatchObject({ probability: 2 / 3, numerator: 2, denominator: 3, event: "positive_minutes",
      methodVersion: "goalie-rolling-14d-appearance-frequency-v1" });
    expect(start).toMatchObject({ probability: 1 / 3, numerator: 1, denominator: 3, event: "official_starter",
      selectedGameIds: appearance.selectedGameIds, methodVersion: "goalie-rolling-14d-start-frequency-v1" });
    expect(appearance.limitations.join(" ")).toContain("include relief");
    expect(start.limitations.join(" ")).toContain("relief appearance");
  });
  it("withholds only the start event when a starter flag is unknown", () => {
    const value = input(); value.history.games[2].officialStarter = null;
    expect(buildRollingWindowGoalieParticipationReceipt({ ...value, version: "goalie-rolling-14d-participation-input-v1" }, clocks(value.cutoffAt)).probability).toBe(2 / 3);
    expect(buildRollingWindowGoalieStartReceipt(value, clocks(value.cutoffAt))).toMatchObject({ probability: null, denominator: 3,
      reasons: ["unresolved_official_starter_label"] });
  });
  it.each(["pregame", "future", "conflicting identity"])("rejects %s starter evidence", kind => {
    const value = input(), game = value.history.games[1];
    if (kind === "pregame") game.starterEvidence = evidence("pregame-starter", at(game.scheduledAt, -1));
    if (kind === "future") game.starterEvidence = evidence("future-starter", at(value.cutoffAt, 0.5));
    if (kind === "conflicting identity") game.starterEvidence = { ...game.starterEvidence!, hash: digest("other") };
    expect(() => buildRollingWindowGoalieStartReceipt(value, clocks(value.cutoffAt))).toThrow();
  });
  it("rejects a skater-class input for the goalie methods", () => {
    const value: any = { ...input(), playerClass: "skater" };
    expect(() => buildRollingWindowGoalieStartReceipt(value, clocks(value.cutoffAt))).toThrow("rolling-window goalie start");
    expect(() => buildRollingWindowGoalieParticipationReceipt({ ...value, version: "goalie-rolling-14d-participation-input-v1" },
      clocks(value.cutoffAt))).toThrow("rolling-window goalie participation");
  });
});

describe("rolling-window release stores", () => {
  const cases = [
    { kind: "skater", dataset: ROLLING_WINDOW_SKATER_PARTICIPATION_DATASET, env: "PLAYER_FORECAST_ROLLING_14D_SKATER_PARTICIPATION_RELEASES",
      legacy: "PLAYER_FORECAST_ROSTER_OBSERVATION_SKATER_PARTICIPATION_RELEASES", load: loadRollingWindowSkaterParticipation,
      entry: () => { const value = skater(input()); return { input: value, receipt: buildRollingWindowSkaterParticipationReceipt(value, clocks(value.cutoffAt)) }; },
      basis: "appearance", version: "skater-rolling-14d-appearance-frequency-v1", probability: 2 / 3 },
    { kind: "goalie", dataset: ROLLING_WINDOW_GOALIE_PARTICIPATION_DATASET, env: "PLAYER_FORECAST_ROLLING_14D_GOALIE_PARTICIPATION_RELEASES",
      legacy: "PLAYER_FORECAST_ROSTER_OBSERVATION_GOALIE_PARTICIPATION_RELEASES", load: loadRollingWindowGoalieParticipation,
      entry: () => { const value = { ...input(), version: "goalie-rolling-14d-participation-input-v1" as const };
        return { input: value, receipt: buildRollingWindowGoalieParticipationReceipt(value, clocks(value.cutoffAt)) }; },
      basis: "appearance", version: "goalie-rolling-14d-appearance-frequency-v1", probability: 2 / 3 },
    { kind: "start", dataset: ROLLING_WINDOW_GOALIE_START_DATASET, env: "PLAYER_FORECAST_ROLLING_14D_GOALIE_START_RELEASES",
      legacy: "PLAYER_FORECAST_ROSTER_OBSERVATION_GOALIE_START_RELEASES", load: loadRollingWindowGoalieStarts,
      entry: () => { const value = input(); return { input: value, receipt: buildRollingWindowGoalieStartReceipt(value, clocks(value.cutoffAt)) }; },
      basis: "start", version: "goalie-rolling-14d-start-frequency-v1", probability: 1 / 3 },
  ] as const;
  it.each(cases)("admits only exact $kind bundles under their own allowlist", async ({ dataset, env, legacy, load, entry, basis, version, probability }) => {
    const issuance = clocks(input().cutoffAt), payload = { version: dataset, seasonId: 20262027, ...issuance, released: true,
      ownerApprovalRef: "synthetic-owner", reviewRef: "synthetic-review", entries: [entry()],
      allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false } };
    const id = "11111111-1111-4111-8111-111111111111", row = { id, provider: "fhfh", dataset_key: dataset, entity_kind: "participation_bundle",
      entity_key: "20262027", available_at: issuance.issuedAt, payload_hash: playerForecastSourcePayloadHash(payload), payload };
    const reply = Promise.resolve({ data: [row], error: null });
    const chain: any = new Proxy({}, { get: (_, key) => key === "then" ? reply.then.bind(reply) : () => chain });
    const db = { from: vi.fn(() => chain) }, at = new Date(issuance.issuedAt);
    expect((await load(db as never, 20262027, at, { environment: { [legacy]: `${id}:${row.payload_hash}` } })).sources).toEqual([]);
    expect(db.from).not.toHaveBeenCalled();
    expect((await load(db as never, 20262027, at, { environment: { [env]: `${id}:${row.payload_hash}` } })).sources[0])
      .toMatchObject({ basis, probability, model: { version } });
    (row.payload.entries[0].receipt as { numerator: number }).numerator = 3;
    row.payload_hash = playerForecastSourcePayloadHash(row.payload);
    expect((await load(db as never, 20262027, at, { environment: { [env]: `${id}:${row.payload_hash}` } })).sources).toEqual([]);
  });
});
