import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGoalieCatchupManifest, GOALIE_DATASETS, type GoalieCatchupManifest, type GoalieCompletionReceipt, type GoalieWorkUnit } from "./goalieCatchup";
import { ensureGoalieCatchupCohort, runGoalieCatchupStep, type GoalieCheckpointClient, type GoalieSourceResult } from "./goalieCatchup.server";
import { NstExecutionLimitError, type NstRequestControl } from "./requestBudget";

const CLAIM = "00000000-0000-4000-8000-000000000001";
const JOB = "00000000-0000-4000-8000-000000000002";
const RECEIPT = "00000000-0000-4000-8000-000000000003";
const FINGERPRINT = "b".repeat(64);
const NOW = Date.parse("2026-11-01T11:10:00Z");

function manifest(now = NOW, receipts: GoalieCompletionReceipt[] = []) {
  return buildGoalieCatchupManifest({ season: "20262027", sourceVersion: "fixture-v1", seasonStartDate: "2026-10-27",
    regularSeasonEndDate: "2027-04-15", startDate: "2026-10-27", now: new Date(now),
    days: ["2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"].map(date => ({ date, calendar: "final", allCounts: "complete" })),
    receipts, holds: [], readsComplete: true });
}
function completion(unit: GoalieWorkUnit): GoalieCompletionReceipt {
  return { season: "20262027", sourceVersion: "fixture-v1", date: unit.date, dataset: unit.dataset,
    status: "complete", parsedRows: 1, mappedRows: 1, writtenRows: 1, outputAcknowledged: true, checkpointAcknowledged: true };
}
function source(unit: GoalieWorkUnit, control: NstRequestControl): Promise<GoalieSourceResult> {
  control.attemptsStarted++;
  return Promise.resolve({ parsedRows: 1, mappedRows: 1, validatedEmpty: false, sourceFingerprint: FINGERPRINT,
    rows: [{ player_id: 1, player_name: "Fixture Goalie", team: "TOR", date_scraped: unit.date, season: 20262027,
      gp: 1, toi: 60, shots_against: 20, saves: 19, goals_against: 1, xg_against: 1.1, hd_shots_against: 4, hd_saves: 3,
      toi_per_gp: 60, shots_against_per_60: 20, saves_per_60: 19, gaa: 1, xg_against_per_60: 1.1,
      hd_shots_against_per_60: 4, hd_saves_per_60: 3 }] });
}

/** Model of the required database transactions, not SQL execution evidence. */
function fixture(initial = manifest()) {
  const state = { manifest: structuredClone(initial), budget: { utcDate: "2026-11-01", steps: 0, attempts: 0 },
    sharedJobActive: false, reviewRequired: false, lastDirectJobFinishedAt: null as string | null };
  let reservation = 0;
  let active = false;
  let claimedKeys: string[] = [];
  let committedKeys: string[] = [];
  const queued = new Set<string>();
  const output = new Map<string, readonly Record<string, unknown>[]>();
  const receipts: GoalieCompletionReceipt[] = [];
  const faults = { loseClaimAck: false, loseCommitAck: false, loseFinishAck: false, loseHoldAck: false, malformedClaim: false, malformedCommit: false };
  const rpc = vi.fn(async (name: string, args: Record<string, any>) => {
    if (name === "nst_goalie_ensure_cohort_v1") {
      queued.add(args.p_manifest.scope);
      return { data: { status: "ensured", scope: args.p_manifest.scope, plannedRequestCount: args.p_manifest.plannedRequestCount,
        jobId: args.p_manifest.units.some((unit: GoalieWorkUnit) => unit.state === "pending") ? JOB : null }, error: null };
    }
    if (name === "nst_goalie_read_state_v1") return { data: structuredClone({ ...state, sharedJobActive: active || state.sharedJobActive }), error: null };
    if (name === "nst_goalie_claim_step_v1") {
      if (active || state.budget.steps >= 7 || state.budget.attempts + args.p_max_attempts > 60) return { data: { status: "deferred", scope: args.p_scope }, error: null };
      active = true; reservation = args.p_max_attempts; claimedKeys = [...args.p_unit_keys]; committedKeys = [];
      state.budget.steps++; state.budget.attempts += reservation;
      if (faults.loseClaimAck) throw new Error("lost claim acknowledgement");
      return { data: { status: "claimed", scope: args.p_scope, claimId: CLAIM, utcDate: state.budget.utcDate,
        deadlineAt: args.p_deadline_at, unitKeys: claimedKeys, plannedRequestCount: state.manifest.plannedRequestCount,
        attemptsReserved: faults.malformedClaim ? reservation + 1 : reservation }, error: null };
    }
    if (name === "nst_goalie_commit_unit_v1") {
      if (!active || !claimedKeys.includes(args.p_unit_key)) throw new Error("no active unit claim");
      const unit = state.manifest.units.find(unit => unit.key === args.p_unit_key)!;
      // One atomic model transition: output and receipt become visible together.
      output.set(unit.key, args.p_rows);
      const status = args.p_rows.length ? "complete" : "empty_valid";
      const receipt = { ...completion(unit), status, parsedRows: args.p_rows.length, mappedRows: args.p_rows.length, writtenRows: args.p_rows.length } as GoalieCompletionReceipt;
      receipts.push(receipt); committedKeys.push(unit.key);
      state.manifest = { ...state.manifest, units: state.manifest.units.map(value => value.key === unit.key ? { ...value, state: status } : value) } as GoalieCatchupManifest;
      if (faults.loseCommitAck) throw new Error("lost output/checkpoint acknowledgement");
      return { data: { status: "committed", scope: args.p_scope, claimId: CLAIM, unitKey: args.p_unit_key, receiptId: RECEIPT,
        sourceFingerprint: args.p_source_fingerprint, completionStatus: status, parsedRows: args.p_rows.length,
        mappedRows: args.p_rows.length, writtenRows: faults.malformedCommit ? -1 : args.p_rows.length, allCountsCoverage: "complete" }, error: null };
    }
    if (name === "nst_goalie_hold_step_v1") {
      if (faults.loseHoldAck) throw new Error("lost hold acknowledgement");
      state.reviewRequired = true;
      state.manifest = { ...state.manifest, units: state.manifest.units.map(unit => claimedKeys.includes(unit.key) && unit.state === "pending"
        ? { ...unit, state: "held", reason: args.p_reason } : unit) };
      return { data: { status: "held", scope: args.p_scope, claimId: CLAIM }, error: null };
    }
    if (name === "nst_goalie_finish_step_v1") {
      if (faults.loseFinishAck) throw new Error("lost settlement acknowledgement");
      expect(args.p_committed_unit_keys).toEqual(committedKeys);
      const unused = 0;
      state.budget.attempts -= unused; active = false;
      return { data: { status: "finished", scope: args.p_scope, claimId: CLAIM, attemptsUsed: args.p_attempts_used,
        attemptsCharged: reservation, unusedReleased: unused, committedUnitKeys: [...committedKeys] }, error: null };
    }
    throw new Error(`Unexpected fixture RPC ${name}`);
  });
  return { client: { rpc } as GoalieCheckpointClient, rpc, state, faults, queued, output, receipts };
}
function execute(f: ReturnType<typeof fixture>, overrides: Partial<Parameters<typeof runGoalieCatchupStep>[0]> = {}) {
  return runGoalieCatchupStep({ client: f.client, scope: f.state.manifest.scope, source, now: () => NOW, deadlineAt: NOW + 220_000, ...overrides });
}

afterEach(() => vi.useRealTimers());
describe("goalie checkpoint adapter", () => {
  it("requests cohort creation and idempotent enqueue in one transaction", async () => {
    const f = fixture();
    const input = { client: f.client, manifest: f.state.manifest, deadlineAt: NOW + 10_000, now: () => NOW };
    expect(await ensureGoalieCatchupCohort(input)).toEqual({ scope: input.manifest.scope, jobId: JOB });
    await ensureGoalieCatchupCohort(input);
    expect(f.queued.size).toBe(1);
    expect(f.rpc.mock.calls.every(([name]) => name === "nst_goalie_ensure_cohort_v1")).toBe(true);
  });
  it("does not dispatch without an acknowledged atomic claim, including racing workers", async () => {
    const f = fixture(); const fetch = vi.fn(source);
    const results = await Promise.all([execute(f, { source: fetch }), execute(f, { source: fetch })]);
    expect(results.map(value => value.status).sort()).toEqual(["deferred", "progress"]);
    expect(fetch).toHaveBeenCalledTimes(6);
    expect(f.state.budget).toMatchObject({ steps: 1, attempts: 18 });
  });
  it.each(["loseClaimAck", "malformedClaim"] as const)("holds %s without any source dispatch or blind retry", async fault => {
    const f = fixture(); f.faults[fault] = true; const fetch = vi.fn(source);
    expect(await execute(f, { source: fetch })).toMatchObject({ status: "held", requiresReview: true, holdAcknowledged: false });
    expect(await execute(f, { source: fetch })).toMatchObject({ status: "deferred" });
    expect(fetch).not.toHaveBeenCalled();
    expect(f.state.budget.attempts).toBe(18);
  });
  it.each(["loseCommitAck", "malformedCommit"] as const)("holds %s and never automatically writes that unit twice", async fault => {
    const f = fixture(); f.faults[fault] = true; const fetch = vi.fn(source);
    expect(await execute(f, { source: fetch })).toMatchObject({ status: "held", holdAcknowledged: true });
    expect(f.output.size).toBe(1);
    await execute(f, { source: fetch });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(f.state.budget.attempts).toBe(18);
  });
  it("preserves uncertainty when even the hold acknowledgement is lost", async () => {
    const f = fixture(); f.faults.loseCommitAck = true; f.faults.loseHoldAck = true;
    expect(await execute(f)).toMatchObject({ status: "held", requiresReview: true, holdAcknowledged: false });
    expect(f.state.budget.attempts).toBe(18);
  });
  it("commits a validated empty situation receipt durably without inventing output rows", async () => {
    const first = manifest(); const done = first.units.filter(unit => unit.dataset !== "ppCounts" || unit.date !== "2026-10-27").map(completion);
    const f = fixture(manifest(NOW, done));
    const empty = vi.fn(async (_unit: GoalieWorkUnit, control: NstRequestControl) => {
      control.attemptsStarted++; return { rows: [], parsedRows: 0, mappedRows: 0, validatedEmpty: true, sourceFingerprint: FINGERPRINT };
    });
    expect(await execute(f, { source: empty })).toMatchObject({ status: "complete", attemptsUsed: 1 });
    expect(f.receipts[0]).toMatchObject({ status: "empty_valid", writtenRows: 0 });
    expect(await execute(f, { source: empty })).toMatchObject({ status: "complete", attemptsUsed: 0 });
    expect(empty).toHaveBeenCalledTimes(1);
  });
  it.each(["identity", "fields", "unvalidated empty", "budget mutation"])("holds invalid %s evidence before an output transaction", async kind => {
    const f = fixture();
    const bad = async (unit: GoalieWorkUnit, control: NstRequestControl) => {
      const data = await source(unit, control);
      if (kind === "identity") data.rows[0].player_id = null;
      if (kind === "fields") data.rows[0].hd_shots_against = null;
      if (kind === "unvalidated empty") { data.rows = []; data.parsedRows = 0; data.mappedRows = 0; }
      if (kind === "budget mutation") control.maxAttempts++;
      return data;
    };
    expect(await execute(f, { source: bad })).toMatchObject({ status: "held" });
    expect(f.output.size).toBe(0);
    expect(f.rpc.mock.calls.some(([name]) => name === "nst_goalie_commit_unit_v1")).toBe(false);
  });
  it("settles a proven pre-dispatch deferral without completing the unit", async () => {
    const f = fixture();
    const result = await execute(f, { source: async () => { throw new NstExecutionLimitError("shared admission unavailable"); } });
    expect(result).toMatchObject({ status: "deferred", attemptsUsed: 0, committedUnitKeys: [], requiresReview: false });
    expect(f.state.budget).toMatchObject({ steps: 1, attempts: 18 });
    expect(f.state.manifest.units.every(unit => unit.state === "pending")).toBe(true);
  });
  it("does not claim completion or refund attempts after uncertain settlement", async () => {
    const first = manifest(); const done = first.units.slice(1).map(completion);
    const f = fixture(manifest(NOW, done)); f.faults.loseFinishAck = true;
    expect(await execute(f)).toMatchObject({ status: "held", requiresReview: true });
    expect(f.state.budget.attempts).toBe(3);
    const fetch = vi.fn(source);
    expect(await execute(f, { source: fetch })).toMatchObject({ status: "held" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects an allCounts checkpoint that does not acknowledge expected appearance coverage", async () => {
    const first = manifest(); const done = first.units.filter(unit => unit.dataset !== "allCounts" || unit.date !== "2026-10-27").map(completion);
    const f = fixture(manifest(NOW, done)); const original = f.rpc.getMockImplementation()!;
    f.rpc.mockImplementation(async (name, args) => {
      const reply: any = await original(name, args);
      if (name === "nst_goalie_commit_unit_v1") reply.data.allCountsCoverage = "unknown";
      return reply;
    });
    expect(await execute(f)).toMatchObject({ status: "held", requiresReview: true, committedUnitKeys: [] });
  });
  it("keeps a prior-day global hold across a new cohort and reset daily budget", async () => {
    const f = fixture(); f.faults.loseCommitAck = true;
    await execute(f);
    const tomorrow = NOW + 86_400_000;
    f.state.manifest = manifest(tomorrow, f.receipts);
    f.state.budget = { utcDate: "2026-11-02", steps: 0, attempts: 0 };
    const fetch = vi.fn(source);
    expect(await execute(f, { source: fetch, now: () => tomorrow, deadlineAt: tomorrow + 220_000 })).toMatchObject({ status: "held", requiresReview: true });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("bounds a hanging provider and retains the entire uncertain reservation", async () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    const f = fixture();
    const pending = execute(f, { now: Date.now, source: async (_unit, control) => { control.attemptsStarted++; return new Promise(() => {}); } });
    await vi.runAllTimersAsync();
    expect(await pending).toMatchObject({ status: "held", holdAcknowledged: true });
    expect(Date.now() - NOW).toBe(200_000);
    expect(f.state.budget.attempts).toBe(18);
  });
  it("bounds a hanging state read and starts no claim/provider call", async () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    const f = fixture(); f.rpc.mockImplementation(async () => new Promise(() => {})); const fetch = vi.fn(source);
    const pending = execute(f, { now: Date.now, source: fetch }); await vi.runAllTimersAsync();
    expect(await pending).toMatchObject({ status: "deferred", attemptsUsed: 0 });
    expect(Date.now() - NOW).toBe(5_000); expect(fetch).not.toHaveBeenCalled(); expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it("retains the original large cohort pacing after progress and enforces the conservative daily reservation cap", async () => {
    const f = fixture(); const fetch = vi.fn(source);
    for (let i = 0; i < 4; i++) expect((await execute(f, { source: fetch })).status).toBe("progress");
    expect(await execute(f, { source: fetch })).toMatchObject({ status: "deferred" });
    expect(f.state.budget).toMatchObject({ steps: 4, attempts: 60 });
    expect(fetch).toHaveBeenCalledTimes(24);
    expect(fetch.mock.calls.every(([, control]) => control.plannedRequestCount === 50 && control.minIntervalMs === 21000)).toBe(true);
  });
  it("makes bounded progress on 37 backlog plus 10 new/day without unverified refunds", async () => {
    const seed = manifest(); const old = seed.units.slice(0, 3).map(completion);
    const f = fixture(manifest(NOW, old)); // 47 pending = 37 backlog + 10 new.
    for (let i = 0; i < 4; i++) await execute(f);
    expect(f.state.manifest.units.filter(unit => unit.state === "pending")).toHaveLength(23);
    const tomorrow = NOW + 86_400_000;
    f.state.manifest = manifest(tomorrow, [...old, ...f.receipts]);
    f.state.budget = { utcDate: "2026-11-02", steps: 0, attempts: 0 };
    expect(f.state.manifest.units.filter(unit => unit.state === "pending")).toHaveLength(33);
    await execute(f, { now: () => tomorrow, deadlineAt: tomorrow + 220_000 });
    expect(f.state.manifest.units.filter(unit => unit.state === "pending")).toHaveLength(13);
    expect(f.state.budget.attempts).toBe(60);
    expect(await execute(f, { now: () => tomorrow, deadlineAt: tomorrow + 220_000 })).toMatchObject({ status: "deferred" });
  });
  it("rejects an incomplete ten-dataset manifest and a missing RPC before provider work", async () => {
    const f = fixture(); f.state.manifest.units = f.state.manifest.units.slice(1);
    const fetch = vi.fn(source);
    expect(await execute(f, { source: fetch })).toMatchObject({ status: "deferred" });
    f.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } } as any);
    expect(await execute(f, { source: fetch })).toMatchObject({ status: "deferred" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
