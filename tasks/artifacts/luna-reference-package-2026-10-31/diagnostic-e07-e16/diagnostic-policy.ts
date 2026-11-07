import { identityDigest } from "../../../../web/lib/sources/playerIdentitySnapshot";
import { runRetainedTweetLunaReview, type LunaReviewInput } from "../../../../web/lib/sources/tweetLunaReview";
import { createLunaTransport, priceLunaUsage, type LunaReceipt } from "../../../../web/lib/sources/tweetLunaTransport";
import { scoreLunaEvaluation } from "../../../../web/lib/sources/tweetLunaEvaluationScoring";

// PROPOSAL ONLY. Offline classification has no file writes, key loader, live fetch,
// admission mutation, correction input or production consumer. Independent review
// must approve this policy before an operator uses it to advance a paid sequence.
export const DIAGNOSTIC_POLICY = "luna-exposed-diagnostic-collection-v1";
export const COLLECTIBLE_MODEL_HOLDS = [
  "goalie_subject_binding_invalid", "goalie_certainty_inflation", "goalie_definite_wording_unsupported",
  "goalie_context_unresolved", "goalie_conflict_or_correction_unresolved", "goalie_tentative_wording_unsupported",
] as const;
type Review = Awaited<ReturnType<typeof runRetainedTweetLunaReview>>;
type Attempt = { hash: string; state: string; reservedNanoUsd: number; receipt: LunaReceipt | null };
type Wire = { endpoint: "responses" | "decisions"; hash: string; body: Record<string, unknown> };

/** Grade the unchanged original; independently replay its exact settled receipts
 * through the pinned caller. The replay store cannot reserve money or call HTTP.
 * The supervising operator still must check pins, full ledger history, budget,
 * source/funding/clock evidence, saved artifacts and case order before invocation.
 */
export async function classifyDiagnosticReport(args: {
  input: LunaReviewInput; expected: Parameters<typeof scoreLunaEvaluation>[0]; originalReview: Review;
  attempts: Attempt[]; requests: Wire[]; cliExitCode: number; checkedAt: string;
}) {
  const score = scoreLunaEvaluation(args.expected, args.originalReview);
  const base = { policy: DIAGNOSTIC_POLICY, originalReviewHash: identityDigest(args.originalReview), rawGrade: score,
    originalStatus: args.originalReview.status, originalHolds: [...args.originalReview.holds],
    canPublish: false, canApply: false, canChangeStatus: false, candidateUsedForGradeOrAdvance: false } as const;
  const stop = (reason: string) => ({ ...base, outcome: "operational_stop" as const, mayAdvanceDiagnosticSequence: false,
    reason, decisionsDisposition: "unresolved_do_not_dispatch" as const });
  if (![0, 2].includes(args.cliExitCode)) return stop("cli_error");
  if (args.attempts.length < 1 || args.attempts.length > args.requests.length
    || args.requests[0]?.endpoint !== "responses" || args.requests.length !== (args.input.decisions ? 2 : 1)
    || args.requests.length === 2 && args.requests[1]?.endpoint !== "decisions") return stop("request_count_or_sequence_invalid");
  try {
    for (const [index, attempt] of args.attempts.entries()) {
      const request = args.requests[index]!, receipt = attempt.receipt;
      if (attempt.hash !== request.hash || request.hash !== identityDigest({ endpoint: request.endpoint, body: request.body })) {
        return stop("request_hash_invalid");
      }
      if (attempt.state !== "settled" || !receipt) return stop("unsettled_or_uncertain_outcome");
      if (receipt.endpoint !== request.endpoint || !/^[A-Za-z0-9_-]{1,200}$/.test(receipt.requestId ?? "")
        || !/^[A-Za-z0-9_-]{1,200}$/.test(receipt.body?.id ?? "") || receipt.body.error != null
        || priceLunaUsage(receipt.body, receipt.endpoint) !== receipt.chargeNanoUsd
        || receipt.chargeNanoUsd > attempt.reservedNanoUsd) return stop("receipt_or_usage_invalid");
      if (receipt.endpoint === "responses") {
        const body = receipt.body, message = body.output?.[0];
        if (body.status !== "completed" || body.incomplete_details != null || !Array.isArray(body.output)
          || body.output.length !== 1 || message.type !== "message" || message.role !== "assistant"
          || message.status != null && message.status !== "completed" || message.content?.length !== 1
          || message.content[0].type !== "output_text" || typeof message.content[0].text !== "string") return stop("response_protocol_invalid");
      }
    }
    let replayIndex = 0;
    const replay = createLunaTransport({ enabled: true, stopped: () => false,
      apiKey: () => { throw new Error("offline_replay_never_reads_credentials"); },
      fetch: async () => { throw new Error("offline_replay_never_dispatches"); },
      admission: {
        reserve: async (hash) => {
          const attempt = args.attempts[replayIndex++];
          if (!attempt || attempt.hash !== hash || !attempt.receipt) throw new Error("offline_replay_request_mismatch");
          return { status: "replay", receipt: structuredClone(attempt.receipt) };
        },
        settle: async () => { throw new Error("offline_replay_never_settles"); },
        uncertain: async () => { throw new Error("offline_replay_never_mutates_admission"); },
      } });
    const reproduced = await runRetainedTweetLunaReview({ enabled: true, input: args.input, now: () => args.checkedAt,
      transport: async (endpoint, wire, hooks) => {
        // Reconstruct the original new-attempt counter while replaying a saved receipt.
        const receipt = await replay(endpoint, wire); hooks?.onAdmitted?.(); return receipt;
      } });
    if (replayIndex !== args.attempts.length || identityDigest(reproduced) !== identityDigest(args.originalReview)) {
      return stop("original_review_receipt_binding_mismatch");
    }
    const review = args.originalReview;
    if ([review.canPublish, review.canWriteAliases, review.canChangeStatus, review.canExecuteReplacement].some(v => v !== false)) {
      return stop("authority_violation");
    }
    if (review.status === "held") {
      if (args.cliExitCode !== 2 || review.holds.length !== 1 || !COLLECTIBLE_MODEL_HOLDS.some(h => h === review.holds[0])
        || !review.identity || review.goalieStatuses.length !== 0 || review.decisionReview !== null || args.attempts.length !== 1) {
        return stop("noncollectible_validation_or_protocol_failure");
      }
      return { ...base, outcome: "recorded_model_failure" as const, mayAdvanceDiagnosticSequence: true,
        reason: review.holds[0]!, decisionsDisposition: args.input.decisions ? "not_run_original_responses_held" as const : "not_scheduled" as const };
    }
    const ordinaryHolds = ["human_review_required", "no_publication_authority", "identity_abstention_or_widening_requires_review", "retrospective_development_evidence"];
    if (args.cliExitCode !== 0 || review.status !== "review_only" || args.attempts.length !== args.requests.length
      || !review.holds.includes("human_review_required") || !review.holds.includes("no_publication_authority")
      || review.holds.some(h => !ordinaryHolds.includes(h))
      || (args.input.decisions ? review.decisionReview?.status !== "bound_review" : review.decisionReview !== null)) {
      return stop("review_or_decisions_unresolved");
    }
    return { ...base, outcome: score.labelMatch ? "recorded_pass" as const : "recorded_model_failure" as const,
      mayAdvanceDiagnosticSequence: true, reason: score.labelMatch ? "original_grade_pass" : "frozen_label_mismatch",
      decisionsDisposition: args.input.decisions ? "completed_and_bound" as const : "not_scheduled" as const };
  } catch {
    return stop("unclassified_integrity_or_protocol_failure");
  }
}
