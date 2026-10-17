import { extractDurableTweetClaims } from "../tweetClaimExtraction";
import { TWEET_LEGACY_SINKS, type TweetClaimEvidence } from "../tweetClaimEvidence";
import { extractTweetPlayerEvents } from "../tweetPlayerEvents";

export function qualifiedFixture() {
  const publishedAt = "2026-10-16T15:00:00Z", receivedAt = "2026-10-16T15:01:00Z", asOf = "2026-10-16T15:02:00Z";
  const text = "BOS Jeremy Swayman starts tonight.";
  const game = { id: 2026020010, date: "2026-10-16", startTime: "2026-10-16T23:00:00Z", homeTeamId: 6, awayTeamId: 10 };
  const source: any = { snapshotDate: game.date, team: { id: 6, abbreviation: "BOS", name: "Boston Bruins" }, gameId: game.id,
    tweetId: "1000", sourceUrl: "https://x.com/Reporter/status/1000", sourceHandle: "Reporter", rawText: text,
    tweetPostedAt: publishedAt, observedAt: receivedAt, nhlFilterStatus: "accepted", detectedLeague: "NHL", metadata: { interpretation: {
      version: "fixture", context: "game", certainty: "confirmed", units: [], unresolved: [], identityContext: { basis: "current_membership", sourcePublishedAt: publishedAt },
      events: extractTweetPlayerEvents({ text, players: [{ playerId: 8478499, fullName: "Jeremy Swayman", lastName: "Swayman", position: "G", teamId: 6 }], publishedAt, includeClaimAnchors: true }) } } };
  const claims = extractDurableTweetClaims({ source, game, interpretedAt: asOf });
  const evidence: TweetClaimEvidence = { readAt: asOf, identities: [{ gameId: game.id, date: game.date, playerId: 8478499, teamId: 6,
    league: "NHL", fullName: "Jeremy Swayman", role: "goalie", knownAt: "2026-10-16T14:00:00Z",
    sourceUrl: `https://api-web.nhle.com/v1/gamecenter/${game.id}/play-by-play`, rawPayloadId: "25", rawPayloadHash: "a".repeat(64), normalizationFingerprint: "b".repeat(64) }],
    history: { status: "complete", from: "2026-10-16T00:00:00Z", through: "2026-10-17T00:00:00Z", basis: "fixture-only isolated empty legacy scope",
      retentionEvidence: "fixture cluster created empty; no deleted rows", writerFenceEvidence: "fixture has no legacy writers" },
    sinks: TWEET_LEGACY_SINKS.map(sink => ({ sink, complete: true, rows: [] })) };
  return { source, game, claims, evidence, asOf };
}
