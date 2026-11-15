import { describe, expect, it } from "vitest";
import { minimumRequiredMs, runPregameCapture, type CaptureDeps, type Collected, type PinnedGame } from "./custody";
import { decodePacket, sha256Hex } from "./packet";
import { u8 } from "./der";
import { mintTimeStampResponse, parseTimeStampRequest, testTsaTrust } from "./__fixtures__/testTsa";
import { buildTimeStampRequest } from "./rfc3161";
import { reverifyStoredWitness } from "./verifier";
import { formatMicros, MICROS_PER_MS, parseInstantMicros } from "./time";
import type { CaptureRpc, ClaimArgs, ReadRow, TerminalOutcome, WitnessArgs } from "./rpc";

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

class Clock {
  constructor(public ms: number) {}
  advance(ms: number) { this.ms += ms; }
}

/** Database timestamps are rendered with offsets and microseconds, as PostgREST does. */
const dbText = (ms: number, offsetMinutes = 0, extraMicros = 123) => {
  const local = new Date(ms + offsetMinutes * MIN).toISOString().slice(0, 23);
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  return `${local}${String(extraMicros).padStart(3, "0")}${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
};

interface Claim { id: string; args: ClaimArgs; inputCutoff: string; ackDeadlineMs: number }
class FakeDb {
  claims = new Map<string, Claim>();
  artifacts = new Map<string, { bytes: Buffer; raw: string; canonical: string; version: number; insertedMs: number }>();
  fences = new Set<string>();
  witnesses = new Map<string, WitnessArgs>();
  outcomes = new Map<string, { outcome: TerminalOutcome; claimId: string | null; metadata: Record<string, unknown> }>();
  calls: string[] = [];
  currentStartMs: number | null = START_MS;
  statuses = ["BOS:FUT:OK", "MIN:FUT:OK"];
  offsetMinutes = -300; // render DB times at -05:00
  /** Hooks for adversarial scenarios. */
  hooks: {
    beforeSave?(claimId: string): void; afterSaveCommit?(): void; tamperRead?(row: ReadRow, n: number): ReadRow;
    afterClaimCommit?(): void; afterWitnessCommit?(): void; afterOutcomeCommit?(): void; settle?(): void;
  } = {};
  reads = 0;
  constructor(readonly clock: Clock) {}
  /** Stored instants are exact; clock readings (now, read time) carry sub-millisecond digits. */
  text(ms: number) { return dbText(ms, this.offsetMinutes, 0); }
  clockText(ms: number) { return dbText(ms, this.offsetMinutes, 789); }
  claimFor(gameId: number, policyId: string) { return [...this.claims.values()].find((c) => c.args.gameId === gameId && c.args.policyId === policyId); }

  rpc(): CaptureRpc {
    return {
      claim: async (args) => {
        this.calls.push("claim");
        const now = this.clock.ms;
        if (args.gameId !== GAME || args.scheduledStart !== START || args.homeTeamId !== 6 || args.awayTeamId !== 30) {
          return { outcome: "binding_mismatch", claimId: null, ackDeadline: null, dbNow: this.clockText(now), inputCutoff: null };
        }
        const deadline = START_MS - 60 * MIN;
        if (this.claimFor(args.gameId, args.policyId) || this.outcomes.has(`${args.gameId}/${args.policyId}`)) {
          return { outcome: "duplicate", claimId: null, ackDeadline: this.text(deadline), dbNow: this.clockText(now), inputCutoff: null };
        }
        if (now >= deadline) return { outcome: "late_start", claimId: null, ackDeadline: this.text(deadline), dbNow: this.clockText(now), inputCutoff: null };
        if (now + args.requiredMs > deadline) return { outcome: "insufficient_time", claimId: null, ackDeadline: this.text(deadline), dbNow: this.clockText(now), inputCutoff: null };
        const id = `claim-${this.claims.size + 1}`;
        this.claims.set(id, { id, args, inputCutoff: this.clockText(now), ackDeadlineMs: deadline });
        this.hooks.afterClaimCommit?.();
        return { outcome: "claimed", claimId: id, ackDeadline: this.text(deadline), dbNow: this.clockText(now), inputCutoff: this.clockText(now) };
      },
      save: async (claimId, b64, raw, canonical, signal) => {
        this.calls.push("save");
        this.hooks.beforeSave?.(claimId);
        if (signal.aborted) throw new Error("AbortError: request aborted");
        const claim = this.claims.get(claimId);
        if (!claim) throw new Error("capture_claim_missing");
        if (this.fences.has(claimId)) throw new Error("capture_save_fenced");
        if (this.clock.ms > claim.ackDeadlineMs) throw new Error("capture_save_late");
        const bytes = Buffer.from(b64, "base64");
        if (sha256Hex(u8(bytes)) !== raw) throw new Error("capture_raw_hash_mismatch");
        if (this.artifacts.has(claimId)) throw new Error("duplicate key value violates unique constraint");
        this.artifacts.set(claimId, { bytes, raw, canonical, version: 1000 + this.artifacts.size, insertedMs: this.clock.ms });
        this.hooks.afterSaveCommit?.();
        return { rawSha256: raw, byteLength: bytes.byteLength, dbNow: this.clockText(this.clock.ms) };
      },
      settle: async (claimId) => {
        this.calls.push("settle");
        this.hooks.settle?.();
        if (this.artifacts.has(claimId)) return { state: "present", dbNow: this.clockText(this.clock.ms) };
        this.fences.add(claimId);
        return { state: "fenced", dbNow: this.clockText(this.clock.ms) };
      },
      read: async (claimId) => {
        this.calls.push("read");
        const claim = this.claims.get(claimId);
        if (!claim) return null;
        const artifact = this.artifacts.get(claimId);
        const witness = this.witnesses.get(claimId);
        const row: ReadRow = {
          claimId, gameId: claim.args.gameId, policyId: claim.args.policyId, slateDate: claim.args.slateDate,
          homeTeamId: claim.args.homeTeamId, awayTeamId: claim.args.awayTeamId, calendarRevision: claim.args.calendarRevision,
          scheduledStart: this.text(START_MS), inputCutoff: claim.inputCutoff, ackDeadline: this.text(claim.ackDeadlineMs),
          codeVersion: claim.args.codeVersion, artifactPresent: Boolean(artifact), saveFenced: this.fences.has(claimId),
          packetBase64: artifact?.bytes.toString("base64") ?? null, rawSha256: artifact ? sha256Hex(u8(artifact.bytes)) : null,
          storedRawSha256: artifact?.raw ?? null, canonicalSha256: artifact?.canonical ?? null, byteLength: artifact?.bytes.byteLength ?? null,
          rowVersion: artifact ? String(artifact.version) : null, artifactInsertedAt: artifact ? this.clockText(artifact.insertedMs) : null,
          currentStart: this.currentStartMs === null ? null : this.text(this.currentStartMs),
          teamGameStatuses: [...this.statuses], teamGameFetchedAt: this.text(this.clock.ms - MIN),
          witnessVerdict: witness?.verdict ?? null, witnessStatementText: witness?.statementText ?? null, witnessTokenBase64: witness?.tsaTokenBase64 ?? null,
          outcome: [...this.outcomes.values()].find((o) => o.claimId === claimId)?.outcome ?? null, dbReadAt: this.clockText(this.clock.ms),
        };
        this.reads += 1;
        return this.hooks.tamperRead ? this.hooks.tamperRead(row, this.reads) : row;
      },
      lookup: async (gameId, policyId) => {
        this.calls.push("lookup");
        const claim = this.claimFor(gameId, policyId);
        return { claimId: claim?.id ?? null, artifactPresent: Boolean(claim && this.artifacts.has(claim.id)), saveFenced: Boolean(claim && this.fences.has(claim.id)),
          witnessVerdict: claim ? this.witnesses.get(claim.id)?.verdict ?? null : null, outcome: this.outcomes.get(`${gameId}/${policyId}`)?.outcome ?? null,
          dbNow: this.clockText(this.clock.ms) };
      },
      recordWitness: async (w) => {
        this.calls.push("recordWitness");
        const claim = this.claims.get(w.claimId)!;
        const artifact = this.artifacts.get(w.claimId);
        if (!artifact) throw new Error("capture_artifact_missing");
        const statement = JSON.parse(w.statementText) as Record<string, string>;
        if (statement.rawSha256 !== artifact.raw || statement.canonicalSha256 !== artifact.canonical || statement.rowVersion !== String(artifact.version)
          || statement.gameId !== String(claim.args.gameId) || statement.claimId !== w.claimId) throw new Error("capture_witness_binding");
        if (parseInstantMicros(w.ackUpper) !== parseInstantMicros(w.tsaGenTime) + w.tsaAccuracyMicros) throw new Error("witnesses_upper");
        if (w.verdict === "qualified" && parseInstantMicros(w.ackUpper) > BigInt(claim.ackDeadlineMs) * MICROS_PER_MS) throw new Error("capture_witness_late");
        if (this.witnesses.has(w.claimId)) throw new Error("duplicate key");
        this.witnesses.set(w.claimId, w);
        this.hooks.afterWitnessCommit?.();
        return this.clockText(this.clock.ms);
      },
      recordOutcome: async (gameId, policyId, claimId, outcome, metadata) => {
        this.calls.push("recordOutcome");
        const key = `${gameId}/${policyId}`;
        if (claimId === null) {
          if (outcome !== "never_dispatched") throw new Error("capture_outcome_needs_claim");
          if (this.claimFor(gameId, policyId)) throw new Error("capture_outcome_claim_exists");
        } else {
          const hasArtifact = this.artifacts.has(claimId);
          const verdict = this.witnesses.get(claimId)?.verdict;
          if ((outcome === "qualified" && verdict !== "qualified") || (outcome === "saved_without_valid_witness" && (!hasArtifact || verdict === "qualified"))
            || ((outcome === "source_failed" || outcome === "save_unknown") && hasArtifact) || outcome === "never_dispatched") throw new Error("capture_outcome_state");
          if (outcome === "source_failed" || outcome === "save_unknown") this.fences.add(claimId);
        }
        if (this.outcomes.has(key)) throw new Error("duplicate key");
        this.outcomes.set(key, { outcome, claimId, metadata });
        this.hooks.afterOutcomeCommit?.();
        return this.clockText(this.clock.ms);
      },
      sweep: async () => [],
    };
  }
}

const pinned: PinnedGame = { gameId: GAME, slateDate: SLATE, homeTeamId: 6, awayTeamId: 30, homeAbbrev: "BOS", awayAbbrev: "MIN", scheduledStart: START, calendarRevision: REV };
const BUDGET = { readMs: 90_000, saveWaitMs: 15_000, tsaTimeoutMs: 10_000, skewToleranceMs: 2_000, rpcMs: 5_000 };

function setup(options: {
  startOffsetMs?: number; tsaSkewMs?: number; tsaAccuracyMs?: number | null; collect?: (clock: Clock) => Partial<Collected>;
  readMs?: number; tsaDown?: boolean; tsaWrongDigest?: boolean; requiredMs?: number;
} = {}) {
  const clock = new Clock(START_MS - 70 * MIN + (options.startOffsetMs ?? 0));
  const db = new FakeDb(clock);
  const deps: CaptureDeps = {
    writer: db.rpc(), verifier: db.rpc(), trust: testTsaTrust(),
    tsa: {
      stamp: async (request) => {
        if (options.tsaDown) throw new Error("ECONNRESET");
        clock.advance(400);
        // A wrong-digest TSA signs some other statement with the same nonce.
        const signed = options.tsaWrongDigest ? buildTimeStampRequest(Buffer.alloc(32, 0x11), parseTimeStampRequest(request).nonce ?? BigInt(0)) : request;
        return mintTimeStampResponse(signed, { genTimeMicros: BigInt(clock.ms + (options.tsaSkewMs ?? 0)) * MICROS_PER_MS,
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
