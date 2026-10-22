import { buildPlayerIdentitySnapshot, indexPlayerIdentitySnapshot, type IdentitySnapshotRecord } from "../playerIdentitySnapshot";
import type { FixtureIdentityMention, FixtureIdentitySource, FixtureIdentityRequest, TweetIdentityProposalOutput } from "../tweetIdentityProposal";

// Entirely synthetic people, IDs, teams, aliases, dates and source provenance. No efficacy/holdout labels.
export const FIXTURE_AS_OF = "2026-10-20T12:00:00Z";
const startsAt = "2026-01-01T00:00:00Z";
export const offlineIdentityRecords: IdentitySnapshotRecord[] = [
  { identity: { playerId: 1001, registryId: 91, fullName: "Milo North", lastName: "North", position: "C", teamId: 22, aliases: ["Undated nickname"] },
    verifiedAliases: [
      { text: "Sparky", verification: "verified", scope: { kind: "global" }, provenance: "synthetic verified alias", startsAt, endsAt: null },
      { text: "Little Spark", verification: "verified", scope: { kind: "team", teamId: 11 }, provenance: "synthetic scoped alias", startsAt, endsAt: null },
    ], memberships: [
      { teamId: 11, startsAt, endsAt: "2026-10-10T00:00:00Z", provenance: "synthetic old team" },
      { teamId: 22, startsAt: "2026-10-10T00:00:00Z", endsAt: null, provenance: "synthetic trade" },
    ] },
  { identity: { playerId: 1002, fullName: "Riley Vale", lastName: "Vale", position: "G" }, verifiedAliases: [],
    memberships: [{ teamId: 11, startsAt, endsAt: null, provenance: "synthetic team" }] },
  { identity: { playerId: 1003, fullName: "Sam Vale", lastName: "Vale", position: "D" }, verifiedAliases: [],
    memberships: [{ teamId: 22, startsAt, endsAt: null, provenance: "synthetic team" }] },
  { identity: { playerId: 1004, fullName: "Émile St-Pierre", lastName: "St-Pierre", position: "LW" }, verifiedAliases: [], memberships: [] },
  { identity: { playerId: 1005, fullName: "Luc Del Bel", lastName: "Del Bel", position: "RW" }, verifiedAliases: [], memberships: [] },
];

export function offlineIdentityIndex(records = offlineIdentityRecords) {
  return indexPlayerIdentitySnapshot(buildPlayerIdentitySnapshot({ asOf: FIXTURE_AS_OF,
    provenance: "synthetic offline test only", completeness: { status: "partial", scope: "synthetic test people only", omittedRecords: null }, records }));
}

export function offlineIdentitySource(text: string, publishedAt: string | null = "2026-10-16T12:00:00Z"): FixtureIdentitySource {
  return { id: "fixture:retained-source", text, originalPostId: "synthetic-original", authorId: "fixture:reporter",
    url: "https://fixture.invalid/original", publishedAt, receivedAt: "2026-10-20T12:00:00Z",
    provenance: { kind: "synthetic", label: "Synthetic text, not an observed tweet", lineageKey: "fixture:original-relay-edit-lineage" } };
}

export function offlineIdentityMention(text: string, name: string, kind: FixtureIdentityMention["kind"] = "name", from = 0): FixtureIdentityMention {
  const start = text.indexOf(name, from);
  if (start < 0) throw new Error("fixture mention absent");
  return { id: `fixture:occurrence:${start}`, kind, span: { start, end: start + name.length, text: name }, teamHint: null, positionHint: null };
}

export function offlineIdentityReply(request: FixtureIdentityRequest,
  propose: (id: string, index: number) => { status: TweetIdentityProposalOutput["occurrences"][number]["status"]; canonicalId: string | null }
    = () => ({ status: "missing", canonicalId: null })): TweetIdentityProposalOutput {
  return { version: request.content.version, requestHash: request.hash, directoryHash: request.content.directory.hash,
    occurrences: request.content.occurrences.map((mention, index) => ({ occurrenceId: mention.id, evidence: mention.span,
      identityConfidence: "unknown", ...propose(mention.id, index) })) };
}
