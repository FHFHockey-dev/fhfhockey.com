import { z } from "zod";
import { timestampMicros } from "lib/projections/evidenceTime";
import { identityDigest, indexPlayerIdentitySnapshot } from "./playerIdentitySnapshot";
import { projectSavedPlayerIdentityEvidence, type IdentityEvidenceEvaluation } from "./playerIdentitySnapshotEvidence";
import { exactIdentitySpan, prepareFixtureIdentityRequest, validateFixtureIdentityProposal,
  type FixtureIdentityMention, type FixtureIdentityRequest } from "./tweetIdentityProposal";
import { mapTweetDecisionReview, DECISION_REVIEW_BINDING_VERSION, type DecisionStatementBinding } from "./tweetDecisionReviewMapping";
import { validateTweetDecisionReviewResult } from "./tweetDecisionReviewResults";
import { createShadowAdapter } from "./decisionsReference/adapter.mjs";
import { LUNA_MODEL, type LunaTransport } from "./tweetLunaTransport";
import type { TweetReviewPacket } from "./tweetReviewSidecar";
import { extractTweetPlayerEvents } from "./tweetPlayerEvents";

export const LUNA_REVIEW_VERSION = "ifttt-luna-review-v1";
export const LUNA_REVIEW_AUTHORITY = { canPublish: false, canWriteAliases: false, canChangeStatus: false, canExecuteReplacement: false } as const;
const span = z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive(), text: z.string().min(1) }).strict();
const statuses = z.array(z.object({ occurrenceId: z.string(), canonicalId: z.string(),
  status: z.enum(["confirmed", "ruled_out", "likely", "projected", "unknown"]), evidence: span,
}).strict()).max(32);
export type LunaReviewInput = {
  packet: TweetReviewPacket; extractionVersion: string; statements: DecisionStatementBinding[];
  identity?: { evidence: unknown; evaluation: IdentityEvidenceEvaluation; asOf: string; mentions: FixtureIdentityMention[] };
  decisions?: boolean;
};

function responsesWire(request: FixtureIdentityRequest) {
  const enumString = (values: string[]) => ({ type: "string", enum: values });
  const object = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
  const evidence = object({ start: { type: "integer" }, end: { type: "integer" }, text: { type: "string" } });
  const occurrenceIds = request.content.occurrences.map(o => o.id);
  const ids = [...new Set(request.content.occurrences.flatMap(o => o.candidateSet.candidates.map(c => c.row.canonicalId)))];
  const schema = object({ identity: object({ version: enumString([request.content.version]), requestHash: enumString([request.hash]),
    directoryHash: enumString([request.content.directory.hash]), occurrences: { type: "array", items: object({
      occurrenceId: enumString(occurrenceIds), canonicalId: { type: ["string", "null"], enum: [...ids, null] },
      status: enumString(["matched", "ambiguous", "missing", "conflicting", "not_player", "needs_widening"]),
      evidence, identityConfidence: enumString(["strong", "tentative", "unknown"]),
    }) } }), goalieStatuses: { type: "array", items: object({ occurrenceId: enumString(occurrenceIds),
    canonicalId: { type: "string" }, status: enumString(["confirmed", "ruled_out", "likely", "projected", "unknown"]), evidence }) } });
  return { model: LUNA_MODEL, input: JSON.stringify(request.content),
    instructions: `${request.content.instructions.join("\n")}\nReturn {identity,goalieStatuses}. Identity follows the supplied identity contract. Optional goalieStatuses classify source wording only, never verified world truth. Each exact evidence span must contain just its named subject, not another occurrence. Never invent game/team/time fields. First-off, practice and uncertainty cannot confirm a start. No injury statement may bind to another subject. Return an empty goalieStatuses array when unsupported.`,
    text: { format: { type: "json_schema", name: "ifttt_luna_review_v1", strict: true, schema } } };
}

/** Validates a proposal, not truth. Verified 100/0 must come through the existing accepted-evidence workflow. */
export function validateLunaGoalieStatuses(request: FixtureIdentityRequest, identity: ReturnType<typeof validateFixtureIdentityProposal>, value: unknown) {
  const result = statuses.parse(value);
  if (new Set(result.map(s => s.occurrenceId)).size !== result.length) throw new Error("duplicate_goalie_subject");
  return result.map(proposal => {
    const occurrence = request.content.occurrences.find(o => o.id === proposal.occurrenceId);
    const selected = identity.occurrences.find(o => o.occurrenceId === proposal.occurrenceId);
    const candidate = occurrence?.candidateSet.candidates.find(c => c.row.canonicalId === proposal.canonicalId);
    if (!occurrence || selected?.status !== "matched" || selected.canonicalId !== proposal.canonicalId
      || !candidate?.row.positions.includes("G") || !exactIdentitySpan(request.content.source.text, proposal.evidence)
      || proposal.evidence.start > occurrence.span.start || proposal.evidence.end < occurrence.span.end
      || request.content.occurrences.some(o => o.id !== occurrence.id && o.span.start < proposal.evidence.end && o.span.end > proposal.evidence.start)) {
      throw new Error("goalie_subject_binding_invalid");
    }
    if (["confirmed", "ruled_out"].includes(proposal.status)
      && /\b(first off|first (?:goalie|goaltender) off|practice|morning skate|could|might|may|likely|projected|expected|probably|if|not confirmed|no decision|undecided)\b|\?/iu.test(proposal.evidence.text)) {
      throw new Error("goalie_certainty_inflation");
    }
    if (["confirmed", "ruled_out"].includes(proposal.status)) {
      const literal = extractTweetPlayerEvents({ text: proposal.evidence.text, publishedAt: request.content.source.publishedAt,
        players: [{ playerId: candidate.row.nhlPlayerId, fullName: candidate.row.fullName, lastName: candidate.row.lastName,
          position: "G", aliases: [occurrence.span.text] }] });
      if (!literal.some(e => e.kind === "goalie" && e.playerId === candidate.row.nhlPlayerId && e.state === proposal.status)) {
        throw new Error("goalie_definite_wording_unsupported");
      }
    }
    return { ...proposal, verified: false as const, gameId: null, teamId: null, appliedOverride: null,
      policyFloorAfterAcceptance: proposal.status === "likely" ? 0.8 : proposal.status === "projected" ? 0.65 : null,
      holds: ["human_review_required", "game_and_source_time_binding_required", "conflict_retraction_check_required"] };
  });
}

function outputJson(body: any) {
  if (body.status !== "completed" || !Array.isArray(body.output)) throw new Error("luna_response_incomplete");
  const content = body.output.flatMap((item: any) => item.type === "message" && item.role === "assistant" && Array.isArray(item.content) ? item.content : []);
  if (content.length !== 1 || content[0].type !== "output_text" || typeof content[0].text !== "string") throw new Error("luna_response_shape");
  return z.object({ identity: z.unknown(), goalieStatuses: z.unknown() }).strict().parse(JSON.parse(content[0].text));
}

/** Explicit post-retention caller. Deterministic packet is immutable; Luna suggestions
 * are never fed back as canonical claims to the reviewer or to the publication path.
 * One Responses call and optionally one Decisions call; no paid widening/retries.
 */
export async function runRetainedTweetLunaReview(args: {
  enabled?: boolean; input: LunaReviewInput; transport?: LunaTransport; now?: () => string;
}) {
  const base = { version: LUNA_REVIEW_VERSION, ...LUNA_REVIEW_AUTHORITY, status: "disabled", holds: [] as string[],
    lineage: null as null | { originalPostId: string | null; author: string | null; url: string | null; textVersion: string; packetHash: string },
    identity: null as ReturnType<typeof validateFixtureIdentityProposal> | null,
    goalieStatuses: [] as ReturnType<typeof validateLunaGoalieStatuses>, decisionReview: null as ReturnType<typeof validateTweetDecisionReviewResult> | null,
    attempts: 0, requestIds: [] as (string | null)[], reviewQueueKey: null as string | null };
  if (args.enabled !== true) return base;
  const now = args.now ?? (() => new Date().toISOString());
  try {
    const input = structuredClone(args.input), packet = input.packet;
    if (Buffer.byteLength(JSON.stringify(input)) > 512_000) throw new Error("review_input_too_large");
    const mapped = mapTweetDecisionReview({ enabled: true, packet, extractionVersion: input.extractionVersion, statements: input.statements });
    if (mapped.status !== "mapped") return { ...base, status: "held", holds: ["retained_packet_unresolved"] };
    if (timestampMicros(now()) === null || timestampMicros(now())! < timestampMicros(packet.source.ingestedAt)!) throw new Error("review_clock_invalid");
    base.lineage = { originalPostId: packet.source.originalPostId, author: packet.source.author, url: packet.source.url,
      textVersion: packet.source.sourceTextVersionId, packetHash: mapped.packetHash };
    base.reviewQueueKey = identityDigest([LUNA_REVIEW_VERSION, mapped.packetHash, input]);
    base.status = "review_only";
    if (!args.transport) return { ...base, status: "held", holds: ["explicit_transport_required"] };
    if (input.identity) {
      const id = input.identity;
      if (timestampMicros(id.evaluation.sourcePublishedAt) !== timestampMicros(packet.source.publishedAt!)
        || timestampMicros(id.asOf) === null || timestampMicros(id.asOf)! > timestampMicros(now())!) throw new Error("identity_source_clock_mismatch");
      // Rebuild for this source: never reuse a later-cutoff bare snapshot.
      const projection = projectSavedPlayerIdentityEvidence(id.evidence, { asOf: id.asOf, evaluation: id.evaluation });
      const index = indexPlayerIdentitySnapshot(projection.snapshot);
      if (!index.snapshot.content.rows.length) throw new Error("dated_identity_evidence_unavailable");
      const prepared = prepareFixtureIdentityRequest({ enabled: true, index, mentions: id.mentions, source: {
        id: packet.source.retainedSourceId, text: packet.source.text, originalPostId: packet.source.originalPostId!,
        authorId: packet.source.author!, url: packet.source.url!, publishedAt: packet.source.publishedAt, receivedAt: packet.source.ingestedAt,
        provenance: { kind: "approved_local", label: `retained-sidecar:${mapped.packetHash}`, lineageKey: packet.source.originalPostId! },
      } });
      if (prepared.status !== "prepared") throw new Error("identity_preparation_held");
      const receipt = await args.transport("responses", responsesWire(prepared.request), { onAdmitted: () => { base.attempts++; } });
      base.requestIds.push(receipt.requestId);
      const raw = outputJson(receipt.body);
      base.identity = validateFixtureIdentityProposal(prepared.request, raw.identity);
      base.goalieStatuses = validateLunaGoalieStatuses(prepared.request, base.identity, raw.goalieStatuses);
      if (base.identity.occurrences.some(o => o.status !== "matched")) base.holds.push("identity_abstention_or_widening_requires_review");
      if (projection.evaluation.mode === "retrospective") base.holds.push("retrospective_development_evidence");
    }
    if (input.decisions === true) {
      const transport = args.transport;
      let transportError: unknown = null;
      const adapter = createShadowAdapter({ now, config: { enabled: true, maxRequests: 1, maxInputTokens: 70_000,
        maxEstimatedUsd: 1, maxInputBytesPerRequest: 65_536, maxReservedTokensPerRequest: 70_000, timeoutMs: 16_000 },
      transport: async (request) => {
        try {
          const receipt = await transport("decisions", request, { onAdmitted: () => { base.attempts++; } });
          base.requestIds.push(receipt.requestId);
          return { body: receipt.body, requestId: receipt.requestId ?? undefined };
        } catch (error) { transportError = error; throw error; }
      } });
      const sidecar = await adapter.evaluate(mapped.input);
      base.decisionReview = validateTweetDecisionReviewResult(mapped, { bindingVersion: DECISION_REVIEW_BINDING_VERSION,
        planHash: mapped.planHash, packetHash: mapped.packetHash, sidecar });
      if (base.decisionReview.status !== "bound_review") base.holds.push("decisions_unresolved");
      // The adapter absorbs transport errors as unknown/skipped; an unusable leg is held, never review_only.
      if (base.decisionReview.status === "unknown") throw transportError ?? new Error("decisions_reference_unavailable");
    }
    base.holds.push("human_review_required", "no_publication_authority");
    return base;
  } catch (error) {
    // Do not propagate provider errors, input text or credentials into operational logs.
    const safeReasons = new Set(["review_input_too_large", "review_clock_invalid", "identity_source_clock_mismatch",
      "dated_identity_evidence_unavailable", "identity_preparation_held", "goalie_subject_binding_invalid", "goalie_certainty_inflation",
      "goalie_definite_wording_unsupported", "luna_response_incomplete", "luna_response_shape", "luna_dispatch_disabled",
      "luna_budget_stopped", "luna_budget_exhausted", "luna_unsettled_attempt", "luna_attempt_held_no_retry", "luna_request_too_large", "decisions_reference_unavailable"]);
    const reason = error instanceof Error && safeReasons.has(error.message) ? error.message : "invalid_or_unavailable_review";
    return { ...base, status: "held", holds: [...base.holds, reason] };
  }
}
