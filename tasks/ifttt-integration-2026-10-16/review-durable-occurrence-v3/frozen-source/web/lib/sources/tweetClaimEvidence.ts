import { claimHash, type TweetClaimEnvelope } from "./tweetClaimExtraction";
import type { RetainedClaimDerivation } from "./tweetClaimReducerAdapter";
import { easternReportDate } from "./projectedLineups";
import { getPrimaryTextForSource } from "./linesCccIngestion";
import { validTweetClaimGameApplicability } from "./tweetClaimApplicability";

/** Exact retained official game roster evidence. Current roster/beat priors never populate this proof. */
export type TweetDatedIdentityEvidence = {
  gameId: number; date: string; playerId: number; teamId: number; league: "NHL";
  fullName: string; role: "goalie" | "skater"; knownAt: string; sourceUrl: string;
  rawPayloadId: string; rawPayloadHash: string; normalizationFingerprint: string;
};
export const TWEET_LEGACY_SINKS = ["tweet_projection_reports", "tweet_player_events", "line_source_snapshots", "lines_ccc",
  "player_forecast_goalie_start_observations", "player_forecast_lineup_snapshots", "line_claim_revisions",
  "line_entry_revisions", "line_pp_decisions", "line_source_captures", "news_feed_items", "player_forecast_inference_queue",
  "player_forecast_lineup_assignments", "line_claim_relations"] as const;
export type TweetLegacySinkRead = { sink: typeof TWEET_LEGACY_SINKS[number]; complete: boolean; rows: unknown[]; reason?: string };
export type TweetClaimEvidence = { identities: TweetDatedIdentityEvidence[]; sinks: TweetLegacySinkRead[]; readAt: string;
  /** A current empty table is not proof that a prior effect never happened. */
  history?: { status: "complete"; from: string; through: string; basis: string; retentionEvidence: string; writerFenceEvidence: string } };

const instant = (value: string) => /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
const name = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function datedTweetClaimBinding(claim: TweetClaimEnvelope, evidence: TweetClaimEvidence): RetainedClaimDerivation["binding"] {
  const o = claim.semantic, scope = o.scope, fact = o.fact;
  const pending = (reason: string): RetainedClaimDerivation["binding"] => ({ status: "pending", reason });
  if (!scope || scope.kind !== "game" || !fact || !("playerId" in fact) || !claim.claimAnchor) return pending("dated_identity_claim_scope_unresolved");
  const published = instant(o.original.publishedAt ?? ""), asOf = instant(evidence.readAt);
  if (!Number.isFinite(published) || !Number.isFinite(asOf) || published > asOf) return pending("dated_identity_source_clock_unresolved");
  const applicability=claim.gameApplicability;
  if(applicability && !validTweetClaimGameApplicability(applicability,{gameId:scope.gameId,teamId:scope.teamId,
    publishedAt:o.original.publishedAt!,effectiveAt:o.effectiveAt,text:getPrimaryTextForSource(claim.source),governingClause:o.evidence}))
    return pending("explicit_game_date_evidence_invalid");
  // Legacy envelopes retain the conservative publication-day rule. A future
  // game requires exact source-clause date evidence and its own dated roster.
  const scopeDate=applicability?.date??easternReportDate(o.original.publishedAt!);
  const rows = evidence.identities.filter(row => row.gameId === scope.gameId && row.playerId === fact.playerId
    && instant(row.knownAt) <= published && instant(row.knownAt) <= asOf);
  if (!rows.length) return pending("dated_official_game_roster_missing_at_source_time");
  if (rows.some(row => row.teamId !== scope.teamId || row.league !== "NHL" || row.date !== scopeDate
    || (fact.kind === "starter" && row.role !== "goalie"))) return pending("dated_identity_team_league_or_role_conflict");
  // Require the exact lexical subject to name the dated identity; substring initials are ambiguous.
  const subject = name(claim.claimAnchor.subjectSpan.text);
  const lexical = evidence.identities.filter(row => row.gameId === scope.gameId && row.teamId === scope.teamId
    && instant(row.knownAt) <= published && (name(row.fullName) === subject || name(row.fullName.split(" ").at(-1) ?? "") === subject));
  if (new Set(lexical.map(row => row.playerId)).size !== 1 || lexical[0]?.playerId !== fact.playerId) return pending("dated_identity_lexical_name_unresolved");
  const selected = rows.filter(row => lexical.includes(row));
  if (!selected.length || new Set(selected.map(row => `${row.fullName}:${row.role}`)).size !== 1) return pending("dated_identity_lexical_name_unresolved");
  const row = selected[0]!;
  if (row.sourceUrl !== `https://api-web.nhle.com/v1/gamecenter/${scope.gameId}/play-by-play`
    || !/^\d+$/.test(row.rawPayloadId) || !/^[a-f0-9]{64}$/.test(row.rawPayloadHash)
    || !/^[a-f0-9]{64}$/.test(row.normalizationFingerprint)) return pending("dated_identity_retained_official_receipt_invalid");
  return { status: "verified", basis: `retained official game roster ${claimHash(selected)}; known before source publication`,
    playerId: fact.playerId, teamId: scope.teamId, league: "NHL", role: row.role, scopeDate: row.date,
    governingPredicateBasis: `exact lexical predicate ${claimHash(claim.claimAnchor.predicateSpan)}` };
}

/** Full scope inventory is deliberately conservative: present/partial rows suppress fresh effects. */
export function tweetLegacyCoverage(evidence: TweetClaimEvidence, publicationTimes: string[] = []) {
  const missing = TWEET_LEGACY_SINKS.filter(sink => evidence.sinks.filter(read => read.sink === sink && read.complete).length !== 1);
  const retained = evidence.sinks.map(read => ({ ...read, payloadFingerprint: claimHash(read.rows) }));
  if (missing.length) return { status: "unknown" as const, reason: `legacy_sink_inventory_incomplete:${missing.join(",")}`, retained };
  if (retained.some(read => read.rows.length)) return { status: "present" as const,
    reason: "legacy_scope_effects_present_reconciliation_required", retained };
  const history = evidence.history;
  if (!history || history.status !== "complete" || !history.basis?.trim() || !history.retentionEvidence?.trim() || !history.writerFenceEvidence?.trim()
    || !Number.isFinite(instant(history.from)) || publicationTimes.some(time => !Number.isFinite(instant(time)) || instant(time) < instant(history.from))
    || !Number.isFinite(instant(history.through)) || instant(history.through) < instant(evidence.readAt)) {
    return { status: "unknown" as const, reason: "legacy_retention_history_or_writer_fence_unattested", retained };
  }
  return { status: "known_clear" as const, basis: `all ${TWEET_LEGACY_SINKS.length} scoped sinks empty in one retained snapshot:${claimHash(retained)}`, retained };
}
