import type { ProjectionInputRead } from "../inputCapture";
import { encodePacket, PACKET_VERSION, type CaptureBinding, type PregamePacket } from "./packet";
import { DEFINITIVE_SAVE_REFUSALS, type CaptureRpc, type ClaimOutcome, type TerminalOutcome } from "./rpc";
import { verifyAndWitness, type TsaClient, type VerifyResult } from "./verifier";
import type { TsaTrust } from "./rfc3161";
import { latestInstant, parseInstantMicros } from "./time";

/**
 * One game, one policy, one attempt: pin → claim → collect (strict, model-free) → save once →
 * settle if unknown (never retry) → independent verify + RFC 3161 witness → exactly one terminal outcome.
 * Nothing here scores, writes forecasts, publishes revisions or changes serving.
 */

export interface PinnedGame {
  gameId: number; slateDate: string; homeTeamId: number; awayTeamId: number; homeAbbrev: string; awayAbbrev: string;
  scheduledStart: string; calendarRevision: string;
}
export interface Collected {
  reads: ProjectionInputRead[];
  candidates: PregamePacket["candidates"];
  transport: PregamePacket["transport"] & { refusals: string[] };
  /** Calendar revision recomputed from the issued context captured inside the packet. */
  calendarRevision: string;
}
export interface CaptureBudget {
  /** Claim refuses unless read + save + verified acknowledgement fits before T−60. */
  requiredMs: number;
  readMs: number; saveWaitMs: number; tsaTimeoutMs: number; skewToleranceMs: number;
}
export interface CaptureDeps {
  writer: CaptureRpc;
  verifier: CaptureRpc; // separate client instance
  tsa: TsaClient; trust: TsaTrust;
  pin(gameId: number, slateDate: string, deadlineMs: number): Promise<PinnedGame>;
  collect(binding: CaptureBinding, deadlineMs: number): Promise<Collected>;
  modelEnvironment(): Record<string, string | null>;
  now(): number;
  nonce?(): bigint;
  budget: CaptureBudget;
}
export interface CaptureRequest { gameId: number; slateDate: string; policyId: string; codeVersion: string; scheduledLaunchAt?: string }
export interface CaptureReport {
  outcome: TerminalOutcome | null; // null only for a refused duplicate: the original attempt owns the outcome
  reason: string | null;
  claimId: string | null;
  outcomeRecorded: boolean;
  timings: Record<string, number>;
  verify?: VerifyResult;
  saveCalls: number;
}

export async function runPregameCapture(deps: CaptureDeps, request: CaptureRequest): Promise<CaptureReport> {
  const t = { start: deps.now() } as Record<string, number>;
  const timings: Record<string, number> = {};
  if (request.scheduledLaunchAt) timings.dispatchDelayMs = t.start - Number(parseInstantMicros(request.scheduledLaunchAt) / 1000n);
  let claimId: string | null = null;
  let saveCalls = 0;
  const finish = async (outcome: TerminalOutcome, reason: string | null, verify?: VerifyResult): Promise<CaptureReport> => {
    timings.totalMs = deps.now() - t.start;
    let outcomeRecorded = false;
    try {
      // Diagnostics are metadata only: no packet content.
      await deps.writer.recordOutcome(request.gameId, request.policyId, claimId, outcome, {
        reason, timings, saveCalls, codeVersion: request.codeVersion,
        ...(verify ? { ackUpper: verify.ackUpper, ackDeadline: verify.ackDeadline, slackMs: verify.slackMs,
          tsa: verify.timestamp ? { genTime: verify.timestamp.genTime, accuracyMicros: verify.timestamp.accuracyMicros.toString(),
            accuracySource: verify.timestamp.accuracySource, tokenSha256: verify.timestamp.tokenSha256 } : null } : {}),
      });
      outcomeRecorded = true;
    } catch { /* the report carries outcomeRecorded=false; never retried */ }
    return { outcome, reason, claimId, outcomeRecorded, timings, verify, saveCalls };
  };

  // 1. Pin the official schedule revision with a strict read.
  let pinned: PinnedGame;
  try {
    pinned = await deps.pin(request.gameId, request.slateDate, deps.now() + deps.budget.readMs);
    if (pinned.gameId !== request.gameId || pinned.slateDate !== request.slateDate) throw new Error("pin_wrong_game");
  } catch (error) {
    timings.pinMs = deps.now() - t.start;
    return finish("never_dispatched", `pin_failed:${message(error)}`);
  }
  timings.pinMs = deps.now() - t.start;

  // 2. Atomic claim; the database clock decides late starts and insufficient time.
  const claimStarted = deps.now();
  let claim;
  try {
    claim = await deps.writer.claim({
      gameId: pinned.gameId, policyId: request.policyId, slateDate: pinned.slateDate, homeTeamId: pinned.homeTeamId,
      awayTeamId: pinned.awayTeamId, calendarRevision: pinned.calendarRevision, scheduledStart: pinned.scheduledStart,
      requiredMs: deps.budget.requiredMs, codeVersion: request.codeVersion,
    });
  } catch (error) {
    timings.claimMs = deps.now() - claimStarted;
    return finish("never_dispatched", `claim_failed:${message(error)}`);
  }
  timings.claimMs = deps.now() - claimStarted;
  if (claim.outcome !== "claimed" || !claim.claimId || !claim.inputCutoff) {
    if (claim.outcome === "duplicate") {
      return { outcome: null, reason: "duplicate", claimId: null, outcomeRecorded: false, timings, saveCalls };
    }
    return finish("never_dispatched", `claim_refused:${claim.outcome as ClaimOutcome}`);
  }
  claimId = claim.claimId;

  // 3. Strict, model-free collection.
  const binding: CaptureBinding = {
    claimId, policyId: request.policyId, codeVersion: request.codeVersion, gameId: pinned.gameId, slateDate: pinned.slateDate,
    homeTeamId: pinned.homeTeamId, awayTeamId: pinned.awayTeamId, homeAbbrev: pinned.homeAbbrev, awayAbbrev: pinned.awayAbbrev,
    scheduledStart: pinned.scheduledStart, calendarRevision: pinned.calendarRevision, inputCutoff: claim.inputCutoff,
  };
  const readStarted = deps.now();
  let collected: Collected;
  try {
    collected = await deps.collect(binding, readStarted + deps.budget.readMs);
  } catch (error) {
    timings.readMs = deps.now() - readStarted;
    return finish("source_failed", `collect_failed:${message(error)}`);
  }
  timings.readMs = deps.now() - readStarted;
  if (collected.transport.refusals.length) return finish("source_failed", `transport_refused:${collected.transport.refusals.slice(0, 5).join("|")}`);
  if (collected.calendarRevision !== pinned.calendarRevision) return finish("source_failed", "calendar_changed_during_capture");
  if (collected.reads.length === 0) return finish("source_failed", "no_reads");
  const times = collected.reads.map((read) => read.receivedAt);
  const readWindow = { start: times.reduce((a, b) => (parseInstantMicros(b) < parseInstantMicros(a) ? b : a)), end: latestInstant(times, times[0]) };
  const packet: PregamePacket = {
    version: PACKET_VERSION, binding, readWindow, statedCutoff: readWindow.end, modelEnvironment: deps.modelEnvironment(),
    candidates: collected.candidates,
    transport: { calls: collected.transport.calls, httpCalls: collected.transport.httpCalls, rows: collected.transport.rows, bytes: collected.transport.bytes },
    reads: collected.reads,
  };
  let encoded: ReturnType<typeof encodePacket>;
  try { encoded = encodePacket(packet); } catch (error) { return finish("source_failed", `packet_invalid:${message(error)}`); }
  timings.packetBytes = encoded.bytes.byteLength;

  // 4. Save exactly once. An unknown result is settled by claim id; the save is never retried.
  const saveStarted = deps.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.budget.saveWaitMs);
  let saveState: "saved" | "unknown" | "refused" = "unknown";
  let saveReason = "";
  try {
    saveCalls += 1;
    await deps.writer.save(claimId, encoded.bytes.toString("base64"), encoded.rawSha256, encoded.canonicalSha256, controller.signal);
    saveState = "saved";
  } catch (error) {
    const text = message(error);
    const definitive = DEFINITIVE_SAVE_REFUSALS.find((code) => text.includes(code));
    saveState = definitive ? "refused" : "unknown";
    saveReason = definitive ?? text;
  } finally { clearTimeout(timer); }
  timings.saveMs = deps.now() - saveStarted;
  if (saveState === "refused") return finish("save_unknown", `save_refused:${saveReason}`);
  if (saveState === "unknown") {
    try {
      const settled = await deps.writer.settle(claimId);
      timings.settleMs = deps.now() - saveStarted - timings.saveMs;
      if (settled.state !== "present") return finish("save_unknown", `save_unknown_fenced_absent:${saveReason}`);
    } catch (error) {
      return finish("save_unknown", `settle_failed:${message(error)}`);
    }
  }

  // 5. Independent verification and witness (separate client; reads committed bytes back).
  const verify = await verifyAndWitness({
    rpc: deps.verifier, tsa: deps.tsa, trust: deps.trust, now: deps.now, nonce: deps.nonce,
    tsaTimeoutMs: deps.budget.tsaTimeoutMs, skewToleranceMs: deps.budget.skewToleranceMs,
  }, { claimId, gameId: pinned.gameId, policyId: request.policyId, rawSha256: encoded.rawSha256, canonicalSha256: encoded.canonicalSha256 });
  timings.verifyMs = verify.verifyMs;
  return finish(verify.verdict === "qualified" && verify.witnessRecorded ? "qualified" : "saved_without_valid_witness", verify.reason, verify);
}

function message(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 160);
}
