import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { isNewsRelayAccount } from "lib/newsFeed";
import { timestampMicros } from "lib/projections/evidenceTime";
import { claimHash } from "./tweetClaimExtraction";
import { sourceClaimTextVersionId } from "./tweetSourceClaimRegistry";
import { tweetClaimAttribution } from "./tweetSourceDirectory";
import { TWEET_REVIEW_PACKET_VERSION, type TweetReviewPacket } from "./tweetReviewSidecar";
import { buildRequest, DEFAULT_CONFIG, MODEL, PROMPT_VERSION, type ReferenceClaim, type ReferenceInput } from "./decisionsReference/adapter.mjs";

export const DECISION_REVIEW_BINDING_VERSION = "tweet-decision-review-binding-v1";
export const DECISION_STATEMENT_VERSION = "tweet-decision-statement-v1";
export const DECISION_REFERENCE_SHA256 = "055bc80ccf9874de8a976da6106bc34af15e424d6b905d39fccf57ecfd2b92a1";
export const REVIEW_ONLY_AUTHORITY = { mode: "review_only", canPublish: false, canChangeStatus: false, providerDispatchEnabled: false } as const;
type Candidate = TweetReviewPacket["candidates"][number];
export type DecisionStatementBinding = {
  version: typeof DECISION_STATEMENT_VERSION;
  observationId: string; sourceId: string; sourceTextVersionId: string; extractionVersion: string; playerId: number;
  statement: string;
  proposition: Pick<Candidate, "fact" | "scope" | "modality" | "effectiveAt">;
  evidence: Candidate["evidence"];
};
export type HeldDecisionCandidate = { candidateIndex: number; observationId: string | null; reasons: string[] };
export const referenceDigest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const id = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const clock = (value: unknown) => typeof value === "string" ? timestampMicros(value) : null;
function frozen<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(frozen);
    Object.freeze(value);
  }
  return value;
}
function spanMatches(source: string, span: Candidate["evidence"]) {
  const boundary = (n: number) => n <= 0 || n >= source.length || !(source.charCodeAt(n - 1) >= 0xd800
    && source.charCodeAt(n - 1) <= 0xdbff && source.charCodeAt(n) >= 0xdc00 && source.charCodeAt(n) <= 0xdfff);
  return span && Number.isSafeInteger(span.start) && Number.isSafeInteger(span.end) && span.start >= 0
    && span.end > span.start && span.end <= source.length && boundary(span.start) && boundary(span.end)
    && source.slice(span.start, span.end) === span.text;
}
function propositionOf(c: Candidate) {
  return { fact: c.fact, scope: c.scope, modality: c.modality, effectiveAt: c.effectiveAt };
}
function validProposition(c: Candidate) {
  if (!["asserted", "uncertain", "projected", "observation"].includes(c.modality)
    || (c.effectiveAt !== null && clock(c.effectiveAt) === null)) return false;
  const s = c.scope, f = c.fact;
  if (!s || !id(s.teamId) || !f || !("playerId" in f) || !id(f.playerId)) return false;
  if (s.kind === "game") {
    if (!id(s.gameId) || !["entry", "in_game"].includes(s.phase) || !(s.group === null || text(s.group))) return false;
  } else if (s.kind === "session") {
    if (!text(s.sessionId) || !/^\d{4}-\d{2}-\d{2}$/.test(s.date) || clock(`${s.date}T00:00:00Z`) === null
      || !(s.group === null || text(s.group))) return false;
  } else if (s.kind === "effective_period") {
    const start = clock(s.startsAt), end = clock(s.endsAt);
    if (!text(s.periodId) || start === null || end === null || start >= end) return false;
  } else return false;
  if (f.kind === "availability") return s.kind === "game" && ["available", "out"].includes(f.status);
  if (f.kind === "starter") return s.kind === "game";
  if (f.kind === "transaction") return s.kind === "effective_period" && ["ir", "ltir", "recall", "assignment", "reassignment"].includes(f.action);
  return f.kind === "observation" && s.kind !== "effective_period" && ["practice", "warmup", "first_off"].includes(f.activity) && typeof f.present === "boolean";
}
function sourceReasons(packet: TweetReviewPacket) {
  const reasons = [...packet.holds, ...packet.wholePost.holds];
  const s = packet.source, r = packet.receiptSnapshot;
  if (packet.version !== TWEET_REVIEW_PACKET_VERSION) reasons.push("packet_version_mismatch");
  if (packet.mode !== "review_only" || packet.canPublish !== false || packet.canChangeStatus !== false
    || packet.providerDispatchEnabled !== false) reasons.push("invalid_review_authority");
  if (!["line_source_ifttt_events", "lines_ccc_ifttt_events"].includes(r.eventTable) || !text(r.id) || !text(r.eventId)
    || s.retainedSourceId !== `${r.eventTable}:${r.eventId}` || s.sourceTextVersionId !== sourceClaimTextVersionId(s.retainedSourceId, s.text)
    || !text(s.text) || s.text !== r.inputRow.text || s.sourceTextIsUntrustedData !== true) reasons.push("retained_source_mismatch");
  const published = clock(s.publishedAt), ingested = clock(s.ingestedAt);
  if (published === null || ingested === null || published > ingested || ingested !== clock(r.receivedAt)) reasons.push("source_clock_unresolved");
  // Reconstruct only attribution's retained wrapper/raw inputs, not a new parser,
  // publication clock or authenticated-enrichment assertion.
  const retainedAttribution = tweetClaimAttribution({ tweetId: r.inputRow.tweet_id, sourceUrl: r.inputRow.link_to_tweet,
    rawText: r.inputRow.text, rawPayload: r.inputRow.raw_payload, tweetPostedAt: r.inputRow.tweet_created_at } as Parameters<typeof tweetClaimAttribution>[0]);
  const a = s.provenance.attribution;
  if (a.status !== "resolved" || retainedAttribution.status !== "resolved" || !a.original
    || !isDeepStrictEqual(a.original, retainedAttribution.original) || a.relationship !== retainedAttribution.relationship
    || a.originalTweetId !== retainedAttribution.originalTweetId || s.originalPostId !== a.originalTweetId
    || s.url !== retainedAttribution.originalUrl || a.originalUrl !== s.url
    || clock(retainedAttribution.originalPublishedAt) !== published || clock(a.originalPublishedAt) !== published
    || !text(s.author) || s.author !== a.original.handle || isNewsRelayAccount(s.author)
    || ["null", "undefined", "unknown", "i"].includes(s.author.toLowerCase())
    || !text(a.original.accountKey)) reasons.push("original_source_unresolved");
  return [...new Set(reasons)];
}

/** Pure, default-off request preparation for the retained reference interface.
 * Statements are explicit proposals, not generated prose or accepted native facts.
 * No transport/factory, environment, database, worker or publication path is used.
 */
export function mapTweetDecisionReview(args: {
  enabled?: boolean; packet: TweetReviewPacket; extractionVersion: string; statements?: readonly DecisionStatementBinding[];
}) {
  if (args.enabled !== true) return { ...REVIEW_ONLY_AUTHORITY, status: "disabled" as const, request: null };
  const held = (reasons: string[], candidates: HeldDecisionCandidate[] = [], count = candidates.length) =>
    frozen({ ...REVIEW_ONLY_AUTHORITY, status: "held" as const, reasons, request: null, candidateCount: count, heldCandidates: candidates });
  try {
    const p = args.packet;
    if (!p || !Array.isArray(p.holds) || !Array.isArray(p.wholePost?.holds) || !Array.isArray(p.candidates)
      || !p.holds.every(text) || !p.wholePost.holds.every(text)) return held(["invalid_packet"]);
    const inherited = p.candidates.map((c, candidateIndex) => ({ candidateIndex, observationId: c?.observationId ?? null,
      reasons: Array.isArray(c?.holds) ? [...c.holds] : ["invalid_candidate"] }));
    const reasons = sourceReasons(p);
    if (!text(args.extractionVersion) || ["unspecified", "unknown"].includes(args.extractionVersion)) reasons.push("extraction_version_missing");
    if (!Number.isSafeInteger(p.candidateCount) || p.candidateCount < 0 || p.candidateCount !== p.candidates.length
      || p.candidates.length > 99 || p.candidatesOmitted !== null) reasons.push("candidate_count_or_overflow_unresolved");
    if (reasons.length) return held(reasons, inherited, p.candidateCount);
    if (args.statements !== undefined && !Array.isArray(args.statements)) return held(["invalid_statement_bindings"], inherited, p.candidateCount);
    const statements = args.statements ?? [], heldCandidates: HeldDecisionCandidate[] = [], claims: ReferenceClaim[] = [];
    const bindings: { candidateIndex: number; observationId: string; playerId: number; statement: string; statementBindingHash: string }[] = [];
    const counts = new Map<string, number>();
    for (const c of p.candidates) counts.set(c.observationId, (counts.get(c.observationId) ?? 0) + 1);
    for (const [candidateIndex, c] of p.candidates.entries()) {
      const holds = Array.isArray(c.holds) && c.holds.every(text) ? [...c.holds] : ["invalid_candidate_holds"];
      if (!text(c.observationId) || counts.get(c.observationId) !== 1) holds.push("ambiguous_observation_identity");
      if (c.extractionVersion !== args.extractionVersion) holds.push("claim_extraction_version_mismatch");
      const playerId = c.canonicalPlayerIds?.[0];
      if (!Array.isArray(c.canonicalPlayerIds) || c.canonicalPlayerIds.length !== 1 || !id(playerId)) holds.push("single_player_identity_required");
      if (!validProposition(c) || !c.fact || !("playerId" in c.fact) || c.fact.playerId !== playerId) holds.push("proposition_or_player_mismatch");
      if (!spanMatches(p.source.text, c.evidence) || !c.anchor || !spanMatches(p.source.text, c.anchor.subjectSpan)
        || !spanMatches(p.source.text, c.anchor.predicateSpan)) holds.push("invalid_exact_utf16_span");
      const matches = statements.filter(s => s?.observationId === c.observationId);
      const s = matches[0];
      if (matches.length !== 1) holds.push(matches.length ? "ambiguous_statement_binding" : "statement_missing");
      else if (s.version !== DECISION_STATEMENT_VERSION || s.sourceId !== p.source.retainedSourceId
        || s.sourceTextVersionId !== p.source.sourceTextVersionId || s.extractionVersion !== c.extractionVersion || s.playerId !== playerId
        || !text(s.statement) || !isDeepStrictEqual(s.proposition, propositionOf(c)) || !isDeepStrictEqual(s.evidence, c.evidence)) holds.push("statement_binding_mismatch");
      if (holds.length) { heldCandidates.push({ candidateIndex, observationId: c.observationId ?? null, reasons: [...new Set(holds)] }); continue; }
      claims.push({ id: c.observationId, sourceId: p.source.retainedSourceId, playerId: String(playerId), statement: s.statement,
        sourceSpan: { start: c.evidence.start, end: c.evidence.end, quote: c.evidence.text } });
      bindings.push({ candidateIndex, observationId: c.observationId, playerId, statement: s.statement,
        statementBindingHash: claimHash({ candidate: c, statement: s }) });
    }
    const unboundStatements = statements.flatMap((s, statementIndex) => counts.has(s?.observationId) ? [] : [{ statementIndex,
      observationId: typeof s?.observationId === "string" ? s.observationId : null, reason: "observation_not_in_packet" }]);
    const input: ReferenceInput = { source: { id: p.source.retainedSourceId, text: p.source.text,
      authorId: p.source.provenance.attribution.original!.accountKey, url: p.source.url!,
      publishedAt: p.source.publishedAt!, ingestedAt: p.source.ingestedAt }, claims, extractionVersion: args.extractionVersion };
    const built = buildRequest(input);
    if (built.invalidClaims.length) return held(["reference_binding_rejected"], inherited, p.candidateCount);
    const requestBytes = Buffer.byteLength(JSON.stringify(built.request));
    if (requestBytes > DEFAULT_CONFIG.maxInputBytesPerRequest) return held(["reference_request_byte_limit"], inherited, p.candidateCount);
    const referenceAudit = { sourceId: input.source.id, sourceHash: referenceDigest(built.evidence.source), claimsHash: referenceDigest(built.evidence.claims),
      evidenceHash: referenceDigest(built.evidence), requestHash: referenceDigest(built.request),
      idempotencyKey: referenceDigest({ evidence: built.evidence, invalidClaims: [], model: MODEL, promptVersion: PROMPT_VERSION, calibration: null }),
      claimBindings: built.evidence.claims.map(c => ({ claimId: c.id, sourceId: c.sourceId, playerId: c.playerId, sourceSpan: c.sourceSpan,
        questionNames: [`claim_${c.index}_support`, `claim_${c.index}_wording`] })) };
    const identity = { bindingVersion: DECISION_REVIEW_BINDING_VERSION, referenceSha256: DECISION_REFERENCE_SHA256,
      packetHash: claimHash(p), sourceTextVersionId: p.source.sourceTextVersionId, receiptId: p.receiptSnapshot.id,
      extractionVersion: args.extractionVersion, bindings, heldCandidates, unboundStatements, requestHash: referenceAudit.requestHash };
    return frozen({ ...REVIEW_ONLY_AUTHORITY, status: "mapped" as const, ...identity, planHash: claimHash(identity),
      candidateCount: p.candidateCount, input: structuredClone(input), request: structuredClone(built.request), requestBytes,
      referenceAudit: structuredClone(referenceAudit), model: MODEL, promptVersion: PROMPT_VERSION });
  } catch {
    return held(["invalid_packet_or_statement_binding"]);
  }
}

export type MappedDecisionReview = Extract<ReturnType<typeof mapTweetDecisionReview>, { status: "mapped" }>;
