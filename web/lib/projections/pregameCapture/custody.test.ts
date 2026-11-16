import { describe, expect, it } from "vitest";
import { minimumRequiredMs, runPregameCapture, type CaptureDeps, type Collected, type PinnedGame } from "./custody";
import { decodePacket, sha256Hex } from "./packet";
import { u8 } from "./der";
import { mintTimeStampResponse, parseTimeStampRequest, testTsaTrust } from "./__fixtures__/testTsa";
import { buildTimeStampRequest } from "./rfc3161";
import { reverifyStoredWitness } from "./verifier";
import { formatMicros, MICROS_PER_MS, parseInstantMicros } from "./time";
import { dbText, FakeClock as Clock, FakeCustodyDb } from "./__fixtures__/fakeCustody";

/**
 * Offline acceptance for the custody path. FakeDb mirrors the SQL semantics proven in
 * supabase/tests/forge_pregame_capture_custody.py: claim refusals and one claim per game/policy (closed games
 * stay closed); save-once with hash check; settle fence; authoritative read; lookup; witness binding with the
 * digest computed from the exact text; outcomes consistent with claim state.
 */

const GAME = 2026020400;
const SLATE = "2026-11-20";
// Puck drop 00:30Z on the next UTC day: the ET slate date and the UTC date differ (midnight rollover).
const START = "2026-11-21T00:30:00Z";
const START_MS = Date.parse(START);
const REV = "c".repeat(64);
const MIN = 60_000;
const POLICY = "pregame-native-v1";
const KEY = `${GAME}/${POLICY}`;

const pinned: PinnedGame = { gameId: GAME, slateDate: SLATE, homeTeamId: 6, awayTeamId: 30, homeAbbrev: "BOS", awayAbbrev: "MIN", scheduledStart: START, calendarRevision: REV };
const BUDGET = { readMs: 90_000, saveWaitMs: 15_000, tsaTimeoutMs: 10_000, skewToleranceMs: 2_000, rpcMs: 5_000 };

function setup(options: {
  startOffsetMs?: number; tsaSkewMs?: number; tsaAccuracyMs?: number | null; collect?: (clock: Clock) => Partial<Collected>;
  readMs?: number; tsaDown?: boolean; tsaWrongDigest?: boolean; requiredMs?: number;
  /** Runs just before the token is minted (genTime = clock then); then the response takes tsaLatencyMs to arrive. */
  tsaBeforeMint?: (clock: Clock) => void; tsaLatencyMs?: number;
} = {}) {
  const clock = new Clock(START_MS - 70 * MIN + (options.startOffsetMs ?? 0));
  const db = new FakeCustodyDb(clock, { gameId: GAME, scheduledStart: START, homeTeamId: 6, awayTeamId: 30, homeAbbrev: "BOS", awayAbbrev: "MIN" });
  const deps: CaptureDeps = {
    writer: db.rpc(), verifier: db.rpc(), trust: testTsaTrust(),
    tsa: {
      stamp: async (request) => {
        if (options.tsaDown) throw new Error("ECONNRESET");
        clock.advance(400);
        options.tsaBeforeMint?.(clock);
        const genTimeMs = clock.ms;
        if (options.tsaLatencyMs) clock.advance(options.tsaLatencyMs);
        // A wrong-digest TSA signs some other statement with the same nonce.
        const signed = options.tsaWrongDigest ? buildTimeStampRequest(Buffer.alloc(32, 0x11), parseTimeStampRequest(request).nonce ?? BigInt(0)) : request;
        return mintTimeStampResponse(signed, { genTimeMicros: BigInt(genTimeMs + (options.tsaSkewMs ?? 0)) * MICROS_PER_MS,
          accuracyMillis: options.tsaAccuracyMs === undefined ? 500 : options.tsaAccuracyMs });
      },
    },
    pin: async () => pinned,
    collect: async (binding) => {
      clock.advance(options.readMs ?? 20_000);
      const at = dbText(clock.ms - 5_000, 0, 456);
      return {
        reads: [
          { request: [{ method: "from", args: ["games"] }, { method: "eq", args: ["id", binding.gameId] }], result: { data: [{ id: binding.gameId }], error: null }, receivedAt: at },
          { request: [{ method: "from", args: ["goalie_start_projections"] }, { method: "eq", args: ["game_id", binding.gameId] }], result: { data: [], error: null }, receivedAt: dbText(clock.ms, 0, 0) },
        ],
        candidates: { skaters: [1, 2], goalies: [3], reserves: [] },
        transport: { calls: 2, httpCalls: 2, rows: 1, bytes: 512, stampToleranceMs: 5_000, refusals: [] },
        calendarRevision: REV, seasonBootstrapApplied: false,
        ...options.collect?.(clock),
      };
    },
    modelEnvironment: () => ({ FORGE_SKATER_MODEL_MODE: "v2" }),
    now: () => clock.ms,
    nonce: () => BigInt(0x5eed),
    budget: { ...BUDGET, requiredMs: options.requiredMs ?? minimumRequiredMs(BUDGET) },
  };
  return { clock, db, deps };
}

const request = { gameId: GAME, slateDate: SLATE, policyId: POLICY, codeVersion: "abcdef0123456789" };
const CAPTURE_RPCS = new Set(["claim", "save", "settle", "read", "lookup", "recordWitness", "recordOutcome"]);

describe("pregame capture custody (offline acceptance)", () => {
  it("qualifies one exact game: one save, committed readback, RFC 3161 witness at or before T−60", async () => {
    const { db, deps } = setup();
    const report = await runPregameCapture(deps, request);
    expect(report).toMatchObject({ outcome: "qualified", reason: null, outcomeRecorded: true, saveCalls: 1 });
    expect(db.calls.filter((c) => c === "save")).toHaveLength(1);
    expect(db.calls.every((c) => CAPTURE_RPCS.has(c))).toBe(true); // no forecast, revision or serving RPC exists here
    const artifact = db.artifacts.get(report.claimId!)!;
    const { packet } = decodePacket(u8(artifact.bytes));
    expect(packet.binding).toMatchObject({ gameId: GAME, slateDate: SLATE, calendarRevision: REV, claimId: report.claimId });
    // Inputs only: no writes, output hash, scores or forecasts are part of the packet.
    expect(Object.keys(packet).sort()).toEqual(["binding", "candidates", "modelEnvironment", "readWindow", "reads", "seasonBootstrapApplied", "statedCutoff", "transport", "version"]);
    expect(parseInstantMicros(packet.statedCutoff) - parseInstantMicros(packet.readWindow.end)).toBe(BigInt(5_000_000));
    expect(parseInstantMicros(report.verify!.ackUpper!)).toBeLessThanOrEqual(parseInstantMicros("2026-11-20T23:30:00Z"));
    expect(db.outcomes.get(KEY)?.outcome).toBe("qualified");
    // The retained receipt re-verifies offline from the stored statement and token alone.
    const row = (await db.rpc().read(report.claimId!))!;
    expect(reverifyStoredWitness(row, testTsaTrust())).toMatchObject({ withinDeadline: true });
    expect(() => reverifyStoredWitness({ ...row, witnessStatementText: row.witnessStatementText!.replace(REV, "d".repeat(64)) }, testTsaTrust())).toThrow();
  });

  it("treats equivalent offsets and sub-second precision as the same instants (no string ordering)", async () => {
    const { db, deps } = setup();
    db.offsetMinutes = 330; // +05:30 rendering of every database instant
    expect((await runPregameCapture(deps, request)).outcome).toBe("qualified");
  });

  it("records never_dispatched only for terminal late-start or insufficient-time refusals", async () => {
    const late = setup({ startOffsetMs: 11 * MIN });
    expect(await runPregameCapture(late.deps, request)).toMatchObject({ outcome: "never_dispatched", reason: "claim_refused:late_start", outcomeRecorded: true });
    const tight = setup({ startOffsetMs: 9 * MIN });
    expect(await runPregameCapture(tight.deps, request)).toMatchObject({ outcome: "never_dispatched", reason: "claim_refused:insufficient_time" });
    expect(tight.db.calls).not.toContain("save");
  });

  it("refuses to start with a time budget that cannot cover read + save + verify", async () => {
    const { db, deps } = setup({ requiredMs: 60_000 });
    const report = await runPregameCapture(deps, request);
    expect(report).toMatchObject({ outcome: null, outcomeRecorded: false });
    expect(report.reason).toMatch(/^budget_inconsistent/);
    expect(db.calls).toEqual([]);
  });

  it("refuses a duplicate claim without touching the first attempt's outcome; a closed game stays closed", async () => {
    const { db, deps } = setup();
    await runPregameCapture(deps, request);
    expect(await runPregameCapture(deps, request)).toMatchObject({ outcome: null, reason: "claim_refused:duplicate", saveCalls: 0 });
    expect(db.calls.filter((c) => c === "save")).toHaveLength(1);
    expect(db.outcomes.get(KEY)?.outcome).toBe("qualified");
  });

  it("leaves pre-claim failures retryable: nothing recorded for a wrong pin or a lost claim response", async () => {
    const wrong = setup();
    wrong.deps.pin = async () => ({ ...pinned, gameId: GAME + 1 });
    expect(await runPregameCapture(wrong.deps, request)).toMatchObject({ outcome: null, reason: "pin_failed:pin_wrong_game" });
    expect(wrong.db.outcomes.size).toBe(0);
    const lost = setup();
    lost.db.hooks.afterClaimCommit = () => { throw new Error("fetch failed: socket hang up"); };
    const report = await runPregameCapture(lost.deps, request);
    expect(report).toMatchObject({ outcome: null, reason: "claim_ambiguous_left_for_sweeper", saveCalls: 0 });
    expect(lost.db.calls.filter((c) => c === "claim")).toHaveLength(1); // never re-claimed
  });

  it("reconciles a save that timed out after commit by claim id, without retrying it", async () => {
    const { db, deps } = setup();
    db.hooks.afterSaveCommit = () => { db.clock.advance(16_000); throw new Error("fetch failed: socket hang up"); };
    const report = await runPregameCapture(deps, request);
    expect(report.saveCalls).toBe(1);
    expect(db.calls.filter((c) => c === "save")).toHaveLength(1);
    expect(db.calls).toContain("settle");
    expect(report.outcome).toBe("qualified");
  });

  it("records save_unknown and fences when an ambiguous save never committed", async () => {
    const { db, deps } = setup();
    db.hooks.beforeSave = () => { throw new Error("fetch failed: ETIMEDOUT"); };
    const report = await runPregameCapture(deps, request);
    expect(report).toMatchObject({ outcome: "save_unknown", saveCalls: 1 });
    expect(report.reason).toContain("save_unknown_fenced_absent");
    expect(db.fences.has(report.claimId!)).toBe(true);
    db.hooks.beforeSave = undefined;
    await expect(db.rpc().save(report.claimId!, Buffer.from("x").toString("base64"), sha256Hex(u8(Buffer.from("x"))), "0".repeat(64), new AbortController().signal)).rejects.toThrow("capture_save_fenced");
  });

  it("repeats the idempotent settle, and leaves the claim for the sweeper when settle never answers", async () => {
    const flaky = setup();
    let failures = 2;
    flaky.db.hooks.beforeSave = () => { throw new Error("fetch failed"); };
    flaky.db.hooks.settle = () => { if (failures-- > 0) throw new Error("lock timeout"); };
    expect((await runPregameCapture(flaky.deps, request)).outcome).toBe("save_unknown");
    expect(flaky.db.calls.filter((c) => c === "settle")).toHaveLength(3);
    const dead = setup();
    dead.db.hooks.beforeSave = () => { throw new Error("fetch failed"); };
    dead.db.hooks.settle = () => { throw new Error("lock timeout"); };
    const report = await runPregameCapture(dead.deps, request);
    expect(report.outcome).toBeNull();
    expect(report.reason).toContain("settle_failed_left_for_sweeper");
    expect(dead.db.calls.filter((c) => c === "save")).toHaveLength(1);
  });

  it("closes the claim consistently when something unexpected throws after the claim", async () => {
    const { db, deps } = setup();
    deps.modelEnvironment = () => { throw new Error("env exploded"); };
    const report = await runPregameCapture(deps, request);
    expect(report).toMatchObject({ outcome: "source_failed", saveCalls: 0, outcomeRecorded: true });
    expect(report.reason).toContain("unexpected:env exploded");
    expect(db.fences.has(report.claimId!)).toBe(true);
  });

  it("does not qualify a writer that starts before the cutoff but commits after it", async () => {
    const { db, deps } = setup({ startOffsetMs: 6 * MIN, readMs: 60_000, requiredMs: minimumRequiredMs(BUDGET) });
    db.hooks.afterSaveCommit = () => { db.clock.advance(3 * MIN); };
    const report = await runPregameCapture(deps, request);
    expect(report.outcome).toBe("saved_without_valid_witness");
    expect(report.reason).toContain("ack_after_deadline");
    expect(db.witnesses.get(report.claimId!)?.verdict).toBe("saved_without_valid_witness");
  });

  it("does not qualify after an earlier reschedule, a postponement, a missing start or once the game is no longer pregame", async () => {
    const earlier = setup();
    earlier.db.currentStartMs = START_MS - 30 * MIN;
    expect((await runPregameCapture(earlier.deps, request)).reason).toContain("ack_after_deadline");
    const live = setup();
    live.db.statuses = ["BOS:LIVE:OK", "MIN:LIVE:OK"];
    expect((await runPregameCapture(live.deps, request)).reason).toContain("game_not_pregame");
    const postponed = setup();
    postponed.db.statuses = ["BOS:FUT:PPD", "MIN:FUT:PPD"];
    expect((await runPregameCapture(postponed.deps, request)).reason).toContain("schedule_not_ok");
    const unknownStart = setup();
    unknownStart.db.currentStartMs = null;
    expect((await runPregameCapture(unknownStart.deps, request)).reason).toContain("current_start_missing");
  });

  it("fails stale or refused inputs as source_failed, fences the claim and saves nothing", async () => {
    const stale = setup({ collect: () => ({ calendarRevision: "d".repeat(64) }) });
    expect(await runPregameCapture(stale.deps, request)).toMatchObject({ outcome: "source_failed", reason: "calendar_changed_during_capture" });
    const refused = setup({ collect: () => ({ transport: { calls: 1, httpCalls: 1, rows: 0, bytes: 0, stampToleranceMs: 5_000, refusals: ["http_status:503"] } }) });
    expect(await runPregameCapture(refused.deps, request)).toMatchObject({ outcome: "source_failed", reason: "transport_refused:http_status:503" });
    const thrown = setup({ collect: () => { throw new Error("relation_not_allowed"); } });
    expect((await runPregameCapture(thrown.deps, request)).outcome).toBe("source_failed");
    for (const s of [stale, refused, thrown]) {
      expect(s.db.calls).not.toContain("save");
      expect(s.db.fences.size).toBe(1);
    }
  });

  it("detects hash, binding and version mismatches in the committed read", async () => {
    const tampered = setup();
    tampered.db.hooks.tamperRead = (row) => ({ ...row, packetBase64: Buffer.from("not the packet").toString("base64") });
    expect((await runPregameCapture(tampered.deps, request)).reason).toBe("raw_hash_mismatch");
    const versioned = setup();
    versioned.db.hooks.tamperRead = (row, n) => (n >= 2 ? { ...row, rowVersion: "9999" } : row);
    expect((await runPregameCapture(versioned.deps, request)).reason).toContain("version_changed_or_unreadable");
    const rebound = setup();
    rebound.db.hooks.tamperRead = (row) => ({ ...row, calendarRevision: "e".repeat(64) });
    expect((await runPregameCapture(rebound.deps, request)).reason).toBe("packet_binding_mismatch");
  });

  it("refuses a witness the TSA did not sign for these bytes, an unbounded or unavailable TSA, and clock disagreement", async () => {
    expect((await runPregameCapture(setup({ tsaWrongDigest: true }).deps, request)).reason).toBe("tsa_failed:tsa_imprint_mismatch");
    expect((await runPregameCapture(setup({ tsaAccuracyMs: null }).deps, request)).reason).toBe("tsa_failed:tsa_accuracy_missing");
    expect(await runPregameCapture(setup({ tsaDown: true }).deps, request)).toMatchObject({ outcome: "saved_without_valid_witness", reason: "tsa_failed:ECONNRESET" });
    expect((await runPregameCapture(setup({ tsaSkewMs: -30_000 }).deps, request)).reason).toContain("db_clock_disagrees_with_tsa");
  });

  it("does not qualify when the token bound is within T−60 but the final authoritative readback is after it", async () => {
    const deadlineMs = START_MS - 60 * MIN;
    // Token minted 2 s before T−60 (accuracy 0.5 s → bound 1.5 s before T−60); the reply arrives 10 s later, so the
    // verifier's final committed readback (database clock) lands 8.4 s after T−60.
    const { db, deps } = setup({ tsaBeforeMint: (clock) => { clock.ms = deadlineMs - 2_000; }, tsaLatencyMs: 10_000 });
    const report = await runPregameCapture(deps, request);
    expect(parseInstantMicros(report.verify!.ackUpper!)).toBeLessThanOrEqual(BigInt(deadlineMs) * MICROS_PER_MS);
    expect(report.outcome).toBe("saved_without_valid_witness");
    expect(report.reason).toContain("final_readback_after_deadline");
    expect(db.witnesses.get(report.claimId!)?.verdict).toBe("saved_without_valid_witness");
  });

  it("qualifies when both the token bound and the final readback are at or before T−60", async () => {
    const deadlineMs = START_MS - 60 * MIN;
    const { deps } = setup({ tsaBeforeMint: (clock) => { clock.ms = deadlineMs - 20_000; }, tsaLatencyMs: 5_000 });
    expect((await runPregameCapture(deps, request)).outcome).toBe("qualified");
  });

  it("measures the final readback against the earliest applicable start (an earlier reschedule)", async () => {
    const earlierStartMs = START_MS - 5 * MIN; // after the first read, before the original T−60
    // Token bound within the rescheduled T−60, but the final readback is after it.
    const { db, deps } = setup({ tsaBeforeMint: (clock) => { clock.ms = earlierStartMs - 60 * MIN - 2_000; }, tsaLatencyMs: 10_000 });
    db.hooks.tamperRead = (row, n) => (n >= 2 ? { ...row, currentStart: dbText(earlierStartMs, 0, 0) } : row);
    const report = await runPregameCapture(deps, request);
    expect(report.outcome).toBe("saved_without_valid_witness");
    expect(report.reason).toContain("final_readback_after_deadline");
  });

  it("reconciles a witness or outcome write whose response was lost, never retrying it", async () => {
    const witnessLost = setup();
    witnessLost.db.hooks.afterWitnessCommit = () => { throw new Error("fetch failed"); };
    expect(await runPregameCapture(witnessLost.deps, request)).toMatchObject({ outcome: "qualified", outcomeRecorded: true });
    expect(witnessLost.db.calls.filter((c) => c === "recordWitness")).toHaveLength(1);
    const outcomeLost = setup();
    outcomeLost.db.hooks.afterOutcomeCommit = () => { throw new Error("fetch failed"); };
    expect(await runPregameCapture(outcomeLost.deps, request)).toMatchObject({ outcome: "qualified", outcomeRecorded: true });
    expect(outcomeLost.db.calls.filter((c) => c === "recordOutcome")).toHaveLength(1);
  });

  it("keeps diagnostics metadata-only in the outcome log", async () => {
    const { db, deps } = setup();
    await runPregameCapture(deps, request);
    const metadata = JSON.stringify(db.outcomes.get(KEY)?.metadata);
    expect(metadata).not.toContain("goalie_start_projections");
    expect(metadata.length).toBeLessThan(2048);
    expect(formatMicros(parseInstantMicros(START))).toBe("2026-11-21T00:30:00.000000Z");
  });
});
