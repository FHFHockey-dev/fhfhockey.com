import type { TweetPlayerEvent } from "../sources/tweetPlayerEvents";
import { timestampMicros } from "../projections/evidenceTime";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";

/** Caller-supplied diagnostics only; these receipts grant no forecast or participation uses. */
export type CurrentRosterInjuryEvidence = {
  playerId: number; nhlPlayerId: number; seasonId: number; sourceId: string;
  observedAt: string; capturedAt: string; expiresAt: string; contentHash: string;
} & ({ provider: "yahoo"; sourceKind: "original_provider_payload" | "merged_player_row";
  payload: Record<string, unknown> }
  | { provider: "ifttt"; payload: { text: string; event: TweetPlayerEvent } });

type Player = { playerId: number; nhlPlayerId: number; teamId: number; yahooPlayerKey?: string };
export function classifyCurrentRosterInjuryEvidence(evidence: CurrentRosterInjuryEvidence, player: Player,
  seasonId: number, cutoffAt: string) {
  const unknown = (reason: string) => ({ sourceId: evidence.sourceId, status: "unknown" as const, reason });
  const cutoff = timestampMicros(cutoffAt), observed = timestampMicros(evidence.observedAt),
    captured = timestampMicros(evidence.capturedAt), expires = timestampMicros(evidence.expiresAt);
  if (evidence.playerId !== player.playerId || evidence.nhlPlayerId !== player.nhlPlayerId || evidence.seasonId !== seasonId) return unknown("identity_or_season_mismatch");
  if (cutoff === null || observed === null || captured === null || expires === null || observed > captured
    || captured > cutoff || expires <= cutoff || cutoff - observed > BigInt(24 * 60 * 60 * 1_000_000)) return unknown("stale_or_invalid_source_clock");
  if (typeof evidence.sourceId !== "string" || !evidence.sourceId.trim() || !/^[a-f0-9]{64}$/.test(evidence.contentHash)
    || playerForecastSourcePayloadHash(evidence.payload) !== evidence.contentHash) return unknown("source_provenance_unverified");
  if (evidence.provider === "yahoo") {
    // COALESCE preserves omitted old fields while last_updated advances. It is not a field observation clock.
    if (evidence.sourceKind !== "original_provider_payload") return unknown("merged_yahoo_field_freshness_unknown");
    if (!player.yahooPlayerKey || evidence.payload.player_key !== player.yahooPlayerKey) return unknown("yahoo_identity_binding_unverified");
    const strings = [evidence.payload.status, evidence.payload.status_full, evidence.payload.injury_note]
      .map(value => typeof value === "string" ? value.trim().toLowerCase() : "");
    const injury = strings.some(value => /^(?:ir|ir-lt|ltir|injured|injured reserve|(?:upper|lower)[ -]body injury|(?:ankle|arm|back|foot|hand|hip|knee|leg|shoulder|wrist) injury|concussion)$/.test(value));
    const conflicting = strings.some(value => /\b(?:healthy|available|active|no injury|not injured|cleared to play)\b/.test(value));
    if (!injury || conflicting) return unknown(conflicting ? "conflicting_or_return_status" : "no_unambiguous_injury_status");
  } else if (evidence.provider === "ifttt") {
    const { event, text } = evidence.payload;
    if (!event || event.playerId !== player.playerId || event.teamId != null && event.teamId !== player.teamId
      || event.kind !== "injury" || event.modality !== "affirmative" || event.reviewReason
      || !["new_injury", "ongoing", "setback"].includes(event.state)
      || ["available", "uncertain"].includes(event.availability)
      || event.availabilityScope !== "unspecified" || event.effectiveDate != null
      || !event.evidence || !Number.isSafeInteger(event.evidence.start) || !Number.isSafeInteger(event.evidence.end)
      || event.evidence.start < 0 || event.evidence.end <= event.evidence.start
      || typeof text !== "string" || event.evidence.end > text.length || text.slice(event.evidence.start, event.evidence.end) !== event.evidence.text
      || !/\b(?:injur\w*|surgery|concussion|setback|rehab\w*|recover\w*)\b/i.test(event.evidence.text)) {
      return unknown("injury_claim_or_current_applicability_unverified");
    }
  } else return unknown("unsupported_provider");
  return { sourceId: evidence.sourceId, status: "injury_supported" as const, reason: "current_explicit_injury_evidence" };
}
