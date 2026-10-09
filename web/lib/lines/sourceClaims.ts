import type { ProjectionReport } from "lib/sources/projectedLineups";
import type { EvidenceSpan, TweetInterpretation } from "lib/sources/tweetInterpretation";
import { bindLineGame } from "./binding";
import { evidenceKey } from "./reconcile";
import { instant, LINE_SELECTOR_VERSION, unitKey, type ClaimDecisionEvidence, type LineClaim, type LineGame, type SourceTime } from "./types";

/** Explicit upstream/reviewer decisions; legacy certainty/gameId are not sufficient. */
export type LineEvidenceContext = {
  gameId?: number; opponentId?: number; date?: string; relative?: "today" | "tonight" | "tomorrow" | "yesterday";
  timezone?: string; rawDisplay?: string; effectiveAt?: string; effectiveUntil?: string;
  phase?: LineClaim["phase"]; kind?: LineClaim["kind"]; author?: string;
  confirmationEvidence?: string[]; authority?: number; identityEvidence?: string[];
  identityStatus?: LineClaim["identityStatus"]; supersedes?: string[]; retracts?: string[];
  relationAuthority?: LineClaim["relationAuthority"];
  certainty?: LineClaim["certainty"]; specificity?: LineClaim["specificity"];
  decisionEvidence?: ClaimDecisionEvidence;
  publication?: { originalPublishedAt: string; relayPublishedAt: string | null; originalIdentity: string; originalAuthor: string; evidence: string[] };
  claimEvidence?: Record<string, Omit<LineEvidenceContext, "claimEvidence">>;
};

export function relationshipClaimKey(relationship: NonNullable<TweetInterpretation["relationships"]>[number]): string {
  return `relationship:${evidenceKey([relationship.kind, relationship.evidence.start, relationship.evidence.end, relationship.evidence.text])}`;
}
function supportedSpans(spans: EvidenceSpan[] | undefined, text: string): boolean {
  return !!spans?.length && spans.every((span) => Number.isInteger(span.start) && Number.isInteger(span.end) && span.start >= 0 && span.end > span.start
    && span.end <= text.length && text.slice(span.start, span.end) === span.text);
}

export function claimsFromReport(report: ProjectionReport, games: LineGame[], context: LineEvidenceContext = {}): LineClaim[] {
  // Only source-wide provenance and clocks may be shared. Semantic decisions belong
  // to individual extracted keys, including relationship-only prose and retractions.
  const count = report.interpretation.units.length + (report.interpretation.relationships?.length ?? 0);
  if (context.claimEvidence || count > 1) {
    const { claimEvidence, ...common } = context;
    const sourceContext = { publication: common.publication, author: common.author, timezone: common.timezone, rawDisplay: common.rawDisplay,
      identityStatus: common.identityStatus, identityEvidence: common.identityEvidence };
    return [
      ...report.interpretation.units.flatMap((unit) => claimsFromReport({ ...report, interpretation: { ...report.interpretation, units: [unit], relationships: [] } }, games, { ...sourceContext, ...claimEvidence?.[unitKey(unit)] })),
      ...(report.interpretation.relationships ?? []).flatMap((relationship) => claimsFromReport({ ...report, interpretation: { ...report.interpretation, units: [], relationships: [relationship] } }, games, { ...sourceContext, ...claimEvidence?.[relationshipClaimKey(relationship)] })),
      ...(count === 0 && common.kind === "retraction" ? claimsFromReport(report, games, { ...sourceContext, ...claimEvidence?.retraction, kind: "retraction" }) : []),
    ];
  }
  const captureId = evidenceKey([report.provenance?.originalTweetId ?? report.key, report.provenance?.relayTweetId, report.text, report.receivedAt]);
  const sourceAuthor = report.originalUrl?.match(/^https:\/\/(?:x|twitter)\.com\/([^/]+)\//)?.[1] ?? null;
  const originalIdentity = report.provenance?.originalTweetId ?? report.originalUrl;
  const publication = context.publication;
  const verifiedPublication = !!publication && instant(publication.originalPublishedAt) != null
    && (publication.relayPublishedAt == null || instant(publication.relayPublishedAt) != null)
    && publication.originalIdentity === originalIdentity && !!publication.originalAuthor && !!publication.evidence.length
    && (!sourceAuthor || publication.originalAuthor.toLowerCase() === sourceAuthor.toLowerCase());
  const decision = context.decisionEvidence;
  const audited = !!decision?.producerVersion && !!decision.decisionId && !!decision.sourceReferences.length;
  const bindingSupported = audited && supportedSpans(decision?.binding, report.text);
  const phaseSupported = audited && supportedSpans(decision?.phase, report.text);
  const binding = bindLineGame({ teamId: report.teamId, ...(bindingSupported ? context : {}),
    originalPublishedAt: verifiedPublication ? publication!.originalPublishedAt : null, quotedTimeUnresolved: !verifiedPublication }, games);
  const { gameId, ...bindingEvidence } = binding;
  const time: SourceTime = {
    originalPublishedAt: verifiedPublication ? publication!.originalPublishedAt : null,
    relayPublishedAt: publication ? publication.relayPublishedAt : (instant(report.publishedAt) == null ? null : report.publishedAt),
    ingestedAt: report.receivedAt, interpretedAt: report.interpretedAt ?? "",
    effectiveAt: context.effectiveAt ?? (verifiedPublication ? publication!.originalPublishedAt : null), effectiveUntil: context.effectiveUntil ?? null,
    rawDisplay: context.rawDisplay ?? null, timezone: context.timezone ?? null,
    precision: verifiedPublication ? "instant" : context.rawDisplay ? "display" : "unknown",
    basis: context.effectiveAt ? "explicit_effective_time" : verifiedPublication ? "verified_original_publication" : "unresolved_display_time",
  };
  const author = publication?.originalAuthor ?? sourceAuthor ?? context.author ?? null;
  const phase = phaseSupported ? context.phase ?? "unknown" : "unknown";
  const reviews = [...report.interpretation.unresolved.map((issue) => `extraction:${issue.reason}:${issue.text}`),
    ...(binding.status !== "bound" ? binding.evidence : []), ...(phase === "unknown" ? ["claim_phase_unresolved"] : []),
    ...(!verifiedPublication ? ["original_provenance_unverified"] : []), ...(!bindingSupported ? ["binding_decision_unverified"] : []),
    ...(!context.kind ? ["claim_kind_unresolved"] : []),
    ...(context.certainty === "confirmed" && !context.confirmationEvidence?.length ? ["claim_confirmation_unresolved"] : []),
    ...(context.identityStatus !== "resolved_at_event" ? ["event_membership_unverified"] : []),
    ...(instant(time.effectiveAt) == null ? ["effective_time_unresolved"] : [])];
  const base = {
    captureId, version: `${report.interpretation.version}:${LINE_SELECTOR_VERSION}`, originalIdentity: report.provenance?.originalTweetId ?? report.originalUrl, provenance: report.provenance,
    decisionEvidence: decision, publicationEvidence: publication?.evidence ?? [], teamId: report.teamId, gameId, binding: bindingEvidence, phase, text: report.text, sourceUrl: report.originalUrl, author, time,
    explicit: bindingSupported && phaseSupported && !!context.kind, authority: context.authority ?? 1, certainty: context.certainty ?? "reported" as const,
    confirmationEvidence: context.certainty === "confirmed" ? context.confirmationEvidence ?? [] : [], specificity: context.specificity ?? "game" as const,
    identityStatus: context.identityStatus ?? "unresolved" as const, identityEvidence: context.identityEvidence ?? [],
    accepted: true, reviewReasons: [...new Set(reviews)], supersedes: context.supersedes ?? [], retracts: context.retracts ?? [], relationAuthority: context.relationAuthority ?? "none" as const,
  };
  const claims: LineClaim[] = report.interpretation.units.map((unit, index) => ({ ...base,
    id: evidenceKey([report.key, binding, context, unit, index]), unit, relationship: null,
    kind: context.kind ?? (unit.situation === "pp" ? "pp" : phase === "in_game" ? "iga" : "entry"),
    reviewReasons: [...base.reviewReasons.filter((reason) => !reason.startsWith("extraction:")), ...report.interpretation.unresolved
      .filter((issue) => issue.situation == null || issue.situation === unit.situation && (issue.number == null || issue.number === unit.number))
      .map((issue) => `extraction:${issue.reason}:${issue.text}`)],
  }));
  for (const relationship of report.interpretation.relationships ?? []) claims.push({ ...base,
    id: evidenceKey([report.key, binding, context, relationship]), kind: context.kind ?? "iga", unit: null,
    relationship: { kind: relationship.kind, playerIds: relationship.playerIds, evidence: relationship.evidence },
    // Keep the relationship even when it cannot be reconciled into slots.
    reviewReasons: [...base.reviewReasons, ...(relationship.reviewReason ? [relationship.reviewReason] : [])],
  });
  if (context.kind === "retraction" && !claims.length) claims.push({ ...base, id: evidenceKey([report.key, binding, context]), kind: "retraction", unit: null, relationship: null });
  return claims;
}
