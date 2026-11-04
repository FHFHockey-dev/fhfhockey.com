import { z } from "zod";
import { timestampMicros } from "lib/projections/evidenceTime";
import { freezeIdentityValue, identityDigest } from "./playerIdentitySnapshot";
import type { FixtureIdentityRequest } from "./tweetIdentityProposal";
import { LUNA_EVIDENCE_BINDING_POLICY, proposeLunaEvidenceBindingReview } from "./tweetLunaEvidenceBinding";
import { LUNA_REVIEW_AUTHORITY, runRetainedTweetLunaReview } from "./tweetLunaReview";
import { priceLunaUsage, type LunaReceipt, type LunaTransport } from "./tweetLunaTransport";
import type { LunaSuppliedSourcePolicy } from "./tweetLunaReference";
import { sourceClaimTextVersionId } from "./tweetSourceClaimRegistry";

const VERSION = "luna-bound-evidence-review-v1";
type Review = Awaited<ReturnType<typeof runRetainedTweetLunaReview>>;
type Derivation = ReturnType<typeof proposeLunaEvidenceBindingReview>;
type BoundContent = typeof LUNA_REVIEW_AUTHORITY & {
  version: typeof VERSION; canApply: false; createdAt: string; receiptReceivedAt: string;
  originalReviewHash: string; reviewQueueKey: string; originalHolds: string[];
  responsesRequestHash: string; responsesRequest: Record<string, unknown>; sourcePolicy: LunaSuppliedSourcePolicy;
  preparedRequest: FixtureIdentityRequest; receipt: LunaReceipt; receiptHash: string;
  derivation: Derivation; holds: string[];
};
export type LunaBoundEvidenceReview = { content: BoundContent; hash: string };
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const decisionSchema = z.object({ candidateHash: digest, reviewerId: z.string().trim().min(1).max(200),
  reviewedAt: z.string().datetime({ offset: true }), decision: z.enum(["accept_coordinate_proposal", "reject", "defer"]),
  rationale: z.string().trim().min(1).max(2000) }).strict();

function completedOutput(receipt: LunaReceipt): string {
  const body = receipt.body;
  if (receipt.endpoint !== "responses" || !/^[A-Za-z0-9_-]{1,200}$/.test(receipt.requestId ?? "")
    || !/^[A-Za-z0-9_-]{1,200}$/.test(body?.id ?? "") || body.status !== "completed"
    || body.error != null || body.incomplete_details != null || !Array.isArray(body.output)
    || priceLunaUsage(body, "responses") !== receipt.chargeNanoUsd) throw new Error("binding_receipt_invalid");
  const messages = body.output.filter((item: any) => item.type === "message" && item.role === "assistant");
  if (messages.length !== 1 || messages[0].status != null && messages[0].status !== "completed"
    || !Array.isArray(messages[0].content) || messages[0].content.length !== 1
    || messages[0].content[0].type !== "output_text" || typeof messages[0].content[0].text !== "string") throw new Error("binding_receipt_invalid");
  return messages[0].content[0].text;
}

/** Recheck persisted integrity against the separately retained original review.
 * Hashes detect substitution; they do not authenticate a human or an edited local file.
 */
function assertBound(candidate: LunaBoundEvidenceReview, original: Review) {
  const c = candidate.content, p = c.sourcePolicy, s = p.source, source = c.preparedRequest.content.source;
  const sent = JSON.parse(String(c.responsesRequest.input));
  if (candidate.hash !== identityDigest(c) || c.version !== VERSION || c.canApply !== false
    || Object.entries(LUNA_REVIEW_AUTHORITY).some(([k, v]) => (c as any)[k] !== v || (original as any)[k] !== v)
    || c.originalReviewHash !== identityDigest(original) || original.status !== "held"
    || !original.holds.includes("goalie_subject_binding_invalid") || identityDigest(c.originalHolds) !== identityDigest(original.holds)
    || !original.reviewQueueKey || c.reviewQueueKey !== original.reviewQueueKey
    || c.responsesRequestHash !== original.responsesRequestHash || !original.requestIds.includes(c.receipt.requestId)
    || identityDigest(c.responsesRequest) !== c.responsesRequestHash || sent.identityRequestHash !== c.preparedRequest.hash
    || identityDigest(sent.identityRequest) !== identityDigest(c.preparedRequest.content) || identityDigest(sent.sourcePolicy) !== identityDigest(p)
    || c.receiptHash !== identityDigest(c.receipt)
    || !original.lineage || original.lineage.packetHash !== p.packetHash || original.lineage.textVersion !== s.sourceTextVersionId
    || original.lineage.originalPostId !== s.originalPostId || original.lineage.author !== s.author || original.lineage.url !== s.url
    || source.id !== s.retainedSourceId || source.originalPostId !== s.originalPostId || source.authorId !== s.author || source.url !== s.url
    || source.publishedAt !== s.publishedAt || source.receivedAt !== s.ingestedAt
    || source.provenance.label !== `retained-sidecar:${p.packetHash}`
    || s.sourceTextVersionId !== sourceClaimTextVersionId(source.id, source.text)) throw new Error("binding_lineage_invalid");
  const created = timestampMicros(c.createdAt), received = timestampMicros(c.receiptReceivedAt), ingested = timestampMicros(s.ingestedAt);
  const published = timestampMicros(s.publishedAt!), asOf = timestampMicros(p.identityAsOf);
  if (created === null || received === null || ingested === null || published === null || asOf === null
    || published > ingested || ingested > received || received > created || asOf > received
    || timestampMicros(p.identityEvaluation.sourcePublishedAt) !== published) throw new Error("binding_clock_invalid");
  const derived = proposeLunaEvidenceBindingReview({ policy: LUNA_EVIDENCE_BINDING_POLICY,
    request: c.preparedRequest, rawOutputText: completedOutput(c.receipt) });
  const holds = [...original.holds, ...derived.holds,
    ...(p.identityEvaluation.mode === "retrospective" ? ["retrospective_development_evidence"] : [])];
  if (derived.status !== "candidate_for_human_review" || identityDigest(derived) !== identityDigest(c.derivation)
    || identityDigest(original.identity) !== identityDigest(derived.candidate?.identity) || original.goalieStatuses.length !== 0
    || identityDigest(holds) !== identityDigest(c.holds)) throw new Error("binding_derivation_invalid");
}

/** Optional wrapper around the existing caller. It captures only a successfully
 * returned receipt after that caller's retention/clock preparation. It never feeds
 * a correction into the caller, Decisions, score or admission store.
 */
export async function runRetainedTweetLunaReviewWithBinding(args: Parameters<typeof runRetainedTweetLunaReview>[0] & {
  bindingPolicy?: typeof LUNA_EVIDENCE_BINDING_POLICY;
}) {
  if (args.bindingPolicy !== LUNA_EVIDENCE_BINDING_POLICY || args.enabled !== true) {
    return { review: await runRetainedTweetLunaReview(args), bindingStatus: "disabled", candidate: null as LunaBoundEvidenceReview | null };
  }
  const now = args.now ?? (() => new Date().toISOString()), input = structuredClone(args.input);
  const captures: { wire: Record<string, unknown>; receipt: LunaReceipt; receivedAt: string }[] = [];
  const transport: LunaTransport | undefined = args.transport ? async (endpoint, wire, hooks) => {
    const sent = structuredClone(wire), receipt = await args.transport!(endpoint, wire, hooks);
    if (endpoint === "responses") captures.push({ wire: sent, receipt: structuredClone(receipt), receivedAt: now() });
    return receipt;
  } : undefined;
  const review = await runRetainedTweetLunaReview({ ...args, input, transport, now });
  try {
    if (captures.length !== 1 || review.status !== "held" || !review.holds.includes("goalie_subject_binding_invalid")) {
      return { review, bindingStatus: "not_eligible", candidate: null };
    }
    const { wire, receipt, receivedAt } = captures[0]!, envelope = JSON.parse(String(wire.input));
    if (identityDigest(wire) !== review.responsesRequestHash) throw new Error("binding_request_invalid");
    const preparedRequest = { content: envelope.identityRequest, hash: envelope.identityRequestHash } as FixtureIdentityRequest;
    const derivation = proposeLunaEvidenceBindingReview({ policy: args.bindingPolicy, request: preparedRequest, rawOutputText: completedOutput(receipt) });
    if (derivation.status !== "candidate_for_human_review") return { review, bindingStatus: "held", candidate: null };
    const sourcePolicy: LunaSuppliedSourcePolicy = envelope.sourcePolicy;
    const { retainedSourceId, sourceTextVersionId, originalPostId, author, url, publishedAt, ingestedAt, provenance } = input.packet.source;
    if (identityDigest(sourcePolicy.source) !== identityDigest({ retainedSourceId, sourceTextVersionId, originalPostId, author, url, publishedAt, ingestedAt, provenance })) {
      throw new Error("binding_source_invalid");
    }
    const content: BoundContent = { version: VERSION, ...LUNA_REVIEW_AUTHORITY, canApply: false,
      createdAt: now(), receiptReceivedAt: receivedAt, originalReviewHash: identityDigest(review), reviewQueueKey: review.reviewQueueKey!,
      originalHolds: [...review.holds], responsesRequestHash: review.responsesRequestHash!, responsesRequest: wire, sourcePolicy,
      preparedRequest, receipt, receiptHash: identityDigest(receipt), derivation,
      holds: [...review.holds, ...derivation.holds, ...(sourcePolicy.identityEvaluation.mode === "retrospective" ? ["retrospective_development_evidence"] : [])] };
    const candidate = { content, hash: identityDigest(content) };
    assertBound(candidate, review);
    return { review, bindingStatus: "candidate_for_human_review", candidate: freezeIdentityValue(candidate) };
  } catch {
    return { review, bindingStatus: "held", candidate: null };
  }
}

/** Manual feedback only, stored as a new separate artifact by the existing CLI.
 * Acceptance means agreement with proposed coordinates, never application or truth.
 * reviewerId is an operator assertion; this local tool has no authentication UI.
 */
export function recordLunaEvidenceBindingDecision(args: {
  candidate: unknown; originalReview: unknown; decision: unknown; now?: () => string;
}) {
  try {
    const decision = decisionSchema.parse(args.decision), candidate = structuredClone(args.candidate) as LunaBoundEvidenceReview;
    const original = structuredClone(args.originalReview) as Review;
    if (Buffer.byteLength(JSON.stringify(candidate)) > 1_500_000 || decision.candidateHash !== candidate.hash) throw new Error("invalid_binding_decision");
    assertBound(candidate, original);
    const recordedAt = (args.now ?? (() => new Date().toISOString()))(), recorded = timestampMicros(recordedAt);
    const reviewed = timestampMicros(decision.reviewedAt), created = timestampMicros(candidate.content.createdAt);
    if (recorded === null || reviewed === null || created === null || reviewed < created || reviewed > recorded) throw new Error("invalid_binding_decision_clock");
    const content = { version: "luna-evidence-binding-decision-v1", ...LUNA_REVIEW_AUTHORITY, canApply: false,
      ...decision, recordedAt, originalReviewHash: candidate.content.originalReviewHash, receiptHash: candidate.content.receiptHash,
      preparedRequestHash: candidate.content.preparedRequest.hash, sourceTextVersionId: candidate.content.sourcePolicy.source.sourceTextVersionId,
      reviewQueueKey: candidate.content.reviewQueueKey, bindingPolicy: LUNA_EVIDENCE_BINDING_POLICY,
      scope: "coordinate_proposal_feedback_only", holds: [...candidate.content.holds] } as const;
    return freezeIdentityValue({ status: "recorded_for_review" as const, record: { content, hash: identityDigest(content) } });
  } catch {
    return { status: "held" as const, reason: "invalid_binding_decision", record: null };
  }
}
