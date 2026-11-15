/**
 * TEST-ONLY in-memory custody database. Mirrors the SQL semantics proven in
 * supabase/tests/forge_pregame_capture_custody.py: claim refusals and one claim per game/policy (closed games stay
 * closed); save-once with hash check; settle fence; authoritative read; lookup; witness binding (digest over the exact
 * text, upper = gen + accuracy); outcomes consistent with claim state. Used by custody.test.ts and the pilot rehearsal.
 */
import { u8 } from "../der";
import { sha256Hex } from "../packet";
import { MICROS_PER_MS, parseInstantMicros } from "../time";
import type { CaptureRpc, ClaimArgs, ReadRow, TerminalOutcome, WitnessArgs } from "../rpc";

const MIN = 60_000;

export class FakeClock {
  constructor(public ms: number) {}
  advance(ms: number) { this.ms += ms; }
}

export interface FakeGame { gameId: number; scheduledStart: string; homeTeamId: number; awayTeamId: number; homeAbbrev: string; awayAbbrev: string }

/** Database timestamps are rendered with offsets and microseconds, as PostgREST does. */
export const dbText = (ms: number, offsetMinutes = 0, extraMicros = 123) => {
  const local = new Date(ms + offsetMinutes * MIN).toISOString().slice(0, 23);
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  return `${local}${String(extraMicros).padStart(3, "0")}${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
};

interface Claim { id: string; args: ClaimArgs; inputCutoff: string; ackDeadlineMs: number }
export class FakeCustodyDb {
  claims = new Map<string, Claim>();
  artifacts = new Map<string, { bytes: Buffer; raw: string; canonical: string; version: number; insertedMs: number }>();
  fences = new Set<string>();
  witnesses = new Map<string, WitnessArgs>();
  outcomes = new Map<string, { outcome: TerminalOutcome; claimId: string | null; metadata: Record<string, unknown> }>();
  calls: string[] = [];
  currentStartMs: number | null;
  statuses: string[];
  offsetMinutes = -300; // render DB times at -05:00
  /** Hooks for adversarial scenarios. */
  hooks: {
    beforeSave?(claimId: string): void; afterSaveCommit?(): void; tamperRead?(row: ReadRow, n: number): ReadRow;
    afterClaimCommit?(): void; afterWitnessCommit?(): void; afterOutcomeCommit?(): void; settle?(): void;
  } = {};
  reads = 0;
  constructor(readonly clock: FakeClock, readonly game: FakeGame) {
    this.currentStartMs = Date.parse(game.scheduledStart);
    this.statuses = [`${game.homeAbbrev}:FUT:OK`, `${game.awayAbbrev}:FUT:OK`];
  }
  /** Stored instants are exact; clock readings (now, read time) carry sub-millisecond digits. */
  text(ms: number) { return dbText(ms, this.offsetMinutes, 0); }
  clockText(ms: number) { return dbText(ms, this.offsetMinutes, 789); }
  claimFor(gameId: number, policyId: string) { return [...this.claims.values()].find((c) => c.args.gameId === gameId && c.args.policyId === policyId); }

  rpc(): CaptureRpc {
    return {
      claim: async (args) => {
        this.calls.push("claim");
        const now = this.clock.ms;
        if (args.gameId !== this.game.gameId || Date.parse(args.scheduledStart) !== Date.parse(this.game.scheduledStart) || args.homeTeamId !== this.game.homeTeamId || args.awayTeamId !== this.game.awayTeamId) {
          return { outcome: "binding_mismatch", claimId: null, ackDeadline: null, dbNow: this.clockText(now), inputCutoff: null };
        }
        const deadline = Date.parse(this.game.scheduledStart) - 60 * MIN;
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
          scheduledStart: this.text(Date.parse(this.game.scheduledStart)), inputCutoff: claim.inputCutoff, ackDeadline: this.text(claim.ackDeadlineMs),
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
        if (parseInstantMicros(w.ackUpper) !== parseInstantMicros(w.tsaGenTime) + w.tsaAccuracyMicros + w.tsaResolutionMicros) throw new Error("witnesses_upper");
        if (w.verdict === "qualified" && parseInstantMicros(w.ackUpper) > BigInt(claim.ackDeadlineMs) * MICROS_PER_MS) throw new Error("capture_witness_late");
        // Database-owned final readback: a qualified witness needs it at or before T−60 of the earliest known start.
        const earliestStartMs = Math.min(Date.parse(this.game.scheduledStart), this.currentStartMs ?? Infinity);
        if (w.verdict === "qualified" && (!w.finalReadAt || Date.parse(w.finalReadAt) > earliestStartMs - 60 * MIN
          || parseInstantMicros(w.finalReadAt) < parseInstantMicros(w.dbReadAt))) throw new Error("capture_witness_final_read");
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
