import { timestampMicros } from "lib/projections/evidenceTime";
import { freezeIdentityValue, identityDigest } from "../playerIdentitySnapshot";
import { projectSavedPlayerIdentityEvidence } from "../playerIdentitySnapshotEvidence";
import { exactIdentitySpan } from "../tweetIdentityProposal";
import { getLunaReferencePackage } from "../tweetLunaReference";
import type { LunaReviewInput } from "../tweetLunaReview";
import { prepareTweetReviewPacket } from "../tweetReviewSidecar";
import { jobIdSchema, validateHostedLunaJob } from "./contract";

type Material = Parameters<typeof prepareTweetReviewPacket>[0] & {
  jobId: string;
  provenanceRef: string;
  preparedAt: string;
  extractionVersion: string;
  statements: LunaReviewInput["statements"];
  identity: NonNullable<LunaReviewInput["identity"]>;
};
const authority = {
  canEnqueue: false, providerDispatchEnabled: false, canPublish: false,
  canChangeStatus: false, canWriteAliases: false, sourceAuthenticated: false,
} as const;
const reviewRequirements = [
  "immutable_retention_and_admission_proof_required",
  "original_source_and_processing_scope_review_required",
  "dated_identity_provenance_review_required",
  "owner_staging_approval_required",
] as const;

/** Pure local preparation only. Supplied receipt/provenance fields establish
 * consistency, never authentication. No caller can clear the review requirements.
 * Preparation is not worker eligibility: strict mention metadata/hint validation
 * and provider admission still run downstream. A draft is not an enqueue request
 * and has no database/provider dependency.
 */
export function prepareHostedLunaDraft(args: { enabled?: boolean; material?: Material }) {
  if (args.enabled !== true) return { ...authority, status: "disabled" as const, draft: null };
  try {
    if (!args.material || Buffer.byteLength(JSON.stringify(args.material)) > 512_000) throw new Error();
    const m = structuredClone(args.material);
    const id = jobIdSchema.parse(m.jobId);
    // Require UUID-shaped database identifiers, not proof of retention. Never
    // invent a receipt UUID from a post ID or promote a legacy event to admission.
    jobIdSchema.parse(m.receipt.id);
    jobIdSchema.parse(m.receipt.eventId);
    const packet = prepareTweetReviewPacket({ receipt: m.receipt, source: m.source, claims: m.claims });
    const input: LunaReviewInput = { packet, extractionVersion: m.extractionVersion,
      statements: m.statements, identity: m.identity, decisions: false, referenceMode: "rules-and-synthetic-only" };
    const prepared = timestampMicros(m.preparedAt), received = timestampMicros(packet.source.ingestedAt);
    const asOf = timestampMicros(m.identity.asOf), published = timestampMicros(packet.source.publishedAt ?? "");
    if (prepared === null || received === null || asOf === null || published === null
      || prepared < received || prepared < asOf || m.identity.evaluation.mode !== "causal_as_of"
      || timestampMicros(m.identity.evaluation.sourcePublishedAt) !== published) throw new Error();
    const projection = projectSavedPlayerIdentityEvidence(m.identity.evidence, {
      asOf: m.identity.asOf, evaluation: m.identity.evaluation,
    });
    if (!projection.snapshot.content.rows.length) throw new Error();
    const mentions = m.identity.mentions;
    if (!Array.isArray(mentions) || !mentions.length || mentions.length > 32
      || new Set(mentions.map(mention => mention.id)).size !== mentions.length
      || mentions.some(mention => !exactIdentitySpan(packet.source.text, mention.span))) throw new Error();
    const ordered = [...mentions].sort((a, b) => a.span.start - b.span.start);
    if (ordered.some((mention, i) => i > 0 && mention.span.start < ordered[i - 1]!.span.end)) throw new Error();
    const envelope = { id, inputJson: JSON.stringify(input), inputHash: identityDigest(input),
      referenceHash: getLunaReferencePackage("rules-and-synthetic-only").hash,
      receiptJson: JSON.stringify(m.receipt), receiptHash: identityDigest(m.receipt), provenanceRef: m.provenanceRef };
    // Reuse the worker's exact validator. It deliberately does not authenticate
    // provenance; full request preparation and admission still happen downstream.
    validateHostedLunaJob(envelope, id);
    const draft = { version: "luna-hosted-draft-v1", preparedAt: m.preparedAt,
      envelope, identityProjectionHash: projection.hash, reviewRequirements };
    return freezeIdentityValue({ ...authority, status: "prepared_for_owner_review" as const,
      draft, draftHash: identityDigest(draft) });
  } catch {
    // No source bodies, malformed input or internal exception text in failures.
    return { ...authority, status: "held" as const, reason: "invalid_or_unresolved_draft", draft: null };
  }
}
