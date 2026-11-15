import { describe, expect, it } from "vitest";
import { runPregameCapture, type CaptureDeps, type Collected, type PinnedGame } from "./custody";
import { decodePacket, sha256Hex } from "./packet";
import { mintTimeStampResponse, parseTimeStampRequest, testTsaTrust } from "./__fixtures__/testTsa";
import { buildTimeStampRequest } from "./rfc3161";
import { formatMicros, MICROS_PER_MS, parseInstantMicros } from "./time";
import type { CaptureRpc, ClaimArgs, ReadRow, TerminalOutcome, WitnessArgs } from "./rpc";

/**
 * Offline acceptance for the custody path. FakeDb mirrors the SQL semantics proven in
 * supabase/tests/forge_pregame_capture_custody.py (claim refusals, one claim per game/policy,
 * save-once with hash check, settle fence, authoritative read, witness/outcome rules).
 */

const GAME = 2026020400;
const SLATE = "2026-11-20";
// Puck drop 00:30Z on the next UTC day: the ET slate date and the UTC date differ (midnight rollover).
const START = "2026-11-21T00:30:00Z";
const START_MS = Date.parse(START);
const REV = "c".repeat(64);
const MIN = 60_000;

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
  artifacts = new Map<string, { bytes: Buffer; raw: string; canonical: string; version: number }>();
  fences = new Set<string>();
  witnesses = new Map<string, WitnessArgs>();
  outcomes = new Map<string, { outcome: TerminalOutcome; claimId: string | null; metadata: Record<string, unknown> }>();
  calls: string[] = [];
  currentStartMs = START_MS;
  statuses = ["BOS:FUT", "MIN:FUT"];
  offsetMinutes = -300; // render DB times at -05:00
  /** Hooks for adversarial scenarios. */
  hooks: {
    beforeSave?(claimId: string): void; afterSaveCommit?(): void; tamperRead?(row: ReadRow, n: number): ReadRow;
  } = {};
  reads = 0;
  constructor(readonly clock: Clock) {}
  /** Stored instants are exact; clock readings (now, read time) carry sub-millisecond digits. */
  text(ms: number) { return dbText(ms, this.offsetMinutes, 0); }
  clockText(ms: number) { return dbText(ms, this.offsetMinutes, 789); }

  rpc(): CaptureRpc {
    return {
      claim: async (args) => {
        this.calls.push("claim");
        const now = this.clock.ms;
        if (args.gameId !== GAME || args.scheduledStart !== START || args.homeTeamId !== 6 || args.awayTeamId !== 30) {
          return { outcome: "binding_mismatch", claimId: null, ackDeadline: null, dbNow: this.text(now), inputCutoff: null };
        }
        const deadline = START_MS - 60 * MIN;
        const key = `${args.gameId}/${args.policyId}`;
        if ([...this.claims.values()].some((c) => `${c.args.gameId}/${c.args.policyId}` === key)) {
          return { outcome: "duplicate", claimId: null, ackDeadline: this.text(deadline), dbNow: this.text(now), inputCutoff: null };
        }
        if (now >= deadline) return { outcome: "late_start", claimId: null, ackDeadline: this.text(deadline), dbNow: this.text(now), inputCutoff: null };
        if (now + args.requiredMs > deadline) return { outcome: "insufficient_time", claimId: null, ackDeadline: this.text(deadline), dbNow: this.text(now), inputCutoff: null };
        const id = `claim-${this.claims.size + 1}`;
        this.claims.set(id, { id, args, inputCutoff: this.clockText(now), ackDeadlineMs: deadline });
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
        if (sha256Hex(bytes) !== raw) throw new Error("capture_raw_hash_mismatch");
        if (this.artifacts.has(claimId)) throw new Error("duplicate key value violates unique constraint");
        this.artifacts.set(claimId, { bytes, raw, canonical, version: 1000 + this.artifacts.size });
        this.hooks.afterSaveCommit?.();
        if (signal.aborted) throw new Error("AbortError: request aborted after commit");
        return { rawSha256: raw, byteLength: bytes.byteLength, dbNow: this.text(this.clock.ms) };
      },
      settle: async (claimId) => {
        this.calls.push("settle");
        if (this.artifacts.has(claimId)) return { state: "present", dbNow: this.text(this.clock.ms) };
        this.fences.add(claimId);
        return { state: "fenced", dbNow: this.text(this.clock.ms) };
      },
      read: async (claimId) => {
        this.calls.push("read");
        const claim = this.claims.get(claimId);
        if (!claim) return null;
        const artifact = this.artifacts.get(claimId);
        const row: ReadRow = {
          claimId, gameId: claim.args.gameId, policyId: claim.args.policyId, slateDate: claim.args.slateDate,
          homeTeamId: claim.args.homeTeamId, awayTeamId: claim.args.awayTeamId, calendarRevision: claim.args.calendarRevision,
          scheduledStart: this.text(START_MS), inputCutoff: claim.inputCutoff, ackDeadline: this.text(claim.ackDeadlineMs),
          codeVersion: claim.args.codeVersion, artifactPresent: Boolean(artifact), saveFenced: this.fences.has(claimId),
          packetBase64: artifact?.bytes.toString("base64") ?? null, rawSha256: artifact ? sha256Hex(artifact.bytes) : null,
          storedRawSha256: artifact?.raw ?? null, canonicalSha256: artifact?.canonical ?? null, byteLength: artifact?.bytes.byteLength ?? null,
          rowVersion: artifact ? String(artifact.version) : null, currentStart: this.text(this.currentStartMs),
          teamGameStatuses: [...this.statuses], dbReadAt: this.clockText(this.clock.ms),
        };
        this.reads += 1;
        return this.hooks.tamperRead ? this.hooks.tamperRead(row, this.reads) : row;
      },
      recordWitness: async (w) => {
        this.calls.push("recordWitness");
        const claim = this.claims.get(w.claimId)!;
        const artifact = this.artifacts.get(w.claimId);
        if (!artifact) throw new Error("capture_artifact_missing");
        if (w.statement.rawSha256 !== artifact.raw || w.statement.canonicalSha256 !== artifact.canonical
          || w.statement.gameId !== String(claim.args.gameId) || w.statement.claimId !== w.claimId) throw new Error("capture_witness_binding");
        if (w.verdict === "qualified" && parseInstantMicros(w.ackUpper) > BigInt(claim.ackDeadlineMs) * MICROS_PER_MS) throw new Error("capture_witness_late");
        if (this.witnesses.has(w.claimId)) throw new Error("duplicate key");
        this.witnesses.set(w.claimId, w);
        return this.text(this.clock.ms);
      },
      recordOutcome: async (gameId, policyId, claimId, outcome, metadata) => {
        this.calls.push("recordOutcome");
        if (outcome === "qualified" && this.witnesses.get(claimId!)?.verdict !== "qualified") throw new Error("capture_outcome_unwitnessed");
        const key = `${gameId}/${policyId}`;
        if (this.outcomes.has(key)) throw new Error("duplicate key");
        this.outcomes.set(key, { outcome, claimId, metadata });
        return this.text(this.clock.ms);
      },
    };
  }
}

const pinned: PinnedGame = { gameId: GAME, slateDate: SLATE, homeTeamId: 6, awayTeamId: 30, homeAbbrev: "BOS", awayAbbrev: "MIN", scheduledStart: START, calendarRevision: REV };

function setup(options: {
  startOffsetMs?: number; tsaSkewMs?: number; tsaAccuracyMs?: number | null; collect?: (clock: Clock) => Partial<Collected>;
  readMs?: number; tsaDown?: boolean; tsaWrongDigest?: boolean; requiredMs?: number;
} = {}) {
  const clock = new Clock(START_MS - 70 * MIN + (options.startOffsetMs ?? 0));
  const db = new FakeDb(clock);
  const tsaCalls: number[] = [];
  const deps: CaptureDeps = {
    writer: db.rpc(), verifier: db.rpc(), trust: testTsaTrust(),
    tsa: {
      stamp: async (request) => {
        if (options.tsaDown) throw new Error("ECONNRESET");
        clock.advance(400);
        tsaCalls.push(clock.ms);
        // A wrong-digest TSA signs some other statement with the same nonce.
        const signed = options.tsaWrongDigest
          ? buildTimeStampRequest(Buffer.alloc(32, 0x11), parseTimeStampRequest(request).nonce ?? 0n) : request;
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
        transport: { calls: 2, httpCalls: 2, rows: 1, bytes: 512, refusals: [] },
        calendarRevision: REV,
        ...options.collect?.(clock),
      };
    },
    modelEnvironment: () => ({ FORGE_SKATER_MODEL_MODE: "v2" }),
    now: () => clock.ms,
    nonce: () => 0x5eedn,
    budget: { requiredMs: options.requiredMs ?? 120_000, readMs: 90_000, saveWaitMs: 15_000, tsaTimeoutMs: 10_000, skewToleranceMs: 2_000 },
  };
  return { clock, db, deps, tsaCalls };
}

const request = { gameId: GAME, slateDate: SLATE, policyId: "pregame-native-v1", codeVersion: "abcdef0123456789" };
const CAPTURE_RPCS = new Set(["claim", "save", "settle", "read", "recordWitness", "recordOutcome"]);

describe("pregame capture custody (offline acceptance)", () => {
  it("qualifies one exact game: one save, committed readback, RFC 3161 witness at or before T−60", async () => {
    const { db, deps } = setup();
    const report = await runPregameCapture(deps, request);
    expect(report).toMatchObject({ outcome: "qualified", reason: null, outcomeRecorded: true, saveCalls: 1 });
    expect(db.calls.filter((c) => c === "save")).toHaveLength(1);
    expect(db.calls.every((c) => CAPTURE_RPCS.has(c))).toBe(true); // no forecast, revision or serving RPC exists here
    const artifact = db.artifacts.get(report.claimId!)!;
    const { packet } = decodePacket(artifact.bytes);
    expect(packet.binding).toMatchObject({ gameId: GAME, slateDate: SLATE, calendarRevision: REV, claimId: report.claimId });
    // Inputs only: no writes, output hash, scores or forecasts are part of the packet.
    expect(Object.keys(packet).sort()).toEqual(["binding", "candidates", "modelEnvironment", "readWindow", "reads", "statedCutoff", "transport", "version"]);
    expect(packet.reads.every((read) => read.request[0].method === "from" || read.request[0].method === "rpc")).toBe(true);
    expect(parseInstantMicros(report.verify!.ackUpper!)).toBeLessThanOrEqual(parseInstantMicros("2026-11-20T23:30:00Z"));
    expect(db.witnesses.get(report.claimId!)?.verdict).toBe("qualified");
    expect(db.outcomes.get(`${GAME}/pregame-native-v1`)?.outcome).toBe("qualified");
  });

  it("treats equivalent offsets and sub-second precision as the same instants (no string ordering)", async () => {
    const { db, deps } = setup();
    db.offsetMinutes = 330; // +05:30 rendering of every database instant
    const report = await runPregameCapture(deps, request);
    expect(report.outcome).toBe("qualified");
  });

  it("refuses a late start and a start without time for read + save + verify", async () => {
    const late = setup({ startOffsetMs: 11 * MIN });
    expect(await runPregameCapture(late.deps, request)).toMatchObject({ outcome: "never_dispatched", reason: "claim_refused:late_start" });
    const tight = setup({ startOffsetMs: 9 * MIN, requiredMs: 2 * MIN });
    expect(await runPregameCapture(tight.deps, request)).toMatchObject({ outcome: "never_dispatched", reason: "claim_refused:insufficient_time" });
    expect(tight.db.calls).not.toContain("save");
  });

  it("refuses a duplicate claim without touching the first attempt's outcome", async () => {
    const { db, deps } = setup();
    await runPregameCapture(deps, request);
    const second = await runPregameCapture(deps, request);
    expect(second).toMatchObject({ outcome: null, reason: "duplicate", saveCalls: 0 });
    expect(db.calls.filter((c) => c === "save")).toHaveLength(1);
    expect(db.outcomes.get(`${GAME}/pregame-native-v1`)?.outcome).toBe("qualified");
  });

  it("reconciles a save that timed out after commit by claim id, without retrying it", async () => {
    const { db, deps } = setup();
    // The row commits, then the response is lost (socket hang up): the writer cannot tell what happened.
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
    // A straggling save from that attempt can no longer commit.
    db.hooks.beforeSave = undefined;
    await expect(db.rpc().save(report.claimId!, Buffer.from("x").toString("base64"), sha256Hex(Buffer.from("x")), "0".repeat(64), new AbortController().signal)).rejects.toThrow("capture_save_fenced");
  });

  it("does not qualify a writer that starts before the cutoff but commits after it", async () => {
    const { db, deps } = setup({ startOffsetMs: 7 * MIN, readMs: 60_000 });
    // Claim at T−63, reads until T−62; the commit lands after T−60 (slow transaction), so the save itself
    // is accepted only if it started in time — the witness is what decides.
    db.hooks.afterSaveCommit = () => { db.clock.advance(3 * MIN); };
    const report = await runPregameCapture(deps, request);
    expect(report.outcome).toBe("saved_without_valid_witness");
    expect(report.reason).toContain("ack_after_deadline");
    expect(db.witnesses.get(report.claimId!)?.verdict).toBe("saved_without_valid_witness");
  });

  it("does not qualify after an earlier reschedule or once the game is no longer pregame", async () => {
    const earlier = setup();
    earlier.db.currentStartMs = START_MS - 30 * MIN;
    expect((await runPregameCapture(earlier.deps, request)).reason).toContain("ack_after_deadline");
    const live = setup();
    live.db.statuses = ["BOS:LIVE", "MIN:LIVE"];
    expect((await runPregameCapture(live.deps, request)).reason).toContain("game_not_pregame");
  });

  it("fails stale, wrong-game or refused inputs as source_failed and saves nothing", async () => {
    const stale = setup({ collect: () => ({ calendarRevision: "d".repeat(64) }) });
    expect(await runPregameCapture(stale.deps, request)).toMatchObject({ outcome: "source_failed", reason: "calendar_changed_during_capture" });
    const refused = setup({ collect: () => ({ transport: { calls: 1, httpCalls: 1, rows: 0, bytes: 0, refusals: ["target_game_result:pbp_plays"] } }) });
    expect(await runPregameCapture(refused.deps, request)).toMatchObject({ outcome: "source_failed" });
    const wrong = setup();
    wrong.deps.pin = async () => ({ ...pinned, gameId: GAME + 1 });
    expect(await runPregameCapture(wrong.deps, request)).toMatchObject({ outcome: "never_dispatched", reason: "pin_failed:pin_wrong_game" });
    const thrown = setup({ collect: () => { throw new Error("relation_not_allowed"); } });
    expect((await runPregameCapture(thrown.deps, request)).outcome).toBe("source_failed");
    for (const s of [stale, refused, thrown]) expect(s.db.calls).not.toContain("save");
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
    const wrongDigest = setup({ tsaWrongDigest: true });
    expect((await runPregameCapture(wrongDigest.deps, request)).reason).toBe("tsa_failed:tsa_imprint_mismatch");
    const noAccuracy = setup({ tsaAccuracyMs: null });
    expect((await runPregameCapture(noAccuracy.deps, request)).reason).toBe("tsa_failed:tsa_accuracy_missing");
    const down = setup({ tsaDown: true });
    const downReport = await runPregameCapture(down.deps, request);
    expect(downReport).toMatchObject({ outcome: "saved_without_valid_witness", reason: "tsa_failed:ECONNRESET" });
    const skewed = setup({ tsaSkewMs: -30_000 });
    expect((await runPregameCapture(skewed.deps, request)).reason).toContain("db_clock_disagrees_with_tsa");
  });

  it("keeps diagnostics metadata-only in the outcome log", async () => {
    const { db, deps } = setup();
    await runPregameCapture(deps, request);
    const metadata = JSON.stringify(db.outcomes.get(`${GAME}/pregame-native-v1`)?.metadata);
    expect(metadata).not.toContain("goalie_start_projections");
    expect(metadata.length).toBeLessThan(2048);
    expect(formatMicros(parseInstantMicros(START))).toBe("2026-11-21T00:30:00.000000Z");
  });
});
