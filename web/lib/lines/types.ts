import type { EvidenceSpan, TweetUnit } from "lib/sources/tweetInterpretation";

export const LINE_SELECTOR_VERSION = "2026-10-02.2";
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
export type PPDecision = { id: string; revision: number; gameId: number; teamId: number; unitNumber: number; selection: SelectedLineUnit | null; conflict: LineConflict | null; replacesId: string | null; reason: string; decidedAt: string; selectorVersion: string };
export type GameTeamLines = {
  teamId: number; abbreviation: string; entry: EntryRevision | null;
  entryRevisions: EntryRevision[];
  fallback: { gameId: number; date: string; entry: EntryRevision } | null;
  observations: LineClaim[]; history: LineClaim[]; ppDefaults: PPDecision[];
  unresolved: Array<{ claimId: string; reasons: string[] }>; conflicts: LineConflict[];
};
export type GameLinesResponse = {
  enabled: boolean; mode: "snapshots"; status: "ready" | "disabled" | "no_game";
  controls: { observations: boolean; entryServing: boolean; carryForward: boolean };
  game: LineGame | null; games: LineGame[]; teams: GameTeamLines[];
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
export function unitKey(unit: TweetUnit): string { return `${unit.situation}:${unit.number ?? "unassigned"}:${unit.group ?? "main"}`; }
