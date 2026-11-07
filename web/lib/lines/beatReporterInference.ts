import type { ParsedLinesCccSource } from "lib/sources/linesCccIngestion";

import { AUTHORITY_SEED, isRelayAccount, NO_CONFIRMATION_AUTHORS, sourceAttribution } from "./authority";

/** One stored lineup/goalie/practice post, as the review route reads it from line_source_snapshots (read-only). */
export type BeatEvidenceRow = {
  source_handle: string | null;
  source_url: string | null;
  tweet_url: string | null;
  tweet_id: string | null;
  quoted_tweet_id: string | null;
  quoted_tweet_url: string | null;
  quoted_author_handle: string | null;
  quoted_author_name: string | null;
  author_name: string | null;
  primary_text_source: string | null;
  raw_text: string | null;
  enriched_text: string | null;
  team_abbreviation: string | null;
  classification: string | null;
  snapshot_date: string | null;
  provider: string | null;
  fx: Record<string, unknown> | null;
  quote: Record<string, unknown> | null;
  provenance: Record<string, unknown> | null;
  ifttt_account: string | null;
};

export type BeatCandidateTeam = { teamAbbrev: string; count: number; share: number };
export type BeatCandidatePost = { text: string; url: string | null; teamAbbrev: string | null; date: string | null; classification: string | null };
export type BeatReporterCandidate = {
  handle: string;
  displayName: string | null;
  /** Posts attributed to this author, team-tagged or not. */
  postCount: number;
  /** Team-tagged posts, most first. */
  teams: BeatCandidateTeam[];
  /** Teams suggested for the association: the top team, plus any other with ≥ 25% share and ≥ 3 posts. */
  suggestedTeams: string[];
  /** 0–1: top-team share × volume (saturates at 30 team-tagged posts). */
  confidence: number;
  samples: BeatCandidatePost[];
};

export const CANDIDATE_CLASSIFICATIONS = ["lineup", "goalie_start", "practice_lines", "power_play"] as const;
const VOLUME_SATURATION = 30;
const SECOND_TEAM_SHARE = 0.25;
const SECOND_TEAM_MIN = 3;
const SAMPLE_LIMIT = 4;

/** Accounts that already have a tier (clubs, FHFHockey) or are relays are never beat-reporter candidates. */
function excludedHandle(handle: string): boolean {
  return isRelayAccount(handle) || handle in AUTHORITY_SEED || NO_CONFIRMATION_AUTHORS.includes(handle);
}

/** The original author, attributed exactly as the Lines engine attributes a source (relay-aware). */
export function rowAuthor(row: BeatEvidenceRow): string | null {
  const source = {
    snapshotDate: row.snapshot_date ?? "",
    nhlFilterStatus: "accepted",
    sourceHandle: row.source_handle,
    sourceUrl: row.source_url,
    tweetUrl: row.tweet_url,
    tweetId: row.tweet_id,
    quotedTweetId: row.quoted_tweet_id,
    quotedTweetUrl: row.quoted_tweet_url,
    quotedAuthorHandle: row.quoted_author_handle,
    primaryTextSource: row.primary_text_source,
    rawText: row.raw_text,
    rawPayload: { provider: row.provider ?? undefined, fx: row.fx ?? undefined, quote: row.quote ?? undefined },
    metadata: { sourceProvenance: row.provenance ?? undefined, iftttSourceAccount: row.ifttt_account ?? undefined }
  } as unknown as ParsedLinesCccSource;
  return sourceAttribution(source, row.raw_text ?? row.enriched_text ?? "").originalAuthor;
}

function displayNameFor(row: BeatEvidenceRow, handle: string): string | null {
  const fxAuthor = (row.fx as { author?: { screen_name?: unknown; name?: unknown } } | null)?.author;
  if (typeof fxAuthor?.screen_name === "string" && fxAuthor.screen_name.toLowerCase() === handle && typeof fxAuthor.name === "string") return fxAuthor.name;
  if (row.quoted_author_handle?.toLowerCase() === handle) return row.quoted_author_name;
  if (row.source_handle?.replace(/^@/, "").toLowerCase() === handle) return row.author_name;
  return null;
}

export function candidateConfidence(teamCounts: number[]): number {
  const tagged = teamCounts.reduce((sum, count) => sum + count, 0);
  if (!tagged) return 0;
  const topShare = Math.max(...teamCounts) / tagged;
  const volume = Math.min(1, Math.log1p(tagged) / Math.log1p(VOLUME_SATURATION));
  return Math.round(topShare * volume * 100) / 100;
}

/**
 * Ranks X authors of stored lineup content as beat-reporter candidates: one per author, with the teams they post
 * about. Authors with fewer than `minPosts` posts, clubs, relays, FHFHockey and already-reviewed handles are left out. Highest confidence first.
 */
export function rankBeatReporterCandidates(rows: BeatEvidenceRow[], reviewedHandles: Iterable<string> = [], { minPosts = 1 }: { minPosts?: number } = {}): BeatReporterCandidate[] {
  const reviewed = new Set([...reviewedHandles].map((handle) => handle.toLowerCase()));
  const byAuthor = new Map<string, { rows: BeatEvidenceRow[]; teams: Map<string, number>; displayName: string | null }>();
  for (const row of rows) {
    const handle = rowAuthor(row);
    if (!handle || excludedHandle(handle) || reviewed.has(handle)) continue;
    const entry = byAuthor.get(handle) ?? { rows: [] as BeatEvidenceRow[], teams: new Map<string, number>(), displayName: null as string | null };
    entry.rows.push(row);
    entry.displayName ??= displayNameFor(row, handle);
    const team = row.team_abbreviation?.toUpperCase();
    if (team) entry.teams.set(team, (entry.teams.get(team) ?? 0) + 1);
    byAuthor.set(handle, entry);
  }
  const candidates: BeatReporterCandidate[] = [];
  for (const [handle, entry] of byAuthor) {
    if (entry.rows.length < minPosts) continue;
    const tagged = [...entry.teams.values()].reduce((sum, count) => sum + count, 0);
    const teams = [...entry.teams.entries()]
      .map(([teamAbbrev, count]) => ({ teamAbbrev, count, share: Math.round((count / tagged) * 100) / 100 }))
      .sort((a, b) => b.count - a.count || a.teamAbbrev.localeCompare(b.teamAbbrev));
    const suggestedTeams = teams.filter((team, index) => index === 0 || (team.share >= SECOND_TEAM_SHARE && team.count >= SECOND_TEAM_MIN)).map((team) => team.teamAbbrev);
    const top = suggestedTeams[0];
    // Samples: newest first, preferring the suggested team's posts.
    const samples = [...entry.rows]
      .sort((a, b) => Number(b.team_abbreviation?.toUpperCase() === top) - Number(a.team_abbreviation?.toUpperCase() === top) || (b.snapshot_date ?? "").localeCompare(a.snapshot_date ?? ""))
      .slice(0, SAMPLE_LIMIT)
      .map((row) => ({ text: (row.raw_text ?? row.enriched_text ?? "").trim(), url: row.tweet_url ?? row.source_url, teamAbbrev: row.team_abbreviation, date: row.snapshot_date, classification: row.classification }));
    candidates.push({ handle, displayName: entry.displayName, postCount: entry.rows.length, teams, suggestedTeams, confidence: candidateConfidence(teams.map((team) => team.count)), samples });
  }
  return candidates.sort((a, b) => b.confidence - a.confidence || b.postCount - a.postCount || a.handle.localeCompare(b.handle));
}
