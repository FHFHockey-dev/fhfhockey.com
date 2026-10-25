import { z } from "zod";
import { timestampMicros } from "lib/projections/evidenceTime";
import { getAliasReviewOccurrence, type AliasReviewName } from "./playerAliasReview";
import { resolvePlayerIdentity } from "./playerIdentity";
import { identityDigest, indexPlayerIdentitySnapshot, snapshotRowAtSource, type PlayerIdentityIndex } from "./playerIdentitySnapshot";
import { segmentPlayerRow } from "./tweetInterpretation";
import { buildTweetNewsInferencePlayerCandidates } from "./tweetNewsInference";
import { IDENTITY_PROPOSAL_AUTHORITY, exactIdentitySpan, prepareFixtureIdentityRequest, proposeFixtureTweetIdentities,
  validateFixtureIdentityProposal, type FixtureIdentityMention, type FixtureIdentitySource, type FixtureIdentityTransport,
  type IdentitySourceSpan, type TweetIdentityOccurrenceProposal } from "./tweetIdentityProposal";

export const LOCAL_IDENTITY_REVIEW_VERSION = "local-alias-identity-review-v1";
const rowSchema = z.object({
  raw_name: z.string().min(1).max(200), context_text: z.string().max(16000).nullable(), team_id: z.number().int().positive().nullable(),
  metadata: z.object({
    contextAlias: z.string().max(200).nullable().optional(), reason: z.string().optional(), reviewKind: z.string().optional(),
    evidence: z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive(), text: z.string().optional(),
      origin: z.enum(["parser", "unique_token", "contextual_row"]).optional() }).optional(),
    situation: z.string().nullable().optional(), sourceOrdinal: z.number().int().positive().nullable().optional(),
    captureKey: z.string().optional(), sourcePublishedAt: z.string().nullable().optional(), candidates: z.array(z.number()).optional(),
  }).nullable().optional(),
});
type LocalHold = { rowIndex: number; reason: string };
export type LocalIdentityOccurrence = {
  id: string; span: IdentitySourceSpan; origin: "existing_alias_occurrence" | "unique_directory_segmentation";
  baselineCandidateIds: string[]; baselineSelectedId: string | null;
  candidateIds: string[]; deterministicSelectedId: string | null;
  modelCandidateIds: string[];
  candidateTruncated: boolean; activeMembership: "known" | "unknown" | "conflicting";
  modelProposal: TweetIdentityOccurrenceProposal | null;
};
export type LocalIdentityReviewResult = typeof IDENTITY_PROPOSAL_AUTHORITY & {
  version: typeof LOCAL_IDENTITY_REVIEW_VERSION; status: "disabled" | "held" | "evaluated"; reason: string | null;
  sourceHash: string | null; directoryHash: string | null; lineageKey: string | null;
  occurrences: LocalIdentityOccurrence[]; holds: LocalHold[]; notes: string[];
  modelMode: "not_run" | "mock"; modelStatus: string; modelReason: string | null; attempts: number; requestHashes: string[];
};

/** Explicit role syntax only: bare letters may be initials; handles/hashtags are not roles. */
function adjacentPositionHint(text: string, span: IdentitySourceSpan): FixtureIdentityMention["positionHint"] {
  const start = text.lastIndexOf("\n", span.start - 1) + 1;
  const before = text.slice(start, span.start).match(/(?:^|[\s(])((?:LW|RW|G|D|C|L|R|F)):\s+$/u);
  const after = text.slice(span.end).match(/^\s+\((LW|RW|G|D|C|L|R|F)\)/u);
  const position = before?.[1] ?? after?.[1];
  if (!position) return null;
  const offset = before ? span.start - before[0].length + before[0].indexOf(position) : span.end + after![0].indexOf(position);
  return { position, evidence: { start: offset, end: offset + position.length, text: position } };
}

/** Local-only caller for retained alias-review rows. No production route imports this module. */
export async function evaluateLocalAliasIdentityReview(args: {
  enabled?: boolean; source: FixtureIdentitySource; index: PlayerIdentityIndex; rows: AliasReviewName[];
  resolver?: { enabled?: boolean; kind: "mock"; transport: FixtureIdentityTransport };
}): Promise<LocalIdentityReviewResult> {
  const base: LocalIdentityReviewResult = { ...IDENTITY_PROPOSAL_AUTHORITY, version: LOCAL_IDENTITY_REVIEW_VERSION,
    status: "disabled", reason: "local_evaluation_disabled", sourceHash: null, directoryHash: null, lineageKey: null,
    occurrences: [], holds: [], notes: [], modelMode: "not_run", modelStatus: "disabled", modelReason: null, attempts: 0, requestHashes: [] };
  if (args.enabled !== true) return base;
  const held = (reason: string) => ({ ...base, status: "held" as const, reason });
  try {
    if (args.resolver?.enabled === true) {
      if (args.resolver.kind !== "mock") return held("paid_trial_preflight_not_integrated");
      base.modelMode = "mock"; base.modelStatus = "not_dispatched";
    }
    const index = indexPlayerIdentitySnapshot(args.index.snapshot), source = args.source;
    if (!source?.publishedAt || timestampMicros(source.publishedAt) === null || !source.text || source.text.length > 16000
      || !Array.isArray(args.rows) || !args.rows.length || args.rows.length > 32) return held("invalid_local_review_input");
    base.sourceHash = identityDigest(source.text); base.directoryHash = index.snapshot.hash; base.lineageKey = source.provenance.lineageKey;
    const views = index.snapshot.content.rows.map(row => snapshotRowAtSource(row, index, source.publishedAt!).identity);
    const mentions: FixtureIdentityMention[] = [], origins = new Map<string, LocalIdentityOccurrence["origin"]>();
    for (const [rowIndex, input] of args.rows.entries()) {
      const parsed = rowSchema.safeParse(input);
      const hold = (reason: string) => base.holds.push({ rowIndex, reason });
      if (!parsed.success) { hold("malformed_alias_review_row"); continue; }
      const row = parsed.data;
      if (row.context_text !== source.text) { hold("review_source_text_mismatch"); continue; }
      if (row.metadata?.sourcePublishedAt && timestampMicros(row.metadata.sourcePublishedAt) !== timestampMicros(source.publishedAt)) {
        hold("review_source_time_mismatch"); continue;
      }
      const evidence = row.metadata?.evidence;
      if (evidence && !exactIdentitySpan(source.text, { ...evidence, text: evidence.text ?? source.text.slice(evidence.start, evidence.end) })) {
        hold("malformed_extractor_evidence"); continue;
      }
      const occurrence = getAliasReviewOccurrence(row);
      if (!occurrence || !exactIdentitySpan(source.text, occurrence)) { hold("occurrence_not_uniquely_bound"); continue; }
      if (evidence && (evidence.start !== occurrence.start || evidence.end !== occurrence.end)) {
        hold("extractor_occurrence_binding_mismatch"); continue;
      }
      if (/\b(?:lines?|lineup|combinations?|combos?|rushes|pairings?|powerplay)\b/iu.test(occurrence.text)) { hold("heading_is_not_a_player"); continue; }
      if (row.team_id !== null) base.notes.push("undated_team_hint_ignored");
      if (row.metadata?.situation) base.notes.push("parser_role_not_used_as_source_evidence");
      const chunk = row.metadata?.reason === "invalid_extraction" || row.metadata?.reviewKind === "invalid_extraction"
        || /\s[-–—]\s|[|/]|[-‐‑–—].*[-‐‑–—]/u.test(occurrence.text);
      const segments = chunk ? segmentPlayerRow(occurrence.text, views) : null;
      if (chunk && !segments) { hold("unparsed_or_ambiguous_name_chunk"); continue; }
      const spans = segments ? segments.map(span => {
        // The existing segmenter may consume a trailing separator after name normalization.
        // Remove only that separator from multi-person evidence, preserving internal compound hyphens.
        const text = segments.length > 1 ? span.text.replace(/[\s,;/\\•–—−-]+$/u, "") : span.text;
        return { start: occurrence.start + span.start, end: occurrence.start + span.start + text.length, text };
      }) : [occurrence];
      for (const span of spans) {
        if (!/^[\p{L}\p{M}][\p{L}\p{M} .’'‐‑-]*$/u.test(span.text) || /\b(?:and|with|in the|vs)\b/iu.test(span.text)) { hold("non_name_extraction"); continue; }
        const id = `local-occurrence:${identityDigest([source.id, span.start, span.end]).slice(0, 24)}`;
        if (mentions.some(mention => mention.id === id)) continue;
        mentions.push({ id, kind: "name", span: { start: span.start, end: span.end, text: span.text }, teamHint: null,
          positionHint: adjacentPositionHint(source.text, span) });
        origins.set(id, segments ? "unique_directory_segmentation" : "existing_alias_occurrence");
      }
    }
    if (!mentions.length) return { ...base, status: "held", reason: "no_reliable_single_player_occurrences" };
    const prepared = prepareFixtureIdentityRequest({ enabled: true, index, source, mentions });
    if (prepared.status !== "prepared") return { ...base, status: "held", reason: prepared.reason };
    const request = prepared.request;
    const players = views.map(player => ({ id: player.playerId, fullName: player.fullName, lastName: player.lastName,
      position: player.position ?? null, team_id: player.teamId ?? null, aliases: player.aliases }));
    const baseline = buildTweetNewsInferencePlayerCandidates({ row: { team_id: null }, players,
      sources: [{ id: "wrapper", text: source.text, url: source.url, authorHandle: source.authorId }] });
    const baselineIds = baseline.map(player => `nhl:${player.id}`), baselineViews = views.filter(player => baseline.some(row => row.id === player.playerId));
    base.occurrences = request.content.occurrences.map(mention => {
      const old = resolvePlayerIdentity(mention.span.text, baselineViews);
      const exact = mention.candidateSet.candidates.filter(candidate => !["acronym", "fuzzy", "context"].includes(candidate.basis));
      let selected = mention.candidateSet.exactStatus === "matched" && exact.length === 1 ? exact[0]!.row.canonicalId : null;
      if (selected) {
        const content = { ...request.content, occurrences: [mention] }, hash = identityDigest(content);
        try { validateFixtureIdentityProposal({ content, hash }, {
          version: request.content.version, requestHash: hash, directoryHash: index.snapshot.hash,
          occurrences: [{ occurrenceId: mention.id, canonicalId: selected, status: "matched", evidence: mention.span, identityConfidence: "unknown" }],
        }); } catch { selected = null; }
      }
      const memberships = mention.candidateSet.candidates.map(c => c.activeTeamIds);
      return { id: mention.id, span: mention.span, origin: origins.get(mention.id)!, baselineCandidateIds: baselineIds,
        baselineSelectedId: old.status === "matched" ? `nhl:${old.player.playerId}` : null,
        candidateIds: mention.candidateSet.candidates.map(c => c.row.canonicalId), deterministicSelectedId: selected,
        modelCandidateIds: [],
        candidateTruncated: mention.candidateSet.truncated,
        activeMembership: memberships.some(ids => ids.length > 1) ? "conflicting" : !memberships.length || memberships.some(ids => !ids.length) ? "unknown" : "known", modelProposal: null };
    });
    base.notes = [...new Set(base.notes)];
    // The local runner intentionally supports mock transports only until paid preflight is reconciled.
    if (args.resolver?.enabled === true) {
      const resolver = args.resolver;
      const result = await proposeFixtureTweetIdentities({ enabled: true, index, source, mentions, transport: async (request, options) => {
        for (const mention of request.content.occurrences) {
          const occurrence = base.occurrences.find(item => item.id === mention.id)!;
          occurrence.modelCandidateIds = mention.candidateSet.candidates.map(c => c.row.canonicalId);
        }
        return resolver.transport(request, options);
      } });
      base.modelMode = "mock"; base.modelStatus = result.status; base.modelReason = result.reason; base.attempts = result.attempts; base.requestHashes = result.requestHashes;
      for (const occurrence of base.occurrences) occurrence.modelProposal = result.proposals.find(proposal => proposal.occurrenceId === occurrence.id) ?? null;
    }
    return { ...base, status: "evaluated", reason: null };
  } catch { return held("invalid_local_review_input"); }
}
