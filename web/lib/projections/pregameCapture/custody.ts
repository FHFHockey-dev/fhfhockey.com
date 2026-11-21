import type { ProjectionInputRead } from "../inputCapture";
import { encodePacket, PACKET_VERSION, type CaptureBinding, type PregamePacket } from "./packet";
import { DEFINITIVE_SAVE_REFUSALS, type CaptureRpc, type ClaimOutcome, type SettleRow, type TerminalOutcome } from "./rpc";
import { pregameScheduleProblem, verifyAndWitness, type TsaClient, type VerifyResult } from "./verifier";
import type { TsaTrust } from "./rfc3161";
import { formatMicros, latestInstant, MICROS_PER_MS, parseInstantMicros } from "./time";

/**
 * One game, one policy, one attempt: pin → claim → collect (strict, model-free) → save once →
 * settle if unknown (never retry the save) → independent verify + RFC 3161 witness → exactly one terminal outcome.
 * Nothing here scores, writes forecasts, publishes revisions or changes serving.
 */

export interface PinnedGame {
  gameId: number; slateDate: string; homeTeamId: number; awayTeamId: number; homeAbbrev: string; awayAbbrev: string;
  scheduledStart: string; calendarRevision: string;
  teamGameStatuses?: string[];
}
export interface Collected {
  reads: ProjectionInputRead[];
  candidates: PregamePacket["candidates"];
  transport: PregamePacket["transport"] & { refusals: string[] };
  /** Calendar revision recomputed from the issued context captured inside the packet. */
  calendarRevision: string;
  seasonBootstrapApplied: boolean;
}
export interface CaptureBudget {
  /** Claim refuses unless read + save + verified acknowledgement fits before T−60. */
  requiredMs: number;
  /** Legacy captures give pinning the same budget as collection. */
  pinMs?: number;
  readMs: number; saveWaitMs: number; tsaTimeoutMs: number; skewToleranceMs: number;
  /** Bound for each custody RPC other than the save (claim, settle, read, witness, outcome). */
  rpcMs: number;
}
/** read + save wait + up to 3 settles + 2 verifier reads + TSA + witness + outcome + skew. */
export function minimumRequiredMs(b: Omit<CaptureBudget, "requiredMs">): number {
  return b.readMs + b.saveWaitMs + 3 * b.rpcMs + 2 * b.rpcMs + b.tsaTimeoutMs + 2 * b.rpcMs + b.skewToleranceMs;
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
export interface CaptureRequest {
  gameId: number; slateDate: string; policyId: string; codeVersion: string; scheduledLaunchAt?: string;
  /** Already-admitted dispatches must pin the same start and still be pregame. */
  expectedScheduledStart?: string;
  /** Hosted v2 must still have its full post-claim budget when it starts the claim. */
  workDeadlineMs?: number;
}
export interface CaptureReport {
  /** null: nothing recorded by this attempt (duplicate, retryable pre-claim failure, or an ambiguous claim the sweeper closes). */
  outcome: TerminalOutcome | null;
  reason: string | null;
  claimId: string | null;
  outcomeRecorded: boolean;
  timings: Record<string, number>;
  verify?: VerifyResult;
  saveCalls: number;
}

const SETTLE_ATTEMPTS = 3;

export async function runPregameCapture(deps: CaptureDeps, request: CaptureRequest): Promise<CaptureReport> {
  const t0 = deps.now();
  const timings: Record<string, number> = {};
  if (request.scheduledLaunchAt) timings.dispatchDelayMs = t0 - Number(parseInstantMicros(request.scheduledLaunchAt) / BigInt(1000));
  let claimId: string | null = null;
  let saveCalls = 0;
  const report = (outcome: TerminalOutcome | null, reason: string | null, outcomeRecorded: boolean, verify?: VerifyResult): CaptureReport =>
    ({ outcome, reason, claimId, outcomeRecorded, timings: { ...timings, totalMs: deps.now() - t0 }, verify, saveCalls });

  const record = async (outcome: TerminalOutcome, reason: string | null, verify?: VerifyResult): Promise<CaptureReport> => {
    timings.totalMs = deps.now() - t0;
    // Diagnostics are metadata only: no packet content.
    const metadata = {
      reason, timings, saveCalls, codeVersion: request.codeVersion,
      ...(verify ? { ackUpper: verify.ackUpper, ackDeadline: verify.ackDeadline, slackMs: verify.slackMs,
        tsa: verify.timestamp ? { genTime: verify.timestamp.genTime, accuracyMicros: verify.timestamp.accuracyMicros.toString(),
          accuracySource: verify.timestamp.accuracySource, tokenSha256: verify.timestamp.tokenSha256 } : null } : {}),
    };
    try {
      await deps.writer.recordOutcome(request.gameId, request.policyId, claimId, outcome, metadata);
      return report(outcome, reason, true, verify);
    } catch {
      // Never retried: confirm by lookup. An unrecorded claim is closed later by the sweeper.
      try {
        const found = await deps.writer.lookup(request.gameId, request.policyId);
        return report(outcome, reason, found.outcome === outcome, verify);
      } catch { return report(outcome, reason, false, verify); }
    }
  };

  const minimum = minimumRequiredMs(deps.budget);
  if (deps.budget.requiredMs < minimum) return report(null, `budget_inconsistent:required_${deps.budget.requiredMs}_lt_${minimum}`, false);

  // 1. Pin the official schedule revision with a strict read. A failure here is retryable; nothing is recorded.
  let pinned: PinnedGame;
  try {
    pinned = await deps.pin(request.gameId, request.slateDate, deps.now() + (deps.budget.pinMs ?? deps.budget.readMs));
    if (pinned.gameId !== request.gameId || pinned.slateDate !== request.slateDate) throw new Error("pin_wrong_game");
    if (request.expectedScheduledStart && (parseInstantMicros(pinned.scheduledStart) !== parseInstantMicros(request.expectedScheduledStart)
      || pregameScheduleProblem(pinned.teamGameStatuses ?? []))) {
      return report(null, "pin_schedule_changed", false);
    }
  } catch (error) {
    timings.pinMs = deps.now() - t0;
    return report(null, `pin_failed:${message(error)}`, false);
  }
  timings.pinMs = deps.now() - t0;

  // 2. Atomic claim; the database clock decides late starts and insufficient time and is the input cutoff.
  const claimStarted = deps.now();
  if (request.workDeadlineMs !== undefined && claimStarted + deps.budget.rpcMs + deps.budget.requiredMs > request.workDeadlineMs) {
    return report(null, "claim_window_closed", false);
  }
  let claim;
  try {
    claim = await deps.writer.claim({
      gameId: pinned.gameId, policyId: request.policyId, slateDate: pinned.slateDate, homeTeamId: pinned.homeTeamId,
      awayTeamId: pinned.awayTeamId, calendarRevision: pinned.calendarRevision, scheduledStart: pinned.scheduledStart,
      requiredMs: deps.budget.requiredMs, codeVersion: request.codeVersion,
    });
  } catch (error) {
    timings.claimMs = deps.now() - claimStarted;
    // The claim may have committed with its response lost: look it up, never re-claim.
    try {
      const found = await deps.writer.lookup(request.gameId, request.policyId);
      claimId = found.claimId;
      return report(null, found.claimId ? "claim_ambiguous_left_for_sweeper" : `claim_failed:${message(error)}`, false);
    } catch { return report(null, `claim_unknown:${message(error)}`, false); }
  }
  timings.claimMs = deps.now() - claimStarted;
  if (claim.outcome !== "claimed" || !claim.claimId || !claim.inputCutoff) {
    const refused = claim.outcome as ClaimOutcome;
    // Only time-based refusals are terminal; a duplicate belongs to the first attempt, a binding mismatch may be a reschedule.
    if (refused === "late_start" || refused === "insufficient_time") return record("never_dispatched", `claim_refused:${refused}`);
    return report(null, `claim_refused:${refused}`, false);
  }
  claimId = claim.claimId;

  try {
    return await afterClaim(deps, request, pinned, claim.claimId, claim.inputCutoff, timings, () => { saveCalls += 1; }, record);
  } catch (error) {
    // Anything unexpected after the claim still ends in exactly one consistent outcome.
    const reason = `unexpected:${message(error)}`;
    const settled = await settleWithRetry(deps.writer, claim.claimId);
    if (settled?.state === "present") return record("saved_without_valid_witness", reason);
    if (settled?.state === "fenced") return record(saveCalls === 0 ? "source_failed" : "save_unknown", reason);
    return report(null, `${reason};settle_failed_left_for_sweeper`, false);
  }
}

async function afterClaim(
  deps: CaptureDeps, request: CaptureRequest, pinned: PinnedGame, claimId: string, inputCutoff: string,
  timings: Record<string, number>, countSave: () => void,
  record: (outcome: TerminalOutcome, reason: string | null, verify?: VerifyResult) => Promise<CaptureReport>,
): Promise<CaptureReport> {
  // 3. Strict, model-free collection.
  const binding: CaptureBinding = {
    claimId, policyId: request.policyId, codeVersion: request.codeVersion, gameId: pinned.gameId, slateDate: pinned.slateDate,
    homeTeamId: pinned.homeTeamId, awayTeamId: pinned.awayTeamId, homeAbbrev: pinned.homeAbbrev, awayAbbrev: pinned.awayAbbrev,
    scheduledStart: pinned.scheduledStart, calendarRevision: pinned.calendarRevision, inputCutoff,
  };
  const readStarted = deps.now();
  let collected: Collected;
  try {
    collected = await deps.collect(binding, readStarted + deps.budget.readMs);
  } catch (error) {
    timings.readMs = deps.now() - readStarted;
    return record("source_failed", `collect_failed:${message(error)}`);
  }
  timings.readMs = deps.now() - readStarted;
  if (collected.transport.refusals.length) return record("source_failed", `transport_refused:${collected.transport.refusals.slice(0, 5).join("|")}`);
  if (collected.calendarRevision !== pinned.calendarRevision) return record("source_failed", "calendar_changed_during_capture");
  if (collected.reads.length === 0) return record("source_failed", "no_reads");
  const times = collected.reads.map((read) => read.receivedAt);
  const readWindow = { start: times.reduce((a, b) => (parseInstantMicros(b) < parseInstantMicros(a) ? b : a)), end: latestInstant(times, times[0]) };
  // Rows may carry database-clock stamps up to the transport's tolerance past the local receive clock: the stated
  // availability cutoff includes that tolerance rather than claiming a tighter bound than was checked.
  const statedCutoff = formatMicros(parseInstantMicros(readWindow.end) + BigInt(collected.transport.stampToleranceMs) * MICROS_PER_MS);
  const packet: PregamePacket = {
    version: PACKET_VERSION, binding, readWindow, statedCutoff, modelEnvironment: deps.modelEnvironment(),
    seasonBootstrapApplied: collected.seasonBootstrapApplied, candidates: collected.candidates,
    transport: { calls: collected.transport.calls, httpCalls: collected.transport.httpCalls, rows: collected.transport.rows, bytes: collected.transport.bytes,
      stampToleranceMs: collected.transport.stampToleranceMs },
    reads: collected.reads,
  };
  let encoded: ReturnType<typeof encodePacket>;
  try { encoded = encodePacket(packet); } catch (error) { return record("source_failed", `packet_invalid:${message(error)}`); }
  timings.packetBytes = encoded.bytes.byteLength;

  // 4. Save exactly once. An unknown result is settled by claim id; the save is never retried.
  const saveStarted = deps.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.budget.saveWaitMs);
  let saveState: "saved" | "unknown" | "refused" = "unknown";
  let saveReason = "";
  try {
    countSave();
    await deps.writer.save(claimId, encoded.bytes.toString("base64"), encoded.rawSha256, encoded.canonicalSha256, controller.signal);
    saveState = "saved";
  } catch (error) {
    const text = message(error);
    const definitive = DEFINITIVE_SAVE_REFUSALS.find((code) => text.includes(code));
    saveState = definitive ? "refused" : "unknown";
    saveReason = definitive ?? text;
  } finally { clearTimeout(timer); }
  timings.saveMs = deps.now() - saveStarted;
  if (saveState === "refused") return record("save_unknown", `save_refused:${saveReason}`);
  if (saveState === "unknown") {
    const settled = await settleWithRetry(deps.writer, claimId);
    timings.settleMs = deps.now() - saveStarted - timings.saveMs;
    if (!settled) throw new Error(`settle_failed_after_unknown_save:${saveReason}`);
    if (settled.state !== "present") return record("save_unknown", `save_unknown_fenced_absent:${saveReason}`);
  }

  // 5. Independent verification and witness (separate client; reads committed bytes back).
  const verify = await verifyAndWitness({
    rpc: deps.verifier, tsa: deps.tsa, trust: deps.trust, now: deps.now, nonce: deps.nonce,
    tsaTimeoutMs: deps.budget.tsaTimeoutMs, skewToleranceMs: deps.budget.skewToleranceMs,
  }, { claimId, gameId: pinned.gameId, policyId: request.policyId, rawSha256: encoded.rawSha256, canonicalSha256: encoded.canonicalSha256 });
  timings.verifyMs = verify.verifyMs;
  return record(verify.verdict === "qualified" && verify.witnessRecorded ? "qualified" : "saved_without_valid_witness", verify.reason, verify);
}

/** settle_v1 is idempotent (it can only report the same state or move absent → fenced), so repeating it is safe. */
async function settleWithRetry(rpc: CaptureRpc, claimId: string): Promise<SettleRow | null> {
  for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt++) {
    try { return await rpc.settle(claimId); } catch { /* lock timeout or transport error: try again */ }
  }
  return null;
}

function message(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 160);
}
