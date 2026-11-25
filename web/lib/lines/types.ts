import type { EvidenceSpan, TweetUnit } from "lib/sources/tweetInterpretation";

export const LINE_SELECTOR_VERSION = "2026-11-18.1";
export type GamePhase = "scheduled" | "pregame" | "live" | "final" | "postponed" | "unknown";
export type LineGame = {
  id: number; date: string; homeTeamId: number; awayTeamId: number;
  homeAbbreviation: string; awayAbbreviation: string; scheduledStart: string | null;
  phase: GamePhase; actualStart: string | null; observedAt: string | null;
  stateSource: string | null; scheduleIdentity: string; replacesGameId: number | null;
};
export type SourceTime = {
  originalPublishedAt: string | null; relayPublishedAt: string | null;
  ingestedAt: string; interpretedAt: string; effectiveAt: string | null; effectiveUntil: string | null;
  rawDisplay: string | null; timezone: string | null;
  precision: "instant" | "display" | "unknown"; basis: string;
};
/** Where a claim's lineup applies. Ranking: warmup > game > practice > projected (carried ranks below all). */
export type ClaimContext = "warmup" | "game" | "practice" | "projected";
/** Original-author authority. The relaying account never confers a tier; FHFHockey is excluded. */
export type AuthorityTier = "team" | "beat" | "aggregator" | "unknown" | "excluded";
export type ClaimDecisionEvidence = {
  producerVersion: string; decisionId: string; sourceReferences: string[];
  binding: EvidenceSpan[]; phase: EvidenceSpan[];
};
export type LineClaim = {
  id: string; captureId: string; version: string; originalIdentity: string | null;
  provenance?: { relayTweetId: string | null; originalTweetId: string | null; attributionStatus: "resolved" | "pending" };
  decisionEvidence?: ClaimDecisionEvidence;
  publicationEvidence?: string[];
  teamId: number; gameId: number | null;
  binding: { status: "bound" | "ambiguous" | "unresolved"; evidence: string[]; resolverVersion: string; scheduleIdentity: string | null };
  kind: "entry" | "iga" | "pp" | "entry_correction" | "retraction";
  phase: "pregame" | "in_game" | "unknown";
  unit: TweetUnit | null; relationship: { kind: string; playerIds: number[]; evidence: EvidenceSpan } | null;
  text: string; sourceUrl: string | null; author: string | null;
  time: SourceTime; explicit: boolean; authority: number;
  certainty: "reported" | "projected" | "confirmed"; confirmationEvidence: string[];
  specificity: "warmup" | "game" | "practice";
  identityStatus: "resolved_at_event" | "unresolved"; identityEvidence: string[];
  accepted: boolean; reviewReasons: string[];
  supersedes: string[]; retracts: string[]; relationAuthority: "original_author" | "reviewed" | "none";
  /** Absent on claims stored before the 2026-11-06 contract; readers treat absent as derived from specificity. */
  context?: ClaimContext; contextEvidence?: EvidenceSpan[];
  authorityTier?: AuthorityTier; originalAuthor?: string | null; relayAccount?: string | null;
  /** A partial PP change (players in for players out). Resolved ids only; applied to a base unit in reconcile. */
  ppSwap?: { unitNumber: 1 | 2; playersIn: number[]; playersOut: number[]; source: string; names?: Record<string, string> };
  /** A lineup change ("X in for Y", draws in/out, IN/OUT list). Players only: no line number and no destination for a displaced player. */
  lineupChange?: { kind: "in_for" | "draws_in" | "draws_out" | "lineup_in_out"; playersIn: number[]; playersOut: number[]; source: string; names?: Record<string, string> };
};
export type SelectedLineUnit = { unit: TweetUnit; claims: LineClaim[]; designation: "reported" | "projected" | "confirmed" | "carried"; originGameId: number | null };
export type LineConflict = { unitKey: string; claimIds: string[]; reason: string };
export type EntryRevision = {
  id: string; gameId: number; teamId: number; revision: number; previousId: string | null;
  status: "expected" | "frozen" | "corrected"; units: SelectedLineUnit[]; conflicts: LineConflict[];
  cutoff: string | null; frozenState: LineGame | null; selectorVersion: string;
  createdAt: string; reason: string; correctionClaimIds: string[];
  // Retain the cutoff evidence and accepted change chain, including inactive/conflicting claims.
  evidenceClaims?: LineClaim[];
};
/** Why a carried PP unit stopped being the default. */
export type PPEndReason =
  | { kind: "superseded"; claimIds: string[]; detail: string }
  | { kind: "player_unavailable"; playerIds: number[]; evidence: string[]; detail: string }
  | { kind: "stale"; gamesElapsed: number; detail: string };
/** A PP unit built by applying a partial swap to an accepted 5-player base unit. */
export type PPDerivation = { baseClaimIds: string[]; swapClaimIds: string[]; playersIn: number[]; playersOut: number[] };
export type PPDecision = { id: string; revision: number; gameId: number; teamId: number; unitNumber: number; selection: SelectedLineUnit | null; conflict: LineConflict | null; replacesId: string | null; reason: string; decidedAt: string; selectorVersion: string;
  endReason?: PPEndReason | null; derivation?: PPDerivation | null;
  /** Display only (PPCF P3): a newer, unbound practice report whose units differ from the carried unit. Never changes `selection`. */
  practiceDiffers?: PPPracticeNote | null };
export type PPPracticeNote = { claimIds: string[]; sourceUrl: string | null; author: string | null; postedAt: string | null;
  units: { number: 1 | 2; players: { playerId: number; name: string }[] }[] };
/** One raw capture for the source feed. Relays collapse under their original. */
export type SourceFeedItem = {
  id: string; originalIdentity: string | null; originalAuthor: string | null; authorityTier: AuthorityTier;
  /** account is null in the public API: relay handles never reach the site surface. */
  relays: Array<{ account: string | null; relayTweetId: string | null; relayPublishedAt: string | null; ingestedAt: string }>;
  text: string; publishedAt: string | null; ingestedAt: string;
  binding: { status: "bound" | "ambiguous" | "unresolved"; gameId: number | null; evidence: string[] };
  context: ClaimContext | null; claimIds: string[]; sourceUrl: string | null;
};
/** NHL event evidence on the updates rail has no coaching unit number. */
export type OfficialPowerPlayObservation = {
  gameId: number; teamId: number; eventId: number; reportEvent: number; order: number;
  period: number; elapsed: string; players: { playerId: number; name: string }[]; sourceUrl: string;
};
export type EntryView = { mode: "expected" | "entering" | "unrecorded"; frozenAt: string | null; basis: "stored" | "read_time" | null };
export type GameGoalieReport = {
  key: string; text: string; originalUrl: string | null; author: string | null; postedAt: string | null; receivedAt: string | null;
  starter: { status: "projected" | "confirmed"; playerId: number; playerName: string } | null;
};
export type GameTimeDecisionReport = {
  playerId: number; playerName: string; originalUrl: string; author: string; postedAt: string; receivedAt: string;
};
export type GameTeamLines = {
  teamId: number; abbreviation: string; entry: EntryRevision | null;
  entryRevisions: EntryRevision[];
  fallback: { gameId: number; date: string; entry: EntryRevision } | null;
  officialPowerPlay?: OfficialPowerPlayObservation[] | null;
  gameTimeDecisionReports?: GameTimeDecisionReport[] | null;
  goalieReports?: GameGoalieReport[] | null;
  observations: LineClaim[]; history: LineClaim[]; ppDefaults: PPDecision[];
  unresolved: Array<{ claimId: string; reasons: string[] }>; conflicts: LineConflict[];
  feed: SourceFeedItem[];
};
export type GameLinesResponse = {
  enabled: boolean; mode: "snapshots"; status: "ready" | "disabled" | "no_game";
  controls: { observations: boolean; entryServing: boolean; carryForward: boolean };
  game: LineGame | null; games: LineGame[]; teams: GameTeamLines[];
  entryView: EntryView;
};

export function lineSnapshotFlags() {
  return {
    observations: process.env.LINES_OBSERVATIONS_ENABLED === "true",
    entryServing: process.env.LINES_ENTRY_SERVING_ENABLED === "true",
    carryForward: process.env.LINES_PP_CARRY_FORWARD_ENABLED === "true",
  };
}

/** Date.parse accepts local timestamps; evidence instants must include an offset. */
export function instant(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
/**
 * Two schedule identities (`gameId:start:state`, start possibly containing ':') name the same scheduled game. An exact match
 * always counts; otherwise the game ids and states must match and both starts must parse to the same instant, so "…Z" and
 * "…+00:00" agree while a reschedule or an unreadable start does not.
 */
export function sameScheduleIdentity(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  if (a === b) return true;
  const split = (value: string) => {
    const first = value.indexOf(":"), last = value.lastIndexOf(":");
    return first > 0 && last > first ? { id: value.slice(0, first), start: value.slice(first + 1, last), state: value.slice(last + 1) } : null;
  };
  const left = split(a), right = split(b);
  if (!left || !right || left.id !== right.id || left.state !== right.state) return false;
  const at = instant(left.start);
  return at != null && at === instant(right.start);
}
export function unitKey(unit: TweetUnit): string { return `${unit.situation}:${unit.number ?? "unassigned"}:${unit.group ?? "main"}`; }
